import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { apiClient } from '@/lib/api-client'

// GET /api/user/bookings
// - Without params: list bookings of current user
// - ?id=[bookingId]: single booking of current user
// - ?bookingId=[bookingId]&action=qr: QR token for that booking
export async function GET(req: NextRequest) {
  try {
    const userInfo = await verifyToken(req)

    if (!userInfo?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const bookingIdParam = searchParams.get('bookingId') || searchParams.get('id')
    const action = searchParams.get('action')
    const status = searchParams.get('status')

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

    const userId = userInfo.id
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const response = await apiClient.getBookingsByUser(userId)
    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Request failed' },
        { status: 500 }
      )
    }

    let data = (response.data || []) as any[]

    if (status) {
      data = data.filter((b) => String(b.status) === status)
    }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
