import { NextRequest, NextResponse } from 'next/server'
import { apiClient, createApiContext, verifyBookingAccess, handleApiError, successResponse, errorResponse } from '@/lib/api-client'
import { verifyToken, getAuthorizationHeader, decodeJWTPayload, isAdmin } from '@/lib/auth-service'
import { API_CONFIG } from '@/lib/config'

// GET - list / detail / filter by user or status
// Supports both system (admin) and user endpoints
export async function GET(req: NextRequest) {
  try {
    // Create API context for authorization
    const { context, error: authError } = await createApiContext(req)
    if (authError) return authError
    if (!context) return errorResponse('Unauthorized', 401)

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const bookingId = searchParams.get('bookingId')
    const userId = searchParams.get('userId')
    const status = searchParams.get('status')
    const action = searchParams.get('action')

    const authHeader = getAuthorizationHeader(req)
    const options: RequestInit = authHeader ? { headers: { Authorization: authHeader } } : {}

    // QR code generation (user-specific)
    if (action === 'qr' && (bookingId || id)) {
      const bid = Number(bookingId || id)
      if (!bid || Number.isNaN(bid)) {
        return errorResponse('Invalid bookingId', 400)
      }

      // Verify booking access
      const { booking, error: accessError } = await verifyBookingAccess(bid, context, req)
      if (accessError) return accessError
      if (!booking) return errorResponse('Booking not found', 404)

      const payload = {
        type: 'BOOKING_CHECKIN',
        bookingId: bid,
        userId: context.userInfo.id,
        bookingCode: booking.code,
        userName: booking.userName,
        userEmail: booking.userEmail || context.userInfo.email,
        roomId: booking.roomId,
        roomCode: booking.roomCode,
        checkinDate: booking.checkinDate,
        checkoutDate: booking.checkoutDate,
        numGuests: booking.numGuests,
        note: booking.note,
        bookingCreatedAt: booking.createdAt || booking.created_at || new Date().toISOString(),
        bookingDate: booking.createdAt || booking.created_at || new Date().toISOString(),
      }

      const json = JSON.stringify(payload)
      const base64 = Buffer.from(json, 'utf-8').toString('base64')

      return NextResponse.json({
        payload,
        token: base64,
        qrImageUrl: booking.qrImageUrl || null,
        bookingData: {
          userName: booking.userName,
          userEmail: booking.userEmail,
          roomName: booking.roomTypeName,
          roomNumber: booking.roomCode,
          checkInTime: booking.checkinDate,
          checkOutTime: booking.checkoutDate,
        },
      })
    }

    // Single booking detail
    if (id || bookingId) {
      const bid = Number(id || bookingId)
      if (!bid || Number.isNaN(bid)) {
        return errorResponse('Invalid booking ID', 400)
      }

      // Verify booking access
      const { booking, error: accessError } = await verifyBookingAccess(bid, context, req)
      if (accessError) return accessError
      if (!booking) return errorResponse('Booking not found', 404)

      return NextResponse.json(booking)
    }

    // Get bookings by user
    if (userId) {
      const user = Number(userId)
      if (!user || Number.isNaN(user)) {
        return errorResponse('Invalid user ID', 400)
      }

      // User can only access their own bookings
      if (context.isUser && String(user) !== String(context.userInfo.id)) {
        return errorResponse('Forbidden', 403)
      }

      const response = await apiClient.getBookingsByUser(user, options as any)
      if (!response.success) {
        return errorResponse(response.error || 'Request failed', 500)
      }
      const raw: any = response.data
      const items = Array.isArray(raw?.content) ? raw.content : Array.isArray(raw) ? raw : []
      
      // Filter by status if provided
      let filteredItems = items
      if (status) {
        filteredItems = items.filter((b: any) => String(b.status) === status)
      }

      // Enrich with roomName/roomCode using rooms API (best-effort; don't fail user flow if it breaks)
      // Why: bookings often only have roomId; frontend needs roomName.
      try {
        const roomsResp = await apiClient.getRooms(options as any)
        if (roomsResp.success) {
          const rooms: any[] = Array.isArray(roomsResp.data)
            ? roomsResp.data
            : (roomsResp.data as any)?.items || (roomsResp.data as any)?.data || []

          const roomInfoById = new Map<number, { name?: string; code?: string }>()

          for (const r of rooms) {
            const rid = Number((r as any).id ?? (r as any).roomId)
            if (!Number.isFinite(rid)) continue

            const name = (r as any).name || (r as any).roomName
            const code = (r as any).code || (r as any).roomCode

            if (name || code) {
              roomInfoById.set(rid, {
                name: name ? String(name) : undefined,
                code: code ? String(code) : undefined,
              })
            }
          }

          filteredItems = filteredItems.map((b: any) => {
            const roomId = Number(b.roomId ?? b.room_id)
            const mapped = Number.isFinite(roomId) ? roomInfoById.get(roomId) : undefined

            const currentName = b.roomName || b.room_name || b.room?.name
            const currentCode = b.roomCode || b.room_code || b.roomNumber || b.room_number

            // Priority:
            // - roomName: existing > mapped.name > roomTypeName (some BE fields) > existing code > mapped.code
            // - roomCode: existing > mapped.code
            const resolvedRoomName =
              currentName ||
              mapped?.name ||
              b.roomTypeName ||
              b.room_type_name ||
              currentCode ||
              mapped?.code ||
              undefined

            const resolvedRoomCode = currentCode || mapped?.code || undefined

            return {
              ...b,
              roomId: Number.isFinite(roomId) ? roomId : b.roomId,
              roomName: resolvedRoomName,
              roomCode: resolvedRoomCode,
            }
          })
        }
      } catch (error: any) {
        console.error('Failed to enrich room names:', error?.message || error)
      }

      return NextResponse.json({ items: filteredItems, total: filteredItems.length })
    }

    // Get bookings by status (admin/staff only)
    if (status) {
      if (!context.isAdmin && !context.isStaff && !context.isOffice) {
        return errorResponse('Forbidden', 403)
      }

      const validStatuses = ['PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'REJECTED']
      if (!validStatuses.includes(status)) {
        return errorResponse('Invalid booking status', 400)
      }
      const response = await apiClient.getBookingsByStatus(status, options as any)
      if (!response.success) {
        return errorResponse(response.error || 'Request failed', 500)
      }
      const raw: any = response.data
      const items = Array.isArray(raw?.content) ? raw.content : Array.isArray(raw) ? raw : []
      return NextResponse.json({ items, total: items.length })
    }

    // List all bookings (admin/staff only) or user's own bookings
    if (context.isUser) {
      // User gets their own bookings
      const userId = context.userInfo.id
      const response = await apiClient.getBookingsByUser(userId, options as any)
      if (!response.success) {
        return errorResponse(response.error || 'Request failed', 500)
      }
      let data = (response.data || []) as any[]
      if (status) {
        data = data.filter((b: any) => String(b.status) === status)
      }
      return NextResponse.json(data)
    }

    // Admin/Staff/Office get all bookings
    if (!context.isAdmin && !context.isStaff && !context.isOffice) {
      return errorResponse('Forbidden', 403)
    }

    const response = await apiClient.getBookings(options as any)
    if (!response.success) {
      return errorResponse(response.error || 'Request failed', 500)
    }
    const raw: any = response.data
    const items = Array.isArray(raw?.content) ? raw.content : Array.isArray(raw) ? raw : []
    return NextResponse.json(
      { items, total: items.length },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (error: any) {
    return handleApiError(error, 'Failed to get bookings')
  }
}

// POST - Create new booking or approve booking
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const id = searchParams.get('id')

    if (action === 'approve' && id) {
      if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
      const bookingId = Number(id)
      if (!bookingId || Number.isNaN(bookingId)) {
        return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 })
      }

      const body = await req.json().catch(() => ({}))
      const decision = (body.decision || new URL(req.url).searchParams.get('decision') || 'APPROVED').toString()
      const reason = (body.reason || new URL(req.url).searchParams.get('reason') || '').toString()
      let approverId: string | undefined = body.approverId ? String(body.approverId) : undefined

      // Lấy approverId từ token chỉ khi thiếu
      if (!approverId) {
        try {
          const userInfo = await verifyToken(req)
          if (userInfo?.id) {
            approverId = String(userInfo.id)
          } else {
            const authHeader = getAuthorizationHeader(req)
            const token = authHeader ? authHeader.replace('Bearer ', '') : ''
            if (token) {
              const payload = decodeJWTPayload(token)
              if (payload?.userId) {
                approverId = String(payload.userId)
              } else if (payload?.sub) {
                approverId = String(payload.sub)
              } else if (payload?.accountId) {
                approverId = String(payload.accountId)
              }
            }
          }
        } catch {
          // ignore token decode errors, fallback to 400 below
        }
      }

      if (!approverId) {
        return NextResponse.json({ error: 'Approver ID is required. Please ensure you are logged in.' }, { status: 400 })
      }

      const authHeader = getAuthorizationHeader(req)
      const requestHeaders: Record<string, string> = authHeader ? { Authorization: authHeader } : {}
      
      const approvePayload = {
        bookingId,
        approverId,
        decision,
        reason,
      }
      
      const backendUrl = `${API_CONFIG.BASE_URL}/bookings/${bookingId}/approve`
      
      const backendResponse = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': '*/*',
          ...requestHeaders
        },
        body: JSON.stringify(approvePayload)
      })
      
      if (!backendResponse.ok) {
        const errorData = await backendResponse.json().catch(() => ({ error: 'Request failed' }))
        return errorResponse(
          errorData.error || errorData.message || errorData.responseCode || 'Request failed',
          backendResponse.status
        )
      }
      
      const responseData = await backendResponse.json()
      return successResponse(responseData.data || responseData)
    }

    if (action === 'checkin' && id) {
      const bookingId = Number(id)
      if (!bookingId || Number.isNaN(bookingId)) {
        return errorResponse('Invalid booking ID', 400)
      }

      // Check-in uses multipart/form-data, not JSON
      try {
        // Try to get token, but don't require it (backend allows check-in without auth)
        let authHeader: string | null = getAuthorizationHeader(req) || null
        let token: string | null = null
        let userInfo: any = null
        
        // Try multiple sources for token: header first, then cookies (optional)
        if (!authHeader) {
          const accessTokenCookie = req.cookies.get('access_token')?.value
          const authAccessTokenCookie = req.cookies.get('auth_access_token')?.value
          const userInfoCookie = req.cookies.get('user_info')?.value
          
          if (accessTokenCookie) {
            token = accessTokenCookie
          } else if (authAccessTokenCookie) {
            token = authAccessTokenCookie
          } else if (userInfoCookie) {
            try {
              const decoded = decodeURIComponent(userInfoCookie)
              const parsedUserInfo = JSON.parse(decoded)
              if (parsedUserInfo && parsedUserInfo.token) {
                token = parsedUserInfo.token
              }
            } catch {
              // ignore cookie parse error
            }
          }
          
          if (token) {
            authHeader = `Bearer ${token}`
          }
        } else {
          // Extract token from Bearer header if present
          if (authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7)
          } else {
            token = authHeader
            authHeader = `Bearer ${token}`
          }
        }
        
        // Verify token validity - only send Authorization header if token is valid
        let isValidToken = false
        if (token) {
          try {
            userInfo = await verifyToken(req)
            if (userInfo?.id) {
              isValidToken = true
            } else {
              authHeader = null
            }
          } catch {
            authHeader = null
          }
        }

        // Read multipart form-data from request
        const incomingForm = await req.formData()
        const faceImage = incomingForm.get('faceImage') as File | null
        const incomingBookingId = incomingForm.get('bookingId')?.toString()
        const userId = incomingForm.get('userId')?.toString()
        const faceRef = incomingForm.get('faceRef')?.toString()

        // Construct outgoing form-data
        const outgoing = new FormData()
        outgoing.append('bookingId', String(incomingBookingId || bookingId))

        const finalUserId = userId || (userInfo?.id) || null
        if (finalUserId) {
          outgoing.append('userId', String(finalUserId))
        }
        
        const faceRefValue = (faceRef === 'false' || faceRef === 'False' || faceRef === 'FALSE') ? 'false' : 'true'
        outgoing.append('faceRef', faceRefValue)
        
        // Face image is optional according to backend design
        if (faceImage && faceImage.size > 0) {
          const imageBlob = await faceImage.arrayBuffer()
          const imageFile = new File([imageBlob], faceImage.name || 'face-image.jpg', {
            type: faceImage.type || 'image/jpeg',
            lastModified: faceImage.lastModified,
          })
          outgoing.append('faceImage', imageFile)
        }
        // Backend will handle check-in without face image if not provided

        const headers: HeadersInit = {
          accept: '*/*',
        }
        
        if (authHeader && isValidToken) {
          headers['Authorization'] = authHeader
        }

        const backendUrl = `${API_CONFIG.BASE_URL}/bookings/${bookingId}/checkin`
        
        const beRes = await fetch(backendUrl, {
          method: 'POST',
          headers,
          body: outgoing,
        })

        const contentType = beRes.headers.get('content-type') || ''
        const status = beRes.status

        if (status === 401) {
          const responseText = await beRes.text().catch(() => '')
          try {
            const errorData = JSON.parse(responseText)
            return NextResponse.json(
              { 
                error: errorData?.message || errorData?.error || 'Unauthorized',
                responseCode: errorData?.responseCode,
                details: errorData
              },
              { status: 401 }
            )
          } catch {
            return NextResponse.json(
              { error: responseText || 'Unauthorized' },
              { status: 401 }
            )
          }
        }

        if (contentType.includes('application/json')) {
          const data = await beRes.json().catch(() => null)
          return NextResponse.json(data ?? { success: status >= 200 && status < 300 }, { status })
        }

        const text = await beRes.text().catch(() => '')
        return new NextResponse(text, { status })
      } catch (error: any) {
        return errorResponse(error?.message || 'Internal server error', 500)
      }
    }

    if (action === 'checkout' && id) {
      const bookingId = Number(id)
      if (!bookingId || Number.isNaN(bookingId)) {
        return errorResponse('Invalid booking ID', 400)
      }

      const { context, error: authError } = await createApiContext(req)
      if (authError) return authError
      if (!context) return errorResponse('Unauthorized', 401)

      const body = await req.json().catch(() => ({}))
      const userId: string | undefined = body.userId ? String(body.userId) : context.userInfo.id

      const authHeader = getAuthorizationHeader(req)
      const options: RequestInit = authHeader ? { headers: { Authorization: authHeader } } : {}

      const response = await apiClient.checkoutBooking(bookingId, userId)
      return response.success
        ? successResponse(response.data)
        : errorResponse(response.error || 'Request failed', 500)
    }

    // User cancel booking (POST method for consistency)
    if (action === 'cancel' && id) {
      const { context, error: authError } = await createApiContext(req)
      if (authError) return authError
      if (!context) return errorResponse('Unauthorized', 401)

      const bookingId = Number(id)
      if (!bookingId || Number.isNaN(bookingId)) {
        return errorResponse('Invalid booking ID', 400)
      }

      // Verify booking access
      const { booking, error: accessError } = await verifyBookingAccess(bookingId, context, req)
      if (accessError) return accessError
      if (!booking) return errorResponse('Booking not found', 404)

      // Only allow cancel for PENDING bookings
      if (booking.status !== 'PENDING') {
        return errorResponse('Only PENDING bookings can be cancelled', 400)
      }

      const body = await req.json().catch(() => ({}))
      const reason = body.reason || 'User cancelled'

      // Update booking status to CANCELLED
      const authHeader = getAuthorizationHeader(req)
      const options: RequestInit = authHeader ? { headers: { Authorization: authHeader } } : {}
      
      const updateData = {
        id: bookingId,
        roomId: booking.roomId,
        checkinDate: booking.checkinDate,
        checkoutDate: booking.checkoutDate,
        numGuests: booking.numGuests || 1,
        note: reason,
        status: 'CANCELLED'
      }

      const response = await apiClient.updateBooking(bookingId, updateData)
      if (!response.success) {
        return NextResponse.json(
          { error: response.error || 'Failed to cancel booking' },
          { status: 500 }
        )
      }
      return successResponse(response.data)
    }

    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 400 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    let authHeader = req.headers.get('authorization') || ''
    if (!body.userId && !body.user_id) {
      const userInfo = await verifyToken(req).catch(() => null)
      if (userInfo?.id) {
        body.userId = String(userInfo.id)
      } else if (authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7)
        const payload = decodeJWTPayload(token)
        if (payload?.userId) {
          body.userId = String(payload.userId)
        } else if (payload?.sub) {
          body.userId = String(payload.sub)
        }
      }

      if (!body.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    if (!body.numGuests) body.numGuests = 1
    if (!body.roomId) return NextResponse.json({ error: 'roomId is required' }, { status: 400 })
    if (!body.checkinDate) return NextResponse.json({ error: 'checkinDate is required' }, { status: 400 })
    if (!body.checkoutDate) return NextResponse.json({ error: 'checkoutDate is required' }, { status: 400 })

    const normalizeDateTime = (value: string) => {
      if (!value) return value
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return value
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:00`
      if (value.endsWith('Z')) {
        const withoutZ = value.slice(0, -1)
        return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(withoutZ) ? `${withoutZ}:00` : withoutZ
      }
      return value
    }

    const formattedBody = {
      code: body.code || '',
      userId: body.userId || '',
      roomId: Number(body.roomId),
      checkinDate: normalizeDateTime(body.checkinDate),
      checkoutDate: normalizeDateTime(body.checkoutDate),
      numGuests: Number(body.numGuests || 1),
      note: body.note || '',
    }

    const options: RequestInit = authHeader
      ? { headers: { Authorization: authHeader } }
      : {}

    const response = await apiClient.createBooking(formattedBody, options)
    return response.success
      ? successResponse(response.data, 201)
      : errorResponse(response.error || 'Request failed', 500)
  } catch (error: any) {
    return handleApiError(error, 'Failed to create booking')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const id = searchParams.get('id')
    
    // User cancel booking
    if (action === 'cancel' && id) {
      const { context, error: authError } = await createApiContext(req)
      if (authError) return authError
      if (!context) return errorResponse('Unauthorized', 401)

      const bookingId = Number(id)
      if (!bookingId || Number.isNaN(bookingId)) {
        return errorResponse('Invalid booking ID', 400)
      }

      // Verify booking access
      const { booking, error: accessError } = await verifyBookingAccess(bookingId, context, req)
      if (accessError) return accessError
      if (!booking) return errorResponse('Booking not found', 404)

      // Only allow cancel for PENDING bookings
      if (booking.status !== 'PENDING') {
        return errorResponse('Only PENDING bookings can be cancelled', 400)
      }

      const body = await req.json().catch(() => ({}))
      const reason = body.reason || 'User cancelled'

      // Update booking status to CANCELLED
      const authHeader = getAuthorizationHeader(req)
      const options: RequestInit = authHeader ? { headers: { Authorization: authHeader } } : {}
      
      const updateData = {
        id: bookingId,
        roomId: booking.roomId,
        checkinDate: booking.checkinDate,
        checkoutDate: booking.checkoutDate,
        numGuests: booking.numGuests || 1,
        note: reason,
        status: 'CANCELLED'
      }

      const response = await apiClient.updateBooking(bookingId, updateData)
      if (!response.success) {
        return NextResponse.json(
          { error: response.error || 'Failed to cancel booking' },
          { status: 500 }
        )
      }
      return successResponse(response.data)
    }

    // User update booking (only for PENDING bookings)
    if (action === 'update' && id) {
      const { context, error: authError } = await createApiContext(req)
      if (authError) return authError
      if (!context) return errorResponse('Unauthorized', 401)

      const bookingId = Number(id)
      if (!bookingId || Number.isNaN(bookingId)) {
        return errorResponse('Invalid booking ID', 400)
      }

      // Verify booking access
      const { booking, error: accessError } = await verifyBookingAccess(bookingId, context, req)
      if (accessError) return accessError
      if (!booking) return errorResponse('Booking not found', 404)

      // Only allow update for PENDING bookings
      if (booking.status !== 'PENDING') {
        return errorResponse('Only PENDING bookings can be updated', 400)
      }

      const body = await req.json().catch(() => null)
      if (!body || typeof body !== 'object') {
        return errorResponse('Invalid JSON body', 400)
      }

      const authHeader = getAuthorizationHeader(req)
      const options: RequestInit = authHeader ? { headers: { Authorization: authHeader } } : {}

      const updateData = {
        id: bookingId,
        roomId: body.roomId || booking.roomId,
        checkinDate: body.checkinDate || booking.checkinDate,
        checkoutDate: body.checkoutDate || booking.checkoutDate,
        numGuests: body.numGuests || booking.numGuests || 1,
        note: body.note || booking.note || ''
      }

      const response = await apiClient.updateBooking(bookingId, updateData)
      return response.success
        ? successResponse(response.data)
        : errorResponse(response.error || 'Failed to update booking')
    }

    // Default: Admin/Staff update booking
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || !body.id) {
      return errorResponse('Invalid JSON body or missing id', 400)
    }

    const { context, error: authError } = await createApiContext(req)
    if (authError) return authError
    if (!context) return errorResponse('Unauthorized', 401)

    // Only admin/staff/office can update bookings directly
    if (!context.isAdmin && !context.isStaff && !context.isOffice) {
      return errorResponse('Forbidden', 403)
    }

    const authHeader = getAuthorizationHeader(req)
    const options: RequestInit = authHeader ? { headers: { Authorization: authHeader } } : {}

    const response = await apiClient.updateBooking(body.id, body)
    return response.success
      ? successResponse(response.data)
      : errorResponse(response.error || 'Request failed')
  } catch (error: any) {
    return handleApiError(error, 'Failed to update booking')
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { context, error: authError } = await createApiContext(req)
    if (authError) return authError
    if (!context) return errorResponse('Unauthorized', 401)

    // Only admin/office can delete bookings
    if (!context.isAdmin && !context.isOffice) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return errorResponse('Booking ID is required', 400)
    }
    const bookingId = Number(id)
    if (!bookingId || Number.isNaN(bookingId)) {
      return errorResponse('Invalid booking ID', 400)
    }

    const authHeader = getAuthorizationHeader(req)
    const options: RequestInit = authHeader ? { headers: { Authorization: authHeader } } : {}

    const response = await apiClient.deleteBooking(bookingId, options)
    return response.success
      ? successResponse({ message: 'Booking deleted successfully' })
      : errorResponse(response.error || 'Request failed')
  } catch (error: any) {
    return handleApiError(error, 'Failed to delete booking')
  }
}