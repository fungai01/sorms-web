"use client";

import { useState, useEffect, Suspense, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TBody } from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import { useRoles } from "@/hooks/useApi";
import Input from "@/components/ui/Input";
import { apiClient } from "@/lib/api-client";

type Role = {
  id?: number;
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
};

function RolesInner() {
  // query state declared above
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  
  // Refs to prevent spam requests
  const isInitialLoadRef = useRef(false);
  const queryDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);
  
  // Debounced query
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Hook-based roles loading - use debounced query
  const { data: rolesData, loading: rolesLoading, error, refetch } = useRoles({ q: debouncedQuery || undefined, page: 0, size: 100 })
  
  // Debounce query changes
  useEffect(() => {
    if (!isInitialLoadRef.current) {
      isInitialLoadRef.current = true;
      setDebouncedQuery(query);
      return;
    }
    
    if (queryDebounceRef.current) {
      clearTimeout(queryDebounceRef.current);
    }
    
    queryDebounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    
    return () => {
      if (queryDebounceRef.current) {
        clearTimeout(queryDebounceRef.current);
      }
    };
  }, [query]);
  
  useEffect(() => {
    setLoading(!!rolesLoading)
    if (!rolesData) return
    let rolesArray: Role[] = []
    if (Array.isArray((rolesData as any).items)) rolesArray = (rolesData as any).items
    else if (Array.isArray(rolesData as any)) rolesArray = rolesData as any
    setRows(rolesArray)
  }, [rolesData, rolesLoading])

  // Initial load - only once
  useEffect(() => {
    if (!isInitialLoadRef.current) {
      isInitialLoadRef.current = true;
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [open, setOpen] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [productToDelete, setProductToDelete] = useState<Role | null>(null);
  const [form, setForm] = useState<{ code: string; name: string; description: string; isActive: boolean }>({
    code: "",
    name: "",
    description: "",
    isActive: true,
  });
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Role | null>(null);
  const [sortKey, setSortKey] = useState<"code" | "name">("code");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [formError, setFormError] = useState<string | null>(null);

  // Filter and sort roles based on query and sort - memoized
  const filtered = useMemo(() => {
    return [...rows].sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      if (sortKey === "code") return a.code.localeCompare(b.code) * dir;
      return a.name.localeCompare(b.name) * dir;
    });
  }, [rows, sortKey, sortOrder]);
  
  // Memoize paginated data to prevent recalculation
  const paginatedData = useMemo(() => {
    return filtered.slice((page - 1) * size, page * size);
  }, [filtered, page, size]);

  // Open modal to create a new role
  function openCreate() {
    setEditing(null);
    setForm({ code: "", name: "", description: "", isActive: true });
    setFormError(null);
    setOpen(true);
  }

  // Open modal to edit an existing role
  function openEdit(role: Role) {
    setEditing(role);
    setForm({
      code: role.code,
      name: role.name,
      description: role.description || "",
      isActive: role.isActive !== false,
    });
    setFormError(null);
    setOpen(true);
  }

  // Save new or updated role
  async function save() {
    if (isProcessingRef.current) return;
    if (!form.code.trim() || !form.name.trim()) {
      setFormError('Vui lòng nhập đầy đủ Code và Tên.');
      return;
    }
    isProcessingRef.current = true;
    try {
      if (editing) {
        if (!editing.id) {
          throw new Error('Thiếu ID vai trò, không thể cập nhật.');
        }

        const prevActive = editing.isActive !== false;
        const nextActive = form.isActive !== false;

        const updateResp = await apiClient.updateRole(String(editing.id), {
          code: editing.code,
          name: form.name.trim(),
          description: form.description,
        });
        if (!updateResp.success) {
          throw new Error(updateResp.error || updateResp.message || 'Cập nhật vai trò thất bại');
        }

        // Nếu trạng thái active thay đổi, gọi thêm endpoint activate/deactivate
        if (prevActive !== nextActive) {
          const toggleResp = nextActive
            ? await apiClient.activateRole(String(editing.id))
            : await apiClient.deactivateRole(String(editing.id));

          if (!toggleResp.success) {
            throw new Error(
              toggleResp.error ||
                toggleResp.message ||
                'Cập nhật trạng thái kích hoạt thất bại'
            );
          }
        }

        setFlash({ type: 'success', text: 'Đã cập nhật vai trò thành công.' });
      } else {
        const createResp = await apiClient.createRole({
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description || '',
          isActive: form.isActive,
        });
        if (!createResp.success) {
          throw new Error(createResp.error || createResp.message || 'Tạo vai trò mới thất bại');
        }
        setFlash({ type: 'success', text: 'Đã tạo vai trò mới thành công.' });
      }
      setFormError(null);
      setOpen(false);
      await refetch()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Có lỗi xảy ra';
      setFormError(message);
      setFlash({ type: 'error', text: message })
    } finally {
      isProcessingRef.current = false;
    }
  }

  // Open modal to confirm deletion
  function handleOpenDelete(role: Role) {
    setProductToDelete(role);
    setOpenDeleteModal(true);
  }

  // Confirm deletion via API (soft delete - deactivate)
  async function confirmDelete() {
    if (!productToDelete || isProcessingRef.current) return;
    isProcessingRef.current = true;
    try {
      if (!productToDelete.id) {
        throw new Error('Thiếu ID vai trò, không thể vô hiệu hóa.');
      }

      const resp = await apiClient.deactivateRole(String(productToDelete.id));
      if (!resp.success) {
        throw new Error(resp.error || resp.message || 'Vô hiệu hóa vai trò thất bại');
      }
      setFlash({ type: 'success', text: 'Đã vô hiệu hóa vai trò thành công.' });
      await refetch()
    } catch (e) {
      setFlash({ type: 'error', text: e instanceof Error ? e.message : 'Có lỗi xảy ra' })
    } finally {
      isProcessingRef.current = false;
      setOpenDeleteModal(false);
    }
  }

  // Activate role
  async function activateRole(role: Role) {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    try {
      if (!role.id) {
        throw new Error('Thiếu ID vai trò, không thể kích hoạt.');
      }

      const resp = await apiClient.activateRole(String(role.id));
      if (!resp.success) {
        throw new Error(resp.error || resp.message || 'Kích hoạt vai trò thất bại');
      }
      setFlash({ type: 'success', text: 'Đã kích hoạt vai trò thành công.' });
      await refetch()
    } catch (e) {
      setFlash({ type: 'error', text: e instanceof Error ? e.message : 'Có lỗi xảy ra' })
    } finally {
      isProcessingRef.current = false;
    }
  }

  // Auto-hide success/error messages after a few seconds
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [flash]);

  // Initialize state from URL on mount
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const s = (searchParams.get("sort") as any) || "code";
    const o = (searchParams.get("order") as any) || "asc";
    const p = parseInt(searchParams.get("page") || "1", 10);
    const sz = parseInt(searchParams.get("size") || "10", 10);
    setQuery(q);
    if (s === "id" || s === "code" || s === "name") setSortKey(s);
    if (o === "asc" || o === "desc") setSortOrder(o);
    if (!Number.isNaN(p) && p > 0) setPage(p);
    if (!Number.isNaN(sz) && [10,20,50].includes(sz)) setSize(sz as 10|20|50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state to URL (no scroll)
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("sort", sortKey);
    params.set("order", sortOrder);
    params.set("page", String(page));
    params.set("size", String(size));
    const search = params.toString();
    router.replace(`?${search}`, { scroll: false });
  }, [query, sortKey, sortOrder, page, size, router]);

  return (
    <>
      <div className="px-6 pt-4 pb-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header + Filters wrapper (match Rooms layout) */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="border-b border-gray-200/50 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 leading-tight truncate">
                    Quản lý vai trò
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    {filtered.length} vai trò trong hệ thống
                  </p>
          </div>
                <div className="flex items-center gap-2 flex-shrink-0">
            <button
              aria-label="Xuất Excel (CSV)"
              title="Xuất Excel (CSV)"
                    className="hidden sm:inline-flex items-center px-4 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => {
                      const csv = [
                        ['Code', 'Tên', 'Mô tả', 'Trạng thái'],
                        ...filtered.map(r => [
                          r.code,
                          r.name,
                          r.description || '',
                          r.isActive !== false ? 'Hoạt động' : 'Vô hiệu',
                        ]),
                      ]
                      const blob = new Blob([csv.map(r => r.join(',')).join('\n')], {
                        type: 'text/csv',
                      })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'roles.xlsx'
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              Xuất Excel
            </button>
                  <Button
                    onClick={openCreate}
                    variant="primary"
                    className="px-5 py-2.5 text-sm rounded-xl flex items-center gap-1.5"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Tạo vai trò
                  </Button>
          </div>
        </div>
      </div>

            {/* Bỏ bộ lọc: không hiển thị thanh search/sort */}
          </div>

          {/* Flash message */}
        {flash && (
            <div>
              <div
                className={`py-2.5 rounded-xl px-4 border shadow-sm animate-fade-in flex items-center gap-2 text-xs sm:text-sm ${
                  flash.type === 'success'
                    ? 'bg-green-50 text-green-800 border-green-100'
                    : 'bg-red-50 text-red-800 border-red-100'
                }`}
              >
                <svg
                  className={`w-4 h-4 sm:w-5 sm:h-5 ${
                    flash.type === 'success' ? 'text-green-500' : 'text-red-500'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {flash.type === 'success' ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v4m0 4h.01M12 5a7 7 0 110 14 7 7 0 010-14z"
                    />
                  )}
                </svg>
                <span className="font-medium">{flash.text}</span>
              </div>
          </div>
        )}

          {/* Loading indicator */}
          {loading && (
            <div className="rounded-xl border p-2.5 sm:p-3 text-xs sm:text-sm shadow-sm bg-yellow-50 border-yellow-200 text-yellow-800">
              Đang tải vai trò...
            </div>
          )}

          {/* Table & list */}
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
          <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Danh sách vai trò</h2>
                <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                  {filtered.length} vai trò
                </span>
          </div>
        </CardHeader>
        <CardBody className="p-0">
              {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <THead>
                    <tr>
                      <th className="px-4 py-3 text-center text-sm font-bold">Code</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Tên vai trò</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Mô tả</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Trạng thái</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Thao tác</th>
                </tr>
                  </THead>
                  <TBody>
                    {filtered.slice((page - 1) * size, page * size).map((r, index) => (
                      <tr
                        key={r.code || `role-${index}`}
                        className={`transition-colors ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        } hover:bg-[#f2f8fe]`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                        {r.code}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{r.name}</td>
                        <td className="px-4 py-3 text-gray-600 truncate" title={r.description}>
                          {r.description || '-'}
                    </td>
                        <td className="px-4 py-3 text-center">
                      {r.isActive !== false ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Vô hiệu
                        </span>
                      )}
                    </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-center">
                            <Button
                              variant="secondary"
                              className="h-8 px-3 text-xs bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                              onClick={() => {
                                setSelected(r)
                                setDetailOpen(true)
                              }}
                            >
                              Xem
                            </Button>
                            <Button
                              variant="secondary"
                              className="h-8 px-3 text-xs bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                              onClick={() => openEdit(r)}
                            >
                              Sửa
                            </Button>
                        {r.isActive !== false ? (
                              <Button
                                variant="danger"
                                className="h-8 px-3 text-xs"
                                onClick={() => handleOpenDelete(r)}
                              >
                                Vô hiệu
                              </Button>
                            ) : (
                              <Button
                                className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => activateRole(r)}
                              >
                                Kích hoạt
                              </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                  </TBody>
                </Table>
          </div>

              {/* Mobile Cards */}
              <div className="lg:hidden space-y-3 p-3">
                {filtered.slice((page - 1) * size, page * size).map((r, index) => (
                  <div
                    key={r.code || `role-mobile-${index}`}
                    className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 transition-colors hover:bg-[#f2f8fe] active:bg-[#f2f8fe]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-[hsl(var(--primary)/0.12)] flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-6 h-6 text-[hsl(var(--primary))]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                        </svg>
                      </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-gray-900 truncate">
                            {r.name || r.code}
                          </h3>
                          <p className="text-xs text-gray-500 truncate">{r.code}</p>
                      </div>
                    </div>
                      <div className="flex-shrink-0">
                    {r.isActive !== false ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Hoạt động
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Vô hiệu
                      </span>
                    )}
                  </div>
                </div>

                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Mô tả</span>
                        <span
                          className="font-medium truncate max-w-[60%] text-right"
                          title={r.description}
                        >
                          {r.description || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Button
                        variant="secondary"
                        className="h-10 text-xs font-medium bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                        onClick={() => {
                          setSelected(r)
                          setDetailOpen(true)
                        }}
                      >
                        Xem
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-10 text-xs font-medium bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                        onClick={() => openEdit(r)}
                      >
                        Sửa
                      </Button>
                    {r.isActive !== false ? (
                        <Button
                          variant="danger"
                          className="h-10 text-xs font-medium"
                          onClick={() => handleOpenDelete(r)}
                        >
                          Vô hiệu
                        </Button>
                      ) : (
                        <Button
                          className="h-10 text-xs font-medium bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => activateRole(r)}
                        >
                          Kích hoạt
                        </Button>
                      )}
                </div>
              </div>
            ))}
          </div>

              {/* Pagination */}
              {filtered.length > size && (
                <div className="bg-gradient-to-r from-gray-50 to-[hsl(var(--page-bg))] px-6 py-6 border-t border-gray-200/50">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="text-center sm:text-left">
                      <div className="text-sm text-gray-600 mb-1">Hiển thị kết quả</div>
                      <div className="text-lg font-bold text-gray-900">
                        <span className="text-[hsl(var(--primary))]">
                          {(page - 1) * size + 1}
                        </span>{' '}
                        -{' '}
                        <span className="text-[hsl(var(--primary))]">
                          {Math.min(page * size, filtered.length)}
                        </span>{' '}
                        / <span className="text-gray-600">{filtered.length}</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="flex items-center gap-2 text-sm">
                <span>Hàng:</span>
                <select 
                          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm"
                  value={size} 
                          onChange={(e) => {
                            setPage(1)
                            setSize(parseInt(e.target.value, 10))
                          }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                      </div>
                      <div className="flex items-center gap-4">
                        <Button
                          variant="secondary"
                          disabled={page === 1}
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          className="h-10 px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg
                            className="w-4 h-4 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                          Trước
                        </Button>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-700 bg-white px-4 py-2 rounded-xl border-2 border-[hsl(var(--primary)/0.25)] shadow-sm">
                            Trang {page}
                          </span>
                          <span className="text-sm text-gray-500">
                            / {Math.ceil(filtered.length / size)}
                          </span>
                        </div>
                        <Button
                          variant="secondary"
                          disabled={page >= Math.ceil(filtered.length / size)}
                          onClick={() =>
                            setPage(p => Math.min(Math.ceil(filtered.length / size), p + 1))
                          }
                          className="h-10 px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Sau
                          <svg
                            className="w-4 h-4 ml-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </Button>
                      </div>
              </div>
              </div>
            </div>
              )}
        </CardBody>
      </Card>
        </div>
      </div>

      {/* Modal for Create/Update */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Sửa vai trò' : 'Tạo vai trò'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button onClick={save}>
              Lưu
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Header giống bookings/rooms style */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 sm:p-4 border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                  {form.code || '—'}
                </h3>
                <div className="text-sm text-gray-600 truncate">{form.name || '—'}</div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code
            </label>
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              disabled={!!editing}
            />
            {!form.code.trim() && (
              <div className="mt-1 text-xs text-red-600">Code bắt buộc.</div>
            )}
            {editing && (
              <div className="mt-1 text-xs text-gray-500">
                Code là định danh của vai trò và không thể thay đổi sau khi tạo.
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            {!form.name.trim() && (
              <div className="mt-1 text-xs text-red-600">Tên bắt buộc.</div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          {formError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {formError}
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="role-active"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              checked={form.isActive}
              onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))}
            />
            <label
              htmlFor="role-active"
              className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 border border-green-200"
            >
              Vai trò đang hoạt động
            </label>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal
        open={openDeleteModal}
        onClose={() => setOpenDeleteModal(false)}
        title="Xác nhận vô hiệu hóa"
      >
        <div className="text-sm text-gray-700">
          Bạn có chắc muốn vô hiệu hóa vai trò này? Vai trò sẽ không bị xóa hoàn toàn và có thể được kích hoạt lại sau.
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="secondary"
            onClick={() => setOpenDeleteModal(false)}
          >
            Hủy
          </Button>
          <Button
            variant="danger"
            onClick={confirmDelete}
          >
            Vô hiệu hóa
          </Button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Chi tiết vai trò"
      >
        {selected ? (
          <div className="space-y-4 p-1">
            {/* Header giống bookings/rooms */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 sm:p-4 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                      {selected.code}
                    </h3>
                  </div>
                  <div className="text-sm text-gray-600 truncate">{selected.name}</div>
                </div>
              </div>
            </div>

            {/* Thông tin chi tiết */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Code</div>
                <div className="font-medium text-gray-900">{selected.code}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Trạng thái</div>
                <div className="font-medium text-gray-900">
                  {selected.isActive !== false ? 'Hoạt động' : 'Vô hiệu'}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white sm:col-span-2">
                <div className="text-gray-500">Tên</div>
                <div className="mt-1 font-medium text-gray-900">{selected.name}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white sm:col-span-2">
                <div className="text-gray-500">Mô tả</div>
                <div className="mt-1 text-gray-900">{selected.description || '—'}</div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

export default function RolesPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Đang tải...</div>}>
      <RolesInner />
    </Suspense>
  )
}
