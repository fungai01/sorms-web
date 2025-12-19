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

    if (error) {
      return NextResponse.redirect(
        new URL(`/auth/callback?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`, request.url)
      )
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/auth/callback?error=no_code', request.url)
      )
    }

    const frontendCallbackUrl = new URL('/auth/callback', request.url)
    frontendCallbackUrl.searchParams.set('code', code)
    if (state) {
      frontendCallbackUrl.searchParams.set('state', state)
    }

    return NextResponse.redirect(frontendCallbackUrl)
  } catch (error) {
    return NextResponse.redirect(
      new URL('/auth/callback?error=callback_error', request.url)
    )
  }
}











