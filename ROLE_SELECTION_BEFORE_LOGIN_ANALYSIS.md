# Phân Tích: Chọn Role Trước Khi Đăng Nhập

## Tổng Quan

**Frontend có cho chọn role trước khi login**, nhưng **backend KHÔNG xử lý role được chọn**. Backend chỉ lấy roles từ database.

## 1. Frontend - Login Page

### Role Selection (Optional)

**File**: `src/app/login/page.tsx`

```typescript
const [selectedRole, setSelectedRole] = useState("");

const roles = [
  { id: "admin", name: "Admin" },
  { id: "office", name: "Phòng Hành chính" },
  { id: "staff", name: "Nhân viên" },
  { id: "user", name: "Người dùng" },
];

const handleGoogleSignIn = async () => {
  // Vai trò là tùy chọn, không bắt buộc chọn
  // Nếu không chọn, role sẽ được lấy từ database/token sau khi xác thực
  if (typeof window !== 'undefined') {
    if (selectedRole) {
      sessionStorage.setItem('selectedRole', selectedRole);  // ✅ Lưu vào sessionStorage
    } else {
      sessionStorage.removeItem('selectedRole');
    }
  }
  
  await loginWithGoogle();
};
```

**Đặc điểm:**
- ✅ Role selection là **optional** (tùy chọn)
- ✅ Lưu `selectedRole` vào `sessionStorage` (không gửi lên backend)
- ✅ Chỉ dùng để validate/display ở frontend

## 2. Backend - OutboundAuthenticateRequest

### Request Format

**File**: `OutboundAuthenticateRequest.java`

```java
public class OutboundAuthenticateRequest {
    private String code;           // ✅ Có
    private String redirectUri;    // ✅ Có
    // ❌ KHÔNG CÓ field role
}
```

**Vấn đề:**
- ❌ **Không có field `role`** trong request
- ❌ Backend **KHÔNG nhận** role được chọn từ frontend
- ❌ Backend **KHÔNG xử lý** role selection

## 3. Backend - OutboundAuthenticationService

### Flow Xử Lý

**File**: `OutboundAuthenticationService.java`

```java
// Step 3: Find or create account
Account account = accountDomainService.findUserLoginByEmail(userInfo.getEmail())
    .orElseGet(() -> createNewAccountFromOAuth(userInfo));

// Step 4: Get roles for account
List<AccountRole> accountRoles = accountRoleDomainService.findByFields(
    Map.of("accountId", account.getId())
);

List<String> roles = accountRoles.stream()
    .map(AccountRole::getRoleId)
    .map(roleId -> roleDomainService.findById(roleId).orElse(null))
    .filter(Objects::nonNull)
    .map(Role::getName)
    .collect(Collectors.toList());

// Step 5: Generate JWT token
String token = jwtProvider.generateToken(account, roles);
```

**Đặc điểm:**
- ✅ **Lấy roles từ database** (AccountRole table)
- ❌ **KHÔNG nhận role từ request**
- ❌ **KHÔNG xử lý role được chọn** ở frontend

## 4. Frontend - Callback Page

### Xử Lý Selected Role

**File**: `src/app/auth/callback/page.tsx`

```typescript
// Lấy role từ sessionStorage (đã lưu khi login) - optional, chỉ dùng để validate
const role = typeof window !== 'undefined' 
  ? sessionStorage.getItem('selectedRole') 
  : null;

// Lấy role từ token/introspect response (đã được backend xác thực)
const getUserRoleFromToken = (userInfo: any): string => {
  const roles = userInfo.roles || userInfo.roleName || [];
  if (Array.isArray(roles) && roles.length > 0) {
    return String(roles[0]);  // ✅ Dùng role từ token (backend)
  }
  return 'USER';
};
```

**Đặc điểm:**
- ✅ Lấy `selectedRole` từ `sessionStorage` (chỉ để validate)
- ✅ **Ưu tiên role từ token** (backend) thay vì selectedRole
- ✅ **Không gửi selectedRole lên backend**

## 5. Kết Luận

### Role Selection ở Frontend:

**Mục đích:**
- ✅ **UI/UX** - Cho user biết họ đang chọn role gì
- ✅ **Validation** - Có thể validate role sau khi login (nếu cần)
- ❌ **KHÔNG ảnh hưởng đến backend** - Backend không nhận role này

### Backend Xử Lý:

**Backend chỉ:**
- ✅ Lấy roles từ **database** (AccountRole table)
- ✅ Generate token với roles từ database
- ❌ **KHÔNG nhận** role từ frontend request
- ❌ **KHÔNG xử lý** role selection

### Flow Thực Tế:

```
1. User chọn role "admin" ở login page
   → Frontend lưu vào sessionStorage
   → KHÔNG gửi lên backend

2. User click "Đăng nhập với Google"
   → Frontend gọi /auth/outbound/authentication
   → Request: { code, redirectUri }  // ❌ KHÔNG CÓ role

3. Backend xử lý:
   → Exchange code → Get user info
   → Find/Create account
   → Lấy roles từ database (AccountRole)  // ✅ Từ database
   → Generate token với roles từ database

4. Frontend nhận token:
   → Lấy roles từ token (backend)
   → So sánh với selectedRole (nếu có) - chỉ để validate
   → Redirect dựa trên role từ token (không phải selectedRole)
```

## 6. Vấn Đề

### Nếu User Chọn Role Khác Với Role Trong Database:

**Ví dụ:**
- User chọn "admin" ở login page
- Nhưng trong database, user chỉ có role "user"

**Kết quả:**
- ✅ Backend vẫn trả về token với role "user" (từ database)
- ✅ Frontend sẽ redirect đến `/user/*` (dựa trên role từ token)
- ⚠️ User có thể thắc mắc tại sao không vào được `/admin/*`

### Giải Pháp Hiện Tại:

**Frontend đã xử lý:**
- ✅ Ưu tiên role từ token (backend) thay vì selectedRole
- ✅ Redirect dựa trên role từ token
- ✅ selectedRole chỉ dùng để validate/display

## 7. Nếu Muốn Backend Xử Lý Role Selection

### Option 1: Thêm Role vào Request

**Modify OutboundAuthenticateRequest:**
```java
public class OutboundAuthenticateRequest {
    private String code;
    private String redirectUri;
    private String selectedRole;  // ✅ Thêm field này
}
```

**Modify OutboundAuthenticationService:**
```java
// Validate selectedRole với roles từ database
List<String> roles = accountRoles.stream()
    .map(AccountRole::getRoleId)
    .map(roleId -> roleDomainService.findById(roleId).orElse(null))
    .filter(Objects::nonNull)
    .map(Role::getName)
    .collect(Collectors.toList());

// Nếu có selectedRole, validate và filter
if (request.getSelectedRole() != null) {
    String selectedRoleUpper = request.getSelectedRole().toUpperCase();
    boolean hasSelectedRole = roles.stream()
        .anyMatch(role -> role.toUpperCase().equals(selectedRoleUpper));
    
    if (!hasSelectedRole) {
        throw new AppException(ErrorCode.FORBIDDEN);  // User không có role này
    }
    
    // Filter roles để chỉ dùng selectedRole
    roles = roles.stream()
        .filter(role -> role.toUpperCase().equals(selectedRoleUpper))
        .collect(Collectors.toList());
}
```

**Nhược điểm:**
- ❌ User có thể chọn role không có trong database
- ❌ Phức tạp hơn
- ❌ Không khuyến nghị

### Option 2: Giữ Nguyên (Recommended)

**Hiện tại đã đúng:**
- ✅ Backend lấy roles từ database (source of truth)
- ✅ Frontend dùng role từ token để redirect
- ✅ selectedRole chỉ là UI hint, không ảnh hưởng logic

## 8. Kết Luận

### Role Selection Trước Khi Login:

**Frontend:**
- ✅ Có cho chọn role (optional)
- ✅ Lưu vào sessionStorage
- ✅ Chỉ dùng để validate/display

**Backend:**
- ❌ **KHÔNG nhận** role từ request
- ❌ **KHÔNG xử lý** role selection
- ✅ **Chỉ lấy roles từ database**

**Kết quả:**
- ✅ Backend luôn trả về roles từ database (source of truth)
- ✅ Frontend dùng role từ token để redirect
- ✅ selectedRole không ảnh hưởng đến backend logic

### Recommendation:

**Giữ nguyên cách hiện tại:**
- ✅ Backend lấy roles từ database (đúng)
- ✅ Frontend dùng role từ token (đúng)
- ✅ selectedRole chỉ là UI hint (đúng)

**Không cần thay đổi backend** để xử lý role selection, vì:
- Backend đã có roles trong database
- Token đã có roles từ database
- Frontend đã dùng role từ token


## Tổng Quan

**Frontend có cho chọn role trước khi login**, nhưng **backend KHÔNG xử lý role được chọn**. Backend chỉ lấy roles từ database.

## 1. Frontend - Login Page

### Role Selection (Optional)

**File**: `src/app/login/page.tsx`

```typescript
const [selectedRole, setSelectedRole] = useState("");

const roles = [
  { id: "admin", name: "Admin" },
  { id: "office", name: "Phòng Hành chính" },
  { id: "staff", name: "Nhân viên" },
  { id: "user", name: "Người dùng" },
];

const handleGoogleSignIn = async () => {
  // Vai trò là tùy chọn, không bắt buộc chọn
  // Nếu không chọn, role sẽ được lấy từ database/token sau khi xác thực
  if (typeof window !== 'undefined') {
    if (selectedRole) {
      sessionStorage.setItem('selectedRole', selectedRole);  // ✅ Lưu vào sessionStorage
    } else {
      sessionStorage.removeItem('selectedRole');
    }
  }
  
  await loginWithGoogle();
};
```

**Đặc điểm:**
- ✅ Role selection là **optional** (tùy chọn)
- ✅ Lưu `selectedRole` vào `sessionStorage` (không gửi lên backend)
- ✅ Chỉ dùng để validate/display ở frontend

## 2. Backend - OutboundAuthenticateRequest

### Request Format

**File**: `OutboundAuthenticateRequest.java`

```java
public class OutboundAuthenticateRequest {
    private String code;           // ✅ Có
    private String redirectUri;    // ✅ Có
    // ❌ KHÔNG CÓ field role
}
```

**Vấn đề:**
- ❌ **Không có field `role`** trong request
- ❌ Backend **KHÔNG nhận** role được chọn từ frontend
- ❌ Backend **KHÔNG xử lý** role selection

## 3. Backend - OutboundAuthenticationService

### Flow Xử Lý

**File**: `OutboundAuthenticationService.java`

```java
// Step 3: Find or create account
Account account = accountDomainService.findUserLoginByEmail(userInfo.getEmail())
    .orElseGet(() -> createNewAccountFromOAuth(userInfo));

// Step 4: Get roles for account
List<AccountRole> accountRoles = accountRoleDomainService.findByFields(
    Map.of("accountId", account.getId())
);

List<String> roles = accountRoles.stream()
    .map(AccountRole::getRoleId)
    .map(roleId -> roleDomainService.findById(roleId).orElse(null))
    .filter(Objects::nonNull)
    .map(Role::getName)
    .collect(Collectors.toList());

// Step 5: Generate JWT token
String token = jwtProvider.generateToken(account, roles);
```

**Đặc điểm:**
- ✅ **Lấy roles từ database** (AccountRole table)
- ❌ **KHÔNG nhận role từ request**
- ❌ **KHÔNG xử lý role được chọn** ở frontend

## 4. Frontend - Callback Page

### Xử Lý Selected Role

**File**: `src/app/auth/callback/page.tsx`

```typescript
// Lấy role từ sessionStorage (đã lưu khi login) - optional, chỉ dùng để validate
const role = typeof window !== 'undefined' 
  ? sessionStorage.getItem('selectedRole') 
  : null;

// Lấy role từ token/introspect response (đã được backend xác thực)
const getUserRoleFromToken = (userInfo: any): string => {
  const roles = userInfo.roles || userInfo.roleName || [];
  if (Array.isArray(roles) && roles.length > 0) {
    return String(roles[0]);  // ✅ Dùng role từ token (backend)
  }
  return 'USER';
};
```

**Đặc điểm:**
- ✅ Lấy `selectedRole` từ `sessionStorage` (chỉ để validate)
- ✅ **Ưu tiên role từ token** (backend) thay vì selectedRole
- ✅ **Không gửi selectedRole lên backend**

## 5. Kết Luận

### Role Selection ở Frontend:

**Mục đích:**
- ✅ **UI/UX** - Cho user biết họ đang chọn role gì
- ✅ **Validation** - Có thể validate role sau khi login (nếu cần)
- ❌ **KHÔNG ảnh hưởng đến backend** - Backend không nhận role này

### Backend Xử Lý:

**Backend chỉ:**
- ✅ Lấy roles từ **database** (AccountRole table)
- ✅ Generate token với roles từ database
- ❌ **KHÔNG nhận** role từ frontend request
- ❌ **KHÔNG xử lý** role selection

### Flow Thực Tế:

```
1. User chọn role "admin" ở login page
   → Frontend lưu vào sessionStorage
   → KHÔNG gửi lên backend

2. User click "Đăng nhập với Google"
   → Frontend gọi /auth/outbound/authentication
   → Request: { code, redirectUri }  // ❌ KHÔNG CÓ role

3. Backend xử lý:
   → Exchange code → Get user info
   → Find/Create account
   → Lấy roles từ database (AccountRole)  // ✅ Từ database
   → Generate token với roles từ database

4. Frontend nhận token:
   → Lấy roles từ token (backend)
   → So sánh với selectedRole (nếu có) - chỉ để validate
   → Redirect dựa trên role từ token (không phải selectedRole)
```

## 6. Vấn Đề

### Nếu User Chọn Role Khác Với Role Trong Database:

**Ví dụ:**
- User chọn "admin" ở login page
- Nhưng trong database, user chỉ có role "user"

**Kết quả:**
- ✅ Backend vẫn trả về token với role "user" (từ database)
- ✅ Frontend sẽ redirect đến `/user/*` (dựa trên role từ token)
- ⚠️ User có thể thắc mắc tại sao không vào được `/admin/*`

### Giải Pháp Hiện Tại:

**Frontend đã xử lý:**
- ✅ Ưu tiên role từ token (backend) thay vì selectedRole
- ✅ Redirect dựa trên role từ token
- ✅ selectedRole chỉ dùng để validate/display

## 7. Nếu Muốn Backend Xử Lý Role Selection

### Option 1: Thêm Role vào Request

**Modify OutboundAuthenticateRequest:**
```java
public class OutboundAuthenticateRequest {
    private String code;
    private String redirectUri;
    private String selectedRole;  // ✅ Thêm field này
}
```

**Modify OutboundAuthenticationService:**
```java
// Validate selectedRole với roles từ database
List<String> roles = accountRoles.stream()
    .map(AccountRole::getRoleId)
    .map(roleId -> roleDomainService.findById(roleId).orElse(null))
    .filter(Objects::nonNull)
    .map(Role::getName)
    .collect(Collectors.toList());

// Nếu có selectedRole, validate và filter
if (request.getSelectedRole() != null) {
    String selectedRoleUpper = request.getSelectedRole().toUpperCase();
    boolean hasSelectedRole = roles.stream()
        .anyMatch(role -> role.toUpperCase().equals(selectedRoleUpper));
    
    if (!hasSelectedRole) {
        throw new AppException(ErrorCode.FORBIDDEN);  // User không có role này
    }
    
    // Filter roles để chỉ dùng selectedRole
    roles = roles.stream()
        .filter(role -> role.toUpperCase().equals(selectedRoleUpper))
        .collect(Collectors.toList());
}
```

**Nhược điểm:**
- ❌ User có thể chọn role không có trong database
- ❌ Phức tạp hơn
- ❌ Không khuyến nghị

### Option 2: Giữ Nguyên (Recommended)

**Hiện tại đã đúng:**
- ✅ Backend lấy roles từ database (source of truth)
- ✅ Frontend dùng role từ token để redirect
- ✅ selectedRole chỉ là UI hint, không ảnh hưởng logic

## 8. Kết Luận

### Role Selection Trước Khi Login:

**Frontend:**
- ✅ Có cho chọn role (optional)
- ✅ Lưu vào sessionStorage
- ✅ Chỉ dùng để validate/display

**Backend:**
- ❌ **KHÔNG nhận** role từ request
- ❌ **KHÔNG xử lý** role selection
- ✅ **Chỉ lấy roles từ database**

**Kết quả:**
- ✅ Backend luôn trả về roles từ database (source of truth)
- ✅ Frontend dùng role từ token để redirect
- ✅ selectedRole không ảnh hưởng đến backend logic

### Recommendation:

**Giữ nguyên cách hiện tại:**
- ✅ Backend lấy roles từ database (đúng)
- ✅ Frontend dùng role từ token (đúng)
- ✅ selectedRole chỉ là UI hint (đúng)

**Không cần thay đổi backend** để xử lý role selection, vì:
- Backend đã có roles trong database
- Token đã có roles từ database
- Frontend đã dùng role từ token

