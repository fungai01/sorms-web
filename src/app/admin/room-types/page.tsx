"use client";

import { useEffect, useMemo, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { type RoomType } from "@/lib/types";
import { useRoomTypes } from '@/hooks/useApi'
import { apiClient } from '@/lib/api-client'

export default function RoomTypesPage() {
  const [rows, setRows] = useState<RoomType[]>([])
  const { data: roomTypesData, refetch: refetchRoomTypes } = useRoomTypes()
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<'code' | 'name' | 'maxOccupancy'>('code')
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const [flash, setFlash] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<RoomType | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<{ id?: number, code: string, name: string, basePrice: number, maxOccupancy: number, description: string }>({ code: "", name: "", basePrice: 0, maxOccupancy: 1, description: "" })
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
    if (roomTypesData) setRows(roomTypesData as RoomType[])
  }, [roomTypesData])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? rows.filter(r => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q))
      : rows
    const dir = sortOrder === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (sortKey === 'code') return a.code.localeCompare(b.code) * dir
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir
      if (sortKey === 'maxOccupancy') return (a.maxOccupancy - b.maxOccupancy) * dir
      return 0
    })
  }, [rows, query, sortKey, sortOrder])

  function openCreate() {
    // Tính mã tiếp theo: ưu tiên parse từ code nếu là số, nếu không dùng id
    const numbers = rows.map(r => {
      const n = parseInt(r.code, 10)
      return Number.isNaN(n) ? r.id : n
    })
    const maxNum = numbers.length ? Math.max(...numbers) : 0
    const nextCode = String(maxNum + 1)
    setEdit({ code: nextCode, name: "", basePrice: 0, maxOccupancy: 1, description: "" })
    setEditOpen(true)
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
    setEditOpen(true)
  }

  async function save() {
    if (!edit.code.trim() || !edit.name.trim()) {
      setFlash({ type: 'error', text: 'Vui lòng nhập Code và Tên loại phòng.' })
      return
    }
    if (edit.basePrice < 0) {
      setFlash({ type: 'error', text: 'Giá cơ bản không được âm.' })
      return
    }
    if (edit.maxOccupancy < 1) {
      setFlash({ type: 'error', text: 'Số người tối đa phải lớn hơn 0.' })
      return
    }
    const payload = {
      code: edit.code.trim(),
      name: edit.name.trim(),
      basePrice: edit.basePrice,
      maxOccupancy: edit.maxOccupancy,
      description: edit.description.trim() || "",
    }
    if (edit.id) {
      const response = await fetch('/api/system/room-types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: edit.id, ...payload })
      })
      if (response.ok) {
        await refetchRoomTypes()
        setFlash({ type: 'success', text: 'Đã cập nhật loại phòng.' })
      } else {
        const errorData = await response.json()
        setFlash({ type: 'error', text: errorData.error || 'Có lỗi xảy ra khi cập nhật.' })
      }
    } else {
      const response = await fetch('/api/system/room-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (response.ok) {
        await refetchRoomTypes()
        setFlash({ type: 'success', text: 'Đã tạo loại phòng mới.' })
      } else {
        const errorData = await response.json()
        setFlash({ type: 'error', text: errorData.error || 'Có lỗi xảy ra khi tạo mới.' })
      }
    }
    setEditOpen(false)
  }

  function confirmDelete(id: number) {
    setConfirmOpen({ open: true, id })
  }

  async function doDelete() {
    if (!confirmOpen.id) return
    const response = await fetch(`/api/system/room-types?id=${confirmOpen.id}`, { method: 'DELETE' })
    if (response.ok) {
      await refetchRoomTypes()
      setFlash({ type: 'success', text: 'Đã vô hiệu hóa loại phòng.' })
    } else {
      const errorData = await response.json()
      setFlash({ type: 'error', text: errorData.error || 'Có lỗi xảy ra khi vô hiệu hóa.' })
    }
    setConfirmOpen({ open: false })
  }

  async function activateRoomType(id: number) {
    try {
      const resp = await fetch(`/api/system/room-types/${id}/activate`, { method: 'PUT' })
      if (!resp.ok) throw new Error('Kích hoạt loại phòng thất bại')
      setFlash({ type: 'success', text: 'Đã kích hoạt loại phòng thành công.' })
      await refetchRoomTypes()
    } catch (e) {
      setFlash({ type: 'error', text: e instanceof Error ? e.message : 'Có lỗi xảy ra' })
    }
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-gray-900 truncate">Loại phòng</h1>
              <p className="text-xs text-gray-500">{filtered.length} loại phòng</p>
            </div>
          </div>
          <Button 
            onClick={openCreate} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm flex-shrink-0"
          >
            <svg className="w-4 h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="hidden sm:inline">Thêm loại phòng</span>
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
                    onChange={(e) =>
                      setSortKey(e.target.value as "code" | "name" | "maxOccupancy")
                    }
                    className="w-full px-2 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="code">Code</option>
                    <option value="name">Tên</option>
                    <option value="maxOccupancy">Số người</option>
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
                    placeholder="Tìm kiếm loại phòng..."
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
                  onChange={(e) => setSortKey(e.target.value as 'code' | 'name' | 'maxOccupancy')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="code">Theo Code</option>
                  <option value="name">Theo Tên</option>
                  <option value="maxOccupancy">Theo Số người</option>
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
  <div className="grid grid-cols-2 items-center">
    {/* Cột trái */}
    <h2 className="text-lg font-bold text-gray-900 text-left">
      Danh sách loại phòng
    </h2>

    {/* Cột phải */}
    <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full text-right justify-self-end">
      {filtered.length} loại phòng
    </span>
  </div>
</CardHeader>


                <CardBody className="p-0">
                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <colgroup>
                        <col className="w-[5%]" />
                        <col className="w-[10%]" />
                        <col className="w-[10%]" />
                        <col className="w-[5%]" />
                        <col className="w-[15%]" />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-50 text-gray-700">
                          <th className="px-4 py-3 text-center font-semibold">Code</th>
                          <th className="px-4 py-3 text-center font-semibold">Tên loại phòng</th>
                          <th className="px-4 py-3 text-center font-semibold">Giá cơ bản</th>
                          <th className="px-4 py-3 text-center font-semibold">Số người</th>
                          <th className="px-4 py-3 text-center font-semibold">Trạng thái</th>
                          <th className="px-4 py-3 text-center font-semibold">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice((page - 1) * size, page * size).map((row) => (
                          <tr key={row.id} className="hover:bg-gray-50 border-b border-gray-100">
                            <td className="px-4 py-3 text-center font-medium text-gray-900">{row.code}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.name}</td>
                            <td className="px-4 py-3 text-center">
                              {row.basePrice === 0 ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Miễn phí
                                </span>
                              ) : (
                                <span className="text-gray-700">{row.basePrice.toLocaleString('vi-VN')} VND</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.maxOccupancy}</td>
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
                                    onClick={() => activateRoomType(row.id)}
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

                  {/* Mobile Cards - Booking Style */}
                  <div className="lg:hidden p-4">
                    <div className="grid grid-cols-1 gap-4">
                      {filtered.slice((page - 1) * size, page * size).map((row) => (
                        <div
                          key={row.id}
                          className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden"
                        >
                          {/* Header với gradient */}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-blue-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                                  <span className="text-white font-bold text-sm">
                                    {row.code.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <h3 className="text-lg font-bold text-gray-900">{row.code}</h3>
                                  <p className="text-sm text-gray-600">{row.name}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Thông tin chính */}
                          <div className="p-4 space-y-3">
                            {/* Giá và số người */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                                <div>
                                  <div className="text-xs text-gray-500">Giá</div>
                                  <div className="text-sm font-semibold text-gray-900">
                                    {row.basePrice === 0 ? 'Miễn phí' : `${row.basePrice.toLocaleString('vi-VN')} VND`}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <div>
                                  <div className="text-xs text-gray-500">Số người</div>
                                  <div className="text-sm font-semibold text-gray-900">{row.maxOccupancy}</div>
                                </div>
                              </div>
                            </div>

                            {/* Mô tả nếu có */}
                            {row.description && (
                              <div className="bg-gray-50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span className="text-sm font-medium text-gray-700">Mô tả</span>
                                </div>
                                <p className="text-sm text-gray-600">{row.description}</p>
                              </div>
                            )}
                          </div>

                          {/* Nút thao tác - Mobile Fixed */}
                          <div className="px-3 py-3 bg-gray-50 border-t border-gray-100">
                            <div className="grid grid-cols-3 gap-2">
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
                                onClick={() => openEdit(row)}
                              >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Sửa
                              </Button>

                              {row.isActive !== false ? (
                                <Button
                                  variant="danger"
                                  className="h-10 text-xs font-medium px-2"
                                  onClick={() => confirmDelete(row.id)}
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                  </svg>
                                  Vô hiệu
                                </Button>
                              ) : (
                                <Button
                                  className="h-10 text-xs font-medium px-2 bg-green-600 hover:bg-green-700"
                                  onClick={() => activateRoomType(row.id)}
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Kích hoạt
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </CardBody>

                {/* Pagination - Mobile Optimized */}
                {filtered.length > size && (
                  <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-3 py-4 border-t border-gray-200/50">
                    {/* Mobile Layout */}
                    <div className="lg:hidden">
                      <div className="text-center mb-4">
                        <div className="text-sm text-gray-600 mb-1">Hiển thị kết quả</div>
                        <div className="text-lg font-bold text-gray-900">
                          <span className="text-blue-600">{(page - 1) * size + 1}</span> - <span className="text-blue-600">{Math.min(page * size, filtered.length)}</span> / <span className="text-gray-600">{filtered.length}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-3">
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
                          <span className="text-sm font-bold text-gray-700 bg-white px-3 py-2 rounded-xl border-2 border-blue-200 shadow-sm">
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

                    {/* Desktop Layout */}
                    <div className="hidden lg:flex flex-row items-center justify-between gap-4 sm:gap-6">
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
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết loại phòng">
        <div className="p-4 sm:p-6">
          {selected && (
            <div className="space-y-6">
              {/* Header với thông tin chính */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 border border-blue-200">
                {/* Thông tin loại phòng chính */}
                <div className="space-y-4">
                  {/* Header với icon */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Loại {selected.code}</h2>
                        <p className="text-base sm:text-lg lg:text-xl text-gray-600 truncate">{selected.name}</p>
                      </div>
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Số người</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-blue-900">{selected.maxOccupancy}</p>
                    </div>
                  </div>

                  {/* Giá cơ bản */}
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Giá cơ bản</span>
                    </div>
                    <p className="text-base sm:text-lg font-bold text-blue-900">
                      {selected.basePrice === 0 ? 'Miễn phí' : `${selected.basePrice.toLocaleString('vi-VN')} VND`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={edit.id ? 'Sửa loại phòng' : 'Thêm loại phòng mới'}>
        <div className="p-4 sm:p-6">
          <div className="space-y-4">
            {/* Form */}
            <div className="space-y-3">
              {/* Code và Tên loại phòng */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <Input
                    value={edit.code}
                    onChange={(e) => setEdit({ ...edit, code: e.target.value })}
                    placeholder="Nhập code loại phòng"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên loại phòng *</label>
                  <Input
                    value={edit.name}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                    placeholder="Nhập tên loại phòng"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Giá cơ bản và Số người */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giá cơ bản *</label>
                  <Input
                    type="number"
                    min="0"
                    value={edit.basePrice}
                    onChange={(e) => setEdit({ ...edit, basePrice: Number(e.target.value) })}
                    placeholder="Giá cơ bản (0 = miễn phí)"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số người tối đa *</label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={edit.maxOccupancy}
                    onChange={(e) => setEdit({ ...edit, maxOccupancy: Number(e.target.value) })}
                    placeholder="Số người tối đa"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Mô tả - chỉ hiển thị trên desktop */}
              <div className="hidden sm:block">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea
                  value={edit.description}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                  placeholder="Nhập mô tả loại phòng"
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
            Bạn có chắc muốn vô hiệu hóa loại phòng này? Loại phòng sẽ không bị xóa hoàn toàn và có thể được kích hoạt lại sau.
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
  );
}