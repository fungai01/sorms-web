"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useBookings, useRooms } from "@/hooks/useApi";
import { useRouter } from "next/navigation";

export default function OfficeDashboard() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  
  // Set user role in sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('userRole', 'office');
    }
  }, []);

  // Use API hooks for data fetching
  const { data: bookingsData, loading: bookingsLoading } = useBookings();
  const { data: roomsData, loading: roomsLoading } = useRooms();

  // Transform API data
  const bookings = (bookingsData as any) || [];
  const rooms = (roomsData as any) || [];

  // Calculate stats
  const totalBookings = bookings.length;
  const pendingBookings = bookings.filter((b: any) => b.status === 'PENDING').length;
  const approvedBookings = bookings.filter((b: any) => b.status === 'APPROVED').length;
  const totalRooms = rooms.length;
  const availableRooms = rooms.filter((r: any) => r.status === 'AVAILABLE').length;
  const occupiedRooms = rooms.filter((r: any) => r.status === 'OCCUPIED').length;
  const maintenanceRooms = rooms.filter((r: any) => r.status === 'MAINTENANCE').length;
  const cleaningRooms = rooms.filter((r: any) => r.status === 'CLEANING').length || 0;

  // Quick actions
  const quickActions = [
    {
      title: "Duyệt đặt phòng",
      description: `${pendingBookings} yêu cầu chờ duyệt`,
      icon: "📋",
      onClick: () => router.push('/office/bookings'),
      variant: "primary" as const
    },
    {
      title: "Quản lý phòng",
      description: `${availableRooms} phòng trống`,
      icon: "🏠",
      onClick: () => router.push('/office/rooms'),
      variant: "secondary" as const
    },
    {
      title: "Báo cáo",
      description: "Xuất báo cáo thống kê",
      icon: "📊",
      onClick: () => router.push('/office/reports'),
      variant: "secondary" as const
    },
    {
      title: "Thông báo",
      description: "Gửi thông báo hệ thống",
      icon: "🔔",
      onClick: () => router.push('/notifications'),
      variant: "ghost" as const
    }
  ];

  // No mocked recent activities. Show only API-derived stats and quick actions.
  const formatTimeAgo = (iso: string) => {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  };

  const recentActivities = (() => {
    const items = (bookings as any[])
      .slice()
      .sort((a: any, b: any) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
      .slice(0, 5)
      .map((b: any) => {
        let action = 'Đặt phòng mới';
        let emoji = '🆕';
        if (b.status === 'APPROVED') { action = 'Đã duyệt đặt phòng'; emoji = '✅'; }
        else if (b.status === 'REJECTED') { action = 'Từ chối đặt phòng'; emoji = '❌'; }
        else if (b.status === 'CHECKED_IN') { action = 'Khách đã nhận phòng'; emoji = '🏨'; }
        else if (b.status === 'CHECKED_OUT') { action = 'Khách đã trả phòng'; emoji = '🔁'; }
        else if (b.status === 'PENDING') { action = 'Yêu cầu chờ duyệt'; emoji = '⏳'; }
        const time = formatTimeAgo(b.updated_at || b.created_at);
        return {
          id: b.id,
          icon: emoji,
          title: `${action} • ${b.code}`,
          subtitle: `${b.userName || `User #${b.userId}`} • ${b.roomCode || `Room #${b.roomId}`}`,
          time
        };
      });
    return items;
  })();

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-transparent shadow-sm px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Dashboard Văn phòng</h1>
              <p className="text-sm lg:text-base text-gray-600 mt-1">Tổng quan hệ thống quản lý phòng</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 bg-white/70 backdrop-blur rounded-full p-1 border border-gray-200">
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
              <Button
                variant="secondary"
                onClick={() => router.push('/office/reports')}
                className="whitespace-nowrap"
                aria-label="Xuất báo cáo nhanh"
              >
                Xuất báo cáo nhanh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-slate-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-5 sm:space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {bookingsLoading || roomsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardBody>
                    <div className="h-16 rounded-md bg-gray-100 animate-pulse" />
                  </CardBody>
                </Card>
              ))
            ) : (
              <>
                <Card>
                  <CardBody>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-gray-600">Tổng đặt phòng</div>
                        <div className="text-2xl font-bold text-blue-600">{totalBookings}</div>
                        <div className="text-xs text-gray-500">{pendingBookings} chờ duyệt</div>
                      </div>
                      <div aria-hidden className="text-xl">📦</div>
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-gray-600">Phòng trống</div>
                        <div className="text-2xl font-bold text-green-600">{availableRooms}</div>
                        <div className="text-xs text-gray-500">{occupiedRooms} đang sử dụng</div>
                      </div>
                      <div aria-hidden className="text-xl">🏠</div>
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-gray-600">Chờ duyệt</div>
                        <div className="text-2xl font-bold text-orange-600">{pendingBookings}</div>
                        <div className="text-xs text-gray-500">{approvedBookings} đã duyệt</div>
                      </div>
                      <div aria-hidden className="text-xl">⏳</div>
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-gray-600">Bảo trì</div>
                        <div className="text-2xl font-bold text-red-600">{maintenanceRooms}</div>
                        <div className="text-xs text-gray-500">Cần xử lý</div>
                      </div>
                      <div aria-hidden className="text-xl">🛠️</div>
                    </div>
                  </CardBody>
                </Card>
              </>
            )}
          </div>

          {/* Quick Actions (hidden on mobile) */}
          <div className="hidden sm:block">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-gray-900">Hành động nhanh</h3>
              </CardHeader>
              <CardBody>
                <div className="grid grid-flow-col auto-cols-[minmax(64px,1fr)] gap-3 overflow-x-auto sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 lg:grid-cols-4">
                  {quickActions.map((action, index) => (
                    <Button
                      key={index}
                      variant={action.variant}
                      onClick={action.onClick}
                      className="flex items-center justify-center sm:justify-start p-3 sm:p-4 h-16 sm:h-auto min-h-14 text-left transition-shadow hover:shadow w-16 sm:w-auto"
                      aria-label={action.title}
                    >
                      <div className="flex items-center sm:space-x-3 w-full sm:w-auto">
                        <div className="flex-shrink-0 text-2xl leading-none">
                          {action.icon}
                        </div>
                        <div className="hidden sm:block flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {action.title}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {action.description}
                          </p>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>


          {/* Biểu đồ tóm tắt */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">Biểu đồ tóm tắt</h3>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Donut phân bổ trạng thái phòng */}
                <div className="flex items-center gap-4">
                  <div className="relative w-28 h-28" role="img" aria-label="Phân bổ trạng thái phòng">
                    {(() => {
                      const total = Math.max(1, availableRooms + occupiedRooms + maintenanceRooms + cleaningRooms);
                      const circumference = 2 * Math.PI * 44; // r=44
                      const segments = [
                        { value: availableRooms, color: '#22c55e', label: 'Trống' },
                        { value: occupiedRooms, color: '#3b82f6', label: 'Sử dụng' },
                        { value: maintenanceRooms, color: '#ef4444', label: 'Bảo trì' },
                        { value: cleaningRooms, color: '#f59e0b', label: 'Đang dọn' },
                      ];
                      let offset = 0;
                      return (
                        <svg viewBox="0 0 100 100" className="w-28 h-28">
                          <circle cx="50" cy="50" r="44" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                          {segments.map((s, i) => {
                            const len = (s.value / total) * circumference;
                            const el = (
                              <circle
                                key={i}
                                cx="50"
                                cy="50"
                                r="44"
                                fill="none"
                                stroke={s.color}
                                strokeWidth="12"
                                strokeDasharray={`${len} ${circumference - len}`}
                                strokeDashoffset={-offset}
                                strokeLinecap="butt"
                              />
                            );
                            offset += len;
                            return el;
                          })}
                          <text x="50" y="54" textAnchor="middle" className="fill-gray-900 text-sm" >{totalRooms}</text>
                        </svg>
                      );
                    })()}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#22c55e' }} /> Trống: {availableRooms}</div>
                    <div className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#3b82f6' }} /> Sử dụng: {occupiedRooms}</div>
                    <div className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444' }} /> Bảo trì: {maintenanceRooms}</div>
                    <div className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} /> Đang dọn: {cleaningRooms}</div>
                  </div>
                </div>

                {/* Mini bars phân bổ trạng thái đặt phòng */}
                <div>
                  <div className="text-sm text-gray-600 mb-2">Trạng thái đặt phòng</div>
                  {(() => {
                    const pending = pendingBookings;
                    const approved = approvedBookings;
                    const rejected = bookings.filter((b: any) => b.status === 'REJECTED').length;
                    const total = Math.max(1, pending + approved + rejected);
                    const rows = [
                      { label: 'Chờ duyệt', value: pending, color: '#f59e0b' },
                      { label: 'Đã duyệt', value: approved, color: '#22c55e' },
                      { label: 'Từ chối', value: rejected, color: '#ef4444' },
                    ];
                    return (
                      <div className="space-y-2">
                        {rows.map((r, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-24 text-xs text-gray-600">{r.label}</div>
                            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-2.5" style={{ width: `${(r.value / total) * 100}%`, background: r.color }} />
                            </div>
                            <div className="w-10 text-right text-xs text-gray-600">{r.value}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">Hoạt động gần đây</h3>
            </CardHeader>
            <CardBody>
              {bookingsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-10 rounded-md bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : recentActivities.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-500">Chưa có hoạt động</div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {recentActivities.map((item) => (
                    <li key={item.id} className="py-3 flex items-center gap-3">
                      <div className="text-xl" aria-hidden>{item.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{item.title}</div>
                        <div className="text-xs text-gray-500 truncate">{item.subtitle}</div>
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">{item.time}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}