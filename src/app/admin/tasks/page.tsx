"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useStaffTasks, useStaffProfiles, useServiceOrders, useUsers } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import { authFetch } from "@/lib/http";
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
  relatedType?: string
  relatedId?: number
  taskCreatedBy?: number
  lastModifiedDate?: string
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
    relatedType: t.relatedType || undefined,
    relatedId: t.relatedId !== undefined ? Number(t.relatedId) : undefined,
    taskCreatedBy: t.taskCreatedBy !== undefined ? Number(t.taskCreatedBy) : undefined,
    lastModifiedDate: t.lastModifiedDate || t.updated_at || t.updatedAt || undefined,
  }
}

// Normalize service order thành StaffTask format
function normalizeServiceOrderToTask(order: any, staffProfiles: any[] = []): StaffTask {
  const assignedTo = order.assignedStaffId !== undefined ? Number(order.assignedStaffId) : undefined
  const staff = assignedTo ? staffProfiles.find((s: any) => Number(s.id) === assignedTo) : null
  const department = staff?.department || ''
  
  // Map service order status sang task status
  let status: TaskStatus = 'TODO'
  const orderStatus = (order.status || '').toUpperCase()
  if (orderStatus === 'PENDING' || orderStatus === 'PENDING_STAFF_CONFIRMATION' || orderStatus === 'PENDING_PAYMENT') {
    status = 'TODO'
  } else if (orderStatus === 'CONFIRMED' || orderStatus === 'IN_PROGRESS') {
    status = 'IN_PROGRESS'
  } else if (orderStatus === 'COMPLETED' || orderStatus === 'DONE') {
    status = 'DONE'
  } else if (orderStatus === 'CANCELLED') {
    status = 'CANCELLED'
  }
  
  // Tạo title ngắn gọn từ service order code
  const title = order.code || `Đơn #${order.id}`
  
  // Lấy thời gian từ service order: ưu tiên confirmedAt, sau đó createdDate
  let due_date = ''
  if (order.confirmedAt) {
    try {
      const date = new Date(order.confirmedAt)
      due_date = date.toISOString().split('T')[0]
    } catch (e) {
      // Ignore
    }
  }
  if (!due_date && (order.createdDate || order.created_at)) {
    try {
      const date = new Date(order.createdDate || order.created_at)
      due_date = date.toISOString().split('T')[0]
    } catch (e) {
      // Ignore
    }
  }
  
  return {
    id: Number(order.id) || 0,
    title: title,
    assignee: department,
    assignedTo: assignedTo,
    department: department,
    due_date: due_date,
    priority: 'MEDIUM' as TaskPriority, // Default priority
    status: status,
    description: order.note || `Đơn dịch vụ ${order.code || `#${order.id}`}`,
    created_at: order.createdDate || order.created_at || '',
    isActive: true,
    relatedType: 'SERVICE_ORDER',
    relatedId: Number(order.id) || 0,
    taskCreatedBy: order.requestedBy ? undefined : undefined, // Service order không có taskCreatedBy
    lastModifiedDate: order.confirmedAt || order.createdDate || undefined,
  }
}

export default function TasksPage() {
  const [flash, setFlash] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [query, setQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<'ALL' | TaskStatus>('ALL')
  const [filterPriority, setFilterPriority] = useState<'ALL' | TaskPriority>('ALL')
  const [filterSource, setFilterSource] = useState<'ALL' | 'SERVICE_ORDER' | 'ADMIN'>('ALL')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<StaffTask | null>(null)
  const [orderDetail, setOrderDetail] = useState<any | null>(null)
  const [orderDetailLoading, setOrderDetailLoading] = useState(false)
  const [orderDetailError, setOrderDetailError] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'OVERVIEW' | 'ORDER'>('OVERVIEW')

  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<{ id?: number, title: string, relatedType: 'SERVICE_ORDER' | 'ROOM' | 'BOOKING', relatedId: number | null, assignedTo: number | null, due_date: string, priority: TaskPriority, status: TaskStatus, description: string }>({ title: '', relatedType: 'SERVICE_ORDER', relatedId: null, assignedTo: null, due_date: '', priority: 'MEDIUM', status: 'TODO', description: '' })
  const [fieldErrors, setFieldErrors] = useState<{ title?: string, assignedTo?: string, due_date?: string, priority?: string, status?: string, description?: string }>({})
  const [confirmOpen, setConfirmOpen] = useState<{ open: boolean, id?: number }>({ open: false })

  // Helper function để map status từ frontend format sang backend format
  const mapStatusToBackend = (status: 'ALL' | TaskStatus): string | undefined => {
    if (status === 'ALL') return undefined
    // Map 'TODO' -> 'OPEN' cho backend (giống như trong save function)
    if (status === 'TODO') return 'OPEN'
    // Các status khác giữ nguyên
    return status
  }

  const findStaffById = useCallback((assignedTo: number | undefined, staffProfiles: any[], users: any[]): any => {
    if (!assignedTo) return null
    
    const staff = staffProfiles.find((s: any) => {
      const staffId = Number(s.id)
      const staffAccountId = s.accountId !== undefined ? Number(s.accountId) : undefined
      const assignedToNum = Number(assignedTo)
      return staffId === assignedToNum || staffAccountId === assignedToNum
    })
    
    if (staff) return staff
    
    const user = users.find((u: any) => {
      const userId = Number(u.id)
      const assignedToNum = Number(assignedTo)
      return userId === assignedToNum
    })
    
    // Nếu tìm thấy user, tìm staff profile có accountId = user.id
    if (user) {
      const staffByAccountId = staffProfiles.find((s: any) => {
        const staffAccountId = s.accountId !== undefined ? Number(s.accountId) : undefined
        return staffAccountId === Number(user.id)
      })
      if (staffByAccountId) return staffByAccountId
      // Nếu không có staff profile, trả về user object với full_name
      return user
    }
    
    return null
  }, [])

  // Helper function để lấy tên staff
  const getStaffName = useCallback((assignedTo: number | undefined, staffProfiles: any[], users: any[]): string => {
    if (!assignedTo) return '—'
    const staffOrUser = findStaffById(assignedTo, staffProfiles, users)
    if (staffOrUser) {
      // Nếu là staff profile
      if (staffOrUser.full_name || staffOrUser.fullName || staffOrUser.name) {
        return staffOrUser.full_name || staffOrUser.fullName || staffOrUser.name
      }
      // Nếu là user object
      if (staffOrUser.full_name) {
        return staffOrUser.full_name
      }
    }
    return `Staff ${assignedTo}`
  }, [findStaffById])

  // Use hooks
  const { data: tasksData, loading: tasksLoading, refetch: refetchTasks } = useStaffTasks({
    status: mapStatusToBackend(filterStatus),
  })
  const { data: serviceOrdersData, loading: ordersLoading } = useServiceOrders()
  const { data: staffProfilesData } = useStaffProfiles()
  const { data: usersData } = useUsers({ size: 1000 }) // Lấy tất cả users để match

  // Get staff profiles
  const staffProfiles = useMemo(() => {
    if (!staffProfilesData) return []
    const data = staffProfilesData as any
    return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
  }, [staffProfilesData])

  // Get users list
  const users = useMemo(() => {
    if (!usersData) return []
    const data = usersData as any
    return Array.isArray(data?.items) ? data.items : Array.isArray(data?.data?.content) ? data.data.content : Array.isArray(data) ? data : []
  }, [usersData])

  // Normalize and merge tasks from both sources
  const rows = useMemo(() => {
    // Normalize staff tasks
    const staffTasks: StaffTask[] = []
    if (tasksData) {
      const data = tasksData as any
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
      staffTasks.push(...items.map((t: any) => normalizeTask(t, staffProfiles)))
    }
    
    // Normalize service orders (chỉ lấy những order có assignedStaffId)
    const serviceOrderTasks: StaffTask[] = []
    if (serviceOrdersData) {
      const data = serviceOrdersData as any
      const orders = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
      // Chỉ lấy service orders có assignedStaffId (đã được assign cho staff)
      const assignedOrders = orders.filter((o: any) => o.assignedStaffId)
      serviceOrderTasks.push(...assignedOrders.map((o: any) => normalizeServiceOrderToTask(o, staffProfiles)))
    }
    
    // Merge và loại bỏ duplicates (nếu StaffTask đã có relatedId trùng với service order id)
    const merged: StaffTask[] = [...staffTasks]
    const existingRelatedIds = new Set(staffTasks.filter(t => t.relatedType === 'SERVICE_ORDER' && t.relatedId).map(t => t.relatedId))
    
    // Chỉ thêm service order tasks nếu chưa có StaffTask tương ứng
    serviceOrderTasks.forEach(serviceOrderTask => {
      if (!existingRelatedIds.has(serviceOrderTask.relatedId)) {
        merged.push(serviceOrderTask)
      }
    })
    
    return merged
  }, [tasksData, serviceOrdersData, staffProfiles])

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
      // Source filter
      let matchesSource = true
      if (filterSource === 'SERVICE_ORDER') {
        // Chỉ hiển thị tasks có relatedType='SERVICE_ORDER' và relatedId > 0
        matchesSource = r.relatedType === 'SERVICE_ORDER' && r.relatedId !== undefined && r.relatedId > 0
      } else if (filterSource === 'ADMIN') {
        // Admin tạo = tất cả task KHÔNG phải là task từ đơn dịch vụ (SERVICE_ORDER + relatedId > 0)
        matchesSource = !(r.relatedType === 'SERVICE_ORDER' && r.relatedId !== undefined && r.relatedId > 0)
      }
      return matchesSearch && matchesStatus && matchesPriority && matchesSource
    })
  }, [rows, query, filterStatus, filterPriority, filterSource])

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
  
  function renderSourceBadge(task: StaffTask) {
    if (task.relatedType === 'SERVICE_ORDER' && task.relatedId && task.relatedId > 0) {
      return <Badge tone="info">Đơn dịch vụ</Badge>
    }
    return <Badge tone="muted">Admin tạo</Badge>
  }

  function openCreate() {
    setEdit({ title: '', relatedType: 'SERVICE_ORDER', relatedId: null, assignedTo: null, due_date: '', priority: 'MEDIUM', status: 'TODO', description: '' })
    setFieldErrors({})
    setFlash(null)
    setEditOpen(true)
  }
  function openEditRow(r: StaffTask) {
    setEdit({
      id: r.id,
      title: r.title,
      relatedType: (r.relatedType as any) || 'SERVICE_ORDER',
      relatedId: r.relatedId !== undefined ? r.relatedId : null,
      assignedTo: r.assignedTo || null,
      due_date: r.due_date || '',
      priority: r.priority,
      status: r.status,
      description: r.description || ''
    })
    setFieldErrors({})
    setFlash(null)
    setEditOpen(true)
  }
  function confirmDelete(id: number) { setConfirmOpen({ open: true, id }) }
  
  async function openDetail(task: StaffTask) {
    setSelected(task)
    setDetailOpen(true)
    setDetailTab('OVERVIEW')

    // Nếu là task từ đơn dịch vụ thì load full order detail
    if (task.relatedType === 'SERVICE_ORDER' && task.relatedId && task.relatedId > 0) {
      setOrderDetail(null)
      setOrderDetailError(null)
      setOrderDetailLoading(true)
      try {
        // Dùng endpoint order detail (đã proxy qua /api/system/orders?orderId=...)
        const res = await authFetch(`/api/system/orders?orderId=${task.relatedId}`, {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        })
        if (!res.ok) {
          const txt = await res.text().catch(() => '')
          throw new Error(txt || 'Không tải được chi tiết đơn dịch vụ')
        }
        const data = await res.json().catch(() => null)
        setOrderDetail(data)
      } catch (e: any) {
        setOrderDetailError(e?.message || 'Không tải được chi tiết đơn dịch vụ')
      } finally {
        setOrderDetailLoading(false)
      }
    } else {
      setOrderDetail(null)
      setOrderDetailError(null)
      setOrderDetailLoading(false)
    }
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
        <div className="grid grid-cols-3 gap-3">
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
                  <div className="relative rounded-xl border border-gray-300 bg-white overflow-hidden">
          <select 
            value={filterSource} 
            onChange={(e) => setFilterSource(e.target.value as any)}
                      className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
          >
                  <option value="ALL">Tất cả</option>
                      <option value="SERVICE_ORDER">Từ đơn dịch vụ</option>
                      <option value="ADMIN">Admin tạo</option>
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
                <div className="w-40 flex-shrink-0 relative rounded-xl border border-gray-300 bg-white overflow-hidden">
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value as any)}
                    className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
              >
                    <option value="ALL">Tất cả</option>
                    <option value="SERVICE_ORDER">Từ đơn dịch vụ</option>
                    <option value="ADMIN">Admin tạo</option>
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
                      <th className="px-4 py-3 text-center text-sm font-bold">Loại đơn</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Người phụ trách</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Thời gian</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Ưu tiên</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Trạng thái</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Thao tác</th>
                </tr>
                  </THead>
                  <TBody>
                    {filtered.slice((page - 1) * size, page * size).map((r: StaffTask, index: number) => {
                      const staffName = getStaffName(r.assignedTo, staffProfiles, users)
                      
                      return (
                      <tr key={r.id} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:bg-[#f2f8fe]`}>
                        <td className="px-4 py-3 text-left text-gray-900">
                        <span title={r.title} className="block truncate">{r.title}</span>
                    </td>
                      <td className="px-4 py-3 text-center">{renderSourceBadge(r)}</td>
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
                                const staffName = getStaffName(r.assignedTo, staffProfiles, users)
                                return <p className="text-sm text-gray-600 truncate">{staffName}</p>
                              })()}
                            <div className="mt-1">{renderSourceBadge(r)}</div>
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
      <Modal open={detailOpen} onClose={() => {
        setDetailOpen(false)
        setOrderDetail(null)
        setOrderDetailError(null)
        setOrderDetailLoading(false)
        setDetailTab('OVERVIEW')
      }} title="Chi tiết công việc" size="lg">
        <div className="p-4 sm:p-6">
          {selected && (() => {
            const staffName = getStaffName(selected.assignedTo, staffProfiles, users)
            const assignedStaff = findStaffById(selected.assignedTo, staffProfiles, users)
            const staffDepartment = assignedStaff?.department || ''
            
            return (
            <div className="space-y-4">
              {/* Header gọn */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-500">Công việc</div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate" title={selected.title}>{selected.title}</h2>
                    <div className="mt-1 text-sm text-gray-600 truncate">
                      Người phụ trách: <span className="font-medium text-gray-900">{staffName}</span>{staffDepartment ? ` - ${staffDepartment}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {renderSourceBadge(selected)}
                    {renderStatusBadge(selected.status)}
                  </div>
                </div>

                {/* Tabs */}
                <div className="mt-4 flex gap-2 border-b border-gray-200">
                  <button
                    type="button"
                    onClick={() => setDetailTab('OVERVIEW')}
                    className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${detailTab === 'OVERVIEW' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                  >
                    Tổng quan
                  </button>
                  {selected.relatedType === 'SERVICE_ORDER' && (selected.relatedId ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setDetailTab('ORDER')}
                      className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${detailTab === 'ORDER' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                    >
                      Chi tiết đơn
                    </button>
                  )}
                </div>
              </div>

              {/* Tab content */}
              {detailTab === 'OVERVIEW' && (
                <div className="space-y-4">
                  {/* Tổng quan */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
  <div className="text-xs font-semibold text-gray-500">Task ID:</div>
  <div className="text-sm font-bold text-gray-900">{selected.id}</div>
</div>
                      <div className="flex items-center space-x-2">
                        <div className="text-xs font-semibold text-gray-500">Ưu tiên:</div>
                        <div className="text-sm font-bold text-gray-900">{renderPriorityBadge(selected.priority)}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-xs font-semibold text-gray-500">Thời gian</div>
                        <div className="text-sm font-medium text-gray-900">{selected.due_date || '—'}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-xs font-semibold text-gray-500">Nguồn:</div>
                        <div className="text-sm font-bold text-gray-900">{renderSourceBadge(selected)}</div>
                        
                      </div>
                    </div>

                    <div className="mt-4 border-t border-gray-200 pt-4">
                      <div className="text-xs font-semibold text-gray-500 mb-1">Mô tả</div>
                      <div className="text-sm text-gray-800 whitespace-pre-line">{selected.description || <span className="text-gray-400 italic">Không có mô tả</span>}</div>
                    </div>
                  </div>

                  {/* Audit */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selected.created_at && (
                        <div className="flex items-center space-x-2">
                          <div className="text-xs font-semibold text-gray-500">Ngày tạo</div>
                          <div className="text-sm font-medium text-gray-900">{new Date(selected.created_at).toLocaleString('vi-VN')}</div>
                        </div>
                      )}
                      {selected.lastModifiedDate && (
                        <div  className="flex items-center space-x-2">
                          <div className="text-xs font-semibold text-gray-500">Cập nhật lần cuối</div>
                          <div className="text-sm font-medium text-gray-900">{new Date(selected.lastModifiedDate).toLocaleString('vi-VN')}</div>
                        </div>
                      )}
                      {selected.taskCreatedBy && (
                        <div>
                          <div className="text-xs font-semibold text-gray-500">Người tạo</div>
                          <div className="text-sm font-medium text-gray-900">{getStaffName(selected.taskCreatedBy, staffProfiles, users)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'ORDER' && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-900">Chi tiết đơn dịch vụ</div>
                    {orderDetailLoading && <div className="text-xs text-gray-500">Đang tải...</div>}
                  </div>

                  {orderDetailError && <div className="mt-2 text-sm text-red-600">{orderDetailError}</div>}

                  {orderDetail && (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <div className="text-xs font-semibold text-gray-500">Mã đơn:</div>
                          <div className="text-sm font-bold text-gray-900">{orderDetail.code || `#${orderDetail.id}`}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-xs font-semibold text-gray-500">Trạng thái</div>
                          <div className="text-sm font-medium text-gray-900">{orderDetail.status || '—'}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-xs font-semibold text-gray-500">Booking:</div>
                          <div className="text-sm font-medium text-gray-900">{orderDetail.bookingId || '—'}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-xs font-semibold text-gray-500">Nhân viên:</div>
                          <div className="text-sm font-medium text-gray-900">{getStaffName(orderDetail.assignedStaffId ? Number(orderDetail.assignedStaffId) : undefined, staffProfiles, users)}</div>
                        </div>
                      </div>

                      {Array.isArray(orderDetail.items) && orderDetail.items.length > 0 && (
                        <div className="overflow-hidden border border-gray-200 rounded-xl">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left px-3 py-2 font-semibold text-gray-600">Dịch vụ</th>
                                <th className="text-right px-3 py-2 font-semibold text-gray-600">SL</th>
                                <th className="text-right px-3 py-2 font-semibold text-gray-600">Giá</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orderDetail.items.map((it: any, idx: number) => (
                                <tr key={idx} className="border-t border-gray-200">
                                  <td className="px-3 py-2 text-gray-900">
                                    {it.serviceName || it.service?.name || `Service #${it.serviceId || it.service_id || ''}`}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700">{it.quantity ?? it.qty ?? 1}</td>
                                  <td className="px-3 py-2 text-right text-gray-900 font-medium">
                                    {it.lineTotal ?? it.line_total ?? it.unitPrice ?? it.unit_price ?? ''}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {(orderDetail.totalAmount ?? orderDetail.total_amount) && (
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                          <div className="text-sm font-semibold text-gray-700">Tổng tiền</div>
                          <div className="text-sm font-bold text-gray-900">{orderDetail.totalAmount ?? orderDetail.total_amount}</div>
                        </div>
                      )}

                      {orderDetail.note && (
                        <div className="pt-2 border-t border-gray-200">
                          <div className="text-xs font-semibold text-gray-500 mb-1">Ghi chú</div>
                          <div className="text-sm text-gray-800 whitespace-pre-line">{orderDetail.note}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {!orderDetailLoading && !orderDetailError && !orderDetail && (
                    <div className="mt-3 text-sm text-gray-500">Chưa có dữ liệu đơn.</div>
                  )}
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
                  {edit.assignedTo && (() => {
                    const selectedStaff = staffProfiles.find((s: any) => Number(s.id) === edit.assignedTo)
                    if (selectedStaff?.department) {
                      return (
                        <div className="mt-1 text-xs text-gray-500">
                          Phòng ban: <span className="font-medium">{selectedStaff.department}</span>
                        </div>
                      )
                    }
                    return null
                  })()}
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
            <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                  <textarea
                    key={`description-${edit.id || 'new'}`}
                    value={edit.description}
                    onChange={(e) => {
                      setEdit({ ...edit, description: e.target.value })
                      if (fieldErrors.description) {
                        setFieldErrors({ ...fieldErrors, description: undefined })
                      }
                    }}
                    placeholder="Nhập mô tả công việc (tùy chọn)"
                    rows={4}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${fieldErrors.description ? 'border-red-500 focus:ring-red-500' : ''}`}
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
