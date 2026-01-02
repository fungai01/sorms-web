"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { Table, THead, TBody } from "@/components/ui/Table";
import { type Room, type RoomStatus } from '@/lib/types'
import { useRoomsFiltered, useRoomTypes } from '@/hooks/useApi'
import { apiClient } from '@/lib/api-client'
import { formatDate, formatDateTime } from '@/lib/utils'

const statusOptions: RoomStatus[] = ["AVAILABLE", "OCCUPIED", "MAINTENANCE", "CLEANING", "OUT_OF_SERVICE"]

const statusLabels: Record<RoomStatus, string> = {
  "AVAILABLE": "Có thể sử dụng",
  "OCCUPIED": "Đang sử dụng", 
  "MAINTENANCE": "Bảo trì",
  "CLEANING": "Đang dọn dẹp",
  "OUT_OF_SERVICE": "Ngừng hoạt động"
}

export default function RoomsPage() {
  const [query, setQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<"ALL" | RoomStatus>("ALL")
  
  // API hooks
  const { data: roomsData, refetch: refetchRooms, loading: loadingRooms } = useRoomsFiltered(
    filterStatus !== 'ALL' ? filterStatus : undefined
  )
  const rooms = roomsData || []

  const { data: roomTypesData } = useRoomTypes()
  const roomTypes = roomTypesData || []

  const [flash, setFlash] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<Room | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const defaultRoomTypeId = useMemo(() => {
    // Prefer first available room type from API; fallback to 1 for safety if not loaded yet
    return Number(roomTypes?.[0]?.id ?? 1)
  }, [roomTypes])

  const [edit, setEdit] = useState<{ id?: number, code: string, name: string, roomTypeId: number, floor: number, status: RoomStatus, description: string }>({ code: "", name: "", roomTypeId: defaultRoomTypeId, floor: 1, status: "AVAILABLE", description: "" })
  const [confirmOpen, setConfirmOpen] = useState<{ open: boolean, id?: number }>({ open: false })
  const [codeError, setCodeError] = useState<string | null>(null)

  const handleCloseEdit = useCallback(() => {
    setEditOpen(false)
    setEdit({ code: "", name: "", roomTypeId: defaultRoomTypeId, floor: 1, status: "AVAILABLE", description: "" })
    setCodeError(null)
  }, [defaultRoomTypeId])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 3000)
    return () => clearTimeout(t)
  }, [flash])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
      const isTextarea = tag === 'textarea'
      const isInput = tag === 'input'

      if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !isTextarea && !isInput && editOpen) {
        e.preventDefault()
        save()
      } else if (e.key === 'Escape') {
        if (editOpen) handleCloseEdit()
        setDetailOpen(false)
        setConfirmOpen({ open: false })
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editOpen, handleCloseEdit])

  const filtered = useMemo(() => {
    const list = Array.isArray(rooms) ? rooms : []
    const q = (query || '').trim().toLowerCase()
    const searched = q
      ? list.filter(r => r.code.toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q))
      : list
    // Mặc định sắp xếp theo code tăng dần
    return [...searched].sort((a, b) => a.code.localeCompare(b.code))
  }, [rooms, query])

  const getNextAvailableCode = useCallback(async () => {
    try {
      const response = await apiClient.getRooms()
      const items = (response.data as any[]) || []
      const numbers = items.map((r: any) => {
        const n = parseInt(String(r.code ?? ''), 10)
        return Number.isNaN(n) ? Number(r.id ?? 0) : n
      })
      return String((numbers.length ? Math.max(...numbers) : 0) + 1)
    } catch {
      const numbers = (rooms as Room[]).map(r => {
        const n = parseInt(r.code, 10)
        return Number.isNaN(n) ? r.id : n
      })
      const maxNum = numbers.length ? Math.max(...numbers) : 0
      return String(maxNum + 1)
    }
  }, [rooms])

  const openCreate = async () => {
    setCodeError(null)
    setFlash(null)
    const nextCode = await getNextAvailableCode()
    setEdit({ 
      code: nextCode, 
      name: "", 
      roomTypeId: defaultRoomTypeId, 
      floor: 1, 
      status: "AVAILABLE", 
      description: "" 
    })
    setEditOpen(true)
  }

  const openEdit = (r: Room) => {
    setCodeError(null)
    setFlash(null)
    setEdit({ 
      id: r.id, 
      code: r.code || "", 
      name: r.name || "", 
      roomTypeId: (r.roomTypeId ?? defaultRoomTypeId), 
      floor: r.floor || 1, 
      status: r.status || "AVAILABLE", 
      description: r.description || "" 
    })
    setEditOpen(true)
  }

  const save = async () => {
    if (!edit.code.trim()) {
      setCodeError('Code is required')
      return
    }
    
    const payload = {
      code: edit.code.trim(),
      name: edit.name.trim() || "",
      roomTypeId: edit.roomTypeId,
      floor: edit.floor,
      status: edit.status,
      description: edit.description.trim() || "",
    }

    const response = edit.id 
      ? await apiClient.updateRoom(edit.id, payload)
      : await apiClient.createRoom(payload)

    if (response.success) {
      await refetchRooms()
      setFlash({ type: 'success', text: edit.id ? 'Đã cập nhật phòng.' : 'Đã tạo phòng mới.' })
      handleCloseEdit()
    } else {
      setCodeError(response.error || '')
    }
  }

  const confirmDelete = (id: number) => {
    setConfirmOpen({ open: true, id })
  }

  const doDelete = async () => {
    if (!confirmOpen.id) return
    const response = await apiClient.deleteRoom(confirmOpen.id)
    if (response.success) {
      await refetchRooms()
      setConfirmOpen({ open: false })
      setFlash({ type: 'success', text: 'Đã xóa phòng.' })
    } else {
      setFlash({ type: 'error', text: response.error || '' })
    }
  }

  const renderStatusChip = (s: RoomStatus) => {
    const toneMap: Record<RoomStatus, "available" | "occupied" | "maintenance" | "info" | "muted"> = {
      "AVAILABLE": "available",
      "OCCUPIED": "occupied",
      "MAINTENANCE": "maintenance",
      "CLEANING": "info",
      "OUT_OF_SERVICE": "muted"
    }
    return <Badge tone={toneMap[s] || "muted"} className="rounded-full">{statusLabels[s]}</Badge>
  }

  const getRoomTypeName = (id: number) => {
    return roomTypes.find(rt => Number(rt.id) === Number(id))?.name || `Type ${id}`
  }

  return (
    <>
      <div className="px-6 pt-4 pb-6">
        <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="header border-b border-gray-200/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900 leading-tight">Quản lý phòng</h1>
            </div>
            <Button 
              onClick={openCreate}
              variant="primary"
              className="px-5 py-2.5 text-sm rounded-xl"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Thêm phòng
              </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white px-6 py-4">
          {/* Mobile: chỉ giữ search + lọc chính */}
          <div className="lg:hidden space-y-3">
            {/* Hàng 1: Tìm kiếm */}
            <Input
              placeholder="Tìm kiếm phòng..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border-gray-300 rounded-xl focus:ring-0 focus:border-gray-300"
            />
            
            {/* Hàng 2: Trạng thái */}
            <div className="relative w-full rounded-xl border border-gray-300 bg-white overflow-hidden">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "ALL" | RoomStatus)}
                className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
              >
                <option value="ALL">Tất cả trạng thái</option>
                {statusOptions.map(status => (
                  <option key={status} value={status}>{statusLabels[status]}</option>
                ))}
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
                placeholder="Tìm kiếm phòng..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border-gray-300 rounded-xl focus:ring-0 focus:border-gray-300"
              />
            </div>

            {/* Trạng thái */}
            <div className="w-40 flex-shrink-0 relative rounded-xl border border-gray-300 bg-white overflow-hidden">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "ALL" | RoomStatus)}
                className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
              >
                <option value="ALL">Tất cả trạng thái</option>
                {statusOptions.map(status => (
                  <option key={status} value={status}>{statusLabels[status]}</option>
                ))}
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

      {/* Table */}
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Danh sách phòng</h2>
                <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                  {filtered.length} phòng
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
                    <th className="px-4 py-3 text-center text-sm font-bold">Tên phòng</th>
                    <th className="px-4 py-3 text-center text-sm font-bold">Dãy Tòa</th>
                    <th className="px-4 py-3 text-center text-sm font-bold">Tầng</th>
                    <th className="px-4 py-3 text-center text-sm font-bold">Trạng thái phòng</th>
                    <th className="px-4 py-3 text-center text-sm font-bold">Thao tác</th>
                  </tr>
                </THead>
                <TBody>
                  {filtered.slice((page - 1) * size, page * size).map((row, index) => (
                    <tr key={row.id} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:bg-[#f2f8fe]`}>
                      <td className="px-4 py-3 font-medium text-center text-gray-900">{row.code}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{row.name || '-'}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{getRoomTypeName(row.roomTypeId)}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{row.floor || '-'}</td>
                      <td className="px-4 py-3 text-center">{renderStatusChip(row.status)}</td>
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
            <div className="lg:hidden space-y-3">
              {filtered.slice((page - 1) * size, page * size).map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 transition-colors hover:bg-[#f2f8fe] active:bg-[#f2f8fe]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Icon tòa nhà (thay cho chữ/số) */}
                      <div className="w-11 h-11 rounded-xl bg-[hsl(var(--primary)/0.12)] flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M6 21V5a2 2 0 012-2h8a2 2 0 012 2v16M9 7h.01M9 11h.01M9 15h.01M12 7h.01M12 11h.01M12 15h.01M15 7h.01M15 11h.01M15 15h.01" />
                        </svg>
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-gray-900 truncate">
                          Phòng {row.name?.trim() ? row.name : row.code}
                        </h3>
                        {!row.name?.trim() && (
                          <p className="text-sm text-gray-600 truncate">Chưa có tên</p>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {renderStatusChip(row.status)}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                      <div className="text-sm text-gray-700 truncate">
                        <span className="font-semibold text-gray-600">Dãy Tòa:</span>{" "}
                        <span className="font-semibold text-gray-900">{getRoomTypeName(row.roomTypeId)}</span>
                      </div>
                    </div>
                    <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                      <div className="text-sm text-gray-700 truncate">
                        <span className="font-semibold text-gray-600">Tầng:</span>{" "}
                        <span className="font-semibold text-gray-900">{row.floor || '-'}</span>
                      </div>
                    </div>
                  </div>

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
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết phòng">
        <div className="p-4 sm:p-6">
          {selected && (
              <div className="space-y-6">
              {/* Header với thông tin chính */}
              <div className="bg-gradient-to-r from-[hsl(var(--page-bg))] to-[hsl(var(--primary)/0.08)] rounded-xl p-4 sm:p-6 border border-[hsl(var(--primary)/0.25)]">
                {/* Thông tin phòng chính */}
                <div className="space-y-4">
                  {/* Header với icon và status */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[hsl(var(--primary))] rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                          Phòng {selected.name?.trim() ? selected.name : selected.code}
                        </h2>
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-full sm:w-auto">
                      {renderStatusChip(selected.status)}
                    </div>
                  </div>

                  {/* Thông tin nhanh */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                      <p className="text-sm sm:text-base font-semibold text-gray-700">
                        <span className="text-gray-600">ID Phòng:</span>{" "}
                        <span className="font-bold text-[hsl(var(--primary))]">{selected.id}</span>
                      </p>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                      <p className="text-sm sm:text-base font-semibold text-gray-700">
                        <span className="text-gray-600">Tầng:</span>{" "}
                        <span className="font-bold text-[hsl(var(--primary))]">{selected.floor || 'Chưa xác định'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Dãy Tòa */}
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                    <p className="text-sm sm:text-base font-semibold text-gray-700 break-words leading-relaxed">
                      <span className="text-gray-600">Dãy Tòa:</span>{" "}
                      <span className="font-bold text-[hsl(var(--primary))]">{getRoomTypeName(selected.roomTypeId)}</span>
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
                        {formatDateTime(selected.created_at)}
                      </p>
                    </div>
                  )}
                  {selected.updated_at && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-gray-200">
                      <div className="text-xs sm:text-sm font-semibold text-gray-500 mb-1">Cập nhật gần nhất</div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDateTime(selected.updated_at)}
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
      <Modal open={editOpen} onClose={handleCloseEdit} title={edit.id ? 'Sửa phòng' : 'Thêm phòng mới'}>
        <div className="p-4 sm:p-6">
          <div className="space-y-4" key={edit.id || 'new'}>
            {/* Form */}
            <div className="space-y-3">
              {/* Code và Tên phòng */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code <span className="text-red-500">*</span></label>
                  <Input
                    key={`code-${edit.id || 'new'}`}
                    value={edit.code}
                    onChange={(e) => { setEdit({ ...edit, code: e.target.value }); setCodeError(null); }}
                    placeholder="Nhập code phòng"
                    className={`w-full ${codeError ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {codeError && (
                    <div className="mt-1 text-sm font-medium text-red-600">{codeError}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên phòng <span className="text-red-500">*</span></label>
                  <Input
                    key={`name-${edit.id || 'new'}`}
                    value={edit.name}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                    placeholder="Nhập tên phòng"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Dãy Tòa và Tầng */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dãy Tòa <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select
                      key={`roomTypeId-${edit.id || 'new'}`}
                      value={edit.roomTypeId}
                      onChange={(e) => setEdit({ ...edit, roomTypeId: Number(e.target.value) })}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none appearance-none bg-white"
                    >
                      {roomTypes.map(rt => (
                        <option key={rt.id} value={rt.id}>{rt.name}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tầng</label>
                  <Input
                    key={`floor-${edit.id || 'new'}`}
                    type="number"
                    min="1"
                    max="50"
                    value={edit.floor}
                    onChange={(e) => setEdit({ ...edit, floor: Number(e.target.value) })}
                    placeholder="Nhập tầng"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Trạng thái */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    key={`status-${edit.id || 'new'}`}
                    value={edit.status}
                    onChange={(e) => setEdit({ ...edit, status: e.target.value as RoomStatus })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none appearance-none bg-white"
                  >
                    {statusOptions.map(status => (
                      <option key={status} value={status}>{statusLabels[status]}</option>
                    ))}
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
                  placeholder="Nhập mô tả phòng"
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
            Bạn có chắc muốn xóa phòng này? Phòng sẽ bị xóa vĩnh viễn khỏi hệ thống.
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