import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { API_CONFIG } from '@/lib/config'
const BASE = API_CONFIG.BASE_URL

// GET - Fetch all room types or specific room type by ID
export async function GET(request: NextRequest) {
  try {
    console.log('[API /system/room-types] GET request received');
    
    // Extract Authorization header from request
    const authHeader = request.headers.get('authorization');
    console.log('[API /system/room-types] Authorization header:', authHeader ? 'Found' : 'Not found');
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Prepare headers to pass to apiClient
    const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {};

    // Get specific room type by ID
    if (id) {
      const roomTypeId = parseInt(id);
      if (isNaN(roomTypeId)) {
        return NextResponse.json({ error: 'Invalid room type ID' }, { status: 400 });
      }
      
      const response = await apiClient.getRoomType(roomTypeId, { headers });
      if (response.success) {
        return NextResponse.json(response.data);
      }
      console.error('[API /system/room-types] Failed to get room type by ID:', response.error);
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    // Get all room types (default)
    const response = await apiClient.getRoomTypes({ headers });
    
    console.log('[API /system/room-types] Response:', {
      success: response.success,
      hasData: !!response.data,
      error: response.error,
      dataType: typeof response.data,
      isArray: Array.isArray(response.data),
    });
    
    if (response.success) {
      const data: any = response.data;
      // Backend trả về ApiResponse<List<RoomTypeResponse>>
      // Format: { responseCode: "S0000", message: "SUCCESS", data: [RoomTypeResponse, ...] }
      // data là array trực tiếp, không phải { content: [...] }
      const items = Array.isArray(data) ? data : [];
      console.log('[API /system/room-types] Returning items:', items.length);
      
      // Add caching headers - cache for 60 seconds (room types don't change often)
      return NextResponse.json(
        { items, total: items.length },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          },
        }
      );
    }
    
    console.error('[API /system/room-types] Failed to get all room types:', response.error);
    return NextResponse.json({ error: response.error || 'Failed to fetch room types' }, { status: 500 });
  } catch (error: any) {
    console.error('[API /system/room-types] Exception:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch room types' },
      { status: 500 }
    );
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

    // Extract Authorization header from request
    const authHeader = request.headers.get('authorization')
    const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {}

    // Use apiClient to create room type
    const response = await apiClient.createRoomType({
      code,
      name,
      basePrice: basePrice || 0,
      maxOccupancy: maxOccupancy || 1,
      description: description || ''
    }, { headers })

    if (!response.success) {
      console.error('POST /api/system/room-types - Failed to create room type:', response.error)
      return NextResponse.json({ error: response.error || 'Failed to create room type' }, { status: 500 })
    }
    return NextResponse.json(response.data, { status: 201 })
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

    // Extract Authorization header from request
    const authHeader = request.headers.get('authorization')
    const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {}

    // Update room type via API client
    const response = await apiClient.updateRoomType(id, {
      code,
      name,
      basePrice: basePrice || 0,
      maxOccupancy: maxOccupancy || 1,
      description: description || ''
    }, { headers })
    
    if (!response.success) {
      console.error('PUT /api/system/room-types - Failed to update room type:', response.error)
      return NextResponse.json({ error: response.error || 'Failed to update room type' }, { status: 500 })
    }
    return NextResponse.json(response.data)
  } catch (error: any) {
    console.error('Error updating room type:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update room type' },
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

    // Extract Authorization header from request
    const authHeader = request.headers.get('authorization')
    const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {}

    // Delete room type via API client
    const response = await apiClient.deleteRoomType(parseInt(id), { headers })
    if (!response.success) {
      console.error('DELETE /api/system/room-types - Failed to delete room type:', response.error)
      return NextResponse.json({ error: response.error || 'Failed to delete room type' }, { status: 500 })
    }
    return NextResponse.json(response.data ?? { success: true })
  } catch (error) {
    console.error('Error deleting room type:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete room type' },
      { status: 500 }
    )
  }
}
