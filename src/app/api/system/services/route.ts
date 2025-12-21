import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { isAdmin, getAuthorizationHeader } from '@/lib/auth-service'

// GET - list services or get by id
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    const authHeader = getAuthorizationHeader(req)
    const options: RequestInit = authHeader ? { headers: { Authorization: authHeader } } : {}

    if (id) {
      const serviceId = Number(id)
      if (!serviceId || Number.isNaN(serviceId)) {
        return NextResponse.json({ error: 'Invalid service ID' }, { status: 400 })
      }
      const response = await apiClient.getService(serviceId, options as any)
      return response.success
        ? NextResponse.json(response.data)
        : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
    }

    // Note: Backend services API may not support query params for filter/sort
    // If backend supports, we can add params here. For now, get all services
    // and filter/sort will be done client-side using lib/utils functions
    const response = await apiClient.getServices(options as any)
    if (!response.success) {
      console.error('GET /api/system/services error:', response.error)
      return NextResponse.json({ 
        error: response.error || 'Request failed',
        details: response.error 
      }, { status: 500 })
    }
    
    const raw: any = response.data
    const items = Array.isArray(raw?.content) ? raw.content : Array.isArray(raw) ? raw : []
    return NextResponse.json(
      { items, total: items.length },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error: any) {
    console.error('GET /api/system/services exception:', error)
    return NextResponse.json({ 
      error: error?.message || 'Internal server error',
      details: error?.stack || String(error)
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const response = await apiClient.createService(body)
    return response.success
      ? NextResponse.json(response.data, { status: 201 })
      : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || !body.id) {
      return NextResponse.json({ error: 'Invalid JSON body or missing id' }, { status: 400 })
    }
    const response = await apiClient.updateService(body.id, body)
    return response.success
      ? NextResponse.json(response.data)
      : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 })
    }
    const serviceId = Number(id)
    if (!serviceId || Number.isNaN(serviceId)) {
      return NextResponse.json({ error: 'Invalid service ID' }, { status: 400 })
    }
    const response = await apiClient.deleteService(serviceId)
    return response.success
      ? NextResponse.json({ message: 'Service deleted successfully' })
      : NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}