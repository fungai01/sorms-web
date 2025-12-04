# Identity Controllers Authorization Analysis

## Tổng Quan

Phân tích 4 controllers trong package `identity`:
1. **RoleController** - Quản lý roles
2. **UserManagementController** - Quản lý users
3. **StaffTaskController** - Quản lý staff tasks
4. **StaffManagementController** - Quản lý staff profiles

## 1. RoleController

**File**: `RoleController.java`
**Base Path**: `/roles`
**Authorization**: `@PreAuthorize("hasAuthority('ADMIN')")` ✅

**Endpoints:**
- `POST /roles` - Create role
- `PUT /roles/{id}` - Update role
- `PUT /roles/{id}/activate` - Activate role
- `PUT /roles/{id}/deactivate` - Deactivate role
- `DELETE /roles/{id}` - Delete role
- `GET /roles/search` - Search roles (pagination)
- `GET /roles/{id}` - Get role by ID

**Yêu cầu quyền:** Chỉ **ADMIN** mới truy cập được tất cả endpoints.

**✅ Đúng:** Có `@PreAuthorize` annotation ở class level.

## 2. UserManagementController

**File**: `UserManagementController.java`
**Base Path**: `/users`
**Authorization**: `@PreAuthorize("hasAuthority('ADMIN')")` ✅

**Endpoints:**
- `GET /users/search` - Search users (pagination)
- `POST /users` - Create user
- `PUT /users/{id}` - Update user
- `DELETE /users/{id}` - Delete user
- `PUT /users/{id}/activate` - Activate user
- `PUT /users/{id}/deactivate` - Deactivate user

**Yêu cầu quyền:** Chỉ **ADMIN** mới truy cập được tất cả endpoints.

**✅ Đúng:** Có `@PreAuthorize` annotation ở class level.

## 3. StaffTaskController

**File**: `StaffTaskController.java`
**Base Path**: `/staff-tasks`
**Authorization**: `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")` ✅

**Endpoints:**
- `POST /staff-tasks` - Create staff task
- `PUT /staff-tasks/{id}` - Update staff task
- `DELETE /staff-tasks/{id}` - Delete staff task
- `GET /staff-tasks/{id}` - Get staff task by ID
- `GET /staff-tasks` - Get all staff tasks
- `GET /staff-tasks/by-assignee/{assignedTo}` - Get tasks by assignee
- `GET /staff-tasks/by-status` - Get tasks by status
- `GET /staff-tasks/by-related` - Get tasks by related entity

**Yêu cầu quyền:** **STAFF**, **MANAGER**, hoặc **ADMIN** mới truy cập được.

**✅ Đúng:** Có `@PreAuthorize` annotation ở class level.

## 4. StaffManagementController

**File**: `StaffManagementController.java`
**Base Path**: `/staff-profiles`
**Authorization**: **KHÔNG CÓ @PreAuthorize** ❌

**Endpoints:**
- `POST /staff-profiles` - Create staff profile
- `PUT /staff-profiles/{id}` - Update staff profile
- `DELETE /staff-profiles/{id}` - Delete staff profile
- `GET /staff-profiles/{id}` - Get staff profile by ID
- `GET /staff-profiles` - Get all staff profiles
- `GET /staff-profiles/by-department/{department}` - Get profiles by department
- `GET /staff-profiles/by-status` - Get profiles by status

**Yêu cầu quyền:** **KHÔNG CÓ** - Tất cả endpoints có thể truy cập mà không cần authentication/authorization!

**❌ Vấn đề nghiêm trọng:** Không có `@PreAuthorize` annotation, có nghĩa là:
- Bất kỳ ai cũng có thể tạo, sửa, xóa staff profiles
- Không có kiểm tra quyền truy cập
- Lỗ hổng bảo mật nghiêm trọng

## So Sánh Authorization

| Controller | Base Path | @PreAuthorize | Yêu Cầu Quyền |
|------------|-----------|---------------|---------------|
| RoleController | `/roles` | ✅ `hasAuthority('ADMIN')` | ADMIN only |
| UserManagementController | `/users` | ✅ `hasAuthority('ADMIN')` | ADMIN only |
| StaffTaskController | `/staff-tasks` | ✅ `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')` | STAFF, MANAGER, ADMIN |
| StaffManagementController | `/staff-profiles` | ❌ **KHÔNG CÓ** | **KHÔNG CÓ** |

## Vấn Đề Phát Hiện

### 1. StaffManagementController Không Có Authorization

**Vấn đề:**
- Không có `@PreAuthorize` annotation
- Tất cả endpoints có thể truy cập mà không cần authentication
- Lỗ hổng bảo mật nghiêm trọng

**Cần sửa:**
```java
@RestController
@RequestMapping("/staff-profiles")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // ✅ Thêm annotation này
public class StaffManagementController {
    // ...
}
```

**Hoặc nếu chỉ ADMIN mới quản lý được:**
```java
@PreAuthorize("hasAuthority('ADMIN')")  // Chỉ ADMIN
```

### 2. Tất Cả Controllers Đều Phụ Thuộc Vào @PreAuthorize

**Vấn đề:**
- Tất cả controllers đều có `@PreAuthorize` annotations
- Nhưng backend không có JWT Filter để parse token và set Authentication
- `@PreAuthorize` không thể hoạt động vì không có Authentication trong SecurityContext
- Dẫn đến lỗi `SYSTEM_ERROR` (S0001)

**Cần sửa:**
- Thêm JWT Filter để parse token và set Authentication vào SecurityContext
- Sau đó `@PreAuthorize` mới hoạt động đúng

## Kết Luận

### Controllers Có Authorization Đúng:
1. ✅ **RoleController** - Chỉ ADMIN
2. ✅ **UserManagementController** - Chỉ ADMIN
3. ✅ **StaffTaskController** - STAFF, MANAGER, ADMIN

### Controllers Thiếu Authorization:
1. ❌ **StaffManagementController** - **KHÔNG CÓ @PreAuthorize**

### Vấn Đề Chung:
- Tất cả controllers phụ thuộc vào `@PreAuthorize`
- Nhưng backend không có JWT Filter
- `@PreAuthorize` không hoạt động → Trả về `SYSTEM_ERROR`

### Cần Sửa:
1. **Thêm @PreAuthorize cho StaffManagementController**
2. **Thêm JWT Filter để parse token và set Authentication**
3. **Đảm bảo roles từ token được map đúng thành authorities (uppercase)**


## Tổng Quan

Phân tích 4 controllers trong package `identity`:
1. **RoleController** - Quản lý roles
2. **UserManagementController** - Quản lý users
3. **StaffTaskController** - Quản lý staff tasks
4. **StaffManagementController** - Quản lý staff profiles

## 1. RoleController

**File**: `RoleController.java`
**Base Path**: `/roles`
**Authorization**: `@PreAuthorize("hasAuthority('ADMIN')")` ✅

**Endpoints:**
- `POST /roles` - Create role
- `PUT /roles/{id}` - Update role
- `PUT /roles/{id}/activate` - Activate role
- `PUT /roles/{id}/deactivate` - Deactivate role
- `DELETE /roles/{id}` - Delete role
- `GET /roles/search` - Search roles (pagination)
- `GET /roles/{id}` - Get role by ID

**Yêu cầu quyền:** Chỉ **ADMIN** mới truy cập được tất cả endpoints.

**✅ Đúng:** Có `@PreAuthorize` annotation ở class level.

## 2. UserManagementController

**File**: `UserManagementController.java`
**Base Path**: `/users`
**Authorization**: `@PreAuthorize("hasAuthority('ADMIN')")` ✅

**Endpoints:**
- `GET /users/search` - Search users (pagination)
- `POST /users` - Create user
- `PUT /users/{id}` - Update user
- `DELETE /users/{id}` - Delete user
- `PUT /users/{id}/activate` - Activate user
- `PUT /users/{id}/deactivate` - Deactivate user

**Yêu cầu quyền:** Chỉ **ADMIN** mới truy cập được tất cả endpoints.

**✅ Đúng:** Có `@PreAuthorize` annotation ở class level.

## 3. StaffTaskController

**File**: `StaffTaskController.java`
**Base Path**: `/staff-tasks`
**Authorization**: `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")` ✅

**Endpoints:**
- `POST /staff-tasks` - Create staff task
- `PUT /staff-tasks/{id}` - Update staff task
- `DELETE /staff-tasks/{id}` - Delete staff task
- `GET /staff-tasks/{id}` - Get staff task by ID
- `GET /staff-tasks` - Get all staff tasks
- `GET /staff-tasks/by-assignee/{assignedTo}` - Get tasks by assignee
- `GET /staff-tasks/by-status` - Get tasks by status
- `GET /staff-tasks/by-related` - Get tasks by related entity

**Yêu cầu quyền:** **STAFF**, **MANAGER**, hoặc **ADMIN** mới truy cập được.

**✅ Đúng:** Có `@PreAuthorize` annotation ở class level.

## 4. StaffManagementController

**File**: `StaffManagementController.java`
**Base Path**: `/staff-profiles`
**Authorization**: **KHÔNG CÓ @PreAuthorize** ❌

**Endpoints:**
- `POST /staff-profiles` - Create staff profile
- `PUT /staff-profiles/{id}` - Update staff profile
- `DELETE /staff-profiles/{id}` - Delete staff profile
- `GET /staff-profiles/{id}` - Get staff profile by ID
- `GET /staff-profiles` - Get all staff profiles
- `GET /staff-profiles/by-department/{department}` - Get profiles by department
- `GET /staff-profiles/by-status` - Get profiles by status

**Yêu cầu quyền:** **KHÔNG CÓ** - Tất cả endpoints có thể truy cập mà không cần authentication/authorization!

**❌ Vấn đề nghiêm trọng:** Không có `@PreAuthorize` annotation, có nghĩa là:
- Bất kỳ ai cũng có thể tạo, sửa, xóa staff profiles
- Không có kiểm tra quyền truy cập
- Lỗ hổng bảo mật nghiêm trọng

## So Sánh Authorization

| Controller | Base Path | @PreAuthorize | Yêu Cầu Quyền |
|------------|-----------|---------------|---------------|
| RoleController | `/roles` | ✅ `hasAuthority('ADMIN')` | ADMIN only |
| UserManagementController | `/users` | ✅ `hasAuthority('ADMIN')` | ADMIN only |
| StaffTaskController | `/staff-tasks` | ✅ `hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')` | STAFF, MANAGER, ADMIN |
| StaffManagementController | `/staff-profiles` | ❌ **KHÔNG CÓ** | **KHÔNG CÓ** |

## Vấn Đề Phát Hiện

### 1. StaffManagementController Không Có Authorization

**Vấn đề:**
- Không có `@PreAuthorize` annotation
- Tất cả endpoints có thể truy cập mà không cần authentication
- Lỗ hổng bảo mật nghiêm trọng

**Cần sửa:**
```java
@RestController
@RequestMapping("/staff-profiles")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")  // ✅ Thêm annotation này
public class StaffManagementController {
    // ...
}
```

**Hoặc nếu chỉ ADMIN mới quản lý được:**
```java
@PreAuthorize("hasAuthority('ADMIN')")  // Chỉ ADMIN
```

### 2. Tất Cả Controllers Đều Phụ Thuộc Vào @PreAuthorize

**Vấn đề:**
- Tất cả controllers đều có `@PreAuthorize` annotations
- Nhưng backend không có JWT Filter để parse token và set Authentication
- `@PreAuthorize` không thể hoạt động vì không có Authentication trong SecurityContext
- Dẫn đến lỗi `SYSTEM_ERROR` (S0001)

**Cần sửa:**
- Thêm JWT Filter để parse token và set Authentication vào SecurityContext
- Sau đó `@PreAuthorize` mới hoạt động đúng

## Kết Luận

### Controllers Có Authorization Đúng:
1. ✅ **RoleController** - Chỉ ADMIN
2. ✅ **UserManagementController** - Chỉ ADMIN
3. ✅ **StaffTaskController** - STAFF, MANAGER, ADMIN

### Controllers Thiếu Authorization:
1. ❌ **StaffManagementController** - **KHÔNG CÓ @PreAuthorize**

### Vấn Đề Chung:
- Tất cả controllers phụ thuộc vào `@PreAuthorize`
- Nhưng backend không có JWT Filter
- `@PreAuthorize` không hoạt động → Trả về `SYSTEM_ERROR`

### Cần Sửa:
1. **Thêm @PreAuthorize cho StaffManagementController**
2. **Thêm JWT Filter để parse token và set Authentication**
3. **Đảm bảo roles từ token được map đúng thành authorities (uppercase)**

