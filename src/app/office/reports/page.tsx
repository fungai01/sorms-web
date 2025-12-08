"use client";

import { useState, useMemo } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useBookings, useRooms } from "@/hooks/useApi";
import * as ExcelJS from 'exceljs';

export default function OfficeReportsPage() {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { data: bookingsData, loading: bookingsLoading } = useBookings();
  const { data: roomsData, loading: roomsLoading } = useRooms();
  const bookings = (bookingsData as any) || [];
  const rooms = (roomsData as any) || [];

  // Filter bookings by time range
  const filteredBookings = useMemo(() => {
    if (!Array.isArray(bookings)) return [] as any[];
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
      // Use custom date range
      const from = customFrom ? new Date(customFrom) : null;
      const to = customTo ? new Date(customTo) : null;
      return bookings.filter((b: any) => {
        const created = new Date(b.created_at);
        if (from && created < new Date(from.getFullYear(), from.getMonth(), from.getDate())) return false;
        if (to && created > new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999)) return false;
        return true;
      });
    } else {
      cutoff = null;
    }
    if (!cutoff) return bookings;
    return bookings.filter((b: any) => new Date(b.created_at) >= cutoff!);
  }, [bookings, timeRange]);

  const totalBookings = filteredBookings.length;
  const pendingBookings = filteredBookings.filter((b: any) => b.status === 'PENDING').length;
  const approvedBookings = filteredBookings.filter((b: any) => b.status === 'APPROVED').length;
  const rejectedBookings = filteredBookings.filter((b: any) => b.status === 'REJECTED').length;

  const totalRooms = rooms.length;
  const availableRooms = rooms.filter((r: any) => r.status === 'AVAILABLE').length;
  const occupiedRooms = rooms.filter((r: any) => r.status === 'OCCUPIED').length;
  const maintenanceRooms = rooms.filter((r: any) => r.status === 'MAINTENANCE').length;
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  const dailySummary = useMemo(() => {
    const days = 7;
    const map: Record<string, { total: number; approved: number; pending: number; rejected: number }>= {};
    (filteredBookings as any[]).forEach((b:any) => {
      const d = new Date(b.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!map[key]) map[key] = { total: 0, approved: 0, pending: 0, rejected: 0 };
      map[key].total += 1;
      if (b.status === 'APPROVED') map[key].approved += 1;
      else if (b.status === 'PENDING') map[key].pending += 1;
      else if (b.status === 'REJECTED') map[key].rejected += 1;
    });
    return Object.entries(map).map(([date, v]) => ({ date, ...v }))
      .sort((a,b) => (a.date < b.date ? 1 : -1))
      .slice(0, days);
  }, [filteredBookings]);

  const exportToExcel = async (type: 'bookings' | 'rooms') => {
    let data: any[] = [];
    let filename = '';
    if (type === 'bookings') {
      data = bookings.map((booking: any) => ({
        'ID': booking.id,
        'Mã đặt phòng': booking.code,
        'Người đặt': booking.userName || `User #${booking.userId}`,
        'ID người dùng': booking.userId,
        'Phòng': booking.roomCode || `Room #${booking.roomId}`,
        'ID phòng': booking.roomId,
        'Check-in': booking.checkinDate,
        'Check-out': booking.checkoutDate,
        'Số khách': booking.numGuests,
        'Trạng thái': booking.status,
        'Ghi chú': booking.note || '',
        'Ngày tạo': new Date(booking.created_at).toLocaleDateString('vi-VN')
      }));
      filename = 'bao_cao_dat_phong.xlsx';
    } else {
      data = rooms.map((room: any) => ({
        'ID': room.id,
        'Mã phòng': room.code,
        'Tên phòng': room.name || '',
        'ID Dãy Tòa': room.roomTypeId,
        'Tầng': room.floor || '',
        'Trạng thái': room.status,
        'Mô tả': room.description || ''
      }));
      filename = 'bao_cao_phong.xlsx';
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');
    if (data.length > 0) {
      worksheet.addRow(Object.keys(data[0]));
      worksheet.getRow(1).font = { bold: true };
    }
    data.forEach(row => worksheet.addRow(Object.values(row)));
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-transparent shadow-sm px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Báo cáo & Thống kê</h1>
              <p className="text-sm lg:text-base text-gray-600 mt-1">Xuất báo cáo và xem thống kê hệ thống</p>
            </div>
            <div className="flex items-center gap-2 bg-white rounded-full p-1 border border-gray-200 w-full sm:w-auto">
              {([
                { key: 'today', label: 'Hôm nay' },
                { key: 'week', label: 'Tuần' },
                { key: 'month', label: 'Tháng' },
                { key: 'custom', label: 'Tùy chọn' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTimeRange(key)}
                  className={
                    "px-3 py-1.5 text-sm rounded-full transition-colors " +
                    (timeRange === key ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100")
                  }
                  aria-pressed={timeRange === key}
                >
                  {label}
                </button>
              ))}
            </div>
            {timeRange === 'custom' && (
              <div className="w-full lg:w-auto lg:ml-4 mt-2 lg:mt-0 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Từ ngày</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e)=>setCustomFrom(e.target.value)}
                    className="w-full px-2 py-2 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Chọn ngày bắt đầu"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Đến ngày</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e)=>setCustomTo(e.target.value)}
                    className="w-full px-2 py-2 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Chọn ngày kết thúc"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 space-y-6">
        {/* Export (hidden on mobile) */}
        <div className="hidden sm:block">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Xuất báo cáo</h3>
          </CardHeader>
          <CardBody>
            {bookingsLoading || roomsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-md bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button onClick={() => exportToExcel('bookings')} variant="primary" className="flex items-center justify-center p-5 h-auto text-base" aria-label="Xuất báo cáo đặt phòng">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">📋</span>
                    <div className="text-left">
                      <div className="font-medium">Báo cáo đặt phòng</div>
                      <div className="text-sm text-gray-500">Xuất Excel - {totalBookings} bản ghi</div>
                    </div>
                  </div>
                </Button>
                <Button onClick={() => exportToExcel('rooms')} variant="secondary" className="flex items-center justify-center p-5 h-auto text-base" aria-label="Xuất báo cáo phòng">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">🏠</span>
                    <div className="text-left">
                      <div className="font-medium">Báo cáo phòng</div>
                      <div className="text-sm text-gray-500">Xuất Excel - {totalRooms} phòng</div>
                    </div>
                  </div>
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardBody><div className="text-center"><div className="text-2xl font-bold text-blue-600">{totalBookings}</div><div className="text-sm text-gray-600">Tổng đặt</div></div></CardBody></Card>
          <Card><CardBody><div className="text-center"><div className="text-2xl font-bold text-orange-600">{pendingBookings}</div><div className="text-sm text-gray-600">Chờ duyệt</div></div></CardBody></Card>
          <Card><CardBody><div className="text-center"><div className="text-2xl font-bold text-green-600">{approvedBookings}</div><div className="text-sm text-gray-600">Đã duyệt</div></div></CardBody></Card>
          <Card><CardBody><div className="text-center"><div className="text-2xl font-bold text-red-600">{rejectedBookings}</div><div className="text-sm text-gray-600">Từ chối</div></div></CardBody></Card>
        </div>

        {/* Charts area: simple progress + bars */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">Tỷ lệ sử dụng phòng</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Tỷ lệ sử dụng</span>
                  <span className="font-medium text-gray-900">{occupancyRate}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-3 bg-blue-500" style={{ width: `${occupancyRate}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Occupied: {occupiedRooms}</span>
                  <span>Available: {availableRooms}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">Trạng thái đặt phòng</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                {[{label:'Chờ duyệt', value: pendingBookings, color:'#f59e0b'}, {label:'Đã duyệt', value: approvedBookings, color:'#22c55e'}, {label:'Từ chối', value: rejectedBookings, color:'#ef4444'}].map((r)=> (
                  <div key={r.label} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-gray-600">{r.label}</div>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-2.5" style={{ width: `${totalBookings>0? (r.value/totalBookings)*100 : 0}%`, background: r.color }} />
                    </div>
                    <div className="w-10 text-right text-xs text-gray-600">{r.value}</div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Daily Summary */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Tóm tắt theo ngày (7 ngày gần đây)</h3>
          </CardHeader>
          <CardBody>
            {bookingsLoading ? (
              <div className="space-y-2">{Array.from({length:5}).map((_,i)=>(<div key={i} className="h-8 rounded bg-gray-100 animate-pulse" />))}</div>
            ) : dailySummary.length === 0 ? (
              <div className="text-center text-sm text-gray-500">Hãy chọn khoảng thời gian khác</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[600px] w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-4 py-2">Ngày</th>
                      <th className="text-left px-4 py-2">Tổng đặt</th>
                      <th className="text-left px-4 py-2">Đã duyệt</th>
                      <th className="text-left px-4 py-2">Chờ duyệt</th>
                      <th className="text-left px-4 py-2">Từ chối</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySummary.map((row, idx) => (
                      <tr key={row.date} className={idx%2===0?"bg-white":"bg-gray-50"}>
                        <td className="px-4 py-2 whitespace-nowrap">{row.date}</td>
                        <td className="px-4 py-2">{row.total}</td>
                        <td className="px-4 py-2">{row.approved}</td>
                        <td className="px-4 py-2">{row.pending}</td>
                        <td className="px-4 py-2">{row.rejected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}


