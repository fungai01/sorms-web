import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { isAdmin } from '@/lib/auth-utils'

// GET - list / detail / filter by status or department
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const status = searchParams.get('status')
    const department = searchParams.get('department')

    if (id) {
      const staffId = Number(id)
      if (!staffId || Number.isNaN(staffId)) {
        return NextResponse.json({ error: 'Invalid staff profile id' }, { status: 400 })
      }
      const resp = await apiClient.getStaffProfile(staffId)
      return resp.success
        ? NextResponse.json(resp.data)
        : NextResponse.json({ error: resp.error || 'Request failed' }, { status: 500 })
    }

    if (status) {
      const resp = await apiClient.getStaffProfilesByStatus(status)
      if (!resp.success) {
        return NextResponse.json({ error: resp.error || 'Request failed' }, { status: 500 })
      }
      const raw: any = resp.data
      const items = Array.isArray(raw?.content) ? raw.content : Array.isArray(raw) ? raw : []
      return NextResponse.json({ items, total: items.length })
    }

    if (department) {
      const resp = await apiClient.getStaffProfilesByDepartment(department)
      if (!resp.success) {
        return NextResponse.json({ error: resp.error || 'Request failed' }, { status: 500 })
      }
      const raw: any = resp.data
      const items = Array.isArray(raw?.content) ? raw.content : Array.isArray(raw) ? raw : []
      return NextResponse.json({ items, total: items.length })
    }

    const resp = await apiClient.getStaffProfiles()
    if (!resp.success) {
      return NextResponse.json({ error: resp.error || 'Request failed' }, { status: 500 })
    }
    const raw: any = resp.data
    const items = Array.isArray(raw?.content) ? raw.content : Array.isArray(raw) ? raw : []
    return NextResponse.json({ items, total: items.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const resp = await apiClient.createStaffProfile(body)
    return resp.success
      ? NextResponse.json(resp.data, { status: 201 })
      : NextResponse.json({ error: resp.error || 'Request failed' }, { status: 500 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  try {
    const body = await request.json().catch(() => null)
    const id = body?.id ? Number(body.id) : NaN
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const { id: _omit, ...payload } = body
    const resp = await apiClient.updateStaffProfile(id, payload)
    return resp.success
      ? NextResponse.json(resp.data)
      : NextResponse.json({ error: resp.error || 'Request failed' }, { status: 500 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const idStr = searchParams.get('id')
    const id = idStr ? Number(idStr) : NaN
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const resp = await apiClient.deleteStaffProfile(id)
    return resp.success
      ? NextResponse.json({ message: 'Staff profile deleted successfully' })
      : NextResponse.json({ error: resp.error || 'Request failed' }, { status: 500 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
