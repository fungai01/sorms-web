import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { API_CONFIG } from '@/lib/config'
import { mapRoleToAppRole } from '@/lib/auth-service'

// POST  /[bookingId]/checkin
// Proxy multipart/form-data to backend:    POST {BASE_URL}/bookings/{id}/checkin
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    // AuthN + AuthZ (Security role only)
    const userInfo = await verifyToken(req)
    if (!userInfo?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Authorization: để backend quyết định phân quyền. Ở FE chỉ cần xác thực có token là đủ.
    // Không chặn theo role ở đây để tránh sai lệch với backend.

    // Params
    const { bookingId: bookingIdStr } = await context.params
    const bookingId = Number(bookingIdStr)
    if (!bookingId || Number.isNaN(bookingId)) {
      return NextResponse.json({ error: 'Invalid bookingId' }, { status: 400 })
    }

    // Read multipart form-data from request
    const incomingForm = await req.formData()
    const faceImage = incomingForm.get('faceImage') as File | null
    const incomingBookingId = incomingForm.get('bookingId')?.toString()
    const userId = incomingForm.get('userId')?.toString()
    const faceRef = incomingForm.get('faceRef')?.toString()

    // Construct outgoing form-data (ensure proper field names)
    const outgoing = new FormData()
    outgoing.append('bookingId', String(incomingBookingId || bookingId))
    outgoing.append('faceRef', typeof faceRef !== 'undefined' ? faceRef : 'true')
    // Ensure userId is present: prefer incoming, fallback to token user id
    outgoing.append('userId', String(userId || userInfo.id))
    if (faceImage) outgoing.append('faceImage', faceImage)

    // Forward Authorization header/cookie token to backend
    const authHeader = req.headers.get('authorization')
    const accessCookie = req.cookies.get('access_token')?.value
    const authAccessCookie = req.cookies.get('auth_access_token')?.value
    const userInfoCookie = req.cookies.get('user_info')?.value

    let cookieToken: string | undefined
    if (accessCookie) cookieToken = accessCookie
    else if (authAccessCookie) cookieToken = authAccessCookie
    else if (userInfoCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(userInfoCookie))
        if (parsed?.token) cookieToken = parsed.token
      } catch {}
    }

    const headers: HeadersInit = {}
    if (authHeader) {
      headers['Authorization'] = authHeader
    } else if (cookieToken) {
      headers['Authorization'] = `Bearer ${cookieToken}`
    }

    // Call backend endpoint
    const backendUrl = `${API_CONFIG.BASE_URL}/bookings/${bookingId}/checkin`
    const beRes = await fetch(backendUrl, {
      method: 'POST',
      headers, // do NOT set Content-Type for multipart; fetch will set boundary
      body: outgoing,
    })

    // Pipe through response
    const contentType = beRes.headers.get('content-type') || ''
    const status = beRes.status

    if (contentType.includes('application/json')) {
      const data = await beRes.json().catch(() => null)
      return NextResponse.json(data ?? { success: status >= 200 && status < 300 }, { status })
    }

    // Fallback: return as text
    const text = await beRes.text().catch(() => '')
    return new NextResponse(text, { status })
  } catch (error: any) {
    console.error('[Security Check-in] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
