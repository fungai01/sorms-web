import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { apiClient } from '@/lib/api-client'

// GET /api/user/orders
// Trả về danh sách đơn dịch vụ của user hiện tại
export async function GET(req: NextRequest) {
  try {
    const userInfo = await verifyToken(req)

    if (!userInfo?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await apiClient.getMyServiceOrders()

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Failed to fetch service orders' },
        { status: 500 }
      )
    }

    return NextResponse.json(response.data || [])
  } catch (error) {
    console.error('[User Orders] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


