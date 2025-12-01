import { NextRequest, NextResponse } from 'next/server'

/**
 * Google OAuth Callback API Route
 * Google redirect về đây sau khi user xác thực
 * Route này chỉ đơn giản redirect code và state đến frontend callback page
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Nếu có lỗi từ Google
    if (error) {
      console.error('Google OAuth error:', error, errorDescription)
      return NextResponse.redirect(
        new URL(`/auth/callback?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`, request.url)
      )
    }

    // Nếu không có code
    if (!code) {
      console.error('No authorization code received from Google')
      return NextResponse.redirect(
        new URL('/auth/callback?error=no_code', request.url)
      )
    }

    // Redirect đến frontend callback page với code và state
    const frontendCallbackUrl = new URL('/auth/callback', request.url)
    frontendCallbackUrl.searchParams.set('code', code)
    if (state) {
      frontendCallbackUrl.searchParams.set('state', state)
    }

    return NextResponse.redirect(frontendCallbackUrl)
  } catch (error) {
    console.error('Error in Google OAuth callback:', error)
    return NextResponse.redirect(
      new URL('/auth/callback?error=callback_error', request.url)
    )
  }
}







