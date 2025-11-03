import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/system/tasks`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ([]))
    const list: any[] = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])

    const toKey = (s: string) => String(s || '').toUpperCase()
    const todo = list.filter((t) => toKey(t.status) === 'TODO' || toKey(t.status) === 'PENDING').length
    const in_progress = list.filter((t) => toKey(t.status) === 'IN_PROGRESS').length
    const done = list.filter((t) => toKey(t.status) === 'DONE' || toKey(t.status) === 'COMPLETED').length
    const cancelled = list.filter((t) => toKey(t.status) === 'CANCELLED' || toKey(t.status) === 'CANCELED').length

    return NextResponse.json({ todo, in_progress, done, cancelled })
  } catch (error) {
    console.error('Tasks API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}



