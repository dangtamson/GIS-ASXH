"use client";

import {App} from "antd";
import {useCallback, useEffect, useState} from "react";

import {api, ApiError} from "@/lib/api";
import {extractList, getRowId} from "@/lib/data-utils";
import {endpoints} from "@/lib/endpoints";

import ActionIcon from "@/components/controller/ActionIcon";
import {
    ActionButton,
    ActionModal,
    AppInput,
    ConfirmModal,
    FilterSpace,
    SearchBox,
    TitleSpace,
} from "@/components/controller";

type Permission = {
  id?: string | number;
  uuid?: string;
  name?: string;
  code?: string;
  module?: string;
  description?: string;
  status?: string;
  [key: string]: unknown;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

function normalizeStatus(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["inactive", "disabled", "ngung", "ngưng"].includes(normalized)) {
    return "Ngưng";
  }
  if (!normalized) {
    return "Hoạt động";
  }
  return normalized;
}

function statusBadgeClass(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["inactive", "disabled", "ngung", "ngưng"].includes(normalized)) {
    return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  }
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
}

function extractPagination(input: unknown): PaginationMeta | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const root = input as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const pagination =
    data.pagination && typeof data.pagination === "object"
      ? (data.pagination as Record<string, unknown>)
      : null;

  if (!pagination) {
    return null;
  }

  return {
    page: Number(pagination.page ?? 1) || 1,
    limit: Number(pagination.limit ?? 10) || 10,
    total: Number(pagination.total ?? 0) || 0,
    pages: Number(pagination.pages ?? 1) || 1,
  };
}

const emptyForm = {
  code: "",
  name: "",
  module: "",
  status: "Hoạt động",
  description: "",
};

export default function QuanLyQuyenPage() {
  const { notification } = App.useApp();

  const [items, setItems] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const [formValues, setFormValues] = useState<Record<string, string>>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(rowsPerPage),
        sortBy: "id",
        sortOrder: "desc",
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const data = await api.get<unknown>(`${endpoints.admin.permissions}?${params.toString()}`);
      const nextItems = extractList<Permission>(data);
      const pagination = extractPagination(data);

      setItems(nextItems);
      setTotalItems(pagination?.total ?? nextItems.length);
    } catch (err) {
      notification.error({
        title: "Lỗi",
        description:
          err instanceof ApiError ? err.message : "Không thể tải danh sách quyền.",
      });
      setItems([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [notification, page, rowsPerPage, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

  useEffect(() => {
    setPage(1);
  }, [search, rowsPerPage]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openCreateModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormValues(emptyForm);
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (item: Permission) => {
    const id = getRowId(item);

    setIsEditMode(true);
    setEditingId(id);
    setFormValues({
      code: String(item.code ?? ""),
      name: String(item.name ?? ""),
      module: String(item.module ?? ""),
      status: normalizeStatus(item.status),
      description: String(item.description ?? ""),
    });
    setFormErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setFormErrors({});
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!formValues.code?.trim()) {
      nextErrors.code = "Mã quyền không được để trống";
    }

    if (!formValues.name?.trim()) {
      nextErrors.name = "Tên quyền không được để trống";
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCreateOrUpdate = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const payload = {
        code: (formValues.code || "").trim().toUpperCase(),
        name: (formValues.name || "").trim(),
        module: (formValues.module || "").trim(),
        status: formValues.status || "Hoạt động",
        description: (formValues.description || "").trim(),
      };

      if (isEditMode && editingId) {
        await api.patch<unknown>(`${endpoints.admin.permissions}/${editingId}`, payload);
      } else {
        await api.post<unknown>(endpoints.admin.permissions, payload);
      }

      setShowModal(false);
      setFormValues(emptyForm);

      notification.success({
        title: "Thành công",
        description: isEditMode
          ? "Cập nhật quyền thành công."
          : "Tạo quyền thành công.",
      });

      await loadData();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : isEditMode
            ? "Không thể cập nhật quyền."
            : "Không thể tạo quyền.";

      setFormErrors({ submit: message });

      notification.error({
        title: "Lỗi",
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setSaving(true);

    try {
      await api.delete<unknown>(`${endpoints.admin.permissions}/${deleteTarget.id}`);
      setDeleteTarget(null);

      notification.success({
        title: "Thành công",
        description: "Đã xóa quyền.",
      });

      await loadData();
    } catch (err) {
      notification.error({
        title: "Lỗi",
        description:
          err instanceof ApiError ? err.message : "Không thể xóa quyền.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <TitleSpace
        title="Quản lý quyền"
        description="Quản lý các quyền và mô tả quyền trong hệ thống."
        actions={
          <div className="flex items-center gap-2">
            <ActionButton type="create" label="Thêm quyền" onClick={openCreateModal} />
          </div>
        }
      />

      <FilterSpace
        actionsPosition="bottom-right"
        actions={
          <>
            <ActionButton
              type="refresh"
              onClick={() => {
                setSearch("");
                setPage(1);
                void loadData();
              }}
            />
            <ActionButton
              type="search"
              onClick={() => {
                setPage(1);
                void loadData();
              }}
            />
          </>
        }
      >
        <SearchBox
          value={search}
          bold
          placeholder="Tìm theo mã, tên, mô tả"
          onChange={setSearch}
        />
      </FilterSpace>

      <div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Không có quyền phù hợp.
          </p>
        ) : (
          <>
            <div className="data-table-shell md:block">
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead className="data-table-head">
                    <tr>
                      <th className="data-table-th">STT</th>
                      <th className="data-table-th">Mã quyền</th>
                      <th className="data-table-th">Tên quyền</th>
                      <th className="data-table-th">Mô tả</th>
                      <th className="data-table-th">Trạng thái</th>
                      <th className="data-table-th-action">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const id = getRowId(item);
                      const label = String(item.name || item.code || id);

                      return (
                        <tr key={id} className="data-table-row">
                          <td className="data-table-cell">{index + 1}</td>
                          <td className="data-table-cell font-medium text-gray-900 dark:text-white">
                            {item.code || "-"}
                          </td>
                          <td className="data-table-cell">{item.name || "-"}</td>
                          <td className="data-table-cell text-gray-600 dark:text-gray-300">
                            {item.description || "-"}
                          </td>
                          <td className="data-table-cell">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}
                            >
                              {normalizeStatus(item.status)}
                            </span>
                          </td>
                          <td className="data-table-cell">
                            <div className="flex items-center gap-2">
                              <button onClick={() => openEditModal(item)} title="Sửa">
                                <ActionIcon action="edit" />
                              </button>
                              <button onClick={() => setDeleteTarget({ id, label })} title="Xóa">
                                <ActionIcon action="delete" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* <div className="grid grid-cols-1 gap-3 md:hidden">
              {items.map((item) => {
                const id = getRowId(item);
                const label = String(item.name || item.code || id);

                return (
                  <div key={id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-base font-semibold text-gray-900 dark:text-white">
                        {item.name || item.code || "-"}
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}
                      >
                        {normalizeStatus(item.status)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Mã: {item.code || "-"}
                    </p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {item.description || "Không có mô tả"}
                    </p>

                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button onClick={() => openEditModal(item)}>
                        <ActionIcon action="edit" />
                        Sửa
                      </button>
                      <button onClick={() => setDeleteTarget({ id, label })}>
                        <ActionIcon action="delete" />
                        Xóa
                      </button>
                    </div>
                  </div>
                );
              })}
            </div> */}

            <div className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-4 text-sm dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <span>Hiển thị</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  {[10, 20, 50].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <span>dòng/trang</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Trước
                </button>
                <span className="text-gray-600 dark:text-gray-300">
                  Trang {page}/{totalPages}
                </span>
                <button
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Sau
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <ActionModal
        open={showModal}
        title={isEditMode ? "Cập nhật" : "Thêm mới"}
        okText={saving ? "Đang lưu..." : "Lưu"}
        cancelText="Đóng"
        loading={saving}
        spinning={saving}
        variant="danger"
        width={900}
        onOk={() => void handleCreateOrUpdate()}
        onCancel={closeModal}
      >
        {formErrors.submit ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {formErrors.submit}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Mã quyền <span className="text-red-500">*</span>
            </div>
            <AppInput
              hideTitle
              value={formValues.code}
              onChange={(nextValue) =>
                setFormValues((prev) => ({ ...prev, code: nextValue }))
              }
            />
            {formErrors.code ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {formErrors.code}
              </p>
            ) : null}
          </div>

          <div>
            <div className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Tên quyền <span className="text-red-500">*</span>
            </div>
            <AppInput
              hideTitle
              value={formValues.name}
              onChange={(nextValue) =>
                setFormValues((prev) => ({ ...prev, name: nextValue }))
              }
            />
            {formErrors.name ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {formErrors.name}
              </p>
            ) : null}
          </div>

          <div>
            <div className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Trạng thái
            </div>
            <select
              value={formValues.status || "Hoạt động"}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, status: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-amber-600 dark:focus:ring-amber-900/40"
            >
              <option>Hoạt động</option>
              <option>Ngưng</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Mô tả
            </div>
            <AppInput
              hideTitle
              type="textarea"
              value={formValues.description}
              onChange={(nextValue) =>
                setFormValues((prev) => ({ ...prev, description: nextValue }))
              }
            />
          </div>
        </div>
      </ActionModal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Xác nhận xóa quyền"
        subject={deleteTarget?.label}
        descriptionPrefix="Bạn có chắc muốn xóa"
        descriptionSuffix="?"
        okText={saving ? "Đang xóa..." : "Xóa"}
        cancelText="Đóng"
        loading={saving}
        spinning={saving}
        variant="danger"
        onOk={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}