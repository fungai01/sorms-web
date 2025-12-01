import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { apiClient } from '@/lib/api-client'

// GET /api/user/bookings/[bookingId]/qr
// Tạo payload QR đơn giản để client render (tạm thời, chưa dùng backend riêng)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const userInfo = await verifyToken(req)

    if (!userInfo?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookingId: bookingIdParam } = await params
    const bookingId = Number(bookingIdParam)
    if (!bookingId || Number.isNaN(bookingId)) {
      return NextResponse.json({ error: 'Invalid bookingId' }, { status: 400 })
    }

    // Đảm bảo booking thuộc về user hiện tại
    const bookingRes = await apiClient.getBooking(bookingId)
    if (!bookingRes.success || !bookingRes.data) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    const booking: any = bookingRes.data
    if (booking.userId !== userInfo.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Payload QR: chứa thông tin cần thiết để tra cứu và hiển thị nhanh
    const payload = {
      type: 'BOOKING_CHECKIN',
      bookingId,
      userId: userInfo.id,
      // Thông tin người đặt
      bookingCode: booking.code,
      userName: booking.userName,
      // Thông tin phòng
      roomId: booking.roomId,
      roomCode: booking.roomCode,
      checkinDate: booking.checkinDate,
      checkoutDate: booking.checkoutDate,
      numGuests: booking.numGuests,
      note: booking.note,
    }

    const json = JSON.stringify(payload)
    const base64 = Buffer.from(json, 'utf-8').toString('base64')

    return NextResponse.json({
      payload,
      token: base64,
    })
  } catch (error) {
    console.error('[Booking QR] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


