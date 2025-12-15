"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Input from "@/components/ui/Input";

type ReportItem = {
  id: number
  date: string
  type: 'BOOKING' | 'PAYMENT' | 'SERVICE' | 'TASK'
  title: string
  amount?: number
  count?: number
}

type StaffRevenue = {
  staffId: number
  staffName: string
  totalAmount: number
  orderCount: number
}

type ReportResponse = {
  summary: {
    totalBookings: number
    totalRevenue: number
    totalServices: number
    openTasks: number
  }
  items: ReportItem[]
  staffRevenues: StaffRevenue[]
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportResponse>({ summary: { totalBookings: 0, totalRevenue: 0, totalServices: 0, openTasks: 0 }, items: [], staffRevenues: [] })
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState<'overview'|'revenue'|'bookings'|'services'|'tasks'|'staff'>('overview')

  // Removed local mock; always use API

  useEffect(() => {
    let aborted = false
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/system/reports', { headers: { 'Content-Type': 'application/json' }, credentials: 'include' })
        const json = await res.json()
        if (!aborted) setData(json)
      } catch {
        if (!aborted) setData({ summary: { totalBookings: 0, totalRevenue: 0, totalServices: 0, openTasks: 0 }, items: [], staffRevenues: [] })
      } finally {
        if (!aborted) setLoading(false)
      }
    }
    fetchData()
    return () => { aborted = true }
  }, [])

  const filtered = useMemo(() => {
    let items = data.items

    // Filter by active tab
    if (activeTab === 'revenue') {
      items = items.filter(i => i.type === 'PAYMENT' || i.type === 'SERVICE')
    } else if (activeTab === 'bookings') {
      items = items.filter(i => i.type === 'BOOKING')
    } else if (activeTab === 'services') {
      items = items.filter(i => i.type === 'SERVICE')
    } else if (activeTab === 'tasks') {
      items = items.filter(i => i.type === 'TASK')
    }
    // 'overview' and 'staff' show all items

    if (dateFrom) items = items.filter(i => i.date >= dateFrom)
    if (dateTo) items = items.filter(i => i.date <= dateTo)
    const q = query.trim().toLowerCase()
    if (q) items = items.filter(i => i.title.toLowerCase().includes(q) || i.type.toLowerCase().includes(q))
    return items
  }, [data.items, dateFrom, dateTo, query, activeTab])

  // Build series for charts from filtered items
  const chartData = useMemo(() => {
    const byDate: Record<string, { revenue: number; bookings: number }> = {}
    for (const i of filtered) {
      const d = i.date
      if (!byDate[d]) byDate[d] = { revenue: 0, bookings: 0 }
      if (i.type === 'BOOKING') byDate[d].bookings += i.count || 0
      if (i.type === 'PAYMENT' || i.type === 'SERVICE') byDate[d].revenue += i.amount || 0
    }
    const dates = Object.keys(byDate).sort()
    const revenueSeries = dates.map(d => byDate[d].revenue)
    const bookingsSeries = dates.map(d => byDate[d].bookings)
    const topRevenueDays = dates
      .map(d => ({ date: d, revenue: byDate[d].revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
    const topBookingDays = dates
      .map(d => ({ date: d, bookings: byDate[d].bookings }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 10)
    return { dates, revenueSeries, bookingsSeries, topRevenueDays, topBookingDays }
  }, [filtered])

  function LineChart({ labels, values, height = 140 }: { labels: string[]; values: number[]; height?: number }) {
    const width = Math.max(300, labels.length * 40)
    const maxVal = Math.max(1, ...values)
    const padding = 24
    const innerW = width - padding * 2
    const innerH = height - padding * 2
    const points = values.map((v, idx) => {
      const x = padding + (labels.length > 1 ? (idx / (labels.length - 1)) * innerW : innerW / 2)
      const y = padding + innerH - (v / maxVal) * innerH
      return [x, y]
    })
    const path = points.map((p, i) => (i === 0 ? `M ${p[0]},${p[1]}` : `L ${p[0]},${p[1]}`)).join(' ')
    return (
      <div className="w-full overflow-x-auto">
        <svg width={width} height={height} className="text-blue-600">
          <rect x={0} y={0} width={width} height={height} fill="white" />
          {/* grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
            <line key={i} x1={padding} x2={width - padding} y1={padding + innerH * t} y2={padding + innerH * t} stroke="#e5e7eb" strokeWidth={1} />
          ))}
          {/* area under line */}
          {points.length > 1 && (
            <path d={`${path} L ${padding + innerW},${padding + innerH} L ${padding},${padding + innerH} Z`} fill="rgba(59,130,246,0.1)" />
          )}
          {/* line */}
          <path d={path} fill="none" stroke="currentColor" strokeWidth={2} />
          {/* points */}
          {points.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r={3} fill="#fff" stroke="#2563eb" strokeWidth={2} />
          ))}
          {/* labels */}
          {labels.map((d, i) => {
            const x = padding + (labels.length > 1 ? (i / (labels.length - 1)) * innerW : innerW / 2)
            return (
              <text key={d} x={x} y={height - 4} textAnchor="middle" className="fill-gray-500 text-[10px]">
                {d.slice(5)}
              </text>
            )
          })}
        </svg>
      </div>
    )
  }

  function BarChart({ labels, values, height = 140 }: { labels: string[]; values: number[]; height?: number }) {
    const width = Math.max(300, labels.length * 40)
    const maxVal = Math.max(1, ...values)
    const padding = 24
    const innerW = width - padding * 2
    const innerH = height - padding * 2
    const barW = labels.length ? innerW / labels.length - 8 : 0
    return (
      <div className="w-full overflow-x-auto">
        <svg width={width} height={height}>
          <rect x={0} y={0} width={width} height={height} fill="white" />
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
            <line key={i} x1={padding} x2={width - padding} y1={padding + innerH * t} y2={padding + innerH * t} stroke="#e5e7eb" strokeWidth={1} />
          ))}
          {labels.map((d, i) => {
            const v = values[i] || 0
            const h = (v / maxVal) * innerH
            const x = padding + i * (barW + 8)
            const y = padding + innerH - h
            return (
              <g key={d}>
                <rect x={x} y={y} width={barW} height={h} fill="#60a5fa" />
                <text x={x + barW / 2} y={height - 4} textAnchor="middle" className="fill-gray-500 text-[10px]">
                  {d.slice(5)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

  // Simple sparkline
  function Sparkline({ values, color = '#2563eb' }: { values: number[]; color?: string }) {
    const width = Math.max(60, values.length * 8)
    const height = 28
    const padding = 4
    const innerW = width - padding * 2
    const innerH = height - padding * 2
    const maxVal = Math.max(1, ...values)
    const points = values.map((v, idx) => {
      const x = padding + (values.length > 1 ? (idx / (values.length - 1)) * innerW : innerW / 2)
      const y = padding + innerH - (v / maxVal) * innerH
      return [x, y]
    })
    const path = points.map((p, i) => (i === 0 ? `M ${p[0]},${p[1]}` : `L ${p[0]},${p[1]}`)).join(' ')
    return (
      <svg width={width} height={height} className="block">
        <path d={path} fill="none" stroke={color} strokeWidth={2} />
      </svg>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-gray-900 truncate">Báo cáo</h1>
            <p className="text-sm text-gray-500">Tổng hợp số liệu hệ thống</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Xuất Excel (CSV)"
              title="Xuất Excel (CSV)"
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"
              onClick={() => {
                const csv = [['ID','Ngày','Loại','Tiêu đề','Số tiền','Số lượng'], ...filtered.map(i => [i.id, i.date, i.type, i.title, i.amount ?? '', i.count ?? ''])]
                const blob = new Blob([csv.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'reports.csv'
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              Xuất Excel
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 py-3">
        <div className="space-y-3">
          {/* Loading indicator */}
          {loading && (
            <div className="rounded-md border p-2 sm:p-3 text-xs sm:text-sm shadow-sm bg-yellow-50 border-yellow-200 text-yellow-800">
              Đang tải dữ liệu báo cáo...
            </div>
          )}

          {/* Controls & Filters */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 rounded-lg">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => { const d = new Date(); const to = d.toISOString().slice(0,10); d.setDate(d.getDate()-6); const from = d.toISOString().slice(0,10); setDateFrom(from); setDateTo(to); }}>7 ngày</Button>
              <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => { const d = new Date(); const to = d.toISOString().slice(0,10); d.setDate(d.getDate()-13); const from = d.toISOString().slice(0,10); setDateFrom(from); setDateTo(to); }}>14 ngày</Button>
              <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => { const d = new Date(); const to = d.toISOString().slice(0,10); d.setDate(d.getDate()-29); const from = d.toISOString().slice(0,10); setDateFrom(from); setDateTo(to); }}>30 ngày</Button>
              <Button className="h-8 px-3 text-xs" onClick={() => { setDateFrom(''); setDateTo(''); setQuery(''); }}>Làm mới</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Từ ngày</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Đến ngày</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Tìm kiếm</label>
                <div className="relative">
                  <Input className="w-full h-9 pl-3 pr-9 text-sm" placeholder="Tìm theo tiêu đề, loại..." value={query} onChange={(e) => setQuery(e.target.value)} />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-gray-600 text-sm">Tổng đặt phòng</div>
              <div className="flex items-end justify-between">
                <div className="text-2xl font-bold text-gray-900">{data.summary.totalBookings}</div>
                <Sparkline values={chartData.bookingsSeries.slice(-10)} color="#10b981" />
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-gray-600 text-sm">Doanh thu</div>
              <div className="flex items-end justify-between">
                <div className="text-2xl font-bold text-gray-900">{data.summary.totalRevenue.toLocaleString('vi-VN')}₫</div>
                <Sparkline values={chartData.revenueSeries.slice(-10)} color="#2563eb" />
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-gray-600 text-sm">Số dịch vụ</div>
              <div className="text-2xl font-bold text-gray-900">{data.summary.totalServices}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-gray-600 text-sm">Công việc mở</div>
              <div className="text-2xl font-bold text-gray-900">{data.summary.openTasks}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-1 flex items-center gap-2 overflow-x-auto">
            {[
              { key: 'overview', label: 'Tổng quan' },
              { key: 'revenue', label: 'Doanh thu' },
              { key: 'bookings', label: 'Đặt phòng' },
              { key: 'services', label: 'Dịch vụ' },
              { key: 'tasks', label: 'Công việc' },
              { key: 'staff', label: 'Nhân viên' },
            ].map(t => (
              <button key={t.key} type="button" onClick={() => setActiveTab(t.key as any)} className={`px-3 py-2 rounded-lg text-sm border ${activeTab===t.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>{t.label}</button>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-gray-700 font-semibold">Doanh thu theo ngày</div>
                <div className="text-xs text-gray-500">{chartData.dates.length} ngày</div>
              </div>
              <LineChart labels={chartData.dates} values={chartData.revenueSeries} />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-gray-700 font-semibold">Lượt đặt phòng theo ngày</div>
                <div className="text-xs text-gray-500">{chartData.dates.length} ngày</div>
              </div>
              <BarChart labels={chartData.dates} values={chartData.bookingsSeries} />
            </div>
          </div>

          {/* Section tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="text-gray-700 font-semibold">Top ngày theo doanh thu</div>
                <button className="text-xs px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50" onClick={() => {
                  const rows = chartData.topRevenueDays.map(r => [r.date, r.revenue])
                  const csv = [['Ngày','Doanh thu'], ...rows]
                  const blob = new Blob([csv.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url; a.download = 'top_revenue_days.csv'; a.click(); URL.revokeObjectURL(url)
                }}>Xuất CSV</button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[480px] w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left">Ngày</th>
                      <th className="px-3 py-2 text-right">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.topRevenueDays.map(r => (
                      <tr key={r.date} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2">{r.date}</td>
                        <td className="px-3 py-2 text-right">{r.revenue.toLocaleString('vi-VN')}₫</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="text-gray-700 font-semibold">Top ngày theo lượt đặt</div>
                <button className="text-xs px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50" onClick={() => {
                  const rows = chartData.topBookingDays.map(r => [r.date, r.bookings])
                  const csv = [['Ngày','Lượt đặt']], blob = new Blob([[...csv, ...rows].map(r => r.join(',')).join('\n')], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url; a.download = 'top_booking_days.csv'; a.click(); URL.revokeObjectURL(url)
                }}>Xuất CSV</button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[480px] w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left">Ngày</th>
                      <th className="px-3 py-2 text-right">Lượt đặt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.topBookingDays.map(r => (
                      <tr key={r.date} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2">{r.date}</td>
                        <td className="px-3 py-2 text-right">{r.bookings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Staff Revenue Table - Only show when staff tab is active */}
          {activeTab === 'staff' && (
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="text-gray-700 font-semibold">Doanh thu theo nhân viên</div>
                <button className="text-xs px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50" onClick={() => {
                  const rows = data.staffRevenues.map(s => [s.staffName, s.orderCount, s.totalAmount])
                  const csv = [['Nhân viên','Số đơn','Doanh thu'], ...rows]
                  const blob = new Blob([csv.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url; a.download = 'staff_revenue.csv'; a.click(); URL.revokeObjectURL(url)
                }}>Xuất CSV</button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[480px] w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left">Nhân viên</th>
                      <th className="px-3 py-2 text-right">Số đơn</th>
                      <th className="px-3 py-2 text-right">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.staffRevenues.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-gray-500">Chưa có dữ liệu</td>
                      </tr>
                    ) : (
                      data.staffRevenues.map(s => (
                        <tr key={s.staffId} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2">{s.staffName}</td>
                          <td className="px-3 py-2 text-right">{s.orderCount}</td>
                          <td className="px-3 py-2 text-right font-semibold text-green-600">{s.totalAmount.toLocaleString('vi-VN')}₫</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Card/Table */}
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-gray-50 border-b border-gray-200 px-6 py-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg text-left font-bold text-gray-900">Danh sách báo cáo</h2>
                <span className="text-sm text-right font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">{filtered.length} mục</span>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-[800px] w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Ngày</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Loại</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Tiêu đề</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Số tiền</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Số lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(i => (
                      <tr key={i.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2">{i.date}</td>
                        <td className="px-3 py-2">{i.type}</td>
                        <td className="px-3 py-2">{i.title}</td>
                        <td className="px-3 py-2 text-right">{i.amount ? i.amount.toLocaleString('vi-VN') + '₫' : '—'}</td>
                        <td className="px-3 py-2 text-right">{i.count ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile list */}
              <div className="lg:hidden p-3 space-y-3">
                {filtered.map(i => (
                  <div key={i.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-900 truncate">{i.title}</div>
                        <div className="text-xs text-gray-600">{i.type}</div>
                      </div>
                    </div>
                    <div className="p-3 space-y-1 text-sm">
                      <div className="flex items-center justify-between"><span className="text-gray-600">Ngày</span><span className="font-medium">{i.date}</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-600">Số tiền</span><span className="font-medium">{i.amount ? i.amount.toLocaleString('vi-VN') + '₫' : '—'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-600">Số lượng</span><span className="font-medium">{i.count ?? '—'}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}


