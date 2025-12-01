"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getFaceStatus, registerFace } from "@/lib/face-service";
import { getBookingQr } from "@/lib/qr-service";

type FaceStatus = {
  registered: boolean;
  data?: any;
};

export default function FaceRegistrationPage() {
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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

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

  // Khởi tạo camera khi user chưa đăng ký khuôn mặt
  useEffect(() => {
    if (status?.registered || typeof navigator === "undefined") {
      return;
    }

    let active = true;

    const initCamera = async () => {
      try {
        setCameraError(null);
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        if (!active) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (e: any) {
        if (e?.name === "NotAllowedError") {
          setCameraError(
            "Bạn chưa cấp quyền sử dụng camera. Vui lòng cho phép truy cập camera trong cài đặt trình duyệt rồi thử lại."
          );
        } else if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") {
          setCameraError(
            "Không tìm thấy thiết bị camera phù hợp. Vui lòng kiểm tra lại kết nối camera của bạn."
          );
        } else {
          setCameraError(
            "Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập và thử lại."
          );
        }
      }
    };

    initCamera();

    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [status?.registered, stream]);

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
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `face-${Date.now()}.jpg`, { type: "image/jpeg" });
        setImages((prev) => {
          // Ghi đè theo từng bước: 0 = chính diện, 1 = trái, 2 = phải
          const next = [...prev];
          const index = Math.min(currentStep, captureSteps.length - 1);
          next[index] = file;
          return next;
        });
        setCurrentStep((prev) => Math.min(prev + 1, captureSteps.length - 1));
        setError(null);
      },
      "image/jpeg",
      0.9
    );
  };

  const handleUseExistingFace = async () => {
    if (!bookingId || Number.isNaN(bookingId)) return;
    try {
      setSubmitting(true);
      setError(null);
      const qr = await getBookingQr(bookingId);
      setQrToken(qr.token);
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

  const handleReRegisterFace = () => {
    setQrToken(null);
    setImages([]);
    setCurrentStep(0);
    setStatus((prev) =>
      prev ? { ...prev, registered: false } : { registered: false }
    );
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

      await registerFace(bookingId, formData);

      const newStatus = await getFaceStatus(bookingId);
      setStatus(newStatus);
      if (newStatus.registered) {
        const qr = await getBookingQr(bookingId);
        setQrToken(qr.token);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      <div className="max-w-2xl w-full">
        <Card>
          <CardHeader>
            <h1 className="text-xl font-bold text-gray-900">
              Đăng ký khuôn mặt cho đặt phòng #{bookingId}
            </h1>
          </CardHeader>
          <CardBody className="space-y-4">
            {loading ? (
              <p className="text-sm text-gray-600">Đang tải trạng thái...</p>
            ) : (
              <>
                {status?.registered ? (
                  <div className="space-y-4">
                    <p className="text-sm text-green-700 font-medium">
                      Hệ thống đã ghi nhận khuôn mặt của bạn cho tài khoản này.
                    </p>
                    {!qrToken ? (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-700">
                          Bạn muốn sử dụng khuôn mặt đã đăng ký hay đăng ký lại?
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            onClick={handleUseExistingFace}
                            disabled={submitting}
                          >
                            Sử dụng khuôn mặt đã đăng ký (hiện mã QR)
                          </Button>
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={handleReRegisterFace}
                            disabled={submitting}
                          >
                            Đăng ký lại khuôn mặt
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <p className="text-sm text-gray-700">
                            Đây là mã QR liên kết với đặt phòng của bạn. Khi đến
                            check-in, vui lòng xuất trình mã này để nhân viên
                            quét:
                          </p>
                          <div className="p-3 rounded-md bg-gray-100 break-all text-xs font-mono text-gray-800">
                            {qrToken}
                          </div>
                        </div>
                        <Button
                          onClick={() => router.push("/user/dashboard")}
                          className="mt-2"
                        >
                          Về trang người dùng
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-700">
                      Vui lòng sử dụng camera để chụp lần lượt 3 ảnh khuôn mặt rõ nét trong các tư
                      thế: <span className="font-semibold">nhìn chính diện</span>,{" "}
                      <span className="font-semibold">nghiêng nhẹ sang trái</span>,{" "}
                      <span className="font-semibold">nghiêng nhẹ sang phải</span>. Đảm bảo khuôn
                      mặt không bị che khuất, nằm trọn trong vòng tròn và ánh sáng chiếu đều lên
                      khuôn mặt.
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Camera khuôn mặt
                      </label>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-md shadow-sm">
                          <div>
                            <p className="font-semibold">
                              Bước {currentStep + 1} / {captureSteps.length}:{" "}
                              {captureSteps[currentStep].title}
                            </p>
                            <p>{captureSteps[currentStep].hint}</p>
                          </div>
                        </div>
                        <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden relative flex items-center justify-center shadow-md">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover opacity-80"
                          />
                          {/* Vòng tròn định vị khuôn mặt kiểu app nhận diện */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full border-2 border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.6)]" />
                          </div>
                          {/* Che mờ vùng ngoài khuôn mặt (giả lập mask) */}
                          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50 pointer-events-none" />
                        </div>
                        <div className="flex flex-col gap-1 text-xs text-gray-500">
                          <span>
                            Đã chụp <span className="font-semibold">{images.length}</span> / 3 ảnh
                            tối thiểu.
                          </span>
                          <span>
                            Giữ khuôn mặt trong vòng tròn, không che khẩu trang/kính râm. Nếu ảnh
                            chưa rõ, bạn có thể chụp lại cho bước hiện tại.
                          </span>
                        </div>
                        {cameraError && (
                          <p className="text-xs text-red-600">{cameraError}</p>
                        )}
                        <Button type="button" onClick={handleCapture}>
                          Chụp ảnh khuôn mặt
                        </Button>
                      </div>
                      {error && (
                        <p className="mt-1 text-xs text-red-600">
                          {error}
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => router.push("/user/dashboard")}
                        disabled={submitting}
                      >
                        Hủy
                      </Button>
                      <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting
                          ? "Đang xử lý..."
                          : images.length >= 3
                          ? "Hoàn tất đăng ký khuôn mặt"
                          : "Đăng ký khuôn mặt"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}


