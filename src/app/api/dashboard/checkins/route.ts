import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const days = Math.min(Math.max(Number(searchParams.get('days') || '14'), 7), 30)

    // Fetch real checkins from system API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_PATH || ''
    const url = `${baseUrl}/api/system/checkins`
    
    console.log('[Dashboard Checkins] Fetching from:', url)
    
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    
    console.log('[Dashboard Checkins] Response status:', res.status)
    
    if (!res.ok) {
      console.error('[Dashboard Checkins] Failed to fetch:', res.status, res.statusText)
      // Return empty series instead of error to prevent dashboard from breaking
      const today = new Date()
      const series: { date: string; count: number }[] = []
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        series.push({ date: d.toISOString().slice(0, 10), count: 0 })
      }
      return NextResponse.json({ series })
    }
    
    const data = await res.json().catch(() => ({ items: [] }))
    const list: any[] = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])

    console.log('[Dashboard Checkins] Found items:', list.length)

    const today = new Date()
    const series: { date: string; count: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const count = list.filter((r) => {
        const ci = String(r.checkin_at || r.checkinAt || r.checkin_at_time || r.checkInDate || '')
        return ci.slice(0, 10) === dateStr
      }).length
      series.push({ date: dateStr, count })
    }

    return NextResponse.json({ series })
  } catch (error) {
    console.error('[Dashboard Checkins] API error:', error)
    // Return empty series instead of error to prevent dashboard from breaking
    const { searchParams } = new URL(req.url)
    const days = Math.min(Math.max(Number(searchParams.get('days') || '14'), 7), 30)
    const today = new Date()
    const series: { date: string; count: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      series.push({ date: d.toISOString().slice(0, 10), count: 0 })
    }
    return NextResponse.json({ series })
  }
}



