"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useStaffTasks, useStaffProfiles } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { Table, THead, TBody } from "@/components/ui/Table";

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'

type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

type StaffTask = {
  id: number
  title: string
  assignee: string
  assignedTo?: number
  department?: string
  due_date?: string
  priority: TaskPriority
  status: TaskStatus
  description?: string
  created_at: string
  isActive?: boolean
}

function normalizeTask(t: any, staffProfiles: any[] = []): StaffTask {
  const assignedTo = t.assignedTo !== undefined ? Number(t.assignedTo) : undefined
  const staff = assignedTo ? staffProfiles.find((s: any) => Number(s.id) === assignedTo) : null
  const department = staff?.department || t.department || ''
  
  // Convert dueAt (ISO) to due_date (YYYY-MM-DD) for display
  let due_date = ''
  if (t.dueAt) {
    try {
      const date = new Date(t.dueAt)
      due_date = date.toISOString().split('T')[0]
    } catch (e) {
      due_date = t.due_date || t.dueDate || ''
    }
  } else {
    due_date = t.due_date || t.dueDate || ''
  }
  
  // Map status: OPEN -> TODO for display
  let statusStr = (t.status || 'TODO').toUpperCase()
  let status: TaskStatus = 'TODO'
  if (statusStr === 'OPEN' || statusStr === 'TODO') {
    status = 'TODO'
  } else if (statusStr === 'IN_PROGRESS') {
    status = 'IN_PROGRESS'
  } else if (statusStr === 'DONE') {
    status = 'DONE'
  } else if (statusStr === 'CANCELLED') {
    status = 'CANCELLED'
  }
  
  return {
    id: Number(t.id) || 0,
    title: String(t.title || t.name || ''),
    assignee: department, // Hiển thị department
    assignedTo: assignedTo,
    department: department,
    due_date: due_date,
    priority: (t.priority || 'MEDIUM').toUpperCase() as TaskPriority,
    status: status,
    description: t.description || t.note || '',
    created_at: t.created_at || t.createdAt || '',
    isActive: t.isActive !== undefined ? !!t.isActive : undefined,
  }
}

export default function TasksPage() {
  const [flash, setFlash] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [query, setQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<'ALL' | TaskStatus>('ALL')
  const [filterPriority, setFilterPriority] = useState<'ALL' | TaskPriority>('ALL')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<StaffTask | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<{ id?: number, title: string, assignedTo: number | null, due_date: string, priority: TaskPriority, status: TaskStatus, description: string }>({ title: '', assignedTo: null, due_date: '', priority: 'MEDIUM', status: 'TODO', description: '' })
  const [fieldErrors, setFieldErrors] = useState<{ title?: string, assignedTo?: string, due_date?: string, priority?: string, status?: string, description?: string }>({})
  const [confirmOpen, setConfirmOpen] = useState<{ open: boolean, id?: number }>({ open: false })

  // Use hooks
  const { data: tasksData, loading: tasksLoading, refetch: refetchTasks } = useStaffTasks({
    status: filterStatus !== 'ALL' ? filterStatus : undefined,
  })
  const { data: staffProfilesData } = useStaffProfiles()

  // Get staff profiles
  const staffProfiles = useMemo(() => {
    if (!staffProfilesData) return []
    const data = staffProfilesData as any
    return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
  }, [staffProfilesData])

  // Normalize and store tasks - map assignedTo to department for display
  const rows = useMemo(() => {
    if (!tasksData) return []
    const data = tasksData as any
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
    return items.map((t: any) => normalizeTask(t, staffProfiles))
  }, [tasksData, staffProfiles])

  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 3000); return () => clearTimeout(t) }, [flash])

  // Keyboard shortcuts
  useEffect(() => {
    if (!editOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
      const isTextarea = tag === 'textarea'

      if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !isTextarea) {
        e.preventDefault()
        save()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setEditOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editOpen, edit])

  // Global Escape handler
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setEditOpen(false)
        setDetailOpen(false)
        setConfirmOpen({ open: false })
      }
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r: StaffTask) => {
      // Search filter
      const matchesSearch = !q || r.title.toLowerCase().includes(q) || r.assignee.toLowerCase().includes(q) || (r.description||'').toLowerCase().includes(q)
      // Status filter
      const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus
      // Priority filter
      const matchesPriority = filterPriority === 'ALL' || r.priority === filterPriority
      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [rows, query, filterStatus, filterPriority])

  function priorityWeight(p: TaskPriority) { return p === 'HIGH' ? 3 : p === 'MEDIUM' ? 2 : 1 }

  function renderPriorityBadge(p: TaskPriority) {
    if (p === 'HIGH') return <Badge tone="error">HIGH</Badge>
    if (p === 'LOW') return <Badge tone="muted">LOW</Badge>
    return <Badge tone="warning">MEDIUM</Badge>
  }
  function renderStatusBadge(s: TaskStatus) {
    if (s === 'DONE') return <Badge tone="success">Hoàn thành</Badge>
    if (s === 'CANCELLED') return <Badge tone="error">Đã hủy</Badge>
    if (s === 'IN_PROGRESS') return <Badge tone="in-progress">Đang làm</Badge>
    return <Badge tone="muted">Chờ</Badge>
  }

  function openCreate() {
    setEdit({ title: '', assignedTo: null, due_date: '', priority: 'MEDIUM', status: 'TODO', description: '' })
    setFieldErrors({})
    setFlash(null)
    setEditOpen(true)
  }
  function openEditRow(r: StaffTask) {
    setEdit({ id: r.id, title: r.title, assignedTo: r.assignedTo || null, due_date: r.due_date || '', priority: r.priority, status: r.status, description: r.description || '' })
    setFieldErrors({})
    setFlash(null)
    setEditOpen(true)
  }
  function confirmDelete(id: number) { setConfirmOpen({ open: true, id }) }
  
  function openDetail(task: StaffTask) {
    setSelected(task)
    setDetailOpen(true)
  }

  async function doDelete() {
    if (!confirmOpen.id) return
    const id = confirmOpen.id
    try {
      const response = await apiClient.deleteStaffTask(id)
      if (response.success) {
        const currentPageStart = (page - 1) * size
        if (currentPageStart >= filtered.length - 1 && page > 1) {
          setPage(page - 1)
        }
        await refetchTasks()
        setFlash({ type: 'success', text: 'Đã xóa công việc.' })
      } else {
        setFlash({ type: 'error', text: response.error || response.message || 'Có lỗi xảy ra khi xóa công việc' })
      }
    } catch (e: any) {
      setFlash({ type: 'error', text: e.message || 'Có lỗi xảy ra' })
    } finally {
      setConfirmOpen({ open: false })
    }
  }

  async function save() {
    // Reset field errors
    setFieldErrors({})
    setFlash(null)
    
    // Basic validation
    const errors: { title?: string, assignedTo?: string, due_date?: string, priority?: string, status?: string, description?: string } = {}
    
    if (!edit.title.trim()) {
      errors.title = 'Vui lòng nhập Tiêu đề.'
    } else if (edit.title.trim().length < 3) {
      errors.title = 'Tiêu đề phải có ít nhất 3 ký tự.'
    } else if (edit.title.trim().length > 200) {
      errors.title = 'Tiêu đề không được vượt quá 200 ký tự.'
    }
    
    if (!edit.assignedTo || edit.assignedTo <= 0) {
      errors.assignedTo = 'Vui lòng chọn Nhân viên.'
    }
    
    if (edit.due_date) {
      const dueDate = new Date(edit.due_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (isNaN(dueDate.getTime())) {
        errors.due_date = 'Thời gia làm không hợp lệ.'
      }
    }
    
    if (!edit.priority || !['LOW', 'MEDIUM', 'HIGH'].includes(edit.priority)) {
      errors.priority = 'Vui lòng chọn Ưu tiên hợp lệ.'
    }
    
    if (!edit.status || !['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'].includes(edit.status)) {
      errors.status = 'Vui lòng chọn Trạng thái hợp lệ.'
    }
    
    if (edit.description && edit.description.length > 1000) {
      errors.description = 'Mô tả không được vượt quá 1000 ký tự.'
    }
    
    // If there are errors, show them and stop (don't call API)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    
    // Convert due_date to dueAt (ISO format)
    let dueAt: string | undefined = undefined
    if (edit.due_date) {
      try {
        // If it's just a date (YYYY-MM-DD), convert to ISO datetime
        if (edit.due_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dueAt = new Date(edit.due_date + 'T00:00:00').toISOString()
        } else {
          dueAt = new Date(edit.due_date).toISOString()
        }
      } catch (e) {
        // Invalid date, leave as undefined
      }
    }

    // Map status: TODO -> OPEN for backend
    let backendStatus: string = edit.status
    if (edit.status === 'TODO') {
      backendStatus = 'OPEN'
    }

    const payload = {
      relatedType: "SERVICE_ORDER" as const,
      relatedId: 0,
      title: edit.title.trim(),
      description: edit.description.trim() || "",
      assignedTo: edit.assignedTo,
      taskCreatedBy: edit.assignedTo, // Use assignedTo as fallback if no user session
      priority: edit.priority,
      status: backendStatus,
      dueAt: dueAt
    }

    try {
      const response = edit.id
        ? await apiClient.updateStaffTask(edit.id, payload)
        : await apiClient.createStaffTask(payload)

      if (response.success) {
        if (!edit.id) {
          setPage(1)
        }
        await refetchTasks()
        setEditOpen(false)
        setFieldErrors({})
        setFlash({ type: 'success', text: edit.id ? 'Đã cập nhật công việc.' : 'Đã tạo công việc mới.' })
      } else {
        const errorMsg = response.error || response.message || 'Có lỗi xảy ra khi lưu công việc.'
        
        // Map error to specific field
        if (/(title|tiêu đề)/i.test(errorMsg)) {
          setFieldErrors({ title: errorMsg })
        } else if (/(assignee|assignedTo|nhân viên)/i.test(errorMsg)) {
          setFieldErrors({ assignedTo: errorMsg })
        } else if (/(due|thời gian|due_date|dueAt)/i.test(errorMsg)) {
          setFieldErrors({ due_date: errorMsg })
        } else if (/(priority|ưu tiên)/i.test(errorMsg)) {
          setFieldErrors({ priority: errorMsg })
        } else if (/(status|trạng thái)/i.test(errorMsg)) {
          setFieldErrors({ status: errorMsg })
        } else if (/(description|mô tả)/i.test(errorMsg)) {
          setFieldErrors({ description: errorMsg })
      } else {
          setFieldErrors({ title: errorMsg })
        }
        setFlash({ type: 'error', text: errorMsg })
      }
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : 'Có lỗi xảy ra khi lưu công việc.'
      setFieldErrors({ title: errorMsg })
      setFlash({ type: 'error', text: errorMsg })
    }
  }

  return (
    <>
      <div className="px-6 pt-4 pb-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header & Filters Card */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
            <div className="header border-b border-gray-200/50 px-6 py-4">
        <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Quản lý công việc</h1>
                <Button onClick={openCreate} variant="primary" className="px-5 py-2.5 text-sm rounded-xl">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
                  Tạo công việc
            </Button>
        </div>
      </div>

            <div className="bg-white px-6 py-4">
          {/* Mobile */}
          <div className="lg:hidden space-y-3">
        <div>
              <div className="relative">
          <Input 
            placeholder="Tìm theo tiêu đề, người phụ trách..." 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
                      className="w-full pl-4 pr-10 py-2.5 text-sm border-gray-300 rounded-xl focus:ring-0 focus:border-gray-300"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
                  <div className="relative rounded-xl border border-gray-300 bg-white overflow-hidden">
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value as any)}
                      className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
          >
                  <option value="ALL">Tất cả</option>
                      <option value="TODO">Chờ</option>
                      <option value="IN_PROGRESS">Đang làm</option>
                      <option value="DONE">Hoàn thành</option>
                      <option value="CANCELLED">Đã hủy</option>
          </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
        </div>
              </div>
                  <div className="relative rounded-xl border border-gray-300 bg-white overflow-hidden">
          <select 
            value={filterPriority} 
            onChange={(e) => setFilterPriority(e.target.value as any)}
                      className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
          >
                  <option value="ALL">Tất cả</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
          </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
        </div>
              </div>
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
                      className="w-full pl-4 pr-10 py-2.5 text-sm border-gray-300 rounded-xl focus:ring-0 focus:border-gray-300"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
                <div className="w-40 flex-shrink-0 relative rounded-xl border border-gray-300 bg-white overflow-hidden">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
              >
                    <option value="ALL">Tất cả</option>
                    <option value="TODO">Chờ</option>
                    <option value="IN_PROGRESS">Đang làm</option>
                    <option value="DONE">Hoàn thành</option>
                    <option value="CANCELLED">Đã hủy</option>
              </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div className="w-40 flex-shrink-0 relative rounded-xl border border-gray-300 bg-white overflow-hidden">
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as any)}
                    className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
              >
                    <option value="ALL">Tất cả</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
              </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              </div>
            </div>

          {/* Success/Error Messages */}
          {flash && (
            <div className={`py-2.5 rounded-xl px-4 border shadow-sm animate-fade-in flex items-center gap-2 ${
              flash.type === 'success' ? 'bg-green-50 text-green-800 border-green-100' : 'bg-red-50 text-red-800 border-red-100'
            }`}>
              <svg className={`w-5 h-5 ${flash.type === 'success' ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {flash.type === 'success' 
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                }
              </svg>
              <span className="text-sm font-medium">{flash.text}</span>
            </div>
          )}

          {/* Table Card */}
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Danh sách công việc</h2>
                <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                  {filtered.length} công việc
                </span>
            </div>
        </CardHeader>

          <CardBody className="p-0">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <THead>
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-bold">Tiêu đề</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Người phụ trách</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Thời gian</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Ưu tiên</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Trạng thái</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Thao tác</th>
                </tr>
                  </THead>
                  <TBody>
                    {filtered.slice((page - 1) * size, page * size).map((r: StaffTask, index: number) => {
                      // Tìm staff từ assignedTo
                      const assignedStaff = r.assignedTo ? staffProfiles.find((s: any) => Number(s.id) === r.assignedTo) : null
                      const staffName = assignedStaff ? (assignedStaff.full_name || assignedStaff.fullName || assignedStaff.name || `Staff ${r.assignedTo}`) : (r.assignedTo ? `Staff ${r.assignedTo}` : '—')
                      
                      return (
                      <tr key={r.id} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:bg-[#f2f8fe]`}>
                        <td className="px-4 py-3 text-left text-gray-900">
                        <span title={r.title} className="block truncate">{r.title}</span>
                    </td>
                      <td className="px-4 py-3 text-center text-gray-700">{staffName}</td>
                      <td className="px-4 py-3 text-center text-gray-700 whitespace-nowrap">{r.due_date || '—'}</td>
                      <td className="px-4 py-3 text-center">{renderPriorityBadge(r.priority)}</td>
                      <td className="px-4 py-3 text-center">{renderStatusBadge(r.status)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                            <Button variant="secondary" className="h-8 px-3 text-xs bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]" onClick={() => openDetail(r)}>Xem</Button>
                            <Button variant="secondary" className="h-8 px-3 text-xs bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]" onClick={() => openEditRow(r)}>Sửa</Button>
                            <Button variant="danger" className="h-8 px-3 text-xs" onClick={() => confirmDelete(r.id)}>Xóa</Button>
                      </div>
                    </td>
                  </tr>
                      )
                    })}
                  </TBody>
                </Table>
          </div>

            {/* Mobile Cards */}
            <div className="lg:hidden p-3">
              <div className="space-y-3">
                  {filtered.slice((page - 1) * size, page * size).map((r: StaffTask) => (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                      {/* Header */}
                      <div className="bg-[hsl(var(--page-bg))]/40 px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                            <span className="text-white font-bold text-sm">{(r.title || 'T').charAt(0)}</span>
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-gray-900 text-base truncate" title={r.title}>{r.title}</h3>
                              {(() => {
                                // Tìm staff từ assignedTo
                                const assignedStaff = r.assignedTo ? staffProfiles.find((s: any) => Number(s.id) === r.assignedTo) : null
                                const staffName = assignedStaff ? (assignedStaff.full_name || assignedStaff.fullName || assignedStaff.name || `Staff ${r.assignedTo}`) : (r.assignedTo ? `Staff ${r.assignedTo}` : '—')
                                return <p className="text-sm text-gray-600 truncate">{staffName}</p>
                              })()}
                          </div>
                        </div>
                        <div className="flex-shrink-0">{renderStatusBadge(r.status)}</div>
                      </div>
                    </div>

                      {/* Content */}
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-500">Thời gian</p>
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

                      {/* Actions */}
                    <div className="px-3 py-3 bg-gray-50 border-t border-gray-100">
                      <div className="grid grid-cols-3 gap-2">
                          <Button variant="secondary" className="h-10 text-xs font-medium px-2 bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]" onClick={() => openDetail(r)}>Xem</Button>
                          <Button variant="secondary" className="h-10 text-xs font-medium px-2 bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]" onClick={() => openEditRow(r)}>Sửa</Button>
                          <Button variant="danger" className="h-10 text-xs font-medium px-2" onClick={() => confirmDelete(r.id)}>Xóa</Button>
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
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết công việc" size="lg">
        <div className="p-4 sm:p-6">
          {selected && (() => {
            // Tìm staff từ assignedTo
            const assignedStaff = selected.assignedTo ? staffProfiles.find((s: any) => Number(s.id) === selected.assignedTo) : null
            const staffName = assignedStaff ? (assignedStaff.full_name || assignedStaff.fullName || assignedStaff.name || `Staff ${selected.assignedTo}`) : (selected.assignedTo ? `Staff ${selected.assignedTo}` : '—')
            const staffDepartment = assignedStaff?.department || ''
            
            return (
            <div className="space-y-6">
              {/* Header với thông tin chính */}
              <div className="bg-gradient-to-r from-[hsl(var(--page-bg))] to-[hsl(var(--primary)/0.08)] rounded-xl p-4 sm:p-6 border border-[hsl(var(--primary)/0.25)]">
                <div className="space-y-4">
                  {/* Header với icon và status */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[hsl(var(--primary))] rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate" title={selected.title}>
                          {selected.title}
                        </h2>
                        <p className="text-base sm:text-lg text-gray-600 truncate mt-2">
                          Người phụ trách: {staffName} {staffDepartment ? `(${staffDepartment})` : ''}
                        </p>
                </div>
              </div>
                    <div className="flex-shrink-0 w-full sm:w-auto flex justify-start sm:justify-end">
                      {(() => {
                        // Render status badge với kích thước lớn hơn cho modal chi tiết
                        const s = selected.status
                        if (s === 'DONE') return <Badge tone="success" className="text-base sm:text-lg px-4 py-2 font-semibold">Hoàn thành</Badge>
                        if (s === 'CANCELLED') return <Badge tone="error" className="text-base sm:text-lg px-4 py-2 font-semibold">Đã hủy</Badge>
                        if (s === 'IN_PROGRESS') return <Badge tone="in-progress" className="text-base sm:text-lg px-4 py-2 font-semibold">Đang làm</Badge>
                        return <Badge tone="muted" className="text-base sm:text-lg px-4 py-2 font-semibold">Chờ</Badge>
                      })()}
                    </div>
            </div>

            {/* Thông tin nhanh */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                      <p className="text-sm sm:text-base font-semibold text-gray-700">
                        <span className="text-gray-600">ID:</span>{" "}
                        <span className="font-bold text-[hsl(var(--primary))]">{selected.id}</span>
                      </p>
              </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                      <div className="text-sm sm:text-base font-semibold text-gray-700">
                        <span className="text-gray-600">Ưu tiên:</span>{" "}
                        <div className="mt-1 inline-block">{renderPriorityBadge(selected.priority)}</div>
                </div>
              </div>
            </div>

                  {/* Thời gian */}
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                    <p className="text-sm sm:text-base font-semibold text-gray-700">
                      <span className="text-gray-600">Thời gian:</span>{" "}
                      <span className="font-bold text-[hsl(var(--primary))]">{selected.due_date || '—'}</span>
                    </p>
                </div>
                </div>
              </div>

              {selected.description && (
                <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-gray-200">
                  <p className="text-sm text-gray-800 whitespace-pre-line">
                    <span className="font-semibold text-gray-600">Mô tả:</span>{" "}
                    {selected.description}
                  </p>
                </div>
              )}

              {selected.created_at && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-gray-200">
                    <div className="text-xs sm:text-sm font-semibold text-gray-500 mb-1">Ngày tạo</div>
                    <p className="text-sm font-medium text-gray-900">
                      {selected.created_at ? new Date(selected.created_at).toLocaleString('vi-VN') : '—'}
                    </p>
              </div>
            </div>
              )}
          </div>
            )
          })()}
        </div>
      </Modal>

      {/* Modal tạo/sửa */}
      <Modal
        open={editOpen}
        onClose={() => {
          setEditOpen(false)
          setFieldErrors({})
          setFlash(null)
        }}
        title={edit.id ? 'Sửa công việc' : 'Tạo công việc'}
        size="lg"
      >
        <div className="p-4 sm:p-6">
          <div className="space-y-4" key={edit.id || 'new'}>
            {/* Form */}
            <div className="space-y-3">
              {/* Tiêu đề và Người phụ trách */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề <span className="text-red-500">*</span></label>
                  <Input
                    key={`title-${edit.id || 'new'}`}
                    value={edit.title}
                    onChange={(e) => {
                      setEdit({ ...edit, title: e.target.value })
                      if (fieldErrors.title) {
                        setFieldErrors({ ...fieldErrors, title: undefined })
                      }
                    }}
                    placeholder="Nhập tiêu đề công việc"
                    className={`w-full ${fieldErrors.title ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {fieldErrors.title && (
                    <div className="mt-1 text-sm font-medium text-red-600">{fieldErrors.title}</div>
                  )}
            </div>
            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Người phụ trách <span className="text-red-500">*</span></label>
                  <select
                    key={`assignedTo-${edit.id || 'new'}`}
                    value={edit.assignedTo || ''}
                    onChange={(e) => {
                      const staffId = e.target.value ? Number(e.target.value) : null
                      setEdit({ ...edit, assignedTo: staffId })
                      if (fieldErrors.assignedTo) {
                        setFieldErrors({ ...fieldErrors, assignedTo: undefined })
                      }
                    }}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${fieldErrors.assignedTo ? 'border-red-500' : ''}`}
                  >
                    <option value="">Chọn nhân viên...</option>
                    {staffProfiles.map((staff: any) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.full_name || staff.fullName || staff.name || `Staff ${staff.id}`} {staff.department ? `(${staff.department})` : ''}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.assignedTo && (
                    <div className="mt-1 text-sm font-medium text-red-600">{fieldErrors.assignedTo}</div>
                  )}
            </div>
          </div>

              {/* Thời gian và Ưu tiên */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian</label>
                  <Input
                    key={`due_date-${edit.id || 'new'}`}
                    type="date"
                    value={edit.due_date}
                    onChange={(e) => {
                      setEdit({ ...edit, due_date: e.target.value })
                      if (fieldErrors.due_date) {
                        setFieldErrors({ ...fieldErrors, due_date: undefined })
                      }
                    }}
                    className={`w-full ${fieldErrors.due_date ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {fieldErrors.due_date && (
                    <div className="mt-1 text-sm font-medium text-red-600">{fieldErrors.due_date}</div>
                  )}
            </div>
            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ưu tiên</label>
                  <select
                    key={`priority-${edit.id || 'new'}`}
                    value={edit.priority}
                    onChange={(e) => {
                      setEdit({ ...edit, priority: e.target.value as TaskPriority })
                      if (fieldErrors.priority) {
                        setFieldErrors({ ...fieldErrors, priority: undefined })
                      }
                    }}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${fieldErrors.priority ? 'border-red-500' : ''}`}
                  >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
                  {fieldErrors.priority && (
                    <div className="mt-1 text-sm font-medium text-red-600">{fieldErrors.priority}</div>
                  )}
            </div>
          </div>

              {/* Trạng thái và Mô tả */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                  <select
                    key={`status-${edit.id || 'new'}`}
                    value={edit.status}
                    onChange={(e) => {
                      setEdit({ ...edit, status: e.target.value as TaskStatus })
                      if (fieldErrors.status) {
                        setFieldErrors({ ...fieldErrors, status: undefined })
                      }
                    }}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${fieldErrors.status ? 'border-red-500' : ''}`}
                  >
                <option value="TODO">Chờ</option>
                <option value="IN_PROGRESS">Đang làm</option>
                <option value="DONE">Hoàn thành</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
                  {fieldErrors.status && (
                    <div className="mt-1 text-sm font-medium text-red-600">{fieldErrors.status}</div>
                  )}
            </div>
            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                  <Input
                    key={`description-${edit.id || 'new'}`}
                    value={edit.description}
                    onChange={(e) => {
                      setEdit({ ...edit, description: e.target.value })
                      if (fieldErrors.description) {
                        setFieldErrors({ ...fieldErrors, description: undefined })
                      }
                    }}
                    placeholder="Nhập mô tả công việc (tùy chọn)"
                    className={`w-full ${fieldErrors.description ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {fieldErrors.description && (
                    <div className="mt-1 text-sm font-medium text-red-600">{fieldErrors.description}</div>
                  )}
            </div>
          </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 sm:px-6 pb-4 sm:pb-6 border-t border-gray-200 pt-4">
          <Button variant="secondary" onClick={() => {
            setEditOpen(false)
            setFieldErrors({})
            setFlash(null)
          }}>Hủy</Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={save}>Lưu</Button>
        </div>
      </Modal>

      {/* Xác nhận xóa */}
      <Modal
        open={confirmOpen.open}
        onClose={() => setConfirmOpen({ open: false })}
        title="Xác nhận xóa"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen({ open: false })}>Hủy</Button>
            <Button variant="danger" onClick={doDelete}>Xóa</Button>
          </div>
        }
      >
        <div className="text-sm text-gray-700">Bạn có chắc muốn xóa công việc này? Hành động này không thể hoàn tác.</div>
      </Modal>
        </div>
      </div>
    </>
  );
}
