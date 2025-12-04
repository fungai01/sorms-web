# Backend Role Mechanism Analysis

## 1. Role Structure

### RoleCode Enum
```java
public enum RoleCode {
    USER("USER"),
    ADMIN("ADMIN"),
    STAFF("STAFF"),
    MANAGER("MANAGER");
}
```
- Định nghĩa các role codes: **USER**, **ADMIN**, **STAFF**, **MANAGER** (uppercase)

### Role Entity
```java
@Entity
@Table(name = "roles")
public class Role extends BaseEntity<String> {
    @Id
    @Column(name = "name", nullable = false, length = 100)
    private String name;  // Primary key: "USER", "ADMIN", "STAFF", "MANAGER"
    
    @Column(name = "code", nullable = false, length = 50)
    private String code;  // "USER", "ADMIN", etc.
    
    @Column(name = "description", length = 255)
    private String description;
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
}
```

**Quan trọng:**
- `name` là **primary key** của Role table
- `name` được dùng để tìm role: `roleDomainService.findById("USER")`
- `name` được lưu vào `AccountRole.roleId`
- `Role.getName()` được dùng trong JWT token

### AccountRole Entity
```java
@Entity
@Table(name = "accounts_roles")
public class AccountRole extends BaseEntity<Long> {
    @Column(name = "account_id", nullable = false)
    private String accountId;
    
    @Column(name = "role_id", nullable = false)
    private String roleId;  // Là Role.name (primary key)
    
    @Column(name = "assigned_at", nullable = false)
    private LocalDateTime assignedAt;
}
```

**Quan trọng:**
- `roleId` trong `AccountRole` là `Role.name` (không phải `Role.code`)
- Khi lấy roles: `AccountRole.getRoleId()` → `Role.findById(roleId)` → `Role.getName()`

## 2. Role Assignment Flow

### Khi tạo account mới (OAuth):
```java
// Step 1: Tìm USER role
Role userRole = roleDomainService.findById("USER")  // Tìm bằng name
    .orElseThrow(() -> new AppException(ErrorCode.ROLE_USER_NOT_FOUND));

// Step 2: Tạo AccountRole
AccountRole accountRole = new AccountRole();
accountRole.setAccountId(savedAccount.getId());
accountRole.setRoleId(userRole.getName());  // Lưu Role.name vào roleId
accountRoleDomainService.save(accountRole);
```

### Khi lấy roles cho account:
```java
// Step 1: Lấy AccountRole list
List<AccountRole> accountRoles = accountRoleDomainService.findByFields(
    Map.of("accountId", account.getId())
);

// Step 2: Convert AccountRole → Role → Role name
List<String> roles = accountRoles.stream()
    .map(AccountRole::getRoleId)                    // Lấy roleId (là Role.name)
    .map(roleId -> roleDomainService.findById(roleId).orElse(null))  // Tìm Role bằng name
    .filter(Objects::nonNull)
    .map(Role::getName)                              // Lấy Role.getName()
    .collect(Collectors.toList());
```

**Kết quả:** `roles` list chứa các giá trị từ `Role.getName()` - có thể là "USER", "ADMIN", "STAFF", "MANAGER" (uppercase) hoặc "user", "admin", etc. (lowercase) tùy vào data trong database.

## 3. JWT Token với Roles

### JWT Token Structure:
```java
JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
    .claim("scope", buildScope(roles))      // "ROLE_USER ROLE_ADMIN" (với prefix ROLE_)
    .claim("roles", roles)                  // ["USER", "ADMIN"] hoặc ["user", "admin"]
    .build();
```

### buildScope() Method:
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
- Nếu `roles = ["USER", "ADMIN"]` → `scope = "ROLE_USER ROLE_ADMIN"`
- Nếu `roles = ["user", "admin"]` → `scope = "ROLE_user ROLE_admin"`

## 4. @PreAuthorize Requirements

### RoomController & RoomTypeController:
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```

**Yêu cầu:**
- Authorities: `STAFF`, `MANAGER`, hoặc `ADMIN` (uppercase, không có prefix `ROLE_`)
- Spring Security cần Authentication object trong SecurityContext
- Authentication object phải có authorities đúng format

## 5. Vấn Đề Phát Hiện

### Vấn đề 1: Role Name Format
- **Database**: Role.name có thể là "USER", "ADMIN" (uppercase) hoặc "user", "admin" (lowercase) tùy vào data
- **JWT Token**: `roles: ["USER", "ADMIN"]` hoặc `roles: ["user", "admin"]` (tùy vào Role.getName())
- **@PreAuthorize**: Yêu cầu "ADMIN" (uppercase, không có prefix ROLE_)

**Nếu Role.getName() trả về lowercase:**
- JWT có `roles: ["admin"]`
- Nhưng @PreAuthorize yêu cầu "ADMIN"
- Cần map "admin" → "ADMIN" khi set authorities

### Vấn đề 2: Không có JWT Filter
- Backend không có filter để parse JWT token và set Authentication
- Khi `@PreAuthorize` được kiểm tra, SecurityContext không có Authentication
- Dẫn đến lỗi `SYSTEM_ERROR`

## 6. Mapping Roles → Authorities

### Cần map roles từ JWT token sang authorities:
```java
// JWT token có: roles = ["admin", "user"] (lowercase)
// Cần map thành: authorities = ["ADMIN", "USER"] (uppercase)

List<GrantedAuthority> authorities = roles.stream()
    .map(role -> role.toUpperCase())              // "admin" → "ADMIN"
    .map(role -> new SimpleGrantedAuthority(role)) // "ADMIN" authority
    .collect(Collectors.toList());
```

## 7. Kết Luận

**Cơ chế role ở backend:**
1. ✅ Roles được lưu trong database với `name` là primary key
2. ✅ AccountRole lưu `roleId` = `Role.name`
3. ✅ Khi tạo JWT token, roles được lấy từ `Role.getName()`
4. ✅ JWT token có `roles` claim và `scope` claim (với prefix ROLE_)

**Vấn đề:**
1. ❌ Không có JWT Filter để parse token và set Authentication
2. ❌ Không có mapping từ roles (có thể lowercase) sang authorities (uppercase)
3. ❌ @PreAuthorize không thể hoạt động vì không có Authentication trong SecurityContext

**Giải pháp cần thiết:**
- Thêm JWT Filter để parse token và set Authentication
- Map roles từ token (có thể lowercase) sang authorities (uppercase) để match với @PreAuthorize


## 1. Role Structure

### RoleCode Enum
```java
public enum RoleCode {
    USER("USER"),
    ADMIN("ADMIN"),
    STAFF("STAFF"),
    MANAGER("MANAGER");
}
```
- Định nghĩa các role codes: **USER**, **ADMIN**, **STAFF**, **MANAGER** (uppercase)

### Role Entity
```java
@Entity
@Table(name = "roles")
public class Role extends BaseEntity<String> {
    @Id
    @Column(name = "name", nullable = false, length = 100)
    private String name;  // Primary key: "USER", "ADMIN", "STAFF", "MANAGER"
    
    @Column(name = "code", nullable = false, length = 50)
    private String code;  // "USER", "ADMIN", etc.
    
    @Column(name = "description", length = 255)
    private String description;
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
}
```

**Quan trọng:**
- `name` là **primary key** của Role table
- `name` được dùng để tìm role: `roleDomainService.findById("USER")`
- `name` được lưu vào `AccountRole.roleId`
- `Role.getName()` được dùng trong JWT token

### AccountRole Entity
```java
@Entity
@Table(name = "accounts_roles")
public class AccountRole extends BaseEntity<Long> {
    @Column(name = "account_id", nullable = false)
    private String accountId;
    
    @Column(name = "role_id", nullable = false)
    private String roleId;  // Là Role.name (primary key)
    
    @Column(name = "assigned_at", nullable = false)
    private LocalDateTime assignedAt;
}
```

**Quan trọng:**
- `roleId` trong `AccountRole` là `Role.name` (không phải `Role.code`)
- Khi lấy roles: `AccountRole.getRoleId()` → `Role.findById(roleId)` → `Role.getName()`

## 2. Role Assignment Flow

### Khi tạo account mới (OAuth):
```java
// Step 1: Tìm USER role
Role userRole = roleDomainService.findById("USER")  // Tìm bằng name
    .orElseThrow(() -> new AppException(ErrorCode.ROLE_USER_NOT_FOUND));

// Step 2: Tạo AccountRole
AccountRole accountRole = new AccountRole();
accountRole.setAccountId(savedAccount.getId());
accountRole.setRoleId(userRole.getName());  // Lưu Role.name vào roleId
accountRoleDomainService.save(accountRole);
```

### Khi lấy roles cho account:
```java
// Step 1: Lấy AccountRole list
List<AccountRole> accountRoles = accountRoleDomainService.findByFields(
    Map.of("accountId", account.getId())
);

// Step 2: Convert AccountRole → Role → Role name
List<String> roles = accountRoles.stream()
    .map(AccountRole::getRoleId)                    // Lấy roleId (là Role.name)
    .map(roleId -> roleDomainService.findById(roleId).orElse(null))  // Tìm Role bằng name
    .filter(Objects::nonNull)
    .map(Role::getName)                              // Lấy Role.getName()
    .collect(Collectors.toList());
```

**Kết quả:** `roles` list chứa các giá trị từ `Role.getName()` - có thể là "USER", "ADMIN", "STAFF", "MANAGER" (uppercase) hoặc "user", "admin", etc. (lowercase) tùy vào data trong database.

## 3. JWT Token với Roles

### JWT Token Structure:
```java
JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
    .claim("scope", buildScope(roles))      // "ROLE_USER ROLE_ADMIN" (với prefix ROLE_)
    .claim("roles", roles)                  // ["USER", "ADMIN"] hoặc ["user", "admin"]
    .build();
```

### buildScope() Method:
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
- Nếu `roles = ["USER", "ADMIN"]` → `scope = "ROLE_USER ROLE_ADMIN"`
- Nếu `roles = ["user", "admin"]` → `scope = "ROLE_user ROLE_admin"`

## 4. @PreAuthorize Requirements

### RoomController & RoomTypeController:
```java
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
```

**Yêu cầu:**
- Authorities: `STAFF`, `MANAGER`, hoặc `ADMIN` (uppercase, không có prefix `ROLE_`)
- Spring Security cần Authentication object trong SecurityContext
- Authentication object phải có authorities đúng format

## 5. Vấn Đề Phát Hiện

### Vấn đề 1: Role Name Format
- **Database**: Role.name có thể là "USER", "ADMIN" (uppercase) hoặc "user", "admin" (lowercase) tùy vào data
- **JWT Token**: `roles: ["USER", "ADMIN"]` hoặc `roles: ["user", "admin"]` (tùy vào Role.getName())
- **@PreAuthorize**: Yêu cầu "ADMIN" (uppercase, không có prefix ROLE_)

**Nếu Role.getName() trả về lowercase:**
- JWT có `roles: ["admin"]`
- Nhưng @PreAuthorize yêu cầu "ADMIN"
- Cần map "admin" → "ADMIN" khi set authorities

### Vấn đề 2: Không có JWT Filter
- Backend không có filter để parse JWT token và set Authentication
- Khi `@PreAuthorize` được kiểm tra, SecurityContext không có Authentication
- Dẫn đến lỗi `SYSTEM_ERROR`

## 6. Mapping Roles → Authorities

### Cần map roles từ JWT token sang authorities:
```java
// JWT token có: roles = ["admin", "user"] (lowercase)
// Cần map thành: authorities = ["ADMIN", "USER"] (uppercase)

List<GrantedAuthority> authorities = roles.stream()
    .map(role -> role.toUpperCase())              // "admin" → "ADMIN"
    .map(role -> new SimpleGrantedAuthority(role)) // "ADMIN" authority
    .collect(Collectors.toList());
```

## 7. Kết Luận

**Cơ chế role ở backend:**
1. ✅ Roles được lưu trong database với `name` là primary key
2. ✅ AccountRole lưu `roleId` = `Role.name`
3. ✅ Khi tạo JWT token, roles được lấy từ `Role.getName()`
4. ✅ JWT token có `roles` claim và `scope` claim (với prefix ROLE_)

**Vấn đề:**
1. ❌ Không có JWT Filter để parse token và set Authentication
2. ❌ Không có mapping từ roles (có thể lowercase) sang authorities (uppercase)
3. ❌ @PreAuthorize không thể hoạt động vì không có Authentication trong SecurityContext

**Giải pháp cần thiết:**
- Thêm JWT Filter để parse token và set Authentication
- Map roles từ token (có thể lowercase) sang authorities (uppercase) để match với @PreAuthorize

