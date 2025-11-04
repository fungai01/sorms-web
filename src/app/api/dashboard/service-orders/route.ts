import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_PATH || ''
    const url = `${baseUrl}/api/system/orders`
    
    console.log('[Dashboard Service Orders] Fetching from:', url)
    
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    
    console.log('[Dashboard Service Orders] Response status:', res.status)
    
    if (!res.ok) {
      console.error('[Dashboard Service Orders] Failed to fetch:', res.status, res.statusText)
      // Return empty top list instead of error to prevent dashboard from breaking
      return NextResponse.json({ top: [] })
    }
    
    const data = await res.json().catch(() => ({ items: [] }))
    const list: any[] = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])

    console.log('[Dashboard Service Orders] Found items:', list.length)

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
    console.error('[Dashboard Service Orders] API error:', error)
    // Return empty top list instead of error to prevent dashboard from breaking
    return NextResponse.json({ top: [] })
  }
}



