import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { isAdmin } from '@/lib/auth-utils'

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

/**
 * Build report from real API data
 * No mock data - all data comes from backend
 */
async function buildReportFromAPI(): Promise<ReportResponse> {
  try {
    // Fetch all data in parallel from backend API
    const [bookingsResponse, serviceOrdersResponse, roomsResponse, roomTypesResponse, usersResponse] = await Promise.all([
      apiClient.getBookings(),
      apiClient.getServiceOrders(),
      apiClient.getRooms(),
      apiClient.getRoomTypes(),
      apiClient.getStaffUsers(),
    ])

    const bookings = (bookingsResponse.data || []) as any[]
    const serviceOrders = (serviceOrdersResponse.data || []) as any[]
    const rooms = (roomsResponse.data || []) as any[]
    const roomTypes = (roomTypesResponse.data || []) as any[]
    const staffUsers = (usersResponse.data || []) as any[]

    // Debug: Log data to check if it's real or mock
    console.log('[REPORTS API] Data from backend:', {
      bookingsCount: bookings.length,
      serviceOrdersCount: serviceOrders.length,
      roomsCount: rooms.length,
      roomTypesCount: roomTypes.length,
      sampleBooking: bookings[0],
      sampleServiceOrder: serviceOrders[0],
      sampleRoom: rooms[0],
      sampleRoomType: roomTypes[0]
    })

    // Calculate summary statistics from real data
    const totalBookings = bookings.length
    const totalServices = serviceOrders.length

    // Calculate total revenue from SERVICE ORDERS (not bookings)
    const totalRevenue = serviceOrders.reduce((sum: number, order: any) => {
      // Use total_amount from service order
      const orderAmount = order.total_amount || order.totalAmount || 0
      return sum + orderAmount
    }, 0)

    // Tasks not implemented yet
    const openTasks = 0

    // Build report items from real data
    const items: ReportItem[] = []
    let itemId = 1

    // Group bookings by date
    const bookingsByDate = new Map<string, number>()
    bookings.forEach((booking: any) => {
      const date = booking.createdDate?.slice(0, 10) || new Date().toISOString().slice(0, 10)
      bookingsByDate.set(date, (bookingsByDate.get(date) || 0) + 1)
    })

    // Add booking items
    bookingsByDate.forEach((count, date) => {
      items.push({
        id: itemId++,
        date,
        type: 'BOOKING',
        title: 'Đặt phòng mới',
        count,
      })
    })

    // Group service orders by date - count orders and sum revenue
    const ordersByDate = new Map<string, { count: number; amount: number }>()
    serviceOrders.forEach((order: any) => {
      const date = order.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10)
      const orderAmount = order.total_amount || order.totalAmount || 0

      const existing = ordersByDate.get(date)
      if (existing) {
        existing.count += 1
        existing.amount += orderAmount
      } else {
        ordersByDate.set(date, {
          count: 1,
          amount: orderAmount
        })
      }
    })

    // Add service order items
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

    // Sort items by date (newest first)
    items.sort((a, b) => b.date.localeCompare(a.date))

    // Calculate revenue by staff
    // Assuming service orders have a field like 'assigned_to' or 'staff_id' for the staff who handled it
    const staffRevenueMap = new Map<number, { name: string; amount: number; count: number }>()

    serviceOrders.forEach((order: any) => {
      const staffId = order.assigned_to || order.staff_id || order.requested_by
      if (!staffId) return

      const orderAmount = order.total_amount || order.totalAmount || 0
      const staff = staffUsers.find((s: any) => s.id === staffId)
      const staffName = staff ? (staff.name || staff.email || `Staff #${staffId}`) : `Staff #${staffId}`

      const existing = staffRevenueMap.get(staffId)
      if (existing) {
        existing.amount += orderAmount
        existing.count += 1
      } else {
        staffRevenueMap.set(staffId, {
          name: staffName,
          amount: orderAmount,
          count: 1
        })
      }
    })

    // Convert to array and sort by revenue (highest first)
    const staffRevenues: StaffRevenue[] = Array.from(staffRevenueMap.entries())
      .map(([staffId, data]) => ({
        staffId,
        staffName: data.name,
        totalAmount: data.amount,
        orderCount: data.count
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
  } catch (error) {
    console.error('Error building report from API:', error)
    // Return empty report on error
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
  if (!await isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
  }
  const report = await buildReportFromAPI()
  return NextResponse.json(report)
}


