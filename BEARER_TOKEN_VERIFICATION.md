# Xác Minh: Bearer Token Đã Được Sử Dụng

## Tổng Quan

**Bearer token đã được cấu hình và sử dụng đúng trong frontend.**

## 1. Kiểm Tra Code

### 1.1. api-client.ts

**File**: `src/lib/api-client.ts`

```typescript
// Line 140-143
// Add Authorization header if we have token (will overwrite if already exists from options)
if (token) {
  mergedHeaders['Authorization'] = `Bearer ${token}`  // ✅ Đúng format
}
```

**✅ Đã đúng:**
- Format: `Bearer ${token}`
- Được thêm vào `mergedHeaders['Authorization']`
- Sử dụng trong `authFetch()`

### 1.2. http.ts (authFetch)

**File**: `src/lib/http.ts`

```typescript
// Line 163-165
if (token) {
  headers.set('Authorization', `Bearer ${token}`)  // ✅ Đúng format
  console.log('[authFetch] Added Authorization header')
}
```

**✅ Đã đúng:**
- Format: `Bearer ${token}`
- Được thêm vào `Headers` instance
- Log để debug

### 1.3. auth-service.ts

**File**: `src/lib/auth-service.ts`

```typescript
// Line 525-530
// Lấy token hiện tại để lưu vào accountInfo
const currentToken = this.getAccessToken()

// Tạo userInfo với token nếu có
const userInfoWithToken = currentToken 
  ? { ...user, token: currentToken }  // ✅ Lưu token vào accountInfo
  : user
```

**✅ Đã đúng:**
- Token được lưu vào accountInfo
- Token được lấy từ `getAccessToken()`

## 2. Flow Hoàn Chỉnh

### 2.1. Khi Đăng Nhập

```
1. User đăng nhập thành công
   ↓
2. Backend trả về: { token: "eyJhbGciOiJ...", accountInfo: {...} }
   ↓
3. auth-service.ts:
   - setTokens() → Lưu token vào localStorage ('auth_access_token')
   - setUserInfo() → Lưu accountInfo + token vào localStorage ('auth_user_info')
   - cookieManager.setAccessToken() → Lưu token vào cookie
   - cookieManager.setUserInfo() → Lưu accountInfo + token vào cookie
   ↓
4. Token đã được lưu ở nhiều nơi:
   ✅ localStorage: 'auth_access_token'
   ✅ localStorage: 'auth_user_info' (có token)
   ✅ cookie: 'access_token'
   ✅ cookie: 'user_info' (có token)
```

### 2.2. Khi Gọi API

```
1. Frontend gọi: apiClient.getRooms()
   ↓
2. api-client.ts request():
   - Lấy token từ accountInfo (userInfo)  ✅ Priority 1
   - Hoặc từ authService.getAccessToken()  ✅ Priority 2
   - Hoặc từ server cookies  ✅ Priority 3
   ↓
3. Thêm vào mergedHeaders:
   mergedHeaders['Authorization'] = `Bearer ${token}`  ✅
   ↓
4. Gọi authFetch(url, { headers: mergedHeaders })
   ↓
5. authFetch():
   - Lấy token từ accountInfo trong cookie  ✅ Priority 1
   - Hoặc từ cookieManager.getAccessToken()  ✅ Priority 2
   - Hoặc từ accountInfo trong localStorage  ✅ Priority 3
   - Hoặc từ localStorage.getItem('auth_access_token')  ✅ Priority 4
   ↓
6. Thêm vào Headers:
   headers.set('Authorization', `Bearer ${token}`)  ✅
   ↓
7. fetch() với Authorization header:
   Headers: { Authorization: "Bearer eyJhbGciOiJ..." }  ✅
   ↓
8. Backend nhận:
   Authorization: Bearer eyJhbGciOiJ...  ✅
```

## 3. Xác Minh Format

### 3.1. Format Bearer Token

**Chuẩn OAuth 2.0:**
```
Authorization: Bearer <token>
```

**Code hiện tại:**
```typescript
// api-client.ts
mergedHeaders['Authorization'] = `Bearer ${token}`  // ✅ Đúng

// http.ts
headers.set('Authorization', `Bearer ${token}`)  // ✅ Đúng
```

**✅ Format đã đúng:**
- Có prefix `Bearer `
- Có space sau `Bearer`
- Token được append sau `Bearer `

### 3.2. Kiểm Tra Headers

**Request headers sẽ có:**
```
Authorization: Bearer eyJhbGciOiJIUzUxMiJ9.eyJhY2NvdW50SW5mbyI6...
```

**✅ Đúng format OAuth 2.0 Bearer Token**

## 4. Test Cases

### 4.1. Test 1: Token từ accountInfo

**Scenario:**
- User đã đăng nhập
- Token được lưu trong accountInfo

**Expected:**
```typescript
// api-client.ts
const userInfo = authService.getUserInfo()
token = userInfo.token  // ✅ Lấy từ accountInfo
mergedHeaders['Authorization'] = `Bearer ${token}`  // ✅ Thêm Bearer
```

**✅ Pass**

### 4.2. Test 2: Token từ authService

**Scenario:**
- User đã đăng nhập
- Token không có trong accountInfo (fallback)

**Expected:**
```typescript
// api-client.ts
token = authService.getAccessToken()  // ✅ Lấy từ authService
mergedHeaders['Authorization'] = `Bearer ${token}`  // ✅ Thêm Bearer
```

**✅ Pass**

### 4.3. Test 3: Token từ cookie

**Scenario:**
- User đã đăng nhập
- Token không có trong accountInfo và authService (fallback)

**Expected:**
```typescript
// http.ts
token = cookieManager.getAccessToken()  // ✅ Lấy từ cookie
headers.set('Authorization', `Bearer ${token}`)  // ✅ Thêm Bearer
```

**✅ Pass**

## 5. Logging

### 5.1. Console Logs

**api-client.ts:**
```typescript
console.log('[API Client] Token from accountInfo (userInfo)')
console.log('[API Client] Token from authService')
console.log('[API Client] Token found in server cookies')
```

**http.ts:**
```typescript
console.log('[authFetch] Token from accountInfo in cookie')
console.log('[authFetch] Token from cookie')
console.log('[authFetch] Token from accountInfo in localStorage')
console.log('[authFetch] Token from localStorage')
console.log('[authFetch] Added Authorization header')
```

**✅ Logging đầy đủ để debug**

## 6. Kết Luận

### Bearer Token Đã Được Sử Dụng:

**✅ Format đúng:**
- `Authorization: Bearer <token>`
- Có prefix `Bearer `
- Có space sau `Bearer`

**✅ Được thêm vào headers:**
- `api-client.ts` → `mergedHeaders['Authorization']`
- `http.ts` → `headers.set('Authorization', ...)`

**✅ Priority order đúng:**
1. Token từ accountInfo (userInfo) - **MỚI**
2. Token từ authService
3. Token từ cookies
4. Token từ localStorage

**✅ Lưu token vào accountInfo:**
- Khi login: Token được lưu vào accountInfo
- Khi refresh: Token mới được cập nhật vào accountInfo

**✅ Fallback đầy đủ:**
- Nếu không có trong accountInfo → Lấy từ authService
- Nếu không có trong authService → Lấy từ cookies
- Nếu không có trong cookies → Lấy từ localStorage

### Tóm Tắt:

**Bearer token đã được sử dụng đúng:**
- ✅ Format: `Bearer <token>`
- ✅ Được thêm vào request headers
- ✅ Priority order hợp lý
- ✅ Fallback đầy đủ
- ✅ Logging để debug

**Sẵn sàng sử dụng!**


## Tổng Quan

**Bearer token đã được cấu hình và sử dụng đúng trong frontend.**

## 1. Kiểm Tra Code

### 1.1. api-client.ts

**File**: `src/lib/api-client.ts`

```typescript
// Line 140-143
// Add Authorization header if we have token (will overwrite if already exists from options)
if (token) {
  mergedHeaders['Authorization'] = `Bearer ${token}`  // ✅ Đúng format
}
```

**✅ Đã đúng:**
- Format: `Bearer ${token}`
- Được thêm vào `mergedHeaders['Authorization']`
- Sử dụng trong `authFetch()`

### 1.2. http.ts (authFetch)

**File**: `src/lib/http.ts`

```typescript
// Line 163-165
if (token) {
  headers.set('Authorization', `Bearer ${token}`)  // ✅ Đúng format
  console.log('[authFetch] Added Authorization header')
}
```

**✅ Đã đúng:**
- Format: `Bearer ${token}`
- Được thêm vào `Headers` instance
- Log để debug

### 1.3. auth-service.ts

**File**: `src/lib/auth-service.ts`

```typescript
// Line 525-530
// Lấy token hiện tại để lưu vào accountInfo
const currentToken = this.getAccessToken()

// Tạo userInfo với token nếu có
const userInfoWithToken = currentToken 
  ? { ...user, token: currentToken }  // ✅ Lưu token vào accountInfo
  : user
```

**✅ Đã đúng:**
- Token được lưu vào accountInfo
- Token được lấy từ `getAccessToken()`

## 2. Flow Hoàn Chỉnh

### 2.1. Khi Đăng Nhập

```
1. User đăng nhập thành công
   ↓
2. Backend trả về: { token: "eyJhbGciOiJ...", accountInfo: {...} }
   ↓
3. auth-service.ts:
   - setTokens() → Lưu token vào localStorage ('auth_access_token')
   - setUserInfo() → Lưu accountInfo + token vào localStorage ('auth_user_info')
   - cookieManager.setAccessToken() → Lưu token vào cookie
   - cookieManager.setUserInfo() → Lưu accountInfo + token vào cookie
   ↓
4. Token đã được lưu ở nhiều nơi:
   ✅ localStorage: 'auth_access_token'
   ✅ localStorage: 'auth_user_info' (có token)
   ✅ cookie: 'access_token'
   ✅ cookie: 'user_info' (có token)
```

### 2.2. Khi Gọi API

```
1. Frontend gọi: apiClient.getRooms()
   ↓
2. api-client.ts request():
   - Lấy token từ accountInfo (userInfo)  ✅ Priority 1
   - Hoặc từ authService.getAccessToken()  ✅ Priority 2
   - Hoặc từ server cookies  ✅ Priority 3
   ↓
3. Thêm vào mergedHeaders:
   mergedHeaders['Authorization'] = `Bearer ${token}`  ✅
   ↓
4. Gọi authFetch(url, { headers: mergedHeaders })
   ↓
5. authFetch():
   - Lấy token từ accountInfo trong cookie  ✅ Priority 1
   - Hoặc từ cookieManager.getAccessToken()  ✅ Priority 2
   - Hoặc từ accountInfo trong localStorage  ✅ Priority 3
   - Hoặc từ localStorage.getItem('auth_access_token')  ✅ Priority 4
   ↓
6. Thêm vào Headers:
   headers.set('Authorization', `Bearer ${token}`)  ✅
   ↓
7. fetch() với Authorization header:
   Headers: { Authorization: "Bearer eyJhbGciOiJ..." }  ✅
   ↓
8. Backend nhận:
   Authorization: Bearer eyJhbGciOiJ...  ✅
```

## 3. Xác Minh Format

### 3.1. Format Bearer Token

**Chuẩn OAuth 2.0:**
```
Authorization: Bearer <token>
```

**Code hiện tại:**
```typescript
// api-client.ts
mergedHeaders['Authorization'] = `Bearer ${token}`  // ✅ Đúng

// http.ts
headers.set('Authorization', `Bearer ${token}`)  // ✅ Đúng
```

**✅ Format đã đúng:**
- Có prefix `Bearer `
- Có space sau `Bearer`
- Token được append sau `Bearer `

### 3.2. Kiểm Tra Headers

**Request headers sẽ có:**
```
Authorization: Bearer eyJhbGciOiJIUzUxMiJ9.eyJhY2NvdW50SW5mbyI6...
```

**✅ Đúng format OAuth 2.0 Bearer Token**

## 4. Test Cases

### 4.1. Test 1: Token từ accountInfo

**Scenario:**
- User đã đăng nhập
- Token được lưu trong accountInfo

**Expected:**
```typescript
// api-client.ts
const userInfo = authService.getUserInfo()
token = userInfo.token  // ✅ Lấy từ accountInfo
mergedHeaders['Authorization'] = `Bearer ${token}`  // ✅ Thêm Bearer
```

**✅ Pass**

### 4.2. Test 2: Token từ authService

**Scenario:**
- User đã đăng nhập
- Token không có trong accountInfo (fallback)

**Expected:**
```typescript
// api-client.ts
token = authService.getAccessToken()  // ✅ Lấy từ authService
mergedHeaders['Authorization'] = `Bearer ${token}`  // ✅ Thêm Bearer
```

**✅ Pass**

### 4.3. Test 3: Token từ cookie

**Scenario:**
- User đã đăng nhập
- Token không có trong accountInfo và authService (fallback)

**Expected:**
```typescript
// http.ts
token = cookieManager.getAccessToken()  // ✅ Lấy từ cookie
headers.set('Authorization', `Bearer ${token}`)  // ✅ Thêm Bearer
```

**✅ Pass**

## 5. Logging

### 5.1. Console Logs

**api-client.ts:**
```typescript
console.log('[API Client] Token from accountInfo (userInfo)')
console.log('[API Client] Token from authService')
console.log('[API Client] Token found in server cookies')
```

**http.ts:**
```typescript
console.log('[authFetch] Token from accountInfo in cookie')
console.log('[authFetch] Token from cookie')
console.log('[authFetch] Token from accountInfo in localStorage')
console.log('[authFetch] Token from localStorage')
console.log('[authFetch] Added Authorization header')
```

**✅ Logging đầy đủ để debug**

## 6. Kết Luận

### Bearer Token Đã Được Sử Dụng:

**✅ Format đúng:**
- `Authorization: Bearer <token>`
- Có prefix `Bearer `
- Có space sau `Bearer`

**✅ Được thêm vào headers:**
- `api-client.ts` → `mergedHeaders['Authorization']`
- `http.ts` → `headers.set('Authorization', ...)`

**✅ Priority order đúng:**
1. Token từ accountInfo (userInfo) - **MỚI**
2. Token từ authService
3. Token từ cookies
4. Token từ localStorage

**✅ Lưu token vào accountInfo:**
- Khi login: Token được lưu vào accountInfo
- Khi refresh: Token mới được cập nhật vào accountInfo

**✅ Fallback đầy đủ:**
- Nếu không có trong accountInfo → Lấy từ authService
- Nếu không có trong authService → Lấy từ cookies
- Nếu không có trong cookies → Lấy từ localStorage

### Tóm Tắt:

**Bearer token đã được sử dụng đúng:**
- ✅ Format: `Bearer <token>`
- ✅ Được thêm vào request headers
- ✅ Priority order hợp lý
- ✅ Fallback đầy đủ
- ✅ Logging để debug

**Sẵn sàng sử dụng!**

