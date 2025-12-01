import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/config'
import { isAdmin } from '@/lib/auth-utils'

const BASE = API_CONFIG.BASE_URL

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

    // Extract specific search parameters
    const email = searchParams.get('email') || ''
    const fullName = searchParams.get('fullName') || ''
    const phoneNumber = searchParams.get('phoneNumber') || ''
    const idCardNumber = searchParams.get('idCardNumber') || ''
    const status = searchParams.get('status') || ''

    console.log('[API] GET /api/system/users - params:', { 
      page, 
      size, 
      keyword,
      email,
      fullName,
      phoneNumber,
      idCardNumber,
      status
    })

    // Get auth token from request
    const authHeader = req.headers.get('authorization')
    const headers: HeadersInit = { 
      'Content-Type': 'application/json', 
      accept: '*/*' 
    }
    
    if (authHeader) {
      headers['Authorization'] = authHeader
      console.log('[API] Using Authorization header from request')
    } else {
      console.warn('[API] No Authorization header found in request')
    }
    
    // Try /users/search endpoint first
    // Backend format: /users/search?email=xxx&fullName=xxx&phoneNumber=xxx&idCardNumber=xxx&status=xxx&page=0&size=10
    let url = new URL(`${BASE}/users/search`)
    url.searchParams.set('page', page)
    url.searchParams.set('size', size)
    
    // Add specific search parameters if provided
    if (email) {
      url.searchParams.set('email', email)
    }
    if (fullName) {
      url.searchParams.set('fullName', fullName)
    }
    if (phoneNumber) {
      url.searchParams.set('phoneNumber', phoneNumber)
    }
    if (idCardNumber) {
      url.searchParams.set('idCardNumber', idCardNumber)
    }
    if (status) {
      url.searchParams.set('status', status)
    }
    
    // If keyword is provided but no specific parameters, try to infer the search type
    if (keyword && !email && !fullName && !phoneNumber && !idCardNumber && !status) {
      // Nếu keyword trông giống email, dùng parameter 'email'
      if (keyword.includes('@')) {
        url.searchParams.set('email', keyword)
      } else if (/^\d+$/.test(keyword)) {
        // Nếu chỉ có số, có thể là phoneNumber hoặc idCardNumber
        // Thử phoneNumber trước (thường ngắn hơn)
        if (keyword.length <= 11) {
          url.searchParams.set('phoneNumber', keyword)
        } else {
          url.searchParams.set('idCardNumber', keyword)
        }
      } else {
        // Nếu không phải email hay số, có thể là fullName
        url.searchParams.set('fullName', keyword)
      }
    }

    console.log('[API] Fetching users from:', url.toString())
    console.log('[API] Request headers:', Object.keys(headers))
    
    let res = await fetch(url.toString(), { 
      headers,
      cache: 'no-store' 
    })

    console.log('[API] Backend response status:', res.status)

    // If /users/search fails with 500, try fallback to /users endpoint
    if (!res.ok && res.status === 500) {
      console.warn('[API] /users/search returned 500, trying fallback to /users endpoint')
      
      // Try fallback endpoint: /users with pagination
      url = new URL(`${BASE}/users`)
      url.searchParams.set('page', page)
      url.searchParams.set('size', size)
      
      // Add search parameters to fallback endpoint
      if (email) {
        url.searchParams.set('email', email)
      }
      if (fullName) {
        url.searchParams.set('fullName', fullName)
      }
      if (phoneNumber) {
        url.searchParams.set('phoneNumber', phoneNumber)
      }
      if (idCardNumber) {
        url.searchParams.set('idCardNumber', idCardNumber)
      }
      if (status) {
        url.searchParams.set('status', status)
      }
      
      // Fallback: use keyword if no specific parameters
      if (keyword && !email && !fullName && !phoneNumber && !idCardNumber && !status) {
        url.searchParams.set('keyword', keyword)
        url.searchParams.set('q', keyword)
      }
      
      console.log('[API] Trying fallback endpoint:', url.toString())
      res = await fetch(url.toString(), { 
        headers,
        cache: 'no-store' 
      })
      
      console.log('[API] Fallback endpoint response status:', res.status)
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[API] Backend returned error. Status:', res.status);
      console.error('[API] Backend error response:', errorText);
      console.error('[API] Request URL:', url.toString());
      console.error('[API] Request headers:', JSON.stringify(headers, null, 2));
      
      // Try to parse error response
      let errorData: any = {}
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { message: errorText || 'Unknown error' }
      }
      
      // Log detailed error information
      console.error('[API] Detailed error info:', {
        status: res.status,
        statusText: res.statusText,
        responseCode: errorData.responseCode,
        message: errorData.message,
        error: errorData.error,
        fullError: errorData
      })
      
      // Return error information instead of empty array
      return NextResponse.json({ 
        items: [],
        error: errorData.message || errorData.error || errorData.responseCode || `Backend error: ${res.status}`,
        responseCode: errorData.responseCode || (res.status === 500 ? 'S0001' : null),
        backendStatus: res.status,
        backendStatusText: res.statusText,
        backendError: errorData
      }, { status: 200 }) // Return 200 but with error info
    }

    const data = await res.json().catch(() => ({}))
    console.log('[API] Backend response data (full):', JSON.stringify(data, null, 2))
    console.log('[API] Backend response type:', typeof data)
    console.log('[API] Backend response isArray:', Array.isArray(data))
    console.log('[API] Backend response keys:', Object.keys(data || {}))
    
    // Check for error response codes first
    if (data?.responseCode && data.responseCode !== 'S0000') {
      console.error('[API] Backend returned error responseCode:', data.responseCode)
      console.error('[API] Backend error message:', data.message || data.error)
      return NextResponse.json({ 
        items: [],
        error: data.message || data.error || 'SYSTEM_ERROR',
        responseCode: data.responseCode,
        backendStatus: res.status,
        backendData: data
      }, { status: 200 })
    }
    
    // Check for error in message field
    if (data?.message && (data.message.includes('ERROR') || data.message.includes('error') || data.message.includes('Error'))) {
      console.error('[API] Backend returned error in message:', data.message)
      return NextResponse.json({ 
        items: [],
        error: data.message,
        responseCode: data.responseCode || 'SYSTEM_ERROR',
        backendStatus: res.status,
        backendData: data
      }, { status: 200 })
    }

    // Handle multiple response formats
    // Backend format: { responseCode: "S0000", message: "SUCCESS", data: { content: [...], page: 0, size: 10, ... } }
    let items = []
    
    // Check for nested structures first - Priority order based on backend response format
    if (data?.data?.content && Array.isArray(data.data.content)) {
      // Format: { data: { content: [...], page: 0, size: 10 } }
      items = data.data.content
      console.log('[API] Format: data.data.content (Pageable) - Found', items.length, 'items')
    } else if (data?.data && Array.isArray(data.data)) {
      // Format: { data: [...] }
      items = data.data
      console.log('[API] Format: data.data (Array) - Found', items.length, 'items')
    } else if (data?.content && Array.isArray(data.content)) {
      // Format: { content: [...] }
      items = data.content
      console.log('[API] Format: data.content (Pageable direct) - Found', items.length, 'items')
    } else if (Array.isArray(data)) {
      // Format: [...] (root array)
      items = data
      console.log('[API] Format: root array - Found', items.length, 'items')
    } else if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
      // Single object wrapped in data: { data: { ... } }
      items = [data.data]
      console.log('[API] Format: single object in data - Found 1 item')
    } else if (data?.items && Array.isArray(data.items)) {
      // Format: { items: [...] }
      items = data.items
      console.log('[API] Format: data.items - Found', items.length, 'items')
    } else {
      // Try to find any array in the response
      const findArray = (obj: any, path = ''): any[] => {
        if (Array.isArray(obj)) return obj
        if (typeof obj !== 'object' || obj === null) return []
        for (const key in obj) {
          const result = findArray(obj[key], `${path}.${key}`)
          if (result.length > 0) return result
        }
        return []
      }
      const foundArray = findArray(data)
      if (foundArray.length > 0) {
        items = foundArray
        console.log('[API] Format: Found nested array - Found', items.length, 'items')
      } else {
        console.warn('[API] No array found in response structure')
        console.warn('[API] Response structure:', JSON.stringify(data, null, 2))
      }
    }
    
    console.log('[API] Final extracted items count:', items.length)
    if (items.length > 0) {
      console.log('[API] Sample item (first):', JSON.stringify(items[0], null, 2))
      console.log('[API] Sample item email:', items[0]?.email)
      console.log('[API] Sample item keys:', Object.keys(items[0] || {}))
    } else {
      console.warn('[API] ⚠️ No items extracted from response')
      console.warn('[API] Full response structure:', JSON.stringify(data, null, 2))
      console.warn('[API] Response keys:', Object.keys(data || {}))
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

      const payload: any = {
        email: body.email,
        password: securePassword,
        fullName: body.full_name || body.fullName,
        phoneNumber: body.phone_number || body.phoneNumber,
        firstName: body.firstName || '',
        lastName: body.lastName || '',
      }
      
      // Nếu có role được gửi từ client, thêm vào payload
      // Backend sẽ validate và gán role phù hợp
      if (body.role) {
        payload.role = body.role;
        console.log('🔑 Including role in payload:', body.role);
      } else {
        console.log('ℹ️ No role provided, backend will assign default role');
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
      // Cho phép cập nhật vai trò nếu backend hỗ trợ trường này
      role: body.role,
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


