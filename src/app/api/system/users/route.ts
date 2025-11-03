import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { API_CONFIG } from '@/lib/config'

const BASE = API_CONFIG.BASE_URL

// Helper: Check if user is admin
async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const email = (token as any)?.email as string | undefined
  const adminEmail = process.env.ADMIN_EMAIL_WHITELIST || 'quyentnqe170062@fpt.edu.vn'
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

    const url = new URL(`${BASE}/users/search`)
    url.searchParams.set('page', page)
    url.searchParams.set('size', size)
    if (keyword) url.searchParams.set('keyword', keyword)

    const res = await fetch(url.toString(), { headers: { 'Content-Type': 'application/json', accept: '*/*' }, cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    const items = Array.isArray(data?.data?.content) ? data.data.content : []
    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
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
      const payload = {
        email: body.email,
        password: body.password,
        fullName: body.full_name || body.fullName,
        phoneNumber: body.phone_number || body.phoneNumber,
        firstName: body.firstName || '',
        lastName: body.lastName || '',
      }
      const res = await fetch(`${BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
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
      states: body.states ?? body.state,
      postalCodes: body.postalCodes ?? body.postalCode ?? body.postal_code,
      country: body.country,
      avatarUrl: body.avatarUrl || body.avatar_url,
      bio: body.bio,
      preferredLanguages: body.preferredLanguages ?? body.preferredLanguage,
      timezones: body.timezones ?? body.timezone,
      emergencyContactNames: body.emergencyContactNames ?? body.emergencyContactName,
      emergencyContactPhones: body.emergencyContactPhones ?? body.emergencyContactPhone,
      emergencyContactRelationship: body.emergencyContactRelationship,
      idCardNumber: body.idCardNumber,
      idCardIssueDates: body.idCardIssueDates ?? body.idCardIssueDate,
      idCardIssuePlaces: body.idCardIssuePlaces ?? body.idCardIssuePlace,
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


