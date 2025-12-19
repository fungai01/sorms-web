import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/config'
import { getAuthorizationHeader } from '@/lib/auth-utils'

const BASE = API_CONFIG.BASE_URL

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    const myOrders = searchParams.get('my') === 'true'
    const staffId = searchParams.get('staffId')
    const staffTaskDetail = searchParams.get('staffTaskDetail') === 'true'

    // Staff workflow: Get staff task detail for order
    if (staffTaskDetail && staffId && orderId) {
      const staffIdNum = Number(staffId)
      const orderIdNum = Number(orderId)
      if (Number.isNaN(staffIdNum) || Number.isNaN(orderIdNum)) {
        return NextResponse.json({ error: 'Invalid staffId or orderId' }, { status: 400 })
      }
      const auth = getAuthorizationHeader(req)
      const res = await fetch(`${BASE}/orders/staff/${staffIdNum}/tasks/${orderIdNum}`, {
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data.data ?? data)
    }

    // Staff workflow: Get staff tasks
    if (staffId) {
      const staffIdNum = Number(staffId)
      if (Number.isNaN(staffIdNum)) {
        return NextResponse.json({ error: 'Invalid staffId' }, { status: 400 })
      }
      const status = searchParams.get('status') || undefined
      const auth = getAuthorizationHeader(req)
      
      let url = `${BASE}/orders/staff/${staffIdNum}/tasks`
      if (status) {
        url += `?status=${encodeURIComponent(status)}`
      }
      
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      const responseData = data.data ?? data
      const items = Array.isArray(responseData) ? responseData : []
      return NextResponse.json({ items, total: items.length })
    }

    if (orderId) {
      const idNum = Number(orderId)
      if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const auth = getAuthorizationHeader(req)
      const res = await fetch(`${BASE}/orders/${idNum}`, { headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data.data ?? data)
    }

    if (myOrders) {
      const bookingId = searchParams.get('bookingId')
      const auth = getAuthorizationHeader(req)
      
      // Build URL with bookingId query param if provided
      let url = `${BASE}/orders/my-orders`
      if (bookingId) {
        url += `?bookingId=${bookingId}`
      }
      
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data.data ?? data)
    }

    // Default: list orders - Backend doesn't have GET /orders endpoint
    // Return empty array for now, or implement aggregation from multiple sources
    // TODO: Backend needs to implement GET /orders endpoint for admin to list all orders
    return NextResponse.json({ items: [], total: 0 })
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
      const auth = getAuthorizationHeader(req)
      const res = await fetch(`${BASE}/orders/${idNum}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
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
      const auth = getAuthorizationHeader(req)
      const res = await fetch(`${BASE}/orders/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data.data ?? data, { status: 201 })
    }

    // Staff workflow: Create service order
    if (action === 'service') {
      // Validate required fields according to backend CreateServiceOrderRequest
      // Backend requires: bookingId, orderId, serviceId, quantity, assignedStaffId, requestedBy, serviceTime
      if (!body.bookingId) {
        return NextResponse.json({ error: 'bookingId is required' }, { status: 400 })
      }
      if (!body.orderId) {
        return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
      }
      if (!body.serviceId) {
        return NextResponse.json({ error: 'serviceId is required' }, { status: 400 })
      }
      if (!body.quantity || body.quantity <= 0) {
        return NextResponse.json({ error: 'quantity is required and must be greater than 0' }, { status: 400 })
      }
      if (!body.assignedStaffId) {
        return NextResponse.json({ error: 'assignedStaffId is required' }, { status: 400 })
      }
      if (!body.requestedBy) {
        return NextResponse.json({ error: 'requestedBy is required' }, { status: 400 })
      }
      if (!body.serviceTime) {
        return NextResponse.json({ error: 'serviceTime is required' }, { status: 400 })
      }
      
      // Format payload according to backend expectations
      // Backend expects: bookingId (Long), orderId (Long), serviceId (Long), 
      // quantity (BigDecimal), assignedStaffId (Long), requestedBy (Long), 
      // serviceTime (LocalDateTime), note (String, optional)
      const payload = {
        bookingId: Number(body.bookingId),
        orderId: Number(body.orderId),
        serviceId: Number(body.serviceId),
        quantity: Number(body.quantity), // Backend will convert to BigDecimal
        assignedStaffId: Number(body.assignedStaffId),
        requestedBy: Number(body.requestedBy),
        serviceTime: body.serviceTime, // Should be in format: "yyyy-MM-dd'T'HH:mm:ss"
        note: body.note || null,
      }
      
      const auth = getAuthorizationHeader(req)
      const res = await fetch(`${BASE}/orders/${payload.orderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
        body: JSON.stringify(payload),
      })
      
      const data = await res.json().catch(() => ({}))
      
      if (!res.ok) {
        return NextResponse.json(
          { error: data?.message || data?.error || `Backend error: ${res.status}` },
          { status: res.status >= 400 && res.status < 500 ? res.status : 500 }
        )
      }
      
      return NextResponse.json(data.data ?? data, { status: 201 })
    }

    // Staff workflow: Staff confirm order
    if (action === 'staffConfirm') {
      if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
      const idNum = Number(orderId)
      if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const auth = getAuthorizationHeader(req)
      const res = await fetch(`${BASE}/orders/${idNum}/staff/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data.data ?? data)
    }

    // Staff workflow: Staff reject order
    if (action === 'staffReject') {
      if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
      const idNum = Number(orderId)
      if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const auth = getAuthorizationHeader(req)
      const res = await fetch(`${BASE}/orders/${idNum}/staff/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data.data ?? data)
    }

    // Complete service
    if (action === 'complete') {
      if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
      const idNum = Number(orderId)
      if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const auth = getAuthorizationHeader(req)
      const res = await fetch(`${BASE}/orders/${idNum}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data.data ?? data)
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
    const action = searchParams.get('action')
    const orderId = searchParams.get('orderId')
    const body = await req.json().catch(() => ({}))

    // Adjust schedule
    if (action === 'adjustSchedule' && orderId) {
      const idNum = Number(orderId)
      if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const auth = getAuthorizationHeader(req)
      const res = await fetch(`${BASE}/orders/${idNum}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
      return NextResponse.json(data.data ?? data)
    }

    // Update order item (existing)
    const itemId = searchParams.get('itemId')
    if (orderId && itemId) {
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
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
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


