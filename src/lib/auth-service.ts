// Authentication service for managing auth state with backend API
import { apiClient } from './api-client'
import { cookieManager } from './http'

export interface AuthTokens {
  accessToken: string
  refreshToken?: string  // Optional - một số backend có thể không trả về refresh token
  expiresIn?: number
}

export interface UserInfo {
  id?: string
  email: string
  username?: string
  firstName?: string
  lastName?: string
  name?: string  // Computed from firstName + lastName
  picture?: string
  avatarUrl?: string
  role?: string
  roleName?: string[]  // Array of roles
  roles?: string[]  // Alias for roleName
  status?: string
  dob?: string
  address?: string
  phoneNumber?: string
}

// Map backend roles/departments to app route roles (FE)
// BE uses: ADMIN, MANAGER, STAFF, USER (plus some historical typos)
// Supports both ROLE_ADMIN_SYTEM and ADMIN_SYTEM formats
export const mapRoleToAppRole = (role?: string): 'admin' | 'office' | 'staff' | 'user' => {
  if (!role) return 'user'
  let r = role.trim().toUpperCase()
  // Strip ROLE_ prefix if present
  if (r.startsWith('ROLE_')) {
    r = r.substring(5)
  }
  // Admin variants
  if (['ADMIN', 'ADMIN_SYTEM'].includes(r)) return 'admin'
  // Manager/Office variants
  if (['ADMINISTRATIVE'].includes(r)) return 'office'
  // Staff variants (includes SECURITY typo)
  if (['STAFF','SECURITY'].includes(r)) return 'staff'
  // Lecturer/Guest/User -> user area
  if (['USER'].includes(r)) return 'user'
  return 'user'
}

export const getHighestAppRole = (roles: Array<string | undefined>): 'admin' | 'office' | 'staff' | 'user' => {
  const mapped = roles
    .filter(Boolean)
    .map(r => mapRoleToAppRole(String(r)))
  // Priority: admin > office > staff > user
  if (mapped.includes('admin')) return 'admin'
  if (mapped.includes('office')) return 'office'
  if (mapped.includes('staff')) return 'staff'
  return 'user'
}

class AuthService {
  private readonly ACCESS_TOKEN_KEY = 'auth_access_token'
  private readonly REFRESH_TOKEN_KEY = 'auth_refresh_token'
  private readonly USER_INFO_KEY = 'auth_user_info'

  // Get Google OAuth redirect URL from backend
  async getGoogleOAuthUrl(): Promise<string> {
    // Xác định callback URL (backend sẽ redirect về đây)
    // Phải khớp với redirectUri đã đăng ký trong Google OAuth Console
    let callbackUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/api/auth/callback/google`
      : 'http://localhost:3000/api/auth/callback/google'
    
    // Loại bỏ trailing slash nếu có và normalize
    const normalizedCallbackUrl = callbackUrl.replace(/\/$/, '')
    
    // Lưu redirectUri vào localStorage để sử dụng lại khi callback (persistent hơn sessionStorage)
    // Đảm bảo format nhất quán (không có trailing slash)
    if (typeof window !== 'undefined') {
      localStorage.setItem('oauth_redirect_uri', normalizedCallbackUrl)
      console.log('💾 Saved redirectUri to localStorage:', {
        redirectUri: normalizedCallbackUrl,
        length: normalizedCallbackUrl.length,
        origin: window.location.origin,
        timestamp: new Date().toISOString()
      })
    }
    
    // Scope mặc định cho Google OAuth
    const scope = 'openid email profile'
    
    console.log('🔗 Getting Google OAuth URL with redirectUri:', {
      redirectUri: normalizedCallbackUrl,
      scope: scope,
      origin: typeof window !== 'undefined' ? window.location.origin : 'server',
      willSendToBackend: normalizedCallbackUrl
    })
    
    // Gọi API với query parameters (sử dụng normalized URL)
    // Backend sẽ sử dụng redirectUri này để đăng ký với Google
    const response = await apiClient.getGoogleOAuthRedirectUrl(normalizedCallbackUrl, scope)
    
    // Log response để đảm bảo backend nhận đúng redirectUri
    if (response.success && response.data) {
      const data = response.data as any
      const redirectUrl = typeof data === 'string' 
        ? data 
        : data.redirectUrl || data.url || ''
      
      console.log('✅ Backend returned OAuth URL:', {
        hasRedirectUrl: !!redirectUrl,
        redirectUrlLength: redirectUrl.length,
        containsRedirectUri: redirectUrl.includes(normalizedCallbackUrl),
        // Log một phần của redirectUrl để verify
        redirectUrlPreview: redirectUrl.substring(0, 100) + '...'
      })
    }
    
    if (response.success && response.data) {
      // Backend trả về format: { redirectUrl: "..." }
      const data = response.data as any
      const redirectUrl = typeof data === 'string' 
        ? data 
        : data.redirectUrl || data.url || ''
      
      if (!redirectUrl) {
        throw new Error('Backend không trả về redirect URL')
      }
      
      console.log('✅ Got Google OAuth URL successfully')
      return redirectUrl
    }
    
    throw new Error(response.error || 'Không thể lấy Google OAuth URL')
  }

  // Handle OAuth callback - exchange code for tokens
  async handleOAuthCallback(code: string, state?: string): Promise<AuthTokens> {
    // Validate code
    if (!code || code.trim() === '') {
      throw new Error('Mã xác thực không hợp lệ. Vui lòng thử đăng nhập lại.')
    }

    // Decode code nếu bị encode (từ URL query params)
    let normalizedCode = code.trim()
    try {
      // Thử decode, nếu không được thì dùng code gốc
      normalizedCode = decodeURIComponent(normalizedCode)
    } catch {
      // Nếu decode fail, dùng code gốc
      normalizedCode = code.trim()
    }

    console.log('🔄 Calling outbound authentication API')
    console.log('📋 Code info:', {
      hasCode: !!normalizedCode,
      codeLength: normalizedCode.length,
      codePrefix: normalizedCode.substring(0, 10) + '...',
      originalCodeLength: code.length,
      isEncoded: code !== normalizedCode,
    })
    
    // Lấy redirectUri từ localStorage (đã lưu khi lấy OAuth URL)
    // Phải khớp CHÍNH XÁC với redirectUri đã gửi khi lấy OAuth URL
    let redirectUri: string = ''
    
    // Lấy redirectUri từ localStorage TRƯỚC (không tính toán lại)
    const savedRedirectUri = typeof window !== 'undefined' 
      ? localStorage.getItem('oauth_redirect_uri') 
      : null
    
    if (savedRedirectUri) {
      // Sử dụng redirectUri đã lưu (đã normalize khi lưu)
      redirectUri = savedRedirectUri.trim()
      console.log('✅ Using saved redirectUri from localStorage:', redirectUri)
    } else {
      // Fallback: tính toán lại từ origin hiện tại (chỉ khi không có trong storage)
      if (typeof window !== 'undefined') {
        redirectUri = `${window.location.origin}/api/auth/callback/google`
        console.warn('⚠️ RedirectUri not found in localStorage, using current origin:', redirectUri)
      } else {
        redirectUri = 'http://localhost:3000/api/auth/callback/google'
      }
    }
    
    // Normalize redirectUri: loại bỏ trailing slash, trim, và đảm bảo format nhất quán
    redirectUri = redirectUri.replace(/\/$/, '').trim()
    
    // Đảm bảo redirectUri khớp với các redirectUri đã đăng ký với Google
    // Các redirectUri hợp lệ (phải khớp với Google OAuth Console):
    const validRedirectUris = [
      'http://localhost:3000/api/auth/callback/google',
      'https://sorms-web.vercel.app/api/auth/callback/google'
    ]
    
    // Kiểm tra xem redirectUri có khớp với một trong các redirectUri hợp lệ không
    const isValidRedirectUri = validRedirectUris.some(validUri => {
      const normalizedValidUri = validUri.replace(/\/$/, '').trim()
      return normalizedValidUri === redirectUri || 
             normalizedValidUri.toLowerCase() === redirectUri.toLowerCase()
    })
    
    // Log chi tiết để debug
    console.log('🔍 RedirectUri debug:', {
      savedInStorage: savedRedirectUri,
      afterNormalization: redirectUri,
      currentOrigin: typeof window !== 'undefined' ? window.location.origin : 'server',
      currentUrl: typeof window !== 'undefined' ? window.location.href : 'server',
      match: savedRedirectUri === redirectUri,
      urlMatch: savedRedirectUri?.replace(/\/$/, '').trim() === redirectUri,
      redirectUriLength: redirectUri.length,
      savedLength: savedRedirectUri?.length,
      isValidRedirectUri: isValidRedirectUri,
      validRedirectUris: validRedirectUris,
      matchesValidUri: validRedirectUris.find(uri => uri.replace(/\/$/, '').trim() === redirectUri)
    })
    
    // Đảm bảo redirectUri không rỗng
    if (!redirectUri || redirectUri.length === 0) {
      throw new Error('RedirectUri không hợp lệ. Không thể xác định redirectUri.')
    }
    
    // Cảnh báo nếu redirectUri không khớp với các redirectUri đã đăng ký
    if (!isValidRedirectUri) {
      console.warn('⚠️ RedirectUri không khớp với các redirectUri đã đăng ký với Google:', {
        using: redirectUri,
        validUris: validRedirectUris
      })
      // Vẫn tiếp tục, vì có thể backend đã đăng ký redirectUri khác
    }
    
    console.log('📤 Sending OAuth callback request:', {
      hasCode: !!code,
      codeLength: code.length,
      hasState: !!state,
      redirectUri,
      origin: typeof window !== 'undefined' ? window.location.origin : 'server',
    })
    
    // Request body theo API spec: { code: "string", redirectUri: "string" }
    const requestBody = {
      code: normalizedCode,
      redirectUri: redirectUri,  // Phải khớp CHÍNH XÁC với redirectUri đã gửi khi lấy OAuth URL
      // Không gửi state vì API chỉ yêu cầu code và redirectUri
    }
    
    console.log('📦 Request body structure:', {
      hasCode: !!requestBody.code,
      codeLength: requestBody.code.length,
      codePrefix: requestBody.code.substring(0, 20) + '...',
      codeSuffix: '...' + requestBody.code.substring(requestBody.code.length - 10),
      hasRedirectUri: !!requestBody.redirectUri,
      redirectUri: requestBody.redirectUri,
      redirectUriLength: requestBody.redirectUri.length,
      redirectUriExact: JSON.stringify(requestBody.redirectUri),  // Log exact string để verify
      hasState: !!(state && state.trim()),  // Log state từ parameter, không phải từ requestBody
      fullBody: JSON.stringify(requestBody, null, 2),
      // So sánh với redirectUri đã lưu
      matchesSaved: savedRedirectUri === requestBody.redirectUri,
      savedRedirectUri: savedRedirectUri
    })
    
    // Validate request body trước khi gửi
    if (!requestBody.code || requestBody.code.length === 0) {
      throw new Error('Mã xác thực không hợp lệ. Code không được để trống.')
    }
    
    if (!requestBody.redirectUri || requestBody.redirectUri.length === 0) {
      throw new Error('RedirectUri không hợp lệ. RedirectUri không được để trống.')
    }
    
    // KHÔNG xóa redirectUri ngay bây giờ - để lại để debug và có thể retry
    // Chỉ xóa sau khi thành công
    // if (typeof window !== 'undefined') {
    //   localStorage.removeItem('oauth_redirect_uri')
    // }
    
    console.log('📤 Final request body before sending:', JSON.stringify(requestBody, null, 2))
    
    // Lưu code vào sessionStorage để tránh sử dụng lại (OAuth code chỉ dùng 1 lần)
    const codeUsedKey = `oauth_code_used_${normalizedCode.substring(0, 20)}`
    if (typeof window !== 'undefined') {
      const codeUsed = sessionStorage.getItem(codeUsedKey)
      if (codeUsed === 'true') {
        throw new Error('Mã xác thực đã được sử dụng. Vui lòng thử đăng nhập lại.')
      }
      // Đánh dấu code đã được sử dụng
      sessionStorage.setItem(codeUsedKey, 'true')
    }
    
    const response = await apiClient.outboundAuth(requestBody)
    
    // Chỉ xóa redirectUri sau khi thành công
    if (response.success && typeof window !== 'undefined') {
      localStorage.removeItem('oauth_redirect_uri')
    } else {
      // Nếu fail, xóa flag để có thể retry với code mới
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(codeUsedKey)
      }
    }

    console.log('📥 Outbound auth response:', {
      success: response.success,
      hasData: !!response.data,
      error: response.error,
      dataKeys: response.data ? Object.keys(response.data as any) : [],
      fullError: response.error,
    })

    // Kiểm tra response success
    if (!response.success) {
      const errorMsg = response.error || 'Xác thực thất bại'
      console.error('❌ Outbound auth failed:', errorMsg)
      console.error('📋 Full response:', JSON.stringify(response, null, 2))
      console.error('📋 Request details:', {
        codeLength: code.length,
        codePrefix: code.substring(0, 20),
        redirectUri,
        hasState: !!state,
      })
      
      // Cải thiện error message dựa trên error code
      if (errorMsg.toLowerCase().includes('unauthenticated') || errorMsg.toLowerCase().includes('au0001')) {
        const detailedError = `Xác thực thất bại (401 Unauthenticated). 
        
Nguyên nhân có thể:
- Mã xác thực đã hết hạn (OAuth codes chỉ valid trong vài phút)
- Mã xác thực đã được sử dụng (mỗi code chỉ dùng 1 lần)
- RedirectUri không khớp với redirectUri đã đăng ký

Vui lòng thử đăng nhập lại.`
        throw new Error(detailedError)
      }
      
      throw new Error(errorMsg)
    }

    // Kiểm tra response.data
    if (!response.data) {
      console.error('❌ Response data is null or undefined')
      throw new Error('Backend không trả về dữ liệu xác thực')
    }

    const data = response.data as any
    console.log('📦 Response data structure:', {
      authenticated: data.authenticated,
      hasToken: !!(data.token || data.accessToken || data.access_token),
      hasAccountInfo: !!data.accountInfo,
      keys: Object.keys(data),
      fullData: JSON.stringify(data, null, 2),  // Log toàn bộ data để debug
    })

    // Backend trả về format: { authenticated: true, token: "string", accountInfo: {...} }
    // Kiểm tra authenticated flag
    if (data.authenticated === false) {
      console.error('❌ Authentication failed: authenticated flag is false')
      throw new Error('Xác thực thất bại. Vui lòng thử đăng nhập lại.')
    }

    // Extract token (ưu tiên data.token theo API spec)
    const accessToken = data.token || data.accessToken || data.access_token

    // Validate access token (bắt buộc)
    if (!accessToken) {
      console.error('❌ Access token is missing in response:', data)
      throw new Error('Backend không trả về access token. Vui lòng kiểm tra lại cấu hình.')
    }

    const tokens: AuthTokens = {
      accessToken,
      // Backend không trả về refresh token trong OAuth flow
      refreshToken: undefined,
      expiresIn: data.expiresIn || data.expires_in,
    }

    console.log('✅ Tokens extracted successfully:', {
      hasAccessToken: !!tokens.accessToken,
      expiresIn: tokens.expiresIn,
    })

    // Lưu tokens
    this.setTokens(tokens)

    // Lưu user info từ accountInfo
    // Format: accountInfo có { id, email, firstName, lastName, avatarUrl, roleName[] }
    const accountInfo = data.accountInfo
    if (accountInfo) {
      console.log('💾 Saving user info from accountInfo')
      
      // Parse roleName array (theo API spec)
      const roleNameArray = Array.isArray(accountInfo.roleName) ? accountInfo.roleName : []
      const rolesArray = Array.isArray(accountInfo.roles) ? accountInfo.roles : []
      const allRoles = roleNameArray.length > 0 ? roleNameArray : rolesArray
      
      const userInfo: UserInfo = {
        id: accountInfo.id || '',
        email: accountInfo.email || '',
        username: accountInfo.username,
        firstName: accountInfo.firstName,
        lastName: accountInfo.lastName,
        name: accountInfo.firstName && accountInfo.lastName 
          ? `${accountInfo.firstName} ${accountInfo.lastName}`
          : accountInfo.firstName || accountInfo.lastName || accountInfo.email || '',
        picture: accountInfo.avatarUrl || accountInfo.picture,
        avatarUrl: accountInfo.avatarUrl,
        role: allRoles.length > 0 ? String(allRoles[0]) : accountInfo.role,
        roleName: allRoles.length > 0 ? allRoles : (roleNameArray.length > 0 ? roleNameArray : []),
        roles: allRoles.length > 0 ? allRoles : (rolesArray.length > 0 ? rolesArray : roleNameArray),
      }
      
      console.log('💾 Parsed user info:', {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        roles: userInfo.roles,
        role: userInfo.role,
      })
      
      // Lưu userInfo với token (setUserInfo sẽ tự động thêm token)
      this.setUserInfo(userInfo)
    } else if (data.email || data.name) {
      // Fallback: nếu user info nằm trực tiếp trong data (legacy format)
      console.log('💾 Saving user info from data root (fallback)')
      this.setUserInfo({
        email: data.email || '',
        name: data.name,
        picture: data.picture || data.avatarUrl,
        avatarUrl: data.avatarUrl,
        role: data.role,
        status: data.status,
      })
    } else {
      console.warn('⚠️ No accountInfo found in response, user info will be fetched via introspect')
    }

    return tokens
  }

  // Set authentication tokens
  setTokens(tokens: AuthTokens): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken)
      // Set cookie for interceptor usage
      try { cookieManager.setAccessToken(tokens.accessToken) } catch {}
      if (tokens.refreshToken) {
        localStorage.setItem(this.REFRESH_TOKEN_KEY, tokens.refreshToken)
      } else {
        // Xóa refresh token nếu không có (trường hợp backend không trả về)
        localStorage.removeItem(this.REFRESH_TOKEN_KEY)
      }
    }
  }

  // Get access token
  getAccessToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.ACCESS_TOKEN_KEY)
    }
    return null
  }

  // Get refresh token
  getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY)
    }
    return null
  }

  // Refresh access token
  async refreshAccessToken(): Promise<AuthTokens> {
    const currentToken = this.getAccessToken()
    if (!currentToken) {
      throw new Error('Không có access token. Vui lòng đăng nhập lại.')
    }

    // Backend yêu cầu gửi token hiện tại trong body
    const response = await apiClient.refreshToken(currentToken)
    if (response.success && response.data) {
      const data = response.data as any
      
      // Backend trả về format: { token, accountInfo }
      const newToken = data.token || data.accessToken || data.access_token
      
      if (!newToken) {
        throw new Error('Backend không trả về access token mới sau khi refresh')
      }

      const tokens: AuthTokens = {
        accessToken: newToken,
        refreshToken: undefined,  // Backend không trả về refresh token
        expiresIn: data.expiresIn || data.expires_in,
      }

      this.setTokens(tokens)

      // Cập nhật user info nếu có
      if (data.accountInfo) {
        const accountInfo = data.accountInfo
        const userInfo: UserInfo = {
          id: accountInfo.id,
          email: accountInfo.email || '',
          username: accountInfo.username,
          firstName: accountInfo.firstName,
          lastName: accountInfo.lastName,
          name: accountInfo.firstName && accountInfo.lastName 
            ? `${accountInfo.firstName} ${accountInfo.lastName}`
            : accountInfo.firstName || accountInfo.lastName || accountInfo.email,
          picture: accountInfo.avatarUrl || accountInfo.picture,
          avatarUrl: accountInfo.avatarUrl,
          role: accountInfo.roleName?.[0] || accountInfo.roles?.[0],
          roleName: accountInfo.roleName || accountInfo.roles,
          roles: accountInfo.roleName || accountInfo.roles,
        }
        // Lưu userInfo với token mới (setUserInfo sẽ tự động thêm token mới)
        this.setUserInfo(userInfo)
      }

      return tokens
    }

    throw new Error(response.error || 'Làm mới token thất bại')
  }

  // Set user info and sync cookies (role + user_info)
  setUserInfo(user: UserInfo): void {
    if (typeof window !== 'undefined') {
      // Lấy token hiện tại để lưu vào accountInfo
      const currentToken = this.getAccessToken()
      
      // Tạo userInfo với token nếu có
      const userInfoWithToken = currentToken 
        ? { ...user, token: currentToken }  // ✅ Thêm token vào accountInfo
        : user
      
      try {
        localStorage.setItem(this.USER_INFO_KEY, JSON.stringify(userInfoWithToken))
      } catch {}

      // Determine app role from backend roles
      const roles = user.roles || user.roleName || (user.role ? [user.role] : [])
      const firstRole = Array.isArray(roles) && roles.length > 0 ? String(roles[0]) : (user.role || 'USER')
      const appRole = mapRoleToAppRole(firstRole)

      // Persist role for RoleGuard and server-middleware
      try { localStorage.setItem('userRole', appRole) } catch {}
      try { cookieManager.setRole(appRole) } catch {}

      // Save user info in cookie for convenience (small, not secure storage)
      // Lưu cả token vào cookie nếu có
      const cookieUserInfo: any = { id: user.id, email: user.email, name: user.name, role: appRole }
      if (currentToken) {
        cookieUserInfo.token = currentToken  // ✅ Thêm token vào cookie userInfo
      }
      try { cookieManager.setUserInfo(cookieUserInfo) } catch {}
    }
  }

  // Get user info
  getUserInfo(): UserInfo | null {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem(this.USER_INFO_KEY)
      if (userStr) {
        try {
          return JSON.parse(userStr) as UserInfo
        } catch {
          return null
        }
      }
    }
    return null
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.getAccessToken() !== null
  }

  // Introspect token (validate token with backend)
  async introspectToken(): Promise<UserInfo | null> {
    const token = this.getAccessToken()
    if (!token) {
      return null
    }

    try {
      const response = await apiClient.introspect(token)
      if (response.success && response.data) {
        const data = response.data as any
        
        // Backend trả về format: { valid, accountInfo }
        if (!data.valid) {
          console.warn('⚠️ Token introspection: token is invalid')
          return null
        }

        // Backend trả về format: { valid, accountId, username, roles, accountInfo }
        // Format mới: data có { valid, accountId, username, roles[], accountInfo: {...} }
        // accountInfo có: { id, username, email, firstName, lastName, dob, address, phoneNumber, avatarUrl, roles[] }
        
        const accountInfo = data.accountInfo || {}
        const rolesFromRoot = Array.isArray(data.roles) ? data.roles : []
        const rolesFromAccountInfo = Array.isArray(accountInfo.roles) ? accountInfo.roles : []
        const roleNameFromAccountInfo = Array.isArray(accountInfo.roleName) ? accountInfo.roleName : []
        
        // Ưu tiên roles từ root level, sau đó từ accountInfo.roles, cuối cùng là accountInfo.roleName
        const allRoles = rolesFromRoot.length > 0 
          ? rolesFromRoot 
          : rolesFromAccountInfo.length > 0 
            ? rolesFromAccountInfo 
            : roleNameFromAccountInfo
        
        // Lấy role đầu tiên để map sang app role
        const firstRole = allRoles.length > 0 
          ? String(allRoles[0]) 
          : accountInfo.role || 'user'
        
        const appRole = mapRoleToAppRole(firstRole)
        
        const userInfo: UserInfo = {
          id: accountInfo.id || data.accountId || '',
          email: accountInfo.email || '',
          username: accountInfo.username || data.username,
          firstName: accountInfo.firstName,
          lastName: accountInfo.lastName,
          name: accountInfo.firstName && accountInfo.lastName 
            ? `${accountInfo.firstName} ${accountInfo.lastName}`
            : accountInfo.firstName || accountInfo.lastName || accountInfo.email || data.username || '',
          picture: accountInfo.avatarUrl || accountInfo.picture,
          avatarUrl: accountInfo.avatarUrl,
          role: appRole,
          roleName: allRoles.length > 0 ? allRoles : (roleNameFromAccountInfo.length > 0 ? roleNameFromAccountInfo : []),
          roles: allRoles.length > 0 ? allRoles : (rolesFromAccountInfo.length > 0 ? rolesFromAccountInfo : roleNameFromAccountInfo),
          dob: accountInfo.dob,
          address: accountInfo.address,
          phoneNumber: accountInfo.phoneNumber,
        }
        
        console.log('📦 Parsed user info from introspect:', {
          id: userInfo.id,
          email: userInfo.email,
          roles: userInfo.roles,
          role: userInfo.role
        })
        
        this.setUserInfo(userInfo)
        return userInfo
      }
    } catch (error) {
      console.error('Token introspection failed:', error)
    }

    return null
  }
  
  // Get token from accountInfo (fallback method)
  getAccessTokenFromAccountInfo(): string | null {
    try {
      const userInfo = this.getUserInfo()
      if (userInfo && (userInfo as any).token) {
        return (userInfo as any).token
      }
    } catch {
      // ignore
    }
    return null
  }

  // Login with username/password
  async login(username: string, password: string): Promise<AuthTokens> {
    console.log('🔐 Logging in with username/password')
    
    const response = await apiClient.login({ username, password })
    
    if (!response.success || !response.data) {
      const errorMsg = response.error || 'Đăng nhập thất bại'
      console.error('❌ Login failed:', errorMsg)
      throw new Error(errorMsg)
    }
    
    const data = response.data as any
    console.log('📦 Login response data:', {
      hasToken: !!(data.token || data.accessToken || data.access_token),
      keys: Object.keys(data),
    })
    
    // Backend trả về format: { token, accountInfo }
    const accessToken = data.token || data.accessToken || data.access_token
    const accountInfo = data.accountInfo || data.user
    
    if (!accessToken) {
      console.error('❌ Access token is missing in response:', data)
      throw new Error('Backend không trả về access token')
    }
    
    const tokens: AuthTokens = {
      accessToken,
      refreshToken: data.refreshToken || data.refresh_token,
      expiresIn: data.expiresIn || data.expires_in,
    }
    
    // Lưu tokens
    this.setTokens(tokens)
    
    // Lưu user info
    if (accountInfo) {
      const userInfo: UserInfo = {
        id: accountInfo.id,
        email: accountInfo.email || '',
        username: accountInfo.username,
        firstName: accountInfo.firstName,
        lastName: accountInfo.lastName,
        name: accountInfo.firstName && accountInfo.lastName 
          ? `${accountInfo.firstName} ${accountInfo.lastName}`
          : accountInfo.firstName || accountInfo.lastName || accountInfo.email,
        picture: accountInfo.avatarUrl || accountInfo.picture,
        avatarUrl: accountInfo.avatarUrl,
        role: accountInfo.roleName?.[0] || accountInfo.roles?.[0],
        roleName: accountInfo.roleName || accountInfo.roles,
        roles: accountInfo.roleName || accountInfo.roles,
        status: accountInfo.status,
        dob: accountInfo.dob,
        address: accountInfo.address,
        phoneNumber: accountInfo.phoneNumber,
      }
      this.setUserInfo(userInfo)
    }
    
    console.log('✅ Login successful')
    return tokens
  }

  // Logout
  async logout(): Promise<void> {
    const token = this.getAccessToken()
    
    // Gọi backend API để logout
    try {
      if (token) {
        await apiClient.logout(token)
      }
    } catch (error) {
      console.error('Logout API call failed:', error)
      // Vẫn tiếp tục xóa local storage dù API call fail
    }

    // Xóa tokens và user info
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.ACCESS_TOKEN_KEY)
      localStorage.removeItem(this.REFRESH_TOKEN_KEY)
      localStorage.removeItem(this.USER_INFO_KEY)
      
      // Xóa các thông tin cũ từ NextAuth (nếu có)
      localStorage.removeItem('userRole')
      localStorage.removeItem('isLoggedIn')
      localStorage.removeItem('userName')
      localStorage.removeItem('userEmail')
      localStorage.removeItem('userPicture')
      
      sessionStorage.removeItem('userRole')
      sessionStorage.removeItem('previousPage')
      
      // Xóa cookies (role/access_token/user_info)
      try { cookieManager.clearAll() } catch {}
      // Legacy cookies
      document.cookie = 'approved=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
  }

  // Clear all auth data (without API call)
  clearAuth(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.ACCESS_TOKEN_KEY)
      localStorage.removeItem(this.REFRESH_TOKEN_KEY)
      localStorage.removeItem(this.USER_INFO_KEY)
    }
  }
}

// Export singleton instance
export const authService = new AuthService()

