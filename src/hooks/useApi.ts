import { useState, useEffect, useCallback } from 'react'
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
            errorMessage = response.error
          } else if (typeof response.error === 'object' && response.error !== null) {
            // Handle object errors
            const errorObj = response.error as any
            if (errorObj.message) {
              errorMessage = String(errorObj.message)
            } else if (errorObj.error) {
              errorMessage = String(errorObj.error)
            } else {
              // Try to stringify the object
              try {
                errorMessage = JSON.stringify(response.error)
              } catch {
                errorMessage = 'Unknown error object'
              }
            }
          }
        }
        
        console.error('API Error:', {
          message: errorMessage,
          originalError: response.error,
          timestamp: new Date().toISOString(),
          endpoint: apiCall.name || 'unknown'
        })
        setError(errorMessage)
      }
    } catch (err) {
      // This should rarely happen now since we handle errors in apiClient
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      console.error('Unexpected API Error:', errorMessage)
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

// Supported hooks tied to real APIs only
export function useRooms() {
  return useApi(() => apiClient.getRooms())
}

export function useRoomTypes() {
  return useApi(() => apiClient.getRoomTypes())
}

export function useBookings() {
  return useApi(() => apiClient.getBookings())
}

export function useServices() {
  return useApi(() => apiClient.getServices())
}

export function useCheckins() {
  return useApi(() => apiClient.getCheckins())
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