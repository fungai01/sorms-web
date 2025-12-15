import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { verifyToken, getAuthorizationHeader, decodeJWTPayload } from '@/lib/auth-utils'

// GET - Fetch all bookings, specific booking by ID, or filtered bookings
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    // Get Authorization header from request (checks headers, cookies, etc.)
    const authHeader = getAuthorizationHeader(req);
    const options: RequestInit = authHeader ? { headers: { Authorization: authHeader } } : {};

    // Get specific booking by ID
    if (id) {
      const bookingId = parseInt(id);
      if (isNaN(bookingId)) {
        return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
      }
      const response = await apiClient.getBooking(bookingId, options as any);
      if (response.success) {
        return NextResponse.json(response.data);
      }
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    // Get bookings by user ID
    if (userId) {
      const user = parseInt(userId);
      if (isNaN(user)) {
        return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
      }
      const response = await apiClient.getBookingsByUser(user, options as any);
      if (response.success) {
        const raw: any = response.data
        const items = Array.isArray(raw?.content) ? raw.content : (Array.isArray(raw) ? raw : [])
        return NextResponse.json({ items, total: items.length });
      }
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    // Get bookings by status
    if (status) {
      const validStatuses = ['PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'REJECTED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid booking status' }, { status: 400 });
      }
      const response = await apiClient.getBookingsByStatus(status, options as any);
      if (response.success) {
        const raw: any = response.data
        const items = Array.isArray(raw?.content) ? raw.content : (Array.isArray(raw) ? raw : [])
        return NextResponse.json({ items, total: items.length });
      }
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    // Get all bookings (default)
    const response = await apiClient.getBookings(options as any)
    
    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Failed to fetch bookings' }, 
        { status: 500 }
      )
    }
    
    const raw: any = response.data
    const items = Array.isArray(raw?.content) ? raw.content : (Array.isArray(raw) ? raw : [])
    
    // Add caching headers - cache for 30 seconds, revalidate in background
    return NextResponse.json(
      { items, total: items.length },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (error) {
    console.error('Bookings API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

// POST - Create new booking or perform actions (checkin, approve)
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');

    // Handle checkin action (Security): forward multipart form-data to backend /bookings/{id}/checkin
    if (action === 'checkin' && id) {
      const bookingId = parseInt(id);
      if (isNaN(bookingId)) {
        return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
      }
      // Expect multipart/form-data
      const contentType = req.headers.get('content-type') || ''
      if (!contentType.includes('multipart/form-data')) {
        // Allow JSON fallback but recommend multipart
        // Try to parse JSON then convert to form
      }
      const form = await req.formData().catch(() => null)
      if (!form) {
        return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
      }
      const auth = req.headers.get('authorization') || ''
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'https://backend.sorms.online/api'}/bookings/${bookingId}/checkin`, {
        method: 'POST',
        headers: {
          ...(auth ? { Authorization: auth } : {}),
        },
        body: form as unknown as BodyInit,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      }
      return NextResponse.json(data?.data ?? data)
    }

    // Handle approve action
    if (action === 'approve' && id) {
      // Admin only
      const { isAdmin } = await import('@/lib/auth-utils')
      if (!await isAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
      }
      const bookingId = parseInt(id);
      if (isNaN(bookingId)) {
        return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
      }

      // Đọc body nếu có (format: { bookingId, approverId, decision, reason })
      let approverId: string | undefined
      let reason: string | undefined
      
      try {
        // Clone request để có thể đọc body nhiều lần
        const clonedReq = req.clone()
        const body = await clonedReq.json().catch(() => ({}))
        if (body.approverId) {
          approverId = String(body.approverId)
        }
        if (body.reason) {
          reason = String(body.reason)
        }
      } catch (e) {
        // Ignore JSON parse errors, will fallback to token
        console.warn('Could not parse approve request body:', e)
      }

      // Fallback: Lấy approverId từ token nếu không có trong body
      if (!approverId) {
        try {
          const userInfo = await verifyToken(req)
          if (userInfo?.id) {
            approverId = String(userInfo.id)
          }
        } catch (e) {
          console.error('Error getting approver info from token:', e)
        }
      }

      const response = await apiClient.approveBooking(bookingId, approverId, reason)
      if (response.success) {
        return NextResponse.json(response.data);
      }
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    // Create new booking (default)
    // Check if request has body
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 400 });
    }

    // Try to parse body with error handling
    let body;
    try {
      body = await req.json();
    } catch (parseError: any) {
      console.error('POST /api/system/bookings - JSON parse error:', parseError);
      // Check if error is due to empty body
      if (parseError.message && parseError.message.includes('Unexpected end of JSON input')) {
        return NextResponse.json({ error: 'Request body is required and must be valid JSON' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be a valid JSON object' }, { status: 400 });
    }
    
    // Try to get userId from token if not provided
    let authHeader = req.headers.get('authorization') || ''
    // Attach userId from token if missing
    if (!body.userId && !body.user_id) {
      try {
        const userInfo = await verifyToken(req)
        if (userInfo?.id) {
          body.userId = String(userInfo.id)
          console.log('✅ Extracted userId from verifyToken:', body.userId)
        }
      } catch (error) {
        console.warn('verifyToken failed, trying decodeJWT:', error)
      }
      // Fallback: decode JWT from Authorization header
      if (!body.userId && authHeader?.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7)
        const payload = decodeJWTPayload(token)
        if (payload?.userId) {
          body.userId = String(payload.userId)
          console.log('✅ Extracted userId from JWT payload:', body.userId)
        } else if (payload?.sub) {
          // Some tokens use 'sub' as userId
          body.userId = String(payload.sub)
          console.log('✅ Extracted userId from JWT sub:', body.userId)
        }
      }
      
      // Final check: if still no userId, return error
      if (!body.userId) {
        console.error('❌ Could not extract userId from token')
        return NextResponse.json({ error: 'Không thể xác định người dùng. Vui lòng đăng nhập lại.' }, { status: 401 })
      }
    }
    // Ensure numGuests at least 1
    if (!body.numGuests) body.numGuests = 1

    // Validate required fields
    if (!body.roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }
    if (!body.checkinDate) {
      return NextResponse.json({ error: 'checkinDate is required' }, { status: 400 });
    }
    if (!body.checkoutDate) {
      return NextResponse.json({ error: 'checkoutDate is required' }, { status: 400 });
    }

    // Format data theo backend CreateBookingRequest: { code: String, userId: String, roomId: Long, checkinDate: LocalDateTime, checkoutDate: LocalDateTime, numGuests: Integer, note: String }
    // Backend LocalDateTime mong đợi format ISO 8601: "2025-12-08T12:00:00" (không có timezone)
    // Giữ nguyên thời gian local để backend nhận đúng giờ VN (12:00 check-in, 10:00 check-out)
    const formatDateTimeForBackend = (dateTimeStr: string) => {
      if (!dateTimeStr) {
        console.warn('⚠️ Empty dateTimeStr provided')
        return dateTimeStr
      }
      
      // Nếu đã là format đúng (YYYY-MM-DDTHH:mm:ss), giữ nguyên
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateTimeStr)) {
        return dateTimeStr
      }
      
      // Nếu thiếu seconds (YYYY-MM-DDTHH:mm), thêm :00
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTimeStr)) {
        return `${dateTimeStr}:00`
      }
      
      // Nếu có timezone offset (+07:00 hoặc -XX:XX), bỏ timezone để giữ nguyên thời gian local
      if (dateTimeStr.includes('+') || (dateTimeStr.includes('-') && dateTimeStr.length > 19 && dateTimeStr[dateTimeStr.length - 6] === ':')) {
        // Bỏ phần timezone, giữ lại phần datetime: "2025-12-08T12:00:00+07:00" -> "2025-12-08T12:00:00"
        const plusIndex = dateTimeStr.lastIndexOf('+')
        const minusIndex = dateTimeStr.lastIndexOf('-')
        const timezoneIndex = plusIndex !== -1 ? plusIndex : (minusIndex !== -1 && minusIndex > 10 ? minusIndex : -1)
        if (timezoneIndex > 0 && dateTimeStr[timezoneIndex - 1] !== 'T') {
          const withoutTz = dateTimeStr.substring(0, timezoneIndex)
          // Đảm bảo có seconds
          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(withoutTz)) {
            return `${withoutTz}:00`
          }
          return withoutTz
        }
      }
      
      // Nếu có Z (UTC), bỏ Z và giữ nguyên thời gian
      if (dateTimeStr.endsWith('Z')) {
        const withoutZ = dateTimeStr.slice(0, -1)
        // Đảm bảo có seconds
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(withoutZ)) {
          return `${withoutZ}:00`
        }
        return withoutZ
      }
      
      // Nếu đã là format không có timezone, giữ nguyên nhưng đảm bảo có seconds
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTimeStr)) {
        return `${dateTimeStr}:00`
      }
      
      return dateTimeStr
    }
    
    const formattedBody = {
      code: body.code || '',
      userId: body.userId || '',
      roomId: Number(body.roomId), // Long
      checkinDate: formatDateTimeForBackend(body.checkinDate), // LocalDateTime (ISO string với Z)
      checkoutDate: formatDateTimeForBackend(body.checkoutDate), // LocalDateTime (ISO string với Z)
      numGuests: Number(body.numGuests || 1), // Integer
      note: body.note || '',
    }
    
    console.log('📤 Formatted booking data for backend:', formattedBody)

    // Forward auth header to backend if present
    const options: RequestInit = authHeader
      ? { headers: { Authorization: authHeader } }
      : {}
    
    const response = await apiClient.createBooking(formattedBody, options)
    
    if (!response.success) {
      console.error('Create booking failed:', response.error, response.data)
      return NextResponse.json(
        { error: response.error || 'Failed to create booking' }, 
        { status: 500 }
      )
    }
    
    return NextResponse.json(response.data, { status: 201 })
  } catch (error) {
    console.error('Create booking API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const response = await apiClient.updateBooking(body.id, body)
    
    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Failed to update booking' }, 
        { status: 500 }
      )
    }
    
    return NextResponse.json(response.data)
  } catch (error) {
    console.error('Update booking API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Booking ID is required for deletion' }, { status: 400 });
    }
    
    const bookingId = parseInt(id);
    if (isNaN(bookingId)) {
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
    }
    
    const response = await apiClient.deleteBooking(bookingId);
    if (response.success) {
      return NextResponse.json({ message: 'Booking deleted successfully' });
    }
    return NextResponse.json({ error: response.error }, { status: 500 });
  } catch (error) {
    console.error('Delete booking API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}


