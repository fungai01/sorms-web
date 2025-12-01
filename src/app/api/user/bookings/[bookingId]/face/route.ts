import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/config'
import { verifyToken } from '@/lib/auth-utils'
import { apiClient } from '@/lib/api-client'

// Helper: kiểm tra booking thuộc về user hiện tại
async function ensureBookingOwnership(bookingId: number, userId: number) {
  const bookingRes = await apiClient.getBooking(bookingId)
  if (!bookingRes.success || !bookingRes.data) {
    throw new Error('Booking not found')
  }
  const booking: any = bookingRes.data
  if (booking.userId !== userId) {
    throw new Error('Forbidden')
  }
  return booking
}

// GET /api/user/bookings/[bookingId]/face
// Lấy trạng thái khuôn mặt đã đăng ký cho user của booking này
export async function GET(
  req: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const userInfo = await verifyToken(req)

    if (!userInfo?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bookingId = Number(params.bookingId)
    if (!bookingId || Number.isNaN(bookingId)) {
      return NextResponse.json({ error: 'Invalid bookingId' }, { status: 400 })
    }

    // Đảm bảo booking thuộc về user hiện tại
    await ensureBookingOwnership(bookingId, Number(userInfo.id))

    // Gọi AI backend để lấy thông tin khuôn mặt
    const faceRes = await fetch(
      `${API_CONFIG.BASE_URL}/ai/recognition/faces/${userInfo.id}`,
      {
        method: 'GET',
      }
    )

    if (!faceRes.ok) {
      // Nếu 404 coi như chưa đăng ký khuôn mặt
      if (faceRes.status === 404) {
        return NextResponse.json({ registered: false })
      }
      const text = await faceRes.text().catch(() => '')
      console.error('[Face GET] Backend error:', faceRes.status, text)
      return NextResponse.json(
        { error: 'Failed to fetch face information' },
        { status: 502 }
      )
    }

    const data = await faceRes.json().catch(() => ({}))
    return NextResponse.json({
      registered: true,
      data,
    })
  } catch (error: any) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Booking not found') {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    console.error('[Face GET] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/user/bookings/[bookingId]/face
// Đăng ký khuôn mặt cho user của booking này
export async function POST(
  req: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const userInfo = await verifyToken(req)

    if (!userInfo?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bookingId = Number(params.bookingId)
    if (!bookingId || Number.isNaN(bookingId)) {
      return NextResponse.json({ error: 'Invalid bookingId' }, { status: 400 })
    }

    // Đảm bảo booking thuộc về user hiện tại
    await ensureBookingOwnership(bookingId, Number(userInfo.id))

    const incomingForm = await req.formData()

    const images = incomingForm.getAll('images')
  if (!images || images.length < 3) {
      return NextResponse.json(
      { error: 'At least three face images are required' },
        { status: 400 }
      )
    }

    // Chuẩn bị form data gửi sang AI backend
    const formData = new FormData()
    formData.append('student_id', String(userInfo.id))
    images.forEach((img, index) => {
      if (img instanceof File) {
        formData.append('images', img, img.name || `face-${index}.jpg`)
      }
    })

    const aiRes = await fetch(
      `${API_CONFIG.BASE_URL}/ai/recognition/face/register`,
      {
        method: 'POST',
        body: formData,
      }
    )

    if (!aiRes.ok) {
      const text = await aiRes.text().catch(() => '')
      console.error('[Face POST] Backend error:', aiRes.status, text)
      return NextResponse.json(
        { error: 'Failed to register face' },
        { status: 502 }
      )
    }

    const data = await aiRes.json().catch(() => ({}))
    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Booking not found') {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    console.error('[Face POST] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


