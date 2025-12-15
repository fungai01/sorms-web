import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/config'
import { getAuthorizationHeader, isAdmin } from '@/lib/auth-utils'

const BASE = API_CONFIG.BASE_URL

export async function POST(req: NextRequest) {
  if (!await isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
  }
  try {
    const body = await req.json().catch(() => ({}))
    let userId = body.userId ?? body.accountId ?? body.id
    const userEmail = body.userEmail || body.email || undefined
    const roles = Array.isArray(body.roles) ? body.roles : []
    if ((!userId && !userEmail) || roles.length === 0) {
      return NextResponse.json({ error: 'userId or userEmail and roles[] are required' }, { status: 400 })
    }

    const auth = getAuthorizationHeader(req)

    // Resolve userId by email if missing
    if (!userId && userEmail) {
      try {
        const searchUrl = new URL('users/search', BASE)
        searchUrl.searchParams.set('page', '0')
        searchUrl.searchParams.set('size', '1')
        searchUrl.searchParams.set('email', userEmail)
        searchUrl.searchParams.set('keyword', userEmail)
        const r = await fetch(searchUrl.toString(), { headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) }, cache: 'no-store' })
        const js = await r.json().catch(() => ({}))
        const list = Array.isArray(js?.data?.content) ? js.data.content : Array.isArray(js?.content) ? js.content : Array.isArray(js?.data) ? js.data : Array.isArray(js) ? js : []
        const found = list.find((u: any) => String(u.email || '').toLowerCase() === String(userEmail).toLowerCase())
        userId = found?.id
      } catch {}
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unable to resolve userId from email' }, { status: 400 })
    }

    // Try backend common endpoints for role assignment
    const candidates = [
      { method: 'PUT', path: `users/${encodeURIComponent(String(userId))}/roles`, payload: { roles } },
      { method: 'POST', path: 'roles/assign', payload: { userId, roles } },
    ] as const

    let lastError: string | null = null
    for (const c of candidates) {
      try {
        const url = new URL(c.path, BASE).toString()
        const res = await fetch(url, {
          method: c.method,
          headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
          body: JSON.stringify(c.payload)
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          return NextResponse.json({ ok: true, data: data?.data ?? data })
        }
        lastError = data?.error || data?.message || `HTTP ${res.status}`
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e)
      }
    }

    return NextResponse.json({ ok: false, note: 'No backend endpoint matched for role assignment', error: lastError || undefined })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

