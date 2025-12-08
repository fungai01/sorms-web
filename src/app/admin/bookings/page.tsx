"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { type Booking, type BookingStatus } from '@/lib/types'
import { useBookings, useRooms } from '@/hooks/useApi'
import { authService } from '@/lib/auth-service'
import { createBookingNotification } from '@/lib/notifications'

const statusOptions: BookingStatus[] = ['PENDING','APPROVED','REJECTED','CANCELLED','CHECKED_IN','CHECKED_OUT']

// Removed mock data; always use API

export default function BookingsPage() {
  const [rows, setRows] = useState<Booking[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [flash, setFlash] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Track seen bookings to avoid duplicate notifications
  const seenBookingIds = useRef<Set<number>>(new Set());
  const lastBookingCheck = useRef<number>(Date.now());

  const [query, setQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [filterStatus, setFilterStatus] = useState<'ALL' | BookingStatus>('ALL')
  
  // API hooks
  const { data: bookingsData, refetch: refetchBookings, loading: bookingsLoading, error: bookingsError } = useBookings(filterStatus)
  const { data: roomsData, refetch: refetchRooms, loading: roomsLoading, error: roomsError } = useRooms()
  const [sortKey, setSortKey] = useState<'id' | 'code' | 'checkin' | 'checkout'>("checkin")
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>("asc")
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<Booking | null>(null)

  const selectedMeta = selected
    ? (() => {
        const raw = selected as Record<string, any>
        const totalCandidate =
          raw?.totalPrice ??
          raw?.total_price ??
          raw?.totalAmount ??
          raw?.total_amount ??
          raw?.amount ??
          null
        const parsedTotal =
          typeof totalCandidate === 'number'
            ? totalCandidate
            : typeof totalCandidate === 'string' && totalCandidate.trim() !== ''
              ? Number(totalCandidate)
              : null
        const paymentCandidate =
          raw?.paymentStatus ??
          raw?.payment_status ??
          raw?.paymentState ??
          raw?.payment_state ??
          null
        return {
          totalPrice: typeof parsedTotal === 'number' && Number.isFinite(parsedTotal) ? parsedTotal : null,
          paymentStatus: typeof paymentCandidate === 'string' ? paymentCandidate : null
        }
      })()
    : { totalPrice: null, paymentStatus: null }

  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<{ id?: number, code: string, userId?: number, roomId: number, checkinDate: string, checkoutDate: string, numGuests: number, status: BookingStatus, note: string }>({ code: '', userId: undefined, roomId: 1, checkinDate: '', checkoutDate: '', numGuests: 1, status: 'PENDING', note: '' })
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({})
  const [confirmOpen, setConfirmOpen] = useState<{ open: boolean, id?: number, type?: 'delete' }>({ open: false })

  const handleCloseEdit = useCallback(() => {
    setEditOpen(false)
    // Reset về giá trị mặc định khi đóng modal
    setEdit({ code: '', userId: undefined, roomId: 1, checkinDate: '', checkoutDate: '', numGuests: 1, status: 'PENDING', note: '' })
    setFieldErrors({})
  }, [])

  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 3000); return () => clearTimeout(t) }, [flash])

  // Check for new bookings and add to notification system
  useEffect(() => {
    // Initialize seen bookings on first load
    if (rows.length > 0 && seenBookingIds.current.size === 0) {
      rows.forEach(b => {
        if (b.status === 'PENDING') {
          seenBookingIds.current.add(b.id);
        }
      });
      lastBookingCheck.current = Date.now();
      return;
    }

    // Check for new PENDING bookings
    const newPendingBookings = rows.filter(b => 
      b.status === 'PENDING' && 
      !seenBookingIds.current.has(b.id) &&
      new Date((b as any).created_at || (b as any).createdAt || '').getTime() > lastBookingCheck.current
    );

    if (newPendingBookings.length > 0) {
      newPendingBookings.forEach(booking => {
        seenBookingIds.current.add(booking.id);
        
        // Add notification to the notification system (will appear in Header dropdown)
        const guestName = booking.userName || `User #${booking.userId}`;
        const roomInfo = getRoomName(booking.roomId);
        
        createBookingNotification(
          booking.id,
          guestName,
          roomInfo,
          'PENDING'
        );
      });
      
      lastBookingCheck.current = Date.now();
    }
  }, [rows, rooms]);

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
  }, [editOpen, edit])

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

  // Sync dữ liệu từ API (không cố gọi /users/{id} nữa để tránh lỗi "User not found")
  useEffect(() => {
    // Đồng bộ phòng
    if (roomsData && Array.isArray(roomsData)) {
      setRooms(roomsData as any[])
    } else if (roomsError) {
      setRooms([])
    } else if (!roomsLoading && !roomsData) {
      // Nếu không loading và không có data, set mảng rỗng
      setRooms([])
    }

    // Đồng bộ đặt phòng - API trả về format: { items: [...], total: ... }
    if (bookingsData) {
      // API route trả về format: { items: [...] }
      const data: any = bookingsData
      const rawList = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
      
      // Normalize dữ liệu - chuyển snake_case sang camelCase nếu cần
      const normalizedList = rawList.map((item: any) => ({
        id: item.id,
        code: item.code || '',
        userId: item.userId || item.user_id,
        userName: item.userName || item.user_name,
        userEmail: item.userEmail || item.user_email || item.email || '',
        phoneNumber: item.phoneNumber || item.phone_number || item.phone || '',
        roomId: item.roomId || item.room_id,
        roomCode: item.roomCode || item.room_code,
        roomTypeName: item.roomTypeName || item.room_type_name || item.roomType || '',
        building: item.building || item.building_name || '',
        checkinDate: item.checkinDate || item.checkin_date || item.checkInDate || '',
        checkoutDate: item.checkoutDate || item.checkout_date || item.checkOutDate || '',
        numGuests: item.numGuests || item.num_guests || 1,
        purpose: item.purpose || item.booking_purpose || '',
        note: item.note || '',
        status: item.status || 'PENDING',
        totalPrice: item.totalPrice || item.total_price || item.amount || null,
        paymentStatus: item.paymentStatus || item.payment_status || '',
        isActive: item.isActive !== undefined ? item.isActive : (item.is_active !== undefined ? item.is_active : true),
        created_at: item.created_at || item.createdAt || '',
        updated_at: item.updated_at || item.updatedAt || ''
      }))
      
      console.log('[BookingsPage] Syncing bookings data:', {
        hasData: !!bookingsData,
        dataType: typeof bookingsData,
        hasItems: !!data?.items,
        itemsLength: rawList.length,
        isArray: Array.isArray(data),
        sampleItem: rawList[0],
        normalizedSample: normalizedList[0]
      })
      setRows(normalizedList as Booking[])
    } else if (bookingsError) {
      console.error('[BookingsPage] Bookings error:', bookingsError)
      setRows([])
    } else if (!bookingsLoading && !bookingsData) {
      // Nếu không loading và không có data, set mảng rỗng
      console.warn('[BookingsPage] No bookings data and no error, setting empty array')
      setRows([])
    }
  }, [bookingsData, roomsData, bookingsError, roomsError, bookingsLoading, roomsLoading])

  const filtered = useMemo(() => {
    // Backend-side filter by status is applied via useBookings(filterStatus)
    const dir = sortOrder === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      if (sortKey === 'id') return (a.id - b.id) * dir
      if (sortKey === 'code') return a.code.localeCompare(b.code) * dir
      if (sortKey === 'checkin') return a.checkinDate.localeCompare(b.checkinDate) * dir
      return a.checkoutDate.localeCompare(b.checkoutDate) * dir
    })
  }, [rows, sortKey, sortOrder])

  function openCreate() {
    setFieldErrors({})
    setEdit({ code: '', userId: undefined, roomId: 1, checkinDate: '', checkoutDate: '', numGuests: 1, status: 'PENDING', note: '' })
    setEditOpen(true)
  }

  function openEdit(r: Booking | any) {
    // Reset errors trước
    setFieldErrors({})
    // Đóng modal trước (nếu đang mở) để reset
    setEditOpen(false)
    
    // Normalize dữ liệu - xử lý cả camelCase và snake_case
    const raw = r as any
    const checkinDate = raw.checkinDate || raw.checkin_date || raw.checkInDate || ''
    const checkoutDate = raw.checkoutDate || raw.checkout_date || raw.checkOutDate || ''
    const numGuests = raw.numGuests || raw.num_guests || raw.numGuests || 1
    const roomId = raw.roomId || raw.room_id || 1
    const code = raw.code || ''
    const status = raw.status || 'PENDING'
    const note = raw.note || ''
    const userId = raw.userId || raw.user_id
    
    // Format dates nếu cần (chuyển từ ISO string sang YYYY-MM-DD cho input type="date")
    let formattedCheckinDate = checkinDate
    let formattedCheckoutDate = checkoutDate
    
    if (checkinDate && checkinDate.includes('T')) {
      formattedCheckinDate = checkinDate.split('T')[0]
    } else if (checkinDate && checkinDate.includes(' ')) {
      formattedCheckinDate = checkinDate.split(' ')[0]
    }
    
    if (checkoutDate && checkoutDate.includes('T')) {
      formattedCheckoutDate = checkoutDate.split('T')[0]
    } else if (checkoutDate && checkoutDate.includes(' ')) {
      formattedCheckoutDate = checkoutDate.split(' ')[0]
    }
    
    // Set dữ liệu của booking được chọn - đảm bảo dữ liệu đầy đủ
    const editData = { 
      id: raw.id, 
      code: code, 
      userId: userId,
      roomId: roomId, 
      checkinDate: formattedCheckinDate, 
      checkoutDate: formattedCheckoutDate, 
      numGuests: numGuests, 
      status: status, 
      note: note
    }
    
    console.log('[BookingsPage] openEdit - Raw data:', raw)
    console.log('[BookingsPage] openEdit - Normalized data:', editData)
    
    setEdit(editData)
    // Mở modal sau khi đã set dữ liệu
    setTimeout(() => {
      setEditOpen(true)
    }, 10)
  }

  async function save() {
    // Clear previous errors
    setFieldErrors({})
    
    const errors: { [key: string]: string } = {}
    
    // Validate required fields
    if (!edit.code.trim()) {
      errors.code = 'Vui lòng nhập Code đặt phòng'
    }
    if (!edit.roomId || edit.roomId === 0) {
      errors.roomId = 'Vui lòng chọn phòng'
    }
    if (!edit.checkinDate) {
      errors.checkinDate = 'Vui lòng nhập ngày check-in'
    }
    if (!edit.checkoutDate) {
      errors.checkoutDate = 'Vui lòng nhập ngày check-out'
    }
    if (edit.numGuests < 1) {
      errors.numGuests = 'Số khách phải lớn hơn 0'
    }
    
    // Validate date logic
    if (edit.checkinDate && edit.checkoutDate && new Date(edit.checkoutDate) <= new Date(edit.checkinDate)) {
      errors.checkoutDate = 'Ngày check-out phải sau ngày check-in'
    }
    
    // If there are errors, show them and return
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    
    // Gọi API
    try {
      if (edit.id) {
        const isApprove = edit.status === 'APPROVED'
        const isReject = edit.status === 'REJECTED'
        const isCancel = edit.status === 'CANCELLED'
        const isCheckin = edit.status === 'CHECKED_IN'
        const isCheckout = edit.status === 'CHECKED_OUT'

          // Nếu status là APPROVED, chỉ gọi POST /bookings/{id}/approve (không gọi PUT)
          if (isApprove) {
            const token = authService.getAccessToken()
            const headers: HeadersInit = { 'Content-Type': 'application/json' }
            if (token) {
              headers['Authorization'] = `Bearer ${token}`
            }

            // Lấy user info để lấy approverId
            const userInfo = authService.getUserInfo()
            const approverId = userInfo?.id || 'SYSTEM'

            // POST /bookings/{id}/approve với body: { bookingId, approverId, decision, reason }
            const approvePayload = {
              bookingId: edit.id,
              approverId: String(approverId),
              decision: 'APPROVED',
              reason: ''
            }

            const approveRes = await fetch(`/api/system/bookings?action=approve&id=${edit.id}`, {
              method: 'POST',
              headers,
              body: JSON.stringify(approvePayload)
            })

            if (!approveRes.ok) {
              const approveError = await approveRes.json().catch(() => ({}))
              const errorMsg = approveError.error || 'Failed to approve booking'
              setFieldErrors({ general: errorMsg })
              return
            }

          // Cập nhật state ngay lập tức để hiển thị thay đổi ngay, không cần đợi refetch
          setRows(prevRows => prevRows.map(booking => 
            booking.id === edit.id 
              ? { ...booking, status: 'APPROVED' as BookingStatus }
              : booking
          ))

          // Không gọi refetch ngay để tránh làm chậm UI - sẽ tự động sync khi user filter/search
          // refetchBookings().catch(err => console.error('Background refetch error:', err))

          setFlash({ type: 'success', text: 'Đã duyệt đặt phòng thành công.' })
          handleCloseEdit()
        } else {
          // Nếu status khác APPROVED, gọi PUT để cập nhật thông tin và status
          // PUT /bookings/{id} - Body format: { id, roomId, checkinDate, checkoutDate, numGuests, note, status }
          const updatePayload: any = {
            id: edit.id,
            roomId: edit.roomId,
            checkinDate: edit.checkinDate,
            checkoutDate: edit.checkoutDate,
            numGuests: edit.numGuests,
            note: edit.note.trim() || '',
            status: edit.status
          }

          // Cập nhật thông tin đặt phòng
          const response = await fetch('/api/system/bookings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
          })
          if (!response.ok) {
            const error = await response.json()
            const errorMsg = error.error || 'Failed to update booking'
            setFieldErrors({ general: errorMsg })
            return
          }

          // Cập nhật state ngay lập tức để hiển thị thay đổi ngay, không cần đợi refetch
          setRows(prevRows => prevRows.map(booking => 
            booking.id === edit.id 
              ? { 
                  ...booking, 
                  status: edit.status,
                  roomId: edit.roomId,
                  checkinDate: edit.checkinDate,
                  checkoutDate: edit.checkoutDate,
                  numGuests: edit.numGuests,
                  note: edit.note.trim() || ''
                }
              : booking
          ))

          // Nếu checkout thành công, tự động cập nhật trạng thái phòng thành AVAILABLE
          if (isCheckout && edit.roomId) {
            try {
              const roomUpdateResponse = await fetch('/api/system/rooms', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: edit.roomId,
                  status: 'AVAILABLE'
                })
              })
              if (!roomUpdateResponse.ok) {
                console.warn('Failed to update room status to AVAILABLE after checkout')
              }
            } catch (error) {
              console.error('Error updating room status after checkout:', error)
            }
          }

          // Không gọi refetch ngay để tránh làm chậm UI - sẽ tự động sync khi user filter/search
          // refetchBookings().catch(err => console.error('Background refetch error:', err))

          let successMessage = 'Đã cập nhật đặt phòng.'
          if (isReject) successMessage = 'Đã từ chối đặt phòng.'
          else if (isCancel) successMessage = 'Đã hủy đặt phòng.'
          else if (isCheckin) successMessage = 'Đã check-in đặt phòng.'
          else if (isCheckout) successMessage = 'Đã check-out đặt phòng. Phòng đã được đặt về trạng thái trống.'
          setFlash({ type: 'success', text: successMessage })
          handleCloseEdit()
        }
      } else {
        // POST /bookings - Create new booking
        const createPayload = {
          code: edit.code.trim(),
          userId: edit.userId,
          roomId: edit.roomId,
          checkinDate: edit.checkinDate,
          checkoutDate: edit.checkoutDate,
          numGuests: edit.numGuests,
          status: edit.status,
          note: edit.note.trim() || '',
        }
        const response = await fetch('/api/system/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload)
        })
        if (!response.ok) {
          const error = await response.json()
          const errorMsg = error.error || 'Failed to create booking'
          setFieldErrors({ general: errorMsg })
          return
        }

        // Parse response để lấy booking mới
        const createdBooking = await response.json()
        const newBooking: Booking = {
          id: createdBooking.id || createdBooking.data?.id || Date.now(),
          code: createdBooking.code || createdBooking.data?.code || edit.code.trim(),
          userId: createdBooking.userId || createdBooking.data?.userId || edit.userId || 0,
          userName: createdBooking.userName || createdBooking.data?.userName,
          roomId: createdBooking.roomId || createdBooking.data?.roomId || edit.roomId,
          roomCode: createdBooking.roomCode || createdBooking.data?.roomCode,
          checkinDate: createdBooking.checkinDate || createdBooking.data?.checkinDate || edit.checkinDate,
          checkoutDate: createdBooking.checkoutDate || createdBooking.data?.checkoutDate || edit.checkoutDate,
          numGuests: createdBooking.numGuests || createdBooking.data?.numGuests || edit.numGuests,
          note: createdBooking.note || createdBooking.data?.note || edit.note.trim() || '',
          status: createdBooking.status || createdBooking.data?.status || edit.status,
          isActive: createdBooking.isActive !== undefined ? createdBooking.isActive : (createdBooking.data?.isActive !== undefined ? createdBooking.data.isActive : true),
          created_at: createdBooking.created_at || createdBooking.data?.created_at || new Date().toISOString(),
          updated_at: createdBooking.updated_at || createdBooking.data?.updated_at || new Date().toISOString()
        }

        // Thêm booking mới vào state ngay lập tức
        setRows(prevRows => [...prevRows, newBooking])

        // Không gọi refetch ngay để tránh làm chậm UI - sẽ tự động sync khi user filter/search
        // refetchBookings().catch(err => console.error('Background refetch error:', err))

        setFlash({ type: 'success', text: 'Đã tạo đặt phòng mới.' })
      }
      handleCloseEdit()
    } catch (error: any) {
      // Hiển thị lỗi trong form thay vì flash message
      setFieldErrors({ general: error.message || 'Có lỗi xảy ra' })
    }
  }

  function confirmAction(id: number, type: 'delete') {
    setConfirmOpen({ open: true, id, type })
  }

  async function doAction() {
    if (!confirmOpen.id || !confirmOpen.type) return
    const { id, type } = confirmOpen
    
    // Gọi API
    try {
      if (type === 'delete') {
        const response = await fetch(`/api/system/bookings?id=${id}`, { method: 'DELETE' })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to deactivate booking')
        }

        // Xóa booking khỏi state ngay lập tức
        setRows(prevRows => prevRows.filter(booking => booking.id !== id))

        // Không gọi refetch ngay để tránh làm chậm UI - sẽ tự động sync khi user filter/search
        // refetchBookings().catch(err => console.error('Background refetch error:', err))

        setFlash({ type: 'success', text: 'Đã xóa đặt phòng.' })
      }
    } catch (error: any) {
      setFlash({ type: 'error', text: error.message || 'Có lỗi xảy ra' })
    }
    
    setConfirmOpen({ open: false })
  }

  async function activateBooking(id: number) {
    setFlash({ type: 'error', text: 'Chức năng kích hoạt đặt phòng chưa được backend hỗ trợ' })
  }

  function renderStatusChip(s: BookingStatus) {
    if (s === 'PENDING') return <Badge tone="pending">Chờ duyệt</Badge>
    if (s === 'APPROVED') return <Badge tone="approved">Đã duyệt</Badge>
    if (s === 'REJECTED') return <Badge tone="rejected">Đã từ chối</Badge>
    if (s === 'CANCELLED') return <Badge tone="cancelled">Đã hủy</Badge>
    if (s === 'CHECKED_IN') return <Badge tone="checked-in">Đã nhận phòng</Badge>
    return <Badge tone="checked-out">Đã trả phòng</Badge>
  }

  const getRoomName = (roomId: number) => {
    const room = rooms.find(r => r.id === roomId)
    if (!room) return `Room ${roomId}`
    return room.name || room.code || `Room ${roomId}`
  }

  return (
    <>
      {/* Header - Mobile Optimized */}
      <div className="bg-white border-b border-gray-200 px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-gray-900 truncate">Đặt phòng</h1>
              <p className="text-sm text-gray-500">{filtered.length} đặt phòng</p>
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
              <span className="hidden sm:inline ml-1">Thêm đặt phòng</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 py-3">
        <div className="space-y-3">
          {/* Success Messages */}
          {flash && flash.type === 'success' && (
            <div className={`rounded-md border p-2 sm:p-3 text-xs sm:text-sm shadow-sm bg-green-50 border-green-200 text-green-800`}>
              {flash.text}
            </div>
          )}

          {/* Loading indicator */}
          {(bookingsLoading || roomsLoading) && (
            <div className="rounded-md border p-2 sm:p-3 text-xs sm:text-sm shadow-sm bg-yellow-50 border-yellow-200 text-yellow-800">
              Đang tải dữ liệu đặt phòng...
            </div>
          )}

          {/* Error indicator */}
          {bookingsError && (
            <div className="rounded-md border p-2 sm:p-3 text-xs sm:text-sm shadow-sm bg-red-50 border-red-200 text-red-800">
              <p className="font-semibold">Lỗi khi tải dữ liệu đặt phòng:</p>
              <p>{bookingsError}</p>
            </div>
          )}

          {/* Empty state */}
          {!bookingsLoading && !bookingsError && rows.length === 0 && (
            <div className="rounded-md border p-4 sm:p-6 text-center shadow-sm bg-gray-50 border-gray-200">
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium text-gray-700">Không có dữ liệu đặt phòng</p>
              <p className="text-xs text-gray-500 mt-1">Vui lòng thử lại hoặc tạo đặt phòng mới</p>
            </div>
          )}

          {/* Filters */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
            {/* Mobile layout - Optimized */}
            <div className="lg:hidden space-y-3">
              {/* Hàng 1: Tìm kiếm */}
              <div className="flex flex-row items-center">
                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <Input
                      placeholder="Tìm kiếm đặt phòng..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 text-sm border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hàng 2: Ngày tháng - Mobile Optimized */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Từ ngày</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    style={{ fontSize: '16px' }} // Prevent zoom on iOS
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Đến ngày</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    style={{ fontSize: '16px' }} // Prevent zoom on iOS
                  />
                </div>
              </div>

              {/* Hàng 3: Sắp xếp và Thứ tự */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Thứ tự</label>
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

              {/* Hàng 4: Trạng thái */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Trạng thái</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'ALL' | BookingStatus)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="PENDING">Chờ duyệt</option>
                  <option value="APPROVED">Đã duyệt</option>
                  <option value="REJECTED">Đã từ chối</option>
                  <option value="CANCELLED">Đã hủy</option>
                  <option value="CHECKED_IN">Đã nhận phòng</option>
                  <option value="CHECKED_OUT">Đã trả phòng</option>
                </select>
              </div>
            </div>

            {/* Desktop layout */}
            <div className="hidden lg:flex flex-row gap-4 items-center">
              {/* Tìm kiếm */}
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Input
                    placeholder="Tìm kiếm đặt phòng..."
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
              
              {/* Từ ngày */}
              <div className="w-40 flex-shrink-0">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {/* Đến ngày */}
              <div className="w-40 flex-shrink-0">
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
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
              
              {/* Trạng thái */}
              <div className="w-36 flex-shrink-0">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'ALL' | BookingStatus)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="PENDING">Chờ duyệt</option>
                  <option value="APPROVED">Đã duyệt</option>
                  <option value="REJECTED">Đã từ chối</option>
                  <option value="CANCELLED">Đã hủy</option>
                  <option value="CHECKED_IN">Đã nhận phòng</option>
                  <option value="CHECKED_OUT">Đã trả phòng</option>
                </select>
              </div>
            </div>
          </div>



          {/* Table */}
          <div className="px-4 py-3">
            <div className="w-full">
              <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-xl rounded-2xl overflow-hidden">
                <CardHeader className="bg-gray-50 border-b border-gray-200 px-6 py-3">
              <div className="flex items-center justify-between">
                    <h2 className="text-lg text-left font-bold text-gray-900">Danh sách đặt phòng</h2>
                    <span className="text-sm text-right font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">{filtered.length} đặt phòng</span>
              </div>
            </CardHeader>
            <CardBody className="p-0">
                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm">
                  <colgroup>
                        <col className="w-[10%]" />
                        <col className="w-[12%]" />
                        <col className="w-[12%]" />
                        <col className="w-[15%]" />
                       <col className="w-[15%]" />
                        <col className="w-[10%]" />
                        <col className="w-[10%]" />
                        <col className="w-[20%]" />
                  </colgroup>
                  <thead>
                        <tr className="bg-gray-50 text-gray-700">
                          <th className="px-4 py-3 text-center font-semibold">Code</th>
                          <th className="px-4 py-3 text-center font-semibold">Khách hàng</th>
                          <th className="px-4 py-3 text-center font-semibold">Phòng</th>
                          <th className="px-4 py-3 text-center font-semibold">Check-in</th>
                          <th className="px-4 py-3 text-center font-semibold">Check-out</th>
                          <th className="px-4 py-3 text-center font-semibold">Số khách</th>
                          <th className="px-4 py-3 text-center font-semibold">Trạng thái</th>
                          <th className="px-4 py-3 text-center font-semibold">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice((page - 1) * size, page * size).map((row) => (
                          <tr key={row.id} className="hover:bg-gray-50 border-b border-gray-100">
                            <td className="px-4 py-3 text-center font-medium text-gray-900">{row.code}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.userId} - {row.userName || `User`}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{getRoomName(row.roomId)}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.checkinDate}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.checkoutDate}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.numGuests}</td>
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
                                {row.isActive !== false && (
                                  <Button
                                    variant="danger"
                                    className="h-8 px-3 text-xs"
                                    onClick={() => confirmAction(row.id, 'delete')}
                                  >
                                    Xóa
                                  </Button>
                                )}
                              </div>
                            </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

                  {/* Mobile Cards - Optimized */}
                  <div className="lg:hidden p-3">
                    <div className="space-y-3">
                      {filtered.slice((page - 1) * size, page * size).map((row) => (
                        <div
                          key={row.id}
                          className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
                        >
                          {/* Header với Code và Status */}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                                  <span className="text-white font-bold text-sm">
                                    {row.code.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <h3 className="font-bold text-gray-900 text-base">{row.code}</h3>
                                  <p className="text-sm text-gray-600">{row.userId} - {row.userName || `User`}</p>
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                {renderStatusChip(row.status)}
                              </div>
                            </div>
                          </div>

                          {/* Thông tin chính */}
                          <div className="p-4">
                            <div className="grid grid-cols-2 gap-3 mb-4">
                              {/* Phòng */}
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs text-gray-500">Phòng</p>
                                  <p className="text-sm font-semibold text-gray-900 truncate">{getRoomName(row.roomId)}</p>
                                </div>
                              </div>

                              {/* Số khách */}
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs text-gray-500">Số khách</p>
                                  <p className="text-sm font-semibold text-gray-900">{row.numGuests} người</p>
                                </div>
                              </div>
                            </div>

                            {/* Ngày tháng */}
                            <div className="flex items-center gap-2 mb-4">
                              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-gray-500">Thời gian</p>
                                <p className="text-sm font-semibold text-gray-900">{row.checkinDate} - {row.checkoutDate}</p>
                              </div>
                            </div>

                            {/* Ghi chú nếu có */}
                            {row.note && (
                              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-500 mb-1">Ghi chú</p>
                                <p className="text-sm text-gray-700 whitespace-pre-line">{row.note}</p>
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
                                  onClick={() => confirmAction(row.id, 'delete')}
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                  </svg>
                                  Xóa
                                </Button>
                              ) : (
                                <Button
                                  className="h-10 text-xs font-medium px-2 bg-green-600 hover:bg-green-700"
                                  onClick={() => activateBooking(row.id)}
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

                    {/* Desktop Layout */}
                    <div className="hidden lg:flex flex-row items-center justify-between gap-6">
                      <div className="text-left">
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

      {/* Detail Modal - Compact */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết đặt phòng" size="xl">
        <div className="p-3 sm:p-4">
          {selected && (
            <div className="space-y-4">
              {/* Header với thông tin chính */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 sm:p-4 border border-blue-200">
                {/* Thông tin đặt phòng chính */}
                <div className="space-y-3">
                  {/* Header với icon */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
              </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Đặt phòng {selected.code}</h2>
                        <p className="text-base sm:text-lg lg:text-xl text-gray-600 truncate">{selected.userId} - {selected.userName || `User`}</p>
              </div>
              </div>
              </div>

                  {/* Thông tin nhanh */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">ID</span>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-blue-900">{selected.id}</p>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Số khách</span>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-blue-900">{selected.numGuests}</p>
                    </div>
                  </div>

                  {/* Thông tin khách hàng */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {(selected as any).userEmail && (
                      <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Khách hàng</span>
                        </div>
                        <p className="text-sm sm:text-base font-bold text-blue-900">{(selected as any).userEmail}</p>
                      </div>
                    )}
                    {(selected as any).phoneNumber && (
                      <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">SĐT</span>
                        </div>
                        <p className="text-sm sm:text-base font-bold text-blue-900">{(selected as any).phoneNumber || 'N/A'}</p>
                      </div>
                    )}
                  </div>

                  {/* Email */}
                  {(selected as any).userEmail && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Email</span>
                      </div>
                      <p className="text-sm sm:text-base font-bold text-blue-900">{(selected as any).userEmail}</p>
                    </div>
                  )}

                  {/* Phòng và Tòa */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Phòng</span>
                      </div>
                      <p className="text-sm sm:text-base font-bold text-blue-900">
                        {(selected as any).roomTypeName ? `${(selected as any).roomTypeName}` : getRoomName(selected.roomId)}
                        {(selected as any).roomCode ? ` - ${(selected as any).roomCode}` : ''}
                      </p>
                    </div>
                    {(selected as any).building && (
                      <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Tòa</span>
                        </div>
                        <p className="text-sm sm:text-base font-bold text-blue-900">{(selected as any).building}</p>
                      </div>
                    )}
                  </div>

                  {/* Check-in và Check-out */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Check-in</span>
                      </div>
                      <p className="text-sm sm:text-base font-bold text-blue-900">
                        {selected.checkinDate ? new Date(selected.checkinDate).toLocaleString('vi-VN') : selected.checkinDate}
                      </p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Check-out</span>
                      </div>
                      <p className="text-sm sm:text-base font-bold text-blue-900">
                        {selected.checkoutDate ? new Date(selected.checkoutDate).toLocaleString('vi-VN') : selected.checkoutDate}
                      </p>
                    </div>
                  </div>

                  {/* Mục đích */}
                  {(selected as any).purpose && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Mục đích</span>
                      </div>
                      <p className="text-sm sm:text-base font-bold text-blue-900">{(selected as any).purpose}</p>
                    </div>
                  )}

                  {/* Trạng thái và ghi chú */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Trạng thái</span>
                      </div>
                      <div className="mt-1">{renderStatusChip(selected.status)}</div>
                    </div>

                    {selected.note && (
                      <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Ghi chú</span>
                        </div>
                        <p className="text-sm sm:text-base font-bold text-blue-900 whitespace-pre-line break-words">{selected.note}</p>
                      </div>
                    )}
                  </div>

                  {/* Tổng tiền và Thanh toán */}
                  {(((selected as any).totalPrice !== null && (selected as any).totalPrice !== undefined) || (selected as any).paymentStatus || selectedMeta.totalPrice !== null || selectedMeta.paymentStatus || selected.created_at || selected.updated_at) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Tổng tiền</span>
                        </div>
                        <p className="text-sm sm:text-base font-bold text-blue-900">
                          {(() => {
                            const totalPrice = (selected as any).totalPrice !== null && (selected as any).totalPrice !== undefined 
                              ? (selected as any).totalPrice 
                              : selectedMeta.totalPrice;
                            return totalPrice !== null && totalPrice !== undefined 
                              ? Number(totalPrice).toLocaleString('vi-VN') + ' VND'
                              : 'Miễn phí';
                          })()}
                        </p>
                      </div>

                      {((selected as any).paymentStatus || selectedMeta.paymentStatus) && (
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 010-4h14a2 2 0 110 4M5 12a2 2 0 000 4h14a2 2 0 100-4" />
                            </svg>
                            <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Thanh toán</span>
                          </div>
                          <p className="text-sm sm:text-base font-bold text-blue-900">{(selected as any).paymentStatus || selectedMeta.paymentStatus}</p>
                        </div>
                      )}

                      {selected.created_at && (
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Đặt lúc</span>
                          </div>
                          <p className="text-sm sm:text-base font-bold text-blue-900">
                            {new Date(selected.created_at).toLocaleString('vi-VN', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit',
                              day: 'numeric',
                              month: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      )}

                      {selected.updated_at && (
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-blue-200">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase">Cập nhật gần nhất</span>
                          </div>
                          <p className="text-sm sm:text-base font-bold text-blue-900">
                            {new Date(selected.updated_at).toLocaleString('vi-VN')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Modal - Mobile Optimized */}
      <Modal open={editOpen} onClose={handleCloseEdit} title={edit.id ? 'Sửa đặt phòng' : 'Thêm đặt phòng mới'}>
        <div className="p-4 sm:p-6">
          <div className="space-y-4" key={edit.id || 'new'}>
            {/* Form */}
            <div className="space-y-4">
              {/* General Error Message */}
              {fieldErrors.general && (
                <div className="rounded-md border p-3 text-sm shadow-sm bg-red-50 border-red-200 text-red-800">
                  {fieldErrors.general}
                </div>
              )}
              
              {/* Code và Số khách */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <Input
                    key={`code-${edit.id || 'new'}-${edit.code}`}
                    value={edit.code}
                    onChange={(e) => {
                      setEdit({ ...edit, code: e.target.value })
                      if (fieldErrors.code) {
                        setFieldErrors(prev => ({ ...prev, code: '' }))
                      }
                    }}
                    placeholder="Nhập code đặt phòng"
                    className={`w-full px-4 py-3 text-base border rounded-xl focus:ring-2 focus:ring-blue-500 ${
                      fieldErrors.code ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors.code && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.code}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số khách *</label>
                  <Input
                    key={`numGuests-${edit.id || 'new'}-${edit.numGuests}`}
                    type="number"
                    min="1"
                    max="10"
                    value={edit.numGuests}
                    onChange={(e) => {
                      setEdit({ ...edit, numGuests: Number(e.target.value) })
                      if (fieldErrors.numGuests) {
                        setFieldErrors(prev => ({ ...prev, numGuests: '' }))
                      }
                    }}
                    placeholder="Số lượng khách"
                    className={`w-full px-4 py-3 text-base border rounded-xl focus:ring-2 focus:ring-blue-500 ${
                      fieldErrors.numGuests ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors.numGuests && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.numGuests}</p>
                  )}
                </div>
              </div>

              {/* Phòng và Trạng thái */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phòng *</label>
                  <select
                    key={`roomId-${edit.id || 'new'}-${edit.roomId}`}
                    value={edit.roomId}
                    onChange={(e) => {
                      setEdit({ ...edit, roomId: Number(e.target.value) })
                      if (fieldErrors.roomId) {
                        setFieldErrors(prev => ({ ...prev, roomId: '' }))
                      }
                    }}
                    className={`w-full px-4 py-3 text-base border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                      fieldErrors.roomId ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Chọn phòng</option>
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>{room.code} - {room.name || 'Phòng'}</option>
                    ))}
                  </select>
                  {fieldErrors.roomId && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.roomId}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                  <select
                    key={`status-${edit.id || 'new'}-${edit.status}`}
                    value={edit.status}
                    onChange={(e) => setEdit({ ...edit, status: e.target.value as BookingStatus })}
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="PENDING">Chờ duyệt</option>
                    <option value="APPROVED">Đã duyệt</option>
                    <option value="REJECTED">Đã từ chối</option>
                    <option value="CANCELLED">Đã hủy</option>
                    <option value="CHECKED_IN">Đã nhận phòng</option>
                    <option value="CHECKED_OUT">Đã trả phòng</option>
                  </select>
                </div>
              </div>

              {/* Ngày check-in và check-out */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày check-in *</label>
                  <Input
                    key={`checkinDate-${edit.id || 'new'}-${edit.checkinDate}`}
                    type="date"
                    value={edit.checkinDate}
                    onChange={(e) => {
                      setEdit({ ...edit, checkinDate: e.target.value })
                      if (fieldErrors.checkinDate) {
                        setFieldErrors(prev => ({ ...prev, checkinDate: '' }))
                      }
                    }}
                    className={`w-full px-4 py-3 text-base border rounded-xl focus:ring-2 focus:ring-blue-500 ${
                      fieldErrors.checkinDate ? 'border-red-500' : 'border-gray-300'
                    }`}
                    style={{ fontSize: '16px' }} // Prevent zoom on iOS
                  />
                  {fieldErrors.checkinDate && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.checkinDate}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày check-out *</label>
                  <Input
                    key={`checkoutDate-${edit.id || 'new'}-${edit.checkoutDate}`}
                    type="date"
                    value={edit.checkoutDate}
                    onChange={(e) => {
                      setEdit({ ...edit, checkoutDate: e.target.value })
                      if (fieldErrors.checkoutDate) {
                        setFieldErrors(prev => ({ ...prev, checkoutDate: '' }))
                      }
                    }}
                    className={`w-full px-4 py-3 text-base border rounded-xl focus:ring-2 focus:ring-blue-500 ${
                      fieldErrors.checkoutDate ? 'border-red-500' : 'border-gray-300'
                    }`}
                    style={{ fontSize: '16px' }} // Prevent zoom on iOS
                  />
                  {fieldErrors.checkoutDate && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.checkoutDate}</p>
                  )}
                </div>
              </div>

              {/* Ghi chú - Full width */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea
                  key={`note-${edit.id || 'new'}-${edit.note}`}
                  value={edit.note}
                  onChange={(e) => setEdit({ ...edit, note: e.target.value })}
                  placeholder="Nhập ghi chú (tùy chọn)"
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Action Buttons - Same Row */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button 
                variant="secondary" 
                onClick={handleCloseEdit}
                className="flex-1 h-12 text-base font-medium"
              >
                Hủy
              </Button>
              <Button 
                onClick={save}
                className="flex-1 h-12 text-base font-medium bg-blue-600 hover:bg-blue-700"
              >
                {edit.id ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal */}
      <Modal open={confirmOpen.open} onClose={() => setConfirmOpen({ open: false })} title="Xác nhận xóa đặt phòng">
        <div className="p-6">
          <p className="text-gray-600 mb-6">
            Bạn có chắc chắn muốn xóa đặt phòng này không?
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmOpen({ open: false })}>
              Hủy
            </Button>
            <Button 
              variant="danger" 
              onClick={doAction}
            >
              Xóa
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}