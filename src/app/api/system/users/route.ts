import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { API_CONFIG } from '@/lib/config'

const BASE = API_CONFIG.BASE_URL

// Helper: Check if email is admin (supports multiple admins)
function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAIL_WHITELIST || 'quyentnqe170062@fpt.edu.vn').split(',');
  return adminEmails.some(adminEmail =>
    email.toLowerCase() === adminEmail.trim().toLowerCase()
  );
}

// Helper: Check if user is admin
async function isAdmin(req: NextRequest): Promise<boolean> {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    const email = (token as any)?.email as string | undefined

    if (!email) {
      return false;
    }

    const adminCheck = isAdminEmail(email);

    console.log('[API] Admin check:', {
      hasToken: !!token,
      email: email,
      adminEmails: process.env.ADMIN_EMAIL_WHITELIST,
      isAdmin: adminCheck
    })

    return adminCheck;
  } catch (error) {
    console.error('[API] Error checking admin:', error)
    return false
  }
}

// GET - Lấy danh sách users (chỉ admin)
export async function GET(req: NextRequest) {
  try {
    // Admin only for list
    const adminCheck = await isAdmin(req)
    if (!adminCheck) {
      console.warn('[API] Unauthorized access attempt to /api/system/users')
      return NextResponse.json({ 
        error: 'Unauthorized - Admin access required',
        message: 'You must be an admin to access this resource'
      }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const page = searchParams.get('page') || '0'
    const size = searchParams.get('size') || '50'
    const keyword = searchParams.get('q') || ''

    console.log('[API] GET /api/system/users - params:', { page, size, keyword })

    const url = new URL('users/search', BASE)
    url.searchParams.set('page', page)
    url.searchParams.set('size', size)
    // Backend có thể dùng 'keyword' hoặc 'q' cho search
    if (keyword) {
      url.searchParams.set('keyword', keyword)
      // Thử cả 'q' nếu backend hỗ trợ
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
      
      // Try to parse error response
      let errorData: any = {}
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { message: errorText }
      }
      
      // Return error information instead of empty array
      return NextResponse.json({ 
        items: [],
        error: errorData.message || errorData.responseCode || `Backend error: ${res.status}`,
        responseCode: errorData.responseCode,
        backendStatus: res.status
      }, { status: 200 }) // Return 200 but with error info
    }

    const data = await res.json().catch(() => ({}))
    console.log('[API] Backend response data:', JSON.stringify(data, null, 2))

    // Handle multiple response formats
    let items = []
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
      // Single object wrapped in data
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
    const res = await fetch(new URL(`users/${id}`, BASE).toString(), { method: 'PUT', headers: { 'Content-Type': 'application/json', accept: '*/*' }, body: JSON.stringify(payload) })
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


