import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getAuthorizationHeader } from '@/lib/auth-utils'
import { API_CONFIG } from '@/lib/config'
import { mapRoleToAppRole } from '@/lib/auth-service'

// POST  /api/bookings/[bookingId]/checkin
// Proxy multipart/form-data to backend:    POST {BASE_URL}/bookings/{id}/checkin
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    console.log('Request received at /api/bookings/.../checkin')
    
    let authHeader: string | null = getAuthorizationHeader(req) || null
    let token: string | null = null
    let userInfo: any = null
    
    if (!authHeader) {
      const accessTokenCookie = req.cookies.get('access_token')?.value
      const authAccessTokenCookie = req.cookies.get('auth_access_token')?.value
      const userInfoCookie = req.cookies.get('user_info')?.value
      
      if (accessTokenCookie) {
        token = accessTokenCookie
      } else if (authAccessTokenCookie) {
        token = authAccessTokenCookie
      } else if (userInfoCookie) {
        try {
          const decoded = decodeURIComponent(userInfoCookie)
          const userInfo = JSON.parse(decoded)
          if (userInfo && userInfo.token) {
            token = userInfo.token
          }
        } catch (error) {
          console.warn('Failed to parse user_info cookie:', error)
        }
      }
      
      if (token) {
        authHeader = `Bearer ${token}`
      }
    } else {
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7)
      } else {
        token = authHeader
        authHeader = `Bearer ${token}`
      }
    }
    
    let isValidToken = false
    if (token) {
      try {
        userInfo = await verifyToken(req)
        if (userInfo?.id) {
          isValidToken = true
        } else {
          authHeader = null
        }
      } catch (verifyError) {
        authHeader = null
      }
    } else {
      console.log('No token provided - proceeding without authentication (backend allows this)')
    }

    const { bookingId: bookingIdStr } = await context.params
    const bookingId = Number(bookingIdStr)
    if (!bookingId || Number.isNaN(bookingId)) {
      return NextResponse.json({ error: 'Invalid bookingId' }, { status: 400 })
    }

    const incomingForm = await req.formData()
    const faceImage = incomingForm.get('faceImage') as File | null
    const incomingBookingId = incomingForm.get('bookingId')?.toString()
    const userId = incomingForm.get('userId')?.toString()
    const faceRef = incomingForm.get('faceRef')?.toString()

    const outgoing = new FormData()
    outgoing.append('bookingId', String(incomingBookingId || bookingId))
    const finalUserId = userId || (userInfo?.id) || null
    if (finalUserId) {
      outgoing.append('userId', String(finalUserId))
    } else {
      console.warn('No userId found, backend may reject request')
    }
    
    const faceRefValue = (faceRef === 'false' || faceRef === 'False' || faceRef === 'FALSE') ? 'false' : 'true'
    outgoing.append('faceRef', faceRefValue)
    
    if (faceImage && faceImage.size > 0) {
      const imageBlob = await faceImage.arrayBuffer()
      const imageFile = new File([imageBlob], faceImage.name || 'face-image.jpg', {
        type: faceImage.type || 'image/jpeg',
        lastModified: faceImage.lastModified,
      })
      outgoing.append('faceImage', imageFile)
    } else {
      return NextResponse.json(
        { error: 'Face image is required for check-in' },
        { status: 400 }
      )
    }

    const headers: HeadersInit = {
      'accept': '*/*',
    }
    
    if (authHeader && isValidToken) {
      headers['Authorization'] = authHeader
    }
    
    const backendUrl = `${API_CONFIG.BASE_URL}/bookings/${bookingId}/checkin`
    
    const beRes = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: outgoing,
    })
    
    const contentType = beRes.headers.get('content-type') || ''
    const status = beRes.status

    if (status === 401) {
      const responseText = await beRes.text().catch(() => '')
      console.error('Backend check-in error:', responseText)
      try {
        const errorData = JSON.parse(responseText)
        return NextResponse.json(
          { 
            error: errorData?.message || errorData?.error || 'Unauthorized',
            responseCode: errorData?.responseCode,
            details: errorData
          },
          { status: 401 }
        )
      } catch {
        return NextResponse.json(
          { error: responseText || 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    if (contentType.includes('application/json')) {
      const data = await beRes.json().catch(() => null)
      return NextResponse.json(data ?? { success: status >= 200 && status < 300 }, { status })
    }

    const text = await beRes.text().catch(() => '')
    return new NextResponse(text, { status })
  } catch (error: any) {
    console.error('Error in /api/bookings/.../checkin:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
