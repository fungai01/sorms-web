import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/config'
import { isAdmin, verifyToken } from '@/lib/auth-utils'

const BASE = API_CONFIG.BASE_URL

// GET - Lấy danh sách users
// - Admin: có thể xem list (phân trang)
// - User thường: dùng ?self=1 để lấy đúng hồ sơ của chính mình
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const self = searchParams.get('self') === '1'

    // Truy vấn hồ sơ bản thân: bỏ qua kiểm tra admin
    if (self) {
      const auth = req.headers.get('authorization') || ''
      // Lấy email hiện tại từ token
      const me = await verifyToken(req)
      if (!me?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Tìm theo email trong backend
      const url = new URL('users/search', BASE)
      url.searchParams.set('page', '0')
      url.searchParams.set('size', '1')
      url.searchParams.set('keyword', me.email)
      url.searchParams.set('q', me.email)

      const res = await fetch(url.toString(), {
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
        cache: 'no-store'
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return NextResponse.json({ items: [], error: text || `Backend error: ${res.status}` }, { status: 200 })
      }

      const payload = await res.json().catch(() => ({} as any))

      // Chuẩn hóa mảng kết quả
      let items: any[] = []
      if (Array.isArray(payload?.data?.content)) items = payload.data.content
      else if (Array.isArray(payload?.content)) items = payload.content
      else if (Array.isArray(payload?.data)) items = payload.data
      else if (Array.isArray(payload)) items = payload

      // Lọc đúng email
      const found = items.find((u: any) => (u?.email || '').toLowerCase() === me.email.toLowerCase())
      return NextResponse.json({ items: found ? [found] : [] })
    }

    // Không phải self: yêu cầu quyền admin
    const adminCheck = await isAdmin(req)
    if (!adminCheck) {
      console.warn('[API] Unauthorized access attempt to /api/system/users')
      return NextResponse.json({ 
        error: 'Unauthorized - Admin access required',
        message: 'You must be an admin to access this resource'
      }, { status: 403 })
    }

    const page = searchParams.get('page') || '0'
    const size = searchParams.get('size') || '50'
    const keyword = searchParams.get('q') || ''

    console.log('[API] GET /api/system/users - params:', { page, size, keyword })

    const url = new URL('users/search', BASE)
    url.searchParams.set('page', page)
    url.searchParams.set('size', size)
    if (keyword) {
      url.searchParams.set('keyword', keyword)
      url.searchParams.set('q', keyword)
    }

    console.log('[API] Fetching users from:', url.toString())
    const auth = req.headers.get('authorization') || ''
    const res = await fetch(url.toString(), { headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) }, cache: 'no-store' })

    console.log('[API] Backend response status:', res.status)

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[API] Backend returned error. Status:', res.status);
      console.error('[API] Backend error response:', errorText);
      
      let errorData: any = {}
      try { errorData = JSON.parse(errorText) } catch { errorData = { message: errorText } }
      
      return NextResponse.json({ 
        items: [],
        error: errorData.message || errorData.responseCode || `Backend error: ${res.status}`,
        responseCode: errorData.responseCode,
        backendStatus: res.status
      }, { status: 200 })
    }

    const data = await res.json().catch(() => ({}))
    console.log('[API] Backend response data:', JSON.stringify(data, null, 2))

    let items = [] as any[]
    if (Array.isArray(data?.data?.content)) {
      items = data.data.content
      console.log('[API] Format: data.data.content (Pageable)')
    } else if (Array.isArray(data?.data)) {
      items = data.data
      console.log('[API] Format: data.data (Array)')
    } else if (Array.isArray(data?.content)) {
      items = data.content
      console.log('[API] Format: data.content (Pageable direct)')
    } else if (Array.isArray(data)) {
      items = data
      console.log('[API] Format: root array')
    } else if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
      items = [data.data]
      console.log('[API] Format: single object in data')
    }
    
    console.log('[API] Extracted items count:', items.length)
    if (items.length > 0) {
      console.log('[API] Sample item:', JSON.stringify(items[0], null, 2))
      console.log('[API] Sample item email:', items[0]?.email)
    } else {
      console.warn('[API] No items found in response')
      console.log('[API] Full response structure:', Object.keys(data))
    }

    return NextResponse.json({ items })
  } catch (e: any) {
    console.error('[API] GET error:', e)
    return NextResponse.json({ items: [] })
  }
}

// POST - Activate/Deactivate user hoặc tạo user mới
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const userId = searchParams.get('userId')

    // Create new user (khi user login lần đầu) - KHÔNG cần admin permission
    if (action === 'create') {
      const body = await req.json().catch(() => ({}))
      // Generate a random, secure password because the backend requires it
      const securePassword = `sorms_${Date.now()}_${Math.random().toString(36).substring(2)}`;

      const payload = {
        email: body.email,
        password: securePassword,
        fullName: body.full_name || body.fullName,
        phoneNumber: body.phone_number || body.phoneNumber,
        firstName: body.firstName || '',
        lastName: body.lastName || '',
        // role: body.role, // Backend assigns a default role, so we do not send it.
      }
      console.log('🔑 Creating user with payload:', JSON.stringify(payload, null, 2));

      const auth = req.headers.get('authorization') || ''
      const res = await fetch(new URL('users', BASE).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(payload)
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        console.error('❌ Backend user creation failed. Status:', res.status);
        console.error('❌ Backend response:', JSON.stringify(data, null, 2));

        // Check if it's a duplicate user error
        if (data.responseCode === 'U0002') {
          return NextResponse.json({ 
            error: 'Email đã tồn tại trong hệ thống',
            responseCode: 'U0002'
          }, { status: 400 });
        }

        return NextResponse.json({
          error: data.message || data.error || `Backend error: ${res.status}`,
          responseCode: data.responseCode || null
        }, { status: res.status });
      }

      console.log('✅ User created successfully:', JSON.stringify(data.data, null, 2));
      return NextResponse.json(data?.data ?? data, { status: 201 })
    }

    // Các action khác CẦN admin permission
    if (!await isAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Activate user
    if (action === 'activate' && userId) {
      const id = parseInt(userId)
      if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
      }
      const auth = req.headers.get('authorization') || ''
      const res = await fetch(new URL(`users/${id}/activate`, BASE).toString(), { method: 'PUT', headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data?.data ?? data)
    }

    // Deactivate user
    if (action === 'deactivate' && userId) {
      const id = parseInt(userId)
      if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
      }
      const auth = req.headers.get('authorization') || ''
      const res = await fetch(new URL(`users/${id}/deactivate`, BASE).toString(), { method: 'PUT', headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data?.data ?? data)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || ''
    const body = await req.json().catch(() => ({}))
    const id = Number(body.id)
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Admins can update anyone, normal users can only update themselves
    const amAdmin = await isAdmin(req)
    if (!amAdmin) {
      const me = await (await import('@/lib/auth-utils')).verifyToken(req)
      if (!me?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (String(id) !== String(me.id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Map to UpdateUserRequest respecting both camelCase/snake_case inputs
    const payload = {
      id,
      fullName: body.fullName ?? body.full_name,
      phoneNumber: body.phoneNumber ?? body.phone_number,
      firstName: body.firstName ?? body.first_name,
      lastName: body.lastName ?? body.last_name,
      dateOfBirth: body.dateOfBirth ?? body.date_of_birth,
      gender: body.gender,
      address: body.address,
      city: body.city,
      state: body.state ?? body.states,
      postalCode: body.postalCode ?? body.postalCodes ?? body.postal_code,
      country: body.country,
      avatarUrl: body.avatarUrl ?? body.avatar_url,
      bio: body.bio,
      preferredLanguage: body.preferredLanguage ?? body.preferredLanguages,
      timezone: body.timezone ?? body.timezones,
      emergencyContactName: body.emergencyContactName ?? body.emergencyContactNames,
      emergencyContactPhone: body.emergencyContactPhone ?? body.emergencyContactPhones,
      emergencyContactRelationship: body.emergencyContactRelationship,
      idCardNumber: body.idCardNumber,
      idCardIssueDate: body.idCardIssueDate ?? body.idCardIssueDates,
      idCardIssuePlace: body.idCardIssuePlace ?? body.idCardIssuePlaces,
    }

    const res = await fetch(new URL(`users/${id}`, BASE).toString(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
      body: JSON.stringify(payload)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    return NextResponse.json(data?.data ?? data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!await isAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const idStr = searchParams.get('id')
    const id = idStr ? Number(idStr) : NaN
    if (!id || isNaN(id)) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const res = await fetch(new URL(`users/${id}`, BASE).toString(), { method: 'DELETE', headers: { 'Content-Type': 'application/json', accept: '*/*' } })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    return NextResponse.json(data?.data ?? data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}


