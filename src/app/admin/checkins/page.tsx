"use client";

import { useEffect, useMemo, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { useCheckins } from '@/hooks/useApi'
import { apiClient } from '@/lib/api-client'

type CheckinStatus = 'PENDING' | 'CHECKED_IN' | 'CHECKED_OUT'

type Checkin = {
  id: number
  booking_code: string
  user_name: string
  room_code: string
  face_ref?: string
  checkin_at: string
  checkout_at?: string
  status: CheckinStatus
}

// Removed mock data; always use API

export default function CheckinsPage() {
  const [rows, setRows] = useState<Checkin[]>([])
  const { data: checkinsData, loading: checkinsLoading, error: checkinsError, refetch: refetchCheckins } = useCheckins()
  const [flash, setFlash] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [query, setQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [filterStatus, setFilterStatus] = useState<'ALL' | CheckinStatus>('ALL')
  const [sortKey, setSortKey] = useState<'id' | 'checkin' | 'checkout'>("checkin")
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>("desc")
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<Checkin | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<{ id?: number, booking_code: string, user_name: string, room_code: string, checkin_at: string, checkout_at: string, face_ref: string, status: CheckinStatus }>({ booking_code: '', user_name: '', room_code: '', checkin_at: '', checkout_at: '', face_ref: '', status: 'PENDING' })
  const [touched, setTouched] = useState<{ booking_code: boolean, user_name: boolean, room_code: boolean, checkin_at: boolean }>({ booking_code: false, user_name: false, room_code: false, checkin_at: false })
  const [confirmOpen, setConfirmOpen] = useState<{ open: boolean, id?: number, type?: 'checkin' | 'checkout' | 'delete' }>({ open: false })

  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 3000); return () => clearTimeout(t) }, [flash])

  // Sync data from API
  useEffect(() => {
    if (checkinsLoading) {
      return
    }
    if (checkinsError) {
      setRows([])
      return
    }
    if (checkinsData && Array.isArray(checkinsData)) {
      setRows(checkinsData as Checkin[])
    } else {
      setRows([])
    }
  }, [checkinsData, checkinsLoading, checkinsError])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = rows.filter(r =>
      r.booking_code.toLowerCase().includes(q) ||
      r.user_name.toLowerCase().includes(q) ||
      r.room_code.toLowerCase().includes(q)
    )
    if (filterStatus !== 'ALL') list = list.filter(r => r.status === filterStatus)
    if (dateFrom) list = list.filter(r => r.checkin_at >= dateFrom)
    if (dateTo) list = list.filter(r => r.checkout_at ? r.checkout_at <= dateTo : false)
    const dir = sortOrder === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (sortKey === 'id') return (a.id - b.id) * dir
      if (sortKey === 'checkin') return a.checkin_at.localeCompare(b.checkin_at) * dir
      return (a.checkout_at || '').localeCompare(b.checkout_at || '') * dir
    })
  }, [rows, query, filterStatus, dateFrom, dateTo, sortKey, sortOrder])

  function openCreate() {
    setEdit({ booking_code: '', user_name: '', room_code: '', checkin_at: '', checkout_at: '', face_ref: '', status: 'PENDING' })
    setTouched({ booking_code: false, user_name: false, room_code: false, checkin_at: false })
    setEditOpen(true)
  }

  function openEditRow(r: Checkin) {
    setEdit({ id: r.id, booking_code: r.booking_code, user_name: r.user_name, room_code: r.room_code, checkin_at: r.checkin_at.slice(0,16), checkout_at: r.checkout_at ? r.checkout_at.slice(0,16) : '', face_ref: r.face_ref || '', status: r.status })
    setTouched({ booking_code: false, user_name: false, room_code: false, checkin_at: false })
    setEditOpen(true)
  }

  async function save() {
    if (!edit.booking_code.trim() || !edit.user_name.trim() || !edit.room_code.trim() || !edit.checkin_at) {
      setFlash({ type: 'error', text: 'Vui lòng nhập đủ Booking, Khách, Phòng và thời gian check‑in.' })
      return
    }
    
    const payload: Checkin = {
      id: edit.id ?? (rows.length ? Math.max(...rows.map(r => r.id)) + 1 : 1),
      booking_code: edit.booking_code.trim(),
      user_name: edit.user_name.trim(),
      room_code: edit.room_code.trim(),
      checkin_at: edit.checkin_at,
      checkout_at: edit.checkout_at || undefined,
      face_ref: edit.face_ref || undefined,
      status: edit.status,
    }

    try {
      if (edit.id) {
        const response = await apiClient.updateCheckin(edit.id, payload)
        if (!response.success) {
          setFlash({ type: 'error', text: response.error || 'Có lỗi xảy ra khi cập nhật.' })
          return
        }
        await refetchCheckins()
        setFlash({ type: 'success', text: 'Đã cập nhật check-in.' })
      } else {
        const response = await apiClient.createCheckin(payload)
        if (!response.success) {
          setFlash({ type: 'error', text: response.error || 'Có lỗi xảy ra khi tạo mới.' })
          return
        }
        await refetchCheckins()
        setFlash({ type: 'success', text: 'Đã tạo check-in mới.' })
      }
    } catch (error) {
      setFlash({ type: 'error', text: 'Có lỗi xảy ra khi lưu check-in. Vui lòng thử lại.' })
      return
    }
    
    setEditOpen(false)
  }

  function confirmDelete(id: number) { setConfirmOpen({ open: true, id }) }
  async function doDelete() {
    if (!confirmOpen.id) return
    
    try {
      const response = await apiClient.deleteCheckin(confirmOpen.id)
      if (!response.success) {
        setFlash({ type: 'error', text: response.error || 'Có lỗi xảy ra khi xóa.' })
        return
      }
      await refetchCheckins()
      setFlash({ type: 'success', text: 'Đã xóa check-in.' })
    } catch (error) {
      setFlash({ type: 'error', text: 'Có lỗi xảy ra khi xóa check-in. Vui lòng thử lại.' })
      return
    }
    
    setConfirmOpen({ open: false })
  }

  function renderStatusChip(s: CheckinStatus) {
    if (s === 'PENDING') return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Chờ xử lý</span>
    if (s === 'CHECKED_IN') return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Đã check-in</span>
    return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Đã check-out</span>
  }

  return (
    <>
      <style jsx global>{`
   /* Style cho date và time inputs */
   input[type="date"], input[type="time"] {
     width: 100%;
     position: relative;
     box-sizing: border-box;
   }

   /* Đảm bảo modal hoạt động tốt trên mobile */
   .modal-content {
     position: relative;
     z-index: 9999;
   }

   /* Modal content có thể scroll khi cần */
   .modal-content > div {
     overflow-y: auto;
     max-height: 90vh;
   }

   /* Đảm bảo scroll mượt mà trên mobile */
   body {
     overflow-x: hidden;
   }









   /* Responsive trên mobile */
   @media (max-width: 768px) {
     input[type="date"], input[type="time"] {
       font-size: 14px;
     }
   }

   @media (max-width: 480px) {
     input[type="date"], input[type="time"] {
       font-size: 13px;
     }
   }
`}</style>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-gray-900 truncate">Check-in</h1>
              <p className="text-xs text-gray-500">{filtered.length} check-in</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={openCreate} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm flex-shrink-0"
            >
              <svg className="w-4 h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="hidden sm:inline">Thêm check-in</span>
              <span className="sm:hidden">Thêm</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="space-y-3">
        {flash && (
          <div className={`rounded-md border p-2 sm:p-3 text-xs sm:text-sm shadow-sm ${flash.type==='success' ? 'bg-green-50 border-blue-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {flash.text}
          </div>
        )}

        {/* Loading indicator */}
        {checkinsLoading && (
          <div className="rounded-md border p-2 sm:p-3 text-xs sm:text-sm shadow-sm bg-yellow-50 border-yellow-200 text-yellow-800">
            Đang tải dữ liệu check-in...
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
                <div className="flex-1">
            <select 
              value={sortKey} 
                    onChange={(e) => setSortKey(e.target.value as 'id' | 'checkin' | 'checkout')}
                    className="w-full px-2 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="checkin">Check-in</option>
              <option value="checkout">Check-out</option>
              <option value="id">ID</option>
            </select>
          </div>
                <div className="w-32 flex-shrink-0">
            <select 
              value={sortOrder} 
                    onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
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
                    placeholder="Tìm kiếm check-in..."
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
                  onChange={(e) => setSortKey(e.target.value as 'id' | 'checkin' | 'checkout')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="checkin">Theo Check-in</option>
                  <option value="checkout">Theo Check-out</option>
                  <option value="id">Theo ID</option>
                </select>
        </div>

              {/* Thứ tự */}
              <div className="w-28 flex-shrink-0">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
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
          <Card className="bg-white border border-gray-200 shadow-lg rounded-xl overflow-hidden">
            <CardHeader className="bg-gray-50 border-b border-gray-200 px-6 py-3">
            <div className="grid grid-cols-2 items-center">
            <h2 className="text-lg font-bold text-gray-900 text-left break-words whitespace-normal">Danh sách check-in</h2>
             <div className="text-right">
    <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full whitespace-nowrap">
      {filtered.length} check-in
    </span>
  </div>
</div>
        </CardHeader>
        <CardBody className="p-0">
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
            <colgroup>
                    <col className="w-[8%]" />
                    <col className="w-[12%]" />
                    <col className="w-[18%]" />
              <col className="w-[12%]" />
                    <col className="w-[18%]" />
                    <col className="w-[18%]" />
                    <col className="w-[14%]" />
            </colgroup>
            <thead>
                    <tr className="bg-gray-50 text-gray-700">
                      <th className="px-4 py-3 text-center font-semibold">ID</th>
                      <th className="px-4 py-3 text-center font-semibold">Booking</th>
                      <th className="px-4 py-3 text-center font-semibold">Khách</th>
                      <th className="px-4 py-3 text-center font-semibold">Phòng</th>
                      <th className="px-4 py-3 text-center font-semibold">Check-in</th>
                      <th className="px-4 py-3 text-center font-semibold">Check-out</th>
                      <th className="px-4 py-3 text-center font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm">Không có dữ liệu</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.slice((page - 1) * size, (page - 1) * size + size).map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50 border-b border-gray-100">
                        <td className="px-4 py-3 text-center font-medium text-gray-900">{r.id}</td>
                        <td className="px-4 py-3 text-center">
                          <span 
                            role="button" 
                            tabIndex={0} 
                            className="cursor-pointer underline underline-offset-2 text-blue-600 hover:text-blue-700 text-sm font-medium" 
                            onClick={() => { setSelected(r); setDetailOpen(true); }}
                          >
                            {r.booking_code}
                          </span>
                  </td>
                        <td className="px-4 py-3 text-center text-gray-700" title={r.user_name}>{r.user_name}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{r.room_code}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{r.checkin_at.replace('T',' ')}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{r.checkout_at ? r.checkout_at.replace('T',' ') : '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <Button 
                              variant="secondary" 
                              className="h-9 px-3 text-xs font-medium flex items-center gap-1.5 hover:bg-blue-50 hover:border-blue-200"
                              onClick={() => {
                                setSelected(r);
                                setDetailOpen(true);
                              }}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              Xem
                            </Button>
                            <Button 
                              variant="secondary" 
                              className="h-9 px-3 text-xs font-medium flex items-center gap-1.5 hover:bg-green-50 hover:border-green-200"
                              onClick={() => openEditRow(r)}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Sửa
                            </Button>
                            <Button 
                              variant="danger" 
                              className="h-9 px-3 text-xs font-medium flex items-center gap-1.5 hover:bg-red-50"
                              onClick={() => confirmDelete(r.id)}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Xóa
                            </Button>
                    </div>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
          </div>

              {/* Mobile Cards - Booking Style */}
              <div className="lg:hidden p-4">
                <div className="grid grid-cols-1 gap-4">
                  {filtered.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">Không có dữ liệu</h3>
                            <p className="text-sm text-gray-500">Kiểm tra kết nối API hoặc thử lại sau</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    filtered.slice((page - 1) * size, (page - 1) * size + size).map((r, index) => (
                    <div
                      key={r.id}
                      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md overflow-hidden"
                    >
                      {/* Header */}
                      <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                              <span className="text-white font-bold text-sm">
                                {r.booking_code.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">{r.booking_code}</h3>
                              <div className="flex items-center gap-2">
                                {renderStatusChip(r.status)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Thông tin chính */}
                      <div className="p-4 space-y-3">
                        {/* Thông tin khách và phòng */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <div>
                              <div className="text-xs text-gray-500">Khách</div>
                              <div className="text-sm font-semibold text-gray-900">{r.user_name}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <div>
                              <div className="text-xs text-gray-500">Phòng</div>
                              <div className="text-sm font-semibold text-gray-900">{r.room_code}</div>
                            </div>
                          </div>
                        </div>

                        {/* Thời gian */}
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">Thời gian</span>
                          </div>
                          <div className="space-y-1">
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Check-in:</span> {r.checkin_at.replace('T',' ')}
                            </div>
                            {r.checkout_at && (
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Check-out:</span> {r.checkout_at.replace('T',' ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Nút thao tác - Mobile Fixed */}
                      <div className="px-3 py-3 bg-gray-50 border-t border-gray-100">
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            variant="secondary"
                            className="h-10 text-xs font-medium px-2"
                            onClick={() => {
                              setSelected(r);
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
                            onClick={() => openEditRow(r)}
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Sửa
                          </Button>

                          <Button
                            variant="danger"
                            className="h-10 text-xs font-medium px-2"
                            onClick={() => confirmDelete(r.id)}
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Xóa
                          </Button>
                        </div>
                      </div>
                    </div>
                    ))
                  )}
                </div>
              </div>
        </CardBody>

                {/* Pagination - Mobile Optimized */}
                {filtered.length > size && (
                  <div className="bg-gray-50 px-3 py-4 border-t border-gray-200">
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

      {/* Modal chi tiết */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết check-in">
        <div className="p-4 sm:p-6">
          {selected && (
            <div className="space-y-6">
              {/* Header với thông tin chính */}
              <div className="bg-blue-50 rounded-xl p-4 sm:p-6 border border-blue-200">
                {/* Thông tin check-in chính */}
                <div className="space-y-4">
                  {/* Header với icon */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900"> {selected.booking_code}</h2>
                        <p className="text-base sm:text-lg lg:text-xl text-gray-600 truncate">{selected.user_name}</p>
                      </div>
                    </div>
                  </div>

                  {/* Thông tin nhanh */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-white rounded-lg p-3 sm:p-4 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">ID</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-blue-900">{selected.id}</p>
                    </div>

                    <div className="bg-white rounded-lg p-3 sm:p-4 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Phòng</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-blue-900">{selected.room_code}</p>
                    </div>
                  </div>

                  {/* Thời gian check-in/out */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-white rounded-lg p-3 sm:p-4 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Check-in</span>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-blue-900">{selected.checkin_at.replace('T',' ')}</p>
                    </div>

                    <div className="bg-white rounded-lg p-3 sm:p-4 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Check-out</span>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-blue-900">
                        {selected.checkout_at ? selected.checkout_at.replace('T',' ') : 'Chưa check-out'}
                      </p>
                    </div>
                  </div>

                  {/* Face ref nếu có */}
                  {selected.face_ref && (
                    <div className="bg-white rounded-lg p-3 sm:p-4 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Face Reference</span>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-blue-900">{selected.face_ref}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          </div>
      </Modal>

      {/* Modal tạo/sửa */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={edit.id ? 'Sửa check-in' : 'Tạo check-in'}
      >
        <div className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto max-w-[95vw] sm:max-w-[90vw] lg:max-w-[80vw] xl:max-w-[70vw] mx-auto">
          <div className="space-y-6">
            {/* Header với icon */}
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {edit.id ? 'Chỉnh sửa thông tin check-in' : 'Tạo check-in mới'}
                </h3>
                <p className="text-sm text-gray-500">
                  {edit.id ? 'Cập nhật thông tin check-in hiện tại' : 'Nhập thông tin để tạo check-in mới'}
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-6">
              {/* Thông tin cơ bản */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Thông tin cơ bản
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Booking Code <span className="text-red-500">*</span>
                    </label>
                    <Input 
                      value={edit.booking_code} 
                      onChange={(e) => setEdit((f) => ({ ...f, booking_code: e.target.value }))}
                      onBlur={() => setTouched(t => ({ ...t, booking_code: true }))}
                      placeholder="VD: BK-0001"
                      className={`w-full ${touched.booking_code && !edit.booking_code.trim() ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                    />
                    {touched.booking_code && !edit.booking_code.trim() && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Booking Code là bắt buộc
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Tên khách <span className="text-red-500">*</span>
                    </label>
                    <Input 
                      value={edit.user_name} 
                      onChange={(e) => setEdit((f) => ({ ...f, user_name: e.target.value }))}
                      onBlur={() => setTouched(t => ({ ...t, user_name: true }))}
                      placeholder="VD: Nguyễn Văn A"
                      className={`w-full ${touched.user_name && !edit.user_name.trim() ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                    />
                    {touched.user_name && !edit.user_name.trim() && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Tên khách là bắt buộc
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Mã phòng <span className="text-red-500">*</span>
                    </label>
                    <Input 
                      value={edit.room_code} 
                      onChange={(e) => setEdit((f) => ({ ...f, room_code: e.target.value }))}
                      onBlur={() => setTouched(t => ({ ...t, room_code: true }))}
                      placeholder="VD: A101"
                      className={`w-full ${touched.room_code && !edit.room_code.trim() ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                    />
                    {touched.room_code && !edit.room_code.trim() && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Mã phòng là bắt buộc
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Face Reference
                      <span className="text-xs text-gray-500 ml-1">(Tùy chọn)</span>
                    </label>
                    <Input 
                      value={edit.face_ref} 
                      onChange={(e) => setEdit((f) => ({ ...f, face_ref: e.target.value }))}
                      placeholder="Nhập face reference"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Thời gian */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Thời gian check-in/out
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Ngày check-in <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Input 
                        type="date" 
                        value={edit.checkin_at ? edit.checkin_at.split('T')[0] : ''} 
                        onChange={(e) => {
                          const date = e.target.value
                          const time = edit.checkin_at ? edit.checkin_at.split('T')[1] : '09:00'
                          setEdit((f) => ({ ...f, checkin_at: date ? `${date}T${time}` : '' }))
                        }}
                        onBlur={() => setTouched(t => ({ ...t, checkin_at: true }))}
                        className={`w-full ${touched.checkin_at && !edit.checkin_at ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                      />
                    </div>
                    {touched.checkin_at && !edit.checkin_at && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Ngày check-in là bắt buộc
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Giờ check-in <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Input 
                        type="time" 
                        value={edit.checkin_at ? edit.checkin_at.split('T')[1] : ''} 
                        onChange={(e) => {
                          const time = e.target.value
                          const date = edit.checkin_at ? edit.checkin_at.split('T')[0] : ''
                          setEdit((f) => ({ ...f, checkin_at: date ? `${date}T${time}` : '' }))
                        }}
                        onBlur={() => setTouched(t => ({ ...t, checkin_at: true }))}
                        className={`w-full ${touched.checkin_at && !edit.checkin_at ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                      />
                    </div>
                    {touched.checkin_at && !edit.checkin_at && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Giờ check-in là bắt buộc
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Ngày check-out
                      <span className="text-xs text-gray-500 ml-1">(Tùy chọn)</span>
                    </label>
                    <div className="relative">
                      <Input 
                        type="date" 
                        value={edit.checkout_at ? edit.checkout_at.split('T')[0] : ''} 
                        onChange={(e) => {
                          const date = e.target.value
                          const time = edit.checkout_at ? edit.checkout_at.split('T')[1] : '12:00'
                          setEdit((f) => ({ ...f, checkout_at: date ? `${date}T${time}` : '' }))
                        }}
                        className="w-full"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Giờ check-out
                      <span className="text-xs text-gray-500 ml-1">(Tùy chọn)</span>
                    </label>
                    <div className="relative">
                      <Input 
                        type="time" 
                        value={edit.checkout_at ? edit.checkout_at.split('T')[1] : ''} 
                        onChange={(e) => {
                          const time = e.target.value
                          const date = edit.checkout_at ? edit.checkout_at.split('T')[0] : ''
                          setEdit((f) => ({ ...f, checkout_at: date ? `${date}T${time}` : '' }))
                        }}
                        className="w-full"
                      />
          </div>
            </div>
      
            </div>
          </div>
            </div>


            {/* Buttons */}
            <div className="flex flex-row gap-3 pt-4 border-t border-gray-200">
              <Button 
                variant="secondary" 
                onClick={() => setEditOpen(false)}
                className="flex-1"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Hủy bỏ
              </Button>
              <Button 
                onClick={save}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {edit.id ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </div>
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
        <div className="text-sm text-gray-700">Bạn có chắc muốn xóa bản ghi check‑in này?</div>
      </Modal>
    </>
  );
}



