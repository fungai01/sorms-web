"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";

import { type Room, type RoomStatus } from '@/lib/types'
import { useRoomsFiltered, useRoomTypes } from '@/hooks/useApi'

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
  const [query, setQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<"ALL" | RoomStatus>("ALL")
  const { data: roomsData, refetch: refetchRooms } = useRoomsFiltered(filterStatus !== 'ALL' ? filterStatus : undefined)
  const { data: roomTypesData, refetch: refetchRoomTypes } = useRoomTypes()
  const [roomTypes, setRoomTypes] = useState<any[]>([])
  const [flash, setFlash] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [sortKey, setSortKey] = useState<"code" | "roomTypeId">("code")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<Room | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<{ id?: number, code: string, name: string, roomTypeId: number, floor: number, status: RoomStatus, description: string }>({ code: "", name: "", roomTypeId: 1, floor: 1, status: "AVAILABLE", description: "" })
  const [confirmOpen, setConfirmOpen] = useState<{ open: boolean, id?: number }>({ open: false })
  const [codeError, setCodeError] = useState<string | null>(null)

  const handleCloseEdit = useCallback(() => {
    setEditOpen(false)
    // Reset về giá trị mặc định khi đóng modal
    setEdit({ code: "", name: "", roomTypeId: 1, floor: 1, status: "AVAILABLE", description: "" })
    setCodeError(null)
  }, [])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 3000)
    return () => clearTimeout(t)
  }, [flash])

  // Keyboard shortcuts for edit modal: Enter = Save, Esc = Close (avoid Enter in textarea)
  useEffect(() => {
    if (!editOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
      const isTextarea = tag === 'textarea'
      const isInput = tag === 'input'

      if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !isTextarea && !isInput) {
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
        if (editOpen) handleCloseEdit()
        setDetailOpen(false)
        setConfirmOpen({ open: false })
      }
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [editOpen, handleCloseEdit])


  // Sync with hooks data
  useEffect(() => {
    if (Array.isArray(roomsData)) {
      setRows(roomsData as Room[])
    } else if (roomsData && Array.isArray((roomsData as any).data)) {
      // fallback if API returns { data: [...] }
      setRows((roomsData as any).data)
    } else if (roomsData == null) {
      setRows([])
    }
  }, [roomsData])

  useEffect(() => {
    if (Array.isArray(roomTypesData)) {
      setRoomTypes(roomTypesData as any[])
    } else if (roomTypesData && Array.isArray((roomTypesData as any).data)) {
      setRoomTypes((roomTypesData as any).data)
    } else if (roomTypesData == null) {
      setRoomTypes([])
    }
  }, [roomTypesData])

  const filtered = useMemo(() => {
    const dir = sortOrder === 'asc' ? 1 : -1
    const list = Array.isArray(rows) ? rows : []
    // client-side search by code or name
    const q = (query || '').trim().toLowerCase()
    const searched = q
      ? list.filter(r => r.code.toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q))
      : list
    return [...searched].sort((a, b) => {
      if (sortKey === 'code') return a.code.localeCompare(b.code) * dir
      return (a.roomTypeId - b.roomTypeId) * dir
    })
  }, [rows, sortKey, sortOrder, query])

  async function openCreate() {
    // Lấy danh sách phòng mới nhất để sinh code tiếp theo
    try {
      const res = await fetch('/api/system/rooms', { credentials: 'include' })
      const data = await res.json()
      const items: any[] = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data?.content)
          ? data.data.content
          : Array.isArray(data?.content)
            ? data.content
            : Array.isArray(data)
              ? data
              : []
      const numbers = items.map((r: any) => {
        const n = parseInt(String(r.code ?? ''), 10)
        return Number.isNaN(n) ? Number(r.id ?? 0) : n
      })
      const next = String((numbers.length ? Math.max(...numbers) : 0) + 1)
      setEdit({ code: next, name: "", roomTypeId: 1, floor: 1, status: "AVAILABLE", description: "" })
    } catch {
      // fallback nếu lỗi
      setEdit({ code: "", name: "", roomTypeId: 1, floor: 1, status: "AVAILABLE", description: "" })
    } finally {
      setCodeError(null)
      setFlash(null)
      setEditOpen(true)
    }
  }

  function openEdit(r: Room) {
    // Reset state trước khi set dữ liệu mới
    setCodeError(null)
    setFlash(null)
    // Đảm bảo dữ liệu được set đúng - sử dụng giá trị thực từ r, không dùng giá trị mặc định
    const editData = { 
      id: r.id, 
      code: r.code || "", 
      name: r.name || "", 
      roomTypeId: r.roomTypeId || 1, 
      floor: r.floor || 1, 
      status: r.status || "AVAILABLE", 
      description: r.description || "" 
    }
    // Đóng modal trước (nếu đang mở) để reset
    setEditOpen(false)
    // Set dữ liệu của phòng được chọn
    setEdit(editData)
    // Mở modal sau khi đã set dữ liệu - sử dụng setTimeout để đảm bảo state được cập nhật
    setTimeout(() => {
      setEditOpen(true)
    }, 10)
  }

  async function save() {
    if (!edit.code.trim()) {
      setCodeError('Vui lòng nhập Code.')
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

    const suggestNextCode = async () => {
      try {
        const res = await fetch('/api/system/rooms', { credentials: 'include' })
        const data = await res.json()
        const items: any[] = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.data?.content)
            ? data.data.content
            : Array.isArray(data?.content)
              ? data.content
              : Array.isArray(data)
                ? data
                : []
        const numbers = items.map((r: any) => {
          const n = parseInt(String(r.code ?? ''), 10)
          return Number.isNaN(n) ? Number(r.id ?? 0) : n
        })
        const maxNum = numbers.length ? Math.max(...numbers) : 0
        return String(maxNum + 1)
      } catch {
        const numbers = rows.map(r => {
          const n = parseInt(r.code, 10)
          return Number.isNaN(n) ? r.id : n
        })
        const maxNum = numbers.length ? Math.max(...numbers) : 0
        return String(maxNum + 1)
      }
    }

    if (edit.id) {
      const res = await fetch('/api/system/rooms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: edit.id, ...payload })
      })
      if (res.ok) {
        await refetchRooms()
        setFlash({ type: 'success', text: 'Đã cập nhật phòng.' })
        handleCloseEdit()
      } else {
        const err = await res.json().catch(() => ({}))
        const msg = (err && (err.error || err.message)) || 'Có lỗi xảy ra khi cập nhật.'
        setCodeError(msg)
      }
    } else {
      const res = await fetch('/api/system/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        await refetchRooms()
        setFlash({ type: 'success', text: 'Đã tạo phòng mới.' })
        handleCloseEdit()
      } else {
        const status = res.status
        const err = await res.json().catch(() => ({}))
        const rawMsg = (err && (err.error || err.message)) || ''
        if (status === 409 || /(exist|duplicate|already|đã tồn tại|trùng)/i.test(rawMsg)) {
          const next = await suggestNextCode()
          setEdit(prev => ({ ...prev, code: next }))
          setCodeError(`Mã (code) đã tồn tại. Đã tự động đặt thành ${next}.`)
        } else {
          setCodeError(rawMsg || 'Có lỗi xảy ra khi tạo phòng.')
        }
      }
    }
  }

  function confirmDelete(id: number) {
    setConfirmOpen({ open: true, id })
  }

  async function doDelete() {
    if (!confirmOpen.id) return
    await fetch(`/api/system/rooms?id=${confirmOpen.id}`, { method: 'DELETE' })
    await refetchRooms()
    setConfirmOpen({ open: false })
    setFlash({ type: 'success', text: 'Đã xóa phòng.' })
  }


  function renderStatusChip(s: RoomStatus) {
    if (s === 'AVAILABLE') return <Badge tone="available">{statusLabels[s]}</Badge>
    if (s === 'OCCUPIED') return <Badge tone="occupied">{statusLabels[s]}</Badge>
    if (s === 'MAINTENANCE') return <Badge tone="maintenance">{statusLabels[s]}</Badge>
    if (s === 'CLEANING') return <Badge tone="info">{statusLabels[s]}</Badge>
    return <Badge tone="muted">{statusLabels[s]}</Badge>
  }

  const getRoomTypeName = (roomTypeId: number) => {
    if (!roomTypeId) return 'Chưa xác định'
    const roomType = roomTypes.find(rt => Number(rt.id) === Number(roomTypeId))
    if (roomType && roomType.name && roomType.name.trim() !== '') {
      return roomType.name
    }
    return `Type ${roomTypeId}`
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Quản lý phòng</h1>
            <p className="text-xs text-gray-500">{filtered.length} phòng</p>
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

      {/* Success Messages */}
      {flash && flash.type === 'success' && (
        <div className={`px-3 sm:px-4 lg:px-6 py-2 bg-green-50 text-green-800`}>
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
                <option value="roomTypeId">Theo Dãy Tòa</option>
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
              <option value="roomTypeId">Theo Dãy Tòa</option>
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
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 text-gray-700">
                    <th className="px-4 py-3 text-center font-semibold">Code</th>
                    <th className="px-4 py-3 text-center font-semibold">Tên phòng</th>
                    <th className="px-4 py-3 text-center font-semibold">Dãy Tòa</th>
                    <th className="px-4 py-3 text-center font-semibold">Tầng</th>
                    <th className="px-4 py-3 text-center font-semibold">Trạng thái phòng</th>
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
                    <Button
                      variant="danger"
                      className="h-10 text-sm font-medium"
                      onClick={() => confirmDelete(row.id)}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Xóa
                    </Button>
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

                  {/* Dãy Tòa */}
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Dãy Tòa</span>
                    </div>
                    <p className="text-base sm:text-lg font-bold text-blue-900 break-words leading-relaxed">{getRoomTypeName(selected.roomTypeId)}</p>
                  </div>
                </div>
              </div>

              {selected.description && (
                <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-gray-200">
                  <div className="text-xs sm:text-sm font-semibold text-gray-500 mb-1">Mô tả</div>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{selected.description}</p>
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
      <Modal open={editOpen} onClose={handleCloseEdit} title={edit.id ? 'Sửa phòng' : 'Thêm phòng mới'}>
        <div className="p-4 sm:p-6">
          <div className="space-y-4" key={edit.id || 'new'}>
            {/* Form */}
            <div className="space-y-3">
              {/* Code và Tên phòng */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <Input
                    key={`code-${edit.id || 'new'}`}
                    value={edit.code}
                    onChange={(e) => { setEdit({ ...edit, code: e.target.value }); setCodeError(null); }}
                    placeholder="Nhập code phòng"
                    className={`w-full ${codeError ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {codeError && (
                    <div className="mt-1 text-xs text-red-600">{codeError}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên phòng</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dãy Tòa *</label>
                  <select
                    key={`roomTypeId-${edit.id || 'new'}`}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái *</label>
                <select
                  key={`status-${edit.id || 'new'}`}
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
                  key={`description-${edit.id || 'new'}`}
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
                onClick={handleCloseEdit}
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