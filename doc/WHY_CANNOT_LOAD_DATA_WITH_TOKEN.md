# Tại Sao Có Token Nhưng Không Load Được Dữ Liệu?

## Vấn Đề

Mặc dù:
- ✅ Frontend có token và gửi token đúng cách trong `Authorization: Bearer <token>` header
- ✅ Backend nhận được token trong request
- ✅ Token hợp lệ (có thể verify được)

Nhưng:
- ❌ Backend trả về `500 Internal Server Error` với `{ responseCode: "S0001", message: "SYSTEM_ERROR", data: null }`
- ❌ Frontend không thể load data từ API

## Nguyên Nhân

### 1. Backend Không Parse Token

**Vấn đề chính:**
- Backend **NHẬN ĐƯỢC** token trong `Authorization` header
- Nhưng backend **KHÔNG PARSE** token để extract roles và set Authentication vào SecurityContext
- Không có JWT Filter để xử lý token

**File**: `WebSecurityConfig.java`
```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
  http
    .csrf(AbstractHttpConfigurer::disable)
    .authorizeHttpRequests(auth ->
      auth.requestMatchers("/**").permitAll()  // ❌ Cho phép tất cả
          .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
          .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
          .anyRequest().authenticated()
    )
    .cors(cors -> cors.configurationSource(corsConfigurationSource()))
    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
  return http.build();
}
```

**Vấn đề:**
- ❌ Không có JWT Filter được thêm vào SecurityFilterChain
- ❌ Token không được parse
- ❌ Authentication không được set vào SecurityContext

### 2. @PreAuthorize Không Hoạt Động

**File**: `RoomController.java`
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
public class RoomController {
    @GetMapping
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getAllRooms() {
        // ...
    }
}
```

**Cách hoạt động:**
1. Request đến `/rooms`
2. Spring Security kiểm tra `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`
3. Spring Security lấy `Authentication` từ `SecurityContextHolder.getContext().getAuthentication()`
4. **Vấn đề**: `SecurityContext` không có `Authentication` vì token chưa được parse
5. `@PreAuthorize` fail → Throw exception
6. `GlobalExceptionHandler` catch exception → Trả về `SYSTEM_ERROR` (S0001)

### 3. Flow Chi Tiết

```
1. Frontend gửi request:
   GET /api/system/rooms
   Headers: Authorization: Bearer <token>

2. Next.js API Route nhận request:
   - Extract Authorization header
   - Gọi apiClient.getRooms({ headers: { Authorization: "Bearer <token>" } })

3. apiClient gửi request đến backend:
   GET https://backend.sorms.online/api/rooms
   Headers: Authorization: Bearer <token>

4. Backend nhận request:
   ✅ Token có trong header
   ❌ Nhưng không có JWT Filter để parse token
   ❌ SecurityContext không có Authentication

5. Spring Security kiểm tra @PreAuthorize:
   - Lấy Authentication từ SecurityContext → null
   - hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN') → fail
   - Throw AccessDeniedException hoặc Exception

6. GlobalExceptionHandler catch exception:
   - Map exception → ErrorCode.SYSTEM_ERR (S0001)
   - Trả về: { responseCode: "S0001", message: "SYSTEM_ERROR", data: null }

7. Frontend nhận response:
   - HTTP 500
   - { responseCode: "S0001", message: "SYSTEM_ERROR", data: null }
   - Không thể load data
```

## Giải Pháp

### Cần Thêm JWT Filter

**Tạo JWT Filter để:**
1. Parse token từ `Authorization` header
2. Verify token (sử dụng `JWTProvider.verifyToken()`)
3. Extract roles từ token claims
4. Map roles → authorities (uppercase, không có prefix ROLE_)
5. Set `Authentication` vào `SecurityContext`

**Ví dụ JWT Filter:**
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
        
        // 1. Extract token from Authorization header
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }
        
        String token = authHeader.substring(7);
        
        try {
            // 2. Verify token
            SignedJWT signedJWT = jwtProvider.verifyToken(token, false);
            
            // 3. Extract roles from token
            List<String> roles = extractRoles(signedJWT);
            
            // 4. Map roles → authorities (uppercase, no ROLE_ prefix)
            List<GrantedAuthority> authorities = roles.stream()
                .map(role -> role.toUpperCase())
                .map(role -> new SimpleGrantedAuthority(role))
                .collect(Collectors.toList());
            
            // 5. Create Authentication object
            Authentication authentication = new UsernamePasswordAuthenticationToken(
                signedJWT.getJWTClaimsSet().getSubject(), // email
                null,
                authorities
            );
            
            // 6. Set Authentication into SecurityContext
            SecurityContextHolder.getContext().setAuthentication(authentication);
            
        } catch (Exception e) {
            // Token invalid or expired
            log.error("JWT authentication failed", e);
        }
        
        filterChain.doFilter(request, response);
    }
    
    private List<String> extractRoles(SignedJWT jwt) {
        try {
            Object rolesClaim = jwt.getJWTClaimsSet().getClaim("roles");
            if (rolesClaim instanceof List<?>) {
                return ((List<?>) rolesClaim).stream()
                    .filter(item -> item instanceof String)
                    .map(item -> (String) item)
                    .collect(Collectors.toList());
            }
        } catch (ParseException e) {
            log.error("Failed to extract roles from token", e);
        }
        return Collections.emptyList();
    }
}
```

**Thêm JWT Filter vào SecurityFilterChain:**
```java
@Bean
public SecurityFilterChain securityFilterChain(
    HttpSecurity http,
    JwtAuthenticationFilter jwtAuthenticationFilter
) throws Exception {
  http
    .csrf(AbstractHttpConfigurer::disable)
    .authorizeHttpRequests(auth ->
      auth.requestMatchers(PUBLIC_ENDPOINTS).permitAll()
          .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
          .anyRequest().authenticated()  // ✅ Yêu cầu authentication
    )
    .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)  // ✅ Thêm JWT Filter
    .cors(cors -> cors.configurationSource(corsConfigurationSource()))
    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
  return http.build();
}
```

## Kết Luận

### Tại Sao Không Load Được Dữ Liệu?

**Nguyên nhân:**
1. ✅ Token được gửi đúng từ frontend
2. ✅ Backend nhận được token
3. ❌ **Backend không parse token và set Authentication**
4. ❌ **@PreAuthorize fail vì không có Authentication trong SecurityContext**
5. ❌ **Backend trả về SYSTEM_ERROR (S0001)**

### Giải Pháp:

**Cần thêm JWT Filter để:**
- Parse token từ Authorization header
- Verify token
- Extract roles và map thành authorities
- Set Authentication vào SecurityContext

**Sau đó:**
- @PreAuthorize sẽ hoạt động đúng
- Backend sẽ trả về data thay vì SYSTEM_ERROR
- Frontend sẽ load được data

### Lưu Ý:

- **Token format**: `Bearer <token>` (đúng)
- **Roles trong token**: `["admin", "user"]` (có thể lowercase)
- **Authorities cần**: `["ADMIN", "USER"]` (uppercase, không có prefix ROLE_)
- **@PreAuthorize yêu cầu**: `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')` (uppercase)

**Cần map roles từ token (có thể lowercase) → authorities (uppercase) trong JWT Filter.**


## Vấn Đề

Mặc dù:
- ✅ Frontend có token và gửi token đúng cách trong `Authorization: Bearer <token>` header
- ✅ Backend nhận được token trong request
- ✅ Token hợp lệ (có thể verify được)

Nhưng:
- ❌ Backend trả về `500 Internal Server Error` với `{ responseCode: "S0001", message: "SYSTEM_ERROR", data: null }`
- ❌ Frontend không thể load data từ API

## Nguyên Nhân

### 1. Backend Không Parse Token

**Vấn đề chính:**
- Backend **NHẬN ĐƯỢC** token trong `Authorization` header
- Nhưng backend **KHÔNG PARSE** token để extract roles và set Authentication vào SecurityContext
- Không có JWT Filter để xử lý token

**File**: `WebSecurityConfig.java`
```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
  http
    .csrf(AbstractHttpConfigurer::disable)
    .authorizeHttpRequests(auth ->
      auth.requestMatchers("/**").permitAll()  // ❌ Cho phép tất cả
          .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
          .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
          .anyRequest().authenticated()
    )
    .cors(cors -> cors.configurationSource(corsConfigurationSource()))
    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
  return http.build();
}
```

**Vấn đề:**
- ❌ Không có JWT Filter được thêm vào SecurityFilterChain
- ❌ Token không được parse
- ❌ Authentication không được set vào SecurityContext

### 2. @PreAuthorize Không Hoạt Động

**File**: `RoomController.java`
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
public class RoomController {
    @GetMapping
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getAllRooms() {
        // ...
    }
}
```

**Cách hoạt động:**
1. Request đến `/rooms`
2. Spring Security kiểm tra `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`
3. Spring Security lấy `Authentication` từ `SecurityContextHolder.getContext().getAuthentication()`
4. **Vấn đề**: `SecurityContext` không có `Authentication` vì token chưa được parse
5. `@PreAuthorize` fail → Throw exception
6. `GlobalExceptionHandler` catch exception → Trả về `SYSTEM_ERROR` (S0001)

### 3. Flow Chi Tiết

```
1. Frontend gửi request:
   GET /api/system/rooms
   Headers: Authorization: Bearer <token>

2. Next.js API Route nhận request:
   - Extract Authorization header
   - Gọi apiClient.getRooms({ headers: { Authorization: "Bearer <token>" } })

3. apiClient gửi request đến backend:
   GET https://backend.sorms.online/api/rooms
   Headers: Authorization: Bearer <token>

4. Backend nhận request:
   ✅ Token có trong header
   ❌ Nhưng không có JWT Filter để parse token
   ❌ SecurityContext không có Authentication

5. Spring Security kiểm tra @PreAuthorize:
   - Lấy Authentication từ SecurityContext → null
   - hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN') → fail
   - Throw AccessDeniedException hoặc Exception

6. GlobalExceptionHandler catch exception:
   - Map exception → ErrorCode.SYSTEM_ERR (S0001)
   - Trả về: { responseCode: "S0001", message: "SYSTEM_ERROR", data: null }

7. Frontend nhận response:
   - HTTP 500
   - { responseCode: "S0001", message: "SYSTEM_ERROR", data: null }
   - Không thể load data
```

## Giải Pháp

### Cần Thêm JWT Filter

**Tạo JWT Filter để:**
1. Parse token từ `Authorization` header
2. Verify token (sử dụng `JWTProvider.verifyToken()`)
3. Extract roles từ token claims
4. Map roles → authorities (uppercase, không có prefix ROLE_)
5. Set `Authentication` vào `SecurityContext`

**Ví dụ JWT Filter:**
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
        
        // 1. Extract token from Authorization header
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }
        
        String token = authHeader.substring(7);
        
        try {
            // 2. Verify token
            SignedJWT signedJWT = jwtProvider.verifyToken(token, false);
            
            // 3. Extract roles from token
            List<String> roles = extractRoles(signedJWT);
            
            // 4. Map roles → authorities (uppercase, no ROLE_ prefix)
            List<GrantedAuthority> authorities = roles.stream()
                .map(role -> role.toUpperCase())
                .map(role -> new SimpleGrantedAuthority(role))
                .collect(Collectors.toList());
            
            // 5. Create Authentication object
            Authentication authentication = new UsernamePasswordAuthenticationToken(
                signedJWT.getJWTClaimsSet().getSubject(), // email
                null,
                authorities
            );
            
            // 6. Set Authentication into SecurityContext
            SecurityContextHolder.getContext().setAuthentication(authentication);
            
        } catch (Exception e) {
            // Token invalid or expired
            log.error("JWT authentication failed", e);
        }
        
        filterChain.doFilter(request, response);
    }
    
    private List<String> extractRoles(SignedJWT jwt) {
        try {
            Object rolesClaim = jwt.getJWTClaimsSet().getClaim("roles");
            if (rolesClaim instanceof List<?>) {
                return ((List<?>) rolesClaim).stream()
                    .filter(item -> item instanceof String)
                    .map(item -> (String) item)
                    .collect(Collectors.toList());
            }
        } catch (ParseException e) {
            log.error("Failed to extract roles from token", e);
        }
        return Collections.emptyList();
    }
}
```

**Thêm JWT Filter vào SecurityFilterChain:**
```java
@Bean
public SecurityFilterChain securityFilterChain(
    HttpSecurity http,
    JwtAuthenticationFilter jwtAuthenticationFilter
) throws Exception {
  http
    .csrf(AbstractHttpConfigurer::disable)
    .authorizeHttpRequests(auth ->
      auth.requestMatchers(PUBLIC_ENDPOINTS).permitAll()
          .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
          .anyRequest().authenticated()  // ✅ Yêu cầu authentication
    )
    .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)  // ✅ Thêm JWT Filter
    .cors(cors -> cors.configurationSource(corsConfigurationSource()))
    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
  return http.build();
}
```

## Kết Luận

### Tại Sao Không Load Được Dữ Liệu?

**Nguyên nhân:**
1. ✅ Token được gửi đúng từ frontend
2. ✅ Backend nhận được token
3. ❌ **Backend không parse token và set Authentication**
4. ❌ **@PreAuthorize fail vì không có Authentication trong SecurityContext**
5. ❌ **Backend trả về SYSTEM_ERROR (S0001)**

### Giải Pháp:

**Cần thêm JWT Filter để:**
- Parse token từ Authorization header
- Verify token
- Extract roles và map thành authorities
- Set Authentication vào SecurityContext

**Sau đó:**
- @PreAuthorize sẽ hoạt động đúng
- Backend sẽ trả về data thay vì SYSTEM_ERROR
- Frontend sẽ load được data

### Lưu Ý:

- **Token format**: `Bearer <token>` (đúng)
- **Roles trong token**: `["admin", "user"]` (có thể lowercase)
- **Authorities cần**: `["ADMIN", "USER"]` (uppercase, không có prefix ROLE_)
- **@PreAuthorize yêu cầu**: `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')` (uppercase)

**Cần map roles từ token (có thể lowercase) → authorities (uppercase) trong JWT Filter.**

