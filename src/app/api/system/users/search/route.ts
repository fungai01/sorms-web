import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/config'
import { getAuthorizationHeader } from '@/lib/auth-utils'

const BASE = API_CONFIG.BASE_URL

// Alias endpoint for convenience: /api/system/users/search
// Mirrors the listing behavior of /api/system/users (GET)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = searchParams.get('page') || '0'
    const size = searchParams.get('size') || '50'
    const keyword = searchParams.get('q') || ''
    const email = searchParams.get('email') || ''
    const fullName = searchParams.get('fullName') || ''

    // Build backend URL
    const url = new URL('users/search', `${BASE}/`)
    url.searchParams.set('page', page)
    url.searchParams.set('size', size)

    // If explicit filters provided, forward them; otherwise map generic q to email/fullName
    if (email) url.searchParams.set('email', email)
    if (fullName) url.searchParams.set('fullName', fullName)
    if (keyword && !email && !fullName) {
      url.searchParams.set('email', keyword)
      url.searchParams.set('fullName', keyword)
      url.searchParams.set('keyword', keyword)
      url.searchParams.set('q', keyword)
    }

    const auth = getAuthorizationHeader(req)
    const res = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
      cache: 'no-store'
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      // Normalize error to empty list but surface info in fields
      return NextResponse.json({
        items: [],
        error: errorText || `Backend error: ${res.status}`,
        backendStatus: res.status,
      }, { status: 200 })
    }

    const data = await res.json().catch(() => ({}))

    // Normalize to array of items
    let items: any[] = []
    if (Array.isArray(data?.data?.content)) items = data.data.content
    else if (Array.isArray(data?.content)) items = data.content
    else if (Array.isArray(data?.data)) items = data.data
    else if (Array.isArray(data)) items = data
    else if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) items = [data.data]

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message || 'Internal server error' }, { status: 200 })
  }
}

