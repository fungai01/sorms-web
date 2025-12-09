"use client";

import { useState, useMemo } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useBookings, useRooms } from "@/hooks/useApi";
import * as ExcelJS from 'exceljs';

export default function OfficeReportsPage() {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | string>('ALL');
  const [dateError, setDateError] = useState<string>('');

  const { data: bookingsData, loading: bookingsLoading } = useBookings();
  const { data: roomsData, loading: roomsLoading } = useRooms();
  
  // Normalize data
  const bookings = useMemo(() => {
    if (!bookingsData) return [];
    if (Array.isArray(bookingsData)) return bookingsData;
    const data = bookingsData as any;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
    return [];
  }, [bookingsData]);

  const rooms = useMemo(() => {
    if (!roomsData) return [];
    if (Array.isArray(roomsData)) return roomsData;
    const data = roomsData as any;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
    return [];
  }, [roomsData]);

  // Filter bookings by time range
  const filteredBookings = useMemo(() => {
    if (!Array.isArray(bookings)) return [];
    
    const now = new Date();
    let cutoff: Date | null = null;
    
    if (timeRange === 'today') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timeRange === 'week') {
      cutoff = new Date(now);
      cutoff.setDate(now.getDate() - 7);
    } else if (timeRange === 'month') {
      cutoff = new Date(now);
      cutoff.setDate(now.getDate() - 30);
    } else if (timeRange === 'custom') {
      // Nếu có lỗi validation, không filter
      if (dateError) return bookings;
      
      const from = customFrom ? new Date(customFrom) : null;
      const to = customTo ? new Date(customTo) : null;
      
      // Nếu chưa có đủ thông tin, không filter
      if (!from || !to) return bookings;
      
      return bookings.filter((b: any) => {
        const created = new Date(b.created_at || b.createdAt || Date.now());
        if (from && created < new Date(from.getFullYear(), from.getMonth(), from.getDate())) return false;
        if (to && created > new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999)) return false;
        if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
        return true;
      });
    }
    
    let filtered = cutoff 
      ? bookings.filter((b: any) => new Date(b.created_at || b.createdAt || Date.now()) >= cutoff!)
      : bookings;
    
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((b: any) => b.status === statusFilter);
    }
    
    return filtered;
  }, [bookings, timeRange, customFrom, customTo, statusFilter, dateError]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalBookings = filteredBookings.length;
    const pendingBookings = filteredBookings.filter((b: any) => b.status === 'PENDING').length;
    const approvedBookings = filteredBookings.filter((b: any) => b.status === 'APPROVED').length;
    const rejectedBookings = filteredBookings.filter((b: any) => b.status === 'REJECTED').length;
    const checkedInBookings = filteredBookings.filter((b: any) => b.status === 'CHECKED_IN').length;
    const checkedOutBookings = filteredBookings.filter((b: any) => b.status === 'CHECKED_OUT').length;
    const cancelledBookings = filteredBookings.filter((b: any) => b.status === 'CANCELLED').length;

    const totalRevenue = filteredBookings
      .filter((b: any) => ['APPROVED', 'CHECKED_IN', 'CHECKED_OUT'].includes(b.status))
      .reduce((sum: number, b: any) => {
        const price = b.totalPrice || b.total_price || b.amount || 0;
        return sum + (typeof price === 'number' && Number.isFinite(price) ? price : 0);
      }, 0);

    const approvalRate = totalBookings > 0 ? Math.round((approvedBookings / totalBookings) * 100) : 0;
    const checkInRate = approvedBookings > 0 ? Math.round((checkedInBookings / approvedBookings) * 100) : 0;

    return {
      totalBookings,
      pendingBookings,
      approvedBookings,
      rejectedBookings,
      checkedInBookings,
      checkedOutBookings,
      cancelledBookings,
      totalRevenue,
      approvalRate,
      checkInRate
    };
  }, [filteredBookings]);

  // Room statistics
  const roomStats = useMemo(() => {
    const totalRooms = rooms.length;
    const availableRooms = rooms.filter((r: any) => r.status === 'AVAILABLE').length;
    const occupiedRooms = rooms.filter((r: any) => r.status === 'OCCUPIED').length;
    const maintenanceRooms = rooms.filter((r: any) => r.status === 'MAINTENANCE').length;
    const cleaningRooms = rooms.filter((r: any) => r.status === 'CLEANING').length;
    const outOfServiceRooms = rooms.filter((r: any) => r.status === 'OUT_OF_SERVICE').length;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
    const utilizationRate = totalRooms > 0 ? Math.round(((occupiedRooms + maintenanceRooms + cleaningRooms) / totalRooms) * 100) : 0;

    return {
      totalRooms,
      availableRooms,
      occupiedRooms,
      maintenanceRooms,
      cleaningRooms,
      outOfServiceRooms,
      occupancyRate,
      utilizationRate
    };
  }, [rooms]);

  // Daily summary
  const dailySummary = useMemo(() => {
    const days = timeRange === 'today' ? 1 : timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 30;
    const map: Record<string, { 
      total: number; 
      approved: number; 
      pending: number; 
      rejected: number;
      checkedIn: number;
      checkedOut: number;
      revenue: number;
    }> = {};
    
    filteredBookings.forEach((b: any) => {
      const d = new Date(b.created_at || b.createdAt || Date.now());
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!map[key]) map[key] = { total: 0, approved: 0, pending: 0, rejected: 0, checkedIn: 0, checkedOut: 0, revenue: 0 };
      map[key].total += 1;
      if (b.status === 'APPROVED') map[key].approved += 1;
      else if (b.status === 'PENDING') map[key].pending += 1;
      else if (b.status === 'REJECTED') map[key].rejected += 1;
      else if (b.status === 'CHECKED_IN') map[key].checkedIn += 1;
      else if (b.status === 'CHECKED_OUT') map[key].checkedOut += 1;
      
      if (['APPROVED', 'CHECKED_IN', 'CHECKED_OUT'].includes(b.status)) {
        const price = b.totalPrice || b.total_price || b.amount || 0;
        map[key].revenue += typeof price === 'number' && Number.isFinite(price) ? price : 0;
      }
    });
    
    return Object.entries(map)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, days);
  }, [filteredBookings, timeRange]);

  const exportToExcel = async (type: 'bookings' | 'rooms') => {
    let data: any[] = [];
    let filename = '';
    
    if (type === 'bookings') {
      data = filteredBookings.map((booking: any) => ({
        'ID': booking.id,
        'Mã đặt phòng': booking.code,
        'Người đặt': booking.userName || booking.user?.fullName || `User #${booking.userId}`,
        'Email': booking.userEmail || booking.user?.email || '',
        'ID người dùng': booking.userId,
        'Phòng': booking.roomCode || booking.room?.code || `Room #${booking.roomId}`,
        'ID phòng': booking.roomId,
        'Check-in': booking.checkinDate || booking.checkin_date || '',
        'Check-out': booking.checkoutDate || booking.checkout_date || '',
        'Số khách': booking.numGuests || booking.num_guests || 1,
        'Trạng thái': booking.status,
        'Doanh thu': booking.totalPrice || booking.total_price || booking.amount || 0,
        'Ghi chú': booking.note || '',
        'Ngày tạo': booking.created_at ? new Date(booking.created_at).toLocaleDateString('vi-VN') : ''
      }));
      filename = `bao_cao_dat_phong_${new Date().toISOString().split('T')[0]}.xlsx`;
    } else {
      data = rooms.map((room: any) => ({
        'ID': room.id,
        'Mã phòng': room.code,
        'Tên phòng': room.name || '',
        'Dãy Tòa': room.roomType?.name || `Type ${room.roomTypeId}`,
        'ID Dãy Tòa': room.roomTypeId,
        'Tầng': room.floor || '',
        'Trạng thái': room.status,
        'Mô tả': room.description || ''
      }));
      filename = `bao_cao_phong_${new Date().toISOString().split('T')[0]}.xlsx`;
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');
    if (data.length > 0) {
      worksheet.addRow(Object.keys(data[0]));
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    }
    data.forEach(row => worksheet.addRow(Object.values(row)));
    
    // Auto-fit columns
    worksheet.columns.forEach((column: any) => {
      if (column.header) {
        column.width = 15;
      }
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-transparent shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <div className="flex flex-col gap-4">
            {/* Title and Export Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Báo cáo & Thống kê</h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">Xem và xuất báo cáo chi tiết hệ thống</p>
              </div>
              
              {/* Export Buttons - Hidden on mobile */}
              <div className="hidden sm:flex flex-row gap-2">
                <Button
                  onClick={() => exportToExcel('bookings')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={bookingsLoading}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Xuất Booking
                </Button>
                <Button
                  onClick={() => exportToExcel('rooms')}
                  variant="secondary"
                  disabled={roomsLoading}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Xuất Phòng
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-4 sm:mt-6 space-y-4">
              {/* Time Range */}
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Khoảng thời gian</label>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                  {(['today', 'week', 'month', 'custom'] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        setTimeRange(key);
                        if (key !== 'custom') {
                          setDateError('');
                          setCustomFrom('');
                          setCustomTo('');
                        }
                      }}
                      className={`px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg transition-colors ${
                        timeRange === key
                          ? 'bg-blue-600 text-white'
                          : 'bg-white sm:bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 sm:border-0'
                      }`}
                    >
                      {key === 'today' ? 'Hôm nay' : key === 'week' ? '7 ngày' : key === 'month' ? '30 ngày' : 'Tùy chọn'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Range */}
              {timeRange === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
                  <div className="w-full">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Từ ngày</label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => {
                        const fromDate = e.target.value;
                        setCustomFrom(fromDate);
                        setDateError('');
                        
                        // Nếu đã có "Đến ngày", kiểm tra lại validation
                        if (customTo) {
                          const toDate = new Date(customTo);
                          const fromDateObj = new Date(fromDate);
                          const minToDate = new Date(fromDateObj);
                          minToDate.setDate(minToDate.getDate() + 1);
                          
                          if (toDate <= fromDateObj) {
                            setDateError('Đến ngày phải lớn hơn Từ ngày ít nhất 1 ngày');
                          } else {
                            setDateError('');
                          }
                        }
                      }}
                      max={customTo || undefined}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        dateError ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div className="w-full">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Đến ngày</label>
                    <input
                      type="date"
                      value={customTo}
                      min={customFrom ? (() => {
                        const fromDate = new Date(customFrom);
                        fromDate.setDate(fromDate.getDate() + 1);
                        return fromDate.toISOString().split('T')[0];
                      })() : undefined}
                      onChange={(e) => {
                        const toDate = e.target.value;
                        setCustomTo(toDate);
                        
                        // Validation: Đến ngày phải lớn hơn Từ ngày ít nhất 1 ngày
                        if (customFrom) {
                          const fromDate = new Date(customFrom);
                          const toDateObj = new Date(toDate);
                          const minToDate = new Date(fromDate);
                          minToDate.setDate(minToDate.getDate() + 1);
                          
                          if (toDateObj <= fromDate) {
                            setDateError('Đến ngày phải lớn hơn Từ ngày ít nhất 1 ngày');
                          } else {
                            setDateError('');
                          }
                        } else {
                          setDateError('Vui lòng chọn Từ ngày trước');
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        dateError ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {dateError && (
                      <p className="mt-1 text-xs text-red-600">{dateError}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Status Filter */}
              <div className="w-full sm:min-w-[150px] sm:max-w-[200px]">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Trạng thái</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="PENDING">Chờ duyệt</option>
                  <option value="APPROVED">Đã duyệt</option>
                  <option value="REJECTED">Từ chối</option>
                  <option value="CHECKED_IN">Đã check-in</option>
                  <option value="CHECKED_OUT">Đã check-out</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardBody className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1 truncate">Tổng đặt phòng</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-600">{stats.totalBookings}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardBody className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1 truncate">Đã duyệt</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">{stats.approvedBookings}</p>
                  <p className="text-xs text-gray-500 mt-1">Tỷ lệ: {stats.approvalRate}%</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardBody className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1 truncate">Đã check-in</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-600">{stats.checkedInBookings}</p>
                  <p className="text-xs text-gray-500 mt-1">Tỷ lệ: {stats.checkInRate}%</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
            <CardBody className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1 truncate">Doanh thu</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-emerald-600 truncate">{stats.totalRevenue.toLocaleString('vi-VN')}đ</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Booking Status Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Phân bổ trạng thái đặt phòng</h3>
            </CardHeader>
            <CardBody className="p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                {[
                  { label: 'Chờ duyệt', value: stats.pendingBookings, color: '#f59e0b', bg: 'bg-orange-100' },
                  { label: 'Đã duyệt', value: stats.approvedBookings, color: '#22c55e', bg: 'bg-green-100' },
                  { label: 'Đã check-in', value: stats.checkedInBookings, color: '#8b5cf6', bg: 'bg-purple-100' },
                  { label: 'Đã check-out', value: stats.checkedOutBookings, color: '#3b82f6', bg: 'bg-blue-100' },
                  { label: 'Từ chối', value: stats.rejectedBookings, color: '#ef4444', bg: 'bg-red-100' },
                  { label: 'Đã hủy', value: stats.cancelledBookings, color: '#6b7280', bg: 'bg-gray-100' }
                ].map((item) => {
                  const percentage = stats.totalBookings > 0 ? Math.round((item.value / stats.totalBookings) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs sm:text-sm font-medium text-gray-700">{item.label}</span>
                        <span className="text-xs sm:text-sm text-gray-600">{item.value} ({percentage}%)</span>
                      </div>
                      <div className="w-full h-2 sm:h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-2 sm:h-2.5 ${item.bg}`}
                          style={{ width: `${percentage}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Thống kê phòng</h3>
            </CardHeader>
            <CardBody className="p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm font-medium text-gray-700">Tỷ lệ sử dụng</span>
                    <span className="text-xs sm:text-sm font-bold text-blue-600">{roomStats.occupancyRate}%</span>
                  </div>
                  <div className="w-full h-2.5 sm:h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-2.5 sm:h-3 bg-blue-500" style={{ width: `${roomStats.occupancyRate}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-4 pt-2">
                  <div className="text-center p-2 sm:p-3 bg-green-50 rounded-lg">
                    <p className="text-xl sm:text-2xl font-bold text-green-600">{roomStats.availableRooms}</p>
                    <p className="text-xs text-gray-600 mt-1">Trống</p>
                  </div>
                  <div className="text-center p-2 sm:p-3 bg-orange-50 rounded-lg">
                    <p className="text-xl sm:text-2xl font-bold text-orange-600">{roomStats.occupiedRooms}</p>
                    <p className="text-xs text-gray-600 mt-1">Đang dùng</p>
                  </div>
                  <div className="text-center p-2 sm:p-3 bg-yellow-50 rounded-lg">
                    <p className="text-xl sm:text-2xl font-bold text-yellow-600">{roomStats.maintenanceRooms + roomStats.cleaningRooms}</p>
                    <p className="text-xs text-gray-600 mt-1">Bảo trì/Dọn</p>
                  </div>
                  <div className="text-center p-2 sm:p-3 bg-red-50 rounded-lg">
                    <p className="text-xl sm:text-2xl font-bold text-red-600">{roomStats.outOfServiceRooms}</p>
                    <p className="text-xs text-gray-600 mt-1">Ngừng hoạt động</p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Daily Summary Table - hidden as requested */}
        {false && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Tóm tắt theo ngày
                <span className="hidden sm:inline">
                  {timeRange === 'today' && ' (Hôm nay)'}
                  {timeRange === 'week' && ' (7 ngày gần đây)'}
                  {timeRange === 'month' && ' (30 ngày gần đây)'}
                  {timeRange === 'custom' && ' (Khoảng thời gian tùy chọn)'}
                </span>
              </h3>
              <span className="text-xs sm:text-sm text-gray-500">{dailySummary.length} ngày</span>
            </div>
          </CardHeader>
          <CardBody className="p-4 sm:p-6">
            {bookingsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 rounded bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : dailySummary.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-gray-500">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm sm:text-base">Không có dữ liệu trong khoảng thời gian đã chọn</p>
                <p className="text-xs sm:text-sm mt-2">Vui lòng chọn khoảng thời gian khác hoặc kiểm tra lại bộ lọc</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-semibold text-gray-700">Ngày</th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-700">Tổng</th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-700">Chờ duyệt</th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-700">Đã duyệt</th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-700">Từ chối</th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-700">Check-in</th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-700">Check-out</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-700">Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySummary.map((row, idx) => (
                        <tr key={row.date} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td className="px-4 py-3 font-medium text-gray-900">{row.date}</td>
                          <td className="px-4 py-3 text-center text-gray-700">{row.total}</td>
                          <td className="px-4 py-3 text-center">
                            {row.pending > 0 && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">{row.pending}</span>}
                            {row.pending === 0 && <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.approved > 0 && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">{row.approved}</span>}
                            {row.approved === 0 && <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.rejected > 0 && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">{row.rejected}</span>}
                            {row.rejected === 0 && <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.checkedIn > 0 && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">{row.checkedIn}</span>}
                            {row.checkedIn === 0 && <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.checkedOut > 0 && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{row.checkedOut}</span>}
                            {row.checkedOut === 0 && <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-600">
                            {row.revenue > 0 ? `${row.revenue.toLocaleString('vi-VN')}đ` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile/Tablet: Scrollable Table */}
                <div className="lg:hidden overflow-x-auto -mx-4 sm:-mx-6">
                  <div className="inline-block min-w-full align-middle">
                    <div className="overflow-hidden">
                      <table className="min-w-full text-xs sm:text-sm divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Ngày</th>
                            <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Tổng</th>
                            <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Chờ</th>
                            <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Duyệt</th>
                            <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Từ chối</th>
                            <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">In</th>
                            <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Out</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">Doanh thu</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {dailySummary.map((row, idx) => (
                            <tr key={row.date} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{row.date}</td>
                              <td className="px-2 py-2 text-center text-gray-700">{row.total}</td>
                              <td className="px-2 py-2 text-center">
                                {row.pending > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">{row.pending}</span>}
                                {row.pending === 0 && <span className="text-gray-400 text-xs">-</span>}
                              </td>
                              <td className="px-2 py-2 text-center">
                                {row.approved > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{row.approved}</span>}
                                {row.approved === 0 && <span className="text-gray-400 text-xs">-</span>}
                              </td>
                              <td className="px-2 py-2 text-center">
                                {row.rejected > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">{row.rejected}</span>}
                                {row.rejected === 0 && <span className="text-gray-400 text-xs">-</span>}
                              </td>
                              <td className="px-2 py-2 text-center">
                                {row.checkedIn > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">{row.checkedIn}</span>}
                                {row.checkedIn === 0 && <span className="text-gray-400 text-xs">-</span>}
                              </td>
                              <td className="px-2 py-2 text-center">
                                {row.checkedOut > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{row.checkedOut}</span>}
                                {row.checkedOut === 0 && <span className="text-gray-400 text-xs">-</span>}
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-emerald-600 whitespace-nowrap text-xs">
                                {row.revenue > 0 ? `${row.revenue.toLocaleString('vi-VN')}đ` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}
      </div>
    </>
  );
}
