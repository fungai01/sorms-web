"use client";

import { useEffect, useMemo, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";

import { type Service } from '@/lib/types'
import { useServices } from '@/hooks/useApi'

export default function ServicesPage() {
  const [rows, setRows] = useState<Service[]>([])
  const { data: servicesData, refetch: refetchServices } = useServices()
  const [flash, setFlash] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<'code' | 'name' | 'price'>("code")
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>("asc")
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<Service | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<{ id?: number, code: string, name: string, unitPrice: number, unitName: string, description: string, isActive: boolean }>({ code: '', name: '', unitPrice: 0, unitName: '', description: '', isActive: true })
  const [editMessage, setEditMessage] = useState<{ type: 'info' | 'warning' | 'error', text: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ code?: string, name?: string, unitPrice?: string, unitName?: string }>({})
  const [confirmOpen, setConfirmOpen] = useState<{ open: boolean, id?: number }>({ open: false })

  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 3000); return () => clearTimeout(t) }, [flash])

  // Keyboard shortcuts for edit modal: Enter = Save, Esc = Close (avoid Enter in textarea)
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

  // Global Escape handler: ESC closes any open modal on this page
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

  // Sync with hooks data
  useEffect(() => {
    if (servicesData) setRows(servicesData as Service[])
  }, [servicesData])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? rows.filter(r => 
      r.code.toLowerCase().includes(q) || 
      r.name.toLowerCase().includes(q) || 
      (r.description || '').toLowerCase().includes(q) || 
      r.unitName.toLowerCase().includes(q)
    ) : rows
    const dir = sortOrder === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (sortKey === 'code') return a.code.localeCompare(b.code) * dir
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir
      return (a.unitPrice - b.unitPrice) * dir
    })
  }, [rows, query, sortKey, sortOrder])
  
  // Memoize paginated data to prevent recalculation
  const paginatedData = useMemo(() => {
    return filtered.slice((page - 1) * size, page * size)
  }, [filtered, page, size])

  // Hàm tự động tạo code dịch vụ mới (SV001, SV002, ...)
  function generateServiceCode(): string {
    // Lấy tất cả các code hiện có
    const existingCodes = rows
      .map(s => s.code.toUpperCase())
      .filter(code => /^SV\d+$/.test(code)) // Chỉ lấy code dạng SV001, SV002, ...
    
    if (existingCodes.length === 0) {
      return 'SV001'
    }
    
    // Tìm số lớn nhất
    const numbers = existingCodes
      .map(code => {
        const match = code.match(/^SV(\d+)$/)
        return match ? parseInt(match[1], 10) : 0
      })
      .filter(num => num > 0)
    
    if (numbers.length === 0) {
      return 'SV001'
    }
    
    const maxNumber = Math.max(...numbers)
    const nextNumber = maxNumber + 1
    
    // Format với 3 chữ số (001, 002, ...)
    return `SV${String(nextNumber).padStart(3, '0')}`
  }

  function openCreate() {
    // Tự động tạo code mới
    const newCode = generateServiceCode()
    setEdit({ code: newCode, name: '', unitPrice: 0, unitName: '', description: '', isActive: true })
    setEditMessage(null) // Reset message khi mở form
    setFieldErrors({}) // Reset field errors
    setEditOpen(true)
  }

  function openEdit(s: Service) {
    setEdit({ 
      id: s.id, 
      code: s.code, 
      name: s.name, 
      unitPrice: s.unitPrice, 
      unitName: s.unitName, 
      description: s.description || '', 
      isActive: s.isActive 
    })
    setEditMessage(null) // Reset message khi mở form
    setFieldErrors({}) // Reset field errors
    setEditOpen(true)
  }

  async function save() {
    // Reset field errors
    const errors: { code?: string, name?: string, unitPrice?: string, unitName?: string } = {}
    
    // Validation
    if (!edit.code.trim()) {
      errors.code = 'Vui lòng nhập Code dịch vụ.'
    }
    if (!edit.name.trim()) {
      errors.name = 'Vui lòng nhập Tên dịch vụ.'
    }
    if (!edit.unitName.trim()) {
      errors.unitName = 'Vui lòng nhập Đơn vị.'
    }
    if (edit.unitPrice === undefined || edit.unitPrice === null || isNaN(edit.unitPrice)) {
      errors.unitPrice = 'Vui lòng nhập giá dịch vụ.'
    } else if (edit.unitPrice < 0) {
      errors.unitPrice = 'Giá dịch vụ không được âm.'
    }
    
    // Nếu có lỗi, hiển thị và dừng lại
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    
    // Clear errors nếu validation pass
    setFieldErrors({})
    
    // Kiểm tra code trùng và tự động tạo code mới nếu cần
    let finalCode = edit.code.trim().toUpperCase()
    
    if (!edit.id) {
      // Khi tạo mới: nếu code trống, tự động tạo
      if (!finalCode) {
        finalCode = generateServiceCode()
        setEdit({ ...edit, code: finalCode })
        setEditMessage({ type: 'info', text: `Đã tự động tạo code: "${finalCode}"` })
      } else {
        // Kiểm tra trùng và tự động tạo code mới
        const existingService = rows.find(s => s.code.toUpperCase() === finalCode)
        if (existingService) {
          // Nếu trùng, tự động tạo code mới
          const oldCode = finalCode
          finalCode = generateServiceCode()
          // Cập nhật state để hiển thị code mới trong form
          setEdit({ ...edit, code: finalCode })
          // Thông báo trong form
          setEditMessage({ type: 'warning', text: `Code "${oldCode}" đã tồn tại. Đã tự động đổi thành "${finalCode}".` })
        } else {
          // Code hợp lệ, xóa message
          setEditMessage(null)
        }
      }
    } else {
      // Khi sửa: kiểm tra code trùng với dịch vụ khác (không phải chính nó)
      const existingService = rows.find(s => s.id !== edit.id && s.code.toUpperCase() === finalCode)
      if (existingService) {
        setEditMessage({ type: 'error', text: `Code "${finalCode}" đã tồn tại. Vui lòng chọn code khác.` })
        return
      } else {
        // Code hợp lệ, xóa message
        setEditMessage(null)
      }
    }
    // Giá 0 là hợp lệ (dịch vụ miễn phí)
    const payload = {
      code: finalCode, // Sử dụng code đã được kiểm tra và tự động tạo nếu cần
      name: edit.name.trim(),
      unitPrice: edit.unitPrice ?? 0, // Đảm bảo giá luôn là số, mặc định 0 nếu undefined/null
      unitName: edit.unitName.trim(),
      description: edit.description.trim() || '',
      isActive: edit.isActive,
    }
    
    console.log('Saving service with payload:', payload)
    console.log('Edit state:', edit)
    console.log('Unit price value:', edit.unitPrice, 'Type:', typeof edit.unitPrice)
    
    try {
      if (edit.id) {
        const response = await fetch('/api/system/services', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: edit.id, ...payload })
        })
        
        console.log('PUT response status:', response.status)
        console.log('PUT response ok:', response.ok)
        
        if (!response.ok) {
          const errorData = await response.json()
          console.log('PUT error data:', errorData)
          
          // Hiển thị error message trong form
          let errorMessage = errorData.error || 'Có lỗi xảy ra khi cập nhật dịch vụ.'
          
          // Nếu là lỗi hệ thống, thêm thông tin hữu ích
          if (errorMessage.includes('Hệ thống đang gặp sự cố') || 
              errorMessage.includes('SYSTEM_ERROR') ||
              response.status === 500) {
            errorMessage = `${errorMessage} Vui lòng kiểm tra kết nối với server hoặc thử lại sau.`
          }
          
          setEditMessage({ type: 'error', text: errorMessage })
          return
        }
        
        const responseData = await response.json()
        console.log('PUT success data:', responseData)
        
        await refetchServices()
        setEditOpen(false)
        setEditMessage(null)
        setFlash({ type: 'success', text: 'Đã cập nhật dịch vụ thành công.' })
      } else {
        console.log('POST request payload:', payload)
        const response = await fetch('/api/system/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        console.log('POST response status:', response.status)
        console.log('POST response ok:', response.ok)

        if (!response.ok) {
          const errorData = await response.json()
          console.log('POST error data:', errorData)
          
          // Hiển thị error message trong form
          let errorMessage = errorData.error || 'Có lỗi xảy ra khi tạo dịch vụ mới.'
          
          // Nếu là lỗi hệ thống, thêm thông tin hữu ích
          if (errorMessage.includes('Hệ thống đang gặp sự cố') || 
              errorMessage.includes('SYSTEM_ERROR') ||
              response.status === 500) {
            errorMessage = `${errorMessage} Vui lòng kiểm tra kết nối với server hoặc thử lại sau.`
          }
          
          setEditMessage({ type: 'error', text: errorMessage })
          return
        }

        const responseData = await response.json()
        console.log('POST success data:', responseData)

        await refetchServices()
        setEditOpen(false)
        setEditMessage(null)
        setFlash({ type: 'success', text: 'Đã tạo dịch vụ mới thành công.' })
      }
    } catch (error) {
      console.error('Error saving service:', error)
      setEditMessage({ type: 'error', text: 'Có lỗi xảy ra khi lưu dịch vụ. Vui lòng thử lại.' })
    }
  }

  function confirmDelete(id: number) {
    setConfirmOpen({ open: true, id })
  }

  async function doDelete() {
    if (!confirmOpen.id) return
    try {
      const res = await fetch(`/api/system/services?id=${confirmOpen.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Xóa dịch vụ thất bại')
      }
      await refetchServices()
      setConfirmOpen({ open: false })
      setFlash({ type: 'success', text: 'Đã xóa dịch vụ.' })
    } catch (e: any) {
      setFlash({ type: 'error', text: e.message || 'Có lỗi xảy ra khi xóa dịch vụ' })
    }
  }

  async function deactivateService(id: number) {
    try {
      // Try deactivate endpoint first (soft delete)
      const res = await fetch(`/api/system/services`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: false })
      })
      
      if (!res.ok) {
        // If deactivate fails, fallback to hard delete
        const errorData = await res.json().catch(() => ({}))
        console.warn('Deactivate failed, trying hard delete:', errorData)
        const deleteRes = await fetch(`/api/system/services?id=${id}`, { method: 'DELETE' })
        if (!deleteRes.ok) {
          const deleteError = await deleteRes.json().catch(() => ({}))
          throw new Error(deleteError.error || 'Vô hiệu hóa dịch vụ thất bại')
        }
        setFlash({ type: 'success', text: 'Đã xóa dịch vụ (hard delete).' })
      } else {
        setFlash({ type: 'success', text: 'Đã vô hiệu hóa dịch vụ thành công.' })
      }
      await refetchServices()
    } catch (e: any) {
      setFlash({ type: 'error', text: e.message || 'Có lỗi xảy ra' })
    }
  }

  async function activateService(id: number) {
    try {
      // Activate by setting isActive=true via PUT
      const resp = await fetch('/api/system/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: true })
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || 'Kích hoạt dịch vụ thất bại')
      }
      setFlash({ type: 'success', text: 'Đã kích hoạt dịch vụ thành công.' })
      await refetchServices()
    } catch (e) {
      setFlash({ type: 'error', text: e instanceof Error ? e.message : 'Có lỗi xảy ra' })
    }
  }

  function renderActiveChip(isActive: boolean) {
    return isActive ? <Badge tone="success">ACTIVE</Badge> : <Badge tone="muted">INACTIVE</Badge>
  }

  function renderPrice(price: number) {
    if (price === 0 || price === null || price === undefined) {
      return (
        <span className="text-green-600 font-semibold bg-green-50 px-2 py-1 rounded-md">
          Miễn phí
        </span>
      )
    }
    return <span className="text-gray-700">{price.toLocaleString('vi-VN')} VND</span>
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-gray-900 truncate">Quản lý dịch vụ</h1>
              <p className="text-xs text-gray-500">{filtered.length} dịch vụ</p>
            </div>
          </div>
          <Button 
            onClick={openCreate} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm flex-shrink-0"
          >
            <svg className="w-4 h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="hidden sm:inline">Thêm dịch vụ</span>  
            <span className="sm:hidden">Thêm</span>
          </Button>
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

          {/* Filters */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
            {/* Mobile layout */}
            <div className="lg:hidden space-y-3">
              {/* Hàng 1: Tìm kiếm */}
              <div className="flex flex-row items-center">
                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <Input
                      placeholder="Tìm kiếm..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 text-sm border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hàng 2: Sắp xếp và Thứ tự */}
              <div className="flex flex-row gap-2 items-center">
                {/* Sắp xếp */}
                <div className="flex-1">
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as 'code' | 'name' | 'price')}
                    className="w-full px-2 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="code">Code</option>
                    <option value="name">Tên</option>
                    <option value="price">Giá</option>
                  </select>
                </div>

                {/* Thứ tự */}
                <div className="w-32 flex-shrink-0">
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                    className="w-full px-2 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="asc">Tăng dần</option>
                    <option value="desc">Giảm dần</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Desktop layout */}
            <div className="hidden lg:flex flex-row gap-2 items-center">
              {/* Tìm kiếm */}
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Input
                    placeholder="Tìm kiếm dịch vụ..."
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
                  onChange={(e) => setSortKey(e.target.value as 'code' | 'name' | 'price')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="code">Theo Code</option>
                  <option value="name">Theo Tên</option>
                  <option value="price">Theo Giá</option>
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
            </div>
          </div>

          {/* Table */}
          <div className="px-4 py-3">
            <div className="max-w-7xl mx-auto">
              <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="bg-gray-50 border-b border-gray-200 px-6 py-3">
  <div className="flex items-center justify-between">
    {/* Bên trái */}
    <h2 className="text-lg font-bold text-gray-900">Danh sách dịch vụ</h2>

    {/* Bên phải */}
    <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
      {filtered.length} dịch vụ
    </span>
  </div>
</CardHeader>

            <CardBody className="p-0">
                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <colgroup>
                        <col className="w-[10%]" />
                        <col className="w-[15%]" />
                        <col className="w-[10%]" />
                        <col className="w-[10%]" />
                        <col className="w-[15%]" />
                        <col className="w-[20%]" />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-50 text-gray-700">
                          <th className="px-4 py-3 text-center font-semibold">Code</th>
                          <th className="px-4 py-3 text-center font-semibold">Tên dịch vụ</th>
                          <th className="px-4 py-3 text-center font-semibold">Giá</th>
                          <th className="px-4 py-3 text-center font-semibold">Đơn vị</th>
                          <th className="px-4 py-3 text-center font-semibold">Trạng thái</th>
                          <th className="px-4 py-3 text-center font-semibold">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice((page - 1) * size, page * size).map((row) => (
                          <tr key={row.id} className="hover:bg-gray-50 border-b border-gray-100">
                            <td className="px-4 py-3 text-center font-medium text-gray-900">{row.code}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.name}</td>
                            <td className="px-4 py-3 text-center">{renderPrice(row.unitPrice)}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.unitName}</td>
                            <td className="px-4 py-3 text-center">{renderActiveChip(row.isActive)}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex gap-2 justify-center">
                                <Button
                                  variant="secondary"
                                  className="h-8 px-3 text-xs"
                                  onClick={() => {
                                    setSelected(row)
                                    setDetailOpen(true)
                                  }}
                                >
                                  Xem
                                </Button>
                                <Button
                                  className="h-8 px-3 text-xs"
                                  onClick={() => openEdit(row)}
                                >
                                  Sửa
                                </Button>
                                {row.isActive ? (
                                  <>
                                    <Button
                                      className="h-8 px-3 text-xs bg-yellow-600 hover:bg-yellow-700 text-white"
                                      onClick={() => deactivateService(row.id)}
                                    >
                                      Vô hiệu hóa
                                    </Button>
                                    <Button
                                      variant="danger"
                                      className="h-8 px-3 text-xs"
                                      onClick={() => confirmDelete(row.id)}
                                    >
                                      Xóa
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700"
                                    onClick={() => activateService(row.id)}
                                  >
                                    Kích hoạt
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
<div className="lg:hidden p-4">
  <div className="grid grid-cols-1 gap-4">
    {filtered.slice((page - 1) * size, page * size).map((row) => (
      <div
        key={row.id}
        className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 p-4"
      >
        <div className="grid grid-cols-[auto_1fr] gap-4 mb-4 items-center">
          {/* Icon chữ cái đầu */}
          <div className="flex items-center justify-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg">
                {row.code.charAt(0)}
              </span>
            </div>
          </div>

          {/* Thông tin */}
            <div className="flex flex-col gap-2 justify-left text-left">
            <h3 className="font-bold text-gray-900 text-base text-left">{row.code}</h3>
            {/* Giá tiền */}
            <div className="flex items-center gap-2 justify-left text-left">
              <svg
                className="w-4 h-4 text-indigo-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                />
              </svg>
              {row.unitPrice === 0 ? (
                <span className="text-sm font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-center">
                  Miễn phí
                </span>
              ) : (
                <span className="text-sm font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full text-center">
                  {row.unitPrice.toLocaleString("vi-VN")} VND
                </span>
              )}
            </div>

            {/* Đơn vị */}
            <div className="flex items-center gap-2 justify-start text-left flex-wrap">
  <svg
    className="w-4 h-4 text-blue-500 flex-shrink-0"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
    />
  </svg>

  <span className="text-sm font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full break-words">
    {row.unitName}
  </span>
</div>


            {/* Trạng thái */}
                <div className="flex items-center gap-2 justify-left text-left">
              {renderActiveChip(row.isActive)}
            </div>
          </div>
        </div>

        {/* Nút thao tác */}
        <div className="space-y-2 pt-3 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="secondary"
              className="h-9 text-xs font-medium"
              onClick={() => {
                setSelected(row);
                setDetailOpen(true);
              }}
            >
              <svg
                className="w-3 h-3 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              Xem
            </Button>

            <Button
              className="h-9 text-xs font-medium"
              onClick={() => openEdit(row)}
            >
              <svg
                className="w-3 h-3 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Sửa
            </Button>

            {row.isActive ? (
              <Button
                className="h-9 text-xs font-medium bg-yellow-600 hover:bg-yellow-700 text-white"
                onClick={() => deactivateService(row.id)}
              >
                <svg
                  className="w-3 h-3 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
                Vô hiệu
              </Button>
            ) : (
              <Button
                className="h-9 text-xs font-medium bg-green-600 hover:bg-green-700"
                onClick={() => activateService(row.id)}
              >
                <svg
                  className="w-3 h-3 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Kích hoạt
              </Button>
            )}
          </div>
          {row.isActive && (
            <Button
              variant="danger"
              className="w-full h-9 text-xs font-medium"
              onClick={() => confirmDelete(row.id)}
            >
              <svg
                className="w-3 h-3 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Xóa vĩnh viễn
            </Button>
          )}
        </div>
      </div>
    ))}
  </div>
</div>

            </CardBody>

                {/* Pagination */}
                {filtered.length > size && (
                  <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-4 sm:px-6 py-4 sm:py-6 border-t border-gray-200/50">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
                      <div className="text-center sm:text-left">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">Hiển thị kết quả</div>
                        <div className="text-sm sm:text-lg font-bold text-gray-900">
                          <span className="text-blue-600">{(page - 1) * size + 1}</span> - <span className="text-blue-600">{Math.min(page * size, filtered.length)}</span> / <span className="text-gray-600">{filtered.length}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4">
                        <Button
                          variant="secondary"
                          disabled={page === 1}
                          onClick={() => setPage(page - 1)}
                          className="h-8 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                          <span className="hidden sm:inline">Trước</span>
                        </Button>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <span className="text-xs sm:text-sm font-bold text-gray-700 bg-white px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl border-2 border-blue-200 shadow-sm">
                            {page}
                          </span>
                          <span className="text-xs sm:text-sm text-gray-500">/ {Math.ceil(filtered.length / size)}</span>
                        </div>
                        <Button
                          variant="secondary"
                          disabled={page >= Math.ceil(filtered.length / size)}
                          onClick={() => setPage(page + 1)}
                          className="h-8 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="hidden sm:inline">Sau</span>
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết dịch vụ">
        <div className="p-4 sm:p-6">
          {selected && (
            <div className="space-y-6">
              {/* Header với thông tin chính */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 border border-blue-200">
                {/* Thông tin dịch vụ chính */}
              <div className="space-y-4">
                  {/* Header với icon */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{selected.code}</h2>
                        <p className="text-base sm:text-lg lg:text-xl text-gray-600 truncate">{selected.name}</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-full sm:w-auto">
                      {renderActiveChip(selected.isActive)}
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Đơn vị</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-blue-900">{selected.unitName}</p>
                    </div>
                  </div>

                  {/* Giá dịch vụ */}
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Giá dịch vụ</span>
                    </div>
                    {selected.unitPrice === 0 ? (
                      <p className="text-base sm:text-lg font-bold text-green-600 bg-green-50 px-3 py-1 rounded-lg inline-block">
                        Miễn phí
                      </p>
                    ) : (
                      <p className="text-base sm:text-lg font-bold text-blue-900">
                        {selected.unitPrice.toLocaleString('vi-VN')} VND
                      </p>
                    )}
                  </div>
                </div>

                {/* Thông tin hệ thống */}
                {(selected.created_at || selected.updated_at) && (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {selected.created_at && (
                      <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                          </svg>
                          <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Ngày tạo</span>
                        </div>
                        <p className="text-sm sm:text-base font-semibold text-gray-900">{new Date(selected.created_at).toLocaleString('vi-VN')}</p>
                      </div>
                    )}
                    {selected.updated_at && (
                      <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                          </svg>
                          <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Cập nhật</span>
                        </div>
                        <p className="text-sm sm:text-base font-semibold text-gray-900">{new Date(selected.updated_at).toLocaleString('vi-VN')}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => {
        setEditOpen(false)
        setEditMessage(null)
        setFieldErrors({})
      }} title={edit.id ? 'Sửa dịch vụ' : 'Thêm dịch vụ mới'}>
        <div className="p-4 sm:p-6">
          <div className="space-y-4">
            {/* Message trong form */}
            {editMessage && (
              <div className={`rounded-md border p-3 text-sm ${
                editMessage.type === 'info' 
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : editMessage.type === 'warning'
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-start gap-2">
                  {editMessage.type === 'info' && (
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {editMessage.type === 'warning' && (
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  {editMessage.type === 'error' && (
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <span>{editMessage.text}</span>
                </div>
              </div>
            )}
            
            {/* Form */}
            <div className="space-y-3">
              {/* Code và Tên dịch vụ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <Input
                    value={edit.code}
                    onChange={(e) => {
                      setEdit({ ...edit, code: e.target.value })
                      if (fieldErrors.code) {
                        setFieldErrors({ ...fieldErrors, code: undefined })
                      }
                    }}
                    placeholder="Nhập code dịch vụ (hoặc để trống để tự động tạo)"
                    className={`w-full ${fieldErrors.code ? 'border-red-500' : ''}`}
                  />
                  {fieldErrors.code && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.code}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên dịch vụ *</label>
                  <Input
                    value={edit.name}
                    onChange={(e) => {
                      setEdit({ ...edit, name: e.target.value })
                      if (fieldErrors.name) {
                        setFieldErrors({ ...fieldErrors, name: undefined })
                      }
                    }}
                    placeholder="Nhập tên dịch vụ"
                    className={`w-full ${fieldErrors.name ? 'border-red-500' : ''}`}
                  />
                  {fieldErrors.name && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>
                  )}
                </div>
              </div>

              {/* Giá và Đơn vị */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giá dịch vụ *</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={edit.unitPrice === 0 || edit.unitPrice === null || edit.unitPrice === undefined ? '0' : String(edit.unitPrice)}
                    onChange={(e) => {
                      const value = e.target.value
                      // Nếu input trống, set về 0 để user có thể nhập lại
                      if (value === '' || value === null || value === undefined) {
                        setEdit({ ...edit, unitPrice: 0 })
                        if (fieldErrors.unitPrice) {
                          setFieldErrors({ ...fieldErrors, unitPrice: undefined })
                        }
                        return
                      }
                      const newPrice = Number(value)
                      // Chỉ cập nhật nếu là số hợp lệ và >= 0 (cho phép cả 0)
                      if (!isNaN(newPrice) && newPrice >= 0) {
                        setEdit({ ...edit, unitPrice: newPrice })
                        if (fieldErrors.unitPrice) {
                          setFieldErrors({ ...fieldErrors, unitPrice: undefined })
                        }
                      }
                    }}
                    onBlur={(e) => {
                      // Khi blur (rời khỏi input), normalize giá trị
                      const value = e.target.value
                      if (value === '' || isNaN(Number(value))) {
                        // Nếu trống hoặc không hợp lệ, set về 0
                        setEdit({ ...edit, unitPrice: 0 })
                      } else {
                        const numValue = Number(value)
                        // Đảm bảo giá không âm
                        if (numValue < 0) {
                          setEdit({ ...edit, unitPrice: 0 })
                        }
                      }
                    }}
                    placeholder="Nhập giá dịch vụ (0 cho dịch vụ miễn phí)"
                    className={`w-full ${fieldErrors.unitPrice ? 'border-red-500' : ''}`}
                  />
                  {fieldErrors.unitPrice && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.unitPrice}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị *</label>
                  <Input
                    value={edit.unitName}
                    onChange={(e) => {
                      setEdit({ ...edit, unitName: e.target.value })
                      if (fieldErrors.unitName) {
                        setFieldErrors({ ...fieldErrors, unitName: undefined })
                      }
                    }}
                    placeholder="Nhập đơn vị (lần, kg, giờ...)"
                    className={`w-full ${fieldErrors.unitName ? 'border-red-500' : ''}`}
                  />
                  {fieldErrors.unitName && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.unitName}</p>
                  )}
                </div>
              </div>

              {/* Trạng thái */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái *</label>
                <select
                  value={edit.isActive ? 'true' : 'false'}
                  onChange={(e) => setEdit({ ...edit, isActive: e.target.value === 'true' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">ACTIVE</option>
                  <option value="false">INACTIVE</option>
                </select>
              </div>

              {/* Mô tả - chỉ hiển thị trên desktop */}
              <div className="hidden sm:block">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea
                  value={edit.description}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                  placeholder="Nhập mô tả dịch vụ"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {edit.id ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={confirmOpen.open} onClose={() => setConfirmOpen({ open: false })} title="Xác nhận vô hiệu hóa">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Xác nhận xóa</h2>
          <p className="text-gray-600 mb-6">
            Bạn có chắc muốn xóa dịch vụ này? Hành động này không thể hoàn tác.
          </p>
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
  )
}
