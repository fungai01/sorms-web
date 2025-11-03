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

    if (id) {
      const res = await fetch(`${BASE}/roles/${id}`, { headers: { 'Content-Type': 'application/json', accept: '*/*' }, cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data?.data ?? data)
    }

    if (q || searchParams.has('page') || searchParams.has('size')) {
      const url = new URL(`${BASE}/roles/search`)
      url.searchParams.set('page', page)
      url.searchParams.set('size', size)
      if (q) url.searchParams.set('keyword', q)
      const res = await fetch(url.toString(), { headers: { 'Content-Type': 'application/json', accept: '*/*' }, cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      const items = Array.isArray(data?.data?.content) ? data.data.content : []
      return NextResponse.json({ items })
    }

    const res = await fetch(`${BASE}/roles`, { headers: { 'Content-Type': 'application/json', accept: '*/*' }, cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const idParam = searchParams.get('id')

    if (action && idParam) {
      const id = idParam
      const endpoint = action === 'activate' ? `${BASE}/roles/${id}/activate` : action === 'deactivate' ? `${BASE}/roles/${id}/deactivate` : ''
      if (!endpoint) return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
      const res = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json', accept: '*/*' } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data?.data ?? data)
    }

    const body = await req.json().catch(() => ({}))
    const payload = { code: body.code, name: body.name, description: body.description }
    const res = await fetch(`${BASE}/roles`, { method: 'POST', headers: { 'Content-Type': 'application/json', accept: '*/*' }, body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    return NextResponse.json(data?.data ?? data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const id = body.id
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const payload = { id, code: body.code, name: body.name, description: body.description }
    const res = await fetch(`${BASE}/roles/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', accept: '*/*' }, body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    return NextResponse.json(data?.data ?? data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const idStr = searchParams.get('id')
    const id = idStr ? Number(idStr) : NaN
    if (!id || isNaN(id)) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    // Soft delete: deactivate instead of hard delete
    const res = await fetch(`${BASE}/roles/${id}/deactivate`, { method: 'PUT', headers: { 'Content-Type': 'application/json', accept: '*/*' } })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    return NextResponse.json(data?.data ?? data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}


