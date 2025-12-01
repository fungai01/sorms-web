import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { apiClient } from '@/lib/api-client'

// GET /api/user/bookings
// Trả về danh sách booking của chính user đang đăng nhập
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
    const status = searchParams.get('status')

    // Lấy tất cả bookings rồi lọc theo user hiện tại (an toàn hơn so với /bookings/by-user)
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
  } catch (error) {
    console.error('[User Bookings] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


