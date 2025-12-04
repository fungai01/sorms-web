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
      const msg = (response.error || '').toLowerCase()
      // Map auth-related errors
      if (msg.includes('unauthorized') || msg.includes('unauthenticated') || msg.includes('forbidden') || msg.includes('403')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      // If endpoint not implemented or not found, return empty list gracefully
      if (msg.includes('not implemented') || msg.includes('not found') || msg.includes('404')) {
        return NextResponse.json([])
      }
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

