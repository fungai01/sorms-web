# Backend External Clients Analysis

## Tổng quan

Backend sử dụng Spring Cloud OpenFeign để giao tiếp với các external services. Tất cả clients được định nghĩa trong package `vn.edu.fpt.sorms.application.client`.

## 1. OAuth2 Clients (Google)

### OutBoundIdentityClient

**Mục đích:** Exchange OAuth2 authorization code với Google để lấy access token.

**Configuration:**
```java
@FeignClient(name = "outbound-identity", url = "https://oauth2.googleapis.com")
```

**Endpoint:**
- `POST /token` - Exchange authorization code for access token

**Request:** `ExchangeTokenOutBoundRequest`
```java
{
  "code": String,              // Authorization code từ Google
  "client_id": String,         // OAuth2 client ID
  "client_secret": String,     // OAuth2 client secret
  "redirect_uri": String,      // Redirect URI đã đăng ký
  "grant_type": String         // "authorization_code"
}
```

**Response:** `ExchangeTokenOutBoundResponse`
```java
{
  "access_token": String,      // Access token từ Google
  "expires_in": String,        // Thời gian hết hạn
  "refresh_token": String,     // Refresh token (nếu có)
  "scope": String,             // Scopes được cấp
  "token_type": String         // "Bearer"
}
```

**Content-Type:** `application/x-www-form-urlencoded`

**Sử dụng trong:** `OutboundAuthenticationService.exchangeToken()`

---

### OutBoundUserInfoClient

**Mục đích:** Lấy thông tin user từ Google API sử dụng access token.

**Configuration:**
```java
@FeignClient(name = "outbound-user-info-client", url = "https://www.googleapis.com")
```

**Endpoint:**
- `GET /oauth2/v1/userinfo` - Get user information

**Request Parameters:**
- `alt`: String (default: "json")
- `access_token`: String (Google access token)

**Response:** `OutBoundUserInfoResponse`
```java
{
  "id": String,                // Google user ID
  "email": String,             // Email address
  "verified_email": Boolean,   // Email verification status
  "name": String,             // Full name
  "given_name": String,       // First name
  "family_name": String,      // Last name
  "picture": String,          // Profile picture URL
  "locale": String           // User locale
}
```

**Sử dụng trong:** `OutboundAuthenticationService.getUserInfo()`

**Flow:**
1. Exchange code → Get access token
2. Use access token → Get user info
3. Create/find account → Generate JWT

---

### GoogleTokenInfoClient

**Mục đích:** Verify Google ID token (nếu backend cần verify ID token thay vì access token).

**Configuration:**
```java
@FeignClient(name = "google-tokeninfo-client", url = "https://oauth2.googleapis.com")
```

**Endpoint:**
- `GET /tokeninfo` - Verify ID token

**Request Parameter:**
- `id_token`: String (Google ID token)

**Response:** `GoogleTokenInfoResponse`
```java
{
  "iss": String,              // Issuer (Google)
  "aud": String,              // Audience (client ID)
  "sub": String,              // Subject (user ID)
  "email": String,            // Email
  "email_verified": Boolean, // Email verification
  "name": String,             // Full name
  "given_name": String,       // First name
  "family_name": String,      // Last name
  "picture": String,          // Profile picture
  "exp": Long,                // Expiration time
  "iat": Long                 // Issued at time
}
```

**Error Response:**
```java
{
  "error": String,            // Error code
  "error_description": String  // Error description
}
```

**Lưu ý:** Client này có thể không được sử dụng trong OAuth flow hiện tại, nhưng có sẵn để verify ID tokens nếu cần.

---

## 2. AI Face Recognition Client

### AIRecognitionClient

**Mục đích:** Giao tiếp với external AI face recognition service để quản lý face images và check-in.

**Configuration:**
```java
@FeignClient(
    name = "Face-Recognition-API",
    url = "http://103.81.87.99:9001"
)
```

**Base URL:** `http://103.81.87.99:9001`

**Lưu ý:** Service này sử dụng HTTP (không phải HTTPS), có thể cần cấu hình security cho production.

---

### Endpoints

#### 1. Register User Face Images

**Endpoint:** `POST /api/face-recognition/students/register`

**Content-Type:** `multipart/form-data`

**Request Parameters:**
- `student_id`: String (User ID trong hệ thống)
- `class_id`: String (Phải là "1" - hardcoded)
- `images`: List<MultipartFile> (3-5 face images)

**Response:** `RegisterUserResponse`
```java
{
  "success": Boolean,
  "message": String,
  "student": {
    "classId": String,
    "numImages": Integer,
    "studentId": String
  }
}
```

**Sử dụng:** Đăng ký face images cho user để nhận diện sau này.

---

#### 2. Get All Users

**Endpoint:** `GET /api/face-recognition/students`

**Query Parameter:**
- `class_id`: String (default: "1")

**Response:** `GetAllUsersResponse`
```java
{
  "success": Boolean,
  "total": Integer,
  "students": [
    {
      "classId": String,
      "numImages": Integer,
      "studentId": String
    }
  ]
}
```

**Sử dụng:** Lấy danh sách tất cả users đã đăng ký face recognition.

---

#### 3. Get User By ID

**Endpoint:** `GET /api/face-recognition/students/{id}`

**Path Variable:**
- `id`: String (User ID)

**Response:** `GetUserByIdResponse` (có thể là `StudentInfo` hoặc wrapper)

**Sử dụng:** Lấy thông tin chi tiết của một user.

---

#### 4. Update User Face Images

**Endpoint:** `PUT /api/face-recognition/students/{id}`

**Content-Type:** `multipart/form-data`

**Path Variable:**
- `id`: String (User ID)

**Request Parameters:**
- `class_id`: String (Phải là "1")
- `images`: List<MultipartFile> (3-5 face images mới)

**Response:** `UpdateUserResponse`
```java
{
  "success": Boolean,
  "message": String,
  "student": StudentInfo
}
```

**Sử dụng:** Cập nhật face images cho user đã đăng ký.

---

#### 5. Delete User

**Endpoint:** `DELETE /api/face-recognition/students/{id}`

**Path Variable:**
- `id`: String (User ID)

**Response:** `DeleteUserResponse`
```java
{
  "success": Boolean,
  "message": String
}
```

**Sử dụng:** Xóa user khỏi face recognition system.

---

#### 6. Check-In/Attendance

**Endpoint:** `POST /api/face-recognition/attendance`

**Content-Type:** `multipart/form-data`

**Request Parameters:**
- `class_id`: String (Phải là "1")
- `image`: MultipartFile (Face image để nhận diện)

**Response:** `CheckInAttendanceResponse`
```java
{
  "classId": String,
  "confidence": Double,        // Độ tin cậy (0.0 - 1.0)
  "matchFound": Boolean,       // Có tìm thấy match không
  "message": String,           // Thông báo
  "processingTime": Double,    // Thời gian xử lý (giây)
  "studentId": String,        // ID của student được nhận diện
  "success": Boolean          // Thành công hay không
}
```

**Sử dụng:** Check-in/attendance bằng face recognition. Service sẽ so sánh face image với database và trả về kết quả nhận diện.

**Flow:**
1. Upload face image
2. AI service so sánh với database
3. Trả về student ID nếu match (với confidence score)
4. Backend xử lý check-in dựa trên kết quả

---

## 3. Important Notes

### OAuth2 Flow

1. **Authorization Code Flow:**
   - Frontend redirect user đến Google OAuth
   - Google redirect về với authorization code
   - Backend exchange code → access token
   - Backend dùng access token → get user info
   - Backend tạo/find account → generate JWT

2. **Token Management:**
   - Access token từ Google chỉ dùng để get user info
   - Backend tự generate JWT token cho internal use
   - JWT token được dùng cho authentication trong hệ thống

### AI Face Recognition

1. **Class ID:** Luôn là "1" (hardcoded) - có thể là limitation của external service

2. **Face Images:** Cần 3-5 images để đảm bảo độ chính xác tốt

3. **Confidence Score:** 
   - Range: 0.0 - 1.0
   - Cần threshold để quyết định match (ví dụ: > 0.8)

4. **Error Handling:**
   - External service có thể fail
   - Backend cần handle FeignException
   - Có thể cần retry logic cho production

5. **Security:**
   - AI service dùng HTTP (không HTTPS)
   - Cần đảm bảo network security
   - Có thể cần VPN hoặc private network

### Feign Client Configuration

- Tất cả clients sử dụng `@FeignClient` annotation
- Auto-configured bởi Spring Cloud OpenFeign
- Error handling có thể được cấu hình qua Feign error decoder
- Timeout và retry có thể được cấu hình

### Integration Points

**OAuth Clients:**
- `OutboundAuthenticationService` → `OutBoundIdentityClient` + `OutBoundUserInfoClient`
- Flow: OAuth callback → Exchange token → Get user info → Create account → Generate JWT

**AI Recognition Client:**
- `AIRecognitionService` → `AIRecognitionClient`
- Flow: Upload face images → Register/Update → Check-in với face image → Get recognition result

---

## 4. Frontend Integration Notes

### OAuth Flow (Frontend)

Frontend không cần gọi trực tiếp các OAuth clients này. Flow:
1. Frontend redirect đến Google OAuth
2. Google redirect về với code
3. Frontend gọi backend `/auth/outbound/authentication` với code
4. Backend xử lý OAuth flow internally
5. Backend trả về JWT token cho frontend

### AI Recognition (Frontend)

Frontend có thể cần:
- Upload face images khi register user
- Upload face image khi check-in
- Hiển thị confidence score và recognition result
- Handle errors từ AI service

**Lưu ý:** Frontend không nên gọi trực tiếp AI service, mà nên gọi qua backend API routes để:
- Bảo mật (không expose external service URL)
- Error handling centralized
- Logging và monitoring
- Rate limiting


## Tổng quan

Backend sử dụng Spring Cloud OpenFeign để giao tiếp với các external services. Tất cả clients được định nghĩa trong package `vn.edu.fpt.sorms.application.client`.

## 1. OAuth2 Clients (Google)

### OutBoundIdentityClient

**Mục đích:** Exchange OAuth2 authorization code với Google để lấy access token.

**Configuration:**
```java
@FeignClient(name = "outbound-identity", url = "https://oauth2.googleapis.com")
```

**Endpoint:**
- `POST /token` - Exchange authorization code for access token

**Request:** `ExchangeTokenOutBoundRequest`
```java
{
  "code": String,              // Authorization code từ Google
  "client_id": String,         // OAuth2 client ID
  "client_secret": String,     // OAuth2 client secret
  "redirect_uri": String,      // Redirect URI đã đăng ký
  "grant_type": String         // "authorization_code"
}
```

**Response:** `ExchangeTokenOutBoundResponse`
```java
{
  "access_token": String,      // Access token từ Google
  "expires_in": String,        // Thời gian hết hạn
  "refresh_token": String,     // Refresh token (nếu có)
  "scope": String,             // Scopes được cấp
  "token_type": String         // "Bearer"
}
```

**Content-Type:** `application/x-www-form-urlencoded`

**Sử dụng trong:** `OutboundAuthenticationService.exchangeToken()`

---

### OutBoundUserInfoClient

**Mục đích:** Lấy thông tin user từ Google API sử dụng access token.

**Configuration:**
```java
@FeignClient(name = "outbound-user-info-client", url = "https://www.googleapis.com")
```

**Endpoint:**
- `GET /oauth2/v1/userinfo` - Get user information

**Request Parameters:**
- `alt`: String (default: "json")
- `access_token`: String (Google access token)

**Response:** `OutBoundUserInfoResponse`
```java
{
  "id": String,                // Google user ID
  "email": String,             // Email address
  "verified_email": Boolean,   // Email verification status
  "name": String,             // Full name
  "given_name": String,       // First name
  "family_name": String,      // Last name
  "picture": String,          // Profile picture URL
  "locale": String           // User locale
}
```

**Sử dụng trong:** `OutboundAuthenticationService.getUserInfo()`

**Flow:**
1. Exchange code → Get access token
2. Use access token → Get user info
3. Create/find account → Generate JWT

---

### GoogleTokenInfoClient

**Mục đích:** Verify Google ID token (nếu backend cần verify ID token thay vì access token).

**Configuration:**
```java
@FeignClient(name = "google-tokeninfo-client", url = "https://oauth2.googleapis.com")
```

**Endpoint:**
- `GET /tokeninfo` - Verify ID token

**Request Parameter:**
- `id_token`: String (Google ID token)

**Response:** `GoogleTokenInfoResponse`
```java
{
  "iss": String,              // Issuer (Google)
  "aud": String,              // Audience (client ID)
  "sub": String,              // Subject (user ID)
  "email": String,            // Email
  "email_verified": Boolean, // Email verification
  "name": String,             // Full name
  "given_name": String,       // First name
  "family_name": String,      // Last name
  "picture": String,          // Profile picture
  "exp": Long,                // Expiration time
  "iat": Long                 // Issued at time
}
```

**Error Response:**
```java
{
  "error": String,            // Error code
  "error_description": String  // Error description
}
```

**Lưu ý:** Client này có thể không được sử dụng trong OAuth flow hiện tại, nhưng có sẵn để verify ID tokens nếu cần.

---

## 2. AI Face Recognition Client

### AIRecognitionClient

**Mục đích:** Giao tiếp với external AI face recognition service để quản lý face images và check-in.

**Configuration:**
```java
@FeignClient(
    name = "Face-Recognition-API",
    url = "http://103.81.87.99:9001"
)
```

**Base URL:** `http://103.81.87.99:9001`

**Lưu ý:** Service này sử dụng HTTP (không phải HTTPS), có thể cần cấu hình security cho production.

---

### Endpoints

#### 1. Register User Face Images

**Endpoint:** `POST /api/face-recognition/students/register`

**Content-Type:** `multipart/form-data`

**Request Parameters:**
- `student_id`: String (User ID trong hệ thống)
- `class_id`: String (Phải là "1" - hardcoded)
- `images`: List<MultipartFile> (3-5 face images)

**Response:** `RegisterUserResponse`
```java
{
  "success": Boolean,
  "message": String,
  "student": {
    "classId": String,
    "numImages": Integer,
    "studentId": String
  }
}
```

**Sử dụng:** Đăng ký face images cho user để nhận diện sau này.

---

#### 2. Get All Users

**Endpoint:** `GET /api/face-recognition/students`

**Query Parameter:**
- `class_id`: String (default: "1")

**Response:** `GetAllUsersResponse`
```java
{
  "success": Boolean,
  "total": Integer,
  "students": [
    {
      "classId": String,
      "numImages": Integer,
      "studentId": String
    }
  ]
}
```

**Sử dụng:** Lấy danh sách tất cả users đã đăng ký face recognition.

---

#### 3. Get User By ID

**Endpoint:** `GET /api/face-recognition/students/{id}`

**Path Variable:**
- `id`: String (User ID)

**Response:** `GetUserByIdResponse` (có thể là `StudentInfo` hoặc wrapper)

**Sử dụng:** Lấy thông tin chi tiết của một user.

---

#### 4. Update User Face Images

**Endpoint:** `PUT /api/face-recognition/students/{id}`

**Content-Type:** `multipart/form-data`

**Path Variable:**
- `id`: String (User ID)

**Request Parameters:**
- `class_id`: String (Phải là "1")
- `images`: List<MultipartFile> (3-5 face images mới)

**Response:** `UpdateUserResponse`
```java
{
  "success": Boolean,
  "message": String,
  "student": StudentInfo
}
```

**Sử dụng:** Cập nhật face images cho user đã đăng ký.

---

#### 5. Delete User

**Endpoint:** `DELETE /api/face-recognition/students/{id}`

**Path Variable:**
- `id`: String (User ID)

**Response:** `DeleteUserResponse`
```java
{
  "success": Boolean,
  "message": String
}
```

**Sử dụng:** Xóa user khỏi face recognition system.

---

#### 6. Check-In/Attendance

**Endpoint:** `POST /api/face-recognition/attendance`

**Content-Type:** `multipart/form-data`

**Request Parameters:**
- `class_id`: String (Phải là "1")
- `image`: MultipartFile (Face image để nhận diện)

**Response:** `CheckInAttendanceResponse`
```java
{
  "classId": String,
  "confidence": Double,        // Độ tin cậy (0.0 - 1.0)
  "matchFound": Boolean,       // Có tìm thấy match không
  "message": String,           // Thông báo
  "processingTime": Double,    // Thời gian xử lý (giây)
  "studentId": String,        // ID của student được nhận diện
  "success": Boolean          // Thành công hay không
}
```

**Sử dụng:** Check-in/attendance bằng face recognition. Service sẽ so sánh face image với database và trả về kết quả nhận diện.

**Flow:**
1. Upload face image
2. AI service so sánh với database
3. Trả về student ID nếu match (với confidence score)
4. Backend xử lý check-in dựa trên kết quả

---

## 3. Important Notes

### OAuth2 Flow

1. **Authorization Code Flow:**
   - Frontend redirect user đến Google OAuth
   - Google redirect về với authorization code
   - Backend exchange code → access token
   - Backend dùng access token → get user info
   - Backend tạo/find account → generate JWT

2. **Token Management:**
   - Access token từ Google chỉ dùng để get user info
   - Backend tự generate JWT token cho internal use
   - JWT token được dùng cho authentication trong hệ thống

### AI Face Recognition

1. **Class ID:** Luôn là "1" (hardcoded) - có thể là limitation của external service

2. **Face Images:** Cần 3-5 images để đảm bảo độ chính xác tốt

3. **Confidence Score:** 
   - Range: 0.0 - 1.0
   - Cần threshold để quyết định match (ví dụ: > 0.8)

4. **Error Handling:**
   - External service có thể fail
   - Backend cần handle FeignException
   - Có thể cần retry logic cho production

5. **Security:**
   - AI service dùng HTTP (không HTTPS)
   - Cần đảm bảo network security
   - Có thể cần VPN hoặc private network

### Feign Client Configuration

- Tất cả clients sử dụng `@FeignClient` annotation
- Auto-configured bởi Spring Cloud OpenFeign
- Error handling có thể được cấu hình qua Feign error decoder
- Timeout và retry có thể được cấu hình

### Integration Points

**OAuth Clients:**
- `OutboundAuthenticationService` → `OutBoundIdentityClient` + `OutBoundUserInfoClient`
- Flow: OAuth callback → Exchange token → Get user info → Create account → Generate JWT

**AI Recognition Client:**
- `AIRecognitionService` → `AIRecognitionClient`
- Flow: Upload face images → Register/Update → Check-in với face image → Get recognition result

---

## 4. Frontend Integration Notes

### OAuth Flow (Frontend)

Frontend không cần gọi trực tiếp các OAuth clients này. Flow:
1. Frontend redirect đến Google OAuth
2. Google redirect về với code
3. Frontend gọi backend `/auth/outbound/authentication` với code
4. Backend xử lý OAuth flow internally
5. Backend trả về JWT token cho frontend

### AI Recognition (Frontend)

Frontend có thể cần:
- Upload face images khi register user
- Upload face image khi check-in
- Hiển thị confidence score và recognition result
- Handle errors từ AI service

**Lưu ý:** Frontend không nên gọi trực tiếp AI service, mà nên gọi qua backend API routes để:
- Bảo mật (không expose external service URL)
- Error handling centralized
- Logging và monitoring
- Rate limiting

