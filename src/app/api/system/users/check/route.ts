import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/config'

const BASE = API_CONFIG.BASE_URL

/**
 * GET /api/system/users/check?email=xxx
 * Kiểm tra user đã tồn tại trong database chưa
 * Public endpoint - không cần authentication
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const url = new URL('users/search', BASE)
    url.searchParams.set('keyword', email)
    url.searchParams.set('page', '0')
    url.searchParams.set('size', '10')

    const res = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json', accept: '*/*' },
      cache: 'no-store'
    })

    if (!res.ok) {
      return NextResponse.json({
        exists: false,
        error: `Backend error: ${res.status}`
      })
    }

    const data = await res.json().catch(() => ({}))
    const users = Array.isArray(data?.data?.content) ? data.data.content : []
    const user = users.find((u: any) =>
      u.email?.toLowerCase() === email.toLowerCase()
    )

    if (user) {
      return NextResponse.json({
        exists: true,
        status: user.status,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          status: user.status,
          role: user.role
        }
      })
    }
    return NextResponse.json({ exists: false })
  } catch (e: any) {
    return NextResponse.json({
      exists: false,
      error: e?.message || 'Internal server error'
    })
  }
}

