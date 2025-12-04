# Các Cách Để Frontend Load Được Dữ Liệu

## Tổng Quan

**Hiện tại frontend không load được dữ liệu vì backend trả về SYSTEM_ERROR. Có một số cách để frontend load được dữ liệu:**

## 1. Phân Tích Vấn Đề

### 1.1. Vấn Đề Hiện Tại

```
1. Frontend gửi: GET /api/rooms
   Headers: { Authorization: "Bearer <token>" }  ✅
   ↓
2. Backend nhận token nhưng không parse  ❌
   ↓
3. @PreAuthorize fails → SYSTEM_ERROR  ❌
   ↓
4. Frontend nhận: { responseCode: "S0001", message: "SYSTEM_ERROR" }  ❌
```

### 1.2. Nguyên Nhân

- Backend có `permitAll()` nhưng không parse token
- SecurityContext == NULL
- @PreAuthorize fails
- Không cho xem dữ liệu

## 2. Các Giải Pháp

### 2.1. Giải Pháp 1: Tạm Thời Bypass @PreAuthorize (Backend)

**Không khuyến nghị vì:**
- User đã nói "code be da dung" (backend đúng)
- Không nên thay đổi backend
- Mất tính bảo mật

### 2.2. Giải Pháp 2: Gọi Trực Tiếp Public Endpoints (Nếu Có)

**Kiểm tra xem có public endpoints không:**
- `/auth/*` endpoints là public
- Nhưng `/rooms`, `/room-types` không phải public
- Không có public endpoints cho data

### 2.3. Giải Pháp 3: Frontend Parse Token và Gửi Thông Tin Khác

**Không khả thi vì:**
- Backend vẫn cần parse token
- @PreAuthorize vẫn cần Authentication

### 2.4. Giải Pháp 4: Tạo JWT Filter ở Backend

**Đây là giải pháp đúng:**
- Parse token từ Authorization header
- Set Authentication vào SecurityContext
- Cho phép @PreAuthorize hoạt động
- Frontend load được dữ liệu

**Nhưng user đã nói:**
- "code be da dung chi sai o font end" (backend đúng, chỉ sai frontend)
- Không nên thay đổi backend

### 2.5. Giải Pháp 5: Frontend Workaround - Mock Data (Tạm Thời)

**Có thể tạo mock data tạm thời:**
- Frontend tự tạo dữ liệu giả
- Chỉ để test UI
- Không phải giải pháp lâu dài

### 2.6. Giải Pháp 6: Kiểm Tra Xem Backend Có Cơ Chế Khác Không

**Có thể backend có:**
- Custom authentication mechanism
- Aspect/Interceptor khác
- Service layer check thay vì @PreAuthorize

## 3. Giải Pháp Khả Thi Nhất

### 3.1. Nếu Backend Đúng (Như User Nói)

**Có thể backend có cơ chế khác:**
1. **Service Layer Check:**
   - Service layer tự check token
   - Không cần @PreAuthorize
   - Frontend chỉ cần gửi token đúng

2. **Custom Authentication:**
   - Backend có custom authentication mechanism
   - Không dùng Spring Security @PreAuthorize
   - Frontend cần gửi token theo format khác

3. **Aspect/Interceptor:**
   - Backend có Aspect để check token
   - Không cần JWT Filter
   - Frontend chỉ cần gửi token

### 3.2. Kiểm Tra Backend Có Service Layer Check Không

**Cần kiểm tra:**
- Service layer có check token không?
- Service layer có parse Authorization header không?
- Service layer có verify token không?

### 3.3. Frontend Có Thể Làm Gì?

**1. Kiểm tra token format:**
- Đảm bảo token đúng format
- Đảm bảo gửi đúng header name
- Đảm bảo có prefix "Bearer "

**2. Kiểm tra endpoint:**
- Đảm bảo gọi đúng endpoint
- Đảm bảo method đúng (GET, POST, etc.)

**3. Kiểm tra response:**
- Parse error response đúng
- Hiển thị error message cho user
- Retry logic nếu cần

## 4. Giải Pháp Tạm Thời: Frontend Mock Data

### 4.1. Tạo Mock Data Service

```typescript
// src/lib/mock-data.ts
export const mockRooms = [
  { id: 1, code: 'R001', name: 'Room 1', status: 'AVAILABLE' },
  { id: 2, code: 'R002', name: 'Room 2', status: 'OCCUPIED' },
  // ... more mock data
]

export const mockRoomTypes = [
  { id: 1, name: 'Standard', price: 100000 },
  { id: 2, name: 'Deluxe', price: 200000 },
  // ... more mock data
]
```

### 4.2. Sử Dụng Mock Data Khi API Fails

```typescript
// src/hooks/useRooms.ts
const fetchRooms = async () => {
  try {
    const response = await apiClient.getRooms()
    if (response.success) {
      return response.data
    }
    // Fallback to mock data
    console.warn('API failed, using mock data')
    return mockRooms
  } catch (error) {
    // Fallback to mock data
    console.warn('API error, using mock data', error)
    return mockRooms
  }
}
```

**⚠️ Chỉ dùng để test UI, không phải giải pháp lâu dài**

## 5. Giải Pháp Đúng: Tạo JWT Filter (Backend)

### 5.1. Tạo JWT Filter

**File**: `SORMS-Backend/infrastructure/src/main/java/vn/edu/fpt/sorms/infrastructure/filter/JwtAuthenticationFilter.java`

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

### 5.2. Cập Nhật WebSecurityConfig

```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
  http
    .csrf(AbstractHttpConfigurer::disable)
    .authorizeHttpRequests(auth ->
            auth.requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                    .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
                           .anyRequest().authenticated()
    )
    .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
    .cors(cors -> cors.configurationSource(corsConfigurationSource()))
    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
  return http.build();
}
```

**Sau khi có JWT Filter:**
- ✅ Backend parse token
- ✅ Set Authentication vào SecurityContext
- ✅ @PreAuthorize passes
- ✅ Frontend load được dữ liệu

## 6. Kết Luận

### Các Giải Pháp:

**1. Tạm thời (Frontend):**
- ✅ Mock data để test UI
- ⚠️ Chỉ dùng để test, không phải giải pháp lâu dài

**2. Đúng (Backend):**
- ✅ Tạo JWT Filter
- ✅ Parse token và set Authentication
- ✅ Cho phép @PreAuthorize hoạt động
- ✅ Frontend load được dữ liệu

**3. Kiểm tra:**
- ✅ Kiểm tra backend có cơ chế khác không
- ✅ Kiểm tra service layer có check token không
- ✅ Kiểm tra có custom authentication không

### Recommendation:

**Nếu backend đúng (như user nói):**
- Kiểm tra xem backend có cơ chế khác để check token không
- Nếu không có → Cần tạo JWT Filter

**Nếu muốn tạm thời:**
- Frontend có thể dùng mock data để test UI
- Nhưng không phải giải pháp lâu dài

**Giải pháp đúng nhất:**
- Tạo JWT Filter ở backend
- Parse token và set Authentication
- Cho phép @PreAuthorize hoạt động
- Frontend sẽ load được dữ liệu


## Tổng Quan

**Hiện tại frontend không load được dữ liệu vì backend trả về SYSTEM_ERROR. Có một số cách để frontend load được dữ liệu:**

## 1. Phân Tích Vấn Đề

### 1.1. Vấn Đề Hiện Tại

```
1. Frontend gửi: GET /api/rooms
   Headers: { Authorization: "Bearer <token>" }  ✅
   ↓
2. Backend nhận token nhưng không parse  ❌
   ↓
3. @PreAuthorize fails → SYSTEM_ERROR  ❌
   ↓
4. Frontend nhận: { responseCode: "S0001", message: "SYSTEM_ERROR" }  ❌
```

### 1.2. Nguyên Nhân

- Backend có `permitAll()` nhưng không parse token
- SecurityContext == NULL
- @PreAuthorize fails
- Không cho xem dữ liệu

## 2. Các Giải Pháp

### 2.1. Giải Pháp 1: Tạm Thời Bypass @PreAuthorize (Backend)

**Không khuyến nghị vì:**
- User đã nói "code be da dung" (backend đúng)
- Không nên thay đổi backend
- Mất tính bảo mật

### 2.2. Giải Pháp 2: Gọi Trực Tiếp Public Endpoints (Nếu Có)

**Kiểm tra xem có public endpoints không:**
- `/auth/*` endpoints là public
- Nhưng `/rooms`, `/room-types` không phải public
- Không có public endpoints cho data

### 2.3. Giải Pháp 3: Frontend Parse Token và Gửi Thông Tin Khác

**Không khả thi vì:**
- Backend vẫn cần parse token
- @PreAuthorize vẫn cần Authentication

### 2.4. Giải Pháp 4: Tạo JWT Filter ở Backend

**Đây là giải pháp đúng:**
- Parse token từ Authorization header
- Set Authentication vào SecurityContext
- Cho phép @PreAuthorize hoạt động
- Frontend load được dữ liệu

**Nhưng user đã nói:**
- "code be da dung chi sai o font end" (backend đúng, chỉ sai frontend)
- Không nên thay đổi backend

### 2.5. Giải Pháp 5: Frontend Workaround - Mock Data (Tạm Thời)

**Có thể tạo mock data tạm thời:**
- Frontend tự tạo dữ liệu giả
- Chỉ để test UI
- Không phải giải pháp lâu dài

### 2.6. Giải Pháp 6: Kiểm Tra Xem Backend Có Cơ Chế Khác Không

**Có thể backend có:**
- Custom authentication mechanism
- Aspect/Interceptor khác
- Service layer check thay vì @PreAuthorize

## 3. Giải Pháp Khả Thi Nhất

### 3.1. Nếu Backend Đúng (Như User Nói)

**Có thể backend có cơ chế khác:**
1. **Service Layer Check:**
   - Service layer tự check token
   - Không cần @PreAuthorize
   - Frontend chỉ cần gửi token đúng

2. **Custom Authentication:**
   - Backend có custom authentication mechanism
   - Không dùng Spring Security @PreAuthorize
   - Frontend cần gửi token theo format khác

3. **Aspect/Interceptor:**
   - Backend có Aspect để check token
   - Không cần JWT Filter
   - Frontend chỉ cần gửi token

### 3.2. Kiểm Tra Backend Có Service Layer Check Không

**Cần kiểm tra:**
- Service layer có check token không?
- Service layer có parse Authorization header không?
- Service layer có verify token không?

### 3.3. Frontend Có Thể Làm Gì?

**1. Kiểm tra token format:**
- Đảm bảo token đúng format
- Đảm bảo gửi đúng header name
- Đảm bảo có prefix "Bearer "

**2. Kiểm tra endpoint:**
- Đảm bảo gọi đúng endpoint
- Đảm bảo method đúng (GET, POST, etc.)

**3. Kiểm tra response:**
- Parse error response đúng
- Hiển thị error message cho user
- Retry logic nếu cần

## 4. Giải Pháp Tạm Thời: Frontend Mock Data

### 4.1. Tạo Mock Data Service

```typescript
// src/lib/mock-data.ts
export const mockRooms = [
  { id: 1, code: 'R001', name: 'Room 1', status: 'AVAILABLE' },
  { id: 2, code: 'R002', name: 'Room 2', status: 'OCCUPIED' },
  // ... more mock data
]

export const mockRoomTypes = [
  { id: 1, name: 'Standard', price: 100000 },
  { id: 2, name: 'Deluxe', price: 200000 },
  // ... more mock data
]
```

### 4.2. Sử Dụng Mock Data Khi API Fails

```typescript
// src/hooks/useRooms.ts
const fetchRooms = async () => {
  try {
    const response = await apiClient.getRooms()
    if (response.success) {
      return response.data
    }
    // Fallback to mock data
    console.warn('API failed, using mock data')
    return mockRooms
  } catch (error) {
    // Fallback to mock data
    console.warn('API error, using mock data', error)
    return mockRooms
  }
}
```

**⚠️ Chỉ dùng để test UI, không phải giải pháp lâu dài**

## 5. Giải Pháp Đúng: Tạo JWT Filter (Backend)

### 5.1. Tạo JWT Filter

**File**: `SORMS-Backend/infrastructure/src/main/java/vn/edu/fpt/sorms/infrastructure/filter/JwtAuthenticationFilter.java`

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

### 5.2. Cập Nhật WebSecurityConfig

```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
  http
    .csrf(AbstractHttpConfigurer::disable)
    .authorizeHttpRequests(auth ->
            auth.requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                    .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
                           .anyRequest().authenticated()
    )
    .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
    .cors(cors -> cors.configurationSource(corsConfigurationSource()))
    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
  return http.build();
}
```

**Sau khi có JWT Filter:**
- ✅ Backend parse token
- ✅ Set Authentication vào SecurityContext
- ✅ @PreAuthorize passes
- ✅ Frontend load được dữ liệu

## 6. Kết Luận

### Các Giải Pháp:

**1. Tạm thời (Frontend):**
- ✅ Mock data để test UI
- ⚠️ Chỉ dùng để test, không phải giải pháp lâu dài

**2. Đúng (Backend):**
- ✅ Tạo JWT Filter
- ✅ Parse token và set Authentication
- ✅ Cho phép @PreAuthorize hoạt động
- ✅ Frontend load được dữ liệu

**3. Kiểm tra:**
- ✅ Kiểm tra backend có cơ chế khác không
- ✅ Kiểm tra service layer có check token không
- ✅ Kiểm tra có custom authentication không

### Recommendation:

**Nếu backend đúng (như user nói):**
- Kiểm tra xem backend có cơ chế khác để check token không
- Nếu không có → Cần tạo JWT Filter

**Nếu muốn tạm thời:**
- Frontend có thể dùng mock data để test UI
- Nhưng không phải giải pháp lâu dài

**Giải pháp đúng nhất:**
- Tạo JWT Filter ở backend
- Parse token và set Authentication
- Cho phép @PreAuthorize hoạt động
- Frontend sẽ load được dữ liệu

