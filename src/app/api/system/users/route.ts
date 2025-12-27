import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { isAdmin, verifyToken, getAuthorizationHeader } from '@/lib/auth-service'

// GET - list users, self profile, or specific user by id
export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    let userInfo
    try {
      userInfo = await verifyToken(req)
    } catch (tokenError: any) {
      console.error('[GET /api/system/users] Token verification failed:', tokenError?.message)
      return NextResponse.json({ error: 'Unauthenticated', items: [] }, { status: 401 })
    }
    
    if (!userInfo) {
      return NextResponse.json({ error: 'Unauthenticated', items: [] }, { status: 401 })
    }
    
    const { searchParams } = new URL(req.url)
    const self = searchParams.get('self') === '1'
    const userIdParam = searchParams.get('id')

    if (userIdParam) {
      const userId = String(userIdParam).trim()
      if (!userId) {
        return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
      }

      const me = await verifyToken(req).catch(() => null)
      if (!me) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const amAdmin = await isAdmin(req)
      if (!amAdmin && String(me.id) !== String(userId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const auth = getAuthorizationHeader(req)
      const options: RequestInit = auth ? { headers: { Authorization: auth }, cache: 'no-store' } : { cache: 'no-store' }
      const userIdNum = Number(userId)
      if (Number.isNaN(userIdNum)) {
        return NextResponse.json({ items: [], error: 'Invalid user ID' }, { status: 400 })
      }
      // `getUser` currently accepts only the user ID
      const response = await apiClient.getUser(userIdNum)
      if (!response.success) {
        return NextResponse.json({ items: [], error: response.error || 'Request failed' }, { status: 500 })
      }
      return NextResponse.json({ items: response.data ? [response.data] : [] })
    }

    if (self) {
      const auth = getAuthorizationHeader(req)
      const me = await verifyToken(req).catch(() => null)

      if (!me?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const options: RequestInit = auth ? { headers: { Authorization: auth }, cache: 'no-store' } : { cache: 'no-store' }
      // `getUsers` now accepts options parameter for authentication
      const response = await apiClient.getUsers({ 
        keyword: me.email, 
        page: 0, 
        size: 1 
      }, options)
      
      if (!response.success) {
        return NextResponse.json({ items: [], error: response.error || 'Request failed' }, { status: 500 })
      }

      let items: any[] = []
      const payload = response.data as any
      if (Array.isArray(payload?.content)) items = payload.content
      else if (Array.isArray(payload?.data)) items = payload.data
      else if (Array.isArray(payload)) items = payload

      const found = items.find((u: any) => (u?.email || '').toLowerCase() === me.email.toLowerCase())
      return NextResponse.json({ items: found ? [found] : [] })
    }

    const page = searchParams.get('page') || '0'
    const size = searchParams.get('size') || '50'
    const keyword = searchParams.get('q') || ''

    const auth = getAuthorizationHeader(req)
    const options: RequestInit = auth ? { headers: { Authorization: auth }, cache: 'no-store' } : { cache: 'no-store' }
    // `getUsers` now accepts options parameter for authentication
    const response = await apiClient.getUsers({
      keyword: keyword || undefined,
      page: Number(page),
      size: Number(size)
    }, options)

    if (!response.success) {
      console.error('[GET /api/system/users] API call failed:', response.error)
      return NextResponse.json(
        {
          items: [],
          error: response.error || 'Request failed',
        },
        { status: 500 }
      )
    }

    const data = response.data as any
    let items: any[] = []
    if (Array.isArray(data?.content)) items = data.content
    else if (Array.isArray(data?.data)) items = data.data
    else if (Array.isArray(data)) items = data
    else if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) items = [data.data]

    return NextResponse.json({ items })
  } catch (e: any) {
    console.error('[GET /api/system/users] Error:', e)
    console.error('[GET /api/system/users] Stack:', e?.stack)
    return NextResponse.json({ items: [], error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// POST - create/activate/deactivate user
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const userId = searchParams.get('userId')

    if (action === 'create') {
      const body = await req.json().catch(() => ({}))
      const securePassword = `sorms_${Date.now()}_${Math.random().toString(36).substring(2)}`

      const payload = {
        email: body.email,
        password: securePassword,
        fullName: body.full_name || body.fullName,
        phoneNumber: body.phone_number || body.phoneNumber,
        firstName: body.firstName || '',
        lastName: body.lastName || '',
      }

      const response = await apiClient.post('/users', payload)
      
      if (!response.success) {
        // Check for specific error codes
        if (response.error?.includes('U0002') || response.error?.includes('already exists')) {
          return NextResponse.json(
            { error: 'Email already exists', responseCode: 'U0002' },
            { status: 400 }
          )
        }
        return NextResponse.json(
          { error: response.error || 'Request failed', responseCode: null },
          { status: 500 }
        )
      }

      return NextResponse.json(response.data, { status: 201 })
    }

    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (action === 'activate' && userId) {
      const id = String(userId).trim()
      if (!id) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
      const auth = getAuthorizationHeader(req)
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      const response = await apiClient.put(`/users/${encodeURIComponent(id)}/activate`, undefined, options)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      return NextResponse.json(response.data)
    }

    if (action === 'deactivate' && userId) {
      const id = String(userId).trim()
      if (!id) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
      const auth = getAuthorizationHeader(req)
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      const response = await apiClient.put(`/users/${encodeURIComponent(id)}/deactivate`, undefined, options)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      return NextResponse.json(response.data)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || ''
    const body = await req.json().catch(() => ({}))

    const idRaw = body.id ?? body.userId
    const id = idRaw !== undefined && idRaw !== null ? String(idRaw).trim() : ''
    
    // Check if this is a profile update (user updating their own profile)
    const me = await verifyToken(req).catch(() => null)
    const isProfileUpdate = me && id && String(id) === String(me.id)
    
    // If user is updating their own profile, use /users/profile endpoint
    if (isProfileUpdate) {
      const userIdForProfile = body.userId ?? body.id ?? me?.id

      const payload = {
        // Backend UpdateProfileRequest expects userId from body
        userId: userIdForProfile ? String(userIdForProfile) : undefined,
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

      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      const response = await apiClient.put('/users/profile', payload, options)
      
      if (!response.success) {
        return NextResponse.json(
          {
            error: response.error || 'Request failed',
            backendStatus: 500,
            responseCode: null,
          },
          { status: 500 }
        )
      }

      return NextResponse.json(response.data)
    }

    // Admin updating other users
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const amAdmin = await isAdmin(req)
    if (!amAdmin) {
      if (!me?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (String(id) !== String(me.id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

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

    const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
    const response = await apiClient.put(`/users/${encodeURIComponent(id)}`, payload, options)
    
    if (!response.success) {
      return NextResponse.json(
        {
          error: response.error || 'Request failed',
          backendStatus: 500,
          responseCode: null,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(response.data)
  } catch (e: any) {
    console.error('[PUT /api/system/users] Error:', e)
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const idRaw = searchParams.get('id')
    const id = idRaw ? String(idRaw).trim() : ''
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const auth = getAuthorizationHeader(req)
    const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
    const response = await apiClient.delete(`/users/${encodeURIComponent(id)}`, options)
    if (!response.success) {
      return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
    }
    return NextResponse.json(response.data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
