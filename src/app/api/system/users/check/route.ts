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

    console.log('🔍 Checking user existence for:', email)

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Gọi backend API để tìm user theo email
    const url = new URL(`${BASE}/users/search`)
    url.searchParams.set('keyword', email)
    url.searchParams.set('page', '0')
    url.searchParams.set('size', '10') // Tăng size để đảm bảo tìm được

    console.log('🔍 Calling backend:', url.toString())

    const res = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json', accept: '*/*' },
      cache: 'no-store'
    })

    console.log('🔍 Backend response status:', res.status)

    if (!res.ok) {
      console.error('❌ Backend search failed:', res.status)
      // Nếu backend lỗi, trả về exists: false để flow tiếp tục
      return NextResponse.json({
        exists: false,
        error: `Backend error: ${res.status}`
      })
    }

    const data = await res.json().catch(() => ({}))
    console.log('🔍 Backend response data:', JSON.stringify(data, null, 2))

    const users = Array.isArray(data?.data?.content) ? data.data.content : []
    console.log('🔍 Found users count:', users.length)

    // Tìm user có email khớp chính xác (case-insensitive)
    const user = users.find((u: any) =>
      u.email?.toLowerCase() === email.toLowerCase()
    )

    if (user) {
      console.log('✅ User exists:', user.email, 'Status:', user.status)
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
    } else {
      console.log('ℹ️ User not found in search results for:', email)
      return NextResponse.json({
        exists: false
      })
    }
  } catch (e: any) {
    console.error('❌ Error checking user:', e)
    return NextResponse.json({
      exists: false,
      error: e?.message || 'Internal server error'
    })
  }
}

