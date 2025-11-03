"use client";

import { useEffect, useMemo, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";

import { type Room, type RoomStatus } from '@/lib/types'
import { useRooms, useRoomTypes } from '@/hooks/useApi'

const statusOptions: RoomStatus[] = ["AVAILABLE", "OCCUPIED", "MAINTENANCE", "CLEANING", "OUT_OF_SERVICE"]

// Mapping trạng thái sang tiếng Việt
const statusLabels: Record<RoomStatus, string> = {
  "AVAILABLE": "Có thể sử dụng",
  "OCCUPIED": "Đang sử dụng", 
  "MAINTENANCE": "Bảo trì",
  "CLEANING": "Đang dọn dẹp",
  "OUT_OF_SERVICE": "Ngừng hoạt động"
}

export default function RoomsPage() {
  const [rows, setRows] = useState<Room[]>([])
  const { data: roomsData, refetch: refetchRooms } = useRooms()
  const { data: roomTypesData, refetch: refetchRoomTypes } = useRoomTypes()
  const [roomTypes, setRoomTypes] = useState<any[]>([])
  const [flash, setFlash] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [query, setQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<"ALL" | RoomStatus>("ALL")
  const [sortKey, setSortKey] = useState<"code" | "roomTypeId">("code")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<Room | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<{ id?: number, code: string, name: string, roomTypeId: number, floor: number, status: RoomStatus, description: string }>({ code: "", name: "", roomTypeId: 1, floor: 1, status: "AVAILABLE", description: "" })
  const [confirmOpen, setConfirmOpen] = useState<{ open: boolean, id?: number }>({ open: false })

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 3000)
    return () => clearTimeout(t)
  }, [flash])

  // Keyboard shortcuts for edit modal
  useEffect(() => {
    if (!editOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
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

  // Sync with hooks data
  useEffect(() => {
    if (roomsData) setRows(roomsData as Room[])
  }, [roomsData])

  useEffect(() => {
    if (roomTypesData) setRoomTypes(roomTypesData as any[])
  }, [roomTypesData])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = rows.filter(r =>
      r.code.toLowerCase().includes(q) ||
      (r.name || "").toLowerCase().includes(q) ||
      (r.description || "").toLowerCase().includes(q)
    )
    if (filterStatus !== "ALL") list = list.filter(r => r.status === filterStatus)
    const dir = sortOrder === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (sortKey === 'code') return a.code.localeCompare(b.code) * dir
      return (a.roomTypeId - b.roomTypeId) * dir
    })
  }, [rows, query, filterStatus, sortKey, sortOrder])

  function openCreate() {
    setEdit({ code: "", name: "", roomTypeId: 1, floor: 1, status: "AVAILABLE", description: "" })
    setEditOpen(true)
  }

  function openEdit(r: Room) {
    setEdit({ 
      id: r.id, 
      code: r.code, 
      name: r.name || "", 
      roomTypeId: r.roomTypeId, 
      floor: r.floor || 1, 
      status: r.status, 
      description: r.description || "" 
    })
    setEditOpen(true)
  }

  async function save() {
    if (!edit.code.trim()) {
      setFlash({ type: 'error', text: 'Vui lòng nhập Code.' })
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
    if (edit.id) {
      await fetch('/api/system/rooms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: edit.id, ...payload })
      })
      await refetchRooms()
      setFlash({ type: 'success', text: 'Đã cập nhật phòng.' })
    } else {
      await fetch('/api/system/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      await refetchRooms()
      setFlash({ type: 'success', text: 'Đã tạo phòng mới.' })
    }
    setEditOpen(false)
  }

  function confirmDelete(id: number) {
    setConfirmOpen({ open: true, id })
  }

  async function doDelete() {
    if (!confirmOpen.id) return
    await fetch(`/api/system/rooms?id=${confirmOpen.id}`, { method: 'DELETE' })
    await refetchRooms()
    setConfirmOpen({ open: false })
    setFlash({ type: 'success', text: 'Đã vô hiệu hóa phòng.' })
  }

  async function activateRoom(id: number) {
    try {
      const resp = await fetch(`/api/system/rooms/${id}/activate`, { method: 'PUT' })
      if (!resp.ok) throw new Error('Kích hoạt phòng thất bại')
      setFlash({ type: 'success', text: 'Đã kích hoạt phòng thành công.' })
      await refetchRooms()
    } catch (e) {
      setFlash({ type: 'error', text: e instanceof Error ? e.message : 'Có lỗi xảy ra' })
    }
  }

  function renderStatusChip(s: RoomStatus) {
    if (s === 'AVAILABLE') return <Badge tone="available">{statusLabels[s]}</Badge>
    if (s === 'OCCUPIED') return <Badge tone="occupied">{statusLabels[s]}</Badge>
    if (s === 'MAINTENANCE') return <Badge tone="maintenance">{statusLabels[s]}</Badge>
    if (s === 'CLEANING') return <Badge tone="info">{statusLabels[s]}</Badge>
    return <Badge tone="muted">{statusLabels[s]}</Badge>
  }

  const getRoomTypeName = (roomTypeId: number) => {
    const roomType = roomTypes.find(rt => rt.id === roomTypeId)
    return roomType ? roomType.name : `Type ${roomTypeId}`
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Quản lý phòng</h1>
              <p className="text-xs text-gray-500">{filtered.length} phòng</p>
            </div>
          </div>
          <Button 
            onClick={openCreate} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Thêm phòng
            </Button>
        </div>
      </div>

      {/* Flash message */}
      {flash && (
        <div className={`px-3 sm:px-4 lg:px-6 py-2 ${flash.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {flash.text}
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 mt-4">
        {/* Mobile: 2 hàng */}
        <div className="lg:hidden space-y-3">
          {/* Hàng 1: Tìm kiếm và Sắp xếp */}
          <div className="flex flex-row gap-3 items-center">
            {/* Tìm kiếm */}
            <div className="flex-1 min-w-0">
              <div className="relative">
            <Input
                  placeholder="Tìm kiếm phòng..."
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
            <div className="w-40 flex-shrink-0">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as "code" | "roomTypeId")}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                <option value="code">Theo Code</option>
                <option value="roomTypeId">Theo Loại phòng</option>
                </select>
              </div>
          </div>
          
          {/* Hàng 2: Thứ tự và Trạng thái */}
          <div className="flex flex-row gap-3 items-center">
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
            
            {/* Trạng thái */}
            <div className="flex-1 min-w-0">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "ALL" | RoomStatus)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tất cả trạng thái</option>
                {statusOptions.map(status => (
                  <option key={status} value={status}>{statusLabels[status]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Desktop: 1 hàng */}
        <div className="hidden lg:flex flex-row gap-4 items-center">
          {/* Tìm kiếm */}
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Input
                placeholder="Tìm kiếm phòng..."
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
              onChange={(e) => setSortKey(e.target.value as "code" | "roomTypeId")}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="code">Theo Code</option>
              <option value="roomTypeId">Theo Loại phòng</option>
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
              onChange={(e) => setFilterStatus(e.target.value as "ALL" | RoomStatus)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tất cả</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>{statusLabels[status]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-gray-50 border-b border-gray-200 px-6 py-3">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Danh sách phòng</h2>
                <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">{filtered.length} phòng</span>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[5%]" />
                  <col className="w-[10%]" />
                  <col className="w-[5%]" />
                  <col className="w-[10%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 text-gray-700">
                    <th className="px-4 py-3 text-center font-semibold">Code</th>
                    <th className="px-4 py-3 text-center font-semibold">Tên phòng</th>
                    <th className="px-4 py-3 text-center font-semibold">Loại phòng</th>
                    <th className="px-4 py-3 text-center font-semibold">Tầng</th>
                    <th className="px-4 py-3 text-center font-semibold">Trạng thái phòng</th>
                    <th className="px-4 py-3 text-center font-semibold">Kích hoạt</th>
                    <th className="px-4 py-3 text-center font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice((page - 1) * size, page * size).map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 border-b border-gray-100">
                      <td className="px-4 py-3 font-medium text-center text-gray-900">{row.code}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{row.name || '-'}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{getRoomTypeName(row.roomTypeId)}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{row.floor || '-'}</td>
                      <td className="px-4 py-3 text-center">{renderStatusChip(row.status)}</td>
                      <td className="px-4 py-3 text-center">
                        {row.isActive !== false ? (
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
                          {row.isActive !== false ? (
                            <Button
                              variant="danger"
                              className="h-8 px-3 text-xs"
                              onClick={() => confirmDelete(row.id)}
                            >
                              Vô hiệu
                            </Button>
                          ) : (
                            <Button
                              className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700"
                              onClick={() => activateRoom(row.id)}
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
            <div className="lg:hidden">
              {filtered.slice((page - 1) * size, page * size).map((row) => (
                <div key={row.id} className="border-b border-gray-100 p-6 hover:bg-gray-50/50 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                          <span className="text-white font-bold text-sm">{row.code.charAt(0)}</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">{row.code}</h3>
                          <p className="text-sm text-gray-600">{row.name || 'Chưa có tên'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className="text-sm text-gray-600">{getRoomTypeName(row.roomTypeId)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                          </svg>
                          <span className="text-sm text-gray-600">Tầng {row.floor || '-'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mb-4">
                        {renderStatusChip(row.status)}
                        {row.isActive !== false ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Vô hiệu
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      variant="secondary"
                      className="h-10 text-sm font-medium"
                      onClick={() => {
                        setSelected(row)
                        setDetailOpen(true)
                      }}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Xem
                    </Button>
                    <Button
                      className="h-10 text-sm font-medium"
                      onClick={() => openEdit(row)}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Sửa
                    </Button>
                    {row.isActive !== false ? (
                      <Button
                        variant="danger"
                        className="h-10 text-sm font-medium"
                        onClick={() => confirmDelete(row.id)}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        Vô hiệu
                      </Button>
                    ) : (
                      <Button
                        className="h-10 text-sm font-medium bg-green-600 hover:bg-green-700"
                        onClick={() => activateRoom(row.id)}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Kích hoạt
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

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
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 border border-blue-200">
                {/* Thông tin phòng chính */}
                <div className="space-y-4">
                  {/* Header với icon và status */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Phòng {selected.code}</h2>
                        <p className="text-base sm:text-lg lg:text-xl text-gray-600 truncate">{selected.name || 'Chưa có tên'}</p>
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
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">ID Phòng</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-blue-900">{selected.id}</p>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Tầng</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-blue-900">{selected.floor || 'Chưa xác định'}</p>
                    </div>
                  </div>

                  {/* Loại phòng */}
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Loại phòng</span>
                    </div>
                    <p className="text-base sm:text-lg font-bold text-blue-900 break-words leading-relaxed">{getRoomTypeName(selected.roomTypeId)}</p>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={edit.id ? 'Sửa phòng' : 'Thêm phòng mới'}>
        <div className="p-4 sm:p-6">
          <div className="space-y-4">
            {/* Form */}
            <div className="space-y-3">
              {/* Code và Tên phòng */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <Input
                    value={edit.code}
                    onChange={(e) => setEdit({ ...edit, code: e.target.value })}
                    placeholder="Nhập code phòng"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên phòng</label>
                  <Input
                    value={edit.name}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                    placeholder="Nhập tên phòng"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Loại phòng và Tầng */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loại phòng *</label>
                  <select
                    value={edit.roomTypeId}
                    onChange={(e) => setEdit({ ...edit, roomTypeId: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {roomTypes.map(rt => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tầng *</label>
                  <Input
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái *</label>
                <select
                  value={edit.status}
                  onChange={(e) => setEdit({ ...edit, status: e.target.value as RoomStatus })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{statusLabels[status]}</option>
                  ))}
                </select>
              </div>

              {/* Mô tả - chỉ hiển thị trên desktop */}
              <div className="hidden sm:block">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea
                  value={edit.description}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                  placeholder="Nhập mô tả phòng"
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Xác nhận vô hiệu hóa</h2>
          <p className="text-gray-600 mb-6">
            Bạn có chắc muốn vô hiệu hóa phòng này? Phòng sẽ không bị xóa hoàn toàn và có thể được kích hoạt lại sau.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmOpen({ open: false })}>
              Hủy
            </Button>
            <Button variant="danger" onClick={doDelete}>
              Vô hiệu hóa
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}