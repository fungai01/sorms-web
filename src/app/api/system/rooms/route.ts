import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api-client';
import { getAuthorizationHeader, isAdmin } from '@/lib/auth-utils';

// GET - Fetch all rooms
export async function GET(request: NextRequest) {
  try {
    console.log('[API /system/rooms] GET request received');
    
    // Get Authorization header from request (checks headers, cookies, etc.)
    const authHeader = getAuthorizationHeader(request);
    console.log('[API /system/rooms] Authorization header:', authHeader ? 'Found' : 'Not found');
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const startTime = searchParams.get('startTime') || undefined;
    const endTime = searchParams.get('endTime') || undefined;
    const roomTypeId = searchParams.get('roomTypeId');
    const id = searchParams.get('id');

    // Prepare headers to pass to apiClient
    const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {};
    const options: RequestInit = { headers };
    console.log('[API /system/rooms] Options prepared:', { hasHeaders: !!headers['Authorization'] });

    // Get specific room by ID
    if (id) {
      const roomId = parseInt(id);
      if (isNaN(roomId)) {
        return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
      }
      const response = await apiClient.getRoom(roomId, options);
      if (response.success) {
        return NextResponse.json(response.data);
      }
      console.error('[API /system/rooms] Failed to get room by ID:', response.error);
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    // Get rooms by status
    if (status) {
      const validStatuses = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING', 'OUT_OF_SERVICE'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid room status' }, { status: 400 });
      }

      const resp = await apiClient.getRoomsByStatus(status as any, startTime ?? undefined, endTime ?? undefined, options);
      if (!resp.success) {
        console.error('[API /system/rooms] Failed to get rooms by status:', resp.error);
        return NextResponse.json({ error: resp.error || 'Failed to fetch rooms by status' }, { status: 500 });
      }
      return NextResponse.json(resp.data);
    }

    // Get rooms by room type
    if (roomTypeId) {
      const typeId = parseInt(roomTypeId);
      if (isNaN(typeId)) {
        return NextResponse.json({ error: 'Invalid room type ID' }, { status: 400 });
      }

      const resp = await apiClient.getRoomsByRoomType(typeId, options);
      if (!resp.success) {
        console.error('[API /system/rooms] Failed to get rooms by room type:', resp.error);
        return NextResponse.json({ error: resp.error || 'Failed to fetch rooms by room type' }, { status: 500 });
      }
      const data: any = resp.data;
      // Backend trả về ApiResponse<List<RoomResponse>> - data là array trực tiếp
      const items = Array.isArray(data) ? data : [];
      return NextResponse.json({ items, total: items.length });
    }

    // Get all rooms (default)
    console.log('[API /system/rooms] Calling apiClient.getRooms with options:', {
      hasHeaders: !!options.headers,
      headerKeys: options.headers ? Object.keys(options.headers as Record<string, string>) : [],
      hasAuth: options.headers && (options.headers as Record<string, string>)['Authorization'] ? true : false
    });
    
    let response
    try {
      response = await apiClient.getRooms(options);
    } catch (apiError) {
      console.error('[API /system/rooms] Exception calling apiClient.getRooms:', {
        error: apiError,
        message: apiError instanceof Error ? apiError.message : String(apiError),
        stack: apiError instanceof Error ? apiError.stack : undefined
      });
      return NextResponse.json(
        { error: apiError instanceof Error ? apiError.message : 'Failed to fetch rooms' },
        { status: 500 }
      );
    }
    
    console.log('[API /system/rooms] Response:', {
      success: response.success,
      hasData: !!response.data,
      error: response.error,
      dataType: typeof response.data,
      isArray: Array.isArray(response.data),
      dataPreview: response.data ? JSON.stringify(response.data).substring(0, 500) : 'null',
      errorPreview: response.error ? String(response.error).substring(0, 500) : 'null'
    });
    
    if (response.success) {
      const data: any = response.data;
      // Backend trả về ApiResponse<List<RoomResponse>>
      // Format: { responseCode: "S0000", message: "SUCCESS", data: [RoomResponse, ...] }
      // data là array trực tiếp, không phải { content: [...] }
      const items = Array.isArray(data) ? data : [];
      console.log('[API /system/rooms] Returning items:', items.length);
      
      // Add caching headers - cache for 30 seconds (rooms status changes more frequently)
      return NextResponse.json(
        { items, total: items.length },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          },
        }
      );
    }
    
    console.error('[API /system/rooms] Failed to get all rooms:', {
      error: response.error,
      fullError: JSON.stringify(response, null, 2)
    });
    return NextResponse.json(
      { error: response.error || 'Failed to fetch rooms' },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('[API /system/rooms] Exception:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Admin only
  if (!await isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
  }
  try {
    const body = await request.json();
    console.log('POST /api/system/rooms - Request body:', body);

    // Extract Authorization header from request
    const authHeader = request.headers.get('authorization');
    const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {};
    const options: RequestInit = { headers };

    const resp = await apiClient.createRoom(body, options)
    if (!resp.success) {
      console.error('POST /api/system/rooms - Failed to create room:', resp.error)
      return NextResponse.json({ error: resp.error || 'Failed to create room' }, { status: 500 })
    }
    return NextResponse.json(resp.data, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/system/rooms - Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  // Admin only
  if (!await isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
  }
  try {
    // Check if request has body
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 400 });
    }

    // Try to parse body with error handling
    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('PUT /api/system/rooms - JSON parse error:', parseError);
      // Check if error is due to empty body
      if (parseError.message && parseError.message.includes('Unexpected end of JSON input')) {
        return NextResponse.json({ error: 'Request body is required and must be valid JSON' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be a valid JSON object' }, { status: 400 });
    }

    const { id, ...updateData } = body;
    if (!id) {
      return NextResponse.json({ error: 'Room ID is required for update' }, { status: 400 });
    }

    // Extract Authorization header from request
    const authHeader = request.headers.get('authorization');
    const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {};
    const options: RequestInit = { headers };

    const response = await apiClient.updateRoom(id, updateData, options);
    if (response.success) {
      return NextResponse.json(response.data);
    }
    console.error('PUT /api/system/rooms - Failed to update room:', response.error)
    return NextResponse.json({ error: response.error }, { status: 500 });
  } catch (error: any) {
    console.error('PUT /api/system/rooms - Error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  // Admin only
  if (!await isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Room ID is required for deletion' }, { status: 400 });
    }

    // Extract Authorization header from request
    const authHeader = request.headers.get('authorization');
    const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {};
    const options: RequestInit = { headers };

    const response = await apiClient.deleteRoom(Number(id), options);
    if (response.success) {
      return NextResponse.json({ message: 'Room deleted successfully' });
    }
    console.error('DELETE /api/system/rooms - Failed to delete room:', response.error)
    return NextResponse.json({ error: response.error }, { status: 500 });
  } catch (error: any) {
    console.error('DELETE /api/system/rooms - Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}