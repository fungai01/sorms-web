import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/config'

const BASE = API_CONFIG.BASE_URL

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    const myOrders = searchParams.get('my') === 'true'

    if (orderId) {
      const idNum = Number(orderId)
      if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const res = await fetch(`${BASE}/orders/${idNum}`, { headers: { 'Content-Type': 'application/json', accept: '*/*' } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data.data ?? data)
    }

    if (myOrders) {
      const res = await fetch(`${BASE}/orders/my-orders`, { headers: { 'Content-Type': 'application/json', accept: '*/*' } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data.data ?? data)
    }

    // Default: list orders if backend supports it
    const res = await fetch(`${BASE}/orders`, { headers: { 'Content-Type': 'application/json', accept: '*/*' } })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    return NextResponse.json(data.data ?? data)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const orderId = searchParams.get('orderId')
    const body = await req.json().catch(() => ({}))

    if (action === 'addItem') {
      if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
      const idNum = Number(orderId)
      if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const res = await fetch(`${BASE}/orders/${idNum}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data.data ?? data, { status: 201 })
    }

    if (action === 'confirm') {
      if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
      const idNum = Number(orderId)
      if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const res = await fetch(`${BASE}/orders/${idNum}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json', accept: '*/*' } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data.data ?? data)
    }

    if (action === 'cancel') {
      if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
      const idNum = Number(orderId)
      if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const res = await fetch(`${BASE}/orders/${idNum}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json', accept: '*/*' } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data.data ?? data)
    }

    if (action === 'cart') {
      const res = await fetch(`${BASE}/orders/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data.data ?? data, { status: 201 })
    }

    // Default create order
    const res = await fetch(`${BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: '*/*' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    return NextResponse.json(data.data ?? data, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    const itemId = searchParams.get('itemId')
    const body = await req.json().catch(() => ({}))
    if (!orderId || !itemId) return NextResponse.json({ error: 'orderId and itemId are required' }, { status: 400 })
    const o = Number(orderId)
    const i = Number(itemId)
    if (Number.isNaN(o) || Number.isNaN(i)) return NextResponse.json({ error: 'Invalid ids' }, { status: 400 })
    const res = await fetch(`${BASE}/orders/${o}/items/${i}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', accept: '*/*' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    return NextResponse.json(data.data ?? data)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    const itemId = searchParams.get('itemId')
    if (!orderId || !itemId) return NextResponse.json({ error: 'orderId and itemId are required' }, { status: 400 })
    const o = Number(orderId)
    const i = Number(itemId)
    if (Number.isNaN(o) || Number.isNaN(i)) return NextResponse.json({ error: 'Invalid ids' }, { status: 400 })
    const res = await fetch(`${BASE}/orders/${o}/items/${i}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', accept: '*/*' } })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    }
    return NextResponse.json({ message: 'Order item deleted successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}


