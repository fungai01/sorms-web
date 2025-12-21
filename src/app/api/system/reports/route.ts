import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { getAuthorizationHeader } from '@/lib/auth-service'
import { API_CONFIG } from '@/lib/config'

const BASE = API_CONFIG.BASE_URL

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

async function buildReportFromAPI(authHeader?: string | null): Promise<ReportResponse> {
  try {
    const authOptions = authHeader
      ? { headers: { Authorization: authHeader } as HeadersInit }
      : undefined

    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      accept: '*/*',
    }
    if (authHeader) {
      authHeaders.Authorization = authHeader
    }

    // Fetch all data in parallel
    const [bookingsResult, serviceOrdersResult, tasksResult, usersResult] = await Promise.allSettled([
      apiClient.getBookings(authOptions),
      fetch(`${BASE}/orders/my-orders`, { headers: authHeaders }).then(async (res) => {
        if (!res.ok) return { success: false, data: [] }
        const data = await res.json().catch(() => ({}))
        const orders = data.items || data.data || (Array.isArray(data) ? data : [])
        return { success: true, data: Array.isArray(orders) ? orders : [] }
      }),
      fetch(`${BASE}/staff-tasks`, { headers: authHeaders }).then(async (res) => {
        if (!res.ok) return { success: false, data: [] }
        const data = await res.json().catch(() => ({}))
        const tasks = data.items || data.data || (Array.isArray(data) ? data : [])
        return { success: true, data: Array.isArray(tasks) ? tasks : [] }
      }),
      fetch(`${BASE}/user/staff`, { headers: authHeaders }).then(async (res) => {
        if (!res.ok) return { success: false, data: [] }
        const data = await res.json().catch(() => ({}))
        const users = data.items || data.data || (Array.isArray(data) ? data : [])
        return { success: true, data: Array.isArray(users) ? users : [] }
      }),
    ])

    // Extract data safely
    const bookingsResponse = bookingsResult.status === 'fulfilled' && bookingsResult.value.success
      ? bookingsResult.value
      : { success: false, data: [] }

    const serviceOrdersResponse = serviceOrdersResult.status === 'fulfilled' && serviceOrdersResult.value.success
      ? serviceOrdersResult.value
      : { success: false, data: [] }

    const tasksResponse = tasksResult.status === 'fulfilled' && tasksResult.value.success
      ? tasksResult.value
      : { success: false, data: [] }

    const usersResponse = usersResult.status === 'fulfilled' && usersResult.value.success
      ? usersResult.value
      : { success: false, data: [] }

    // Unwrap bookings
    const rawBookings = bookingsResponse.data as any
    const bookings: any[] = Array.isArray(rawBookings)
      ? rawBookings
      : Array.isArray(rawBookings?.items)
        ? rawBookings.items
        : Array.isArray(rawBookings?.content)
          ? rawBookings.content
          : []

    // Unwrap service orders
    const serviceOrders: any[] = Array.isArray(serviceOrdersResponse.data)
      ? serviceOrdersResponse.data
      : []

    // Unwrap tasks
    const tasks: any[] = Array.isArray(tasksResponse.data)
      ? tasksResponse.data
      : []

    // Unwrap staff users
    const staffUsers: any[] = Array.isArray(usersResponse.data)
      ? usersResponse.data
      : []

    // Calculate summary
    const totalBookings = bookings.length
    const totalServices = serviceOrders.length
    const totalRevenue = serviceOrders.reduce((sum: number, order: any) => {
      const amount = order.total_amount || order.totalAmount || order.amount || 0
      return sum + (Number(amount) || 0)
    }, 0)
    const openTasks = tasks.filter((t: any) => {
      const status = (t.status || '').toUpperCase()
      return status === 'TODO' || status === 'IN_PROGRESS' || status === 'OPEN'
    }).length

    // Build report items
    const items: ReportItem[] = []
    let itemId = 1

    // Group bookings by date
    const bookingsByDate = new Map<string, number>()
    bookings.forEach((booking: any) => {
      const date = (booking.checkinDate || booking.createdDate || '').slice(0, 10)
      if (date) {
        bookingsByDate.set(date, (bookingsByDate.get(date) || 0) + 1)
      }
    })

    bookingsByDate.forEach((count, date) => {
      items.push({
        id: itemId++,
        date,
        type: 'BOOKING',
        title: 'Đặt phòng mới',
        count,
      })
    })

    // Group service orders by date
    const ordersByDate = new Map<string, { count: number; amount: number }>()
    serviceOrders.forEach((order: any) => {
      const date = (order.created_at || order.createdDate || '').slice(0, 10)
      if (date) {
        const amount = order.total_amount || order.totalAmount || order.amount || 0
        const existing = ordersByDate.get(date)
        if (existing) {
          existing.count += 1
          existing.amount += Number(amount) || 0
        } else {
          ordersByDate.set(date, { count: 1, amount: Number(amount) || 0 })
        }
      }
    })

    ordersByDate.forEach((data, date) => {
      items.push({
        id: itemId++,
        date,
        type: 'SERVICE',
        title: 'Đơn dịch vụ',
        count: data.count,
        amount: data.amount,
      })
    })

    // Sort items by date descending
    items.sort((a, b) => b.date.localeCompare(a.date))

    // Calculate staff revenues
    const staffRevenueMap = new Map<number, { name: string; amount: number; count: number }>()
    serviceOrders.forEach((order: any) => {
      const staffId = order.assigned_to || order.staff_id || order.requested_by
      if (!staffId) return

      const orderAmount = order.total_amount || order.totalAmount || order.amount || 0
      const staff = staffUsers.find((s: any) => s.id === staffId)
      const staffName = staff ? (staff.name || staff.email || `Staff #${staffId}`) : `Staff #${staffId}`

      const existing = staffRevenueMap.get(staffId)
      if (existing) {
        existing.amount += Number(orderAmount) || 0
        existing.count += 1
      } else {
        staffRevenueMap.set(staffId, {
          name: staffName,
          amount: Number(orderAmount) || 0,
          count: 1,
        })
      }
    })

    const staffRevenues: StaffRevenue[] = Array.from(staffRevenueMap.entries())
      .map(([staffId, data]) => ({
        staffId,
        staffName: data.name,
        totalAmount: data.amount,
        orderCount: data.count,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)

    return {
      summary: {
        totalBookings,
        totalRevenue,
        totalServices,
        openTasks,
      },
      items,
      staffRevenues,
    }
  } catch (error: any) {
    console.error('[Reports] Error building report:', error)
    return {
      summary: {
        totalBookings: 0,
        totalRevenue: 0,
        totalServices: 0,
        openTasks: 0,
      },
      items: [],
      staffRevenues: [],
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = getAuthorizationHeader(req)
    const report = await buildReportFromAPI(authHeader)
    return NextResponse.json(report)
  } catch (error: any) {
    console.error('[Reports] Error in GET handler:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error?.message || 'Unknown error',
        summary: { totalBookings: 0, totalRevenue: 0, totalServices: 0, openTasks: 0 },
        items: [],
        staffRevenues: [],
      },
      { status: 500 }
    )
  }
}

