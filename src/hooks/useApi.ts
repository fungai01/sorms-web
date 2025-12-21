import { useState, useEffect, useCallback, useRef } from 'react'
import { apiClient, ApiResponse } from '@/lib/api-client'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useApi<T>(
  apiCall: () => Promise<ApiResponse<T>>,
  dependencies: any[] = []
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Use useRef to store the latest apiCall function to avoid recreating fetchData
  const apiCallRef = useRef(apiCall)
  useEffect(() => {
    apiCallRef.current = apiCall
  })

  // Memoize dependencies string to detect actual changes
  const depsString = JSON.stringify(dependencies)
  const prevDepsRef = useRef<string>('')
  
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiCallRef.current()
      
      if (response.success) {
        setData(response.data || null)
      } else {
        const errorMessage =
          typeof response.error === 'string' && response.error.trim()
            ? response.error.trim()
            : ''
        setError(errorMessage)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ''
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, []) // Empty deps - fetchData never changes

  useEffect(() => {
    // Always fetch on initial mount (when prevDepsRef is empty)
    if (prevDepsRef.current === '') {
      prevDepsRef.current = depsString
      fetchData()
      return
    }
    
    // Only fetch if dependencies actually changed
    if (prevDepsRef.current !== depsString) {
      prevDepsRef.current = depsString
      fetchData()
    }
  }, [depsString, fetchData])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  }
}

// Helper function to call Next.js API routes (proxy to backend)
async function fetchFromProxy<T>(endpoint: string): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }

    // Use authFetch to automatically attach Authorization from cookies/localStorage
    const res = await (await import('@/lib/http')).authFetch(endpoint, {
      headers,
      credentials: 'include'
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: '' }))
      return {
        success: false,
        error: errorData.error || ''
      }
    }

    const data = await res.json()
    return {
      success: true,
      data
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : ''
    }
  }
}

// Normalize list results to always return an array
async function fetchList<T = any>(endpoint: string): Promise<ApiResponse<T[]>> {
  const res = await fetchFromProxy<any>(endpoint)
  if (!res.success) return { success: false, error: res.error || '' }
  const d = res.data
  const items: T[] = Array.isArray(d?.items)
    ? d.items
    : Array.isArray(d?.data?.content)
      ? d.data.content
      : Array.isArray(d?.content)
        ? d.content
        : Array.isArray(d)
          ? d
          : []
  return { success: true, data: items }
}

// Supported hooks tied to real APIs only - using Next.js API routes as proxy
export function useRooms() {
  return useApi(() => fetchList('/api/system/rooms'))
}

// Fetch rooms with backend-side filters (status, roomTypeId)
export function useRoomsFiltered(status?: string, roomTypeId?: number, startTime?: string, endTime?: string) {
  const params = new URLSearchParams()
  if (status && status !== 'ALL') params.set('status', status)
  if (roomTypeId) params.set('roomTypeId', String(roomTypeId))
  if (startTime) params.set('startTime', startTime)
  if (endTime) params.set('endTime', endTime)
  const endpoint = `/api/system/rooms${params.toString() ? `?${params.toString()}` : ''}`
  // Always normalize list responses to an array so UI can render immediately on first load
  return useApi(() => fetchList(endpoint), [endpoint])
}

export function useAvailableRooms(startTime?: string, endTime?: string) {
  const params = new URLSearchParams()
  params.set('status', 'AVAILABLE')
  if (startTime) params.set('startTime', startTime)
  if (endTime) params.set('endTime', endTime)
  const endpoint = `/api/system/rooms?${params.toString()}`
  return useApi(() => fetchFromProxy(endpoint), [endpoint])
}

export function useRoomTypes() {
  return useApi(() => fetchList('/api/system/room-types'))
}

// Booking hooks
// Optional status param để khi filter trạng thái trên UI có thể gửi thẳng lên API
export function useBookings(status?: string) {
  const endpoint =
    status && status !== 'ALL'
      ? `/api/system/bookings?status=${encodeURIComponent(status)}`
      : '/api/system/bookings'

  // Use fetchList to normalize response to array format (same as useRoomsFiltered)
  return useApi(() => fetchList(endpoint), [endpoint])
}

// Dành riêng cho dashboard user: lấy toàn bộ bookings để tính toán phòng trống
export function useAllBookings() {
  return useApi(() => fetchFromProxy('/api/system/bookings'))
}

export function useUserBookings() {
  // Use system bookings endpoint with user context
  return useApi(() => fetchFromProxy('/api/system/bookings'))
}

export function useServices(params?: { q?: string; sortBy?: string; sortOrder?: string; isActive?: boolean }) {
  const queryParams = new URLSearchParams()
  if (params?.q) queryParams.set('q', params.q)
  if (params?.sortBy) queryParams.set('sortBy', params.sortBy)
  if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder)
  if (params?.isActive !== undefined) queryParams.set('isActive', params.isActive.toString())
  const endpoint = `/api/system/services${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
  return useApi(() => fetchList(endpoint), [endpoint])
}

export function useServiceOrders(status?: string) {
  // Backend doesn't have direct GET /orders endpoint
  // Use Next.js API route which proxies to backend
  const endpoint = status && status !== 'ALL'
    ? `/api/system/orders?status=${encodeURIComponent(status)}`
    : '/api/system/orders'
  return useApi(() => fetchList(endpoint), [endpoint])
}

export function useServiceOrdersByBooking(bookingId: number) {
  const endpoint = `/api/system/orders?my=true&bookingId=${bookingId}`
  return useApi(() => fetchList(endpoint), [bookingId])
}

// User service orders - get all orders for current user
export function useMyServiceOrders(bookingId?: number) {
  const endpoint = bookingId 
    ? `/api/system/orders?my=true&bookingId=${bookingId}`
    : `/api/system/orders?my=true`
  return useApi(() => fetchList(endpoint), [endpoint])
}

// Single service order detail
export function useServiceOrder(orderId: number) {
  return useApi(() => apiClient.getServiceOrder(orderId), [orderId])
}

export function useStaffUsers() {
  return useApi(() => fetchList('/api/user/staff'))
}

// Dashboard stats derived from real endpoints
export function useDashboardStats() {
  return useApi(() => apiClient.getDashboardStats())
}

export function useOccupancyStats() {
  return useApi(() => apiClient.getOccupancyStats())
}

export function useBookingStats() {
  return useApi(() => apiClient.getBookingStats())
}

export function usePaymentStats() {
  return useApi(() => apiClient.getPaymentStats())
}

// Staff profiles
export function useStaffProfiles() {
  return useApi(() => apiClient.getStaffProfiles())
}

export function useStaffProfilesFiltered(status?: string, department?: string) {
  // Prefer normalized API from apiClient, with optional filters
  return useApi(() => {
    if (status && status !== 'ALL') {
      return apiClient.getStaffProfilesByStatus(status)
    }
    if (department && department !== 'ALL') {
      return apiClient.getStaffProfilesByDepartment(department)
    }
    return apiClient.getStaffProfiles()
  }, [status, department])
}

// Users management - filters are forwarded to backend via Next.js API route
export function useUsers(params?: { role?: string; status?: string; page?: number; size?: number; keyword?: string }) {
  const query = new URLSearchParams()
  if (params?.role) query.set('role', params.role)
  if (params?.status && params.status !== 'ALL') query.set('status', params.status)
  if (params?.page !== undefined) query.set('page', String(params.page))
  if (params?.size !== undefined) query.set('size', String(params.size))
  if (params?.keyword) query.set('q', params.keyword)
  const endpoint = `/api/system/users${query.toString() ? `?${query.toString()}` : ''}`
  return useApi(() => fetchFromProxy(endpoint), [endpoint])
}

// Staff tasks
export function useStaffTasks(params?: { 
  status?: string
  assignedTo?: number
  relatedType?: string
  relatedId?: number
}) {
  const queryParams = new URLSearchParams()
  if (params?.status && params.status !== 'ALL') queryParams.set('status', params.status)
  if (params?.assignedTo) queryParams.set('assignedTo', String(params.assignedTo))
  if (params?.relatedType && params?.relatedId) {
    queryParams.set('relatedType', params.relatedType)
    queryParams.set('relatedId', String(params.relatedId))
  }
  const endpoint = `/api/system/tasks${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
  return useApi(() => fetchList(endpoint), [endpoint])
}

// Roles management
export function useRoles(params?: { q?: string; page?: number; size?: number }) {
  const query = new URLSearchParams()
  if (params?.q) query.set('q', params.q)
  if (params?.page !== undefined) query.set('page', String(params.page))
  if (params?.size !== undefined) query.set('size', String(params.size))
  const endpoint = `/api/system/roles${query.toString() ? `?${query.toString()}` : ''}`
  return useApi(() => fetchFromProxy(endpoint), [endpoint])
}

// Payments - use backend API via apiClient (normalized)
export function usePayments() {
  return useApi(() => apiClient.getPaymentTransactions())
}
