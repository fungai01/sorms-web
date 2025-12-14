import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getAuthorizationHeader } from '@/lib/auth-utils'
import { API_CONFIG } from '@/lib/config'
import { mapRoleToAppRole } from '@/lib/auth-service'

// POST  /api/security/bookings/[bookingId]/checkin
// Proxy multipart/form-data to backend:    POST {BASE_URL}/bookings/{id}/checkin
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    console.log('[Security Check-in] Request received')
    
    // IMPORTANT: Backend has disabled authentication for check-in endpoint
    // Try to get token for logging purposes, but don't require it
    // Get token BEFORE reading FormData (FormData consumption may affect request)
    let authHeader: string | null = getAuthorizationHeader(req) || null
    let token: string | null = null
    let userInfo: any = null
    
    // Try multiple sources for token: header first, then cookies (optional)
    if (!authHeader) {
      const accessTokenCookie = req.cookies.get('access_token')?.value
      const authAccessTokenCookie = req.cookies.get('auth_access_token')?.value
      const userInfoCookie = req.cookies.get('user_info')?.value
      
      if (accessTokenCookie) {
        token = accessTokenCookie
        console.log('[Security Check-in] Token from access_token cookie (optional)')
      } else if (authAccessTokenCookie) {
        token = authAccessTokenCookie
        console.log('[Security Check-in] Token from auth_access_token cookie (optional)')
      } else if (userInfoCookie) {
        try {
          const decoded = decodeURIComponent(userInfoCookie)
          const userInfo = JSON.parse(decoded)
          if (userInfo && userInfo.token) {
            token = userInfo.token
            console.log('[Security Check-in] Token from user_info cookie (optional)')
          }
        } catch (error) {
          console.warn('[Security Check-in] Failed to parse user_info cookie:', error)
        }
      }
      
      if (token) {
        authHeader = `Bearer ${token}`
      }
    } else {
      // Extract token from Bearer header if present
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7)
      } else {
        token = authHeader
        authHeader = `Bearer ${token}`
      }
    }
    
    // Verify token validity - only send Authorization header if token is valid
    // If token is invalid or expired, don't send it to avoid 401 errors
    let isValidToken = false
    if (token) {
      try {
        userInfo = await verifyToken(req)
        if (userInfo?.id) {
          isValidToken = true
          console.log('[Security Check-in] Valid token found - User info:', { id: userInfo.id, email: userInfo.email })
        } else {
          console.log('[Security Check-in] Token verification failed - will not send Authorization header')
          authHeader = null // Clear invalid token
        }
      } catch (verifyError) {
        console.log('[Security Check-in] Token verification error - will not send Authorization header:', verifyError)
        authHeader = null // Clear invalid token
      }
    } else {
      console.log('[Security Check-in] No token provided - proceeding without authentication (backend allows this)')
    }

    // Params
    const { bookingId: bookingIdStr } = await context.params
    const bookingId = Number(bookingIdStr)
    if (!bookingId || Number.isNaN(bookingId)) {
      return NextResponse.json({ error: 'Invalid bookingId' }, { status: 400 })
    }

    // Read multipart form-data from request (AFTER getting token)
    const incomingForm = await req.formData()
    const faceImage = incomingForm.get('faceImage') as File | null
    const incomingBookingId = incomingForm.get('bookingId')?.toString()
    const userId = incomingForm.get('userId')?.toString()
    const faceRef = incomingForm.get('faceRef')?.toString()

    // Log file information
    if (faceImage) {
      console.log('[Security Check-in] Face image received:', {
        name: faceImage.name,
        size: faceImage.size,
        type: faceImage.type,
        lastModified: faceImage.lastModified,
      })
    } else {
      console.warn('[Security Check-in] No faceImage file found in request')
      // Check all form data entries
      console.log('[Security Check-in] All form data entries:', Array.from(incomingForm.entries()).map(([key, value]) => ({
        key,
        valueType: value instanceof File ? `File(${value.name}, ${value.size} bytes)` : typeof value,
      })))
    }

    // Construct outgoing form-data (ensure proper field names)
    const outgoing = new FormData()
    // Append fields in order: bookingId, userId, faceRef, then faceImage
    outgoing.append('bookingId', String(incomingBookingId || bookingId))
    // Use userId from form data, or from verified userInfo, or from token payload
    const finalUserId = userId || (userInfo?.id) || null
    if (finalUserId) {
      outgoing.append('userId', String(finalUserId))
    } else {
      console.warn('[Security Check-in] No userId found, backend may reject request')
    }
    
    // For boolean primitive binding in Spring @ModelAttribute with multipart/form-data:
    // Spring expects "true" or "false" as string for boolean primitive binding
    // Try sending as lowercase string - Spring should auto-convert
    // Note: If this still fails, the issue might be time validation (check-in before/after booking period)
    const faceRefValue = (faceRef === 'false' || faceRef === 'False' || faceRef === 'FALSE') ? 'false' : 'true'
    outgoing.append('faceRef', faceRefValue)
    console.log('[Security Check-in] FaceRef being sent:', { original: faceRef, converted: faceRefValue })
    
    // Append faceImage file - ensure it's properly included
    if (faceImage && faceImage.size > 0) {
      // Create a new File/Blob from the original to ensure it's properly serialized
      const imageBlob = await faceImage.arrayBuffer()
      const imageFile = new File([imageBlob], faceImage.name || 'face-image.jpg', {
        type: faceImage.type || 'image/jpeg',
        lastModified: faceImage.lastModified,
      })
      outgoing.append('faceImage', imageFile)
      console.log('[Security Check-in] Face image appended to outgoing FormData:', {
        name: imageFile.name,
        size: imageFile.size,
        type: imageFile.type,
      })
    } else {
      console.error('[Security Check-in] Cannot append faceImage: file is missing or empty')
      return NextResponse.json(
        { error: 'Face image is required for check-in' },
        { status: 400 }
      )
    }

    // Prepare headers for backend request
    // Note: Do NOT set Content-Type for multipart/form-data - browser/fetch will set it automatically with boundary
    // Backend has disabled authentication, so Authorization header is optional
    // IMPORTANT: Only send Authorization header if token is VALID to avoid 401 errors
    const headers: HeadersInit = {
      'accept': '*/*',
    }
    
    // Only add Authorization header if token exists AND is valid
    // If token is invalid/expired, don't send it - backend will allow unauthenticated request
    if (authHeader && isValidToken) {
      headers['Authorization'] = authHeader
      console.log('[Security Check-in] Valid Authorization header included')
    } else {
      console.log('[Security Check-in] No Authorization header - proceeding without authentication (backend allows this)')
    }
    
    console.log('[Security Check-in] Headers prepared for backend:', {
      hasAuthorization: !!headers['Authorization'],
      tokenValid: isValidToken,
      accept: headers['accept'],
    })

    // Call backend endpoint: POST {BASE_URL}/bookings/{id}/checkin
    const backendUrl = `${API_CONFIG.BASE_URL}/bookings/${bookingId}/checkin`
    console.log('[Security Check-in] Calling backend:', backendUrl)
    
    // Log all FormData entries (for debugging)
    const formDataEntries: any = {}
    for (const [key, value] of outgoing.entries()) {
      if (value instanceof File) {
        formDataEntries[key] = `File(${value.name}, ${value.size} bytes, ${value.type})`
      } else {
        formDataEntries[key] = value
      }
    }
    console.log('[Security Check-in] Outgoing FormData fields:', formDataEntries)
    console.log('[Security Check-in] FaceRef value type and content:', {
      original: faceRef,
      converted: faceRefValue,
      type: typeof faceRefValue
    })
    
    const beRes = await fetch(backendUrl, {
      method: 'POST',
      headers, // fetch will automatically set Content-Type: multipart/form-data with boundary
      body: outgoing,
    })
    
    console.log('[Security Check-in] Backend response status:', beRes.status)

    // Pipe through response
    const contentType = beRes.headers.get('content-type') || ''
    const status = beRes.status

    // Log response body for debugging, especially for 401 errors
    if (status === 401) {
      const responseText = await beRes.text().catch(() => '')
      console.error('[Security Check-in] 401 Unauthorized - Backend response:', responseText)
      try {
        const errorData = JSON.parse(responseText)
        console.error('[Security Check-in] Error details:', errorData)
        return NextResponse.json(
          { 
            error: errorData?.message || errorData?.error || 'Unauthorized: Token không hợp lệ hoặc đã hết hạn',
            responseCode: errorData?.responseCode,
            details: errorData
          },
          { status: 401 }
        )
      } catch {
        return NextResponse.json(
          { error: responseText || 'Unauthorized: Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.' },
          { status: 401 }
        )
      }
    }

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
