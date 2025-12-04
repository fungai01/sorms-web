# Debug 500 Error - API System Rooms

## Error Message
```json
{"error":"Hệ thống đang gặp sự cố. Vui lòng thử lại sau."}
```

## Phân tích

Error message này đến từ error code `S0001` hoặc `SYSTEM_ERROR` từ backend, được map bởi `getErrorMessage()` trong `utils.ts`.

## Các nguyên nhân có thể:

### 1. Backend URL không đúng
- Frontend đang gọi đến: `https://backend.sorms.online/api/rooms`
- Nhưng backend có thể đang chạy ở: `http://localhost:8080/api/rooms`

**Kiểm tra:**
- Xem file `.env` có `NEXT_PUBLIC_API_BASE_URL` không
- Kiểm tra backend có đang chạy không
- Test backend URL trực tiếp: `curl https://backend.sorms.online/api/rooms` hoặc `curl http://localhost:8080/api/rooms`

### 2. Backend không nhận được token
- Token được gửi trong Authorization header: `Bearer eyJhbGciOiJIUzUxMiJ9...`
- Nhưng backend có thể không parse được hoặc token không hợp lệ

**Kiểm tra:**
- Xem backend logs để xem có nhận được request không
- Kiểm tra JWT token có hợp lệ không (decode token và xem expiration)

### 3. Backend có lỗi khi xử lý
- Backend nhận được request nhưng có exception khi xử lý
- Có thể do database connection, missing data, etc.

**Kiểm tra:**
- Xem backend logs để xem exception stack trace
- Kiểm tra database connection
- Kiểm tra backend có đủ data không

## Cách Debug:

### Bước 1: Kiểm tra Backend URL
```bash
# Kiểm tra .env file
cat .env | grep API_BASE_URL

# Test backend URL
curl -H "Authorization: Bearer YOUR_TOKEN" https://backend.sorms.online/api/rooms
# hoặc
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/api/rooms
```

### Bước 2: Xem Server Logs
- **Frontend logs**: Tìm `[API Client] /rooms - Error response text (full):`
- **Backend logs**: Tìm `Received request to get all rooms` và exception stack trace

### Bước 3: Kiểm tra Token
```javascript
// Trong Browser Console
const token = localStorage.getItem('auth_access_token')
console.log('Token:', token)

// Decode token (chỉ để xem, không verify)
const payload = JSON.parse(atob(token.split('.')[1]))
console.log('Token payload:', payload)
console.log('Expires at:', new Date(payload.exp * 1000))
console.log('Roles:', payload.roles)
```

### Bước 4: Test API trực tiếp
```javascript
// Trong Browser Console
fetch('https://backend.sorms.online/api/rooms', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('auth_access_token')}`
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

## Logs cần kiểm tra:

1. **Frontend logs** (terminal chạy `npm run dev`):
   - `[API Client] 🚀 Request:` - Xem URL và headers
   - `[API Client] /rooms - Error response text (full):` - Xem backend response
   - `[API Client] /rooms - Error response body (parsed):` - Xem parsed error

2. **Backend logs** (terminal chạy Spring Boot):
   - `Received request to get all rooms` - Xem có nhận được request không
   - Exception stack trace - Xem lỗi cụ thể

## Next Steps:

1. Kiểm tra backend URL trong `.env` file
2. Xem server logs để biết backend response thực sự là gì
3. Test backend API trực tiếp với curl hoặc Postman
4. Kiểm tra token có hợp lệ không


## Error Message
```json
{"error":"Hệ thống đang gặp sự cố. Vui lòng thử lại sau."}
```

## Phân tích

Error message này đến từ error code `S0001` hoặc `SYSTEM_ERROR` từ backend, được map bởi `getErrorMessage()` trong `utils.ts`.

## Các nguyên nhân có thể:

### 1. Backend URL không đúng
- Frontend đang gọi đến: `https://backend.sorms.online/api/rooms`
- Nhưng backend có thể đang chạy ở: `http://localhost:8080/api/rooms`

**Kiểm tra:**
- Xem file `.env` có `NEXT_PUBLIC_API_BASE_URL` không
- Kiểm tra backend có đang chạy không
- Test backend URL trực tiếp: `curl https://backend.sorms.online/api/rooms` hoặc `curl http://localhost:8080/api/rooms`

### 2. Backend không nhận được token
- Token được gửi trong Authorization header: `Bearer eyJhbGciOiJIUzUxMiJ9...`
- Nhưng backend có thể không parse được hoặc token không hợp lệ

**Kiểm tra:**
- Xem backend logs để xem có nhận được request không
- Kiểm tra JWT token có hợp lệ không (decode token và xem expiration)

### 3. Backend có lỗi khi xử lý
- Backend nhận được request nhưng có exception khi xử lý
- Có thể do database connection, missing data, etc.

**Kiểm tra:**
- Xem backend logs để xem exception stack trace
- Kiểm tra database connection
- Kiểm tra backend có đủ data không

## Cách Debug:

### Bước 1: Kiểm tra Backend URL
```bash
# Kiểm tra .env file
cat .env | grep API_BASE_URL

# Test backend URL
curl -H "Authorization: Bearer YOUR_TOKEN" https://backend.sorms.online/api/rooms
# hoặc
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/api/rooms
```

### Bước 2: Xem Server Logs
- **Frontend logs**: Tìm `[API Client] /rooms - Error response text (full):`
- **Backend logs**: Tìm `Received request to get all rooms` và exception stack trace

### Bước 3: Kiểm tra Token
```javascript
// Trong Browser Console
const token = localStorage.getItem('auth_access_token')
console.log('Token:', token)

// Decode token (chỉ để xem, không verify)
const payload = JSON.parse(atob(token.split('.')[1]))
console.log('Token payload:', payload)
console.log('Expires at:', new Date(payload.exp * 1000))
console.log('Roles:', payload.roles)
```

### Bước 4: Test API trực tiếp
```javascript
// Trong Browser Console
fetch('https://backend.sorms.online/api/rooms', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('auth_access_token')}`
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

## Logs cần kiểm tra:

1. **Frontend logs** (terminal chạy `npm run dev`):
   - `[API Client] 🚀 Request:` - Xem URL và headers
   - `[API Client] /rooms - Error response text (full):` - Xem backend response
   - `[API Client] /rooms - Error response body (parsed):` - Xem parsed error

2. **Backend logs** (terminal chạy Spring Boot):
   - `Received request to get all rooms` - Xem có nhận được request không
   - Exception stack trace - Xem lỗi cụ thể

## Next Steps:

1. Kiểm tra backend URL trong `.env` file
2. Xem server logs để biết backend response thực sự là gì
3. Test backend API trực tiếp với curl hoặc Postman
4. Kiểm tra token có hợp lệ không

