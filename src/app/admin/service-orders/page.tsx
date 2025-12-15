"use client";

import { useEffect, useMemo, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";

import { type Service } from '@/lib/types'
import { useServices } from '@/hooks/useApi'

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
}

type ServiceOrderItem = {
  id: number
  service_name: string
  quantity: number
  unit_price: number
}

// Removed mock data; use API

export default function ServiceOrdersPage() {
  const [rows, setRows] = useState<DemoServiceOrder[]>([])
  const [loading, setLoading] = useState(false)
  const { data: servicesData } = useServices()
  const [services, setServices] = useState<Service[]>([])
  const [flash, setFlash] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [query, setQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<'ALL' | OrderStatus>('ALL')
  const [sortKey, setSortKey] = useState<'id' | 'code' | 'customer' | 'created' | 'total'>("created")
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>("desc")
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<DemoServiceOrder | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<{ id?: number, code: string, customer_name: string, room_code: string, created_at: string, total_price: string, status: OrderStatus, note: string, items: ServiceOrderItem[], item_service_id: string, item_name: string, item_qty: string, item_price: string }>({ code: '', customer_name: '', room_code: '', created_at: '', total_price: '', status: 'PENDING', note: '', items: [], item_service_id: '', item_name: '', item_qty: '', item_price: '' })
  const [confirmOpen, setConfirmOpen] = useState<{ open: boolean, id?: number } >({ open: false })
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [isAllSelected, setIsAllSelected] = useState(false)

  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 3000); return () => clearTimeout(t) }, [flash])

  async function refetchOrders() {
    setLoading(true)
    try {
      const res = await fetch('/api/system/orders', { headers: { 'Content-Type': 'application/json' }, credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (Array.isArray(data)) setRows(data as DemoServiceOrder[])
      else if (Array.isArray(data?.items)) setRows(data.items as DemoServiceOrder[])
      else setRows([])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { refetchOrders() }, [])

  // Sync with hooks data
  useEffect(() => {
    if (servicesData) setServices(servicesData as Service[])
  }, [servicesData])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = rows.filter(r => r.code.toLowerCase().includes(q) || r.customer_name.toLowerCase().includes(q) || (r.room_code||'').toLowerCase().includes(q) || (r.items||[]).some(i => i.service_name.toLowerCase().includes(q)))
    if (filterStatus !== 'ALL') list = list.filter(r => r.status === filterStatus)
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

  function openCreate() {
    setEdit({ code: '', customer_name: '', room_code: '', created_at: '', total_price: '', status: 'PENDING', note: '', items: [], item_service_id: '', item_name: '', item_qty: '', item_price: '' })
    setEditOpen(true)
  }
  function openEditRow(r: DemoServiceOrder) {
    setEdit({ id: r.id, code: r.code, customer_name: r.customer_name, room_code: r.room_code || '', created_at: r.created_at.slice(0,16), total_price: String(r.total_amount), status: r.status, note: r.note || '', items: r.items ? [...r.items] : [], item_service_id: '', item_name: '', item_qty: '', item_price: '' })
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
    if (!edit.code.trim() || !edit.customer_name.trim() || !edit.created_at) {
      setFlash({ type: 'error', text: 'Vui lòng nhập Code, Khách, Ngày tạo.' })
      return
    }
    
    const payload: DemoServiceOrder = {
      id: edit.id ?? (rows.length ? Math.max(...rows.map(r => r.id)) + 1 : 1),
      code: edit.code.trim(),
      customer_name: edit.customer_name.trim(),
      room_code: edit.room_code.trim() || undefined,
      created_at: edit.created_at,
      total_amount: computeTotal(edit.items),
      status: edit.status,
      note: edit.note.trim() || undefined,
      items: edit.items
    }

    try {
      if (edit.id) {
        const resp = await fetch('/api/system/orders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!resp.ok) throw new Error('Cập nhật phiếu dịch vụ thất bại')
        setFlash({ type: 'success', text: 'Đã cập nhật phiếu dịch vụ.' })
      } else {
        const resp = await fetch('/api/system/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!resp.ok) throw new Error('Tạo phiếu dịch vụ thất bại')
        setFlash({ type: 'success', text: 'Đã tạo phiếu dịch vụ mới.' })
      }
      await refetchOrders()
    } catch (e: any) {
      setFlash({ type: 'error', text: e.message || 'Có lỗi xảy ra' })
      return
    }
    
    setEditOpen(false)
  }
  function confirmDelete(id: number) { setConfirmOpen({ open: true, id }) }
  async function doDelete() { 
    if (!confirmOpen.id) return
    try {
      const resp = await fetch(`/api/system/orders?id=${confirmOpen.id}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error('Xóa phiếu dịch vụ thất bại')
      setFlash({ type: 'success', text: 'Đã xóa phiếu dịch vụ.' })
      await refetchOrders()
    } catch (e: any) {
      setFlash({ type: 'error', text: e.message || 'Có lỗi xảy ra' })
      return
    }
    setConfirmOpen({ open: false })
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
    const selectedOrders = selectedRows.map(id => rows.find(r => r.id === id)).filter((order): order is DemoServiceOrder => order !== undefined)
    
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-gray-900 truncate">Quản lý phiếu dịch vụ</h1>
            <p className="text-xs text-gray-500">{filtered.length} phiếu dịch vụ</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Removed Demo/Live toggle */}
            
            <Button 
              onClick={openCreate} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm flex-shrink-0 rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="hidden sm:inline ml-1">Tạo phiếu dịch vụ</span>
            </Button>
            
            {selectedRows.length > 0 && (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-sm text-gray-600">
                  Đã chọn: {selectedRows.length}
                </span>
                <button
                  onClick={exportMultiplePdfs}
                  className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 flex-shrink-0"
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
                  className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 flex-shrink-0"
                >
                  Hủy chọn
                </button>
              </div>
            )}
            <button
              aria-label="Xuất Excel (CSV)"
              title="Xuất Excel (CSV)"
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 flex-shrink-0"
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

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="space-y-3">
          {/* Flash Messages */}
          {flash && (
            <div className={`rounded-md border p-2 sm:p-3 text-xs sm:text-sm shadow-sm ${
              flash.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {flash.text}
            </div>
          )}

          {/* Removed Demo/Live indicator and API notice */}

          {/* Filters */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
            {/* Mobile layout */}
            <div className="lg:hidden space-y-3">
              {/* Hàng 1: Tìm kiếm */}
              <div className="flex flex-row items-center">
                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <Input
                      placeholder="Tìm kiếm phiếu dịch vụ..."
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
              </div>

              {/* Hàng 2: Sắp xếp và Thứ tự */}
              <div className="flex flex-row gap-3 items-center">
                {/* Sắp xếp */}
                <div className="flex-1">
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as 'id' | 'code' | 'customer' | 'created' | 'total')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="created">Ngày tạo</option>
                    <option value="total">Tổng tiền</option>
                    <option value="code">Code</option>
                    <option value="customer">Khách</option>
                    <option value="id">ID</option>
                  </select>
                </div>

                {/* Thứ tự */}
                <div className="w-32 flex-shrink-0">
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="asc">Tăng dần</option>
                    <option value="desc">Giảm dần</option>
                  </select>
                </div>
              </div>

              {/* Hàng 3: Trạng thái */}
              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'ALL' | OrderStatus)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="PENDING">PENDING</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>

            {/* Desktop layout */}
            <div className="hidden lg:flex flex-row gap-4 items-center">
              {/* Tìm kiếm */}
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Input
                    placeholder="Tìm kiếm phiếu dịch vụ..."
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
              
              {/* Sắp xếp */}
              <div className="w-36 flex-shrink-0">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as 'id' | 'code' | 'customer' | 'created' | 'total')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="created">Ngày tạo</option>
                  <option value="total">Tổng tiền</option>
                  <option value="code">Code</option>
                  <option value="customer">Khách</option>
                  <option value="id">ID</option>
                </select>
              </div>
              
              {/* Thứ tự */}
              <div className="w-28 flex-shrink-0">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="asc">Tăng dần</option>
                  <option value="desc">Giảm dần</option>
                </select>
              </div>
              
              {/* Trạng thái */}
              <div className="w-36 flex-shrink-0">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'ALL' | OrderStatus)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="PENDING">PENDING</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="px-4 py-3">
            <div className="max-w-7xl mx-auto">
              <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-xl rounded-2xl overflow-hidden">
                <CardHeader className="bg-gray-50 border-b border-gray-200 px-6 py-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">Danh sách phiếu dịch vụ</h2>
                    <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">{filtered.length} phiếu</span>
                  </div>
                </CardHeader>
                <CardBody className="p-0">
                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <colgroup>
                        <col className="w-[5%]" />
                        <col className="w-[12%]" />
                        <col className="w-[20%]" />
                        <col className="w-[10%]" />
                        <col className="w-[12%]" />
                        <col className="w-[10%]" />
                        <col className="w-[18%]" />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-50 text-gray-700">
                          <th className="px-4 py-3 text-center font-semibold w-12">
                            <input
                              type="checkbox"
                              checked={isAllSelected}
                              onChange={handleSelectAll}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </th>
                          <th className="px-4 py-3 text-center font-semibold">Code</th>
                          <th className="px-4 py-3 text-center font-semibold">Khách hàng</th>
                          <th className="px-4 py-3 text-center font-semibold">Phòng</th>
                          <th className="px-4 py-3 text-center font-semibold">Ngày tạo</th>
                          <th className="px-4 py-3 text-center font-semibold">Trạng thái</th>
                          <th className="px-4 py-3 text-center font-semibold">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice((page - 1) * size, page * size).map((row) => (
                          <tr key={row.id} className="hover:bg-gray-50 border-b border-gray-100">
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedRows.includes(row.id)}
                                onChange={() => handleSelectRow(row.id)}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-gray-900">{row.code}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.customer_name}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.room_code || '—'}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.created_at.replace('T',' ')}</td>
                            <td className="px-4 py-3 text-center">{renderStatusChip(row.status)}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex gap-1 justify-center">
                                <Button
                                  variant="secondary"
                                  className="h-8 px-2 text-xs"
                                  onClick={() => {
                                    setSelected(row);
                                    setDetailOpen(true);
                                  }}
                                >
                                  Xem
                                </Button>
                                <Button
                                  className="h-8 px-2 text-xs"
                                  onClick={() => openEditRow(row)}
                                >
                                  Sửa
                                </Button>
                                <Button
                                  variant="secondary"
                                  className="h-8 px-2 text-xs bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                  onClick={() => exportSinglePdf(row)}
                                >
                                  PDF
                                </Button>
                                <Button
                                  variant="danger"
                                  className="h-8 px-2 text-xs"
                                  onClick={() => confirmDelete(row.id)}
                                >
                                  Xóa
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards - Optimized for mobile viewing and printing */}
                  <div className="lg:hidden p-3 sm:p-4">
                    <div className="space-y-3 sm:space-y-4">
                      {filtered.slice((page - 1) * size, page * size).map((row) => (
                        <div
                          key={row.id}
                          className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden print:shadow-none print:border-gray-400"
                        >
                          {/* Header với Code và Status */}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-3 sm:px-4 py-3 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">{row.code}</h3>
                                  <p className="text-xs sm:text-sm text-gray-600 truncate">{row.customer_name}</p>
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                {renderStatusChip(row.status)}
                              </div>
                            </div>
                          </div>

                          {/* Thông tin chính - Mobile optimized grid */}
                          <div className="p-3 sm:p-4">
                            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4">
                              {/* ID */}
                              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                                <div className="text-xs text-gray-500 mb-1">ID</div>
                                <div className="text-sm font-semibold text-gray-900">{row.id}</div>
                              </div>

                              {/* Phòng */}
                              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                                <div className="text-xs text-gray-500 mb-1">Phòng</div>
                                <div className="text-sm font-semibold text-gray-900 truncate">{row.room_code || 'N/A'}</div>
                              </div>

                              {/* Ngày tạo */}
                              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                                <div className="text-xs text-gray-500 mb-1">Ngày tạo</div>
                                <div className="text-xs sm:text-sm font-semibold text-gray-900">{row.created_at.replace('T',' ')}</div>
                              </div>

                              {/* Tổng tiền */}
                              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                                <div className="text-xs text-gray-500 mb-1">Tổng tiền</div>
                                <div className="text-xs sm:text-sm font-semibold text-gray-900">
                                  {row.total_amount === 0 ? 'Miễn phí' : `${row.total_amount.toLocaleString('vi-VN')} ₫`}
                                </div>
                              </div>
                            </div>

                            {/* Dịch vụ - Mobile optimized */}
                            <div className="mb-3 sm:mb-4">
                              <div className="text-xs text-gray-500 mb-2">Dịch vụ</div>
                              <div className="flex flex-wrap gap-1 sm:gap-2">
                                {(row.items||[]).map((item: ServiceOrderItem) => (
                                  <span key={item.id} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full whitespace-nowrap">
                                    {item.service_name} (x{item.quantity})
                                  </span>
                                ))}
                            </div>
                          </div>

                            {/* Actions - Bookings Pattern with PDF */}
                          <div className="px-3 py-3 bg-gray-50 border-t border-gray-100">
                              <div className="grid grid-cols-2 gap-2 mb-2">
                              <Button
                                variant="secondary"
                                className="h-10 text-xs font-medium px-2"
                                onClick={() => {
                                  setSelected(row);
                                  setDetailOpen(true);
                                }}
                              >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Xem
                              </Button>

                              <Button
                                className="h-10 text-xs font-medium px-2"
                                onClick={() => openEditRow(row)}
                              >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Sửa
                              </Button>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  variant="secondary"
                                  className="h-10 text-xs font-medium px-2 bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                  onClick={() => exportSinglePdf(row)}
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Tải PDF
                                </Button>

                              <Button
                                variant="danger"
                                className="h-10 text-xs font-medium px-2"
                                onClick={() => confirmDelete(row.id)}
                              >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Xóa
                              </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Modal - Detail Pattern Design */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={edit.id ? 'Sửa phiếu dịch vụ' : 'Tạo phiếu dịch vụ'}
      >
        <div className="p-3 sm:p-4">
          <div className="space-y-4">
            {/* Header với thông tin chính - Detail Pattern */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 sm:p-4 border border-blue-200">
              <div className="space-y-3">
                {/* Header với icon */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                        {edit.id ? `Sửa phiếu ${edit.code}` : 'Tạo phiếu dịch vụ mới'}
                      </h2>
                      <p className="text-sm sm:text-base text-gray-600">
                        {edit.id ? 'Chỉnh sửa thông tin phiếu dịch vụ' : 'Nhập thông tin phiếu dịch vụ'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Basic Information - Card Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span className="text-xs font-semibold text-blue-700 uppercase">Code *</span>
                    </div>
                  <Input
                    value={edit.code}
                    onChange={(e) => setEdit((f) => ({ ...f, code: e.target.value }))}
                    placeholder="Nhập code phiếu dịch vụ"
                      className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:ring-0 focus:outline-none min-w-0"
                  />
                </div>

                  <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-xs font-semibold text-blue-700 uppercase">Khách hàng *</span>
                    </div>
                  <Input
                    value={edit.customer_name}
                    onChange={(e) => setEdit((f) => ({ ...f, customer_name: e.target.value }))}
                    placeholder="Nhập tên khách hàng"
                      className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:ring-0 focus:outline-none min-w-0"
                  />
                </div>
              </div>

                {/* Room and Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="text-xs font-semibold text-blue-700 uppercase">Phòng</span>
                    </div>
                  <Input
                    value={edit.room_code}
                    onChange={(e) => setEdit((f) => ({ ...f, room_code: e.target.value }))}
                    placeholder="Nhập mã phòng"
                      className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:ring-0 focus:outline-none min-w-0"
                  />
                </div>

                  <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-semibold text-blue-700 uppercase">Ngày tạo *</span>
                    </div>
                  <Input
                    type="datetime-local"
                    value={edit.created_at}
                    onChange={(e) => setEdit((f) => ({ ...f, created_at: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:ring-0 focus:outline-none min-w-0"
                      style={{ fontSize: '16px' }}
                  />
                  </div>
                </div>
                </div>
              </div>

            {/* Services Management - Detail Pattern */}
            <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Quản lý dịch vụ</h3>
              
              {/* Add Service Form - Detail Pattern */}
              <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Thêm dịch vụ mới</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Chọn dịch vụ</label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tên dịch vụ</label>
                      <Input 
                        placeholder="Nhập tên dịch vụ" 
                        value={edit.item_name} 
                        onChange={(e) => setEdit(f => ({ ...f, item_name: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-w-0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SL</label>
                      <Input 
                        placeholder="SL" 
                        value={edit.item_qty} 
                        onChange={(e) => setEdit(f => ({ ...f, item_qty: e.target.value }))}
                        className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-w-0 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Đơn giá</label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Nhập" 
                          value={edit.item_price} 
                          onChange={(e) => setEdit(f => ({ ...f, item_price: e.target.value }))}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-w-0"
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

              {/* Services List - Detail Pattern */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">Dịch vụ đã thêm</h4>
                {edit.items.length ? (
                  <div className="space-y-2">
                    {edit.items.map(it => (
                      <div key={it.id} className="bg-white rounded-lg p-3 border border-gray-200 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <h5 className="font-semibold text-gray-900 text-sm truncate">{it.service_name}</h5>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              x{it.quantity}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm text-gray-600 mt-1">
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
                    
                    {/* Total */}
                    <div className="bg-blue-50 rounded-lg p-3 border-2 border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-900">Tổng tạm tính:</span>
                        <span className="text-lg font-bold text-blue-600">
                          {computeTotal(edit.items) === 0 ? 'Miễn phí' : `${computeTotal(edit.items).toLocaleString('vi-VN')} ₫`}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">
                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">Chưa có dịch vụ nào</p>
                  </div>
                )}
                </div>
              </div>

            {/* Status and Note - Detail Pattern */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-2">Trạng thái</h3>
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
              <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-2">Ghi chú</h3>
                <textarea
                    value={edit.note}
                    onChange={(e) => setEdit((f) => ({ ...f, note: e.target.value }))}
                    placeholder="Nhập ghi chú (tùy chọn)"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-w-0 resize-y min-h-[60px]"
                  rows={3}
                  />
                </div>
              </div>
            </div>

          {/* Action Buttons - Detail Pattern */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 mt-6">
              <Button 
                variant="secondary" 
                onClick={() => setEditOpen(false)}
              className="flex-1 h-10 text-sm font-medium"
              >
                Hủy
              </Button>
              <Button 
                onClick={save}
              className="flex-1 h-10 text-sm font-medium bg-blue-600 hover:bg-blue-700"
              >
                {edit.id ? 'Cập nhật' : 'Tạo mới'}
              </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={confirmOpen.open} onClose={() => setConfirmOpen({ open: false })} title="Xác nhận xóa">
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



