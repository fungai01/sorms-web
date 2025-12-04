# Giải Thích: Đăng Nhập vs JWT Filter

## Tổng Quan

**Có 2 giai đoạn khác nhau:**

1. **Đăng nhập (Login)** = Tạo token ✅ **ĐÃ CÓ**
2. **Xác thực request (JWT Filter)** = Verify token trong mỗi request ❌ **CHƯA CÓ**

## 1. Đăng Nhập (Login) - ✅ ĐÃ CÓ

### 1.1. Flow Đăng Nhập

**File**: `OutboundAuthenticationService.java`

```
1. User click "Đăng nhập với Google"
   ↓
2. Frontend gọi: POST /auth/outbound/authentication
   Request: { code, redirectUri }
   ↓
3. Backend OutboundAuthenticationService:
   - Exchange code → Get access token từ Google
   - Get user info từ Google
   - Find/Create account trong database
   - Lấy roles từ database (AccountRole)
   - Generate JWT token với roles
   ↓
4. Backend trả về:
   Response: { 
     authenticated: true,
     token: "eyJhbGciOiJ...",
     accountInfo: { roles: ["admin", "user"] }
   }
   ↓
5. Frontend lưu token vào localStorage
   ✅ Đăng nhập thành công
```

**Code:**

```java
// OutboundAuthenticationService.java
@Override
protected AuthenticationResponse execute(OutboundAuthenticateRequest request) {
    // Step 1-4: Exchange code, get user info, find/create account
    // Step 5: Generate JWT token
    String token = jwtProvider.generateToken(account, roles);  // ✅ Tạo token
    
    return AuthenticationResponse.builder()
        .token(token)  // ✅ Trả về token
        .authenticated(true)
        .accountInfo(accountInfo)
        .build();
}
```

**Kết luận:**
- ✅ **Đăng nhập đã hoạt động** - Tạo token thành công
- ✅ Token được trả về cho frontend
- ✅ Frontend lưu token vào localStorage

## 2. Xác Thực Request (JWT Filter) - ❌ CHƯA CÓ

### 2.1. Vấn Đề Sau Khi Đăng Nhập

**Sau khi đăng nhập thành công, user gọi API:**

```
1. Frontend gọi: GET /rooms
   Headers: { Authorization: "Bearer eyJhbGciOiJ..." }
   ↓
2. Request đến backend
   ↓
3. ❌ KHÔNG CÓ JWT Filter để:
   - Extract token từ Authorization header
   - Verify token
   - Set Authentication vào SecurityContext
   ↓
4. Request đến RoomController trực tiếp
   ↓
5. RoomController có @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
   ↓
6. @PreAuthorize check SecurityContext.getAuthentication()
   ↓
7. ❌ SecurityContext.getAuthentication() == NULL
   ↓
8. ❌ @PreAuthorize fails → Throw AccessDeniedException
   ↓
9. GlobalExceptionHandler catch → Return SYSTEM_ERROR
   ↓
10. Frontend nhận: { responseCode: "S0001", message: "SYSTEM_ERROR" }
```

### 2.2. Code Hiện Tại

**RoomController:**

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

**WebSecurityConfig:**

```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
  http
    .authorizeHttpRequests(auth ->
            auth.requestMatchers("/**").permitAll()  // ❌ Bypass tất cả
                    .anyRequest().authenticated()
    )
    // ❌ KHÔNG CÓ addFilter() để thêm JWT Filter
    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
  return http.build();
}
```

**Kết luận:**
- ❌ **Không có JWT Filter** để verify token trong mỗi request
- ❌ `SecurityContext.getAuthentication()` **luôn NULL**
- ❌ `@PreAuthorize` **luôn fail**
- ❌ Protected endpoints trả về `SYSTEM_ERROR`

## 3. So Sánh: Đăng Nhập vs Xác Thực Request

### 3.1. Đăng Nhập (Login) - ✅ ĐÃ CÓ

| Bước | Mô Tả | Status |
|------|-------|--------|
| 1 | User click "Đăng nhập với Google" | ✅ |
| 2 | Frontend gọi `/auth/outbound/authentication` | ✅ |
| 3 | Backend exchange code → Get user info | ✅ |
| 4 | Backend find/create account | ✅ |
| 5 | Backend lấy roles từ database | ✅ |
| 6 | Backend generate JWT token | ✅ |
| 7 | Backend trả về token | ✅ |
| 8 | Frontend lưu token | ✅ |

**Kết quả:** ✅ Đăng nhập thành công, có token

### 3.2. Xác Thực Request (JWT Filter) - ❌ CHƯA CÓ

| Bước | Mô Tả | Status |
|------|-------|--------|
| 1 | Frontend gọi API với token | ✅ |
| 2 | Request đến backend | ✅ |
| 3 | **JWT Filter extract token** | ❌ **THIẾU** |
| 4 | **JWT Filter verify token** | ❌ **THIẾU** |
| 5 | **JWT Filter parse roles** | ❌ **THIẾU** |
| 6 | **JWT Filter set Authentication** | ❌ **THIẾU** |
| 7 | Request đến Controller | ✅ |
| 8 | @PreAuthorize check SecurityContext | ✅ |
| 9 | SecurityContext.getAuthentication() | ❌ **NULL** |
| 10 | @PreAuthorize fails | ❌ |

**Kết quả:** ❌ Không thể xác thực request, trả về `SYSTEM_ERROR`

## 4. Tại Sao Cần JWT Filter?

### 4.1. Đăng Nhập Chỉ Tạo Token

**Đăng nhập:**
- ✅ Tạo token với roles
- ✅ Trả về token cho frontend
- ❌ **KHÔNG verify token** trong các request sau

**Ví dụ:**
```
Login: POST /auth/outbound/authentication
→ Tạo token: "eyJhbGciOiJ..."
→ Trả về token
→ ✅ Xong (chỉ tạo token, không verify)
```

### 4.2. Mỗi Request Cần Verify Token

**Mỗi request sau khi login:**
- ✅ Frontend gửi token trong `Authorization` header
- ❌ **Backend cần verify token** mỗi lần
- ❌ **Backend cần set Authentication** vào SecurityContext
- ❌ **Backend cần extract roles** từ token

**Ví dụ:**
```
GET /rooms
Headers: { Authorization: "Bearer eyJhbGciOiJ..." }
→ ❌ Cần JWT Filter để:
   - Extract token
   - Verify token
   - Set Authentication
→ ✅ Sau đó mới đến Controller
```

## 5. Flow Hoàn Chỉnh (Có JWT Filter)

### 5.1. Đăng Nhập

```
1. User đăng nhập
   ↓
2. POST /auth/outbound/authentication
   ↓
3. Backend tạo token
   ↓
4. Trả về token
   ↓
5. Frontend lưu token
   ✅ Đăng nhập thành công
```

### 5.2. Gọi API (Có JWT Filter)

```
1. Frontend gọi: GET /rooms
   Headers: { Authorization: "Bearer <token>" }
   ↓
2. JWT Filter intercept request
   ↓
3. Extract token từ Authorization header
   ↓
4. Verify token (signature, expiration)
   ↓
5. Parse roles từ token claims
   ↓
6. Create Authentication object
   ↓
7. Set Authentication vào SecurityContext
   ↓
8. Request tiếp tục đến Controller
   ↓
9. @PreAuthorize check SecurityContext
   ↓
10. SecurityContext.getAuthentication() != NULL
   ↓
11. @PreAuthorize passes
   ↓
12. Controller xử lý request
   ↓
13. Trả về data
   ✅ Thành công
```

## 6. Kết Luận

### Đăng Nhập (Login):

**Đã có:**
- ✅ `OutboundAuthenticationService` - Tạo token
- ✅ `JWTProvider.generateToken()` - Generate JWT
- ✅ Trả về token cho frontend

**Kết quả:**
- ✅ Đăng nhập thành công
- ✅ Có token

### Xác Thực Request (JWT Filter):

**Chưa có:**
- ❌ JWT Filter để extract token
- ❌ JWT Filter để verify token
- ❌ JWT Filter để set Authentication

**Kết quả:**
- ❌ Không thể verify token trong mỗi request
- ❌ `SecurityContext.getAuthentication()` luôn NULL
- ❌ `@PreAuthorize` luôn fail
- ❌ Protected endpoints trả về `SYSTEM_ERROR`

### Tóm Tắt:

**Đăng nhập ≠ Xác thực request**

- **Đăng nhập:** Tạo token 1 lần ✅ (đã có)
- **Xác thực request:** Verify token mỗi lần ❌ (chưa có)

**Cần tạo JWT Filter để:**
- Extract token từ mỗi request
- Verify token mỗi lần
- Set Authentication vào SecurityContext
- Cho phép `@PreAuthorize` hoạt động


## Tổng Quan

**Có 2 giai đoạn khác nhau:**

1. **Đăng nhập (Login)** = Tạo token ✅ **ĐÃ CÓ**
2. **Xác thực request (JWT Filter)** = Verify token trong mỗi request ❌ **CHƯA CÓ**

## 1. Đăng Nhập (Login) - ✅ ĐÃ CÓ

### 1.1. Flow Đăng Nhập

**File**: `OutboundAuthenticationService.java`

```
1. User click "Đăng nhập với Google"
   ↓
2. Frontend gọi: POST /auth/outbound/authentication
   Request: { code, redirectUri }
   ↓
3. Backend OutboundAuthenticationService:
   - Exchange code → Get access token từ Google
   - Get user info từ Google
   - Find/Create account trong database
   - Lấy roles từ database (AccountRole)
   - Generate JWT token với roles
   ↓
4. Backend trả về:
   Response: { 
     authenticated: true,
     token: "eyJhbGciOiJ...",
     accountInfo: { roles: ["admin", "user"] }
   }
   ↓
5. Frontend lưu token vào localStorage
   ✅ Đăng nhập thành công
```

**Code:**

```java
// OutboundAuthenticationService.java
@Override
protected AuthenticationResponse execute(OutboundAuthenticateRequest request) {
    // Step 1-4: Exchange code, get user info, find/create account
    // Step 5: Generate JWT token
    String token = jwtProvider.generateToken(account, roles);  // ✅ Tạo token
    
    return AuthenticationResponse.builder()
        .token(token)  // ✅ Trả về token
        .authenticated(true)
        .accountInfo(accountInfo)
        .build();
}
```

**Kết luận:**
- ✅ **Đăng nhập đã hoạt động** - Tạo token thành công
- ✅ Token được trả về cho frontend
- ✅ Frontend lưu token vào localStorage

## 2. Xác Thực Request (JWT Filter) - ❌ CHƯA CÓ

### 2.1. Vấn Đề Sau Khi Đăng Nhập

**Sau khi đăng nhập thành công, user gọi API:**

```
1. Frontend gọi: GET /rooms
   Headers: { Authorization: "Bearer eyJhbGciOiJ..." }
   ↓
2. Request đến backend
   ↓
3. ❌ KHÔNG CÓ JWT Filter để:
   - Extract token từ Authorization header
   - Verify token
   - Set Authentication vào SecurityContext
   ↓
4. Request đến RoomController trực tiếp
   ↓
5. RoomController có @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
   ↓
6. @PreAuthorize check SecurityContext.getAuthentication()
   ↓
7. ❌ SecurityContext.getAuthentication() == NULL
   ↓
8. ❌ @PreAuthorize fails → Throw AccessDeniedException
   ↓
9. GlobalExceptionHandler catch → Return SYSTEM_ERROR
   ↓
10. Frontend nhận: { responseCode: "S0001", message: "SYSTEM_ERROR" }
```

### 2.2. Code Hiện Tại

**RoomController:**

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

**WebSecurityConfig:**

```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
  http
    .authorizeHttpRequests(auth ->
            auth.requestMatchers("/**").permitAll()  // ❌ Bypass tất cả
                    .anyRequest().authenticated()
    )
    // ❌ KHÔNG CÓ addFilter() để thêm JWT Filter
    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
  return http.build();
}
```

**Kết luận:**
- ❌ **Không có JWT Filter** để verify token trong mỗi request
- ❌ `SecurityContext.getAuthentication()` **luôn NULL**
- ❌ `@PreAuthorize` **luôn fail**
- ❌ Protected endpoints trả về `SYSTEM_ERROR`

## 3. So Sánh: Đăng Nhập vs Xác Thực Request

### 3.1. Đăng Nhập (Login) - ✅ ĐÃ CÓ

| Bước | Mô Tả | Status |
|------|-------|--------|
| 1 | User click "Đăng nhập với Google" | ✅ |
| 2 | Frontend gọi `/auth/outbound/authentication` | ✅ |
| 3 | Backend exchange code → Get user info | ✅ |
| 4 | Backend find/create account | ✅ |
| 5 | Backend lấy roles từ database | ✅ |
| 6 | Backend generate JWT token | ✅ |
| 7 | Backend trả về token | ✅ |
| 8 | Frontend lưu token | ✅ |

**Kết quả:** ✅ Đăng nhập thành công, có token

### 3.2. Xác Thực Request (JWT Filter) - ❌ CHƯA CÓ

| Bước | Mô Tả | Status |
|------|-------|--------|
| 1 | Frontend gọi API với token | ✅ |
| 2 | Request đến backend | ✅ |
| 3 | **JWT Filter extract token** | ❌ **THIẾU** |
| 4 | **JWT Filter verify token** | ❌ **THIẾU** |
| 5 | **JWT Filter parse roles** | ❌ **THIẾU** |
| 6 | **JWT Filter set Authentication** | ❌ **THIẾU** |
| 7 | Request đến Controller | ✅ |
| 8 | @PreAuthorize check SecurityContext | ✅ |
| 9 | SecurityContext.getAuthentication() | ❌ **NULL** |
| 10 | @PreAuthorize fails | ❌ |

**Kết quả:** ❌ Không thể xác thực request, trả về `SYSTEM_ERROR`

## 4. Tại Sao Cần JWT Filter?

### 4.1. Đăng Nhập Chỉ Tạo Token

**Đăng nhập:**
- ✅ Tạo token với roles
- ✅ Trả về token cho frontend
- ❌ **KHÔNG verify token** trong các request sau

**Ví dụ:**
```
Login: POST /auth/outbound/authentication
→ Tạo token: "eyJhbGciOiJ..."
→ Trả về token
→ ✅ Xong (chỉ tạo token, không verify)
```

### 4.2. Mỗi Request Cần Verify Token

**Mỗi request sau khi login:**
- ✅ Frontend gửi token trong `Authorization` header
- ❌ **Backend cần verify token** mỗi lần
- ❌ **Backend cần set Authentication** vào SecurityContext
- ❌ **Backend cần extract roles** từ token

**Ví dụ:**
```
GET /rooms
Headers: { Authorization: "Bearer eyJhbGciOiJ..." }
→ ❌ Cần JWT Filter để:
   - Extract token
   - Verify token
   - Set Authentication
→ ✅ Sau đó mới đến Controller
```

## 5. Flow Hoàn Chỉnh (Có JWT Filter)

### 5.1. Đăng Nhập

```
1. User đăng nhập
   ↓
2. POST /auth/outbound/authentication
   ↓
3. Backend tạo token
   ↓
4. Trả về token
   ↓
5. Frontend lưu token
   ✅ Đăng nhập thành công
```

### 5.2. Gọi API (Có JWT Filter)

```
1. Frontend gọi: GET /rooms
   Headers: { Authorization: "Bearer <token>" }
   ↓
2. JWT Filter intercept request
   ↓
3. Extract token từ Authorization header
   ↓
4. Verify token (signature, expiration)
   ↓
5. Parse roles từ token claims
   ↓
6. Create Authentication object
   ↓
7. Set Authentication vào SecurityContext
   ↓
8. Request tiếp tục đến Controller
   ↓
9. @PreAuthorize check SecurityContext
   ↓
10. SecurityContext.getAuthentication() != NULL
   ↓
11. @PreAuthorize passes
   ↓
12. Controller xử lý request
   ↓
13. Trả về data
   ✅ Thành công
```

## 6. Kết Luận

### Đăng Nhập (Login):

**Đã có:**
- ✅ `OutboundAuthenticationService` - Tạo token
- ✅ `JWTProvider.generateToken()` - Generate JWT
- ✅ Trả về token cho frontend

**Kết quả:**
- ✅ Đăng nhập thành công
- ✅ Có token

### Xác Thực Request (JWT Filter):

**Chưa có:**
- ❌ JWT Filter để extract token
- ❌ JWT Filter để verify token
- ❌ JWT Filter để set Authentication

**Kết quả:**
- ❌ Không thể verify token trong mỗi request
- ❌ `SecurityContext.getAuthentication()` luôn NULL
- ❌ `@PreAuthorize` luôn fail
- ❌ Protected endpoints trả về `SYSTEM_ERROR`

### Tóm Tắt:

**Đăng nhập ≠ Xác thực request**

- **Đăng nhập:** Tạo token 1 lần ✅ (đã có)
- **Xác thực request:** Verify token mỗi lần ❌ (chưa có)

**Cần tạo JWT Filter để:**
- Extract token từ mỗi request
- Verify token mỗi lần
- Set Authentication vào SecurityContext
- Cho phép `@PreAuthorize` hoạt động

