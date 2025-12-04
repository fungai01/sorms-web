import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { API_CONFIG } from '@/lib/config'
const BASE = API_CONFIG.BASE_URL

// GET - Fetch all room types or specific room type by ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Get specific room type by ID
    if (id) {
      const roomTypeId = parseInt(id);
      if (isNaN(roomTypeId)) {
        return NextResponse.json({ error: 'Invalid room type ID' }, { status: 400 });
      }
      
      const response = await apiClient.getRoomType(roomTypeId);
      if (response.success) {
        return NextResponse.json(response.data);
      }
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    // Get all room types (default) via configured BASE
    const auth = request.headers.get('authorization') || ''
    const res = await fetch(`${BASE}/room-types`, { headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) }, cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    return NextResponse.json(data?.data ?? data)
  } catch (error) {
    console.error('Error fetching room types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch room types' },
      { status: 500 }
    )
  }
}

// POST - Create new room type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, name, basePrice, maxOccupancy, description } = body

    // Validate required fields
    if (!code || !name) {
      return NextResponse.json(
        { success: false, error: 'Code and name are required' },
        { status: 400 }
      )
    }

    const res = await fetch(`${BASE}/room-types`, { method: 'POST', headers: { 'Content-Type': 'application/json', accept: '*/*' }, body: JSON.stringify({ code, name, basePrice: basePrice || 0, maxOccupancy: maxOccupancy || 1, description: description || '' }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    return NextResponse.json(data?.data ?? data, { status: 201 })
  } catch (error) {
    console.error('Error creating room type:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create room type' },
      { status: 500 }
    )
  }
}

// PUT - Update room type
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, code, name, basePrice, maxOccupancy, description } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Room type ID is required' },
        { status: 400 }
      )
    }

    // Update room type via API client
    const response = await apiClient.updateRoomType(id, {
      code,
      name,
      basePrice: basePrice || 0,
      maxOccupancy: maxOccupancy || 1,
      description: description || ''
    })
    if (!response.success) return NextResponse.json({ error: response.error || 'Failed to update room type' }, { status: 500 })
    return NextResponse.json(response.data)
  } catch (error) {
    console.error('Error updating room type:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update room type' },
      { status: 500 }
    )
  }
}

// DELETE - Delete room type
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Room type ID is required' },
        { status: 400 }
      )
    }

    // Delete room type via API client
    const response = await apiClient.deleteRoomType(parseInt(id))
    if (!response.success) return NextResponse.json({ error: response.error || 'Failed to delete room type' }, { status: 500 })
    return NextResponse.json(response.data ?? { success: true })
  } catch (error) {
    console.error('Error deleting room type:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete room type' },
      { status: 500 }
    )
  }
}
