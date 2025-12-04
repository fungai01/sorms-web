# Cách Xem Server Logs

## 1. Next.js Frontend Server Logs

### Cách xem:
1. **Mở terminal đang chạy Next.js dev server**
   - Terminal nơi bạn chạy `npm run dev` hoặc `next dev`
   - Logs sẽ hiển thị trực tiếp trong terminal này

2. **Các logs quan trọng cần tìm:**
   ```
   [Dashboard API] Authorization header: { found: true/false, ... }
   [API Client] 🚀 Request: { url, method, hasAuthorization, ... }
   [API Client] /rooms - Response status: 200/500
   [API Client] /rooms - Error response text: ...
   ```

3. **Nếu không thấy terminal:**
   - Kiểm tra terminal/console trong VS Code
   - Hoặc mở PowerShell/CMD mới và chạy lại `npm run dev`

## 2. Spring Boot Backend Server Logs

### Cách xem:
1. **Mở terminal đang chạy Spring Boot**
   - Terminal nơi bạn chạy `mvn spring-boot:run` hoặc `./gradlew bootRun`
   - Hoặc nếu chạy bằng JAR: `java -jar app.jar`

2. **Các logs quan trọng cần tìm:**
   ```
   Received request to get all rooms
   Received request to get all room types
   Authentication failed / Authorization denied
   ```

3. **Nếu backend chạy trên server khác:**
   - SSH vào server và xem logs
   - Hoặc kiểm tra log files trong `logs/` directory

## 3. Browser Console Logs

### Cách xem:
1. **Mở Browser DevTools**
   - Nhấn `F12` hoặc `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Chọn tab **Console**

2. **Các logs quan trọng:**
   ```
   [API Client] ⚠️ No access token available for request: ...
   [authFetch] Added Authorization header from cookie/localStorage
   Dashboard fetch error: Error: HTTP error in: occupancy
   ```

## 4. Network Tab (Browser DevTools)

### Cách xem:
1. **Mở Browser DevTools** → Tab **Network**
2. **Filter theo "Fetch/XHR"**
3. **Click vào request bị lỗi** (status 500)
4. **Xem:**
   - **Headers** → Request Headers → `Authorization: Bearer ...`
   - **Response** → Error message từ backend
   - **Preview** → JSON response nếu có

## 5. Cách Debug Lỗi 500

### Bước 1: Kiểm tra Token
```javascript
// Trong Browser Console
localStorage.getItem('auth_access_token')
// Hoặc
document.cookie
```

### Bước 2: Kiểm tra Request Headers
- Mở Network tab
- Tìm request `/api/dashboard/occupancy` hoặc `/api/system/rooms`
- Xem Request Headers có `Authorization: Bearer ...` không

### Bước 3: Kiểm tra Response
- Xem Response body trong Network tab
- Copy error message và paste vào chat để debug

### Bước 4: Kiểm tra Server Logs
- Frontend logs: Tìm `[Dashboard API]` hoặc `[API Client]`
- Backend logs: Tìm `Received request to get all rooms`

## 6. Tạo Log File (Optional)

### Frontend (Next.js):
```bash
npm run dev > frontend.log 2>&1
```

### Backend (Spring Boot):
```bash
mvn spring-boot:run > backend.log 2>&1
```

Sau đó mở file `.log` để xem logs.

## 7. Quick Debug Commands

### Kiểm tra token trong browser console:
```javascript
// Check token
console.log('Token:', localStorage.getItem('auth_access_token'))

// Check user info
console.log('User Info:', JSON.parse(localStorage.getItem('auth_user_info') || '{}'))

// Test API call
fetch('/api/system/rooms', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('auth_access_token')}`
  }
}).then(r => r.json()).then(console.log)
```

## 8. Common Issues

### Issue 1: Token không được gửi
- **Check**: Network tab → Request Headers → Không có `Authorization`
- **Fix**: Đảm bảo `authService.getAccessToken()` trả về token

### Issue 2: Token hết hạn
- **Check**: Backend logs → "Token expired" hoặc "Unauthenticated"
- **Fix**: Refresh token hoặc login lại

### Issue 3: 500 Internal Server Error
- **Check**: Backend logs → Exception stack trace
- **Fix**: Xem error message và fix theo

### Issue 4: CORS Error
- **Check**: Browser Console → "CORS policy" error
- **Fix**: Kiểm tra backend CORS configuration


## 1. Next.js Frontend Server Logs

### Cách xem:
1. **Mở terminal đang chạy Next.js dev server**
   - Terminal nơi bạn chạy `npm run dev` hoặc `next dev`
   - Logs sẽ hiển thị trực tiếp trong terminal này

2. **Các logs quan trọng cần tìm:**
   ```
   [Dashboard API] Authorization header: { found: true/false, ... }
   [API Client] 🚀 Request: { url, method, hasAuthorization, ... }
   [API Client] /rooms - Response status: 200/500
   [API Client] /rooms - Error response text: ...
   ```

3. **Nếu không thấy terminal:**
   - Kiểm tra terminal/console trong VS Code
   - Hoặc mở PowerShell/CMD mới và chạy lại `npm run dev`

## 2. Spring Boot Backend Server Logs

### Cách xem:
1. **Mở terminal đang chạy Spring Boot**
   - Terminal nơi bạn chạy `mvn spring-boot:run` hoặc `./gradlew bootRun`
   - Hoặc nếu chạy bằng JAR: `java -jar app.jar`

2. **Các logs quan trọng cần tìm:**
   ```
   Received request to get all rooms
   Received request to get all room types
   Authentication failed / Authorization denied
   ```

3. **Nếu backend chạy trên server khác:**
   - SSH vào server và xem logs
   - Hoặc kiểm tra log files trong `logs/` directory

## 3. Browser Console Logs

### Cách xem:
1. **Mở Browser DevTools**
   - Nhấn `F12` hoặc `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Chọn tab **Console**

2. **Các logs quan trọng:**
   ```
   [API Client] ⚠️ No access token available for request: ...
   [authFetch] Added Authorization header from cookie/localStorage
   Dashboard fetch error: Error: HTTP error in: occupancy
   ```

## 4. Network Tab (Browser DevTools)

### Cách xem:
1. **Mở Browser DevTools** → Tab **Network**
2. **Filter theo "Fetch/XHR"**
3. **Click vào request bị lỗi** (status 500)
4. **Xem:**
   - **Headers** → Request Headers → `Authorization: Bearer ...`
   - **Response** → Error message từ backend
   - **Preview** → JSON response nếu có

## 5. Cách Debug Lỗi 500

### Bước 1: Kiểm tra Token
```javascript
// Trong Browser Console
localStorage.getItem('auth_access_token')
// Hoặc
document.cookie
```

### Bước 2: Kiểm tra Request Headers
- Mở Network tab
- Tìm request `/api/dashboard/occupancy` hoặc `/api/system/rooms`
- Xem Request Headers có `Authorization: Bearer ...` không

### Bước 3: Kiểm tra Response
- Xem Response body trong Network tab
- Copy error message và paste vào chat để debug

### Bước 4: Kiểm tra Server Logs
- Frontend logs: Tìm `[Dashboard API]` hoặc `[API Client]`
- Backend logs: Tìm `Received request to get all rooms`

## 6. Tạo Log File (Optional)

### Frontend (Next.js):
```bash
npm run dev > frontend.log 2>&1
```

### Backend (Spring Boot):
```bash
mvn spring-boot:run > backend.log 2>&1
```

Sau đó mở file `.log` để xem logs.

## 7. Quick Debug Commands

### Kiểm tra token trong browser console:
```javascript
// Check token
console.log('Token:', localStorage.getItem('auth_access_token'))

// Check user info
console.log('User Info:', JSON.parse(localStorage.getItem('auth_user_info') || '{}'))

// Test API call
fetch('/api/system/rooms', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('auth_access_token')}`
  }
}).then(r => r.json()).then(console.log)
```

## 8. Common Issues

### Issue 1: Token không được gửi
- **Check**: Network tab → Request Headers → Không có `Authorization`
- **Fix**: Đảm bảo `authService.getAccessToken()` trả về token

### Issue 2: Token hết hạn
- **Check**: Backend logs → "Token expired" hoặc "Unauthenticated"
- **Fix**: Refresh token hoặc login lại

### Issue 3: 500 Internal Server Error
- **Check**: Backend logs → Exception stack trace
- **Fix**: Xem error message và fix theo

### Issue 4: CORS Error
- **Check**: Browser Console → "CORS policy" error
- **Fix**: Kiểm tra backend CORS configuration

