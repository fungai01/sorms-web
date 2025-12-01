"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Table, THead, TBody } from "@/components/ui/Table";
import { createBookingNotification } from "@/lib/notifications";
import { useBookings } from "@/hooks/useApi";
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
  // Transform API data
  const bookings: BookingRequest[] = (bookingsData as any) || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [compact, setCompact] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bookings.filter(booking => {
      // Status filter
      const statusMatch = filterStatus === 'ALL' || booking.status === filterStatus;

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

      return statusMatch && searchMatch && advancedMatch;
    });
  }, [bookings, filterStatus, searchQuery, checkinFrom, checkinTo, checkoutFrom, checkoutTo, guestsMin, guestsMax, userIdFilter, roomIdFilter]);

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

  // Calculate KPIs
  const totalBookings = bookings.length;
  const pendingBookings = bookings.filter(b => b.status === 'PENDING').length;
  const approvedBookings = bookings.filter(b => b.status === 'APPROVED').length;
  const today = new Date().toISOString().split('T')[0];
  const todayCheckins = bookings.filter(b => b.checkinDate === today).length;

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

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Tổng đặt phòng</p>
                    <p className="text-2xl font-bold text-blue-600">{totalBookings}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Chờ duyệt</p>
                    <p className="text-2xl font-bold text-orange-600">{pendingBookings}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Đã duyệt</p>
                    <p className="text-2xl font-bold text-green-600">{approvedBookings}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Check-in hôm nay</p>
                    <p className="text-2xl font-bold text-purple-600">{todayCheckins}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Toolbar */}
          <Card>
            <CardBody>
              <div className="space-y-4">
                {/* Status Filter and Search */}
                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {([
                      { key: 'ALL', label: `Tất cả (${bookings.length})` },
                      { key: 'PENDING', label: `Chờ duyệt (${bookings.filter(b => b.status === 'PENDING').length})` },
                      { key: 'APPROVED', label: `Đã duyệt (${bookings.filter(b => b.status === 'APPROVED').length})` },
                      { key: 'REJECTED', label: `Từ chối (${bookings.filter(b => b.status === 'REJECTED').length})` },
                      { key: 'CHECKED_IN', label: `Đã nhận (${bookings.filter(b => b.status === 'CHECKED_IN').length})` },
                      { key: 'CHECKED_OUT', label: `Đã trả (${bookings.filter(b => b.status === 'CHECKED_OUT').length})` },
                      { key: 'CANCELLED', label: `Đã hủy (${bookings.filter(b => b.status === 'CANCELLED').length})` },
                    ] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setFilterStatus(key as any)}
                        className={
                          "px-3 py-1.5 rounded-full text-sm border transition-colors " +
                          (filterStatus === key
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")
                        }
                        aria-pressed={filterStatus === key}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search and View Toggle */}
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
                    <Button
                      variant={showAdvanced ? "primary" : "secondary"}
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="whitespace-nowrap"
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
                <div className="overflow-x-auto">
                <div className="sm:min-w-[1000px]">
                <Table>
                  <THead>
                    <tr>
                      <th className="px-4 sm:px-6 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap">Mã đặt phòng</th>
                      <th className="px-4 sm:px-6 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap">Người đặt</th>
                      <th className="px-4 sm:px-6 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap hidden sm:table-cell">Phòng</th>
                      <th className="px-4 sm:px-6 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap">Thời gian</th>
                      <th className="px-4 sm:px-6 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap hidden sm:table-cell">Số khách</th>
                      <th className="px-4 sm:px-6 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap">Trạng thái</th>
                      <th className="px-4 sm:px-6 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap">Hành động</th>
                    </tr>
                  </THead>
                  <TBody>
                    {filteredBookings.map((booking) => (
                      <tr key={booking.id} className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                        <td className="px-4 sm:px-6 py-3 sm:py-4 align-middle whitespace-nowrap">
                          <div className="font-medium text-gray-900">{booking.code}</div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 sm:py-4 align-middle whitespace-nowrap">
                          <div>
                            <div className="font-medium text-gray-900">{booking.userName || `User #${booking.userId}`}</div>
                            <div className="text-sm text-gray-500">ID: {booking.userId}</div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 sm:py-4 align-middle whitespace-nowrap hidden sm:table-cell">
                          <div>
                            <div className="font-medium text-gray-900">{booking.roomCode || `Room #${booking.roomId}`}</div>
                            <div className="text-sm text-gray-500">ID: {booking.roomId}</div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 sm:py-4 align-middle">
                          <div>
                            <div className="text-xs sm:text-sm text-gray-900">CI: {booking.checkinDate}</div>
                            <div className="text-xs sm:text-sm text-gray-900">CO: {booking.checkoutDate}</div>
                            <div className="hidden sm:block text-xs text-gray-500">Đặt lúc: {new Date(booking.created_at).toLocaleString('vi-VN')}</div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 sm:py-4 align-middle whitespace-nowrap hidden sm:table-cell">
                          <div className="text-sm text-gray-900">{booking.numGuests} khách</div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 sm:py-4 align-middle whitespace-nowrap">
                          {getStatusBadge(booking.status)}
                        </td>
                        <td className="px-4 sm:px-6 py-3 sm:py-4 align-middle whitespace-nowrap">
                          <div className="flex flex-col gap-2">
                            {booking.status === 'PENDING' && (
                              <div className="flex space-x-2">
                                <Button
                                  onClick={() => {
                                    setSelectedBooking(booking);
                                    setApprovalModalOpen(true);
                                  }}
                                  variant="primary"
                                  className="text-xs"
                                >
                                  Duyệt
                                </Button>
                                <Button
                                  onClick={() => {
                                    setSelectedBooking(booking);
                                    setApprovalModalOpen(true);
                                  }}
                                  variant="danger"
                                  className="text-xs"
                                >
                                  Từ chối
                                </Button>
                              </div>
                            )}
                            {booking.status === 'APPROVED' && (
                              <Button
                                onClick={() => handleCheckin(booking)}
                                variant="secondary"
                                className="text-xs"
                              >
                                Check-in
                              </Button>
                            )}
                            {booking.status === 'CHECKED_IN' && (
                              <Button
                                onClick={() => handleCheckout(booking)}
                                variant="secondary"
                                className="text-xs"
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
                              className="text-xs"
                            >
                              Xem chi tiết
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </TBody>
                </Table>
                </div>
                </div>
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
                  <span className="text-xs text-gray-500">ID: {selectedBooking.userId}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-600 text-xs">Phòng</span>
                  <span className="font-medium text-gray-900">{selectedBooking.roomCode || `Room #${selectedBooking.roomId}`}</span>
                  <span className="text-xs text-gray-500">ID: {selectedBooking.roomId}</span>
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
                  <span className="font-medium text-gray-900">{new Date(selectedBooking.created_at).toLocaleString('vi-VN')}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-600 text-xs">Ngày cập nhật</span>
                  <span className="font-medium text-gray-900">{new Date(selectedBooking.updated_at).toLocaleString('vi-VN')}</span>
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
                <div><span className="font-medium">Phòng:</span> {selectedBooking.roomCode || `Room #${selectedBooking.roomId}`}</div>
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


