"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TBody } from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";

type Role = { id: number; code: string; name: string; description?: string; isVisible: boolean };

function RolesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false)

  async function refetchRoles() {
    setLoading(true)
    try {
      const res = await fetch('/api/system/roles', { headers: { 'Content-Type': 'application/json' }, credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (Array.isArray(data?.items)) {
        setRows(data.items)
      } else if (Array.isArray(data)) {
        setRows(data)
      } else {
        setRows([])
      }
    } catch (e) {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetchRoles()
  }, [])
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [productToDelete, setProductToDelete] = useState<Role | null>(null);
  const [form, setForm] = useState<Pick<Role, "code" | "name" | "description" | "isVisible">>({
    code: "",
    name: "",
    description: "",
    isVisible: true,
  });
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Role | null>(null);
  const [sortKey, setSortKey] = useState<"id" | "code" | "name">("code");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  // Remove role from list
  function remove(id: number) {
    setRows((r) => r.filter((x) => x.id !== id));
    setFlash({ type: 'success', text: 'Đã xóa vai trò thành công.' });
  }

  // Filter and sort roles based on query and sort
  const filtered = rows
    .filter((r) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      if (sortKey === "id") return (a.id - b.id) * dir;
      if (sortKey === "code") return a.code.localeCompare(b.code) * dir;
      return a.name.localeCompare(b.name) * dir;
    });

  // Open modal to create a new role
  function openCreate() {
    setEditing(null);
    setForm({ code: "", name: "", description: "", isVisible: true });
    setOpen(true);
  }

  // Open modal to edit an existing role
  function openEdit(role: Role) {
    setEditing(role);
    setForm({ code: role.code, name: role.name, description: role.description || "", isVisible: role.isVisible });
    setOpen(true);
  }

  // Save new or updated role
  async function save() {
    if (!form.code.trim() || !form.name.trim()) {
      setFlash({ type: 'error', text: 'Vui lòng nhập Code và Tên.' });
      return;
    }
    try {
      if (editing) {
        const resp = await fetch('/api/system/roles', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...form })
        })
        if (!resp.ok) throw new Error('Cập nhật vai trò thất bại')
        setFlash({ type: 'success', text: 'Đã cập nhật vai trò thành công.' });
      } else {
        const resp = await fetch('/api/system/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        })
        if (!resp.ok) throw new Error('Tạo vai trò mới thất bại')
        setFlash({ type: 'success', text: 'Đã tạo vai trò mới thành công.' });
      }
      setOpen(false);
      await refetchRoles()
    } catch (e) {
      setFlash({ type: 'error', text: e instanceof Error ? e.message : 'Có lỗi xảy ra' })
    }
  }

  // Open modal to confirm deletion
  function handleOpenDelete(role: Role) {
    setProductToDelete(role);
    setOpenDeleteModal(true);
  }

  // Confirm deletion via API (soft delete - deactivate)
  async function confirmDelete() {
    if (!productToDelete) return
    try {
      const resp = await fetch(`/api/system/roles?id=${productToDelete.id}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error('Vô hiệu hóa vai trò thất bại')
      setFlash({ type: 'success', text: 'Đã vô hiệu hóa vai trò thành công.' });
      await refetchRoles()
    } catch (e) {
      setFlash({ type: 'error', text: e instanceof Error ? e.message : 'Có lỗi xảy ra' })
    } finally {
      setOpenDeleteModal(false);
    }
  }

  // Activate role
  async function activateRole(role: Role) {
    try {
      const resp = await fetch(`/api/system/roles?action=activate&id=${role.id}`, { method: 'POST' })
      if (!resp.ok) throw new Error('Kích hoạt vai trò thất bại')
      setFlash({ type: 'success', text: 'Đã kích hoạt vai trò thành công.' });
      await refetchRoles()
    } catch (e) {
      setFlash({ type: 'error', text: e instanceof Error ? e.message : 'Có lỗi xảy ra' })
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
      {/* Header - match admin style with Demo/Live toggle */}
      <div className="bg-white border-b border-gray-200 px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-gray-900 truncate">Phân quyền</h1>
              <p className="text-sm text-gray-500">{filtered.length} vai trò</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm flex-shrink-0 rounded-lg" onClick={openCreate}>
              Tạo vai trò
            </Button>
            <button
              aria-label="Xuất Excel (CSV)"
              title="Xuất Excel (CSV)"
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"
              onClick={() => {
                const csv = [['ID', 'Code', 'Tên', 'Mô tả', 'Hiển thị'], ...filtered.map(r => [r.id, r.code, r.name, r.description || '', r.isVisible ? 'Có' : 'Không'])]
                const blob = new Blob([csv.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
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
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 py-3">
        <div className="space-y-3">
        {flash && (
          <div className={`rounded-md border p-2 sm:p-3 text-xs sm:text-sm shadow-sm ${flash.type==='success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {flash.text}
          </div>
        )}

          {/* Loading indicator */}
          {loading && (
            <div className="rounded-md border p-2 sm:p-3 text-xs sm:text-sm shadow-sm bg-yellow-50 border-yellow-200 text-yellow-800">
              Đang tải vai trò...
            </div>
          )}

      {/* Filters */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 rounded-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Tìm kiếm</label>
            <div className="relative">
              <Input 
                className="w-full h-9 pl-3 pr-9 text-sm border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                placeholder="Tìm theo code, tên..." 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Sắp xếp</label>
            <div className="flex gap-2">
              <select 
                className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm flex-1" 
                value={sortKey} 
                onChange={(e) => setSortKey(e.target.value as any)}
              >
                <option value="code">Code</option>
                <option value="name">Tên</option>
                <option value="id">ID</option>
              </select>
              <select 
                className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm flex-1" 
                value={sortOrder} 
                onChange={(e) => setSortOrder(e.target.value as any)}
              >
                <option value="asc">Tăng dần</option>
                <option value="desc">Giảm dần</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-gray-50 border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg text-left font-bold text-gray-900">Danh sách vai trò</h2>
            <span className="text-sm text-right font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">{filtered.length} vai trò</span>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-[800px] w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left font-semibold text-gray-700">ID</th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left font-semibold text-gray-700">Code</th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left font-semibold text-gray-700">Tên</th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left font-semibold text-gray-700">Mô tả</th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left font-semibold text-gray-700">Trạng thái</th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left font-semibold text-gray-700">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice((page - 1) * size, (page - 1) * size + size).map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">{r.id}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                      <span 
                        role="button" 
                        tabIndex={0} 
                        className="cursor-pointer underline underline-offset-2 text-blue-600 hover:text-blue-700 text-xs sm:text-sm" 
                        onClick={() => { setSelected(r); setDetailOpen(true); }}
                      >
                        {r.code}
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700">{r.name}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-500 truncate" title={r.description}>{r.description}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                      {r.isVisible ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Vô hiệu
                        </span>
                      )}
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                        <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => { setSelected(r); setDetailOpen(true); }}>Xem</Button>
                        <Button className="h-8 px-3 text-xs" onClick={() => openEdit(r)}>Sửa</Button>
                        {r.isVisible ? (
                          <Button variant="danger" className="h-8 px-3 text-xs" onClick={() => handleOpenDelete(r)}>Vô hiệu</Button>
                        ) : (
                          <Button className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700" onClick={() => activateRole(r)}>Kích hoạt</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="lg:hidden p-3 space-y-3">
            {filtered.slice((page - 1) * size, (page - 1) * size + size).map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 truncate">{r.code}</div>
                        <div className="text-xs text-gray-600 truncate">{r.name}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Mô tả</span>
                    <span className="font-medium truncate max-w-[60%] text-right" title={r.description}>{r.description || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Trạng thái</span>
                    {r.isVisible ? (
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

                <div className="px-3 py-3 bg-gray-50 border-t border-gray-100">
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="secondary" className="h-10 text-xs font-medium px-2" onClick={() => { setSelected(r); setDetailOpen(true); }}>Xem</Button>
                    <Button className="h-10 text-xs font-medium px-2" onClick={() => openEdit(r)}>Sửa</Button>
                    {r.isVisible ? (
                      <Button variant="danger" className="h-10 text-xs font-medium px-2" onClick={() => handleOpenDelete(r)}>Vô hiệu</Button>
                    ) : (
                      <Button className="h-10 text-xs font-medium px-2 bg-green-600 hover:bg-green-700" onClick={() => activateRole(r)}>Kích hoạt</Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span>Hàng:</span>
                <select 
                  className="h-7 sm:h-8 rounded-md border border-gray-300 bg-white px-2 sm:px-3 text-xs" 
                  value={size} 
                  onChange={(e) => { setPage(1); setSize(parseInt(e.target.value, 10)); }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-gray-500">trên {filtered.length}</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <Button variant="secondary" className="h-7 sm:h-8 px-2 sm:px-3 text-xs" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Trước</Button>
                <span className="px-2">Trang {page} / {Math.max(1, Math.ceil(filtered.length / size))}</span>
                <Button variant="secondary" className="h-7 sm:h-8 px-2 sm:px-3 text-xs" disabled={page >= Math.ceil(filtered.length / size)} onClick={() => setPage(p => Math.min(Math.ceil(filtered.length / size), p + 1))}>Sau</Button>
              </div>
            </div>
        </CardBody>
      </Card>

      {/* Modal for Create/Update */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Sửa vai trò" : "Tạo vai trò"}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <Button
              onClick={save}
            >
              Lưu
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Header giống bookings */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 sm:p-4 border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{form.code || '—'}</h3>
                <div className="text-sm text-gray-600 truncate">{form.name || '—'}</div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
            {!form.code.trim() && <div className="mt-1 text-xs text-red-600">Code bắt buộc.</div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            {!form.name.trim() && <div className="mt-1 text-xs text-red-600">Tên bắt buộc.</div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal open={openDeleteModal} onClose={() => setOpenDeleteModal(false)} title="Xác nhận vô hiệu hóa">
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
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết vai trò">
        {selected ? (
          <div className="space-y-4 p-1">
            {/* Header giống bookings */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 sm:p-4 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{selected.code}</h3>
                  </div>
                  <div className="text-sm text-gray-600 truncate">{selected.name}</div>
                </div>
              </div>
            </div>

            {/* Thông tin chi tiết */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">ID</div>
                <div className="font-medium text-gray-900">{selected.id}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="text-gray-500">Hiển thị</div>
                <div className="font-medium text-gray-900">{selected.isVisible ? 'Có' : 'Không'}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white sm:col-span-2">
                <div className="text-gray-500">Mô tả</div>
                <div className="mt-1 text-gray-900">{selected.description || '—'}</div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
      </div>
      </div>
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
