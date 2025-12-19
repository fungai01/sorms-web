"use client";

import { useEffect, useMemo, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { Table, THead, TBody } from "@/components/ui/Table";

import { type Service } from '@/lib/types'
import { useServices } from '@/hooks/useApi'
import { apiClient } from '@/lib/api-client'
import { filterAndSortServices } from '@/lib/utils'

export default function ServicesPage() {
  const { data: servicesData, refetch: refetchServices, loading: loadingServices } = useServices()
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

  // Sync with hooks data and apply filtering/sorting using lib utilities
  const rows = useMemo(() => {
    return (servicesData || []) as Service[]
  }, [servicesData])

  const filtered = useMemo(() => {
    return filterAndSortServices(rows, query, sortKey, sortOrder)
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
    setFieldErrors({}) // Reset field errors
    setFlash(null) // Clear flash messages
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
    setFieldErrors({}) // Reset field errors
    setFlash(null) // Clear flash messages
    setEditOpen(true)
  }

  async function save() {
    // Reset field errors
    setFieldErrors({})
    setFlash(null) // Clear any previous flash messages
    
    // Basic validation
    const errors: { code?: string, name?: string, unitPrice?: string, unitName?: string } = {}
    
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
    
    // Nếu có lỗi, hiển thị và dừng lại (không gọi API)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    
    // Prepare payload
    const payload = {
      code: edit.code.trim().toUpperCase(),
      name: edit.name.trim(),
      unitPrice: edit.unitPrice ?? 0,
      unitName: edit.unitName.trim(),
      description: edit.description.trim() || '',
      isActive: edit.isActive,
    }
    
    try {
      // Use apiClient instead of fetch
      const response = edit.id 
        ? await apiClient.updateService(edit.id, payload)
        : await apiClient.createService(payload)

      if (response.success) {
        // Reset page to 1 when creating new item
        if (!edit.id) {
          setPage(1)
        }
        // Refetch data first, then close modal and show flash
        await refetchServices()
        setEditOpen(false)
        setFieldErrors({})
        setFlash({ type: 'success', text: edit.id ? 'Đã cập nhật dịch vụ thành công.' : 'Đã tạo dịch vụ mới thành công.' })
      } else {
        const errorMsg = response.error || response.message || 'Có lỗi xảy ra khi lưu dịch vụ.'
        
        // Map error to specific field
        if (/(code|mã)/i.test(errorMsg)) {
          setFieldErrors({ code: errorMsg })
        } else if (/(name|tên)/i.test(errorMsg)) {
          setFieldErrors({ name: errorMsg })
        } else if (/(price|giá|unitPrice)/i.test(errorMsg)) {
          setFieldErrors({ unitPrice: errorMsg })
        } else if (/(unit|đơn vị|unitName)/i.test(errorMsg)) {
          setFieldErrors({ unitName: errorMsg })
        } else {
          // Show general error in first field if can't map to specific field
          setFieldErrors({ code: errorMsg })
        }
        // Hiển thị lỗi trong form, không refresh page
        setFlash({ type: 'error', text: errorMsg })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi lưu dịch vụ.'
      setFieldErrors({ code: errorMsg })
      setFlash({ type: 'error', text: errorMsg })
    }
  }

  function confirmDelete(id: number) {
    setConfirmOpen({ open: true, id })
  }

  async function doDelete() {
    if (!confirmOpen.id) return
    
    try {
      const response = await apiClient.deleteService(confirmOpen.id)
      if (response.success) {
        // Reset page if current page becomes empty after deletion
        const currentPageStart = (page - 1) * size
        if (currentPageStart >= filtered.length - 1 && page > 1) {
          setPage(page - 1)
        }
        // Refetch data first, then close modal and show flash
        await refetchServices()
        setConfirmOpen({ open: false })
        setFlash({ type: 'success', text: 'Đã xóa dịch vụ.' })
      } else {
        setFlash({ type: 'error', text: response.error || response.message || 'Có lỗi xảy ra khi xóa dịch vụ' })
        setConfirmOpen({ open: false })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi xóa dịch vụ'
      setFlash({ type: 'error', text: errorMsg })
      setConfirmOpen({ open: false })
    }
  }

  async function deactivateService(id: number) {
    try {
      // Use updateService to set isActive=false
      const response = await apiClient.updateService(id, { isActive: false })
      if (response.success) {
        await refetchServices()
        setFlash({ type: 'success', text: 'Đã vô hiệu hóa dịch vụ thành công.' })
      } else {
        setFlash({ type: 'error', text: response.error || response.message || 'Có lỗi xảy ra khi vô hiệu hóa dịch vụ' })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi vô hiệu hóa dịch vụ'
      setFlash({ type: 'error', text: errorMsg })
    }
  }

  async function activateService(id: number) {
    try {
      // Use updateService to set isActive=true
      const response = await apiClient.updateService(id, { isActive: true })
      if (response.success) {
        await refetchServices()
        setFlash({ type: 'success', text: 'Đã kích hoạt dịch vụ thành công.' })
      } else {
        setFlash({ type: 'error', text: response.error || response.message || 'Có lỗi xảy ra khi kích hoạt dịch vụ' })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi kích hoạt dịch vụ'
      setFlash({ type: 'error', text: errorMsg })
    }
  }

  function renderActiveChip(isActive: boolean) {
    return isActive ? <Badge tone="success" className="rounded-full">ACTIVE</Badge> : <Badge tone="muted" className="rounded-full">INACTIVE</Badge>
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
      <div className="px-6 pt-4 pb-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header & Filters Card */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
            <div className="header border-b border-gray-200/50 px-6 py-4">
        <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Quản lý dịch vụ</h1>
                <Button onClick={openCreate} variant="primary" className="px-5 py-2.5 text-sm rounded-xl">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
                  Thêm dịch vụ
          </Button>
        </div>
      </div>

            <div className="bg-white px-6 py-4">
              <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="flex-1 min-w-0 w-full">
                  <Input
                    placeholder="Tìm kiếm dịch vụ..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border-gray-300 rounded-xl focus:ring-0 focus:border-gray-300"
                  />
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
                <h2 className="text-xl font-bold text-gray-900">Danh sách dịch vụ</h2>
                <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
      {filtered.length} dịch vụ
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
                          <th className="px-4 py-3 text-left text-sm font-bold">Tên dịch vụ</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Giá</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Đơn vị</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Trạng thái</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Thao tác</th>
                        </tr>
                      </THead>
                      <TBody>
                        {filtered.slice((page - 1) * size, page * size).map((row, index) => (
                          <tr key={row.id} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:bg-[#f2f8fe]`}>
                            <td className="px-4 py-3 text-center font-medium text-gray-900">{row.code}</td>
                            <td className="px-4 py-3 text-left text-gray-700">{row.name}</td>
                            <td className="px-4 py-3 text-center">{renderPrice(row.unitPrice)}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.unitName}</td>
                            <td className="px-4 py-3 text-center">{renderActiveChip(row.isActive)}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex gap-2 justify-center">
                                <Button
                                  variant="secondary"
                                  className="h-8 px-3 text-xs bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                                  onClick={() => {
                                    setSelected(row)
                                    setDetailOpen(true)
                                  }}
                                >
                                  Xem
                                </Button>
                                <Button
                                  variant="secondary"
                                  className="h-8 px-3 text-xs bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
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
                                    className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => activateService(row.id)}
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
              <div className="lg:hidden space-y-3 p-4">
    {filtered.slice((page - 1) * size, page * size).map((row) => (
                  <div key={row.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 transition-colors hover:bg-[#f2f8fe]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-[hsl(var(--primary)/0.12)] flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                          </svg>
            </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-gray-900 truncate">{row.code}</h3>
                          <p className="text-sm text-gray-600 truncate">{row.name}</p>
          </div>
            </div>
                      <div className="flex-shrink-0">{renderActiveChip(row.isActive)}</div>
</div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                        <span className="text-gray-600">Giá:</span> <span className="font-bold text-gray-900">{row.unitPrice === 0 ? 'Miễn phí' : `${row.unitPrice.toLocaleString('vi-VN')} VND`}</span>
            </div>
                      <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                        <span className="text-gray-600">Đơn vị:</span> <span className="font-bold text-gray-900">{row.unitName}</span>
          </div>
        </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Button variant="secondary" className="h-10 text-sm font-medium bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))]" onClick={() => { setSelected(row); setDetailOpen(true); }}>Xem</Button>
                      <Button variant="secondary" className="h-10 text-sm font-medium bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))]" onClick={() => openEdit(row)}>Sửa</Button>
            {row.isActive ? (
                        <Button variant="danger" className="h-10 text-sm font-medium" onClick={() => confirmDelete(row.id)}>Xóa</Button>
                      ) : (
                        <Button className="h-10 text-sm font-medium bg-green-600 hover:bg-green-700 text-white" onClick={() => activateService(row.id)}>Kích hoạt</Button>
            )}
          </div>
          {row.isActive && (
            <Button
                        className="w-full mt-2 h-10 text-sm font-medium bg-yellow-600 hover:bg-yellow-700 text-white"
                        onClick={() => deactivateService(row.id)}
                      >
                        Vô hiệu hóa
            </Button>
          )}
      </div>
    ))}
</div>

            </CardBody>

                {/* Pagination */}
                {filtered.length > size && (
                <div className="bg-gradient-to-r from-gray-50 to-[hsl(var(--page-bg))] px-6 py-6 border-t border-gray-200/50 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="text-lg font-bold text-gray-900">
                    <span className="text-[hsl(var(--primary))]">{(page - 1) * size + 1}</span> - <span className="text-[hsl(var(--primary))]">{Math.min(page * size, filtered.length)}</span> / <span className="text-gray-600">{filtered.length}</span>
                        </div>
                  <div className="flex items-center gap-4">
                    <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)} className="h-10 px-4">Trước</Button>
                    <span className="text-sm font-bold bg-white px-4 py-2 rounded-xl border-2 border-[hsl(var(--primary)/0.25)]">Trang {page}</span>
                    <Button variant="secondary" disabled={page >= Math.ceil(filtered.length / size)} onClick={() => setPage(page + 1)} className="h-10 px-4">Sau</Button>
                    </div>
                  </div>
                )}
          </Card>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết dịch vụ" size="lg">
        <div className="p-4 sm:p-6">
          {selected && (
            <div className="space-y-6">
              {/* Header với thông tin chính */}
              <div className="bg-gradient-to-r from-[hsl(var(--page-bg))] to-[hsl(var(--primary)/0.08)] rounded-xl p-4 sm:p-6 border border-[hsl(var(--primary)/0.25)]">
              <div className="space-y-4">
                  {/* Header với icon và status */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[hsl(var(--primary))] rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                          {selected.code}
                        </h2>
                        <p className="text-base sm:text-lg text-gray-600 truncate">{selected.name}</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-full sm:w-auto">
                      {renderActiveChip(selected.isActive)}
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
                      <p className="text-sm sm:text-base font-semibold text-gray-700">
                        <span className="text-gray-600">Đơn vị:</span>{" "}
                        <span className="font-bold text-[hsl(var(--primary))]">{selected.unitName}</span>
                      </p>
                    </div>
                  </div>

                  {/* Giá dịch vụ */}
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                    <p className="text-sm sm:text-base font-semibold text-gray-700">
                      <span className="text-gray-600">Giá dịch vụ:</span>{" "}
                    {selected.unitPrice === 0 ? (
                        <span className="font-bold text-green-600 bg-green-50 px-3 py-1 rounded-lg inline-block">Miễn phí</span>
                    ) : (
                        <span className="font-bold text-[hsl(var(--primary))]">{selected.unitPrice.toLocaleString('vi-VN')} VND</span>
                    )}
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

                {(selected.created_at || selected.updated_at) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {selected.created_at && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-gray-200">
                      <div className="text-xs sm:text-sm font-semibold text-gray-500 mb-1">Ngày tạo</div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(selected.created_at).toLocaleString('vi-VN')}
                      </p>
                      </div>
                    )}
                    {selected.updated_at && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-gray-200">
                      <div className="text-xs sm:text-sm font-semibold text-gray-500 mb-1">Cập nhật gần nhất</div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(selected.updated_at).toLocaleString('vi-VN')}
                      </p>
                      </div>
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
      </Modal>
      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => {
        setEditOpen(false)
        setFieldErrors({})
        setFlash(null)
      }} title={edit.id ? 'Sửa dịch vụ' : 'Thêm dịch vụ mới'} size="lg">
        <div className="p-4 sm:p-6">
          <div className="space-y-4" key={edit.id || 'new'}>
            {/* Form */}
            <div className="space-y-3">
              {/* Code và Tên dịch vụ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code <span className="text-red-500">*</span></label>
                  <Input
                    key={`code-${edit.id || 'new'}`}
                    value={edit.code}
                    onChange={(e) => {
                      setEdit({ ...edit, code: e.target.value })
                      if (fieldErrors.code) {
                        setFieldErrors({ ...fieldErrors, code: undefined })
                      }
                    }}
                    placeholder="Nhập code dịch vụ"
                    className={`w-full ${fieldErrors.code ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {fieldErrors.code && (
                    <div className="mt-1 text-sm font-medium text-red-600">{fieldErrors.code}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên dịch vụ <span className="text-red-500">*</span></label>
                  <Input
                    key={`name-${edit.id || 'new'}`}
                    value={edit.name}
                    onChange={(e) => {
                      setEdit({ ...edit, name: e.target.value })
                      if (fieldErrors.name) {
                        setFieldErrors({ ...fieldErrors, name: undefined })
                      }
                    }}
                    placeholder="Nhập tên dịch vụ"
                    className={`w-full ${fieldErrors.name ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {fieldErrors.name && (
                    <div className="mt-1 text-sm font-medium text-red-600">{fieldErrors.name}</div>
                  )}
                </div>
              </div>

              {/* Giá và Đơn vị */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giá dịch vụ <span className="text-red-500">*</span></label>
                  <Input
                    key={`unitPrice-${edit.id || 'new'}`}
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
                    className={`w-full ${fieldErrors.unitPrice ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {fieldErrors.unitPrice && (
                    <div className="mt-1 text-sm font-medium text-red-600">{fieldErrors.unitPrice}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị <span className="text-red-500">*</span></label>
                  <Input
                    key={`unitName-${edit.id || 'new'}`}
                    value={edit.unitName}
                    onChange={(e) => {
                      setEdit({ ...edit, unitName: e.target.value })
                      if (fieldErrors.unitName) {
                        setFieldErrors({ ...fieldErrors, unitName: undefined })
                      }
                    }}
                    placeholder="Nhập đơn vị (lần, kg, giờ...)"
                    className={`w-full ${fieldErrors.unitName ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {fieldErrors.unitName && (
                    <div className="mt-1 text-sm font-medium text-red-600">{fieldErrors.unitName}</div>
                  )}
                </div>
              </div>

              {/* Trạng thái */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái <span className="text-red-500">*</span></label>
                <div className="relative">
                <select
                    key={`isActive-${edit.id || 'new'}`}
                  value={edit.isActive ? 'true' : 'false'}
                  onChange={(e) => setEdit({ ...edit, isActive: e.target.value === 'true' })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none appearance-none bg-white"
                >
                  <option value="true">ACTIVE</option>
                  <option value="false">INACTIVE</option>
                </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Mô tả - chỉ hiển thị trên desktop */}
              <div className="hidden sm:block">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea
                  key={`description-${edit.id || 'new'}`}
                  value={edit.description}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                  placeholder="Nhập mô tả dịch vụ"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
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
      <Modal open={confirmOpen.open} onClose={() => setConfirmOpen({ open: false })} title="Xác nhận xóa">
        <div className="p-6">          <p className="text-gray-600 mb-6">
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
