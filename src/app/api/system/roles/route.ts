import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { isAdmin, verifyToken } from '@/lib/auth-utils'

// GET - Lấy danh sách roles hoặc role theo ID
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    // Lấy role theo ID
    if (id) {
      const response = await apiClient.getRole(id)
      if (response.success) {
        return NextResponse.json(response.data)
      }
      return NextResponse.json({ error: response.error }, { status: 500 })
    }

    // Lấy danh sách roles với search params
    const name = searchParams.get('name') || undefined
    const code = searchParams.get('code') || undefined
    const description = searchParams.get('description') || undefined
    const isActiveParam = searchParams.get('isActive')
    const isActive = isActiveParam ? isActiveParam === 'true' : undefined
    const page = parseInt(searchParams.get('page') || '0')
    const size = parseInt(searchParams.get('size') || '10')

    const response = await apiClient.getRoles({
      name,
      code,
      description,
      isActive,
      page,
      size,
    })

    if (response.success) {
      const data: any = response.data
      // Backend trả về PageResponse format
      const items = Array.isArray(data?.content) ? data.content : (Array.isArray(data) ? data : [])
      const total = data?.totalElements || data?.total || items.length
      return NextResponse.json({ items, total })
    }

    return NextResponse.json({ error: response.error }, { status: 500 })
  } catch (error: any) {
    console.error('GET /api/system/roles error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// POST - Tạo role mới
export async function POST(req: NextRequest) {
  try {
    // Yêu cầu quyền admin
    if (!await isAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const response = await apiClient.createRole(body)

    if (response.success) {
      return NextResponse.json(response.data, { status: 201 })
    }

    return NextResponse.json({ error: response.error }, { status: 500 })
  } catch (error: any) {
    console.error('POST /api/system/roles error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// PUT - Cập nhật role hoặc activate/deactivate
export async function PUT(req: NextRequest) {
  try {
    // Yêu cầu quyền admin
    if (!await isAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Role ID is required' }, { status: 400 })
    }

    // Activate role
    if (action === 'activate') {
      const response = await apiClient.activateRole(id)
      if (response.success) {
        return NextResponse.json(response.data)
      }
      return NextResponse.json({ error: response.error }, { status: 500 })
    }

    // Deactivate role
    if (action === 'deactivate') {
      const response = await apiClient.deactivateRole(id)
      if (response.success) {
        return NextResponse.json(response.data)
      }
      return NextResponse.json({ error: response.error }, { status: 500 })
    }

    // Update role
    const body = await req.json()
    const response = await apiClient.updateRole(id, body)

    if (response.success) {
      return NextResponse.json(response.data)
    }

    return NextResponse.json({ error: response.error }, { status: 500 })
  } catch (error: any) {
    console.error('PUT /api/system/roles error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Xóa role
export async function DELETE(req: NextRequest) {
  try {
    // Yêu cầu quyền admin
    if (!await isAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Role ID is required' }, { status: 400 })
    }

    const response = await apiClient.deleteRole(id)

    if (response.success) {
      return NextResponse.json({ message: 'Role deleted successfully' })
    }

    return NextResponse.json({ error: response.error }, { status: 500 })
  } catch (error: any) {
    console.error('DELETE /api/system/roles error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
