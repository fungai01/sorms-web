# Xác Minh: Backend Có Nhận Bearer Token Không?

## Tổng Quan

**Frontend đã gửi Bearer token lên backend, nhưng backend KHÔNG có cơ chế để check token.**

## 1. Frontend Gửi Bearer Token

### 1.1. Flow Frontend → Backend

```
1. Frontend gọi: apiClient.getRooms()
   ↓
2. api-client.ts:
   - Lấy token từ accountInfo/authService/cookies
   - mergedHeaders['Authorization'] = `Bearer ${token}`  ✅
   ↓
3. authFetch():
   - headers.set('Authorization', `Bearer ${token}`)  ✅
   ↓
4. fetch() gửi request:
   Headers: { Authorization: "Bearer eyJhbGciOiJ..." }  ✅
   ↓
5. Next.js API Route (/api/system/rooms):
   - Nhận Authorization header từ request  ✅
   - Pass xuống apiClient: { headers: { Authorization: "Bearer ..." } }  ✅
   ↓
6. apiClient gửi đến Backend:
   GET https://backend.sorms.online/api/rooms
   Headers: { Authorization: "Bearer eyJhbGciOiJ..." }  ✅
   ↓
7. Backend nhận request:
   ✅ CÓ Authorization header
   ❌ KHÔNG CÓ JWT Filter để check
```

### 1.2. Code Frontend

**api-client.ts:**
```typescript
// Line 155-157
if (token) {
  mergedHeaders['Authorization'] = `Bearer ${token}`  // ✅ Gửi lên backend
}

// Line 185-200
const response = await authFetch(url, {
  method: options.method || 'GET',
  headers: mergedHeaders,  // ✅ Có Authorization header
  body: options.body,
  ...restOptions
})
```

**Next.js API Route:**
```typescript
// src/app/api/system/rooms/route.ts
const authHeader = request.headers.get('authorization')  // ✅ Nhận từ frontend
const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {}
const response = await apiClient.getRooms({ headers })  // ✅ Pass xuống backend
```

**✅ Frontend đã gửi Bearer token lên backend**

## 2. Backend Nhận Bearer Token

### 2.1. Backend Nhận Request

**Backend nhận được:**
```
GET /api/rooms
Headers: {
  Authorization: "Bearer eyJhbGciOiJIUzUxMiJ9.eyJhY2NvdW50SW5mbyI6..."
}
```

**✅ Backend CÓ NHẬN được Authorization header**

### 2.2. Backend Có Check Token Không?

**WebSecurityConfig.java:**
```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
  http
    .authorizeHttpRequests(auth ->
            auth.requestMatchers("/**").permitAll()  // ❌ BYPASS TẤT CẢ
                    .anyRequest().authenticated()
    )
    // ❌ KHÔNG CÓ JWT Filter
    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
  return http.build();
}
```

**RoomController.java:**
```java
@RestController
@RequestMapping("/rooms")
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // ✅ Có annotation
public class RoomController {
    @GetMapping
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getAllRooms() {
        // ❌ SecurityContext.getAuthentication() == NULL
        // ❌ @PreAuthorize fails
        // ❌ Throw AccessDeniedException
        // ❌ Return SYSTEM_ERROR
    }
}
```

**❌ Backend KHÔNG CÓ cơ chế để check token:**
- ❌ Không có JWT Filter để parse token
- ❌ Không có logic để verify token
- ❌ Không set Authentication vào SecurityContext
- ❌ `@PreAuthorize` luôn fail vì SecurityContext == NULL

## 3. Vấn Đề

### 3.1. Backend Nhận Token Nhưng Không Check

**Flow hiện tại:**
```
1. Frontend gửi: Authorization: Bearer <token>  ✅
   ↓
2. Backend nhận: Authorization header  ✅
   ↓
3. Backend: permitAll() → Bypass security  ❌
   ↓
4. Request đến Controller  ✅
   ↓
5. @PreAuthorize check SecurityContext  ✅
   ↓
6. SecurityContext.getAuthentication() == NULL  ❌
   ↓
7. @PreAuthorize fails → AccessDeniedException  ❌
   ↓
8. GlobalExceptionHandler → SYSTEM_ERROR  ❌
```

### 3.2. Tại Sao Backend Không Check Token?

**Thiếu JWT Filter:**
- ❌ Không có Filter để extract token từ Authorization header
- ❌ Không có Filter để verify token
- ❌ Không có Filter để parse roles từ token
- ❌ Không có Filter để set Authentication vào SecurityContext

**Kết quả:**
- ✅ Backend nhận được Authorization header
- ❌ Backend không check token
- ❌ SecurityContext luôn NULL
- ❌ @PreAuthorize luôn fail

## 4. Giải Pháp

### 4.1. Cần Tạo JWT Filter

**JWT Filter cần:**
1. Extract token từ `Authorization: Bearer <token>` header
2. Verify token bằng `JWTProvider.verifyToken()`
3. Parse roles từ JWT claims
4. Create `Authentication` object với authorities
5. Set vào `SecurityContextHolder`
6. Continue filter chain

**Sau khi có JWT Filter:**
```
1. Frontend gửi: Authorization: Bearer <token>  ✅
   ↓
2. Backend nhận: Authorization header  ✅
   ↓
3. JWT Filter:
   - Extract token  ✅
   - Verify token  ✅
   - Parse roles  ✅
   - Set Authentication  ✅
   ↓
4. Request đến Controller  ✅
   ↓
5. @PreAuthorize check SecurityContext  ✅
   ↓
6. SecurityContext.getAuthentication() != NULL  ✅
   ↓
7. @PreAuthorize passes  ✅
   ↓
8. Controller xử lý request  ✅
   ↓
9. Trả về data  ✅
```

## 5. Kết Luận

### Frontend:

**✅ Đã gửi Bearer token:**
- Format đúng: `Authorization: Bearer <token>`
- Gửi trong mọi request đến backend
- Next.js API routes pass token xuống backend

### Backend:

**✅ Nhận được Bearer token:**
- Backend nhận được Authorization header
- Header có format đúng: `Bearer <token>`

**❌ Không check token:**
- Không có JWT Filter để parse token
- Không có logic để verify token
- SecurityContext luôn NULL
- @PreAuthorize luôn fail

### Tóm Tắt:

**Frontend → Backend:**
- ✅ Frontend gửi Bearer token
- ✅ Backend nhận Bearer token
- ❌ Backend không check token (thiếu JWT Filter)

**Cần tạo JWT Filter để:**
- Parse token từ Authorization header
- Verify token
- Set Authentication vào SecurityContext
- Cho phép @PreAuthorize hoạt động


## Tổng Quan

**Frontend đã gửi Bearer token lên backend, nhưng backend KHÔNG có cơ chế để check token.**

## 1. Frontend Gửi Bearer Token

### 1.1. Flow Frontend → Backend

```
1. Frontend gọi: apiClient.getRooms()
   ↓
2. api-client.ts:
   - Lấy token từ accountInfo/authService/cookies
   - mergedHeaders['Authorization'] = `Bearer ${token}`  ✅
   ↓
3. authFetch():
   - headers.set('Authorization', `Bearer ${token}`)  ✅
   ↓
4. fetch() gửi request:
   Headers: { Authorization: "Bearer eyJhbGciOiJ..." }  ✅
   ↓
5. Next.js API Route (/api/system/rooms):
   - Nhận Authorization header từ request  ✅
   - Pass xuống apiClient: { headers: { Authorization: "Bearer ..." } }  ✅
   ↓
6. apiClient gửi đến Backend:
   GET https://backend.sorms.online/api/rooms
   Headers: { Authorization: "Bearer eyJhbGciOiJ..." }  ✅
   ↓
7. Backend nhận request:
   ✅ CÓ Authorization header
   ❌ KHÔNG CÓ JWT Filter để check
```

### 1.2. Code Frontend

**api-client.ts:**
```typescript
// Line 155-157
if (token) {
  mergedHeaders['Authorization'] = `Bearer ${token}`  // ✅ Gửi lên backend
}

// Line 185-200
const response = await authFetch(url, {
  method: options.method || 'GET',
  headers: mergedHeaders,  // ✅ Có Authorization header
  body: options.body,
  ...restOptions
})
```

**Next.js API Route:**
```typescript
// src/app/api/system/rooms/route.ts
const authHeader = request.headers.get('authorization')  // ✅ Nhận từ frontend
const headers: Record<string, string> = authHeader ? { 'Authorization': authHeader } : {}
const response = await apiClient.getRooms({ headers })  // ✅ Pass xuống backend
```

**✅ Frontend đã gửi Bearer token lên backend**

## 2. Backend Nhận Bearer Token

### 2.1. Backend Nhận Request

**Backend nhận được:**
```
GET /api/rooms
Headers: {
  Authorization: "Bearer eyJhbGciOiJIUzUxMiJ9.eyJhY2NvdW50SW5mbyI6..."
}
```

**✅ Backend CÓ NHẬN được Authorization header**

### 2.2. Backend Có Check Token Không?

**WebSecurityConfig.java:**
```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
  http
    .authorizeHttpRequests(auth ->
            auth.requestMatchers("/**").permitAll()  // ❌ BYPASS TẤT CẢ
                    .anyRequest().authenticated()
    )
    // ❌ KHÔNG CÓ JWT Filter
    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
  return http.build();
}
```

**RoomController.java:**
```java
@RestController
@RequestMapping("/rooms")
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // ✅ Có annotation
public class RoomController {
    @GetMapping
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getAllRooms() {
        // ❌ SecurityContext.getAuthentication() == NULL
        // ❌ @PreAuthorize fails
        // ❌ Throw AccessDeniedException
        // ❌ Return SYSTEM_ERROR
    }
}
```

**❌ Backend KHÔNG CÓ cơ chế để check token:**
- ❌ Không có JWT Filter để parse token
- ❌ Không có logic để verify token
- ❌ Không set Authentication vào SecurityContext
- ❌ `@PreAuthorize` luôn fail vì SecurityContext == NULL

## 3. Vấn Đề

### 3.1. Backend Nhận Token Nhưng Không Check

**Flow hiện tại:**
```
1. Frontend gửi: Authorization: Bearer <token>  ✅
   ↓
2. Backend nhận: Authorization header  ✅
   ↓
3. Backend: permitAll() → Bypass security  ❌
   ↓
4. Request đến Controller  ✅
   ↓
5. @PreAuthorize check SecurityContext  ✅
   ↓
6. SecurityContext.getAuthentication() == NULL  ❌
   ↓
7. @PreAuthorize fails → AccessDeniedException  ❌
   ↓
8. GlobalExceptionHandler → SYSTEM_ERROR  ❌
```

### 3.2. Tại Sao Backend Không Check Token?

**Thiếu JWT Filter:**
- ❌ Không có Filter để extract token từ Authorization header
- ❌ Không có Filter để verify token
- ❌ Không có Filter để parse roles từ token
- ❌ Không có Filter để set Authentication vào SecurityContext

**Kết quả:**
- ✅ Backend nhận được Authorization header
- ❌ Backend không check token
- ❌ SecurityContext luôn NULL
- ❌ @PreAuthorize luôn fail

## 4. Giải Pháp

### 4.1. Cần Tạo JWT Filter

**JWT Filter cần:**
1. Extract token từ `Authorization: Bearer <token>` header
2. Verify token bằng `JWTProvider.verifyToken()`
3. Parse roles từ JWT claims
4. Create `Authentication` object với authorities
5. Set vào `SecurityContextHolder`
6. Continue filter chain

**Sau khi có JWT Filter:**
```
1. Frontend gửi: Authorization: Bearer <token>  ✅
   ↓
2. Backend nhận: Authorization header  ✅
   ↓
3. JWT Filter:
   - Extract token  ✅
   - Verify token  ✅
   - Parse roles  ✅
   - Set Authentication  ✅
   ↓
4. Request đến Controller  ✅
   ↓
5. @PreAuthorize check SecurityContext  ✅
   ↓
6. SecurityContext.getAuthentication() != NULL  ✅
   ↓
7. @PreAuthorize passes  ✅
   ↓
8. Controller xử lý request  ✅
   ↓
9. Trả về data  ✅
```

## 5. Kết Luận

### Frontend:

**✅ Đã gửi Bearer token:**
- Format đúng: `Authorization: Bearer <token>`
- Gửi trong mọi request đến backend
- Next.js API routes pass token xuống backend

### Backend:

**✅ Nhận được Bearer token:**
- Backend nhận được Authorization header
- Header có format đúng: `Bearer <token>`

**❌ Không check token:**
- Không có JWT Filter để parse token
- Không có logic để verify token
- SecurityContext luôn NULL
- @PreAuthorize luôn fail

### Tóm Tắt:

**Frontend → Backend:**
- ✅ Frontend gửi Bearer token
- ✅ Backend nhận Bearer token
- ❌ Backend không check token (thiếu JWT Filter)

**Cần tạo JWT Filter để:**
- Parse token từ Authorization header
- Verify token
- Set Authentication vào SecurityContext
- Cho phép @PreAuthorize hoạt động

