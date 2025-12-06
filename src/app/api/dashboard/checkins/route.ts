import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const days = Math.min(Math.max(Number(searchParams.get('days') || '14'), 7), 30)
    
    console.log('[Dashboard API] Fetching checkins data, days:', days)
    
    // Extract Authorization header from request and pass to apiClient
    const authHeader = req.headers.get('authorization')
    console.log('[Dashboard API] Authorization header:', authHeader ? 'Found' : 'Not found')
    
    // Get all bookings and filter by CHECKED_IN status
    // Pass headers via options parameter
    const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {}
    const response = await apiClient.getBookings({ headers })
    
    console.log('[Dashboard API] Checkins response:', {
      success: response.success,
      hasData: !!response.data,
      error: response.error,
      dataType: typeof response.data,
      isArray: Array.isArray(response.data),
    })
    
    if (!response.success) {
      console.error('[Dashboard API] Failed to fetch checkins:', response.error)
      return NextResponse.json(
        { error: response.error || 'Failed to fetch checkins data' }, 
        { status: 500 }
      )
    }

    interface Booking {
      status: string
      checkinDate?: string
      // Add other properties if needed
    }

    // Normalize response data
    const raw: any = response.data
    const allBookings: Booking[] = Array.isArray(raw?.content) 
      ? raw.content 
      : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw) 
          ? raw 
          : []

    // Filter bookings with CHECKED_IN status
    const checkins = allBookings.filter((b: any) => b.status === 'CHECKED_IN')

    // Generate simple time series data
    const today = new Date()
    const series: { date: string; count: number }[] = []

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const dateStr = date.toISOString().slice(0, 10)
      
      // Count checkins for this date (bookings with CHECKED_IN status on this date)
      const count = checkins.filter((b: any) => 
        b.checkinDate && b.checkinDate.slice(0, 10) === dateStr
      ).length
      
      series.push({ date: dateStr, count })
    }
    
    console.log('[Dashboard API] Checkins processed:', { 
      totalCheckins: checkins.length,
      seriesCount: series.length 
    })
    
    return NextResponse.json({ series })
  } catch (error) {
    console.error('[Dashboard API] Checkins error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' }, 
      { status: 500 }
    )
  }
}

