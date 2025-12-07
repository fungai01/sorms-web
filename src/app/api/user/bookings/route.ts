import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { apiClient } from '@/lib/api-client'

// Helper: kiểm tra booking thuộc về user hiện tại
async function ensureBookingOwnership(bookingId: number, userId: number) {
  const bookingRes = await apiClient.getBooking(bookingId)
  if (!bookingRes.success || !bookingRes.data) {
    throw new Error('Booking not found')
  }
  const booking: any = bookingRes.data
  if (String(booking.userId) !== String(userId)) {
    throw new Error('Forbidden')
  }
  return booking
}

// GET /api/user/bookings
// Trả về danh sách booking của chính user đang đăng nhập
// GET /api/user/bookings?id=[bookingId]
// Trả về thông tin booking cụ thể nếu có query parameter id
// GET /api/user/bookings?bookingId=[bookingId]&action=qr
// Lấy mã QR
export async function GET(req: NextRequest) {
  try {
    const userInfo = await verifyToken(req)

    if (!userInfo?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const bookingIdParam = searchParams.get('bookingId') || searchParams.get('id')
    const action = searchParams.get('action')
    const status = searchParams.get('status')

    // Xử lý action=qr
    if (action === 'qr' && bookingIdParam) {
      const bookingId = Number(bookingIdParam)
      if (!bookingId || Number.isNaN(bookingId)) {
        return NextResponse.json({ error: 'Invalid bookingId' }, { status: 400 })
      }

      const bookingRes = await apiClient.getBooking(bookingId)
      if (!bookingRes.success || !bookingRes.data) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
      }
      const booking: any = bookingRes.data
      if (String(booking.userId) !== String(userInfo.id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const payload = {
        type: 'BOOKING_CHECKIN',
        bookingId,
        userId: userInfo.id,
        bookingCode: booking.code,
        userName: booking.userName,
        userEmail: booking.userEmail || userInfo.email,
        roomId: booking.roomId,
        roomCode: booking.roomCode,
        checkinDate: booking.checkinDate,
        checkoutDate: booking.checkoutDate,
        numGuests: booking.numGuests,
        note: booking.note,
        bookingCreatedAt: booking.createdAt || booking.created_at || new Date().toISOString(), // Ngày giờ đặt phòng
        bookingDate: booking.createdAt || booking.created_at || new Date().toISOString(), // Alias for compatibility
      }

      const json = JSON.stringify(payload)
      const base64 = Buffer.from(json, 'utf-8').toString('base64')

      return NextResponse.json({
        payload,
        token: base64,
        bookingData: {
          userName: booking.userName,
          userEmail: booking.userEmail,
          roomName: booking.roomTypeName,
          roomNumber: booking.roomCode,
          checkInTime: booking.checkinDate,
          checkOutTime: booking.checkoutDate,
        }
      })
    }

    // Nếu có bookingId (không có action), trả về booking cụ thể
    if (bookingIdParam && !action) {
      const bookingId = Number(bookingIdParam)
      if (!bookingId || Number.isNaN(bookingId)) {
        return NextResponse.json({ error: 'Invalid bookingId' }, { status: 400 })
      }

      const bookingRes = await apiClient.getBooking(bookingId)
      if (!bookingRes.success || !bookingRes.data) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
      }

      const booking: any = bookingRes.data
      if (String(booking.userId) !== String(userInfo.id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      return NextResponse.json(booking)
    }

    // Nếu không có bookingId, trả về danh sách bookings
    const response = await apiClient.getBookings()

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Failed to fetch user bookings' },
        { status: 500 }
      )
    }

    const all = (response.data || []) as any[]
    const userIdStr = String(userInfo.id)
    let data = all.filter(b => String(b.userId) === userIdStr)

    if (status) {
      data = data.filter(b => String(b.status) === status)
    }

    return NextResponse.json(data)
  } catch (error: any) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Booking not found') {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    console.error('[User Bookings] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


