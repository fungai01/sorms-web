# Backend Hiện Tại - Tổng Hợp Những Gì Đã Có

## 1. Security Configuration

### WebSecurityConfig
**File**: `infrastructure/src/main/java/vn/edu/fpt/sorms/infrastructure/config/config/WebSecurityConfig.java`

**Đã có:**
- ✅ `@EnableWebSecurity` - Enable Spring Security
- ✅ `@EnableMethodSecurity` - Enable @PreAuthorize support
- ✅ `SecurityFilterChain` - Configure security filter chain
- ✅ `AuthenticationManager` - Bean cho authentication
- ✅ `PasswordEncoder` - BCryptPasswordEncoder(12)
- ✅ `CorsConfigurationSource` - CORS configuration (allow all)

**Vấn đề:**
- ❌ `auth.requestMatchers("/**").permitAll()` - Cho phép tất cả requests (bypass security)
- ❌ **Không có JWT Filter** trong SecurityFilterChain
- ❌ Không parse token và set Authentication

**Code hiện tại:**
```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
  http
    .csrf(AbstractHttpConfigurer::disable)
    .authorizeHttpRequests(auth ->
      auth.requestMatchers("/**").permitAll()  // ❌ Vấn đề: Cho phép tất cả
          .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
          .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
          .anyRequest().authenticated()
    )
    .cors(cors -> cors.configurationSource(corsConfigurationSource()))
    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
  return http.build();
}
```

### SpringSecurityAuditorAware
**File**: `infrastructure/src/main/java/vn/edu/fpt/sorms/infrastructure/config/config/SpringSecurityAuditorAware.java`

**Đã có:**
- ✅ Implement `AuditorAware<String>` để lấy current user cho auditing
- ✅ Lấy Authentication từ `SecurityContextHolder.getContext().getAuthentication()`

**Vấn đề:**
- ❌ Luôn trả về `"SYSTEM"` vì không có Authentication trong SecurityContext
- ❌ Không thể lấy được user thực sự

**Code hiện tại:**
```java
@Override
public Optional<String> getCurrentAuditor() {
  final Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
  if (authentication == null || !authentication.isAuthenticated()) {
    return Optional.of("SYSTEM");  // ❌ Luôn trả về "SYSTEM"
  }
  // ...
}
```

## 2. JWT Provider

### JWTProvider
**File**: `application/src/main/java/vn/edu/fpt/sorms/application/service/auth/JWTProvider.java`

**Đã có:**
- ✅ `generateToken(Account account, List<String> roles)` - Generate JWT token
- ✅ `verifyToken(String token, boolean isRefresh)` - Verify JWT token
- ✅ `buildScope(List<String> roles)` - Build scope với prefix "ROLE_"
- ✅ Token có claims: `scope`, `userId`, `accountInfo`, `roles`

**Token Structure:**
```java
JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
    .subject(account.getEmail())
    .issuer("sorms.com.vn")
    .claim("scope", buildScope(roles))      // "ROLE_USER ROLE_ADMIN"
    .claim("userId", account.getId())
    .claim("accountInfo", accountJson)
    .claim("roles", roles)                  // ["USER", "ADMIN"] hoặc ["user", "admin"]
    .build();
```

**Có thể dùng:**
- ✅ Parse token từ request
- ✅ Extract roles từ token
- ✅ Verify token validity

## 3. Authentication Services

### OutboundAuthenticationService
**File**: `application/src/main/java/vn/edu/fpt/sorms/application/service/auth/OutboundAuthenticationService.java`

**Đã có:**
- ✅ OAuth2 authentication flow
- ✅ Exchange code for token
- ✅ Get user info from Google
- ✅ Create/update account
- ✅ Get roles from AccountRole
- ✅ Generate JWT token với roles

**✅ Hoạt động đúng:** Có lấy roles từ AccountRole và đưa vào token

### AuthenticateService
**File**: `application/src/main/java/vn/edu/fpt/sorms/application/service/auth/AuthenticateService.java`

**Đã có:**
- ✅ Email/password authentication
- ✅ Verify password
- ✅ Generate JWT token

**❌ Vấn đề:** `roles = null` khi generate token (bug nghiêm trọng)

### IntrospectService
**File**: `application/src/main/java/vn/edu/fpt/sorms/application/service/auth/IntrospectService.java`

**Đã có:**
- ✅ Verify token
- ✅ Extract roles từ token
- ✅ Parse accountInfo từ token
- ✅ Return introspect response với roles

**✅ Hoạt động đúng:** Có extract roles từ token

## 4. Controllers với @PreAuthorize

### Controllers có @PreAuthorize:
1. ✅ **RoleController** - `@PreAuthorize("hasAuthority('ADMIN')")`
2. ✅ **UserManagementController** - `@PreAuthorize("hasAuthority('ADMIN')")`
3. ✅ **StaffTaskController** - `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`
4. ✅ **RoomController** - `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`
5. ✅ **RoomTypeController** - `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`
6. ✅ **ServiceController** - `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`
7. ✅ **BookingController** - Có @PreAuthorize ở method level
8. ✅ **OrderController** - `@PreAuthorize("hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')")`
9. ✅ **PaymentController** - `@PreAuthorize("hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')")`
10. ✅ **AIRecognitionController** - `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`

### Controllers không có @PreAuthorize:
1. ❌ **StaffManagementController** - Không có @PreAuthorize (lỗ hổng bảo mật)
2. ✅ **AuthenticationController** - Public endpoints (không cần @PreAuthorize)

## 5. Infrastructure Components

### Đã có:
- ✅ **CacheService** - Caching service
- ✅ **ConfigCloudinary** - Cloudinary configuration
- ✅ **DatabaseConfiguration** - Database config
- ✅ **LiquibaseConfig** - Database migration
- ✅ **OpenApiConfig** - Swagger/OpenAPI config
- ✅ **PayOSConfig** - Payment gateway config
- ✅ **PayOSClient** - Payment client
- ✅ **QRHelper** - QR code helper
- ✅ **CloudinaryHelper** - Image upload helper

### Không có:
- ❌ **JWT Filter** - Không có filter để parse token
- ❌ **Aspect** - Không có Aspect để intercept @PreAuthorize
- ❌ **Interceptor** - Không có Interceptor để set Authentication

## 6. Tổng Kết

### ✅ Đã Có:
1. **JWT Provider** - Generate và verify token ✅
2. **Authentication Services** - OAuth, login, introspect ✅
3. **@PreAuthorize Annotations** - Trên hầu hết controllers ✅
4. **WebSecurityConfig** - Security configuration ✅
5. **SpringSecurityAuditorAware** - Auditor aware ✅
6. **CORS Configuration** - Allow all origins ✅

### ❌ Thiếu:
1. **JWT Filter/Aspect/Interceptor** - Không có cơ chế parse token và set Authentication ❌
2. **AuthenticateService bug** - `roles = null` khi login bằng email/password ❌
3. **StaffManagementController** - Không có @PreAuthorize ❌
4. **WebSecurityConfig** - `permitAll()` cho tất cả requests ❌

### ⚠️ Vấn Đề:
1. **@PreAuthorize không hoạt động** - Vì không có Authentication trong SecurityContext
2. **Backend trả về SYSTEM_ERROR** - Vì @PreAuthorize fail
3. **Frontend không load được data** - Vì backend trả về error

## 7. Cần Thêm

### Option 1: JWT Filter (Standard)
- Tạo `JwtAuthenticationFilter extends OncePerRequestFilter`
- Parse token từ Authorization header
- Extract roles và map thành authorities
- Set Authentication vào SecurityContext
- Thêm vào SecurityFilterChain

### Option 2: Aspect (Alternative)
- Tạo `JwtAuthenticationAspect`
- Intercept methods có @PreAuthorize
- Parse token và set Authentication
- Enable `@EnableAspectJAutoProxy`

### Option 3: Interceptor (Alternative)
- Tạo `JwtAuthenticationInterceptor implements HandlerInterceptor`
- Intercept tất cả requests
- Parse token và set Authentication
- Register trong `WebMvcConfig`

## 8. Kết Luận

**Backend hiện tại có:**
- ✅ JWT Provider (đầy đủ)
- ✅ Authentication Services (gần đầy đủ, có 1 bug)
- ✅ @PreAuthorize annotations (trên hầu hết controllers)
- ✅ Security configuration (cơ bản)

**Backend thiếu:**
- ❌ Cơ chế parse token và set Authentication (Filter/Aspect/Interceptor)
- ❌ Fix bug trong AuthenticateService (roles = null)
- ❌ @PreAuthorize cho StaffManagementController

**Vấn đề chính:**
- ❌ @PreAuthorize không hoạt động vì không có Authentication trong SecurityContext
- ❌ Cần thêm Filter/Aspect/Interceptor để parse token


## 1. Security Configuration

### WebSecurityConfig
**File**: `infrastructure/src/main/java/vn/edu/fpt/sorms/infrastructure/config/config/WebSecurityConfig.java`

**Đã có:**
- ✅ `@EnableWebSecurity` - Enable Spring Security
- ✅ `@EnableMethodSecurity` - Enable @PreAuthorize support
- ✅ `SecurityFilterChain` - Configure security filter chain
- ✅ `AuthenticationManager` - Bean cho authentication
- ✅ `PasswordEncoder` - BCryptPasswordEncoder(12)
- ✅ `CorsConfigurationSource` - CORS configuration (allow all)

**Vấn đề:**
- ❌ `auth.requestMatchers("/**").permitAll()` - Cho phép tất cả requests (bypass security)
- ❌ **Không có JWT Filter** trong SecurityFilterChain
- ❌ Không parse token và set Authentication

**Code hiện tại:**
```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
  http
    .csrf(AbstractHttpConfigurer::disable)
    .authorizeHttpRequests(auth ->
      auth.requestMatchers("/**").permitAll()  // ❌ Vấn đề: Cho phép tất cả
          .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
          .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
          .anyRequest().authenticated()
    )
    .cors(cors -> cors.configurationSource(corsConfigurationSource()))
    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
  return http.build();
}
```

### SpringSecurityAuditorAware
**File**: `infrastructure/src/main/java/vn/edu/fpt/sorms/infrastructure/config/config/SpringSecurityAuditorAware.java`

**Đã có:**
- ✅ Implement `AuditorAware<String>` để lấy current user cho auditing
- ✅ Lấy Authentication từ `SecurityContextHolder.getContext().getAuthentication()`

**Vấn đề:**
- ❌ Luôn trả về `"SYSTEM"` vì không có Authentication trong SecurityContext
- ❌ Không thể lấy được user thực sự

**Code hiện tại:**
```java
@Override
public Optional<String> getCurrentAuditor() {
  final Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
  if (authentication == null || !authentication.isAuthenticated()) {
    return Optional.of("SYSTEM");  // ❌ Luôn trả về "SYSTEM"
  }
  // ...
}
```

## 2. JWT Provider

### JWTProvider
**File**: `application/src/main/java/vn/edu/fpt/sorms/application/service/auth/JWTProvider.java`

**Đã có:**
- ✅ `generateToken(Account account, List<String> roles)` - Generate JWT token
- ✅ `verifyToken(String token, boolean isRefresh)` - Verify JWT token
- ✅ `buildScope(List<String> roles)` - Build scope với prefix "ROLE_"
- ✅ Token có claims: `scope`, `userId`, `accountInfo`, `roles`

**Token Structure:**
```java
JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
    .subject(account.getEmail())
    .issuer("sorms.com.vn")
    .claim("scope", buildScope(roles))      // "ROLE_USER ROLE_ADMIN"
    .claim("userId", account.getId())
    .claim("accountInfo", accountJson)
    .claim("roles", roles)                  // ["USER", "ADMIN"] hoặc ["user", "admin"]
    .build();
```

**Có thể dùng:**
- ✅ Parse token từ request
- ✅ Extract roles từ token
- ✅ Verify token validity

## 3. Authentication Services

### OutboundAuthenticationService
**File**: `application/src/main/java/vn/edu/fpt/sorms/application/service/auth/OutboundAuthenticationService.java`

**Đã có:**
- ✅ OAuth2 authentication flow
- ✅ Exchange code for token
- ✅ Get user info from Google
- ✅ Create/update account
- ✅ Get roles from AccountRole
- ✅ Generate JWT token với roles

**✅ Hoạt động đúng:** Có lấy roles từ AccountRole và đưa vào token

### AuthenticateService
**File**: `application/src/main/java/vn/edu/fpt/sorms/application/service/auth/AuthenticateService.java`

**Đã có:**
- ✅ Email/password authentication
- ✅ Verify password
- ✅ Generate JWT token

**❌ Vấn đề:** `roles = null` khi generate token (bug nghiêm trọng)

### IntrospectService
**File**: `application/src/main/java/vn/edu/fpt/sorms/application/service/auth/IntrospectService.java`

**Đã có:**
- ✅ Verify token
- ✅ Extract roles từ token
- ✅ Parse accountInfo từ token
- ✅ Return introspect response với roles

**✅ Hoạt động đúng:** Có extract roles từ token

## 4. Controllers với @PreAuthorize

### Controllers có @PreAuthorize:
1. ✅ **RoleController** - `@PreAuthorize("hasAuthority('ADMIN')")`
2. ✅ **UserManagementController** - `@PreAuthorize("hasAuthority('ADMIN')")`
3. ✅ **StaffTaskController** - `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`
4. ✅ **RoomController** - `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`
5. ✅ **RoomTypeController** - `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`
6. ✅ **ServiceController** - `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`
7. ✅ **BookingController** - Có @PreAuthorize ở method level
8. ✅ **OrderController** - `@PreAuthorize("hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')")`
9. ✅ **PaymentController** - `@PreAuthorize("hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')")`
10. ✅ **AIRecognitionController** - `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`

### Controllers không có @PreAuthorize:
1. ❌ **StaffManagementController** - Không có @PreAuthorize (lỗ hổng bảo mật)
2. ✅ **AuthenticationController** - Public endpoints (không cần @PreAuthorize)

## 5. Infrastructure Components

### Đã có:
- ✅ **CacheService** - Caching service
- ✅ **ConfigCloudinary** - Cloudinary configuration
- ✅ **DatabaseConfiguration** - Database config
- ✅ **LiquibaseConfig** - Database migration
- ✅ **OpenApiConfig** - Swagger/OpenAPI config
- ✅ **PayOSConfig** - Payment gateway config
- ✅ **PayOSClient** - Payment client
- ✅ **QRHelper** - QR code helper
- ✅ **CloudinaryHelper** - Image upload helper

### Không có:
- ❌ **JWT Filter** - Không có filter để parse token
- ❌ **Aspect** - Không có Aspect để intercept @PreAuthorize
- ❌ **Interceptor** - Không có Interceptor để set Authentication

## 6. Tổng Kết

### ✅ Đã Có:
1. **JWT Provider** - Generate và verify token ✅
2. **Authentication Services** - OAuth, login, introspect ✅
3. **@PreAuthorize Annotations** - Trên hầu hết controllers ✅
4. **WebSecurityConfig** - Security configuration ✅
5. **SpringSecurityAuditorAware** - Auditor aware ✅
6. **CORS Configuration** - Allow all origins ✅

### ❌ Thiếu:
1. **JWT Filter/Aspect/Interceptor** - Không có cơ chế parse token và set Authentication ❌
2. **AuthenticateService bug** - `roles = null` khi login bằng email/password ❌
3. **StaffManagementController** - Không có @PreAuthorize ❌
4. **WebSecurityConfig** - `permitAll()` cho tất cả requests ❌

### ⚠️ Vấn Đề:
1. **@PreAuthorize không hoạt động** - Vì không có Authentication trong SecurityContext
2. **Backend trả về SYSTEM_ERROR** - Vì @PreAuthorize fail
3. **Frontend không load được data** - Vì backend trả về error

## 7. Cần Thêm

### Option 1: JWT Filter (Standard)
- Tạo `JwtAuthenticationFilter extends OncePerRequestFilter`
- Parse token từ Authorization header
- Extract roles và map thành authorities
- Set Authentication vào SecurityContext
- Thêm vào SecurityFilterChain

### Option 2: Aspect (Alternative)
- Tạo `JwtAuthenticationAspect`
- Intercept methods có @PreAuthorize
- Parse token và set Authentication
- Enable `@EnableAspectJAutoProxy`

### Option 3: Interceptor (Alternative)
- Tạo `JwtAuthenticationInterceptor implements HandlerInterceptor`
- Intercept tất cả requests
- Parse token và set Authentication
- Register trong `WebMvcConfig`

## 8. Kết Luận

**Backend hiện tại có:**
- ✅ JWT Provider (đầy đủ)
- ✅ Authentication Services (gần đầy đủ, có 1 bug)
- ✅ @PreAuthorize annotations (trên hầu hết controllers)
- ✅ Security configuration (cơ bản)

**Backend thiếu:**
- ❌ Cơ chế parse token và set Authentication (Filter/Aspect/Interceptor)
- ❌ Fix bug trong AuthenticateService (roles = null)
- ❌ @PreAuthorize cho StaffManagementController

**Vấn đề chính:**
- ❌ @PreAuthorize không hoạt động vì không có Authentication trong SecurityContext
- ❌ Cần thêm Filter/Aspect/Interceptor để parse token

