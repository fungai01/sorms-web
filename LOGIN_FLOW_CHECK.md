# Kiểm tra Flow Đăng Nhập Frontend - Backend

## 1. Lấy Google OAuth URL

### Frontend:
- **Hàm**: `authService.getGoogleOAuthUrl()`
- **API Call**: `apiClient.getGoogleOAuthRedirectUrl(redirectUri, scope)`
- **Endpoint**: `GET /auth/oauth2/google/redirect-url?redirectUri=...&scope=openid email profile`
- **Request**: Query params `redirectUri` và `scope`

### Backend Expected:
- **Response Format**: `{ responseCode: "S0000", message: "SUCCESS", data: { redirectUrl: "..." } }`
- Hoặc: `{ responseCode: "S0000", data: "https://accounts.google.com/..." }` (string)

### Frontend Parse:
```typescript
const data = response.data as any
const redirectUrl = typeof data === 'string' 
  ? data 
  : data.redirectUrl || data.url || ''
```

✅ **Trùng khớp**: Frontend parse đúng format backend

---

## 2. Exchange Code Lấy Token (Outbound Authentication)

### Frontend:
- **Hàm**: `authService.handleOAuthCallback(code, state)`
- **API Call**: `apiClient.outboundAuth({ code, redirectUri })`
- **Endpoint**: `POST /auth/outbound/authentication`
- **Request Body**: 
```json
{
  "code": "string",
  "redirectUri": "string"
}
```

### Backend Expected:
- **Response Format**:
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
      "roleName": ["string"]
    }
  }
}
```

### Frontend Parse:
```typescript
// Check authenticated flag
if (data.authenticated === false) throw Error

// Extract token
const accessToken = data.token || data.accessToken || data.access_token

// Parse accountInfo
const accountInfo = data.accountInfo
const roleNameArray = Array.isArray(accountInfo.roleName) ? accountInfo.roleName : []
const rolesArray = Array.isArray(accountInfo.roles) ? accountInfo.roles : []
const allRoles = roleNameArray.length > 0 ? roleNameArray : rolesArray
```

✅ **Trùng khớp**: Frontend parse đúng format backend

---

## 3. Introspect Token (Lấy User Info)

### Frontend:
- **Hàm**: `authService.introspectToken()`
- **API Call**: `apiClient.introspect(token)`
- **Endpoint**: `POST /auth/introspect`
- **Request Body**: `{ token: "JWT_TOKEN" }`

### Backend Expected:
- **Response Format**:
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

### Frontend Parse:
```typescript
// Check valid flag
if (!data.valid) return null

// Parse roles từ nhiều nguồn
const rolesFromRoot = Array.isArray(data.roles) ? data.roles : []
const rolesFromAccountInfo = Array.isArray(accountInfo.roles) ? accountInfo.roles : []
const roleNameFromAccountInfo = Array.isArray(accountInfo.roleName) ? accountInfo.roleName : []

// Ưu tiên: root roles → accountInfo.roles → accountInfo.roleName
const allRoles = rolesFromRoot.length > 0 
  ? rolesFromRoot 
  : rolesFromAccountInfo.length > 0 
    ? rolesFromAccountInfo 
    : roleNameFromAccountInfo
```

✅ **Trùng khớp**: Frontend parse đúng format backend

---

## 4. Check User Existence

### Frontend:
- **API Call**: `fetch('${BASE_URL}/users/search?keyword=email&page=0&size=10')`
- **Endpoint**: `GET /users/search?keyword=email&page=0&size=10`
- **Headers**: `Authorization: Bearer ${token}`

### Backend Expected:
- **Response Format**:
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "content": [
      {
        "id": "string",
        "email": "string",
        "fullName": "string",
        "status": "ACTIVE",
        "role": "ADMIN"
      }
    ],
    "totalElements": 1,
    "totalPages": 1
  }
}
```

### Frontend Parse:
```typescript
const users = Array.isArray(checkData?.data?.content) 
  ? checkData.data.content 
  : Array.isArray(checkData?.data) 
    ? checkData.data 
    : []

const foundUser = users.find((u: any) =>
  u.email?.toLowerCase() === userInfo.email.toLowerCase()
)

if (foundUser) {
  const databaseRole = foundUser.role || userInfo.roles?.[0] || 'user'
  const userStatus = foundUser.status || 'ACTIVE'
}
```

✅ **Trùng khớp**: Frontend parse đúng format backend

---

## 5. Create User

### Frontend:
- **API Call**: `fetch('${BASE_URL}/users', { method: 'POST', body: {...} })`
- **Endpoint**: `POST /users`
- **Request Body**:
```json
{
  "email": "string",
  "password": "sorms_1234567890_abc123",
  "fullName": "string",
  "firstName": "string",
  "lastName": "string",
  "phoneNumber": "string"
}
```
⚠️ **Lưu ý**: Frontend KHÔNG gửi `role` (backend tự assign default role)

### Backend Expected:
- **Response Format**:
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "id": "string",
    "email": "string",
    "fullName": "string",
    "status": "ACTIVE",
    "role": "USER"
  }
}
```

### Frontend Parse:
```typescript
const userData = createData.data || createData
const databaseRole = userData.role || userInfo.roles?.[0] || 'user'
const userStatus = userData.status || 'ACTIVE'
```

✅ **Trùng khớp**: Frontend parse đúng format backend

---

## 6. Role Mapping

### Backend Roles:
- `ADMIN`
- `OFFICE`
- `STAFF`
- `LECTURER`
- `GUEST`

### Frontend Roles:
- `admin`
- `office`
- `staff`
- `user`

### Mapping Function:
```typescript
function mapRoleToAppRole(backendRole: string): 'admin' | 'office' | 'staff' | 'user' {
  const upper = String(backendRole || '').toUpperCase()
  if (upper === 'ADMIN') return 'admin'
  if (upper === 'OFFICE') return 'office'
  if (upper === 'STAFF') return 'staff'
  return 'user' // LECTURER, GUEST, và các role khác → user
}
```

✅ **Trùng khớp**: Mapping đúng logic

---

## 7. Error Handling

### Backend Error Format:
```json
{
  "responseCode": "U0002",
  "message": "Email đã tồn tại",
  "data": null
}
```

### Frontend Error Handling:
- `responseCode === 'S0000'` → Success
- `responseCode === 'U0002'` → Duplicate email
- `authenticated === false` → Auth failed
- `valid === false` → Token invalid
- `status === 'INACTIVE'` → Account locked

✅ **Trùng khớp**: Frontend handle đúng error codes

---

## Tổng Kết

### ✅ Đã Trùng Khớp:
1. ✅ OAuth URL request/response format
2. ✅ Outbound authentication request/response format
3. ✅ Introspect token request/response format
4. ✅ User search request/response format
5. ✅ Create user request/response format
6. ✅ Role mapping logic
7. ✅ Error handling

### ⚠️ Cần Lưu Ý:
1. **RedirectUri**: Phải khớp CHÍNH XÁC giữa lúc lấy OAuth URL và exchange code
2. **Role từ token vs database**: 
   - Ưu tiên role từ database (sau khi check/create user)
   - Fallback về role từ token nếu database fail
3. **Password khi create user**: Frontend tự generate random password (backend yêu cầu password bắt buộc)
4. **Role khi create user**: Frontend KHÔNG gửi role, backend tự assign default role

### 🔧 Cải Tiến Đã Thực Hiện:
1. ✅ Gọi trực tiếp backend API thay vì Next.js API route (tránh 404)
2. ✅ Parse roles từ nhiều nguồn (root, accountInfo.roles, accountInfo.roleName)
3. ✅ Fallback logic khi check/create user fail
4. ✅ Validate authenticated flag và valid flag
5. ✅ Error handling chi tiết với error codes

---

## Kết Luận

**Frontend và Backend đã trùng khớp về:**
- ✅ API endpoints
- ✅ Request/Response formats
- ✅ Error handling
- ✅ Role mapping
- ✅ User provisioning flow

**Flow đăng nhập hoàn chỉnh và đã được tối ưu.**


## 1. Lấy Google OAuth URL

### Frontend:
- **Hàm**: `authService.getGoogleOAuthUrl()`
- **API Call**: `apiClient.getGoogleOAuthRedirectUrl(redirectUri, scope)`
- **Endpoint**: `GET /auth/oauth2/google/redirect-url?redirectUri=...&scope=openid email profile`
- **Request**: Query params `redirectUri` và `scope`

### Backend Expected:
- **Response Format**: `{ responseCode: "S0000", message: "SUCCESS", data: { redirectUrl: "..." } }`
- Hoặc: `{ responseCode: "S0000", data: "https://accounts.google.com/..." }` (string)

### Frontend Parse:
```typescript
const data = response.data as any
const redirectUrl = typeof data === 'string' 
  ? data 
  : data.redirectUrl || data.url || ''
```

✅ **Trùng khớp**: Frontend parse đúng format backend

---

## 2. Exchange Code Lấy Token (Outbound Authentication)

### Frontend:
- **Hàm**: `authService.handleOAuthCallback(code, state)`
- **API Call**: `apiClient.outboundAuth({ code, redirectUri })`
- **Endpoint**: `POST /auth/outbound/authentication`
- **Request Body**: 
```json
{
  "code": "string",
  "redirectUri": "string"
}
```

### Backend Expected:
- **Response Format**:
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
      "roleName": ["string"]
    }
  }
}
```

### Frontend Parse:
```typescript
// Check authenticated flag
if (data.authenticated === false) throw Error

// Extract token
const accessToken = data.token || data.accessToken || data.access_token

// Parse accountInfo
const accountInfo = data.accountInfo
const roleNameArray = Array.isArray(accountInfo.roleName) ? accountInfo.roleName : []
const rolesArray = Array.isArray(accountInfo.roles) ? accountInfo.roles : []
const allRoles = roleNameArray.length > 0 ? roleNameArray : rolesArray
```

✅ **Trùng khớp**: Frontend parse đúng format backend

---

## 3. Introspect Token (Lấy User Info)

### Frontend:
- **Hàm**: `authService.introspectToken()`
- **API Call**: `apiClient.introspect(token)`
- **Endpoint**: `POST /auth/introspect`
- **Request Body**: `{ token: "JWT_TOKEN" }`

### Backend Expected:
- **Response Format**:
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

### Frontend Parse:
```typescript
// Check valid flag
if (!data.valid) return null

// Parse roles từ nhiều nguồn
const rolesFromRoot = Array.isArray(data.roles) ? data.roles : []
const rolesFromAccountInfo = Array.isArray(accountInfo.roles) ? accountInfo.roles : []
const roleNameFromAccountInfo = Array.isArray(accountInfo.roleName) ? accountInfo.roleName : []

// Ưu tiên: root roles → accountInfo.roles → accountInfo.roleName
const allRoles = rolesFromRoot.length > 0 
  ? rolesFromRoot 
  : rolesFromAccountInfo.length > 0 
    ? rolesFromAccountInfo 
    : roleNameFromAccountInfo
```

✅ **Trùng khớp**: Frontend parse đúng format backend

---

## 4. Check User Existence

### Frontend:
- **API Call**: `fetch('${BASE_URL}/users/search?keyword=email&page=0&size=10')`
- **Endpoint**: `GET /users/search?keyword=email&page=0&size=10`
- **Headers**: `Authorization: Bearer ${token}`

### Backend Expected:
- **Response Format**:
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "content": [
      {
        "id": "string",
        "email": "string",
        "fullName": "string",
        "status": "ACTIVE",
        "role": "ADMIN"
      }
    ],
    "totalElements": 1,
    "totalPages": 1
  }
}
```

### Frontend Parse:
```typescript
const users = Array.isArray(checkData?.data?.content) 
  ? checkData.data.content 
  : Array.isArray(checkData?.data) 
    ? checkData.data 
    : []

const foundUser = users.find((u: any) =>
  u.email?.toLowerCase() === userInfo.email.toLowerCase()
)

if (foundUser) {
  const databaseRole = foundUser.role || userInfo.roles?.[0] || 'user'
  const userStatus = foundUser.status || 'ACTIVE'
}
```

✅ **Trùng khớp**: Frontend parse đúng format backend

---

## 5. Create User

### Frontend:
- **API Call**: `fetch('${BASE_URL}/users', { method: 'POST', body: {...} })`
- **Endpoint**: `POST /users`
- **Request Body**:
```json
{
  "email": "string",
  "password": "sorms_1234567890_abc123",
  "fullName": "string",
  "firstName": "string",
  "lastName": "string",
  "phoneNumber": "string"
}
```
⚠️ **Lưu ý**: Frontend KHÔNG gửi `role` (backend tự assign default role)

### Backend Expected:
- **Response Format**:
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "id": "string",
    "email": "string",
    "fullName": "string",
    "status": "ACTIVE",
    "role": "USER"
  }
}
```

### Frontend Parse:
```typescript
const userData = createData.data || createData
const databaseRole = userData.role || userInfo.roles?.[0] || 'user'
const userStatus = userData.status || 'ACTIVE'
```

✅ **Trùng khớp**: Frontend parse đúng format backend

---

## 6. Role Mapping

### Backend Roles:
- `ADMIN`
- `OFFICE`
- `STAFF`
- `LECTURER`
- `GUEST`

### Frontend Roles:
- `admin`
- `office`
- `staff`
- `user`

### Mapping Function:
```typescript
function mapRoleToAppRole(backendRole: string): 'admin' | 'office' | 'staff' | 'user' {
  const upper = String(backendRole || '').toUpperCase()
  if (upper === 'ADMIN') return 'admin'
  if (upper === 'OFFICE') return 'office'
  if (upper === 'STAFF') return 'staff'
  return 'user' // LECTURER, GUEST, và các role khác → user
}
```

✅ **Trùng khớp**: Mapping đúng logic

---

## 7. Error Handling

### Backend Error Format:
```json
{
  "responseCode": "U0002",
  "message": "Email đã tồn tại",
  "data": null
}
```

### Frontend Error Handling:
- `responseCode === 'S0000'` → Success
- `responseCode === 'U0002'` → Duplicate email
- `authenticated === false` → Auth failed
- `valid === false` → Token invalid
- `status === 'INACTIVE'` → Account locked

✅ **Trùng khớp**: Frontend handle đúng error codes

---

## Tổng Kết

### ✅ Đã Trùng Khớp:
1. ✅ OAuth URL request/response format
2. ✅ Outbound authentication request/response format
3. ✅ Introspect token request/response format
4. ✅ User search request/response format
5. ✅ Create user request/response format
6. ✅ Role mapping logic
7. ✅ Error handling

### ⚠️ Cần Lưu Ý:
1. **RedirectUri**: Phải khớp CHÍNH XÁC giữa lúc lấy OAuth URL và exchange code
2. **Role từ token vs database**: 
   - Ưu tiên role từ database (sau khi check/create user)
   - Fallback về role từ token nếu database fail
3. **Password khi create user**: Frontend tự generate random password (backend yêu cầu password bắt buộc)
4. **Role khi create user**: Frontend KHÔNG gửi role, backend tự assign default role

### 🔧 Cải Tiến Đã Thực Hiện:
1. ✅ Gọi trực tiếp backend API thay vì Next.js API route (tránh 404)
2. ✅ Parse roles từ nhiều nguồn (root, accountInfo.roles, accountInfo.roleName)
3. ✅ Fallback logic khi check/create user fail
4. ✅ Validate authenticated flag và valid flag
5. ✅ Error handling chi tiết với error codes

---

## Kết Luận

**Frontend và Backend đã trùng khớp về:**
- ✅ API endpoints
- ✅ Request/Response formats
- ✅ Error handling
- ✅ Role mapping
- ✅ User provisioning flow

**Flow đăng nhập hoàn chỉnh và đã được tối ưu.**

