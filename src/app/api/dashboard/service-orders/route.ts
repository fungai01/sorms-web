import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/system/orders`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ([]))
    const list: any[] = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])

    const counts = new Map<string, number>()
    for (const o of list) {
      const name = String(o.serviceName || o.service_name || o.name || 'Khác')
      counts.set(name, (counts.get(name) || 0) + 1)
    }
    const top = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return NextResponse.json({ top })
  } catch (error) {
    console.error('Service Orders API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}



