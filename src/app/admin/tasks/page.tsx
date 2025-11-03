"use client";

import { useEffect, useMemo, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'

type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

type StaffTask = {
  id: number
  title: string
  assignee: string
  due_date?: string
  priority: TaskPriority
  status: TaskStatus
  description?: string
  created_at: string
  isActive?: boolean
}

// Remove mock; always use API

export default function TasksPage() {
  const [rows, setRows] = useState<StaffTask[]>([])
  const [flash, setFlash] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [query, setQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<'ALL' | TaskStatus>('ALL')
  const [sortKey, setSortKey] = useState<'id' | 'created' | 'due' | 'priority'>("created")
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>("desc")
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<StaffTask | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<{ id?: number, title: string, assignee: string, due_date: string, priority: TaskPriority, status: TaskStatus, description: string }>({ title: '', assignee: '', due_date: '', priority: 'MEDIUM', status: 'TODO', description: '' })
  const [confirmOpen, setConfirmOpen] = useState<{ open: boolean, id?: number }>({ open: false })

  const [loading, setLoading] = useState(false)
  async function refetchTasks() {
    setLoading(true)
    try {
      const res = await fetch('/api/system/tasks', { headers: { 'Content-Type': 'application/json' }, credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (Array.isArray(data)) setRows(data)
      else if (Array.isArray(data?.items)) setRows(data.items)
      else setRows([])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { refetchTasks() }, [])

  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 3000); return () => clearTimeout(t) }, [flash])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = rows.filter(r => r.title.toLowerCase().includes(q) || r.assignee.toLowerCase().includes(q) || (r.description||'').toLowerCase().includes(q))
    if (filterStatus !== 'ALL') list = list.filter(r => r.status === filterStatus)
    const dir = sortOrder === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (sortKey === 'id') return (a.id - b.id) * dir
      if (sortKey === 'due') return (a.due_date || '').localeCompare(b.due_date || '') * dir
      if (sortKey === 'priority') return priorityWeight(a.priority) - priorityWeight(b.priority) * dir
      return a.created_at.localeCompare(b.created_at) * dir
    })
  }, [rows, query, filterStatus, sortKey, sortOrder])

  function priorityWeight(p: TaskPriority) { return p === 'HIGH' ? 3 : p === 'MEDIUM' ? 2 : 1 }

  function renderPriorityBadge(p: TaskPriority) {
    if (p === 'HIGH') return <Badge tone="warning">HIGH</Badge>
    if (p === 'LOW') return <Badge tone="muted">LOW</Badge>
    return <Badge>MEDIUM</Badge>
  }
  function renderStatusBadge(s: TaskStatus) {
    if (s === 'DONE') return <Badge tone="success">Hoàn thành</Badge>
    if (s === 'CANCELLED') return <Badge tone="warning">Đã hủy</Badge>
    if (s === 'IN_PROGRESS') return <Badge>Đang làm</Badge>
    return <Badge tone="muted">Chờ</Badge>
  }

  function openCreate() {
    setEdit({ title: '', assignee: '', due_date: '', priority: 'MEDIUM', status: 'TODO', description: '' })
    setEditOpen(true)
  }
  function openEditRow(r: StaffTask) {
    setEdit({ id: r.id, title: r.title, assignee: r.assignee, due_date: r.due_date || '', priority: r.priority, status: r.status, description: r.description || '' })
    setEditOpen(true)
  }
  function confirmDelete(id: number) { setConfirmOpen({ open: true, id }) }
  async function doDelete() {
    if (!confirmOpen.id) return
    const id = confirmOpen.id
    try {
      const res = await fetch(`/api/system/tasks?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Vô hiệu hóa công việc thất bại')
      await refetchTasks()
      setFlash({ type: 'success', text: 'Đã vô hiệu hóa công việc.' })
    } catch (e: any) {
      setFlash({ type: 'error', text: e.message || 'Có lỗi xảy ra' })
    } finally {
      setConfirmOpen({ open: false })
    }
  }

  async function activateTask(id: number) {
    try {
      const res = await fetch(`/api/system/tasks`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ id, isActive: true })
      })
      if (!res.ok) throw new Error('Kích hoạt công việc thất bại')
      await refetchTasks()
      setFlash({ type: 'success', text: 'Đã kích hoạt công việc.' })
    } catch (e: any) {
      setFlash({ type: 'error', text: e.message || 'Có lỗi xảy ra' })
    }
  }

  async function save() {
    if (!edit.title.trim() || !edit.assignee.trim()) {
      setFlash({ type: 'error', text: 'Vui lòng nhập Tiêu đề và Người phụ trách.' })
      return
    }
    const payload = {
      id: edit.id,
      title: edit.title.trim(),
      assignee: edit.assignee.trim(),
      due_date: edit.due_date || undefined,
      priority: edit.priority,
      status: edit.status,
      description: edit.description.trim() || undefined
    }

    try {
      if (edit.id) {
        const res = await fetch('/api/system/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) throw new Error('Cập nhật công việc thất bại')
        await refetchTasks()
        setFlash({ type: 'success', text: 'Đã cập nhật công việc.' })
      } else {
        const res = await fetch('/api/system/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) throw new Error('Tạo công việc thất bại')
        await refetchTasks()
        setFlash({ type: 'success', text: 'Đã tạo công việc mới.' })
      }
    setEditOpen(false)
    } catch (e: any) {
      setFlash({ type: 'error', text: e.message || 'Có lỗi xảy ra' })
    }
  }

  return (
    <>
      {/* Header - match admin style */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 px-4 sm:px-6 py-4 sm:py-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
          <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">Công việc</h1>
              <p className="text-sm text-gray-500 truncate">{filtered.length} công việc</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={openCreate} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm flex-shrink-0 rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="hidden sm:inline ml-1">Tạo công việc</span>
            </Button>
            <button
              aria-label="Xuất Excel (CSV)"
              title="Xuất Excel (CSV)"
              className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-xs sm:text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"
              onClick={() => {
                const csv = [['ID', 'Tiêu đề', 'Người phụ trách', 'Hạn', 'Ưu tiên', 'Trạng thái', 'Mô tả', 'Ngày tạo'], ...filtered.map(r => [r.id, r.title, r.assignee, r.due_date || '', r.priority, r.status, r.description || '', r.created_at])]
                const blob = new Blob([csv.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'tasks.csv'
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
      <div className="w-full px-4 py-3 space-y-3">
        {flash && (
          <div className={`rounded-md border p-2 sm:p-3 text-xs sm:text-sm shadow-sm ${flash.type==='success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {flash.text}
          </div>
        )}

        {/* Removed Demo/Live indicator */}

        {/* Filters - match admin pattern */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
          {/* Mobile */}
          <div className="lg:hidden space-y-3">
        <div>
              <div className="relative">
          <Input 
            placeholder="Tìm theo tiêu đề, người phụ trách..." 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
                  className="w-full pl-4 pr-10 py-3 text-sm border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
        </div>
            <div className="grid grid-cols-2 gap-3">
        <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Trạng thái</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
                  <option value="ALL">Tất cả</option>
            <option value="TODO">TODO</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="DONE">DONE</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
        <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sắp xếp</label>
          <select 
            value={sortKey} 
            onChange={(e) => setSortKey(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="created">Ngày tạo</option>
            <option value="due">Hạn</option>
            <option value="priority">Ưu tiên</option>
            <option value="id">ID</option>
          </select>
              </div>
        </div>
        <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Thứ tự</label>
          <select 
            value={sortOrder} 
            onChange={(e) => setSortOrder(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="asc">Tăng dần</option>
            <option value="desc">Giảm dần</option>
          </select>
        </div>
      </div>

          {/* Desktop */}
          <div className="hidden lg:flex flex-row gap-4 items-center">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Input
                  placeholder="Tìm theo tiêu đề, người phụ trách..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-4 pr-10 py-2 text-sm border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="w-40 flex-shrink-0">
              <label className="block text-xs font-medium text-gray-600 mb-1">Trạng thái</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tất cả</option>
                <option value="TODO">TODO</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="DONE">DONE</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <div className="w-36 flex-shrink-0">
              <label className="block text-xs font-medium text-gray-600 mb-1">Sắp xếp</label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="created">Ngày tạo</option>
                <option value="due">Hạn</option>
                <option value="priority">Ưu tiên</option>
                <option value="id">ID</option>
              </select>
            </div>
            <div className="w-28 flex-shrink-0">
              <label className="block text-xs font-medium text-gray-600 mb-1">Thứ tự</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="asc">Tăng dần</option>
                <option value="desc">Giảm dần</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table/Card */}
        <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-gray-50 border-b border-gray-200 px-6 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg text-left font-bold text-gray-900">Danh sách công việc</h2>
              <span className="text-sm text-right font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">{filtered.length} công việc</span>
            </div>
        </CardHeader>
          <CardBody className="p-0">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
              <thead>
                  <tr className="bg-gray-50 text-gray-700">
                    <th className="px-4 py-3 text-left font-semibold">Tiêu đề</th>
                    <th className="px-4 py-3 text-center font-semibold">Người phụ trách</th>
                    <th className="px-4 py-3 text-center font-semibold">Hạn</th>
                    <th className="px-4 py-3 text-center font-semibold">Ưu tiên</th>
                    <th className="px-4 py-3 text-center font-semibold">Trạng thái</th>
                    <th className="px-4 py-3 text-center font-semibold">Kích hoạt</th>
                    <th className="px-4 py-3 text-center font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                  {filtered.slice((page - 1) * size, page * size).map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 border-b border-gray-100">
                      <td className="px-4 py-3 text-gray-900">
                        <span title={r.title} className="block truncate">{r.title}</span>
                    </td>
                      <td className="px-4 py-3 text-center text-gray-700">{r.assignee}</td>
                      <td className="px-4 py-3 text-center text-gray-700 whitespace-nowrap">{r.due_date || '—'}</td>
                      <td className="px-4 py-3 text-center">{renderPriorityBadge(r.priority)}</td>
                      <td className="px-4 py-3 text-center">{renderStatusBadge(r.status)}</td>
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
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => { setSelected(r); setDetailOpen(true) }}>Xem</Button>
                          <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => openEditRow(r)}>Sửa</Button>
                          {r.isActive !== false ? (
                            <Button variant="danger" className="h-8 px-3 text-xs" onClick={() => confirmDelete(r.id)}>Vô hiệu</Button>
                          ) : (
                            <Button className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700" onClick={() => activateTask(r.id)}>Kích hoạt</Button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

            {/* Mobile Cards */}
            <div className="lg:hidden p-3">
              <div className="space-y-3">
                {filtered.slice((page - 1) * size, page * size).map((r) => (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                    {/* Header giống bookings */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                            <span className="text-white font-bold text-sm">{(r.title || 'T').charAt(0)}</span>
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-gray-900 text-base truncate" title={r.title}>{r.title}</h3>
                            <p className="text-sm text-gray-600 truncate">{r.assignee}</p>
                          </div>
                        </div>
                        <div className="flex-shrink-0">{renderStatusBadge(r.status)}</div>
                      </div>
                    </div>

                    {/* Nội dung giống bookings */}
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-500">Hạn</p>
                            <p className="text-sm font-semibold text-gray-900 truncate">{r.due_date || '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6l-2 4-4 2 4 2 2 4 2-4 4-2-4-2-2-4z" />
                          </svg>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-500">Ưu tiên</p>
                            <div className="mt-0.5">{renderPriorityBadge(r.priority)}</div>
                          </div>
                        </div>
                      </div>
                      {r.description && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">Mô tả</p>
                          <p className="text-sm text-gray-700">{r.description}</p>
                        </div>
                      )}
                    </div>

                    {/* Nút thao tác giống bookings */}
                    <div className="px-3 py-3 bg-gray-50 border-t border-gray-100">
                      <div className="grid grid-cols-3 gap-2">
                        <Button variant="secondary" className="h-10 text-xs font-medium px-2" onClick={() => { setSelected(r); setDetailOpen(true) }}>Xem</Button>
                        <Button className="h-10 text-xs font-medium px-2" onClick={() => openEditRow(r)}>Sửa</Button>
                        {r.isActive !== false ? (
                          <Button variant="danger" className="h-10 text-xs font-medium px-2" onClick={() => confirmDelete(r.id)}>Vô hiệu</Button>
                        ) : (
                          <Button className="h-10 text-xs font-medium px-2 bg-green-600 hover:bg-green-700" onClick={() => activateTask(r.id)}>Kích hoạt</Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>

          {/* Pagination */}
          {filtered.length > size && (
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-3 py-4 border-t border-gray-200/50">
              {/* Mobile */}
              <div className="lg:hidden">
                <div className="text-center mb-4">
                  <div className="text-sm text-gray-600 mb-1">Hiển thị kết quả</div>
                  <div className="text-lg font-bold text-gray-900">
                    <span className="text-blue-600">{(page - 1) * size + 1}</span> - <span className="text-blue-600">{Math.min(page * size, filtered.length)}</span> / <span className="text-gray-600">{filtered.length}</span>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)} className="h-10 px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">Trước</Button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-700 bg-white px-4 py-2 rounded-xl border-2 border-blue-200 shadow-sm">{page}</span>
                    <span className="text-sm text-gray-500">/ {Math.ceil(filtered.length / size)}</span>
                  </div>
                  <Button variant="secondary" disabled={page >= Math.ceil(filtered.length / size)} onClick={() => setPage(page + 1)} className="h-10 px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">Sau</Button>
                </div>
              </div>
              {/* Desktop */}
              <div className="hidden lg:flex flex-row items-center justify-between gap-6">
                <div className="text-left">
                  <div className="text-sm text-gray-600 mb-1">Hiển thị kết quả</div>
                  <div className="text-lg font-bold text-gray-900">
                    <span className="text-blue-600">{(page - 1) * size + 1}</span> - <span className="text-blue-600">{Math.min(page * size, filtered.length)}</span> / <span className="text-gray-600">{filtered.length}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)} className="h-10 px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">Trước</Button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-700 bg-white px-4 py-2 rounded-xl border-2 border-blue-200 shadow-sm">{page}</span>
                    <span className="text-sm text-gray-500">/ {Math.ceil(filtered.length / size)}</span>
                  </div>
                  <Button variant="secondary" disabled={page >= Math.ceil(filtered.length / size)} onClick={() => setPage(page + 1)} className="h-10 px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">Sau</Button>
                </div>
              </div>
            </div>
          )}
      </Card>

      {/* Modal chi tiết */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết công việc">
        {selected ? (
          <div className="p-3 sm:p-4 space-y-4">
            {/* Header gradient giống bookings */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 sm:p-4 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate" title={selected.title}>{selected.title}</h2>
                  <p className="text-sm sm:text-base text-gray-600 truncate">Người phụ trách: {selected.assignee}</p>
                </div>
              </div>
            </div>

            {/* Thông tin nhanh */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-blue-100">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Hạn</span>
                </div>
                <p className="text-sm sm:text-base font-bold text-blue-900">{selected.due_date || '—'}</p>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-blue-100">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6l-2 4-4 2 4 2 2 4 2-4 4-2-4-2-2-4z" />
                  </svg>
                  <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Ưu tiên</span>
                </div>
                <div className="mt-1">{renderPriorityBadge(selected.priority)}</div>
              </div>
            </div>

            {/* Trạng thái & Ngày tạo */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-blue-100">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Trạng thái</span>
                </div>
                <div className="mt-1">{renderStatusBadge(selected.status)}</div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-blue-100">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                  </svg>
                  <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Ngày tạo</span>
                </div>
                <p className="text-sm sm:text-base font-bold text-blue-900">{selected.created_at.replace('T',' ')}</p>
              </div>
            </div>

            {/* Mô tả */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Mô tả</span>
              </div>
              <p className="text-sm sm:text-base text-gray-800">{selected.description || '—'}</p>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Modal tạo/sửa */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={edit.id ? 'Sửa công việc' : 'Tạo công việc'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Hủy</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={save}>Lưu</Button>
          </div>
        }
      >
        <div className="p-1 sm:p-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tiêu đề *</label>
              <Input className="px-4 py-3 text-base rounded-xl" value={edit.title} onChange={(e) => setEdit((f) => ({ ...f, title: e.target.value }))} />
              {!edit.title.trim() && <div className="mt-1 text-xs text-red-600">Bắt buộc.</div>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Người phụ trách *</label>
              <Input className="px-4 py-3 text-base rounded-xl" value={edit.assignee} onChange={(e) => setEdit((f) => ({ ...f, assignee: e.target.value }))} />
              {!edit.assignee.trim() && <div className="mt-1 text-xs text-red-600">Bắt buộc.</div>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Hạn</label>
              <Input type="date" className="px-4 py-3 text-base rounded-xl" value={edit.due_date} onChange={(e) => setEdit((f) => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Ưu tiên</label>
              <select className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base" value={edit.priority} onChange={(e) => setEdit((f) => ({ ...f, priority: e.target.value as TaskPriority }))}>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Trạng thái</label>
              <select className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base" value={edit.status} onChange={(e) => setEdit((f) => ({ ...f, status: e.target.value as TaskStatus }))}>
                <option value="TODO">Chờ</option>
                <option value="IN_PROGRESS">Đang làm</option>
                <option value="DONE">Hoàn thành</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Mô tả</label>
              <Input className="px-4 py-3 text-base rounded-xl" value={edit.description} onChange={(e) => setEdit((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
        </div>
      </Modal>

      {/* Xác nhận xóa */}
      <Modal
        open={confirmOpen.open}
        onClose={() => setConfirmOpen({ open: false })}
        title="Xác nhận vô hiệu hóa"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen({ open: false })}>Hủy</Button>
            <Button variant="danger" onClick={doDelete}>Vô hiệu hóa</Button>
          </div>
        }
      >
        <div className="text-sm text-gray-700">Bạn có chắc muốn vô hiệu hóa công việc này? Công việc sẽ không bị xóa và có thể được kích hoạt lại sau.</div>
      </Modal>
      </div>
    </>
  );
}



