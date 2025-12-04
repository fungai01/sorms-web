# So Sánh Backend và Frontend - Flow Đăng Nhập

## ✅ Đã Trùng Khớp

### 1. OAuth Redirect URL Endpoint
**Backend:**
- Endpoint: `GET /auth/oauth2/google/redirect-url?redirectUri=...&scope=...`
- Response: `ApiResponse<OAuth2RedirectUrlResponse>`
- Format: `{ responseCode: "S0000", message: "SUCCESS", data: { redirectUrl: "..." } }`

**Frontend:**
- Gọi: `GET /auth/oauth2/google/redirect-url?redirectUri=...&scope=...`
- Parse: `data.redirectUrl || data.url || data`

✅ **Trùng khớp hoàn toàn**

---

### 2. Outbound Authentication Endpoint
**Backend:**
- Endpoint: `POST /auth/outbound/authentication`
- Request: `{ code: string, redirectUri: string }`
- Response: `ApiResponse<AuthenticationResponse>`
- Format:
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "authenticated": true,
    "token": "JWT_TOKEN",
    "accountInfo": {
      "id": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "avatarUrl": "string",
      "roleName": ["ADMIN", "USER"]
    }
  }
}
```

**Frontend:**
- Gọi: `POST /auth/outbound/authentication` với `{ code, redirectUri }`
- Parse: `data.authenticated`, `data.token`, `data.accountInfo.roleName[]`

✅ **Trùng khớp hoàn toàn**

---

### 3. Introspect Token Endpoint
**Backend:**
- Endpoint: `POST /auth/introspect`
- Request: `{ token: string }`
- Response: `ApiResponse<IntrospectResponse>`
- Format:
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "valid": true,
    "accountId": "string",
    "username": "string",
    "roles": ["ADMIN"],
    "accountInfo": {
      "id": "string",
      "username": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "dob": "2025-12-04",
      "address": "string",
      "phoneNumber": "string",
      "avatarUrl": "string",
      "roles": ["ADMIN"]
    }
  }
}
```

**Frontend:**
- Gọi: `POST /auth/introspect` với `{ token }`
- Parse: `data.valid`, `data.roles[]`, `data.accountInfo.roles[]`

✅ **Trùng khớp hoàn toàn**

---

### 4. Create User Endpoint
**Backend:**
- Endpoint: `POST /users`
- Request: `CreateUserRequest` với các fields:
  - `email` (required)
  - `password` (required)
  - `fullName` (required)
  - `firstName`, `lastName`, `phoneNumber` (optional)
- Response: `ApiResponse<UserResponse>` với status 201
- Format:
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "id": 1,
    "email": "string",
    "fullName": "string",
    "status": "ACTIVE",
    ...
  }
}
```

**Frontend:**
- Gọi: `POST /users` với `{ email, password, fullName, firstName, lastName, phoneNumber }`
- Parse: `data.id`, `data.status`, `data.email`

✅ **Trùng khớp hoàn toàn**

---

## ✅ Đã Sửa

### 1. User Search Endpoint - Thiếu `keyword` Parameter

**Backend:**
- Endpoint: `GET /users/search`
- Parameters hỗ trợ:
  - `email` (LIKE search)
  - `fullName` (LIKE search)
  - `phoneNumber` (LIKE search)
  - `idCardNumber` (LIKE search)
  - `status` (exact match)
  - `page` (default: 0)
  - `size` (default: 10)
- **KHÔNG hỗ trợ `keyword` parameter**

**Frontend:**
- ✅ **Đã sửa**: Gọi `GET /users/search?email=email&page=0&size=10`
- Parse: `data.content[]` (PageResponse format)

✅ **Đã sửa**: Frontend đã đổi từ `keyword` sang `email` parameter

---

### 2. User Search Endpoint - Authorization Requirement

**Backend:**
- Endpoint: `GET /users/search` có `@PreAuthorize("hasAuthority('ADMIN')")`
- **Yêu cầu**: User phải có role ADMIN mới được gọi

**Frontend:**
- ✅ **Đã sửa**: Handle 403 Forbidden gracefully
- ✅ **Đã sửa**: Fallback về dùng role từ token/introspect khi bị 403
- ✅ **Logic**: Backend đã tự động tạo user trong OAuth flow, không cần check/create nữa

✅ **Đã sửa**: Frontend handle 403 và fallback về dùng role từ token (backend đã authenticated và auto-created user)

---

### 3. Create User Endpoint - Authorization Requirement

**Backend:**
- Endpoint: `POST /users` có `@PreAuthorize("hasAuthority('ADMIN')")`
- **Yêu cầu**: User phải có role ADMIN mới được tạo user
- ✅ **Backend đã tự động tạo user** trong `OutboundAuthenticationService.createNewAccountFromOAuth()`

**Frontend:**
- ✅ **Đã sửa**: Bỏ logic create user
- ✅ **Logic**: Backend tự động tạo user trong OAuth flow, frontend không cần gọi `POST /users` nữa

✅ **Đã sửa**: Frontend đã bỏ logic create user, dựa vào backend auto-create

---

### 4. UserResponse Format - Thiếu `role` Field

**Backend:**
- `UserResponse` không có field `role`
- Chỉ có các fields: `id`, `email`, `fullName`, `status`, `firstName`, `lastName`, ...

**Frontend:**
- ✅ **Đã sửa**: Không parse `foundUser.role` từ search response
- ✅ **Đã sửa**: Dùng role từ token/introspect response thay vì từ search response

✅ **Đã sửa**: Frontend đã bỏ parse `role` từ search response, dùng role từ token/introspect

---

## 📋 Tổng Kết

### ✅ Đã Trùng Khớp (5/5 endpoints):
1. ✅ OAuth Redirect URL
2. ✅ Outbound Authentication
3. ✅ Introspect Token
4. ✅ User Search (đã sửa `keyword` → `email`, handle 403)
5. ✅ Create User (đã bỏ logic, backend tự động tạo)

### ✅ Đã Sửa (4/4 vấn đề):
1. ✅ User Search: Frontend đã đổi từ `keyword` sang `email`
2. ✅ User Search: Frontend đã handle 403 và fallback về role từ token
3. ✅ Create User: Frontend đã bỏ logic create (backend tự động tạo)
4. ✅ UserResponse: Frontend đã bỏ parse `role`, dùng role từ token/introspect

---

## 🔧 Khuyến Nghị Sửa Lỗi

### Priority 1: Sửa Frontend (Dễ nhất)
1. **Sửa search endpoint**: Dùng `email` thay vì `keyword`
2. **Bỏ logic check/create user**: Backend đã tự động tạo user trong OAuth flow
3. **Dùng role từ token**: Không parse `role` từ search response

### Priority 2: Sửa Backend (Nếu cần)
1. **Thêm `keyword` parameter** vào search endpoint (optional)
2. **Thêm `role` field** vào `UserResponse`
3. **Tạo endpoint `/users/check`** không cần ADMIN permission

---

## 📝 Code Changes Needed

### Frontend Changes:
```typescript
// 1. Sửa search endpoint
const searchUrl = new URL('users/search', API_CONFIG.BASE_URL);
searchUrl.searchParams.set('email', userInfo.email); // Thay vì 'keyword'
searchUrl.searchParams.set('page', '0');
searchUrl.searchParams.set('size', '10');

// 2. Bỏ logic check/create user (backend đã tự động tạo)
// Hoặc chỉ check để lấy role, không tạo nữa

// 3. Dùng role từ token/introspect thay vì từ search response
const databaseRole = userInfo.role || userInfo.roles?.[0] || 'user';
```

### Backend Changes (Optional):
```java
// 1. Thêm keyword parameter vào SearchListUserRequest
private String keyword; // Search trong email, fullName, phoneNumber

// 2. Thêm role field vào UserResponse
private String role; // Lấy từ AccountRole

// 3. Tạo endpoint check không cần ADMIN
@GetMapping("/check")
public ResponseEntity<ApiResponse<UserResponse>> checkUserByEmail(
    @RequestParam String email) {
    // Không cần @PreAuthorize
}
```


## ✅ Đã Trùng Khớp

### 1. OAuth Redirect URL Endpoint
**Backend:**
- Endpoint: `GET /auth/oauth2/google/redirect-url?redirectUri=...&scope=...`
- Response: `ApiResponse<OAuth2RedirectUrlResponse>`
- Format: `{ responseCode: "S0000", message: "SUCCESS", data: { redirectUrl: "..." } }`

**Frontend:**
- Gọi: `GET /auth/oauth2/google/redirect-url?redirectUri=...&scope=...`
- Parse: `data.redirectUrl || data.url || data`

✅ **Trùng khớp hoàn toàn**

---

### 2. Outbound Authentication Endpoint
**Backend:**
- Endpoint: `POST /auth/outbound/authentication`
- Request: `{ code: string, redirectUri: string }`
- Response: `ApiResponse<AuthenticationResponse>`
- Format:
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "authenticated": true,
    "token": "JWT_TOKEN",
    "accountInfo": {
      "id": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "avatarUrl": "string",
      "roleName": ["ADMIN", "USER"]
    }
  }
}
```

**Frontend:**
- Gọi: `POST /auth/outbound/authentication` với `{ code, redirectUri }`
- Parse: `data.authenticated`, `data.token`, `data.accountInfo.roleName[]`

✅ **Trùng khớp hoàn toàn**

---

### 3. Introspect Token Endpoint
**Backend:**
- Endpoint: `POST /auth/introspect`
- Request: `{ token: string }`
- Response: `ApiResponse<IntrospectResponse>`
- Format:
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "valid": true,
    "accountId": "string",
    "username": "string",
    "roles": ["ADMIN"],
    "accountInfo": {
      "id": "string",
      "username": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "dob": "2025-12-04",
      "address": "string",
      "phoneNumber": "string",
      "avatarUrl": "string",
      "roles": ["ADMIN"]
    }
  }
}
```

**Frontend:**
- Gọi: `POST /auth/introspect` với `{ token }`
- Parse: `data.valid`, `data.roles[]`, `data.accountInfo.roles[]`

✅ **Trùng khớp hoàn toàn**

---

### 4. Create User Endpoint
**Backend:**
- Endpoint: `POST /users`
- Request: `CreateUserRequest` với các fields:
  - `email` (required)
  - `password` (required)
  - `fullName` (required)
  - `firstName`, `lastName`, `phoneNumber` (optional)
- Response: `ApiResponse<UserResponse>` với status 201
- Format:
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "id": 1,
    "email": "string",
    "fullName": "string",
    "status": "ACTIVE",
    ...
  }
}
```

**Frontend:**
- Gọi: `POST /users` với `{ email, password, fullName, firstName, lastName, phoneNumber }`
- Parse: `data.id`, `data.status`, `data.email`

✅ **Trùng khớp hoàn toàn**

---

## ✅ Đã Sửa

### 1. User Search Endpoint - Thiếu `keyword` Parameter

**Backend:**
- Endpoint: `GET /users/search`
- Parameters hỗ trợ:
  - `email` (LIKE search)
  - `fullName` (LIKE search)
  - `phoneNumber` (LIKE search)
  - `idCardNumber` (LIKE search)
  - `status` (exact match)
  - `page` (default: 0)
  - `size` (default: 10)
- **KHÔNG hỗ trợ `keyword` parameter**

**Frontend:**
- ✅ **Đã sửa**: Gọi `GET /users/search?email=email&page=0&size=10`
- Parse: `data.content[]` (PageResponse format)

✅ **Đã sửa**: Frontend đã đổi từ `keyword` sang `email` parameter

---

### 2. User Search Endpoint - Authorization Requirement

**Backend:**
- Endpoint: `GET /users/search` có `@PreAuthorize("hasAuthority('ADMIN')")`
- **Yêu cầu**: User phải có role ADMIN mới được gọi

**Frontend:**
- ✅ **Đã sửa**: Handle 403 Forbidden gracefully
- ✅ **Đã sửa**: Fallback về dùng role từ token/introspect khi bị 403
- ✅ **Logic**: Backend đã tự động tạo user trong OAuth flow, không cần check/create nữa

✅ **Đã sửa**: Frontend handle 403 và fallback về dùng role từ token (backend đã authenticated và auto-created user)

---

### 3. Create User Endpoint - Authorization Requirement

**Backend:**
- Endpoint: `POST /users` có `@PreAuthorize("hasAuthority('ADMIN')")`
- **Yêu cầu**: User phải có role ADMIN mới được tạo user
- ✅ **Backend đã tự động tạo user** trong `OutboundAuthenticationService.createNewAccountFromOAuth()`

**Frontend:**
- ✅ **Đã sửa**: Bỏ logic create user
- ✅ **Logic**: Backend tự động tạo user trong OAuth flow, frontend không cần gọi `POST /users` nữa

✅ **Đã sửa**: Frontend đã bỏ logic create user, dựa vào backend auto-create

---

### 4. UserResponse Format - Thiếu `role` Field

**Backend:**
- `UserResponse` không có field `role`
- Chỉ có các fields: `id`, `email`, `fullName`, `status`, `firstName`, `lastName`, ...

**Frontend:**
- ✅ **Đã sửa**: Không parse `foundUser.role` từ search response
- ✅ **Đã sửa**: Dùng role từ token/introspect response thay vì từ search response

✅ **Đã sửa**: Frontend đã bỏ parse `role` từ search response, dùng role từ token/introspect

---

## 📋 Tổng Kết

### ✅ Đã Trùng Khớp (5/5 endpoints):
1. ✅ OAuth Redirect URL
2. ✅ Outbound Authentication
3. ✅ Introspect Token
4. ✅ User Search (đã sửa `keyword` → `email`, handle 403)
5. ✅ Create User (đã bỏ logic, backend tự động tạo)

### ✅ Đã Sửa (4/4 vấn đề):
1. ✅ User Search: Frontend đã đổi từ `keyword` sang `email`
2. ✅ User Search: Frontend đã handle 403 và fallback về role từ token
3. ✅ Create User: Frontend đã bỏ logic create (backend tự động tạo)
4. ✅ UserResponse: Frontend đã bỏ parse `role`, dùng role từ token/introspect

---

## 🔧 Khuyến Nghị Sửa Lỗi

### Priority 1: Sửa Frontend (Dễ nhất)
1. **Sửa search endpoint**: Dùng `email` thay vì `keyword`
2. **Bỏ logic check/create user**: Backend đã tự động tạo user trong OAuth flow
3. **Dùng role từ token**: Không parse `role` từ search response

### Priority 2: Sửa Backend (Nếu cần)
1. **Thêm `keyword` parameter** vào search endpoint (optional)
2. **Thêm `role` field** vào `UserResponse`
3. **Tạo endpoint `/users/check`** không cần ADMIN permission

---

## 📝 Code Changes Needed

### Frontend Changes:
```typescript
// 1. Sửa search endpoint
const searchUrl = new URL('users/search', API_CONFIG.BASE_URL);
searchUrl.searchParams.set('email', userInfo.email); // Thay vì 'keyword'
searchUrl.searchParams.set('page', '0');
searchUrl.searchParams.set('size', '10');

// 2. Bỏ logic check/create user (backend đã tự động tạo)
// Hoặc chỉ check để lấy role, không tạo nữa

// 3. Dùng role từ token/introspect thay vì từ search response
const databaseRole = userInfo.role || userInfo.roles?.[0] || 'user';
```

### Backend Changes (Optional):
```java
// 1. Thêm keyword parameter vào SearchListUserRequest
private String keyword; // Search trong email, fullName, phoneNumber

// 2. Thêm role field vào UserResponse
private String role; // Lấy từ AccountRole

// 3. Tạo endpoint check không cần ADMIN
@GetMapping("/check")
public ResponseEntity<ApiResponse<UserResponse>> checkUserByEmail(
    @RequestParam String email) {
    // Không cần @PreAuthorize
}
```

