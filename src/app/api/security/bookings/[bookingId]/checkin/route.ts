import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { apiClient } from '@/lib/api-client'

// POST /api/security/bookings/[bookingId]/checkin
// Thực hiện check-in cho booking (chỉ Security role)
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const userInfo = await verifyToken(req)

    if (!userInfo?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Kiểm tra role - chỉ Security mới được check-in
    const roles = userInfo.roles || userInfo.roleName || []
    const isSecurity = roles.some((r: string) => 
      r.toUpperCase().includes('SECURITY') || r.toUpperCase() === 'SECURITY'
    )

    if (!isSecurity) {
      return NextResponse.json(
        { error: 'Forbidden: Only Security role can perform check-in' },
        { status: 403 }
      )
    }

    const { bookingId: bookingIdStr } = await context.params
    const bookingId = Number(bookingIdStr)
    if (!bookingId || Number.isNaN(bookingId)) {
      return NextResponse.json(
        { error: 'Invalid bookingId' },
        { status: 400 }
      )
    }

    // TODO: Call backend API to perform check-in
    // For now, return success
    // const checkinRes = await apiClient.checkinBooking(bookingId)
    
    return NextResponse.json({
      success: true,
      message: 'Check-in thành công',
      bookingId,
    })
  } catch (error: any) {
    console.error('[Check-in] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

