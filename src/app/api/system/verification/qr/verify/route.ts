import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-service'

// POST /api/system/verification/qr/verify
// Xác thực mã QR code từ user
export async function POST(req: NextRequest) {
  try {
    const userInfo = await verifyToken(req)

    if (!userInfo?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const roles = userInfo.roles || userInfo.roleName || []
    const isSecurity = roles.some((r: string) => 
      r.toUpperCase().includes('SECURITY') || r.toUpperCase() === 'SECURITY'
    )

    if (!isSecurity) {
      return NextResponse.json(
        { error: 'Forbidden: Only Security role can verify QR codes' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { token } = body

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid token' },
        { status: 400 }
      )
    }

    // Decode token (base64)
    let payload: any
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      payload = JSON.parse(decoded)
    } catch {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 400 }
      )
    }

    // Validate payload structure
    if (payload.type !== 'BOOKING_CHECKIN') {
      return NextResponse.json(
        { error: 'Invalid token type' },
        { status: 400 }
      )
    }

    if (!payload.bookingId) {
      return NextResponse.json(
        { error: 'Missing bookingId in token' },
        { status: 400 }
      )
    }

    // Verify booking with backend
    const auth = req.headers.get('authorization') || ''
    const accessCookie = req.cookies.get('access_token')?.value
    const authAccessCookie = req.cookies.get('auth_access_token')?.value
    const userInfoCookie = req.cookies.get('user_info')?.value
    let cookieToken: string | undefined
    if (accessCookie) cookieToken = accessCookie
    else if (authAccessCookie) cookieToken = authAccessCookie
    else if (userInfoCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(userInfoCookie))
        if (parsed?.token) cookieToken = parsed.token
      } catch {}
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json', accept: '*/*' }
    if (auth) headers['Authorization'] = auth
    else if (cookieToken) headers['Authorization'] = `Bearer ${cookieToken}`

    try {
      const { API_CONFIG } = await import('@/lib/config')
      const bookingId = payload.bookingId
      
      // Get booking from backend to verify
      const res = await fetch(`${API_CONFIG.BASE_URL}/bookings/${bookingId}`, {
        headers,
      })

      if (!res.ok) {
        if (res.status === 404) {
          return NextResponse.json(
            { 
              valid: false, 
              error: 'Booking not found',
              bookingId: payload.bookingId 
            },
            { status: 404 }
          )
        }
        const errorData = await res.json().catch(() => ({}))
        return NextResponse.json(
          { 
            valid: false, 
            error: errorData?.message || errorData?.error || `Backend error: ${res.status}`,
            bookingId: payload.bookingId 
          },
          { status: res.status }
        )
      }

      const bookingData = await res.json().catch(() => ({}))
      const booking = bookingData?.data || bookingData

      // Verify booking details match QR payload
      const isValid = booking && (
        String(booking.id || booking.bookingId) === String(payload.bookingId) &&
        String(booking.userId || booking.user_id) === String(payload.userId) &&
        booking.code === payload.bookingCode
      )

      if (!isValid) {
        return NextResponse.json(
          { 
            valid: false, 
            error: 'QR code data does not match booking',
            bookingId: payload.bookingId 
          },
          { status: 400 }
        )
      }

      // Check if booking is in valid status for check-in
      const validStatuses = ['APPROVED', 'PENDING']
      const bookingStatus = (booking.status || '').toUpperCase()
      if (!validStatuses.includes(bookingStatus)) {
        return NextResponse.json(
          { 
            valid: false, 
            error: `Booking is ${bookingStatus}, cannot check in`,
            bookingId: payload.bookingId,
            bookingStatus: bookingStatus
          },
          { status: 400 }
        )
      }

      return NextResponse.json({
        valid: true,
        bookingId: booking.id || booking.bookingId,
        userId: booking.userId || booking.user_id,
        userName: booking.userName || booking.user_name || payload.userName,
        userEmail: booking.userEmail || booking.user_email || payload.userEmail,
        roomId: booking.roomId || booking.room_id,
        roomCode: booking.roomCode || booking.room_code || payload.roomCode,
        checkinDate: booking.checkinDate || booking.checkin_date,
        checkoutDate: booking.checkoutDate || booking.checkout_date,
        numGuests: booking.numGuests || booking.num_guests || payload.numGuests,
        bookingCode: booking.code || payload.bookingCode,
        bookingStatus: booking.status,
      })
    } catch (error: any) {
      console.error('Error verifying QR code with backend:', error)
      return NextResponse.json(
        { 
          valid: false, 
          error: error?.message || 'Failed to verify booking with backend',
          bookingId: payload.bookingId 
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


