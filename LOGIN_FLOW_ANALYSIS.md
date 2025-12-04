# Login Flow Analysis & Issues

## Tổng quan Login Flow

### Flow hiện tại:

1. **Login Page** (`/login`)
   - User chọn role (optional)
   - Click "Đăng nhập với Google"
   - Gọi `loginWithGoogle()` → `authService.getGoogleOAuthUrl()`
   - Redirect đến Google OAuth

2. **OAuth Callback** (`/auth/callback`)
   - Google redirect về với `code` và `state`
   - Gọi `authService.handleOAuthCallback(code, state)`
   - Exchange code → Get tokens → Save user info
   - Check user existence → Validate role → Redirect

3. **Auth Service**
   - `getGoogleOAuthUrl()`: GET `/auth/oauth2/google/redirect-url`
   - `handleOAuthCallback()`: POST `/auth/outbound/authentication`
   - `introspectToken()`: POST `/auth/introspect`

---

## Issues Phát Hiện

### 1. ❌ Callback URL Format

**Vấn đề:**
- Frontend lưu callback URL: `/api/auth/callback/google`
- Backend có thể expect format khác
- Callback URL phải khớp CHÍNH XÁC với Google OAuth Console

**Code hiện tại:**
```typescript
// auth-service.ts line 65-67
let callbackUrl = typeof window !== 'undefined' 
  ? `${window.location.origin}/api/auth/callback/google`
  : 'http://localhost:3000/api/auth/callback/google'
```

**Backend API:**
- Endpoint: `GET /auth/oauth2/google/redirect-url?redirectUri=...`
- Backend sẽ sử dụng `redirectUri` này để đăng ký với Google

**Giải pháp:**
- Đảm bảo callback URL khớp với Google OAuth Console
- Normalize URL (loại bỏ trailing slash)
- Log callback URL để debug

**Status:** ✅ Đã được xử lý (normalize URL, lưu vào localStorage)

---

### 2. ⚠️ User Provisioning Logic Không Cần Thiết

**Vấn đề:**
- Frontend đang gọi `/users/search` để check user existence
- Endpoint này yêu cầu `ADMIN` permission → 403 Forbidden
- Backend đã tự động tạo user trong OAuth flow

**Code hiện tại:**
```typescript
// auth/callback/page.tsx line 51-136
const checkResponse = await fetch(searchUrl.toString(), {
  headers: {
    'Authorization': `Bearer ${bearerToken}`,
  },
})
// 403 Forbidden → fallback to token role
```

**Backend Behavior:**
- `OutboundAuthenticationService.createNewAccountFromOAuth()` tự động tạo user
- User được tạo với role "USER" mặc định
- Không cần frontend check/create user

**Giải pháp:**
- **Option 1:** Xóa hoàn toàn logic check user (recommended)
- **Option 2:** Giữ logic nhưng handle 403 gracefully (current approach)

**Status:** ⚠️ Đã handle 403 nhưng logic vẫn không cần thiết

**Recommendation:** Xóa `handleUserProvisioning()` function, chỉ dùng role từ token

---

### 3. ✅ Role Mapping Logic

**Vấn đề:**
- Backend trả về roles: `["USER", "ADMIN", "MANAGER", "STAFF"]`
- Frontend cần map sang: `admin | office | staff | user`
- Mapping có thể không đầy đủ

**Code hiện tại:**
```typescript
// auth-service.ts line 31-43
export const mapRoleToAppRole = (role?: string): 'admin' | 'office' | 'staff' | 'user' => {
  if (!role) return 'user'
  const r = role.trim().toUpperCase()
  if (['ADMIN','ADMIN_SYSTEM','ADMIN_SYTEM','ADMINISTRATOR'].includes(r)) return 'admin'
  if (['MANAGER','ADMINISTRATIVE','ADMINITRATIVE','OFFICE'].includes(r)) return 'office'
  if (['STAFF','SECURITY','SERCURITY'].includes(r)) return 'staff'
  if (['LECTURER','GUEST','USER'].includes(r)) return 'user'
  return 'user'
}
```

**Backend Roles:**
- `ADMIN` → `admin` ✅
- `MANAGER` → `office` ✅
- `STAFF` → `staff` ✅
- `USER` → `user` ✅

**Status:** ✅ Mapping logic đúng

---

### 4. ⚠️ Role Validation Logic

**Vấn đề:**
- Frontend check role mismatch giữa `selectedRole` và `databaseRole`
- Logic: Non-admin phải login với role của mình
- Admin có thể login với bất kỳ role nào

**Code hiện tại:**
```typescript
// auth/callback/page.tsx line 220-231
if (databaseRole && databaseRole !== 'admin') {
  if (selectedRoleFromLogin && selectedRoleFromLogin !== databaseRole) {
    await authService.logout();
    router.push('/login?error=role_mismatch');
    return;
  }
}
```

**Vấn đề:**
- `databaseRole` được lấy từ token/introspect (đúng)
- Nhưng `selectedRoleFromLogin` là từ sessionStorage (user input)
- Có thể không khớp với backend role

**Giải pháp:**
- **Option 1:** Bỏ role selection, chỉ dùng role từ backend (recommended)
- **Option 2:** Giữ role selection nhưng validate chặt chẽ hơn

**Status:** ⚠️ Logic đúng nhưng có thể đơn giản hóa

---

### 5. ✅ Token Storage & Cookies

**Vấn đề:**
- Token được lưu trong localStorage
- Cookie cũng được set cho middleware
- Cần đảm bảo consistency

**Code hiện tại:**
```typescript
// auth-service.ts line 435-447
setTokens(tokens: AuthTokens): void {
  localStorage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken)
  cookieManager.setAccessToken(tokens.accessToken)
  // ...
}

// auth/callback/page.tsx line 253-254
document.cookie = `role=${actualRole}; path=/; max-age=86400`;
document.cookie = `isLoggedIn=true; path=/; max-age=86400`;
```

**Status:** ✅ Token storage đúng

---

### 6. ⚠️ Response Parsing

**Vấn đề:**
- Backend trả về format: `{ responseCode, message, data }`
- Frontend cần parse đúng format
- Có thể có edge cases

**Code hiện tại:**
```typescript
// auth-service.ts line 340-430
const data = response.data as any
const accessToken = data.token || data.accessToken || data.access_token
const accountInfo = data.accountInfo
```

**Backend Response Format:**
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "authenticated": true,
    "token": "jwt_token",
    "accountInfo": {
      "id": "...",
      "email": "...",
      "roleName": ["USER"]
    }
  }
}
```

**Status:** ✅ Parsing logic đúng

---

### 7. ⚠️ Error Handling

**Vấn đề:**
- Error messages có thể không user-friendly
- Một số errors không được handle đầy đủ
- Cần cải thiện error messages

**Code hiện tại:**
```typescript
// auth/callback/page.tsx line 281-312
catch (err) {
  const errorMessage = err instanceof Error ? err.message : 'Có lỗi xảy ra'
  // Map error codes
  let errorParam = 'auth_failed'
  if (errorMessage.includes('hết hạn')) errorParam = 'code_expired'
  // ...
}
```

**Status:** ⚠️ Có thể cải thiện

---

## Recommendations

### Priority 1: Đơn giản hóa User Provisioning

**Action:** Xóa `handleUserProvisioning()` function

**Reason:**
- Backend đã tự động tạo user
- Frontend không cần check/create user
- Giảm complexity và API calls

**Code change:**
```typescript
// auth/callback/page.tsx
// Xóa handleUserProvisioning function
// Chỉ dùng role từ token/introspect
const rawActualRole = (userInfo.roles?.[0] as string) || userInfo.role || 'user'
```

---

### Priority 2: Đơn giản hóa Role Selection

**Action:** Bỏ role selection hoặc chỉ cho admin

**Reason:**
- User chỉ nên login với role của mình
- Role selection có thể gây confusion
- Backend đã có role trong token

**Code change:**
```typescript
// login/page.tsx
// Option 1: Bỏ role selection hoàn toàn
// Option 2: Chỉ hiện role selection cho admin (sau khi login)
```

---

### Priority 3: Cải thiện Error Handling

**Action:** Map backend error codes sang user-friendly messages

**Code change:**
```typescript
// auth/callback/page.tsx
const mapErrorCode = (errorCode: string): string => {
  const errorMap: Record<string, string> = {
    'AU0001': 'Xác thực thất bại. Vui lòng đăng nhập lại.',
    'S0001': 'Lỗi hệ thống. Vui lòng thử lại sau.',
    'S0003': 'Không tìm thấy tài nguyên.',
    // ...
  }
  return errorMap[errorCode] || 'Có lỗi xảy ra. Vui lòng thử lại.'
}
```

---

### Priority 4: Validate Callback URL

**Action:** Validate callback URL format và log chi tiết

**Code change:**
```typescript
// auth-service.ts
const validateCallbackUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}
```

---

## Testing Checklist

- [ ] Login với Google OAuth
- [ ] Callback URL khớp với Google Console
- [ ] Token được lưu đúng
- [ ] User info được parse đúng
- [ ] Role mapping đúng
- [ ] Redirect đúng theo role
- [ ] Error handling đầy đủ
- [ ] Logout hoạt động đúng
- [ ] Token refresh hoạt động đúng
- [ ] Middleware check role đúng

---

## Summary

**Issues Found:**
1. ✅ Callback URL - Đã được xử lý
2. ⚠️ User provisioning - Logic không cần thiết, nên xóa
3. ✅ Role mapping - Đúng
4. ⚠️ Role validation - Có thể đơn giản hóa
5. ✅ Token storage - Đúng
6. ✅ Response parsing - Đúng
7. ⚠️ Error handling - Có thể cải thiện

**Priority Actions:**
1. Xóa `handleUserProvisioning()` function
2. Đơn giản hóa role selection logic
3. Cải thiện error handling với error code mapping


## Tổng quan Login Flow

### Flow hiện tại:

1. **Login Page** (`/login`)
   - User chọn role (optional)
   - Click "Đăng nhập với Google"
   - Gọi `loginWithGoogle()` → `authService.getGoogleOAuthUrl()`
   - Redirect đến Google OAuth

2. **OAuth Callback** (`/auth/callback`)
   - Google redirect về với `code` và `state`
   - Gọi `authService.handleOAuthCallback(code, state)`
   - Exchange code → Get tokens → Save user info
   - Check user existence → Validate role → Redirect

3. **Auth Service**
   - `getGoogleOAuthUrl()`: GET `/auth/oauth2/google/redirect-url`
   - `handleOAuthCallback()`: POST `/auth/outbound/authentication`
   - `introspectToken()`: POST `/auth/introspect`

---

## Issues Phát Hiện

### 1. ❌ Callback URL Format

**Vấn đề:**
- Frontend lưu callback URL: `/api/auth/callback/google`
- Backend có thể expect format khác
- Callback URL phải khớp CHÍNH XÁC với Google OAuth Console

**Code hiện tại:**
```typescript
// auth-service.ts line 65-67
let callbackUrl = typeof window !== 'undefined' 
  ? `${window.location.origin}/api/auth/callback/google`
  : 'http://localhost:3000/api/auth/callback/google'
```

**Backend API:**
- Endpoint: `GET /auth/oauth2/google/redirect-url?redirectUri=...`
- Backend sẽ sử dụng `redirectUri` này để đăng ký với Google

**Giải pháp:**
- Đảm bảo callback URL khớp với Google OAuth Console
- Normalize URL (loại bỏ trailing slash)
- Log callback URL để debug

**Status:** ✅ Đã được xử lý (normalize URL, lưu vào localStorage)

---

### 2. ⚠️ User Provisioning Logic Không Cần Thiết

**Vấn đề:**
- Frontend đang gọi `/users/search` để check user existence
- Endpoint này yêu cầu `ADMIN` permission → 403 Forbidden
- Backend đã tự động tạo user trong OAuth flow

**Code hiện tại:**
```typescript
// auth/callback/page.tsx line 51-136
const checkResponse = await fetch(searchUrl.toString(), {
  headers: {
    'Authorization': `Bearer ${bearerToken}`,
  },
})
// 403 Forbidden → fallback to token role
```

**Backend Behavior:**
- `OutboundAuthenticationService.createNewAccountFromOAuth()` tự động tạo user
- User được tạo với role "USER" mặc định
- Không cần frontend check/create user

**Giải pháp:**
- **Option 1:** Xóa hoàn toàn logic check user (recommended)
- **Option 2:** Giữ logic nhưng handle 403 gracefully (current approach)

**Status:** ⚠️ Đã handle 403 nhưng logic vẫn không cần thiết

**Recommendation:** Xóa `handleUserProvisioning()` function, chỉ dùng role từ token

---

### 3. ✅ Role Mapping Logic

**Vấn đề:**
- Backend trả về roles: `["USER", "ADMIN", "MANAGER", "STAFF"]`
- Frontend cần map sang: `admin | office | staff | user`
- Mapping có thể không đầy đủ

**Code hiện tại:**
```typescript
// auth-service.ts line 31-43
export const mapRoleToAppRole = (role?: string): 'admin' | 'office' | 'staff' | 'user' => {
  if (!role) return 'user'
  const r = role.trim().toUpperCase()
  if (['ADMIN','ADMIN_SYSTEM','ADMIN_SYTEM','ADMINISTRATOR'].includes(r)) return 'admin'
  if (['MANAGER','ADMINISTRATIVE','ADMINITRATIVE','OFFICE'].includes(r)) return 'office'
  if (['STAFF','SECURITY','SERCURITY'].includes(r)) return 'staff'
  if (['LECTURER','GUEST','USER'].includes(r)) return 'user'
  return 'user'
}
```

**Backend Roles:**
- `ADMIN` → `admin` ✅
- `MANAGER` → `office` ✅
- `STAFF` → `staff` ✅
- `USER` → `user` ✅

**Status:** ✅ Mapping logic đúng

---

### 4. ⚠️ Role Validation Logic

**Vấn đề:**
- Frontend check role mismatch giữa `selectedRole` và `databaseRole`
- Logic: Non-admin phải login với role của mình
- Admin có thể login với bất kỳ role nào

**Code hiện tại:**
```typescript
// auth/callback/page.tsx line 220-231
if (databaseRole && databaseRole !== 'admin') {
  if (selectedRoleFromLogin && selectedRoleFromLogin !== databaseRole) {
    await authService.logout();
    router.push('/login?error=role_mismatch');
    return;
  }
}
```

**Vấn đề:**
- `databaseRole` được lấy từ token/introspect (đúng)
- Nhưng `selectedRoleFromLogin` là từ sessionStorage (user input)
- Có thể không khớp với backend role

**Giải pháp:**
- **Option 1:** Bỏ role selection, chỉ dùng role từ backend (recommended)
- **Option 2:** Giữ role selection nhưng validate chặt chẽ hơn

**Status:** ⚠️ Logic đúng nhưng có thể đơn giản hóa

---

### 5. ✅ Token Storage & Cookies

**Vấn đề:**
- Token được lưu trong localStorage
- Cookie cũng được set cho middleware
- Cần đảm bảo consistency

**Code hiện tại:**
```typescript
// auth-service.ts line 435-447
setTokens(tokens: AuthTokens): void {
  localStorage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken)
  cookieManager.setAccessToken(tokens.accessToken)
  // ...
}

// auth/callback/page.tsx line 253-254
document.cookie = `role=${actualRole}; path=/; max-age=86400`;
document.cookie = `isLoggedIn=true; path=/; max-age=86400`;
```

**Status:** ✅ Token storage đúng

---

### 6. ⚠️ Response Parsing

**Vấn đề:**
- Backend trả về format: `{ responseCode, message, data }`
- Frontend cần parse đúng format
- Có thể có edge cases

**Code hiện tại:**
```typescript
// auth-service.ts line 340-430
const data = response.data as any
const accessToken = data.token || data.accessToken || data.access_token
const accountInfo = data.accountInfo
```

**Backend Response Format:**
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "authenticated": true,
    "token": "jwt_token",
    "accountInfo": {
      "id": "...",
      "email": "...",
      "roleName": ["USER"]
    }
  }
}
```

**Status:** ✅ Parsing logic đúng

---

### 7. ⚠️ Error Handling

**Vấn đề:**
- Error messages có thể không user-friendly
- Một số errors không được handle đầy đủ
- Cần cải thiện error messages

**Code hiện tại:**
```typescript
// auth/callback/page.tsx line 281-312
catch (err) {
  const errorMessage = err instanceof Error ? err.message : 'Có lỗi xảy ra'
  // Map error codes
  let errorParam = 'auth_failed'
  if (errorMessage.includes('hết hạn')) errorParam = 'code_expired'
  // ...
}
```

**Status:** ⚠️ Có thể cải thiện

---

## Recommendations

### Priority 1: Đơn giản hóa User Provisioning

**Action:** Xóa `handleUserProvisioning()` function

**Reason:**
- Backend đã tự động tạo user
- Frontend không cần check/create user
- Giảm complexity và API calls

**Code change:**
```typescript
// auth/callback/page.tsx
// Xóa handleUserProvisioning function
// Chỉ dùng role từ token/introspect
const rawActualRole = (userInfo.roles?.[0] as string) || userInfo.role || 'user'
```

---

### Priority 2: Đơn giản hóa Role Selection

**Action:** Bỏ role selection hoặc chỉ cho admin

**Reason:**
- User chỉ nên login với role của mình
- Role selection có thể gây confusion
- Backend đã có role trong token

**Code change:**
```typescript
// login/page.tsx
// Option 1: Bỏ role selection hoàn toàn
// Option 2: Chỉ hiện role selection cho admin (sau khi login)
```

---

### Priority 3: Cải thiện Error Handling

**Action:** Map backend error codes sang user-friendly messages

**Code change:**
```typescript
// auth/callback/page.tsx
const mapErrorCode = (errorCode: string): string => {
  const errorMap: Record<string, string> = {
    'AU0001': 'Xác thực thất bại. Vui lòng đăng nhập lại.',
    'S0001': 'Lỗi hệ thống. Vui lòng thử lại sau.',
    'S0003': 'Không tìm thấy tài nguyên.',
    // ...
  }
  return errorMap[errorCode] || 'Có lỗi xảy ra. Vui lòng thử lại.'
}
```

---

### Priority 4: Validate Callback URL

**Action:** Validate callback URL format và log chi tiết

**Code change:**
```typescript
// auth-service.ts
const validateCallbackUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}
```

---

## Testing Checklist

- [ ] Login với Google OAuth
- [ ] Callback URL khớp với Google Console
- [ ] Token được lưu đúng
- [ ] User info được parse đúng
- [ ] Role mapping đúng
- [ ] Redirect đúng theo role
- [ ] Error handling đầy đủ
- [ ] Logout hoạt động đúng
- [ ] Token refresh hoạt động đúng
- [ ] Middleware check role đúng

---

## Summary

**Issues Found:**
1. ✅ Callback URL - Đã được xử lý
2. ⚠️ User provisioning - Logic không cần thiết, nên xóa
3. ✅ Role mapping - Đúng
4. ⚠️ Role validation - Có thể đơn giản hóa
5. ✅ Token storage - Đúng
6. ✅ Response parsing - Đúng
7. ⚠️ Error handling - Có thể cải thiện

**Priority Actions:**
1. Xóa `handleUserProvisioning()` function
2. Đơn giản hóa role selection logic
3. Cải thiện error handling với error code mapping

