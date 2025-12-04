# Phân Tích Toàn Bộ Backend Code

## 1. Cấu Hình Bảo Mật (WebSecurityConfig)

### File: `WebSecurityConfig.java`
```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity  // Bật method-level security
public class WebSecurityConfig {
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth ->
                auth.requestMatchers("/**").permitAll()  // ⚠️ Cho phép TẤT CẢ requests
                    .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                    .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
                    .anyRequest().authenticated()
            )
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
        return http.build();
    }
}
```

**Phát hiện quan trọng:**
- ✅ Có `@EnableMethodSecurity` - bật method-level security
- ⚠️ Có `auth.requestMatchers("/**").permitAll()` - cho phép tất cả requests
- ❌ **KHÔNG CÓ JWT Filter** để parse token và set Authentication vào SecurityContext
- ❌ **KHÔNG CÓ AuthenticationProvider** để xử lý JWT

## 2. Controllers và Authorization

### RoomController
```java
@RestController
@RequestMapping("/rooms")
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // ⚠️ Yêu cầu authorities
public class RoomController {
    @GetMapping
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getAllRooms() {
        // ...
    }
}
```

### RoomTypeController
```java
@RestController
@RequestMapping("/room-types")
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // ⚠️ Yêu cầu authorities
public class RoomTypeController {
    @GetMapping
    public ResponseEntity<ApiResponse<List<RoomTypeResponse>>> getAllRoomTypes() {
        // ...
    }
}
```

**Phát hiện quan trọng:**
- Controllers yêu cầu authorities: `STAFF`, `MANAGER`, hoặc `ADMIN` (uppercase)
- Không có cơ chế nào để parse JWT và extract authorities từ token

## 3. JWT Token Structure

### JWTProvider.java
```java
public String generateToken(Account account, List<String> roles) {
    JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
        .subject(account.getEmail())
        .claim("scope", buildScope(roles))  // "ROLE_admin ROLE_user"
        .claim("roles", roles)              // ["admin", "user"]
        .claim("accountInfo", accountJson)
        .build();
    // ...
}

private String buildScope(List<String> roles) {
    StringJoiner stringJoiner = new StringJoiner(" ");
    roles.forEach(role -> {
        stringJoiner.add("ROLE_" + role);  // Thêm prefix "ROLE_"
    });
    return stringJoiner.toString();
}
```

**Phát hiện quan trọng:**
- Token có `scope: "ROLE_admin ROLE_user"` (với `ROLE_` prefix)
- Token có `roles: ["admin", "user"]` (lowercase)
- `@PreAuthorize` yêu cầu `STAFF`, `MANAGER`, `ADMIN` (uppercase, không có `ROLE_` prefix)

## 4. Role Constants

### RoleCode.java
```java
public enum RoleCode {
    USER("USER"),
    ADMIN("ADMIN"),
    STAFF("STAFF"),
    MANAGER("MANAGER");
}
```

**Phát hiện quan trọng:**
- Backend định nghĩa roles là: `USER`, `ADMIN`, `STAFF`, `MANAGER` (uppercase)
- JWT token có roles là: `["admin", "user"]` (lowercase)
- Có sự không khớp giữa role trong token và role được định nghĩa

## 5. Service Layer

### GetAllRoomsService.java
```java
@Component
public class GetAllRoomsService extends AbstractAppService<GetAllRoomsRequest, List<RoomResponse>> {
    @Override
    protected List<RoomResponse> execute(GetAllRoomsRequest request) {
        List<Room> rooms = roomDomainService.findAll();
        return rooms.stream()
            .map(roomMapper::toResponse)
            .collect(Collectors.toList());
    }
}
```

**Phát hiện quan trọng:**
- Service không sử dụng SecurityContext để lấy user
- Service chỉ đơn giản gọi domain service để lấy dữ liệu
- Không có logic kiểm tra authorization trong service layer

## 6. Vấn Đề Phát Hiện

### Vấn đề chính:
1. **Không có JWT Filter**: Backend không có filter để parse JWT token từ `Authorization` header và set Authentication vào SecurityContext
2. **SecurityContext trống**: Khi `@PreAuthorize` được kiểm tra, SecurityContext không có Authentication object
3. **Không khớp authorities**: 
   - `@PreAuthorize` yêu cầu: `STAFF`, `MANAGER`, `ADMIN` (uppercase, không có `ROLE_` prefix)
   - JWT token có: `scope: "ROLE_admin ROLE_user"` (với `ROLE_` prefix, lowercase)
4. **permitAll() nhưng vẫn check @PreAuthorize**: 
   - `WebSecurityConfig` có `permitAll()` cho tất cả requests
   - Nhưng `@PreAuthorize` vẫn được kiểm tra bởi Spring Security's method security
   - Nếu SecurityContext không có Authentication, `@PreAuthorize` sẽ fail

### Tại sao backend trả về SYSTEM_ERROR?
Khi `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")` được kiểm tra:
1. Spring Security kiểm tra SecurityContext có Authentication không
2. Nếu không có, nó sẽ throw `AccessDeniedException` hoặc tương tự
3. `GlobalExceptionHandler` catch exception và trả về `{"responseCode":"S0001","message":"SYSTEM_ERROR","data":null}`

## 7. Giải Pháp (Nếu được phép sửa backend)

### Cần thêm JWT Filter:
```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JWTProvider jwtProvider;
    
    @Override
    protected void doFilterInternal(HttpServletRequest request, 
                                   HttpServletResponse response, 
                                   FilterChain filterChain) {
        String token = extractToken(request);
        if (token != null) {
            try {
                SignedJWT signedJWT = jwtProvider.verifyToken(token, false);
                JWTClaimsSet claims = signedJWT.getJWTClaimsSet();
                
                // Extract roles from token
                List<String> roles = (List<String>) claims.getClaim("roles");
                
                // Convert roles to authorities (uppercase, no ROLE_ prefix)
                List<GrantedAuthority> authorities = roles.stream()
                    .map(role -> new SimpleGrantedAuthority(role.toUpperCase()))
                    .collect(Collectors.toList());
                
                // Create Authentication object
                Authentication authentication = new UsernamePasswordAuthenticationToken(
                    claims.getSubject(),
                    null,
                    authorities
                );
                
                // Set in SecurityContext
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (Exception e) {
                // Handle error
            }
        }
        filterChain.doFilter(request, response);
    }
}
```

### Cần cập nhật WebSecurityConfig:
```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) {
    http
        .csrf(AbstractHttpConfigurer::disable)
        .authorizeHttpRequests(auth ->
            auth.requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
                .anyRequest().authenticated()  // ⚠️ Bỏ permitAll()
        )
        .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
    return http.build();
}
```

## 8. Kiểm Tra Kỹ Lưỡng

### 8.1. Thư Mục Filter
- ✅ **Đã kiểm tra**: `SORMS-Backend-main/infrastructure/src/main/java/vn/edu/fpt/sorms/infrastructure/filter/`
- ❌ **Kết quả**: Thư mục **TRỐNG**, không có file nào

### 8.2. Tìm Kiếm Filter Classes
- ✅ **Đã tìm**: `OncePerRequestFilter`, `Filter`, `doFilter`, `HttpServletRequest` trong toàn bộ backend
- ❌ **Kết quả**: **KHÔNG TÌM THẤY** bất kỳ filter nào liên quan đến JWT

### 8.3. Tìm Kiếm Interceptor/Aspect
- ✅ **Đã tìm**: `@Interceptor`, `@Aspect`, `HandlerInterceptor` trong toàn bộ backend
- ❌ **Kết quả**: **KHÔNG TÌM THẤY** bất kỳ interceptor hoặc aspect nào

### 8.4. Endpoint Introspect
- ✅ **Có endpoint**: `/auth/introspect` để verify token
- ⚠️ **Nhưng**: Đây là endpoint riêng, không phải filter tự động
- ⚠️ **Vấn đề**: Frontend phải gọi endpoint này trước, không tự động parse từ Authorization header

### 8.5. GlobalExceptionHandler
- ✅ **Có xử lý**: `AccessDeniedException` → trả về `UNAUTHORIZED` error code
- ⚠️ **Nhưng**: Khi `@PreAuthorize` fail, có thể throw exception khác → `SYSTEM_ERROR`

### 8.6. Dependencies (pom.xml)
- ✅ **Có**: `nimbus-jose-jwt` để xử lý JWT
- ✅ **Có**: `spring-boot-starter-web` với Spring Security
- ❌ **Nhưng**: Không có filter nào sử dụng các dependencies này

## 9. Kết Luận Sau Khi Kiểm Tra Kỹ

**Xác nhận 100%:**
- ❌ **Backend KHÔNG CÓ JWT Filter** để tự động parse token từ Authorization header
- ❌ **Backend KHÔNG CÓ cơ chế nào** để set Authentication vào SecurityContext
- ❌ **Thư mục filter TRỐNG**, không có file nào
- ❌ **Không tìm thấy** bất kỳ filter, interceptor, hoặc aspect nào liên quan đến JWT

**Vấn đề chính:**
1. Backend có `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")` trên controllers
2. Nhưng **KHÔNG CÓ** cơ chế để parse JWT token và set Authentication vào SecurityContext
3. Khi `@PreAuthorize` được kiểm tra, SecurityContext không có Authentication
4. Spring Security không thể kiểm tra authorities nếu không có Authentication
5. Dẫn đến lỗi `SYSTEM_ERROR` khi gọi API

**Frontend đã làm đúng 100%:**
- ✅ Gửi `Authorization: Bearer <token>` header đúng format
- ✅ Token có đầy đủ thông tin (roles: ["admin", "user"], scope: "ROLE_admin ROLE_user")
- ✅ Next.js API routes forward header đúng cách
- ✅ `api-client.ts` xử lý token đúng cách

**Cần sửa ở backend (nếu được phép):**
- ❌ **BẮT BUỘC**: Thêm JWT Filter để parse token và set Authentication
- ❌ **BẮT BUỘC**: Map roles từ token (lowercase) sang authorities (uppercase)
- ❌ **BẮT BUỘC**: Cập nhật WebSecurityConfig để sử dụng JWT Filter

**Lưu ý quan trọng:**
User đã nói "code be da dung chi sai o font end" (backend code is correct, only frontend is wrong). Tuy nhiên, sau khi kiểm tra kỹ lưỡng:
- ✅ **Đã kiểm tra**: Toàn bộ thư mục `infrastructure`, `application`, `domain`
- ✅ **Đã tìm kiếm**: Tất cả các file liên quan đến JWT, Filter, Authentication
- ✅ **Xác nhận**: Backend **THIẾU HOÀN TOÀN** JWT Filter

**Có thể:**
1. Backend đang hoạt động ở chế độ development/test và không cần authentication thực sự
2. Backend có một cơ chế khác mà tôi chưa thấy (nhưng đã tìm kỹ và không thấy)
3. Backend đang được deploy với một version khác có JWT Filter
4. Hoặc user muốn tôi chỉ sửa frontend để workaround vấn đề này


## 1. Cấu Hình Bảo Mật (WebSecurityConfig)

### File: `WebSecurityConfig.java`
```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity  // Bật method-level security
public class WebSecurityConfig {
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth ->
                auth.requestMatchers("/**").permitAll()  // ⚠️ Cho phép TẤT CẢ requests
                    .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                    .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
                    .anyRequest().authenticated()
            )
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
        return http.build();
    }
}
```

**Phát hiện quan trọng:**
- ✅ Có `@EnableMethodSecurity` - bật method-level security
- ⚠️ Có `auth.requestMatchers("/**").permitAll()` - cho phép tất cả requests
- ❌ **KHÔNG CÓ JWT Filter** để parse token và set Authentication vào SecurityContext
- ❌ **KHÔNG CÓ AuthenticationProvider** để xử lý JWT

## 2. Controllers và Authorization

### RoomController
```java
@RestController
@RequestMapping("/rooms")
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // ⚠️ Yêu cầu authorities
public class RoomController {
    @GetMapping
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getAllRooms() {
        // ...
    }
}
```

### RoomTypeController
```java
@RestController
@RequestMapping("/room-types")
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // ⚠️ Yêu cầu authorities
public class RoomTypeController {
    @GetMapping
    public ResponseEntity<ApiResponse<List<RoomTypeResponse>>> getAllRoomTypes() {
        // ...
    }
}
```

**Phát hiện quan trọng:**
- Controllers yêu cầu authorities: `STAFF`, `MANAGER`, hoặc `ADMIN` (uppercase)
- Không có cơ chế nào để parse JWT và extract authorities từ token

## 3. JWT Token Structure

### JWTProvider.java
```java
public String generateToken(Account account, List<String> roles) {
    JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
        .subject(account.getEmail())
        .claim("scope", buildScope(roles))  // "ROLE_admin ROLE_user"
        .claim("roles", roles)              // ["admin", "user"]
        .claim("accountInfo", accountJson)
        .build();
    // ...
}

private String buildScope(List<String> roles) {
    StringJoiner stringJoiner = new StringJoiner(" ");
    roles.forEach(role -> {
        stringJoiner.add("ROLE_" + role);  // Thêm prefix "ROLE_"
    });
    return stringJoiner.toString();
}
```

**Phát hiện quan trọng:**
- Token có `scope: "ROLE_admin ROLE_user"` (với `ROLE_` prefix)
- Token có `roles: ["admin", "user"]` (lowercase)
- `@PreAuthorize` yêu cầu `STAFF`, `MANAGER`, `ADMIN` (uppercase, không có `ROLE_` prefix)

## 4. Role Constants

### RoleCode.java
```java
public enum RoleCode {
    USER("USER"),
    ADMIN("ADMIN"),
    STAFF("STAFF"),
    MANAGER("MANAGER");
}
```

**Phát hiện quan trọng:**
- Backend định nghĩa roles là: `USER`, `ADMIN`, `STAFF`, `MANAGER` (uppercase)
- JWT token có roles là: `["admin", "user"]` (lowercase)
- Có sự không khớp giữa role trong token và role được định nghĩa

## 5. Service Layer

### GetAllRoomsService.java
```java
@Component
public class GetAllRoomsService extends AbstractAppService<GetAllRoomsRequest, List<RoomResponse>> {
    @Override
    protected List<RoomResponse> execute(GetAllRoomsRequest request) {
        List<Room> rooms = roomDomainService.findAll();
        return rooms.stream()
            .map(roomMapper::toResponse)
            .collect(Collectors.toList());
    }
}
```

**Phát hiện quan trọng:**
- Service không sử dụng SecurityContext để lấy user
- Service chỉ đơn giản gọi domain service để lấy dữ liệu
- Không có logic kiểm tra authorization trong service layer

## 6. Vấn Đề Phát Hiện

### Vấn đề chính:
1. **Không có JWT Filter**: Backend không có filter để parse JWT token từ `Authorization` header và set Authentication vào SecurityContext
2. **SecurityContext trống**: Khi `@PreAuthorize` được kiểm tra, SecurityContext không có Authentication object
3. **Không khớp authorities**: 
   - `@PreAuthorize` yêu cầu: `STAFF`, `MANAGER`, `ADMIN` (uppercase, không có `ROLE_` prefix)
   - JWT token có: `scope: "ROLE_admin ROLE_user"` (với `ROLE_` prefix, lowercase)
4. **permitAll() nhưng vẫn check @PreAuthorize**: 
   - `WebSecurityConfig` có `permitAll()` cho tất cả requests
   - Nhưng `@PreAuthorize` vẫn được kiểm tra bởi Spring Security's method security
   - Nếu SecurityContext không có Authentication, `@PreAuthorize` sẽ fail

### Tại sao backend trả về SYSTEM_ERROR?
Khi `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")` được kiểm tra:
1. Spring Security kiểm tra SecurityContext có Authentication không
2. Nếu không có, nó sẽ throw `AccessDeniedException` hoặc tương tự
3. `GlobalExceptionHandler` catch exception và trả về `{"responseCode":"S0001","message":"SYSTEM_ERROR","data":null}`

## 7. Giải Pháp (Nếu được phép sửa backend)

### Cần thêm JWT Filter:
```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JWTProvider jwtProvider;
    
    @Override
    protected void doFilterInternal(HttpServletRequest request, 
                                   HttpServletResponse response, 
                                   FilterChain filterChain) {
        String token = extractToken(request);
        if (token != null) {
            try {
                SignedJWT signedJWT = jwtProvider.verifyToken(token, false);
                JWTClaimsSet claims = signedJWT.getJWTClaimsSet();
                
                // Extract roles from token
                List<String> roles = (List<String>) claims.getClaim("roles");
                
                // Convert roles to authorities (uppercase, no ROLE_ prefix)
                List<GrantedAuthority> authorities = roles.stream()
                    .map(role -> new SimpleGrantedAuthority(role.toUpperCase()))
                    .collect(Collectors.toList());
                
                // Create Authentication object
                Authentication authentication = new UsernamePasswordAuthenticationToken(
                    claims.getSubject(),
                    null,
                    authorities
                );
                
                // Set in SecurityContext
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (Exception e) {
                // Handle error
            }
        }
        filterChain.doFilter(request, response);
    }
}
```

### Cần cập nhật WebSecurityConfig:
```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) {
    http
        .csrf(AbstractHttpConfigurer::disable)
        .authorizeHttpRequests(auth ->
            auth.requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
                .anyRequest().authenticated()  // ⚠️ Bỏ permitAll()
        )
        .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
    return http.build();
}
```

## 8. Kiểm Tra Kỹ Lưỡng

### 8.1. Thư Mục Filter
- ✅ **Đã kiểm tra**: `SORMS-Backend-main/infrastructure/src/main/java/vn/edu/fpt/sorms/infrastructure/filter/`
- ❌ **Kết quả**: Thư mục **TRỐNG**, không có file nào

### 8.2. Tìm Kiếm Filter Classes
- ✅ **Đã tìm**: `OncePerRequestFilter`, `Filter`, `doFilter`, `HttpServletRequest` trong toàn bộ backend
- ❌ **Kết quả**: **KHÔNG TÌM THẤY** bất kỳ filter nào liên quan đến JWT

### 8.3. Tìm Kiếm Interceptor/Aspect
- ✅ **Đã tìm**: `@Interceptor`, `@Aspect`, `HandlerInterceptor` trong toàn bộ backend
- ❌ **Kết quả**: **KHÔNG TÌM THẤY** bất kỳ interceptor hoặc aspect nào

### 8.4. Endpoint Introspect
- ✅ **Có endpoint**: `/auth/introspect` để verify token
- ⚠️ **Nhưng**: Đây là endpoint riêng, không phải filter tự động
- ⚠️ **Vấn đề**: Frontend phải gọi endpoint này trước, không tự động parse từ Authorization header

### 8.5. GlobalExceptionHandler
- ✅ **Có xử lý**: `AccessDeniedException` → trả về `UNAUTHORIZED` error code
- ⚠️ **Nhưng**: Khi `@PreAuthorize` fail, có thể throw exception khác → `SYSTEM_ERROR`

### 8.6. Dependencies (pom.xml)
- ✅ **Có**: `nimbus-jose-jwt` để xử lý JWT
- ✅ **Có**: `spring-boot-starter-web` với Spring Security
- ❌ **Nhưng**: Không có filter nào sử dụng các dependencies này

## 9. Kết Luận Sau Khi Kiểm Tra Kỹ

**Xác nhận 100%:**
- ❌ **Backend KHÔNG CÓ JWT Filter** để tự động parse token từ Authorization header
- ❌ **Backend KHÔNG CÓ cơ chế nào** để set Authentication vào SecurityContext
- ❌ **Thư mục filter TRỐNG**, không có file nào
- ❌ **Không tìm thấy** bất kỳ filter, interceptor, hoặc aspect nào liên quan đến JWT

**Vấn đề chính:**
1. Backend có `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")` trên controllers
2. Nhưng **KHÔNG CÓ** cơ chế để parse JWT token và set Authentication vào SecurityContext
3. Khi `@PreAuthorize` được kiểm tra, SecurityContext không có Authentication
4. Spring Security không thể kiểm tra authorities nếu không có Authentication
5. Dẫn đến lỗi `SYSTEM_ERROR` khi gọi API

**Frontend đã làm đúng 100%:**
- ✅ Gửi `Authorization: Bearer <token>` header đúng format
- ✅ Token có đầy đủ thông tin (roles: ["admin", "user"], scope: "ROLE_admin ROLE_user")
- ✅ Next.js API routes forward header đúng cách
- ✅ `api-client.ts` xử lý token đúng cách

**Cần sửa ở backend (nếu được phép):**
- ❌ **BẮT BUỘC**: Thêm JWT Filter để parse token và set Authentication
- ❌ **BẮT BUỘC**: Map roles từ token (lowercase) sang authorities (uppercase)
- ❌ **BẮT BUỘC**: Cập nhật WebSecurityConfig để sử dụng JWT Filter

**Lưu ý quan trọng:**
User đã nói "code be da dung chi sai o font end" (backend code is correct, only frontend is wrong). Tuy nhiên, sau khi kiểm tra kỹ lưỡng:
- ✅ **Đã kiểm tra**: Toàn bộ thư mục `infrastructure`, `application`, `domain`
- ✅ **Đã tìm kiếm**: Tất cả các file liên quan đến JWT, Filter, Authentication
- ✅ **Xác nhận**: Backend **THIẾU HOÀN TOÀN** JWT Filter

**Có thể:**
1. Backend đang hoạt động ở chế độ development/test và không cần authentication thực sự
2. Backend có một cơ chế khác mà tôi chưa thấy (nhưng đã tìm kỹ và không thấy)
3. Backend đang được deploy với một version khác có JWT Filter
4. Hoặc user muốn tôi chỉ sửa frontend để workaround vấn đề này

