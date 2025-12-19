import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { verifyToken, getAuthorizationHeader, decodeJWTPayload, isAdmin } from '@/lib/auth-utils'
import { API_CONFIG } from '@/lib/config'

// GET - list / detail / filter by user or status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')
    const status = searchParams.get('status')

    const authHeader = getAuthorizationHeader(req)
    const options: RequestInit = authHeader ? { headers: { Authorization: authHeader } } : {}

    if (id) {
      const bookingId = Number(id)
      if (!bookingId || Number.isNaN(bookingId)) {
        return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 })
      }
      const response = await apiClient.getBooking(bookingId, options as any)
      return response.success
        ? NextResponse.json(response.data)
        : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
    }

    if (userId) {
      const user = Number(userId)
      if (!user || Number.isNaN(user)) {
        return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
      }
      const response = await apiClient.getBookingsByUser(user, options as any)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      const raw: any = response.data
      const items = Array.isArray(raw?.content) ? raw.content : Array.isArray(raw) ? raw : []
      return NextResponse.json({ items, total: items.length })
    }

    if (status) {
      const validStatuses = ['PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'REJECTED']
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid booking status' }, { status: 400 })
      }
      const response = await apiClient.getBookingsByStatus(status, options as any)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      const raw: any = response.data
      const items = Array.isArray(raw?.content) ? raw.content : Array.isArray(raw) ? raw : []
      return NextResponse.json({ items, total: items.length })
    }

    const response = await apiClient.getBookings(options as any)
    if (!response.success) {
      return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
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
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
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
      let approverId: string | undefined = body.approverId ? String(body.approverId) : undefined
      const reason: string | undefined = body.reason ? String(body.reason) : undefined
      const decision: string | undefined = body.decision ? String(body.decision) : 'APPROVED'

      // Lấy approverId từ token nếu chưa có trong body
      if (!approverId) {
        try {
          const userInfo = await verifyToken(req)
          if (userInfo?.id) {
            approverId = String(userInfo.id)
          } else {
            // Thử lấy từ JWT payload trực tiếp
            const token = getAuthorizationHeader(req).replace('Bearer ', '')
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
        } catch (error) {
          console.error('Error getting approverId from token:', error)
        }
      }

      if (!approverId) {
        return NextResponse.json({ error: 'Approver ID is required. Please ensure you are logged in.' }, { status: 400 })
      }

      // Gọi backend với decision từ body (APPROVED hoặc REJECTED)
      const authHeader = getAuthorizationHeader(req)
      const requestHeaders: Record<string, string> = authHeader ? { Authorization: authHeader } : {}
      
      const approvePayload = {
        bookingId: bookingId,
        approverId: approverId,
        decision: decision,
        reason: reason || ''
      }
      
      const backendUrl = `${API_CONFIG.BASE_URL}/bookings/${bookingId}/approve`
      
      console.log('Calling backend approve endpoint:', backendUrl)
      console.log('Payload:', JSON.stringify(approvePayload, null, 2))
      
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
        return NextResponse.json({ error: errorData.error || errorData.message || errorData.responseCode || 'Request failed' }, { status: backendResponse.status })
      }
      
      const responseData = await backendResponse.json()
      return NextResponse.json(responseData)
    }

    if (action === 'checkout' && id) {
      const bookingId = Number(id)
      if (!bookingId || Number.isNaN(bookingId)) {
        return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 })
      }

      const body = await req.json().catch(() => ({}))
      const userId: string | undefined = body.userId ? String(body.userId) : undefined

      const response = await apiClient.checkoutBooking(bookingId, userId)
      return response.success
        ? NextResponse.json(response.data)
        : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
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
      ? NextResponse.json(response.data, { status: 201 })
      : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || !body.id) {
      return NextResponse.json({ error: 'Invalid JSON body or missing id' }, { status: 400 })
    }
    const response = await apiClient.updateBooking(body.id, body)
    return response.success
      ? NextResponse.json(response.data)
      : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 })
    }
    const bookingId = Number(id)
    if (!bookingId || Number.isNaN(bookingId)) {
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 })
    }
    const response = await apiClient.deleteBooking(bookingId)
    return response.success
      ? NextResponse.json({ message: 'Booking deleted successfully' })
      : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}