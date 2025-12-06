"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getFaceStatus, registerFace, updateFace, deleteFace } from "@/lib/face-service";
import { getBookingQr } from "@/lib/qr-service";
import QRCode from "qrcode";
import dynamic from "next/dynamic";

// Dynamic import Webcam để tránh SSR issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WebcamComponent = dynamic(
  // @ts-ignore - react-webcam type incompatibility with Next.js dynamic import
  () => import("react-webcam"),
  { 
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-900 flex items-center justify-center text-white">Đang tải camera...</div>
  }
) as any;

type FaceStatus = {
  registered: boolean;
  data?: any;
};

type BookingData = {
  id: number;
  userName?: string;
  userEmail?: string;
  roomName?: string;
  roomNumber?: string;
  checkInTime?: string;
  checkOutTime?: string;
  [key: string]: any;
};

function FaceRegistrationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookingIdParam = searchParams.get("bookingId");
  const bookingId = bookingIdParam ? Number(bookingIdParam) : NaN;

  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [capturedSteps, setCapturedSteps] = useState<boolean[]>([false, false, false]);

  const webcamRef = useRef<any>(null);

  useEffect(() => {
    if (!bookingId || Number.isNaN(bookingId)) {
      setError("bookingId không hợp lệ.");
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getFaceStatus(bookingId);
        setStatus(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thể tải trạng thái khuôn mặt");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [bookingId]);



  const captureSteps = [
    {
      title: "Nhìn chính diện",
      hint: "Giữ thẳng đầu, nhìn trực tiếp vào camera.",
    },
    {
      title: "Nghiêng nhẹ sang trái",
      hint: "Xoay nhẹ mặt sang bên trái, vẫn giữ khuôn mặt trong khung hình.",
    },
    {
      title: "Nghiêng nhẹ sang phải",
      hint: "Xoay nhẹ mặt sang bên phải, vẫn giữ khuôn mặt trong khung hình.",
    },
  ];

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
      const file = new File([blob], `face-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });

        setImages((prev) => {
          const next = [...prev];
          const index = Math.min(currentStep, captureSteps.length - 1);
          next[index] = file;
          return next;
        });

      setCapturedSteps((prev) => {
        const updated = [...prev];
        updated[Math.min(currentStep, captureSteps.length - 1)] = true;
        return updated;
      });

      if (currentStep < captureSteps.length - 1) {
        setCurrentStep((prev) => prev + 1);
      }
        setError(null);
    } catch (e) {
      setError("Không thể chụp ảnh. Vui lòng kiểm tra camera và thử lại.");
    }
  };

  // Generate QR code with booking data
  const generateQRCode = (data: string) => {
    try {
      QRCode.toDataURL(data, {
        errorCorrectionLevel: "H",
        margin: 1,
        width: 300,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      }).then((url) => {
        setQrDataUrl(url);
      }).catch((err) => {
        console.error("Error generating QR code:", err);
        setError("Không thể tạo mã QR. Vui lòng thử lại.");
      });
    } catch (err) {
      console.error("Error generating QR code:", err);
      setError("Không thể tạo mã QR. Vui lòng thử lại.");
    }
  };

  const handleUseExistingFace = async () => {
    if (!bookingId || Number.isNaN(bookingId)) return;
    try {
      setSubmitting(true);
      setError(null);
      const qr = await getBookingQr(bookingId);
      setQrToken(qr.token);
      
      // Extract booking data from response if available
      if (qr.bookingData) {
        setBookingData(qr.bookingData);
      }
      
      // Generate QR code với token (base64) từ API
      // Token này đã chứa đầy đủ thông tin booking được encode
      if (qr.token) {
        generateQRCode(qr.token);
      } else {
        setError("Không có token để tạo mã QR");
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Không thể lấy mã QR cho đặt phòng này. Vui lòng thử lại."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReRegisterFace = async () => {
    if (!bookingId || Number.isNaN(bookingId)) return;
    try {
      setSubmitting(true);
      setError(null);
      
      // Xóa khuôn mặt cũ trước khi đăng ký lại
      try {
        await deleteFace(bookingId);
      } catch (e) {
        // Nếu chưa có khuôn mặt hoặc lỗi, vẫn tiếp tục
        console.log('Delete face error (may not exist):', e);
      }
      
      // Reset state để cho phép đăng ký lại
      setQrToken(null);
      setQrDataUrl(null);
      setImages([]);
      setCurrentStep(0);
      setCapturedSteps([false, false, false]);
      setStatus((prev) =>
        prev ? { ...prev, registered: false } : { registered: false }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể xóa khuôn mặt cũ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!bookingId || Number.isNaN(bookingId)) return;
    if (images.length < 3) {
      setError(
        "Vui lòng chụp đủ 3 góc: chính diện, nghiêng nhẹ sang trái và nghiêng nhẹ sang phải."
      );
      return;
    }
    try {
      setSubmitting(true);
      setError(null);

      const formData = new FormData();
      images.forEach((img) => {
        formData.append("images", img, img.name);
      });

      // Nếu đã có khuôn mặt, dùng PUT để cập nhật; nếu chưa có, dùng POST để đăng ký
      if (status?.registered) {
        await updateFace(bookingId, formData);
      } else {
        await registerFace(bookingId, formData);
      }

      const newStatus = await getFaceStatus(bookingId);
      setStatus(newStatus);
      if (newStatus.registered) {
        const qr = await getBookingQr(bookingId);
        setQrToken(qr.token);
        
        // Extract booking data from response if available
        if (qr.bookingData) {
          setBookingData(qr.bookingData);
        }
        
        // Generate QR code với token (base64) từ API
        // Token này đã chứa đầy đủ thông tin booking được encode
        if (qr.token) {
          generateQRCode(qr.token);
        } else {
          setError("Không có token để tạo mã QR");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể đăng ký khuôn mặt");
    } finally {
      setSubmitting(false);
    }
  };

  if (!bookingId || Number.isNaN(bookingId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card>
          <CardBody>
            <p className="text-red-600 text-sm">Thiếu tham số bookingId.</p>
            <Button className="mt-3" onClick={() => router.push("/user/dashboard")}>
              Về trang người dùng
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Modal overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
        <div className="relative w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-auto">
          <button
            aria-label="Đóng"
            onClick={() => router.back()}
            className="absolute top-2 right-2 z-10 bg-white text-gray-600 hover:text-gray-900 rounded w-7 h-7 flex items-center justify-center border text-sm"
          >
            ×
          </button>
        {loading ? (
        <Card>
            <CardBody className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-sm text-gray-600">Đang tải trạng thái...</p>
              </div>
            </CardBody>
          </Card>
            ) : (
              <>
                {status?.registered ? (
              <Card className="border-0 shadow-2xl">
                <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold">Xác thực sinh trắc học thành công</h1>
                      <p className="text-sm text-green-100">Khuôn mặt của bạn đã được ghi nhận</p>
                    </div>
                  </div>
                </CardHeader>
                <CardBody className="space-y-6 p-8">
                  {!qrDataUrl ? (
                  <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm text-green-800">
                          ✓ Hệ thống đã ghi nhận khuôn mặt của bạn cho đặt phòng #{bookingId}
                    </p>
                      </div>
                      <p className="text-gray-700 text-center">
                          Bạn muốn sử dụng khuôn mặt đã đăng ký hay đăng ký lại?
                        </p>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          <Button
                            onClick={handleUseExistingFace}
                            disabled={submitting}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                          {submitting ? "Đang tạo mã QR..." : "Tạo mã QR check-in"}
                          </Button>
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={handleReRegisterFace}
                            disabled={submitting}
                          className="border-gray-300"
                          >
                            Đăng ký lại khuôn mặt
                          </Button>
                        </div>
                      </div>
                    ) : (
                    <div className="space-y-6">
                      {/* QR Code Section */}
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-200">
                        <div className="flex flex-col items-center space-y-4">
                          <div className="text-center mb-4">
                            <h2 className="text-lg font-bold text-gray-900 mb-2">Mã QR Check-in</h2>
                            <p className="text-sm text-gray-600">Quét mã này tại lễ tân để hoàn tất check-in</p>
                          </div>
                          
                          {qrDataUrl && (
                            <div className="bg-white p-6 rounded-lg shadow-md border-2 border-blue-200">
                              <img 
                                src={qrDataUrl} 
                                alt="QR Code" 
                                className="w-64 h-64 object-contain"
                              />
                            </div>
                          )}
                          
                          <div className="w-full bg-white rounded-lg p-4 border border-gray-200 space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              {bookingData?.userName && (
                                <div>
                                  <p className="text-xs text-gray-500 font-semibold uppercase">Tên khách</p>
                                  <p className="text-sm font-medium text-gray-900">{bookingData.userName}</p>
                                </div>
                              )}
                              {bookingData?.roomNumber && (
                                <div>
                                  <p className="text-xs text-gray-500 font-semibold uppercase">Phòng</p>
                                  <p className="text-sm font-medium text-gray-900">{bookingData.roomNumber}</p>
                                </div>
                              )}
                              {bookingData?.checkInTime && (
                                <div>
                                  <p className="text-xs text-gray-500 font-semibold uppercase">Check-in</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {new Date(bookingData.checkInTime).toLocaleString("vi-VN")}
                                  </p>
                                </div>
                              )}
                              {bookingData?.checkOutTime && (
                                <div>
                                  <p className="text-xs text-gray-500 font-semibold uppercase">Check-out</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {new Date(bookingData.checkOutTime).toLocaleString("vi-VN")}
                                  </p>
                                </div>
                              )}
                            </div>
                            {bookingData?.userEmail && (
                              <div className="pt-2 border-t border-gray-200">
                                <p className="text-xs text-gray-500 font-semibold uppercase">Email</p>
                                <p className="text-sm text-gray-700 break-all">{bookingData.userEmail}</p>
                              </div>
                            )}
                          </div>
                          </div>
                        </div>

                      {/* Instructions */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                        <p className="text-sm font-semibold text-blue-900">📱 Hướng dẫn sử dụng:</p>
                        <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
                          <li>Lưu hoặc chụp ảnh mã QR này</li>
                          <li>Xuất trình mã QR tại lễ tân khi check-in</li>
                          <li>Nhân viên sẽ quét mã để xác nhận thông tin của bạn</li>
                        </ul>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button
                          onClick={() => {
                            if (qrDataUrl) {
                              const link = document.createElement("a");
                              link.href = qrDataUrl;
                              link.download = `check-in-qr-${bookingId}.png`;
                              link.click();
                            }
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          ⬇️ Tải mã QR
                        </Button>
                        <Button
                          onClick={() => router.push(`/user/dashboard?bookingId=${bookingId}`)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          ✓ Hoàn tất
                        </Button>
                      </div>
                      </div>
                    )}
                </CardBody>
              </Card>
            ) : (
              <Card className="border shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold text-gray-900">Xác thực khuôn mặt</h1>
                    <p className="text-sm text-gray-500">#{bookingId}</p>
                  </div>
                </CardHeader>
                <CardBody className="space-y-4 p-4">
                  {/* Stepper */}
                  <div className="flex justify-between items-center pb-4 border-b">
                    {captureSteps.map((step, idx) => (
                      <div key={idx} className="flex flex-col items-center flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm mb-1 ${
                          capturedSteps[idx] 
                            ? "bg-blue-600 text-white" 
                            : idx === currentStep 
                            ? "bg-blue-600 text-white" 
                            : "bg-gray-200 text-gray-600"
                        }`}>
                          {capturedSteps[idx] ? "✓" : idx + 1}
                        </div>
                        <p className="text-xs text-center text-gray-600">{step.title}</p>
                      </div>
                    ))}
                  </div>

                  {/* PART 2: CAMERA + CONTROLS */}
                  <div className="space-y-4 pt-6">
                    {/* Camera Feed */}
                    <div className="relative rounded overflow-hidden border border-gray-200 h-[360px] sm:h-[400px]">
                      <WebcamComponent
                        ref={webcamRef as any}
                        audio={false}
                        className="w-full h-full object-cover bg-gray-900"
                        screenshotFormat="image/jpeg"
                        screenshotQuality={0.9}
                        videoConstraints={{ facingMode: "user" }}
                        onUserMedia={() => setCameraError(null)}
                        onUserMediaError={(e: unknown) => {
                          const name = (e as any)?.name;
                          if (name === "NotAllowedError") {
                            setCameraError("Bạn chưa cấp quyền camera. Vui lòng cho phép và thử lại.");
                          } else if (name === "NotFoundError" || name === "OverconstrainedError") {
                            setCameraError("Không tìm thấy thiết bị camera phù hợp.");
                          } else {
                            setCameraError("Không thể truy cập camera. Vui lòng thử lại.");
                          }
                        }}
                      />

                      {/* Face Detection Circle */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="rounded-full border-2 border-blue-500" style={{ width: "280px", height: "280px" }} />
                      </div>

                      {/* Capture Button - Icon centered below face circle */}
                      <div className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none">
                        <button
                          onClick={handleCapture}
                          disabled={!!cameraError || submitting}
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

                    {/* Step Description */}
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        Bước {currentStep + 1}: {captureSteps[currentStep].title}
                      </p>
                      <p className="text-xs text-gray-600">
                        {captureSteps[currentStep].hint}
                      </p>
                    </div>

                    {/* Progress */}
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-sm text-gray-700 text-center">Tiến độ: {images.length}/3 ảnh</p>
                    </div>

                    {/* Error Messages */}
                    {(cameraError || error) && (
                      <div className="bg-red-50 border border-red-200 rounded p-2">
                        <p className="text-xs text-red-700">{cameraError || error}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="secondary"
                        onClick={() => router.push(`/user/dashboard${bookingId ? `?bookingId=${bookingId}` : ''}`)}
                        disabled={submitting}
                        className="flex-1 border-gray-300"
                      >
                        Hủy
                      </Button>
                      {images.length >= 3 && (
                        <Button 
                          onClick={handleSubmit} 
                          disabled={submitting}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {submitting ? "Đang xử lý..." : "Hoàn tất"}
                        </Button>
                      )}
                    </div>
                  </div>


                </CardBody>
              </Card>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}

export default function FaceRegistrationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Card>
            <CardBody>
              <p className="text-sm text-gray-600">Đang tải...</p>
            </CardBody>
          </Card>
        </div>
      }
    >
      <FaceRegistrationContent />
    </Suspense>
  );
}

