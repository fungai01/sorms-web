"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { Table, THead, TBody } from "@/components/ui/Table";
import { type Booking, type BookingStatus, type User } from '@/lib/types'
import { useBookings, useRooms, useRoomsFiltered, useUsers } from '@/hooks/useApi'
import { apiClient } from '@/lib/api-client'
import { formatDate, formatDateTime } from '@/lib/utils'

const statusOptions: BookingStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'CHECKED_IN', 'CHECKED_OUT']

const statusLabels: Record<BookingStatus, string> = {
  "PENDING": "Chờ duyệt",
  "APPROVED": "Đã duyệt",
  "REJECTED": "Đã từ chối",
  "CANCELLED": "Đã hủy",
  "CHECKED_IN": "Đã nhận phòng",
  "CHECKED_OUT": "Đã trả phòng"
}

export default function BookingsPage() {
  const [query, setQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<"ALL" | BookingStatus>("ALL")
  
  // API hooks
  const { data: bookingsData, refetch: refetchBookings, loading: loadingBookings } = useBookings(
    filterStatus !== 'ALL' ? filterStatus : undefined
  )
  
  const bookings = (bookingsData || []) as Booking[]

  // Lấy tất cả phòng (dùng khi sửa)
  const { data: roomsData, refetch: refetchRooms } = useRooms()
  const allRooms = (roomsData || []) as any[]
  
  // Lấy phòng trống (dùng khi tạo mới)
  const { data: availableRoomsData, refetch: refetchAvailableRooms } = useRoomsFiltered('AVAILABLE')
  const availableRooms = (availableRoomsData || []) as any[]

  const { data: usersData } = useUsers({ size: 1000 })
  const users = useMemo(() => {
    if (!usersData) return []
    const raw = usersData as any
    return (Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw?.content) ? raw.content : (Array.isArray(raw) ? raw : []))) as User[]
  }, [usersData])

  const [flash, setFlash] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<Booking | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<{ 
    id?: number, code: string, userId?: number, roomId: number, 
    checkinDate: string, checkoutDate: string, numGuests: number, 
    status: BookingStatus, note: string 
  }>({ 
    code: "", roomId: 0, checkinDate: "", checkoutDate: "", 
    numGuests: 1, status: "PENDING", note: "" 
  })
  
  const [confirmOpen, setConfirmOpen] = useState<{ open: boolean, id?: number }>({ open: false })
  const [codeError, setCodeError] = useState<string | null>(null)
  const [userIdError, setUserIdError] = useState<string | null>(null)
  const [roomIdError, setRoomIdError] = useState<string | null>(null)
  const [checkinDateError, setCheckinDateError] = useState<string | null>(null)
  const [checkoutDateError, setCheckoutDateError] = useState<string | null>(null)
  const [numGuestsError, setNumGuestsError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [noteError, setNoteError] = useState<string | null>(null)
  
  // Searchable dropdown states
  const [userSearch, setUserSearch] = useState("")
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [roomSearch, setRoomSearch] = useState("")
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false)

  // Sử dụng phòng trống khi tạo mới, tất cả phòng khi sửa
  const rooms = useMemo(() => {
    return editOpen && !edit.id ? availableRooms : allRooms
  }, [editOpen, edit.id, availableRooms, allRooms])

  const handleCloseEdit = useCallback(() => {
    setEditOpen(false)
    setEdit({ code: "", userId: undefined, roomId: 0, checkinDate: "", checkoutDate: "", numGuests: 1, status: "PENDING", note: "" })
    setCodeError(null)
    setUserIdError(null)
    setRoomIdError(null)
    setCheckinDateError(null)
    setCheckoutDateError(null)
    setNumGuestsError(null)
    setStatusError(null)
    setNoteError(null)
    setUserSearch("")
    setUserDropdownOpen(false)
    setRoomSearch("")
    setRoomDropdownOpen(false)
  }, [])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 3000)
    return () => clearTimeout(t)
  }, [flash])

  // Helper: Hiển thị tên khách hàng (Tên > Email > #ID)
  const getCustomerDisplay = useCallback((b: any) => {
    if (b.userName) return b.userName
    if (b.userEmail) return b.userEmail
    const user = users.find(u => String(u.id) === String(b.userId))
    if (user) return user.full_name || user.email || `#${b.userId}`
    return b.userId ? `#${b.userId}` : "Chưa xác định"
  }, [users])

  // Filtered users for searchable dropdown
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return users
    return users.filter(u => 
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    )
  }, [users, userSearch])

  // Filtered rooms for searchable dropdown
  const filteredRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase()
    if (!q) return rooms
    return rooms.filter(r => 
      (r.code || "").toLowerCase().includes(q) ||
      (r.name || "").toLowerCase().includes(q)
    )
  }, [rooms, roomSearch])

  // Get display name for selected user
  const getSelectedUserDisplay = useCallback(() => {
    if (!edit.userId) return ""
    const user = users.find(u => u.id === edit.userId)
    return user ? (user.full_name || user.email || `#${user.id}`) : ""
  }, [edit.userId, users])

  // Get display name for selected room - luôn dùng allRooms để đảm bảo tìm thấy phòng khi sửa
  const getSelectedRoomDisplay = useCallback(() => {
    if (!edit.roomId || edit.roomId === 0) return ""
    const room = allRooms.find(r => r.id === edit.roomId)
    return room ? room.code : ""
  }, [edit.roomId, allRooms])

  // Helper: Get room code by ID (for table display) - luôn dùng allRooms
  const getRoomName = useCallback((roomId: number) => {
    const room = allRooms.find(r => r.id === roomId)
    return room ? room.code : `#${roomId}`
  }, [allRooms])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bookings.filter(b => 
      b.code.toLowerCase().includes(q) || 
      getCustomerDisplay(b).toLowerCase().includes(q) ||
      getRoomName(b.roomId).toLowerCase().includes(q)
    ).sort((a, b) => new Date(b.checkinDate).getTime() - new Date(a.checkinDate).getTime())
  }, [bookings, query, getCustomerDisplay, getRoomName])

  const openCreate = async () => {
    setCodeError(null)
    setUserIdError(null)
    setRoomIdError(null)
    setCheckinDateError(null)
    setCheckoutDateError(null)
    setNumGuestsError(null)
    setStatusError(null)
    setNoteError(null)
    setFlash(null)
    setEdit({ 
      code: `BK${Date.now().toString().slice(-6)}`, 
      userId: users[0]?.id || undefined,
      roomId: availableRooms[0]?.id || 0, 
      checkinDate: new Date().toISOString().split('T')[0], 
      checkoutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], 
      numGuests: 1, 
      status: "PENDING", 
      note: "" 
    })
    setEditOpen(true)
  }

  const openEdit = (b: Booking) => {
    setCodeError(null)
    setUserIdError(null)
    setRoomIdError(null)
    setCheckinDateError(null)
    setCheckoutDateError(null)
    setNumGuestsError(null)
    setStatusError(null)
    setNoteError(null)
    setFlash(null)
    
    // Format dates for input type="date"
    const formatDateForInput = (dateStr: string) => {
      if (!dateStr) return ""
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return ""
      return date.toISOString().split('T')[0]
    }
    
    setEdit({ 
      id: b.id, 
      code: b.code, 
      userId: b.userId,
      roomId: b.roomId, 
      checkinDate: formatDateForInput(b.checkinDate), 
      checkoutDate: formatDateForInput(b.checkoutDate), 
      numGuests: b.numGuests, 
      status: b.status, 
      note: b.note || "" 
    })
      setEditOpen(true)
  }

  const save = async () => {
    // Clear previous errors
    setCodeError(null)
    setUserIdError(null)
    setRoomIdError(null)
    setCheckinDateError(null)
    setCheckoutDateError(null)
    setNumGuestsError(null)
    setStatusError(null)
    setNoteError(null)

    // Validate
    if (!edit.code.trim()) {
      setCodeError('Code is required')
      return
    }
    if (!edit.userId) {
      setUserIdError('Vui lòng chọn khách hàng')
      return
    }
    if (!edit.roomId || edit.roomId === 0) {
      setRoomIdError('Vui lòng chọn phòng')
      return
    }
    if (!edit.checkinDate) {
      setCheckinDateError('Ngày check-in là bắt buộc')
      return
    }
    if (!edit.checkoutDate) {
      setCheckoutDateError('Ngày check-out là bắt buộc')
      return
    }
    
    // Validation cho tạo mới: check-in không được là ngày trước ngày hiện tại
    if (!edit.id) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const checkinDate = new Date(edit.checkinDate)
      checkinDate.setHours(0, 0, 0, 0)
      
      if (checkinDate < today) {
        setCheckinDateError('Ngày check-in không được là ngày trước ngày hiện tại')
      return
    }
    
      // Check-out phải lớn hơn ngày hiện tại
      const checkoutDate = new Date(edit.checkoutDate)
      checkoutDate.setHours(0, 0, 0, 0)
      
      if (checkoutDate <= today) {
        setCheckoutDateError('Ngày check-out phải lớn hơn ngày hiện tại')
        return
      }
    }
    
    if (edit.checkinDate && edit.checkoutDate && new Date(edit.checkoutDate) <= new Date(edit.checkinDate)) {
      setCheckoutDateError('Ngày check-out phải sau ngày check-in')
              return
            }
    if (edit.numGuests < 1) {
      setNumGuestsError('Số khách phải lớn hơn 0')
              return
            }

    // Format dates to ISO format for backend
    const formatDateTimeForBackend = (dateStr: string) => {
      if (!dateStr) return ""
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return ""
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}T00:00:00`
    }

    // Khi tạo mới: gửi tất cả fields
    // Khi sửa: chỉ gửi các field có thể sửa (không gửi code, userId, roomId)
    const payload = edit.id ? {
      // Chỉ gửi các field có thể sửa khi update
                  roomId: edit.roomId,
      checkinDate: formatDateTimeForBackend(edit.checkinDate),
      checkoutDate: formatDateTimeForBackend(edit.checkoutDate),
                  numGuests: edit.numGuests,
                  status: edit.status,
      note: edit.note.trim() || "",
    } : {
      // Tạo mới: gửi tất cả fields
          code: edit.code.trim(),
          userId: edit.userId,
                  roomId: edit.roomId,
      checkinDate: formatDateTimeForBackend(edit.checkinDate),
      checkoutDate: formatDateTimeForBackend(edit.checkoutDate),
                  numGuests: edit.numGuests,
          status: edit.status,
      note: edit.note.trim() || "",
    }

    const response = edit.id 
      ? await apiClient.updateBooking(edit.id, payload)
      : await apiClient.createBooking(payload)

    if (response.success) {
      await refetchBookings()
      setFlash({ type: 'success', text: edit.id ? 'Đã cập nhật đặt phòng.' : 'Đã tạo đặt phòng mới.' })
          handleCloseEdit()
      } else {
      const errorMsg = response.error || response.message || ''
      const errorLower = errorMsg.toLowerCase()
      
      // Map error to specific field
      if (/(code|mã)/i.test(errorMsg)) {
        setCodeError(errorMsg)
      } else if (/(user|khách hàng|customer|userId)/i.test(errorMsg)) {
        setUserIdError(errorMsg)
      } else if (/(room|phòng|roomId)/i.test(errorMsg)) {
        setRoomIdError(errorMsg)
      } else if (/(checkin|check-in|ngày nhận)/i.test(errorMsg)) {
        setCheckinDateError(errorMsg)
      } else if (/(checkout|check-out|ngày trả)/i.test(errorMsg)) {
        setCheckoutDateError(errorMsg)
      } else if (/(guest|khách|numGuests|số khách)/i.test(errorMsg)) {
        setNumGuestsError(errorMsg)
      } else if (/(status|trạng thái)/i.test(errorMsg)) {
        setStatusError(errorMsg)
      } else if (/(note|ghi chú)/i.test(errorMsg)) {
        setNoteError(errorMsg)
      } else {
        // Nếu không match field nào, hiển thị ở field đầu tiên có thể (code hoặc userId)
        if (!edit.id) {
          setCodeError(errorMsg)
        } else {
          setCheckinDateError(errorMsg)
        }
      }
    }
  }

  // Approve booking
  const handleApprove = useCallback(async (bookingId: number) => {
    const response = await apiClient.approveBooking(bookingId, undefined, 'Đã duyệt bởi admin')
    if (response.success) {
      await refetchBookings()
      // Refresh danh sách phòng sau khi approve booking
      await refetchRooms()
      await refetchAvailableRooms()
      setFlash({ type: 'success', text: 'Đã duyệt đặt phòng thành công.' })
      // Đóng modal nếu đang mở
      if (editOpen && edit.id === bookingId) {
          handleCloseEdit()
        }
      } else {
      setFlash({ type: 'error', text: response.error || response.message || 'Không thể duyệt đặt phòng.' })
    }
  }, [refetchBookings, refetchRooms, refetchAvailableRooms, editOpen, edit.id, handleCloseEdit])

  // Reject booking
  const handleReject = useCallback(async (bookingId: number) => {
    const response = await apiClient.rejectBooking(bookingId, undefined, 'Đã từ chối bởi admin')
    if (response.success) {
      await refetchBookings()
      // Refresh danh sách phòng sau khi reject booking (vì backend đã trả lại phòng về AVAILABLE)
      await refetchRooms()
      await refetchAvailableRooms()
      setFlash({ type: 'success', text: 'Đã từ chối đặt phòng thành công.' })
      // Đóng modal nếu đang mở
      if (editOpen && edit.id === bookingId) {
        handleCloseEdit()
      }
    } else {
      setFlash({ type: 'error', text: response.error || response.message || 'Không thể từ chối đặt phòng.' })
    }
  }, [refetchBookings, refetchRooms, refetchAvailableRooms, editOpen, edit.id, handleCloseEdit])

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
  }, [editOpen, handleCloseEdit, save])

  const confirmDelete = (id: number) => {
    setConfirmOpen({ open: true, id })
  }

  const doDelete = async () => {
    if (!confirmOpen.id) return
    
    // Tìm booking để kiểm tra status
    const booking = bookings.find(b => b.id === confirmOpen.id)
    if (booking) {
      // Backend chỉ cho phép delete khi status = PENDING hoặc REJECTED (theo DeleteBookingService)
      if (booking.status !== 'PENDING' && booking.status !== 'REJECTED') {
        setFlash({ type: 'error', text: 'Chỉ có thể xóa đặt phòng ở trạng thái "Chờ duyệt" (PENDING) hoặc "Đã từ chối" (REJECTED).' })
        setConfirmOpen({ open: false })
        return
      }
    }
    
    const response = await apiClient.deleteBooking(confirmOpen.id)
    if (response.success) {
      await refetchBookings()
      // Refresh danh sách phòng sau khi xóa booking (vì backend đã trả lại phòng về AVAILABLE)
      await refetchRooms()
      await refetchAvailableRooms()
      setConfirmOpen({ open: false })
        setFlash({ type: 'success', text: 'Đã xóa đặt phòng.' })
    } else {
      setFlash({ type: 'error', text: response.error || response.message || '' })
      setConfirmOpen({ open: false })
      }
    }
    
  const renderStatusChip = (s: BookingStatus) => {
    const toneMap: Record<BookingStatus, any> = {
      "PENDING": "pending", "APPROVED": "approved", "REJECTED": "rejected",
      "CANCELLED": "cancelled", "CHECKED_IN": "checked-in", "CHECKED_OUT": "checked-out"
  }
    return <Badge tone={toneMap[s] || "muted"} className="rounded-full">{statusLabels[s]}</Badge>
  }

  return (
    <>
      <div className="px-6 pt-4 pb-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header & Filters Card */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
            <div className="header border-b border-gray-200/50 px-6 py-4">
        <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Quản lý đặt phòng</h1>
                <Button onClick={openCreate} variant="primary" className="px-5 py-2.5 text-sm rounded-xl">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
                  Thêm đặt phòng
            </Button>
        </div>
      </div>

            <div className="bg-white px-6 py-4">
              <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="flex-1 min-w-0 w-full">
                    <Input
                      placeholder="Tìm kiếm đặt phòng..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border-gray-300 rounded-xl focus:ring-0 focus:border-gray-300"
                    />
                    </div>
                <div className="w-full lg:w-48 flex-shrink-0 relative rounded-xl border border-gray-300 bg-white overflow-hidden">
                <select
                  value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                    {statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
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
                <h2 className="text-xl font-bold text-gray-900">Danh sách đặt phòng</h2>
                <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                  {filtered.length} đặt phòng
                </span>
              </div>
            </CardHeader>
            <CardBody className="p-0">
                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <THead>
                    <tr>
                      <th className="px-4 py-3 text-center text-sm font-bold">Mã Boking</th>
                      <th className="px-4 py-3 text-left text-sm font-bold">Khách hàng</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Phòng Đặt</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Thời gian</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Trạng thái</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Thao tác</th>
                    </tr>
                  </THead>
                  <TBody>
                    {filtered.slice((page - 1) * size, page * size).map((row, index) => (
                      <tr key={row.id} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:bg-[#f2f8fe]`}>
                        <td className="px-4 py-3 font-medium text-center text-gray-900">{row.code}</td>
                        <td className="px-4 py-3 text-left text-gray-700">{getCustomerDisplay(row)}</td>
                        <td className="px-4 py-3 text-center text-gray-700 font-semibold">{getRoomName(row.roomId)}</td>
                        <td className="px-4 py-3 text-center text-gray-700">
                          {formatDate(row.checkinDate)} - {formatDate(row.checkoutDate)}
                        </td>
                            <td className="px-4 py-3 text-center">{renderStatusChip(row.status)}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex gap-2 justify-center">
                            <Button variant="secondary" className="h-8 px-3 text-xs bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]" onClick={() => { setSelected(row); setDetailOpen(true); }}>Xem</Button>
                            <Button variant="secondary" className="h-8 px-3 text-xs bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]" onClick={() => openEdit(row)}>Sửa</Button>
                            <Button variant="danger" className="h-8 px-3 text-xs" onClick={() => confirmDelete(row.id)}>Xóa</Button>
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-gray-900 truncate">{row.code}</h3>
                          <p className="text-sm text-gray-600 truncate">{getCustomerDisplay(row)}</p>
                              </div>
                                </div>
                      <div className="flex-shrink-0">{renderStatusChip(row.status)}</div>
                              </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                        <span className="text-gray-600">Phòng:</span> <span className="font-bold text-gray-900">{getRoomName(row.roomId)}</span>
                            </div>
                      <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                        <span className="text-gray-600">Khách:</span> <span className="font-bold text-gray-900">{row.numGuests}</span>
                              </div>
                            </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Button variant="secondary" className="h-10 text-sm font-medium bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))]" onClick={() => { setSelected(row); setDetailOpen(true); }}>Xem</Button>
                      <Button variant="secondary" className="h-10 text-sm font-medium bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))]" onClick={() => openEdit(row)}>Sửa</Button>
                      <Button variant="danger" className="h-10 text-sm font-medium" onClick={() => confirmDelete(row.id)}>Xóa</Button>
                          </div>
                        </div>
                      ))}
                    </div>

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
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết đặt phòng" size="lg">
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                          Mã đặt phòng {selected.code}
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
                        <span className="text-gray-600">ID:</span>{" "}
                        <span className="font-bold text-[hsl(var(--primary))]">{selected.id}</span>
                      </p>
              </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                      <p className="text-sm sm:text-base font-semibold text-gray-700">
                        <span className="text-gray-600">Số khách:</span>{" "}
                        <span className="font-bold text-[hsl(var(--primary))]">{selected.numGuests}</span>
                      </p>
                </div>
              </div>

                  {/* Khách hàng và Phòng */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                      <p className="text-sm sm:text-base font-semibold text-gray-700 break-words leading-relaxed">
                        <span className="text-gray-600">Khách hàng:</span>{" "}
                        <span className="font-bold text-[hsl(var(--primary))]">{getCustomerDisplay(selected)}</span>
                    </p>
                  </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                      <p className="text-sm sm:text-base font-semibold text-gray-700 break-words leading-relaxed">
                        <span className="text-gray-600">Phòng:</span>{" "}
                        <span className="font-bold text-[hsl(var(--primary))]">{getRoomName(selected.roomId)}</span>
                      </p>
                </div>
              </div>

                  {/* Thời gian */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                      <p className="text-sm sm:text-base font-semibold text-gray-700">
                        <span className="text-gray-600">Check-in:</span>{" "}
                        <span className="font-bold text-[hsl(var(--primary))]">{formatDate(selected.checkinDate)}</span>
                      </p>
                        </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                      <p className="text-sm sm:text-base font-semibold text-gray-700">
                        <span className="text-gray-600">Check-out:</span>{" "}
                        <span className="font-bold text-[hsl(var(--primary))]">{formatDate(selected.checkoutDate)}</span>
                      </p>
                      </div>
                        </div>
                      </div>
                  </div>

              {selected.note && (
                <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-gray-200">
                  <p className="text-sm text-gray-800 whitespace-pre-line">
                    <span className="font-semibold text-gray-600">Ghi chú:</span>{" "}
                    {selected.note}
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
      <Modal open={editOpen} onClose={handleCloseEdit} title={edit.id ? 'Sửa đặt phòng' : 'Thêm đặt phòng mới'} size="lg">
        <div className="p-4 sm:p-6">
          <div className="space-y-4" key={edit.id || 'new'}>
            {/* Form */}
            <div className="space-y-3">
              {/* Code */}
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code <span className="text-red-500">*</span></label>
                  <Input
                  key={`code-${edit.id || 'new'}`}
                    value={edit.code}
                  onChange={(e) => { setEdit({ ...edit, code: e.target.value }); setCodeError(null); }}
                    placeholder="Nhập code đặt phòng"
                  disabled={!!edit.id}
                  className={`w-full ${codeError ? 'border-red-500 focus:ring-red-500' : ''} ${edit.id ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                {codeError && (
                  <div className="mt-1 text-sm font-medium text-red-600">{codeError}</div>
                  )}
                </div>

              {/* Khách hàng và Phòng */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Searchable User Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Khách hàng <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type="text"
                      value={userDropdownOpen && !edit.id ? userSearch : getSelectedUserDisplay()}
                    onChange={(e) => {
                        if (!edit.id) {
                          setUserSearch(e.target.value)
                          if (!userDropdownOpen) setUserDropdownOpen(true)
                        }
                      }}
                      onFocus={() => {
                        if (!edit.id) {
                          setUserDropdownOpen(true)
                          setUserSearch("")
                          setUserIdError(null)
                        }
                      }}
                      onBlur={() => setTimeout(() => setUserDropdownOpen(false), 200)}
                      placeholder="Gõ để tìm khách hàng..."
                      disabled={!!edit.id}
                      className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] ${userIdError ? 'border-red-500' : 'border-gray-300'} ${edit.id ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    {userDropdownOpen && !edit.id && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredUsers.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-500">Không tìm thấy khách hàng</div>
                        ) : (
                          filteredUsers.map(user => (
                            <div
                              key={user.id}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setEdit({ ...edit, userId: user.id })
                                setUserSearch("")
                                setUserDropdownOpen(false)
                              }}
                              className={`px-3 py-2 text-sm cursor-pointer hover:bg-[hsl(var(--primary)/0.1)] ${edit.userId === user.id ? 'bg-[hsl(var(--primary)/0.15)] font-medium' : ''}`}
                            >
                              {user.full_name || user.email || `#${user.id}`}
                            </div>
                          ))
                  )}
                </div>
                    )}
                  </div>
                  {userIdError && (
                    <div className="mt-1 text-sm font-medium text-red-600">{userIdError}</div>
                  )}
              </div>

                {/* Searchable Room Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phòng <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type="text"
                      value={roomDropdownOpen && !edit.id ? roomSearch : getSelectedRoomDisplay()}
                    onChange={(e) => {
                        if (!edit.id) {
                          setRoomSearch(e.target.value)
                          if (!roomDropdownOpen) setRoomDropdownOpen(true)
                        }
                      }}
                      onFocus={() => {
                        if (!edit.id) {
                          setRoomDropdownOpen(true)
                          setRoomSearch("")
                          setRoomIdError(null)
                        }
                      }}
                      onBlur={() => setTimeout(() => setRoomDropdownOpen(false), 200)}
                      placeholder="Gõ để tìm phòng..."
                      disabled={!!edit.id}
                      className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] ${roomIdError ? 'border-red-500' : 'border-gray-300'} ${edit.id ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    {roomDropdownOpen && !edit.id && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredRooms.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-500">Không tìm thấy phòng</div>
                        ) : (
                          filteredRooms.map(room => (
                            <div
                              key={room.id}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setEdit({ ...edit, roomId: room.id })
                                setRoomSearch("")
                                setRoomDropdownOpen(false)
                                setRoomIdError(null)
                              }}
                              className={`px-3 py-2 text-sm cursor-pointer hover:bg-[hsl(var(--primary)/0.1)] ${edit.roomId === room.id ? 'bg-[hsl(var(--primary)/0.15)] font-medium' : ''}`}
                            >
                              {room.code}
                            </div>
                          ))
                  )}
                </div>
                    )}
                  </div>
                  {roomIdError && (
                    <div className="mt-1 text-sm font-medium text-red-600">{roomIdError}</div>
                  )}
                </div>
              </div>

              {/* Ngày check-in và check-out */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày check-in <span className="text-red-500">*</span></label>
                  <Input
                    key={`checkinDate-${edit.id || 'new'}`}
                    type="date"
                    value={edit.checkinDate}
                    onChange={(e) => { setEdit({ ...edit, checkinDate: e.target.value }); setCheckinDateError(null); }}
                    placeholder="Chọn ngày check-in"
                    min={!edit.id ? new Date().toISOString().split('T')[0] : undefined}
                    className={`w-full ${checkinDateError ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {checkinDateError && (
                    <div className="mt-1 text-sm font-medium text-red-600">{checkinDateError}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày check-out <span className="text-red-500">*</span></label>
                  <Input
                    key={`checkoutDate-${edit.id || 'new'}`}
                    type="date"
                    value={edit.checkoutDate}
                    onChange={(e) => { setEdit({ ...edit, checkoutDate: e.target.value }); setCheckoutDateError(null); }}
                    placeholder="Chọn ngày check-out"
                    min={!edit.id ? (() => {
                      const tomorrow = new Date()
                      tomorrow.setDate(tomorrow.getDate() + 1)
                      return tomorrow.toISOString().split('T')[0]
                    })() : undefined}
                    className={`w-full ${checkoutDateError ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {checkoutDateError && (
                    <div className="mt-1 text-sm font-medium text-red-600">{checkoutDateError}</div>
                  )}
                </div>
              </div>

              {/* Số khách và Trạng thái */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số khách <span className="text-red-500">*</span></label>
                  <Input
                    key={`numGuests-${edit.id || 'new'}`}
                    type="number"
                    min="1"
                    max="20"
                    value={edit.numGuests}
                    onChange={(e) => { setEdit({ ...edit, numGuests: Number(e.target.value) }); setNumGuestsError(null); }}
                    placeholder="Số lượng khách"
                    className={`w-full ${numGuestsError ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {numGuestsError && (
                    <div className="mt-1 text-sm font-medium text-red-600">{numGuestsError}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select
                      key={`status-${edit.id || 'new'}`}
                      value={edit.status}
                      onChange={(e) => { setEdit({ ...edit, status: e.target.value as BookingStatus }); setStatusError(null); }}
                      disabled={!!edit.id}
                      className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:outline-none appearance-none ${edit.id ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'} ${statusError ? 'border-red-500' : 'border-gray-300'}`}
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
                  {statusError && (
                    <div className="mt-1 text-sm font-medium text-red-600">{statusError}</div>
                  )}
                  {/* Hiển thị 2 button Duyệt/Không duyệt khi đang edit và status = PENDING */}
                  {edit.id && edit.status === 'PENDING' && (
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="primary"
                        onClick={() => handleApprove(edit.id!)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2"
                      >
                        Duyệt
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => handleReject(edit.id!)}
                        className="flex-1 text-sm py-2"
                      >
                        Không duyệt
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Ghi chú - chỉ hiển thị trên desktop */}
              <div className="hidden sm:block">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea
                  key={`note-${edit.id || 'new'}`}
                  value={edit.note}
                  onChange={(e) => { setEdit({ ...edit, note: e.target.value }); setNoteError(null); }}
                  placeholder="Nhập ghi chú đặt phòng"
                  rows={2}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] ${noteError ? 'border-red-500' : 'border-gray-300'}`}
                />
                {noteError && (
                  <div className="mt-1 text-sm font-medium text-red-600">{noteError}</div>
                )}
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
            Bạn có chắc muốn xóa đặt phòng này? Đặt phòng sẽ bị xóa vĩnh viễn khỏi hệ thống.
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