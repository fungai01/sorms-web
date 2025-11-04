import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const days = Math.min(Math.max(Number(searchParams.get('days') || '14'), 7), 30)

    // Use service orders as revenue proxy if payments list endpoint is unavailable
    const baseUrl = process.env.NEXT_PUBLIC_BASE_PATH || ''
    const url = `${baseUrl}/api/system/orders`
    
    console.log('[Dashboard Payments] Fetching from:', url)
    
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    
    console.log('[Dashboard Payments] Response status:', res.status)
    
    if (!res.ok) {
      console.error('[Dashboard Payments] Failed to fetch:', res.status, res.statusText)
      // Return empty series instead of error to prevent dashboard from breaking
      const today = new Date()
      const series: { date: string; sum: number }[] = []
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        series.push({ date: d.toISOString().slice(0, 10), sum: 0 })
      }
      return NextResponse.json({ count: 0, sum: 0, series })
    }
    
    const data = await res.json().catch(() => ({ items: [] }))
    const list: any[] = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])

    console.log('[Dashboard Payments] Found items:', list.length)

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
        const created = String(o.created_at || o.createdAt || o.date || o.orderDate || '')
        return created.slice(0, 10) === dateStr
      })
      const daySum = dayItems.reduce((s, o) => s + getAmount(o), 0)
      series.push({ date: dateStr, sum: daySum })
      totalSum += daySum
      count += dayItems.length
    }

    return NextResponse.json({ count, sum: totalSum, series })
  } catch (error) {
    console.error('[Dashboard Payments] API error:', error)
    // Return empty series instead of error to prevent dashboard from breaking
    const { searchParams } = new URL(req.url)
    const days = Math.min(Math.max(Number(searchParams.get('days') || '14'), 7), 30)
    const today = new Date()
    const series: { date: string; sum: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      series.push({ date: d.toISOString().slice(0, 10), sum: 0 })
    }
    return NextResponse.json({ count: 0, sum: 0, series })
  }
}



