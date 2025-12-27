import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/config'
import { getTokenFromRequest, isAdmin } from '@/lib/auth-service'

function buildAuthHeaders(req: NextRequest): Record<string, string> {
  const token = getTokenFromRequest(req)
  const headers: Record<string, string> = { accept: '*/*' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthenticated', items: [], total: 0 }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const status = searchParams.get('status')
    const department = searchParams.get('department')

    let backendUrl = `${API_CONFIG.BASE_URL}/staff-profiles`

    if (id) {
      const staffId = Number(id)
      if (!staffId || Number.isNaN(staffId)) {
        return NextResponse.json({ error: 'Invalid staff profile id' }, { status: 400 })
      }
      backendUrl = `${API_CONFIG.BASE_URL}/staff-profiles/${staffId}`
    } else if (department) {
      backendUrl = `${API_CONFIG.BASE_URL}/staff-profiles/by-department/${encodeURIComponent(department)}`
    } else if (status) {
      // FE filter uses ACTIVE/INACTIVE; backend expects isActive=true/false
      const normalized = status.toUpperCase()
      const isActive = normalized === 'ACTIVE' ? 'true' : normalized === 'INACTIVE' ? 'false' : ''
      if (!isActive) {
        return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
      }
      backendUrl = `${API_CONFIG.BASE_URL}/staff-profiles/by-status?isActive=${isActive}`
    }

    const beRes = await fetch(backendUrl, {
      method: 'GET',
      headers: buildAuthHeaders(request),
    })

    const data = await beRes.json().catch(() => null)
    if (!beRes.ok) {
      const errMsg = (data as any)?.message || (data as any)?.error || 'Request failed'
      return NextResponse.json({ error: errMsg, items: [], total: 0 }, { status: beRes.status })
    }

    const payload: any = (data as any)?.data ?? data

    if (id) {
      return NextResponse.json(payload)
    }

    const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : []
    return NextResponse.json({ items, total: items.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error', items: [], total: 0 }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // NOTE: backend currently comments out @PreAuthorize, but keep admin check on FE proxy.
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const token = getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Require accountId
    const accountId = body.accountId ?? body.accountID ?? body.account_id ?? null
    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    // Require role (only STAFF or ADMINISTRATIVE)
    const rawRole = (body.role ?? body.userRole ?? body.user_role ?? '').toString().trim()
    if (!rawRole) {
      return NextResponse.json({ error: 'role is required' }, { status: 400 })
    }

    const normalizedRole = rawRole.toUpperCase().replace(/^ROLE_/, '')
    const allowedRoles = ['STAFF', 'ADMINISTRATIVE']
    if (!allowedRoles.includes(normalizedRole)) {
      return NextResponse.json({
        error: `Invalid role. Allowed roles: ${allowedRoles.join(', ')}`,
      }, { status: 400 })
    }

    const payload = {
      ...body,
      accountId: String(accountId),
      role: normalizedRole,
    }

    const beRes = await fetch(`${API_CONFIG.BASE_URL}/staff-profiles`, {
      method: 'POST',
      headers: { ...buildAuthHeaders(request), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await beRes.json().catch(() => null)
    if (!beRes.ok) {
      const errMsg = (data as any)?.message || (data as any)?.error || 'Request failed'
      return NextResponse.json({ error: errMsg }, { status: beRes.status })
    }

    return NextResponse.json((data as any)?.data ?? data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  try {
    const token = getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const id = body?.id ? Number(body.id) : NaN
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { id: _omit, ...payload } = body as any

    const beRes = await fetch(`${API_CONFIG.BASE_URL}/staff-profiles/${id}`, {
      method: 'PUT',
      headers: { ...buildAuthHeaders(request), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await beRes.json().catch(() => null)
    if (!beRes.ok) {
      const errMsg = (data as any)?.message || (data as any)?.error || 'Request failed'
      return NextResponse.json({ error: errMsg }, { status: beRes.status })
    }

    return NextResponse.json((data as any)?.data ?? data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  try {
    const token = getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const idStr = searchParams.get('id')
    const id = idStr ? Number(idStr) : NaN
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const beRes = await fetch(`${API_CONFIG.BASE_URL}/staff-profiles/${id}`, {
      method: 'DELETE',
      headers: buildAuthHeaders(request),
    })

    const data = await beRes.json().catch(() => null)
    if (!beRes.ok) {
      const errMsg = (data as any)?.message || (data as any)?.error || 'Request failed'
      return NextResponse.json({ error: errMsg }, { status: beRes.status })
    }

    return NextResponse.json({ message: 'Staff profile deleted successfully' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
