# Tự Động Thêm Bearer Token Vào Header Request

## Tổng Quan

**Frontend đã có cơ chế tự động thêm Bearer token vào header request** thông qua:
1. `authFetch` interceptor trong `http.ts`
2. `api-client.ts` tự động thêm Authorization header

## 1. Hiện Trạng

### 1.1. authFetch Interceptor

**File**: `src/lib/http.ts`

```typescript
export async function authFetch(input: string | URL | Request, init?: AuthFetchOptions): Promise<Response> {
  const options: RequestInit = { ...init }
  
  // Convert headers to Headers instance
  const headers = new Headers()
  
  // Merge headers from options
  if (options.headers) {
    // ... merge logic ...
  }

  if (!init?.skipAuth) {
    // Check if Authorization header already exists
    if (!headers.has('Authorization') && !headers.has('authorization')) {
      // Get token from cookie or localStorage
      let token = cookieManager.getAccessToken()  // ✅ Từ cookie
      if (!token && typeof window !== 'undefined') {
        token = localStorage.getItem('auth_access_token')  // ✅ Từ localStorage
      }
      
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)  // ✅ Tự động thêm Bearer
        console.log('[authFetch] Added Authorization header from cookie/localStorage')
      }
    }
  }

  options.headers = headers
  return fetch(input as any, options)
}
```

**Đặc điểm:**
- ✅ Tự động lấy token từ cookie (`access_token`)
- ✅ Fallback lấy token từ localStorage (`auth_access_token`)
- ✅ Tự động thêm `Authorization: Bearer <token>` vào header
- ✅ Skip cho public endpoints

### 1.2. API Client

**File**: `src/lib/api-client.ts`

```typescript
private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  // Extract token
  let token: string | null = null
  
  // 1. Priority: Token from options.headers (Next.js API route)
  if (authHeaderFromOptions && authHeaderFromOptions.startsWith('Bearer ')) {
    token = authHeaderFromOptions.substring(7)
  } else {
    // 2. Priority: Get token from authService (client-side)
    token = authService.getAccessToken()  // ✅ Từ authService
    
    // 3. Priority: Get token from server cookies (Next.js API route)
    if (!token) {
      // Try next/headers cookies...
    }
  }
  
  // Add Authorization header if we have token
  if (token) {
    mergedHeaders['Authorization'] = `Bearer ${token}`  // ✅ Tự động thêm Bearer
  }
  
  // Use authFetch for actual request
  const response = await authFetch(url, {
    method: options.method || 'GET',
    headers: mergedHeaders,
    body: options.body,
    ...restOptions
  })
}
```

**Đặc điểm:**
- ✅ Tự động lấy token từ `authService.getAccessToken()`
- ✅ Fallback lấy token từ server cookies (Next.js API route)
- ✅ Tự động thêm `Authorization: Bearer <token>` vào header
- ✅ Sử dụng `authFetch` để đảm bảo token được thêm

### 1.3. AuthService

**File**: `src/lib/auth-service.ts`

```typescript
class AuthService {
  private readonly ACCESS_TOKEN_KEY = 'auth_access_token'
  
  // Get token from localStorage
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(this.ACCESS_TOKEN_KEY)  // ✅ Lấy từ localStorage
    } catch {
      return null
    }
  }
  
  // Save token after login
  async handleOAuthCallback(code: string, state?: string): Promise<AuthTokens> {
    // ... exchange code for token ...
    
    // Save token
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, token)  // ✅ Lưu vào localStorage
      cookieManager.setAccessToken(token)  // ✅ Lưu vào cookie
    }
    
    return { accessToken: token }
  }
}
```

**Đặc điểm:**
- ✅ Lưu token vào localStorage (`auth_access_token`)
- ✅ Lưu token vào cookie (`access_token`)
- ✅ Cung cấp `getAccessToken()` để lấy token

## 2. Flow Tự Động Thêm Bearer Token

### 2.1. Sau Khi Đăng Nhập

```
1. User đăng nhập thành công
   ↓
2. Backend trả về: { token: "eyJhbGciOiJ...", accountInfo: {...} }
   ↓
3. Frontend lưu token:
   - localStorage.setItem('auth_access_token', token)  ✅
   - cookieManager.setAccessToken(token)  ✅
   ↓
4. Token đã được lưu
```

### 2.2. Khi Gọi API

```
1. Frontend gọi: apiClient.getRooms()
   ↓
2. api-client.ts request() method:
   - token = authService.getAccessToken()  ✅ Lấy từ localStorage
   - mergedHeaders['Authorization'] = `Bearer ${token}`  ✅ Thêm Bearer
   ↓
3. Gọi authFetch(url, { headers: mergedHeaders })
   ↓
4. authFetch interceptor:
   - Check nếu chưa có Authorization header
   - token = cookieManager.getAccessToken() || localStorage.getItem('auth_access_token')
   - headers.set('Authorization', `Bearer ${token}`)  ✅ Thêm Bearer
   ↓
5. fetch() với Authorization header
   ↓
6. Backend nhận: Authorization: Bearer <token>
   ✅ Token đã được tự động thêm
```

## 3. Tự Động Lấy Token Từ accountInfo

### 3.1. Hiện Tại

**Token được lưu riêng, không nằm trong accountInfo:**

```typescript
// Sau khi login
const response = {
  authenticated: true,
  token: "eyJhbGciOiJ...",  // ✅ Token riêng
  accountInfo: {
    id: "1",
    email: "user@example.com",
    roleName: ["admin", "user"]
    // ❌ KHÔNG CÓ token trong accountInfo
  }
}

// Lưu token
localStorage.setItem('auth_access_token', response.token)  // ✅ Lưu token riêng
localStorage.setItem('auth_user_info', JSON.stringify(response.accountInfo))  // ✅ Lưu accountInfo riêng
```

### 3.2. Nếu Muốn Lấy Token Từ accountInfo

**Có thể lưu token vào accountInfo:**

```typescript
// Option 1: Lưu token vào accountInfo
const accountInfoWithToken = {
  ...response.accountInfo,
  token: response.token  // ✅ Thêm token vào accountInfo
}

localStorage.setItem('auth_user_info', JSON.stringify(accountInfoWithToken))

// Lấy token từ accountInfo
const userInfo = JSON.parse(localStorage.getItem('auth_user_info') || '{}')
const token = userInfo.token  // ✅ Lấy token từ accountInfo
```

**Nhưng không khuyến nghị vì:**
- ❌ Token và accountInfo nên tách biệt
- ❌ Token có thể refresh, accountInfo không đổi
- ❌ Hiện tại đã hoạt động tốt

## 4. Cải Thiện: Tự Động Thêm Bearer Token Từ accountInfo

### 4.1. Nếu Muốn Lấy Token Từ accountInfo

**Có thể cập nhật `authFetch` hoặc `api-client.ts`:**

```typescript
// Option 1: Cập nhật authFetch
export async function authFetch(input: string | URL | Request, init?: AuthFetchOptions): Promise<Response> {
  const headers = new Headers()
  
  // ... merge headers ...
  
  if (!init?.skipAuth && !headers.has('Authorization')) {
    let token: string | null = null
    
    // Priority 1: Token từ accountInfo (nếu có)
    try {
      const userInfo = cookieManager.getUserInfo()
      if (userInfo && userInfo.token) {
        token = userInfo.token
        console.log('[authFetch] Token from accountInfo')
      }
    } catch {}
    
    // Priority 2: Token từ cookie
    if (!token) {
      token = cookieManager.getAccessToken()
      console.log('[authFetch] Token from cookie')
    }
    
    // Priority 3: Token từ localStorage
    if (!token && typeof window !== 'undefined') {
      token = localStorage.getItem('auth_access_token')
      console.log('[authFetch] Token from localStorage')
    }
    
    // Priority 4: Token từ accountInfo trong localStorage
    if (!token && typeof window !== 'undefined') {
      try {
        const userInfoStr = localStorage.getItem('auth_user_info')
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr)
          if (userInfo.token) {
            token = userInfo.token
            console.log('[authFetch] Token from accountInfo in localStorage')
          }
        }
      } catch {}
    }
    
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }
  
  options.headers = headers
  return fetch(input as any, options)
}
```

### 4.2. Cập Nhật AuthService Để Lưu Token Vào accountInfo

```typescript
class AuthService {
  async handleOAuthCallback(code: string, state?: string): Promise<AuthTokens> {
    // ... exchange code ...
    
    const response = {
      authenticated: true,
      token: "...",
      accountInfo: { ... }
    }
    
    // Lưu token riêng
    localStorage.setItem(this.ACCESS_TOKEN_KEY, response.token)
    cookieManager.setAccessToken(response.token)
    
    // Lưu accountInfo với token (optional)
    const accountInfoWithToken = {
      ...response.accountInfo,
      token: response.token  // ✅ Thêm token vào accountInfo
    }
    localStorage.setItem(this.USER_INFO_KEY, JSON.stringify(accountInfoWithToken))
    cookieManager.setUserInfo(accountInfoWithToken)
    
    return { accessToken: response.token }
  }
  
  // Get token từ accountInfo (fallback)
  getAccessTokenFromAccountInfo(): string | null {
    try {
      const userInfo = this.getUserInfo()
      return userInfo?.token || null  // ✅ Lấy token từ accountInfo
    } catch {
      return null
    }
  }
}
```

## 5. Kết Luận

### Hiện Tại:

**Frontend đã tự động thêm Bearer token:**
- ✅ `authFetch` tự động lấy token từ cookie/localStorage
- ✅ `api-client.ts` tự động lấy token từ `authService`
- ✅ Tự động thêm `Authorization: Bearer <token>` vào header
- ✅ Hoạt động tốt

### Nếu Muốn Lấy Token Từ accountInfo:

**Có thể:**
1. ✅ Lưu token vào accountInfo khi login
2. ✅ Cập nhật `authFetch` để ưu tiên lấy token từ accountInfo
3. ✅ Fallback về cookie/localStorage nếu không có trong accountInfo

**Nhưng không khuyến nghị vì:**
- ❌ Token và accountInfo nên tách biệt
- ❌ Hiện tại đã hoạt động tốt
- ❌ Thêm phức tạp không cần thiết

### Recommendation:

**Giữ nguyên cách hiện tại:**
- ✅ Token lưu riêng trong localStorage/cookie
- ✅ accountInfo lưu riêng
- ✅ `authFetch` và `api-client.ts` tự động thêm Bearer token
- ✅ Hoạt động tốt, không cần thay đổi


## Tổng Quan

**Frontend đã có cơ chế tự động thêm Bearer token vào header request** thông qua:
1. `authFetch` interceptor trong `http.ts`
2. `api-client.ts` tự động thêm Authorization header

## 1. Hiện Trạng

### 1.1. authFetch Interceptor

**File**: `src/lib/http.ts`

```typescript
export async function authFetch(input: string | URL | Request, init?: AuthFetchOptions): Promise<Response> {
  const options: RequestInit = { ...init }
  
  // Convert headers to Headers instance
  const headers = new Headers()
  
  // Merge headers from options
  if (options.headers) {
    // ... merge logic ...
  }

  if (!init?.skipAuth) {
    // Check if Authorization header already exists
    if (!headers.has('Authorization') && !headers.has('authorization')) {
      // Get token from cookie or localStorage
      let token = cookieManager.getAccessToken()  // ✅ Từ cookie
      if (!token && typeof window !== 'undefined') {
        token = localStorage.getItem('auth_access_token')  // ✅ Từ localStorage
      }
      
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)  // ✅ Tự động thêm Bearer
        console.log('[authFetch] Added Authorization header from cookie/localStorage')
      }
    }
  }

  options.headers = headers
  return fetch(input as any, options)
}
```

**Đặc điểm:**
- ✅ Tự động lấy token từ cookie (`access_token`)
- ✅ Fallback lấy token từ localStorage (`auth_access_token`)
- ✅ Tự động thêm `Authorization: Bearer <token>` vào header
- ✅ Skip cho public endpoints

### 1.2. API Client

**File**: `src/lib/api-client.ts`

```typescript
private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  // Extract token
  let token: string | null = null
  
  // 1. Priority: Token from options.headers (Next.js API route)
  if (authHeaderFromOptions && authHeaderFromOptions.startsWith('Bearer ')) {
    token = authHeaderFromOptions.substring(7)
  } else {
    // 2. Priority: Get token from authService (client-side)
    token = authService.getAccessToken()  // ✅ Từ authService
    
    // 3. Priority: Get token from server cookies (Next.js API route)
    if (!token) {
      // Try next/headers cookies...
    }
  }
  
  // Add Authorization header if we have token
  if (token) {
    mergedHeaders['Authorization'] = `Bearer ${token}`  // ✅ Tự động thêm Bearer
  }
  
  // Use authFetch for actual request
  const response = await authFetch(url, {
    method: options.method || 'GET',
    headers: mergedHeaders,
    body: options.body,
    ...restOptions
  })
}
```

**Đặc điểm:**
- ✅ Tự động lấy token từ `authService.getAccessToken()`
- ✅ Fallback lấy token từ server cookies (Next.js API route)
- ✅ Tự động thêm `Authorization: Bearer <token>` vào header
- ✅ Sử dụng `authFetch` để đảm bảo token được thêm

### 1.3. AuthService

**File**: `src/lib/auth-service.ts`

```typescript
class AuthService {
  private readonly ACCESS_TOKEN_KEY = 'auth_access_token'
  
  // Get token from localStorage
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(this.ACCESS_TOKEN_KEY)  // ✅ Lấy từ localStorage
    } catch {
      return null
    }
  }
  
  // Save token after login
  async handleOAuthCallback(code: string, state?: string): Promise<AuthTokens> {
    // ... exchange code for token ...
    
    // Save token
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, token)  // ✅ Lưu vào localStorage
      cookieManager.setAccessToken(token)  // ✅ Lưu vào cookie
    }
    
    return { accessToken: token }
  }
}
```

**Đặc điểm:**
- ✅ Lưu token vào localStorage (`auth_access_token`)
- ✅ Lưu token vào cookie (`access_token`)
- ✅ Cung cấp `getAccessToken()` để lấy token

## 2. Flow Tự Động Thêm Bearer Token

### 2.1. Sau Khi Đăng Nhập

```
1. User đăng nhập thành công
   ↓
2. Backend trả về: { token: "eyJhbGciOiJ...", accountInfo: {...} }
   ↓
3. Frontend lưu token:
   - localStorage.setItem('auth_access_token', token)  ✅
   - cookieManager.setAccessToken(token)  ✅
   ↓
4. Token đã được lưu
```

### 2.2. Khi Gọi API

```
1. Frontend gọi: apiClient.getRooms()
   ↓
2. api-client.ts request() method:
   - token = authService.getAccessToken()  ✅ Lấy từ localStorage
   - mergedHeaders['Authorization'] = `Bearer ${token}`  ✅ Thêm Bearer
   ↓
3. Gọi authFetch(url, { headers: mergedHeaders })
   ↓
4. authFetch interceptor:
   - Check nếu chưa có Authorization header
   - token = cookieManager.getAccessToken() || localStorage.getItem('auth_access_token')
   - headers.set('Authorization', `Bearer ${token}`)  ✅ Thêm Bearer
   ↓
5. fetch() với Authorization header
   ↓
6. Backend nhận: Authorization: Bearer <token>
   ✅ Token đã được tự động thêm
```

## 3. Tự Động Lấy Token Từ accountInfo

### 3.1. Hiện Tại

**Token được lưu riêng, không nằm trong accountInfo:**

```typescript
// Sau khi login
const response = {
  authenticated: true,
  token: "eyJhbGciOiJ...",  // ✅ Token riêng
  accountInfo: {
    id: "1",
    email: "user@example.com",
    roleName: ["admin", "user"]
    // ❌ KHÔNG CÓ token trong accountInfo
  }
}

// Lưu token
localStorage.setItem('auth_access_token', response.token)  // ✅ Lưu token riêng
localStorage.setItem('auth_user_info', JSON.stringify(response.accountInfo))  // ✅ Lưu accountInfo riêng
```

### 3.2. Nếu Muốn Lấy Token Từ accountInfo

**Có thể lưu token vào accountInfo:**

```typescript
// Option 1: Lưu token vào accountInfo
const accountInfoWithToken = {
  ...response.accountInfo,
  token: response.token  // ✅ Thêm token vào accountInfo
}

localStorage.setItem('auth_user_info', JSON.stringify(accountInfoWithToken))

// Lấy token từ accountInfo
const userInfo = JSON.parse(localStorage.getItem('auth_user_info') || '{}')
const token = userInfo.token  // ✅ Lấy token từ accountInfo
```

**Nhưng không khuyến nghị vì:**
- ❌ Token và accountInfo nên tách biệt
- ❌ Token có thể refresh, accountInfo không đổi
- ❌ Hiện tại đã hoạt động tốt

## 4. Cải Thiện: Tự Động Thêm Bearer Token Từ accountInfo

### 4.1. Nếu Muốn Lấy Token Từ accountInfo

**Có thể cập nhật `authFetch` hoặc `api-client.ts`:**

```typescript
// Option 1: Cập nhật authFetch
export async function authFetch(input: string | URL | Request, init?: AuthFetchOptions): Promise<Response> {
  const headers = new Headers()
  
  // ... merge headers ...
  
  if (!init?.skipAuth && !headers.has('Authorization')) {
    let token: string | null = null
    
    // Priority 1: Token từ accountInfo (nếu có)
    try {
      const userInfo = cookieManager.getUserInfo()
      if (userInfo && userInfo.token) {
        token = userInfo.token
        console.log('[authFetch] Token from accountInfo')
      }
    } catch {}
    
    // Priority 2: Token từ cookie
    if (!token) {
      token = cookieManager.getAccessToken()
      console.log('[authFetch] Token from cookie')
    }
    
    // Priority 3: Token từ localStorage
    if (!token && typeof window !== 'undefined') {
      token = localStorage.getItem('auth_access_token')
      console.log('[authFetch] Token from localStorage')
    }
    
    // Priority 4: Token từ accountInfo trong localStorage
    if (!token && typeof window !== 'undefined') {
      try {
        const userInfoStr = localStorage.getItem('auth_user_info')
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr)
          if (userInfo.token) {
            token = userInfo.token
            console.log('[authFetch] Token from accountInfo in localStorage')
          }
        }
      } catch {}
    }
    
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }
  
  options.headers = headers
  return fetch(input as any, options)
}
```

### 4.2. Cập Nhật AuthService Để Lưu Token Vào accountInfo

```typescript
class AuthService {
  async handleOAuthCallback(code: string, state?: string): Promise<AuthTokens> {
    // ... exchange code ...
    
    const response = {
      authenticated: true,
      token: "...",
      accountInfo: { ... }
    }
    
    // Lưu token riêng
    localStorage.setItem(this.ACCESS_TOKEN_KEY, response.token)
    cookieManager.setAccessToken(response.token)
    
    // Lưu accountInfo với token (optional)
    const accountInfoWithToken = {
      ...response.accountInfo,
      token: response.token  // ✅ Thêm token vào accountInfo
    }
    localStorage.setItem(this.USER_INFO_KEY, JSON.stringify(accountInfoWithToken))
    cookieManager.setUserInfo(accountInfoWithToken)
    
    return { accessToken: response.token }
  }
  
  // Get token từ accountInfo (fallback)
  getAccessTokenFromAccountInfo(): string | null {
    try {
      const userInfo = this.getUserInfo()
      return userInfo?.token || null  // ✅ Lấy token từ accountInfo
    } catch {
      return null
    }
  }
}
```

## 5. Kết Luận

### Hiện Tại:

**Frontend đã tự động thêm Bearer token:**
- ✅ `authFetch` tự động lấy token từ cookie/localStorage
- ✅ `api-client.ts` tự động lấy token từ `authService`
- ✅ Tự động thêm `Authorization: Bearer <token>` vào header
- ✅ Hoạt động tốt

### Nếu Muốn Lấy Token Từ accountInfo:

**Có thể:**
1. ✅ Lưu token vào accountInfo khi login
2. ✅ Cập nhật `authFetch` để ưu tiên lấy token từ accountInfo
3. ✅ Fallback về cookie/localStorage nếu không có trong accountInfo

**Nhưng không khuyến nghị vì:**
- ❌ Token và accountInfo nên tách biệt
- ❌ Hiện tại đã hoạt động tốt
- ❌ Thêm phức tạp không cần thiết

### Recommendation:

**Giữ nguyên cách hiện tại:**
- ✅ Token lưu riêng trong localStorage/cookie
- ✅ accountInfo lưu riêng
- ✅ `authFetch` và `api-client.ts` tự động thêm Bearer token
- ✅ Hoạt động tốt, không cần thay đổi

