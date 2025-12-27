import { NextRequest, NextResponse } from 'next/server'
import { apiClient } from '@/lib/api-client'
import { getAuthorizationHeader } from '@/lib/auth-service'
import { API_CONFIG } from '@/lib/config'

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
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      const response = await apiClient.get(`/orders/staff/${staffIdNum}/tasks/${orderIdNum}`, options)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      return NextResponse.json(response.data)
    }

    // Staff workflow: Get staff tasks
    if (staffId) {
      const staffIdNum = Number(staffId)
      if (Number.isNaN(staffIdNum)) {
        return NextResponse.json({ error: 'Invalid staffId' }, { status: 400 })
      }
      const status = searchParams.get('status') || undefined
      const auth = getAuthorizationHeader(req)
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      
      let endpoint = `/orders/staff/${staffIdNum}/tasks`
      if (status) {
        endpoint += `?status=${encodeURIComponent(status)}`
      }
      
      const response = await apiClient.get(endpoint, options)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      const responseData = response.data
      const items = Array.isArray(responseData) ? responseData : []
      return NextResponse.json({ items, total: items.length })
    }

    if (orderId) {
      const idNum = Number(orderId)
      if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const auth = getAuthorizationHeader(req)
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      const response = await apiClient.getServiceOrder(idNum)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      return NextResponse.json(response.data)
    }

    if (myOrders) {
      const bookingId = searchParams.get('bookingId')
      const auth = getAuthorizationHeader(req)
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      
      // Backend requires bookingId as a required parameter
      // If bookingId is missing, return empty list instead of calling backend
      if (!bookingId) {
        return NextResponse.json({ items: [], total: 0 })
      }

      // If no authentication, return empty list (graceful degradation)
      if (!auth) {
        return NextResponse.json({ items: [], total: 0 })
      }

      const bookingIdNum = Number(bookingId)
      if (Number.isNaN(bookingIdNum)) {
        return NextResponse.json({ error: 'Invalid bookingId', items: [] }, { status: 400 })
      }

      // `getMyServiceOrders` requires bookingId parameter
      const response = await apiClient.getMyServiceOrders(bookingIdNum)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed', items: [] }, { status: 500 })
      }
      return NextResponse.json(response.data)
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
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      const response = await apiClient.addOrderItem(
        idNum,
        body.serviceId,
        body.quantity,
        body.serviceDate,
        body.serviceTime,
        body.assignedStaffId
      )
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      return NextResponse.json(response.data, { status: 201 })
    }

    if (action === 'confirm') {
      if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
      const idNum = Number(orderId)
      if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const response = await apiClient.confirmOrder(idNum)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      return NextResponse.json(response.data)
    }

    if (action === 'cancel') {
      if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
      const idNum = Number(orderId)
      if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const auth = getAuthorizationHeader(req)
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      const response = await apiClient.post(`/orders/${idNum}/cancel`, undefined, options)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      return NextResponse.json(response.data)
    }

    if (action === 'cart') {
      const auth = getAuthorizationHeader(req)
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      const response = await apiClient.createOrderCart({
        bookingId: body.bookingId,
        requestedBy: body.requestedBy,
        note: body.note
      })
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      return NextResponse.json(response.data, { status: 201 })
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
      
      // Call backend POST /orders/service endpoint directly
      const auth = getAuthorizationHeader(req)
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (auth) {
        headers['Authorization'] = auth
      }
      
      const backendUrl = `${API_CONFIG.BASE_URL}/orders/service`
      const backendRes = await fetch(backendUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      
      if (!backendRes.ok) {
        const errorData = await backendRes.json().catch(() => ({ error: `Backend error: ${backendRes.status}` }))
        return NextResponse.json(
          { error: errorData.error || errorData.message || 'Request failed' },
          { status: backendRes.status || 500 }
        )
      }
      
      const data = await backendRes.json()
      return NextResponse.json(data.data || data, { status: 201 })
    }

    // Staff workflow: Staff confirm order
    if (action === 'staffConfirm') {
      if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
      const idNum = Number(orderId)
      if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const auth = getAuthorizationHeader(req)
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      const response = await apiClient.staffConfirmOrder(idNum, body.staffId, body.note)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      return NextResponse.json(response.data)
    }

    // Staff workflow: Staff reject order
    if (action === 'staffReject') {
      if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
      const idNum = Number(orderId)
      if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const auth = getAuthorizationHeader(req)
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      const response = await apiClient.staffRejectOrder(idNum, body.staffId, body.reason)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      return NextResponse.json(response.data)
    }

    // Complete service
    if (action === 'complete') {
      if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
      const idNum = Number(orderId)
      if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const auth = getAuthorizationHeader(req)
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      const response = await apiClient.post(`/orders/${idNum}/complete`, body, options)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      return NextResponse.json(response.data)
    }

    // Default create order
    const response = await apiClient.post('/orders', body)
    if (!response.success) {
      return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
    }
    return NextResponse.json(response.data, { status: 201 })
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
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      const response = await apiClient.put(`/orders/${idNum}/schedule`, body, options)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      return NextResponse.json(response.data)
    }

    // Update order item (existing)
    const itemId = searchParams.get('itemId')
    if (orderId && itemId) {
      const o = Number(orderId)
      const i = Number(itemId)
      if (Number.isNaN(o) || Number.isNaN(i)) return NextResponse.json({ error: 'Invalid ids' }, { status: 400 })
      const auth = getAuthorizationHeader(req)
      const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
      const response = await apiClient.updateOrderItem(o, i, body.quantity)
      if (!response.success) {
        return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
      }
      return NextResponse.json(response.data)
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
    const auth = getAuthorizationHeader(req)
    const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
    const response = await apiClient.removeOrderItem(o, i)
    if (!response.success) {
      return NextResponse.json({ error: response.error || 'Request failed' }, { status: 500 })
    }
    return NextResponse.json({ message: 'Order item deleted successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}


