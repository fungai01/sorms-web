# Tại Sao Login Admin Thành Công Nhưng Vẫn Không Xem Được Dữ Liệu?

## Tổng Quan

**Login admin thành công, nhưng vẫn không xem được dữ liệu vì backend không parse token để check quyền admin.**

## 1. Login Admin Thành Công

### 1.1. Response Từ Backend

```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": {
    "authenticated": true,
    "token": "eyJhbGciOiJ...",
    "accountInfo": {
      "id": "1",
      "email": "quyentnqe170062@fpt.edu.vn",
      "roleName": ["admin", "user"]  // ✅ Có role admin
    }
  }
}
```

**✅ Xác nhận:**
- ✅ Login thành công
- ✅ Token được trả về
- ✅ Role: `["admin", "user"]` - Có quyền admin

### 1.2. Token Có Thông Tin Admin

**JWT Token decode:**
```json
{
  "sub": "quyentnqe170062@fpt.edu.vn",
  "scope": "ROLE_admin ROLE_user",  // ✅ Có ROLE_admin
  "roles": ["admin", "user"],        // ✅ Có admin
  "userId": "1",
  "accountInfo": {...}
}
```

**✅ Token có đầy đủ thông tin admin**

## 2. Vấn Đề: Backend Không Parse Token

### 2.1. Flow Khi Gọi API

```
1. Frontend gửi: GET /api/rooms
   Headers: { Authorization: "Bearer <token>" }  ✅
   Token có: roles: ["admin", "user"]  ✅
   ↓
2. Backend nhận request:
   ✅ CÓ Authorization header
   ✅ Header có format đúng: "Bearer <token>"
   ↓
3. WebSecurityConfig:
   permitAll() → Bypass security  ✅
   ❌ NHƯNG không parse token
   ❌ KHÔNG extract roles từ token
   ❌ KHÔNG set Authentication vào SecurityContext
   ↓
4. Request đến RoomController:
   ✅ Đến được controller
   ↓
5. @PreAuthorize check:
   @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
   ↓
6. Spring Security check:
   SecurityContext.getAuthentication()  // ❌ NULL
   Authentication.getAuthorities()      // ❌ NULL (vì Authentication == NULL)
   ↓
7. @PreAuthorize fails:
   ❌ Không có authority 'ADMIN' (vì Authentication == NULL)
   ❌ Throw AccessDeniedException
   ↓
8. GlobalExceptionHandler:
   ❌ Return: { responseCode: "S0001", message: "SYSTEM_ERROR" }
   ❌ KHÔNG CÓ DỮ LIỆU
```

### 2.2. Tại Sao @PreAuthorize Fails?

**@PreAuthorize cần:**
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```

**Spring Security sẽ:**
1. Lấy `Authentication` từ `SecurityContext`
2. Lấy `authorities` từ `Authentication`
3. Check xem có authority 'ADMIN' không

**Hiện tại:**
```java
SecurityContext.getContext().getAuthentication()  // ❌ NULL
// → Không có Authentication
// → Không có authorities
// → @PreAuthorize fails
// → Không cho xem dữ liệu
```

**Mặc dù:**
- ✅ Token có role "admin"
- ✅ Token được gửi đúng
- ✅ Backend nhận được token

**Nhưng:**
- ❌ Backend không parse token
- ❌ Backend không extract roles từ token
- ❌ Backend không set Authentication
- ❌ @PreAuthorize không biết user là admin

## 3. So Sánh: Có Parse Token vs Không Parse

### 3.1. Không Parse Token (Hiện Tại)

```
1. Frontend gửi token với role "admin"  ✅
   ↓
2. Backend nhận token  ✅
   ↓
3. Backend KHÔNG parse token  ❌
   ↓
4. SecurityContext.getAuthentication() == NULL  ❌
   ↓
5. @PreAuthorize check:
   - Authentication == NULL
   - Authorities == NULL
   - hasAnyAuthority('ADMIN') → FALSE  ❌
   ↓
6. @PreAuthorize fails  ❌
   ↓
7. Không cho xem dữ liệu  ❌
```

### 3.2. Có Parse Token (Cần Tạo JWT Filter)

```
1. Frontend gửi token với role "admin"  ✅
   ↓
2. Backend nhận token  ✅
   ↓
3. JWT Filter parse token  ✅
   - Extract token từ Authorization header
   - Verify token
   - Extract roles: ["admin", "user"]
   - Create Authentication với authorities: ["ADMIN", "USER"]
   - Set vào SecurityContext  ✅
   ↓
4. SecurityContext.getAuthentication() != NULL  ✅
   Authentication.getAuthorities() = ["ADMIN", "USER"]  ✅
   ↓
5. @PreAuthorize check:
   - Authentication != NULL
   - Authorities = ["ADMIN", "USER"]
   - hasAnyAuthority('ADMIN') → TRUE  ✅
   ↓
6. @PreAuthorize passes  ✅
   ↓
7. Controller xử lý request  ✅
   ↓
8. Trả về dữ liệu  ✅
```

## 4. Tại Sao Admin Không Xem Được?

### 4.1. Token Có Role Admin Nhưng Backend Không Biết

**Token có:**
```json
{
  "roles": ["admin", "user"],  // ✅ Có admin
  "scope": "ROLE_admin ROLE_user"  // ✅ Có ROLE_admin
}
```

**Nhưng backend:**
- ❌ Không parse token
- ❌ Không extract roles
- ❌ Không biết user là admin
- ❌ SecurityContext == NULL
- ❌ @PreAuthorize không check được role

### 4.2. @PreAuthorize Cần Authentication

**@PreAuthorize check:**
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```

**Cần:**
- `Authentication` object trong `SecurityContext`
- `Authentication.getAuthorities()` chứa ["ADMIN", "USER"]

**Hiện tại:**
- `SecurityContext.getAuthentication() == NULL`
- Không có `Authentication`
- Không có `authorities`
- @PreAuthorize fails

## 5. Giải Pháp

### 5.1. Cần Tạo JWT Filter

**JWT Filter cần:**
1. Extract token từ `Authorization: Bearer <token>` header
2. Verify token bằng `JWTProvider.verifyToken()`
3. Extract roles từ token: `["admin", "user"]`
4. Convert roles thành authorities: `["ADMIN", "USER"]`
5. Create `Authentication` object với authorities
6. Set vào `SecurityContextHolder`

**Sau khi có JWT Filter:**
- ✅ Backend parse token
- ✅ Extract roles từ token
- ✅ Set Authentication với authorities ["ADMIN", "USER"]
- ✅ @PreAuthorize check hasAnyAuthority('ADMIN') → TRUE
- ✅ Cho xem dữ liệu

## 6. Kết Luận

### ✅ Login Admin Thành Công:

- ✅ Backend tạo token với role "admin"
- ✅ Frontend nhận và lưu token
- ✅ Token có đầy đủ thông tin admin

### ❌ Nhưng Vẫn Không Xem Được Dữ Liệu:

- ❌ Backend không parse token
- ❌ Backend không extract roles từ token
- ❌ SecurityContext == NULL
- ❌ @PreAuthorize không biết user là admin
- ❌ @PreAuthorize fails → SYSTEM_ERROR

### 🔧 Giải Pháp:

**Cần tạo JWT Filter để:**
- Parse token từ Authorization header
- Extract roles từ token
- Set Authentication với authorities vào SecurityContext
- Cho phép @PreAuthorize check role admin
- Cho xem dữ liệu

### Tóm Tắt:

**Login admin thành công → Token có role admin → Nhưng backend không parse token → SecurityContext NULL → @PreAuthorize không biết user là admin → Không cho xem dữ liệu**

**Cần JWT Filter để parse token → Extract roles → Set Authentication → @PreAuthorize biết user là admin → Cho xem dữ liệu**

