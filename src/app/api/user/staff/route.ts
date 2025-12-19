import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { apiClient } from '@/lib/api-client'

// GET /api/user/staff - public staff list for logged-in user
export async function GET(req: NextRequest) {
  try {
    const userInfo = await verifyToken(req).catch(() => null)

    if (!userInfo?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await apiClient.getStaffUsers()

    if (!response.success) {
      const msg = (response.error || '').toLowerCase()
      if (msg.includes('unauthorized') || msg.includes('unauthenticated') || msg.includes('forbidden') || msg.includes('403')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (msg.includes('not implemented') || msg.includes('not found') || msg.includes('404')) {
        return NextResponse.json([])
      }
      return NextResponse.json([], { status: 200 })
    }

    const data = response.data as any
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []

    return NextResponse.json(items)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}