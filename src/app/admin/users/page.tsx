"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

type User = {
  id: number;
  email: string;
  full_name: string;
  phone_number?: string;
  status: "ACTIVE" | "INACTIVE";
  roles: string[];
};

function UsersInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"id" | "name" | "email">("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<User | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const roleOptions = ["admin", "office", "lecture", "staff", "guest"] as const;
  const [editForm, setEditForm] = useState<{ id?: number; full_name: string; email: string; phone_number?: string; role: string }>(
    { full_name: "", email: "", phone_number: "", role: "" }
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{ full_name: string; email: string; phone_number?: string; role: string }>(
    { full_name: "", email: "", phone_number: "", role: "" }
  );
  const [confirmOpen, setConfirmOpen] = useState<{ open: boolean; type: 'delete' | 'deactivate' | 'activate'; user?: User }>({ open: false, type: 'delete' });
  const [message, setMessage] = useState<string | null>(null);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function refetchUsers() {
    try {
      const res = await fetch('/api/system/users', { headers: { 'Content-Type': 'application/json' }, credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (Array.isArray(data?.items)) {
        setRows(data.items)
      } else if (Array.isArray(data)) {
        setRows(data)
      } else {
        setRows([])
      }
    } catch {
      setRows([])
    }
  }

  useEffect(() => {
    refetchUsers()
  }, [])

  useEffect(() => {
    const q = searchParams.get("q") || "";
    const s = (searchParams.get("sort") as any) || "id";
    const o = (searchParams.get("order") as any) || "asc";
    const p = parseInt(searchParams.get("page") || "1", 10);
    const sz = parseInt(searchParams.get("size") || "10", 10);
    setQuery(q);
    if (s === "id" || s === "name" || s === "email") setSortKey(s);
    if (o === "asc" || o === "desc") setSortOrder(o);
    if (!Number.isNaN(p) && p > 0) setPage(p);
    if (!Number.isNaN(sz) && [10,20,50].includes(sz)) setSize(sz as 10|20|50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("sort", sortKey);
    params.set("order", sortOrder);
    params.set("page", String(page));
    params.set("size", String(size));
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [query, sortKey, sortOrder, page, size, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? rows.filter(
          (u) =>
            u.email.toLowerCase().includes(q) ||
            u.full_name.toLowerCase().includes(q) ||
            u.roles.join(",").includes(q)
        )
      : rows;
    const ordered = [...list].sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      if (sortKey === "id") return (a.id - b.id) * dir;
      if (sortKey === "name") return a.full_name.localeCompare(b.full_name) * dir;
      return a.email.localeCompare(b.email) * dir;
    });
    return ordered;
  }, [rows, query, sortKey, sortOrder]);

  async function deactivate(id: number) {
    try {
      const res = await fetch(`/api/system/users?action=deactivate&userId=${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        setRows((r) => r.map((u) => (u.id === id ? { ...u, status: "INACTIVE" } : u)));
        setMessage('Đã vô hiệu hóa người dùng.');
      } else {
        setMessage('Lỗi khi vô hiệu hóa người dùng.');
      }
    } catch (error) {
      setMessage('Lỗi khi vô hiệu hóa người dùng.');
    }
  }

  async function activate(id: number) {
    try {
      const res = await fetch(`/api/system/users?action=activate&userId=${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        setRows((r) => r.map((u) => (u.id === id ? { ...u, status: "ACTIVE" } : u)));
        setMessage('Đã kích hoạt người dùng.');
      } else {
        setMessage('Lỗi khi kích hoạt người dùng.');
      }
    } catch (error) {
      setMessage('Lỗi khi kích hoạt người dùng.');
    }
  }

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <>
      {/* Header - match admin style with Demo/Live toggle */}
      <div className="bg-white border-b border-gray-200 px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A4 4 0 018 17h8a4 4 0 012.879 1.196M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-gray-900 truncate">Người dùng</h1>
              <p className="text-sm text-gray-500">{filtered.length} người dùng</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button className="h-9 px-4 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-sm whitespace-nowrap" onClick={() => { setCreateForm({ full_name: "", email: "", phone_number: "", role: "" }); setCreateOpen(true); }}>
              Tạo người dùng
            </Button>
            <button
              type="button"
              aria-label="Xuất Excel"
              title="Xuất Excel"
              className="h-9 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"
              onClick={() => {
                const csv = [['ID', 'Email', 'Họ tên', 'Vai trò', 'Trạng thái'], ...filtered.map(u => [u.id, u.email, u.full_name, u.roles.join(','), u.status])]
                const blob = new Blob([csv.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `users_${new Date().toISOString().slice(0,10)}.xlsx`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              Xuất excel
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 py-3">
        <div className="space-y-3">
        {message && (
          <div className="rounded-md border p-2 sm:p-3 text-xs sm:text-sm shadow-sm bg-green-50 border-green-200 text-green-800">
            {message}
          </div>
        )}

        {/* Removed Demo/Live banner */}

        {/* Filters */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 rounded-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Tìm kiếm</label>
              <div className="relative">
                <Input
                  className="w-full h-9 pl-3 pr-9 text-sm border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Tìm theo email, họ tên, vai trò..."
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
                  <option value="id">ID</option>
                  <option value="name">Họ tên</option>
                  <option value="email">Email</option>
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
            <h2 className="text-lg text-left font-bold text-gray-900">Danh sách người dùng</h2>
            <span className="text-sm text-right font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">{filtered.length} người dùng</span>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-[800px] w-full table-fixed text-xs sm:text-sm">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[25%]" />
            </colgroup>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 text-xs sm:text-sm">
                <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left font-semibold">ID</th>
                <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left font-semibold">Họ tên</th>
                <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left font-semibold">Email</th>
                <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left font-semibold">Điện thoại</th>
                <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left font-semibold">Vai trò</th>
                <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left font-semibold">Trạng thái</th>
                <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered
                .slice((page - 1) * size, (page - 1) * size + size)
                .map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">{u.id}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">{u.full_name}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 font-mono text-xs sm:text-sm truncate max-w-[180px] sm:max-w-[240px] lg:max-w-[300px]" title={u.email}>
                      {u.email}
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">{u.phone_number || "—"}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r}>{r}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                      {u.status === "ACTIVE" ? <Badge tone="success">ACTIVE</Badge> : <Badge tone="muted">INACTIVE</Badge>}
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                        <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => { setSelected(u); setDetailOpen(true); }}>Xem</Button>
                        <Button className="h-8 px-3 text-xs" onClick={() => {
                          setEditForm({ id: u.id, full_name: u.full_name, email: u.email, phone_number: u.phone_number, role: u.roles[0] || "" });
                          setEditOpen(true);
                        }}>Sửa</Button>
                        <Button variant="danger" className="h-8 px-3 text-xs" onClick={() => setConfirmOpen({ open: true, type: 'delete', user: u })}>Xóa</Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          </div>

          {/* Mobile list */}
          <div className="lg:hidden p-3 space-y-3">
            {filtered.slice((page - 1) * size, (page - 1) * size + size).map((u) => (
              <div key={u.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                {/* Header gradient giống bookings/tasks */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A4 4 0 018 17h8a4 4 0 012.879 1.196M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 truncate">{u.full_name}</div>
                        <div className="text-xs text-gray-600 truncate">{u.email}</div>
                      </div>
                    </div>
                    <div>{u.status === 'ACTIVE' ? <Badge tone="success">ACTIVE</Badge> : <Badge tone="muted">INACTIVE</Badge>}</div>
                  </div>
                </div>

                <div className="p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Điện thoại</span>
                    <span className="font-medium">{u.phone_number || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Vai trò</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {u.roles.map((r) => (<Badge key={r}>{r}</Badge>))}
                    </div>
                  </div>
                </div>

                <div className="px-3 py-3 bg-gray-50 border-t border-gray-100">
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="secondary" className="h-10 text-xs font-medium px-2" onClick={() => { setSelected(u); setDetailOpen(true); }}>Xem</Button>
                    <Button className="h-10 text-xs font-medium px-2" onClick={() => { setEditForm({ id: u.id, full_name: u.full_name, email: u.email, phone_number: u.phone_number, role: u.roles[0] || "" }); setEditOpen(true); }}>Sửa</Button>
                    <Button variant="danger" className="h-10 text-xs font-medium px-2" onClick={() => setConfirmOpen({ open: true, type: 'delete', user: u })}>Xóa</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <span>Hàng:</span>
              <select
                className="h-7 sm:h-8 rounded-md border border-gray-300 bg-white px-2 text-xs sm:text-sm"
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
              <Button variant="secondary" className="h-7 sm:h-8 px-2 sm:px-3 text-xs" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trước</Button>
              <span className="px-2 text-xs sm:text-sm">Trang {page} / {Math.max(1, Math.ceil(filtered.length / size))}</span>
              <Button variant="secondary" className="h-7 sm:h-8 px-2 sm:px-3 text-xs" disabled={page >= Math.ceil(filtered.length / size)} onClick={() => setPage((p) => Math.min(Math.ceil(filtered.length / size), p + 1))}>Sau</Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết người dùng">
        {selected ? (
          <div className="space-y-4 p-1">
            {/* Header giống bookings */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 sm:p-4 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A4 4 0 018 17h8a4 4 0 012.879 1.196M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{selected.full_name}</h3>
                    {selected.status === 'ACTIVE' ? (
                      <Badge tone="success">ACTIVE</Badge>
                    ) : (
                      <Badge tone="muted">INACTIVE</Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 truncate">{selected.email}</div>
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
                <div className="text-gray-500">Điện thoại</div>
                <div className="font-medium text-gray-900">{selected.phone_number || '—'}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white sm:col-span-2">
                <div className="text-gray-500">Vai trò</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selected.roles.map((r) => (<Badge key={r}>{r}</Badge>))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Sửa người dùng"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Hủy</Button>
            <Button disabled={!editForm.id || !editForm.full_name.trim() || !emailRegex.test(editForm.email) || !editForm.role}
              onClick={async () => {
              try {
                // Tạm thời cập nhật local do API chưa có endpoint update cụ thể
                setRows((rs) => rs.map((u) => u.id === editForm.id
                  ? { ...u, full_name: editForm.full_name, email: editForm.email, phone_number: editForm.phone_number, roles: editForm.role ? [editForm.role] : [] }
                  : u
                ));
                setEditOpen(false);
                setMessage('Đã cập nhật người dùng.');
                await refetchUsers()
              } catch {
                setMessage('Lỗi khi cập nhật người dùng.')
              }
            }}>Lưu</Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Header giống bookings */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 sm:p-4 border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A4 4 0 018 17h8a4 4 0 012.879 1.196M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{editForm.full_name || '—'}</h3>
                <div className="text-sm text-gray-600 truncate">{editForm.email || '—'}</div>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Họ tên</label>
            <Input value={editForm.full_name} onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <Input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Điện thoại</label>
            <Input value={editForm.phone_number || ''} onChange={(e) => setEditForm((f) => ({ ...f, phone_number: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Vai trò</label>
            <select
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editForm.role}
              onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="">-- Chọn vai trò --</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="mt-1 text-xs text-red-600">
              {!editForm.full_name.trim() ? 'Họ tên bắt buộc. ' : ''}
              {!emailRegex.test(editForm.email) ? 'Email không hợp lệ. ' : ''}
              {!editForm.role ? 'Vui lòng chọn vai trò.' : ''}
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal tạo người dùng */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo người dùng"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button disabled={!createForm.full_name.trim() || !emailRegex.test(createForm.email) || !createForm.role}
              onClick={async () => {
              try {
                const resp = await fetch('/api/system/users?action=create', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    full_name: createForm.full_name,
                    email: createForm.email,
                    phone_number: createForm.phone_number,
                    role: createForm.role
                  })
                })
                if (!resp.ok) throw new Error('Tạo người dùng thất bại')
                setCreateOpen(false);
                setMessage('Đã tạo người dùng mới.');
                await refetchUsers()
              } catch (e) {
                setMessage('Lỗi khi tạo người dùng mới.')
              }
            }}>Tạo</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Họ tên</label>
            <Input value={createForm.full_name} onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <Input value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Điện thoại</label>
            <Input value={createForm.phone_number || ''} onChange={(e) => setCreateForm((f) => ({ ...f, phone_number: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Vai trò</label>
            <select
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={createForm.role}
              onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="">-- Chọn vai trò --</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="mt-1 text-xs text-red-600">
              {!createForm.full_name.trim() ? 'Họ tên bắt buộc. ' : ''}
              {!emailRegex.test(createForm.email) ? 'Email không hợp lệ. ' : ''}
              {!createForm.role ? 'Vui lòng chọn vai trò.' : ''}
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal xác nhận xóa */}
      <Modal
        open={confirmOpen.open}
        onClose={() => setConfirmOpen({ open: false, type: 'delete' })}
        title={'Xác nhận xóa'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen({ open: false, type: 'delete' })}>Hủy</Button>
            <Button onClick={async () => {
              if (!confirmOpen.user) return;
              try {
                const resp = await fetch(`/api/system/users?id=${confirmOpen.user.id}` , { method: 'DELETE', headers: { 'Content-Type': 'application/json' } })
                if (!resp.ok) {
                  const err = await resp.json().catch(() => ({}))
                  throw new Error(err?.error || 'Xóa người dùng thất bại')
                }
                setMessage('Đã xóa người dùng.');
                setConfirmOpen({ open: false, type: 'delete' });
                await refetchUsers()
              } catch (e) {
                setMessage(e instanceof Error ? e.message : 'Lỗi khi xóa người dùng.')
              }
            }}>Xác nhận</Button>
          </div>
        }
      >
        <div className="text-sm text-gray-700">
          Bạn có chắc muốn xóa người dùng này? Hành động này không thể hoàn tác.
        </div>
      </Modal>
      </div>
      </div>
    </>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Đang tải...</div>}>
      <UsersInner />
    </Suspense>
  )
}


