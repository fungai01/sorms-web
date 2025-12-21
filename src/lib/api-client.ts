// API Client for connecting to backend
import { API_CONFIG } from './config'
import { authService, decodeJWTPayload } from './auth-service'
import { authFetch } from './http'
import { generateBookingCode } from './utils'
import type { StaffProfile } from './types'

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
      const getAuthHeader = (h: HeadersInit | undefined): string | null => {
        if (!h) return null
        if (h instanceof Headers) return h.get('authorization')
        if (Array.isArray(h)) {
          const entry = h.find(([k]) => k?.toLowerCase() === 'authorization')
          return entry ? (entry[1] as string | null) ?? null : null
        }
        if (typeof h === 'object') {
          const key = Object.keys(h).find(k => k.toLowerCase() === 'authorization')
          return key ? ((h as Record<string, string | null | undefined>)[key] ?? null) : null
        }
        return null
      }
      
      const authHeaderFromOptions = getAuthHeader(options.headers)
      
      let token: string | null = null
      
      if (authHeaderFromOptions && authHeaderFromOptions.startsWith('Bearer ')) {
        token = authHeaderFromOptions.substring(7)
      } else {
          const userInfo = authService.getUserInfo()
          if (userInfo && (userInfo as any).token) {
            token = (userInfo as any).token
          }
        
        if (!token) {
          token = authService.getAccessToken()
        }
        
        // On the server, prefer passing Authorization header explicitly instead of reading cookies here.
      }
      
      const publicEndpoints = [
        '/auth/outbound/authentication',
        '/auth/mobile/outbound/authentication',
        '/auth/login',
        '/auth/refresh',
      ]
      
      const isPublicEndpoint = publicEndpoints.some(publicPath => endpoint.includes(publicPath))
      
      let mergedHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      
      if (options.headers) {
        if (options.headers instanceof Headers) {
          mergedHeaders = { ...mergedHeaders, ...Object.fromEntries(options.headers.entries()) }
        } else if (Array.isArray(options.headers)) {
          mergedHeaders = { ...mergedHeaders, ...Object.fromEntries(options.headers) }
        } else if (typeof options.headers === 'object') {
          mergedHeaders = { ...mergedHeaders, ...(options.headers as Record<string, string>) }
        }
      }
      
      if (token) {
        mergedHeaders['Authorization'] = `Bearer ${token}`
      }
      
      const headers = mergedHeaders

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
      
      const response = await authFetch(url, {
        ...restOptions,
        headers: headers,
      })
      
      if (!response.ok) {
        let errorMessage = response.statusText || `HTTP error! status: ${response.status}`
        const rawResponseText = await response.text().catch(() => '')
        let parsed: any = null
        if (rawResponseText) {
          try {
            parsed = JSON.parse(rawResponseText)
          } catch {}
        }
        if (parsed?.message) {
          errorMessage = parsed.message
        } else if (parsed?.error) {
          errorMessage = String(parsed.error)
        } else if (parsed?.responseCode) {
          errorMessage = String(parsed.responseCode)
        } else if (rawResponseText) {
          errorMessage = rawResponseText
        }
        
        return {
          success: false,
          error: String(errorMessage),
        }
      }

      const data = await response.json()
      
      if (data.responseCode) {
        if (data.responseCode === 'S0000') {
          return {
            success: true,
            data: data.data,
          }
        } else {
          return {
            success: false,
            error: String(data.message || data.error || data.responseCode),
          }
        }
      }
      
      if (data.error) {
          return {
            success: false,
          error: String(data.message || data.error),
        }
      }
      
      return {
        success: true,
        data,
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unknown error occurred'
      
      return {
        success: false,
        error: String(errorMessage),
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

  async getRoomsByRoomType(roomTypeId: number, options?: RequestInit) {
    return this.get(`/rooms/by-room-type/${roomTypeId}`, options)
  }


  async getStaffProfiles() {
    return this.get<StaffProfile[]>('/staff-profiles')
  }

  async getStaffProfile(id: number) {
    return this.get<StaffProfile>(`/staff-profiles/${id}`)
  }

  async getStaffProfilesByStatus(status: string) {
    // Backend expects isActive boolean: ACTIVE -> true, INACTIVE -> false
    const isActive = status === 'ACTIVE'
    return this.get<StaffProfile[]>(`/staff-profiles/by-status?isActive=${isActive}`)
  }

  async getStaffProfilesByDepartment(department: string) {
    return this.get<StaffProfile[]>(`/staff-profiles/by-department/${encodeURIComponent(department)}`)
  }

  async createStaffProfile(profileData: Partial<StaffProfile>) {
    return this.post('/staff-profiles', profileData)
  }

  async updateStaffProfile(id: number, profileData: Partial<StaffProfile>) {
    return this.put(`/staff-profiles/${id}`, profileData)
  }

  async deleteStaffProfile(id: number) {
    return this.delete(`/staff-profiles/${id}`)
  }


  async getRoomTypes(options?: RequestInit) {
    return this.get('/room-types', options)
  }

  async getRoomsByStatus(
    status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'CLEANING' | 'OUT_OF_SERVICE',
    startTime?: string,
    endTime?: string,
    options?: RequestInit
  ) {
    const params = new URLSearchParams()
    if (startTime) params.set('startTime', startTime)
    if (endTime) params.set('endTime', endTime)
    const qs = params.toString()
    return this.get(`/rooms/by-status/${status}${qs ? `?${qs}` : ''}`, options)
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
    // DELETE /room-types/{id} - Hard delete as per API spec
    return this.delete(`/room-types/${id}`, options)
  }

  async getBookings(options?: RequestInit) {
    return this.get('/bookings', options)
  }

  async getBooking(id: number, options?: RequestInit) {
    return this.get(`/bookings/${id}`, options)
  }

  async createBooking(bookingData: any, options?: RequestInit) {
    // Backend format: CreateBookingRequest { code: String, userId: String, roomId: Long, checkinDate: LocalDateTime, checkoutDate: LocalDateTime, numGuests: Integer, note: String }
    const rawUserId = bookingData.userId || bookingData.user_id || null
    const rawRoomId = bookingData.roomId || bookingData.room_id
    const rawNumGuests = bookingData.numGuests || bookingData.num_guests || bookingData.guests || 1
    
    // Format datetime strings to ensure they're in the correct format (YYYY-MM-DDTHH:mm:ss)
    const formatDateTime = (dateTimeStr: string | undefined): string | undefined => {
      if (!dateTimeStr) return dateTimeStr
      
      // Nếu đã là format đúng (YYYY-MM-DDTHH:mm:ss), giữ nguyên
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateTimeStr)) {
        return dateTimeStr
      }
      
      // Nếu thiếu seconds (YYYY-MM-DDTHH:mm), thêm :00
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTimeStr)) {
        return `${dateTimeStr}:00`
      }
      
      // Nếu có timezone, bỏ timezone
      if (dateTimeStr.includes('+') || dateTimeStr.endsWith('Z')) {
        const withoutTz = dateTimeStr.replace(/[+-]\d{2}:\d{2}$/, '').replace(/Z$/, '')
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(withoutTz)) {
          return `${withoutTz}:00`
        }
        return withoutTz
      }
      
      return dateTimeStr
    }
    
    const formattedData: any = {
      code: bookingData.code || generateBookingCode(),
      // Backend yêu cầu userId dạng string
      userId: rawUserId != null ? String(rawUserId) : null,
      // Backend yêu cầu roomId dạng Long (number)
      roomId: rawRoomId != null ? Number(rawRoomId) : null,
      // Backend yêu cầu checkinDate dạng LocalDateTime (ISO datetime string without timezone)
      checkinDate: formatDateTime(bookingData.checkinDate || bookingData.checkin_date || bookingData.checkIn),
      // Backend yêu cầu checkoutDate dạng LocalDateTime (ISO datetime string without timezone)
      checkoutDate: formatDateTime(bookingData.checkoutDate || bookingData.checkout_date || bookingData.checkOut),
      // Backend yêu cầu numGuests dạng Integer (number)
      numGuests: rawNumGuests != null ? Number(rawNumGuests) : 1,
      note: bookingData.note || bookingData.purpose || '',
    }
    
    // Validate required fields
    if (!formattedData.userId) {
      console.warn('⚠️ createBooking: userId is missing')
    }
    if (!formattedData.roomId) {
      console.warn('⚠️ createBooking: roomId is missing')
    }
    if (!formattedData.checkinDate) {
      console.warn('⚠️ createBooking: checkinDate is missing')
    }
    if (!formattedData.checkoutDate) {
      console.warn('⚠️ createBooking: checkoutDate is missing')
    }
    
    // Không gửi status vì backend không có trong CreateBookingRequest
    return this.post('/bookings', formattedData, options)
  }

  async updateBooking(id: number, bookingData: any) {
    // PUT /bookings/{id} - Body format: { id, roomId, checkinDate, checkoutDate, numGuests, note, status? }
    // Note: status có thể được gửi để cập nhật trạng thái booking
    const formattedData: any = {
      id: id, // Include id in body as per API spec
      roomId: bookingData.roomId || bookingData.room_id,
      checkinDate: bookingData.checkinDate || bookingData.checkin_date,
      checkoutDate: bookingData.checkoutDate || bookingData.checkout_date,
      numGuests: bookingData.numGuests || bookingData.num_guests || 1,
      note: bookingData.note || ''
    }
    // Thêm status nếu có (để cập nhật trạng thái booking)
    if (bookingData.status) {
      formattedData.status = bookingData.status
    }
    return this.put(`/bookings/${id}`, formattedData)
  }

  async deleteBooking(id: number, options?: RequestInit) {
    // Xóa booking theo spec mới: DELETE /bookings/{id}
    return this.delete(`/bookings/${id}`, options)
  }

  // Additional booking methods for filtering and actions
  async getBookingsByUser(userId: string | number, options?: RequestInit) {
    return this.get(`/bookings/by-user/${encodeURIComponent(String(userId))}`, options)
  }

  async getBookingsByStatus(status: string, options?: RequestInit) {
    return this.get(`/bookings/by-status/${status}`, options)
  }

  async checkinBooking(id: number) {
    return this.post(`/bookings/${id}/checkin`)
  }

  async checkoutBooking(id: number, userId?: string) {
    // Backend format: CheckoutBookingRequest { bookingId: Long, userId: String }
    const payload: any = {
      bookingId: id,
    }
    if (userId) {
      payload.userId = String(userId)
    }
    return this.post(`/bookings/${id}/checkout`, payload)
  }

  // User cancel booking - update status to CANCELLED
  async cancelBooking(id: number, reason?: string) {
    // Use Next.js API route as proxy to handle user cancellation
    try {
      const token = authService.getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/system/bookings?id=${id}&action=cancel`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        return {
          success: false,
          error: errorData.error || errorData.message || `Failed to cancel booking: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data ?? data,
      };
    } catch (error) {
      console.error('cancelBooking error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel booking',
      };
    }
  }

  // User update booking - only for PENDING bookings
  async updateMyBooking(id: number, bookingData: { roomId?: number; checkinDate?: string; checkoutDate?: string; numGuests?: number; note?: string }) {
    // Use Next.js API route as proxy
    try {
      const token = authService.getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const formattedData: any = {
        id,
        ...bookingData,
      };

      const response = await fetch(`/api/system/bookings?id=${id}&action=update`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(formattedData),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        return {
          success: false,
          error: errorData.error || errorData.message || `Failed to update booking: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data ?? data,
      };
    } catch (error) {
      console.error('updateMyBooking error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update booking',
      };
    }
  }

  async approveBooking(id: number, approverId?: string, reason?: string, options?: RequestInit) {
    // Gọi trực tiếp backend endpoint: /bookings/{id}/approve (không qua Next.js route)
    // Body: { bookingId, approverId, decision, reason }
    // Lấy approverId từ token nếu chưa có
    let finalApproverId = approverId
    if (!finalApproverId) {
      try {
        const userInfo = authService.getUserInfo()
        if (userInfo?.id) {
          finalApproverId = userInfo.id
        } else {
          // Thử lấy từ token trực tiếp
          const token = authService.getAccessToken()
          if (token) {
            const payload = decodeJWTPayload(token)
            if (payload?.userId) {
              finalApproverId = String(payload.userId)
            } else if (payload?.sub) {
              finalApproverId = String(payload.sub)
            } else if (payload?.accountId) {
              finalApproverId = String(payload.accountId)
            }
          }
        }
      } catch (error) {
        console.error('Error getting approverId:', error)
      }
    }

    if (!finalApproverId) {
      return {
        success: false,
        error: 'Approver ID is required. Please ensure you are logged in.'
      }
    }

    const payload: any = {
      bookingId: id,
      approverId: finalApproverId,
      decision: 'APPROVED',
      reason: reason ?? ''
    }
    
    // Gọi trực tiếp backend endpoint (không qua Next.js route để tránh /api/api)
    return this.post(`/bookings/${id}/approve`, payload, options)
  }

  async rejectBooking(id: number, approverId?: string, reason?: string, options?: RequestInit) {
    // Gọi trực tiếp backend endpoint: /bookings/{id}/approve (không qua Next.js route)
    // Body: { bookingId, approverId, decision, reason }
    // Lấy approverId từ token nếu chưa có
    let finalApproverId = approverId
    if (!finalApproverId) {
      try {
        const userInfo = authService.getUserInfo()
        if (userInfo?.id) {
          finalApproverId = userInfo.id
        } else {
          // Thử lấy từ token trực tiếp
          const token = authService.getAccessToken()
          if (token) {
            const payload = decodeJWTPayload(token)
            if (payload?.userId) {
              finalApproverId = String(payload.userId)
            } else if (payload?.sub) {
              finalApproverId = String(payload.sub)
            } else if (payload?.accountId) {
              finalApproverId = String(payload.accountId)
            }
          }
        }
      } catch (error) {
        console.error('Error getting approverId:', error)
      }
    }

    if (!finalApproverId) {
      return {
        success: false,
        error: 'Approver ID is required. Please ensure you are logged in.'
      }
    }

    const payload: any = {
      bookingId: id,
      approverId: finalApproverId,
      decision: 'REJECTED',
      reason: reason ?? ''
    }
    
    // Gọi trực tiếp backend endpoint (không qua Next.js route để tránh /api/api)
    return this.post(`/bookings/${id}/approve`, payload, options)
  }

  async getServices(options?: RequestInit) {
    return this.get('/services', options)
  }

  async getService(id: number, options?: RequestInit) {
    return this.get(`/services/${id}`, options)
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
    // Hard delete: DELETE /services/{id}
    return this.delete(`/services/${id}`)
  }

  async deactivateService(id: number) {
    // Soft delete: deactivate service (if backend supports this endpoint)
    // Note: Backend may not have this endpoint, use deleteService for hard delete
    return this.put(`/services/${id}/deactivate`)
  }

  // Service Orders (Orders API)
  async getServiceOrders() {
    // Backend doesn't have GET /orders endpoint to list all orders
    // Use Next.js API route which may aggregate from multiple sources
    return this.get('/orders')
  }

  async getMyServiceOrders(bookingId?: number) {
    const queryParams = new URLSearchParams()
    if (bookingId !== undefined) {
      queryParams.set('bookingId', bookingId.toString())
    }
    const endpoint = `/orders/my-orders${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    return this.get(endpoint)
  }

  async getServiceOrder(id: number) {
    return this.get(`/orders/${id}`)
  }


  async createServiceOrder(orderData: any) {
    // Normalize serviceTime to LocalDateTime format without timezone for Spring (yyyy-MM-dd'T'HH:mm:ss)
    let st: string | undefined = orderData.serviceTime || orderData.scheduledDateTime
    if (typeof st === 'string') {
      // Strip timezone 'Z' and milliseconds if present
      st = st.replace(/Z$/, '')
      st = st.replace(/\.\d+$/, '')
      // Ensure seconds are present
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(st)) {
        st = st + ':00'
      }
    }

    // Backend CreateServiceOrderRequest requires ALL these fields:
    // - bookingId (Long) - required
    // - orderId (Long) - required (must exist, backend will update it)
    // - serviceId (Long) - required
    // - quantity (BigDecimal) - required
    // - assignedStaffId (Long) - required
    // - requestedBy (Long) - required
    // - serviceTime (LocalDateTime) - required
    // - note (String) - optional
    
    const payload = {
      bookingId: orderData.bookingId,
      orderId: orderData.orderId, // REQUIRED - must be existing order ID
      serviceId: orderData.serviceId,
      quantity: orderData.quantity,
      assignedStaffId: orderData.assignedStaffId, // REQUIRED
      requestedBy: orderData.requestedBy, // REQUIRED
      serviceTime: st, // BE expects LocalDateTime without timezone (yyyy-MM-dd'T'HH:mm:ss)
      note: orderData.note || null
    }
    
    // Validate required fields
    if (!payload.bookingId) {
      return { success: false, error: 'bookingId is required' }
    }
    if (!payload.orderId) {
      return { success: false, error: 'orderId is required (must be existing order ID)' }
    }
    if (!payload.serviceId) {
      return { success: false, error: 'serviceId is required' }
    }
    if (!payload.quantity || payload.quantity <= 0) {
      return { success: false, error: 'quantity is required and must be greater than 0' }
    }
    if (!payload.assignedStaffId) {
      return { success: false, error: 'assignedStaffId is required' }
    }
    if (!payload.requestedBy) {
      return { success: false, error: 'requestedBy is required' }
    }
    if (!payload.serviceTime) {
      return { success: false, error: 'serviceTime is required' }
    }
    
    // Use Next.js API route as proxy instead of calling backend directly
    // This ensures proper authentication and error handling
    try {
      const token = authService.getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/system/orders?action=service', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        return {
          success: false,
          error: errorData.error || errorData.message || `Failed to create service order: ${response.status}`,
        }
      }
      
      const data = await response.json()
      return {
        success: true,
        data: data.data ?? data,
      }
    } catch (error) {
      console.error('createServiceOrder error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create service order',
      }
    }
  }

  async confirmOrder(orderId: number) {
    return this.post(`/orders/${orderId}/confirm`)
  }

  // Create service order with staff confirmation workflow
  // Backend endpoint: POST /orders/service
  async createServiceOrderWithStaff(payload: {
    bookingId: number;
    orderId: number;
    serviceId: number;
    quantity: number;
    assignedStaffId: number;
    requestedBy: string;
    serviceTime: string; // LocalDateTime format: yyyy-MM-dd'T'HH:mm:ss
    note?: string;
  }) {
    return this.post('/orders/service', payload)
  }

  // Cart-based order workflow
  async createOrderCart(params: { bookingId: number; requestedBy?: string; note?: string } | number) {
    if (typeof params === 'number') {
      return this.post('/orders/cart', { bookingId: params })
    }
    return this.post('/orders/cart', {
      bookingId: params.bookingId,
      requestedBy: params.requestedBy,
      note: params.note
    })
  }

  async addOrderItem(orderId: number, serviceId: number, quantity: number, serviceDate?: string, serviceTime?: string, assignedStaffId?: number) {
    return this.post(`/orders/${orderId}/items`, {
      serviceId,
      quantity,
      serviceDate,
      serviceTime,
      assignedStaffId
    })
  }

  async updateOrderItem(orderId: number, itemId: number, quantity: number) {
    return this.put(`/orders/${orderId}/items/${itemId}`, { quantity })
  }

  async removeOrderItem(orderId: number, itemId: number) {
    return this.delete(`/orders/${orderId}/items/${itemId}`)
  }

  // Payments
  async createPayment(payload: { serviceOrderId: number; method: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'WALLET'; returnUrl?: string; cancelUrl?: string }) {
    return this.post('/payments/create', payload)
  }

  async getPayment(transactionId: number | string) {
    return this.get(`/payments/${transactionId}`)
  }

  async getPaymentTransactions() {
    return this.get('/payments')
  }

  // Staff Tasks API
  async getStaffTasks() {
    return this.get('/staff-tasks')
  }

  async getStaffTask(id: number) {
    return this.get(`/staff-tasks/${id}`)
  }

  async getStaffTasksByAssignee(assignedTo: number) {
    return this.get(`/staff-tasks/by-assignee/${assignedTo}`)
  }

  async getStaffTasksByStatus(status: string) {
    return this.get(`/staff-tasks/by-status?status=${encodeURIComponent(status)}`)
  }

  async getStaffTasksByRelated(relatedType: string, relatedId: number) {
    return this.get(`/staff-tasks/by-related?relatedType=${encodeURIComponent(relatedType)}&relatedId=${relatedId}`)
  }

  async createStaffTask(taskData: any) {
    return this.post('/staff-tasks', taskData)
  }

  async updateStaffTask(id: number, taskData: any) {
    return this.put(`/staff-tasks/${id}`, taskData)
  }

  async deleteStaffTask(id: number) {
    return this.delete(`/staff-tasks/${id}`)
  }

  // Roles API
  async getRoles(params?: { name?: string; code?: string; description?: string; isActive?: boolean; page?: number; size?: number }, options?: RequestInit) {
    const queryParams = new URLSearchParams()
    if (params?.name) queryParams.set('name', params.name)
    if (params?.code) queryParams.set('code', params.code)
    if (params?.description) queryParams.set('description', params.description)
    if (params?.isActive !== undefined) queryParams.set('isActive', params.isActive.toString())
    if (params?.page !== undefined) queryParams.set('page', params.page.toString())
    if (params?.size !== undefined) queryParams.set('size', params.size.toString())

    const endpoint = `/roles/search${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    return this.get(endpoint, options)
  }

  async getRole(id: string, options?: RequestInit) {
    return this.get(`/roles/${id}`, options)
  }

  async createRole(roleData: any) {
    return this.post('/roles', roleData)
  }

  async updateRole(id: string, roleData: any) {
    return this.put(`/roles/${id}`, roleData)
  }

  async activateRole(id: string) {
    return this.put(`/roles/${id}/activate`)
  }

  async deactivateRole(id: string) {
    return this.put(`/roles/${id}/deactivate`)
  }

  async deleteRole(id: string) {
    return this.delete(`/roles/${id}`)
  }
  async staffConfirmOrder(orderId: number, staffId: number, note?: string) {
    return this.post(`/orders/${orderId}/staff/confirm`, { staffId, note: note || '' })
  }

  async staffRejectOrder(orderId: number, staffId: number, reason?: string) {
    return this.post(`/orders/${orderId}/staff/reject`, { staffId, reason: reason || '' })
  }

  async assignStaffToOrder(orderId: number, staffId: number) {
    // Note: This endpoint may need to be created in backend
    // For now, using PUT to update order with assignedStaffId
    return this.put(`/orders/${orderId}/assign-staff`, { assignedStaffId: staffId })
  }

  async getStaffTasksForOrder(staffId: number, status?: string) {
    const queryParams = new URLSearchParams()
    if (status) queryParams.set('status', status)
    const endpoint = `/orders/staff/${staffId}/tasks${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    return this.get(endpoint)
  }

  async getStaffTaskDetailForOrder(staffId: number, orderId: number) {
    return this.get(`/orders/staff/${staffId}/tasks/${orderId}`)
  }

  // Users API
  async getUsers(params?: { role?: string; page?: number; size?: number; keyword?: string; email?: string; fullName?: string; phoneNumber?: string; idCardNumber?: string; status?: string }, options?: RequestInit) {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.set('page', params.page.toString());
    if (params?.size !== undefined) queryParams.set('size', params.size.toString());
    
    // Backend accepts: email, fullName, phoneNumber, idCardNumber, status
    // Map keyword to email if it looks like an email, otherwise to fullName
    if (params?.keyword) {
      const keyword = params.keyword.trim();
      // Check if keyword looks like an email
      if (keyword.includes('@')) {
        queryParams.set('email', keyword);
      } else {
        // Try as fullName first, backend will search in multiple fields
        queryParams.set('fullName', keyword);
      }
    }
    
    // Direct parameter mapping
    if (params?.email) queryParams.set('email', params.email);
    if (params?.fullName) queryParams.set('fullName', params.fullName);
    if (params?.phoneNumber) queryParams.set('phoneNumber', params.phoneNumber);
    if (params?.idCardNumber) queryParams.set('idCardNumber', params.idCardNumber);
    if (params?.status) queryParams.set('status', params.status);

    // Note: Backend doesn't support 'role' parameter in /users/search endpoint
    // Role filtering should be handled at service level if needed

    const endpoint = `/users/search${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return this.get(endpoint, options);
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
    try {
      const token = authService.getAccessToken()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch('/api/system/payments?action=stats', {
        method: 'GET',
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        return {
          success: false,
          error: errorData.error || errorData.message || `Failed to get payment stats: ${response.status}`,
        }
      }

      const data = await response.json()
      return {
        success: true,
        data: data.data ?? data,
      }
    } catch (error) {
      console.error('getPaymentStats error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get payment stats',
      }
    }
  }

  async refreshToken(refreshToken: string) {
    // Backend yêu cầu gửi refreshToken trong body (FE cũ dùng key "token", BE hiện hỗ trợ cả hai)
    return this.post('/auth/refresh', { refreshToken })
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

// ========== API Router Utils (merged from api-router-utils.ts) ==========
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getAuthorizationHeader } from './auth-service'
import type { UserInfo } from './auth-service'

export interface ApiRouteContext {
  userInfo: any
  isAuthenticated: boolean
  isAdmin: boolean
  isUser: boolean
  isStaff: boolean
  isOffice: boolean
}

/**
 * Common middleware for API routes
 * Verifies authentication and extracts user context
 */
export async function createApiContext(req: NextRequest): Promise<{
  context: ApiRouteContext | null
  error: NextResponse | null
}> {
  try {
    const userInfo = await verifyToken(req)

    if (!userInfo?.id) {
      return {
        context: null,
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const role = (userInfo.role || '').toUpperCase()
    const isAdmin = role === 'ADMIN_SYSTEM' || role === 'ADMIN'
    const isUser = role === 'USER'
    const isStaff = role === 'STAFF'
    const isOffice = role === 'ADMINISTRATIVE' || role === 'OFFICE'

    return {
      context: {
        userInfo,
        isAuthenticated: true,
        isAdmin,
        isUser,
        isStaff,
        isOffice
      },
      error: null
    }
  } catch (error: any) {
    return {
      context: null,
      error: NextResponse.json(
        { error: error.message || 'Authentication failed' },
        { status: 401 }
      )
    }
  }
}

/**
 * Verify that booking belongs to user or user has admin access
 */
export async function verifyBookingAccess(
  bookingId: number,
  context: ApiRouteContext,
  req?: NextRequest
): Promise<{
  booking: any | null
  error: NextResponse | null
}> {
  try {
    const authHeader = req ? getAuthorizationHeader(req) : `Bearer ${context.userInfo.token || ''}`
    const options: RequestInit = authHeader ? { headers: { Authorization: authHeader } } : {}

    const bookingRes = await apiClient.getBooking(bookingId, options as any)
    if (!bookingRes.success || !bookingRes.data) {
      return {
        booking: null,
        error: NextResponse.json({ error: 'Booking not found' }, { status: 404 })
      }
    }

    const booking: any = bookingRes.data

    // Admin/Staff/Office can access any booking
    if (context.isAdmin || context.isStaff || context.isOffice) {
      return { booking, error: null }
    }

    // User can only access their own bookings
    if (context.isUser && String(booking.userId) !== String(context.userInfo.id)) {
      return {
        booking: null,
        error: NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return { booking, error: null }
  } catch (error: any) {
    return {
      booking: null,
      error: NextResponse.json(
        { error: error.message || 'Failed to verify booking access' },
        { status: 500 }
      )
    }
  }
}

/**
 * Common error handler
 */
export function handleApiError(error: any, defaultMessage = 'Internal server error'): NextResponse {
  console.error('API Error:', error)
  return NextResponse.json(
    { error: error.message || defaultMessage },
    { status: error.status || 500 }
  )
}

/**
 * Common success response
 */
export function successResponse(data: any, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status })
}

/**
 * Common error response
 */
export function errorResponse(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status })
}
