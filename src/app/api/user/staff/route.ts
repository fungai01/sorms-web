import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { apiClient } from '@/lib/api-client'

// GET /api/user/staff
// Trả về danh sách staff cho frontend user dùng (không giới hạn admin)
export async function GET(req: NextRequest) {
  try {
    const userInfo = await verifyToken(req)

    if (!userInfo?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await apiClient.getStaffUsers()

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Failed to fetch staff users' },
        { status: 500 }
      )
    }

    // apiClient.getStaffUsers trả về { data: { items: [...] } } hoặc array
    const data = response.data as any
    const items =
      Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []

    return NextResponse.json(items)
  } catch (error) {
    console.error('[User Staff] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


