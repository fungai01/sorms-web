import { useState, useEffect, useCallback } from 'react'
import { apiClient, ApiResponse } from '@/lib/api-client'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// Helper function để serialize error values an toàn
function serializeErrorValue(value: any): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value || '(empty string)'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  
  // Xử lý objects và arrays
  try {
    const serialized = JSON.stringify(value, null, 2)
    return serialized || '(empty object)'
  } catch (e) {
    // Tránh circular references
    try {
      return String(value)
    } catch {
      return '[Unable to serialize error value]'
    }
  }
}

// Helper function để xác định endpoint name
function getEndpointName(apiCall: () => Promise<any>): string {
  // Thử lấy function name trước
  if (apiCall.name && apiCall.name !== '') {
    return apiCall.name
  }
  
  // Thử lấy thông tin từ function string representation
  const funcString = apiCall.toString()
  if (funcString.includes('apiClient.')) {
    const match = funcString.match(/apiClient\.(\w+)/)
    if (match && match[1]) {
      return match[1]
    }
  }
  
  return 'unknown-endpoint'
}

export function useApi<T>(
  apiCall: () => Promise<ApiResponse<T>>,
  dependencies: any[] = []
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiCall()
      
      if (response.success) {
        setData(response.data || null)
      } else {
        // Better error handling with more context
        let errorMessage = 'API call failed'
        
        if (response.error) {
          if (typeof response.error === 'string') {
            errorMessage = response.error.trim() || 'API call failed'
          } else if (typeof response.error === 'object' && response.error !== null) {
            // Handle object errors
            const errorObj = response.error as any
            if (errorObj.message) {
              errorMessage = String(errorObj.message).trim() || 'API call failed'
            } else if (errorObj.error) {
              errorMessage = String(errorObj.error).trim() || 'API call failed'
            } else {
              // Try to stringify the object
              try {
                const serialized = JSON.stringify(response.error)
                errorMessage = serialized || 'API call failed'
              } catch {
                errorMessage = 'Unknown error object'
              }
            }
          }
        }
        
        // Đảm bảo errorMessage không bao giờ rỗng
        if (!errorMessage || errorMessage.trim() === '') {
          errorMessage = 'API call failed'
        }
        
        // Tạo error object với tất cả properties có giá trị hợp lệ
        const endpointName = getEndpointName(apiCall)
        const serializedOriginalError = response.error ? serializeErrorValue(response.error) : 'none'
        
        console.error('API Error:', {
          message: errorMessage,
          originalError: serializedOriginalError,
          timestamp: new Date().toISOString(),
          endpoint: endpointName
        })
        setError(errorMessage)
      }
    } catch (err) {
      // This should rarely happen now since we handle errors in apiClient
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      console.error('Unexpected API Error:', {
        message: errorMessage,
        error: serializeErrorValue(err),
        timestamp: new Date().toISOString(),
        endpoint: getEndpointName(apiCall)
      })
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, dependencies)

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
    const res = await fetch(endpoint, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Request failed' }))
      return {
        success: false,
        error: errorData.error || `HTTP ${res.status}`
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
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Supported hooks tied to real APIs only - using Next.js API routes as proxy
export function useRooms() {
  return useApi(() => fetchFromProxy('/api/system/rooms'))
}

export function useRoomTypes() {
  return useApi(() => fetchFromProxy('/api/system/room-types'))
}

export function useBookings() {
  return useApi(() => fetchFromProxy('/api/system/bookings'))
}

export function useServices() {
  return useApi(() => fetchFromProxy('/api/system/services'))
}

export function useServiceOrders() {
  return useApi(() => fetchFromProxy('/api/system/orders'))
}

export function useStaffUsers() {
  return useApi(() => fetchFromProxy('/api/system/users'))
}

export function useCheckins() {
  return useApi(() => fetchFromProxy('/api/system/checkins'))
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