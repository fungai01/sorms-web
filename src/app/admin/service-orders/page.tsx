"use client";

import { useEffect, useMemo, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { Table, THead, TBody } from "@/components/ui/Table";

import { type Service } from '@/lib/types'
import { useServices, useServiceOrders, useBookings, useStaffProfiles } from '@/hooks/useApi'
import { apiClient } from '@/lib/api-client'

type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

// Demo interface for service orders (not implemented in API yet)
type DemoServiceOrder = {
  id: number
  code: string
  customer_name: string
  room_code?: string
  created_at: string
  total_amount: number
  status: OrderStatus
  note?: string
  items: ServiceOrderItem[]
  assignedStaffId?: number | null
}

type ServiceOrderItem = {
  id: number
  service_name: string
  quantity: number
  unit_price: number
}

// Removed mock data; use API

export default function ServiceOrdersPage() {
  const [query, setQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<'ALL' | OrderStatus>('ALL')
  
  const { data: ordersData, refetch: refetchOrders, loading: loadingOrders } = useServiceOrders(
    filterStatus !== 'ALL' ? filterStatus : undefined
  )
  const { data: servicesData } = useServices()
  const { data: bookingsData } = useBookings()
  const { data: staffProfilesData } = useStaffProfiles()
  const [services, setServices] = useState<Service[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [staffProfiles, setStaffProfiles] = useState<any[]>([])
  const [flash, setFlash] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ customer_name?: string, items?: string, booking_id?: string }>({})
  const [sortKey, setSortKey] = useState<'id' | 'code' | 'customer' | 'created' | 'total'>("created")
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>("desc")
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<DemoServiceOrder | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null)
  const [assigningStaff, setAssigningStaff] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<{ id?: number, code: string, customer_name: string, booking_id: number | null, created_at: string, total_price: string, status: OrderStatus, note: string, items: ServiceOrderItem[], item_service_id: string, item_name: string, item_qty: string, item_price: string }>({ code: '', customer_name: '', booking_id: null, created_at: '', total_price: '', status: 'PENDING', note: '', items: [], item_service_id: '', item_name: '', item_qty: '', item_price: '' })
  const [confirmOpen, setConfirmOpen] = useState<{ open: boolean, id?: number } >({ open: false })
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [isAllSelected, setIsAllSelected] = useState(false)

  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 3000); return () => clearTimeout(t) }, [flash])

  // Sync with hooks data
  useEffect(() => {
    if (servicesData) setServices(servicesData as Service[])
  }, [servicesData])

  useEffect(() => {
    if (bookingsData) {
      const items = Array.isArray(bookingsData) ? bookingsData : Array.isArray((bookingsData as any)?.items) ? (bookingsData as any).items : []
      setBookings(items)
    }
  }, [bookingsData])

  useEffect(() => {
    if (staffProfilesData) {
      const items = Array.isArray(staffProfilesData) ? staffProfilesData : []
      setStaffProfiles(items)
    }
  }, [staffProfilesData])

  // Convert orders data to DemoServiceOrder format
  // Map từ backend ServiceOrderResponse format sang frontend DemoServiceOrder format
  const rows = useMemo(() => {
    if (!ordersData) return []
    const items = Array.isArray(ordersData) 
      ? ordersData 
      : Array.isArray((ordersData as any)?.items) 
        ? (ordersData as any).items 
        : Array.isArray((ordersData as any)?.data?.content)
          ? (ordersData as any).data.content
          : Array.isArray((ordersData as any)?.data)
            ? (ordersData as any).data
            : []
    
    // Map backend ServiceOrderResponse to DemoServiceOrder format
    return items.map((order: any) => {
      // Backend ServiceOrderResponse fields:
      // id, code, bookingId, requestedBy (Long), status, subtotalAmount, discountAmount, 
      // totalAmount, note, items[], createdDate, assignedStaffId, confirmedAt, rejectedAt, rejectionReason
      const orderId = order.id || 0
      const orderCode = order.code || ''
      
      // Find booking info to get customer and room info
      const bookingId = order.bookingId
      const booking = bookings.find((b: any) => Number(b.id) === Number(bookingId))
      
      // Map customer name - try multiple sources
      let customerName = ''
      if (booking) {
        customerName = booking.userName || booking.user?.name || booking.userId || booking.user?.id || ''
      }
      if (!customerName && order.requestedBy) {
        // requestedBy có thể là Long hoặc String
        customerName = typeof order.requestedBy === 'number' ? `User ${order.requestedBy}` : String(order.requestedBy)
      }
      if (!customerName) {
        customerName = bookingId ? `Booking ${bookingId}` : 'N/A'
      }
      
      // Map room code
      let roomCode: string | null = null
      if (booking) {
        roomCode = booking.roomCode || booking.room?.code || booking.roomCode || null
      }
      if (!roomCode && bookingId) {
        roomCode = `Booking ${bookingId}`
      }
      
      // Format created date
      const createdAt = order.createdDate || order.created_at || order.createdAt || order.createdDate || new Date().toISOString()
      // Ensure format is ISO string for display
      const formattedDate = createdAt.includes('T') ? createdAt : new Date(createdAt).toISOString()
      
      // Backend uses BigDecimal, convert to number
      const totalAmount = order.totalAmount ? Number(order.totalAmount) : 0
      
      // Map status - backend uses ServiceOrderStatus enum
      const orderStatus = (order.status || 'PENDING') as OrderStatus
      
      const orderNote = order.note || ''
      
      // Map items - ServiceOrderItemResponse format:
      // id, serviceId, serviceName, quantity (BigDecimal), unitPrice (BigDecimal), lineTotal (BigDecimal)
      const orderItems = (order.items || []).map((item: any) => ({
        id: item.id || 0,
        service_name: item.serviceName || item.service_name || '',
        quantity: item.quantity ? Number(item.quantity) : 0,
        unit_price: item.unitPrice ? Number(item.unitPrice) : 0,
      })) as ServiceOrderItem[]
      
      // Map assignedStaffId
      const assignedStaffId = order.assignedStaffId || null
      
      return {
        id: orderId,
        code: orderCode,
        customer_name: customerName,
        room_code: roomCode,
        created_at: formattedDate,
        total_amount: totalAmount,
        status: orderStatus,
        note: orderNote,
        items: orderItems,
        assignedStaffId: assignedStaffId
      } as DemoServiceOrder
    })
  }, [ordersData, bookings])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = rows.filter((r: DemoServiceOrder) => r.code.toLowerCase().includes(q) || r.customer_name.toLowerCase().includes(q) || (r.room_code||'').toLowerCase().includes(q) || (r.items||[]).some((i: ServiceOrderItem) => i.service_name.toLowerCase().includes(q)))
    if (filterStatus !== 'ALL') list = list.filter((r: DemoServiceOrder) => r.status === filterStatus)
    const dir = sortOrder === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (sortKey === 'id') return (a.id - b.id) * dir
      if (sortKey === 'code') return a.code.localeCompare(b.code) * dir
      if (sortKey === 'customer') return a.customer_name.localeCompare(b.customer_name) * dir
      if (sortKey === 'total') return (a.total_amount - b.total_amount) * dir
      return a.created_at.localeCompare(b.created_at) * dir
    })
  }, [rows, query, filterStatus, sortKey, sortOrder])
  
  // Memoize paginated data to prevent recalculation
  const paginatedData = useMemo(() => {
    return filtered.slice((page - 1) * size, page * size)
  }, [filtered, page, size])

  async function assignStaff() {
    if (!selected || !selectedStaffId) {
      setFlash({ type: 'error', text: 'Vui lòng chọn nhân viên.' })
      return
    }

    setAssigningStaff(true)
    setFlash(null)

    try {
      const response = await apiClient.assignStaffToOrder(selected.id, selectedStaffId)
      
      if (response.success) {
        setFlash({ type: 'success', text: 'Đã assign nhân viên thành công.' })
        // Update selected order với assignedStaffId mới
        setSelected({ ...selected, assignedStaffId: selectedStaffId })
        // Refresh orders list
        refetchOrders()
      } else {
        const errorMsg = response.error || 'Assign nhân viên thất bại'
        setFlash({ type: 'error', text: errorMsg })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi assign nhân viên'
      setFlash({ type: 'error', text: errorMsg })
    } finally {
      setAssigningStaff(false)
    }
  }

  function openCreate() {
    setEdit({ code: '', customer_name: '', booking_id: null, created_at: '', total_price: '', status: 'PENDING', note: '', items: [], item_service_id: '', item_name: '', item_qty: '', item_price: '' })
    setFieldErrors({})
    setFlash(null)
    setEditOpen(true)
  }
  function openEditRow(r: DemoServiceOrder) {
    // Note: Edit is not fully supported by backend - can only view
    // Extract bookingId from room_code if format is "Booking {id}"
    const bookingId = r.room_code ? parseInt(r.room_code.replace(/\D/g, '')) || null : null
    setEdit({ id: r.id, code: r.code, customer_name: r.customer_name, booking_id: bookingId, created_at: r.created_at.slice(0,16), total_price: String(r.total_amount), status: r.status, note: r.note || '', items: r.items ? [...r.items] : [], item_service_id: '', item_name: '', item_qty: '', item_price: '' })
    setFieldErrors({})
    setFlash(null)
    setEditOpen(true)
  }

  function computeTotal(items: ServiceOrderItem[]): number {
    return items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0)
  }

  function handlePickService(id: string) {
    setEdit(e => {
      const picked = services.find(s => String(s.id) === id)
      return { ...e, item_service_id: id, item_name: picked ? picked.name : '', item_price: picked ? String(picked.unitPrice) : e.item_price }
    })
  }

  function addItem() {
    if (!edit.item_name.trim() || !edit.item_qty || isNaN(Number(edit.item_qty)) || !edit.item_price || isNaN(Number(edit.item_price))) return
    const newItem: ServiceOrderItem = {
      id: edit.items.length ? Math.max(...edit.items.map(i => i.id)) + 1 : 1,
      service_name: edit.item_name.trim(),
      quantity: Number(edit.item_qty),
      unit_price: Number(edit.item_price),
    }
    const items = [...edit.items, newItem]
    setEdit(e => ({ ...e, items, item_service_id: '', item_name: '', item_qty: '', item_price: '', total_price: String(computeTotal(items)) }))
  }
  function removeItem(id: number) {
    const items = edit.items.filter(i => i.id !== id)
    setEdit(e => ({ ...e, items, total_price: String(computeTotal(items)) }))
  }

  async function save() {
    // Reset field errors
    setFieldErrors({})
    setFlash(null)
    
    // Basic validation
    const errors: { customer_name?: string, items?: string, booking_id?: string } = {}
    
    if (!edit.booking_id) {
      errors.booking_id = 'Vui lòng chọn Booking.'
    }
    if (!edit.customer_name.trim()) {
      errors.customer_name = 'Vui lòng nhập Requested By (User ID).'
    }
    if (edit.items.length === 0) {
      errors.items = 'Vui lòng thêm ít nhất một dịch vụ.'
    }
    
    // Nếu có lỗi, hiển thị và dừng lại (không gọi API)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setFlash({ type: 'error', text: 'Vui lòng điền đầy đủ thông tin bắt buộc.' })
      return
    }

    try {
      if (edit.id) {
        // Update: Backend không có endpoint update order trực tiếp
        // Có thể update items hoặc cancel/confirm order
        setFlash({ type: 'error', text: 'Cập nhật order chưa được hỗ trợ. Vui lòng xóa và tạo mới.' })
        return
      } else {
        // Create new order theo backend workflow:
        // 1. Tạo cart: POST /orders/cart với {bookingId, requestedBy, note?}
        // 2. Add items: POST /orders/{orderId}/items với {serviceId, quantity} cho mỗi item
        
        if (!edit.booking_id) {
          setFlash({ type: 'error', text: 'Vui lòng chọn Booking.' })
          return
        }
        
        const requestedBy = edit.customer_name.trim() || 'admin' // Backend expects String
        
        // Step 1: Create cart using apiClient
        const cartResponse = await apiClient.createOrderCart({
          bookingId: edit.booking_id,
          requestedBy: requestedBy,
          note: edit.note.trim() || undefined
        })
        
        if (!cartResponse.success) {
          const errorMsg = cartResponse.error || 'Tạo phiếu dịch vụ thất bại'
          setFlash({ type: 'error', text: errorMsg })
          if (/(booking|phòng)/i.test(errorMsg)) {
            setFieldErrors({ booking_id: errorMsg })
          } else if (/(customer|khách|requested)/i.test(errorMsg)) {
            setFieldErrors({ customer_name: errorMsg })
          }
      return
    }
    
        const orderId = (cartResponse.data as any)?.id
        
        if (!orderId) {
          setFlash({ type: 'error', text: 'Không thể lấy order ID sau khi tạo cart' })
          return
        }
        
        // Step 2: Add items to order using apiClient
        for (const item of edit.items) {
          // Tìm serviceId từ service name
          const service = services.find(s => s.name === item.service_name)
          if (!service) {
            setFlash({ type: 'error', text: `Không tìm thấy dịch vụ: ${item.service_name}` })
            return
          }
          
          const addItemResponse = await apiClient.addOrderItemToCart(orderId, {
            serviceId: service.id,
            quantity: Number(item.quantity)
          })
          
          if (!addItemResponse.success) {
            const errorMsg = addItemResponse.error || `Thêm dịch vụ ${item.service_name} thất bại`
            setFlash({ type: 'error', text: errorMsg })
            return
          }
        }
        
        await refetchOrders()
    setEditOpen(false)
        setFlash({ type: 'success', text: 'Đã tạo phiếu dịch vụ mới.' })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi lưu phiếu dịch vụ.'
      setFlash({ type: 'error', text: errorMsg })
      // Hiển thị lỗi trong form, không refresh page
    }
  }
  function confirmDelete(id: number) { 
    setConfirmOpen({ open: true, id })
    setFlash(null)
  }
  
  async function doDelete() { 
    if (!confirmOpen.id) return
    
    try {
      // Note: Backend may not support DELETE /orders/{id} directly
      // May need to cancel or deactivate instead
      const response = await fetch(`/api/system/orders?orderId=${confirmOpen.id}`, { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Xóa phiếu dịch vụ thất bại' }))
        throw new Error(errorData.error || errorData.message || 'Xóa phiếu dịch vụ thất bại')
      }
      
      // Reset page if current page becomes empty after deletion
      const currentPageStart = (page - 1) * size
      if (currentPageStart >= filtered.length - 1 && page > 1) {
        setPage(page - 1)
      }
      
      await refetchOrders()
      setConfirmOpen({ open: false })
      setFlash({ type: 'success', text: 'Đã xóa phiếu dịch vụ.' })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi xóa phiếu dịch vụ'
      setFlash({ type: 'error', text: errorMsg })
    setConfirmOpen({ open: false })
    }
  }

  function renderStatusChip(s: OrderStatus) {
    if (s === 'COMPLETED') return <Badge tone="success">Hoàn thành</Badge>
    if (s === 'CANCELLED') return <Badge tone="warning">Đã hủy</Badge>
    if (s === 'IN_PROGRESS') return <Badge>Đang xử lý</Badge>
    return <Badge tone="muted">Chờ xử lý</Badge>
  }

  function exportCsv() {
    const headers = ['ID','Code','Khách hàng','Phòng','Ngày tạo','Tổng tiền','Trạng thái','Ghi chú','Dịch vụ']
    const csv = [headers.join(','), ...filtered.map(r => [
      r.id,
      `"${r.code}"`,
      `"${r.customer_name}"`,
      `"${r.room_code || ''}"`,
      `"${r.created_at}"`,
      `"${r.total_amount === 0 ? 'Miễn phí' : r.total_amount.toLocaleString('vi-VN') + ' ₫'}"`,
      `"${r.status === 'PENDING' ? 'Chờ xử lý' : r.status === 'IN_PROGRESS' ? 'Đang xử lý' : r.status === 'COMPLETED' ? 'Hoàn thành' : 'Đã hủy'}"`,
      `"${(r.note||'').replace(/"/g,'""')}"`,
      `"${(r.items||[]).map((i: ServiceOrderItem)=>i.service_name).join('; ').replace(/"/g,'""')}"`
    ].join(','))].join('\n')
    
    // Add BOM for UTF-8 to ensure proper encoding in Excel
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `service_orders_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Bulk selection functions
  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRows([])
      setIsAllSelected(false)
    } else {
      const allIds = filtered.slice((page - 1) * size, page * size).map(row => row.id)
      setSelectedRows(allIds)
      setIsAllSelected(true)
    }
  }

  const handleSelectRow = (id: number) => {
    if (selectedRows.includes(id)) {
      setSelectedRows(selectedRows.filter(rowId => rowId !== id))
      setIsAllSelected(false)
    } else {
      const newSelected = [...selectedRows, id]
      setSelectedRows(newSelected)
      const currentPageIds = filtered.slice((page - 1) * size, page * size).map(row => row.id)
      setIsAllSelected(newSelected.length === currentPageIds.length && currentPageIds.every(id => newSelected.includes(id)))
    }
  }

  const exportMultiplePdfs = async () => {
    if (selectedRows.length === 0) return
    
    // Tạo một PDF duy nhất chứa tất cả các phiếu được chọn
    const selectedOrders = selectedRows.map(id => rows.find((r: DemoServiceOrder) => r.id === id)).filter((order): order is DemoServiceOrder => order !== undefined)
    
    if (selectedOrders.length === 0) return
    
    // Tạo HTML cho tất cả các phiếu
    const allItemsRows = selectedOrders.map((order, orderIndex) => {
      const itemsRows = (order.items||[]).map((i: ServiceOrderItem) => 
        `<tr><td>${i.service_name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${i.unit_price === 0 ? 'Miễn phí' : i.unit_price.toLocaleString('vi-VN') + ' ₫'}</td><td style="text-align:right">${i.unit_price === 0 ? 'Miễn phí' : (i.quantity*i.unit_price).toLocaleString('vi-VN') + ' ₫'}</td></tr>`
      ).join('')
      
      return `
        <div style="page-break-after: ${orderIndex < selectedOrders.length - 1 ? 'always' : 'auto'}; margin-bottom: 20px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px;">
            Phiếu dịch vụ: ${order.code}
          </h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; font-weight: bold; width: 30%;">Khách hàng:</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${order.customer_name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; font-weight: bold;">Phòng:</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${order.room_code || '—'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; font-weight: bold;">Ngày tạo:</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${order.created_at.replace('T',' ')}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; font-weight: bold;">Trạng thái:</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${order.status === 'PENDING' ? 'Chờ xử lý' : order.status === 'IN_PROGRESS' ? 'Đang xử lý' : order.status === 'COMPLETED' ? 'Hoàn thành' : 'Đã hủy'}</td>
            </tr>
            ${order.note ? `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; font-weight: bold;">Ghi chú:</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${order.note}</td>
            </tr>
            ` : ''}
          </table>
          
          <h3 style="color: #374151; margin-bottom: 15px;">Chi tiết dịch vụ:</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 12px; border: 1px solid #d1d5db; text-align: left;">Dịch vụ</th>
                <th style="padding: 12px; border: 1px solid #d1d5db; text-align: center;">Số lượng</th>
                <th style="padding: 12px; border: 1px solid #d1d5db; text-align: right;">Đơn giá</th>
                <th style="padding: 12px; border: 1px solid #d1d5db; text-align: right;">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
          
          <div style="text-align: right; margin-top: 20px; padding: 15px; background-color: #f8f9fa; border: 1px solid #d1d5db; border-radius: 8px;">
            <strong style="font-size: 18px; color: #1f2937;">
              Tổng tiền: ${order.total_amount === 0 ? 'Miễn phí' : order.total_amount.toLocaleString('vi-VN') + ' ₫'}
            </strong>
          </div>
        </div>
      `
    }).join('')
    
    const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>Danh sách phiếu dịch vụ</title>
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #333; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px; border: 1px solid #ddd; }
  th { background-color: #f8f9fa; font-weight: bold; }
  @media print {
    body { margin: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <h1 style="text-align: center; color: #2563eb; margin-bottom: 30px;">DANH SÁCH PHIẾU DỊCH VỤ</h1>
  <p style="text-align: center; color: #6b7280; margin-bottom: 30px;">Xuất ngày: ${new Date().toLocaleString('vi-VN')}</p>
  
  ${allItemsRows}
  
  <div style="margin-top: 40px; text-align: center; color: #6b7280; font-size: 12px;">
    <p>--- Hết danh sách ---</p>
    <p>Tổng số phiếu: ${selectedOrders.length}</p>
  </div>
</body>
</html>`

    // Tạo và tải file
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `service_orders_bulk_${new Date().toISOString().slice(0,10)}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportSinglePdf(order: DemoServiceOrder) {
    const itemsRows = (order.items||[]).map((i: ServiceOrderItem) => `<tr><td>${i.service_name}</td><td style=\"text-align:center\">${i.quantity}</td><td style=\"text-align:right\">${i.unit_price === 0 ? 'Miễn phí' : i.unit_price.toLocaleString('vi-VN') + ' ₫'}</td><td style=\"text-align:right\">${i.unit_price === 0 ? 'Miễn phí' : (i.quantity*i.unit_price).toLocaleString('vi-VN') + ' ₫'}</td></tr>`).join('')
    const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>Phiếu dịch vụ ${order.code}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; margin: 24px; color: #111827; }
  .header { display:flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .title { font-size: 20px; font-weight: 700; }
  .meta { font-size: 14px; color: #374151; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #E5E7EB; }
  .total { text-align: right; font-weight: 700; }
  .badge { display:inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; }
  .badge-success { background:#D1FAE5; color:#065F46; }
  .badge-warn { background:#FEF3C7; color:#92400E; }
  .badge-muted { background:#E5E7EB; color:#374151; }
  @media print { .no-print { display:none; } }
</style>
</head>
<body>
  <div class="header">
    <div class="title">Phiếu dịch vụ ${order.code}</div>
    <div class="meta">Ngày tạo: ${order.created_at.replace('T',' ')}</div>
  </div>
  <div class="meta">Khách: <b>${order.customer_name}</b></div>
  <div class="meta">Phòng: <b>${order.room_code || '—'}</b></div>
  <div class="meta">Trạng thái: <span class="badge ${order.status==='COMPLETED' ? 'badge-success' : order.status==='CANCELLED' ? 'badge-warn' : 'badge-muted'}">${order.status}</span></div>
  <table>
    <thead>
      <tr><th>Dịch vụ</th><th style=\"text-align:center\">SL</th><th style=\"text-align:right\">Đơn giá</th><th style=\"text-align:right\">Thành tiền</th></tr>
    </thead>
    <tbody>
      ${itemsRows || '<tr><td colspan=\"4\" style=\"text-align:center\">(Không có dòng dịch vụ)</td></tr>'}
      <tr><td colspan=\"4\" class=\"total\">Tổng cộng: ${order.total_amount === 0 ? 'Miễn phí' : order.total_amount.toLocaleString('vi-VN') + ' ₫'}</td></tr>
    </tbody>
  </table>
  <div style="margin-top:24px" class="meta">Ghi chú: ${order.note || '—'}</div>
  <div class="no-print" style="margin-top:24px"><button onclick="window.print()" style="padding:8px 12px;border:1px solid #D1D5DB;border-radius:6px;background:#111827;color:white">In / Lưu PDF</button></div>
</body>
</html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  return (
    <>
      <div className="px-6 pt-4 pb-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header & Filters Card */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
            <div className="header border-b border-gray-200/50 px-6 py-4">
        <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold text-gray-900 leading-tight">Quản lý phiếu dịch vụ</h1>
          </div>
          <div className="flex items-center gap-2">
            {selectedRows.length > 0 && (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-sm text-gray-600">
                  Đã chọn: {selectedRows.length}
                </span>
                <button
                  onClick={exportMultiplePdfs}
                        className="px-3 py-2 rounded-xl bg-red-600 text-white text-sm hover:bg-red-700 flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="hidden sm:inline ml-1">Tải PDF ({selectedRows.length})</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedRows([])
                    setIsAllSelected(false)
                  }}
                        className="px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 flex-shrink-0"
                >
                  Hủy chọn
                </button>
              </div>
            )}
            <button
              aria-label="Xuất Excel (CSV)"
              title="Xuất Excel (CSV)"
                    className="px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 flex-shrink-0"
              onClick={exportCsv}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline ml-1">Xuất Excel</span>
            </button>
          </div>
        </div>
      </div>

          {/* Filters */}
            <div className="bg-white px-6 py-4">
              {/* Mobile: chỉ giữ search + lọc chính */}
            <div className="lg:hidden space-y-3">
              {/* Hàng 1: Tìm kiếm */}
                    <Input
                      placeholder="Tìm kiếm phiếu dịch vụ..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border-gray-300 rounded-xl focus:ring-0 focus:border-gray-300"
                />
                
                {/* Hàng 2: Trạng thái */}
                <div className="relative w-full rounded-xl border border-gray-300 bg-white overflow-hidden">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'ALL' | OrderStatus)}
                    className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="PENDING">PENDING</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
              </div>
            </div>

              {/* Desktop: 1 hàng – chỉ giữ search + lọc chính */}
            <div className="hidden lg:flex flex-row gap-4 items-center">
              {/* Tìm kiếm */}
              <div className="flex-1 min-w-0">
                  <Input
                    placeholder="Tìm kiếm phiếu dịch vụ..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border-gray-300 rounded-xl focus:ring-0 focus:border-gray-300"
                  />
              </div>
              
              {/* Trạng thái */}
                <div className="w-40 flex-shrink-0 relative rounded-xl border border-gray-300 bg-white overflow-hidden">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'ALL' | OrderStatus)}
                    className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
                >
                    <option value="ALL">Tất cả trạng thái</option>
                  <option value="PENDING">PENDING</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
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

          {/* Flash Messages */}
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

          {/* Table */}
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Danh sách phiếu dịch vụ</h2>
                    <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">{filtered.length} phiếu dịch vụ</span>
                  </div>
                </CardHeader>
                <CardBody className="p-0">
                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <Table>
                      <THead>
                        <tr>
                          <th className="px-4 py-3 text-center text-sm font-bold w-12">
                            <input
                              type="checkbox"
                              checked={isAllSelected}
                              onChange={handleSelectAll}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Code</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Khách hàng</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Phòng</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Ngày tạo</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Tổng tiền</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Trạng thái</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Thao tác</th>
                        </tr>
                      </THead>
                      <TBody>
                        {filtered.slice((page - 1) * size, page * size).map((row, index) => (
                          <tr key={row.id} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:bg-[#f2f8fe]`}>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedRows.includes(row.id)}
                                onChange={() => handleSelectRow(row.id)}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-gray-900">{row.code || 'N/A'}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.customer_name || 'N/A'}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.room_code || '—'}</td>
                            <td className="px-4 py-3 text-center text-gray-700">
                              {row.created_at ? (row.created_at.includes('T') ? row.created_at.replace('T', ' ').slice(0, 19) : new Date(row.created_at).toLocaleString('vi-VN')) : 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700 font-semibold">
                              {row.total_amount === 0 ? (
                                <span className="text-green-600">Miễn phí</span>
                              ) : (
                                <span>{row.total_amount.toLocaleString('vi-VN')} ₫</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">{renderStatusChip(row.status)}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex gap-2 justify-center">
                                <Button
                                  variant="secondary"
                                  className="h-8 px-3 text-xs bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                                  onClick={() => {
                                    setSelected(row);
                                    setSelectedStaffId(row.assignedStaffId || null);
                                    setDetailOpen(true);
                                  }}
                                >
                                  Xem
                                </Button>
                                <Button
                                  variant="secondary"
                                  className="h-8 px-3 text-xs bg-white text-red-600 border border-red-600 hover:bg-red-50"
                                  onClick={() => exportSinglePdf(row)}
                                >
                                  PDF
                                </Button>
                                <Button
                                  variant="danger"
                                  className="h-8 px-3 text-xs"
                                  onClick={() => confirmDelete(row.id)}
                                >
                                  Xóa
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </TBody>
                    </Table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="lg:hidden space-y-3 p-4">
                      {filtered.slice((page - 1) * size, page * size).map((row) => (
                        <div
                          key={row.id}
                        className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 transition-colors hover:bg-[#f2f8fe]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-[hsl(var(--primary)/0.12)] flex items-center justify-center flex-shrink-0">
                              <svg className="w-6 h-6 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                            <div className="min-w-0">
                              <h3 className="text-base font-bold text-gray-900 truncate">{row.code || 'N/A'}</h3>
                              <p className="text-sm text-gray-600 truncate">{row.customer_name || 'N/A'}</p>
                                </div>
                              </div>
                          <div className="flex-shrink-0">{renderStatusChip(row.status)}</div>
                              </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                            <span className="text-gray-600">Phòng:</span> <span className="font-bold text-gray-900">{row.room_code || 'N/A'}</span>
                            </div>
                          <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                            <span className="text-gray-600">Tổng tiền:</span> <span className="font-bold text-gray-900">{row.total_amount === 0 ? 'Miễn phí' : `${row.total_amount.toLocaleString('vi-VN')} ₫`}</span>
                          </div>
                              </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                              <Button
                                variant="secondary"
                            className="h-10 text-sm font-medium bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))]" 
                                onClick={() => {
                                  setSelected(row);
                              setSelectedStaffId(row.assignedStaffId || null);
                                  setDetailOpen(true);
                                }}
                              >
                                Xem
                              </Button>
                                <Button
                                  variant="secondary"
                            className="h-10 text-sm font-medium bg-white text-red-600 border border-red-600 hover:bg-red-50" 
                                  onClick={() => exportSinglePdf(row)}
                                >
                            PDF
                                </Button>
                              <Button
                                variant="danger"
                            className="h-10 text-sm font-medium" 
                                onClick={() => confirmDelete(row.id)}
                              >
                                Xóa
                              </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardBody>

                {/* Pagination */}
                {filtered.length > size && (
                  <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-6 border-t border-gray-200/50">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div className="text-center sm:text-left">
                        <div className="text-sm text-gray-600 mb-1">Hiển thị kết quả</div>
                        <div className="text-lg font-bold text-gray-900">
                          <span className="text-blue-600">{(page - 1) * size + 1}</span> - <span className="text-blue-600">{Math.min(page * size, filtered.length)}</span> / <span className="text-gray-600">{filtered.length}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Button
                          variant="secondary"
                          disabled={page === 1}
                          onClick={() => setPage(page - 1)}
                          className="h-10 px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                          Trước
                        </Button>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-700 bg-white px-4 py-2 rounded-xl border-2 border-blue-200 shadow-sm">
                            {page}
                          </span>
                          <span className="text-sm text-gray-500">/ {Math.ceil(filtered.length / size)}</span>
                        </div>
                        <Button
                          variant="secondary"
                          disabled={page >= Math.ceil(filtered.length / size)}
                          onClick={() => setPage(page + 1)}
                          className="h-10 px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Sau
                          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết phiếu dịch vụ">
        <div className="p-4 sm:p-6">
          {selected && (
            <div className="space-y-6">
              {/* Header với thông tin chính */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 border border-blue-200">
                {/* Thông tin phiếu dịch vụ chính */}
                <div className="space-y-4">
                  {/* Header với icon */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Phiếu {selected.code}</h2>
                        <p className="text-base sm:text-lg lg:text-xl text-gray-600 truncate">{selected.customer_name}</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-full sm:w-auto">
                      {renderStatusChip(selected.status)}
                    </div>
                  </div>

                  {/* Thông tin nhanh */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">ID</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-blue-900">{selected.id}</p>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Ngày tạo</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-blue-900">{selected.created_at.replace('T',' ')}</p>
                    </div>
                  </div>

                  {/* Phòng và tổng tiền */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Phòng</span>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-blue-900">{selected.room_code || 'Chưa xác định'}</p>
                    </div>

                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Tổng tiền</span>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-blue-900">
                        {selected.total_amount === 0 ? 'Miễn phí' : `${selected.total_amount.toLocaleString('vi-VN')} ₫`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dịch vụ - Tag-based display */}
              <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Dịch vụ</h3>
                {selected.items && selected.items.length ? (
                  <div className="space-y-3">
                    {/* Service cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selected.items.map((item: ServiceOrderItem) => (
                        <div key={item.id} className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-900 text-sm">{item.service_name}</h4>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              x{item.quantity}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">
                              {item.unit_price === 0 ? 'Miễn phí' : `${item.unit_price.toLocaleString('vi-VN')} ₫`}
                            </span>
                            <span className="font-semibold text-gray-900">
                              {item.unit_price === 0 ? 'Miễn phí' : `${(item.quantity * item.unit_price).toLocaleString('vi-VN')} ₫`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Total */}
                    <div className="bg-white rounded-lg p-3 border-2 border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-900">Tổng cộng:</span>
                        <span className="text-lg font-bold text-blue-600">
                          {selected.total_amount === 0 ? 'Miễn phí' : `${selected.total_amount.toLocaleString('vi-VN')} ₫`}
                        </span>
                </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>Không có dịch vụ nào</p>
                  </div>
                )}
              </div>

              {/* Ghi chú */}
              {selected.note && (
                <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Ghi chú</h3>
                  <p className="text-gray-700">{selected.note}</p>
                </div>
              )}

              {/* Assign nhân viên */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 sm:p-6 border border-purple-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Assign nhân viên</h3>
                
                {/* Hiển thị nhân viên hiện tại */}
                {selected.assignedStaffId && (
                  <div className="mb-4 p-3 bg-white rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-600">Nhân viên hiện tại:</span>
                        <p className="font-semibold text-gray-900">
                          {(() => {
                            const staff = staffProfiles.find((s: any) => Number(s.accountId) === Number(selected.assignedStaffId))
                            return staff ? (staff.employeeId || `Staff #${selected.assignedStaffId}`) : `Staff #${selected.assignedStaffId}`
                          })()}
                      </p>
                    </div>
                  </div>
                </div>
                )}

                {/* Chọn nhân viên mới */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Chọn nhân viên {selected.assignedStaffId && <span className="text-xs text-gray-500">(Thay đổi)</span>}
                  </label>
                  <select
                    value={selectedStaffId || ''}
                    onChange={(e) => setSelectedStaffId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    <option value="">Chọn nhân viên...</option>
                    {staffProfiles.map((staff: any) => (
                      <option key={staff.id} value={staff.accountId}>
                        {staff.employeeId || `Staff #${staff.accountId}`} - {staff.jobTitle || staff.department || 'N/A'}
                      </option>
                    ))}
                  </select>
                  
                  <Button
                    onClick={assignStaff}
                    disabled={!selectedStaffId || assigningStaff || (selectedStaffId === selected.assignedStaffId)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {assigningStaff ? 'Đang assign...' : selected.assignedStaffId ? 'Thay đổi nhân viên' : 'Assign nhân viên'}
                  </Button>
                    </div>
                </div>
              </div>
          )}
                    </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={() => {
          setEditOpen(false)
          setFieldErrors({})
          setFlash(null)
        }}
        title={edit.id ? 'Sửa phiếu dịch vụ' : 'Tạo phiếu dịch vụ mới'}
        size="lg"
      >
        <div className="p-4 sm:p-6">
          <div className="space-y-4" key={edit.id || 'new'}>
            {/* Form */}
              <div className="space-y-3">
              {/* Booking và Requested By */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Booking <span className="text-red-500">*</span>
                    {edit.id && <span className="text-xs text-gray-500 ml-2">(Không thể chỉnh sửa)</span>}
                  </label>
                  <select
                    key={`booking-${edit.id || 'new'}`}
                    value={edit.booking_id || ''}
                    onChange={(e) => {
                      const bookingId = e.target.value ? parseInt(e.target.value) : null
                      // Tự động lấy userId từ booking và set vào customer_name (requestedBy)
                      let requestedBy = ''
                      if (bookingId) {
                        const selectedBooking = bookings.find((b: any) => Number(b.id) === Number(bookingId))
                        if (selectedBooking) {
                          // Backend cần requestedBy là String, lấy userId từ booking (chỉ set nếu có giá trị)
                          const userId = selectedBooking.userId || selectedBooking.user?.id
                          if (userId) {
                            requestedBy = String(userId)
                          }
                        }
                      }
                      setEdit((f) => ({ ...f, booking_id: bookingId, customer_name: requestedBy }))
                      if (fieldErrors.booking_id) {
                        setFieldErrors({ ...fieldErrors, booking_id: undefined })
                      }
                      if (fieldErrors.customer_name) {
                        setFieldErrors({ ...fieldErrors, customer_name: undefined })
                      }
                    }}
                    disabled={!!edit.id}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${fieldErrors.booking_id ? 'border-red-500' : ''} ${edit.id ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Chọn booking...</option>
                    {bookings.map((booking: any) => (
                      <option key={booking.id} value={booking.id}>
                        {booking.code || `Booking ${booking.id}`}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.booking_id && (
                    <div className="mt-1 text-sm font-medium text-red-600">{fieldErrors.booking_id}</div>
                  )}
                    </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Requested By (User ID) <span className="text-red-500">*</span>
                    {edit.id && <span className="text-xs text-gray-500 ml-2">(Không thể chỉnh sửa)</span>}
                    {!edit.id && edit.booking_id && <span className="text-xs text-gray-500 ml-2">(Tự động từ Booking)</span>}
                  </label>
                  <Input
                    key={`customer-${edit.id || 'new'}`}
                    value={edit.customer_name}
                    onChange={(e) => {
                      setEdit((f) => ({ ...f, customer_name: e.target.value }))
                      if (fieldErrors.customer_name) {
                        setFieldErrors({ ...fieldErrors, customer_name: undefined })
                      }
                    }}
                    disabled={!!edit.id || !!edit.booking_id}
                    placeholder={edit.booking_id ? "Tự động từ Booking" : "Nhập User ID hoặc tên người yêu cầu"}
                    className={`w-full ${fieldErrors.customer_name ? 'border-red-500 focus:ring-red-500' : ''} ${(edit.id || edit.booking_id) ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                  {fieldErrors.customer_name && (
                    <div className="mt-1 text-sm font-medium text-red-600">{fieldErrors.customer_name}</div>
                  )}
                </div>
              </div>

              {/* Quản lý dịch vụ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dịch vụ <span className="text-red-500">*</span></label>
                {fieldErrors.items && (
                  <div className="mb-2 text-sm font-medium text-red-600 bg-red-50 p-2 rounded">{fieldErrors.items}</div>
                )}
                
                {/* Thêm dịch vụ */}
                <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Thêm dịch vụ</h4>
                <div className="space-y-3">
                  <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Chọn dịch vụ</label>
                    <select 
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                      value={edit.item_service_id} 
                      onChange={(e) => handlePickService(e.target.value)}
                    >
                    <option value="">Chọn dịch vụ...</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.unitPrice === 0 ? 'Miễn phí' : `${s.unitPrice.toLocaleString('vi-VN')} ₫`}/{s.unitName}
                      </option>
                    ))}
                  </select>
                </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_2fr] gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tên dịch vụ</label>
                      <Input 
                        placeholder="Nhập tên dịch vụ" 
                        value={edit.item_name} 
                        onChange={(e) => setEdit(f => ({ ...f, item_name: e.target.value }))}
                          className="w-full"
                      />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Số lượng</label>
                      <Input 
                          type="number"
                        placeholder="SL" 
                        value={edit.item_qty} 
                        onChange={(e) => setEdit(f => ({ ...f, item_qty: e.target.value }))}
                          className="w-full text-center"
                      />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Đơn giá</label>
                      <div className="flex gap-2">
                        <Input 
                            type="number"
                            placeholder="Nhập giá" 
                          value={edit.item_price} 
                          onChange={(e) => setEdit(f => ({ ...f, item_price: e.target.value }))}
                            className="flex-1"
                        />
                        <Button 
                          onClick={addItem} 
                          className="bg-blue-600 hover:bg-blue-700 px-3 py-2 text-sm flex-shrink-0"
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

                {/* Danh sách dịch vụ đã thêm */}
                  <div className="space-y-2">
                  {edit.items.length ? (
                    <>
                    {edit.items.map(it => (
                      <div key={it.id} className="bg-white rounded-lg p-3 border border-gray-200 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                            <h5 className="font-semibold text-gray-900 text-sm truncate">{it.service_name}</h5>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              x{it.quantity}
                            </span>
                          </div>
                            <div className="flex justify-between text-sm text-gray-600">
                            <span>
                              {it.unit_price === 0 ? 'Miễn phí' : `${it.unit_price.toLocaleString('vi-VN')} ₫`}
                            </span>
                            <span className="font-semibold text-gray-900">
                              {it.unit_price === 0 ? 'Miễn phí' : `${(it.quantity*it.unit_price).toLocaleString('vi-VN')} ₫`}
                            </span>
                          </div>
                        </div>
                        <Button 
                          variant="danger" 
                          className="h-8 px-3 text-xs ml-3 flex-shrink-0" 
                          onClick={() => removeItem(it.id)}
                        >
                          Xóa
                        </Button>
                      </div>
                    ))}
                    <div className="bg-blue-50 rounded-lg p-3 border-2 border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-900">Tổng tạm tính:</span>
                        <span className="text-lg font-bold text-blue-600">
                          {computeTotal(edit.items) === 0 ? 'Miễn phí' : `${computeTotal(edit.items).toLocaleString('vi-VN')} ₫`}
                        </span>
                      </div>
                    </div>
                    </>
                ) : (
                    <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">Chưa có dịch vụ nào</p>
                  </div>
                )}
                </div>
              </div>

              {/* Trạng thái và Ghi chú */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                  <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={edit.status}
                    onChange={(e) => setEdit((f) => ({ ...f, status: e.target.value as OrderStatus }))}
                  >
                  <option value="PENDING">Chờ xử lý</option>
                  <option value="IN_PROGRESS">Đang xử lý</option>
                  <option value="COMPLETED">Hoàn thành</option>
                  <option value="CANCELLED">Đã hủy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea
                    value={edit.note}
                    onChange={(e) => setEdit((f) => ({ ...f, note: e.target.value }))}
                    placeholder="Nhập ghi chú (tùy chọn)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[80px]"
                  rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-row gap-3 pt-3 border-t border-gray-200">
              <Button 
                variant="secondary" 
                onClick={() => setEditOpen(false)}
                className="flex-1"
              >
                Hủy bỏ
              </Button>
              <Button 
                onClick={save}
                variant="primary"
                className="flex-1"
              >
                {edit.id ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={confirmOpen.open} onClose={() => {
        setConfirmOpen({ open: false })
        setFlash(null)
      }} title="Xác nhận xóa">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Xác nhận xóa</h2>
          <p className="text-gray-600 mb-6">Bạn có chắc chắn muốn xóa phiếu dịch vụ này không? Hành động này không thể hoàn tác.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmOpen({ open: false })}>
              Hủy
            </Button>
            <Button variant="danger" onClick={doDelete}>
              Xóa
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}



