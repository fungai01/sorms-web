"use client";

import { useRef, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import dynamic from "next/dynamic";

// Dynamic import Webcam để tránh SSR issues
const WebcamComponent = dynamic(
  // @ts-ignore - react-webcam type incompatibility with Next.js dynamic import
  () => import("react-webcam"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center text-white">
        Đang tải camera...
      </div>
    ),
  }
) as any;

interface FaceCaptureProps {
  open: boolean;
  title?: string;
  loading?: boolean;
  onClose: () => void;
  onCapture: (imageSrc: string) => void | Promise<void>;
  // Gợi ý overlay tĩnh cho góc mặt
  overlayType?: "front" | "left" | "right";
  // Tự động chụp ngay khi mở (dùng cho flow tự động)
  autoCapture?: boolean;
}

export function FaceCapture({
  open,
  title = "Chụp ảnh khuôn mặt",
  loading = false,
  onClose,
  onCapture,
  overlayType,
  autoCapture = false,
}: FaceCaptureProps) {
  const webcamRef = useRef<any>(null);
  const autoCapturedRef = useRef(false);

  const handleClickCapture = async () => {
    if (!webcamRef.current) {
      return;
    }

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      return;
    }

    await onCapture(imageSrc);
  };

  // Tự động chụp 1 lần khi modal mở (nếu bật autoCapture)
  useEffect(() => {
    if (!open || !autoCapture) {
      autoCapturedRef.current = false;
      return;
    }
    if (autoCapturedRef.current) return;

    const timer = setTimeout(() => {
      autoCapturedRef.current = true;
      handleClickCapture();
    }, 800); // đợi ~0.8s cho camera ổn định

    return () => {
      clearTimeout(timer);
    };
  }, [open, autoCapture]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div
          className="bg-gray-900 rounded-lg overflow-hidden relative"
          style={{ aspectRatio: "4/3" }}
        >
          {open && (
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
          {/* Overlay tĩnh gợi ý góc mặt */}
          {overlayType && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={`
                  relative border-2 border-white/90 rounded-[999px]
                  shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]
                  transition-transform duration-200
                  ${overlayType === "front" ? "w-[65%] h-[80%] translate-x-0" : ""}
                  ${overlayType === "left" ? "w-[60%] h-[75%] -translate-x-6" : ""}
                  ${overlayType === "right" ? "w-[60%] h-[75%] translate-x-6" : ""}
                `}
              >
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[11px] px-3 py-1 rounded-full">
                  {overlayType === "front" && "Giữ mặt chính diện trong khung"}
                  {overlayType === "left" && "Quay mặt sang TRÁI trong khung"}
                  {overlayType === "right" && "Quay mặt sang PHẢI trong khung"}
                </div>
              </div>
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-white text-lg font-semibold">Đang xử lý...</div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm text-gray-600">
          </p>
          <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
          </ul>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleClickCapture}
            disabled={loading}
            variant="primary"
            className="flex-1"
          >
            {loading ? "Đang xử lý..." : "Chụp ảnh"}
          </Button>
          <Button onClick={onClose} variant="secondary">
            Hủy
          </Button>
        </div>
      </div>
    </Modal>
  );
}


