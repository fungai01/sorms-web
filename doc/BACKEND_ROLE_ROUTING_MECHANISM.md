# Backend Role Routing Mechanism Analysis

## Tổng Quan

Backend **KHÔNG có cơ chế điều hướng (routing/redirect) dựa trên role**. Backend chỉ cung cấp:
1. **Authentication**: Xác thực user và trả về JWT token
2. **Authorization**: Kiểm tra quyền truy cập endpoint thông qua `@PreAuthorize`
3. **Role Information**: Trả về roles trong token và accountInfo

**Frontend phải tự điều hướng** dựa trên role từ token.

## 1. Authentication Response

### AuthenticationResponse Structure

**File**: `AuthenticationResponse.java`

```java
public class AuthenticationResponse {
    private String token;              // JWT token
    private Boolean authenticated;     // true/false
    private AccountInfoAuthenticateDTO accountInfo;  // User info với roles
}
```

**AccountInfoAuthenticateDTO Structure:**
```java
public class AccountInfoAuthenticateDTO {
    private String id;
    private String email;
    private String firstName;
    private String lastName;
    private String avatarUrl;
    private List<String> roleName;    // Array of roles: ["admin", "user"]
}
```

**Không có:**
- ❌ `redirectUrl` field
- ❌ `redirectPath` field
- ❌ `defaultRoute` field
- ❌ Logic redirect dựa trên role

## 2. Authorization Mechanism

### @PreAuthorize Annotations

Backend sử dụng `@PreAuthorize` để kiểm tra quyền truy cập endpoint:

**RoomController & RoomTypeController:**
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
public class RoomController {
    // Tất cả endpoints yêu cầu STAFF, MANAGER, hoặc ADMIN
}
```

**UserManagementController & RoleController:**
```java
@PreAuthorize("hasAuthority('ADMIN')")
public class UserManagementController {
    // Chỉ ADMIN mới truy cập được
}
```

**BookingController:**
```java
@PostMapping
@PreAuthorize("hasAuthority('USER')")  // createBooking
public ResponseEntity<...> createBooking(...) { ... }

@PutMapping("/{id}")
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // updateBooking
public ResponseEntity<...> updateBooking(...) { ... }

@DeleteMapping("/{id}")
@PreAuthorize("hasAuthority('ADMIN')")  // deleteBooking
public ResponseEntity<...> deleteBooking(...) { ... }
```

**OrderController:**
```java
@PreAuthorize("hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')")  // Class level
public class OrderController {
    @PostMapping("/{orderId}/staff/confirm")
    @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // Method level
    public ResponseEntity<...> staffConfirmOrder(...) { ... }
}
```

### Cách Hoạt Động

1. **Request đến endpoint** → Spring Security kiểm tra `@PreAuthorize`
2. **Nếu không có Authentication** → Throw `AccessDeniedException` hoặc `Exception`
3. **Nếu có Authentication nhưng không đủ quyền** → Throw `AccessDeniedException`
4. **Nếu có đủ quyền** → Cho phép truy cập endpoint

**Vấn đề:**
- ❌ Backend không có JWT Filter để parse token và set Authentication
- ❌ `@PreAuthorize` không thể hoạt động vì không có Authentication trong SecurityContext
- ❌ Dẫn đến lỗi `SYSTEM_ERROR` (S0001)

## 3. Role Information trong Token

### JWT Token Structure

**File**: `JWTProvider.java`

```java
JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
    .claim("scope", buildScope(roles))      // "ROLE_USER ROLE_ADMIN" (với prefix ROLE_)
    .claim("roles", roles)                  // ["USER", "ADMIN"] hoặc ["user", "admin"]
    .claim("accountInfo", accountJson)      // Account info JSON string
    .build();
```

**Roles trong token:**
- `roles`: Array of role names từ `Role.getName()` (có thể là "USER" hoặc "user" tùy data)
- `scope`: Space-separated roles với prefix "ROLE_" (dùng cho OAuth2 scope)

### AccountInfo trong Token

```json
{
  "accountInfo": {
    "id": "1",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "avatarUrl": "...",
    "roles": ["admin", "user"]  // Từ AccountRole → Role.getName()
  }
}
```

## 4. Không Có Routing Logic

### Không Có Interceptor/Filter cho Routing

**Tìm kiếm:**
- ❌ Không có `RoleRoutingInterceptor`
- ❌ Không có `RoleBasedRedirectFilter`
- ❌ Không có `RoleRoutingAspect`

### Không Có Redirect Endpoint

**AuthenticationController không có:**
- ❌ `/auth/redirect` endpoint
- ❌ `/auth/route` endpoint
- ❌ Logic redirect dựa trên role

**Chỉ có:**
- ✅ `/auth/outbound/authentication` - Trả về token và accountInfo
- ✅ `/auth/login` - Trả về token và accountInfo
- ✅ `/auth/introspect` - Validate token và trả về accountInfo

## 5. Frontend Phải Tự Điều Hướng

### Flow Điều Hướng

```
1. User login → Backend trả về token + accountInfo (có roles)
2. Frontend parse roles từ accountInfo.roleName[]
3. Frontend map roles sang app routes:
   - "admin" → /admin/*
   - "office" → /office/*
   - "staff" → /staff/*
   - "user" → /user/*
4. Frontend redirect user đến route tương ứng
```

### Frontend Code (Middleware)

**File**: `middleware.ts`

```typescript
// Lấy role từ cookie
const roleFromCookie = cookies().get('role')?.value

// Điều hướng dựa trên role
if (roleFromCookie === 'admin' && pathname.startsWith('/admin')) {
  // Cho phép truy cập
} else if (roleFromCookie === 'office' && pathname.startsWith('/office')) {
  // Cho phép truy cập
}
// ...
```

## 6. Kết Luận

### Backend Không Có:
1. ❌ Cơ chế redirect dựa trên role
2. ❌ Routing logic dựa trên role
3. ❌ Interceptor/Filter để điều hướng
4. ❌ Redirect URL trong authentication response

### Backend Có:
1. ✅ Authentication: Trả về token và accountInfo
2. ✅ Authorization: `@PreAuthorize` để kiểm tra quyền truy cập endpoint
3. ✅ Role Information: Roles trong token và accountInfo

### Frontend Phải:
1. ✅ Parse roles từ token/accountInfo
2. ✅ Map roles sang app routes
3. ✅ Redirect user đến route tương ứng
4. ✅ Kiểm tra quyền truy cập route trong middleware

### Vấn Đề Hiện Tại:
1. ❌ Backend không có JWT Filter → `@PreAuthorize` không hoạt động
2. ❌ Frontend không thể lấy data vì backend trả về `SYSTEM_ERROR`
3. ❌ Cần sửa backend để `@PreAuthorize` hoạt động (thêm JWT Filter)

## 7. Recommendation

### Nếu Muốn Backend Điều Hướng:

**Option 1: Thêm Redirect URL vào AuthenticationResponse**
```java
public class AuthenticationResponse {
    private String token;
    private Boolean authenticated;
    private AccountInfoAuthenticateDTO accountInfo;
    private String redirectUrl;  // Thêm field này
}
```

**Option 2: Tạo Endpoint Riêng**
```java
@GetMapping("/auth/redirect")
public ResponseEntity<ApiResponse<String>> getRedirectUrl(
    @RequestHeader("Authorization") String token) {
    // Parse token, lấy roles, trả về redirect URL
    String redirectUrl = determineRedirectUrl(roles);
    return ResponseEntity.ok(redirectUrl);
}
```

**Nhưng hiện tại:** Frontend đã tự điều hướng, không cần backend làm việc này.


## Tổng Quan

Backend **KHÔNG có cơ chế điều hướng (routing/redirect) dựa trên role**. Backend chỉ cung cấp:
1. **Authentication**: Xác thực user và trả về JWT token
2. **Authorization**: Kiểm tra quyền truy cập endpoint thông qua `@PreAuthorize`
3. **Role Information**: Trả về roles trong token và accountInfo

**Frontend phải tự điều hướng** dựa trên role từ token.

## 1. Authentication Response

### AuthenticationResponse Structure

**File**: `AuthenticationResponse.java`

```java
public class AuthenticationResponse {
    private String token;              // JWT token
    private Boolean authenticated;     // true/false
    private AccountInfoAuthenticateDTO accountInfo;  // User info với roles
}
```

**AccountInfoAuthenticateDTO Structure:**
```java
public class AccountInfoAuthenticateDTO {
    private String id;
    private String email;
    private String firstName;
    private String lastName;
    private String avatarUrl;
    private List<String> roleName;    // Array of roles: ["admin", "user"]
}
```

**Không có:**
- ❌ `redirectUrl` field
- ❌ `redirectPath` field
- ❌ `defaultRoute` field
- ❌ Logic redirect dựa trên role

## 2. Authorization Mechanism

### @PreAuthorize Annotations

Backend sử dụng `@PreAuthorize` để kiểm tra quyền truy cập endpoint:

**RoomController & RoomTypeController:**
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
public class RoomController {
    // Tất cả endpoints yêu cầu STAFF, MANAGER, hoặc ADMIN
}
```

**UserManagementController & RoleController:**
```java
@PreAuthorize("hasAuthority('ADMIN')")
public class UserManagementController {
    // Chỉ ADMIN mới truy cập được
}
```

**BookingController:**
```java
@PostMapping
@PreAuthorize("hasAuthority('USER')")  // createBooking
public ResponseEntity<...> createBooking(...) { ... }

@PutMapping("/{id}")
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // updateBooking
public ResponseEntity<...> updateBooking(...) { ... }

@DeleteMapping("/{id}")
@PreAuthorize("hasAuthority('ADMIN')")  // deleteBooking
public ResponseEntity<...> deleteBooking(...) { ... }
```

**OrderController:**
```java
@PreAuthorize("hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')")  // Class level
public class OrderController {
    @PostMapping("/{orderId}/staff/confirm")
    @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // Method level
    public ResponseEntity<...> staffConfirmOrder(...) { ... }
}
```

### Cách Hoạt Động

1. **Request đến endpoint** → Spring Security kiểm tra `@PreAuthorize`
2. **Nếu không có Authentication** → Throw `AccessDeniedException` hoặc `Exception`
3. **Nếu có Authentication nhưng không đủ quyền** → Throw `AccessDeniedException`
4. **Nếu có đủ quyền** → Cho phép truy cập endpoint

**Vấn đề:**
- ❌ Backend không có JWT Filter để parse token và set Authentication
- ❌ `@PreAuthorize` không thể hoạt động vì không có Authentication trong SecurityContext
- ❌ Dẫn đến lỗi `SYSTEM_ERROR` (S0001)

## 3. Role Information trong Token

### JWT Token Structure

**File**: `JWTProvider.java`

```java
JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
    .claim("scope", buildScope(roles))      // "ROLE_USER ROLE_ADMIN" (với prefix ROLE_)
    .claim("roles", roles)                  // ["USER", "ADMIN"] hoặc ["user", "admin"]
    .claim("accountInfo", accountJson)      // Account info JSON string
    .build();
```

**Roles trong token:**
- `roles`: Array of role names từ `Role.getName()` (có thể là "USER" hoặc "user" tùy data)
- `scope`: Space-separated roles với prefix "ROLE_" (dùng cho OAuth2 scope)

### AccountInfo trong Token

```json
{
  "accountInfo": {
    "id": "1",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "avatarUrl": "...",
    "roles": ["admin", "user"]  // Từ AccountRole → Role.getName()
  }
}
```

## 4. Không Có Routing Logic

### Không Có Interceptor/Filter cho Routing

**Tìm kiếm:**
- ❌ Không có `RoleRoutingInterceptor`
- ❌ Không có `RoleBasedRedirectFilter`
- ❌ Không có `RoleRoutingAspect`

### Không Có Redirect Endpoint

**AuthenticationController không có:**
- ❌ `/auth/redirect` endpoint
- ❌ `/auth/route` endpoint
- ❌ Logic redirect dựa trên role

**Chỉ có:**
- ✅ `/auth/outbound/authentication` - Trả về token và accountInfo
- ✅ `/auth/login` - Trả về token và accountInfo
- ✅ `/auth/introspect` - Validate token và trả về accountInfo

## 5. Frontend Phải Tự Điều Hướng

### Flow Điều Hướng

```
1. User login → Backend trả về token + accountInfo (có roles)
2. Frontend parse roles từ accountInfo.roleName[]
3. Frontend map roles sang app routes:
   - "admin" → /admin/*
   - "office" → /office/*
   - "staff" → /staff/*
   - "user" → /user/*
4. Frontend redirect user đến route tương ứng
```

### Frontend Code (Middleware)

**File**: `middleware.ts`

```typescript
// Lấy role từ cookie
const roleFromCookie = cookies().get('role')?.value

// Điều hướng dựa trên role
if (roleFromCookie === 'admin' && pathname.startsWith('/admin')) {
  // Cho phép truy cập
} else if (roleFromCookie === 'office' && pathname.startsWith('/office')) {
  // Cho phép truy cập
}
// ...
```

## 6. Kết Luận

### Backend Không Có:
1. ❌ Cơ chế redirect dựa trên role
2. ❌ Routing logic dựa trên role
3. ❌ Interceptor/Filter để điều hướng
4. ❌ Redirect URL trong authentication response

### Backend Có:
1. ✅ Authentication: Trả về token và accountInfo
2. ✅ Authorization: `@PreAuthorize` để kiểm tra quyền truy cập endpoint
3. ✅ Role Information: Roles trong token và accountInfo

### Frontend Phải:
1. ✅ Parse roles từ token/accountInfo
2. ✅ Map roles sang app routes
3. ✅ Redirect user đến route tương ứng
4. ✅ Kiểm tra quyền truy cập route trong middleware

### Vấn Đề Hiện Tại:
1. ❌ Backend không có JWT Filter → `@PreAuthorize` không hoạt động
2. ❌ Frontend không thể lấy data vì backend trả về `SYSTEM_ERROR`
3. ❌ Cần sửa backend để `@PreAuthorize` hoạt động (thêm JWT Filter)

## 7. Recommendation

### Nếu Muốn Backend Điều Hướng:

**Option 1: Thêm Redirect URL vào AuthenticationResponse**
```java
public class AuthenticationResponse {
    private String token;
    private Boolean authenticated;
    private AccountInfoAuthenticateDTO accountInfo;
    private String redirectUrl;  // Thêm field này
}
```

**Option 2: Tạo Endpoint Riêng**
```java
@GetMapping("/auth/redirect")
public ResponseEntity<ApiResponse<String>> getRedirectUrl(
    @RequestHeader("Authorization") String token) {
    // Parse token, lấy roles, trả về redirect URL
    String redirectUrl = determineRedirectUrl(roles);
    return ResponseEntity.ok(redirectUrl);
}
```

**Nhưng hiện tại:** Frontend đã tự điều hướng, không cần backend làm việc này.

