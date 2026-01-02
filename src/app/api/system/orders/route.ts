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
      // apiClient chưa có getServiceOrder(), nên gọi trực tiếp endpoint /orders/{id}
      const response = await apiClient.get(`/orders/${idNum}`, options)
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
    // Workaround: Try direct backend call first, then aggregate from all bookings
    const auth = getAuthorizationHeader(req)
    const options: RequestInit = auth ? { headers: { Authorization: auth } } : {}
    
    try {
      // First, try direct backend call (might work for admin)
      const directResponse = await apiClient.get('/orders', options)
      if (directResponse.success && directResponse.data) {
        const directOrders = Array.isArray(directResponse.data)
          ? directResponse.data
          : Array.isArray((directResponse.data as any)?.items)
            ? (directResponse.data as any).items
            : Array.isArray((directResponse.data as any)?.data?.content)
              ? (directResponse.data as any).data.content
              : []
        
        if (directOrders.length > 0) {
          console.log('[API] Got orders from direct backend call:', directOrders.length)
          const statusFilter = searchParams.get('status')
          if (statusFilter) {
            const filterStatusUpper = statusFilter.toUpperCase().replace(/\s+/g, '_')
            const filtered = directOrders.filter((o: any) => {
              const orderStatus = (o.status || '').toUpperCase().replace(/\s+/g, '_')
              if (orderStatus === filterStatusUpper) return true
              if (orderStatus.replace(/_/g, '') === filterStatusUpper.replace(/_/g, '')) return true
              if (filterStatusUpper === 'PENDING' && orderStatus.startsWith('PENDING')) return true
              return false
            })
            return NextResponse.json({ items: filtered, total: filtered.length })
          }
          return NextResponse.json({ items: directOrders, total: directOrders.length })
        }
      }
      
      // Fallback: Aggregate orders from all bookings
      console.log('[API] Direct call failed or empty, aggregating from bookings...')
      const bookingsResponse = await apiClient.getBookings(options)
      console.log('[API] getBookings response:', { 
        success: bookingsResponse.success, 
        hasData: !!bookingsResponse.data,
        dataType: typeof bookingsResponse.data 
      })
      
      if (!bookingsResponse.success || !bookingsResponse.data) {
        console.warn('[API] No bookings found or request failed')
        return NextResponse.json({ items: [], total: 0 })
      }
      
      const bookings = Array.isArray(bookingsResponse.data)
        ? bookingsResponse.data
        : Array.isArray((bookingsResponse.data as any)?.items)
          ? (bookingsResponse.data as any).items
          : Array.isArray((bookingsResponse.data as any)?.data?.content)
            ? (bookingsResponse.data as any).data.content
            : []
      
      console.log('[API] Found bookings:', bookings.length)
      
      if (bookings.length === 0) {
        console.warn('[API] No bookings available')
        return NextResponse.json({ items: [], total: 0 })
      }
      
      // Get orders from each booking
      const allOrders: any[] = []
      const statusFilter = searchParams.get('status')
      
      for (const booking of bookings) {
        const bookingId = booking.id || booking.bookingId
        if (!bookingId) {
          console.warn('[API] Booking missing id:', booking)
          continue
        }
        
        try {
          // Use get() directly with auth header instead of getMyOrders
          // getMyOrders doesn't accept options parameter
          const ordersResponse = await apiClient.get(`/orders/my-orders?bookingId=${bookingId}`, options)
          console.log(`[API] getMyOrders for booking ${bookingId}:`, { 
            success: ordersResponse.success, 
            hasData: !!ordersResponse.data,
            error: ordersResponse.error 
          })
          
          if (ordersResponse.success && ordersResponse.data) {
            const orders = Array.isArray(ordersResponse.data)
              ? ordersResponse.data
              : Array.isArray((ordersResponse.data as any)?.items)
                ? (ordersResponse.data as any).items
                : Array.isArray((ordersResponse.data as any)?.data)
                  ? (ordersResponse.data as any).data
                  : []
            
            console.log(`[API] Found ${orders.length} orders for booking ${bookingId}`)
            
            // Filter by status if provided (normalize status for comparison)
            if (statusFilter) {
              const filterStatusUpper = statusFilter.toUpperCase().replace(/\s+/g, '_')
              const filtered = orders.filter((o: any) => {
                const orderStatus = (o.status || '').toUpperCase().replace(/\s+/g, '_')
                // Exact match
                if (orderStatus === filterStatusUpper) return true
                // Handle variations (PENDING_STAFF_CONFIRMATION vs PENDINGSTAFFCONFIRMATION)
                if (orderStatus.replace(/_/g, '') === filterStatusUpper.replace(/_/g, '')) return true
                // Handle PENDING filter to include PENDING_STAFF_CONFIRMATION
                if (filterStatusUpper === 'PENDING' && orderStatus.startsWith('PENDING')) return true
                return false
              })
              allOrders.push(...filtered)
            } else {
              allOrders.push(...orders)
            }
          }
        } catch (err) {
          // Skip bookings that fail to load orders
          console.warn(`[API] Failed to load orders for booking ${bookingId}:`, err)
        }
      }
      
      console.log('[API] Total orders collected:', allOrders.length)
      
      // Remove duplicates by order id
      const uniqueOrders = Array.from(
        new Map(allOrders.map((o: any) => [o.id, o])).values()
      )
      
      console.log('[API] Unique orders after deduplication:', uniqueOrders.length)
      
      return NextResponse.json({ items: uniqueOrders, total: uniqueOrders.length })
    } catch (error: any) {
      console.error('[API] Error aggregating orders:', error)
      return NextResponse.json({ items: [], total: 0 })
    }
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

    // DEPRECATED: Staff workflow: Create service order
    // This action is no longer used. Frontend now uses POST /orders/{orderId}/confirm directly
    // Keeping for backward compatibility but will return error
    if (action === 'service') {
      return NextResponse.json(
        { error: 'This endpoint is deprecated. Use POST /orders/{orderId}/confirm instead.' },
        { status: 410 }
      )
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


