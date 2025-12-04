# Backend Authentication Endpoints Analysis

## AuthenticationController Endpoints

### 1. Public Endpoints (Không cần authentication)

#### `GET /auth/oauth2/google/redirect-url`
- **Mục đích**: Lấy Google OAuth2 redirect URL
- **Request**: Query params: `redirectUri`, `scope` (optional)
- **Response**: `{ redirectUrl: "https://accounts.google.com/o/oauth2/v2/auth?..." }`
- **Authorization**: ❌ Không cần

#### `POST /auth/outbound/authentication`
- **Mục đích**: OAuth2 authentication (Web)
- **Request Body**: `{ code: string, redirectUri: string }`
- **Response**: `{ authenticated: true, token: string, accountInfo: {...} }`
- **Authorization**: ❌ Không cần
- **Note**: Tự động tạo user nếu chưa tồn tại

#### `POST /auth/mobile/outbound/authentication`
- **Mục đích**: OAuth2 authentication (Mobile)
- **Request Body**: `{ idToken: string, platform: string }`
- **Response**: `{ authenticated: true, token: string, accountInfo: {...} }`
- **Authorization**: ❌ Không cần
- **Note**: Verify Google ID token trước khi tạo JWT

#### `POST /auth/login`
- **Mục đích**: Traditional login với email/password
- **Request Body**: `{ username: string, password: string }`
- **Response**: `{ authenticated: true, token: string, accountInfo: {...} }`
- **Authorization**: ❌ Không cần

#### `POST /auth/introspect`
- **Mục đích**: Verify JWT token và lấy thông tin từ token
- **Request Body**: `{ token: string }`
- **Response**: 
  ```json
  {
    "valid": true,
    "accountId": "string",
    "username": "string",
    "roles": ["admin", "user"],
    "accountInfo": {...}
  }
  ```
- **Authorization**: ❌ Không cần
- **Note**: Đây là endpoint để verify token, KHÔNG phải filter tự động

#### `POST /auth/refresh`
- **Mục đích**: Refresh JWT token
- **Request Body**: `{ token: string }`
- **Response**: `{ authenticated: true, token: string, accountInfo: {...} }`
- **Authorization**: ❌ Không cần

#### `POST /auth/logout`
- **Mục đích**: Logout và invalidate token
- **Request Body**: `{ token: string }`
- **Response**: `{ success: true }`
- **Authorization**: ❌ Không cần

#### `POST /auth/verify-account/send-code`
- **Mục đích**: Gửi verification code qua email
- **Request Body**: `{ email: string }`
- **Response**: `{ success: true }`
- **Authorization**: ❌ Không cần

#### `POST /auth/verify-account/check-code`
- **Mục đích**: Verify account bằng code
- **Request Body**: `{ email: string, code: string }`
- **Response**: `{ verified: true }`
- **Authorization**: ❌ Không cần

## WebSecurityConfig Configuration

### Public Endpoints List
```java
private static final String[] PUBLIC_ENDPOINTS = {
    "/auth/login",
    "/auth/logout",
    "/auth/introspect",
    "/auth/refresh",
    "/accounts/registration",
    "auth/outbound/authentication",  // ⚠️ Thiếu dấu "/" ở đầu
    "/auth/verify-account/check-code",
    "/auth/verify-account/send-code",
    "/auth/oauth2/google/redirect-url",
    "/auth/mobile/outbound/authentication",
    "/internal/**"
};
```

### Security Configuration
```java
.authorizeHttpRequests(auth ->
    auth.requestMatchers("/**").permitAll()  // ⚠️ Cho phép TẤT CẢ
        .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
        .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
        .anyRequest().authenticated()
)
```

**Phát hiện quan trọng:**
- ✅ Tất cả `/auth/*` endpoints đều là PUBLIC (không cần authentication)
- ⚠️ `auth.requestMatchers("/**").permitAll()` cho phép TẤT CẢ requests
- ❌ **KHÔNG CÓ JWT Filter** để tự động parse token từ Authorization header
- ❌ **KHÔNG CÓ** cơ chế để set Authentication vào SecurityContext

## Protected Endpoints (Cần authentication)

### RoomController
- **Base Path**: `/rooms`
- **Authorization**: `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`
- **Endpoints**:
  - `GET /rooms` - Get all rooms
  - `GET /rooms/{id}` - Get room by ID
  - `POST /rooms` - Create room
  - `PUT /rooms/{id}` - Update room
  - `DELETE /rooms/{id}` - Delete room
  - `GET /rooms/by-status/{status}` - Get rooms by status
  - `GET /rooms/by-room-type/{roomTypeId}` - Get rooms by room type

### RoomTypeController
- **Base Path**: `/room-types`
- **Authorization**: `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`
- **Endpoints**:
  - `GET /room-types` - Get all room types
  - `GET /room-types/{id}` - Get room type by ID
  - `POST /room-types` - Create room type
  - `PUT /room-types/{id}` - Update room type
  - `DELETE /room-types/{id}` - Delete room type

## Vấn Đề Phát Hiện

### 1. Không có JWT Filter
- Backend **KHÔNG CÓ** filter để tự động parse JWT token từ `Authorization: Bearer <token>` header
- Backend **KHÔNG CÓ** cơ chế để set Authentication vào SecurityContext
- Khi `@PreAuthorize` được kiểm tra, SecurityContext không có Authentication → **FAIL**

### 2. Endpoint `/auth/introspect` không phải filter
- Endpoint này chỉ để verify token khi được gọi **thủ công**
- Không tự động verify token cho các protected endpoints
- Frontend phải gọi endpoint này trước, nhưng vẫn không giải quyết vấn đề `@PreAuthorize`

### 3. `permitAll()` nhưng vẫn check `@PreAuthorize`
- `WebSecurityConfig` có `permitAll()` cho tất cả requests
- Nhưng `@PreAuthorize` vẫn được kiểm tra bởi Spring Security's method security
- Nếu SecurityContext không có Authentication, `@PreAuthorize` sẽ fail

## Flow Hiện Tại

### Frontend Flow:
1. User login → Gọi `/auth/outbound/authentication`
2. Nhận JWT token → Lưu vào localStorage/cookie
3. Gọi protected API (ví dụ: `GET /rooms`) → Gửi `Authorization: Bearer <token>`
4. ❌ **Backend không parse token** → SecurityContext không có Authentication
5. ❌ `@PreAuthorize` fail → Trả về `SYSTEM_ERROR`

### Backend Flow:
1. Request đến → `WebSecurityConfig.permitAll()` → Cho phép request
2. Request đến Controller → `@PreAuthorize` được kiểm tra
3. ❌ SecurityContext không có Authentication → `@PreAuthorize` fail
4. Exception được throw → `GlobalExceptionHandler` catch
5. Trả về `{"responseCode":"S0001","message":"SYSTEM_ERROR","data":null}`

## Giải Pháp Cần Thiết

### Backend cần thêm:
1. **JWT Filter** để tự động parse token từ Authorization header
2. **Map roles** từ token (lowercase) sang authorities (uppercase)
3. **Set Authentication** vào SecurityContext với authorities đúng

### Frontend đã làm đúng:
- ✅ Gửi `Authorization: Bearer <token>` header
- ✅ Token có đầy đủ thông tin (roles, scope, accountInfo)
- ✅ Next.js API routes forward header đúng cách

## Kết Luận

**Backend thiếu hoàn toàn JWT Filter** để tự động parse token và set Authentication. Điều này khiến `@PreAuthorize` không thể hoạt động đúng, dẫn đến lỗi `SYSTEM_ERROR` cho tất cả protected endpoints.

**Frontend không thể giải quyết vấn đề này** vì vấn đề nằm ở backend's security configuration. Backend cần thêm JWT Filter để parse token và set Authentication vào SecurityContext.


## AuthenticationController Endpoints

### 1. Public Endpoints (Không cần authentication)

#### `GET /auth/oauth2/google/redirect-url`
- **Mục đích**: Lấy Google OAuth2 redirect URL
- **Request**: Query params: `redirectUri`, `scope` (optional)
- **Response**: `{ redirectUrl: "https://accounts.google.com/o/oauth2/v2/auth?..." }`
- **Authorization**: ❌ Không cần

#### `POST /auth/outbound/authentication`
- **Mục đích**: OAuth2 authentication (Web)
- **Request Body**: `{ code: string, redirectUri: string }`
- **Response**: `{ authenticated: true, token: string, accountInfo: {...} }`
- **Authorization**: ❌ Không cần
- **Note**: Tự động tạo user nếu chưa tồn tại

#### `POST /auth/mobile/outbound/authentication`
- **Mục đích**: OAuth2 authentication (Mobile)
- **Request Body**: `{ idToken: string, platform: string }`
- **Response**: `{ authenticated: true, token: string, accountInfo: {...} }`
- **Authorization**: ❌ Không cần
- **Note**: Verify Google ID token trước khi tạo JWT

#### `POST /auth/login`
- **Mục đích**: Traditional login với email/password
- **Request Body**: `{ username: string, password: string }`
- **Response**: `{ authenticated: true, token: string, accountInfo: {...} }`
- **Authorization**: ❌ Không cần

#### `POST /auth/introspect`
- **Mục đích**: Verify JWT token và lấy thông tin từ token
- **Request Body**: `{ token: string }`
- **Response**: 
  ```json
  {
    "valid": true,
    "accountId": "string",
    "username": "string",
    "roles": ["admin", "user"],
    "accountInfo": {...}
  }
  ```
- **Authorization**: ❌ Không cần
- **Note**: Đây là endpoint để verify token, KHÔNG phải filter tự động

#### `POST /auth/refresh`
- **Mục đích**: Refresh JWT token
- **Request Body**: `{ token: string }`
- **Response**: `{ authenticated: true, token: string, accountInfo: {...} }`
- **Authorization**: ❌ Không cần

#### `POST /auth/logout`
- **Mục đích**: Logout và invalidate token
- **Request Body**: `{ token: string }`
- **Response**: `{ success: true }`
- **Authorization**: ❌ Không cần

#### `POST /auth/verify-account/send-code`
- **Mục đích**: Gửi verification code qua email
- **Request Body**: `{ email: string }`
- **Response**: `{ success: true }`
- **Authorization**: ❌ Không cần

#### `POST /auth/verify-account/check-code`
- **Mục đích**: Verify account bằng code
- **Request Body**: `{ email: string, code: string }`
- **Response**: `{ verified: true }`
- **Authorization**: ❌ Không cần

## WebSecurityConfig Configuration

### Public Endpoints List
```java
private static final String[] PUBLIC_ENDPOINTS = {
    "/auth/login",
    "/auth/logout",
    "/auth/introspect",
    "/auth/refresh",
    "/accounts/registration",
    "auth/outbound/authentication",  // ⚠️ Thiếu dấu "/" ở đầu
    "/auth/verify-account/check-code",
    "/auth/verify-account/send-code",
    "/auth/oauth2/google/redirect-url",
    "/auth/mobile/outbound/authentication",
    "/internal/**"
};
```

### Security Configuration
```java
.authorizeHttpRequests(auth ->
    auth.requestMatchers("/**").permitAll()  // ⚠️ Cho phép TẤT CẢ
        .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
        .requestMatchers(ENDPOINTS_SWAGGER).permitAll()
        .anyRequest().authenticated()
)
```

**Phát hiện quan trọng:**
- ✅ Tất cả `/auth/*` endpoints đều là PUBLIC (không cần authentication)
- ⚠️ `auth.requestMatchers("/**").permitAll()` cho phép TẤT CẢ requests
- ❌ **KHÔNG CÓ JWT Filter** để tự động parse token từ Authorization header
- ❌ **KHÔNG CÓ** cơ chế để set Authentication vào SecurityContext

## Protected Endpoints (Cần authentication)

### RoomController
- **Base Path**: `/rooms`
- **Authorization**: `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`
- **Endpoints**:
  - `GET /rooms` - Get all rooms
  - `GET /rooms/{id}` - Get room by ID
  - `POST /rooms` - Create room
  - `PUT /rooms/{id}` - Update room
  - `DELETE /rooms/{id}` - Delete room
  - `GET /rooms/by-status/{status}` - Get rooms by status
  - `GET /rooms/by-room-type/{roomTypeId}` - Get rooms by room type

### RoomTypeController
- **Base Path**: `/room-types`
- **Authorization**: `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`
- **Endpoints**:
  - `GET /room-types` - Get all room types
  - `GET /room-types/{id}` - Get room type by ID
  - `POST /room-types` - Create room type
  - `PUT /room-types/{id}` - Update room type
  - `DELETE /room-types/{id}` - Delete room type

## Vấn Đề Phát Hiện

### 1. Không có JWT Filter
- Backend **KHÔNG CÓ** filter để tự động parse JWT token từ `Authorization: Bearer <token>` header
- Backend **KHÔNG CÓ** cơ chế để set Authentication vào SecurityContext
- Khi `@PreAuthorize` được kiểm tra, SecurityContext không có Authentication → **FAIL**

### 2. Endpoint `/auth/introspect` không phải filter
- Endpoint này chỉ để verify token khi được gọi **thủ công**
- Không tự động verify token cho các protected endpoints
- Frontend phải gọi endpoint này trước, nhưng vẫn không giải quyết vấn đề `@PreAuthorize`

### 3. `permitAll()` nhưng vẫn check `@PreAuthorize`
- `WebSecurityConfig` có `permitAll()` cho tất cả requests
- Nhưng `@PreAuthorize` vẫn được kiểm tra bởi Spring Security's method security
- Nếu SecurityContext không có Authentication, `@PreAuthorize` sẽ fail

## Flow Hiện Tại

### Frontend Flow:
1. User login → Gọi `/auth/outbound/authentication`
2. Nhận JWT token → Lưu vào localStorage/cookie
3. Gọi protected API (ví dụ: `GET /rooms`) → Gửi `Authorization: Bearer <token>`
4. ❌ **Backend không parse token** → SecurityContext không có Authentication
5. ❌ `@PreAuthorize` fail → Trả về `SYSTEM_ERROR`

### Backend Flow:
1. Request đến → `WebSecurityConfig.permitAll()` → Cho phép request
2. Request đến Controller → `@PreAuthorize` được kiểm tra
3. ❌ SecurityContext không có Authentication → `@PreAuthorize` fail
4. Exception được throw → `GlobalExceptionHandler` catch
5. Trả về `{"responseCode":"S0001","message":"SYSTEM_ERROR","data":null}`

## Giải Pháp Cần Thiết

### Backend cần thêm:
1. **JWT Filter** để tự động parse token từ Authorization header
2. **Map roles** từ token (lowercase) sang authorities (uppercase)
3. **Set Authentication** vào SecurityContext với authorities đúng

### Frontend đã làm đúng:
- ✅ Gửi `Authorization: Bearer <token>` header
- ✅ Token có đầy đủ thông tin (roles, scope, accountInfo)
- ✅ Next.js API routes forward header đúng cách

## Kết Luận

**Backend thiếu hoàn toàn JWT Filter** để tự động parse token và set Authentication. Điều này khiến `@PreAuthorize` không thể hoạt động đúng, dẫn đến lỗi `SYSTEM_ERROR` cho tất cả protected endpoints.

**Frontend không thể giải quyết vấn đề này** vì vấn đề nằm ở backend's security configuration. Backend cần thêm JWT Filter để parse token và set Authentication vào SecurityContext.

