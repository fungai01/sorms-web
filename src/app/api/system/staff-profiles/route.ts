import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'

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
      if (!resp.success) return NextResponse.json({ error: resp.error || 'Failed to fetch staff profile' }, { status: 500 })
      return NextResponse.json(resp.data)
    }

    if (status) {
      const resp = await apiClient.getStaffProfilesByStatus(status)
      if (!resp.success) return NextResponse.json({ error: resp.error || 'Failed to fetch staff profiles by status' }, { status: 500 })
      const raw: any = resp.data
      const items = Array.isArray(raw?.content) ? raw.content : (Array.isArray(raw) ? raw : [])
      return NextResponse.json({ items, total: items.length })
    }

    if (department) {
      const resp = await apiClient.getStaffProfilesByDepartment(department)
      if (!resp.success) return NextResponse.json({ error: resp.error || 'Failed to fetch staff profiles by department' }, { status: 500 })
      const raw: any = resp.data
      const items = Array.isArray(raw?.content) ? raw.content : (Array.isArray(raw) ? raw : [])
      return NextResponse.json({ items, total: items.length })
    }

    const resp = await apiClient.getStaffProfiles()
    if (!resp.success) return NextResponse.json({ error: resp.error || 'Failed to fetch staff profiles' }, { status: 500 })
    const raw: any = resp.data
    const items = Array.isArray(raw?.content) ? raw.content : (Array.isArray(raw) ? raw : [])
    return NextResponse.json({ items, total: items.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const resp = await apiClient.createStaffProfile(body)
    if (!resp.success) return NextResponse.json({ error: resp.error || 'Failed to create staff profile' }, { status: 500 })
    return NextResponse.json(resp.data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const id = Number(body.id)
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const { id: _omit, ...payload } = body
    const resp = await apiClient.updateStaffProfile(id, payload)
    if (!resp.success) return NextResponse.json({ error: resp.error || 'Failed to update staff profile' }, { status: 500 })
    return NextResponse.json(resp.data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const idStr = searchParams.get('id')
    const id = idStr ? Number(idStr) : NaN
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const resp = await apiClient.deleteStaffProfile(id)
    if (!resp.success) return NextResponse.json({ error: resp.error || 'Failed to delete staff profile' }, { status: 500 })
    return NextResponse.json({ message: 'Staff profile deleted successfully' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}







