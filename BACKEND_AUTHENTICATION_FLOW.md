# Backend Authentication Flow Analysis

## OutboundAuthenticationService Flow

### Step-by-Step Process

#### Step 1: Exchange Authorization Code for Access Token
```java
ExchangeTokenOutBoundResponse tokenResponse = outBoundIdentityClient.exchangeToken(
    ExchangeTokenOutBoundRequest.builder()
        .code(request.getCode())
        .clientId(CLIENT_ID)
        .clientSecret(CLIENT_SECRET)
        .grantType("authorization_code")
        .redirectUri(request.getRedirectUri().trim())
        .build()
);
```
- Gọi Google OAuth2 API để exchange code lấy access token

#### Step 2: Get User Info from Google
```java
OutBoundUserInfoResponse userInfo = outBoundUserInfoClient.getUserInfo(
    "json", 
    tokenResponse.getAccessToken()
);
```
- Lấy thông tin user từ Google (email, name, picture, etc.)

#### Step 3: Find or Create Account
```java
Account account = accountDomainService.findUserLoginByEmail(userInfo.getEmail())
    .orElseGet(() -> createNewAccountFromOAuth(userInfo));
```
- Tìm account trong database theo email
- Nếu không có, tạo account mới với role "USER" mặc định

#### Step 4: Get Roles from Database
```java
List<AccountRole> accountRoles = accountRoleDomainService.findByFields(
    Map.of("accountId", account.getId())
);

List<String> roles = accountRoles.stream()
    .map(AccountRole::getRoleId)           // Lấy roleId (là name của Role)
    .map(roleId -> roleDomainService.findById(roleId).orElse(null))
    .filter(Objects::nonNull)
    .map(Role::getName)                    // Lấy Role.getName()
    .collect(Collectors.toList());
```
- Lấy roles từ database (AccountRole → Role)
- Roles là `Role.getName()` - có thể là "ADMIN", "USER", "STAFF", "MANAGER" (uppercase)

#### Step 5: Generate JWT Token
```java
String token = jwtProvider.generateToken(account, roles);
```

### JWT Token Generation (JWTProvider)

```java
JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
    .subject(account.getEmail())
    .issuer("sorms.com.vn")
    .claim("scope", buildScope(roles))      // "ROLE_admin ROLE_user"
    .claim("userId", account.getId())
    .claim("accountInfo", accountJson)
    .claim("roles", roles)                  // ["admin", "user"] hoặc ["ADMIN", "USER"]
    .build();
```

#### buildScope() Method
```java
private String buildScope(List<String> roles) {
    StringJoiner stringJoiner = new StringJoiner(" ");
    roles.forEach(role -> {
        stringJoiner.add("ROLE_" + role);  // Thêm prefix "ROLE_"
    });
    return stringJoiner.toString();
}
```

**Ví dụ:**
- Nếu `roles = ["ADMIN", "USER"]` → `scope = "ROLE_ADMIN ROLE_USER"`
- Nếu `roles = ["admin", "user"]` → `scope = "ROLE_admin ROLE_user"`

## Role Structure in Database

### Role Entity
```java
@Entity
@Table(name = "roles")
public class Role extends BaseEntity<String> {
    @Id
    @Column(name = "name", nullable = false, length = 100)
    private String name;  // Primary key: "ADMIN", "USER", "STAFF", "MANAGER"
    
    @Column(name = "code", nullable = false, length = 50)
    private String code;  // "ADMIN", "USER", etc.
    
    @Column(name = "description", length = 255)
    private String description;
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
}
```

### RoleCode Enum
```java
public enum RoleCode {
    USER("USER"),
    ADMIN("ADMIN"),
    STAFF("STAFF"),
    MANAGER("MANAGER");
}
```

**Lưu ý:** Role name trong database có thể là uppercase ("ADMIN") hoặc lowercase ("admin"), tùy thuộc vào cách data được insert.

## JWT Token Structure

### Claims trong JWT Token:
```json
{
  "sub": "user@example.com",
  "iss": "sorms.com.vn",
  "scope": "ROLE_admin ROLE_user",  // Với prefix ROLE_
  "userId": "1",
  "roles": ["admin", "user"],        // Từ Role.getName()
  "accountInfo": "{...}"             // JSON string của Account object
}
```

## Protected Endpoints Authorization

### RoomController & RoomTypeController
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```

**Yêu cầu:**
- Authorities: `STAFF`, `MANAGER`, hoặc `ADMIN` (uppercase, không có prefix `ROLE_`)
- Spring Security cần Authentication object trong SecurityContext
- Authentication object phải có authorities đúng format

## Vấn Đề Phát Hiện

### 1. Backend Không Có JWT Filter
- ❌ **KHÔNG CÓ** filter để tự động parse JWT token từ `Authorization: Bearer <token>` header
- ❌ **KHÔNG CÓ** cơ chế để set Authentication vào SecurityContext
- Khi `@PreAuthorize` được kiểm tra, SecurityContext không có Authentication → **FAIL**

### 2. Role Name Format Mismatch
- **Database**: Role name có thể là "ADMIN" hoặc "admin" (tùy data)
- **JWT Token**: 
  - `roles: ["admin", "user"]` (từ Role.getName())
  - `scope: "ROLE_admin ROLE_user"` (với prefix ROLE_)
- **@PreAuthorize**: Yêu cầu "ADMIN" (uppercase, không có prefix ROLE_)

**Vấn đề:**
- Nếu Role.getName() trả về "admin" (lowercase) → JWT có `roles: ["admin"]`
- Nhưng @PreAuthorize yêu cầu "ADMIN" (uppercase)
- Cần map "admin" → "ADMIN" khi set authorities

### 3. Scope vs Authorities
- **JWT Token có**: `scope: "ROLE_admin ROLE_user"` (với prefix ROLE_)
- **@PreAuthorize yêu cầu**: `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')` (không có prefix ROLE_)
- Spring Security's `hasAnyAuthority` kiểm tra exact authority name, không tự động remove prefix

## Flow Hiện Tại

### Authentication Flow:
```
1. Frontend → POST /auth/outbound/authentication { code, redirectUri }
2. Backend → Exchange code với Google → Get access token
3. Backend → Get user info từ Google
4. Backend → Find/Create account trong database
5. Backend → Get roles từ database (Role.getName())
6. Backend → Generate JWT token với roles
7. Backend → Return { token, authenticated: true, accountInfo }
8. Frontend → Lưu token vào localStorage/cookie
```

### Protected API Flow (HIỆN TẠI - FAIL):
```
1. Frontend → GET /rooms với Authorization: Bearer <token>
2. Backend → permitAll() cho phép request
3. Backend → RoomController.getAllRooms()
4. Backend → @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')") được kiểm tra
5. ❌ SecurityContext không có Authentication
6. ❌ @PreAuthorize fail → Exception
7. Backend → GlobalExceptionHandler catch → SYSTEM_ERROR
```

### Protected API Flow (CẦN CÓ - JWT Filter):
```
1. Frontend → GET /rooms với Authorization: Bearer <token>
2. Backend → JWT Filter intercept request
3. Backend → Parse token từ Authorization header
4. Backend → Verify token signature và expiration
5. Backend → Extract roles từ token
6. Backend → Map roles (lowercase) → authorities (uppercase)
7. Backend → Create Authentication object với authorities
8. Backend → Set Authentication vào SecurityContext
9. Backend → RoomController.getAllRooms()
10. Backend → @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')") được kiểm tra
11. ✅ SecurityContext có Authentication với authorities đúng
12. ✅ @PreAuthorize pass → Execute method
13. Backend → Return data
```

## Giải Pháp Cần Thiết

### Backend Cần Thêm:

#### 1. JWT Filter
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
                
                // Map roles to authorities (uppercase, no ROLE_ prefix)
                List<GrantedAuthority> authorities = roles.stream()
                    .map(role -> role.toUpperCase())  // "admin" → "ADMIN"
                    .map(role -> new SimpleGrantedAuthority(role))  // "ADMIN" authority
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

#### 2. Update WebSecurityConfig
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

## Kết Luận

**Backend thiếu hoàn toàn JWT Filter** để tự động parse token và set Authentication. Điều này khiến `@PreAuthorize` không thể hoạt động đúng, dẫn đến lỗi `SYSTEM_ERROR` cho tất cả protected endpoints.

**Frontend đã làm đúng 100%:**
- ✅ Gửi `Authorization: Bearer <token>` header
- ✅ Token có đầy đủ thông tin (roles, scope, accountInfo)
- ✅ Next.js API routes forward header đúng cách

**Vấn đề không thể giải quyết chỉ bằng cách sửa frontend** - cần thêm JWT Filter ở backend.


## OutboundAuthenticationService Flow

### Step-by-Step Process

#### Step 1: Exchange Authorization Code for Access Token
```java
ExchangeTokenOutBoundResponse tokenResponse = outBoundIdentityClient.exchangeToken(
    ExchangeTokenOutBoundRequest.builder()
        .code(request.getCode())
        .clientId(CLIENT_ID)
        .clientSecret(CLIENT_SECRET)
        .grantType("authorization_code")
        .redirectUri(request.getRedirectUri().trim())
        .build()
);
```
- Gọi Google OAuth2 API để exchange code lấy access token

#### Step 2: Get User Info from Google
```java
OutBoundUserInfoResponse userInfo = outBoundUserInfoClient.getUserInfo(
    "json", 
    tokenResponse.getAccessToken()
);
```
- Lấy thông tin user từ Google (email, name, picture, etc.)

#### Step 3: Find or Create Account
```java
Account account = accountDomainService.findUserLoginByEmail(userInfo.getEmail())
    .orElseGet(() -> createNewAccountFromOAuth(userInfo));
```
- Tìm account trong database theo email
- Nếu không có, tạo account mới với role "USER" mặc định

#### Step 4: Get Roles from Database
```java
List<AccountRole> accountRoles = accountRoleDomainService.findByFields(
    Map.of("accountId", account.getId())
);

List<String> roles = accountRoles.stream()
    .map(AccountRole::getRoleId)           // Lấy roleId (là name của Role)
    .map(roleId -> roleDomainService.findById(roleId).orElse(null))
    .filter(Objects::nonNull)
    .map(Role::getName)                    // Lấy Role.getName()
    .collect(Collectors.toList());
```
- Lấy roles từ database (AccountRole → Role)
- Roles là `Role.getName()` - có thể là "ADMIN", "USER", "STAFF", "MANAGER" (uppercase)

#### Step 5: Generate JWT Token
```java
String token = jwtProvider.generateToken(account, roles);
```

### JWT Token Generation (JWTProvider)

```java
JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
    .subject(account.getEmail())
    .issuer("sorms.com.vn")
    .claim("scope", buildScope(roles))      // "ROLE_admin ROLE_user"
    .claim("userId", account.getId())
    .claim("accountInfo", accountJson)
    .claim("roles", roles)                  // ["admin", "user"] hoặc ["ADMIN", "USER"]
    .build();
```

#### buildScope() Method
```java
private String buildScope(List<String> roles) {
    StringJoiner stringJoiner = new StringJoiner(" ");
    roles.forEach(role -> {
        stringJoiner.add("ROLE_" + role);  // Thêm prefix "ROLE_"
    });
    return stringJoiner.toString();
}
```

**Ví dụ:**
- Nếu `roles = ["ADMIN", "USER"]` → `scope = "ROLE_ADMIN ROLE_USER"`
- Nếu `roles = ["admin", "user"]` → `scope = "ROLE_admin ROLE_user"`

## Role Structure in Database

### Role Entity
```java
@Entity
@Table(name = "roles")
public class Role extends BaseEntity<String> {
    @Id
    @Column(name = "name", nullable = false, length = 100)
    private String name;  // Primary key: "ADMIN", "USER", "STAFF", "MANAGER"
    
    @Column(name = "code", nullable = false, length = 50)
    private String code;  // "ADMIN", "USER", etc.
    
    @Column(name = "description", length = 255)
    private String description;
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
}
```

### RoleCode Enum
```java
public enum RoleCode {
    USER("USER"),
    ADMIN("ADMIN"),
    STAFF("STAFF"),
    MANAGER("MANAGER");
}
```

**Lưu ý:** Role name trong database có thể là uppercase ("ADMIN") hoặc lowercase ("admin"), tùy thuộc vào cách data được insert.

## JWT Token Structure

### Claims trong JWT Token:
```json
{
  "sub": "user@example.com",
  "iss": "sorms.com.vn",
  "scope": "ROLE_admin ROLE_user",  // Với prefix ROLE_
  "userId": "1",
  "roles": ["admin", "user"],        // Từ Role.getName()
  "accountInfo": "{...}"             // JSON string của Account object
}
```

## Protected Endpoints Authorization

### RoomController & RoomTypeController
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```

**Yêu cầu:**
- Authorities: `STAFF`, `MANAGER`, hoặc `ADMIN` (uppercase, không có prefix `ROLE_`)
- Spring Security cần Authentication object trong SecurityContext
- Authentication object phải có authorities đúng format

## Vấn Đề Phát Hiện

### 1. Backend Không Có JWT Filter
- ❌ **KHÔNG CÓ** filter để tự động parse JWT token từ `Authorization: Bearer <token>` header
- ❌ **KHÔNG CÓ** cơ chế để set Authentication vào SecurityContext
- Khi `@PreAuthorize` được kiểm tra, SecurityContext không có Authentication → **FAIL**

### 2. Role Name Format Mismatch
- **Database**: Role name có thể là "ADMIN" hoặc "admin" (tùy data)
- **JWT Token**: 
  - `roles: ["admin", "user"]` (từ Role.getName())
  - `scope: "ROLE_admin ROLE_user"` (với prefix ROLE_)
- **@PreAuthorize**: Yêu cầu "ADMIN" (uppercase, không có prefix ROLE_)

**Vấn đề:**
- Nếu Role.getName() trả về "admin" (lowercase) → JWT có `roles: ["admin"]`
- Nhưng @PreAuthorize yêu cầu "ADMIN" (uppercase)
- Cần map "admin" → "ADMIN" khi set authorities

### 3. Scope vs Authorities
- **JWT Token có**: `scope: "ROLE_admin ROLE_user"` (với prefix ROLE_)
- **@PreAuthorize yêu cầu**: `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')` (không có prefix ROLE_)
- Spring Security's `hasAnyAuthority` kiểm tra exact authority name, không tự động remove prefix

## Flow Hiện Tại

### Authentication Flow:
```
1. Frontend → POST /auth/outbound/authentication { code, redirectUri }
2. Backend → Exchange code với Google → Get access token
3. Backend → Get user info từ Google
4. Backend → Find/Create account trong database
5. Backend → Get roles từ database (Role.getName())
6. Backend → Generate JWT token với roles
7. Backend → Return { token, authenticated: true, accountInfo }
8. Frontend → Lưu token vào localStorage/cookie
```

### Protected API Flow (HIỆN TẠI - FAIL):
```
1. Frontend → GET /rooms với Authorization: Bearer <token>
2. Backend → permitAll() cho phép request
3. Backend → RoomController.getAllRooms()
4. Backend → @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')") được kiểm tra
5. ❌ SecurityContext không có Authentication
6. ❌ @PreAuthorize fail → Exception
7. Backend → GlobalExceptionHandler catch → SYSTEM_ERROR
```

### Protected API Flow (CẦN CÓ - JWT Filter):
```
1. Frontend → GET /rooms với Authorization: Bearer <token>
2. Backend → JWT Filter intercept request
3. Backend → Parse token từ Authorization header
4. Backend → Verify token signature và expiration
5. Backend → Extract roles từ token
6. Backend → Map roles (lowercase) → authorities (uppercase)
7. Backend → Create Authentication object với authorities
8. Backend → Set Authentication vào SecurityContext
9. Backend → RoomController.getAllRooms()
10. Backend → @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')") được kiểm tra
11. ✅ SecurityContext có Authentication với authorities đúng
12. ✅ @PreAuthorize pass → Execute method
13. Backend → Return data
```

## Giải Pháp Cần Thiết

### Backend Cần Thêm:

#### 1. JWT Filter
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
                
                // Map roles to authorities (uppercase, no ROLE_ prefix)
                List<GrantedAuthority> authorities = roles.stream()
                    .map(role -> role.toUpperCase())  // "admin" → "ADMIN"
                    .map(role -> new SimpleGrantedAuthority(role))  // "ADMIN" authority
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

#### 2. Update WebSecurityConfig
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

## Kết Luận

**Backend thiếu hoàn toàn JWT Filter** để tự động parse token và set Authentication. Điều này khiến `@PreAuthorize` không thể hoạt động đúng, dẫn đến lỗi `SYSTEM_ERROR` cho tất cả protected endpoints.

**Frontend đã làm đúng 100%:**
- ✅ Gửi `Authorization: Bearer <token>` header
- ✅ Token có đầy đủ thông tin (roles, scope, accountInfo)
- ✅ Next.js API routes forward header đúng cách

**Vấn đề không thể giải quyết chỉ bằng cách sửa frontend** - cần thêm JWT Filter ở backend.

