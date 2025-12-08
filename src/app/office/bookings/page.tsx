"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Table, THead, TBody } from "@/components/ui/Table";
import { createBookingNotification } from "@/lib/notifications";
import { useBookings, useRooms, useUsers } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import { authService } from "@/lib/auth-service";
import { useRouter } from "next/navigation";

type BookingRequest = {
  id: number;
  code: string;
  userId: number;
  userName?: string;  
  roomId: number;
  roomCode?: string;
  roomName?: string;
  checkinDate: string;
  checkoutDate: string;
  numGuests: number;
  note?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT';
  created_at: string;
  updated_at: string;
};

export default function OfficeBookingsPage() {
  const router = useRouter();

  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT'>('ALL');

  // Use API hooks for data fetching (gửi status lên API nếu khác ALL)
  const { data: bookingsData, loading: bookingsLoading, error: bookingsError, refetch: refetchBookings } = useBookings(filterStatus);
  const { data: roomsData } = useRooms();
  const { data: usersData } = useUsers();
  
  // Transform API data - ensure array and normalize field names
  const rawBookings = Array.isArray(bookingsData)
    ? bookingsData
    : Array.isArray((bookingsData as any)?.items)
      ? (bookingsData as any).items
      : Array.isArray((bookingsData as any)?.data?.content)
        ? (bookingsData as any).data.content
        : Array.isArray((bookingsData as any)?.content)
          ? (bookingsData as any).content
          : Array.isArray((bookingsData as any)?.data)
            ? (bookingsData as any).data
            : [];
  
  // Normalize rooms and users data
  const rooms = Array.isArray(roomsData) ? roomsData : [];
  const users = Array.isArray(usersData) 
    ? usersData 
    : Array.isArray((usersData as any)?.items) 
      ? (usersData as any).items 
      : Array.isArray((usersData as any)?.data?.content)
        ? (usersData as any).data.content
        : [];
  
  // Normalize dữ liệu - chuyển snake_case sang camelCase và map user/room info
  const bookings: BookingRequest[] = rawBookings.map((item: any) => {
    const userId = item.userId || item.user_id;
    const roomId = item.roomId || item.room_id;
    
    // Tìm room từ rooms data - thử nhiều cách match
    const room = rooms.find((r: any) => {
      const rId = r.id || r.roomId;
      return rId === roomId || 
             String(rId) === String(roomId) ||
             Number(rId) === Number(roomId);
    });
    
    // Tìm user từ users data
    const user = users.find((u: any) => 
      (u.id === userId) || 
      (u.userId === userId) ||
      (String(u.id) === String(userId)) ||
      (String(u.userId) === String(userId))
    );
    
    return {
      id: item.id,
      code: item.code || '',
      userId: userId,
      userName: item.userName || item.user_name || item.user?.name || item.user?.firstName || item.user?.email || item.user?.username || user?.name || user?.firstName || user?.email || user?.username || null,
      roomId: roomId,
      roomCode: item.roomCode || item.room_code || item.room?.code || room?.code || room?.roomCode || room?.roomNumber || null,
      roomName: item.roomName || item.room_name || item.room?.name || room?.name || room?.roomName || null,
      checkinDate: item.checkinDate || item.checkin_date || item.checkInDate || '',
      checkoutDate: item.checkoutDate || item.checkout_date || item.checkOutDate || '',
      numGuests: item.numGuests || item.num_guests || 1,
      note: item.note || '',
      status: item.status || 'PENDING',
      created_at: item.created_at || item.createdAt || '',
      updated_at: item.updated_at || item.updatedAt || ''
    };
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [compact, setCompact] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Track seen bookings to avoid duplicate notifications
  const seenBookingIds = useRef<Set<number>>(new Set());
  const lastBookingCheck = useRef<number>(Date.now());

  // Advanced filters
  const [checkinFrom, setCheckinFrom] = useState('');
  const [checkinTo, setCheckinTo] = useState('');
  const [checkoutFrom, setCheckoutFrom] = useState('');
  const [checkoutTo, setCheckoutTo] = useState('');
  const [guestsMin, setGuestsMin] = useState('');
  const [guestsMax, setGuestsMax] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [roomIdFilter, setRoomIdFilter] = useState('');

  // Auto-hide success/error messages
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [flash]);

  // Check for new bookings and add to notification system
  useEffect(() => {
    // Initialize seen bookings on first load
    if (bookings.length > 0 && seenBookingIds.current.size === 0) {
      bookings.forEach(b => {
        if (b.status === 'PENDING') {
          seenBookingIds.current.add(b.id);
        }
      });
      lastBookingCheck.current = Date.now();
      return;
    }

    // Check for new PENDING bookings
    const newPendingBookings = bookings.filter(b => 
      b.status === 'PENDING' && 
      !seenBookingIds.current.has(b.id) &&
      new Date(b.created_at).getTime() > lastBookingCheck.current
    );

    if (newPendingBookings.length > 0) {
      newPendingBookings.forEach(booking => {
        seenBookingIds.current.add(booking.id);
        
        // Add notification to the notification system (will appear in Header dropdown)
        const guestName = booking.userName || `User #${booking.userId}`;
        const roomInfo = booking.roomName || booking.roomCode || `Room #${booking.roomId}`;
        
        createBookingNotification(
          booking.id,
          guestName,
          roomInfo,
          'PENDING'
        );
      });
      
      lastBookingCheck.current = Date.now();
    }
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bookings.filter(booking => {
      // Search filter
      let searchMatch = true;
      if (q) {
        const hay = [
          booking.code,
          booking.userName || String(booking.userId),
          booking.roomCode || String(booking.roomId),
          booking.note || ''
        ].join(' ').toLowerCase();
        searchMatch = hay.includes(q);
      }

      // Advanced filters
      let advancedMatch = true;
      if (checkinFrom && booking.checkinDate < checkinFrom) advancedMatch = false;
      if (checkinTo && booking.checkinDate > checkinTo) advancedMatch = false;
      if (checkoutFrom && booking.checkoutDate < checkoutFrom) advancedMatch = false;
      if (checkoutTo && booking.checkoutDate > checkoutTo) advancedMatch = false;
      if (guestsMin && booking.numGuests < parseInt(guestsMin)) advancedMatch = false;
      if (guestsMax && booking.numGuests > parseInt(guestsMax)) advancedMatch = false;
      if (userIdFilter && booking.userId !== parseInt(userIdFilter)) advancedMatch = false;
      if (roomIdFilter && booking.roomId !== parseInt(roomIdFilter)) advancedMatch = false;

      return searchMatch && advancedMatch;
    });
  }, [bookings, searchQuery, checkinFrom, checkinTo, checkoutFrom, checkoutTo, guestsMin, guestsMax, userIdFilter, roomIdFilter]);

  const handleApprove = async (booking: BookingRequest) => {
    try {
      const token = authService.getAccessToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/system/bookings?action=approve&id=${booking.id}`, {
        method: 'POST',
        headers
      })
      if (res.ok) {
        setFlash({ type: 'success', text: 'Đã duyệt đặt phòng thành công!' });
        setApprovalModalOpen(false);
        setSelectedBooking(null);
        refetchBookings();
        
        // Create notification
        createBookingNotification(
          booking.id,
          booking.userName || `User #${booking.userId}`,
          booking.roomCode || `Room #${booking.roomId}`,
          'CONFIRMED'
        );
      } else {
        const err = await res.text()
        setFlash({ type: 'error', text: err || 'Có lỗi xảy ra khi duyệt đặt phòng' });
      }
    } catch (error) {
      setFlash({ type: 'error', text: 'Có lỗi xảy ra khi duyệt đặt phòng' });
      console.error('Booking approval error:', error);
    }
  };

  const handleCheckin = async (booking: BookingRequest) => {
    try {
      const res = await fetch(`/api/system/bookings?action=checkin&id=${booking.id}`, {
        method: 'POST'
      })
      if (res.ok) {
        setFlash({ type: 'success', text: 'Check-in thành công!' });
        refetchBookings();
        // Create notification
        createBookingNotification(
          booking.id,
          booking.userName || `User #${booking.userId}`,
          booking.roomCode || `Room #${booking.roomId}`,
          'CONFIRMED'
        );
      } else {
        const err = await res.text()
        setFlash({ type: 'error', text: err || 'Có lỗi xảy ra khi check-in' });
      }
    } catch (error) {
      setFlash({ type: 'error', text: 'Có lỗi xảy ra khi check-in' });
      console.error('Booking checkin error:', error);
    }
  };

  const handleCheckout = async (booking: BookingRequest) => {
    try {
      const response = await apiClient.updateBooking(booking.id, {
        ...booking,
        status: 'CHECKED_OUT'
      });

      if (response.success) {
        setFlash({ type: 'success', text: 'Check-out thành công!' });
        refetchBookings();
        // Create notification
        createBookingNotification(
          booking.id,
          booking.userName || `User #${booking.userId}`,
          booking.roomCode || `Room #${booking.roomId}`,
          'CONFIRMED'
        );
      } else {
        setFlash({ type: 'error', text: response.error || 'Có lỗi xảy ra khi check-out' });
      }
    } catch (error) {
      setFlash({ type: 'error', text: 'Có lỗi xảy ra khi check-out' });
      console.error('Booking checkout error:', error);
    }
  };

  const handleReject = async (booking: BookingRequest) => {
    if (!rejectionReason.trim()) {
      setFlash({ type: 'error', text: 'Vui lòng nhập lý do từ chối' });
      return;
    }

    try {
      const response = await apiClient.updateBooking(booking.id, {
        ...booking,
        status: 'REJECTED',
        rejectionReason
      });
      
      if (response.success) {
        setFlash({ type: 'success', text: 'Đã từ chối đặt phòng' });
        setApprovalModalOpen(false);
        setSelectedBooking(null);
        setRejectionReason('');
        refetchBookings();
        
        // Create notification
        createBookingNotification(
          booking.id,
          booking.userName || `User #${booking.userId}`,
          booking.roomCode || `Room #${booking.roomId}`,
          'REJECTED'
        );
      } else {
        setFlash({ type: 'error', text: response.error || 'Có lỗi xảy ra khi từ chối đặt phòng' });
      }
    } catch (error) {
      setFlash({ type: 'error', text: 'Có lỗi xảy ra khi từ chối đặt phòng' });
      console.error('Booking rejection error:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge tone="warning">Chờ duyệt</Badge>;
      case 'APPROVED':
        return <Badge tone="available">Đã duyệt</Badge>;
      case 'REJECTED':
        return <Badge tone="rejected">Từ chối</Badge>;
      case 'CHECKED_IN':
        return <Badge tone="occupied">Đã nhận phòng</Badge>;
      case 'CHECKED_OUT':
        return <Badge tone="maintenance">Đã trả phòng</Badge>;
      case 'CANCELLED':
        return <Badge tone="rejected">Đã hủy</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const resetAdvancedFilters = () => {
    setCheckinFrom('');
    setCheckinTo('');
    setCheckoutFrom('');
    setCheckoutTo('');
    setGuestsMin('');
    setGuestsMax('');
    setUserIdFilter('');
    setRoomIdFilter('');
  };

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-transparent shadow-sm px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Quản lý đặt phòng</h1>
              <p className="text-sm lg:text-base text-gray-600 mt-1">Theo dõi và xử lý yêu cầu đặt phòng</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-5 sm:py-6">
        <div className="space-y-5 sm:space-y-6">
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

          {/* Toolbar */}
          <Card>
            <CardBody>
              <div className="space-y-4">
                {/* Search, Status Filter and View Toggle */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm đặt phòng theo mã, người đặt, phòng..."
                      className="w-full px-3 py-2 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Tìm kiếm đặt phòng"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      className="px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex-1 sm:flex-none min-w-[100px]"
                      aria-label="Lọc theo trạng thái"
                    >
                      <option value="ALL">Tất cả</option>
                      <option value="PENDING">Chờ duyệt</option>
                      <option value="APPROVED">Đã duyệt</option>
                      <option value="REJECTED">Từ chối</option>
                      <option value="CHECKED_IN">Đã nhận</option>
                      <option value="CHECKED_OUT">Đã trả</option>
                      <option value="CANCELLED">Đã hủy</option>
                    </select>
                    <Button
                      variant={showAdvanced ? "primary" : "secondary"}
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4"
                    >
                       Bộ lọc
                    </Button>
                  </div>
                </div>

                {/* Advanced Filters */}
                {showAdvanced && (
                  <div className="border-t pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Check-in từ</label>
                        <input
                          type="date"
                          value={checkinFrom}
                          onChange={(e) => setCheckinFrom(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Check-in đến</label>
                        <input
                          type="date"
                          value={checkinTo}
                          onChange={(e) => setCheckinTo(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Check-out từ</label>
                        <input
                          type="date"
                          value={checkoutFrom}
                          onChange={(e) => setCheckoutFrom(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Check-out đến</label>
                        <input
                          type="date"
                          value={checkoutTo}
                          onChange={(e) => setCheckoutTo(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Số khách tối thiểu</label>
                        <input
                          type="number"
                          min="1"
                          value={guestsMin}
                          onChange={(e) => setGuestsMin(e.target.value)}
                          placeholder="Min"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Số khách tối đa</label>
                        <input
                          type="number"
                          min="1"
                          value={guestsMax}
                          onChange={(e) => setGuestsMax(e.target.value)}
                          placeholder="Max"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">ID người dùng</label>
                        <input
                          type="number"
                          value={userIdFilter}
                          onChange={(e) => setUserIdFilter(e.target.value)}
                          placeholder="User ID"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">ID phòng</label>
                        <input
                          type="number"
                          value={roomIdFilter}
                          onChange={(e) => setRoomIdFilter(e.target.value)}
                          placeholder="Room ID"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button variant="secondary" onClick={resetAdvancedFilters} className="text-sm">
                        Đặt lại
                      </Button>
                      <Button variant="primary" onClick={() => setShowAdvanced(false)} className="text-sm">
                        Áp dụng
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Bookings Table */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">
                Danh sách đặt phòng ({filteredBookings.length})
              </h3>
            </CardHeader>
            <CardBody>
              {bookingsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-md bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500">Không có đặt phòng nào</p>
                  <div className="mt-4">
                    <Button variant="secondary" onClick={() => refetchBookings()}>
                      Làm mới
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="block md:hidden space-y-3">
                    {filteredBookings.map((booking) => (
                      <Card key={booking.id}>
                        <CardBody>
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 mb-1">{booking.code}</div>
                                <div className="text-sm text-gray-600">
                                  {booking.userName || `User #${booking.userId}`}
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                  {booking.roomName || booking.roomCode || `Room #${booking.roomId}`}
                                </div>
                              </div>
                              <div className="ml-2">
                                {getStatusBadge(booking.status)}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500">CI:</span> {booking.checkinDate}
                              </div>
                              <div>
                                <span className="text-gray-500">CO:</span> {booking.checkoutDate}
                              </div>
                              <div>
                                <span className="text-gray-500">Khách:</span> {booking.numGuests}
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 pt-2 border-t">
                              {booking.status === 'PENDING' && (
                                <>
                                  <Button
                                    onClick={() => {
                                      setSelectedBooking(booking);
                                      setApprovalModalOpen(true);
                                    }}
                                    variant="primary"
                                    className="text-xs flex-1 min-w-[80px]"
                                  >
                                    Duyệt
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setSelectedBooking(booking);
                                      setApprovalModalOpen(true);
                                    }}
                                    variant="danger"
                                    className="text-xs flex-1 min-w-[80px]"
                                  >
                                    Từ chối
                                  </Button>
                                </>
                              )}
                              {booking.status === 'APPROVED' && (
                                <Button
                                  onClick={() => handleCheckin(booking)}
                                  variant="secondary"
                                  className="text-xs flex-1"
                                >
                                  Check-in
                                </Button>
                              )}
                              {booking.status === 'CHECKED_IN' && (
                                <Button
                                  onClick={() => handleCheckout(booking)}
                                  variant="secondary"
                                  className="text-xs flex-1"
                                >
                                  Check-out
                                </Button>
                              )}
                              <Button
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setDetailModalOpen(true);
                                }}
                                variant="secondary"
                                className="text-xs flex-1"
                              >
                                Chi tiết
                              </Button>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <div className="min-w-[800px]">
                      <Table>
                        <THead>
                          <tr>
                            <th className="px-3 lg:px-4 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap text-xs lg:text-sm">Mã đặt phòng</th>
                            <th className="px-2 lg:px-3 py-3 bg-gray-50 sticky top-0 z-10 text-center max-w-[120px] text-xs lg:text-sm">Người đặt</th>
                            <th className="px-3 lg:px-4 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap text-xs lg:text-sm">Phòng</th>
                            <th className="px-3 lg:px-4 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap text-xs lg:text-sm">Thời gian</th>
                            <th className="px-3 lg:px-4 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap text-xs lg:text-sm">Số khách</th>
                            <th className="px-3 lg:px-4 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap text-xs lg:text-sm">Trạng thái</th>
                            <th className="px-3 lg:px-4 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap text-xs lg:text-sm">Hành động</th>
                          </tr>
                        </THead>
                        <TBody>
                          {filteredBookings.map((booking) => (
                            <tr key={booking.id} className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                              <td className="px-3 lg:px-4 py-3 align-middle whitespace-nowrap">
                                <div className="font-medium text-gray-900 text-xs lg:text-sm">{booking.code}</div>
                              </td>
                              <td className="px-2 lg:px-3 py-3 align-middle max-w-[120px]">
                                <div className="font-medium text-gray-900 text-xs lg:text-sm break-words">
                                  {booking.userName || `User #${booking.userId}`}
                                </div>
                              </td>
                              <td className="px-3 lg:px-4 py-3 align-middle whitespace-nowrap">
                                <div className="font-medium text-gray-900 text-xs lg:text-sm">
                                  {booking.roomName || booking.roomCode || `Room #${booking.roomId}`}
                                </div>
                              </td>
                              <td className="px-3 lg:px-4 py-3 align-middle">
                                <div className="text-xs lg:text-sm">
                                  <div className="text-gray-900">CI: {booking.checkinDate}</div>
                                  <div className="text-gray-900">CO: {booking.checkoutDate}</div>
                                  <div className="text-gray-500 text-xs mt-1">
                                    Đặt lúc: {booking.created_at 
                                      ? (() => {
                                          const date = new Date(booking.created_at);
                                          return isNaN(date.getTime()) 
                                            ? booking.created_at 
                                            : date.toLocaleString('vi-VN');
                                        })()
                                      : 'N/A'}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 lg:px-4 py-3 align-middle whitespace-nowrap">
                                <div className="text-xs lg:text-sm text-gray-900">{booking.numGuests} khách</div>
                              </td>
                              <td className="px-3 lg:px-4 py-3 align-middle whitespace-nowrap">
                                {getStatusBadge(booking.status)}
                              </td>
                              <td className="px-3 lg:px-4 py-3 align-middle whitespace-nowrap">
                                <div className="flex flex-col gap-1.5">
                                  {booking.status === 'PENDING' && (
                                    <div className="flex gap-1.5">
                                      <Button
                                        onClick={() => {
                                          setSelectedBooking(booking);
                                          setApprovalModalOpen(true);
                                        }}
                                        variant="primary"
                                        className="text-xs px-2 py-1"
                                      >
                                        Duyệt
                                      </Button>
                                      <Button
                                        onClick={() => {
                                          setSelectedBooking(booking);
                                          setApprovalModalOpen(true);
                                        }}
                                        variant="danger"
                                        className="text-xs px-2 py-1"
                                      >
                                        Từ chối
                                      </Button>
                                    </div>
                                  )}
                                  {booking.status === 'APPROVED' && (
                                    <Button
                                      onClick={() => handleCheckin(booking)}
                                      variant="secondary"
                                      className="text-xs px-2 py-1"
                                    >
                                      Check-in
                                    </Button>
                                  )}
                                  {booking.status === 'CHECKED_IN' && (
                                    <Button
                                      onClick={() => handleCheckout(booking)}
                                      variant="secondary"
                                      className="text-xs px-2 py-1"
                                    >
                                      Check-out
                                    </Button>
                                  )}
                                  <Button
                                    onClick={() => {
                                      setSelectedBooking(booking);
                                      setDetailModalOpen(true);
                                    }}
                                    variant="secondary"
                                    className="text-xs px-2 py-1"
                                  >
                                    Chi tiết
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </TBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedBooking(null);
        }}
        title={selectedBooking ? `Chi tiết đặt phòng - ${selectedBooking.code}` : ''}
        footer={
          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setDetailModalOpen(false);
                setSelectedBooking(null);
              }}
            >
              Đóng
            </Button>
          </div>
        }
      >
        {selectedBooking && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-3">Thông tin đặt phòng</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex flex-col">
                  <span className="text-gray-600 text-xs">Mã đặt phòng</span>
                  <span className="font-medium text-gray-900">{selectedBooking.code}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-600 text-xs">Trạng thái</span>
                  <div className="mt-1">{getStatusBadge(selectedBooking.status)}</div>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-600 text-xs">Người đặt</span>
                  <span className="font-medium text-gray-900">{selectedBooking.userName || `User #${selectedBooking.userId}`}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-600 text-xs">Phòng</span>
                  <span className="font-medium text-gray-900">{selectedBooking.roomCode || selectedBooking.roomName || `Room #${selectedBooking.roomId}`}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-600 text-xs">Check-in</span>
                  <span className="font-medium text-gray-900">{selectedBooking.checkinDate}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-600 text-xs">Check-out</span>
                  <span className="font-medium text-gray-900">{selectedBooking.checkoutDate}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-600 text-xs">Số khách</span>
                  <span className="font-medium text-gray-900">{selectedBooking.numGuests} khách</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-600 text-xs">Ngày tạo</span>
                  <span className="font-medium text-gray-900">
                    {selectedBooking.created_at 
                      ? (() => {
                          const date = new Date(selectedBooking.created_at);
                          return isNaN(date.getTime()) 
                            ? selectedBooking.created_at 
                            : date.toLocaleString('vi-VN');
                        })()
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-600 text-xs">Ngày cập nhật</span>
                  <span className="font-medium text-gray-900">
                    {selectedBooking.updated_at 
                      ? (() => {
                          const date = new Date(selectedBooking.updated_at);
                          return isNaN(date.getTime()) 
                            ? selectedBooking.updated_at 
                            : date.toLocaleString('vi-VN');
                        })()
                      : 'N/A'}
                  </span>
                </div>
                {selectedBooking.note && (
                  <div className="flex flex-col sm:col-span-2">
                    <span className="text-gray-600 text-xs">Ghi chú</span>
                    <span className="font-medium text-gray-900">{selectedBooking.note}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Approval Modal */}
      <Modal
        open={approvalModalOpen}
        onClose={() => {
          setApprovalModalOpen(false);
          setSelectedBooking(null);
          setRejectionReason('');
        }}
        title={selectedBooking ? `Xử lý đặt phòng - ${selectedBooking.code}` : ''}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setApprovalModalOpen(false);
                setSelectedBooking(null);
                setRejectionReason('');
              }}
            >
              Hủy
            </Button>
            {selectedBooking && (
              <>
                <Button
                  variant="danger"
                  onClick={() => handleReject(selectedBooking)}
                >
                  Từ chối
                </Button>
                <Button
                  onClick={() => handleApprove(selectedBooking)}
                >
                  Duyệt
                </Button>
              </>
            )}
          </div>
        }
      >
        {selectedBooking && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-2">Thông tin đặt phòng</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="font-medium">Mã đặt phòng:</span> {selectedBooking.code}</div>
                <div><span className="font-medium">Người đặt:</span> {selectedBooking.userName || `User #${selectedBooking.userId}`}</div>
                <div><span className="font-medium">Phòng:</span> {selectedBooking.roomCode || selectedBooking.roomName || `Room #${selectedBooking.roomId}`}</div>
                <div><span className="font-medium">Số khách:</span> {selectedBooking.numGuests}</div>
                <div><span className="font-medium">Check-in:</span> {selectedBooking.checkinDate}</div>
                <div><span className="font-medium">Check-out:</span> {selectedBooking.checkoutDate}</div>
                {selectedBooking.note && <div className="col-span-2"><span className="font-medium">Ghi chú:</span> {selectedBooking.note}</div>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lý do từ chối (nếu có)</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Nhập lý do từ chối (nếu cần)"
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}


