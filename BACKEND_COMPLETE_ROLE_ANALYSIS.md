# Backend Complete Role Mechanism Analysis

## 1. Tổng Quan Cơ Chế Role

### 1.1 Role Structure
- **RoleCode Enum**: `USER`, `ADMIN`, `STAFF`, `MANAGER` (uppercase)
- **Role Entity**: `name` là primary key (có thể là "USER" hoặc "user" tùy data trong DB)
- **AccountRole**: Lưu `roleId` = `Role.name` (không phải `Role.code`)

### 1.2 Flow Lấy Roles
```
AccountRole.getRoleId() 
  → Role.findById(roleId)  // Tìm bằng name (primary key)
  → Role.getName() 
  → Đưa vào JWT token
```

### 1.3 JWT Token Structure
```java
JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
    .claim("scope", buildScope(roles))      // "ROLE_USER ROLE_ADMIN" (với prefix ROLE_)
    .claim("roles", roles)                  // ["USER", "ADMIN"] hoặc ["user", "admin"]
    .build();
```

**buildScope() Method:**
```java
private String buildScope(List<String> roles) {
    StringJoiner stringJoiner = new StringJoiner(" ");
    roles.forEach(role -> {
        stringJoiner.add("ROLE_" + role);  // Thêm prefix "ROLE_"
    });
    return stringJoiner.toString();
}
```

## 2. Phân Tích Các Service

### 2.1 AuthenticateService (Email/Password Login)
**File**: `AuthenticateService.java`
**Vấn đề nghiêm trọng:**
```java
List<String> roles = null;  // ❌ BUG: roles = null
String token = jwtProvider.generateToken(account.get(), roles);
```

**Hậu quả:**
- Token được tạo với `roles = null`
- JWT token không có `roles` claim hoặc `roles = []`
- User không có roles trong token → không thể authorize

**Cần sửa:**
```java
// Lấy roles từ AccountRole
List<AccountRole> accountRoles = accountRoleDomainService.findByFields(
    Map.of("accountId", account.get().getId())
);

List<String> roles = accountRoles.stream()
    .map(AccountRole::getRoleId)
    .map(roleId -> roleDomainService.findById(roleId).orElse(null))
    .filter(Objects::nonNull)
    .map(Role::getName)
    .collect(Collectors.toList());
```

### 2.2 OutboundAuthenticationService (OAuth Login)
**File**: `OutboundAuthenticationService.java`
**✅ Đúng:**
```java
// Step 4: Get roles for account
List<AccountRole> accountRoles = accountRoleDomainService.findByFields(
    Map.of("accountId", account.getId())
);

List<String> roles = accountRoles.stream()
    .map(AccountRole::getRoleId)
    .map(roleId -> roleDomainService.findById(roleId).orElse(null))
    .filter(Objects::nonNull)
    .map(Role::getName)
    .collect(Collectors.toList());

// Step 5: Generate JWT token for the user
String token = jwtProvider.generateToken(account, roles);
```

### 2.3 RefreshTokenService
**File**: `RefreshTokenService.java`
**✅ Đúng:** Có lấy roles từ AccountRole trước khi generate token mới

### 2.4 MobileOutboundAuthenticationService
**File**: `MobileOutboundAuthenticationService.java`
**✅ Đúng:** Có lấy roles từ AccountRole trước khi generate token

### 2.5 IntrospectService
**File**: `IntrospectService.java`
**✅ Đúng:** Có extract `roles` claim từ JWT token

## 3. Phân Tích Controllers

### 3.1 @PreAuthorize Annotations

**RoomController & RoomTypeController:**
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```

**UserManagementController & RoleController:**
```java
@PreAuthorize("hasAuthority('ADMIN')")
```

**BookingController:**
```java
@PreAuthorize("hasAuthority('USER')")  // createBooking
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // updateBooking
@PreAuthorize("hasAuthority('ADMIN')")  // deleteBooking
@PreAuthorize("hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')")  // getBookingById, getBookingsByUser
```

**OrderController:**
```java
@PreAuthorize("hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')")  // Class level + method level
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // staffConfirmOrder, staffRejectOrder
@PreAuthorize("isAuthenticated()")  // getOrder, getMyOrders
```

**PaymentController:**
```java
@PreAuthorize("hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')")  // createPayment, getPaymentStatus
```

### 3.2 Vấn Đề với @PreAuthorize

**Yêu cầu:**
- `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')` yêu cầu authorities: `STAFF`, `MANAGER`, hoặc `ADMIN` (uppercase, không có prefix `ROLE_`)
- Spring Security cần `Authentication` object trong `SecurityContext`
- `Authentication` object phải có authorities đúng format

**Vấn đề:**
- ❌ Backend không có JWT Filter để parse token và set `Authentication` vào `SecurityContext`
- ❌ Khi `@PreAuthorize` được kiểm tra, `SecurityContext` không có `Authentication`
- ❌ Dẫn đến lỗi `SYSTEM_ERROR` (S0001)

## 4. Services Không Sử Dụng SecurityContext

**Phát hiện:**
- Không có code nào trong services để lấy current user từ `SecurityContext`
- Services không kiểm tra authentication/authorization
- Chỉ có controllers có `@PreAuthorize` annotations

**Ví dụ:**
- `GetAllRoomsService`: Không có logic kiểm tra user
- `GetAllRoomTypesService`: Không có logic kiểm tra user
- `SearchListUserService`: Không có logic kiểm tra user

## 5. GlobalExceptionHandler

**File**: `GlobalExceptionHandler.java`

**Xử lý AccessDeniedException:**
```java
@ExceptionHandler(value = AccessDeniedException.class)
ResponseEntity<ApiResponse<Object>> handlingAccessDeniedException(AccessDeniedException exception) {
    ErrorCode errorCode = ErrorCode.UNAUTHORIZED;  // S0006
    ApiResponse<Object> ApiResponse = new ApiResponse<>();
    ApiResponse.setMessage(errorCode.getValue());
    ApiResponse.setResponseCode(errorCode.getKey());
    ApiResponse.setData(null);
    return ResponseEntity.status(Integer.parseInt(String.valueOf(errorCode.getStatusCode())))
            .body(ApiResponse);
}
```

**Xử lý Exception chung:**
```java
@ExceptionHandler(value = Exception.class)
ResponseEntity<ApiResponse<Object>> handlingRuntimeException(Exception exception) {
    // ...
    ErrorCode errorCode = ErrorCode.SYSTEM_ERR;  // S0001
    // ...
    return ResponseEntity.status(errorCode.getStatusCode()).body(ApiResponse);
}
```

**Vấn đề:**
- Khi `@PreAuthorize` fail, có thể throw `AccessDeniedException` hoặc `Exception`
- Nếu throw `Exception` → trả về `S0001` (SYSTEM_ERROR)
- Nếu throw `AccessDeniedException` → trả về `S0006` (UNAUTHORIZED)

## 6. Vấn Đề Tổng Hợp

### 6.1 Vấn Đề 1: AuthenticateService không lấy roles
- **File**: `AuthenticateService.java`
- **Dòng**: 69
- **Mô tả**: `roles = null` khi login bằng email/password
- **Hậu quả**: Token không có roles → không thể authorize

### 6.2 Vấn Đề 2: Không có JWT Filter
- **Mô tả**: Backend không có filter để parse JWT token và set `Authentication` vào `SecurityContext`
- **Hậu quả**: `@PreAuthorize` không thể hoạt động vì không có `Authentication` object

### 6.3 Vấn Đề 3: Role Name Format
- **Mô tả**: `Role.getName()` có thể trả về "USER" (uppercase) hoặc "user" (lowercase) tùy vào data trong database
- **@PreAuthorize yêu cầu**: "ADMIN" (uppercase, không có prefix ROLE_)
- **Hậu quả**: Nếu role name là lowercase → không match với @PreAuthorize

### 6.4 Vấn Đề 4: WebSecurityConfig permitAll()
- **File**: `WebSecurityConfig.java`
- **Mô tả**: `auth.requestMatchers("/**").permitAll()` cho phép tất cả requests
- **Hậu quả**: Mặc dù có `@PreAuthorize`, nhưng `permitAll()` có thể bypass security

## 7. Kết Luận

### 7.1 Cơ Chế Role Hiện Tại
1. ✅ Roles được lưu trong database với `name` là primary key
2. ✅ AccountRole lưu `roleId` = `Role.name`
3. ✅ Khi tạo JWT token (OAuth), roles được lấy từ `Role.getName()`
4. ✅ JWT token có `roles` claim và `scope` claim (với prefix ROLE_)
5. ❌ **AuthenticateService không lấy roles** (bug nghiêm trọng)
6. ❌ **Không có JWT Filter** để parse token và set Authentication
7. ❌ **@PreAuthorize không thể hoạt động** vì không có Authentication trong SecurityContext

### 7.2 Cần Sửa
1. **Sửa AuthenticateService**: Lấy roles từ AccountRole trước khi generate token
2. **Thêm JWT Filter**: Parse JWT token, extract roles, map roles → authorities (uppercase), set Authentication vào SecurityContext
3. **Đảm bảo Role Name Format**: Đảm bảo `Role.getName()` trả về uppercase ("USER", "ADMIN", etc.) hoặc map lowercase → uppercase trong JWT Filter
4. **Sửa WebSecurityConfig**: Bỏ `permitAll()` và chỉ permit PUBLIC_ENDPOINTS, các endpoint khác cần authentication

### 7.3 Mapping Roles → Authorities
```java
// JWT token có: roles = ["admin", "user"] (có thể lowercase)
// Cần map thành: authorities = ["ADMIN", "USER"] (uppercase, không có prefix ROLE_)

List<GrantedAuthority> authorities = roles.stream()
    .map(role -> role.toUpperCase())              // "admin" → "ADMIN"
    .map(role -> new SimpleGrantedAuthority(role)) // "ADMIN" authority
    .collect(Collectors.toList());
```

**Lưu ý:**
- `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")` yêu cầu authorities: `STAFF`, `MANAGER`, `ADMIN` (không có prefix `ROLE_`)
- `scope` claim có prefix `ROLE_` nhưng không được dùng cho `@PreAuthorize`
- Chỉ `roles` claim được dùng, và cần map thành authorities (uppercase)


## 1. Tổng Quan Cơ Chế Role

### 1.1 Role Structure
- **RoleCode Enum**: `USER`, `ADMIN`, `STAFF`, `MANAGER` (uppercase)
- **Role Entity**: `name` là primary key (có thể là "USER" hoặc "user" tùy data trong DB)
- **AccountRole**: Lưu `roleId` = `Role.name` (không phải `Role.code`)

### 1.2 Flow Lấy Roles
```
AccountRole.getRoleId() 
  → Role.findById(roleId)  // Tìm bằng name (primary key)
  → Role.getName() 
  → Đưa vào JWT token
```

### 1.3 JWT Token Structure
```java
JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
    .claim("scope", buildScope(roles))      // "ROLE_USER ROLE_ADMIN" (với prefix ROLE_)
    .claim("roles", roles)                  // ["USER", "ADMIN"] hoặc ["user", "admin"]
    .build();
```

**buildScope() Method:**
```java
private String buildScope(List<String> roles) {
    StringJoiner stringJoiner = new StringJoiner(" ");
    roles.forEach(role -> {
        stringJoiner.add("ROLE_" + role);  // Thêm prefix "ROLE_"
    });
    return stringJoiner.toString();
}
```

## 2. Phân Tích Các Service

### 2.1 AuthenticateService (Email/Password Login)
**File**: `AuthenticateService.java`
**Vấn đề nghiêm trọng:**
```java
List<String> roles = null;  // ❌ BUG: roles = null
String token = jwtProvider.generateToken(account.get(), roles);
```

**Hậu quả:**
- Token được tạo với `roles = null`
- JWT token không có `roles` claim hoặc `roles = []`
- User không có roles trong token → không thể authorize

**Cần sửa:**
```java
// Lấy roles từ AccountRole
List<AccountRole> accountRoles = accountRoleDomainService.findByFields(
    Map.of("accountId", account.get().getId())
);

List<String> roles = accountRoles.stream()
    .map(AccountRole::getRoleId)
    .map(roleId -> roleDomainService.findById(roleId).orElse(null))
    .filter(Objects::nonNull)
    .map(Role::getName)
    .collect(Collectors.toList());
```

### 2.2 OutboundAuthenticationService (OAuth Login)
**File**: `OutboundAuthenticationService.java`
**✅ Đúng:**
```java
// Step 4: Get roles for account
List<AccountRole> accountRoles = accountRoleDomainService.findByFields(
    Map.of("accountId", account.getId())
);

List<String> roles = accountRoles.stream()
    .map(AccountRole::getRoleId)
    .map(roleId -> roleDomainService.findById(roleId).orElse(null))
    .filter(Objects::nonNull)
    .map(Role::getName)
    .collect(Collectors.toList());

// Step 5: Generate JWT token for the user
String token = jwtProvider.generateToken(account, roles);
```

### 2.3 RefreshTokenService
**File**: `RefreshTokenService.java`
**✅ Đúng:** Có lấy roles từ AccountRole trước khi generate token mới

### 2.4 MobileOutboundAuthenticationService
**File**: `MobileOutboundAuthenticationService.java`
**✅ Đúng:** Có lấy roles từ AccountRole trước khi generate token

### 2.5 IntrospectService
**File**: `IntrospectService.java`
**✅ Đúng:** Có extract `roles` claim từ JWT token

## 3. Phân Tích Controllers

### 3.1 @PreAuthorize Annotations

**RoomController & RoomTypeController:**
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```

**UserManagementController & RoleController:**
```java
@PreAuthorize("hasAuthority('ADMIN')")
```

**BookingController:**
```java
@PreAuthorize("hasAuthority('USER')")  // createBooking
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // updateBooking
@PreAuthorize("hasAuthority('ADMIN')")  // deleteBooking
@PreAuthorize("hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')")  // getBookingById, getBookingsByUser
```

**OrderController:**
```java
@PreAuthorize("hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')")  // Class level + method level
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // staffConfirmOrder, staffRejectOrder
@PreAuthorize("isAuthenticated()")  // getOrder, getMyOrders
```

**PaymentController:**
```java
@PreAuthorize("hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')")  // createPayment, getPaymentStatus
```

### 3.2 Vấn Đề với @PreAuthorize

**Yêu cầu:**
- `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')` yêu cầu authorities: `STAFF`, `MANAGER`, hoặc `ADMIN` (uppercase, không có prefix `ROLE_`)
- Spring Security cần `Authentication` object trong `SecurityContext`
- `Authentication` object phải có authorities đúng format

**Vấn đề:**
- ❌ Backend không có JWT Filter để parse token và set `Authentication` vào `SecurityContext`
- ❌ Khi `@PreAuthorize` được kiểm tra, `SecurityContext` không có `Authentication`
- ❌ Dẫn đến lỗi `SYSTEM_ERROR` (S0001)

## 4. Services Không Sử Dụng SecurityContext

**Phát hiện:**
- Không có code nào trong services để lấy current user từ `SecurityContext`
- Services không kiểm tra authentication/authorization
- Chỉ có controllers có `@PreAuthorize` annotations

**Ví dụ:**
- `GetAllRoomsService`: Không có logic kiểm tra user
- `GetAllRoomTypesService`: Không có logic kiểm tra user
- `SearchListUserService`: Không có logic kiểm tra user

## 5. GlobalExceptionHandler

**File**: `GlobalExceptionHandler.java`

**Xử lý AccessDeniedException:**
```java
@ExceptionHandler(value = AccessDeniedException.class)
ResponseEntity<ApiResponse<Object>> handlingAccessDeniedException(AccessDeniedException exception) {
    ErrorCode errorCode = ErrorCode.UNAUTHORIZED;  // S0006
    ApiResponse<Object> ApiResponse = new ApiResponse<>();
    ApiResponse.setMessage(errorCode.getValue());
    ApiResponse.setResponseCode(errorCode.getKey());
    ApiResponse.setData(null);
    return ResponseEntity.status(Integer.parseInt(String.valueOf(errorCode.getStatusCode())))
            .body(ApiResponse);
}
```

**Xử lý Exception chung:**
```java
@ExceptionHandler(value = Exception.class)
ResponseEntity<ApiResponse<Object>> handlingRuntimeException(Exception exception) {
    // ...
    ErrorCode errorCode = ErrorCode.SYSTEM_ERR;  // S0001
    // ...
    return ResponseEntity.status(errorCode.getStatusCode()).body(ApiResponse);
}
```

**Vấn đề:**
- Khi `@PreAuthorize` fail, có thể throw `AccessDeniedException` hoặc `Exception`
- Nếu throw `Exception` → trả về `S0001` (SYSTEM_ERROR)
- Nếu throw `AccessDeniedException` → trả về `S0006` (UNAUTHORIZED)

## 6. Vấn Đề Tổng Hợp

### 6.1 Vấn Đề 1: AuthenticateService không lấy roles
- **File**: `AuthenticateService.java`
- **Dòng**: 69
- **Mô tả**: `roles = null` khi login bằng email/password
- **Hậu quả**: Token không có roles → không thể authorize

### 6.2 Vấn Đề 2: Không có JWT Filter
- **Mô tả**: Backend không có filter để parse JWT token và set `Authentication` vào `SecurityContext`
- **Hậu quả**: `@PreAuthorize` không thể hoạt động vì không có `Authentication` object

### 6.3 Vấn Đề 3: Role Name Format
- **Mô tả**: `Role.getName()` có thể trả về "USER" (uppercase) hoặc "user" (lowercase) tùy vào data trong database
- **@PreAuthorize yêu cầu**: "ADMIN" (uppercase, không có prefix ROLE_)
- **Hậu quả**: Nếu role name là lowercase → không match với @PreAuthorize

### 6.4 Vấn Đề 4: WebSecurityConfig permitAll()
- **File**: `WebSecurityConfig.java`
- **Mô tả**: `auth.requestMatchers("/**").permitAll()` cho phép tất cả requests
- **Hậu quả**: Mặc dù có `@PreAuthorize`, nhưng `permitAll()` có thể bypass security

## 7. Kết Luận

### 7.1 Cơ Chế Role Hiện Tại
1. ✅ Roles được lưu trong database với `name` là primary key
2. ✅ AccountRole lưu `roleId` = `Role.name`
3. ✅ Khi tạo JWT token (OAuth), roles được lấy từ `Role.getName()`
4. ✅ JWT token có `roles` claim và `scope` claim (với prefix ROLE_)
5. ❌ **AuthenticateService không lấy roles** (bug nghiêm trọng)
6. ❌ **Không có JWT Filter** để parse token và set Authentication
7. ❌ **@PreAuthorize không thể hoạt động** vì không có Authentication trong SecurityContext

### 7.2 Cần Sửa
1. **Sửa AuthenticateService**: Lấy roles từ AccountRole trước khi generate token
2. **Thêm JWT Filter**: Parse JWT token, extract roles, map roles → authorities (uppercase), set Authentication vào SecurityContext
3. **Đảm bảo Role Name Format**: Đảm bảo `Role.getName()` trả về uppercase ("USER", "ADMIN", etc.) hoặc map lowercase → uppercase trong JWT Filter
4. **Sửa WebSecurityConfig**: Bỏ `permitAll()` và chỉ permit PUBLIC_ENDPOINTS, các endpoint khác cần authentication

### 7.3 Mapping Roles → Authorities
```java
// JWT token có: roles = ["admin", "user"] (có thể lowercase)
// Cần map thành: authorities = ["ADMIN", "USER"] (uppercase, không có prefix ROLE_)

List<GrantedAuthority> authorities = roles.stream()
    .map(role -> role.toUpperCase())              // "admin" → "ADMIN"
    .map(role -> new SimpleGrantedAuthority(role)) // "ADMIN" authority
    .collect(Collectors.toList());
```

**Lưu ý:**
- `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")` yêu cầu authorities: `STAFF`, `MANAGER`, `ADMIN` (không có prefix `ROLE_`)
- `scope` claim có prefix `ROLE_` nhưng không được dùng cho `@PreAuthorize`
- Chỉ `roles` claim được dùng, và cần map thành authorities (uppercase)

