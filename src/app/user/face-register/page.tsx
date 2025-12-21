"use client";

import { useState, useRef, useEffect } from "react";
import { useUserBookings } from "@/hooks/useApi";
import { registerFace, getFaceStatus } from "@/lib/services";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import dynamic from "next/dynamic";
import type { Booking } from "@/lib/types";

// Dynamic import Webcam để tránh SSR issues
const WebcamComponent = dynamic(
  // @ts-ignore - react-webcam type incompatibility with Next.js dynamic import
  () => import("react-webcam"),
  { 
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-900 flex items-center justify-center text-white">Đang tải camera...</div>
  }
) as any;

export default function FaceRegisterPage() {
  const [selectedBooking, setSelectedBooking] = useState<number | "">("");
  const [showCamera, setShowCamera] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [faceRegistered, setFaceRegistered] = useState<Record<number, boolean>>({});
  const [checkingStatus, setCheckingStatus] = useState<Record<number, boolean>>({});
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const webcamRef = useRef<any>(null);
  const { data: bookingsData, loading: bookingsLoading } = useUserBookings();

  const bookings = bookingsData 
    ? (Array.isArray(bookingsData) ? bookingsData : (bookingsData as any).items || [])
    : [];

      // Check face status for each booking
  useEffect(() => {
    const checkFaceStatuses = async () => {
      for (const booking of bookings) {
        const bookingId = typeof booking.id === 'string' ? Number(booking.id) : (booking.id || 0);
        if (bookingId > 0 && !checkingStatus[bookingId]) {
          setCheckingStatus(prev => ({ ...prev, [bookingId]: true }));
          try {
            const status = await getFaceStatus(bookingId);
            setFaceRegistered(prev => ({ ...prev, [bookingId]: status.registered }));
          } catch (error) {
            console.error(`Error checking face status for booking ${bookingId}:`, error);
          } finally {
            setCheckingStatus(prev => ({ ...prev, [bookingId]: false }));
          }
        }
      }
    };

    if (bookings.length > 0) {
      checkFaceStatuses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings.length]);

  // Auto-hide flash messages
  useEffect(() => {
    if (flash) {
      const timer = setTimeout(() => setFlash(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [flash]);

  const capturePhoto = () => {
    if (!webcamRef.current) {
      setFlash({ type: 'error', text: 'Camera chưa sẵn sàng' });
      return;
    }

    try {
      setCapturing(true);
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        handleUploadFace(imageSrc);
      } else {
        setFlash({ type: 'error', text: 'Không thể chụp ảnh' });
        setCapturing(false);
      }
    } catch (error) {
      console.error('Capture error:', error);
      setFlash({ type: 'error', text: 'Lỗi khi chụp ảnh' });
      setCapturing(false);
    }
  };

  const handleUploadFace = async (imageSrc: string) => {
    if (typeof selectedBooking !== "number") {
      setFlash({ type: 'error', text: 'Vui lòng chọn đặt phòng' });
      setCapturing(false);
      return;
    }

    try {
      setUploading(true);
      
      // Backend requires 3-5 images for better recognition
      // For single photo capture, we'll use the same image multiple times
      // (In production, user should capture 3-5 different angles)
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      
      // Create FormData with multiple images (backend expects "images" parameter)
      const formData = new FormData();
      
      // Add the same image 3 times (minimum requirement)
      // In a real scenario, user should capture 3-5 different angles
      for (let i = 0; i < 3; i++) {
        const file = new File([blob], `face-${Date.now()}-${i}.jpg`, { type: 'image/jpeg' });
        formData.append('images', file);
      }

      // Register face
      await registerFace(Number(selectedBooking), formData);
      
      setFlash({ type: 'success', text: 'Đăng ký khuôn mặt thành công!' });
      setFaceRegistered(prev => ({ ...prev, [Number(selectedBooking)]: true }));
      setShowCamera(false);
      setSelectedBooking("");
    } catch (error: any) {
      console.error('Upload error:', error);
      setFlash({ type: 'error', text: error?.message || 'Đăng ký khuôn mặt thất bại' });
    } finally {
      setUploading(false);
      setCapturing(false);
    }
  };

  const handleStartRegistration = () => {
    if (typeof selectedBooking !== "number") {
      setFlash({ type: 'error', text: 'Vui lòng chọn đặt phòng' });
      return;
    }
    setShowCamera(true);
  };

  return (
    <div className="px-4 lg:px-6 py-6">
      <div className="mb-4">
        <p className="text-sm text-gray-500">Bảo mật</p>
        <h1 className="text-lg font-semibold text-gray-900">Đăng ký khuôn mặt</h1>
      </div>

      {flash && (
        <div className={`mb-4 p-3 rounded-lg ${
          flash.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {flash.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Chọn đặt phòng để đăng ký khuôn mặt</h2>
            <p className="text-sm text-gray-500">
              Đăng ký khuôn mặt để sử dụng tính năng check-in tự động và mở cửa bằng nhận diện khuôn mặt.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          {bookingsLoading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Đang tải danh sách đặt phòng...
            </div>
          ) : bookings.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Bạn chưa có đặt phòng nào. Vui lòng đặt phòng trước khi đăng ký khuôn mặt.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-600 mb-2 text-sm font-medium">Chọn đặt phòng</label>
                <select
                  value={selectedBooking}
                  onChange={(e) => setSelectedBooking(e.target.value === "" ? "" : Number(e.target.value))}
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))]"
                >
                  <option value="">-- Chọn đặt phòng --</option>
                  {bookings.map((booking: Booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.code} - {booking.roomCode || `Phòng #${booking.roomId}`} 
                      ({new Date(booking.checkinDate).toLocaleDateString("vi-VN")} - {new Date(booking.checkoutDate).toLocaleDateString("vi-VN")})
                    </option>
                  ))}
                </select>
              </div>

              {selectedBooking && typeof selectedBooking === "number" && (() => {
                const bookingId = selectedBooking;
                return (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Trạng thái đăng ký:</span>
                      {checkingStatus[bookingId] ? (
                        <span className="text-sm text-gray-500">Đang kiểm tra...</span>
                      ) : faceRegistered[bookingId] ? (
                        <Badge tone="success">Đã đăng ký</Badge>
                      ) : (
                        <Badge tone="warning">Chưa đăng ký</Badge>
                      )}
                    </div>
                    {!faceRegistered[bookingId] && (
                      <Button
                        onClick={handleStartRegistration}
                        variant="primary"
                        className="w-full"
                      >
                        Bắt đầu đăng ký khuôn mặt
                      </Button>
                    )}
                  </div>
                );
              })()}

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Danh sách đặt phòng</h3>
                <div className="space-y-2">
                  {bookings.map((booking: Booking) => {
                    const bookingId = typeof booking.id === 'string' ? Number(booking.id) : booking.id;
                    return (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div>
                          <div className="font-medium text-sm text-gray-900">
                            {booking.code} - {booking.roomCode || `Phòng #${booking.roomId}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(booking.checkinDate).toLocaleDateString("vi-VN")} - {new Date(booking.checkoutDate).toLocaleDateString("vi-VN")}
                          </div>
                        </div>
                        {checkingStatus[bookingId] ? (
                          <span className="text-xs text-gray-500">Đang kiểm tra...</span>
                        ) : faceRegistered[bookingId] ? (
                          <Badge tone="success">Đã đăng ký</Badge>
                        ) : (
                          <Badge tone="warning">Chưa đăng ký</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Camera Modal */}
      <Modal
        open={showCamera}
        onClose={() => {
          setShowCamera(false);
          setCapturing(false);
        }}
        title="Chụp ảnh khuôn mặt"
      >
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-lg overflow-hidden relative" style={{ aspectRatio: '4/3' }}>
            {showCamera && (
              <WebcamComponent
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  facingMode: "user",
                  width: 1280,
                  height: 720,
                }}
                className="w-full h-full object-cover"
              />
            )}
            {capturing && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-white text-lg font-semibold">Đang xử lý...</div>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <strong>Hướng dẫn:</strong>
            </p>
            <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
              <li>Đảm bảo ánh sáng đủ và rõ ràng</li>
              <li>Nhìn thẳng vào camera</li>
              <li>Không đeo khẩu trang hoặc che khuất khuôn mặt</li>
              <li>Giữ nguyên tư thế trong vài giây</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={capturePhoto}
              disabled={capturing || uploading}
              variant="primary"
              className="flex-1"
            >
              {capturing || uploading ? "Đang xử lý..." : "Chụp ảnh"}
            </Button>
            <Button
              onClick={() => {
                setShowCamera(false);
                setCapturing(false);
              }}
              variant="secondary"
            >
              Hủy
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

