"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { getAccount, getWorkspaceId } from "@/lib/auth";
import { extractList, getCategoryLabel } from "@/lib/data-utils";
import { endpoints } from "@/lib/endpoints";
import { useSidebar } from "../context/SidebarContext";
import {
  BoxCubeIcon,
  CalenderIcon,
  ChevronDownIcon,
  GridIcon,
  ListIcon,
  PageIcon,
  PieChartIcon,
  GroupIcon,
  PlugInIcon,
  TableIcon,
  UserCircleIcon,
} from "../icons/index";
import { Badge, Popover, Tooltip } from "antd";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  badgeCount?: number;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean; order?: number; badgeCount?: number }[];
};

type CategoryMenu = {
  id?: string;
  uuid?: string;
  name?: string;
  title?: string;
  code?: string;
};

type DynamicFeature = {
  name: string;
  path: string;
  groupName: string;
  enabled: boolean;
  requiredPermissionCode?: string | null;
  requiresSuperAdmin?: boolean;
  requiresWorkspaceAdmin?: boolean;
  orderIndex?: number;
  icon?: string;
  uuid?: string;
};

type TaskReminderResponse = {
  remind?: number;
};

type MenuType = "main" | "others";

const isTruthyBooleanLike = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value === 1;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }
  return false;
};

const parsePositiveInt = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
};

const getWorkspaceEntryId = (workspace: unknown): string => {
  if (!workspace || typeof workspace !== "object") {
    return "";
  }

  const workspaceRecord = workspace as Record<string, unknown>;
  const directId = workspaceRecord.id ?? workspaceRecord.uuid;
  if (typeof directId === "string" && directId.trim()) {
    return directId;
  }

  const nestedWorkspace = workspaceRecord.workspace;
  if (nestedWorkspace && typeof nestedWorkspace === "object") {
    const nestedRecord = nestedWorkspace as Record<string, unknown>;
    const nestedId = nestedRecord.id ?? nestedRecord.uuid;
    if (typeof nestedId === "string" && nestedId.trim()) {
      return nestedId;
    }
  }

  return "";
};

const getWorkspaceEntryRoleId = (workspace: unknown): number | null => {
  if (!workspace || typeof workspace !== "object") {
    return null;
  }

  const workspaceRecord = workspace as Record<string, unknown>;
  const directRole =
    workspaceRecord.role && typeof workspaceRecord.role === "object"
      ? (workspaceRecord.role as Record<string, unknown>)
      : null;

  const membershipRecord =
    workspaceRecord.membership && typeof workspaceRecord.membership === "object"
      ? (workspaceRecord.membership as Record<string, unknown>)
      : null;

  const membershipRole =
    membershipRecord?.role && typeof membershipRecord.role === "object"
      ? (membershipRecord.role as Record<string, unknown>)
      : null;

  return (
    parsePositiveInt(workspaceRecord.roleId) ??
    parsePositiveInt(directRole?.id) ??
    parsePositiveInt(membershipRecord?.roleId) ??
    parsePositiveInt(membershipRole?.id) ??
    null
  );
};

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, setIsHovered, toggleMobileSidebar, setActiveItem } = useSidebar();
  const pathname = usePathname();
  const selectedWorkspaceId = getWorkspaceId();
  const [categoryMenuItems, setCategoryMenuItems] = useState<
    { name: string; path: string; pro?: boolean; new?: boolean }[]
  >([
    { name: "Danh mục đơn vị", path: "/danh-muc/don-vi" },
  ]);
  const [dynamicFeatures, setDynamicFeatures] = useState<DynamicFeature[]>([]);
  const [roleAccessibleFeatures, setRoleAccessibleFeatures] = useState<Set<string>>(new Set());
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [assignedTaskReminderCount, setAssignedTaskReminderCount] = useState(0);

  const { isSuperAdmin, isWorkspaceAdmin, currentRoleId } = (() => {
    const account = getAccount();
    const memberships = Array.isArray(account?.memberships) ? account.memberships : [];
    const workspaces = Array.isArray(account?.workspaces) ? account.workspaces : [];

    let foundRoleId: number | null = null;
    let hasWorkspaceAdmin = false;

    memberships.forEach((membership) => {
      if (foundRoleId) {
        return;
      }

      if (!membership || typeof membership !== "object") {
        return;
      }

      const membershipRecord = membership as Record<string, unknown>;
      const directWorkspaceId =
        typeof membershipRecord.workspaceId === "string" ? membershipRecord.workspaceId : "";
      const nestedWorkspace =
        membershipRecord.workspace && typeof membershipRecord.workspace === "object"
          ? (membershipRecord.workspace as Record<string, unknown>)
          : null;
      const nestedWorkspaceId =
        typeof nestedWorkspace?.id === "string"
          ? nestedWorkspace.id
          : typeof nestedWorkspace?.uuid === "string"
            ? nestedWorkspace.uuid
            : "";

      const workspaceId = directWorkspaceId || nestedWorkspaceId;
      const matchesSelectedWorkspace = !selectedWorkspaceId || workspaceId === selectedWorkspaceId;

      if (!matchesSelectedWorkspace) {
        return;
      }

      const roleRecord =
        membershipRecord.role && typeof membershipRecord.role === "object"
          ? (membershipRecord.role as Record<string, unknown>)
          : null;
      const membershipRoleId =
        parsePositiveInt(membershipRecord.roleId) ??
        parsePositiveInt(roleRecord?.id);

      if (membershipRoleId) {
        foundRoleId = membershipRoleId;
      }

      if (isTruthyBooleanLike(membershipRecord.isAdmin)) {
        hasWorkspaceAdmin = true;
      }
    });

    workspaces.forEach((workspace) => {
      if (!workspace || typeof workspace !== "object") {
        return;
      }

      const workspaceRecord = workspace as Record<string, unknown>;
      const workspaceId = getWorkspaceEntryId(workspace);
      const matchesSelectedWorkspace = !selectedWorkspaceId || workspaceId === selectedWorkspaceId;
      const membership = workspaceRecord.membership;
      const membershipRecord =
        membership && typeof membership === "object"
          ? (membership as Record<string, unknown>)
          : null;
      const membershipIsAdmin = isTruthyBooleanLike(membershipRecord?.isAdmin);
      const membershipRoleId = getWorkspaceEntryRoleId(workspaceRecord);

      if (!foundRoleId && matchesSelectedWorkspace && membershipRoleId) {
        foundRoleId = membershipRoleId;
      }

      if (matchesSelectedWorkspace && membershipIsAdmin) {
        hasWorkspaceAdmin = true;
      }
    });

    // Fallback when selected workspace is not resolved but account still has memberships.
    if (!foundRoleId) {
      workspaces.some((workspace) => {
        if (!workspace || typeof workspace !== "object") {
          return false;
        }

        const membershipRoleId = getWorkspaceEntryRoleId(workspace);

        if (membershipRoleId) {
          foundRoleId = membershipRoleId;
          return true;
        }

        return false;
      });
    }

    return {
      isSuperAdmin: Boolean(account?.isSuperAdmin),
      isWorkspaceAdmin: hasWorkspaceAdmin,
      currentRoleId: foundRoleId,
    };
  })();

  useEffect(() => {
    const loadCategoriesAndFeatures = async () => {
      setIsLoadingMenu(true);

      try {
        const data = await api.get<unknown>(endpoints.admin.categories);
        const categories = extractList<CategoryMenu>(data);

        const dynamicCategoryItems = categories
          .map((category) => {
            const id = String(category.id ?? category.uuid ?? "");
            if (!id) {
              return null;
            }

            const label = getCategoryLabel(category as Record<string, unknown>) || `Danh mục ${id}`;

            return {
              name: label,
              path: `/danh-muc/cat-${id}`,
            };
          })
          .filter(Boolean) as { name: string; path: string }[];

        setCategoryMenuItems([
          { name: "Danh mục đơn vị", path: "/danh-muc/don-vi" },
          ...dynamicCategoryItems,
        ]);
      } catch {
        setCategoryMenuItems([
          { name: "Danh mục đơn vị", path: "/danh-muc/don-vi" },
        ]);
      }

      // Load features from API
      if (isSuperAdmin) {
        try {
          const featuresData = await api.get<unknown>(endpoints.admin.features);
          const features = extractList<Record<string, unknown>>(featuresData);

          const enabledFeatures = features
            .filter((f) => {
              if (typeof f !== "object" || f === null) return false;
              const fRecord = f as Record<string, unknown>;
              return fRecord.enabled === true;
            })
            .map((f) => {
              const fRecord = f as Record<string, unknown>;
              return {
                name: String(fRecord.name ?? ""),
                path: String(fRecord.path ?? ""),
                groupName: String(fRecord.groupName ?? ""),
                enabled: fRecord.enabled === true,
                requiredPermissionCode:
                  typeof fRecord.requiredPermissionCode === "string"
                    ? fRecord.requiredPermissionCode
                    : null,
                requiresSuperAdmin: fRecord.requiresSuperAdmin === true,
                requiresWorkspaceAdmin: fRecord.requiresWorkspaceAdmin === true,
                orderIndex: typeof fRecord.orderIndex === "number" ? fRecord.orderIndex : undefined,
                icon: typeof fRecord.icon === "string" ? fRecord.icon : undefined,
                uuid: typeof fRecord.uuid === "string" ? fRecord.uuid : undefined,
              } as DynamicFeature & { uuid?: string };
            });

          setDynamicFeatures(enabledFeatures as DynamicFeature[]);
          setRoleAccessibleFeatures(
            new Set(
              enabledFeatures
                .map((feature) => feature.uuid)
                .filter((id): id is string => typeof id === "string")
            )
          );
        } catch (error) {
          console.error("Failed to load features:", error);
          setDynamicFeatures([]);
          setRoleAccessibleFeatures(new Set());
        }
      } else if (currentRoleId) {
        try {
          const roleFeatsData = await api.get<unknown>(`/admin/roles/${currentRoleId}/features`);
          const roleFeats = extractList<Record<string, unknown>>(roleFeatsData);

          const mappedFeatures = roleFeats
            .map((feat) => {
              const nestedFeature =
                feat.feature && typeof feat.feature === "object"
                  ? (feat.feature as Record<string, unknown>)
                  : null;

              if (!nestedFeature) {
                return null;
              }

              return {
                name: String(nestedFeature.name ?? ""),
                path: String(nestedFeature.path ?? ""),
                groupName: String(nestedFeature.groupName ?? ""),
                enabled: nestedFeature.enabled === true,
                requiredPermissionCode:
                  typeof nestedFeature.requiredPermissionCode === "string"
                    ? nestedFeature.requiredPermissionCode
                    : null,
                requiresSuperAdmin: nestedFeature.requiresSuperAdmin === true,
                requiresWorkspaceAdmin: nestedFeature.requiresWorkspaceAdmin === true,
                orderIndex: typeof nestedFeature.orderIndex === "number" ? nestedFeature.orderIndex : undefined,
                icon: typeof nestedFeature.icon === "string" ? nestedFeature.icon : undefined,
                uuid: typeof nestedFeature.uuid === "string" ? nestedFeature.uuid : undefined,
              } as DynamicFeature & { uuid?: string };
            })
            .filter((feature): feature is DynamicFeature & { uuid?: string } => Boolean(feature))
            .filter((feature) => feature.enabled === true);

          setDynamicFeatures(mappedFeatures);
          setRoleAccessibleFeatures(
            new Set(
              mappedFeatures
                .map((feature) => feature.uuid)
                .filter((id): id is string => typeof id === "string")
            )
          );
        } catch (error) {
          console.error("Failed to load role features:", error);
          setDynamicFeatures([]);
          setRoleAccessibleFeatures(new Set());
        }
      } else {
        setDynamicFeatures([]);
        setRoleAccessibleFeatures(new Set());
      }

      setIsLoadingMenu(false);
    };

    void loadCategoriesAndFeatures();
  }, [isSuperAdmin, selectedWorkspaceId, currentRoleId]);

  useEffect(() => {
    const loadTaskReminder = async () => {
      try {
        const response = await api.get<TaskReminderResponse>(endpoints.admin.tasksReminder);
        setAssignedTaskReminderCount(Number(response?.remind ?? 0));
      } catch (error) {
        setAssignedTaskReminderCount(0);
      }
    };

    void loadTaskReminder();
  }, [selectedWorkspaceId]);

  // Memoized icon factory
  const getIcon = useCallback((iconName?: string | null): React.ReactNode => {
    const iconMap: Record<string, React.ReactNode> = {
      GridIcon: <GridIcon />,
      UserCircleIcon: <UserCircleIcon />,
      CalenderIcon: <CalenderIcon />,
      ListIcon: <ListIcon />,
      TableIcon: <TableIcon />,
      PieChartIcon: <PieChartIcon />,
      PageIcon: <PageIcon />,
      PlugInIcon: <PlugInIcon />,
      BoxCubeIcon: <BoxCubeIcon />,
    };
    if (!iconName) return <PageIcon />;
    return iconMap[iconName] ?? <PageIcon />;
  }, []);

  const canAccessFeature = useCallback(
    (feature: DynamicFeature & { uuid?: string }) => {
      // Super admin can bypass role-feature mapping.
      if (isSuperAdmin) {
        return true;
      }

      // For non-super-admin users, role context is required to enforce assigned features.
      if (!currentRoleId) {
        return false;
      }

      const featureUuid = feature.uuid;
      if (!featureUuid || !roleAccessibleFeatures.has(featureUuid)) {
        return false;
      }

      // Non-super-admin users rely only on assigned role features.
      return true;
    },
    [isSuperAdmin, roleAccessibleFeatures, currentRoleId]
  );

  const navItems = useMemo<NavItem[]>(() => {
    const mainFeatures = dynamicFeatures
      .filter((f) => f.groupName === "main")
      .filter((feature) => canAccessFeature(feature))
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

    return mainFeatures.map((feature) => {
      if (feature.path === "/bao-cao") {
        const reportSubItems = dynamicFeatures
          .filter((f) => f.groupName === "reports")
          .filter((feature) => canAccessFeature(feature))
          .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
          .map((f) => ({
            name: f.name,
            path: f.path,
            pro: false,
            order: f.orderIndex ?? Number.MAX_SAFE_INTEGER,
          }));

        return {
          icon: getIcon(feature.icon),
          name: feature.name,
          path: feature.path,
          subItems: reportSubItems,
        };
      }

      return {
        icon: getIcon(feature.icon),
        name: feature.name,
        path: feature.path,
        badgeCount: feature.path === "/nhiem-vu-duoc-giao" ? assignedTaskReminderCount : undefined,
      };
    });
  }, [dynamicFeatures, getIcon, canAccessFeature, assignedTaskReminderCount]);

  const adminSubItems = useMemo(() => {
    const dynamicAdminFeatures = dynamicFeatures
      .filter((f) => f.groupName === "admin")
      .filter((feature) => canAccessFeature(feature))
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((f) => ({
        name: f.name,
        path: f.path,
        pro: false,
        order: f.orderIndex ?? Number.MAX_SAFE_INTEGER,
      }));

    return dynamicAdminFeatures;
  }, [dynamicFeatures, canAccessFeature]);

  const systemSubItems = useMemo(() => {
    const systemFeatures = dynamicFeatures
      .filter((f) => f.groupName === "system")
      .filter((feature) => canAccessFeature(feature))
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((f) => ({
        name: f.name,
        path: f.path,
        pro: false,
        order: f.orderIndex ?? Number.MAX_SAFE_INTEGER,
      }));

    return systemFeatures.sort((a, b) => {
      const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });
  }, [dynamicFeatures, canAccessFeature]);

  const povertySubItems = useMemo(() => {
    return dynamicFeatures
      .filter((f) => f.groupName === "poverty")
      .filter((feature) => canAccessFeature(feature))
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((feature) => ({
        name: feature.name,
        path: feature.path,
        pro: false,
        order: feature.orderIndex ?? Number.MAX_SAFE_INTEGER,
      }));
  }, [dynamicFeatures, canAccessFeature]);

  const primaryNavItems = useMemo<NavItem[]>(() => {
    if (povertySubItems.length === 0) {
      return navItems;
    }

    const povertyGroup: NavItem = {
      icon: <GroupIcon />,
      name: "Hộ nghèo",
      subItems: povertySubItems,
    };
    const overviewIndex = navItems.findIndex((item) => {
      const normalizedName = item.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

      return normalizedName === "tong quan";
    });
    const insertIndex = overviewIndex >= 0 ? overviewIndex + 1 : Math.min(1, navItems.length);

    return [
      ...navItems.slice(0, insertIndex),
      povertyGroup,
      ...navItems.slice(insertIndex),
    ];
  }, [navItems, povertySubItems]);

  const categoryFeatureItems = useMemo(() => {
    return dynamicFeatures
      .filter((f) => f.groupName === "categories")
      .filter((feature) => canAccessFeature(feature))
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }, [dynamicFeatures, canAccessFeature]);

  const canViewCategoryMenu = useMemo(() => {
    if (isSuperAdmin) {
      return true;
    }
    return categoryFeatureItems.length > 0;
  }, [isSuperAdmin, categoryFeatureItems]);

  const canViewAdminMenu = adminSubItems.length > 0;

  const othersItems = useMemo<NavItem[]>(
    () => [
      ...(canViewAdminMenu
        ? [
          {
            icon: <BoxCubeIcon />,
            name: "Quản trị",
            subItems: adminSubItems,
          },
        ]
        : []),
      ...(systemSubItems.length > 0
        ? [
          {
            icon: <PlugInIcon />,
            name: "Hệ thống",
            subItems: systemSubItems,
          },
        ]
        : []),
    ],
    [adminSubItems, canViewAdminMenu, systemSubItems]
  );

  const othersItemsWithCategories = useMemo<NavItem[]>(
    () => [
      ...(canViewCategoryMenu
        ? [
          {
            name: "Danh mục",
            icon: <PageIcon />,
            subItems: categoryMenuItems,
          },
        ]
        : []),
      ...othersItems,
    ],
    [canViewCategoryMenu, categoryMenuItems, othersItems]
  );

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: MenuType;
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback((path: string) => {
    if (!path) return false;
    const normalizedParent = path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;
    // Root path should only match exactly '/'
    if (normalizedParent === "/") {
      return pathname === "/";
    }
    if (normalizedParent === pathname) return true;
    return pathname.startsWith(`${normalizedParent}/`);
  }, [pathname]);

  const getBestActiveSubItemPath = useCallback((subItems?: NavItem["subItems"]) => {
    if (!subItems?.length) {
      return null;
    }

    const activePaths = subItems
      .map((subItem) => {
        const normalizedPath = subItem.path.endsWith("/") && subItem.path !== "/" ? subItem.path.slice(0, -1) : subItem.path;
        if (normalizedPath === "/") {
          return pathname === "/" ? normalizedPath : null;
        }
        if (pathname === normalizedPath || pathname.startsWith(`${normalizedPath}/`)) {
          return normalizedPath;
        }
        return null;
      })
      .filter((path): path is string => Boolean(path));

    return activePaths.sort((a, b) => b.length - a.length)[0] ?? null;
  }, [pathname]);

  const isSubItemActive = useCallback((subItemPath: string, subItems?: NavItem["subItems"]) => {
    const normalizedPath = subItemPath.endsWith("/") && subItemPath !== "/" ? subItemPath.slice(0, -1) : subItemPath;
    return getBestActiveSubItemPath(subItems) === normalizedPath;
  }, [getBestActiveSubItemPath]);

  const handleSubmenuToggle = useCallback((index: number, menuType: MenuType) => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  }, []);

  const handleMobileNavigate = useCallback(() => {
    if (isMobileOpen) {
      toggleMobileSidebar();
    }
  }, [isMobileOpen, toggleMobileSidebar]);

  const isCollapsedDesktop = !isExpanded && !isMobileOpen;

  const isSubmenuActive = useCallback(
    (subItems?: NavItem["subItems"]) =>
      Boolean(getBestActiveSubItemPath(subItems)),
    [getBestActiveSubItemPath]
  );

  const renderCollapsedSubmenuTrigger = useCallback(
    (nav: NavItem) => {
      if (!nav.subItems?.length) {
        return null;
      }

      const items = nav.subItems.map((subItem) => ({
        key: subItem.path,
        label: (
          <Link
            href={subItem.path}
            onClick={handleMobileNavigate}
            className={`flex text-black min-w-[180px] items-center gap-2 ${isSubItemActive(subItem.path, nav.subItems) ? "text-[#b91c1c] font-medium" : ""}`}
          >
            <span className="flex-1 text-black">{subItem.name}</span>
            {typeof subItem.badgeCount === "number" && subItem.badgeCount > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#fee2e2] px-1.5 py-0.5 text-[11px] font-semibold text-[#b91c1c]">
                {subItem.badgeCount}
              </span>
            ) : null}
          </Link>
        ),
      }));

      const isActiveMenu = isSubmenuActive(nav.subItems);

      return (
        <Popover
          content={<div className="min-w-[220px]">{items.map((item) => <div key={String(item.key)} className="py-1">{item.label}</div>)}</div>}
          placement="rightTop"
          trigger="hover"
          classNames={
            {
              root: 'controller-select-dropdown'
            }
          }
        >
          <button
            className={`menu-item group flex w-full items-center justify-center rounded mb-1 px-3 py-2.5 text-[14px] relative ${isActiveMenu ? "bg-white border-l-4 border-[#dc2626]" : "hover:bg-white/50"}`}
            type="button"
          >
            <span className={` ${isActiveMenu ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>
              {nav.icon}
            </span>
          </button>
        </Popover>
      );
    },
    [handleMobileNavigate, isSubItemActive, isSubmenuActive]
  );

  const renderMenuItems = useCallback(
    (navItems: NavItem[], menuType: MenuType) => (
      <ul className="flex flex-col gap-2">
        {navItems.map((nav, index) => (
          <li key={`${menuType}-${index}-${nav.path ?? nav.name}`}>
            {nav.subItems ? (
              isCollapsedDesktop ? (
                renderCollapsedSubmenuTrigger(nav)
              ) : (
                <button
                  onClick={() => handleSubmenuToggle(index, menuType)}
                  className={`menu-item group px-3 py-2.5 rounded mb-1 text-[14px] relative gap-3  ${openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "rounded mb-1 relative gap-3 bg-white border-l-4 border-[#dc2626]"
                    : "hover:bg-white/50"
                    } cursor-pointer lg:justify-start`}
                  type="button"
                >
                  <span
                    className={` ${openSubmenu?.type === menuType && openSubmenu?.index === index
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                      }`}
                  >
                    {nav.icon}
                  </span>
                  {(isExpanded || isMobileOpen) && (
                    <span className={`menu-item-text`}>{nav.name}</span>
                  )}
                  {(isExpanded || isMobileOpen) && (
                    <ChevronDownIcon
                      className={`ml-auto w-5 h-5 transition-transform duration-200  ${openSubmenu?.type === menuType && openSubmenu?.index === index
                        ? "rotate-180 text-brand-500"
                        : ""
                        }`}
                    />
                  )}
                </button>
              )
            ) : (
              nav.path && (
                isCollapsedDesktop ? (
                  <Tooltip title={nav.name} placement="right">
                    <Link
                      href={nav.path}
                      onClick={handleMobileNavigate}
                      className={`menu-item group flex items-center justify-center px-3 py-2.5 rounded mb-1 text-[14px] relative ${isActive(nav.path)
                        ? "rounded mb-1 relative bg-white border-l-4 border-[#dc2626]"
                        : "hover:bg-white/50"
                        }`}
                    >
                      <span>{nav.icon}</span>
                    </Link>
                  </Tooltip>
                ) : (
                  <Link
                    href={nav.path}
                    onClick={handleMobileNavigate}
                    className={`menu-item group flex items-center px-3 py-2.5 rounded mb-1 text-[14px] relative gap-3 ${isActive(nav.path)
                      ? "rounded mb-1 relative gap-3 bg-white border-l-4 border-[#dc2626]"
                      : "hover:bg-white/50"
                      }`}
                  >
                    <span>{nav.icon}</span>
                    {(isExpanded || isMobileOpen) && (
                      <span className={`menu-item-text`}>{nav.name}</span>
                    )}
                    {(isExpanded || isMobileOpen) &&
                      typeof nav.badgeCount === "number" &&
                      nav.badgeCount > 0 && (
                        <Badge count={nav.badgeCount} />
                      )}
                  </Link>
                )
              )
            )}
            {nav.subItems && (isExpanded || isMobileOpen) && (
              <div
                ref={(el) => {
                  subMenuRefs.current[`${menuType}-${index}`] = el;
                }}
                className="overflow-hidden transition-all duration-300"
                style={{
                  height:
                    openSubmenu?.type === menuType && openSubmenu?.index === index
                      ? `${subMenuHeight[`${menuType}-${index}`]}px`
                      : "0px",
                }}
              >
                <ul className="mt-2 space-y-1 ml-9">
                  {nav.subItems.map((subItem) => {
                    const subItemActive = isSubItemActive(subItem.path, nav.subItems);

                    return (
                      <li key={subItem.path}>
                        <Link
                          href={subItem.path}
                          onClick={handleMobileNavigate}
                          className={`menu-dropdown-item menu-item group text-xs flex items-center px-3 py-2.5 rounded mb-1 relative gap-3 ${subItemActive
                            ? "menu-dropdown-item-active rounded mb-1 relative gap-3 bg-white border-l-4 border-[#dc2626]"
                            : "menu-dropdown-item-inactive"
                            }`}
                        >
                          {subItem.name}
                          <span className="flex items-center gap-1 ml-auto">
                            {subItem.new && (
                              <span
                                className={`ml-auto ${subItemActive
                                  ? "menu-dropdown-badge-active"
                                  : "menu-dropdown-badge-inactive"
                                  } menu-dropdown-badge `}
                              >
                                new
                              </span>
                            )}
                            {subItem.pro && (
                              <span
                                className={`ml-auto ${subItemActive
                                  ? "menu-dropdown-badge-active"
                                  : "menu-dropdown-badge-inactive"
                                  } menu-dropdown-badge `}
                              >
                                pro
                              </span>
                            )}
                            {typeof subItem.badgeCount === "number" && subItem.badgeCount > 0 && (
                              <span
                                className={`ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${subItemActive
                                  ? "bg-[#dc2626] text-white"
                                  : "bg-[#fee2e2] text-[#b91c1c]"
                                  }`}
                              >
                                {subItem.badgeCount}
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    ),
    [isCollapsedDesktop, isExpanded, isMobileOpen, openSubmenu, subMenuHeight, subMenuRefs, isActive, isSubItemActive, handleSubmenuToggle, handleMobileNavigate, renderCollapsedSubmenuTrigger]
  );

  const renderMenuSkeleton = useCallback(() => (
    <ul className="flex flex-col gap-2">
      {[...Array(5)].map((_, index) => (
        <li key={`skeleton-${index}`} className="animate-pulse">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded mb-1">
            <div className="w-5 h-5 bg-gray-300 dark:bg-gray-700 rounded" />
            {(isExpanded || isMobileOpen) && (
              <div className="flex-1 h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
            )}
          </div>
        </li>
      ))}
    </ul>
  ), [isExpanded, isMobileOpen]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      let nextOpenSubmenu: { type: MenuType; index: number } | null = null;
      let submenuMatched = false;

      (["main", "others"] as const).forEach((menuType) => {
        const items = menuType === "main" ? primaryNavItems : othersItemsWithCategories;
        items.forEach((nav, index) => {
          if (getBestActiveSubItemPath(nav.subItems)) {
            nextOpenSubmenu = { type: menuType, index };
            submenuMatched = true;
          }
        });
      });

      setOpenSubmenu(submenuMatched ? nextOpenSubmenu : null);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [getBestActiveSubItemPath, primaryNavItems, othersItemsWithCategories]);

  // Update active page title in SidebarContext so header can display current title
  useEffect(() => {
    // prefer parent name when current path matches a subItem
    let foundTitle: string | null = null;

    // Search all independently rendered sidebar groups.
    const searchMenus = (items: NavItem[]) => {
      for (const nav of items) {
        if (nav.subItems && nav.subItems.length > 0) {
          for (const sub of nav.subItems) {
            if (sub.path === pathname || pathname.startsWith(`${sub.path}/`)) {
              return nav.name; // parent name
            }
          }
        }
        if (nav.path && (nav.path === pathname || pathname.startsWith(`${nav.path}/`))) {
          return nav.name;
        }
      }
      return null;
    };

    foundTitle = searchMenus(primaryNavItems)
      || searchMenus(othersItemsWithCategories)
      || null;

    // fallback: if path corresponds to category dynamic items, othersItemsWithCategories already includes them
    setActiveItem(foundTitle);
  }, [pathname, primaryNavItems, othersItemsWithCategories, setActiveItem]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  return (
    <aside
      className={`fixed top-0 left-0 z-1000 mt-0 md:mt-8 pt-18 flex h-screen flex-col border-r  border-gray-300 bg-[#f5ebe0] px-2 py-2 text-gray-900 stransition-all duration-300 ease-in-out dark:border-brand-900/40 dark:bg-gray-900 lg:z-1 lg:mt-0 
        ${isExpanded || isMobileOpen
          ? "w-[290px]"
          : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => setIsHovered(false)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-1">
            <div>
              {isLoadingMenu ? renderMenuSkeleton() : renderMenuItems(primaryNavItems, "main")}
            </div>

            <div>
              {isLoadingMenu ? renderMenuSkeleton() : renderMenuItems(othersItemsWithCategories, "others")}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default React.memo(AppSidebar);
