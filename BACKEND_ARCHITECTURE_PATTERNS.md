# Backend Architecture & Patterns Analysis

## Tổng quan

Backend SORMS sử dụng **Clean Architecture** với **Domain-Driven Design (DDD)** principles, được tổ chức thành 3 layers chính:
- **Application Layer**: Controllers, Services, Models, Mappers
- **Domain Layer**: Domain models, Domain services, Business logic
- **Infrastructure Layer**: Database, External services, Configuration

---

## 1. Exception Handling

### Exception Classes

#### AppException
- **Purpose:** Business logic errors
- **Fields:** `errorKey`, `errorMessage`, `statusCode`
- **Usage:** Throw với `ErrorCode` enum
- **Example:** `throw new AppException(ErrorCode.ROOM_NOT_FOUND)`

#### ResourceNotFoundException
- **Purpose:** Resource not found errors
- **Usage:** Có thể được sử dụng nhưng không được handle trong GlobalExceptionHandler

#### SystemValidatorException
- **Purpose:** Validation errors từ FluentValidator
- **Usage:** Thrown trong `AbstractAppService.validate()`

### GlobalExceptionHandler

**@ControllerAdvice** - Xử lý tất cả exceptions globally

**Exception Handlers:**

1. **Exception (Generic)**
   - Catch-all cho system errors
   - Returns: `SYSTEM_ERROR` (S0001)
   - Status: 500 Internal Server Error
   - Logs: Full stack trace

2. **AppException**
   - Business logic errors
   - Returns: Error code và message từ exception
   - Status: Từ `ErrorCode.statusCode`
   - Logs: Error message (info level)

3. **AccessDeniedException**
   - Authorization errors
   - Returns: `UNAUTHORIZED` (S0006)
   - Status: 401 Unauthorized

4. **MethodArgumentNotValidException**
   - Validation errors từ `@Valid`
   - Returns: `INVALID_KEY` (S0002) hoặc mapped ErrorCode
   - Status: 400 Bad Request
   - Supports attribute mapping (ví dụ: `{min}` → actual value)

### ErrorCode Enum

**Structure:**
```java
ErrorCode(String key, String value, HttpStatus statusCode)
```

**Categories:**
- **S prefix:** System errors (S0000-S0010)
- **AU prefix:** Authentication errors (AU0001)
- **U prefix:** User errors (U0001-U0013)
- **R prefix:** Room errors (R0001-R0007)
- **RT prefix:** RoomType errors (RT0001-RT0006)
- **SV prefix:** Service errors (SV0001-SV0006)
- **B prefix:** Booking errors (B0001-B0015)
- **O prefix:** Order errors (O0001-O0014)
- **P prefix:** Payment errors (P0001-P0005)
- **RL prefix:** Role errors (RL0001-RL0007)
- **ST prefix:** Staff errors (ST0001-ST0008)
- **STT prefix:** StaffTask errors (STT0001-STT0006)
- **QR prefix:** QR Code errors (QR0001-QR0004)

**Total:** ~80 error codes

---

## 2. Mapper Pattern (MapStruct)

### Overview

Sử dụng **MapStruct** để map giữa:
- Domain entities ↔ Request/Response DTOs
- Request DTOs → Domain entities
- Update requests → Existing entities

### Mapper Configuration

```java
@Mapper(
    componentModel = "spring",  // Spring component
    nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE
)
```

### Common Mapper Methods

#### 1. Entity → Response
```java
RoomResponse toResponse(Room room);
```
- Map domain entity sang response DTO
- Có thể ignore một số fields
- Có thể map nested objects

#### 2. Request → Entity (Create)
```java
Room toEntity(CreateRoomRequest request);
```
- Map request sang entity mới
- Ignore: id, timestamps, audit fields, version

#### 3. Request → Entity (Update)
```java
void updateEntity(UpdateRoomRequest request, @MappingTarget Room room);
```
- Update existing entity từ request
- Ignore: id, timestamps, audit fields, version
- Chỉ update fields có trong request

### Mapper Examples

**RoomMapper:**
- `toResponse()`: Room → RoomResponse
- `toEntity()`: CreateRoomRequest → Room
- `updateEntity()`: UpdateRoomRequest → Room (update existing)

**UserMapper:**
- `toResponse()`: Account + UserProfile → UserResponse
- `toAccountEntity()`: CreateUserRequest → Account
- `toUserProfileEntity()`: CreateUserRequest → UserProfile
- `updateAccountEntity()`: UpdateUserRequest → Account
- `updateUserProfileEntity()`: UpdateUserRequest → UserProfile
- Custom methods: `mapGender()` cho enum conversion

**BookingMapper:**
- `toResponse()`: Booking → BookingResponse
- `toApprovalResponse()`: BookingApproval → BookingApprovalResponse
- `toCheckinResponse()`: Checkin → CheckinResponse
- Multiple entity types mapping

### Mapping Strategies

- **Null handling:** `IGNORE` - Không map null values
- **Field mapping:** `@Mapping(source, target)` - Custom field mapping
- **Ignore fields:** `@Mapping(target = "field", ignore = true)`
- **After mapping:** `@AfterMapping` - Custom logic sau khi map

---

## 3. Model Structure

### Request/Response Pattern

**Command Requests** (Write operations):
- `CreateXxxRequest`
- `UpdateXxxRequest`
- `DeleteXxxRequest`
- `ApproveXxxRequest`, `ActivateXxxRequest`, etc.

**Query Requests** (Read operations):
- `GetXxxByIdRequest`
- `GetAllXxxRequest`
- `GetXxxByStatusRequest`
- `SearchListXxxRequest` (với pagination)

**Responses:**
- `XxxResponse` - Single object
- `List<XxxResponse>` - List (trả về trực tiếp trong `data`)
- `PageResponse<XxxResponse>` - Paginated list (chỉ cho search endpoints)

### Request Structure Examples

**CreateRoomRequest:**
```java
{
  "code": String,
  "name": String,
  "roomTypeId": Long,
  "floor": Integer,
  "status": RoomStatus (optional),
  "description": String
}
```

**UpdateRoomRequest:**
```java
{
  "id": Long,  // Set by controller from path variable
  "code": String (optional),
  "name": String (optional),
  "roomTypeId": Long (optional),
  "floor": Integer (optional),
  "status": RoomStatus (optional),
  "description": String (optional)
}
```

**GetAllRoomsRequest:**
```java
{
  // Empty class - có thể extend với pagination/filtering
}
```

**SearchListUserRequest:**
```java
{
  "email": String (optional),
  "fullName": String (optional),
  "phoneNumber": String (optional),
  "idCardNumber": String (optional),
  "status": String (optional),
  "page": Integer (default: 0),
  "size": Integer (default: 10)
}
```

### Response Structure Examples

**RoomResponse:**
```java
{
  "id": Long,
  "code": String,
  "name": String,
  "roomTypeId": Long,
  "roomTypeCode": String,
  "roomTypeName": String,
  "floor": Integer,
  "status": RoomStatus,
  "description": String,
  "createdDate": LocalDateTime,
  "lastModifiedDate": LocalDateTime
}
```

**PageResponse<T>:**
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

---

## 4. Service Pattern

### AbstractAppService

**Base class** cho tất cả services:
```java
public abstract class AbstractAppService<T, K> {
    private final Validator<T> validator;  // Optional
    
    protected void validate(T t) { ... }
    public K handle(T t) {
        validate(t);
        return execute(t);
    }
    protected abstract K execute(T t);
}
```

**Pattern:**
- `T`: Request type
- `K`: Response type
- `validate()`: Auto-validation nếu có validator
- `execute()`: Business logic (abstract, must implement)

### Service Execution

**AppServiceExecution:**
- Map-based dependency injection
- Auto-registration qua `AppServiceConfig`
- Pattern: `Map<Class<?>, AbstractAppService<?, ?>>`
- Execution: `serviceMap.get(request.getClass()).handle(request)`

**Flow:**
1. Controller nhận request
2. Controller gọi `appServiceExecution.execute(request)`
3. `AppServiceExecution` tìm service tương ứng với request class
4. Service `handle()` → `validate()` → `execute()`
5. Return response

### Service Types

#### Command Services (Write Operations)
- Extend `AbstractAppService<CommandRequest, Response>`
- Examples: `CreateRoomService`, `UpdateRoomService`, `DeleteRoomService`
- Pattern:
  1. Validate input
  2. Fetch related entities (nếu cần)
  3. Map request → entity
  4. Save/Update/Delete entity
  5. Map entity → response
  6. Return response

#### Query Services (Read Operations)
- Extend `AbstractAppService<QueryRequest, Response>`
- Examples: `GetAllRoomsService`, `GetRoomByIdService`
- Pattern:
  1. Fetch entities từ domain service
  2. Map entities → responses
  3. Return response(s)

### Service Examples

**CreateRoomService:**
```java
1. Validate roomTypeId exists
2. Map CreateRoomRequest → Room entity
3. Set default status = AVAILABLE (nếu null)
4. Save room
5. Map Room → RoomResponse
6. Return response
```

**UpdateRoomService:**
```java
1. Find existing room (throw if not found)
2. Validate roomTypeId (nếu được update)
3. Map UpdateRoomRequest → existing Room entity
4. Save updated room
5. Map Room → RoomResponse
6. Return response
```

**DeleteRoomService:**
```java
1. Verify room exists (throw if not found)
2. Soft delete room
3. Return null (Void)
```

**GetRoomByIdService:**
```java
1. Find room by ID (throw if not found)
2. Map Room → RoomResponse
3. Return response
```

**GetAllRoomsService:**
```java
1. Find all rooms
2. Map List<Room> → List<RoomResponse>
3. Return list
```

---

## 5. Utils

### ResponseHelper

**Purpose:** Tạo standardized API responses

**Methods:**

1. **createSuccessResponse(ErrorCode, T data)**
   ```java
   ApiResponse<T> createSuccessResponse(ErrorCode successCode, T data)
   ```
   - Tạo success response với data
   - Thường dùng `ErrorCode.SUCCESS`
   - Returns: `ApiResponse` với `responseCode`, `message`, `data`

2. **createErrorResponse(ErrorCode)**
   ```java
   ApiResponse<T> createErrorResponse(ErrorCode errorCode)
   ```
   - Tạo error response
   - `data` = `null`
   - Returns: `ApiResponse` với `responseCode`, `message`, `data = null`

**Usage:** Tất cả controllers sử dụng `ResponseHelper` để tạo responses

### ErrorUtils

**Purpose:** Utility methods cho error handling

**Methods:**

1. **stackTraceToString(Throwable)**
   - Convert stack trace thành string
   - Sử dụng Apache Commons Lang3

2. **getMessage(Throwable)**
   - Get error message từ exception

**Usage:** `GlobalExceptionHandler` sử dụng để log errors

---

## 6. StartApplication

**Main class** của Spring Boot application:

```java
@SpringBootApplication
@EnableFeignClients  // Enable Feign clients
@ComponentScan(basePackages = {
    "vn.edu.fpt.sorms.application",
    "vn.edu.fpt.sorms.domain",
    "vn.edu.fpt.sorms.infrastructure"
})
public class StartApplication {
    public static void main(String[] args) {
        SpringApplication.run(StartApplication.class, args);
    }
}
```

**Key Annotations:**
- `@SpringBootApplication`: Auto-configuration
- `@EnableFeignClients`: Enable Spring Cloud OpenFeign
- `@ComponentScan`: Scan packages để tìm components

**Component Scan:**
- `application`: Controllers, Services, Models, Mappers
- `domain`: Domain models, Domain services
- `infrastructure`: Database, External services, Configuration

---

## 7. Architecture Patterns

### Clean Architecture Layers

**Application Layer:**
- Controllers (REST endpoints)
- Services (Business logic)
- Models (DTOs: Request/Response)
- Mappers (Entity ↔ DTO mapping)
- Exception handling

**Domain Layer:**
- Domain models (Entities)
- Domain services (Business logic)
- Domain repositories (Interfaces)
- Business rules và validations

**Infrastructure Layer:**
- Database repositories (Implementations)
- External service clients (Feign)
- Configuration (Security, CORS, etc.)

### Command/Query Separation (CQRS)

**Commands (Write):**
- `CreateXxxService`
- `UpdateXxxService`
- `DeleteXxxService`
- Request: `CommandRequest`
- Response: Single object hoặc Void

**Queries (Read):**
- `GetXxxByIdService`
- `GetAllXxxService`
- `GetXxxByStatusService`
- Request: `QueryRequest`
- Response: Single object, List, hoặc PageResponse

### Dependency Injection Pattern

**Service Registration:**
- `AppServiceConfig` scan tất cả `AbstractAppService` implementations
- Tạo Map: `requestClass → serviceInstance`
- Auto-registration khi application starts

**Service Lookup:**
- `AppServiceExecution` nhận request
- Tìm service từ Map bằng `request.getClass()`
- Execute service

**Benefits:**
- Type-safe service lookup
- No manual wiring needed
- Easy to add new services

### Request/Response Pattern

**Request Objects:**
- Separate classes cho mỗi operation
- Used as service input
- Can contain validation annotations
- Mapped to domain entities

**Response Objects:**
- Separate classes cho mỗi entity type
- Used as service output
- Mapped from domain entities
- Can contain computed fields

**Benefits:**
- Clear separation of concerns
- Type safety
- Easy to version APIs
- Can evolve independently

---

## 8. Important Patterns & Practices

### Soft Delete

- Entities không bị xóa thực sự
- Set `isDeleted = true` hoặc `deleted = true`
- Queries tự động filter deleted records

### Audit Fields

- `createdDate`, `lastModifiedDate`
- `createdBy`, `lastModifiedBy`
- `version` (optimistic locking)
- Auto-managed bởi Spring Data JPA

### Validation

- **Request validation:** FluentValidator trong `AbstractAppService`
- **Field validation:** `@Valid` annotations trong controllers
- **Business validation:** Trong service `execute()` methods

### Error Handling

- **Business errors:** Throw `AppException` với `ErrorCode`
- **System errors:** Caught bởi `GlobalExceptionHandler`
- **All errors:** Trả về `ApiResponse` format

### Logging

- Tất cả services sử dụng `@Slf4j`
- Log levels:
  - `log.info()`: Business operations
  - `log.error()`: Errors và exceptions
  - `log.warn()`: Warnings

### Null Safety

- Mappers ignore null values (`NullValuePropertyMappingStrategy.IGNORE`)
- Services check null và throw `AppException` nếu cần
- Optional handling với `.orElseThrow()`

---

## 9. Frontend Integration Notes

### Request Format

- **Content-Type:** `application/json` (trừ multipart/form-data)
- **Authorization:** `Bearer <jwt_token>` header
- **Request body:** JSON matching Request DTO structure

### Response Format

- **Always:** `{ responseCode, message, data }`
- **Success:** `responseCode = "S0000"`, `data` contains payload
- **Error:** `responseCode = error code`, `data = null`

### Error Handling

- **Check `responseCode`:**
  - `S0000`: Success
  - Other codes: Error
- **Error message:** Trong `message` field
- **HTTP status:** Map từ `ErrorCode.statusCode`

### List vs PageResponse

- **List endpoints:** `data` là array trực tiếp
- **Search endpoints:** `data` là `PageResponse` với `content` array
- **Frontend cần:** Parse đúng format dựa trên endpoint

### Request/Response Mapping

- **Request:** Map frontend form/data → Request DTO structure
- **Response:** Map Response DTO → Frontend state/display
- **Field names:** Có thể khác nhau (camelCase vs snake_case)

---

## 10. Best Practices Summary

1. **Always use Request/Response DTOs** - Không expose domain entities
2. **Use Mappers** - MapStruct cho type-safe mapping
3. **Validate inputs** - Request validation + business validation
4. **Handle errors properly** - Throw `AppException` với `ErrorCode`
5. **Log operations** - Info cho business ops, Error cho exceptions
6. **Use soft delete** - Không xóa thực sự records
7. **Separate Commands/Queries** - Clear separation of concerns
8. **Type-safe service lookup** - Map-based DI pattern
9. **Consistent error format** - Tất cả errors trả về `ApiResponse`
10. **Null safety** - Check và handle null values properly


## Tổng quan

Backend SORMS sử dụng **Clean Architecture** với **Domain-Driven Design (DDD)** principles, được tổ chức thành 3 layers chính:
- **Application Layer**: Controllers, Services, Models, Mappers
- **Domain Layer**: Domain models, Domain services, Business logic
- **Infrastructure Layer**: Database, External services, Configuration

---

## 1. Exception Handling

### Exception Classes

#### AppException
- **Purpose:** Business logic errors
- **Fields:** `errorKey`, `errorMessage`, `statusCode`
- **Usage:** Throw với `ErrorCode` enum
- **Example:** `throw new AppException(ErrorCode.ROOM_NOT_FOUND)`

#### ResourceNotFoundException
- **Purpose:** Resource not found errors
- **Usage:** Có thể được sử dụng nhưng không được handle trong GlobalExceptionHandler

#### SystemValidatorException
- **Purpose:** Validation errors từ FluentValidator
- **Usage:** Thrown trong `AbstractAppService.validate()`

### GlobalExceptionHandler

**@ControllerAdvice** - Xử lý tất cả exceptions globally

**Exception Handlers:**

1. **Exception (Generic)**
   - Catch-all cho system errors
   - Returns: `SYSTEM_ERROR` (S0001)
   - Status: 500 Internal Server Error
   - Logs: Full stack trace

2. **AppException**
   - Business logic errors
   - Returns: Error code và message từ exception
   - Status: Từ `ErrorCode.statusCode`
   - Logs: Error message (info level)

3. **AccessDeniedException**
   - Authorization errors
   - Returns: `UNAUTHORIZED` (S0006)
   - Status: 401 Unauthorized

4. **MethodArgumentNotValidException**
   - Validation errors từ `@Valid`
   - Returns: `INVALID_KEY` (S0002) hoặc mapped ErrorCode
   - Status: 400 Bad Request
   - Supports attribute mapping (ví dụ: `{min}` → actual value)

### ErrorCode Enum

**Structure:**
```java
ErrorCode(String key, String value, HttpStatus statusCode)
```

**Categories:**
- **S prefix:** System errors (S0000-S0010)
- **AU prefix:** Authentication errors (AU0001)
- **U prefix:** User errors (U0001-U0013)
- **R prefix:** Room errors (R0001-R0007)
- **RT prefix:** RoomType errors (RT0001-RT0006)
- **SV prefix:** Service errors (SV0001-SV0006)
- **B prefix:** Booking errors (B0001-B0015)
- **O prefix:** Order errors (O0001-O0014)
- **P prefix:** Payment errors (P0001-P0005)
- **RL prefix:** Role errors (RL0001-RL0007)
- **ST prefix:** Staff errors (ST0001-ST0008)
- **STT prefix:** StaffTask errors (STT0001-STT0006)
- **QR prefix:** QR Code errors (QR0001-QR0004)

**Total:** ~80 error codes

---

## 2. Mapper Pattern (MapStruct)

### Overview

Sử dụng **MapStruct** để map giữa:
- Domain entities ↔ Request/Response DTOs
- Request DTOs → Domain entities
- Update requests → Existing entities

### Mapper Configuration

```java
@Mapper(
    componentModel = "spring",  // Spring component
    nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE
)
```

### Common Mapper Methods

#### 1. Entity → Response
```java
RoomResponse toResponse(Room room);
```
- Map domain entity sang response DTO
- Có thể ignore một số fields
- Có thể map nested objects

#### 2. Request → Entity (Create)
```java
Room toEntity(CreateRoomRequest request);
```
- Map request sang entity mới
- Ignore: id, timestamps, audit fields, version

#### 3. Request → Entity (Update)
```java
void updateEntity(UpdateRoomRequest request, @MappingTarget Room room);
```
- Update existing entity từ request
- Ignore: id, timestamps, audit fields, version
- Chỉ update fields có trong request

### Mapper Examples

**RoomMapper:**
- `toResponse()`: Room → RoomResponse
- `toEntity()`: CreateRoomRequest → Room
- `updateEntity()`: UpdateRoomRequest → Room (update existing)

**UserMapper:**
- `toResponse()`: Account + UserProfile → UserResponse
- `toAccountEntity()`: CreateUserRequest → Account
- `toUserProfileEntity()`: CreateUserRequest → UserProfile
- `updateAccountEntity()`: UpdateUserRequest → Account
- `updateUserProfileEntity()`: UpdateUserRequest → UserProfile
- Custom methods: `mapGender()` cho enum conversion

**BookingMapper:**
- `toResponse()`: Booking → BookingResponse
- `toApprovalResponse()`: BookingApproval → BookingApprovalResponse
- `toCheckinResponse()`: Checkin → CheckinResponse
- Multiple entity types mapping

### Mapping Strategies

- **Null handling:** `IGNORE` - Không map null values
- **Field mapping:** `@Mapping(source, target)` - Custom field mapping
- **Ignore fields:** `@Mapping(target = "field", ignore = true)`
- **After mapping:** `@AfterMapping` - Custom logic sau khi map

---

## 3. Model Structure

### Request/Response Pattern

**Command Requests** (Write operations):
- `CreateXxxRequest`
- `UpdateXxxRequest`
- `DeleteXxxRequest`
- `ApproveXxxRequest`, `ActivateXxxRequest`, etc.

**Query Requests** (Read operations):
- `GetXxxByIdRequest`
- `GetAllXxxRequest`
- `GetXxxByStatusRequest`
- `SearchListXxxRequest` (với pagination)

**Responses:**
- `XxxResponse` - Single object
- `List<XxxResponse>` - List (trả về trực tiếp trong `data`)
- `PageResponse<XxxResponse>` - Paginated list (chỉ cho search endpoints)

### Request Structure Examples

**CreateRoomRequest:**
```java
{
  "code": String,
  "name": String,
  "roomTypeId": Long,
  "floor": Integer,
  "status": RoomStatus (optional),
  "description": String
}
```

**UpdateRoomRequest:**
```java
{
  "id": Long,  // Set by controller from path variable
  "code": String (optional),
  "name": String (optional),
  "roomTypeId": Long (optional),
  "floor": Integer (optional),
  "status": RoomStatus (optional),
  "description": String (optional)
}
```

**GetAllRoomsRequest:**
```java
{
  // Empty class - có thể extend với pagination/filtering
}
```

**SearchListUserRequest:**
```java
{
  "email": String (optional),
  "fullName": String (optional),
  "phoneNumber": String (optional),
  "idCardNumber": String (optional),
  "status": String (optional),
  "page": Integer (default: 0),
  "size": Integer (default: 10)
}
```

### Response Structure Examples

**RoomResponse:**
```java
{
  "id": Long,
  "code": String,
  "name": String,
  "roomTypeId": Long,
  "roomTypeCode": String,
  "roomTypeName": String,
  "floor": Integer,
  "status": RoomStatus,
  "description": String,
  "createdDate": LocalDateTime,
  "lastModifiedDate": LocalDateTime
}
```

**PageResponse<T>:**
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

---

## 4. Service Pattern

### AbstractAppService

**Base class** cho tất cả services:
```java
public abstract class AbstractAppService<T, K> {
    private final Validator<T> validator;  // Optional
    
    protected void validate(T t) { ... }
    public K handle(T t) {
        validate(t);
        return execute(t);
    }
    protected abstract K execute(T t);
}
```

**Pattern:**
- `T`: Request type
- `K`: Response type
- `validate()`: Auto-validation nếu có validator
- `execute()`: Business logic (abstract, must implement)

### Service Execution

**AppServiceExecution:**
- Map-based dependency injection
- Auto-registration qua `AppServiceConfig`
- Pattern: `Map<Class<?>, AbstractAppService<?, ?>>`
- Execution: `serviceMap.get(request.getClass()).handle(request)`

**Flow:**
1. Controller nhận request
2. Controller gọi `appServiceExecution.execute(request)`
3. `AppServiceExecution` tìm service tương ứng với request class
4. Service `handle()` → `validate()` → `execute()`
5. Return response

### Service Types

#### Command Services (Write Operations)
- Extend `AbstractAppService<CommandRequest, Response>`
- Examples: `CreateRoomService`, `UpdateRoomService`, `DeleteRoomService`
- Pattern:
  1. Validate input
  2. Fetch related entities (nếu cần)
  3. Map request → entity
  4. Save/Update/Delete entity
  5. Map entity → response
  6. Return response

#### Query Services (Read Operations)
- Extend `AbstractAppService<QueryRequest, Response>`
- Examples: `GetAllRoomsService`, `GetRoomByIdService`
- Pattern:
  1. Fetch entities từ domain service
  2. Map entities → responses
  3. Return response(s)

### Service Examples

**CreateRoomService:**
```java
1. Validate roomTypeId exists
2. Map CreateRoomRequest → Room entity
3. Set default status = AVAILABLE (nếu null)
4. Save room
5. Map Room → RoomResponse
6. Return response
```

**UpdateRoomService:**
```java
1. Find existing room (throw if not found)
2. Validate roomTypeId (nếu được update)
3. Map UpdateRoomRequest → existing Room entity
4. Save updated room
5. Map Room → RoomResponse
6. Return response
```

**DeleteRoomService:**
```java
1. Verify room exists (throw if not found)
2. Soft delete room
3. Return null (Void)
```

**GetRoomByIdService:**
```java
1. Find room by ID (throw if not found)
2. Map Room → RoomResponse
3. Return response
```

**GetAllRoomsService:**
```java
1. Find all rooms
2. Map List<Room> → List<RoomResponse>
3. Return list
```

---

## 5. Utils

### ResponseHelper

**Purpose:** Tạo standardized API responses

**Methods:**

1. **createSuccessResponse(ErrorCode, T data)**
   ```java
   ApiResponse<T> createSuccessResponse(ErrorCode successCode, T data)
   ```
   - Tạo success response với data
   - Thường dùng `ErrorCode.SUCCESS`
   - Returns: `ApiResponse` với `responseCode`, `message`, `data`

2. **createErrorResponse(ErrorCode)**
   ```java
   ApiResponse<T> createErrorResponse(ErrorCode errorCode)
   ```
   - Tạo error response
   - `data` = `null`
   - Returns: `ApiResponse` với `responseCode`, `message`, `data = null`

**Usage:** Tất cả controllers sử dụng `ResponseHelper` để tạo responses

### ErrorUtils

**Purpose:** Utility methods cho error handling

**Methods:**

1. **stackTraceToString(Throwable)**
   - Convert stack trace thành string
   - Sử dụng Apache Commons Lang3

2. **getMessage(Throwable)**
   - Get error message từ exception

**Usage:** `GlobalExceptionHandler` sử dụng để log errors

---

## 6. StartApplication

**Main class** của Spring Boot application:

```java
@SpringBootApplication
@EnableFeignClients  // Enable Feign clients
@ComponentScan(basePackages = {
    "vn.edu.fpt.sorms.application",
    "vn.edu.fpt.sorms.domain",
    "vn.edu.fpt.sorms.infrastructure"
})
public class StartApplication {
    public static void main(String[] args) {
        SpringApplication.run(StartApplication.class, args);
    }
}
```

**Key Annotations:**
- `@SpringBootApplication`: Auto-configuration
- `@EnableFeignClients`: Enable Spring Cloud OpenFeign
- `@ComponentScan`: Scan packages để tìm components

**Component Scan:**
- `application`: Controllers, Services, Models, Mappers
- `domain`: Domain models, Domain services
- `infrastructure`: Database, External services, Configuration

---

## 7. Architecture Patterns

### Clean Architecture Layers

**Application Layer:**
- Controllers (REST endpoints)
- Services (Business logic)
- Models (DTOs: Request/Response)
- Mappers (Entity ↔ DTO mapping)
- Exception handling

**Domain Layer:**
- Domain models (Entities)
- Domain services (Business logic)
- Domain repositories (Interfaces)
- Business rules và validations

**Infrastructure Layer:**
- Database repositories (Implementations)
- External service clients (Feign)
- Configuration (Security, CORS, etc.)

### Command/Query Separation (CQRS)

**Commands (Write):**
- `CreateXxxService`
- `UpdateXxxService`
- `DeleteXxxService`
- Request: `CommandRequest`
- Response: Single object hoặc Void

**Queries (Read):**
- `GetXxxByIdService`
- `GetAllXxxService`
- `GetXxxByStatusService`
- Request: `QueryRequest`
- Response: Single object, List, hoặc PageResponse

### Dependency Injection Pattern

**Service Registration:**
- `AppServiceConfig` scan tất cả `AbstractAppService` implementations
- Tạo Map: `requestClass → serviceInstance`
- Auto-registration khi application starts

**Service Lookup:**
- `AppServiceExecution` nhận request
- Tìm service từ Map bằng `request.getClass()`
- Execute service

**Benefits:**
- Type-safe service lookup
- No manual wiring needed
- Easy to add new services

### Request/Response Pattern

**Request Objects:**
- Separate classes cho mỗi operation
- Used as service input
- Can contain validation annotations
- Mapped to domain entities

**Response Objects:**
- Separate classes cho mỗi entity type
- Used as service output
- Mapped from domain entities
- Can contain computed fields

**Benefits:**
- Clear separation of concerns
- Type safety
- Easy to version APIs
- Can evolve independently

---

## 8. Important Patterns & Practices

### Soft Delete

- Entities không bị xóa thực sự
- Set `isDeleted = true` hoặc `deleted = true`
- Queries tự động filter deleted records

### Audit Fields

- `createdDate`, `lastModifiedDate`
- `createdBy`, `lastModifiedBy`
- `version` (optimistic locking)
- Auto-managed bởi Spring Data JPA

### Validation

- **Request validation:** FluentValidator trong `AbstractAppService`
- **Field validation:** `@Valid` annotations trong controllers
- **Business validation:** Trong service `execute()` methods

### Error Handling

- **Business errors:** Throw `AppException` với `ErrorCode`
- **System errors:** Caught bởi `GlobalExceptionHandler`
- **All errors:** Trả về `ApiResponse` format

### Logging

- Tất cả services sử dụng `@Slf4j`
- Log levels:
  - `log.info()`: Business operations
  - `log.error()`: Errors và exceptions
  - `log.warn()`: Warnings

### Null Safety

- Mappers ignore null values (`NullValuePropertyMappingStrategy.IGNORE`)
- Services check null và throw `AppException` nếu cần
- Optional handling với `.orElseThrow()`

---

## 9. Frontend Integration Notes

### Request Format

- **Content-Type:** `application/json` (trừ multipart/form-data)
- **Authorization:** `Bearer <jwt_token>` header
- **Request body:** JSON matching Request DTO structure

### Response Format

- **Always:** `{ responseCode, message, data }`
- **Success:** `responseCode = "S0000"`, `data` contains payload
- **Error:** `responseCode = error code`, `data = null`

### Error Handling

- **Check `responseCode`:**
  - `S0000`: Success
  - Other codes: Error
- **Error message:** Trong `message` field
- **HTTP status:** Map từ `ErrorCode.statusCode`

### List vs PageResponse

- **List endpoints:** `data` là array trực tiếp
- **Search endpoints:** `data` là `PageResponse` với `content` array
- **Frontend cần:** Parse đúng format dựa trên endpoint

### Request/Response Mapping

- **Request:** Map frontend form/data → Request DTO structure
- **Response:** Map Response DTO → Frontend state/display
- **Field names:** Có thể khác nhau (camelCase vs snake_case)

---

## 10. Best Practices Summary

1. **Always use Request/Response DTOs** - Không expose domain entities
2. **Use Mappers** - MapStruct cho type-safe mapping
3. **Validate inputs** - Request validation + business validation
4. **Handle errors properly** - Throw `AppException` với `ErrorCode`
5. **Log operations** - Info cho business ops, Error cho exceptions
6. **Use soft delete** - Không xóa thực sự records
7. **Separate Commands/Queries** - Clear separation of concerns
8. **Type-safe service lookup** - Map-based DI pattern
9. **Consistent error format** - Tất cả errors trả về `ApiResponse`
10. **Null safety** - Check và handle null values properly

