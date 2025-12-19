import { NextRequest, NextResponse } from 'next/server'

const ADDRESS_KIT_API = 'https://production.cas.so/address-kit/2025-07-01/communes'
const TIMEOUT_MS = 10000

// GET - Proxy request đến address-kit API để tránh CORS
export async function GET(req: NextRequest) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const size = searchParams.get('size') || '50'

    const url = new URL(ADDRESS_KIT_API)
    if (q) url.searchParams.set('q', q)
    if (size) url.searchParams.set('size', size)

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      const message = errorText || `${res.status} ${res.statusText}`
      return NextResponse.json(
        {
          error: message,
          communes: [],
        },
        { status: res.status }
      )
    }

    const data = await res.json().catch(() => ({}))

    return NextResponse.json({
      communes: Array.isArray((data as any)?.communes) ? (data as any).communes : [],
      success: true,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        {
          error: 'Request timeout',
          communes: [],
        },
        { status: 504 }
      )
    }

    const message = error instanceof Error ? error.message : 'Request failed'
    return NextResponse.json(
      {
        error: message,
        communes: [],
      },
      { status: 500 }
    )
  } finally {
    clearTimeout(timeoutId)
  }
}






