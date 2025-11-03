import { NextResponse } from 'next/server'

type ReportItem = {
  id: number
  date: string
  type: 'BOOKING' | 'PAYMENT' | 'SERVICE' | 'TASK'
  title: string
  amount?: number
  count?: number
}

type ReportResponse = {
  summary: {
    totalBookings: number
    totalRevenue: number
    totalServices: number
    openTasks: number
  }
  items: ReportItem[]
}

const mockItems: ReportItem[] = [
  { id: 1, date: '2025-10-24', type: 'BOOKING', title: 'Đặt phòng mới', count: 12 },
  { id: 2, date: '2025-10-24', type: 'PAYMENT', title: 'Thanh toán', amount: 18500000 },
  { id: 3, date: '2025-10-24', type: 'SERVICE', title: 'Dịch vụ giặt ủi', amount: 1200000 },
  { id: 4, date: '2025-10-24', type: 'TASK', title: 'Công việc đang mở', count: 7 },
  { id: 5, date: '2025-10-23', type: 'BOOKING', title: 'Đặt phòng mới', count: 9 },
  { id: 6, date: '2025-10-23', type: 'PAYMENT', title: 'Thanh toán', amount: 14250000 },
]

function buildMock(): ReportResponse {
  const totalBookings = mockItems.filter(i => i.type === 'BOOKING').reduce((s, i) => s + (i.count || 0), 0)
  const totalRevenue = mockItems.filter(i => i.type === 'PAYMENT' || i.type === 'SERVICE').reduce((s, i) => s + (i.amount || 0), 0)
  const totalServices = mockItems.filter(i => i.type === 'SERVICE').length
  const openTasks = mockItems.filter(i => i.type === 'TASK').reduce((s, i) => s + (i.count || 0), 0)
  return {
    summary: { totalBookings, totalRevenue, totalServices, openTasks },
    items: mockItems,
  }
}

export async function GET() {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
  if (!useMock) return NextResponse.json({ summary: { totalBookings: 0, totalRevenue: 0, totalServices: 0, openTasks: 0 }, items: [] })
  return NextResponse.json(buildMock())
}


