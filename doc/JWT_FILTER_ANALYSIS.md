# Phân Tích: JWT Filter trong Backend

## Tổng Quan

**Kết luận: Backend KHÔNG có JWT Filter.**

## 1. Kiểm Tra Backend

### 1.1. Tìm Kiếm Filter

**Kết quả:**
- ❌ Không có file `*Filter*.java` trong backend
- ❌ Không có `JwtAuthenticationFilter`
- ❌ Không có `OncePerRequestFilter` implementation
- ❌ Không có Aspect hoặc Interceptor để xử lý JWT

### 1.2. WebSecurityConfig

**File**: `WebSecurityConfig.java`

```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
  http
    .csrf(AbstractHttpConfigurer::disable)
    .authorizeHttpRequests(auth ->
            auth.requestMatchers("/**").permitAll()  // ❌ BYPASS TẤT CẢ SECURITY
                    .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                    .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
                           .anyRequest().authenticated()
    ).cors(cors -> cors.configurationSource(corsConfigurationSource()))
    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
  return http.build();
}
```

**Vấn đề:**
- ❌ `auth.requestMatchers("/**").permitAll()` → **Bypass tất cả security**
- ❌ **Không có** `addFilter()` hoặc `addFilterBefore()` để thêm JWT Filter
- ❌ **Không có** JWT Filter được inject vào SecurityFilterChain

### 1.3. JWTProvider

**File**: `JWTProvider.java`

```java
@Component
public class JWTProvider {
    // ✅ Generate token
    public String generateToken(Account account, List<String> roles) { ... }
    
    // ✅ Verify token (signature, expiration)
    public SignedJWT verifyToken(String token, boolean isRefresh) throws JOSEException, ParseException { ... }
    
    // ❌ KHÔNG CÓ method để:
    // - Parse token từ HTTP request
    // - Set Authentication vào SecurityContext
}
```

**Đặc điểm:**
- ✅ Có `generateToken()` - tạo JWT token
- ✅ Có `verifyToken()` - verify signature và expiration
- ❌ **KHÔNG CÓ** logic để parse token từ `Authorization` header
- ❌ **KHÔNG CÓ** logic để set `Authentication` vào `SecurityContextHolder`

### 1.4. SpringSecurityAuditorAware

**File**: `SpringSecurityAuditorAware.java`

```java
@Component
public class SpringSecurityAuditorAware implements AuditorAware<String> {
  @Override
  public Optional<String> getCurrentAuditor() {
    final Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    // ❌ authentication luôn NULL vì không có Filter nào set nó
    if (authentication == null || !authentication.isAuthenticated()) {
      principal = "SYSTEM";  // ✅ Fallback
    }
    return Optional.ofNullable(principal);
  }
}
```

**Vấn đề:**
- ✅ Có fallback `"SYSTEM"` khi `authentication == null`
- ❌ `SecurityContextHolder.getContext().getAuthentication()` **luôn NULL**
- ❌ Không có Filter nào set `Authentication` vào `SecurityContext`

## 2. JWT Filter Hoạt Động Như Thế Nào?

### 2.1. Flow Chuẩn (Có JWT Filter)

```
1. HTTP Request đến server
   ↓
2. JWT Filter intercept request
   ↓
3. Extract token từ Authorization header: "Bearer <token>"
   ↓
4. Verify token (signature, expiration)
   ↓
5. Parse claims (roles, userId, etc.)
   ↓
6. Create Authentication object với roles
   ↓
7. Set Authentication vào SecurityContextHolder
   ↓
8. Request tiếp tục đến Controller
   ↓
9. @PreAuthorize check roles từ SecurityContext
   ↓
10. Controller xử lý request
```

### 2.2. Flow Hiện Tại (Không Có JWT Filter)

```
1. HTTP Request đến server
   ↓
2. WebSecurityConfig: permitAll() → Bypass security
   ↓
3. Request đến Controller trực tiếp
   ↓
4. @PreAuthorize check SecurityContext
   ↓
5. ❌ SecurityContext.getAuthentication() == NULL
   ↓
6. ❌ @PreAuthorize fails → Throw AccessDeniedException
   ↓
7. GlobalExceptionHandler catch → Return SYSTEM_ERROR
```

## 3. Tại Sao @PreAuthorize Không Hoạt Động?

### 3.1. @PreAuthorize Yêu Cầu

**@PreAuthorize cần:**
- ✅ `Authentication` object trong `SecurityContext`
- ✅ `Authentication.getAuthorities()` chứa roles (authorities)
- ✅ Authorities phải match với expression (e.g., `hasAuthority('ADMIN')`)

### 3.2. Hiện Tại Backend

**Backend có:**
- ✅ `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")` trên controllers
- ❌ **KHÔNG CÓ** Filter để set `Authentication` vào `SecurityContext`
- ❌ `SecurityContext.getAuthentication()` **luôn NULL**

**Kết quả:**
- ❌ `@PreAuthorize` **luôn fail**
- ❌ Throw `AccessDeniedException`
- ❌ `GlobalExceptionHandler` catch → Return `SYSTEM_ERROR`

## 4. JWT Filter Cần Làm Gì?

### 4.1. Các Bước Cần Thiết

**JWT Filter cần:**

1. **Extract token từ request:**
   ```java
   String authHeader = request.getHeader("Authorization");
   if (authHeader != null && authHeader.startsWith("Bearer ")) {
       String token = authHeader.substring(7);
   }
   ```

2. **Verify token:**
   ```java
   SignedJWT signedJWT = jwtProvider.verifyToken(token, false);
   JWTClaimsSet claims = signedJWT.getJWTClaimsSet();
   ```

3. **Extract roles từ claims:**
   ```java
   List<String> roles = (List<String>) claims.getClaim("roles");
   // Hoặc từ scope: "ROLE_ADMIN ROLE_USER"
   ```

4. **Create Authentication object:**
   ```java
   List<GrantedAuthority> authorities = roles.stream()
       .map(role -> new SimpleGrantedAuthority(role.toUpperCase()))  // ADMIN, không phải ROLE_ADMIN
       .collect(Collectors.toList());
   
   Authentication authentication = new UsernamePasswordAuthenticationToken(
       claims.getSubject(),  // username/email
       null,                 // credentials
       authorities           // roles
   );
   ```

5. **Set vào SecurityContext:**
   ```java
   SecurityContextHolder.getContext().setAuthentication(authentication);
   ```

6. **Continue filter chain:**
   ```java
   filterChain.doFilter(request, response);
   ```

### 4.2. Ví Dụ JWT Filter

```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    
    private final JWTProvider jwtProvider;
    
    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        
        // 1. Extract token
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }
        
        String token = authHeader.substring(7);
        
        try {
            // 2. Verify token
            SignedJWT signedJWT = jwtProvider.verifyToken(token, false);
            JWTClaimsSet claims = signedJWT.getJWTClaimsSet();
            
            // 3. Extract roles
            List<String> roles = (List<String>) claims.getClaim("roles");
            if (roles == null) {
                // Fallback: parse from scope
                String scope = (String) claims.getClaim("scope");
                roles = parseRolesFromScope(scope);
            }
            
            // 4. Create authorities (uppercase, no ROLE_ prefix)
            List<GrantedAuthority> authorities = roles.stream()
                .map(role -> new SimpleGrantedAuthority(role.toUpperCase()))
                .collect(Collectors.toList());
            
            // 5. Create Authentication
            Authentication authentication = new UsernamePasswordAuthenticationToken(
                claims.getSubject(),
                null,
                authorities
            );
            
            // 6. Set vào SecurityContext
            SecurityContextHolder.getContext().setAuthentication(authentication);
            
        } catch (Exception e) {
            // Token invalid → Continue without authentication
            log.warn("Invalid JWT token: {}", e.getMessage());
        }
        
        // 7. Continue filter chain
        filterChain.doFilter(request, response);
    }
    
    private List<String> parseRolesFromScope(String scope) {
        if (scope == null) return Collections.emptyList();
        return Arrays.stream(scope.split(" "))
            .map(s -> s.replace("ROLE_", ""))
            .collect(Collectors.toList());
    }
}
```

### 4.3. Cập Nhật WebSecurityConfig

```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
  http
    .csrf(AbstractHttpConfigurer::disable)
    .authorizeHttpRequests(auth ->
            auth.requestMatchers(PUBLIC_ENDPOINTS).permitAll()  // ✅ Chỉ public endpoints
                    .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
                           .anyRequest().authenticated()  // ✅ Yêu cầu authentication
    )
    .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)  // ✅ Thêm JWT Filter
    .cors(cors -> cors.configurationSource(corsConfigurationSource()))
    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
  return http.build();
}
```

## 5. Kết Luận

### Backend Hiện Tại:

**Có:**
- ✅ `JWTProvider` - Generate và verify token
- ✅ `@PreAuthorize` annotations trên controllers
- ✅ `WebSecurityConfig` với `@EnableMethodSecurity`

**Thiếu:**
- ❌ **JWT Filter** để parse token và set Authentication
- ❌ Logic để extract token từ `Authorization` header
- ❌ Logic để set `Authentication` vào `SecurityContextHolder`

**Kết quả:**
- ❌ `SecurityContext.getAuthentication()` **luôn NULL**
- ❌ `@PreAuthorize` **luôn fail**
- ❌ Backend trả về `SYSTEM_ERROR` cho tất cả protected endpoints

### Giải Pháp:

**Cần tạo JWT Filter:**
1. ✅ Extract token từ `Authorization` header
2. ✅ Verify token bằng `JWTProvider.verifyToken()`
3. ✅ Extract roles từ JWT claims
4. ✅ Create `Authentication` object với authorities
5. ✅ Set vào `SecurityContextHolder`
6. ✅ Add filter vào `WebSecurityConfig` trước `UsernamePasswordAuthenticationFilter`

**Sau khi có JWT Filter:**
- ✅ `SecurityContext.getAuthentication()` sẽ có giá trị
- ✅ `@PreAuthorize` sẽ hoạt động đúng
- ✅ Protected endpoints sẽ trả về data thay vì `SYSTEM_ERROR`


## Tổng Quan

**Kết luận: Backend KHÔNG có JWT Filter.**

## 1. Kiểm Tra Backend

### 1.1. Tìm Kiếm Filter

**Kết quả:**
- ❌ Không có file `*Filter*.java` trong backend
- ❌ Không có `JwtAuthenticationFilter`
- ❌ Không có `OncePerRequestFilter` implementation
- ❌ Không có Aspect hoặc Interceptor để xử lý JWT

### 1.2. WebSecurityConfig

**File**: `WebSecurityConfig.java`

```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
  http
    .csrf(AbstractHttpConfigurer::disable)
    .authorizeHttpRequests(auth ->
            auth.requestMatchers("/**").permitAll()  // ❌ BYPASS TẤT CẢ SECURITY
                    .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                    .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
                           .anyRequest().authenticated()
    ).cors(cors -> cors.configurationSource(corsConfigurationSource()))
    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
  return http.build();
}
```

**Vấn đề:**
- ❌ `auth.requestMatchers("/**").permitAll()` → **Bypass tất cả security**
- ❌ **Không có** `addFilter()` hoặc `addFilterBefore()` để thêm JWT Filter
- ❌ **Không có** JWT Filter được inject vào SecurityFilterChain

### 1.3. JWTProvider

**File**: `JWTProvider.java`

```java
@Component
public class JWTProvider {
    // ✅ Generate token
    public String generateToken(Account account, List<String> roles) { ... }
    
    // ✅ Verify token (signature, expiration)
    public SignedJWT verifyToken(String token, boolean isRefresh) throws JOSEException, ParseException { ... }
    
    // ❌ KHÔNG CÓ method để:
    // - Parse token từ HTTP request
    // - Set Authentication vào SecurityContext
}
```

**Đặc điểm:**
- ✅ Có `generateToken()` - tạo JWT token
- ✅ Có `verifyToken()` - verify signature và expiration
- ❌ **KHÔNG CÓ** logic để parse token từ `Authorization` header
- ❌ **KHÔNG CÓ** logic để set `Authentication` vào `SecurityContextHolder`

### 1.4. SpringSecurityAuditorAware

**File**: `SpringSecurityAuditorAware.java`

```java
@Component
public class SpringSecurityAuditorAware implements AuditorAware<String> {
  @Override
  public Optional<String> getCurrentAuditor() {
    final Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    // ❌ authentication luôn NULL vì không có Filter nào set nó
    if (authentication == null || !authentication.isAuthenticated()) {
      principal = "SYSTEM";  // ✅ Fallback
    }
    return Optional.ofNullable(principal);
  }
}
```

**Vấn đề:**
- ✅ Có fallback `"SYSTEM"` khi `authentication == null`
- ❌ `SecurityContextHolder.getContext().getAuthentication()` **luôn NULL**
- ❌ Không có Filter nào set `Authentication` vào `SecurityContext`

## 2. JWT Filter Hoạt Động Như Thế Nào?

### 2.1. Flow Chuẩn (Có JWT Filter)

```
1. HTTP Request đến server
   ↓
2. JWT Filter intercept request
   ↓
3. Extract token từ Authorization header: "Bearer <token>"
   ↓
4. Verify token (signature, expiration)
   ↓
5. Parse claims (roles, userId, etc.)
   ↓
6. Create Authentication object với roles
   ↓
7. Set Authentication vào SecurityContextHolder
   ↓
8. Request tiếp tục đến Controller
   ↓
9. @PreAuthorize check roles từ SecurityContext
   ↓
10. Controller xử lý request
```

### 2.2. Flow Hiện Tại (Không Có JWT Filter)

```
1. HTTP Request đến server
   ↓
2. WebSecurityConfig: permitAll() → Bypass security
   ↓
3. Request đến Controller trực tiếp
   ↓
4. @PreAuthorize check SecurityContext
   ↓
5. ❌ SecurityContext.getAuthentication() == NULL
   ↓
6. ❌ @PreAuthorize fails → Throw AccessDeniedException
   ↓
7. GlobalExceptionHandler catch → Return SYSTEM_ERROR
```

## 3. Tại Sao @PreAuthorize Không Hoạt Động?

### 3.1. @PreAuthorize Yêu Cầu

**@PreAuthorize cần:**
- ✅ `Authentication` object trong `SecurityContext`
- ✅ `Authentication.getAuthorities()` chứa roles (authorities)
- ✅ Authorities phải match với expression (e.g., `hasAuthority('ADMIN')`)

### 3.2. Hiện Tại Backend

**Backend có:**
- ✅ `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")` trên controllers
- ❌ **KHÔNG CÓ** Filter để set `Authentication` vào `SecurityContext`
- ❌ `SecurityContext.getAuthentication()` **luôn NULL**

**Kết quả:**
- ❌ `@PreAuthorize` **luôn fail**
- ❌ Throw `AccessDeniedException`
- ❌ `GlobalExceptionHandler` catch → Return `SYSTEM_ERROR`

## 4. JWT Filter Cần Làm Gì?

### 4.1. Các Bước Cần Thiết

**JWT Filter cần:**

1. **Extract token từ request:**
   ```java
   String authHeader = request.getHeader("Authorization");
   if (authHeader != null && authHeader.startsWith("Bearer ")) {
       String token = authHeader.substring(7);
   }
   ```

2. **Verify token:**
   ```java
   SignedJWT signedJWT = jwtProvider.verifyToken(token, false);
   JWTClaimsSet claims = signedJWT.getJWTClaimsSet();
   ```

3. **Extract roles từ claims:**
   ```java
   List<String> roles = (List<String>) claims.getClaim("roles");
   // Hoặc từ scope: "ROLE_ADMIN ROLE_USER"
   ```

4. **Create Authentication object:**
   ```java
   List<GrantedAuthority> authorities = roles.stream()
       .map(role -> new SimpleGrantedAuthority(role.toUpperCase()))  // ADMIN, không phải ROLE_ADMIN
       .collect(Collectors.toList());
   
   Authentication authentication = new UsernamePasswordAuthenticationToken(
       claims.getSubject(),  // username/email
       null,                 // credentials
       authorities           // roles
   );
   ```

5. **Set vào SecurityContext:**
   ```java
   SecurityContextHolder.getContext().setAuthentication(authentication);
   ```

6. **Continue filter chain:**
   ```java
   filterChain.doFilter(request, response);
   ```

### 4.2. Ví Dụ JWT Filter

```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    
    private final JWTProvider jwtProvider;
    
    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        
        // 1. Extract token
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }
        
        String token = authHeader.substring(7);
        
        try {
            // 2. Verify token
            SignedJWT signedJWT = jwtProvider.verifyToken(token, false);
            JWTClaimsSet claims = signedJWT.getJWTClaimsSet();
            
            // 3. Extract roles
            List<String> roles = (List<String>) claims.getClaim("roles");
            if (roles == null) {
                // Fallback: parse from scope
                String scope = (String) claims.getClaim("scope");
                roles = parseRolesFromScope(scope);
            }
            
            // 4. Create authorities (uppercase, no ROLE_ prefix)
            List<GrantedAuthority> authorities = roles.stream()
                .map(role -> new SimpleGrantedAuthority(role.toUpperCase()))
                .collect(Collectors.toList());
            
            // 5. Create Authentication
            Authentication authentication = new UsernamePasswordAuthenticationToken(
                claims.getSubject(),
                null,
                authorities
            );
            
            // 6. Set vào SecurityContext
            SecurityContextHolder.getContext().setAuthentication(authentication);
            
        } catch (Exception e) {
            // Token invalid → Continue without authentication
            log.warn("Invalid JWT token: {}", e.getMessage());
        }
        
        // 7. Continue filter chain
        filterChain.doFilter(request, response);
    }
    
    private List<String> parseRolesFromScope(String scope) {
        if (scope == null) return Collections.emptyList();
        return Arrays.stream(scope.split(" "))
            .map(s -> s.replace("ROLE_", ""))
            .collect(Collectors.toList());
    }
}
```

### 4.3. Cập Nhật WebSecurityConfig

```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
  http
    .csrf(AbstractHttpConfigurer::disable)
    .authorizeHttpRequests(auth ->
            auth.requestMatchers(PUBLIC_ENDPOINTS).permitAll()  // ✅ Chỉ public endpoints
                    .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
                           .anyRequest().authenticated()  // ✅ Yêu cầu authentication
    )
    .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)  // ✅ Thêm JWT Filter
    .cors(cors -> cors.configurationSource(corsConfigurationSource()))
    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
  return http.build();
}
```

## 5. Kết Luận

### Backend Hiện Tại:

**Có:**
- ✅ `JWTProvider` - Generate và verify token
- ✅ `@PreAuthorize` annotations trên controllers
- ✅ `WebSecurityConfig` với `@EnableMethodSecurity`

**Thiếu:**
- ❌ **JWT Filter** để parse token và set Authentication
- ❌ Logic để extract token từ `Authorization` header
- ❌ Logic để set `Authentication` vào `SecurityContextHolder`

**Kết quả:**
- ❌ `SecurityContext.getAuthentication()` **luôn NULL**
- ❌ `@PreAuthorize` **luôn fail**
- ❌ Backend trả về `SYSTEM_ERROR` cho tất cả protected endpoints

### Giải Pháp:

**Cần tạo JWT Filter:**
1. ✅ Extract token từ `Authorization` header
2. ✅ Verify token bằng `JWTProvider.verifyToken()`
3. ✅ Extract roles từ JWT claims
4. ✅ Create `Authentication` object với authorities
5. ✅ Set vào `SecurityContextHolder`
6. ✅ Add filter vào `WebSecurityConfig` trước `UsernamePasswordAuthenticationFilter`

**Sau khi có JWT Filter:**
- ✅ `SecurityContext.getAuthentication()` sẽ có giá trị
- ✅ `@PreAuthorize` sẽ hoạt động đúng
- ✅ Protected endpoints sẽ trả về data thay vì `SYSTEM_ERROR`

