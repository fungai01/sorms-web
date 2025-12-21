import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizationHeader, verifyToken } from '@/lib/auth-service'
import { API_CONFIG } from '@/lib/config'

// POST  /api/system/verification/open-door
// Proxy multipart/form-data to backend:    POST {BASE_URL}/door/open
export async function POST(req: NextRequest) {
  try {
    // Backend has disabled authentication for open-door endpoint
    let authHeader: string | null = getAuthorizationHeader(req) || null
    let token: string | null = null
    
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
        } catch {
          // ignore cookie parse error
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
        const userInfo = await verifyToken(req)
        if (userInfo?.id) {
          isValidToken = true
        } else {
          authHeader = null as any
        }
      } catch {
        authHeader = null as any
      }
    }
    
    const incomingForm = await req.formData()
    const image = incomingForm.get('image') as File | null

    if (!image) {
      return NextResponse.json(
        { error: 'Image is required for door access' },
        { status: 400 }
      )
    }

    const outgoing = new FormData()
    
    if (image && image.size > 0) {
      const imageBlob = await image.arrayBuffer()
      const imageFile = new File([imageBlob], image.name || 'door-image.jpg', {
        type: image.type || 'image/jpeg',
        lastModified: image.lastModified,
      })
      outgoing.append('image', imageFile)
    } else {
      return NextResponse.json(
        { error: 'Image file is required and must not be empty' },
        { status: 400 }
      )
    }

    const headers: HeadersInit = {
      accept: '*/*',
    }
    
    if (authHeader && isValidToken) {
      headers['Authorization'] = authHeader
    }
    
    const backendUrl = `${API_CONFIG.BASE_URL}/door/open`
    
    const beRes = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: outgoing,
    })
    
    const contentType = beRes.headers.get('content-type') || ''
    const status = beRes.status

    if (status === 401) {
      const responseText = await beRes.text().catch(() => '')
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
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


