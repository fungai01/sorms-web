import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_PATH || `http://localhost:${process.env.PORT || 3002}`
    const url = `${baseUrl}/api/system/tasks`

    console.log('[Dashboard Tasks] Fetching from:', url)

    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    
    console.log('[Dashboard Tasks] Response status:', res.status)
    
    if (!res.ok) {
      console.error('[Dashboard Tasks] Failed to fetch:', res.status, res.statusText)
      // Return empty counts instead of error to prevent dashboard from breaking
      return NextResponse.json({ todo: 0, in_progress: 0, done: 0, cancelled: 0 })
    }
    
    const data = await res.json().catch(() => ({ items: [] }))
    const list: any[] = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])

    console.log('[Dashboard Tasks] Found items:', list.length)

    const toKey = (s: string) => String(s || '').toUpperCase()
    const todo = list.filter((t) => toKey(t.status) === 'TODO' || toKey(t.status) === 'PENDING').length
    const in_progress = list.filter((t) => toKey(t.status) === 'IN_PROGRESS').length
    const done = list.filter((t) => toKey(t.status) === 'DONE' || toKey(t.status) === 'COMPLETED').length
    const cancelled = list.filter((t) => toKey(t.status) === 'CANCELLED' || toKey(t.status) === 'CANCELED').length

    return NextResponse.json({ todo, in_progress, done, cancelled })
  } catch (error) {
    console.error('[Dashboard Tasks] API error:', error)
    // Return empty counts instead of error to prevent dashboard from breaking
    return NextResponse.json({ todo: 0, in_progress: 0, done: 0, cancelled: 0 })
  }
}



