import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const days = Math.min(Math.max(Number(searchParams.get('days') || '14'), 7), 30)
    
    // Get bookings data
    const response = await apiClient.getBookings()
    if (!response.success) {
      return NextResponse.json(
        { error: 'Failed to fetch bookings data' }, 
        { status: 500 }
      )
    }

    interface Booking {
      status: string
      checkinDate?: string
      // Add other properties if needed
    }

    const bookings: Booking[] = Array.isArray(response.data) ? response.data : []
    const pending = bookings.filter((b) => b.status === 'PENDING').length

    // Generate simple time series data
    const today = new Date()
    const series: { date: string; count: number }[] = []

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const dateStr = date.toISOString().slice(0, 10)
      
      // Count bookings for this date
      const count = bookings.filter((b: any) => 
        b.checkinDate && b.checkinDate.slice(0, 10) === dateStr
      ).length
      
      series.push({ date: dateStr, count })
    }
    
    return NextResponse.json({ pending, series })
  } catch (error) {
    console.error('Bookings API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}



