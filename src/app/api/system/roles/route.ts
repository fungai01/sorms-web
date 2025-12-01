import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/config'

const BASE = API_CONFIG.BASE_URL

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const q = searchParams.get('q')
    const page = searchParams.get('page') || '0'
    const size = searchParams.get('size') || '50'

    console.log('[API] GET /api/system/roles - params:', { id, q, page, size })
    console.log('[API] Backend URL:', BASE)

    if (id) {
      console.log('[API] Fetching role by ID:', id)
      const res = await fetch(`${BASE}/roles/${id}`, { headers: { 'Content-Type': 'application/json', accept: '*/*' }, cache: 'no-store' }).catch((e) => {
        console.error(`[API] Fetch failed for /roles/${id}:`, e);
        return new Response(JSON.stringify({ error: 'Failed to connect to backend API', details: e.message }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      });
      const data = await res.json().catch(() => ({}))
      console.log('[API] Backend response for role by ID:', data)
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data?.data ?? data)
    }

    if (q || searchParams.has('page') || searchParams.has('size')) {
      const url = new URL(`${BASE}/roles/search`)
      url.searchParams.set('page', page)
      url.searchParams.set('size', size)
      if (q) url.searchParams.set('keyword', q)
      console.log('[API] Searching roles:', url.toString())
      const res = await fetch(url.toString(), { headers: { 'Content-Type': 'application/json', accept: '*/*' }, cache: 'no-store' }).catch((e) => {
        console.error(`[API] Fetch failed for /roles/search:`, e);
        return new Response(JSON.stringify({ error: 'Failed to connect to backend API', details: e.message }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      });
      const data = await res.json().catch(() => ({}))
      console.log('[API] Backend search response:', data)
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      const items = Array.isArray(data?.data?.content) ? data.data.content : []
      return NextResponse.json({ items })
    }

    // Backend GET /roles có vấn đề, sử dụng search endpoint thay thế
    console.log('[API] Fetching all roles using search endpoint')
    const searchUrl = new URL(`${BASE}/roles/search`)
    searchUrl.searchParams.set('page', '0')
    searchUrl.searchParams.set('size', '100') // Lấy nhiều để đảm bảo có đủ

    console.log('[API] Search URL:', searchUrl.toString())
    const res = await fetch(searchUrl.toString(), {
      headers: { 'Content-Type': 'application/json', accept: '*/*' },
      cache: 'no-store'
    }).catch((e) => {
      console.error('[API] Fetch failed:', e);
      return new Response(JSON.stringify({ error: 'Failed to connect to backend API', details: e.message }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    });

    console.log('[API] Backend response status:', res.status)
    const rawText = await res.text()
    console.log('[API] Backend raw response:', rawText)

    const data = rawText ? JSON.parse(rawText) : {}
    console.log('[API] Backend parsed data:', data)

    if (!res.ok) {
      console.error('[API] Backend search endpoint also failed:', data)
      console.warn('[API] Returning empty array as fallback')
      // Trả về empty array thay vì error để UI không bị crash
      return NextResponse.json({ items: [] })
    }

    // Search endpoint trả về data.data.content
    const items = Array.isArray(data?.data?.content) ? data.data.content :
                  (Array.isArray(data?.data) ? data.data :
                  (Array.isArray(data) ? data : []));
    console.log('[API] Returning items count:', items.length)
    return NextResponse.json({ items })
  } catch (e: any) {
    console.error('[API] Error in GET /api/system/roles:', e);
    if (e.cause) {
      return NextResponse.json({
        error: 'Could not connect to the backend service.',
        details: `The request to the backend API failed. Please ensure the backend at ${BASE} is running and accessible.`
      }, { status: 503 });
    }
    return NextResponse.json({ error: e?.message || 'An internal server error occurred.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const idParam = searchParams.get('id')
    const codeParam = searchParams.get('code')

    console.log('[API] POST /api/system/roles - action:', action, 'id:', idParam, 'code:', codeParam)

    if (action && (idParam || codeParam)) {
      const idOrCode = idParam ?? codeParam
      // Backend spec: /roles/{id}/activate | /roles/{id}/deactivate
      const endpoint = action === 'activate'
        ? `${BASE}/roles/${idOrCode}/activate`
        : action === 'deactivate'
          ? `${BASE}/roles/${idOrCode}/deactivate`
          : ''
      if (!endpoint) return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
      console.log('[API] Calling endpoint:', endpoint)
      const res = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json', accept: '*/*' } })
      const data = await res.json().catch(() => ({}))
      console.log('[API] Response:', res.status, data)
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data?.data ?? data)
    }

    const body = await req.json().catch(() => ({}))
    const payload = { code: body.code, name: body.name, description: body.description }
    console.log('[API] Creating role with payload:', payload)
    const res = await fetch(`${BASE}/roles`, { method: 'POST', headers: { 'Content-Type': 'application/json', accept: '*/*' }, body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({}))
    console.log('[API] Create response:', res.status, data)
    if (!res.ok) {
      console.error('[API] Create failed:', data)
      return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    }
    return NextResponse.json(data?.data ?? data, { status: 201 })
  } catch (e: any) {
    console.error('[API] POST error:', e)
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    // Hỗ trợ cả id và code để tương thích với backend (một số bản dùng code làm key)
    const idOrCode = body.id ?? body.code
    if (!idOrCode) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    console.log('[API] Updating role:', idOrCode, 'with payload:', body)
    const payload = { code: body.code, name: body.name, description: body.description }
    const res = await fetch(`${BASE}/roles/${idOrCode}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', accept: '*/*' },
      body: JSON.stringify(payload)
    })
    const data = await res.json().catch(() => ({}))
    console.log('[API] Update response:', res.status, data)
    if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    return NextResponse.json(data?.data ?? data)
  } catch (e: any) {
    console.error('[API] PUT error:', e)
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const code = searchParams.get('code')
    const idOrCode = id ?? code
    if (!idOrCode) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    console.log('[API] Deactivating role:', idOrCode)
    // Soft delete: deactivate instead of hard delete
    const res = await fetch(`${BASE}/roles/${idOrCode}/deactivate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', accept: '*/*' }
    })
    const data = await res.json().catch(() => ({}))
    console.log('[API] Deactivate response:', res.status, data)
    if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    return NextResponse.json(data?.data ?? data)
  } catch (e: any) {
    console.error('[API] DELETE error:', e)
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}


