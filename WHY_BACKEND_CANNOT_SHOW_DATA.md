# Tại Sao Backend Nhận Bearer Token Nhưng Không Cho Xem Dữ Liệu?

## Tổng Quan

**Backend nhận được Bearer token, nhưng vẫn không cho xem dữ liệu vì:**
1. ✅ Backend nhận được Authorization header
2. ❌ Backend KHÔNG parse token (thiếu JWT Filter)
3. ❌ SecurityContext.getAuthentication() == NULL
4. ❌ @PreAuthorize fails → AccessDeniedException
5. ❌ Trả về SYSTEM_ERROR thay vì dữ liệu

## 1. Flow Hiện Tại

### 1.1. Request Đến Backend

```
1. Frontend gửi:
   GET /api/rooms
   Headers: { Authorization: "Bearer eyJhbGciOiJ..." }  ✅
   ↓
2. Backend nhận request:
   ✅ CÓ Authorization header
   ✅ Header có format đúng: "Bearer <token>"
   ↓
3. WebSecurityConfig:
   auth.requestMatchers("/**").permitAll()  // ❌ BYPASS security
   ↓
4. Request đến RoomController:
   ✅ Đến được controller
   ↓
5. RoomController có @PreAuthorize:
   @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
   ↓
6. Spring Security check @PreAuthorize:
   SecurityContext.getAuthentication()  // ❌ NULL
   ↓
7. @PreAuthorize fails:
   ❌ Throw AccessDeniedException
   ↓
8. GlobalExceptionHandler:
   ❌ Catch AccessDeniedException
   ❌ Return: { responseCode: "S0001", message: "SYSTEM_ERROR" }
```

### 1.2. Vấn Đề

**Backend nhận được token nhưng:**
- ❌ Không parse token từ Authorization header
- ❌ Không verify token
- ❌ Không extract roles từ token
- ❌ Không set Authentication vào SecurityContext
- ❌ SecurityContext.getAuthentication() == NULL
- ❌ @PreAuthorize không thể check roles

## 2. Tại Sao @PreAuthorize Fails?

### 2.1. @PreAuthorize Cần Gì?

**@PreAuthorize cần:**
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```

**Spring Security sẽ:**
1. Lấy `Authentication` từ `SecurityContext`
2. Lấy `authorities` từ `Authentication`
3. Check xem có authority 'STAFF', 'MANAGER', hoặc 'ADMIN' không
4. Nếu có → Cho phép
5. Nếu không → Throw `AccessDeniedException`

### 2.2. Hiện Tại Backend

**SecurityContext:**
```java
SecurityContext.getContext().getAuthentication()  // ❌ NULL
```

**Tại sao NULL?**
- ❌ Không có JWT Filter để parse token
- ❌ Không có logic để set Authentication
- ❌ SecurityContext luôn empty

**Kết quả:**
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
// Spring Security check:
Authentication auth = SecurityContext.getContext().getAuthentication();
// auth == NULL
// → @PreAuthorize fails
// → Throw AccessDeniedException
```

## 3. Code Backend

### 3.1. WebSecurityConfig

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

**Vấn đề:**
- `permitAll()` → Bypass security, nhưng không parse token
- Không có JWT Filter → Không set Authentication
- SecurityContext luôn NULL

### 3.2. RoomController

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
        // ❌ Không đến được đây
    }
}
```

**Vấn đề:**
- @PreAuthorize check trước khi vào method
- SecurityContext == NULL → @PreAuthorize fails
- Throw AccessDeniedException → Không vào được method

### 3.3. SpringSecurityAuditorAware

```java
@Override
public Optional<String> getCurrentAuditor() {
  final Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
  // ❌ authentication == NULL
  if (authentication == null || !authentication.isAuthenticated()) {
    principal = "SYSTEM";  // ✅ Fallback
  }
  return Optional.ofNullable(principal);
}
```

**Vấn đề:**
- SecurityContext.getAuthentication() == NULL
- Phải dùng fallback "SYSTEM"
- Không có thông tin user thực tế

## 4. So Sánh: Có JWT Filter vs Không Có

### 4.1. Không Có JWT Filter (Hiện Tại)

```
1. Request đến: GET /api/rooms
   Headers: { Authorization: "Bearer <token>" }  ✅
   ↓
2. WebSecurityConfig: permitAll() → Bypass  ✅
   ↓
3. Request đến Controller  ✅
   ↓
4. @PreAuthorize check:
   SecurityContext.getAuthentication()  // ❌ NULL
   ↓
5. @PreAuthorize fails:
   ❌ Throw AccessDeniedException
   ↓
6. GlobalExceptionHandler:
   ❌ Return SYSTEM_ERROR
   ↓
7. Frontend nhận: { responseCode: "S0001", message: "SYSTEM_ERROR" }
   ❌ KHÔNG CÓ DỮ LIỆU
```

### 4.2. Có JWT Filter (Cần Tạo)

```
1. Request đến: GET /api/rooms
   Headers: { Authorization: "Bearer <token>" }  ✅
   ↓
2. JWT Filter intercept:
   - Extract token từ Authorization header  ✅
   - Verify token  ✅
   - Parse roles từ token  ✅
   - Create Authentication object  ✅
   - Set vào SecurityContext  ✅
   ↓
3. Request đến Controller  ✅
   ↓
4. @PreAuthorize check:
   SecurityContext.getAuthentication()  // ✅ CÓ GIÁ TRỊ
   Authentication.getAuthorities()  // ✅ CÓ ['ADMIN', 'USER']
   ↓
5. @PreAuthorize passes:
   ✅ hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN') → TRUE
   ↓
6. Controller xử lý:
   ✅ getAllRooms() được gọi
   ✅ Lấy dữ liệu từ database
   ✅ Trả về dữ liệu
   ↓
7. Frontend nhận: { data: [...] }
   ✅ CÓ DỮ LIỆU
```

## 5. Tại Sao Không Cho Xem Dữ Liệu?

### 5.1. Backend Nhận Token Nhưng Không Parse

**Vấn đề:**
- ✅ Backend nhận được Authorization header
- ❌ Backend KHÔNG parse token
- ❌ Backend KHÔNG verify token
- ❌ Backend KHÔNG extract roles
- ❌ Backend KHÔNG set Authentication

**Kết quả:**
- SecurityContext == NULL
- @PreAuthorize fails
- Không cho xem dữ liệu

### 5.2. @PreAuthorize Yêu Cầu Authentication

**@PreAuthorize cần:**
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```

**Spring Security sẽ:**
1. Lấy Authentication từ SecurityContext
2. Nếu Authentication == NULL → Fail
3. Throw AccessDeniedException
4. Không cho vào method

**Hiện tại:**
- SecurityContext.getAuthentication() == NULL
- @PreAuthorize fails
- Không cho xem dữ liệu

## 6. Giải Pháp

### 6.1. Cần Tạo JWT Filter

**JWT Filter cần làm:**
1. Extract token từ `Authorization: Bearer <token>` header
2. Verify token bằng `JWTProvider.verifyToken()`
3. Parse roles từ JWT claims
4. Create `Authentication` object với authorities
5. Set vào `SecurityContextHolder`
6. Continue filter chain

**Sau khi có JWT Filter:**
- SecurityContext.getAuthentication() != NULL
- @PreAuthorize passes
- Cho xem dữ liệu

## 7. Kết Luận

### Tại Sao Không Cho Xem Dữ Liệu?

**Backend nhận Bearer token nhưng:**
1. ❌ Không parse token (thiếu JWT Filter)
2. ❌ SecurityContext == NULL
3. ❌ @PreAuthorize fails
4. ❌ Throw AccessDeniedException
5. ❌ Trả về SYSTEM_ERROR thay vì dữ liệu

### Cần Làm Gì?

**Tạo JWT Filter để:**
- Parse token từ Authorization header
- Verify token
- Set Authentication vào SecurityContext
- Cho phép @PreAuthorize hoạt động
- Cho xem dữ liệu

### Tóm Tắt:

**Backend nhận token → Nhưng không parse → SecurityContext NULL → @PreAuthorize fails → Không cho xem dữ liệu**

**Cần JWT Filter để parse token → Set Authentication → @PreAuthorize passes → Cho xem dữ liệu**


## Tổng Quan

**Backend nhận được Bearer token, nhưng vẫn không cho xem dữ liệu vì:**
1. ✅ Backend nhận được Authorization header
2. ❌ Backend KHÔNG parse token (thiếu JWT Filter)
3. ❌ SecurityContext.getAuthentication() == NULL
4. ❌ @PreAuthorize fails → AccessDeniedException
5. ❌ Trả về SYSTEM_ERROR thay vì dữ liệu

## 1. Flow Hiện Tại

### 1.1. Request Đến Backend

```
1. Frontend gửi:
   GET /api/rooms
   Headers: { Authorization: "Bearer eyJhbGciOiJ..." }  ✅
   ↓
2. Backend nhận request:
   ✅ CÓ Authorization header
   ✅ Header có format đúng: "Bearer <token>"
   ↓
3. WebSecurityConfig:
   auth.requestMatchers("/**").permitAll()  // ❌ BYPASS security
   ↓
4. Request đến RoomController:
   ✅ Đến được controller
   ↓
5. RoomController có @PreAuthorize:
   @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
   ↓
6. Spring Security check @PreAuthorize:
   SecurityContext.getAuthentication()  // ❌ NULL
   ↓
7. @PreAuthorize fails:
   ❌ Throw AccessDeniedException
   ↓
8. GlobalExceptionHandler:
   ❌ Catch AccessDeniedException
   ❌ Return: { responseCode: "S0001", message: "SYSTEM_ERROR" }
```

### 1.2. Vấn Đề

**Backend nhận được token nhưng:**
- ❌ Không parse token từ Authorization header
- ❌ Không verify token
- ❌ Không extract roles từ token
- ❌ Không set Authentication vào SecurityContext
- ❌ SecurityContext.getAuthentication() == NULL
- ❌ @PreAuthorize không thể check roles

## 2. Tại Sao @PreAuthorize Fails?

### 2.1. @PreAuthorize Cần Gì?

**@PreAuthorize cần:**
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```

**Spring Security sẽ:**
1. Lấy `Authentication` từ `SecurityContext`
2. Lấy `authorities` từ `Authentication`
3. Check xem có authority 'STAFF', 'MANAGER', hoặc 'ADMIN' không
4. Nếu có → Cho phép
5. Nếu không → Throw `AccessDeniedException`

### 2.2. Hiện Tại Backend

**SecurityContext:**
```java
SecurityContext.getContext().getAuthentication()  // ❌ NULL
```

**Tại sao NULL?**
- ❌ Không có JWT Filter để parse token
- ❌ Không có logic để set Authentication
- ❌ SecurityContext luôn empty

**Kết quả:**
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
// Spring Security check:
Authentication auth = SecurityContext.getContext().getAuthentication();
// auth == NULL
// → @PreAuthorize fails
// → Throw AccessDeniedException
```

## 3. Code Backend

### 3.1. WebSecurityConfig

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

**Vấn đề:**
- `permitAll()` → Bypass security, nhưng không parse token
- Không có JWT Filter → Không set Authentication
- SecurityContext luôn NULL

### 3.2. RoomController

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
        // ❌ Không đến được đây
    }
}
```

**Vấn đề:**
- @PreAuthorize check trước khi vào method
- SecurityContext == NULL → @PreAuthorize fails
- Throw AccessDeniedException → Không vào được method

### 3.3. SpringSecurityAuditorAware

```java
@Override
public Optional<String> getCurrentAuditor() {
  final Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
  // ❌ authentication == NULL
  if (authentication == null || !authentication.isAuthenticated()) {
    principal = "SYSTEM";  // ✅ Fallback
  }
  return Optional.ofNullable(principal);
}
```

**Vấn đề:**
- SecurityContext.getAuthentication() == NULL
- Phải dùng fallback "SYSTEM"
- Không có thông tin user thực tế

## 4. So Sánh: Có JWT Filter vs Không Có

### 4.1. Không Có JWT Filter (Hiện Tại)

```
1. Request đến: GET /api/rooms
   Headers: { Authorization: "Bearer <token>" }  ✅
   ↓
2. WebSecurityConfig: permitAll() → Bypass  ✅
   ↓
3. Request đến Controller  ✅
   ↓
4. @PreAuthorize check:
   SecurityContext.getAuthentication()  // ❌ NULL
   ↓
5. @PreAuthorize fails:
   ❌ Throw AccessDeniedException
   ↓
6. GlobalExceptionHandler:
   ❌ Return SYSTEM_ERROR
   ↓
7. Frontend nhận: { responseCode: "S0001", message: "SYSTEM_ERROR" }
   ❌ KHÔNG CÓ DỮ LIỆU
```

### 4.2. Có JWT Filter (Cần Tạo)

```
1. Request đến: GET /api/rooms
   Headers: { Authorization: "Bearer <token>" }  ✅
   ↓
2. JWT Filter intercept:
   - Extract token từ Authorization header  ✅
   - Verify token  ✅
   - Parse roles từ token  ✅
   - Create Authentication object  ✅
   - Set vào SecurityContext  ✅
   ↓
3. Request đến Controller  ✅
   ↓
4. @PreAuthorize check:
   SecurityContext.getAuthentication()  // ✅ CÓ GIÁ TRỊ
   Authentication.getAuthorities()  // ✅ CÓ ['ADMIN', 'USER']
   ↓
5. @PreAuthorize passes:
   ✅ hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN') → TRUE
   ↓
6. Controller xử lý:
   ✅ getAllRooms() được gọi
   ✅ Lấy dữ liệu từ database
   ✅ Trả về dữ liệu
   ↓
7. Frontend nhận: { data: [...] }
   ✅ CÓ DỮ LIỆU
```

## 5. Tại Sao Không Cho Xem Dữ Liệu?

### 5.1. Backend Nhận Token Nhưng Không Parse

**Vấn đề:**
- ✅ Backend nhận được Authorization header
- ❌ Backend KHÔNG parse token
- ❌ Backend KHÔNG verify token
- ❌ Backend KHÔNG extract roles
- ❌ Backend KHÔNG set Authentication

**Kết quả:**
- SecurityContext == NULL
- @PreAuthorize fails
- Không cho xem dữ liệu

### 5.2. @PreAuthorize Yêu Cầu Authentication

**@PreAuthorize cần:**
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```

**Spring Security sẽ:**
1. Lấy Authentication từ SecurityContext
2. Nếu Authentication == NULL → Fail
3. Throw AccessDeniedException
4. Không cho vào method

**Hiện tại:**
- SecurityContext.getAuthentication() == NULL
- @PreAuthorize fails
- Không cho xem dữ liệu

## 6. Giải Pháp

### 6.1. Cần Tạo JWT Filter

**JWT Filter cần làm:**
1. Extract token từ `Authorization: Bearer <token>` header
2. Verify token bằng `JWTProvider.verifyToken()`
3. Parse roles từ JWT claims
4. Create `Authentication` object với authorities
5. Set vào `SecurityContextHolder`
6. Continue filter chain

**Sau khi có JWT Filter:**
- SecurityContext.getAuthentication() != NULL
- @PreAuthorize passes
- Cho xem dữ liệu

## 7. Kết Luận

### Tại Sao Không Cho Xem Dữ Liệu?

**Backend nhận Bearer token nhưng:**
1. ❌ Không parse token (thiếu JWT Filter)
2. ❌ SecurityContext == NULL
3. ❌ @PreAuthorize fails
4. ❌ Throw AccessDeniedException
5. ❌ Trả về SYSTEM_ERROR thay vì dữ liệu

### Cần Làm Gì?

**Tạo JWT Filter để:**
- Parse token từ Authorization header
- Verify token
- Set Authentication vào SecurityContext
- Cho phép @PreAuthorize hoạt động
- Cho xem dữ liệu

### Tóm Tắt:

**Backend nhận token → Nhưng không parse → SecurityContext NULL → @PreAuthorize fails → Không cho xem dữ liệu**

**Cần JWT Filter để parse token → Set Authentication → @PreAuthorize passes → Cho xem dữ liệu**

