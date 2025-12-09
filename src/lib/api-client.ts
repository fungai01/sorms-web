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

      const incomingHeaders = options.headers as Record<string, string> | Headers | undefined
      let authHeaderFromOptions: string | null = null
      
      if (incomingHeaders) {
        if (incomingHeaders instanceof Headers) {
          authHeaderFromOptions = incomingHeaders.get('authorization') || 
                                  incomingHeaders.get('Authorization') ||
                                  incomingHeaders.get('AUTHORIZATION') ||
                                  null
        } else if (typeof incomingHeaders === 'object') {
          authHeaderFromOptions = incomingHeaders['authorization'] || 
                                  incomingHeaders['Authorization'] || 
                                  incomingHeaders['AUTHORIZATION'] ||
                                  null
        }
      }
      
      let token: string | null = null
      
      if (authHeaderFromOptions && authHeaderFromOptions.startsWith('Bearer ')) {
        token = authHeaderFromOptions.substring(7)
      } else {
        try {
          const userInfo = authService.getUserInfo()
          if (userInfo && (userInfo as any).token) {
            token = (userInfo as any).token
          }
        } catch {}
        
        if (!token) {
          token = authService.getAccessToken()
        }
        
        if (!token) {
          try {
            const mod: any = await import('next/headers')
            if (typeof mod.cookies === 'function') {
              const maybePromise = mod.cookies()
              const cookieStore =
                typeof maybePromise?.then === 'function' ? await maybePromise : maybePromise
              
              const cookieToken = cookieStore?.get?.('access_token')?.value || 
                                 cookieStore?.get?.('auth_access_token')?.value
              
              if (cookieToken) {
                token = cookieToken
              }
            }
          } catch (e) {
            // ignore
          }
        }
      }
      
      const publicEndpoints = [
        '/auth/outbound/authentication',
        '/auth/mobile/outbound/authentication',
        '/auth/login',
        '/auth/refresh',
      ]
      
      const isPublicEndpoint = publicEndpoints.some(publicPath => endpoint.includes(publicPath))
      
      if (!token && !isPublicEndpoint) {
        console.warn('[API Client] No access token available for request:', endpoint)
      }
      
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
        const alreadyRetried = (options as any)?._retried === true
        if (response.status === 401 && typeof window !== 'undefined' && !alreadyRetried) {
          try {
            await authService.refreshAccessToken()
            const retryOptions: RequestInit & { _retried?: boolean } = { ...(options || {}), _retried: true }
            return await this.request<T>(endpoint, retryOptions)
          } catch (refreshErr) {
            console.error('[API Client] Refresh token failed:', refreshErr)
          }
        }

        let errorMessage = `HTTP error! status: ${response.status}`
        let errorData: any = null
        let rawResponseText: string = ''
        try {
          const responseClone = response.clone()
          rawResponseText = await responseClone.text()
          try {
            errorData = JSON.parse(rawResponseText)
          } catch (parseErr) {
            errorMessage = rawResponseText || errorMessage
          }
          
          if (errorData) {
            if (errorData.responseCode) {
              errorMessage = getErrorMessage(
                String(errorData.responseCode),
                errorData.message || errorData.error || ''
              )
            } else if (errorData.message) {
              errorMessage = errorData.message
            } else if (errorData.error) {
              const mappedError = getErrorMessage(String(errorData.error), '')
              errorMessage = mappedError !== 'Có lỗi xảy ra. Vui lòng thử lại.' ? mappedError : errorData.error
            }
          }
        } catch (parseError) {
          console.error(`[API Client] ${endpoint} - Failed to parse error response:`, parseError)
          errorMessage = response.statusText || errorMessage
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
          const errorMessage = getErrorMessage(
            String(data.responseCode),
            data.message || data.error || ''
          )
          return {
            success: false,
            error: String(errorMessage),
          }
        }
      }
      
      if (data.error) {
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
      
      return {
        success: true,
        data,
      }
    } catch (error) {
      console.error(`[API Client] Request failed for ${endpoint}:`, error)

      let errorMessage = 'Unknown error occurred'

      if (error instanceof TypeError) {
        if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
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

  async deleteBooking(id: number) {
    // Xóa booking theo spec mới: DELETE /bookings/{id}
    return this.delete(`/bookings/${id}`)
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

    const payload = {
      bookingId: orderData.bookingId,
      orderId: orderData.orderId, // optional
      serviceId: orderData.serviceId,
      quantity: orderData.quantity,
      assignedStaffId: orderData.assignedStaffId,
      requestedBy: orderData.requestedBy, // optional
      serviceTime: st, // BE expects LocalDateTime without timezone
      note: orderData.note || ''
    }
    return this.post('/orders/service', payload)
  }

  async addOrderItem(orderId: number, itemData: any) {
    return this.post(`/orders/${orderId}/items`, itemData)
  }

  async confirmOrder(orderId: number) {
    return this.post(`/orders/${orderId}/confirm`)
  }

  // Payments
  async createPayment(payload: { serviceOrderId: number; method: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'WALLET'; returnUrl?: string; cancelUrl?: string }) {
    return this.post('/payments/create', payload)
  }

  async getPayment(transactionId: number | string) {
    return this.get(`/payments/${transactionId}`)
  }

  async getPaymentTransactions() {
    return { success: false, error: 'API not implemented yet' }
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
  async getRoles(params?: { name?: string; code?: string; description?: string; isActive?: boolean; page?: number; size?: number }) {
    const queryParams = new URLSearchParams()
    if (params?.name) queryParams.set('name', params.name)
    if (params?.code) queryParams.set('code', params.code)
    if (params?.description) queryParams.set('description', params.description)
    if (params?.isActive !== undefined) queryParams.set('isActive', params.isActive.toString())
    if (params?.page !== undefined) queryParams.set('page', params.page.toString())
    if (params?.size !== undefined) queryParams.set('size', params.size.toString())

    const endpoint = `/roles/search${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    return this.get(endpoint)
  }

  async getRole(id: string) {
    return this.get(`/roles/${id}`)
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
      if (v === 'ADMIN_SYTEM') return 'ADMIN_SYTEM'
      if (v === 'STAFF') return 'STAFF'
      if (v === 'ADMINISTRATIVE') return 'ADMINISTRATIVE'
      if (v === 'SERCURITY') return 'SECURITY'
      if (v === 'USER') return 'USER'
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
