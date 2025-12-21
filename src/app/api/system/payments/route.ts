import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/config'

const BASE = API_CONFIG.BASE_URL

type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED'
type Payment = {
  id: number
  code: string
  order_code?: string
  payer_name: string
  method: 'Tiền Mặt' | 'Chuyển Khoản'
  amount: number
  created_at: string
  status: PaymentStatus
  note?: string
}

let payments: Payment[] = []
const nextId = () => (payments.length ? Math.max(...payments.map((p) => p.id)) + 1 : 1)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const transactionId = searchParams.get('transactionId')
    const action = searchParams.get('action')

    // Get payment stats
    if (action === 'stats') {
      const auth = req.headers.get('authorization') || ''
      const accessCookie = req.cookies.get('access_token')?.value
      const authAccessCookie = req.cookies.get('auth_access_token')?.value
      const userInfoCookie = req.cookies.get('user_info')?.value
      let cookieToken: string | undefined
      if (accessCookie) cookieToken = accessCookie
      else if (authAccessCookie) cookieToken = authAccessCookie
      else if (userInfoCookie) {
        try {
          const parsed = JSON.parse(decodeURIComponent(userInfoCookie))
          if (parsed?.token) cookieToken = parsed.token
        } catch {}
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json', accept: '*/*' }
      if (auth) headers['Authorization'] = auth
      else if (cookieToken) headers['Authorization'] = `Bearer ${cookieToken}`

      // Get all payments from backend
      try {
        const res = await fetch(`${BASE}/payments`, {
          headers,
        })
        const data = await res.json().catch(() => ({}))
        
        if (!res.ok) {
          return NextResponse.json(
            { 
              count: 0, 
              sum: 0, 
              series: [],
              error: data?.message || `Backend error: ${res.status}` 
            },
            { status: 500 }
          )
        }

        const paymentsList = Array.isArray(data?.data) ? data.data : Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : []
        
        // Calculate stats
        const count = paymentsList.length
        const sum = paymentsList.reduce((total: number, p: any) => {
          const amount = typeof p.amount === 'number' ? p.amount : (typeof p.totalAmount === 'number' ? p.totalAmount : 0)
          return total + (amount || 0)
        }, 0)

        // Generate time series (last 14 days)
        const today = new Date()
        const series = []
        for (let i = 13; i >= 0; i--) {
          const date = new Date(today)
          date.setDate(today.getDate() - i)
          const dateStr = date.toISOString().slice(0, 10)
          
          // Count payments for this date
          const dayPayments = paymentsList.filter((p: any) => {
            const paymentDate = p.createdAt || p.created_at || p.createdDate || ''
            return paymentDate && paymentDate.slice(0, 10) === dateStr
          })
          
          const daySum = dayPayments.reduce((total: number, p: any) => {
            const amount = typeof p.amount === 'number' ? p.amount : (typeof p.totalAmount === 'number' ? p.totalAmount : 0)
            return total + (amount || 0)
          }, 0)
          
          series.push({ 
            date: dateStr, 
            count: dayPayments.length,
            sum: daySum
          })
        }

        return NextResponse.json({
          count,
          sum,
          series
        })
      } catch (error: any) {
        console.error('Error fetching payment stats:', error)
        return NextResponse.json(
          { 
            count: 0, 
            sum: 0, 
            series: [],
            error: error?.message || 'Failed to fetch payment stats'
          },
          { status: 500 }
        )
      }
    }

    if (transactionId) {
      const auth = req.headers.get('authorization') || ''
      const res = await fetch(`${BASE}/payments/${transactionId}`, {
        headers: { 'Content-Type': 'application/json', accept: '*/*', ...(auth ? { Authorization: auth } : {}) },
      })
      const data = await res.json().catch(() => ({}))
      return res.ok
        ? NextResponse.json(data.data ?? data)
        : NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    }

    // Get all payments from backend
    const auth = req.headers.get('authorization') || ''
    const accessCookie = req.cookies.get('access_token')?.value
    const authAccessCookie = req.cookies.get('auth_access_token')?.value
    const userInfoCookie = req.cookies.get('user_info')?.value
    let cookieToken: string | undefined
    if (accessCookie) cookieToken = accessCookie
    else if (authAccessCookie) cookieToken = authAccessCookie
    else if (userInfoCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(userInfoCookie))
        if (parsed?.token) cookieToken = parsed.token
      } catch {}
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json', accept: '*/*' }
    if (auth) headers['Authorization'] = auth
    else if (cookieToken) headers['Authorization'] = `Bearer ${cookieToken}`

    try {
      const res = await fetch(`${BASE}/payments`, {
        headers,
      })
      const data = await res.json().catch(() => ({}))
      
      if (!res.ok) {
        // Fallback to local storage if backend fails
        const q = searchParams.get('q')?.toLowerCase() || ''
        const status = searchParams.get('status') as PaymentStatus | null
        let list = payments
        if (q) {
          list = list.filter(
            (p) =>
              p.code.toLowerCase().includes(q) ||
              (p.order_code || '').toLowerCase().includes(q) ||
              p.payer_name.toLowerCase().includes(q)
          )
        }
        if (status && ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'].includes(status)) {
          list = list.filter((p) => p.status === status)
        }
        return NextResponse.json({ items: list, total: list.length })
      }

      const paymentsList = Array.isArray(data?.data) ? data.data : Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : []
      
      // Apply filters
      const q = searchParams.get('q')?.toLowerCase() || ''
      const status = searchParams.get('status') as PaymentStatus | null
      let filteredList = paymentsList
      
      if (q) {
        filteredList = filteredList.filter(
          (p: any) =>
            (p.code || '').toLowerCase().includes(q) ||
            (p.orderCode || p.order_code || '').toLowerCase().includes(q) ||
            (p.payerName || p.payer_name || '').toLowerCase().includes(q)
        )
      }
      if (status && ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PAID', 'CANCELLED'].includes(status)) {
        filteredList = filteredList.filter((p: any) => {
          const pStatus = (p.status || '').toUpperCase()
          return pStatus === status.toUpperCase() || 
                 (status === 'SUCCESS' && pStatus === 'PAID') ||
                 (status === 'FAILED' && pStatus === 'CANCELLED')
        })
      }

      return NextResponse.json(
        { items: filteredList, total: filteredList.length },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          },
        }
      )
    } catch (error: any) {
      // Fallback to local storage
      const q = searchParams.get('q')?.toLowerCase() || ''
      const status = searchParams.get('status') as PaymentStatus | null
      let list = payments
      if (q) {
        list = list.filter(
          (p) =>
            p.code.toLowerCase().includes(q) ||
            (p.order_code || '').toLowerCase().includes(q) ||
            p.payer_name.toLowerCase().includes(q)
        )
      }
      if (status && ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'].includes(status)) {
        list = list.filter((p) => p.status === status)
      }
      return NextResponse.json({ items: list, total: list.length })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    if (action === 'create' || action === 'webhook') {
      const body = await req.json().catch(() => ({}))
      const endpoint = action === 'create' ? `${BASE}/payments/create` : `${BASE}/payments/webhook`
      const authHeader = req.headers.get('authorization') || ''
      const accessCookie = req.cookies.get('access_token')?.value
      const authAccessCookie = req.cookies.get('auth_access_token')?.value
      const userInfoCookie = req.cookies.get('user_info')?.value
      let cookieToken: string | undefined
      if (accessCookie) cookieToken = accessCookie
      else if (authAccessCookie) cookieToken = authAccessCookie
      else if (userInfoCookie) {
        try {
          const parsed = JSON.parse(decodeURIComponent(userInfoCookie))
          if (parsed?.token) cookieToken = parsed.token
        } catch {}
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json', accept: '*/*' }
      if (authHeader) headers['Authorization'] = authHeader
      else if (cookieToken) headers['Authorization'] = `Bearer ${cookieToken}`

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      return res.ok
        ? NextResponse.json(data.data ?? data, { status: action === 'create' ? 201 : 200 })
        : NextResponse.json({ error: data?.message || `Backend error: ${res.status}` }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const item: Payment = {
      id: nextId(),
      code: String(body.code || `PM-${Date.now()}`),
      order_code: body.order_code || undefined,
      payer_name: String(body.payer_name || ''),
      method: body.method === 'Chuyển Khoản' ? 'Chuyển Khoản' : 'Tiền Mặt',
      amount: Number(body.amount || 0),
      created_at: String(body.created_at || new Date().toISOString().slice(0, 16)),
      status: (['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'] as PaymentStatus[]).includes(body.status)
        ? body.status
        : 'PENDING',
      note: body.note || undefined,
    }

    if (!item.payer_name.trim() || !item.code.trim()) {
      return NextResponse.json({ error: 'Missing code or payer_name' }, { status: 400 })
    }

    payments.push(item)
    return NextResponse.json(item, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const id = Number(body.id)
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const idx = payments.findIndex((p) => p.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const prev = payments[idx]
    const updated: Payment = {
      ...prev,
      code: body.code ?? prev.code,
      order_code: body.order_code ?? prev.order_code,
      payer_name: body.payer_name ?? prev.payer_name,
      method: body.method === 'Chuyển Khoản' || body.method === 'Tiền Mặt' ? body.method : prev.method,
      amount: body.amount !== undefined ? Number(body.amount) : prev.amount,
      created_at: body.created_at ?? prev.created_at,
      status: (['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'] as PaymentStatus[]).includes(body.status)
        ? body.status
        : prev.status,
      note: body.note ?? prev.note,
    }
    payments[idx] = updated
    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const idParam = req.nextUrl.searchParams.get('id')
    const id = idParam ? Number(idParam) : 0
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const idx = payments.findIndex((p) => p.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    payments.splice(idx, 1)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
