"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TBody } from "@/components/ui/Table";
import { useBookings, useServiceOrders, useStaffTasks } from "@/hooks/useApi";
import { authFetch } from "@/lib/http";

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

// Professional Chart Components
function LineChart({ labels, values, color = "#2563eb", height = 280, title, unit = "" }: { 
  labels: string[], 
  values: number[], 
  color?: string,
  height?: number,
  title?: string,
  unit?: string
}) {
  if (!values.length || values.every(v => v === 0)) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <p className="text-sm">Không có dữ liệu</p>
        </div>
      </div>
    )
  }

  const max = Math.max(...values, 1)
  const min = Math.min(...values.filter(v => v > 0), 0)
  const range = max - min || 1
  const width = 900
  const padding = 60
  const total = values.reduce((a, b) => a + b, 0)
  const avg = total / values.length

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1 || 1)) * (width - 2 * padding)
    const y = height - padding - ((v - min) / range) * (height - 2 * padding)
    return { x, y, value: v, label: labels[i] }
  })

  const pathData = points.map((p, i) => 
    i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`
  ).join(' ')

  // Area under line
  const areaPath = pathData + ` L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`

  return (
    <div className="w-full bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
      {/* Header with stats */}
      {title && (
        <div className="mb-6 pb-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Tổng</div>
              <div className="text-xl font-bold ">{total.toLocaleString('vi-VN')}{unit}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Trung bình</div>
              <div className="text-xl font-bold text-green-600">{Math.round(avg).toLocaleString('vi-VN')}{unit}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Cao nhất</div>
              <div className="text-xl font-bold text-purple-600">{max.toLocaleString('vi-VN')}{unit}</div>
            </div>
          </div>
        </div>
      )}
      
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minHeight: `${height}px` }} preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding + ratio * (height - 2 * padding)
            const value = max - (ratio * range)
            return (
              <g key={ratio}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4" />
                <text x={padding - 15} y={y + 4} textAnchor="end" fontSize="11" fill="#6b7280" fontWeight="500">
                  {value.toFixed(0)}
                </text>
              </g>
            )
          })}
          
          {/* Area under line */}
          <path
            d={areaPath}
            fill={color}
            opacity="0.1"
          />
          
          {/* Line */}
          <path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-sm"
          />
          
          {/* Points with hover */}
          {points.map((p, i) => (
            <g key={i} className="cursor-pointer group">
              <circle cx={p.x} cy={p.y} r="6" fill="white" stroke={color} strokeWidth="3" className="group-hover:r-8 transition-all" />
              <circle cx={p.x} cy={p.y} r="4" fill={color} className="group-hover:opacity-80" />
              <circle cx={p.x} cy={p.y} r="12" fill={color} opacity="0.1" className="group-hover:opacity-20 transition-opacity" />
              
              {/* Tooltip */}
              <g className="opacity-0 group-hover:opacity-100 transition-opacity">
                <rect x={p.x - 50} y={p.y - 45} width="100" height="35" rx="6" fill="#1f2937" opacity="0.95" />
                <text x={p.x} y={p.y - 30} textAnchor="middle" fontSize="10" fill="white" fontWeight="600">
                  {p.label?.slice(5) || ''}
                </text>
                <text x={p.x} y={p.y - 15} textAnchor="middle" fontSize="12" fill="white" fontWeight="bold">
                  {p.value.toLocaleString('vi-VN')}{unit}
                </text>
              </g>
            </g>
          ))}
          
          {/* X-axis labels */}
          {labels.map((label, i) => {
            if (i % Math.ceil(labels.length / 8) !== 0 && i !== labels.length - 1) return null
            const x = padding + (i / (labels.length - 1 || 1)) * (width - 2 * padding)
            return (
              <g key={i}>
                <line x1={x} y1={height - padding} x2={x} y2={height - padding + 5} stroke="#9ca3af" strokeWidth="2" />
                <text x={x} y={height - padding + 20} textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
                  {label.slice(5)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function BarChart({ labels, values, color = "#10b981", height = 280, title, unit = "" }: { 
  labels: string[], 
  values: number[], 
  color?: string,
  height?: number,
  title?: string,
  unit?: string
}) {
  if (!values.length || values.every(v => v === 0)) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
       
          <p className="text-sm">Không có dữ liệu</p>
        </div>
      </div>
    )
  }

  const max = Math.max(...values, 1)
  const total = values.reduce((a, b) => a + b, 0)
  const avg = total / values.length
  const barCount = Math.min(values.length, 15)
  const displayedValues = values.slice(0, barCount)
  const displayedLabels = labels.slice(0, barCount)

  return (
    <div className="w-full bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
      {/* Header with stats */}
      {title && (
        <div className="mb-6 pb-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Tổng</div>
              <div className="text-xl font-bold text-green-600">{total.toLocaleString('vi-VN')}{unit}</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Trung bình</div>
              <div className="text-xl font-bold ">{Math.round(avg).toLocaleString('vi-VN')}{unit}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Cao nhất</div>
              <div className="text-xl font-bold text-purple-600">{max.toLocaleString('vi-VN')}{unit}</div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <div className="flex items-end justify-between gap-2 px-2" style={{ minHeight: `${height}px` }}>
          {displayedValues.map((v, i) => {
            const barHeight = (v / max) * 100
            const isMax = v === max
            return (
              <div key={i} className="flex-1 flex flex-col items-center group relative min-w-[40px]">
                <div className="w-full h-full flex flex-col justify-end relative">
                  {/* Value label on top */}
                  {v > 0 && (
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap shadow-lg font-semibold">
                        {v.toLocaleString('vi-VN')}{unit}
                      </div>
                      <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 mx-auto"></div>
                    </div>
                  )}
                  
                  {/* Bar */}
                  <div
                    className="w-full rounded-t-lg transition-all duration-300 hover:opacity-90 cursor-pointer relative group/bar shadow-sm"
                    style={{
                      height: `${Math.max(barHeight, 3)}%`,
                      backgroundColor: isMax ? color : color,
                      background: isMax 
                        ? `linear-gradient(to top, ${color}, ${color}dd)` 
                        : `linear-gradient(to top, ${color}dd, ${color}aa)`,
                      minHeight: v > 0 ? '8px' : '0',
                      borderTopLeftRadius: '8px',
                      borderTopRightRadius: '8px',
                    }}
                  >
                    {/* Gradient overlay on hover */}
                    <div className="absolute inset-0 bg-white opacity-0 group-hover/bar:opacity-20 rounded-t-lg transition-opacity"></div>
                    
                    {/* Percentage indicator */}
                    {v > 0 && barHeight > 10 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-white opacity-0 group-hover/bar:opacity-100 transition-opacity drop-shadow-md">
                          {((v / max) * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* X-axis label */}
                <div className="text-xs text-gray-600 mt-3 text-center truncate w-full font-medium" style={{ fontSize: '11px' }}>
                  {displayedLabels[i]?.slice(5) || ''}
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Y-axis grid lines */}
        <div className="relative -mt-[280px] h-[280px] pointer-events-none">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const value = max - (ratio * max)
            return (
              <div key={ratio} className="absolute left-0 right-0 border-t border-dashed border-gray-200" style={{ bottom: `${ratio * 100}%` }}>
                <span className="absolute -left-12 text-xs text-gray-500 font-medium">{value.toFixed(0)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PieChart({ data, title }: { data: { label: string, value: number, color: string }[], title?: string }) {
  if (!data.length || data.every(d => d.value === 0)) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
         
          <p className="text-sm">Không có dữ liệu</p>
        </div>
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p className="text-sm">Không có dữ liệu</p>
      </div>
    )
  }

  let currentAngle = 0
  const size = 280
  const radius = size / 2 - 30
  const centerX = size / 2
  const centerY = size / 2

  return (
    <div className="w-full bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
      {/* Header */}
      {title && (
        <div className="mb-6 pb-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
           
        </div>
      )}

      <div className="flex flex-col lg:flex-row items-center gap-8">
        {/* Pie Chart */}
        <div className="relative flex-shrink-0">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-72 h-72 lg:w-80 lg:h-80">
            {data.map((item, i) => {
              const percentage = (item.value / total) * 100
              const angle = (percentage / 100) * 360
              const startAngle = currentAngle
              currentAngle += angle

              const startRad = (startAngle - 90) * Math.PI / 180
              const endRad = (currentAngle - 90) * Math.PI / 180
              
              const x1 = centerX + radius * Math.cos(startRad)
              const y1 = centerY + radius * Math.sin(startRad)
              const x2 = centerX + radius * Math.cos(endRad)
              const y2 = centerY + radius * Math.sin(endRad)
              
              const largeArc = angle > 180 ? 1 : 0
              const midAngle = (startAngle + currentAngle) / 2
              const labelRadius = radius * 0.7
              const labelX = centerX + labelRadius * Math.cos((midAngle - 90) * Math.PI / 180)
              const labelY = centerY + labelRadius * Math.sin((midAngle - 90) * Math.PI / 180)

              return (
                <g key={i} className="group cursor-pointer">
                  <path
                    d={`M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                    fill={item.color}
                    stroke="white"
                    strokeWidth="4"
                    className="hover:opacity-90 transition-all duration-300 hover:scale-105 origin-center"
                    style={{ transformOrigin: `${centerX}px ${centerY}px` }}
                  >
                    <title>{item.label}: {item.value} ({percentage.toFixed(1)}%)</title>
                  </path>
                  
                  {/* Percentage label */}
                  {percentage > 5 && (
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="14"
                      fontWeight="bold"
                      fill="white"
                      className="drop-shadow-lg"
                    >
                      {percentage.toFixed(0)}%
                    </text>
                  )}
                </g>
              )
            })}
            
            {/* Center circle */}
            <circle cx={centerX} cy={centerY} r="40" fill="white" className="drop-shadow-md" />
            <text
              x={centerX}
              y={centerY - 8}
              textAnchor="middle"
              fontSize="16"
              fontWeight="bold"
              fill="#374151"
            >
              Tổng
            </text>
            <text
              x={centerX}
              y={centerY + 12}
              textAnchor="middle"
              fontSize="20"
              fontWeight="bold"
              fill="#1f2937"
            >
              {total}
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 w-full lg:w-auto">
          <div className="space-y-3">
            {data.map((item, i) => {
              const percentage = (item.value / total) * 100
              return (
                <div 
                  key={i} 
                  className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition-all cursor-pointer group border border-transparent hover:border-gray-200"
                >
                  <div 
                    className="w-6 h-6 rounded-lg flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform" 
                    style={{ backgroundColor: item.color }} 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-semibold text-gray-900 truncate">{item.label}</div>
                      <div className="text-sm font-bold text-gray-700 ml-2">{item.value.toLocaleString('vi-VN')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: item.color
                          }}
                        />
                      </div>
                      <div className="text-xs font-medium text-gray-600 w-12 text-right">
                        {percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportResponse>({ 
    summary: { totalBookings: 0, totalRevenue: 0, totalServices: 0, openTasks: 0 }, 
    items: [], 
    staffRevenues: [] 
  })
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview'|'revenue'|'bookings'|'services'|'tasks'|'staff'|'rooms'>('overview')
  const [viewMode, setViewMode] = useState<'table'|'chart'>('table')
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [roomQuery, setRoomQuery] = useState("")
  const [bookingStatus, setBookingStatus] = useState<string>('ALL')
  const [serviceStatus, setServiceStatus] = useState<string>('ALL')
  const [taskStatus, setTaskStatus] = useState<string>('ALL')
  
  // Pagination
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  // Fetch detailed data
  const { data: bookingList } = useBookings(bookingStatus === 'ALL' ? undefined : bookingStatus)
  const bookingRows = (bookingList as any[]) || []

  const { data: serviceOrderList } = useServiceOrders(serviceStatus === 'ALL' ? undefined : serviceStatus)
  const serviceRows = (serviceOrderList as any[]) || []

  const { data: taskList } = useStaffTasks(taskStatus === 'ALL' ? undefined : { status: taskStatus })
  const taskRows = (taskList as any[]) || []

  // Fetch report summary
  useEffect(() => {
    let aborted = false
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await authFetch('/api/system/reports', { 
          headers: { 'Content-Type': 'application/json' }, 
          credentials: 'include' 
        })
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        
        const json = await res.json()
        if (!aborted) setData(json)
      } catch (error) {
        console.error('Error fetching report data:', error)
        if (!aborted) setData({ 
          summary: { totalBookings: 0, totalRevenue: 0, totalServices: 0, openTasks: 0 }, 
          items: [], 
          staffRevenues: [] 
        })
      } finally {
        if (!aborted) setLoading(false)
      }
    }
    fetchData()
    return () => { aborted = true }
  }, [])

  // Filter items by tab and date
  const filtered = useMemo(() => {
    let items = Array.isArray(data.items) ? data.items : []

    if (activeTab === 'revenue') {
      items = items.filter(i => i.type === 'PAYMENT' || i.type === 'SERVICE')
    } else if (activeTab === 'bookings') {
      items = items.filter(i => i.type === 'BOOKING')
    } else if (activeTab === 'services') {
      items = items.filter(i => i.type === 'SERVICE')
    } else if (activeTab === 'tasks') {
      items = items.filter(i => i.type === 'TASK')
    }

    if (dateFrom) items = items.filter(i => i.date >= dateFrom)
    if (dateTo) items = items.filter(i => i.date <= dateTo)
    
    return items
  }, [data.items, dateFrom, dateTo, activeTab])

  // Reset page when tab or filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, bookingStatus, serviceStatus, taskStatus, dateFrom, dateTo])

  // Get current tab data
  const currentTabData = useMemo(() => {
    if (activeTab === 'bookings') return bookingRows
    if (activeTab === 'services') return serviceRows
    if (activeTab === 'tasks') return taskRows
    if (activeTab === 'staff') return data.staffRevenues
    return filtered
  }, [activeTab, bookingRows, serviceRows, taskRows, data.staffRevenues, filtered])

  // Paginated data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return currentTabData.slice(start, end)
  }, [currentTabData, currentPage, pageSize])

  const totalPages = Math.ceil(currentTabData.length / pageSize)
  const hasMore = currentPage < totalPages

  // Build chart data
  const chartData = useMemo(() => {
    const byDate: Record<string, { revenue: number; bookings: number; services: number }> = {}
    
    filtered.forEach((i) => {
      const d = i.date
      if (!byDate[d]) byDate[d] = { revenue: 0, bookings: 0, services: 0 }
      if (i.type === 'BOOKING') byDate[d].bookings += i.count || 0
      if (i.type === 'PAYMENT' || i.type === 'SERVICE') byDate[d].revenue += i.amount || 0
      if (i.type === 'SERVICE') byDate[d].services += i.count || 0
    })
    
    const bookingsByDate: Record<string, number> = {}
    bookingRows.forEach((b: any) => {
      const date = (b.checkinDate || b.createdDate || '').slice(0, 10)
      if (date) bookingsByDate[date] = (bookingsByDate[date] || 0) + 1
    })
    
    const servicesByDate: Record<string, { count: number; revenue: number }> = {}
    serviceRows.forEach((s: any) => {
      const date = (s.created_at || s.createdDate || '').slice(0, 10)
      if (date) {
        if (!servicesByDate[date]) servicesByDate[date] = { count: 0, revenue: 0 }
        servicesByDate[date].count += 1
        servicesByDate[date].revenue += (s.total_amount || s.totalAmount || 0)
      }
    })
    
    const tasksByStatus: Record<string, number> = {}
    taskRows.forEach((t: any) => {
      const status = (t.status || 'TODO').toUpperCase()
      tasksByStatus[status] = (tasksByStatus[status] || 0) + 1
    })
    
    const dates = Object.keys(byDate).sort()
    const bookingDates = Object.keys(bookingsByDate).sort()
    const serviceDates = Object.keys(servicesByDate).sort()
    
    return { 
      dates, 
      revenueSeries: dates.map(d => byDate[d].revenue), 
      bookingsSeries: dates.map(d => byDate[d].bookings),
      bookingDates,
      bookingCounts: bookingDates.map(d => bookingsByDate[d]),
      serviceDates,
      serviceCounts: serviceDates.map(d => servicesByDate[d].count),
      serviceRevenues: serviceDates.map(d => servicesByDate[d].revenue),
      tasksByStatus,
    }
  }, [filtered, bookingRows, serviceRows, taskRows])

  // Pagination Component
  const PaginationControls = () => {
    if (viewMode === 'chart' || currentTabData.length === 0) return null
    
    return (
      <div className="bg-gradient-to-r from-gray-50 to-[hsl(var(--page-bg))] px-6 py-6 border-t border-gray-200/50">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <div className="text-sm text-gray-600 mb-1">Hiển thị kết quả</div>
            <div className="text-lg font-bold text-gray-900">
              <span className="text-[hsl(var(--primary))]">
                {((currentPage - 1) * pageSize) + 1}
              </span>{' '}
              -{' '}
              <span className="text-[hsl(var(--primary))]">
                {Math.min(currentPage * pageSize, currentTabData.length)}
              </span>{' '}
              / <span className="text-gray-600">{currentTabData.length}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span>Hàng:</span>
              <select 
                className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                value={pageSize} 
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            {hasMore && (
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                className="h-10 px-4 bg-[hsl(var(--primary))] text-white rounded-lg text-sm font-medium hover:bg-[hsl(var(--primary)/0.9)] transition-colors flex items-center gap-2 shadow-sm"
              >
                Xem tiếp
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

    return (
    <div className="px-6 pt-4 pb-6">
      <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
        <div className="shadow-sm border border-gray-200 rounded-2xl overflow-hidden" style={{ backgroundColor: '#dcebff' }}>
          <div className="border-b border-gray-200/50 px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Báo cáo tổng hợp</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Phân tích và thống kê dữ liệu hệ thống
                </p>
          </div>
            <button
              onClick={() => {
                  const csv = [
                    ['ID','Ngày','Loại','Tiêu đề','Số tiền','Số lượng'], 
                    ...filtered.map(i => [i.id, i.date, i.type, i.title, i.amount ?? '', i.count ?? ''])
                  ]
                const blob = new Blob([csv.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                  a.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`
                a.click()
                URL.revokeObjectURL(url)
              }}
                className="h-10 px-4 rounded-xl border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              Xuất Excel
            </button>
          </div>
        </div>
      </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-200 p-6 shadow-sm" style={{ backgroundColor: '#f4f8ff' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tổng đặt phòng</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{data?.summary?.totalBookings ?? 0}</p>
            </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f4f8ff' }}>
                <svg className="w-6 h-6" style={{ color: '#0277b0' }}  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
            </div>
              </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-6 shadow-sm" style={{ backgroundColor: '#f4f8ff' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Doanh thu</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {(data?.summary?.totalRevenue ?? 0).toLocaleString('vi-VN')}₫
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f4f8ff' }}>
                <svg className="w-6 h-6" style={{ color: '#0277b0' }}  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

          <div className="rounded-xl border border-gray-200 p-6 shadow-sm" style={{ backgroundColor: '#f4f8ff' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Số dịch vụ</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{data?.summary?.totalServices ?? 0}</p>
            </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f4f8ff' }}>
                <svg className="w-6 h-6" style={{ color: '#0277b0' }}  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
          </div>
              </div>
            </div>

          <div className="rounded-xl border border-gray-200 p-6 shadow-sm" style={{ backgroundColor: '#f4f8ff' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Công việc mở</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{data?.summary?.openTasks ?? 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f4f8ff' }}>
                <svg className="w-6 h-6" style={{ color: '#0277b0' }}  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
            </div>
            </div>
            </div>
          </div>

          {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 p-1 flex items-center gap-1 overflow-x-auto">
            {[
              { key: 'overview', label: 'Tổng quan' },
              { key: 'revenue', label: 'Doanh thu' },
              { key: 'bookings', label: 'Đặt phòng' },
            { key: 'services', label: 'Dịch vụ'},
              { key: 'tasks', label: 'Công việc' },
            { key: 'staff', label: 'Nhân viên'},
            ].map(t => (
            <button 
              key={t.key} 
              type="button" 
              onClick={() => setActiveTab(t.key as any)} 
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === t.key 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
            ))}
          </div>

        {/* Main Content */}
        <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-xl font-bold text-gray-900">
                {activeTab === 'bookings' && ' Danh sách đặt phòng'}
                {activeTab === 'services' && ' Danh sách dịch vụ'}
                {activeTab === 'tasks' && ' Danh sách công việc'}
                {activeTab === 'staff' && ' Doanh thu theo nhân viên'}
                {activeTab === 'overview' && ' Tổng quan giao dịch'}
                {activeTab === 'revenue' && ' Chi tiết doanh thu'}
              </h2>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Date Filter */}
                {activeTab !== 'staff' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-500">-</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
              </div>
                )}
                {/* View Toggle */}
                <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      viewMode === 'table'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Bảng
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('chart')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      viewMode === 'chart'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Biểu đồ
                  </button>
            </div>
                {((activeTab === 'bookings' && bookingRows.length > 0) ||
                  (activeTab === 'services' && serviceRows.length > 0) ||
                  (activeTab === 'tasks' && taskRows.length > 0) ||
                  (activeTab === 'staff' && data.staffRevenues.length > 0) ||
                  (activeTab === 'overview' && filtered.length > 0) ||
                  (activeTab === 'revenue' && serviceRows.length > 0)) && (
                  <div className="px-3 py-1.5  text-blue-700 rounded-lg text-sm font-semibold">
                    {activeTab === 'bookings' && `${bookingRows.length} đặt phòng`}
                    {activeTab === 'services' && `${serviceRows.length} dịch vụ`}
                    {activeTab === 'tasks' && `${taskRows.length} công việc`}
                    {activeTab === 'staff' && `${data.staffRevenues.length} nhân viên`}
                    {activeTab === 'overview' && `${filtered.length} mục`}
                    {activeTab === 'revenue' && `${serviceRows.length} giao dịch`}
              </div>
                )}
            </div>
          </div>
          </CardHeader>
          <CardBody className="p-0">
            {/* BOOKINGS TAB */}
            {activeTab === 'bookings' && (
              <>
                <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">Lọc theo trạng thái:</label>
                    <select
                      className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={bookingStatus}
                      onChange={(e) => setBookingStatus(e.target.value)}
                    >
                      <option value="ALL">Tất cả</option>
                      <option value="PENDING">Chờ duyệt</option>
                      <option value="APPROVED">Đã duyệt</option>
                      <option value="CHECKED_IN">Đã nhận phòng</option>
                      <option value="CHECKED_OUT">Đã trả phòng</option>
                      <option value="CANCELLED">Đã hủy</option>
                      <option value="REJECTED">Đã từ chối</option>
                    </select>
              </div>
          </div>
                {viewMode === 'chart' ? (
                  <div className="p-6">
                    <BarChart 
                      labels={chartData.bookingDates} 
                      values={chartData.bookingCounts} 
                      color="#3b82f6"
                      title="Lượt đặt phòng theo ngày"
                      unit=" lượt"
                    />
              </div>
                ) : (
              <div className="hidden lg:block overflow-x-auto">
                    <Table>
                      <THead>
                        <tr>
                          <th className="px-4 py-3 text-center text-sm font-bold">Mã booking</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Phòng</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Check-in</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Check-out</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Số khách</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Trạng thái</th>
                    </tr>
                      </THead>
                      <TBody>
                        {paginatedData.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                              
                              <p>Không có dữ liệu</p>
                            </td>
                      </tr>
                        ) : (
                          (paginatedData as any[]).map((b: any, index: number) => (
                            <tr key={b.id} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-[#f2f8fe]`}>
                              <td className="px-4 py-3 text-center font-medium text-gray-900">{b.code}</td>
                              <td className="px-4 py-3 text-center text-gray-700">{b.roomId ?? '—'}</td>
                              <td className="px-4 py-3 text-center text-gray-700">{b.checkinDate}</td>
                              <td className="px-4 py-3 text-center text-gray-700">{b.checkoutDate}</td>
                              <td className="px-4 py-3 text-center text-gray-700">{b.numGuests ?? 1}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  b.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                  b.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                  b.status === 'CANCELLED' || b.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                  ' text-blue-800'
                                }`}>
                                  {b.status}
                                </span>
                              </td>
                      </tr>
                          ))
                        )}
                  </TBody>
                </Table>
              </div>
                )}
                {viewMode === 'table' && <PaginationControls />}
              </>
            )}

            {/* SERVICES TAB */}
            {activeTab === 'services' && (
              <>
                <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">Lọc theo trạng thái:</label>
                    <select
                      className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={serviceStatus}
                      onChange={(e) => setServiceStatus(e.target.value)}
                    >
                      <option value="ALL">Tất cả</option>
                      <option value="PENDING">Chờ xử lý</option>
                      <option value="CONFIRMED">Đã xác nhận</option>
                      <option value="COMPLETED">Hoàn thành</option>
                      <option value="CANCELLED">Đã hủy</option>
                    </select>
            </div>
              </div>
                {viewMode === 'chart' ? (
                  <div className="p-6">
                    <LineChart 
                      labels={chartData.serviceDates} 
                      values={chartData.serviceRevenues} 
                      color="#10b981"
                      title="Doanh thu dịch vụ theo ngày"
                      unit="₫"
                    />
              </div>
                ) : (
              <div className="hidden lg:block overflow-x-auto">
                    <Table>
                      <THead>
                        <tr>
                          <th className="px-4 py-3 text-center text-sm font-bold">Mã đơn</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Booking</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Tổng tiền</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Trạng thái</th>
                    </tr>
                      </THead>
                      <TBody>
                        {paginatedData.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                            
                              <p>Không có dữ liệu</p>
                            </td>
                      </tr>
                        ) : (
                          (paginatedData as any[]).map((o: any, index: number) => (
                            <tr key={o.id} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-[#f2f8fe]`}>
                              <td className="px-4 py-3 text-center font-medium text-gray-900">{o.code || o.id}</td>
                              <td className="px-4 py-3 text-center text-gray-700">{o.bookingId ?? '—'}</td>
                              <td className="px-4 py-3 text-center font-semibold text-green-600">
                                {(o.totalAmount || o.total_amount || 0).toLocaleString('vi-VN')}₫
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  o.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                  o.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                  o.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                  ' text-blue-800'
                                }`}>
                                  {o.status || '—'}
                                </span>
                              </td>
                      </tr>
                          ))
                        )}
                  </TBody>
                </Table>
              </div>
                )}
                {viewMode === 'table' && <PaginationControls />}
              </>
            )}

            {/* TASKS TAB */}
            {activeTab === 'tasks' && (
              <>
                <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">Lọc theo trạng thái:</label>
                    <select
                      className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={taskStatus}
                      onChange={(e) => setTaskStatus(e.target.value)}
                    >
                      <option value="ALL">Tất cả</option>
                      <option value="TODO">Cần làm</option>
                      <option value="IN_PROGRESS">Đang thực hiện</option>
                      <option value="DONE">Hoàn thành</option>
                      <option value="CANCELLED">Đã hủy</option>
                    </select>
            </div>
          </div>
                {viewMode === 'chart' ? (
                  <div className="p-6">
                    <PieChart 
                      title="Phân bổ công việc theo trạng thái"
                      data={Object.entries(chartData.tasksByStatus).map(([status, count]) => ({
                        label: status === 'TODO' ? 'Cần làm' :
                               status === 'OPEN' ? 'Mở' :
                               status === 'IN_PROGRESS' ? 'Đang thực hiện' :
                               status === 'DONE' ? 'Hoàn thành' :
                               status === 'COMPLETED' ? 'Đã hoàn thành' :
                               status === 'CANCELLED' ? 'Đã hủy' : status,
                        value: count as number,
                        color: status === 'TODO' || status === 'OPEN' ? '#ef4444' : 
                               status === 'IN_PROGRESS' ? '#f59e0b' : 
                               status === 'DONE' || status === 'COMPLETED' ? '#10b981' : '#6b7280'
                      }))}
                    />
              </div>
                ) : (
              <div className="hidden lg:block overflow-x-auto">
                    <Table>
                      <THead>
                        <tr>
                          <th className="px-4 py-3 text-center text-sm font-bold">Tiêu đề</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Loại</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Liên quan</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Trạng thái</th>
                    </tr>
                      </THead>
                      <TBody>
                        {paginatedData.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                           
                              <p>Không có dữ liệu</p>
                            </td>
                      </tr>
                    ) : (
                          (paginatedData as any[]).map((t: any, index: number) => (
                            <tr key={t.id} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-[#f2f8fe]`}>
                              <td className="px-4 py-3 text-center font-medium text-gray-900">{t.title || t.taskName || t.code}</td>
                              <td className="px-4 py-3 text-center text-gray-700">{t.taskType || t.type || '—'}</td>
                              <td className="px-4 py-3 text-center text-gray-700">{t.relatedType ? `${t.relatedType} #${t.relatedId}` : '—'}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  t.status === 'DONE' || t.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                  t.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                                  t.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {t.status}
                                </span>
                              </td>
                        </tr>
                      ))
                    )}
                  </TBody>
                </Table>
            </div>
                )}
                {viewMode === 'table' && <PaginationControls />}
              </>
            )}

            {/* STAFF TAB */}
          {activeTab === 'staff' && (
              <>
                {viewMode === 'chart' ? (
                  <div className="p-6">
                    <BarChart 
                      labels={data.staffRevenues.map(s => s.staffName)} 
                      values={data.staffRevenues.map(s => s.totalAmount)} 
                      color="#8b5cf6"
                      title="Doanh thu theo nhân viên"
                      unit="₫"
                    />
              </div>
                ) : (
              <div className="hidden lg:block overflow-x-auto">
                    <Table>
                      <THead>
                        <tr>
                          <th className="px-4 py-3 text-center text-sm font-bold">Nhân viên</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Số đơn</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Doanh thu</th>
                    </tr>
                      </THead>
                      <TBody>
                        {paginatedData.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              <p>Chưa có dữ liệu</p>
                            </td>
                      </tr>
                    ) : (
                          (paginatedData as any[]).map((s: any, index: number) => (
                            <tr key={s.staffId} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-[#f2f8fe]`}>
                              <td className="px-4 py-3 text-center font-medium text-gray-900">{s.staffName}</td>
                              <td className="px-4 py-3 text-center text-gray-700">{s.orderCount}</td>
                              <td className="px-4 py-3 text-center font-semibold text-green-600">
                                {s.totalAmount.toLocaleString('vi-VN')}₫
                              </td>
                        </tr>
                      ))
                    )}
                  </TBody>
                </Table>
              </div>
                )}
                {viewMode === 'table' && <PaginationControls />}
              </>
            )}

            {/* OVERVIEW & REVENUE TABS */}
            {(activeTab === 'overview' || activeTab === 'revenue') && (
              <>
                {viewMode === 'chart' ? (
                  <div className="p-6 space-y-8">
                    <LineChart 
                      labels={chartData.dates} 
                      values={chartData.revenueSeries} 
                      color="#3b82f6"
                      title="Doanh thu theo thời gian"
                      unit="₫"
                    />
                    <BarChart 
                      labels={chartData.dates} 
                      values={chartData.bookingsSeries} 
                      color="#10b981"
                      title="Lượt đặt phòng theo thời gian"
                      unit=" lượt"
                    />
                      </div>
                ) : (
                  <div className="hidden lg:block overflow-x-auto">
                    <Table>
                      <THead>
                        <tr>
                          <th className="px-4 py-3 text-center text-sm font-bold">Ngày</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Loại</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Tiêu đề</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Số tiền</th>
                          <th className="px-4 py-3 text-center text-sm font-bold">Số lượng</th>
                    </tr>
                      </THead>
                      <TBody>
                        {paginatedData.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                           
                              <p>Không có dữ liệu</p>
                            </td>
                      </tr>
                        ) : (
                          (paginatedData as any[]).map((i: any, index: number) => (
                            <tr key={i.id} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-[#f2f8fe]`}>
                              <td className="px-4 py-3 text-center text-gray-700">{i.date}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  i.type === 'BOOKING' ? ' text-blue-800' :
                                  i.type === 'SERVICE' ? 'bg-green-100 text-green-800' :
                                  i.type === 'PAYMENT' ? 'bg-purple-100 text-purple-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {i.type}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-gray-900">{i.title}</td>
                              <td className="px-4 py-3 text-center font-medium text-gray-900">
                                {i.amount ? `${i.amount.toLocaleString('vi-VN')}₫` : '—'}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-700">{i.count ?? '—'}</td>
                            </tr>
                          ))
                        )}
                  </TBody>
                </Table>
                    </div>
                )}
                {viewMode === 'table' && <PaginationControls />}
              </>
            )}
            </CardBody>
          </Card>
        </div>
      </div>
  )
}
