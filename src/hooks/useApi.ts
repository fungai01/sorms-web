import { useMemo } from 'react'
import useSWR from 'swr'
import { apiClient, ApiResponse } from '@/lib/api-client'
import { authFetch } from '@/lib/http'

// SWR fetcher helpers
const jsonFetcher = async <T = any>(endpoint: string): Promise<T> => {
  const res = await authFetch(endpoint, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || res.statusText)
  }
  return res.json().catch(() => ({} as T))
}

const listFetcher = async <T = any>(endpoint: string): Promise<T[]> => {
  const data: any = await jsonFetcher(endpoint)
  const items: T[] = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data?.content)
      ? data.data.content
      : Array.isArray(data?.content)
        ? data.content
        : Array.isArray(data)
          ? data
          : []
  return items
}

type UseApiState<T> = {
  data: T | null
  loading: boolean
  error: string | null
  mutate: (data?: T | Promise<T> | ((prev: T | null) => T | null), shouldRevalidate?: boolean) => Promise<T | undefined>
  refetch: () => Promise<T | undefined>
}

// SWR-wrapped list hook
function useList<T = any>(key: string | null, refreshInterval?: number): UseApiState<T[]> {
  const { data, error, isLoading, mutate } = useSWR<T[]>(key, listFetcher, {
    refreshInterval,
    dedupingInterval: 5000,
  })

  return {
    data: (data || null) as T[] | null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    mutate: mutate as any,
    refetch: () => mutate()
  }
}

// SWR-wrapped single resource hook (JSON)
function useJson<T = any>(key: string | null, refreshInterval?: number): UseApiState<T> {
  const { data, error, isLoading, mutate } = useSWR<T>(key, jsonFetcher, {
    refreshInterval,
    dedupingInterval: 5000,
  })
  return {
    data: (data ?? null) as T | null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    mutate: mutate as any,
    refetch: () => mutate()
  }
}

// Supported hooks tied to real APIs only - using Next.js API routes as proxy
export function useRooms() {
  return useList('/api/system/rooms')
}

// Fetch rooms with backend-side filters (status, roomTypeId)
export function useRoomsFiltered(status?: string, roomTypeId?: number, startTime?: string, endTime?: string) {
  const params = new URLSearchParams()
  if (status && status !== 'ALL') params.set('status', status)
  if (roomTypeId) params.set('roomTypeId', String(roomTypeId))
  if (startTime) params.set('startTime', startTime)
  if (endTime) params.set('endTime', endTime)
  const endpoint = `/api/system/rooms${params.toString() ? `?${params.toString()}` : ''}`
  return useList(endpoint)
}

export function useAvailableRooms(startTime?: string, endTime?: string) {
  const params = new URLSearchParams()
  params.set('status', 'AVAILABLE')
  if (startTime) params.set('startTime', startTime)
  if (endTime) params.set('endTime', endTime)
  const endpoint = `/api/system/rooms?${params.toString()}`
  return useList(endpoint)
}

export function useRoomTypes() {
  return useList('/api/system/room-types')
}

// Booking hooks
// Optional status param để khi filter trạng thái trên UI có thể gửi thẳng lên API
export function useBookings(status?: string) {
  const endpoint =
    status && status !== 'ALL'
      ? `/api/system/bookings?status=${encodeURIComponent(status)}`
      : '/api/system/bookings'
  return useList(endpoint)
}

// Dành riêng cho dashboard user: lấy toàn bộ bookings để tính toán phòng trống
export function useAllBookings() {
  return useJson('/api/system/bookings')
}

export function useUserBookings() {
  // Use system bookings endpoint with user context
  return useJson('/api/system/bookings')
}

export function useServices(params?: { q?: string; sortBy?: string; sortOrder?: string; isActive?: boolean; page?: number; size?: number }) {
  const queryParams = new URLSearchParams()
  if (params?.q) queryParams.set('q', params.q)
  if (params?.sortBy) queryParams.set('sortBy', params.sortBy)
  if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder)
  if (params?.isActive !== undefined) queryParams.set('isActive', params.isActive.toString())
  if (params?.page !== undefined) queryParams.set('page', String(params.page))
  if (params?.size !== undefined) queryParams.set('size', String(params.size))
  const endpoint = `/api/system/services${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
  return useList(endpoint)
}

export function useServiceOrders(status?: string) {
  // Backend doesn't have direct GET /orders endpoint
  // Use Next.js API route which proxies to backend
  const endpoint = status && status !== 'ALL'
    ? `/api/system/orders?status=${encodeURIComponent(status)}`
    : '/api/system/orders'
  return useList(endpoint)
}

export function useServiceOrdersByBooking(bookingId: number) {
  const endpoint = `/api/system/orders?my=true&bookingId=${bookingId}`
  return useList(endpoint)
}

// User service orders - get all orders for current user
export function useMyServiceOrders(bookingId?: number) {
  const endpoint = bookingId 
    ? `/api/system/orders?my=true&bookingId=${bookingId}`
    : `/api/system/orders?my=true`
  return useList(endpoint)
}

// Single service order detail
export function useServiceOrder(orderId: number) {
  return useJson(`/api/system/orders/${orderId}`)
}

export function useStaffUsers() {
  return useList('/api/user/staff')
}

// Dashboard stats derived from real endpoints
export function useDashboardStats() {
  return useJson('/api/system/dashboard')
}

export function useOccupancyStats() {
  return useJson('/api/system/dashboard/occupancy')
}

export function useBookingStats() {
  return useJson('/api/system/dashboard/bookings')
}

export function usePaymentStats() {
  return useJson('/api/system/dashboard/payments')
}

// Staff profiles
export function useStaffProfiles() {
  return useList('/api/system/staff-profiles')
}

export function useStaffProfilesFiltered(status?: string, department?: string) {
  // Prefer normalized API from apiClient, with optional filters
  const key = useMemo(() => {
    const q = new URLSearchParams()
    if (status && status !== 'ALL') q.set('status', status)
    if (department && department !== 'ALL') q.set('department', department)
    const qs = q.toString()
    return `/api/system/staff-profiles${qs ? `?${qs}` : ''}`
  }, [status, department])
  return useList(key)
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
  return useJson(endpoint, 30000)
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
  return useList(endpoint, 30000)
}

// Roles management
export function useRoles(params?: { q?: string; page?: number; size?: number }) {
  const query = new URLSearchParams()
  if (params?.q) query.set('q', params.q)
  if (params?.page !== undefined) query.set('page', String(params.page))
  if (params?.size !== undefined) query.set('size', String(params.size))
  const endpoint = `/api/system/roles${query.toString() ? `?${query.toString()}` : ''}`
  return useList(endpoint)
}

// Payments - use backend API via apiClient (normalized)
export function usePayments() {
  return useList('/api/system/payments')
}

// Current user info (self)
export function useSelfUser() {
  return useJson('/api/system/users?self=1')
}
