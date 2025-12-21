import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { verifyToken, getAuthorizationHeader } from '@/lib/auth-service'

// GET - list tasks or get by id / assignee / status / related
export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const userInfo = await verifyToken(req)
    if (!userInfo) {
      return NextResponse.json({ error: 'Unauthenticated', items: [], total: 0 }, { status: 401 })
    }
    
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
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      // `getStaffTask` currently only accepts the task ID
      const response = await apiClient.getStaffTask(taskId)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      return NextResponse.json(response.data)
    }

    if (assignedTo) {
      const assigneeId = Number(assignedTo)
      if (!assigneeId || Number.isNaN(assigneeId)) {
        return NextResponse.json({ error: 'Invalid assignee ID' }, { status: 400 })
      }
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      // `getStaffTasksByAssignee` currently only accepts the assignee ID
      const response = await apiClient.getStaffTasksByAssignee(assigneeId)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed', items: [], total: 0 }, { status: 500 })
      }
      const items = Array.isArray(response.data) ? response.data : []
      return NextResponse.json({ items, total: items.length })
    }

    if (status) {
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      // `getStaffTasksByStatus` currently only accepts the status string
      const response = await apiClient.getStaffTasksByStatus(status)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed', items: [], total: 0 }, { status: 500 })
      }
      const items = Array.isArray(response.data) ? response.data : []
      return NextResponse.json({ items, total: items.length })
    }

    if (relatedType && relatedId) {
      const relatedIdNum = Number(relatedId)
      if (!relatedIdNum || Number.isNaN(relatedIdNum)) {
        return NextResponse.json({ error: 'Invalid related ID' }, { status: 400 })
      }
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      // `getStaffTasksByRelated` currently accepts relatedType and relatedId only
      const response = await apiClient.getStaffTasksByRelated(relatedType, relatedIdNum)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed', items: [], total: 0 }, { status: 500 })
      }
      const items = Array.isArray(response.data) ? response.data : []
      return NextResponse.json({ items, total: items.length })
    }

    // Default: get all tasks
    const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
    // `getStaffTasks` currently does not accept options, it handles auth internally
    const response = await apiClient.getStaffTasks()
    if (!response.success) {
      console.error('[GET /api/system/tasks] Backend error:', response.error)
      return NextResponse.json({ 
        error: response.error || 'Request failed',
        items: [],
        total: 0
      }, { status: 500 })
    }
    const items = Array.isArray(response.data) ? response.data : []
    return NextResponse.json({ items, total: items.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// POST - create staff task
export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const userInfo = await verifyToken(req)
    if (!userInfo) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }
    
    const auth = getAuthorizationHeader(req)
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (userInfo?.id && !body.taskCreatedBy) {
      body.taskCreatedBy = userInfo.id
    }

    const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
    // `createStaffTask` currently accepts only the task data
    const response = await apiClient.createStaffTask(body)
    if (!response.success) {
      return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
    }
    return NextResponse.json(response.data, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

// PUT - update staff task
export async function PUT(req: NextRequest) {
  try {
    // Verify authentication
    const userInfo = await verifyToken(req)
    if (!userInfo) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }
    
    const auth = getAuthorizationHeader(req)
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || !body.id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const { id, ...updateData } = body
    const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
    // `updateStaffTask` currently accepts (id, updateData)
    const response = await apiClient.updateStaffTask(id, updateData)
    if (!response.success) {
      return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
    }
    return NextResponse.json(response.data)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE - delete staff task
export async function DELETE(req: NextRequest) {
  try {
    // Verify authentication
    const userInfo = await verifyToken(req)
    if (!userInfo) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }
    
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

    const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
    // `deleteStaffTask` currently accepts only the task ID
    const response = await apiClient.deleteStaffTask(taskId)
    if (!response.success) {
      return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
    }
    return NextResponse.json({ message: 'Task deleted successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
