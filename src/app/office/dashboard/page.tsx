"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useBookings, useRooms } from "@/hooks/useApi";
import { useRouter } from "next/navigation";

// ===== UI Components =====
function KPICard({ title, value, hint }: { 
  title: string; 
  value: string; 
  hint?: string; 
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
          {hint && <p className="text-sm text-gray-500">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

function Donut({ value, total, color = "#3b82f6" }: { value: number; total: number; color?: string }) {
  const size = 180;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? value / total : 0;
  
  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-48 w-48">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c}`}
          strokeDashoffset={`${c * (1 - pct)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="fill-gray-900 text-2xl font-bold">
          {Math.round(pct * 100)}%
        </text>
        <text x="50%" y="60%" dominantBaseline="middle" textAnchor="middle" className="fill-gray-500 text-sm">
          {value}/{total}
        </text>
      </svg>
    </div>
  );
}

export default function OfficeDashboard() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('userRole', 'office');
    }
  }, []);

  const { data: bookingsData, loading: bookingsLoading } = useBookings();
  const { data: roomsData, loading: roomsLoading } = useRooms();

  // Transform API data
  const bookings = Array.isArray(bookingsData)
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
  
  const rooms = Array.isArray(roomsData)
    ? roomsData
    : Array.isArray((roomsData as any)?.items)
      ? (roomsData as any).items
      : Array.isArray((roomsData as any)?.data?.content)
        ? (roomsData as any).data.content
        : Array.isArray((roomsData as any)?.content)
          ? (roomsData as any).content
          : Array.isArray((roomsData as any)?.data)
            ? (roomsData as any).data
            : [];

  // Calculate stats
  const totalBookings = bookings.length;
  const pendingBookings = bookings.filter((b: any) => b.status === 'PENDING').length;
  const approvedBookings = bookings.filter((b: any) => b.status === 'APPROVED').length;
  const totalRooms = rooms.length;
  const availableRooms = rooms.filter((r: any) => r.status === 'AVAILABLE').length;
  const occupiedRooms = rooms.filter((r: any) => r.status === 'OCCUPIED').length;
  const maintenanceRooms = rooms.filter((r: any) => r.status === 'MAINTENANCE').length;
  const cleaningRooms = rooms.filter((r: any) => r.status === 'CLEANING').length || 0;

  const loading = bookingsLoading || roomsLoading;
  const occupancyPercent = useMemo(() => Math.round((occupiedRooms / Math.max(1, totalRooms)) * 100), [occupiedRooms, totalRooms]);


  return (
    <div className="px-6 pt-4 pb-6" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
          <div className="border-b border-gray-200/50 px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Dashboard Hành Chính Chính</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Tổng quan hệ thống quản lý phòng
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 bg-gray-100 rounded-full p-1">
                  {([
                    { key: 'today', label: 'Hôm nay' },
                    { key: 'week', label: 'Tuần' },
                    { key: 'month', label: 'Tháng' },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setTimeRange(key)}
                      className={
                        "px-3 py-1.5 text-sm rounded-full transition-colors " +
                        (timeRange === key ? "bg-[hsl(var(--primary))] text-white" : "text-gray-700 hover:bg-gray-200")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  onClick={() => router.push('/office/reports')}
                >
                  Xuất báo cáo
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {loading ? (
            <>
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </>
          ) : (
            <>
              <KPICard 
                title="Tổng đặt phòng" 
                value={String(totalBookings)} 
                hint={`${pendingBookings} chờ duyệt`}
              />
              <KPICard 
                title="Phòng trống" 
                value={String(availableRooms)} 
                hint={`${occupiedRooms} đang sử dụng`}
              />
              <KPICard 
                title="Chờ duyệt" 
                value={String(pendingBookings)} 
                hint={`${approvedBookings} đã duyệt`}
              />
              <KPICard 
                title="Bảo trì" 
                value={String(maintenanceRooms)} 
                hint="Cần xử lý"
              />
            </>
          )}
        </section>

        {/* Row 2: Room Status & Booking Status - cùng 1 hàng */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Phân bổ trạng thái phòng */}
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
              <h3 className="text-xl font-bold text-gray-900">Phân bổ trạng thái phòng</h3>
            </CardHeader>
            <CardBody className="p-6">
              {loading ? <Skeleton className="h-56" /> : (
                <div className="flex items-center gap-6">
                  <Donut value={occupiedRooms} total={totalRooms} color="#3b82f6" />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-sm text-gray-700">Phòng trống</span>
                      </div>
                      <span className="text-lg font-bold text-green-700">{availableRooms}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-sm text-gray-700">Đang sử dụng</span>
                      </div>
                      <span className="text-lg font-bold text-blue-700">{occupiedRooms}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-sm text-gray-700">Bảo trì</span>
                      </div>
                      <span className="text-lg font-bold text-red-700">{maintenanceRooms}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span className="text-sm text-gray-700">Đang dọn</span>
                      </div>
                      <span className="text-lg font-bold text-yellow-700">{cleaningRooms}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Trạng thái đặt phòng */}
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
              <h3 className="text-xl font-bold text-gray-900">Trạng thái đặt phòng</h3>
            </CardHeader>
            <CardBody className="p-6">
              {loading ? <Skeleton className="h-56" /> : (
                <div className="space-y-4">
                  {(() => {
                    const pending = pendingBookings;
                    const approved = approvedBookings;
                    const rejected = bookings.filter((b: any) => b.status === 'REJECTED').length;
                    const checkedIn = bookings.filter((b: any) => b.status === 'CHECKED_IN').length;
                    const checkedOut = bookings.filter((b: any) => b.status === 'CHECKED_OUT').length;
                    const cancelled = bookings.filter((b: any) => b.status === 'CANCELLED').length;
                    const total = Math.max(1, pending + approved + rejected + checkedIn + checkedOut + cancelled);
                    const rows = [
                      { label: 'Chờ duyệt', value: pending, color: '#f59e0b', bgColor: 'bg-yellow-50' },
                      { label: 'Đã duyệt', value: approved, color: '#22c55e', bgColor: 'bg-green-50' },
                      { label: 'Đã nhận phòng', value: checkedIn, color: '#3b82f6', bgColor: 'bg-blue-50' },
                      { label: 'Đã trả phòng', value: checkedOut, color: '#6366f1', bgColor: 'bg-indigo-50' },
                      { label: 'Từ chối', value: rejected, color: '#ef4444', bgColor: 'bg-red-50' },
                      { label: 'Đã hủy', value: cancelled, color: '#6b7280', bgColor: 'bg-gray-50' },
                    ];
                    return rows.map((r, i) => (
                      <div key={i} className={`flex items-center gap-4 p-3 ${r.bgColor} rounded-xl`}>
                        <div className="w-28 text-sm font-medium text-gray-700">{r.label}</div>
                        <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-3 rounded-full transition-all duration-500" 
                            style={{ width: `${(r.value / total) * 100}%`, background: r.color }} 
                          />
                        </div>
                        <div className="w-12 text-right text-sm font-bold text-gray-900">{r.value}</div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
