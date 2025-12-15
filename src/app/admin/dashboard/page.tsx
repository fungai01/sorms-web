"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { authService } from '@/lib/auth-service'
import { useBookings, useRooms, useUsers } from '@/hooks/useApi'

// ===== Types =====
type DateRange = { fromDate: string; toDate: string };
type OccupancyResp = { total: number; occupied: number };
type BookingsResp = { pending: number; series: { date: string; count: number }[] };
type CheckinsResp = { series: { date: string; count: number }[] };
type PaymentsResp = { count: number; sum: number; series: { date: string; sum: number }[] };
type ServicesResp = { top: { name: string; count: number }[] };
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

function Card({ title, actions, children, className = "" }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-5 flex items-center justify-between">
          {title && (
            <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          )}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

function KPICard({ title, value, hint, trend, bgColor = "bg-blue-50" }: { 
  title: string; 
  value: string; 
  hint?: string; 
  trend?: { value: number; isPositive: boolean };
  bgColor?: string;
}) {
  return (
    <div className={`rounded-2xl ${bgColor} p-5`}>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{title}</div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      {hint && <div className="text-sm text-gray-600">{hint}</div>}
      {trend && (
        <div className={`flex items-center gap-1 text-xs mt-2 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${trend.isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
            {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
          </span>
          <span className="text-gray-500">so với tháng trước</span>
        </div>
      )}
    </div>
  );
}

function DateRangeSelector({ dateRange, setDateRange, onReload }: { 
  dateRange: DateRange; 
  setDateRange: (range: DateRange) => void;
  onReload: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Từ ngày</span>
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
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Đến ngày</span>
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
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
      </div>
      <button
        onClick={onReload}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Reload
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
  if (!series?.length) return <Empty />;
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
  if (!series?.length) return <Empty />;
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
  if (!series?.length) return <Empty />;
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
  if (!series?.length) return <Empty />;
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
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <div className="text-sm">Không có dữ liệu</div>
    </div>
  );
}

function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

function Stacked({ tasks }: { tasks: TasksResp }) {
  const total = tasks.todo + tasks.in_progress + tasks.done + tasks.cancelled;
  const segments = [
    { label: 'Chờ xử lý', value: tasks.todo, color: '#ef4444', percentage: total > 0 ? (tasks.todo / total) * 100 : 0 },
    { label: 'Đang thực hiện', value: tasks.in_progress, color: '#f59e0b', percentage: total > 0 ? (tasks.in_progress / total) * 100 : 0 },
    { label: 'Hoàn thành', value: tasks.done, color: '#22c55e', percentage: total > 0 ? (tasks.done / total) * 100 : 0 },
    { label: 'Đã hủy', value: tasks.cancelled, color: '#9ca3af', percentage: total > 0 ? (tasks.cancelled / total) * 100 : 0 },
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const { data: bookingsData } = useBookings('PENDING');
  const { data: roomsData } = useRooms();
  const { data: usersData } = useUsers();

  const [kpis, setKpis] = useState({ totalRooms: 0, occupiedRooms: 0, pendingBookings: 0, paymentsToday: 0, revenueToday: 0, tasksTodo: 0 });
  const [bookingsSeries, setBookingsSeries] = useState<{ date: string; count: number }[]>([]);
  const [checkinsSeries, setCheckinsSeries] = useState<{ date: string; count: number }[]>([]);
  const [paymentsSeries, setPaymentsSeries] = useState<{ date: string; sum: number }[]>([]);
  const [servicesTop, setServicesTop] = useState<{ name: string; count: number }[]>([]);
  const [tasksSummary, setTasksSummary] = useState<TasksResp>({ todo: 0, in_progress: 0, done: 0, cancelled: 0 });
  const [apiLoaded, setApiLoaded] = useState(false);

  const daysRange = useMemo(() => {
    return Math.ceil((new Date(dateRange.toDate).getTime() - new Date(dateRange.fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [dateRange]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    
    const timeoutId = setTimeout(() => {
      const fetchData = async () => {
        try {
          if (ac.signal.aborted) return;
          
          const token = typeof window !== 'undefined' ? authService.getAccessToken() : null;
          const fetchOptions: RequestInit = { 
            signal: ac.signal,
            credentials: 'include' as RequestCredentials,
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            }
          };
          
          const [occRes, bRes, cRes, pRes, soRes, tRes] = await Promise.all([
            fetch(`/api/dashboard/occupancy?fromDate=${dateRange.fromDate}&toDate=${dateRange.toDate}`, fetchOptions),
            fetch(`/api/dashboard/bookings?fromDate=${dateRange.fromDate}&toDate=${dateRange.toDate}`, fetchOptions),
            fetch(`/api/dashboard/checkins?fromDate=${dateRange.fromDate}&toDate=${dateRange.toDate}`, fetchOptions),
            fetch(`/api/dashboard/payments?fromDate=${dateRange.fromDate}&toDate=${dateRange.toDate}`, fetchOptions),
            fetch(`/api/dashboard/service-orders?fromDate=${dateRange.fromDate}&toDate=${dateRange.toDate}`, fetchOptions),
            fetch(`/api/dashboard/tasks?fromDate=${dateRange.fromDate}&toDate=${dateRange.toDate}`, fetchOptions),
          ]);

          if (ac.signal.aborted) return;

          if (!occRes.ok || !bRes.ok || !cRes.ok || !pRes.ok || !soRes.ok || !tRes.ok) {
            throw new Error('HTTP error');
          }

          const [occ, b, c, p, so, t] = await Promise.all([
            occRes.json() as Promise<OccupancyResp>,
            bRes.json() as Promise<BookingsResp>,
            cRes.json() as Promise<CheckinsResp>,
            pRes.json() as Promise<PaymentsResp>,
            soRes.json() as Promise<ServicesResp>,
            tRes.json() as Promise<TasksResp>,
          ]);

          if (ac.signal.aborted) return;

          setKpis({ 
            totalRooms: occ.total, 
            occupiedRooms: occ.occupied, 
            pendingBookings: b.pending, 
            paymentsToday: p.count, 
            revenueToday: p.sum, 
            tasksTodo: t.todo + t.in_progress 
          });
          setBookingsSeries(b.series);
          setCheckinsSeries(c.series);
          setPaymentsSeries(p.series);
          setServicesTop(so.top);
          setTasksSummary(t);
          setApiLoaded(true);
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return;
          setError(`Không tải được dữ liệu`);
          setApiLoaded(false);
        } finally {
          if (!ac.signal.aborted) setLoading(false);
        }
      };
      fetchData();
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      ac.abort();
    };
  }, [dateRange, refreshTrigger, daysRange]);

  const occupancyPercent = useMemo(() => Math.round((kpis.occupiedRooms / Math.max(1, kpis.totalRooms)) * 100), [kpis]);

  const revenueTrend = useMemo(() => {
    if (paymentsSeries.length < 2) return undefined;
    const last = paymentsSeries[paymentsSeries.length - 1].sum;
    const prevAvg = Math.max(1, Math.round((paymentsSeries.slice(0, -1).reduce((s, x) => s + x.sum, 0)) / (paymentsSeries.length - 1)));
    const diffPct = Math.round(((last - prevAvg) / prevAvg) * 100);
    return { value: Math.abs(diffPct), isPositive: diffPct >= 0 };
  }, [paymentsSeries]);

  return (
    <main className="min-h-screen bg-gray-50" suppressHydrationWarning>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5" suppressHydrationWarning>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">ADMIN - Dashboard</h1>
            <p className="text-sm text-gray-500">Tổng quan hệ thống quản lý nhà công vụ thông minh</p>
          </div>
          <DateRangeSelector 
            dateRange={dateRange} 
            setDateRange={setDateRange} 
            onReload={() => setRefreshTrigger(prev => prev + 1)}
          />
        </div>
      </div>

      <div className="p-6 space-y-6" suppressHydrationWarning>
        {/* API Status */}
        {!loading && !error && apiLoaded && (
          <div className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-lg inline-block">
            Dữ liệu đã được tải từ API
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => { setError(null); setRefreshTrigger(prev => prev + 1); }} className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 rounded-md">
              Thử lại
            </button>
          </div>
        )}

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
                title="Tỉ lệ lấp đầy" 
                value={`${kpis.occupiedRooms}/${kpis.totalRooms}`} 
                hint={`${occupancyPercent}% đang ở`}
                bgColor="bg-blue-50"
              />
              <KPICard 
                title="Đặt phòng chờ" 
                value={String(kpis.pendingBookings)} 
                hint="Cần xử lý"
                bgColor="bg-blue-50"
              />
              <KPICard 
                title="Doanh thu hôm nay" 
                value={fmtCurrency(kpis.revenueToday)} 
                hint={`${kpis.paymentsToday} giao dịch`}
                bgColor="bg-blue-50"
                trend={revenueTrend}
              />
              <KPICard 
                title="Công việc đang chờ" 
                value={String(kpis.tasksTodo)} 
                hint="Cần thực hiện"
                bgColor="bg-blue-50"
              />
            </>
          )}
        </section>

        {/* Row 2: Occupancy + Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Occupancy Donut */}
          <Card title="Tỉ lệ lấp đầy phòng">
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
          </Card>

          {/* Tasks Status */}
          <Card title="Trạng thái công việc">
            {loading ? <Skeleton className="h-56" /> : (
              <div className="space-y-4">
                <Stacked tasks={tasksSummary} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                      <span className="text-sm text-gray-700">Chờ xử lý</span>
                    </div>
                    <span className="text-lg font-bold text-gray-800">{tasksSummary.todo}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                      <span className="text-sm text-gray-700">Đang thực hiện</span>
                    </div>
                    <span className="text-lg font-bold text-gray-800">{tasksSummary.in_progress}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                      <span className="text-sm text-gray-700">Hoàn thành</span>
                    </div>
                    <span className="text-lg font-bold text-gray-800">{tasksSummary.done}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-100 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-400"></div>
                      <span className="text-sm text-gray-700">Đã hủy</span>
                    </div>
                    <span className="text-lg font-bold text-gray-800">{tasksSummary.cancelled}</span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Row 3: Bookings + Checkins Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title={`Xu hướng đặt phòng (${daysRange} ngày)`}>
            {loading ? <Skeleton className="h-64" /> : (
              <div className="space-y-4">
                <LineChart series={bookingsSeries} color="#3b82f6" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <div className="text-lg font-bold text-blue-700">{bookingsSeries.reduce((sum, s) => sum + s.count, 0)}</div>
                    <div className="text-xs text-gray-600">Tổng đặt phòng</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <div className="text-lg font-bold text-blue-700">{Math.round(bookingsSeries.reduce((sum, s) => sum + s.count, 0) / Math.max(1, bookingsSeries.length))}</div>
                    <div className="text-xs text-gray-600">Trung bình/ngày</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <div className="text-lg font-bold text-blue-700">{Math.max(...bookingsSeries.map(s => s.count), 0)}</div>
                    <div className="text-xs text-gray-600">Cao nhất/ngày</div>
                  </div>
                </div>
              </div>
            )}
          </Card>
          
          <Card title={`Lượt check-in (${daysRange} ngày)`}>
            {loading ? <Skeleton className="h-64" /> : (
              <div className="space-y-4">
                <AreaChart series={checkinsSeries} color="#3b82f6" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <div className="text-lg font-bold text-blue-700">{checkinsSeries.reduce((sum, s) => sum + s.count, 0)}</div>
                    <div className="text-xs text-gray-600">Tổng check-in</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <div className="text-lg font-bold text-blue-700">{Math.round(checkinsSeries.reduce((sum, s) => sum + s.count, 0) / Math.max(1, checkinsSeries.length))}</div>
                    <div className="text-xs text-gray-600">Trung bình/ngày</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <div className="text-lg font-bold text-blue-700">{Math.max(...checkinsSeries.map(s => s.count), 0)}</div>
                    <div className="text-xs text-gray-600">Cao nhất/ngày</div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Row 4: Payments + Services */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card 
            title={`Doanh thu thanh toán (${daysRange} ngày)`} 
            actions={<ExportCSV filename={`payments_${daysRange}d.csv`} rows={paymentsSeries.map((s) => ({ Ngày: fmtDate(s.date), DoanhThu: s.sum }))} />}
          >
            {loading ? <Skeleton className="h-64" /> : (
              <div className="space-y-4">
                <BarChart series={paymentsSeries.map((s) => ({ label: fmtDate(s.date), value: s.sum }))} color="#3b82f6" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <div className="text-sm font-bold text-blue-700">{fmtCurrency(paymentsSeries.reduce((sum, s) => sum + s.sum, 0))}</div>
                    <div className="text-xs text-gray-600">Tổng doanh thu</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <div className="text-sm font-bold text-blue-700">{fmtCurrency(Math.round(paymentsSeries.reduce((sum, s) => sum + s.sum, 0) / Math.max(1, paymentsSeries.length)))}</div>
                    <div className="text-xs text-gray-600">Trung bình/ngày</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <div className="text-sm font-bold text-blue-700">{fmtCurrency(Math.max(...paymentsSeries.map(s => s.sum), 0))}</div>
                    <div className="text-xs text-gray-600">Cao nhất/ngày</div>
                  </div>
                </div>
              </div>
            )}
          </Card>
          
          <Card 
            title="Top dịch vụ được sử dụng" 
            actions={<ExportCSV filename={`services_top_${daysRange}d.csv`} rows={servicesTop} />}
          >
            {loading ? <Skeleton className="h-64" /> : (
              servicesTop.length === 0 ? (
                <Empty />
              ) : (
                <div className="space-y-4">
                  <HBarChart series={servicesTop.map((s) => ({ label: s.name, value: s.count }))} color="#3b82f6" />
                  <div className="space-y-2.5">
                    {servicesTop.slice(0, 5).map((service, index) => (
                      <div key={service.name} className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 bg-blue-500 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium text-gray-700">{service.name}</span>
                        </div>
                        <div className="text-sm font-bold text-blue-700">{service.count} lần</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
