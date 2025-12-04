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
      const msg = (response.error || '').toLowerCase()
      // Map auth-related errors
      if (msg.includes('unauthorized') || msg.includes('unauthenticated') || msg.includes('forbidden') || msg.includes('403')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      // If endpoint not implemented or not found, return empty list gracefully
      if (msg.includes('not implemented') || msg.includes('not found') || msg.includes('404')) {
        return NextResponse.json({ items: [], total: 0 })
      }
      // Fallback: avoid crashing UI, return empty list on backend failure
      return NextResponse.json({ items: [], total: 0 })
    }

    const raw: any = response.data
    const items = Array.isArray(raw?.content) ? raw.content : (Array.isArray(raw) ? raw : [])
    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    console.error('[User Orders] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



