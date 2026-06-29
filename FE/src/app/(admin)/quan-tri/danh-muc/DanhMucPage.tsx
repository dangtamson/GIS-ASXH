"use client";

import {api, ApiError} from "@/lib/api";
import {extractList, getRowId} from "@/lib/data-utils";
import {endpoints} from "@/lib/endpoints";
import {App} from "antd";
import {useCallback, useEffect, useState} from "react";

import {
    ActionButton,
    ActionModal,
    AppInput,
    ConfirmModal,
    FilterSpace,
    SearchBox,
    TitleSpace,
    ViewModal,
} from "@/components/controller";

import ActionIcon from "@/components/controller/ActionIcon";

type Category = {
  id?: string | number;
  uuid?: string;
  name?: string;
  code?: string;
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

function statusLabel(value: unknown): string {
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
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;
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

export default function DanhMucPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { notification } = App.useApp();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewTarget, setViewTarget] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const [formValues, setFormValues] = useState<Record<string, string>>({
    code: "",
    name: "",
    description: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(rowsPerPage),
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      if (search.trim()) {
        params.set("search", search.trim());
      }

      const data = await api.get<unknown>(`${endpoints.admin.categories}?${params.toString()}`);
      const nextItems = extractList<Category>(data);
      const pagination = extractPagination(data);
      setItems(nextItems);
      setTotalItems(pagination?.total ?? nextItems.length);
    } catch (err) {
      if (err instanceof ApiError) {
        notification.error({
          message: "Lỗi",
          description: err.message,
        });
      } else {
        notification.error({
          message: "Lỗi",
          description: "Không thể tải danh sách loại danh mục.",
        });
      }
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
    setFormValues({ code: "", name: "", description: "" });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (item: Category) => {
    const id = getRowId(item);
    setIsEditMode(true);
    setEditingId(id);
    setFormValues({
      code: String(item.code ?? ""),
      name: String(item.name ?? ""),
      description: String(item.description ?? ""),
    });
    setFormErrors({});
    setShowModal(true);
  };

  const validateForm = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!formValues.code?.trim()) {
      nextErrors.code = "Mã loại danh mục không được để trống";
    }

    if (!formValues.name?.trim()) {
      nextErrors.name = "Tên loại danh mục không được để trống";
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
        code: formValues.code.trim(),
        name: formValues.name.trim(),
        description: formValues.description?.trim() || "",
      };

      if (isEditMode && editingId) {
        await api.patch<unknown>(`${endpoints.admin.categories}/${editingId}`, payload);
      } else {
        await api.post<unknown>(endpoints.admin.categories, payload);
      }

      setShowModal(false);
      setFormValues({ code: "", name: "", description: "" });
      notification.success({
        message: "Thành công",
        description: isEditMode ? "Cập nhật loại danh mục thành công." : "Tạo loại danh mục thành công.",
      });
      await loadData();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormErrors({ submit: err.message });
      } else {
        setFormErrors({ submit: isEditMode ? "Không thể cập nhật loại danh mục." : "Không thể tạo loại danh mục." });
      }
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
      await api.delete<unknown>(`${endpoints.admin.categories}/${deleteTarget.id}`);
      setDeleteTarget(null);
      notification.success({
        message: "Thành công",
        description: "Đã xóa loại danh mục.",
      });
      await loadData();
    } catch (err) {
      if (err instanceof ApiError) {
        notification.error({
          message: "Lỗi",
          description: err.message,
        });
      } else {
        notification.error({
          message: "Lỗi",
          description: "Không thể xóa loại danh mục.",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <TitleSpace
        title="Quản lý danh mục dữ liệu"
        description="Quản lý các loại danh mục dùng để phân loại và tổ chức dữ liệu trong hệ thống."
        actions={
          <div className="flex items-center gap-2">
            <ActionButton type="create" label="Thêm mới" onClick={openCreateModal} />
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
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Không có loại danh mục phù hợp.</p>
        ) : (
          <>
            <div className="data-table-shell md:block">
              <table className="data-table">
                <thead className="data-table-head">
                  <tr>
                    <th className="data-table-th">STT</th>
                    <th className="data-table-th">Mã</th>
                    <th className="data-table-th">Tên</th>
                    <th className="data-table-th">Mô tả</th>
                    <th className="data-table-th">Trạng thái</th>
                    <th className="data-table-th">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const id = getRowId(item);
                    const label = String(item.name || item.code || id);

                    return (
                      <tr key={id} className="data-table-row">
                        <td className="data-table-cell">{index + 1}</td>
                        <td className="data-table-cell">{item.code || "-"}</td>
                        <td className="data-table-cell">{item.name || "-"}</td>
                        <td className="data-table-cell">{item.description || "-"}</td>
                        <td className="data-table-cell">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td className="data-table-cell">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setViewTarget(item)}
                              title="Xem chi tiết"
                            >
                              <ActionIcon action="view" />
                            </button>
                            <button
                              onClick={() => openEditModal(item)}
                              title="Sửa"
                            >
                              <ActionIcon action="edit" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget({ id, label })}
                              title="Xóa"
                            >
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

            {/* <div className="grid grid-cols-1 gap-3 md:hidden">
              {items.map((item) => {
                const id = getRowId(item);
                const label = String(item.name || item.code || id);

                return (
                  <div key={id} className="rounded-xl border bg-white border-gray-200 p-4 dark:border-gray-700">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-base font-semibold text-gray-900 dark:text-white">{item.name || item.code || "-"}</p>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400">Mã: {item.code || "-"}</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.description || "Không có mô tả"}</p>

                    <div className="mt-3 flex items-center justify-end gap-3">
                      <button className={'flex items-center gap-1'} onClick={() => setViewTarget(item)}>
                        <ActionIcon action="view" />
                        <span>Xem</span>
                      </button>
                      <button className={'flex items-center gap-1'} onClick={() => openEditModal(item)}>
                        <ActionIcon action="edit" />
                        <span>Cập nhật</span>
                      </button>
                      <button className={'flex items-center gap-1'} onClick={() => setDeleteTarget({ id, label })}>
                        <ActionIcon action="delete" />
                        <span>Xóa</span>
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
                <p className="text-gray-600 dark:text-gray-300">{totalItems} loại danh mục</p>
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Trước
                </button>
                <span className="text-gray-600 dark:text-gray-300">Trang {page}/{totalPages}</span>
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
        onOk={() => void handleCreateOrUpdate()}
        onCancel={() => setShowModal(false)}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Mã loại danh mục <span className="text-red-500">*</span>
            </div>
            <AppInput
              hideTitle
              value={formValues.code || ""}
              onChange={(nextValue) => setFormValues((prev) => ({ ...prev, code: nextValue }))}
            />
            {formErrors.code ? <p className="mt-1 text-xs text-red-600">{formErrors.code}</p> : null}
          </div>

          <div>
            <div className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Tên loại danh mục <span className="text-red-500">*</span>
            </div>
            <AppInput
              hideTitle
              value={formValues.name || ""}
              onChange={(nextValue) => setFormValues((prev) => ({ ...prev, name: nextValue }))}
            />
            {formErrors.name ? <p className="mt-1 text-xs text-red-600">{formErrors.name}</p> : null}
          </div>

          <div className="md:col-span-2">
            <div className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Mô tả
            </div>
            <AppInput
              hideTitle
              type="textarea"
              value={formValues.description || ""}
              onChange={(nextValue) => setFormValues((prev) => ({ ...prev, description: nextValue }))}
            />
          </div>
        </div>
      </ActionModal>

      <ViewModal
        open={Boolean(viewTarget)}
        title="Chi tiết loại danh mục"
        width={720}
        onCancel={() => setViewTarget(null)}
        footer={
          <div className="popup-footer-actions">
            <ActionButton type="close" onClick={() => setViewTarget(null)} />
          </div>
        }
      >
        {viewTarget && (
          <div className="space-y-3 text-sm">
            <p><span className="font-medium">Mã:</span> {String(viewTarget.code || "-")}</p>
            <p><span className="font-medium">Tên:</span> {String(viewTarget.name || "-")}</p>
            <p><span className="font-medium">Mô tả:</span> {String(viewTarget.description || "-")}</p>
            <p>
              <span className="font-medium">Trạng thái:</span>{" "}
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(viewTarget.status)}`}>
                {statusLabel(viewTarget.status)}
              </span>
            </p>
          </div>
        )}
      </ViewModal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Xác nhận xóa loại danh mục"
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
