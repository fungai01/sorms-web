# Backend Admin Data Loading Mechanism

## Backend Authorization Requirements

### 1. Controller Authorization
- **RoomController**: `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`
- **RoomTypeController**: `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`

### 2. JWT Token Structure
The backend generates JWT tokens with:
- `scope`: "ROLE_admin ROLE_user" (with `ROLE_` prefix)
- `roles`: ["admin", "user"] (lowercase)
- `accountInfo`: Full account information as JSON string

### 3. Security Configuration
- `WebSecurityConfig` has `auth.requestMatchers("/**").permitAll()` which permits all requests
- However, `@PreAuthorize` annotations are still checked by Spring Security's method security
- The backend must parse JWT and extract authorities from the `scope` claim

### 4. API Response Format
Backend returns standard `ApiResponse<T>` format:
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": T
}
```

For errors:
```json
{
  "responseCode": "S0001",
  "message": "SYSTEM_ERROR",
  "data": null
}
```

## Frontend Configuration

### 1. Token Forwarding
- Frontend must send `Authorization: Bearer <token>` header
- Token is extracted from `authService.getAccessToken()` or cookies
- Next.js API routes must forward the Authorization header to backend

### 2. API Client Configuration
- `api-client.ts` correctly extracts token from:
  1. `options.headers` (from Next.js API routes)
  2. `authService.getAccessToken()` (client-side)
  3. Server cookies (fallback)
- Token is added as `Authorization: Bearer <token>` header

### 3. Next.js API Routes
- `/api/system/rooms/route.ts`: Forwards Authorization header to `apiClient.getRooms({ headers })`
- `/api/system/room-types/route.ts`: Forwards Authorization header to `apiClient.getRoomTypes({ headers })`
- `/api/dashboard/occupancy/route.ts`: Forwards Authorization header to `apiClient.getRooms({ headers })`

### 4. Response Parsing
- Frontend correctly parses `ApiResponse<T>` format
- Checks `responseCode === 'S0000'` for success
- Maps error codes using `getErrorMessage()` utility

## Current Issue

Backend is returning `{"responseCode":"S0001","message":"SYSTEM_ERROR","data":null}` for `/api/system/rooms` and `/api/system/room-types` requests, even though:
- Frontend is correctly sending Authorization header
- Token is valid and contains admin role
- Request format matches backend expectations

This suggests the backend's `@PreAuthorize` check is failing, or there's an internal error in the service layer when processing the request.

## Frontend Fixes Applied

1. ✅ Token forwarding from Next.js API routes to backend
2. ✅ Correct Authorization header format (`Bearer <token>`)
3. ✅ Proper response parsing for `ApiResponse<T>` format
4. ✅ Error code mapping for user-friendly messages
5. ✅ Logging for debugging token propagation

## Next Steps

Since the backend code is considered correct, the issue may be:
1. Backend's JWT parsing/authority extraction mechanism
2. Backend's service layer expecting authenticated user in SecurityContext
3. Backend's `@PreAuthorize` not recognizing `ROLE_admin` as `ADMIN` authority

However, since we cannot modify backend code, we must ensure frontend is configured correctly, which has been done.

## Backend Authorization Requirements

### 1. Controller Authorization
- **RoomController**: `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`
- **RoomTypeController**: `@PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")`

### 2. JWT Token Structure
The backend generates JWT tokens with:
- `scope`: "ROLE_admin ROLE_user" (with `ROLE_` prefix)
- `roles`: ["admin", "user"] (lowercase)
- `accountInfo`: Full account information as JSON string

### 3. Security Configuration
- `WebSecurityConfig` has `auth.requestMatchers("/**").permitAll()` which permits all requests
- However, `@PreAuthorize` annotations are still checked by Spring Security's method security
- The backend must parse JWT and extract authorities from the `scope` claim

### 4. API Response Format
Backend returns standard `ApiResponse<T>` format:
```json
{
  "responseCode": "S0000",
  "message": "SUCCESS",
  "data": T
}
```

For errors:
```json
{
  "responseCode": "S0001",
  "message": "SYSTEM_ERROR",
  "data": null
}
```

## Frontend Configuration

### 1. Token Forwarding
- Frontend must send `Authorization: Bearer <token>` header
- Token is extracted from `authService.getAccessToken()` or cookies
- Next.js API routes must forward the Authorization header to backend

### 2. API Client Configuration
- `api-client.ts` correctly extracts token from:
  1. `options.headers` (from Next.js API routes)
  2. `authService.getAccessToken()` (client-side)
  3. Server cookies (fallback)
- Token is added as `Authorization: Bearer <token>` header

### 3. Next.js API Routes
- `/api/system/rooms/route.ts`: Forwards Authorization header to `apiClient.getRooms({ headers })`
- `/api/system/room-types/route.ts`: Forwards Authorization header to `apiClient.getRoomTypes({ headers })`
- `/api/dashboard/occupancy/route.ts`: Forwards Authorization header to `apiClient.getRooms({ headers })`

### 4. Response Parsing
- Frontend correctly parses `ApiResponse<T>` format
- Checks `responseCode === 'S0000'` for success
- Maps error codes using `getErrorMessage()` utility

## Current Issue

Backend is returning `{"responseCode":"S0001","message":"SYSTEM_ERROR","data":null}` for `/api/system/rooms` and `/api/system/room-types` requests, even though:
- Frontend is correctly sending Authorization header
- Token is valid and contains admin role
- Request format matches backend expectations

This suggests the backend's `@PreAuthorize` check is failing, or there's an internal error in the service layer when processing the request.

## Frontend Fixes Applied

1. ✅ Token forwarding from Next.js API routes to backend
2. ✅ Correct Authorization header format (`Bearer <token>`)
3. ✅ Proper response parsing for `ApiResponse<T>` format
4. ✅ Error code mapping for user-friendly messages
5. ✅ Logging for debugging token propagation

## Next Steps

Since the backend code is considered correct, the issue may be:
1. Backend's JWT parsing/authority extraction mechanism
2. Backend's service layer expecting authenticated user in SecurityContext
3. Backend's `@PreAuthorize` not recognizing `ROLE_admin` as `ADMIN` authority

However, since we cannot modify backend code, we must ensure frontend is configured correctly, which has been done.
