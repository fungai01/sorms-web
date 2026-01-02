"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useBookings, useRooms, useServiceOrders, useStaffTasks } from '@/hooks/useApi'
import { authFetch } from '@/lib/http'

// ===== Types =====
type DateRange = { fromDate: string; toDate: string };
type TasksResp = { todo: number; in_progress: number; done: number; cancelled: number };

// ===== Helpers =====
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { 
  year: "numeric", 
  month: "2-digit", 
  day: "2-digit",
  weekday: "short"
});

const getDefaultDateRange = (): DateRange => {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(today.getDate() - 1);
  
  return {
    fromDate: fromDate.toISOString().split('T')[0],
    toDate: today.toISOString().split('T')[0]
  };
};

// ===== UI Components =====

function DashboardCard({ title, actions, children, className = "" }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden ${className}`}>
      {(title || actions) && (
        <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
          <div className="flex items-center justify-between">
          {title && (
              <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          )}
          {actions}
        </div>
        </CardHeader>
      )}
      <CardBody className={title || actions ? "p-6" : "p-0"}>
      {children}
      </CardBody>
    </Card>
  );
}

function KPICard({ title, value, hint, trend, icon, bgColor = "bg-blue-50", iconColor = "text-blue-600" }: { 
  title: string; 
  value: string; 
  hint?: string; 
  trend?: { value: number; isPositive: boolean };
  bgColor?: string;
  icon?: React.ReactNode;
  iconColor?: string;
}) {
  const isHexBgColor = bgColor?.startsWith('#');
  const isHexIconColor = iconColor?.startsWith('#');

  const iconContainerProps = {
    className: `w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${!isHexBgColor ? bgColor : ''}`,
    style: isHexBgColor ? { backgroundColor: bgColor } : {},
  };

  const iconProps = {
    className: !isHexIconColor ? iconColor : '',
    style: isHexIconColor ? { color: iconColor } : {},
  };

  return (
    <div
      className={`rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow ${!isHexBgColor ? 'bg-white' : ''}`}
      style={isHexBgColor ? { backgroundColor: bgColor } : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
          {hint && <p className="text-sm text-gray-500">{hint}</p>}
      {trend && (
            <div className={`flex items-center gap-1.5 text-xs mt-2 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${trend.isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
          <span className="text-gray-500">so với tháng trước</span>
        </div>
      )}
        </div>
        {icon && (
          <div {...iconContainerProps}>
            <div {...iconProps}>
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DateRangeSelector({ dateRange, setDateRange, onReload }: { 
  dateRange: DateRange; 
  setDateRange: (range: DateRange) => void;
  onReload: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 font-medium">Từ ngày</span>
        <input
          type="date"
          value={dateRange.fromDate}
          onChange={(e) => {
            const newFrom = e.target.value
            if (!newFrom) return
            if (new Date(newFrom) > new Date(dateRange.toDate)) {
              setDateRange({ fromDate: newFrom, toDate: newFrom })
            } else {
              setDateRange({ ...dateRange, fromDate: newFrom })
            }
          }}
          className="h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 font-medium">Đến ngày</span>
        <input
          type="date"
          value={dateRange.toDate}
          min={dateRange.fromDate}
          onChange={(e) => {
            const newTo = e.target.value
            if (!newTo) return
            if (new Date(newTo) < new Date(dateRange.fromDate)) return
            setDateRange({ ...dateRange, toDate: newTo })
          }}
          className="h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
      </div>
      <button
        onClick={onReload}
        className="h-9 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Tải lại
      </button>
    </div>
  );
}

// ===== Charts =====

function useTooltip() {
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(null);
  const show = (x: number, y: number, label: string) => setTip({ x, y, label });
  const hide = () => setTip(null);
  return { tip, show, hide } as const;
}

function Axis({ w, h, pad }: { w: number; h: number; pad: number }) {
  return (
    <g>
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#e5e7eb" strokeWidth="2" />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#e5e7eb" strokeWidth="2" />
    </g>
  );
}

function Grid({ w, h, pad, rows = 4 }: { w: number; h: number; pad: number; rows?: number }) {
  const gh = (h - 2 * pad) / rows;
  return (
    <g>
      {Array.from({ length: rows + 1 }).map((_, i) => (
        <line key={i} x1={pad} y1={pad + i * gh} x2={w - pad} y2={pad + i * gh} stroke="#f8fafc" strokeWidth="1" />
      ))}
    </g>
  );
}

function LineChart({ series, color = "#3b82f6" }: { series: { date: string; count: number }[]; color?: string }) {
  if (!series?.length) return null;
  const w = 560, h = 200, pad = 28;
  const maxY = Math.max(...series.map((s) => s.count), 1);
  const stepX = (w - 2 * pad) / Math.max(1, series.length - 1);
  const pts = series.map((s, i) => ({ x: pad + i * stepX, y: h - pad - (s.count * (h - 2 * pad)) / maxY }));
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const { tip, show, hide } = useTooltip();

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="block w-full h-56">
        <Axis w={w} h={h} pad={pad} />
        <Grid w={w} h={h} pad={pad} />
        <path d={d} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill="white"
            stroke={color}
            strokeWidth="2"
            className="cursor-pointer transition-all"
            onMouseEnter={(e) => show(e.currentTarget.cx.baseVal.value, e.currentTarget.cy.baseVal.value - 12, `${fmtDate(series[i].date)} • ${series[i].count}`)}
            onMouseLeave={hide}
          />
        ))}
      </svg>
      {tip && (
        <div className="pointer-events-none absolute -translate-x-1/2 rounded-lg border bg-white px-3 py-2 text-sm text-gray-700 shadow-lg z-10" style={{ left: tip.x, top: tip.y }}>
          {tip.label}
        </div>
      )}
    </div>
  );
}

function AreaChart({ series, color = "#3b82f6" }: { series: { date: string; count: number }[]; color?: string }) {
  if (!series?.length) return null;
  const w = 560, h = 200, pad = 28;
  const maxY = Math.max(...series.map((s) => s.count), 1);
  const stepX = (w - 2 * pad) / Math.max(1, series.length - 1);
  const pts = series.map((s, i) => ({ x: pad + i * stepX, y: h - pad - (s.count * (h - 2 * pad)) / maxY }));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const area = `M${pad},${h - pad} L ${pts.map((p) => `${p.x},${p.y}`).join(" L ")} L ${w - pad},${h - pad} Z`;
  
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block w-full h-56">
      <Axis w={w} h={h} pad={pad} />
      <Grid w={w} h={h} pad={pad} />
      <defs>
        <linearGradient id={`area-gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#area-gradient-${color})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BarChart({ series, color = "#3b82f6" }: { series: { label: string; value: number }[]; color?: string }) {
  if (!series?.length) return null;
  const w = 560, h = 200, pad = 28;
  const max = Math.max(...series.map((s) => s.value), 1);
  const barW = (w - 2 * pad) / series.length - 6;
  
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block w-full h-56">
      <Axis w={w} h={h} pad={pad} />
      <Grid w={w} h={h} pad={pad} />
      {series.map((s, i) => {
        const x = pad + i * ((w - 2 * pad) / series.length);
        const height = ((h - 2 * pad) * s.value) / max;
        return (
          <rect 
            key={i} 
            x={x} 
            y={h - pad - height} 
            width={barW} 
            height={height} 
            fill={color}
            rx={6}
            className="hover:opacity-80 transition-opacity"
          />
        );
      })}
    </svg>
  );
}

function HBarChart({ series, color = "#3b82f6" }: { series: { label: string; value: number }[]; color?: string }) {
  if (!series?.length) return null;
  const w = 560, h = Math.max(200, 40 + series.length * 26), pad = 28;
  const max = Math.max(...series.map((s) => s.value), 1);
  const barH = (h - 2 * pad) / series.length - 6;
  
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block w-full" style={{ height: h }}>
      <Axis w={w} h={h} pad={pad} />
      <Grid w={w} h={h} pad={pad} />
      {series.map((s, i) => {
        const y = pad + i * ((h - 2 * pad) / series.length);
        const width = ((w - 2 * pad) * s.value) / max;
        return (
          <g key={i}>
            <rect x={pad} y={y} width={width} height={barH} fill={color} rx={6} className="hover:opacity-80 transition-opacity" />
            <text 
              x={pad} 
              y={y + barH / 2} 
              dominantBaseline="middle" 
              textAnchor="start" 
              className="fill-gray-700 text-xs font-medium"
            >
              {s.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
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

function Empty() {
  return null;
}

function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

function Stacked({ tasks }: { tasks: TasksResp }) {
  const total = tasks.todo + tasks.in_progress + tasks.done + tasks.cancelled;
  // Colors matching Badge.tsx but lighter: pending (orange-100), in-progress (primary/0.12), completed (green-100), cancelled (red-100)
  const segments = [
    { label: 'Chờ xử lý', value: tasks.todo, color: '#ffedd5', percentage: total > 0 ? (tasks.todo / total) * 100 : 0 }, // orange-100
    { label: 'Đang thực hiện', value: tasks.in_progress, color: '#dbeafe', percentage: total > 0 ? (tasks.in_progress / total) * 100 : 0 }, // blue-100 (lighter primary)
    { label: 'Hoàn thành', value: tasks.done, color: '#dcfce7', percentage: total > 0 ? (tasks.done / total) * 100 : 0 }, // green-100
    { label: 'Đã hủy', value: tasks.cancelled, color: '#fee2e2', percentage: total > 0 ? (tasks.cancelled / total) * 100 : 0 }, // red-100
  ];

  return (
    <div className="space-y-3">
      <div className="flex h-8 w-full overflow-hidden rounded-full bg-gray-100">
        {segments.map((segment, index) => (
          segment.percentage > 0 && (
            <div
              key={index}
              style={{
                width: `${segment.percentage}%`,
                backgroundColor: segment.color,
              }}
              className="transition-all duration-300 hover:opacity-80"
              title={`${segment.label}: ${segment.value}`}
            />
          )
        ))}
      </div>
      <div className="text-center text-sm text-gray-600">
        Tổng cộng: <span className="font-semibold">{total}</span> công việc
      </div>
    </div>
  );
}

function ExportCSV({ filename, rows }: { filename: string; rows: any[] }) {
  const handleExport = () => {
    if (!rows || rows.length === 0) {
      alert('Không có dữ liệu để xuất');
      return;
    }
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        headers.map(header => {
          const value = row[header];
          const stringValue = String(value || '');
          return stringValue.includes(',') ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
        }).join(',')
      )
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      onClick={handleExport}
      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
    >
      Xuất CSV
    </button>
  );
}

// ===== Main Component =====

export default function AdminHome() {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Use hooks to fetch data - refetch when refreshTrigger changes
  const { data: roomsData, loading: roomsLoading, refetch: refetchRooms } = useRooms();
  const { data: bookingsData, loading: bookingsLoading, refetch: refetchBookings } = useBookings();
  const { data: serviceOrdersData, loading: ordersLoading, refetch: refetchOrders } = useServiceOrders();
  const { data: tasksData, loading: tasksLoading, refetch: refetchTasks } = useStaffTasks();

  // Fetch payments
  const [paymentsData, setPaymentsData] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setPaymentsLoading(true);
        const res = await authFetch('/api/system/payments', {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
          setPaymentsData(items);
        }
      } catch (error) {
        console.error('Error fetching payments:', error);
      } finally {
        setPaymentsLoading(false);
      }
    };
    fetchPayments();
  }, [refreshTrigger]);

  // Refetch all data when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      refetchRooms();
      refetchBookings();
      refetchOrders();
      refetchTasks();
    }
  }, [refreshTrigger, refetchRooms, refetchBookings, refetchOrders, refetchTasks]);

  const loading = roomsLoading || bookingsLoading || ordersLoading || tasksLoading || paymentsLoading;

  // Calculate KPIs from hooks data
  const kpis = useMemo(() => {
    const rooms = Array.isArray(roomsData) ? roomsData : [];
    const bookings = Array.isArray(bookingsData) ? bookingsData : [];
    const orders = Array.isArray(serviceOrdersData) ? serviceOrdersData : [];
    const tasks = Array.isArray(tasksData) ? tasksData : [];
    const payments = Array.isArray(paymentsData) ? paymentsData : [];

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter((r: any) => r.status === 'OCCUPIED').length;
    const pendingBookings = bookings.filter((b: any) => b.status === 'PENDING').length;

    // Calculate today's revenue from service orders (not bookings)
    const today = new Date().toISOString().split('T')[0];
    const todayServiceOrders = orders.filter((so: any) => {
      // Get paid amount from various possible field names
      const paidAmount = so.paidAmount || so.paid_amount || so.amountPaid || so.amount_paid || 0;
      if (paidAmount <= 0) return false;
      
      // Check if updated today (prefer updated_at, fallback to created_at)
      const updateDate = so.updated_at?.split('T')[0] || so.updatedAt?.split('T')[0] || so.created_at?.split('T')[0] || so.createdAt?.split('T')[0];
      return updateDate === today;
    });
    const paymentsToday = todayServiceOrders.length;
    const revenueToday = todayServiceOrders.reduce((sum: number, so: any) => {
      const paidAmount = so.paidAmount || so.paid_amount || so.amountPaid || so.amount_paid || 0;
      return sum + paidAmount;
    }, 0);

    // Calculate tasks todo
    const tasksTodo = tasks.filter((t: any) => {
      const status = (t.status || '').toUpperCase();
      return status === 'TODO' || status === 'OPEN' || status === 'IN_PROGRESS';
    }).length;

    return {
      totalRooms,
      occupiedRooms,
      pendingBookings,
      paymentsToday,
      revenueToday,
      tasksTodo
    };
  }, [roomsData, bookingsData, serviceOrdersData, tasksData]);

  // Calculate tasks summary
  const tasksSummary = useMemo(() => {
    const tasks = Array.isArray(tasksData) ? tasksData : [];
    return {
      todo: tasks.filter((t: any) => ['TODO', 'OPEN'].includes((t.status || '').toUpperCase())).length,
      in_progress: tasks.filter((t: any) => (t.status || '').toUpperCase() === 'IN_PROGRESS').length,
      done: tasks.filter((t: any) => ['DONE', 'COMPLETED'].includes((t.status || '').toUpperCase())).length,
      cancelled: tasks.filter((t: any) => (t.status || '').toUpperCase() === 'CANCELLED').length,
    };
  }, [tasksData]);

  const occupancyPercent = useMemo(() => Math.round((kpis.occupiedRooms / Math.max(1, kpis.totalRooms)) * 100), [kpis]);

  return (
    <div className="px-6 pt-4 pb-6" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
        <div className="shadow-sm border border-gray-200 rounded-2xl overflow-hidden" style={{ backgroundColor: '#dcebff' }}>
          <div className="border-b border-gray-200/50 px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Dashboard</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Tổng quan hệ thống quản lý nhà công vụ thông minh
                </p>
          </div>
          <DateRangeSelector 
            dateRange={dateRange} 
            setDateRange={setDateRange} 
            onReload={() => setRefreshTrigger(prev => prev + 1)}
          />
        </div>
      </div>
          </div>

        {/* KPIs - 4 Cards */}
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
                title="Phòng đang ở" 
                value={`${kpis.occupiedRooms}/${kpis.totalRooms}`} 
                hint={`Phòng đang có người ở`}
                bgColor="#f4f8ff"
                iconColor="#0277b0" 
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
              />
              <KPICard 
                title="Phòng chờ xử lý" 
                value={String(kpis.pendingBookings)} 
                hint="Cần xử lý"
                bgColor="#f4f8ff"
                iconColor="#0277b0"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
              />
              <KPICard 
                title="Doanh thu" 
                value={fmtCurrency(kpis.revenueToday)} 
                hint={`Đơn hàng đã thanh toán`}
                bgColor="#f4f8ff"
                iconColor="#0277b0"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <KPICard 
                title="Công việc" 
                value={String(kpis.tasksTodo)} 
                hint="Cần thực hiện"
                bgColor="#f4f8ff"
                iconColor="#0277b0"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                }
              />
            </>
          )}
        </section>

        {/* Row 2: Occupancy + Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Occupancy Donut */}
          <DashboardCard title="Phòng đang ở và phòng trống">
            {loading ? <Skeleton className="h-56" /> : (
              <div className="flex items-center gap-6">
                <Donut value={kpis.occupiedRooms} total={kpis.totalRooms} color="#3b82f6" />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-sm text-gray-700">Phòng đang ở</span>
                    </div>
                    <span className="text-lg font-bold text-blue-700">{kpis.occupiedRooms}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-100 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                      <span className="text-sm text-gray-700">Phòng trống</span>
                    </div>
                    <span className="text-lg font-bold text-gray-700">{kpis.totalRooms - kpis.occupiedRooms}</span>
                  </div>
                </div>
              </div>
            )}
          </DashboardCard>

          {/* Tasks Status */}
          <DashboardCard title="Trạng thái công việc">
            {loading ? <Skeleton className="h-56" /> : (
              <div className="space-y-4">
                <Stacked tasks={tasksSummary} />
                 <div className="grid grid-cols-2 gap-2.5">
                   <div className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200" style={{ backgroundColor: '#eff7fe' }}>
                     <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-orange-300"></div>
                       <span className="text-xs text-gray-700 font-medium">Chờ xử lý</span>
                     </div>
                     <span className="text-base font-bold text-gray-800">{tasksSummary.todo}</span>
                   </div>
                   <div className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200" style={{ backgroundColor: '#f2f4f7' }}>
                     <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-blue-300"></div>
                       <span className="text-xs text-gray-700 font-medium">Đang thực hiện</span>
                     </div>
                     <span className="text-base font-bold text-gray-800">{tasksSummary.in_progress}</span>
                   </div>
                   <div className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200" style={{ backgroundColor: '#eff7fe' }}>
                     <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-green-300"></div>
                       <span className="text-xs text-gray-700 font-medium">Hoàn thành</span>
                     </div>
                     <span className="text-base font-bold text-gray-800">{tasksSummary.done}</span>
                   </div>
                   <div className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200" style={{ backgroundColor: '#f2f4f7' }}>
                     <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-red-300"></div>
                       <span className="text-xs text-gray-700 font-medium">Đã hủy</span>
                     </div>
                     <span className="text-base font-bold text-gray-800">{tasksSummary.cancelled}</span>
                   </div>
                 </div>
              </div>
            )}
          </DashboardCard>
        </div>

        </div>
      </div>
  );
}

