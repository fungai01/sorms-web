# Backend API Analysis - SORMS Backend

## Tổng quan

Backend sử dụng Spring Boot với Spring Security, JWT authentication, và RESTful API pattern.

## 1. Response Format

Tất cả API responses đều theo format chuẩn:

```json
{
  "responseCode": "S0000",  // ErrorCode key
  "message": "SUCCESS",      // ErrorCode value
  "data": <T>                // Response data (có thể là object, array, hoặc null)
}
```

### ApiResponse Structure
```java
public class ApiResponse<T> {
    private String responseCode;  // ErrorCode.getKey()
    private String message;       // ErrorCode.getValue()
    private T data;               // Response payload
}
```

### Error Codes
- `S0000`: SUCCESS
- `S0001`: SYSTEM_ERROR
- `S0003`: RESOURCE_NOT_FOUND
- `S0004`: INVALID_REQUEST
- `S0006`: UNAUTHORIZED
- `S0007`: FORBIDDEN
- `AU0001`: UNAUTHENTICATED
- Và nhiều error codes khác theo prefix (R, RT, SV, B, O, P, RL, U, ST, STT, QR)

## 2. Authentication & Authorization

### OAuth2 Flow (Google Login)

**Endpoint:** `POST /auth/outbound/authentication`

**Request:**
```json
{
  "code": "authorization_code_from_google",
  "redirectUri": "http://localhost:3000/auth/callback"
}
```

**Response:**
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "authenticated": true,
    "token": "jwt_token_string",
    "accountInfo": {
      "id": "account_id",
      "email": "user@example.com",
      "firstName": "First",
      "lastName": "Last",
      "avatarUrl": "https://...",
      "roleName": ["USER"]  // List<String> roles
    }
  }
}
```

**Backend Flow:**
1. Exchange authorization code với Google để lấy access token
2. Lấy user info từ Google API
3. Tìm hoặc tạo account trong database (tự động tạo nếu chưa có)
4. Lấy roles từ AccountRole table
5. Generate JWT token với roles
6. Trả về token và accountInfo

**Lưu ý:** Backend tự động tạo user với role "USER" nếu chưa tồn tại.

### Token Introspection

**Endpoint:** `POST /auth/introspect`

**Request:**
```json
{
  "token": "jwt_token_string"
}
```

**Response:**
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "valid": true,
    "accountId": "account_id",
    "username": "user@example.com",
    "roles": ["USER", "ADMIN"],  // List<String>
    "accountInfo": {
      "id": "account_id",
      "username": "user@example.com",
      "email": "user@example.com",
      "firstName": "First",
      "lastName": "Last",
      "dob": "1990-01-01",
      "address": "...",
      "phoneNumber": "...",
      "avatarUrl": "https://...",
      "roles": ["USER", "ADMIN"]  // List<String>
    }
  }
}
```

### JWT Token Structure

JWT token chứa các claims:
- `sub`: Email của user
- `userId`: Account ID
- `roles`: List<String> roles (ví dụ: ["USER", "ADMIN"])
- `scope`: "ROLE_USER ROLE_ADMIN" (space-separated)
- `accountInfo`: JSON string của Account object
- `exp`: Expiration time
- `iat`: Issued at time
- `jti`: JWT ID

### Authorization

Backend sử dụng `@PreAuthorize` annotations:

- `@PreAuthorize("hasAuthority('ADMIN')")` - Chỉ ADMIN
- `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")` - STAFF, MANAGER, hoặc ADMIN
- `@PreAuthorize("hasAuthority('USER')")` - Chỉ USER
- `@PreAuthorize("isAuthenticated()")` - Bất kỳ authenticated user nào

**Lưu ý:** Roles trong JWT phải có prefix "ROLE_" khi check authority (ví dụ: "ROLE_ADMIN", "ROLE_USER").

## 3. API Endpoints

### Rooms

**Base Path:** `/rooms`

**GET /rooms** - Get all rooms
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<List<RoomResponse>>`
- **Format:** `{ responseCode, message, data: [RoomResponse, ...] }`

**GET /rooms/{id}** - Get room by ID
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<RoomResponse>`

**GET /rooms/by-status/{status}** - Get rooms by status
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Status values:** AVAILABLE, OCCUPIED, MAINTENANCE, CLEANING, OUT_OF_SERVICE
- **Response:** `ApiResponse<List<RoomResponse>>`

**GET /rooms/by-room-type/{roomTypeId}** - Get rooms by room type
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<List<RoomResponse>>`

**POST /rooms** - Create room
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<RoomResponse>` (status 201)

**PUT /rooms/{id}** - Update room
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<RoomResponse>`

**DELETE /rooms/{id}** - Delete room
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<Void>`

### Room Types

**Base Path:** `/room-types`

**GET /room-types** - Get all room types
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<List<RoomTypeResponse>>`

**GET /room-types/{id}** - Get room type by ID
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<RoomTypeResponse>`

**POST /room-types** - Create room type
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<RoomTypeResponse>` (status 201)

**PUT /room-types/{id}** - Update room type
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<RoomTypeResponse>`

**DELETE /room-types/{id}** - Delete room type
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<Void>`

### Bookings

**Base Path:** `/bookings`

**GET /bookings** - Get all bookings
- **Auth:** Không yêu cầu (public)
- **Response:** `ApiResponse<List<BookingResponse>>`

**GET /bookings/{id}** - Get booking by ID
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<BookingResponse>`

**GET /bookings/by-status/{status}** - Get bookings by status
- **Auth:** Không yêu cầu (public)
- **Response:** `ApiResponse<List<BookingResponse>>`

**GET /bookings/by-user/{userId}** - Get bookings by user
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<List<BookingResponse>>`

**POST /bookings** - Create booking
- **Auth:** `hasAuthority('USER')`
- **Response:** `ApiResponse<BookingResponse>` (status 201)

**PUT /bookings/{id}** - Update booking
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<BookingResponse>`

**POST /bookings/{id}/approve** - Approve booking
- **Auth:** Không yêu cầu (public)
- **Response:** `ApiResponse<BookingApprovalResponse>`

**POST /bookings/{id}/checkin** - Check-in booking
- **Auth:** Không yêu cầu (public)
- **Request:** multipart/form-data với `user_id` và `face_image` (optional)
- **Response:** `ApiResponse<CheckinResponse>`

**DELETE /bookings/{id}** - Delete booking
- **Auth:** `hasAuthority('ADMIN')`
- **Response:** `ApiResponse<Void>`

### Services

**Base Path:** `/services`

**GET /services** - Get all services
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<List<ServiceResponse>>`

**GET /services/{id}** - Get service by ID
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<ServiceResponse>`

**POST /services** - Create service
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<ServiceResponse>` (status 201)

**PUT /services/{id}** - Update service
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<ServiceResponse>`

**DELETE /services/{id}** - Delete service
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<Void>`

### Orders

**Base Path:** `/orders`

**GET /orders/{orderId}** - Get order by ID
- **Auth:** `isAuthenticated()`
- **Response:** `ApiResponse<ServiceOrderResponse>`

**GET /orders/my-orders** - Get orders by booking
- **Auth:** `isAuthenticated()`
- **Query params:** `bookingId` (required)
- **Response:** `ApiResponse<List<ServiceOrderResponse>>`

**GET /orders/staff/{staffId}/tasks** - Get staff tasks
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Query params:** `status` (optional)
- **Response:** `ApiResponse<List<ServiceOrderResponse>>`

**POST /orders/cart** - Create order cart
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<ServiceOrderResponse>` (status 201)

**POST /orders/{orderId}/items** - Add item to order
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<ServiceOrderResponse>`

**POST /orders/{orderId}/confirm** - Confirm order
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<ServiceOrderResponse>`

**POST /orders/{orderId}/staff/confirm** - Staff confirm order
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<ServiceOrderResponse>`

**POST /orders/{orderId}/staff/reject** - Staff reject order
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<ServiceOrderResponse>`

### Payments

**Base Path:** `/payments`

**GET /payments/{transactionId}** - Get payment by ID
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<PaymentResponse>`

**POST /payments/create** - Create payment
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<PaymentResponse>` (status 201)

**POST /payments/webhook** - Payment webhook
- **Auth:** Không yêu cầu (public)
- **Response:** `ApiResponse<String>`

### Users

**Base Path:** `/users`

**GET /users/search** - Search users
- **Auth:** `hasAuthority('ADMIN')`
- **Query params:** `email`, `fullName`, `phoneNumber`, `idCardNumber`, `status`, `page` (default: 0), `size` (default: 10)
- **Response:** `ApiResponse<PageResponse<UserResponse>>`
- **Format:** `{ responseCode, message, data: { content: [...], page, size, totalElements, totalPages, ... } }`

**POST /users** - Create user
- **Auth:** `hasAuthority('ADMIN')`
- **Response:** `ApiResponse<UserResponse>` (status 201)

**PUT /users/{id}** - Update user
- **Auth:** `hasAuthority('ADMIN')`
- **Response:** `ApiResponse<UserResponse>`

**DELETE /users/{id}** - Delete user
- **Auth:** `hasAuthority('ADMIN')`
- **Response:** `ApiResponse<Void>`

**PUT /users/{id}/activate** - Activate user
- **Auth:** `hasAuthority('ADMIN')`
- **Response:** `ApiResponse<UserResponse>`

**PUT /users/{id}/deactivate** - Deactivate user
- **Auth:** `hasAuthority('ADMIN')`
- **Response:** `ApiResponse<UserResponse>`

### Staff Tasks

**Base Path:** `/staff-tasks`

**GET /staff-tasks** - Get all staff tasks
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<List<StaffTaskResponse>>`

**GET /staff-tasks/{id}** - Get staff task by ID
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<StaffTaskResponse>`

**GET /staff-tasks/by-assignee/{assignedTo}** - Get tasks by assignee
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<List<StaffTaskResponse>>`

**GET /staff-tasks/by-status** - Get tasks by status
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Query params:** `status` (required)
- **Response:** `ApiResponse<List<StaffTaskResponse>>`

## 4. Response Models

### RoomResponse
```java
{
  "id": Long,
  "code": String,
  "name": String,
  "roomTypeId": Long,
  "roomTypeCode": String,
  "roomTypeName": String,
  "floor": Integer,
  "status": RoomStatus,  // AVAILABLE, OCCUPIED, MAINTENANCE, CLEANING, OUT_OF_SERVICE
  "description": String,
  "createdDate": LocalDateTime,
  "lastModifiedDate": LocalDateTime
}
```

### RoomTypeResponse
```java
{
  "id": Long,
  "code": String,
  "name": String,
  "description": String,
  "basePrice": BigDecimal,
  "maxOccupancy": Integer,
  "createdDate": LocalDateTime,
  "lastModifiedDate": LocalDateTime
}
```

### PageResponse<T>
```java
{
  "content": List<T>,
  "page": int,
  "size": int,
  "totalElements": long,
  "totalPages": int,
  "first": boolean,
  "last": boolean,
  "hasNext": boolean,
  "hasPrevious": boolean
}
```

## 5. Security Configuration

### CORS
- `allowCredentials`: true
- `allowedOriginPattern`: "*" (all origins)
- `allowedMethods`: ALL
- `allowedHeaders`: ALL

### Public Endpoints
- `/auth/login`
- `/auth/logout`
- `/auth/introspect`
- `/auth/refresh`
- `/auth/outbound/authentication`
- `/auth/oauth2/google/redirect-url`
- `/auth/verify-account/**`
- `/internal/**`
- Swagger endpoints

### Session Management
- `SessionCreationPolicy.STATELESS` - Không sử dụng session, chỉ dùng JWT

## 6. Service Architecture

### Base Service Pattern

Tất cả services đều extend `AbstractAppService<T, K>`:
- `T`: Request type
- `K`: Response type
- `execute(T request)`: Abstract method để implement business logic
- `validate(T request)`: Tự động validate request nếu có validator

### Service Execution

`AppServiceExecution` sử dụng Map-based dependency injection:
- Map request class → service instance
- Tự động tìm và execute service tương ứng với request type
- Pattern: Command/Query separation

### Exception Handling

**GlobalExceptionHandler** xử lý tất cả exceptions:
- `AppException`: Business logic errors → trả về `ApiResponse` với `responseCode` và `message`
- `Exception`: System errors → trả về `SYSTEM_ERROR` (S0001)
- `AccessDeniedException`: Authorization errors → trả về `UNAUTHORIZED` (S0006)
- `MethodArgumentNotValidException`: Validation errors → trả về `INVALID_KEY` (S0002)

## 7. Important Notes

1. **List Responses:** Khi backend trả về `List<T>`, format là:
   ```json
   {
     "responseCode": "S0000",
     "message": "SUCCESS",
     "data": [item1, item2, ...]  // Array trực tiếp, KHÔNG phải { content: [...] }
   }
   ```
   **Ví dụ:** `/rooms`, `/room-types`, `/bookings`, `/services` đều trả về array trực tiếp.

2. **PageResponse:** Chỉ có ở `/users/search`, format là:
   ```json
   {
     "responseCode": "S0000",
     "message": "SUCCESS",
     "data": {
       "content": [...],
       "page": 0,
       "size": 10,
       "totalElements": 100,
       "totalPages": 10,
       "first": true,
       "last": false,
       "hasNext": true,
       "hasPrevious": false
     }
   }
   ```

3. **Authorization Header:** Tất cả authenticated requests phải có:
   ```
   Authorization: Bearer <jwt_token>
   ```

4. **Role Mapping:** 
   - Backend roles: `USER`, `STAFF`, `MANAGER`, `ADMIN`
   - JWT scope: `ROLE_USER`, `ROLE_STAFF`, `ROLE_MANAGER`, `ROLE_ADMIN` (prefix "ROLE_")
   - Spring Security checks: `hasAuthority('ADMIN')` → checks for "ROLE_ADMIN" in JWT scope
   - Frontend cần map: `admin`, `office`, `staff`, `user`

5. **OAuth User Creation:** 
   - Backend tự động tạo user với role "USER" khi login lần đầu với Google OAuth
   - Flow: Exchange code → Get user info → Find or create account → Assign USER role → Generate JWT
   - Account được tạo với: `isVerified=true`, `isActive=true`, `status=ACTIVE`

6. **Error Handling:** 
   - Tất cả errors đều trả về format `ApiResponse` với `responseCode` và `message` tương ứng
   - HTTP status code được map từ `ErrorCode.statusCode`
   - `data` field sẽ là `null` khi có error

7. **Token Management:**
   - JWT token có `jti` (JWT ID) để track và invalidate
   - Logout: Token được lưu vào `InvalidatedToken` table
   - Refresh token: Old token được invalidate, new token được generate
   - Token verification: Check signature, expiration, và invalidated status

8. **User Search:**
   - `/users/search` chỉ tìm users có role "USER" (không bao gồm STAFF, MANAGER, ADMIN)
   - Filter by: `email`, `fullName`, `phoneNumber`, `idCardNumber`, `status`
   - Pagination: `page` (default: 0), `size` (default: 10)
   - Returns `PageResponse<UserResponse>` với `content` array

9. **Service Pattern:**
   - Query services: Return data (read operations)
   - Command services: Modify data (write operations)
   - All services extend `AbstractAppService<Request, Response>`
   - Services are auto-registered via `AppServiceConfig`

10. **External Clients:**
    - `OutBoundIdentityClient`: Feign client để exchange OAuth code với Google
    - `OutBoundUserInfoClient`: Feign client để lấy user info từ Google API
    - Both use Spring Cloud OpenFeign


## Tổng quan

Backend sử dụng Spring Boot với Spring Security, JWT authentication, và RESTful API pattern.

## 1. Response Format

Tất cả API responses đều theo format chuẩn:

```json
{
  "responseCode": "S0000",  // ErrorCode key
  "message": "SUCCESS",      // ErrorCode value
  "data": <T>                // Response data (có thể là object, array, hoặc null)
}
```

### ApiResponse Structure
```java
public class ApiResponse<T> {
    private String responseCode;  // ErrorCode.getKey()
    private String message;       // ErrorCode.getValue()
    private T data;               // Response payload
}
```

### Error Codes
- `S0000`: SUCCESS
- `S0001`: SYSTEM_ERROR
- `S0003`: RESOURCE_NOT_FOUND
- `S0004`: INVALID_REQUEST
- `S0006`: UNAUTHORIZED
- `S0007`: FORBIDDEN
- `AU0001`: UNAUTHENTICATED
- Và nhiều error codes khác theo prefix (R, RT, SV, B, O, P, RL, U, ST, STT, QR)

## 2. Authentication & Authorization

### OAuth2 Flow (Google Login)

**Endpoint:** `POST /auth/outbound/authentication`

**Request:**
```json
{
  "code": "authorization_code_from_google",
  "redirectUri": "http://localhost:3000/auth/callback"
}
```

**Response:**
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "authenticated": true,
    "token": "jwt_token_string",
    "accountInfo": {
      "id": "account_id",
      "email": "user@example.com",
      "firstName": "First",
      "lastName": "Last",
      "avatarUrl": "https://...",
      "roleName": ["USER"]  // List<String> roles
    }
  }
}
```

**Backend Flow:**
1. Exchange authorization code với Google để lấy access token
2. Lấy user info từ Google API
3. Tìm hoặc tạo account trong database (tự động tạo nếu chưa có)
4. Lấy roles từ AccountRole table
5. Generate JWT token với roles
6. Trả về token và accountInfo

**Lưu ý:** Backend tự động tạo user với role "USER" nếu chưa tồn tại.

### Token Introspection

**Endpoint:** `POST /auth/introspect`

**Request:**
```json
{
  "token": "jwt_token_string"
}
```

**Response:**
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "valid": true,
    "accountId": "account_id",
    "username": "user@example.com",
    "roles": ["USER", "ADMIN"],  // List<String>
    "accountInfo": {
      "id": "account_id",
      "username": "user@example.com",
      "email": "user@example.com",
      "firstName": "First",
      "lastName": "Last",
      "dob": "1990-01-01",
      "address": "...",
      "phoneNumber": "...",
      "avatarUrl": "https://...",
      "roles": ["USER", "ADMIN"]  // List<String>
    }
  }
}
```

### JWT Token Structure

JWT token chứa các claims:
- `sub`: Email của user
- `userId`: Account ID
- `roles`: List<String> roles (ví dụ: ["USER", "ADMIN"])
- `scope`: "ROLE_USER ROLE_ADMIN" (space-separated)
- `accountInfo`: JSON string của Account object
- `exp`: Expiration time
- `iat`: Issued at time
- `jti`: JWT ID

### Authorization

Backend sử dụng `@PreAuthorize` annotations:

- `@PreAuthorize("hasAuthority('ADMIN')")` - Chỉ ADMIN
- `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")` - STAFF, MANAGER, hoặc ADMIN
- `@PreAuthorize("hasAuthority('USER')")` - Chỉ USER
- `@PreAuthorize("isAuthenticated()")` - Bất kỳ authenticated user nào

**Lưu ý:** Roles trong JWT phải có prefix "ROLE_" khi check authority (ví dụ: "ROLE_ADMIN", "ROLE_USER").

## 3. API Endpoints

### Rooms

**Base Path:** `/rooms`

**GET /rooms** - Get all rooms
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<List<RoomResponse>>`
- **Format:** `{ responseCode, message, data: [RoomResponse, ...] }`

**GET /rooms/{id}** - Get room by ID
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<RoomResponse>`

**GET /rooms/by-status/{status}** - Get rooms by status
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Status values:** AVAILABLE, OCCUPIED, MAINTENANCE, CLEANING, OUT_OF_SERVICE
- **Response:** `ApiResponse<List<RoomResponse>>`

**GET /rooms/by-room-type/{roomTypeId}** - Get rooms by room type
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<List<RoomResponse>>`

**POST /rooms** - Create room
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<RoomResponse>` (status 201)

**PUT /rooms/{id}** - Update room
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<RoomResponse>`

**DELETE /rooms/{id}** - Delete room
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<Void>`

### Room Types

**Base Path:** `/room-types`

**GET /room-types** - Get all room types
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<List<RoomTypeResponse>>`

**GET /room-types/{id}** - Get room type by ID
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<RoomTypeResponse>`

**POST /room-types** - Create room type
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<RoomTypeResponse>` (status 201)

**PUT /room-types/{id}** - Update room type
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<RoomTypeResponse>`

**DELETE /room-types/{id}** - Delete room type
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<Void>`

### Bookings

**Base Path:** `/bookings`

**GET /bookings** - Get all bookings
- **Auth:** Không yêu cầu (public)
- **Response:** `ApiResponse<List<BookingResponse>>`

**GET /bookings/{id}** - Get booking by ID
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<BookingResponse>`

**GET /bookings/by-status/{status}** - Get bookings by status
- **Auth:** Không yêu cầu (public)
- **Response:** `ApiResponse<List<BookingResponse>>`

**GET /bookings/by-user/{userId}** - Get bookings by user
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<List<BookingResponse>>`

**POST /bookings** - Create booking
- **Auth:** `hasAuthority('USER')`
- **Response:** `ApiResponse<BookingResponse>` (status 201)

**PUT /bookings/{id}** - Update booking
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<BookingResponse>`

**POST /bookings/{id}/approve** - Approve booking
- **Auth:** Không yêu cầu (public)
- **Response:** `ApiResponse<BookingApprovalResponse>`

**POST /bookings/{id}/checkin** - Check-in booking
- **Auth:** Không yêu cầu (public)
- **Request:** multipart/form-data với `user_id` và `face_image` (optional)
- **Response:** `ApiResponse<CheckinResponse>`

**DELETE /bookings/{id}** - Delete booking
- **Auth:** `hasAuthority('ADMIN')`
- **Response:** `ApiResponse<Void>`

### Services

**Base Path:** `/services`

**GET /services** - Get all services
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<List<ServiceResponse>>`

**GET /services/{id}** - Get service by ID
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<ServiceResponse>`

**POST /services** - Create service
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<ServiceResponse>` (status 201)

**PUT /services/{id}** - Update service
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<ServiceResponse>`

**DELETE /services/{id}** - Delete service
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<Void>`

### Orders

**Base Path:** `/orders`

**GET /orders/{orderId}** - Get order by ID
- **Auth:** `isAuthenticated()`
- **Response:** `ApiResponse<ServiceOrderResponse>`

**GET /orders/my-orders** - Get orders by booking
- **Auth:** `isAuthenticated()`
- **Query params:** `bookingId` (required)
- **Response:** `ApiResponse<List<ServiceOrderResponse>>`

**GET /orders/staff/{staffId}/tasks** - Get staff tasks
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Query params:** `status` (optional)
- **Response:** `ApiResponse<List<ServiceOrderResponse>>`

**POST /orders/cart** - Create order cart
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<ServiceOrderResponse>` (status 201)

**POST /orders/{orderId}/items** - Add item to order
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<ServiceOrderResponse>`

**POST /orders/{orderId}/confirm** - Confirm order
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<ServiceOrderResponse>`

**POST /orders/{orderId}/staff/confirm** - Staff confirm order
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<ServiceOrderResponse>`

**POST /orders/{orderId}/staff/reject** - Staff reject order
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<ServiceOrderResponse>`

### Payments

**Base Path:** `/payments`

**GET /payments/{transactionId}** - Get payment by ID
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<PaymentResponse>`

**POST /payments/create** - Create payment
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<PaymentResponse>` (status 201)

**POST /payments/webhook** - Payment webhook
- **Auth:** Không yêu cầu (public)
- **Response:** `ApiResponse<String>`

### Users

**Base Path:** `/users`

**GET /users/search** - Search users
- **Auth:** `hasAuthority('ADMIN')`
- **Query params:** `email`, `fullName`, `phoneNumber`, `idCardNumber`, `status`, `page` (default: 0), `size` (default: 10)
- **Response:** `ApiResponse<PageResponse<UserResponse>>`
- **Format:** `{ responseCode, message, data: { content: [...], page, size, totalElements, totalPages, ... } }`

**POST /users** - Create user
- **Auth:** `hasAuthority('ADMIN')`
- **Response:** `ApiResponse<UserResponse>` (status 201)

**PUT /users/{id}** - Update user
- **Auth:** `hasAuthority('ADMIN')`
- **Response:** `ApiResponse<UserResponse>`

**DELETE /users/{id}** - Delete user
- **Auth:** `hasAuthority('ADMIN')`
- **Response:** `ApiResponse<Void>`

**PUT /users/{id}/activate** - Activate user
- **Auth:** `hasAuthority('ADMIN')`
- **Response:** `ApiResponse<UserResponse>`

**PUT /users/{id}/deactivate** - Deactivate user
- **Auth:** `hasAuthority('ADMIN')`
- **Response:** `ApiResponse<UserResponse>`

### Staff Tasks

**Base Path:** `/staff-tasks`

**GET /staff-tasks** - Get all staff tasks
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<List<StaffTaskResponse>>`

**GET /staff-tasks/{id}** - Get staff task by ID
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<StaffTaskResponse>`

**GET /staff-tasks/by-assignee/{assignedTo}** - Get tasks by assignee
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Response:** `ApiResponse<List<StaffTaskResponse>>`

**GET /staff-tasks/by-status** - Get tasks by status
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Query params:** `status` (required)
- **Response:** `ApiResponse<List<StaffTaskResponse>>`

## 4. Response Models

### RoomResponse
```java
{
  "id": Long,
  "code": String,
  "name": String,
  "roomTypeId": Long,
  "roomTypeCode": String,
  "roomTypeName": String,
  "floor": Integer,
  "status": RoomStatus,  // AVAILABLE, OCCUPIED, MAINTENANCE, CLEANING, OUT_OF_SERVICE
  "description": String,
  "createdDate": LocalDateTime,
  "lastModifiedDate": LocalDateTime
}
```

### RoomTypeResponse
```java
{
  "id": Long,
  "code": String,
  "name": String,
  "description": String,
  "basePrice": BigDecimal,
  "maxOccupancy": Integer,
  "createdDate": LocalDateTime,
  "lastModifiedDate": LocalDateTime
}
```

### PageResponse<T>
```java
{
  "content": List<T>,
  "page": int,
  "size": int,
  "totalElements": long,
  "totalPages": int,
  "first": boolean,
  "last": boolean,
  "hasNext": boolean,
  "hasPrevious": boolean
}
```

## 5. Security Configuration

### CORS
- `allowCredentials`: true
- `allowedOriginPattern`: "*" (all origins)
- `allowedMethods`: ALL
- `allowedHeaders`: ALL

### Public Endpoints
- `/auth/login`
- `/auth/logout`
- `/auth/introspect`
- `/auth/refresh`
- `/auth/outbound/authentication`
- `/auth/oauth2/google/redirect-url`
- `/auth/verify-account/**`
- `/internal/**`
- Swagger endpoints

### Session Management
- `SessionCreationPolicy.STATELESS` - Không sử dụng session, chỉ dùng JWT

## 6. Service Architecture

### Base Service Pattern

Tất cả services đều extend `AbstractAppService<T, K>`:
- `T`: Request type
- `K`: Response type
- `execute(T request)`: Abstract method để implement business logic
- `validate(T request)`: Tự động validate request nếu có validator

### Service Execution

`AppServiceExecution` sử dụng Map-based dependency injection:
- Map request class → service instance
- Tự động tìm và execute service tương ứng với request type
- Pattern: Command/Query separation

### Exception Handling

**GlobalExceptionHandler** xử lý tất cả exceptions:
- `AppException`: Business logic errors → trả về `ApiResponse` với `responseCode` và `message`
- `Exception`: System errors → trả về `SYSTEM_ERROR` (S0001)
- `AccessDeniedException`: Authorization errors → trả về `UNAUTHORIZED` (S0006)
- `MethodArgumentNotValidException`: Validation errors → trả về `INVALID_KEY` (S0002)

## 7. Important Notes

1. **List Responses:** Khi backend trả về `List<T>`, format là:
   ```json
   {
     "responseCode": "S0000",
     "message": "SUCCESS",
     "data": [item1, item2, ...]  // Array trực tiếp, KHÔNG phải { content: [...] }
   }
   ```
   **Ví dụ:** `/rooms`, `/room-types`, `/bookings`, `/services` đều trả về array trực tiếp.

2. **PageResponse:** Chỉ có ở `/users/search`, format là:
   ```json
   {
     "responseCode": "S0000",
     "message": "SUCCESS",
     "data": {
       "content": [...],
       "page": 0,
       "size": 10,
       "totalElements": 100,
       "totalPages": 10,
       "first": true,
       "last": false,
       "hasNext": true,
       "hasPrevious": false
     }
   }
   ```

3. **Authorization Header:** Tất cả authenticated requests phải có:
   ```
   Authorization: Bearer <jwt_token>
   ```

4. **Role Mapping:** 
   - Backend roles: `USER`, `STAFF`, `MANAGER`, `ADMIN`
   - JWT scope: `ROLE_USER`, `ROLE_STAFF`, `ROLE_MANAGER`, `ROLE_ADMIN` (prefix "ROLE_")
   - Spring Security checks: `hasAuthority('ADMIN')` → checks for "ROLE_ADMIN" in JWT scope
   - Frontend cần map: `admin`, `office`, `staff`, `user`

5. **OAuth User Creation:** 
   - Backend tự động tạo user với role "USER" khi login lần đầu với Google OAuth
   - Flow: Exchange code → Get user info → Find or create account → Assign USER role → Generate JWT
   - Account được tạo với: `isVerified=true`, `isActive=true`, `status=ACTIVE`

6. **Error Handling:** 
   - Tất cả errors đều trả về format `ApiResponse` với `responseCode` và `message` tương ứng
   - HTTP status code được map từ `ErrorCode.statusCode`
   - `data` field sẽ là `null` khi có error

7. **Token Management:**
   - JWT token có `jti` (JWT ID) để track và invalidate
   - Logout: Token được lưu vào `InvalidatedToken` table
   - Refresh token: Old token được invalidate, new token được generate
   - Token verification: Check signature, expiration, và invalidated status

8. **User Search:**
   - `/users/search` chỉ tìm users có role "USER" (không bao gồm STAFF, MANAGER, ADMIN)
   - Filter by: `email`, `fullName`, `phoneNumber`, `idCardNumber`, `status`
   - Pagination: `page` (default: 0), `size` (default: 10)
   - Returns `PageResponse<UserResponse>` với `content` array

9. **Service Pattern:**
   - Query services: Return data (read operations)
   - Command services: Modify data (write operations)
   - All services extend `AbstractAppService<Request, Response>`
   - Services are auto-registered via `AppServiceConfig`

10. **External Clients:**
    - `OutBoundIdentityClient`: Feign client để exchange OAuth code với Google
    - `OutBoundUserInfoClient`: Feign client để lấy user info từ Google API
    - Both use Spring Cloud OpenFeign

