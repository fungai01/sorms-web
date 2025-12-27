import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/config'
import { getTokenFromRequest } from '@/lib/auth-service'

// NOTE:
// - Backend endpoints for tasks: /staff-tasks...
// - This route acts as a thin proxy that ALWAYS forwards Authorization (Bearer token)
//   extracted from request header/cookies.

function buildAuthHeaders(req: NextRequest): Record<string, string> {
  const token = getTokenFromRequest(req)
  const headers: Record<string, string> = { accept: '*/*' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req)
    if (!token) {
      return NextResponse.json({ error: 'Unauthenticated', items: [], total: 0 }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const assignedTo = searchParams.get('assignedTo')
    const status = searchParams.get('status')
    const relatedType = searchParams.get('relatedType')
    const relatedId = searchParams.get('relatedId')

    let backendUrl = `${API_CONFIG.BASE_URL}/staff-tasks`

    if (id) {
      const taskId = Number(id)
      if (!taskId || Number.isNaN(taskId)) {
        return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
      }
      backendUrl = `${API_CONFIG.BASE_URL}/staff-tasks/${taskId}`
    } else if (assignedTo) {
      const assigneeId = Number(assignedTo)
      if (!assigneeId || Number.isNaN(assigneeId)) {
        return NextResponse.json({ error: 'Invalid assignee ID' }, { status: 400 })
      }
      backendUrl = `${API_CONFIG.BASE_URL}/staff-tasks/by-assignee/${assigneeId}`
    } else if (status) {
      backendUrl = `${API_CONFIG.BASE_URL}/staff-tasks/by-status?status=${encodeURIComponent(status)}`
    } else if (relatedType && relatedId) {
      const rid = Number(relatedId)
      if (!rid || Number.isNaN(rid)) {
        return NextResponse.json({ error: 'Invalid related ID' }, { status: 400 })
      }
      backendUrl = `${API_CONFIG.BASE_URL}/staff-tasks/by-related?relatedType=${encodeURIComponent(relatedType)}&relatedId=${rid}`
    }

    const beRes = await fetch(backendUrl, {
      method: 'GET',
      headers: buildAuthHeaders(req),
    })

    const data = await beRes.json().catch(() => null)
    if (!beRes.ok) {
      const errMsg = (data as any)?.message || (data as any)?.error || 'Request failed'
      return NextResponse.json({ error: errMsg, items: [], total: 0 }, { status: beRes.status })
    }

    // Backend wraps payload as { responseCode, message, data }
    const payload: any = (data as any)?.data ?? data

    // For list endpoints, normalize to {items,total}
    if (id) {
      return NextResponse.json(payload)
    }

    const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : []
    return NextResponse.json({ items, total: items.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error', items: [], total: 0 }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req)
    if (!token) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const beRes = await fetch(`${API_CONFIG.BASE_URL}/staff-tasks`, {
      method: 'POST',
      headers: { ...buildAuthHeaders(req), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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

export async function PUT(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req)
    if (!token) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || !body.id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const id = Number(body.id)
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    const { id: _omit, ...updateData } = body as any

    const beRes = await fetch(`${API_CONFIG.BASE_URL}/staff-tasks/${id}`, {
      method: 'PUT',
      headers: { ...buildAuthHeaders(req), 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
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

export async function DELETE(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req)
    if (!token) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const taskId = Number(id)
    if (!taskId || Number.isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    const beRes = await fetch(`${API_CONFIG.BASE_URL}/staff-tasks/${taskId}`, {
      method: 'DELETE',
      headers: buildAuthHeaders(req),
    })

    const data = await beRes.json().catch(() => null)
    if (!beRes.ok) {
      const errMsg = (data as any)?.message || (data as any)?.error || 'Request failed'
      return NextResponse.json({ error: errMsg }, { status: beRes.status })
    }

    return NextResponse.json({ message: 'Task deleted successfully' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
