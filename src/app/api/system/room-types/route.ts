import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { getAuthorizationHeader } from '@/lib/auth-utils'

// GET - Fetch all room types or specific room type by ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const authHeader = getAuthorizationHeader(request);
    const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {};

    if (id) {
      const roomTypeId = parseInt(id);
      if (isNaN(roomTypeId)) {
        return NextResponse.json({ error: 'Invalid room type ID' }, { status: 400 });
      }
      const response = await apiClient.getRoomType(roomTypeId, { headers });
      if (response.success) {
        return NextResponse.json(response.data);
      }
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    const response = await apiClient.getRoomTypes({ headers });
    if (response.success) {
      const data: any = response.data;
      const items = Array.isArray(data) ? data : [];
      return NextResponse.json(
        { items, total: items.length },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          },
        }
      );
    }
    return NextResponse.json({ error: response.error }, { status: 500 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new room type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, name, basePrice, maxOccupancy, description } = body

    if (!code || !name) {
      return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })
    }

    const authHeader = getAuthorizationHeader(request)
    const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {}

    const response = await apiClient.createRoomType({
      code,
      name,
      basePrice: basePrice || 0,
      maxOccupancy: maxOccupancy || 1,
      description: description || ''
    }, { headers })

    if (!response.success) {
      return NextResponse.json({ error: response.error }, { status: 500 })
    }
    return NextResponse.json(response.data, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update room type
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, code, name, basePrice, maxOccupancy, description } = body

    if (!id) {
      return NextResponse.json({ error: 'Room type ID is required' }, { status: 400 })
    }

    const authHeader = getAuthorizationHeader(request)
    const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {}

    const response = await apiClient.updateRoomType(id, {
      code,
      name,
      basePrice: basePrice || 0,
      maxOccupancy: maxOccupancy || 1,
      description: description || ''
    }, { headers })
    
    if (!response.success) {
      return NextResponse.json({ error: response.error }, { status: 500 })
    }
    return NextResponse.json(response.data)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete room type
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Room type ID is required' }, { status: 400 })
    }

    const authHeader = getAuthorizationHeader(request)
    const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {}

    const response = await apiClient.deleteRoomType(parseInt(id), { headers })
    if (!response.success) {
      return NextResponse.json({ error: response.error }, { status: 500 })
    }
    return NextResponse.json(response.data ?? { success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
