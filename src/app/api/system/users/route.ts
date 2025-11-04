import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { API_CONFIG } from '@/lib/config'

const BASE = API_CONFIG.BASE_URL
const adminEmail = process.env.ADMIN_EMAIL_WHITELIST || 'quyentnqe170062@fpt.edu.vn'

// Helper: Check if user is admin
async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const email = (token as any)?.email as string | undefined
  return email?.toLowerCase() === adminEmail.toLowerCase()
}

// GET - Lấy danh sách users (chỉ admin)
export async function GET(req: NextRequest) {
  try {
    // Admin only for list
    if (!await isAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const page = searchParams.get('page') || '0'
    const size = searchParams.get('size') || '50'
    const keyword = searchParams.get('q') || ''

    console.log('[API] GET /api/system/users - params:', { page, size, keyword })

    const url = new URL(`${BASE}/users/search`)
    url.searchParams.set('page', page)
    url.searchParams.set('size', size)
    if (keyword) url.searchParams.set('keyword', keyword)

    console.log('[API] Fetching users from:', url.toString())
    const res = await fetch(url.toString(), { headers: { 'Content-Type': 'application/json', accept: '*/*' }, cache: 'no-store' })

    console.log('[API] Backend response status:', res.status)

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[API] Backend returned error. Status:', res.status);
      console.error('[API] Backend error response:', errorText);
      console.warn('[API] Returning empty array as fallback')
      return NextResponse.json({ items: [] })
    }

    const data = await res.json().catch(() => ({}))
    console.log('[API] Backend response data:', JSON.stringify(data, null, 2))

    const items = Array.isArray(data?.data?.content) ? data.data.content :
                  (Array.isArray(data?.data) ? data.data :
                  (Array.isArray(data) ? data : []))
    console.log('[API] Extracted items count:', items.length)
    console.log('[API] Sample item:', items[0] ? JSON.stringify(items[0], null, 2) : 'No items')
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

      const res = await fetch(`${BASE}/users`, {
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
          return NextResponse.json({ error: 'Email đã tồn tại trong hệ thống' }, { status: 400 });
        }

        return NextResponse.json({
          error: data.message || `Backend error: ${res.status}`
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
      const res = await fetch(`${BASE}/users/${id}/activate`, { method: 'PUT', headers: { 'Content-Type': 'application/json', accept: '*/*' } })
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
      const res = await fetch(`${BASE}/users/${id}/deactivate`, { method: 'PUT', headers: { 'Content-Type': 'application/json', accept: '*/*' } })
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
    if (!await isAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const id = Number(body.id)
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    // Map to UpdateUserRequest (pluralized keys per spec)
    const payload = {
      id,
      fullName: body.fullName || body.full_name,
      phoneNumber: body.phoneNumber || body.phone_number,
      firstName: body.firstName || body.first_name,
      lastName: body.lastName || body.last_name,
      dateOfBirth: body.dateOfBirth || body.date_of_birth,
      gender: body.gender,
      address: body.address,
      city: body.city,
      state: body.states ?? body.state,
      postalCode: body.postalCodes ?? body.postalCode ?? body.postal_code,
      country: body.country,
      avatarUrl: body.avatarUrl || body.avatar_url,
      bio: body.bio,
      preferredLanguage: body.preferredLanguages ?? body.preferredLanguage,
      timezone: body.timezones ?? body.timezone,
      emergencyContactName: body.emergencyContactNames ?? body.emergencyContactName,
      emergencyContactPhone: body.emergencyContactPhones ?? body.emergencyContactPhone,
      emergencyContactRelationship: body.emergencyContactRelationship,
      idCardNumber: body.idCardNumber,
      idCardIssueDate: body.idCardIssueDates ?? body.idCardIssueDate,
      idCardIssuePlace: body.idCardIssuePlaces ?? body.idCardIssuePlace,
    }
    const res = await fetch(`${BASE}/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', accept: '*/*' }, body: JSON.stringify(payload) })
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
    const res = await fetch(`${BASE}/users/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', accept: '*/*' } })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    return NextResponse.json(data?.data ?? data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}


