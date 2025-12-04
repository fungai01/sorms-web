# Spring Security @PreAuthorize Annotation - Giải Thích Chi Tiết

## 1. @PreAuthorize là gì?

`@PreAuthorize` là một annotation từ Spring Security được sử dụng để **kiểm tra quyền truy cập TRƯỚC KHI thực thi method hoặc class**.

**File**: `PreAuthorize.class`
```java
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Inherited
@Documented
public @interface PreAuthorize {
   String value();
}
```

**Giải thích:**
- `@Target({ElementType.METHOD, ElementType.TYPE})`: Có thể dùng ở **method level** hoặc **class level**
- `@Retention(RetentionPolicy.RUNTIME)`: Annotation được giữ lại khi runtime
- `@Inherited`: Annotation được kế thừa bởi subclasses
- `@Documented`: Annotation được include trong JavaDoc
- `String value()`: Expression string để kiểm tra quyền (ví dụ: `"hasAuthority('ADMIN')"`)

## 2. Cách Sử Dụng

### Class Level (Áp dụng cho tất cả methods trong class)

```java
@RestController
@RequestMapping("/roles")
@PreAuthorize("hasAuthority('ADMIN')")  // ✅ Tất cả methods trong class yêu cầu ADMIN
public class RoleController {
    
    @GetMapping
    public ResponseEntity<...> getAllRoles() {
        // Method này yêu cầu ADMIN
    }
    
    @PostMapping
    public ResponseEntity<...> createRole() {
        // Method này cũng yêu cầu ADMIN
    }
}
```

### Method Level (Chỉ áp dụng cho method cụ thể)

```java
@RestController
@RequestMapping("/bookings")
public class BookingController {
    
    @PostMapping
    @PreAuthorize("hasAuthority('USER')")  // ✅ Chỉ method này yêu cầu USER
    public ResponseEntity<...> createBooking() {
        // ...
    }
    
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // ✅ Method này yêu cầu STAFF, MANAGER, hoặc ADMIN
    public ResponseEntity<...> updateBooking() {
        // ...
    }
    
    @GetMapping
    // ✅ Không có @PreAuthorize - Không yêu cầu authentication
    public ResponseEntity<...> getAllBookings() {
        // ...
    }
}
```

### Kết Hợp Class Level và Method Level

```java
@RestController
@RequestMapping("/orders")
@PreAuthorize("hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')")  // ✅ Class level: Default cho tất cả methods
public class OrderController {
    
    @PostMapping("/{orderId}/staff/confirm")
    @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // ✅ Method level: Override class level
    public ResponseEntity<...> staffConfirmOrder() {
        // Method này yêu cầu STAFF, MANAGER, hoặc ADMIN (không phải USER)
    }
    
    @GetMapping("/{orderId}")
    @PreAuthorize("isAuthenticated()")  // ✅ Method level: Override class level
    public ResponseEntity<...> getOrder() {
        // Method này chỉ yêu cầu authenticated (bất kỳ role nào)
    }
}
```

## 3. Các Expression Phổ Biến

### hasAuthority('ROLE_NAME')
```java
@PreAuthorize("hasAuthority('ADMIN')")
```
- Kiểm tra user có authority **chính xác** là `ADMIN`
- Yêu cầu: `Authentication.getAuthorities()` phải chứa `GrantedAuthority("ADMIN")`

### hasAnyAuthority('ROLE1', 'ROLE2', 'ROLE3')
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```
- Kiểm tra user có **ít nhất một** trong các authorities: `STAFF`, `MANAGER`, hoặc `ADMIN`
- Yêu cầu: `Authentication.getAuthorities()` phải chứa ít nhất một trong các authorities này

### hasRole('ROLE_NAME')
```java
@PreAuthorize("hasRole('ADMIN')")
```
- Tương tự `hasAuthority('ROLE_ADMIN')`
- Spring Security tự động thêm prefix `ROLE_` khi kiểm tra
- Yêu cầu: Authority phải là `ROLE_ADMIN` (không phải `ADMIN`)

### hasAnyRole('ROLE1', 'ROLE2')
```java
@PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
```
- Tương tự `hasAnyAuthority('ROLE_STAFF', 'ROLE_ADMIN')`
- Spring Security tự động thêm prefix `ROLE_`

### isAuthenticated()
```java
@PreAuthorize("isAuthenticated()")
```
- Chỉ yêu cầu user đã authenticated (bất kỳ role nào)
- Không kiểm tra role cụ thể

### permitAll() / anonymous()
```java
@PreAuthorize("permitAll()")
```
- Cho phép tất cả (kể cả chưa authenticated)
- Thường không dùng với `@PreAuthorize`, mà dùng trong `WebSecurityConfig`

## 4. Cách Hoạt Động

### Flow Chi Tiết

```
1. Request đến endpoint:
   GET /api/system/rooms
   Headers: Authorization: Bearer <token>

2. Spring Security Filter Chain:
   - CORS Filter
   - JWT Filter (nếu có) → Parse token, set Authentication
   - SecurityContextHolder.getContext().setAuthentication(authentication)
   - ...

3. DispatcherServlet:
   - Route request đến controller method

4. Spring AOP Interceptor (@PreAuthorize):
   - Intercept method call TRƯỚC KHI thực thi method
   - Lấy Authentication từ SecurityContext:
     Authentication auth = SecurityContextHolder.getContext().getAuthentication();
   - Evaluate expression: hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')
   - Kiểm tra authorities:
     auth.getAuthorities().contains(new SimpleGrantedAuthority("STAFF")) ||
     auth.getAuthorities().contains(new SimpleGrantedAuthority("MANAGER")) ||
     auth.getAuthorities().contains(new SimpleGrantedAuthority("ADMIN"))
   - Nếu pass → Cho phép thực thi method
   - Nếu fail → Throw AccessDeniedException

5. Method Execution:
   - Nếu pass → Thực thi method
   - Nếu fail → GlobalExceptionHandler catch AccessDeniedException → Trả về error
```

### Vấn Đề Hiện Tại

**Trong code của bạn:**

```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
public class RoomController {
    // ...
}
```

**Vấn đề:**
1. ✅ Request có token trong `Authorization` header
2. ❌ **Không có JWT Filter** để parse token và set Authentication
3. ❌ `SecurityContextHolder.getContext().getAuthentication()` → **null**
4. ❌ `@PreAuthorize` evaluate expression → **fail** (vì không có Authentication)
5. ❌ Throw `AccessDeniedException` hoặc `Exception`
6. ❌ `GlobalExceptionHandler` catch → Trả về `SYSTEM_ERROR` (S0001)

## 5. Yêu Cầu Để @PreAuthorize Hoạt Động

### 1. Authentication Object Phải Có Trong SecurityContext

```java
// Cần có trong SecurityContext:
Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

// Authentication phải có:
authentication != null
authentication.isAuthenticated() == true
authentication.getAuthorities() != null
authentication.getAuthorities().contains(new SimpleGrantedAuthority("ADMIN"))
```

### 2. Authorities Phải Đúng Format

**@PreAuthorize yêu cầu:**
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```

**Authorities trong Authentication phải là:**
```java
List<GrantedAuthority> authorities = Arrays.asList(
    new SimpleGrantedAuthority("STAFF"),    // ✅ Uppercase, không có prefix ROLE_
    new SimpleGrantedAuthority("MANAGER"),  // ✅ Uppercase, không có prefix ROLE_
    new SimpleGrantedAuthority("ADMIN")     // ✅ Uppercase, không có prefix ROLE_
);
```

**KHÔNG phải:**
```java
// ❌ Lowercase
new SimpleGrantedAuthority("admin")

// ❌ Có prefix ROLE_
new SimpleGrantedAuthority("ROLE_ADMIN")

// ❌ Format khác
new SimpleGrantedAuthority("role_admin")
```

### 3. JWT Filter Phải Parse Token và Set Authentication

**Cần có JWT Filter:**
```java
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    
    @Override
    protected void doFilterInternal(...) {
        // 1. Extract token từ Authorization header
        String token = extractToken(request);
        
        // 2. Verify token
        SignedJWT signedJWT = jwtProvider.verifyToken(token, false);
        
        // 3. Extract roles từ token
        List<String> roles = extractRoles(signedJWT);  // ["admin", "user"]
        
        // 4. Map roles → authorities (uppercase, không có prefix ROLE_)
        List<GrantedAuthority> authorities = roles.stream()
            .map(role -> role.toUpperCase())              // "admin" → "ADMIN"
            .map(role -> new SimpleGrantedAuthority(role)) // "ADMIN" authority
            .collect(Collectors.toList());
        
        // 5. Create Authentication object
        Authentication authentication = new UsernamePasswordAuthenticationToken(
            signedJWT.getSubject(),  // email
            null,
            authorities
        );
        
        // 6. Set Authentication vào SecurityContext
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
```

## 6. So Sánh với @Secured và @RolesAllowed

### @PreAuthorize (Spring Security - Recommended)
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```
- ✅ Hỗ trợ SpEL (Spring Expression Language)
- ✅ Linh hoạt hơn, có thể dùng complex expressions
- ✅ Cần `@EnableMethodSecurity` với `prePostEnabled = true`

### @Secured (Spring Security - Legacy)
```java
@Secured({"ROLE_STAFF", "ROLE_MANAGER", "ROLE_ADMIN"})
```
- ❌ Không hỗ trợ SpEL
- ❌ Yêu cầu prefix `ROLE_`
- ✅ Đơn giản hơn

### @RolesAllowed (JSR-250 - Standard)
```java
@RolesAllowed({"STAFF", "MANAGER", "ADMIN"})
```
- ❌ Không hỗ trợ SpEL
- ✅ Standard Java annotation
- ✅ Cần `@EnableMethodSecurity` với `jsr250Enabled = true`

## 7. Kết Luận

### @PreAuthorize Hoạt Động Khi:
1. ✅ Có `@EnableMethodSecurity` trong config
2. ✅ Có Authentication object trong SecurityContext
3. ✅ Authentication có authorities đúng format (uppercase, không có prefix ROLE_)
4. ✅ Expression match với authorities

### @PreAuthorize Không Hoạt Động Khi:
1. ❌ Không có Authentication trong SecurityContext
2. ❌ Authorities không đúng format (lowercase, có prefix ROLE_)
3. ❌ Expression không match với authorities
4. ❌ Token không được parse và set vào SecurityContext

### Trong Code Của Bạn:
- ✅ Có `@EnableMethodSecurity` trong `WebSecurityConfig`
- ✅ Có `@PreAuthorize` annotations trên controllers
- ❌ **Không có JWT Filter** để parse token và set Authentication
- ❌ **@PreAuthorize không hoạt động** → Trả về `SYSTEM_ERROR`

### Giải Pháp:
**Cần thêm JWT Filter để parse token và set Authentication vào SecurityContext.**


## 1. @PreAuthorize là gì?

`@PreAuthorize` là một annotation từ Spring Security được sử dụng để **kiểm tra quyền truy cập TRƯỚC KHI thực thi method hoặc class**.

**File**: `PreAuthorize.class`
```java
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Inherited
@Documented
public @interface PreAuthorize {
   String value();
}
```

**Giải thích:**
- `@Target({ElementType.METHOD, ElementType.TYPE})`: Có thể dùng ở **method level** hoặc **class level**
- `@Retention(RetentionPolicy.RUNTIME)`: Annotation được giữ lại khi runtime
- `@Inherited`: Annotation được kế thừa bởi subclasses
- `@Documented`: Annotation được include trong JavaDoc
- `String value()`: Expression string để kiểm tra quyền (ví dụ: `"hasAuthority('ADMIN')"`)

## 2. Cách Sử Dụng

### Class Level (Áp dụng cho tất cả methods trong class)

```java
@RestController
@RequestMapping("/roles")
@PreAuthorize("hasAuthority('ADMIN')")  // ✅ Tất cả methods trong class yêu cầu ADMIN
public class RoleController {
    
    @GetMapping
    public ResponseEntity<...> getAllRoles() {
        // Method này yêu cầu ADMIN
    }
    
    @PostMapping
    public ResponseEntity<...> createRole() {
        // Method này cũng yêu cầu ADMIN
    }
}
```

### Method Level (Chỉ áp dụng cho method cụ thể)

```java
@RestController
@RequestMapping("/bookings")
public class BookingController {
    
    @PostMapping
    @PreAuthorize("hasAuthority('USER')")  // ✅ Chỉ method này yêu cầu USER
    public ResponseEntity<...> createBooking() {
        // ...
    }
    
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // ✅ Method này yêu cầu STAFF, MANAGER, hoặc ADMIN
    public ResponseEntity<...> updateBooking() {
        // ...
    }
    
    @GetMapping
    // ✅ Không có @PreAuthorize - Không yêu cầu authentication
    public ResponseEntity<...> getAllBookings() {
        // ...
    }
}
```

### Kết Hợp Class Level và Method Level

```java
@RestController
@RequestMapping("/orders")
@PreAuthorize("hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')")  // ✅ Class level: Default cho tất cả methods
public class OrderController {
    
    @PostMapping("/{orderId}/staff/confirm")
    @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // ✅ Method level: Override class level
    public ResponseEntity<...> staffConfirmOrder() {
        // Method này yêu cầu STAFF, MANAGER, hoặc ADMIN (không phải USER)
    }
    
    @GetMapping("/{orderId}")
    @PreAuthorize("isAuthenticated()")  // ✅ Method level: Override class level
    public ResponseEntity<...> getOrder() {
        // Method này chỉ yêu cầu authenticated (bất kỳ role nào)
    }
}
```

## 3. Các Expression Phổ Biến

### hasAuthority('ROLE_NAME')
```java
@PreAuthorize("hasAuthority('ADMIN')")
```
- Kiểm tra user có authority **chính xác** là `ADMIN`
- Yêu cầu: `Authentication.getAuthorities()` phải chứa `GrantedAuthority("ADMIN")`

### hasAnyAuthority('ROLE1', 'ROLE2', 'ROLE3')
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```
- Kiểm tra user có **ít nhất một** trong các authorities: `STAFF`, `MANAGER`, hoặc `ADMIN`
- Yêu cầu: `Authentication.getAuthorities()` phải chứa ít nhất một trong các authorities này

### hasRole('ROLE_NAME')
```java
@PreAuthorize("hasRole('ADMIN')")
```
- Tương tự `hasAuthority('ROLE_ADMIN')`
- Spring Security tự động thêm prefix `ROLE_` khi kiểm tra
- Yêu cầu: Authority phải là `ROLE_ADMIN` (không phải `ADMIN`)

### hasAnyRole('ROLE1', 'ROLE2')
```java
@PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
```
- Tương tự `hasAnyAuthority('ROLE_STAFF', 'ROLE_ADMIN')`
- Spring Security tự động thêm prefix `ROLE_`

### isAuthenticated()
```java
@PreAuthorize("isAuthenticated()")
```
- Chỉ yêu cầu user đã authenticated (bất kỳ role nào)
- Không kiểm tra role cụ thể

### permitAll() / anonymous()
```java
@PreAuthorize("permitAll()")
```
- Cho phép tất cả (kể cả chưa authenticated)
- Thường không dùng với `@PreAuthorize`, mà dùng trong `WebSecurityConfig`

## 4. Cách Hoạt Động

### Flow Chi Tiết

```
1. Request đến endpoint:
   GET /api/system/rooms
   Headers: Authorization: Bearer <token>

2. Spring Security Filter Chain:
   - CORS Filter
   - JWT Filter (nếu có) → Parse token, set Authentication
   - SecurityContextHolder.getContext().setAuthentication(authentication)
   - ...

3. DispatcherServlet:
   - Route request đến controller method

4. Spring AOP Interceptor (@PreAuthorize):
   - Intercept method call TRƯỚC KHI thực thi method
   - Lấy Authentication từ SecurityContext:
     Authentication auth = SecurityContextHolder.getContext().getAuthentication();
   - Evaluate expression: hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')
   - Kiểm tra authorities:
     auth.getAuthorities().contains(new SimpleGrantedAuthority("STAFF")) ||
     auth.getAuthorities().contains(new SimpleGrantedAuthority("MANAGER")) ||
     auth.getAuthorities().contains(new SimpleGrantedAuthority("ADMIN"))
   - Nếu pass → Cho phép thực thi method
   - Nếu fail → Throw AccessDeniedException

5. Method Execution:
   - Nếu pass → Thực thi method
   - Nếu fail → GlobalExceptionHandler catch AccessDeniedException → Trả về error
```

### Vấn Đề Hiện Tại

**Trong code của bạn:**

```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
public class RoomController {
    // ...
}
```

**Vấn đề:**
1. ✅ Request có token trong `Authorization` header
2. ❌ **Không có JWT Filter** để parse token và set Authentication
3. ❌ `SecurityContextHolder.getContext().getAuthentication()` → **null**
4. ❌ `@PreAuthorize` evaluate expression → **fail** (vì không có Authentication)
5. ❌ Throw `AccessDeniedException` hoặc `Exception`
6. ❌ `GlobalExceptionHandler` catch → Trả về `SYSTEM_ERROR` (S0001)

## 5. Yêu Cầu Để @PreAuthorize Hoạt Động

### 1. Authentication Object Phải Có Trong SecurityContext

```java
// Cần có trong SecurityContext:
Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

// Authentication phải có:
authentication != null
authentication.isAuthenticated() == true
authentication.getAuthorities() != null
authentication.getAuthorities().contains(new SimpleGrantedAuthority("ADMIN"))
```

### 2. Authorities Phải Đúng Format

**@PreAuthorize yêu cầu:**
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```

**Authorities trong Authentication phải là:**
```java
List<GrantedAuthority> authorities = Arrays.asList(
    new SimpleGrantedAuthority("STAFF"),    // ✅ Uppercase, không có prefix ROLE_
    new SimpleGrantedAuthority("MANAGER"),  // ✅ Uppercase, không có prefix ROLE_
    new SimpleGrantedAuthority("ADMIN")     // ✅ Uppercase, không có prefix ROLE_
);
```

**KHÔNG phải:**
```java
// ❌ Lowercase
new SimpleGrantedAuthority("admin")

// ❌ Có prefix ROLE_
new SimpleGrantedAuthority("ROLE_ADMIN")

// ❌ Format khác
new SimpleGrantedAuthority("role_admin")
```

### 3. JWT Filter Phải Parse Token và Set Authentication

**Cần có JWT Filter:**
```java
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    
    @Override
    protected void doFilterInternal(...) {
        // 1. Extract token từ Authorization header
        String token = extractToken(request);
        
        // 2. Verify token
        SignedJWT signedJWT = jwtProvider.verifyToken(token, false);
        
        // 3. Extract roles từ token
        List<String> roles = extractRoles(signedJWT);  // ["admin", "user"]
        
        // 4. Map roles → authorities (uppercase, không có prefix ROLE_)
        List<GrantedAuthority> authorities = roles.stream()
            .map(role -> role.toUpperCase())              // "admin" → "ADMIN"
            .map(role -> new SimpleGrantedAuthority(role)) // "ADMIN" authority
            .collect(Collectors.toList());
        
        // 5. Create Authentication object
        Authentication authentication = new UsernamePasswordAuthenticationToken(
            signedJWT.getSubject(),  // email
            null,
            authorities
        );
        
        // 6. Set Authentication vào SecurityContext
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
```

## 6. So Sánh với @Secured và @RolesAllowed

### @PreAuthorize (Spring Security - Recommended)
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```
- ✅ Hỗ trợ SpEL (Spring Expression Language)
- ✅ Linh hoạt hơn, có thể dùng complex expressions
- ✅ Cần `@EnableMethodSecurity` với `prePostEnabled = true`

### @Secured (Spring Security - Legacy)
```java
@Secured({"ROLE_STAFF", "ROLE_MANAGER", "ROLE_ADMIN"})
```
- ❌ Không hỗ trợ SpEL
- ❌ Yêu cầu prefix `ROLE_`
- ✅ Đơn giản hơn

### @RolesAllowed (JSR-250 - Standard)
```java
@RolesAllowed({"STAFF", "MANAGER", "ADMIN"})
```
- ❌ Không hỗ trợ SpEL
- ✅ Standard Java annotation
- ✅ Cần `@EnableMethodSecurity` với `jsr250Enabled = true`

## 7. Kết Luận

### @PreAuthorize Hoạt Động Khi:
1. ✅ Có `@EnableMethodSecurity` trong config
2. ✅ Có Authentication object trong SecurityContext
3. ✅ Authentication có authorities đúng format (uppercase, không có prefix ROLE_)
4. ✅ Expression match với authorities

### @PreAuthorize Không Hoạt Động Khi:
1. ❌ Không có Authentication trong SecurityContext
2. ❌ Authorities không đúng format (lowercase, có prefix ROLE_)
3. ❌ Expression không match với authorities
4. ❌ Token không được parse và set vào SecurityContext

### Trong Code Của Bạn:
- ✅ Có `@EnableMethodSecurity` trong `WebSecurityConfig`
- ✅ Có `@PreAuthorize` annotations trên controllers
- ❌ **Không có JWT Filter** để parse token và set Authentication
- ❌ **@PreAuthorize không hoạt động** → Trả về `SYSTEM_ERROR`

### Giải Pháp:
**Cần thêm JWT Filter để parse token và set Authentication vào SecurityContext.**

