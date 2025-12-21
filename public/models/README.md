# Face API Models

Thư mục này chứa các mô hình nhận diện khuôn mặt cho face-api.js.

## Cài đặt Models

Chạy lệnh sau để tải các mô hình cần thiết:

```bash
npm run download-face-models
```

Hoặc chạy trực tiếp:

```bash
node scripts/download-face-models.js
```

## Models được sử dụng

- `tiny_face_detector_model`: Mô hình phát hiện khuôn mặt nhỏ gọn
- `face_landmark_68_model`: Mô hình nhận diện 68 điểm mốc trên khuôn mặt

Sau khi tải xong, các file sẽ được lưu trong thư mục `public/models/` và có thể được sử dụng bởi ứng dụng.


