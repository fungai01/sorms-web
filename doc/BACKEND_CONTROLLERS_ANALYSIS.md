# Backend Controllers Analysis - SORMS Backend

## Tổng quan

Backend có 10 controllers chính, được tổ chức theo domain:
- `auth`: Authentication & Authorization
- `ai`: AI Face Recognition
- `booking`: Booking Management
- `identity`: User, Role, Staff Management
- `masterdata`: Rooms, Room Types
- `order`: Service Orders
- `payment`: Payment Processing

---

## 1. AuthenticationController

**Base Path:** `/auth`

**Authorization:** Public (không yêu cầu authentication)

### Endpoints

#### GET `/auth/oauth2/google/redirect-url`
- **Purpose:** Generate Google OAuth2 redirect URL
- **Query Params:** 
  - `redirectUri` (required)
  - `scope` (default: "openid email profile")
- **Response:** `ApiResponse<OAuth2RedirectUrlResponse>`
- **Usage:** Frontend gọi để lấy Google OAuth URL

#### POST `/auth/outbound/authentication`
- **Purpose:** OAuth2 authentication với Google
- **Request:** `OutboundAuthenticateRequest { code, redirectUri }`
- **Response:** `ApiResponse<AuthenticationResponse>`
- **Flow:** Exchange code → Get user info → Create/find account → Generate JWT

#### POST `/auth/login`
- **Purpose:** Traditional username/password login
- **Request:** `AuthenticationRequest { username, password }`
- **Response:** `ApiResponse<AuthenticationResponse>`
- **Auth:** Public

#### POST `/auth/introspect`
- **Purpose:** Verify và parse JWT token
- **Request:** `IntrospectRequest { token }`
- **Response:** `ApiResponse<IntrospectResponse>`
- **Auth:** Public

#### POST `/auth/logout`
- **Purpose:** Invalidate JWT token
- **Request:** `LogoutRequest { token }`
- **Response:** `ApiResponse<Void>`
- **Auth:** Public

#### POST `/auth/refresh`
- **Purpose:** Refresh JWT token
- **Request:** `RefreshTokenRequest { token }`
- **Response:** `ApiResponse<AuthenticationResponse>`
- **Auth:** Public

#### POST `/auth/verify-account/check-code`
- **Purpose:** Verify account với code từ email
- **Request:** `VerifyAccountByCodeRequest`
- **Response:** `ApiResponse<VerifyAccountByCodeResponse>`
- **Auth:** Public

#### POST `/auth/verify-account/send-code`
- **Purpose:** Gửi verification code đến email
- **Request:** `SendCodeVerifyAccountRequest`
- **Response:** `ApiResponse<Void>`
- **Auth:** Public

#### POST `/auth/mobile/outbound/authentication`
- **Purpose:** Mobile OAuth2 authentication
- **Request:** `MobileOutboundAuthenticateRequest`
- **Response:** `ApiResponse<AuthenticationResponse>`
- **Auth:** Public

---

## 2. AIRecognitionController

**Base Path:** `/ai/recognition`

**Authorization:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`

### Endpoints

#### POST `/ai/recognition/face/register`
- **Purpose:** Đăng ký face images cho user
- **Content-Type:** `multipart/form-data`
- **Params:** 
  - `student_id` (String) - User ID
  - `images` (List<MultipartFile>) - 3-5 face images
- **Response:** `ApiResponse<Object>`
- **Note:** Class ID được hardcode là "1" trong service layer

#### GET `/ai/recognition/faces`
- **Purpose:** Lấy tất cả users đã đăng ký face recognition
- **Response:** `ApiResponse<Object>` (GetAllUsersResponse)

#### GET `/ai/recognition/faces/{id}`
- **Purpose:** Lấy thông tin user theo ID
- **Path:** `id` (String) - User ID
- **Response:** `ApiResponse<Object>`

#### PUT `/ai/recognition/faces/{id}`
- **Purpose:** Cập nhật face images cho user
- **Content-Type:** `multipart/form-data`
- **Path:** `id` (String) - User ID
- **Params:** `images` (List<MultipartFile>) - 3-5 face images mới
- **Response:** `ApiResponse<Object>`

#### DELETE `/ai/recognition/faces/{id}`
- **Purpose:** Xóa user khỏi face recognition system
- **Path:** `id` (String) - User ID
- **Response:** `ApiResponse<Object>`

**Lưu ý:** Controller này không có endpoint check-in. Check-in được xử lý trong BookingController.

---

## 3. BookingController

**Base Path:** `/bookings`

**Authorization:** Mixed (một số endpoints public, một số yêu cầu auth)

### Endpoints

#### POST `/bookings`
- **Purpose:** Tạo booking mới
- **Auth:** `hasAuthority('USER')`
- **Request:** `CreateBookingRequest`
- **Response:** `ApiResponse<BookingResponse>` (status 201)

#### GET `/bookings`
- **Purpose:** Lấy tất cả bookings
- **Auth:** Public (không yêu cầu)
- **Response:** `ApiResponse<List<BookingResponse>>`

#### GET `/bookings/{id}`
- **Purpose:** Lấy booking theo ID
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Path:** `id` (Long)
- **Response:** `ApiResponse<BookingResponse>`

#### GET `/bookings/by-status/{status}`
- **Purpose:** Lấy bookings theo status
- **Auth:** Public
- **Path:** `status` (BookingStatus enum)
- **Response:** `ApiResponse<List<BookingResponse>>`

#### GET `/bookings/by-user/{userId}`
- **Purpose:** Lấy bookings của user cụ thể
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Path:** `userId` (Long)
- **Response:** `ApiResponse<List<BookingResponse>>`

#### PUT `/bookings/{id}`
- **Purpose:** Cập nhật booking
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Path:** `id` (Long)
- **Request:** `UpdateBookingRequest`
- **Response:** `ApiResponse<BookingResponse>`

#### DELETE `/bookings/{id}`
- **Purpose:** Xóa booking
- **Auth:** `hasAuthority('ADMIN')`
- **Path:** `id` (Long)
- **Response:** `ApiResponse<Void>`

#### POST `/bookings/{id}/approve`
- **Purpose:** Approve booking
- **Auth:** Public
- **Path:** `id` (Long)
- **Request:** `ApproveBookingRequest`
- **Response:** `ApiResponse<BookingApprovalResponse>`

#### POST `/bookings/{id}/checkin`
- **Purpose:** Check-in booking với face recognition
- **Auth:** Public
- **Content-Type:** `multipart/form-data`
- **Path:** `id` (Long) - Booking ID
- **Params:** 
  - `user_id` (String) - User ID
  - `face_image` (MultipartFile, optional) - Face image để nhận diện
- **Response:** `ApiResponse<CheckinResponse>`

---

## 4. RoomController

**Base Path:** `/rooms`

**Authorization:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`

### Endpoints

#### GET `/rooms`
- **Purpose:** Lấy tất cả rooms
- **Response:** `ApiResponse<List<RoomResponse>>`

#### GET `/rooms/{id}`
- **Purpose:** Lấy room theo ID
- **Path:** `id` (Long)
- **Response:** `ApiResponse<RoomResponse>`

#### GET `/rooms/by-status/{status}`
- **Purpose:** Lấy rooms theo status
- **Path:** `status` (RoomStatus enum: AVAILABLE, OCCUPIED, MAINTENANCE, CLEANING, OUT_OF_SERVICE)
- **Response:** `ApiResponse<List<RoomResponse>>`

#### GET `/rooms/by-room-type/{roomTypeId}`
- **Purpose:** Lấy rooms theo room type
- **Path:** `roomTypeId` (Long)
- **Response:** `ApiResponse<List<RoomResponse>>`

#### POST `/rooms`
- **Purpose:** Tạo room mới
- **Request:** `CreateRoomRequest`
- **Response:** `ApiResponse<RoomResponse>` (status 201)

#### PUT `/rooms/{id}`
- **Purpose:** Cập nhật room
- **Path:** `id` (Long)
- **Request:** `UpdateRoomRequest`
- **Response:** `ApiResponse<RoomResponse>`

#### DELETE `/rooms/{id}`
- **Purpose:** Xóa room
- **Path:** `id` (Long)
- **Response:** `ApiResponse<Void>`

---

## 5. RoomTypeController

**Base Path:** `/room-types`

**Authorization:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`

### Endpoints

#### GET `/room-types`
- **Purpose:** Lấy tất cả room types
- **Response:** `ApiResponse<List<RoomTypeResponse>>`

#### GET `/room-types/{id}`
- **Purpose:** Lấy room type theo ID
- **Path:** `id` (Long)
- **Response:** `ApiResponse<RoomTypeResponse>`

#### POST `/room-types`
- **Purpose:** Tạo room type mới
- **Request:** `CreateRoomTypeRequest`
- **Response:** `ApiResponse<RoomTypeResponse>` (status 201)

#### PUT `/room-types/{id}`
- **Purpose:** Cập nhật room type
- **Path:** `id` (Long)
- **Request:** `UpdateRoomTypeRequest`
- **Response:** `ApiResponse<RoomTypeResponse>`

#### DELETE `/room-types/{id}`
- **Purpose:** Xóa room type
- **Path:** `id` (Long)
- **Response:** `ApiResponse<Void>`

---

## 6. ServiceController

**Base Path:** `/services`

**Authorization:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`

### Endpoints

#### GET `/services`
- **Purpose:** Lấy tất cả services
- **Response:** `ApiResponse<List<ServiceResponse>>`

#### GET `/services/{id}`
- **Purpose:** Lấy service theo ID
- **Path:** `id` (Long)
- **Response:** `ApiResponse<ServiceResponse>`

#### POST `/services`
- **Purpose:** Tạo service mới
- **Request:** `CreateServiceRequest`
- **Response:** `ApiResponse<ServiceResponse>` (status 201)

#### PUT `/services/{id}`
- **Purpose:** Cập nhật service
- **Path:** `id` (Long)
- **Request:** `UpdateServiceRequest`
- **Response:** `ApiResponse<ServiceResponse>`

#### DELETE `/services/{id}`
- **Purpose:** Xóa service
- **Path:** `id` (Long)
- **Response:** `ApiResponse<Void>`

---

## 7. OrderController

**Base Path:** `/orders`

**Authorization:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')` (class-level)

### Cart-Based Workflow Endpoints

#### POST `/orders/cart`
- **Purpose:** Tạo order cart (PENDING status)
- **Request:** `CreateOrderCartRequest`
- **Response:** `ApiResponse<ServiceOrderResponse>` (status 201)

#### POST `/orders/{orderId}/items`
- **Purpose:** Thêm item vào cart
- **Path:** `orderId` (Long)
- **Request:** `AddOrderItemRequest`
- **Response:** `ApiResponse<ServiceOrderResponse>`

#### PUT `/orders/{orderId}/items/{itemId}`
- **Purpose:** Cập nhật quantity của item
- **Path:** `orderId` (Long), `itemId` (Long)
- **Request:** `UpdateOrderItemRequest`
- **Response:** `ApiResponse<ServiceOrderResponse>`

#### DELETE `/orders/{orderId}/items/{itemId}`
- **Purpose:** Xóa item khỏi cart
- **Path:** `orderId` (Long), `itemId` (Long)
- **Response:** `ApiResponse<ServiceOrderResponse>`

#### POST `/orders/{orderId}/confirm`
- **Purpose:** Confirm order (PENDING → CONFIRMED)
- **Path:** `orderId` (Long)
- **Request:** `ConfirmOrderRequest`
- **Response:** `ApiResponse<ServiceOrderResponse>`

#### POST `/orders/{orderId}/cancel`
- **Purpose:** Cancel order
- **Path:** `orderId` (Long)
- **Response:** `ApiResponse<ServiceOrderResponse>`

### Service-Based Workflow Endpoints

#### POST `/orders/service`
- **Purpose:** Tạo service order với staff confirmation workflow
- **Request:** `CreateServiceOrderRequest`
- **Response:** `ApiResponse<ServiceOrderResponse>` (status 201)
- **Note:** Status: PENDING_STAFF_CONFIRMATION, requires staff assignment

#### POST `/orders/{orderId}/staff/confirm`
- **Purpose:** Staff confirm order (PENDING_STAFF_CONFIRMATION → PENDING_PAYMENT)
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Path:** `orderId` (Long)
- **Request:** `StaffConfirmOrderRequest`
- **Response:** `ApiResponse<ServiceOrderResponse>`

#### POST `/orders/{orderId}/staff/reject`
- **Purpose:** Staff reject order (PENDING_STAFF_CONFIRMATION → REJECTED)
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Path:** `orderId` (Long)
- **Request:** `StaffRejectOrderRequest`
- **Response:** `ApiResponse<ServiceOrderResponse>`

### Query Endpoints

#### GET `/orders/{orderId}`
- **Purpose:** Lấy order theo ID
- **Auth:** `isAuthenticated()`
- **Path:** `orderId` (Long)
- **Response:** `ApiResponse<ServiceOrderResponse>`

#### GET `/orders/my-orders`
- **Purpose:** Lấy orders của booking
- **Auth:** `isAuthenticated()`
- **Query:** `bookingId` (Long, required)
- **Response:** `ApiResponse<List<ServiceOrderResponse>>`

#### GET `/orders/staff/{staffId}/tasks`
- **Purpose:** Lấy tasks của staff
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Path:** `staffId` (Long)
- **Query:** `status` (String, optional) - Filter by status
- **Response:** `ApiResponse<List<ServiceOrderResponse>>`

#### GET `/orders/staff/{staffId}/tasks/{orderId}`
- **Purpose:** Lấy chi tiết task của staff
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Path:** `staffId` (Long), `orderId` (Long)
- **Response:** `ApiResponse<ServiceOrderResponse>`

---

## 8. PaymentController

**Base Path:** `/payments`

**Authorization:** Mixed

### Endpoints

#### POST `/payments/create`
- **Purpose:** Tạo payment transaction và lấy PayOS checkout URL
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Request:** `CreatePaymentRequest` (validated)
- **Response:** `ApiResponse<PaymentResponse>` (status 201)

#### POST `/payments/webhook`
- **Purpose:** Xử lý webhook từ PayOS
- **Auth:** Public
- **Request:** `Object` (raw webhook data)
- **Response:** `ApiResponse<String>`
- **Note:** Verify webhook signature với PayOS SDK

#### GET `/payments/{transactionId}`
- **Purpose:** Lấy payment transaction theo ID
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Path:** `transactionId` (Long)
- **Response:** `ApiResponse<PaymentResponse>`

---

## 9. UserManagementController

**Base Path:** `/users`

**Authorization:** `hasAuthority('ADMIN')` (class-level)

### Endpoints

#### GET `/users/search`
- **Purpose:** Search users với filters và pagination
- **Query Params:**
  - `email` (String, optional)
  - `fullName` (String, optional)
  - `phoneNumber` (String, optional)
  - `idCardNumber` (String, optional)
  - `status` (String, optional)
  - `page` (Integer, default: 0)
  - `size` (Integer, default: 10)
- **Response:** `ApiResponse<PageResponse<UserResponse>>`
- **Note:** Chỉ tìm users có role "USER", không bao gồm STAFF/MANAGER/ADMIN

#### POST `/users`
- **Purpose:** Tạo user mới
- **Request:** `CreateUserRequest`
- **Response:** `ApiResponse<UserResponse>` (status 201)

#### PUT `/users/{id}`
- **Purpose:** Cập nhật user
- **Path:** `id` (String)
- **Request:** `UpdateUserRequest`
- **Response:** `ApiResponse<UserResponse>`

#### DELETE `/users/{id}`
- **Purpose:** Xóa user
- **Path:** `id` (String)
- **Response:** `ApiResponse<Void>`

#### PUT `/users/{id}/activate`
- **Purpose:** Activate user
- **Path:** `id` (String)
- **Response:** `ApiResponse<UserResponse>`

#### PUT `/users/{id}/deactivate`
- **Purpose:** Deactivate user
- **Path:** `id` (String)
- **Response:** `ApiResponse<UserResponse>`

---

## 10. RoleController

**Base Path:** `/roles`

**Authorization:** `hasAuthority('ADMIN')` (class-level)

### Endpoints

#### GET `/roles/search`
- **Purpose:** Search roles với filters và pagination
- **Query Params:**
  - `name` (String, optional)
  - `code` (String, optional)
  - `description` (String, optional)
  - `isActive` (Boolean, optional)
  - `page` (Integer, default: 0)
  - `size` (Integer, default: 10)
- **Response:** `ApiResponse<PageResponse<RoleResponse>>`

#### GET `/roles/{id}`
- **Purpose:** Lấy role theo ID
- **Path:** `id` (String)
- **Response:** `ApiResponse<RoleResponse>`

#### POST `/roles`
- **Purpose:** Tạo role mới
- **Request:** `CreateRoleRequest`
- **Response:** `ApiResponse<RoleResponse>` (status 201)

#### PUT `/roles/{id}`
- **Purpose:** Cập nhật role
- **Path:** `id` (String)
- **Request:** `UpdateRoleRequest`
- **Response:** `ApiResponse<RoleResponse>`

#### DELETE `/roles/{id}`
- **Purpose:** Xóa role
- **Path:** `id` (String)
- **Response:** `ApiResponse<Void>`

#### PUT `/roles/{id}/activate`
- **Purpose:** Activate role
- **Path:** `id` (String)
- **Response:** `ApiResponse<RoleResponse>`

#### PUT `/roles/{id}/deactivate`
- **Purpose:** Deactivate role
- **Path:** `id` (String)
- **Response:** `ApiResponse<RoleResponse>`

---

## 11. StaffManagementController & StaffProfileController

**Base Path:** `/staff-profiles`

**Lưu ý:** Có 2 controllers với cùng base path:
- `StaffManagementController`: Không có `@PreAuthorize` (public?)
- `StaffProfileController`: `hasAnyAuthority('MANAGER', 'ADMIN')`

**Có thể là duplicate hoặc một trong hai không được sử dụng.**

### Endpoints (từ StaffProfileController)

#### GET `/staff-profiles`
- **Purpose:** Lấy tất cả staff profiles
- **Response:** `ApiResponse<List<StaffProfileResponse>>`

#### GET `/staff-profiles/{id}`
- **Purpose:** Lấy staff profile theo ID
- **Path:** `id` (Long)
- **Response:** `ApiResponse<StaffProfileResponse>`

#### GET `/staff-profiles/by-department/{department}`
- **Purpose:** Lấy staff profiles theo department
- **Path:** `department` (String)
- **Response:** `ApiResponse<List<StaffProfileResponse>>`

#### GET `/staff-profiles/by-status`
- **Purpose:** Lấy staff profiles theo status
- **Query:** `isActive` (Boolean, required)
- **Response:** `ApiResponse<List<StaffProfileResponse>>`

#### POST `/staff-profiles`
- **Purpose:** Tạo staff profile mới
- **Request:** `CreateStaffProfileRequest`
- **Response:** `ApiResponse<StaffProfileResponse>` (status 201)

#### PUT `/staff-profiles/{id}`
- **Purpose:** Cập nhật staff profile
- **Path:** `id` (Long)
- **Request:** `UpdateStaffProfileRequest`
- **Response:** `ApiResponse<StaffProfileResponse>`

#### DELETE `/staff-profiles/{id}`
- **Purpose:** Xóa staff profile
- **Path:** `id` (Long)
- **Response:** `ApiResponse<Void>`

---

## 12. StaffTaskController

**Base Path:** `/staff-tasks`

**Authorization:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')` (class-level)

### Endpoints

#### GET `/staff-tasks`
- **Purpose:** Lấy tất cả staff tasks
- **Response:** `ApiResponse<List<StaffTaskResponse>>`

#### GET `/staff-tasks/{id}`
- **Purpose:** Lấy staff task theo ID
- **Path:** `id` (Long)
- **Response:** `ApiResponse<StaffTaskResponse>`

#### GET `/staff-tasks/by-assignee/{assignedTo}`
- **Purpose:** Lấy tasks theo assignee
- **Path:** `assignedTo` (Long) - Staff ID
- **Response:** `ApiResponse<List<StaffTaskResponse>>`

#### GET `/staff-tasks/by-status`
- **Purpose:** Lấy tasks theo status
- **Query:** `status` (TaskStatus enum, required)
- **Response:** `ApiResponse<List<StaffTaskResponse>>`

#### GET `/staff-tasks/by-related`
- **Purpose:** Lấy tasks theo related entity
- **Query:** 
  - `relatedType` (RelatedType enum, required)
  - `relatedId` (Long, required)
- **Response:** `ApiResponse<List<StaffTaskResponse>>`

#### POST `/staff-tasks`
- **Purpose:** Tạo staff task mới
- **Request:** `CreateStaffTaskRequest`
- **Response:** `ApiResponse<StaffTaskResponse>` (status 201)

#### PUT `/staff-tasks/{id}`
- **Purpose:** Cập nhật staff task
- **Path:** `id` (Long)
- **Request:** `UpdateStaffTaskRequest`
- **Response:** `ApiResponse<StaffTaskResponse>`

#### DELETE `/staff-tasks/{id}`
- **Purpose:** Xóa staff task
- **Path:** `id` (Long)
- **Response:** `ApiResponse<Void>`

---

## Important Notes

### Authorization Patterns

1. **Public Endpoints:** Không có `@PreAuthorize` hoặc có nhưng không yêu cầu auth
   - Authentication endpoints
   - Một số booking endpoints (GET all, by-status, approve, checkin)

2. **Role-Based Authorization:**
   - `hasAuthority('ADMIN')`: Chỉ ADMIN
   - `hasAuthority('USER')`: Chỉ USER
   - `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`: STAFF, MANAGER, hoặc ADMIN
   - `isAuthenticated()`: Bất kỳ authenticated user nào

3. **Method-Level vs Class-Level:**
   - Class-level `@PreAuthorize` áp dụng cho tất cả methods
   - Method-level `@PreAuthorize` override class-level

### Response Formats

- **List Responses:** `ApiResponse<List<T>>` - `data` là array trực tiếp
- **PageResponse:** Chỉ có ở `/users/search` và `/roles/search` - `data.content` là array
- **Single Object:** `ApiResponse<T>` - `data` là object
- **Void:** `ApiResponse<Void>` - `data` là `null`

### HTTP Status Codes

- **200 OK:** GET, PUT, DELETE thành công
- **201 Created:** POST thành công (create operations)
- **400 Bad Request:** Validation errors
- **401 Unauthorized:** Authentication required
- **403 Forbidden:** Authorization failed
- **404 Not Found:** Resource not found
- **500 Internal Server Error:** System errors

### Duplicate Controllers

**StaffManagementController vs StaffProfileController:**
- Cả hai đều có base path `/staff-profiles`
- Có thể là duplicate hoặc một trong hai không được sử dụng
- Cần kiểm tra xem controller nào đang được sử dụng

### Order Workflows

**Cart-Based Workflow:**
- Multi-item orders
- Items được thêm riêng lẻ
- Không yêu cầu staff assignment
- Status: PENDING → CONFIRMED

**Service-Based Workflow:**
- Single-item orders
- Yêu cầu staff assignment ngay từ đầu
- Status: PENDING_STAFF_CONFIRMATION → PENDING_PAYMENT → COMPLETED/REJECTED
- Staff phải confirm/reject trước khi payment


## Tổng quan

Backend có 10 controllers chính, được tổ chức theo domain:
- `auth`: Authentication & Authorization
- `ai`: AI Face Recognition
- `booking`: Booking Management
- `identity`: User, Role, Staff Management
- `masterdata`: Rooms, Room Types
- `order`: Service Orders
- `payment`: Payment Processing

---

## 1. AuthenticationController

**Base Path:** `/auth`

**Authorization:** Public (không yêu cầu authentication)

### Endpoints

#### GET `/auth/oauth2/google/redirect-url`
- **Purpose:** Generate Google OAuth2 redirect URL
- **Query Params:** 
  - `redirectUri` (required)
  - `scope` (default: "openid email profile")
- **Response:** `ApiResponse<OAuth2RedirectUrlResponse>`
- **Usage:** Frontend gọi để lấy Google OAuth URL

#### POST `/auth/outbound/authentication`
- **Purpose:** OAuth2 authentication với Google
- **Request:** `OutboundAuthenticateRequest { code, redirectUri }`
- **Response:** `ApiResponse<AuthenticationResponse>`
- **Flow:** Exchange code → Get user info → Create/find account → Generate JWT

#### POST `/auth/login`
- **Purpose:** Traditional username/password login
- **Request:** `AuthenticationRequest { username, password }`
- **Response:** `ApiResponse<AuthenticationResponse>`
- **Auth:** Public

#### POST `/auth/introspect`
- **Purpose:** Verify và parse JWT token
- **Request:** `IntrospectRequest { token }`
- **Response:** `ApiResponse<IntrospectResponse>`
- **Auth:** Public

#### POST `/auth/logout`
- **Purpose:** Invalidate JWT token
- **Request:** `LogoutRequest { token }`
- **Response:** `ApiResponse<Void>`
- **Auth:** Public

#### POST `/auth/refresh`
- **Purpose:** Refresh JWT token
- **Request:** `RefreshTokenRequest { token }`
- **Response:** `ApiResponse<AuthenticationResponse>`
- **Auth:** Public

#### POST `/auth/verify-account/check-code`
- **Purpose:** Verify account với code từ email
- **Request:** `VerifyAccountByCodeRequest`
- **Response:** `ApiResponse<VerifyAccountByCodeResponse>`
- **Auth:** Public

#### POST `/auth/verify-account/send-code`
- **Purpose:** Gửi verification code đến email
- **Request:** `SendCodeVerifyAccountRequest`
- **Response:** `ApiResponse<Void>`
- **Auth:** Public

#### POST `/auth/mobile/outbound/authentication`
- **Purpose:** Mobile OAuth2 authentication
- **Request:** `MobileOutboundAuthenticateRequest`
- **Response:** `ApiResponse<AuthenticationResponse>`
- **Auth:** Public

---

## 2. AIRecognitionController

**Base Path:** `/ai/recognition`

**Authorization:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`

### Endpoints

#### POST `/ai/recognition/face/register`
- **Purpose:** Đăng ký face images cho user
- **Content-Type:** `multipart/form-data`
- **Params:** 
  - `student_id` (String) - User ID
  - `images` (List<MultipartFile>) - 3-5 face images
- **Response:** `ApiResponse<Object>`
- **Note:** Class ID được hardcode là "1" trong service layer

#### GET `/ai/recognition/faces`
- **Purpose:** Lấy tất cả users đã đăng ký face recognition
- **Response:** `ApiResponse<Object>` (GetAllUsersResponse)

#### GET `/ai/recognition/faces/{id}`
- **Purpose:** Lấy thông tin user theo ID
- **Path:** `id` (String) - User ID
- **Response:** `ApiResponse<Object>`

#### PUT `/ai/recognition/faces/{id}`
- **Purpose:** Cập nhật face images cho user
- **Content-Type:** `multipart/form-data`
- **Path:** `id` (String) - User ID
- **Params:** `images` (List<MultipartFile>) - 3-5 face images mới
- **Response:** `ApiResponse<Object>`

#### DELETE `/ai/recognition/faces/{id}`
- **Purpose:** Xóa user khỏi face recognition system
- **Path:** `id` (String) - User ID
- **Response:** `ApiResponse<Object>`

**Lưu ý:** Controller này không có endpoint check-in. Check-in được xử lý trong BookingController.

---

## 3. BookingController

**Base Path:** `/bookings`

**Authorization:** Mixed (một số endpoints public, một số yêu cầu auth)

### Endpoints

#### POST `/bookings`
- **Purpose:** Tạo booking mới
- **Auth:** `hasAuthority('USER')`
- **Request:** `CreateBookingRequest`
- **Response:** `ApiResponse<BookingResponse>` (status 201)

#### GET `/bookings`
- **Purpose:** Lấy tất cả bookings
- **Auth:** Public (không yêu cầu)
- **Response:** `ApiResponse<List<BookingResponse>>`

#### GET `/bookings/{id}`
- **Purpose:** Lấy booking theo ID
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Path:** `id` (Long)
- **Response:** `ApiResponse<BookingResponse>`

#### GET `/bookings/by-status/{status}`
- **Purpose:** Lấy bookings theo status
- **Auth:** Public
- **Path:** `status` (BookingStatus enum)
- **Response:** `ApiResponse<List<BookingResponse>>`

#### GET `/bookings/by-user/{userId}`
- **Purpose:** Lấy bookings của user cụ thể
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Path:** `userId` (Long)
- **Response:** `ApiResponse<List<BookingResponse>>`

#### PUT `/bookings/{id}`
- **Purpose:** Cập nhật booking
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Path:** `id` (Long)
- **Request:** `UpdateBookingRequest`
- **Response:** `ApiResponse<BookingResponse>`

#### DELETE `/bookings/{id}`
- **Purpose:** Xóa booking
- **Auth:** `hasAuthority('ADMIN')`
- **Path:** `id` (Long)
- **Response:** `ApiResponse<Void>`

#### POST `/bookings/{id}/approve`
- **Purpose:** Approve booking
- **Auth:** Public
- **Path:** `id` (Long)
- **Request:** `ApproveBookingRequest`
- **Response:** `ApiResponse<BookingApprovalResponse>`

#### POST `/bookings/{id}/checkin`
- **Purpose:** Check-in booking với face recognition
- **Auth:** Public
- **Content-Type:** `multipart/form-data`
- **Path:** `id` (Long) - Booking ID
- **Params:** 
  - `user_id` (String) - User ID
  - `face_image` (MultipartFile, optional) - Face image để nhận diện
- **Response:** `ApiResponse<CheckinResponse>`

---

## 4. RoomController

**Base Path:** `/rooms`

**Authorization:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`

### Endpoints

#### GET `/rooms`
- **Purpose:** Lấy tất cả rooms
- **Response:** `ApiResponse<List<RoomResponse>>`

#### GET `/rooms/{id}`
- **Purpose:** Lấy room theo ID
- **Path:** `id` (Long)
- **Response:** `ApiResponse<RoomResponse>`

#### GET `/rooms/by-status/{status}`
- **Purpose:** Lấy rooms theo status
- **Path:** `status` (RoomStatus enum: AVAILABLE, OCCUPIED, MAINTENANCE, CLEANING, OUT_OF_SERVICE)
- **Response:** `ApiResponse<List<RoomResponse>>`

#### GET `/rooms/by-room-type/{roomTypeId}`
- **Purpose:** Lấy rooms theo room type
- **Path:** `roomTypeId` (Long)
- **Response:** `ApiResponse<List<RoomResponse>>`

#### POST `/rooms`
- **Purpose:** Tạo room mới
- **Request:** `CreateRoomRequest`
- **Response:** `ApiResponse<RoomResponse>` (status 201)

#### PUT `/rooms/{id}`
- **Purpose:** Cập nhật room
- **Path:** `id` (Long)
- **Request:** `UpdateRoomRequest`
- **Response:** `ApiResponse<RoomResponse>`

#### DELETE `/rooms/{id}`
- **Purpose:** Xóa room
- **Path:** `id` (Long)
- **Response:** `ApiResponse<Void>`

---

## 5. RoomTypeController

**Base Path:** `/room-types`

**Authorization:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`

### Endpoints

#### GET `/room-types`
- **Purpose:** Lấy tất cả room types
- **Response:** `ApiResponse<List<RoomTypeResponse>>`

#### GET `/room-types/{id}`
- **Purpose:** Lấy room type theo ID
- **Path:** `id` (Long)
- **Response:** `ApiResponse<RoomTypeResponse>`

#### POST `/room-types`
- **Purpose:** Tạo room type mới
- **Request:** `CreateRoomTypeRequest`
- **Response:** `ApiResponse<RoomTypeResponse>` (status 201)

#### PUT `/room-types/{id}`
- **Purpose:** Cập nhật room type
- **Path:** `id` (Long)
- **Request:** `UpdateRoomTypeRequest`
- **Response:** `ApiResponse<RoomTypeResponse>`

#### DELETE `/room-types/{id}`
- **Purpose:** Xóa room type
- **Path:** `id` (Long)
- **Response:** `ApiResponse<Void>`

---

## 6. ServiceController

**Base Path:** `/services`

**Authorization:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`

### Endpoints

#### GET `/services`
- **Purpose:** Lấy tất cả services
- **Response:** `ApiResponse<List<ServiceResponse>>`

#### GET `/services/{id}`
- **Purpose:** Lấy service theo ID
- **Path:** `id` (Long)
- **Response:** `ApiResponse<ServiceResponse>`

#### POST `/services`
- **Purpose:** Tạo service mới
- **Request:** `CreateServiceRequest`
- **Response:** `ApiResponse<ServiceResponse>` (status 201)

#### PUT `/services/{id}`
- **Purpose:** Cập nhật service
- **Path:** `id` (Long)
- **Request:** `UpdateServiceRequest`
- **Response:** `ApiResponse<ServiceResponse>`

#### DELETE `/services/{id}`
- **Purpose:** Xóa service
- **Path:** `id` (Long)
- **Response:** `ApiResponse<Void>`

---

## 7. OrderController

**Base Path:** `/orders`

**Authorization:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')` (class-level)

### Cart-Based Workflow Endpoints

#### POST `/orders/cart`
- **Purpose:** Tạo order cart (PENDING status)
- **Request:** `CreateOrderCartRequest`
- **Response:** `ApiResponse<ServiceOrderResponse>` (status 201)

#### POST `/orders/{orderId}/items`
- **Purpose:** Thêm item vào cart
- **Path:** `orderId` (Long)
- **Request:** `AddOrderItemRequest`
- **Response:** `ApiResponse<ServiceOrderResponse>`

#### PUT `/orders/{orderId}/items/{itemId}`
- **Purpose:** Cập nhật quantity của item
- **Path:** `orderId` (Long), `itemId` (Long)
- **Request:** `UpdateOrderItemRequest`
- **Response:** `ApiResponse<ServiceOrderResponse>`

#### DELETE `/orders/{orderId}/items/{itemId}`
- **Purpose:** Xóa item khỏi cart
- **Path:** `orderId` (Long), `itemId` (Long)
- **Response:** `ApiResponse<ServiceOrderResponse>`

#### POST `/orders/{orderId}/confirm`
- **Purpose:** Confirm order (PENDING → CONFIRMED)
- **Path:** `orderId` (Long)
- **Request:** `ConfirmOrderRequest`
- **Response:** `ApiResponse<ServiceOrderResponse>`

#### POST `/orders/{orderId}/cancel`
- **Purpose:** Cancel order
- **Path:** `orderId` (Long)
- **Response:** `ApiResponse<ServiceOrderResponse>`

### Service-Based Workflow Endpoints

#### POST `/orders/service`
- **Purpose:** Tạo service order với staff confirmation workflow
- **Request:** `CreateServiceOrderRequest`
- **Response:** `ApiResponse<ServiceOrderResponse>` (status 201)
- **Note:** Status: PENDING_STAFF_CONFIRMATION, requires staff assignment

#### POST `/orders/{orderId}/staff/confirm`
- **Purpose:** Staff confirm order (PENDING_STAFF_CONFIRMATION → PENDING_PAYMENT)
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Path:** `orderId` (Long)
- **Request:** `StaffConfirmOrderRequest`
- **Response:** `ApiResponse<ServiceOrderResponse>`

#### POST `/orders/{orderId}/staff/reject`
- **Purpose:** Staff reject order (PENDING_STAFF_CONFIRMATION → REJECTED)
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Path:** `orderId` (Long)
- **Request:** `StaffRejectOrderRequest`
- **Response:** `ApiResponse<ServiceOrderResponse>`

### Query Endpoints

#### GET `/orders/{orderId}`
- **Purpose:** Lấy order theo ID
- **Auth:** `isAuthenticated()`
- **Path:** `orderId` (Long)
- **Response:** `ApiResponse<ServiceOrderResponse>`

#### GET `/orders/my-orders`
- **Purpose:** Lấy orders của booking
- **Auth:** `isAuthenticated()`
- **Query:** `bookingId` (Long, required)
- **Response:** `ApiResponse<List<ServiceOrderResponse>>`

#### GET `/orders/staff/{staffId}/tasks`
- **Purpose:** Lấy tasks của staff
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Path:** `staffId` (Long)
- **Query:** `status` (String, optional) - Filter by status
- **Response:** `ApiResponse<List<ServiceOrderResponse>>`

#### GET `/orders/staff/{staffId}/tasks/{orderId}`
- **Purpose:** Lấy chi tiết task của staff
- **Auth:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`
- **Path:** `staffId` (Long), `orderId` (Long)
- **Response:** `ApiResponse<ServiceOrderResponse>`

---

## 8. PaymentController

**Base Path:** `/payments`

**Authorization:** Mixed

### Endpoints

#### POST `/payments/create`
- **Purpose:** Tạo payment transaction và lấy PayOS checkout URL
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Request:** `CreatePaymentRequest` (validated)
- **Response:** `ApiResponse<PaymentResponse>` (status 201)

#### POST `/payments/webhook`
- **Purpose:** Xử lý webhook từ PayOS
- **Auth:** Public
- **Request:** `Object` (raw webhook data)
- **Response:** `ApiResponse<String>`
- **Note:** Verify webhook signature với PayOS SDK

#### GET `/payments/{transactionId}`
- **Purpose:** Lấy payment transaction theo ID
- **Auth:** `hasAnyAuthority('USER', 'STAFF', 'MANAGER', 'ADMIN')`
- **Path:** `transactionId` (Long)
- **Response:** `ApiResponse<PaymentResponse>`

---

## 9. UserManagementController

**Base Path:** `/users`

**Authorization:** `hasAuthority('ADMIN')` (class-level)

### Endpoints

#### GET `/users/search`
- **Purpose:** Search users với filters và pagination
- **Query Params:**
  - `email` (String, optional)
  - `fullName` (String, optional)
  - `phoneNumber` (String, optional)
  - `idCardNumber` (String, optional)
  - `status` (String, optional)
  - `page` (Integer, default: 0)
  - `size` (Integer, default: 10)
- **Response:** `ApiResponse<PageResponse<UserResponse>>`
- **Note:** Chỉ tìm users có role "USER", không bao gồm STAFF/MANAGER/ADMIN

#### POST `/users`
- **Purpose:** Tạo user mới
- **Request:** `CreateUserRequest`
- **Response:** `ApiResponse<UserResponse>` (status 201)

#### PUT `/users/{id}`
- **Purpose:** Cập nhật user
- **Path:** `id` (String)
- **Request:** `UpdateUserRequest`
- **Response:** `ApiResponse<UserResponse>`

#### DELETE `/users/{id}`
- **Purpose:** Xóa user
- **Path:** `id` (String)
- **Response:** `ApiResponse<Void>`

#### PUT `/users/{id}/activate`
- **Purpose:** Activate user
- **Path:** `id` (String)
- **Response:** `ApiResponse<UserResponse>`

#### PUT `/users/{id}/deactivate`
- **Purpose:** Deactivate user
- **Path:** `id` (String)
- **Response:** `ApiResponse<UserResponse>`

---

## 10. RoleController

**Base Path:** `/roles`

**Authorization:** `hasAuthority('ADMIN')` (class-level)

### Endpoints

#### GET `/roles/search`
- **Purpose:** Search roles với filters và pagination
- **Query Params:**
  - `name` (String, optional)
  - `code` (String, optional)
  - `description` (String, optional)
  - `isActive` (Boolean, optional)
  - `page` (Integer, default: 0)
  - `size` (Integer, default: 10)
- **Response:** `ApiResponse<PageResponse<RoleResponse>>`

#### GET `/roles/{id}`
- **Purpose:** Lấy role theo ID
- **Path:** `id` (String)
- **Response:** `ApiResponse<RoleResponse>`

#### POST `/roles`
- **Purpose:** Tạo role mới
- **Request:** `CreateRoleRequest`
- **Response:** `ApiResponse<RoleResponse>` (status 201)

#### PUT `/roles/{id}`
- **Purpose:** Cập nhật role
- **Path:** `id` (String)
- **Request:** `UpdateRoleRequest`
- **Response:** `ApiResponse<RoleResponse>`

#### DELETE `/roles/{id}`
- **Purpose:** Xóa role
- **Path:** `id` (String)
- **Response:** `ApiResponse<Void>`

#### PUT `/roles/{id}/activate`
- **Purpose:** Activate role
- **Path:** `id` (String)
- **Response:** `ApiResponse<RoleResponse>`

#### PUT `/roles/{id}/deactivate`
- **Purpose:** Deactivate role
- **Path:** `id` (String)
- **Response:** `ApiResponse<RoleResponse>`

---

## 11. StaffManagementController & StaffProfileController

**Base Path:** `/staff-profiles`

**Lưu ý:** Có 2 controllers với cùng base path:
- `StaffManagementController`: Không có `@PreAuthorize` (public?)
- `StaffProfileController`: `hasAnyAuthority('MANAGER', 'ADMIN')`

**Có thể là duplicate hoặc một trong hai không được sử dụng.**

### Endpoints (từ StaffProfileController)

#### GET `/staff-profiles`
- **Purpose:** Lấy tất cả staff profiles
- **Response:** `ApiResponse<List<StaffProfileResponse>>`

#### GET `/staff-profiles/{id}`
- **Purpose:** Lấy staff profile theo ID
- **Path:** `id` (Long)
- **Response:** `ApiResponse<StaffProfileResponse>`

#### GET `/staff-profiles/by-department/{department}`
- **Purpose:** Lấy staff profiles theo department
- **Path:** `department` (String)
- **Response:** `ApiResponse<List<StaffProfileResponse>>`

#### GET `/staff-profiles/by-status`
- **Purpose:** Lấy staff profiles theo status
- **Query:** `isActive` (Boolean, required)
- **Response:** `ApiResponse<List<StaffProfileResponse>>`

#### POST `/staff-profiles`
- **Purpose:** Tạo staff profile mới
- **Request:** `CreateStaffProfileRequest`
- **Response:** `ApiResponse<StaffProfileResponse>` (status 201)

#### PUT `/staff-profiles/{id}`
- **Purpose:** Cập nhật staff profile
- **Path:** `id` (Long)
- **Request:** `UpdateStaffProfileRequest`
- **Response:** `ApiResponse<StaffProfileResponse>`

#### DELETE `/staff-profiles/{id}`
- **Purpose:** Xóa staff profile
- **Path:** `id` (Long)
- **Response:** `ApiResponse<Void>`

---

## 12. StaffTaskController

**Base Path:** `/staff-tasks`

**Authorization:** `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')` (class-level)

### Endpoints

#### GET `/staff-tasks`
- **Purpose:** Lấy tất cả staff tasks
- **Response:** `ApiResponse<List<StaffTaskResponse>>`

#### GET `/staff-tasks/{id}`
- **Purpose:** Lấy staff task theo ID
- **Path:** `id` (Long)
- **Response:** `ApiResponse<StaffTaskResponse>`

#### GET `/staff-tasks/by-assignee/{assignedTo}`
- **Purpose:** Lấy tasks theo assignee
- **Path:** `assignedTo` (Long) - Staff ID
- **Response:** `ApiResponse<List<StaffTaskResponse>>`

#### GET `/staff-tasks/by-status`
- **Purpose:** Lấy tasks theo status
- **Query:** `status` (TaskStatus enum, required)
- **Response:** `ApiResponse<List<StaffTaskResponse>>`

#### GET `/staff-tasks/by-related`
- **Purpose:** Lấy tasks theo related entity
- **Query:** 
  - `relatedType` (RelatedType enum, required)
  - `relatedId` (Long, required)
- **Response:** `ApiResponse<List<StaffTaskResponse>>`

#### POST `/staff-tasks`
- **Purpose:** Tạo staff task mới
- **Request:** `CreateStaffTaskRequest`
- **Response:** `ApiResponse<StaffTaskResponse>` (status 201)

#### PUT `/staff-tasks/{id}`
- **Purpose:** Cập nhật staff task
- **Path:** `id` (Long)
- **Request:** `UpdateStaffTaskRequest`
- **Response:** `ApiResponse<StaffTaskResponse>`

#### DELETE `/staff-tasks/{id}`
- **Purpose:** Xóa staff task
- **Path:** `id` (Long)
- **Response:** `ApiResponse<Void>`

---

## Important Notes

### Authorization Patterns

1. **Public Endpoints:** Không có `@PreAuthorize` hoặc có nhưng không yêu cầu auth
   - Authentication endpoints
   - Một số booking endpoints (GET all, by-status, approve, checkin)

2. **Role-Based Authorization:**
   - `hasAuthority('ADMIN')`: Chỉ ADMIN
   - `hasAuthority('USER')`: Chỉ USER
   - `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')`: STAFF, MANAGER, hoặc ADMIN
   - `isAuthenticated()`: Bất kỳ authenticated user nào

3. **Method-Level vs Class-Level:**
   - Class-level `@PreAuthorize` áp dụng cho tất cả methods
   - Method-level `@PreAuthorize` override class-level

### Response Formats

- **List Responses:** `ApiResponse<List<T>>` - `data` là array trực tiếp
- **PageResponse:** Chỉ có ở `/users/search` và `/roles/search` - `data.content` là array
- **Single Object:** `ApiResponse<T>` - `data` là object
- **Void:** `ApiResponse<Void>` - `data` là `null`

### HTTP Status Codes

- **200 OK:** GET, PUT, DELETE thành công
- **201 Created:** POST thành công (create operations)
- **400 Bad Request:** Validation errors
- **401 Unauthorized:** Authentication required
- **403 Forbidden:** Authorization failed
- **404 Not Found:** Resource not found
- **500 Internal Server Error:** System errors

### Duplicate Controllers

**StaffManagementController vs StaffProfileController:**
- Cả hai đều có base path `/staff-profiles`
- Có thể là duplicate hoặc một trong hai không được sử dụng
- Cần kiểm tra xem controller nào đang được sử dụng

### Order Workflows

**Cart-Based Workflow:**
- Multi-item orders
- Items được thêm riêng lẻ
- Không yêu cầu staff assignment
- Status: PENDING → CONFIRMED

**Service-Based Workflow:**
- Single-item orders
- Yêu cầu staff assignment ngay từ đầu
- Status: PENDING_STAFF_CONFIRMATION → PENDING_PAYMENT → COMPLETED/REJECTED
- Staff phải confirm/reject trước khi payment

