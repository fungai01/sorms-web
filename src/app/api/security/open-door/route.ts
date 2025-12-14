import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizationHeader, verifyToken } from '@/lib/auth-utils'
import { API_CONFIG } from '@/lib/config'

// POST  /api/security/open-door
// Proxy multipart/form-data to backend:    POST {BASE_URL}/door/open
export async function POST(req: NextRequest) {
  try {
    console.log('[Security Open Door] Request received')
    
    // IMPORTANT: Backend has disabled authentication for open-door endpoint
    // Try to get token for logging purposes, but don't require it
    let authHeader: string | null = getAuthorizationHeader(req) || null
    let token: string | null = null
    
    // Try multiple sources for token: header first, then cookies (optional)
    if (!authHeader) {
      const accessTokenCookie = req.cookies.get('access_token')?.value
      const authAccessTokenCookie = req.cookies.get('auth_access_token')?.value
      const userInfoCookie = req.cookies.get('user_info')?.value
      
      if (accessTokenCookie) {
        token = accessTokenCookie
        console.log('[Security Open Door] Token from access_token cookie (optional)')
      } else if (authAccessTokenCookie) {
        token = authAccessTokenCookie
        console.log('[Security Open Door] Token from auth_access_token cookie (optional)')
      } else if (userInfoCookie) {
        try {
          const decoded = decodeURIComponent(userInfoCookie)
          const userInfo = JSON.parse(decoded)
          if (userInfo && userInfo.token) {
            token = userInfo.token
            console.log('[Security Open Door] Token from user_info cookie (optional)')
          }
        } catch (error) {
          console.warn('[Security Open Door] Failed to parse user_info cookie:', error)
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
    
    // Verify token validity - only send Authorization header if token is valid
    // If token is invalid or expired, don't send it to avoid 401 errors
    let isValidToken = false
    let userInfo: any = null
    if (token) {
      try {
        userInfo = await verifyToken(req)
        if (userInfo?.id) {
          isValidToken = true
          console.log('[Security Open Door] Valid token found - User info:', { id: userInfo.id, email: userInfo.email })
        } else {
          console.log('[Security Open Door] Token verification failed - will not send Authorization header')
          authHeader = null as any // Clear invalid token
        }
      } catch (verifyError) {
        console.log('[Security Open Door] Token verification error - will not send Authorization header:', verifyError)
        authHeader = null as any // Clear invalid token
      }
    } else {
      console.log('[Security Open Door] No token provided - proceeding without authentication (backend allows this)')
    }
    
    // Read multipart form-data from request
    const incomingForm = await req.formData()
    const image = incomingForm.get('image') as File | null

    // Log file information
    if (image) {
      console.log('[Security Open Door] Image received:', {
        name: image.name,
        size: image.size,
        type: image.type,
        lastModified: image.lastModified,
      })
    } else {
      console.warn('[Security Open Door] No image file found in request')
      return NextResponse.json(
        { error: 'Image is required for door access' },
        { status: 400 }
      )
    }

    // Construct outgoing form-data
    const outgoing = new FormData()
    
    // Append image file
    if (image && image.size > 0) {
      const imageBlob = await image.arrayBuffer()
      const imageFile = new File([imageBlob], image.name || 'door-image.jpg', {
        type: image.type || 'image/jpeg',
        lastModified: image.lastModified,
      })
      outgoing.append('image', imageFile)
      console.log('[Security Open Door] Image appended to outgoing FormData:', {
        name: imageFile.name,
        size: imageFile.size,
        type: imageFile.type,
      })
    } else {
      console.error('[Security Open Door] Cannot append image: file is missing or empty')
      return NextResponse.json(
        { error: 'Image file is required and must not be empty' },
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
      console.log('[Security Open Door] Valid Authorization header included')
    } else {
      console.log('[Security Open Door] No Authorization header - proceeding without authentication (backend allows this)')
    }
    
    console.log('[Security Open Door] Headers prepared for backend:', {
      hasAuthorization: !!headers['Authorization'],
      tokenValid: isValidToken,
      accept: headers['accept'],
    })

    // Call backend endpoint: POST {BASE_URL}/door/open
    const backendUrl = `${API_CONFIG.BASE_URL}/door/open`
    console.log('[Security Open Door] Calling backend:', backendUrl)
    
    const beRes = await fetch(backendUrl, {
      method: 'POST',
      headers, // fetch will automatically set Content-Type: multipart/form-data with boundary
      body: outgoing,
    })
    
    console.log('[Security Open Door] Backend response status:', beRes.status)

    // Pipe through response
    const contentType = beRes.headers.get('content-type') || ''
    const status = beRes.status

    // Log response body for debugging, especially for 401 errors
    if (status === 401) {
      const responseText = await beRes.text().catch(() => '')
      console.error('[Security Open Door] 401 Unauthorized - Backend response:', responseText)
      try {
        const errorData = JSON.parse(responseText)
        console.error('[Security Open Door] Error details:', errorData)
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
    console.error('[Security Open Door] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

