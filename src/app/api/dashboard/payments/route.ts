import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const days = Math.min(Math.max(Number(searchParams.get('days') || '14'), 7), 30)

    // Use service orders as revenue proxy if payments list endpoint is unavailable
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/system/orders`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ([]))
    const list: any[] = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])

    const today = new Date()
    const series: { date: string; sum: number }[] = []
    let totalSum = 0
    let count = 0

    const getAmount = (o: any) => {
      const qty = Number(o.quantity || o.qty || 1)
      const unit = Number(o.unitPrice || o.unit_price || o.price || 0)
      const total = Number(o.total || o.amount || qty * unit || 0)
      return isNaN(total) ? 0 : total
    }

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const dayItems = list.filter((o) => {
        const created = String(o.created_at || o.createdAt || o.date || '')
        return created.slice(0, 10) === dateStr
      })
      const daySum = dayItems.reduce((s, o) => s + getAmount(o), 0)
      series.push({ date: dateStr, sum: daySum })
      totalSum += daySum
      count += dayItems.length
    }

    return NextResponse.json({ count, sum: totalSum, series })
  } catch (error) {
    console.error('Payments API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}



