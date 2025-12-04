# Frontend Issue Analysis

## Vấn Đề Hiện Tại

Backend trả về `500 Internal Server Error` với response:
```json
{
  "responseCode": "S0001",
  "message": "SYSTEM_ERROR",
  "data": null
}
```

## Phân Tích Frontend Code

### 1. API Client Response Parsing

**File**: `src/lib/api-client.ts` (dòng 274-292)

```typescript
// Handle backend response format: {responseCode, message, data}
if (data.responseCode) {
  if (data.responseCode === 'S0000') {
    return {
      success: true,
      data: data.data,
    }
  } else {
    // Map common error codes to user-friendly messages
    const errorMessage = getErrorMessage(
      String(data.responseCode),
      data.message || data.error || ''
    )
    return {
      success: false,
      error: String(errorMessage),
    }
  }
}
```

**Vấn đề:**
- Khi backend trả về `responseCode: "S0001"`, `apiClient` sẽ return `{ success: false, error: ... }`
- Nhưng khi HTTP status là 200, code này sẽ chạy
- Khi HTTP status là 500, code ở dòng 202-269 sẽ chạy (error handling)

### 2. API Route Error Handling

**File**: `src/app/api/system/rooms/route.ts` (dòng 79-90)

```typescript
let response
try {
  response = await apiClient.getRooms(options);
} catch (apiError) {
  console.error('[API /system/rooms] Exception calling apiClient.getRooms:', {
    error: apiError,
    message: apiError instanceof Error ? apiError.message : String(apiError),
    stack: apiError instanceof Error ? apiError.stack : undefined
  });
  return NextResponse.json(
    { error: apiError instanceof Error ? apiError.message : 'Failed to fetch rooms' },
    { status: 500 }
  );
}
```

**Vấn đề:**
- Nếu `apiClient.getRooms()` trả về `{ success: false, error: ... }`, code vẫn tiếp tục
- Không check `response.success` trước khi return data

**File**: `src/app/api/system/rooms/route.ts` (dòng 102-110)

```typescript
if (response.success) {
  const data: any = response.data;
  // Backend trả về ApiResponse<List<RoomResponse>>
  // Format: { responseCode: "S0000", message: "SUCCESS", data: [RoomResponse, ...] }
  // data là array trực tiếp, không phải { content: [...] }
  const items = Array.isArray(data) ? data : [];
  console.log('[API /system/rooms] Returning items:', items.length);
  return NextResponse.json({ items, total: items.length });
}

console.error('[API /system/rooms] Failed to get all rooms:', {
  error: response.error,
  fullError: JSON.stringify(response, null, 2)
});
return NextResponse.json(
  { error: response.error || 'Failed to fetch rooms' },
  { status: 500 }
);
```

**✅ Đúng:** Code đã check `response.success` và return error nếu `success: false`

### 3. HTTP Error Handling trong API Client

**File**: `src/lib/api-client.ts` (dòng 202-269)

Khi backend trả về HTTP 500, code sẽ:
1. Parse error response body
2. Extract `responseCode` và `message`
3. Map error code sang user-friendly message
4. Return `{ success: false, error: ... }`

**Vấn đề tiềm ẩn:**
- Nếu backend trả về HTTP 500 nhưng response body không phải JSON, code sẽ fail
- Nếu response body là JSON nhưng không có `responseCode`, code sẽ dùng `response.statusText`

### 4. Dashboard Page Error Handling

**File**: `src/app/admin/dashboard/page.tsx` (dòng 511-521)

```typescript
if (!occRes.ok || !bRes.ok || !cRes.ok || !pRes.ok || !soRes.ok || !tRes.ok) {
  const failed = [
    !occRes.ok && 'occupancy',
    !bRes.ok && 'bookings', 
    !cRes.ok && 'checkins',
    !pRes.ok && 'payments',
    !soRes.ok && 'services',
    !tRes.ok && 'tasks'
  ].filter(Boolean);
  throw new Error(`HTTP error in: ${failed.join(', ')}`);
}
```

**Vấn đề:**
- Code chỉ check `response.ok`, không parse error message từ response body
- User chỉ thấy "HTTP error in: occupancy, bookings, ..." mà không biết lý do cụ thể

## Vấn Đề Thực Sự

### Vấn đề 1: Backend trả về 500 với SYSTEM_ERROR

**Nguyên nhân:**
- Backend không có JWT Filter để parse token và set Authentication
- `@PreAuthorize` annotations fail vì không có Authentication trong SecurityContext
- GlobalExceptionHandler catch exception và trả về `S0001` (SYSTEM_ERROR)

**Nhưng người dùng nói:** "vấn đề ở frontend không phải backend"

### Vấn đề 2: Frontend không parse error message đúng cách

**Vấn đề:**
- Dashboard page chỉ check `response.ok`, không parse error message
- API routes có parse error nhưng có thể không đầy đủ

### Vấn đề 3: Frontend không handle responseCode đúng cách

**Vấn đề:**
- Khi backend trả về HTTP 500 với `{ responseCode: "S0001", message: "SYSTEM_ERROR", data: null }`
- `apiClient` sẽ parse và return `{ success: false, error: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau." }`
- API routes sẽ return `{ error: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau." }` với status 500
- Dashboard page sẽ throw error với message generic

## Giải Pháp

### 1. Cải thiện Error Handling trong Dashboard

**File**: `src/app/admin/dashboard/page.tsx`

Cần parse error message từ response body:

```typescript
if (!occRes.ok) {
  try {
    const errorData = await occRes.json();
    const errorMessage = errorData.error || errorData.message || 'Failed to fetch occupancy data';
    throw new Error(`Occupancy: ${errorMessage}`);
  } catch (parseError) {
    throw new Error(`Occupancy: ${occRes.statusText || 'Unknown error'}`);
  }
}
```

### 2. Cải thiện Error Logging

Thêm logging chi tiết hơn để debug:

```typescript
if (!response.success) {
  console.error('[API /system/rooms] Failed:', {
    success: response.success,
    error: response.error,
    responseCode: response.responseCode, // Nếu có
    message: response.message, // Nếu có
  });
  return NextResponse.json(
    { error: response.error || 'Failed to fetch rooms' },
    { status: 500 }
  );
}
```

### 3. Kiểm tra Token Format

Đảm bảo token được gửi đúng format `Bearer <token>`:

```typescript
// Trong api-client.ts, dòng 142
if (token) {
  mergedHeaders['Authorization'] = `Bearer ${token}` // ✅ Đúng format
}
```

### 4. Kiểm tra Response Parsing

Đảm bảo response từ backend được parse đúng:

```typescript
// Trong api-client.ts, dòng 271-292
const data = await response.json()
console.log(`[API Client] ${endpoint} - Success response body:`, JSON.stringify(data, null, 2))

// Handle backend response format: {responseCode, message, data}
if (data.responseCode) {
  if (data.responseCode === 'S0000') {
    return { success: true, data: data.data }
  } else {
    // Error case
    const errorMessage = getErrorMessage(String(data.responseCode), data.message || '')
    return { success: false, error: errorMessage }
  }
}
```

## Kết Luận

**Vấn đề chính:**
1. ✅ Frontend đã parse response đúng cách (check `responseCode`)
2. ✅ API routes đã check `response.success` trước khi return data
3. ❌ Dashboard page không parse error message từ response body
4. ❌ Error logging không đầy đủ để debug

**Cần sửa:**
1. Cải thiện error handling trong dashboard page để parse error message
2. Thêm logging chi tiết hơn
3. Đảm bảo error message được hiển thị đúng cho user


## Vấn Đề Hiện Tại

Backend trả về `500 Internal Server Error` với response:
```json
{
  "responseCode": "S0001",
  "message": "SYSTEM_ERROR",
  "data": null
}
```

## Phân Tích Frontend Code

### 1. API Client Response Parsing

**File**: `src/lib/api-client.ts` (dòng 274-292)

```typescript
// Handle backend response format: {responseCode, message, data}
if (data.responseCode) {
  if (data.responseCode === 'S0000') {
    return {
      success: true,
      data: data.data,
    }
  } else {
    // Map common error codes to user-friendly messages
    const errorMessage = getErrorMessage(
      String(data.responseCode),
      data.message || data.error || ''
    )
    return {
      success: false,
      error: String(errorMessage),
    }
  }
}
```

**Vấn đề:**
- Khi backend trả về `responseCode: "S0001"`, `apiClient` sẽ return `{ success: false, error: ... }`
- Nhưng khi HTTP status là 200, code này sẽ chạy
- Khi HTTP status là 500, code ở dòng 202-269 sẽ chạy (error handling)

### 2. API Route Error Handling

**File**: `src/app/api/system/rooms/route.ts` (dòng 79-90)

```typescript
let response
try {
  response = await apiClient.getRooms(options);
} catch (apiError) {
  console.error('[API /system/rooms] Exception calling apiClient.getRooms:', {
    error: apiError,
    message: apiError instanceof Error ? apiError.message : String(apiError),
    stack: apiError instanceof Error ? apiError.stack : undefined
  });
  return NextResponse.json(
    { error: apiError instanceof Error ? apiError.message : 'Failed to fetch rooms' },
    { status: 500 }
  );
}
```

**Vấn đề:**
- Nếu `apiClient.getRooms()` trả về `{ success: false, error: ... }`, code vẫn tiếp tục
- Không check `response.success` trước khi return data

**File**: `src/app/api/system/rooms/route.ts` (dòng 102-110)

```typescript
if (response.success) {
  const data: any = response.data;
  // Backend trả về ApiResponse<List<RoomResponse>>
  // Format: { responseCode: "S0000", message: "SUCCESS", data: [RoomResponse, ...] }
  // data là array trực tiếp, không phải { content: [...] }
  const items = Array.isArray(data) ? data : [];
  console.log('[API /system/rooms] Returning items:', items.length);
  return NextResponse.json({ items, total: items.length });
}

console.error('[API /system/rooms] Failed to get all rooms:', {
  error: response.error,
  fullError: JSON.stringify(response, null, 2)
});
return NextResponse.json(
  { error: response.error || 'Failed to fetch rooms' },
  { status: 500 }
);
```

**✅ Đúng:** Code đã check `response.success` và return error nếu `success: false`

### 3. HTTP Error Handling trong API Client

**File**: `src/lib/api-client.ts` (dòng 202-269)

Khi backend trả về HTTP 500, code sẽ:
1. Parse error response body
2. Extract `responseCode` và `message`
3. Map error code sang user-friendly message
4. Return `{ success: false, error: ... }`

**Vấn đề tiềm ẩn:**
- Nếu backend trả về HTTP 500 nhưng response body không phải JSON, code sẽ fail
- Nếu response body là JSON nhưng không có `responseCode`, code sẽ dùng `response.statusText`

### 4. Dashboard Page Error Handling

**File**: `src/app/admin/dashboard/page.tsx` (dòng 511-521)

```typescript
if (!occRes.ok || !bRes.ok || !cRes.ok || !pRes.ok || !soRes.ok || !tRes.ok) {
  const failed = [
    !occRes.ok && 'occupancy',
    !bRes.ok && 'bookings', 
    !cRes.ok && 'checkins',
    !pRes.ok && 'payments',
    !soRes.ok && 'services',
    !tRes.ok && 'tasks'
  ].filter(Boolean);
  throw new Error(`HTTP error in: ${failed.join(', ')}`);
}
```

**Vấn đề:**
- Code chỉ check `response.ok`, không parse error message từ response body
- User chỉ thấy "HTTP error in: occupancy, bookings, ..." mà không biết lý do cụ thể

## Vấn Đề Thực Sự

### Vấn đề 1: Backend trả về 500 với SYSTEM_ERROR

**Nguyên nhân:**
- Backend không có JWT Filter để parse token và set Authentication
- `@PreAuthorize` annotations fail vì không có Authentication trong SecurityContext
- GlobalExceptionHandler catch exception và trả về `S0001` (SYSTEM_ERROR)

**Nhưng người dùng nói:** "vấn đề ở frontend không phải backend"

### Vấn đề 2: Frontend không parse error message đúng cách

**Vấn đề:**
- Dashboard page chỉ check `response.ok`, không parse error message
- API routes có parse error nhưng có thể không đầy đủ

### Vấn đề 3: Frontend không handle responseCode đúng cách

**Vấn đề:**
- Khi backend trả về HTTP 500 với `{ responseCode: "S0001", message: "SYSTEM_ERROR", data: null }`
- `apiClient` sẽ parse và return `{ success: false, error: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau." }`
- API routes sẽ return `{ error: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau." }` với status 500
- Dashboard page sẽ throw error với message generic

## Giải Pháp

### 1. Cải thiện Error Handling trong Dashboard

**File**: `src/app/admin/dashboard/page.tsx`

Cần parse error message từ response body:

```typescript
if (!occRes.ok) {
  try {
    const errorData = await occRes.json();
    const errorMessage = errorData.error || errorData.message || 'Failed to fetch occupancy data';
    throw new Error(`Occupancy: ${errorMessage}`);
  } catch (parseError) {
    throw new Error(`Occupancy: ${occRes.statusText || 'Unknown error'}`);
  }
}
```

### 2. Cải thiện Error Logging

Thêm logging chi tiết hơn để debug:

```typescript
if (!response.success) {
  console.error('[API /system/rooms] Failed:', {
    success: response.success,
    error: response.error,
    responseCode: response.responseCode, // Nếu có
    message: response.message, // Nếu có
  });
  return NextResponse.json(
    { error: response.error || 'Failed to fetch rooms' },
    { status: 500 }
  );
}
```

### 3. Kiểm tra Token Format

Đảm bảo token được gửi đúng format `Bearer <token>`:

```typescript
// Trong api-client.ts, dòng 142
if (token) {
  mergedHeaders['Authorization'] = `Bearer ${token}` // ✅ Đúng format
}
```

### 4. Kiểm tra Response Parsing

Đảm bảo response từ backend được parse đúng:

```typescript
// Trong api-client.ts, dòng 271-292
const data = await response.json()
console.log(`[API Client] ${endpoint} - Success response body:`, JSON.stringify(data, null, 2))

// Handle backend response format: {responseCode, message, data}
if (data.responseCode) {
  if (data.responseCode === 'S0000') {
    return { success: true, data: data.data }
  } else {
    // Error case
    const errorMessage = getErrorMessage(String(data.responseCode), data.message || '')
    return { success: false, error: errorMessage }
  }
}
```

## Kết Luận

**Vấn đề chính:**
1. ✅ Frontend đã parse response đúng cách (check `responseCode`)
2. ✅ API routes đã check `response.success` trước khi return data
3. ❌ Dashboard page không parse error message từ response body
4. ❌ Error logging không đầy đủ để debug

**Cần sửa:**
1. Cải thiện error handling trong dashboard page để parse error message
2. Thêm logging chi tiết hơn
3. Đảm bảo error message được hiển thị đúng cho user

