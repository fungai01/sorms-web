import { NextRequest, NextResponse } from 'next/server'

const ADDRESS_KIT_API = 'https://production.cas.so/address-kit/2025-07-01/communes'
const TIMEOUT_MS = 10000

// GET - Proxy request đến address-kit API để tránh CORS
export async function GET(req: NextRequest) {
  try {
    // Tạo AbortController để timeout
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
        cache: 'no-store', // Không cache để luôn lấy dữ liệu mới nhất
      })

      clearTimeout(timeoutId)

      // Kiểm tra response status
      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        console.error('[API] Address-kit API error:', res.status, errorText)
        return NextResponse.json(
          { 
            error: `API trả về lỗi: ${res.status} ${res.statusText}`,
            communes: [] 
          },
          { status: res.status }
        )
      }

      // Parse JSON response
      let data
      try {
        data = await res.json()
      } catch (parseError) {
        console.error('[API] Failed to parse JSON from address-kit API:', parseError)
        return NextResponse.json(
          { 
            error: 'Không thể parse dữ liệu từ API',
            communes: [] 
          },
          { status: 500 }
        )
      }

      // Trả về dữ liệu với format chuẩn
      return NextResponse.json({
        communes: Array.isArray(data?.communes) ? data.communes : [],
        success: true,
      })

    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[API] Address-kit API timeout')
        return NextResponse.json(
          { 
            error: 'Request timeout: API không phản hồi trong thời gian cho phép',
            communes: [] 
          },
          { status: 504 }
        )
      }

      // Network error hoặc CORS error
      console.error('[API] Address-kit API fetch error:', error)
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Lỗi kết nối đến API địa chỉ',
          communes: [] 
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[API] Unexpected error in address/communes route:', error)
    return NextResponse.json(
      { 
        error: 'Lỗi server không mong đợi',
        communes: [] 
      },
      { status: 500 }
    )
  }
}






