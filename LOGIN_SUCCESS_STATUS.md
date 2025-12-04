# Trạng Thái: Đăng Nhập Thành Công

## Tổng Quan

**✅ Đăng nhập thành công - Token đã được nhận và lưu.**

## 1. Response Từ Backend

### 1.1. Login Response

```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "authenticated": true,
    "token": "eyJhbGciOiJIUzUxMiJ9...",
    "accountInfo": {
      "id": "1",
      "email": "quyentnqe170062@fpt.edu.vn",
      "firstName": "",
      "lastName": "",
      "avatarUrl": null,
      "roleName": ["admin", "user"]
    }
  }
}
```

**✅ Xác nhận:**
- ✅ `authenticated: true`
- ✅ Token được trả về (JWT format)
- ✅ accountInfo có roles: `["admin", "user"]`

### 1.2. Token Structure

**JWT Token có:**
- `sub`: "quyentnqe170062@fpt.edu.vn"
- `scope`: "ROLE_admin ROLE_user"
- `roles`: ["admin", "user"]
- `userId`: "1"
- `accountInfo`: {...}

**✅ Token đúng format và có đầy đủ thông tin**

## 2. Frontend Đã Lưu Token

### 2.1. Flow Lưu Token

```
1. Backend trả về token
   ↓
2. auth-service.ts handleOAuthCallback():
   - setTokens() → Lưu vào localStorage ('auth_access_token')  ✅
   - setUserInfo() → Lưu accountInfo + token vào localStorage ('auth_user_info')  ✅
   - cookieManager.setAccessToken() → Lưu vào cookie  ✅
   - cookieManager.setUserInfo() → Lưu accountInfo + token vào cookie  ✅
   ↓
3. Token đã được lưu ở nhiều nơi:
   ✅ localStorage: 'auth_access_token'
   ✅ localStorage: 'auth_user_info' (có token)
   ✅ cookie: 'access_token'
   ✅ cookie: 'user_info' (có token)
```

### 2.2. Code Lưu Token

**auth-service.ts:**
```typescript
// Line 436-440: Lưu token riêng
setTokens(tokens: AuthTokens): void {
  localStorage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken)  // ✅
  cookieManager.setAccessToken(tokens.accessToken)  // ✅
}

// Line 522-530: Lưu token vào accountInfo
setUserInfo(user: UserInfo): void {
  const currentToken = this.getAccessToken()  // ✅ Lấy token
  const userInfoWithToken = currentToken 
    ? { ...user, token: currentToken }  // ✅ Thêm token vào accountInfo
    : user
  localStorage.setItem(this.USER_INFO_KEY, JSON.stringify(userInfoWithToken))  // ✅
}
```

**✅ Token đã được lưu đúng**

## 3. Frontend Gửi Token Khi Gọi API

### 3.1. Flow Gửi Token

```
1. Frontend gọi: apiClient.getRooms()
   ↓
2. api-client.ts:
   - Lấy token từ accountInfo (Priority 1)  ✅
   - Hoặc từ authService (Priority 2)  ✅
   - mergedHeaders['Authorization'] = `Bearer ${token}`  ✅
   ↓
3. authFetch():
   - Lấy token từ accountInfo trong cookie (Priority 1)  ✅
   - Hoặc từ cookie/localStorage (Priority 2-4)  ✅
   - headers.set('Authorization', `Bearer ${token}`)  ✅
   ↓
4. Request gửi đến backend:
   Headers: { Authorization: "Bearer eyJhbGciOiJ..." }  ✅
```

### 3.2. Code Gửi Token

**api-client.ts:**
```typescript
// Line 78-84: Lấy token từ accountInfo
const userInfo = authService.getUserInfo()
if (userInfo && (userInfo as any).token) {
  token = (userInfo as any).token  // ✅ Lấy từ accountInfo
}

// Line 156: Thêm Bearer token
mergedHeaders['Authorization'] = `Bearer ${token}`  // ✅
```

**http.ts:**
```typescript
// Line 125-129: Lấy token từ accountInfo trong cookie
const userInfo = cookieManager.getUserInfo()
if (userInfo && (userInfo as any).token) {
  token = (userInfo as any).token  // ✅ Lấy từ accountInfo
}

// Line 164: Thêm Bearer token
headers.set('Authorization', `Bearer ${token}`)  // ✅
```

**✅ Frontend đã gửi Bearer token đúng**

## 4. Vấn Đề: Backend Không Parse Token

### 4.1. Backend Nhận Token Nhưng Không Parse

```
1. Frontend gửi:
   GET /api/rooms
   Headers: { Authorization: "Bearer eyJhbGciOiJ..." }  ✅
   ↓
2. Backend nhận request:
   ✅ CÓ Authorization header
   ✅ Header có format đúng: "Bearer <token>"
   ↓
3. WebSecurityConfig:
   permitAll() → Bypass security  ✅
   ❌ NHƯNG không parse token
   ↓
4. Request đến RoomController:
   ✅ Đến được controller
   ↓
5. @PreAuthorize check:
   SecurityContext.getAuthentication()  // ❌ NULL
   ↓
6. @PreAuthorize fails:
   ❌ Throw AccessDeniedException
   ↓
7. GlobalExceptionHandler:
   ❌ Return: { responseCode: "S0001", message: "SYSTEM_ERROR" }
   ❌ KHÔNG CÓ DỮ LIỆU
```

### 4.2. Tại Sao Không Load Được Dữ Liệu?

**Vấn đề:**
- ✅ Backend nhận được Authorization header
- ❌ Backend KHÔNG parse token (thiếu JWT Filter)
- ❌ SecurityContext.getAuthentication() == NULL
- ❌ @PreAuthorize fails
- ❌ Trả về SYSTEM_ERROR thay vì dữ liệu

## 5. Kết Luận

### ✅ Những Gì Đã Hoạt Động:

1. **Đăng nhập:**
   - ✅ Backend tạo token thành công
   - ✅ Frontend nhận token
   - ✅ Token được lưu vào localStorage và cookie
   - ✅ Token được lưu vào accountInfo

2. **Gửi token:**
   - ✅ Frontend gửi Bearer token trong mọi request
   - ✅ Token được lấy từ accountInfo (ưu tiên)
   - ✅ Format đúng: `Authorization: Bearer <token>`

3. **Backend nhận token:**
   - ✅ Backend nhận được Authorization header
   - ✅ Header có format đúng

### ❌ Vấn Đề Còn Lại:

1. **Backend không parse token:**
   - ❌ Không có JWT Filter để parse token
   - ❌ SecurityContext == NULL
   - ❌ @PreAuthorize fails
   - ❌ Không cho xem dữ liệu

### 🔧 Giải Pháp:

**Cần tạo JWT Filter ở backend để:**
- Parse token từ Authorization header
- Verify token
- Extract roles từ token
- Set Authentication vào SecurityContext
- Cho phép @PreAuthorize hoạt động
- Cho xem dữ liệu

## 6. Tóm Tắt

**✅ Đăng nhập thành công:**
- Token được tạo và trả về
- Token được lưu vào accountInfo
- Frontend gửi token đúng format

**❌ Vẫn không load được dữ liệu:**
- Backend nhận token nhưng không parse
- SecurityContext == NULL
- @PreAuthorize fails
- Trả về SYSTEM_ERROR

**🔧 Cần làm:**
- Tạo JWT Filter ở backend
- Parse token và set Authentication
- Cho phép @PreAuthorize hoạt động
- Frontend sẽ load được dữ liệu

