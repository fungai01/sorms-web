"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import dynamic from "next/dynamic";

// Dynamic import Webcam để tránh SSR issues
const WebcamComponent = dynamic(
  // @ts-ignore - react-webcam type incompatibility with Next.js dynamic import
  () => import("react-webcam"),
  { 
    ssr: false,
    loading: () => <div className="w-full h-72 bg-gray-900 flex items-center justify-center text-white">Đang tải camera...</div>
  }
) as any;

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookingIdParam = searchParams.get("bookingId");
  const bookingId = bookingIdParam ? Number(bookingIdParam) : NaN;

  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [note, setNote] = useState("");

  const webcamRef = useRef<any>(null);

  useEffect(() => {
    if (!bookingId || Number.isNaN(bookingId)) {
      setError("bookingId không hợp lệ.");
    }
  }, [bookingId]);

  const handleCapture = async () => {
    try {
      const screenshot = webcamRef.current?.getScreenshot();
      if (!screenshot) {
        setError("Không thể chụp ảnh từ camera. Vui lòng thử lại.");
        return;
      }
      // Convert base64 to Blob
      const res = await fetch(screenshot);
      const blob = await res.blob();
      const file = new File([blob], `room-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
      setImages(prev => [...prev, file]);
      setError(null);
    } catch (e) {
      setError("Không thể chụp ảnh. Vui lòng kiểm tra camera và thử lại.");
    }
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!bookingId || Number.isNaN(bookingId)) return;
    if (images.length === 0) {
      setError("Vui lòng chụp ít nhất 1 ảnh hiện trạng phòng.");
      return;
    }
    // Tạm thời không gọi API do chưa có backend
    // Chỉ hiển thị hướng dẫn trả chìa khóa cho người dùng
    setSubmitting(true);
    setTimeout(() => {
      setSuccess(true);
      setSubmitting(false);
    }, 600);
  }

  if (!bookingId || Number.isNaN(bookingId)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card>
          <CardBody>
            <p className="text-red-600 text-sm">Thiếu tham số bookingId.</p>
            <Button className="mt-3" onClick={() => router.push("/user/dashboard")}>Về trang người dùng</Button>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Check-out phòng #{bookingId}</h1>
          <Button variant="secondary" onClick={() => router.back()}>Quay lại</Button>
        </div>

        {success ? (
          <Card className="border-0 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
              <h2 className="text-xl font-semibold">Đã gửi yêu cầu check-out</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">Cảm ơn bạn! Yêu cầu check-out đã được gửi. Vui lòng thực hiện các bước sau:</p>
                <ul className="list-disc ml-5 mt-2 text-sm text-green-900 space-y-1">
                  <li>Thu dọn đồ đạc và đảm bảo không bỏ quên tài sản cá nhân</li>
                  <li>Tắt các thiết bị điện, nước</li>
                  <li>Đóng cửa sổ, khóa cửa phòng</li>
                  <li>Trả chìa khóa tại bàn bảo vệ</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => router.push('/user/dashboard')} className="bg-blue-600 hover:bg-blue-700 text-white">Về trang người dùng</Button>
                <Button variant="secondary" onClick={() => router.push('/security/dashboard')}>Xem hướng dẫn bảo vệ</Button>
              </div>
            </CardBody>
          </Card>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-md border p-3 text-sm bg-red-50 border-red-200 text-red-800">{error}</div>
            )}

            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b px-4 py-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Chụp ảnh hiện trạng phòng</h2>
                  <span className="text-xs text-gray-500">Yêu cầu tối thiểu 1 ảnh</span>
                </div>
              </CardHeader>
              <CardBody className="space-y-4 p-4">
                <div className="relative rounded overflow-hidden border border-gray-200 h-[320px]">
                  <WebcamComponent
                    ref={webcamRef as any}
                    audio={false}
                    className="w-full h-full object-cover bg-gray-900"
                    screenshotFormat="image/jpeg"
                    screenshotQuality={0.9}
                    videoConstraints={{ facingMode: "environment" }}
                  />

                  <div className="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
                    <button
                      onClick={handleCapture}
                      disabled={submitting}
                      className="pointer-events-auto w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center shadow-md"
                      aria-label="Chụp ảnh"
                    >
                      <svg 
                        className="w-7 h-7 text-white" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" 
                        />
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" 
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {images.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Ảnh đã chụp:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {images.map((img, idx) => (
                        <div key={idx} className="relative border rounded overflow-hidden">
                          <img src={URL.createObjectURL(img)} alt={`room-${idx+1}`} className="w-full h-32 object-cover" />
                          <button
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 bg-white/90 border rounded px-2 py-0.5 text-xs text-red-600"
                          >
                            Xóa
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (tùy chọn)</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ví dụ: Tình trạng phòng trước khi rời đi, số chìa khóa bàn giao..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" onClick={() => router.push('/user/dashboard')}>Hủy</Button>
                  <Button onClick={handleSubmit} disabled={submitting || images.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {submitting ? 'Đang gửi...' : 'Gửi check-out'}
                  </Button>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Hướng dẫn trả chìa khóa</h2>
              </CardHeader>
              <CardBody className="text-sm text-gray-700 space-y-2">
                <p>Sau khi gửi check-out, vui lòng đến bàn bảo vệ để trả chìa khóa phòng. Nhân viên bảo vệ sẽ xác nhận và hoàn tất thủ tục.</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li>Trả chìa khóa trong phong bì (nếu có)</li>
                  <li>Thông báo số phòng và mã đặt phòng cho bảo vệ</li>
                  <li>Giữ biên nhận (nếu được cấp)</li>
                </ul>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">Đang tải...</p>
          </CardBody>
        </Card>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}

