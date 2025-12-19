import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/config'
import { isAdmin, verifyToken, getAuthorizationHeader } from '@/lib/auth-utils'

const BASE = API_CONFIG.BASE_URL

// GET - list users, self profile, or specific user by id
export async function GET(req: NextRequest) {
  try {
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
      const url = new URL(`users/${encodeURIComponent(userId)}`, `${BASE}/`)
      const res = await fetch(url.toString(), {
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
        cache: 'no-store',
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return NextResponse.json({ items: [], error: text || `Backend error: ${res.status}` }, { status: res.status })
      }

      const payload = await res.json().catch(() => ({} as any))
      const user = payload?.data || payload
      return NextResponse.json({ items: user ? [user] : [] })
    }

    if (self) {
      const auth = getAuthorizationHeader(req)
      const me = await verifyToken(req).catch(() => null)

      if (!me?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL('users/search', `${BASE}/`)
      url.searchParams.set('page', '0')
      url.searchParams.set('size', '1')
      url.searchParams.set('email', me.email)
      url.searchParams.set('keyword', me.email)
      url.searchParams.set('q', me.email)

      const res = await fetch(url.toString(), {
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
        cache: 'no-store',
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return NextResponse.json({ items: [], error: text || `Backend error: ${res.status}` }, { status: res.status })
      }

      const payload = await res.json().catch(() => ({} as any))
      let items: any[] = []
      if (Array.isArray(payload?.data?.content)) items = payload.data.content
      else if (Array.isArray(payload?.content)) items = payload.content
      else if (Array.isArray(payload?.data)) items = payload.data
      else if (Array.isArray(payload)) items = payload

      const found = items.find((u: any) => (u?.email || '').toLowerCase() === me.email.toLowerCase())
      return NextResponse.json({ items: found ? [found] : [] })
    }

    const page = searchParams.get('page') || '0'
    const size = searchParams.get('size') || '50'
    const keyword = searchParams.get('q') || ''

    const url = new URL('users/search', `${BASE}/`)
    url.searchParams.set('page', page)
    url.searchParams.set('size', size)
    if (keyword) {
      url.searchParams.set('email', keyword)
      url.searchParams.set('fullName', keyword)
      url.searchParams.set('keyword', keyword)
      url.searchParams.set('q', keyword)
    }

    const auth = getAuthorizationHeader(req)
    const res = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
      cache: 'no-store',
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      let errorData: any = {}
      try {
        errorData = errorText ? JSON.parse(errorText) : {}
      } catch {
        errorData = { message: errorText }
      }

      return NextResponse.json(
        {
          items: [],
          error: errorData.message || errorData.responseCode || `Backend error: ${res.status}`,
          responseCode: errorData.responseCode,
          backendStatus: res.status,
        },
        { status: res.status }
      )
    }

    const data = await res.json().catch(() => ({}))
    let items: any[] = []
    if (Array.isArray(data?.data?.content)) items = data.data.content
    else if (Array.isArray(data?.data)) items = data.data
    else if (Array.isArray(data?.content)) items = data.content
    else if (Array.isArray(data)) items = data
    else if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) items = [data.data]

    return NextResponse.json({ items })
  } catch (e: any) {
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

      const endpoint = new URL('users', `${BASE}/`).toString()
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (data.responseCode === 'U0002') {
          return NextResponse.json(
            { error: 'Email already exists', responseCode: 'U0002' },
            { status: 400 }
          )
        }

        return NextResponse.json(
          { error: data.message || data.error || `Backend error: ${res.status}`, responseCode: data.responseCode || null },
          { status: res.status }
        )
      }

      return NextResponse.json(data?.data ?? data, { status: 201 })
    }

    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (action === 'activate' && userId) {
      const id = String(userId).trim()
      if (!id) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
      const auth = getAuthorizationHeader(req)
      const res = await fetch(new URL(`users/${encodeURIComponent(id)}/activate`, `${BASE}/`).toString(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
      })
      const data = await res.json().catch(() => ({}))
      return res.ok
        ? NextResponse.json(data?.data ?? data)
        : NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    }

    if (action === 'deactivate' && userId) {
      const id = String(userId).trim()
      if (!id) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
      const auth = getAuthorizationHeader(req)
      const res = await fetch(new URL(`users/${encodeURIComponent(id)}/deactivate`, `${BASE}/`).toString(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
      })
      const data = await res.json().catch(() => ({}))
      return res.ok
        ? NextResponse.json(data?.data ?? data)
        : NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
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
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const amAdmin = await isAdmin(req)
    if (!amAdmin) {
      const me = await verifyToken(req).catch(() => null)
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

    const targetUrl = new URL(`users/${encodeURIComponent(id)}`, `${BASE}/`).toString()
    const res = await fetch(targetUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
      body: JSON.stringify(payload),
    })
    const text = await res.text().catch(() => '')

    if (!res.ok) {
      let data: any = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        data = { message: text }
      }
      return NextResponse.json(
        {
          error: data?.message || data?.error || `Backend error: ${res.status}`,
          backendStatus: res.status,
          responseCode: data?.responseCode,
        },
        { status: res.status }
      )
    }

    let data: any = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = {}
    }
    return NextResponse.json(data?.data ?? data)
  } catch (e: any) {
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
    const res = await fetch(new URL(`users/${encodeURIComponent(id)}`, BASE).toString(), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
    })
    const data = await res.json().catch(() => ({}))
    return res.ok
      ? NextResponse.json(data?.data ?? data)
      : NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
