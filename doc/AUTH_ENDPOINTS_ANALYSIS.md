# Phân Tích 2 Endpoints Authentication

## 1. POST /auth/outbound/authentication

### Mục Đích
Xác thực user thông qua OAuth2 (Google login), exchange authorization code để lấy JWT token.

### Request Format
```json
{
  "code": "4/0AeanS...",           // Authorization code từ Google OAuth
  "redirectUri": "http://localhost:3000/api/auth/callback/google"
}
```

### Flow Chi Tiết

**Step 1: Exchange Code for Access Token**
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
- Gọi Google OAuth API để exchange code → access token
- Sử dụng `OutBoundIdentityClient` (Feign Client)

**Step 2: Get User Info from Google**
```java
OutBoundUserInfoResponse userInfo = outBoundUserInfoClient.getUserInfo(
    "json", 
    tokenResponse.getAccessToken()
);
```
- Lấy thông tin user từ Google (email, name, picture, etc.)
- Sử dụng `OutBoundUserInfoClient` (Feign Client)

**Step 3: Find or Create Account**
```java
Account account = accountDomainService.findUserLoginByEmail(userInfo.getEmail())
    .orElseGet(() -> createNewAccountFromOAuth(userInfo));
```
- Tìm account trong database theo email
- Nếu không có → Tạo account mới với role "USER" mặc định

**Step 4: Get Roles for Account**
```java
List<AccountRole> accountRoles = accountRoleDomainService.findByFields(
    Map.of("accountId", account.getId())
);

List<String> roles = accountRoles.stream()
    .map(AccountRole::getRoleId)                    // Lấy roleId (là Role.name)
    .map(roleId -> roleDomainService.findById(roleId).orElse(null))  // Tìm Role
    .filter(Objects::nonNull)
    .map(Role::getName)                              // Lấy Role.getName()
    .collect(Collectors.toList());
```
- Lấy tất cả roles của account từ `AccountRole` table
- Convert `AccountRole.roleId` → `Role.name`

**Step 5: Generate JWT Token**
```java
String token = jwtProvider.generateToken(account, roles);
```
- Generate JWT token với:
  - `subject`: account email
  - `userId`: account ID
  - `roles`: List of role names (có thể là "USER", "ADMIN" hoặc "user", "admin" tùy data)
  - `scope`: "ROLE_USER ROLE_ADMIN" (với prefix ROLE_)
  - `accountInfo`: Account JSON string

**Step 6: Build Response**
```java
return AuthenticationResponse.builder()
    .token(token)
    .authenticated(true)
    .accountInfo(AccountInfoAuthenticateDTO.builder()
        .id(account.getId())
        .email(account.getEmail())
        .firstName(account.getFirstName())
        .lastName(account.getLastName())
        .avatarUrl(account.getAvatarUrl())
        .roleName(roles)  // ["USER", "ADMIN"] hoặc ["user", "admin"]
        .build())
    .build();
```

### Response Format
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "authenticated": true,
    "token": "eyJhbGciOiJIUzUxMiJ9...",
    "accountInfo": {
      "id": "1",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "avatarUrl": "https://...",
      "roleName": ["admin", "user"]  // Array of roles
    }
  }
}
```

### Security
- ✅ **Public endpoint** - Không cần authentication
- ✅ Trong `PUBLIC_ENDPOINTS` array
- ✅ `permitAll()` trong WebSecurityConfig

### ✅ Hoạt Động Đúng
- Có lấy roles từ AccountRole
- Có generate token với roles
- Có trả về accountInfo với roleName array

---

## 2. POST /auth/introspect

### Mục Đích
Verify JWT token và trả về thông tin user (roles, accountInfo) từ token.

### Request Format
```json
{
  "token": "eyJhbGciOiJIUzUxMiJ9..."
}
```

### Flow Chi Tiết

**Step 1: Verify Token**
```java
SignedJWT jwt = jwtProvider.verifyToken(token, false);
```
- Verify token signature và expiration time
- Check token có trong invalidated tokens table không
- Nếu invalid → `isValid = false`, `jwt = null`

**Step 2: Extract Claims from Token**
```java
// Extract accountId
String accountId = extractStringClaim(jwt, "userId");

// Extract username (subject = email)
String username = jwt.getPayload().toJSONObject().get("sub").toString();

// Extract roles
List<String> roles = extractRoles(jwt);  // Từ claim "roles"

// Parse accountInfo
AccountInfo accountInfo = parseAccountInfo(jwt);  // Từ claim "accountInfo"
```

**Step 3: Extract Roles**
```java
private List<String> extractRoles(SignedJWT jwt) {
    Object rolesClaim = jwt.getJWTClaimsSet().getClaim("roles");
    if (rolesClaim instanceof List<?> rawList) {
        List<String> result = new ArrayList<>();
        for (Object item : rawList) {
            if (item instanceof String) {
                result.add((String) item);  // ["USER", "ADMIN"] hoặc ["user", "admin"]
            }
        }
        return result;
    }
    return null;
}
```
- Extract roles từ token claim "roles"
- Trả về list of role names (có thể là uppercase hoặc lowercase tùy data)

**Step 4: Parse AccountInfo**
```java
private AccountInfo parseAccountInfo(SignedJWT jwt) {
    Object accountInfoClaim = jwt.getJWTClaimsSet().getClaim("accountInfo");
    if (accountInfoClaim instanceof String) {
        return objectMapper.readValue((String) accountInfoClaim, AccountInfo.class);
    } else {
        return objectMapper.convertValue(accountInfoClaim, AccountInfo.class);
    }
}
```
- Parse accountInfo từ token claim "accountInfo"
- AccountInfo có thể là JSON string hoặc object

**Step 5: Build Response**
```java
return IntrospectResponse.builder()
    .accountId(accountId)
    .valid(isValid)
    .username(username)  // email
    .roles(roles)        // ["USER", "ADMIN"] hoặc ["user", "admin"]
    .accountInfo(accountInfo)
    .build();
```

### Response Format
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "valid": true,
    "accountId": "1",
    "username": "user@example.com",
    "roles": ["admin", "user"],  // Array of roles từ token
    "accountInfo": {
      "id": "1",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "avatarUrl": "https://...",
      "roles": ["admin", "user"]  // Có thể có trong accountInfo
    }
  }
}
```

### Security
- ✅ **Public endpoint** - Không cần authentication
- ✅ Trong `PUBLIC_ENDPOINTS` array
- ✅ `permitAll()` trong WebSecurityConfig

### ✅ Hoạt Động Đúng
- Có verify token
- Có extract roles từ token
- Có parse accountInfo từ token
- Có trả về đầy đủ thông tin

---

## 3. So Sánh 2 Endpoints

| Aspect | /auth/outbound/authentication | /auth/introspect |
|--------|------------------------------|------------------|
| **Mục đích** | OAuth login, tạo token mới | Verify token, lấy thông tin từ token |
| **Input** | `{ code, redirectUri }` | `{ token }` |
| **Output** | `{ token, authenticated, accountInfo }` | `{ valid, accountId, username, roles, accountInfo }` |
| **Security** | Public endpoint | Public endpoint |
| **Roles** | Lấy từ database (AccountRole) | Lấy từ token (claim "roles") |
| **Token** | Generate token mới | Verify token có sẵn |

## 4. Vấn Đề

### Endpoint 1: /auth/outbound/authentication
- ✅ Hoạt động đúng
- ✅ Có lấy roles từ database
- ✅ Có generate token với roles

### Endpoint 2: /auth/introspect
- ✅ Hoạt động đúng
- ✅ Có extract roles từ token
- ✅ Có parse accountInfo

### Vấn Đề Chung:
- ❌ **Roles format không nhất quán**: Có thể là "USER" (uppercase) hoặc "user" (lowercase) tùy data trong database
- ❌ **@PreAuthorize yêu cầu**: "ADMIN" (uppercase, không có prefix ROLE_)
- ❌ **Cần map roles** từ token (có thể lowercase) → authorities (uppercase) trong Filter/Aspect

## 5. Kết Luận

### Cả 2 Endpoints:
- ✅ **Hoạt động đúng** - Có lấy và trả về roles
- ✅ **Public endpoints** - Không cần authentication
- ✅ **Trả về đầy đủ thông tin** - Token, roles, accountInfo

### Vấn Đề:
- ❌ **Roles format** - Có thể không match với @PreAuthorize requirements
- ❌ **Cần map roles** - Từ token format → authorities format (uppercase)

### Sử Dụng:
- **Frontend dùng `/auth/outbound/authentication`** để login và lấy token
- **Frontend dùng `/auth/introspect`** để verify token và lấy user info
- **Backend cần Filter/Aspect** để parse token và set Authentication cho các endpoints khác


## 1. POST /auth/outbound/authentication

### Mục Đích
Xác thực user thông qua OAuth2 (Google login), exchange authorization code để lấy JWT token.

### Request Format
```json
{
  "code": "4/0AeanS...",           // Authorization code từ Google OAuth
  "redirectUri": "http://localhost:3000/api/auth/callback/google"
}
```

### Flow Chi Tiết

**Step 1: Exchange Code for Access Token**
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
- Gọi Google OAuth API để exchange code → access token
- Sử dụng `OutBoundIdentityClient` (Feign Client)

**Step 2: Get User Info from Google**
```java
OutBoundUserInfoResponse userInfo = outBoundUserInfoClient.getUserInfo(
    "json", 
    tokenResponse.getAccessToken()
);
```
- Lấy thông tin user từ Google (email, name, picture, etc.)
- Sử dụng `OutBoundUserInfoClient` (Feign Client)

**Step 3: Find or Create Account**
```java
Account account = accountDomainService.findUserLoginByEmail(userInfo.getEmail())
    .orElseGet(() -> createNewAccountFromOAuth(userInfo));
```
- Tìm account trong database theo email
- Nếu không có → Tạo account mới với role "USER" mặc định

**Step 4: Get Roles for Account**
```java
List<AccountRole> accountRoles = accountRoleDomainService.findByFields(
    Map.of("accountId", account.getId())
);

List<String> roles = accountRoles.stream()
    .map(AccountRole::getRoleId)                    // Lấy roleId (là Role.name)
    .map(roleId -> roleDomainService.findById(roleId).orElse(null))  // Tìm Role
    .filter(Objects::nonNull)
    .map(Role::getName)                              // Lấy Role.getName()
    .collect(Collectors.toList());
```
- Lấy tất cả roles của account từ `AccountRole` table
- Convert `AccountRole.roleId` → `Role.name`

**Step 5: Generate JWT Token**
```java
String token = jwtProvider.generateToken(account, roles);
```
- Generate JWT token với:
  - `subject`: account email
  - `userId`: account ID
  - `roles`: List of role names (có thể là "USER", "ADMIN" hoặc "user", "admin" tùy data)
  - `scope`: "ROLE_USER ROLE_ADMIN" (với prefix ROLE_)
  - `accountInfo`: Account JSON string

**Step 6: Build Response**
```java
return AuthenticationResponse.builder()
    .token(token)
    .authenticated(true)
    .accountInfo(AccountInfoAuthenticateDTO.builder()
        .id(account.getId())
        .email(account.getEmail())
        .firstName(account.getFirstName())
        .lastName(account.getLastName())
        .avatarUrl(account.getAvatarUrl())
        .roleName(roles)  // ["USER", "ADMIN"] hoặc ["user", "admin"]
        .build())
    .build();
```

### Response Format
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "authenticated": true,
    "token": "eyJhbGciOiJIUzUxMiJ9...",
    "accountInfo": {
      "id": "1",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "avatarUrl": "https://...",
      "roleName": ["admin", "user"]  // Array of roles
    }
  }
}
```

### Security
- ✅ **Public endpoint** - Không cần authentication
- ✅ Trong `PUBLIC_ENDPOINTS` array
- ✅ `permitAll()` trong WebSecurityConfig

### ✅ Hoạt Động Đúng
- Có lấy roles từ AccountRole
- Có generate token với roles
- Có trả về accountInfo với roleName array

---

## 2. POST /auth/introspect

### Mục Đích
Verify JWT token và trả về thông tin user (roles, accountInfo) từ token.

### Request Format
```json
{
  "token": "eyJhbGciOiJIUzUxMiJ9..."
}
```

### Flow Chi Tiết

**Step 1: Verify Token**
```java
SignedJWT jwt = jwtProvider.verifyToken(token, false);
```
- Verify token signature và expiration time
- Check token có trong invalidated tokens table không
- Nếu invalid → `isValid = false`, `jwt = null`

**Step 2: Extract Claims from Token**
```java
// Extract accountId
String accountId = extractStringClaim(jwt, "userId");

// Extract username (subject = email)
String username = jwt.getPayload().toJSONObject().get("sub").toString();

// Extract roles
List<String> roles = extractRoles(jwt);  // Từ claim "roles"

// Parse accountInfo
AccountInfo accountInfo = parseAccountInfo(jwt);  // Từ claim "accountInfo"
```

**Step 3: Extract Roles**
```java
private List<String> extractRoles(SignedJWT jwt) {
    Object rolesClaim = jwt.getJWTClaimsSet().getClaim("roles");
    if (rolesClaim instanceof List<?> rawList) {
        List<String> result = new ArrayList<>();
        for (Object item : rawList) {
            if (item instanceof String) {
                result.add((String) item);  // ["USER", "ADMIN"] hoặc ["user", "admin"]
            }
        }
        return result;
    }
    return null;
}
```
- Extract roles từ token claim "roles"
- Trả về list of role names (có thể là uppercase hoặc lowercase tùy data)

**Step 4: Parse AccountInfo**
```java
private AccountInfo parseAccountInfo(SignedJWT jwt) {
    Object accountInfoClaim = jwt.getJWTClaimsSet().getClaim("accountInfo");
    if (accountInfoClaim instanceof String) {
        return objectMapper.readValue((String) accountInfoClaim, AccountInfo.class);
    } else {
        return objectMapper.convertValue(accountInfoClaim, AccountInfo.class);
    }
}
```
- Parse accountInfo từ token claim "accountInfo"
- AccountInfo có thể là JSON string hoặc object

**Step 5: Build Response**
```java
return IntrospectResponse.builder()
    .accountId(accountId)
    .valid(isValid)
    .username(username)  // email
    .roles(roles)        // ["USER", "ADMIN"] hoặc ["user", "admin"]
    .accountInfo(accountInfo)
    .build();
```

### Response Format
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "valid": true,
    "accountId": "1",
    "username": "user@example.com",
    "roles": ["admin", "user"],  // Array of roles từ token
    "accountInfo": {
      "id": "1",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "avatarUrl": "https://...",
      "roles": ["admin", "user"]  // Có thể có trong accountInfo
    }
  }
}
```

### Security
- ✅ **Public endpoint** - Không cần authentication
- ✅ Trong `PUBLIC_ENDPOINTS` array
- ✅ `permitAll()` trong WebSecurityConfig

### ✅ Hoạt Động Đúng
- Có verify token
- Có extract roles từ token
- Có parse accountInfo từ token
- Có trả về đầy đủ thông tin

---

## 3. So Sánh 2 Endpoints

| Aspect | /auth/outbound/authentication | /auth/introspect |
|--------|------------------------------|------------------|
| **Mục đích** | OAuth login, tạo token mới | Verify token, lấy thông tin từ token |
| **Input** | `{ code, redirectUri }` | `{ token }` |
| **Output** | `{ token, authenticated, accountInfo }` | `{ valid, accountId, username, roles, accountInfo }` |
| **Security** | Public endpoint | Public endpoint |
| **Roles** | Lấy từ database (AccountRole) | Lấy từ token (claim "roles") |
| **Token** | Generate token mới | Verify token có sẵn |

## 4. Vấn Đề

### Endpoint 1: /auth/outbound/authentication
- ✅ Hoạt động đúng
- ✅ Có lấy roles từ database
- ✅ Có generate token với roles

### Endpoint 2: /auth/introspect
- ✅ Hoạt động đúng
- ✅ Có extract roles từ token
- ✅ Có parse accountInfo

### Vấn Đề Chung:
- ❌ **Roles format không nhất quán**: Có thể là "USER" (uppercase) hoặc "user" (lowercase) tùy data trong database
- ❌ **@PreAuthorize yêu cầu**: "ADMIN" (uppercase, không có prefix ROLE_)
- ❌ **Cần map roles** từ token (có thể lowercase) → authorities (uppercase) trong Filter/Aspect

## 5. Kết Luận

### Cả 2 Endpoints:
- ✅ **Hoạt động đúng** - Có lấy và trả về roles
- ✅ **Public endpoints** - Không cần authentication
- ✅ **Trả về đầy đủ thông tin** - Token, roles, accountInfo

### Vấn Đề:
- ❌ **Roles format** - Có thể không match với @PreAuthorize requirements
- ❌ **Cần map roles** - Từ token format → authorities format (uppercase)

### Sử Dụng:
- **Frontend dùng `/auth/outbound/authentication`** để login và lấy token
- **Frontend dùng `/auth/introspect`** để verify token và lấy user info
- **Backend cần Filter/Aspect** để parse token và set Authentication cho các endpoints khác

