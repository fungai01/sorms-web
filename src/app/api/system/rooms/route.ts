import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { getAuthorizationHeader, isAdmin } from '@/lib/auth-utils'

// GET - Fetch rooms (all, by id, by status, by room type)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const startTime = searchParams.get('startTime') || undefined
    const endTime = searchParams.get('endTime') || undefined
    const roomTypeId = searchParams.get('roomTypeId')
    const id = searchParams.get('id')

    const authHeader = getAuthorizationHeader(request)
    const headers: Record<string, string> = authHeader ? { Authorization: authHeader } : {}
    const options: RequestInit = Object.keys(headers).length ? { headers } : {}

    if (id) {
      const roomId = Number(id)
      if (!roomId || Number.isNaN(roomId)) {
        return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 })
      }
      const response = await apiClient.getRoom(roomId, options)
      return response.success
        ? NextResponse.json(response.data)
        : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
    }

    if (status) {
      const validStatuses = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING', 'OUT_OF_SERVICE']
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid room status' }, { status: 400 })
      }

      const resp = await apiClient.getRoomsByStatus(status as any, startTime, endTime, options)
      return resp.success
        ? NextResponse.json(resp.data)
        : NextResponse.json({ error: resp.error || 'Request failed' }, { status: 500 })
    }

    if (roomTypeId) {
      const typeId = Number(roomTypeId)
      if (!typeId || Number.isNaN(typeId)) {
        return NextResponse.json({ error: 'Invalid room type ID' }, { status: 400 })
      }

      const resp = await apiClient.getRoomsByRoomType(typeId, options)
      if (!resp.success) {
        return NextResponse.json({ error: resp.error || 'Request failed' }, { status: 500 })
      }
      const data: any = resp.data
      const items = Array.isArray(data) ? data : []
      return NextResponse.json({ items, total: items.length })
    }

    const response = await apiClient.getRooms(options)
    if (!response.success) {
      return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
    }
    const data: any = response.data
    const items = Array.isArray(data) ? data : []
    return NextResponse.json(
      { items, total: items.length },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
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

    const authHeader = request.headers.get('authorization')
    const headers: Record<string, string> = authHeader ? { Authorization: authHeader } : {}
    const options: RequestInit = Object.keys(headers).length ? { headers } : {}

    const resp = await apiClient.createRoom(body, options)
    return resp.success
      ? NextResponse.json(resp.data, { status: 201 })
      : NextResponse.json({ error: resp.error || 'Request failed' }, { status: 500 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { id, ...updateData } = body as any
    if (!id) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization')
    const headers: Record<string, string> = authHeader ? { Authorization: authHeader } : {}
    const options: RequestInit = Object.keys(headers).length ? { headers } : {}

    const response = await apiClient.updateRoom(id, updateData, options)
    return response.success
      ? NextResponse.json(response.data)
      : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization')
    const headers: Record<string, string> = authHeader ? { Authorization: authHeader } : {}
    const options: RequestInit = Object.keys(headers).length ? { headers } : {}

    const response = await apiClient.deleteRoom(Number(id), options)
    return response.success
      ? NextResponse.json({ message: 'Room deleted successfully' })
      : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}