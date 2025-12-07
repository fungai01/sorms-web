import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { verifyToken } from '@/lib/auth-utils'

// GET - Lấy danh sách staff tasks hoặc task theo ID
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const assignedTo = searchParams.get('assignedTo')
    const status = searchParams.get('status')
    const relatedType = searchParams.get('relatedType')
    const relatedId = searchParams.get('relatedId')

    // Lấy task theo ID
    if (id) {
      const taskId = parseInt(id)
      if (isNaN(taskId)) {
        return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
      }
      const response = await apiClient.getStaffTask(taskId)
      if (response.success) {
        return NextResponse.json(response.data)
      }
      return NextResponse.json({ error: response.error }, { status: 500 })
    }

    // Lấy tasks theo assignee
    if (assignedTo) {
      const assigneeId = parseInt(assignedTo)
      if (isNaN(assigneeId)) {
        return NextResponse.json({ error: 'Invalid assignee ID' }, { status: 400 })
      }
      const response = await apiClient.getStaffTasksByAssignee(assigneeId)
      if (response.success) {
        const data: any = response.data
        const items = Array.isArray(data) ? data : []
        return NextResponse.json({ items, total: items.length })
      }
      return NextResponse.json({ error: response.error }, { status: 500 })
    }

    // Lấy tasks theo status
    if (status) {
      const response = await apiClient.getStaffTasksByStatus(status)
      if (response.success) {
        const data: any = response.data
        const items = Array.isArray(data) ? data : []
        return NextResponse.json({ items, total: items.length })
      }
      return NextResponse.json({ error: response.error }, { status: 500 })
    }

    // Lấy tasks theo related entity
    if (relatedType && relatedId) {
      const relatedIdNum = parseInt(relatedId)
      if (isNaN(relatedIdNum)) {
        return NextResponse.json({ error: 'Invalid related ID' }, { status: 400 })
      }
      const response = await apiClient.getStaffTasksByRelated(relatedType, relatedIdNum)
      if (response.success) {
        const data: any = response.data
        const items = Array.isArray(data) ? data : []
        return NextResponse.json({ items, total: items.length })
      }
      return NextResponse.json({ error: response.error }, { status: 500 })
    }

    // Lấy tất cả tasks
    const response = await apiClient.getStaffTasks()
    if (response.success) {
      const data: any = response.data
      const items = Array.isArray(data) ? data : []
      return NextResponse.json({ items, total: items.length })
    }

    return NextResponse.json({ error: response.error }, { status: 500 })
  } catch (error: any) {
    console.error('GET /api/system/tasks error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// POST - Tạo staff task mới
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Lấy user info từ token để set createdBy nếu không có
    try {
      const userInfo = await verifyToken(req)
      if (userInfo?.id && !body.createdBy) {
        body.createdBy = userInfo.id
      }
    } catch (e) {
      console.warn('Could not get user info from token:', e)
    }

    const response = await apiClient.createStaffTask(body)

    if (response.success) {
      return NextResponse.json(response.data, { status: 201 })
    }

    return NextResponse.json({ error: response.error }, { status: 500 })
  } catch (error: any) {
    console.error('POST /api/system/tasks error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// PUT - Cập nhật staff task
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const response = await apiClient.updateStaffTask(id, updateData)

    if (response.success) {
      return NextResponse.json(response.data)
    }

    return NextResponse.json({ error: response.error }, { status: 500 })
  } catch (error: any) {
    console.error('PUT /api/system/tasks error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Xóa staff task
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const taskId = parseInt(id)
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    const response = await apiClient.deleteStaffTask(taskId)

    if (response.success) {
      return NextResponse.json({ message: 'Task deleted successfully' })
    }

    return NextResponse.json({ error: response.error }, { status: 500 })
  } catch (error: any) {
    console.error('DELETE /api/system/tasks error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
