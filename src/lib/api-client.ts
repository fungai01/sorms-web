// API Client for connecting to backend
import { API_CONFIG } from './config'
import { authService } from './auth-service'
import { authFetch } from './http'
import { generateBookingCode, getErrorMessage } from './utils'

const API_BASE_URL = API_CONFIG.BASE_URL

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

class ApiClient {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      // Normalize URL to avoid double slashes
      const baseURLWithoutTrailingSlash = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL
      const endpointWithLeadingSlash = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
      const url = `${baseURLWithoutTrailingSlash}${endpointWithLeadingSlash}`
      
      // Validate URL scheme (must be http or https for CORS)
      try {
        const urlObj = new URL(url)
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          return {
            success: false,
            error: `URL scheme không hợp lệ: ${urlObj.protocol}. Chỉ hỗ trợ http:// hoặc https://`
          }
        }
      } catch (urlError) {
        return {
          success: false,
          error: `URL không hợp lệ: ${url}. Vui lòng kiểm tra cấu hình API_BASE_URL.`
        }
      }

      // Extract headers from options first (priority)
      const incomingHeaders = options.headers as Record<string, string> | Headers | undefined
      let authHeaderFromOptions: string | null = null
      
      if (incomingHeaders) {
        if (incomingHeaders instanceof Headers) {
          // Headers instance - check both lowercase and capitalized
          authHeaderFromOptions = incomingHeaders.get('authorization') || 
                                  incomingHeaders.get('Authorization') ||
                                  incomingHeaders.get('AUTHORIZATION') ||
                                  null
        } else if (typeof incomingHeaders === 'object') {
          // Record<string, string> - check all possible key variations
          authHeaderFromOptions = incomingHeaders['authorization'] || 
                                  incomingHeaders['Authorization'] || 
                                  incomingHeaders['AUTHORIZATION'] ||
                                  null
        }
      }
      
      // Thêm Authorization header nếu có token
      // Priority: options.headers > accountInfo > authService > cookies
      let token: string | null = null
      
      // 1. First priority: Use token from options.headers (from Next.js API route)
      if (authHeaderFromOptions && authHeaderFromOptions.startsWith('Bearer ')) {
        token = authHeaderFromOptions.substring(7)
        console.log('[API Client] Token extracted from incoming request headers (options)')
      } else {
        // 2. Second priority: Get token from accountInfo (userInfo)
        try {
          const userInfo = authService.getUserInfo()
          if (userInfo && (userInfo as any).token) {
            token = (userInfo as any).token
            console.log('[API Client] Token from accountInfo (userInfo)')
          }
        } catch {}
        
        // 3. Third priority: Get token from authService (client-side)
        if (!token) {
          token = authService.getAccessToken()
          if (token) {
            console.log('[API Client] Token from authService')
          }
        }
        
        // 4. Fourth priority: Try get token from server cookies (Next.js API route fallback)
        if (!token) {
          try {
            const mod: any = await import('next/headers')
            if (typeof mod.cookies === 'function') {
              const maybePromise = mod.cookies()
              const cookieStore =
                typeof maybePromise?.then === 'function' ? await maybePromise : maybePromise
              
              // Try multiple cookie names for compatibility
              const cookieToken = cookieStore?.get?.('access_token')?.value || 
                                 cookieStore?.get?.('auth_access_token')?.value
              
              if (cookieToken) {
                token = cookieToken
                console.log('[API Client] Token found in server cookies')
              }
            }
          } catch (e) {
            // ignore (client-side or not in Next.js environment)
          }
        }
      }
      
      // List of public endpoints that don't require authentication
      const publicEndpoints = [
        '/auth/outbound/authentication',
        '/auth/mobile/outbound/authentication',
        '/auth/login',
        '/auth/refresh',
      ]
      
      const isPublicEndpoint = publicEndpoints.some(publicPath => endpoint.includes(publicPath))
      
      if (!token && !isPublicEndpoint) {
        console.warn('[API Client] ⚠️ No access token available for request:', endpoint)
      } else if (isPublicEndpoint) {
        console.log('[API Client] Public endpoint, skipping token check:', endpoint)
      }
      
      // Merge headers: options.headers first, then add Authorization if we have token
      // RequestInit.headers can be Headers, Record<string, string>, or string[][]
      let mergedHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      
      // Merge headers from options
      if (options.headers) {
        if (options.headers instanceof Headers) {
          mergedHeaders = { ...mergedHeaders, ...Object.fromEntries(options.headers.entries()) }
        } else if (Array.isArray(options.headers)) {
          // Handle string[][] format
          mergedHeaders = { ...mergedHeaders, ...Object.fromEntries(options.headers) }
        } else if (typeof options.headers === 'object') {
          // Handle Record<string, string>
          mergedHeaders = { ...mergedHeaders, ...(options.headers as Record<string, string>) }
        }
      }
      
      // Add Authorization header if we have token (will overwrite if already exists from options)
      if (token) {
        mergedHeaders['Authorization'] = `Bearer ${token}`
      }
      
      const headers = mergedHeaders

      // Log request details for debugging
      let bodyContent = null
      if (options.body && typeof options.body === 'string') {
        try {
          bodyContent = JSON.parse(options.body)
        } catch {
          bodyContent = options.body.substring(0, 200)
        }
      }
      
      console.log(`[API Client] 🚀 Request:`, {
        url,
        method: options.method || 'GET',
        baseURL: this.baseURL,
        endpoint,
        hasBody: !!options.body,
        body: bodyContent,
        headers: Object.keys(headers),
        hasAuthorization: !!headers['Authorization'],
        authorizationPrefix: headers['Authorization']?.substring(0, 30) || 'none',
        authorizationLength: headers['Authorization']?.length || 0,
        tokenSource: token ? (authHeaderFromOptions ? 'options.headers' : (authService.getAccessToken() ? 'authService' : 'cookies')) : 'none',
        tokenLength: token?.length || 0,
        timestamp: new Date().toISOString()
      })

      // Merge options carefully: headers should come from our merged headers, not from options
      // Create new options object without headers property to avoid overwriting
      const restOptions: RequestInit = {}
      if (options.method) restOptions.method = options.method
      if (options.body) restOptions.body = options.body
      if (options.signal) restOptions.signal = options.signal
      if (options.cache) restOptions.cache = options.cache
      if (options.credentials) restOptions.credentials = options.credentials
      if (options.mode) restOptions.mode = options.mode
      if (options.redirect) restOptions.redirect = options.redirect
      if (options.referrer) restOptions.referrer = options.referrer
      if (options.referrerPolicy) restOptions.referrerPolicy = options.referrerPolicy
      if (options.integrity) restOptions.integrity = options.integrity
      if (options.keepalive !== undefined) restOptions.keepalive = options.keepalive
      
      // Pass headers as Record<string, string> to authFetch
      // authFetch will convert to Headers instance properly
      const response = await authFetch(url, {
        ...restOptions,
        headers: headers, // Pass as Record<string, string>
      })

      // Log response details for debugging
      console.log(`[API Client] ${endpoint} - Response status:`, response.status, response.statusText)
      console.log(`[API Client] ${endpoint} - Response headers:`, {
        contentType: response.headers.get('content-type'),
        hasBody: response.body !== null
      })
      
      if (!response.ok) {
        // Try to get error message from response body
        let errorMessage = `HTTP error! status: ${response.status}`
        let errorData: any = null
        let rawResponseText: string = ''
        try {
          // Clone response để có thể đọc text nhiều lần
          const responseClone = response.clone()
          rawResponseText = await responseClone.text()
          console.log(`[API Client] ${endpoint} - Error response status: ${response.status} ${response.statusText}`)
          console.log(`[API Client] ${endpoint} - Error response text (full):`, rawResponseText)
          console.log(`[API Client] ${endpoint} - Error response headers:`, {
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length')
          })
          try {
            errorData = JSON.parse(rawResponseText)
            console.log(`[API Client] ${endpoint} - Error response body (parsed):`, JSON.stringify(errorData, null, 2))
          } catch (parseErr) {
            console.log(`[API Client] ${endpoint} - Error response is not JSON, raw text:`, rawResponseText)
            errorMessage = rawResponseText || errorMessage
          }
          
          // Try to map error code if present
          if (errorData) {
            console.log(`[API Client] ${endpoint} - Error data structure:`, {
              hasResponseCode: !!errorData.responseCode,
              responseCode: errorData.responseCode,
              hasMessage: !!errorData.message,
              message: errorData.message,
              hasError: !!errorData.error,
              error: errorData.error,
              keys: Object.keys(errorData)
            })
            
            if (errorData.responseCode) {
              const mappedMessage = getErrorMessage(
                String(errorData.responseCode),
                errorData.message || errorData.error || ''
              )
              console.log(`[API Client] ${endpoint} - Mapped error message:`, mappedMessage)
              errorMessage = mappedMessage
            } else if (errorData.message) {
              errorMessage = errorData.message
            } else if (errorData.error) {
              // Check if error is a code that can be mapped
              const mappedError = getErrorMessage(String(errorData.error), '')
              if (mappedError !== 'Có lỗi xảy ra. Vui lòng thử lại.') {
                errorMessage = mappedError
              } else {
                errorMessage = errorData.error
              }
            }
          }
        } catch (parseError) {
          // If we can't parse the error response, use the status text
          console.error(`[API Client] ${endpoint} - Failed to parse error response:`, parseError)
          console.error(`[API Client] ${endpoint} - Raw response text:`, rawResponseText)
          errorMessage = response.statusText || errorMessage
        }
        
        console.error(`[API Client] ${endpoint} - Final error message:`, errorMessage)
        
        return {
          success: false,
          error: String(errorMessage), // Ensure error is always a string
        }
      }

      const data = await response.json()
      console.log(`[API Client] ${endpoint} - Success response body:`, JSON.stringify(data, null, 2))
      
      // Handle backend response format: {responseCode, message, data}
      if (data.responseCode) {
        if (data.responseCode === 'S0000') {
          return {
            success: true,
            data: data.data,
          }
        } else {
          // Map common error codes to user-friendly messages
          const errorMessage = getErrorMessage(
            String(data.responseCode),
            data.message || data.error || ''
          )
          return {
            success: false,
            error: String(errorMessage), // Ensure error is always a string
          }
        }
      }
      
      // Check if response has error field (even with HTTP 200)
      if (data.error) {
        // Try to map error code if it looks like one
        const mappedError = getErrorMessage(String(data.error), data.message || '')
        if (mappedError !== 'Có lỗi xảy ra. Vui lòng thử lại.') {
          return {
            success: false,
            error: String(mappedError),
          }
        }
        return {
          success: false,
          error: String(data.error),
        }
      }
      
      // Fallback for other response formats
      return {
        success: true,
        data,
      }
    } catch (error) {
      console.error(`[API Client] ❌ Request failed for ${endpoint}:`, {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        baseURL: this.baseURL,
        endpoint,
        timestamp: new Date().toISOString()
      })

      // Handle network errors and other exceptions
      let errorMessage = 'Unknown error occurred'

      if (error instanceof TypeError) {
        if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          // CORS or network error
          errorMessage = 'Không thể kết nối đến server. Nguyên nhân có thể:\n' +
            '- Backend không cho phép CORS từ domain này\n' +
            '- Server backend đang offline\n' +
            '- URL không hợp lệ (phải là http:// hoặc https://)\n' +
            `- Kiểm tra BASE_URL: ${this.baseURL}`
        } else if (error.message.includes('URL scheme')) {
          errorMessage = error.message
        } else {
          errorMessage = error.message
        }
      } else if (error instanceof Error) {
        errorMessage = error.message
      }
      
      console.error(`[API Client] ❌ Network/CORS error for ${endpoint}:`, {
        error,
        errorMessage,
        url: `${this.baseURL}${endpoint}`,
        baseURL: this.baseURL,
      })
      
      return {
        success: false,
        error: String(errorMessage), // Ensure error is always a string
      }
    }
  }

  // GET request
  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', ...options })
  }

  // POST request
  async post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    })
  }

  // PUT request
  async put<T>(endpoint: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    })
  }

  // PATCH request (now using PUT)
  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  // DELETE request
  async delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }

  // Specific API methods for SORMS - Only use available endpoints
  async getRooms(options?: RequestInit) {
    return this.get('/rooms', options)
  }

  async getRoom(id: number, options?: RequestInit) {
    return this.get(`/rooms/${id}`, options)
  }

  async createRoom(roomData: any, options?: RequestInit) {
    const formattedData = {
      code: roomData.code,
      name: roomData.name || '',
      roomTypeId: roomData.roomTypeId,
      floor: roomData.floor || 1,
      status: roomData.status || 'AVAILABLE',
      description: roomData.description || ''
    }
    return this.post('/rooms', formattedData, options)
  }

  async updateRoom(id: number, roomData: any, options?: RequestInit) {
    const formattedData = {
      code: roomData.code,
      name: roomData.name || '',
      roomTypeId: roomData.roomTypeId,
      floor: roomData.floor || 1,
      status: roomData.status || 'AVAILABLE',
      description: roomData.description || ''
    }
    return this.put(`/rooms/${id}`, formattedData, options)
  }

  async deleteRoom(id: number, options?: RequestInit) {
    // Use DELETE endpoint as per backend controller
    return this.delete(`/rooms/${id}`, options)
  }

  // Additional room methods for filtering
  async getRoomsByStatus(status: string, options?: RequestInit) {
    return this.get(`/rooms/by-status/${status}`, options)
  }

  async getRoomsByRoomType(roomTypeId: number, options?: RequestInit) {
    return this.get(`/rooms/by-room-type/${roomTypeId}`, options)
  }


  // Staff Profiles API
  async getStaffProfiles() {
    return this.get('/staff-profiles')
  }

  async getStaffProfile(id: number) {
    return this.get(`/staff-profiles/${id}`)
  }

  async getStaffProfilesByStatus(status: string) {
    return this.get(`/staff-profiles/by-status?status=${encodeURIComponent(status)}`)
  }

  async getStaffProfilesByDepartment(department: string) {
    return this.get(`/staff-profiles/by-department/${encodeURIComponent(department)}`)
  }

  async createStaffProfile(profileData: any) {
    return this.post('/staff-profiles', profileData)
  }

  async updateStaffProfile(id: number, profileData: any) {
    return this.put(`/staff-profiles/${id}`, profileData)
  }

  async deleteStaffProfile(id: number) {
    return this.delete(`/staff-profiles/${id}`)
  }


  async getRoomTypes(options?: RequestInit) {
    return this.get('/room-types', options)
  }

  async getRoomType(id: number, options?: RequestInit) {
    return this.get(`/room-types/${id}`, options)
  }

  async createRoomType(roomTypeData: any, options?: RequestInit) {
    const formattedData = {
      code: roomTypeData.code,
      name: roomTypeData.name,
      basePrice: roomTypeData.basePrice || 0,
      maxOccupancy: roomTypeData.maxOccupancy || 1,
      description: roomTypeData.description || ''
    }
    return this.post('/room-types', formattedData, options)
  }

  async updateRoomType(id: number, roomTypeData: any, options?: RequestInit) {
    const formattedData = {
      code: roomTypeData.code,
      name: roomTypeData.name,
      basePrice: roomTypeData.basePrice || 0,
      maxOccupancy: roomTypeData.maxOccupancy || 1,
      description: roomTypeData.description || ''
    }
    return this.put(`/room-types/${id}`, formattedData, options)
  }

  async deleteRoomType(id: number, options?: RequestInit) {
    // Soft delete: deactivate instead of hard delete
    return this.put(`/room-types/${id}/deactivate`, undefined, options)
  }

  async getBookings(options?: RequestInit) {
    return this.get('/bookings', options)
  }

  async getBooking(id: number) {
    return this.get(`/bookings/${id}`)
  }

  async createBooking(bookingData: any) {
    // Ensure data matches API format - handle both camelCase and snake_case, and common variations
    const rawUserId = bookingData.userId || bookingData.user_id || null
    const formattedData = {
      code: bookingData.code || generateBookingCode(),
      // Backend yêu cầu userId dạng string
      userId: rawUserId != null ? String(rawUserId) : null,
      roomId: bookingData.roomId || bookingData.room_id,
      checkinDate: bookingData.checkinDate || bookingData.checkin_date || bookingData.checkIn,
      checkoutDate: bookingData.checkoutDate || bookingData.checkout_date || bookingData.checkOut,
      numGuests: bookingData.numGuests || bookingData.num_guests || bookingData.guests || 1,
      note: bookingData.note || bookingData.purpose || '',
      status: bookingData.status || 'PENDING'
    }
    return this.post('/bookings', formattedData)
  }

  async updateBooking(id: number, bookingData: any) {
    const formattedData = {
      code: bookingData.code,
      userId: bookingData.userId || bookingData.user_id,
      roomId: bookingData.roomId || bookingData.room_id,
      checkinDate: bookingData.checkinDate || bookingData.checkin_date,
      checkoutDate: bookingData.checkoutDate || bookingData.checkout_date,
      numGuests: bookingData.numGuests || bookingData.num_guests,
      note: bookingData.note || '',
      status: bookingData.status
    }
    return this.patch(`/bookings/${id}`, formattedData)
  }

  async deleteBooking(id: number) {
    // Xóa booking theo spec mới: DELETE /bookings/{id}
    return this.delete(`/bookings/${id}`)
  }

  // Additional booking methods for filtering and actions
  async getBookingsByUser(userId: number) {
    return this.get(`/bookings/by-user/${userId}`)
  }

  async getBookingsByStatus(status: string) {
    return this.get(`/bookings/by-status/${status}`)
  }

  async checkinBooking(id: number) {
    return this.post(`/bookings/${id}/checkin`)
  }

  async approveBooking(id: number, approverId?: string, reason?: string) {
    // Backend hiện yêu cầu body dạng:
    // { bookingId, approverId, decision, reason }
    const payload = {
      bookingId: id,
      approverId: approverId ?? 'SYSTEM',
      decision: 'APPROVED',
      reason: reason ?? ''
    }
    return this.post(`/bookings/${id}/approve`, payload)
  }

  async getServices() {
    return this.get('/services')
  }

  async getService(id: number) {
    return this.get(`/services/${id}`)
  }

  async createService(serviceData: any) {
    // Ensure data matches API format
    const formattedData = {
      code: serviceData.code,
      name: serviceData.name,
      description: serviceData.description || '',
      unitPrice: serviceData.unitPrice || serviceData.unit_price,
      unitName: serviceData.unitName || serviceData.unit_name,
      isActive: serviceData.isActive !== undefined ? serviceData.isActive : serviceData.is_active !== undefined ? serviceData.is_active : true
    }
    return this.post('/services', formattedData)
  }

  async updateService(id: number, serviceData: any) {
    const formattedData = {
      code: serviceData.code,
      name: serviceData.name,
      description: serviceData.description || '',
      unitPrice: serviceData.unitPrice || serviceData.unit_price,
      unitName: serviceData.unitName || serviceData.unit_name,
      isActive: serviceData.isActive !== undefined ? serviceData.isActive : serviceData.is_active
    }
    return this.put(`/services/${id}`, formattedData)
  }

  async deleteService(id: number) {
    // Soft delete: deactivate instead of hard delete
    return this.put(`/services/${id}/deactivate`)
  }

  // Service Orders (Orders API)
  async getServiceOrders() {
    return this.get('/orders')
  }

  async getMyServiceOrders() {
    return this.get('/orders/my-orders')
  }

  async getServiceOrder(id: number) {
    return this.get(`/orders/${id}`)
  }

  async createServiceOrder(orderData: any) {
    return this.post('/orders', orderData)
  }

  async addOrderItem(orderId: number, itemData: any) {
    return this.post(`/orders/${orderId}/items`, itemData)
  }

  async confirmOrder(orderId: number) {
    return this.post(`/orders/${orderId}/confirm`)
  }

  // Payments
  async createPayment(payload: { serviceOrderId: number; method: 'CASH' | 'PAYOS'; returnUrl: string; cancelUrl: string }) {
    return this.post('/payments/create', payload)
  }

  async getPayment(transactionId: number | string) {
    return this.get(`/payments/${transactionId}`)
  }

  async getPaymentTransactions() {
    return { success: false, error: 'API not implemented yet' }
  }

  async getStaffTasks() {
    return { success: false, error: 'API not implemented yet' }
  }

  // Users API
  async getUsers(params?: { role?: string; page?: number; size?: number; keyword?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.set('page', params.page.toString());
    if (params?.size !== undefined) queryParams.set('size', params.size.toString());
    if (params?.keyword) queryParams.set('q', params.keyword);

    // Map FE role -> BE role code for search filters
    const mapAppRoleToBackend = (r?: string): string | undefined => {
      if (!r) return undefined
      const v = String(r).trim().toUpperCase()
      // Primary roles used by BE security annotations
      if (v === 'ADMIN') return 'ADMIN'
      if (v === 'STAFF') return 'STAFF'
      if (v === 'MANAGER') return 'MANAGER'
      if (v === 'USER') return 'USER'
      // FE route aliases
      if (v === 'OFFICE') return 'MANAGER' // office area maps to manager-level access
      // Legacy synonyms from older data
      if (v === 'ADMIN_SYSTEM' || v === 'ADMIN_SYTEM' || v === 'ADMINISTRATOR') return 'ADMIN'
      if (v === 'ADMINITRATIVE' || v === 'ADMINISTRATIVE') return 'MANAGER'
      if (v === 'SERCURITY' || v === 'SECURITY') return 'STAFF'
      return undefined
    }

    const mappedRole = mapAppRoleToBackend(params?.role)
    if (mappedRole) queryParams.set('role', mappedRole)

    const endpoint = `/users/search${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return this.get(endpoint);
  }

  async getStaffUsers() {
    return this.getUsers({ role: 'staff', size: 100 });
  }

  async getUser(id: number) {
    return this.get(`/users/${id}`);
  }

  // Dashboard endpoints - calculate from real data
  async getDashboardStats() {
    try {
      const [roomsResponse, bookingsResponse, roomTypesResponse] = await Promise.all([
        this.getRooms(),
        this.getBookings(),
        this.getRoomTypes()
      ])

      const rooms = (roomsResponse.data || []) as any[]
      const bookings = (bookingsResponse.data || []) as any[]
      const roomTypes = (roomTypesResponse.data || []) as any[]

      const totalRooms = rooms.length
      const occupiedRooms = rooms.filter((r: any) => r.status === 'OCCUPIED').length
      const pendingBookings = bookings.filter((b: any) => b.status === 'PENDING').length

      // Calculate total revenue from bookings using REAL room prices from API
      const totalRevenue = bookings.reduce((sum: number, booking: any) => {
        // Find room for this booking
        const room = rooms.find((r: any) => r.id === booking.roomId)
        if (!room) return sum

        // Find room type to get base price
        const roomType = roomTypes.find((rt: any) => rt.id === room.roomTypeId)
        if (!roomType) return sum

        const basePrice = roomType.basePrice || 0

        // Calculate number of days
        const checkinDate = new Date(booking.checkinDate)
        const checkoutDate = new Date(booking.checkoutDate)
        const days = Math.max(1, Math.ceil((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24)))

        // Calculate revenue: basePrice * days * numGuests
        const bookingRevenue = basePrice * days * (booking.numGuests || 1)
        return sum + bookingRevenue
      }, 0)

      return {
        success: true,
        data: {
          totalRooms,
          occupiedRooms,
          pendingBookings,
          totalRevenue
        }
      }
    } catch (error) {
      return {
        success: false,
        error: 'Failed to calculate dashboard stats'
      }
    }
  }

  async getOccupancyStats() {
    try {
      const roomsResponse = await this.getRooms()
      if (!roomsResponse.success) {
        return { 
          success: false, 
          error: 'Failed to fetch rooms data' 
        }
      }
      
      const rooms = (roomsResponse.data || []) as any[]
      const total = rooms.length
      const occupied = rooms.filter((r: any) => r.status === 'OCCUPIED').length
      
      return { 
        success: true, 
        data: { 
          total, 
          occupied 
        } 
      }
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to calculate occupancy stats' 
      }
    }
  }

  async getBookingStats() {
    try {
      const bookingsResponse = await this.getBookings()
      if (!bookingsResponse.success) {
        return { 
          success: false, 
          error: 'Failed to fetch bookings data' 
        }
      }
      
      const bookings = (bookingsResponse.data || []) as any[]
      const pending = bookings.filter((b: any) => b.status === 'PENDING').length
      
      // Generate time series data from real bookings
      const today = new Date()
      const series = []
      for (let i = 13; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(today.getDate() - i)
        const dateStr = date.toISOString().slice(0, 10)
        
        // Count bookings for this date
        const count = bookings.filter((b: any) => 
          b.checkinDate && b.checkinDate.slice(0, 10) === dateStr
        ).length
        
        series.push({ 
          date: dateStr, 
          count 
        })
      }
      
      return { 
        success: true, 
        data: { 
          pending, 
          series 
        } 
      }
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to calculate booking stats' 
      }
    }
  }

  async getPaymentStats() {
    // Payment API not implemented yet - return empty data
    return { 
      success: true, 
      data: { 
        count: 0, 
        sum: 0, 
        series: [] 
      } 
    }
  }

  // Check-in methods
  async getCheckins() {
    return this.get('/checkins')
  }

  async createCheckin(checkinData: any) {
    const formattedData = {
      booking_code: checkinData.booking_code,
      user_name: checkinData.user_name,
      room_code: checkinData.room_code,
      checkin_at: checkinData.checkin_at,
      checkout_at: checkinData.checkout_at,
      face_ref: checkinData.face_ref,
      status: checkinData.status || 'PENDING'
    }
    return this.post('/checkins', formattedData)
  }

  async updateCheckin(id: number, checkinData: any) {
    const formattedData = {
      booking_code: checkinData.booking_code,
      user_name: checkinData.user_name,
      room_code: checkinData.room_code,
      checkin_at: checkinData.checkin_at,
      checkout_at: checkinData.checkout_at,
      face_ref: checkinData.face_ref,
      status: checkinData.status
    }
    return this.put(`/checkins/${id}`, formattedData)
  }

  async deleteCheckin(id: number) {
    // Soft delete: deactivate instead of hard delete
    return this.put(`/checkins/${id}/deactivate`)
  }

  async getCheckin(id: number) {
    return this.get(`/checkins/${id}`)
  }

  // Authentication methods
  async sendVerificationCode(email: string) {
    return this.post('/auth/verify-account/send-code', { email })
  }

  async checkVerificationCode(email: string, code: string) {
    return this.post('/auth/verify-account/check-code', { email, code })
  }

  async refreshToken(token: string) {
    // Backend yêu cầu gửi token hiện tại trong body
    return this.post('/auth/refresh', { token })
  }

  async outboundAuth(data: any) {
    return this.post('/auth/outbound/authentication', data)
  }

  async mobileOutboundAuth(data: any) {
    return this.post('/auth/mobile/outbound/authentication', data)
  }

  async logout(token?: string) {
    // Backend yêu cầu gửi token trong body
    if (token) {
      return this.post('/auth/logout', { token })
    }
    return this.post('/auth/logout', {})
  }

  async login(credentials: { username: string; password: string } | { email: string; password: string }) {
    // Backend yêu cầu username, nhưng hỗ trợ cả email để tương thích
    const body = 'username' in credentials 
      ? credentials 
      : { username: credentials.email, password: credentials.password }
    return this.post('/auth/login', body)
  }

  async introspect(token: string) {
    return this.post('/auth/introspect', { token })
  }

  async getGoogleOAuthRedirectUrl(redirectUri?: string, scope?: string) {
    const params = new URLSearchParams()
    if (redirectUri) {
      params.set('redirectUri', redirectUri)
    }
    if (scope) {
      params.set('scope', scope)
    }
    
    const queryString = params.toString()
    const endpoint = `/auth/oauth2/google/redirect-url${queryString ? '?' + queryString : ''}`
    return this.get(endpoint)
  }
}

// Export singleton instance
export const apiClient = new ApiClient()

// Export types
export type { ApiResponse }
