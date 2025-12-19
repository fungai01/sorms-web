import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { isAdmin } from '@/lib/auth-utils'

// GET - list roles or get by id
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const authHeader = req.headers.get('authorization') || undefined

    if (id) {
      const response = await apiClient.getRole(id, {
        headers: authHeader ? { Authorization: authHeader } : undefined,
      })
      return response.success
        ? NextResponse.json(response.data)
        : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
    }

    const q = searchParams.get('q') || undefined
    let name = searchParams.get('name') || undefined
    let code = searchParams.get('code') || undefined
    let description = searchParams.get('description') || undefined
    const isActiveParam = searchParams.get('isActive')
    const isActive = isActiveParam ? isActiveParam === 'true' : undefined
    const page = parseInt(searchParams.get('page') || '0')
    const size = parseInt(searchParams.get('size') || '10')

    if (q) {
      if (!name) name = q
      if (!code) code = q
      if (!description) description = q
    }

    const response = await apiClient.getRoles({
      name,
      code,
      description,
      isActive,
      page,
      size,
    }, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    })

    if (!response.success) {
      return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
    }

    const data: any = response.data
    const items = Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : []
    const total = data?.totalElements || data?.total || items.length
    return NextResponse.json({ items, total })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

// POST - create role
export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const response = await apiClient.createRole(body)

    return response.success
      ? NextResponse.json(response.data, { status: 201 })
      : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

// PUT - update / activate / deactivate role
export async function PUT(req: NextRequest) {
  try {
    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Role ID is required' }, { status: 400 })
    }

    if (action === 'activate') {
      const response = await apiClient.activateRole(id)
      return response.success
        ? NextResponse.json(response.data)
        : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
    }

    if (action === 'deactivate') {
      const response = await apiClient.deactivateRole(id)
      return response.success
        ? NextResponse.json(response.data)
        : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const response = await apiClient.updateRole(id, body)
    return response.success
      ? NextResponse.json(response.data)
      : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE - delete role
export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Role ID is required' }, { status: 400 })
    }

    const response = await apiClient.deleteRole(id)

    return response.success
      ? NextResponse.json({ message: 'Role deleted successfully' })
      : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
