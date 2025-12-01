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

    // Xử lý nhiều format response từ backend
    let users: any[] = []
    if (Array.isArray(data?.data?.content)) {
      users = data.data.content
      console.log('🔍 Format: data.data.content (Pageable)')
    } else if (Array.isArray(data?.data)) {
      users = data.data
      console.log('🔍 Format: data.data (Array)')
    } else if (Array.isArray(data?.content)) {
      users = data.content
      console.log('🔍 Format: data.content (Pageable direct)')
    } else if (Array.isArray(data)) {
      users = data
      console.log('🔍 Format: root array')
    } else if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
      // Single object wrapped in data
      users = [data.data]
      console.log('🔍 Format: single object in data')
    }
    
    console.log('🔍 Found users count:', users.length)
    if (users.length > 0) {
      console.log('🔍 Sample user emails:', users.slice(0, 3).map((u: any) => u.email))
    }

    // Tìm user có email khớp chính xác (case-insensitive, trim whitespace)
    const normalizedEmail = email.toLowerCase().trim()
    const user = users.find((u: any) => {
      const userEmail = u.email?.toLowerCase().trim()
      return userEmail === normalizedEmail
    })

    if (user) {
      console.log('✅ User exists:', {
        email: user.email,
        status: user.status,
        role: user.role,
        id: user.id
      })
      return NextResponse.json({
        exists: true,
        status: user.status,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName || user.full_name,
          status: user.status,
          role: user.role
        }
      })
    } else {
      console.log('ℹ️ User not found in search results for:', email)
      console.log('ℹ️ Searched in', users.length, 'users')
      console.log('ℹ️ Looking for email:', normalizedEmail)
      return NextResponse.json({
        exists: false,
        searchedEmail: email,
        normalizedEmail: normalizedEmail,
        totalUsersChecked: users.length
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

