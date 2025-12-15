import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const days = Math.min(Math.max(Number(searchParams.get('days') || '14'), 7), 30)
    
    console.log('[Dashboard API] Fetching bookings data, days:', days)
    
    // Extract Authorization header from request and pass to apiClient
    const authHeader = req.headers.get('authorization')
    console.log('[Dashboard API] Authorization header:', authHeader ? 'Found' : 'Not found')
    
    // Get bookings data
    // Pass headers via options parameter
    const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {}
    const response = await apiClient.getBookings({ headers })
    
    console.log('[Dashboard API] Bookings response:', {
      success: response.success,
      hasData: !!response.data,
      error: response.error,
      dataType: typeof response.data,
      isArray: Array.isArray(response.data),
    })
    
    if (!response.success) {
      console.error('[Dashboard API] Failed to fetch bookings:', response.error)
      // Return empty data instead of error to prevent dashboard crash
      return NextResponse.json({ pending: 0, series: [] })
    }

    interface Booking {
      status: string
      checkinDate?: string
      // Add other properties if needed
    }

    // Normalize response data - handle different response formats
    const raw: any = response.data
    const bookings: Booking[] = Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.content)
        ? raw.content
        : Array.isArray(raw?.data?.content)
          ? raw.data.content
          : Array.isArray(raw?.data?.items)
            ? raw.data.items
            : Array.isArray(raw)
              ? raw
              : []
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
    
    console.log('[Dashboard API] Bookings processed:', { pending, seriesCount: series.length })
    
    // Add caching headers - cache for 30 seconds
    return NextResponse.json(
      { pending, series },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (error) {
    console.error('[Dashboard API] Bookings error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' }, 
      { status: 500 }
    )
  }
}



