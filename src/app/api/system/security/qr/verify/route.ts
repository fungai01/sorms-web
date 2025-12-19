import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'

// POST /api/system/security/qr/verify
// Xác thực mã QR code từ user (chỉ Security role)
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

    // TODO: Call backend API to verify booking status
    return NextResponse.json({
      valid: true,
      bookingId: payload.bookingId,
      userId: payload.userId,
      userName: payload.userName,
      userEmail: payload.userEmail,
      roomId: payload.roomId,
      roomCode: payload.roomCode,
      checkinDate: payload.checkinDate,
      checkoutDate: payload.checkoutDate,
      numGuests: payload.numGuests,
      bookingCode: payload.bookingCode,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


