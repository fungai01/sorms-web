"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { Table, THead, TBody } from "@/components/ui/Table";
import { type RoomType } from "@/lib/types";
import { useRoomTypes } from '@/hooks/useApi'
import { apiClient } from '@/lib/api-client'

export default function RoomTypesPage() {
  const { data: roomTypesData, refetch: refetchRoomTypes } = useRoomTypes()
  const rows = roomTypesData || []
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const [flash, setFlash] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<RoomType | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<{ id?: number, code: string, name: string, basePrice: number, maxOccupancy: number, description: string }>({ code: "", name: "", basePrice: 0, maxOccupancy: 1, description: "" })
  const [confirmOpen, setConfirmOpen] = useState<{ open: boolean, id?: number }>({ open: false })
  const [codeError, setCodeError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [basePriceError, setBasePriceError] = useState<string | null>(null)
  const [maxOccupancyError, setMaxOccupancyError] = useState<string | null>(null)

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 3000)
    return () => clearTimeout(t)
  }, [flash])

  const handleCloseEdit = useCallback(() => {
    setEditOpen(false)
    setEdit({ code: "", name: "", basePrice: 0, maxOccupancy: 1, description: "" })
    setCodeError(null)
    setNameError(null)
    setBasePriceError(null)
    setMaxOccupancyError(null)
  }, [])

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
        handleCloseEdit()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editOpen, handleCloseEdit])

  // Global Escape handler: ESC closes any open modal on this page
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleCloseEdit()
        setDetailOpen(false)
        setConfirmOpen({ open: false })
      }
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [handleCloseEdit])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? rows.filter(r => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q))
      : rows
  }, [rows, query])

  async function openCreate() {
    try {
      const response = await apiClient.getRoomTypes()
      const items = (response.data as any[]) || []
      const numbers = items.map((r: any) => {
        const n = parseInt(String(r.code ?? ''), 10)
        return Number.isNaN(n) ? Number(r.id ?? 0) : n
      })
      const maxNum = numbers.length ? Math.max(...numbers) : 0
      const nextCode = String(maxNum + 1)
      setEdit({ code: nextCode, name: "", basePrice: 0, maxOccupancy: 1, description: "" })
    } catch {
      const numbers = rows.map(r => {
        const n = parseInt(r.code, 10)
        return Number.isNaN(n) ? r.id : n
      })
      const maxNum = numbers.length ? Math.max(...numbers) : 0
      const nextCode = String(maxNum + 1)
      setEdit({ code: nextCode, name: "", basePrice: 0, maxOccupancy: 1, description: "" })
    } finally {
      setCodeError(null)
      setNameError(null)
      setBasePriceError(null)
      setMaxOccupancyError(null)
      setEditOpen(true)
    }
  }

  function openEdit(rt: RoomType) {
    setEdit({ 
      id: rt.id, 
      code: rt.code, 
      name: rt.name, 
      basePrice: rt.basePrice, 
      maxOccupancy: rt.maxOccupancy, 
      description: rt.description || "" 
    })
    setCodeError(null)
    setNameError(null)
    setBasePriceError(null)
    setMaxOccupancyError(null)
    setEditOpen(true)
  }

  async function save() {
    if (!edit.code.trim()) {
      setCodeError('Code is required')
      return
    }
    if (!edit.name.trim()) {
      setNameError('Name is required')
      return
    }
    if (edit.basePrice < 0) {
      setBasePriceError('Base price cannot be negative.')
      return
    }
    if (edit.maxOccupancy < 1) {
      setMaxOccupancyError('Max occupancy must be greater than 0.')
      return
    }
    const payload = {
      code: edit.code.trim(),
      name: edit.name.trim(),
      basePrice: edit.basePrice,
      maxOccupancy: edit.maxOccupancy,
      description: edit.description.trim() || "",
    }

    const response = edit.id
      ? await apiClient.updateRoomType(edit.id, payload)
      : await apiClient.createRoomType(payload)

    if (response.success) {
      await refetchRoomTypes()
      setFlash({ type: 'success', text: edit.id ? 'Đã cập nhật dãy tòa.' : 'Đã tạo dãy tòa mới.' })
      handleCloseEdit()
    } else {
      const errorMsg = response.error || ''
      if (/(exist|duplicate|already|đã tồn tại|trùng)/i.test(errorMsg)) {
        setCodeError(errorMsg)
      } else {
        setFlash({ type: 'error', text: errorMsg })
      }
    }
  }

  function confirmDelete(id: number) {
    setConfirmOpen({ open: true, id })
  }

  async function doDelete() {
    if (!confirmOpen.id) return
    const response = await apiClient.deleteRoomType(confirmOpen.id)
    if (response.success) {
      await refetchRoomTypes()
      setConfirmOpen({ open: false })
      setFlash({ type: 'success', text: 'Đã xóa dãy tòa.' })
    } else {
      setFlash({ type: 'error', text: response.error || '' })
    }
  }

  return (
    <>
      <div className="px-6 pt-4 pb-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header + Filters Card */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="header border-b border-gray-200/50 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold text-gray-900 leading-tight">Quản lý dãy tòa</h1>
                </div>
                <Button 
                  onClick={openCreate}
                  variant="primary"
                  className="px-5 py-2.5 text-sm rounded-xl"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Thêm dãy tòa
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white px-6 py-4">
              {/* Mobile: search only */}
              <div className="lg:hidden">
                <Input
                  placeholder="Tìm kiếm dãy tòa..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border-gray-300 rounded-xl focus:ring-0 focus:border-gray-300"
                />
              </div>

              {/* Desktop: search only */}
              <div className="hidden lg:flex flex-row gap-4 items-center">
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder="Tìm kiếm dãy tòa..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border-gray-300 rounded-xl focus:ring-0 focus:border-gray-300"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Success Messages */}
          {flash && flash.type === 'success' && (
            <div>
              <div className="py-2.5 bg-green-50 text-green-800 rounded-xl px-4 border border-green-100 shadow-sm animate-fade-in flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium">{flash.text}</span>
              </div>
            </div>
          )}

          {/* Error Messages */}
          {flash && flash.type === 'error' && (
            <div>
              <div className="py-2.5 bg-red-50 text-red-800 rounded-xl px-4 border border-red-100 shadow-sm animate-fade-in flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-sm font-medium">{flash.text}</span>
              </div>
            </div>
          )}

          {/* Table */}
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Danh sách dãy tòa</h2>
                <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                  {filtered.length} dãy tòa
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
                      <th className="px-4 py-3 text-center text-sm font-bold">Tên dãy tòa</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Giá cơ bản</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Số người tối đa</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Trạng thái</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Thao tác</th>
                    </tr>
                  </THead>
                  <TBody>
                    {filtered.slice((page - 1) * size, page * size).map((row, index) => (
                      <tr key={row.id} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:bg-[#f2f8fe]`}>
                        <td className="px-4 py-3 font-medium text-center text-gray-900">{row.code}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{row.name}</td>
                        <td className="px-4 py-3 text-center text-gray-700">
                          {row.basePrice === 0 ? (
                            <Badge tone="success" className="rounded-full">Miễn phí</Badge>
                          ) : (
                            <span>{row.basePrice.toLocaleString('vi-VN')} VND</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">{row.maxOccupancy}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge tone="active" className="rounded-full">Hoạt động</Badge>
                        </td>
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
                    className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 transition-colors hover:bg-[#f2f8fe] active:bg-[#f2f8fe]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Icon tòa nhà */}
                        <div className="w-11 h-11 rounded-xl bg-[hsl(var(--primary)/0.12)] flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                          </svg>
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-gray-900 truncate">
                            Dãy {row.name?.trim() ? row.name : row.code}
                          </h3>
                          {!row.name?.trim() && (
                            <p className="text-sm text-gray-600 truncate">Chưa có tên</p>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        <Badge tone="active" className="rounded-full">Hoạt động</Badge>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                        <div className="text-sm text-gray-700 truncate">
                          <span className="font-semibold text-gray-600">Giá cơ bản:</span>{" "}
                          <span className="inline-block font-semibold text-green-800 bg-green-100 border border-green-200 rounded-md px-2 py-0.5">
                            {row.basePrice === 0 ? 'Miễn phí' : `${row.basePrice.toLocaleString('vi-VN')} VND`}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                        <div className="text-sm text-gray-700 truncate">
                          <span className="font-semibold text-gray-600">Số người tối đa:</span>{" "}
                          <span className="font-semibold text-gray-900">{row.maxOccupancy}</span>
                        </div>
                      </div>
                    </div>

                    {row.description && (
                      <div className="mt-3 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                        <div className="text-sm text-gray-700">
                          <span className="font-semibold text-gray-600">Mô tả:</span>{" "}
                          <span className="text-gray-900">{row.description}</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Button
                        variant="secondary"
                        className="h-10 text-sm font-medium bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                        onClick={() => {
                          setSelected(row)
                          setDetailOpen(true)
                        }}
                      >
                        Xem
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-10 text-sm font-medium bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                        onClick={() => openEdit(row)}
                      >
                        Sửa
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

              {/* Pagination */}
              {filtered.length > size && (
                <div className="bg-gradient-to-r from-gray-50 to-[hsl(var(--page-bg))] px-6 py-6 border-t border-gray-200/50">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="text-center sm:text-left">
                      <div className="text-sm text-gray-600 mb-1">Hiển thị kết quả</div>
                      <div className="text-lg font-bold text-gray-900">
                        <span className="text-[hsl(var(--primary))]">{(page - 1) * size + 1}</span>
                        {" "}-{" "}
                        <span className="text-[hsl(var(--primary))]">{Math.min(page * size, filtered.length)}</span>
                        {" "} / <span className="text-gray-600">{filtered.length}</span>
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
                        <span className="text-sm font-bold text-gray-700 bg-white px-4 py-2 rounded-xl border-2 border-[hsl(var(--primary)/0.25)] shadow-sm">
                          Trang {page}
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
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết dãy tòa">
        <div className="p-4 sm:p-6">
          {selected && (
            <div className="space-y-6">
              {/* Header với thông tin chính */}
              <div className="bg-gradient-to-r from-[hsl(var(--page-bg))] to-[hsl(var(--primary)/0.08)] rounded-xl p-4 sm:p-6 border border-[hsl(var(--primary)/0.25)]">
                {/* Thông tin dãy tòa chính */}
                <div className="space-y-4">
                  {/* Header với icon */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[hsl(var(--primary))] rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                          Dãy {selected.name?.trim() ? selected.name : selected.code}
                        </h2>
                      </div>
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
                        <span className="text-gray-600">Số người tối đa:</span>{" "}
                        <span className="font-bold text-[hsl(var(--primary))]">{selected.maxOccupancy}</span>
                      </p>
                    </div>
                  </div>

                  {/* Giá cơ bản */}
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                    <p className="text-sm sm:text-base font-semibold text-gray-700 break-words leading-relaxed">
                      <span className="text-gray-600">Giá cơ bản:</span>{" "}
                      <span className="font-bold text-[hsl(var(--primary))]">
                        {selected.basePrice === 0 ? 'Miễn phí' : `${selected.basePrice.toLocaleString('vi-VN')} VND`}
                      </span>
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
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={handleCloseEdit} title={edit.id ? 'Sửa dãy tòa' : 'Thêm dãy tòa mới'}>
        <div className="p-4 sm:p-6">
          <div className="space-y-4">
            {/* Form */}
            <div className="space-y-3">
              {/* Code và Tên dãy tòa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={edit.code}
                    onChange={(e) => { setEdit({ ...edit, code: e.target.value }); setCodeError(null); }}
                    placeholder="Nhập code dãy tòa"
                    className={`w-full ${codeError ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {codeError && (
                    <div className="mt-1 text-sm font-medium text-red-600">{codeError}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên Dãy Tòa <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={edit.name}
                    onChange={(e) => { setEdit({ ...edit, name: e.target.value }); setNameError(null); }}
                    placeholder="Nhập tên dãy tòa"
                    className={`w-full ${nameError ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {nameError && (
                    <div className="mt-1 text-sm font-medium text-red-600">{nameError}</div>
                  )}
                </div>
              </div>

              {/* Giá cơ bản và Số người */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Giá cơ bản <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={edit.basePrice}
                    onChange={(e) => { setEdit({ ...edit, basePrice: Number(e.target.value) }); setBasePriceError(null); }}
                    placeholder="Giá cơ bản (0 = miễn phí)"
                    className={`w-full ${basePriceError ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {basePriceError && (
                    <div className="mt-1 text-sm font-medium text-red-600">{basePriceError}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số người tối đa <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={edit.maxOccupancy}
                    onChange={(e) => { setEdit({ ...edit, maxOccupancy: Number(e.target.value) }); setMaxOccupancyError(null); }}
                    placeholder="Số người tối đa"
                    className={`w-full ${maxOccupancyError ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {maxOccupancyError && (
                    <div className="mt-1 text-sm font-medium text-red-600">{maxOccupancyError}</div>
                  )}
                </div>
              </div>

              {/* Mô tả - chỉ hiển thị trên desktop */}
              <div className="hidden sm:block">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea
                  value={edit.description}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                  placeholder="Nhập mô tả dãy tòa"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-row gap-3 pt-3 border-t border-gray-200">
              <Button 
                variant="secondary" 
                onClick={handleCloseEdit}
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
        <div className="p-6">
          <p className="text-gray-600 mb-6">
            Bạn có chắc muốn xóa dãy tòa này? Dãy tòa sẽ bị xóa vĩnh viễn khỏi hệ thống.
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
  );
}
