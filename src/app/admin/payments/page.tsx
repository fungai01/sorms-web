"use client";

import { useEffect, useMemo, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";

type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED'

type Payment = {
  id: number
  code: string
  order_code?: string
  payer_name: string
  method: 'Tiền Mặt' | 'Chuyển Khoản'
  amount: number
  created_at: string
  status: PaymentStatus
  note?: string
}

// Removed mock; always use API

export default function PaymentsPage() {
  const [rows, setRows] = useState<Payment[]>([])
  const [flash, setFlash] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [query, setQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<'ALL' | PaymentStatus>('ALL')
  const [sortKey, setSortKey] = useState<'id' | 'code' | 'created' | 'amount'>("created")
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>("desc")
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<Payment | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<{ id?: number, code: string, order_code: string, payer_name: string, method: Payment['method'], amount: string, created_at: string, status: PaymentStatus, note: string }>({ code: '', order_code: '', payer_name: '', method: 'Tiền Mặt', amount: '', created_at: '', status: 'PENDING', note: '' })
  const [confirmOpen, setConfirmOpen] = useState<{ open: boolean, id?: number }>({ open: false })
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [isAllSelected, setIsAllSelected] = useState(false)

  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 3000); return () => clearTimeout(t) }, [flash])

  useEffect(() => {
    refetchPayments()
  }, [])

  async function refetchPayments() {
    try {
      const res = await fetch('/api/system/payments', { headers: { 'Content-Type': 'application/json' }, credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (Array.isArray(data)) setRows(data as Payment[])
      else if (Array.isArray(data?.items)) setRows(data.items as Payment[])
      else setRows([])
    } catch {
      setRows([])
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = rows.filter(r =>
      r.code.toLowerCase().includes(q) ||
      (r.order_code || '').toLowerCase().includes(q) ||
      r.payer_name.toLowerCase().includes(q)
    )
    if (filterStatus !== 'ALL') list = list.filter(r => r.status === filterStatus)
    const dir = sortOrder === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (sortKey === 'id') return (a.id - b.id) * dir
      if (sortKey === 'code') return a.code.localeCompare(b.code) * dir
      if (sortKey === 'amount') return (a.amount - b.amount) * dir
      return a.created_at.localeCompare(b.created_at) * dir
    })
  }, [rows, query, filterStatus, sortKey, sortOrder])

  function openCreate() {
    setEdit({ code: '', order_code: '', payer_name: '', method: 'Chuyển Khoản', amount: '', created_at: '', status: 'PENDING', note: '' })
    setEditOpen(true)
  }
  function openEditRow(r: Payment) {
    setEdit({ id: r.id, code: r.code, order_code: r.order_code || '', payer_name: r.payer_name, method: r.method, amount: String(r.amount), created_at: r.created_at.slice(0,16), status: r.status, note: r.note || '' })
    setEditOpen(true)
  }
  async function save() {
    if (!edit.code.trim() || !edit.payer_name.trim() || !edit.created_at || !edit.amount || isNaN(Number(edit.amount))) {
      setFlash({ type: 'error', text: 'Vui lòng nhập Code, Người thanh toán, Ngày tạo và Số tiền hợp lệ.' })
      return
    }
    
    const payload: Payment = {
      id: edit.id ?? (rows.length ? Math.max(...rows.map(r => r.id)) + 1 : 1),
      code: edit.code.trim(),
      order_code: edit.order_code.trim() || undefined,
      payer_name: edit.payer_name.trim(),
      method: edit.method,
      amount: Number(edit.amount),
      created_at: edit.created_at,
      status: edit.status,
      note: edit.note.trim() || undefined,
    }

    try {
      if (edit.id) {
        const resp = await fetch('/api/system/payments', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!resp.ok) throw new Error('Cập nhật giao dịch thất bại')
        setFlash({ type: 'success', text: 'Đã cập nhật giao dịch.' })
      } else {
        const resp = await fetch('/api/system/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!resp.ok) throw new Error('Tạo giao dịch mới thất bại')
        setFlash({ type: 'success', text: 'Đã tạo giao dịch mới.' })
      }
      await refetchPayments()
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
      const resp = await fetch(`/api/system/payments?id=${confirmOpen.id}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error('Xóa giao dịch thất bại')
      setFlash({ type: 'success', text: 'Đã xóa giao dịch.' })
      await refetchPayments()
    } catch (e: any) {
      setFlash({ type: 'error', text: e.message || 'Có lỗi xảy ra' })
      return
    }
    
    setConfirmOpen({ open: false })
  }

  function renderStatusChip(s: PaymentStatus) {
    if (s === 'SUCCESS') return <Badge tone="success">Thành công</Badge>
    if (s === 'FAILED') return <Badge tone="warning">Thất bại</Badge>
    if (s === 'REFUNDED') return <Badge tone="warning">Đã hoàn tiền</Badge>
    return <Badge>Đang xử lý</Badge>
  }

  function exportCsv() {
    const headers = ['Code','Người thanh toán','Phương thức','Số tiền','Ngày tạo','Trạng thái','Ghi chú']
    const csv = [headers.join(','), ...filtered.map(r => [
      `"${r.code}"`,
      `"${r.payer_name}"`,
      `"${r.method}"`,
      r.amount,
      `"${r.created_at}"`,
      `"${r.status}"`,
      `"${(r.note||'').replace(/"/g,'""')}"`
    ].join(','))].join('\n')
    
    // Thêm BOM để hỗ trợ tiếng Việt trong Excel
    const BOM = '\uFEFF'
    const csvWithBOM = BOM + csv
    
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payments_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Bulk export functions
  function exportSelectedCsv() {
    if (selectedRows.length === 0) {
      setFlash({ type: 'error', text: 'Vui lòng chọn ít nhất một giao dịch để xuất.' })
      return
    }
    
    const selectedPayments = filtered.filter(r => selectedRows.includes(r.id))
    const headers = ['Code','Người thanh toán','Phương thức','Số tiền','Ngày tạo','Trạng thái','Ghi chú']
    const csv = [headers.join(','), ...selectedPayments.map(r => [
      `"${r.code}"`,
      `"${r.payer_name}"`,
      `"${r.method}"`,
      r.amount,
      `"${r.created_at}"`,
      `"${r.status}"`,
      `"${(r.note||'').replace(/"/g,'""')}"`
    ].join(','))].join('\n')
    
    // Thêm BOM để hỗ trợ tiếng Việt trong Excel
    const BOM = '\uFEFF'
    const csvWithBOM = BOM + csv
    
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payments_selected_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setFlash({ type: 'success', text: `Đã xuất ${selectedRows.length} giao dịch thành công.` })
  }

  function exportSelectedPdf() {
    if (selectedRows.length === 0) {
      setFlash({ type: 'error', text: 'Vui lòng chọn ít nhất một giao dịch để xuất.' })
      return
    }
    
    const selectedPayments = filtered.filter(r => selectedRows.includes(r.id))
    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Danh sách giao dịch đã chọn</title>
  <style>
    @page {
      size: A4;
      margin: 1cm;
    }
    body { 
      font-family: 'Times New Roman', serif; 
      margin: 0; 
      padding: 20px;
      font-size: 12px;
      line-height: 1.4;
    }
    .header { 
      text-align: center; 
      margin-bottom: 30px;
      border-bottom: 2px solid #333;
      padding-bottom: 15px;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 18px;
      font-weight: bold;
    }
    .header p {
      margin: 5px 0;
      font-size: 11px;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 20px;
      font-size: 10px;
    }
    th, td { 
      border: 1px solid #333; 
      padding: 6px 4px; 
      text-align: left;
      vertical-align: top;
    }
    th { 
      background-color: #f5f5f5; 
      font-weight: bold;
      text-align: center;
    }
    .amount {
      text-align: right;
    }
    .status {
      text-align: center;
    }
    .note {
      max-width: 150px;
      word-wrap: break-word;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 10px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>DANH SÁCH GIAO DỊCH ĐÃ CHỌN</h1>
    <p><strong>Ngày xuất:</strong> ${new Date().toLocaleDateString('vi-VN')} - ${new Date().toLocaleTimeString('vi-VN')}</p>
    <p><strong>Tổng số giao dịch:</strong> ${selectedPayments.length}</p>
    <p><strong>Tổng số tiền:</strong> ${selectedPayments.reduce((sum, r) => sum + r.amount, 0).toLocaleString('vi-VN')} ₫</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th style="width: 8%;">STT</th>
        <th style="width: 12%;">Code</th>
        <th style="width: 20%;">Người thanh toán</th>
        <th style="width: 10%;">PTTT</th>
        <th style="width: 12%;">Số tiền</th>
        <th style="width: 15%;">Ngày tạo</th>
        <th style="width: 10%;">Trạng thái</th>
        <th style="width: 13%;">Ghi chú</th>
      </tr>
    </thead>
    <tbody>
      ${selectedPayments.map((r, index) => `
        <tr>
          <td class="status">${index + 1}</td>
          <td><strong>${r.code}</strong></td>
          <td>${r.payer_name}</td>
          <td>${r.method}</td>
          <td class="amount">${r.amount.toLocaleString('vi-VN')} ₫</td>
          <td>${r.created_at.replace('T',' ')}</td>
          <td class="status">${r.status}</td>
          <td class="note">${r.note || ''}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div class="footer">
    <p>Báo cáo được tạo tự động từ hệ thống SORMS</p>
    <p>Trang 1/1</p>
  </div>
</body>
</html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setFlash({ type: 'success', text: `Đã xuất ${selectedRows.length} giao dịch thành PDF.` })
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

  function exportInvoicePdf(p: Payment) {
    const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>Hóa đơn ${p.code}</title>
<style>
  @page {
    size: A4;
    margin: 1cm;
  }
  body { 
    font-family: 'Times New Roman', serif; 
    margin: 0; 
    padding: 20px;
    color: #000;
    font-size: 12px;
    line-height: 1.4;
  }
  .header { 
    text-align: center; 
    margin-bottom: 30px;
    border-bottom: 2px solid #000;
    padding-bottom: 15px;
  }
  .header h1 {
    margin: 0 0 10px 0;
    font-size: 18px;
    font-weight: bold;
  }
  .header p {
    margin: 5px 0;
    font-size: 11px;
  }
  .info-section {
    margin-bottom: 20px;
  }
  .info-row {
    display: flex;
    margin-bottom: 8px;
  }
  .info-label {
    font-weight: bold;
    width: 120px;
    flex-shrink: 0;
  }
  .info-value {
    flex: 1;
  }
  table { 
    width: 100%; 
    border-collapse: collapse; 
    margin: 20px 0;
    font-size: 11px;
  }
  th, td { 
    border: 1px solid #000; 
    padding: 8px; 
    text-align: left;
  }
  th { 
    background-color: #f0f0f0; 
    font-weight: bold;
    text-align: center;
  }
  .amount {
    text-align: right;
    font-weight: bold;
  }
  .total-row {
    font-weight: bold;
    background-color: #f9f9f9;
  }
  .footer {
    margin-top: 40px;
    text-align: center;
    font-size: 10px;
    color: #666;
  }
  .no-print { 
    display: none; 
  }
  @media screen {
    .no-print { 
      display: block; 
      margin-top: 20px;
      text-align: center;
    }
    .no-print button {
      padding: 10px 20px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
    }
    .no-print button:hover {
      background: #0056b3;
    }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>HÓA ĐƠN THANH TOÁN</h1>
    <p><strong>Mã giao dịch:</strong> ${p.code}</p>
    <p><strong>Ngày tạo:</strong> ${p.created_at.replace('T',' ')}</p>
  </div>
  
  <div class="info-section">
    <div class="info-row">
      <div class="info-label">Người thanh toán:</div>
      <div class="info-value"><strong>${p.payer_name}</strong></div>
    </div>
    <div class="info-row">
      <div class="info-label">Phương thức:</div>
      <div class="info-value">${p.method}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Trạng thái:</div>
      <div class="info-value">${p.status}</div>
    </div>
    ${p.order_code ? `
    <div class="info-row">
      <div class="info-label">Đơn hàng:</div>
      <div class="info-value">${p.order_code}</div>
    </div>
    ` : ''}
    ${p.note ? `
    <div class="info-row">
      <div class="info-label">Ghi chú:</div>
      <div class="info-value">${p.note}</div>
    </div>
    ` : ''}
  </div>
  
  <table>
    <thead>
      <tr>
        <th style="width: 60%;">Nội dung</th>
        <th style="width: 40%;">Số tiền</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Thanh toán dịch vụ${p.order_code ? ' (Đơn hàng: ' + p.order_code + ')' : ''}</td>
        <td class="amount">${p.amount.toLocaleString('vi-VN')} ₫</td>
      </tr>
      <tr class="total-row">
        <td><strong>TỔNG CỘNG</strong></td>
        <td class="amount"><strong>${p.amount.toLocaleString('vi-VN')} ₫</strong></td>
      </tr>
    </tbody>
  </table>
  
  <div class="footer">
    <p>Hóa đơn được tạo tự động từ hệ thống SORMS</p>
    <p>Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} - ${new Date().toLocaleTimeString('vi-VN')}</p>
  </div>
  
  <div class="no-print">
    <button onclick="window.print()">In / Lưu PDF</button>
  </div>
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
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-gray-900 truncate">Quản lý thanh toán</h1>
              <p className="text-xs text-gray-500">{filtered.length} giao dịch</p>
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
              <span className="hidden sm:inline ml-1">Tạo giao dịch</span>
            </Button>
            
            {selectedRows.length > 0 && (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-sm text-gray-600">
                  Đã chọn: {selectedRows.length}
                </span>
                <button
                  onClick={exportSelectedCsv}
                  className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="hidden sm:inline ml-1">Tải CSV ({selectedRows.length})</span>
                </button>
                <button
                  onClick={exportSelectedPdf}
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
              <span className="hidden sm:inline ml-1">Xuất File</span>
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
                      placeholder="Tìm kiếm giao dịch..."
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
                    onChange={(e) => setSortKey(e.target.value as 'id' | 'code' | 'created' | 'amount')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="created">Ngày tạo</option>
                    <option value="amount">Số tiền</option>
                    <option value="code">Code</option>
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
                  onChange={(e) => setFilterStatus(e.target.value as 'ALL' | PaymentStatus)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tất cả trạng thái</option>
                  <option value="PENDING">Đang xử lý</option>
                  <option value="SUCCESS">Thành công</option>
                  <option value="FAILED">Thất bại</option>
                  <option value="REFUNDED">Đã hoàn tiền</option>
            </select>
          </div>
            </div>

            {/* Desktop layout */}
            <div className="hidden lg:flex flex-row gap-4 items-center">
              {/* Tìm kiếm */}
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Input
                    placeholder="Tìm kiếm giao dịch..."
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
                  onChange={(e) => setSortKey(e.target.value as 'id' | 'code' | 'created' | 'amount')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="created">Ngày tạo</option>
              <option value="amount">Số tiền</option>
              <option value="code">Code</option>
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
                  onChange={(e) => setFilterStatus(e.target.value as 'ALL' | PaymentStatus)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="PENDING">Đang xử lý</option>
                  <option value="SUCCESS">Thành công</option>
                  <option value="FAILED">Thất bại</option>
                  <option value="REFUNDED">Đã hoàn tiền</option>
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
                    <h2 className="text-lg font-bold text-gray-900">Danh sách giao dịch</h2>
                    <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">{filtered.length} giao dịch</span>
                  </div>
        </CardHeader>
        <CardBody className="p-0">
                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm">
              <colgroup>
                        <col className="w-[12%]" />
                        <col className="w-[20%]" />
                <col className="w-[10%]" />
                        <col className="w-[12%]" />
                        <col className="w-[12%]" />
                        <col className="w-[12%]" />
                        <col className="w-[22%]" />
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
                          <th className="px-4 py-3 text-center font-semibold">Người thanh toán</th>
                          <th className="px-4 py-3 text-center font-semibold">PTTT</th>
                          <th className="px-4 py-3 text-center font-semibold">Số tiền</th>
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
                            <td className="px-4 py-3 text-center text-gray-700">{row.payer_name}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.method}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.amount.toLocaleString('vi-VN')} ₫</td>
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
                                  onClick={() => exportInvoicePdf(row)}
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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                  </svg>
            </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">{row.code}</h3>
                                  <p className="text-xs sm:text-sm text-gray-600 truncate">{row.payer_name}</p>
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

                              {/* Phương thức */}
                              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                                <div className="text-xs text-gray-500 mb-1">PTTT</div>
                                <div className="text-sm font-semibold text-gray-900 truncate">{row.method}</div>
                              </div>

                              {/* Ngày tạo */}
                              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                                <div className="text-xs text-gray-500 mb-1">Ngày tạo</div>
                                <div className="text-xs sm:text-sm font-semibold text-gray-900">{row.created_at.replace('T',' ')}</div>
                              </div>

                              {/* Số tiền */}
                              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                                <div className="text-xs text-gray-500 mb-1">Số tiền</div>
                                <div className="text-xs sm:text-sm font-semibold text-gray-900">
                                  {row.amount.toLocaleString('vi-VN')} ₫
                                </div>
                              </div>
                            </div>

                            {/* Ghi chú nếu có */}
                            {row.note && (
                              <div className="mb-3 sm:mb-4 p-3 bg-gray-50 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">Ghi chú</div>
                                <div className="text-sm text-gray-700">{row.note}</div>
                              </div>
                            )}
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
                                onClick={() => exportInvoicePdf(row)}
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
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết giao dịch">
        <div className="p-4 sm:p-6">
          {selected && (
            <div className="space-y-6">
              {/* Header với thông tin chính */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 border border-blue-200">
                {/* Thông tin giao dịch chính */}
                <div className="space-y-4">
                  {/* Header với icon */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
          </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Giao dịch {selected.code}</h2>
                        <p className="text-base sm:text-lg lg:text-xl text-gray-600 truncate">{selected.payer_name}</p>
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

                  {/* Phương thức và số tiền */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Phương thức</span>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-blue-900">{selected.method}</p>
                    </div>

                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Số tiền</span>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-blue-900">
                        {selected.amount.toLocaleString('vi-VN')} ₫
                      </p>
                    </div>
                  </div>

                  {/* Đơn hàng liên kết nếu có */}
                  {selected.order_code && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Đơn hàng liên kết</span>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-blue-900">{selected.order_code}</p>
                    </div>
                  )}
                </div>
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

      {/* Modal tạo/sửa */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={edit.id ? 'Sửa giao dịch' : 'Tạo giao dịch'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Hủy</Button>
            <Button onClick={save}>Lưu</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Code</label>
              <Input value={edit.code} onChange={(e) => setEdit((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Đơn (nếu có)</label>
              <Input value={edit.order_code} onChange={(e) => setEdit((f) => ({ ...f, order_code: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Người thanh toán</label>
              <Input value={edit.payer_name} onChange={(e) => setEdit((f) => ({ ...f, payer_name: e.target.value }))} />
              {!edit.payer_name.trim() && <div className="mt-1 text-xs text-red-600">Bắt buộc.</div>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Phương thức</label>
              <select className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={edit.method} onChange={(e) => setEdit((f) => ({ ...f, method: e.target.value as Payment['method'] }))}>
                <option value="Tiền Mặt">Tiền Mặt</option>
                <option value="Chuyển Khoản">Chuyển Khoản</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Số tiền (₫)</label>
              <Input value={edit.amount} onChange={(e) => setEdit((f) => ({ ...f, amount: e.target.value }))} />
              {(!edit.amount || isNaN(Number(edit.amount))) && <div className="mt-1 text-xs text-red-600">Số tiền hợp lệ bắt buộc.</div>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ngày tạo</label>
              <Input type="datetime-local" value={edit.created_at} onChange={(e) => setEdit((f) => ({ ...f, created_at: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Trạng thái</label>
            <select className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={edit.status} onChange={(e) => setEdit((f) => ({ ...f, status: e.target.value as PaymentStatus }))}>
              <option value="PENDING">Đang xử lý</option>
              <option value="SUCCESS">Thành công</option>
              <option value="FAILED">Thất bại</option>
              <option value="REFUNDED">Đã hoàn tiền</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Ghi chú</label>
            <Input value={edit.note} onChange={(e) => setEdit((f) => ({ ...f, note: e.target.value }))} />
          </div>
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
        <div className="text-sm text-gray-700">Bạn có chắc muốn xóa giao dịch này?</div>
      </Modal>
    </>
  );
}



