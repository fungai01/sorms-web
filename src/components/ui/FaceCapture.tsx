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

export type FaceGuidanceStatus = "no-face" | "off-center" | "too-close" | "too-far" | "turn-left" | "turn-right" | "face-front" | "good";

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
  
  // Bước chụp ảnh: 1=chính diện, 2=trái, 3=phải, 4=CCCD trước, 5=CCCD sau
  faceCaptureStep?: 1 | 2 | 3 | 4 | 5;
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
  faceCaptureStep = 1,
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
        // Kiểm tra cả 2 models đã load chưa
        if (faceapi.nets.tinyFaceDetector.isLoaded && faceapi.nets.faceLandmark68Net.isLoaded) {
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
        
        // Load cả 2 models: detector và landmark
        if (!faceapi.nets.tinyFaceDetector.isLoaded) {
          await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        }
        
        if (!faceapi.nets.faceLandmark68Net.isLoaded) {
          await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        }

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

  // Tính góc yaw (góc nghiêng trái/phải) từ landmarks
  // Trả về: số dương = quay trái, số âm = quay phải, 0 = chính diện
  // Giá trị tuyệt đối càng lớn = góc nghiêng càng nhiều
  const calculateFaceYaw = (landmarks: faceapi.FaceLandmarks68): number => {
    // Landmark indices theo face-api.js 68-point model:
    // Mắt trái: 36-41, mắt phải: 42-47
    // Lấy điểm giữa mỗi mắt
    const leftEyePoints = landmarks.positions.slice(36, 42);
    const rightEyePoints = landmarks.positions.slice(42, 48);
    
    const leftEyeCenter = {
      x: leftEyePoints.reduce((sum, p) => sum + p.x, 0) / leftEyePoints.length,
      y: leftEyePoints.reduce((sum, p) => sum + p.y, 0) / leftEyePoints.length,
    };
    
    const rightEyeCenter = {
      x: rightEyePoints.reduce((sum, p) => sum + p.x, 0) / rightEyePoints.length,
      y: rightEyePoints.reduce((sum, p) => sum + p.y, 0) / rightEyePoints.length,
    };
    
    // Tính khoảng cách giữa 2 mắt (baseline)
    const eyeDistance = Math.sqrt(
      Math.pow(rightEyeCenter.x - leftEyeCenter.x, 2) + 
      Math.pow(rightEyeCenter.y - leftEyeCenter.y, 2)
    );
    
    if (eyeDistance === 0) return 0;
    
    // Tính độ lệch của điểm giữa 2 mắt so với trung tâm khuôn mặt
    // Sử dụng điểm mũi (30) làm tham chiếu
    const noseTip = landmarks.positions[30];
    const eyeMidpoint = {
      x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
      y: (leftEyeCenter.y + rightEyeCenter.y) / 2,
    };
    
    // Tính góc yaw: nếu mắt trái xa hơn mũi thì quay trái (dương), ngược lại quay phải (âm)
    const horizontalOffset = (leftEyeCenter.x - rightEyeCenter.x) / eyeDistance;
    
    // Chuyển đổi sang góc (ước tính, không chính xác 100% nhưng đủ để hướng dẫn)
    // Giá trị từ -1 đến 1, nhân với 45 độ để có góc ước tính
    const yawAngle = Math.asin(Math.max(-1, Math.min(1, horizontalOffset))) * (180 / Math.PI);
    
    return yawAngle;
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
          // Detect với landmarks để có thể tính góc nghiêng
          // Tăng inputSize để phát hiện khuôn mặt tốt hơn ở khoảng cách xa hơn
          const detection = await faceapi
            .detectSingleFace(
              video,
              new faceapi.TinyFaceDetectorOptions({
                inputSize: 512, // Tăng từ mặc định 320 lên 512 để nhận diện tốt hơn
                scoreThreshold: 0.5, // Ngưỡng điểm số (0-1), thấp hơn = nhạy cảm hơn
              })
            )
            .withFaceLandmarks();

          if (!detection) {
            setFaceStatus("no-face");
            setFaceBox(null);
            return;
          }

          const box = detection.detection.box;
          const landmarks = detection.landmarks;
          const frameW = video.videoWidth || 1;
          const frameH = video.videoHeight || 1;

          // Tính toán các giá trị kiểm tra từ box gốc
          const centerX = (box.x + box.width / 2) / frameW;
          const centerY = (box.y + box.height / 2) / frameH;
          const faceAreaRatio = (box.width * box.height) / (frameW * frameH);

          // Mở rộng vùng box để hiển thị dễ nhìn hơn
          // Padding không đều: phần trên cần nhiều hơn để bao phủ trán/tóc
          const paddingTopRatio = 0.6; // 60% phía trên (để bao phủ trán/tóc đầy đủ)
          const paddingBottomRatio = 0.1; // 10% phía dưới (giảm để tập trung vào phần trên)
          const paddingSideRatio = 0.2; // 20% hai bên
          
          const paddingTop = box.height * paddingTopRatio;
          const paddingBottom = box.height * paddingBottomRatio;
          const paddingX = box.width * paddingSideRatio;
          
          // Tính y mới - cố gắng mở rộng phần trên tối đa
          const desiredY = box.y - paddingTop;
          const expandedY = Math.max(0, desiredY);
          
          // Tính padding thực tế có thể áp dụng (có thể nhỏ hơn nếu box ở gần đầu màn hình)
          const actualPaddingTop = box.y - expandedY;
          
          // Tính height: box gốc + padding trên thực tế + padding dưới
          // Đảm bảo tổng height bao phủ đủ phần trên
          const expandedHeight = box.height + actualPaddingTop + paddingBottom;
          
          // Đảm bảo box không vượt quá giới hạn màn hình
          const expandedBox = {
            x: Math.max(0, box.x - paddingX),
            y: expandedY,
            width: Math.min(frameW, box.width + paddingX * 2),
            height: Math.min(frameH - expandedY, expandedHeight),
          };

          // lưu box mở rộng dạng tỉ lệ (0-1) để hiển thị
          setFaceBox({
            x: expandedBox.x / frameW,
            y: expandedBox.y / frameH,
            width: expandedBox.width / frameW,
            height: expandedBox.height / frameH,
          });

          const isOffCenter = Math.abs(centerX - 0.5) > 0.15 || Math.abs(centerY - 0.5) > 0.15;

          // Kiểm tra khoảng cách trước
          if (isOffCenter) {
            setFaceStatus("off-center");
            return;
          } else if (faceAreaRatio > 0.35) {
            setFaceStatus("too-close");
            return;
          } else if (faceAreaRatio < 0.08) {
            setFaceStatus("too-far");
            return;
          }

          // Kiểm tra góc nghiêng nếu có landmarks và đang chụp khuôn mặt (bước 1, 2, 3)
          if (landmarks && faceCaptureStep <= 3) {
            const yaw = calculateFaceYaw(landmarks);
            const YAW_THRESHOLD = 25; // Ngưỡng góc nghiêng (độ) cho bước 2 và 3
            
            if (faceCaptureStep === 1) {
              // Bước 1: Chụp chính diện
              // Tạm thời bỏ qua kiểm tra góc nghiêng nghiêm ngặt ở bước 1
              // Chỉ kiểm tra các điều kiện cơ bản (vị trí, khoảng cách) đã đủ
              // Cho phép chụp nếu các điều kiện khác đã đạt
              setFaceStatus("good");
              return;
            } else if (faceCaptureStep === 2) {
              // Bước 2: Chụp mặt trái - yaw phải dương (quay trái)
              if (yaw < YAW_THRESHOLD) {
                if (yaw < -YAW_THRESHOLD) {
                  setFaceStatus("turn-left"); // Đang quay phải, cần quay trái
                } else {
                  setFaceStatus("turn-left"); // Chưa đủ góc, cần quay trái thêm
                }
                return;
              } else {
                setFaceStatus("good");
              }
            } else if (faceCaptureStep === 3) {
              // Bước 3: Chụp mặt phải - yaw phải âm (quay phải)
              if (yaw > -YAW_THRESHOLD) {
                if (yaw > YAW_THRESHOLD) {
                  setFaceStatus("turn-right"); // Đang quay trái, cần quay phải
                } else {
                  setFaceStatus("turn-right"); // Chưa đủ góc, cần quay phải thêm
                }
                return;
              } else {
                setFaceStatus("good");
              }
            }
          }

          // Nếu không cần kiểm tra góc hoặc góc đã đúng
          setFaceStatus("good");
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
    
    // Hướng dẫn theo từng bước chụp
    const stepInstructions: { [key: number]: string } = {
      1: "Chụp khuôn mặt chính diện",
      2: "Chụp khuôn mặt nghiêng trái",
      3: "Chụp khuôn mặt nghiêng phải",
      4: "Chụp CCCD mặt trước",
      5: "Chụp CCCD mặt sau",
    };
    
    const stepInstruction = stepInstructions[faceCaptureStep] || "";
    
    switch (faceStatus) {
      case "no-face":
        return `${stepInstruction}. Không thấy khuôn mặt, vui lòng đưa mặt vào khung.`;
      case "off-center":
        return `${stepInstruction}. Khuôn mặt đang lệch, hãy canh vào giữa.`;
      case "too-close":
        return `${stepInstruction}. Bạn đang quá gần, hãy lùi ra một chút.`;
      case "too-far":
        return `${stepInstruction}. Bạn đang quá xa, hãy lại gần camera hơn.`;
      case "turn-left":
        return `${stepInstruction}. Vui lòng quay mặt sang trái.`;
      case "turn-right":
        return `${stepInstruction}. Vui lòng quay mặt sang phải.`;
      case "face-front":
        if (faceCaptureStep === 1) {
          return `${stepInstruction}. Vui lòng quay mặt về chính diện (nhìn thẳng vào camera).`;
        }
        return `${stepInstruction}. Vui lòng quay mặt về chính diện.`;
      case "good":
        return `${stepInstruction}. Vị trí tốt, bạn có thể chụp ảnh.`;
      default:
        return stepInstruction;
    }
  })();

  // Chỉ cho phép chụp khi:
  // - Không loading
  // - Nếu enableFaceGuidance: status phải là "good"
  // - Nếu không enableFaceGuidance: luôn cho phép
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
