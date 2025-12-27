"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import dynamic from "next/dynamic";
import * as faceapi from "face-api.js";

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

export type FaceGuidanceStatus = "no-face" | "off-center" | "too-close" | "too-far" | "good";

interface FaceCaptureProps {
  open: boolean;
  title?: string;
  loading?: boolean;
  onClose: () => void;
  onCapture: (imageSrc: string) => void | Promise<void>;


  // Tự động chụp ngay khi mở (dùng cho flow tự động)
  autoCapture?: boolean;

  enableFaceGuidance?: boolean;
  onFaceStatusChange?: (status: FaceGuidanceStatus) => void;
}

export function FaceCapture({
  open,
  title = "Chụp ảnh khuôn mặt",
  loading = false,
  onClose,
  onCapture,
  autoCapture = false,
  enableFaceGuidance = true,
  onFaceStatusChange,
}: FaceCaptureProps) {
  const webcamRef = useRef<any>(null);
  const autoCapturedRef = useRef(false);

  const [faceModelLoaded, setFaceModelLoaded] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceStatus, setFaceStatus] = useState<FaceGuidanceStatus>("no-face");
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    onFaceStatusChange?.(faceStatus);
  }, [faceStatus, onFaceStatusChange]);

  useEffect(() => {
    if (!enableFaceGuidance) return;

    let cancelled = false;

    const loadModels = async () => {
      try {
        if (faceapi.nets.tinyFaceDetector.isLoaded) {
          if (!cancelled) setFaceModelLoaded(true);
          return;
        }

        if (faceapi?.tf) {
          const currentBackend = faceapi.tf.getBackend?.();
          if (!currentBackend) {
            await import("@tensorflow/tfjs-backend-webgl");
            await faceapi.tf.setBackend("webgl");
          }
          await faceapi.tf.ready();
        }

        const MODEL_URL = "/models";
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

        if (!cancelled) setFaceModelLoaded(true);
      } catch (err) {
        console.error("Không thể load model face-api:", err);
        if (!cancelled) setFaceModelLoaded(false);
      }
    };

    loadModels();

    return () => {
      cancelled = true;
    };
  }, [enableFaceGuidance]);

  const isValidVideoElement = (video: any): video is HTMLVideoElement => {
    if (!video) return false;
    if (!(video instanceof HTMLVideoElement)) return false;
    if (!document.body.contains(video)) return false;

    if (
      video.tagName !== "VIDEO" ||
      video.readyState !== 4 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0 ||
      video.paused ||
      video.ended
    ) {
      return false;
    }

    if (!video.srcObject && !video.src) return false;

    return true;
  };

  // Detect khuôn mặt liên tục để canh (no-face / lệch / gần / xa / good)
  useEffect(() => {
    if (!open || !enableFaceGuidance) {
      setFaceStatus("no-face");
      setFaceBox(null);
      setCameraReady(false);
      return;
    }

    if (!faceModelLoaded || !cameraReady) {
      setFaceStatus("no-face");
      return;
    }

    let interval: any;
    let timeoutId: any;
    let isDetecting = false;
    let retryCount = 0;
    const MAX_RETRIES = 10;

    timeoutId = setTimeout(() => {
      interval = setInterval(async () => {
        if (isDetecting) return;

        const video = webcamRef.current?.video as HTMLVideoElement | null;

        if (!isValidVideoElement(video)) {
          retryCount++;
          if (retryCount > MAX_RETRIES) {
            setFaceStatus("no-face");
            setFaceBox(null);
          }
          return;
        }

        retryCount = 0;

        if (video.paused || video.ended || video.readyState < 4) return;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        isDetecting = true;
        try {
          const detection = await faceapi.detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions()
          );

          if (!detection) {
            setFaceStatus("no-face");
            setFaceBox(null);
            return;
          }

          const { box } = detection;
          const frameW = video.videoWidth || 1;
          const frameH = video.videoHeight || 1;

          // lưu box dạng tỉ lệ (0-1)
          setFaceBox({
            x: box.x / frameW,
            y: box.y / frameH,
            width: box.width / frameW,
            height: box.height / frameH,
          });

          const centerX = (box.x + box.width / 2) / frameW;
          const centerY = (box.y + box.height / 2) / frameH;
          const faceAreaRatio = (box.width * box.height) / (frameW * frameH);

          const isOffCenter = Math.abs(centerX - 0.5) > 0.15 || Math.abs(centerY - 0.5) > 0.15;

          if (isOffCenter) {
            setFaceStatus("off-center");
          } else if (faceAreaRatio > 0.35) {
            setFaceStatus("too-close");
          } else if (faceAreaRatio < 0.08) {
            setFaceStatus("too-far");
          } else {
            setFaceStatus("good");
          }
        } catch (err) {
          console.error("Lỗi khi detect khuôn mặt:", err);
          setFaceStatus("no-face");
          setFaceBox(null);
        } finally {
          isDetecting = false;
        }
      }, 700);
    }, 1000);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (interval) clearInterval(interval);
    };
  }, [open, enableFaceGuidance, faceModelLoaded, cameraReady]);

  const handleClickCapture = async () => {
    if (!webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

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
    }, 800);

    return () => {
      clearTimeout(timer);
    };
  }, [open, autoCapture]);

  const guidanceText = (() => {
    if (!enableFaceGuidance) return "";
    switch (faceStatus) {
      case "no-face":
        return "Không thấy khuôn mặt, vui lòng đưa mặt vào khung.";
      case "off-center":
        return "Khuôn mặt đang lệch, hãy canh vào giữa.";
      case "too-close":
        return "Bạn đang quá gần, hãy lùi ra một chút.";
      case "too-far":
        return "Bạn đang quá xa, hãy lại gần camera hơn.";
      case "good":
        return "Vị trí tốt, bạn có thể chụp ảnh.";
      default:
        return "";
    }
  })();

  const canCapture = !loading && (!enableFaceGuidance || faceStatus === "good");

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="bg-gray-900 rounded-lg overflow-hidden relative" style={{ aspectRatio: "4/3" }}>
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
              onUserMedia={() => {
                // Next.js 15: đợi video mount ổn định
                setTimeout(() => {
                  const video = webcamRef.current?.video;
                  if (video && video instanceof HTMLVideoElement) {
                    setCameraReady(true);
                  } else {
                    setTimeout(() => {
                      const retryVideo = webcamRef.current?.video;
                      if (retryVideo && retryVideo instanceof HTMLVideoElement) {
                        setCameraReady(true);
                      }
                    }, 200);
                  }
                }, 100);
              }}
              onUserMediaError={() => {
                setCameraReady(false);
                setFaceStatus("no-face");
                setFaceBox(null);
              }}
            />
          )}


          {/* Vẽ khung khuôn mặt (tỉ lệ 0-1) */}
          {enableFaceGuidance && faceBox && (
            <div
              className={`absolute border-4 rounded-xl pointer-events-none shadow-lg ${
                faceStatus === "good" ? "border-green-400" : "border-amber-400"
              }`}
              style={{
                left: `${faceBox.x * 100}%`,
                top: `${faceBox.y * 100}%`,
                width: `${faceBox.width * 100}%`,
                height: `${faceBox.height * 100}%`,
                boxSizing: "border-box",
              }}
            />
          )}

          {loading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-white text-lg font-semibold">Đang xử lý...</div>
            </div>
          )}
        </div>

        {enableFaceGuidance && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm text-blue-900 font-medium">Hướng dẫn</p>
            <p className="text-xs text-blue-800 mt-1">{guidanceText}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={handleClickCapture} disabled={!canCapture} variant="primary" className="flex-1">
            {loading ? "Đang xử lý..." : "Chụp ảnh"}
          </Button>
          <Button onClick={onClose} variant="secondary" disabled={loading}>
            Hủy
          </Button>
        </div>
      </div>
    </Modal>
  );
}
