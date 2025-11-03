import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const days = Math.min(Math.max(Number(searchParams.get('days') || '14'), 7), 30)

    // Fetch real checkins from system API
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/system/checkins`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ([]))
    const list: any[] = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])

    const today = new Date()
    const series: { date: string; count: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const count = list.filter((r) => {
        const ci = String(r.checkin_at || r.checkinAt || r.checkin_at_time || '')
        return ci.slice(0, 10) === dateStr
      }).length
      series.push({ date: dateStr, count })
    }

    return NextResponse.json({ series })
  } catch (error) {
    console.error('Checkins API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}



