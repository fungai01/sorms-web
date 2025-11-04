import { NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'

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

/**
 * Build report from real API data
 * No mock data - all data comes from backend
 */
async function buildReportFromAPI(): Promise<ReportResponse> {
  try {
    // Fetch all data in parallel from backend API
    const [bookingsResponse, servicesResponse, roomsResponse, roomTypesResponse] = await Promise.all([
      apiClient.getBookings(),
      apiClient.getServices(),
      apiClient.getRooms(),
      apiClient.getRoomTypes(),
    ])

    const bookings = (bookingsResponse.data || []) as any[]
    const services = (servicesResponse.data || []) as any[]
    const rooms = (roomsResponse.data || []) as any[]
    const roomTypes = (roomTypesResponse.data || []) as any[]

    // Calculate summary statistics from real data
    const totalBookings = bookings.length
    const totalServices = services.filter((s: any) => s.isActive).length

    // Calculate total revenue from bookings using REAL room prices from API
    const totalRevenue = bookings.reduce((sum: number, booking: any) => {
      // Find room for this booking
      const room = rooms.find((r: any) => r.id === booking.roomId)
      if (!room) return sum

      // Find room type to get base price
      const roomType = roomTypes.find((rt: any) => rt.id === room.roomTypeId)
      if (!roomType) return sum

      const basePrice = roomType.basePrice || 0

      // Calculate number of days
      const checkinDate = new Date(booking.checkinDate)
      const checkoutDate = new Date(booking.checkoutDate)
      const days = Math.max(1, Math.ceil((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24)))

      // Calculate revenue: basePrice * days * numGuests
      const bookingRevenue = basePrice * days * (booking.numGuests || 1)
      return sum + bookingRevenue
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

    // Group services by date (using service orders when available)
    const servicesByDate = new Map<string, number>()
    services.forEach((service: any) => {
      const date = service.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10)
      servicesByDate.set(date, (servicesByDate.get(date) || 0) + (service.unitPrice || 0))
    })

    // Add service items
    servicesByDate.forEach((amount, date) => {
      items.push({
        id: itemId++,
        date,
        type: 'SERVICE',
        title: 'Dịch vụ',
        amount,
      })
    })

    // Sort items by date (newest first)
    items.sort((a, b) => b.date.localeCompare(a.date))

    return {
      summary: {
        totalBookings,
        totalRevenue,
        totalServices,
        openTasks,
      },
      items,
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
    }
  }
}

export async function GET() {
  const report = await buildReportFromAPI()
  return NextResponse.json(report)
}


