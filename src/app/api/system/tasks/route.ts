import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { verifyToken, getAuthorizationHeader } from '@/lib/auth-utils'
import { API_CONFIG } from '@/lib/config'

const BASE = API_CONFIG.BASE_URL

// GET - list tasks or get by id / assignee / status / related
export async function GET(req: NextRequest) {
  try {
    const auth = getAuthorizationHeader(req)
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const assignedTo = searchParams.get('assignedTo')
    const status = searchParams.get('status')
    const relatedType = searchParams.get('relatedType')
    const relatedId = searchParams.get('relatedId')

    if (id) {
      const taskId = Number(id)
      if (!taskId || Number.isNaN(taskId)) {
        return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
      }
      const res = await fetch(`${BASE}/staff-tasks/${taskId}`, {
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      }
      return NextResponse.json(data?.data ?? data)
    }

    if (assignedTo) {
      const assigneeId = Number(assignedTo)
      if (!assigneeId || Number.isNaN(assigneeId)) {
        return NextResponse.json({ error: 'Invalid assignee ID' }, { status: 400 })
      }
      const res = await fetch(`${BASE}/staff-tasks/by-assignee/${assigneeId}`, {
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return NextResponse.json({ error: data?.message || `Backend error: ${res.status}`, items: [], total: 0 }, { status: 500 })
      }
      const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
      return NextResponse.json({ items, total: items.length })
    }

    if (status) {
      const res = await fetch(`${BASE}/staff-tasks/by-status?status=${encodeURIComponent(status)}`, {
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return NextResponse.json({ error: data?.message || `Backend error: ${res.status}`, items: [], total: 0 }, { status: 500 })
      }
      const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
      return NextResponse.json({ items, total: items.length })
    }

    if (relatedType && relatedId) {
      const relatedIdNum = Number(relatedId)
      if (!relatedIdNum || Number.isNaN(relatedIdNum)) {
        return NextResponse.json({ error: 'Invalid related ID' }, { status: 400 })
      }
      const res = await fetch(`${BASE}/staff-tasks/by-related?relatedType=${encodeURIComponent(relatedType)}&relatedId=${relatedIdNum}`, {
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return NextResponse.json({ error: data?.message || `Backend error: ${res.status}`, items: [], total: 0 }, { status: 500 })
      }
      const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
      return NextResponse.json({ items, total: items.length })
    }

    // Default: get all tasks
    const res = await fetch(`${BASE}/staff-tasks`, {
      headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('[GET /api/system/tasks] Backend error:', data?.message || res.status)
      return NextResponse.json({ 
        error: data?.message || `Backend error: ${res.status}`,
        items: [],
        total: 0
      }, { status: 500 })
    }
    // Backend returns ApiResponse<List<StaffTaskResponse>>, so data might be wrapped
    const responseData = data?.data ?? data
    const items = Array.isArray(responseData) ? responseData : (Array.isArray(data) ? data : [])
    return NextResponse.json({ items, total: items.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// POST - create staff task
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthorizationHeader(req)
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const userInfo = await verifyToken(req).catch(() => null)
    if (userInfo?.id && !body.taskCreatedBy) {
      body.taskCreatedBy = userInfo.id
    }

    const res = await fetch(`${BASE}/staff-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    }
    return NextResponse.json(data?.data ?? data, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

// PUT - update staff task
export async function PUT(req: NextRequest) {
  try {
    const auth = getAuthorizationHeader(req)
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || !body.id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const { id, ...updateData } = body
    const res = await fetch(`${BASE}/staff-tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
      body: JSON.stringify(updateData),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    }
    return NextResponse.json(data?.data ?? data)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE - delete staff task
export async function DELETE(req: NextRequest) {
  try {
    const auth = getAuthorizationHeader(req)
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const taskId = Number(id)
    if (!taskId || Number.isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    const res = await fetch(`${BASE}/staff-tasks/${taskId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    }
    return NextResponse.json({ message: 'Task deleted successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
