"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import dynamic from "next/dynamic";

// Dynamic import Webcam để tránh SSR issues
const WebcamComponent = dynamic(
  // @ts-ignore - react-webcam type incompatibility with Next.js dynamic import
  () => import("react-webcam"),
  { 
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-900 flex items-center justify-center text-white">Đang tải camera...</div>
  }
) as any;

type Room = {
  id: number;
  code: string;
  name?: string;
  roomTypeId?: number;
  roomTypeName?: string;
  status?: string;
  floor?: number;
  capacity?: number;
  price?: number;
  description?: string;
};

type DoorStatus = {
  success: boolean;
  message?: string;
  error?: string;
  confidence?: number;
  userId?: string;
  bookingId?: number;
};

export default function OpenDoorPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [doorStatus, setDoorStatus] = useState<DoorStatus | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [autoCaptureCountdown, setAutoCaptureCountdown] = useState<number | null>(null);
  
  // Webcam ref for face capture
  const webcamRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const faceDetectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoCapturedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const lastDetectionTimeRef = useRef<number>(0);
  const doorOpenedSuccessfullyRef = useRef(false);

  // Auto-hide flash messages
  useEffect(() => {
    if (flash) {
      const timer = setTimeout(() => setFlash(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [flash]);

  // Fetch rooms on mount
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoadingRooms(true);
        const response = await fetch('/api/system/rooms', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch rooms');
        }

        const data = await response.json();
        const roomsList = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
        setRooms(roomsList);
      } catch (error: any) {
        console.error('Error fetching rooms:', error);
        setFlash({ type: 'error', text: 'Không thể tải danh sách phòng. Vui lòng thử lại.' });
      } finally {
        setLoadingRooms(false);
      }
    };

    fetchRooms();
  }, []);

  const handleRoomSelect = (room: Room) => {
    // Clear any existing intervals first
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }
    
    setSelectedRoom(room);
    setShowCamera(true);
    setDoorStatus(null);
    setCameraError(null);
    setFlash(null);
    setFaceDetected(false);
    setAutoCaptureCountdown(null);
    hasAutoCapturedRef.current = false;
    isProcessingRef.current = false;
    lastDetectionTimeRef.current = 0;
    doorOpenedSuccessfullyRef.current = false; // Reset success flag
  };

  const handleBackToRooms = () => {
    // Clear face detection interval
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }
    
    setSelectedRoom(null);
    setShowCamera(false);
    setDoorStatus(null);
    setCameraError(null);
    setFlash(null);
    setFaceDetected(false);
    setAutoCaptureCountdown(null);
    hasAutoCapturedRef.current = false;
    isProcessingRef.current = false;
    lastDetectionTimeRef.current = 0;
    doorOpenedSuccessfullyRef.current = false; // Reset success flag
  };

  const handleOpenDoor = async () => {
    if (!webcamRef.current || !selectedRoom) {
      setFlash({ type: 'error', text: 'Không thể truy cập camera hoặc chưa chọn phòng.' });
      return;
    }

    // Prevent multiple simultaneous requests
    if (isProcessingRef.current || loading) {
      console.log('[Open Door] Request already in progress, skipping...');
      return;
    }

    try {
      isProcessingRef.current = true;
      setLoading(true);
      setFlash(null);
      setDoorStatus(null);
      
      // Stop face detection to prevent spam
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
        faceDetectionIntervalRef.current = null;
      }

      // Capture image from webcam
      const screenshot = webcamRef.current.getScreenshot({
        width: 800,
        height: 600,
        screenshotQuality: 0.9,
        screenshotFormat: 'image/jpeg'
      });
      
      if (!screenshot) {
        setFlash({ type: 'error', text: 'Không thể chụp ảnh từ camera' });
        setLoading(false);
        return;
      }

      // Convert base64 to Blob
      const imgRes = await fetch(screenshot);
      const blob = await imgRes.blob();
      const file = new File([blob], `door-face-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });

      // Create FormData
      const formData = new FormData();
      formData.append('image', file);

      // Call API to open door
      console.log('[Open Door] Sending request to API...');
      const response = await fetch(`/api/security/open-door`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      console.log('[Open Door] Response status:', response.status, response.statusText);

      let data: any = {};
      try {
        const text = await response.text();
        console.log('[Open Door] Response text:', text);
        if (text) {
          data = JSON.parse(text);
          console.log('[Open Door] Parsed response data:', data);
        }
      } catch (parseError) {
        console.error('[Open Door] Failed to parse response:', parseError);
        if (!response.ok) {
          const errorMsg = `Lỗi từ server: ${response.status} ${response.statusText}`;
          setDoorStatus({
            success: false,
            error: errorMsg,
          });
          setFlash({ type: 'error', text: errorMsg });
          setLoading(false);
          return;
        }
      }

      // Backend returns ApiResponse<CheckDoorResponse>
      // Response structure: { responseCode: "S0000", message: "SUCCESS", data: { access: true/false, userId, confidence, message, bookingId } }
      console.log('[Open Door] Response status:', response.status);
      console.log('[Open Door] Response data:', data);

      if (!response.ok) {
        // Handle HTTP error status codes (4xx, 5xx)
        const errorMessage = data?.message || data?.error || data?.data?.message || 'Không thể mở cửa. Vui lòng thử lại.';
        const responseCode = data?.responseCode;
        
        console.error('[Open Door] HTTP Error response:', {
          status: response.status,
          responseCode,
          message: errorMessage,
          data
        });

        setDoorStatus({
          success: false,
          error: errorMessage,
        });
        setFlash({ type: 'error', text: errorMessage });
        setLoading(false);
        return;
      }

      // Check response structure
      // Backend returns: { responseCode: "S0000", message: "SUCCESS", data: { access: true/false, ... } }
      const doorData = data?.data || data;
      const responseCode = data?.responseCode;
      
      // Check if responseCode indicates success (S0000, SUCCESS, or 200)
      const isSuccessResponse = responseCode === 'S0000' || responseCode === 'SUCCESS' || responseCode === '200' || !responseCode;
      
      if (!isSuccessResponse) {
        // ResponseCode indicates an error
        const errorMsg = data?.message || doorData?.message || 'Không thể kiểm tra quyền truy cập. Vui lòng thử lại.';
        console.error('[Open Door] Backend error responseCode:', responseCode, errorMsg);
        setDoorStatus({
          success: false,
          error: errorMsg,
        });
        setFlash({ type: 'error', text: errorMsg });
        setLoading(false);
        return;
      }

      // Check if access is granted
      const accessGranted = doorData?.access === true || doorData?.access === 'true' || data?.access === true;

      if (!accessGranted) {
        // Access denied - show message from backend
        const errorMsg = doorData?.message || data?.message || 'Truy cập bị từ chối. Khuôn mặt không khớp hoặc không có quyền.';
        console.log('[Open Door] Access denied:', {
          responseCode,
          message: errorMsg,
          userId: doorData?.userId,
          confidence: doorData?.confidence
        });
        setDoorStatus({
          success: false,
          error: errorMsg,
        });
        setFlash({ type: 'error', text: errorMsg });
        setLoading(false);
        return;
      }

      // Mark door as opened successfully FIRST (before setting state)
      doorOpenedSuccessfullyRef.current = true;
      
      // Stop face detection immediately when door opens successfully
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
        faceDetectionIntervalRef.current = null;
      }
      hasAutoCapturedRef.current = true;
      setFaceDetected(false);
      setAutoCaptureCountdown(null);
      
      setDoorStatus({
        success: true,
        message: doorData?.message || 'Đã mở cửa thành công!',
        confidence: doorData?.confidence,
        userId: doorData?.userId,
        bookingId: doorData?.bookingId,
      });
      setFlash({ type: 'success', text: doorData?.message || 'Đã mở cửa thành công!' });
    } catch (error: any) {
      setDoorStatus({
        success: false,
        error: error?.message || 'Lỗi khi mở cửa',
      });
      setFlash({ type: 'error', text: error?.message || 'Lỗi khi mở cửa' });
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toUpperCase()) {
      case 'AVAILABLE':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'OCCUPIED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'MAINTENANCE':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'CLEANING':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'OUT_OF_SERVICE':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status?.toUpperCase()) {
      case 'AVAILABLE':
        return 'Trống';
      case 'OCCUPIED':
        return 'Đã thuê';
      case 'MAINTENANCE':
        return 'Bảo trì';
      case 'CLEANING':
        return 'Đang dọn';
      case 'OUT_OF_SERVICE':
        return 'Ngừng phục vụ';
      default:
        return status || 'N/A';
    }
  };

  // Simple face detection using canvas and basic image analysis
  const startFaceDetection = () => {
    if (!videoRef.current || hasAutoCapturedRef.current || doorOpenedSuccessfullyRef.current) return;

    // Clear any existing interval first
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }

    const checkFace = () => {
      // Stop if door already opened successfully (using ref for immediate check)
      if (doorOpenedSuccessfullyRef.current) {
        if (faceDetectionIntervalRef.current) {
          clearInterval(faceDetectionIntervalRef.current);
          faceDetectionIntervalRef.current = null;
        }
        return;
      }

      if (!videoRef.current || hasAutoCapturedRef.current || loading || isProcessingRef.current) return;
      
      // Throttle: only check every 1 second to prevent spam
      const now = Date.now();
      if (now - lastDetectionTimeRef.current < 1000) {
        return;
      }
      lastDetectionTimeRef.current = now;

      try {
        const video = videoRef.current;
        if (video.readyState !== 4) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Simple face detection: check for skin tone pixels in center area
        // This is a simplified approach - in production, use proper face detection library
        let skinPixels = 0;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const checkRadius = Math.min(canvas.width, canvas.height) * 0.3;

        for (let y = centerY - checkRadius; y < centerY + checkRadius; y += 5) {
          for (let x = centerX - checkRadius; x < centerX + checkRadius; x += 5) {
            const idx = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // Simple skin tone detection (RGB ranges for skin)
            if (r > 95 && g > 40 && b > 20 && 
                Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
                Math.abs(r - g) > 15 && r > g && r > b) {
              skinPixels++;
            }
          }
        }

        const totalPixels = (checkRadius * 2 / 5) * (checkRadius * 2 / 5);
        const skinRatio = skinPixels / totalPixels;

        // If enough skin pixels detected (likely a face), start countdown
        if (skinRatio > 0.15 && !hasAutoCapturedRef.current) {
          setFaceDetected(true);
          
          if (autoCaptureCountdown === null) {
            let countdown = 3;
            setAutoCaptureCountdown(countdown);
            
            const countdownInterval = setInterval(() => {
              countdown--;
              setAutoCaptureCountdown(countdown);
              
              if (countdown <= 0) {
                clearInterval(countdownInterval);
                setAutoCaptureCountdown(null);
                hasAutoCapturedRef.current = true;
                handleOpenDoor();
              } else if (skinRatio < 0.1) {
                // Face moved away, reset
                clearInterval(countdownInterval);
                setFaceDetected(false);
                setAutoCaptureCountdown(null);
              }
            }, 1000);
          }
        } else if (skinRatio < 0.1) {
          setFaceDetected(false);
          setAutoCaptureCountdown(null);
        }
      } catch (error) {
        console.error('Face detection error:', error);
      }
    };

    // Check every 2 seconds to prevent spam (reduced from 500ms)
    faceDetectionIntervalRef.current = setInterval(checkFace, 2000);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
        faceDetectionIntervalRef.current = null;
      }
    };
  }, []);

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Mở cửa phòng</h1>
              <p className="text-sm text-gray-600 mt-1">
                {selectedRoom ? `Phòng ${selectedRoom.code}` : 'Chọn phòng để mở cửa'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-4xl mx-auto px-4 py-4">
        <div className="space-y-4">
          {/* Flash Messages */}
          {flash && (
            <div className={`rounded-lg border p-4 text-sm ${
              flash.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {flash.text}
            </div>
          )}

          {/* Room List View */}
          {!selectedRoom && (
            <Card className="border-0 shadow-none">
              <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-4">
                <h2 className="text-lg font-semibold">Danh sách phòng</h2>
              </CardHeader>
              <CardBody className="space-y-4 p-4">
                {loadingRooms ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Đang tải danh sách phòng...</p>
                    </div>
                  </div>
                ) : rooms.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-600 mb-4">Không có phòng nào</p>
                    <Button
                      onClick={() => window.location.reload()}
                      variant="secondary"
                    >
                      Tải lại
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rooms.map((room) => (
                      <div
                        key={room.id}
                        onClick={() => handleRoomSelect(room)}
                        className="group relative bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 cursor-pointer"
                      >
                        {/* Gradient Header with Status */}
                        <div className="relative h-32 bg-gradient-to-br from-gray-500 via-gray-600 to-gray-700 overflow-hidden">
                          <div className="absolute inset-0 opacity-10">
                            <div className="absolute inset-0" style={{
                              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.1) 10px, rgba(255,255,255,.1) 20px)`
                            }}></div>
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <svg className="w-16 h-16 text-white opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                          </div>
                          <div className="absolute top-3 right-3">
                            <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-md px-2 py-0.5">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(room.status)}`}>
                                {getStatusText(room.status)}
                              </span>
                            </div>
                          </div>
                          <div className="absolute bottom-3 left-3">
                            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1">
                              <p className="text-white font-bold text-lg">{room.name || room.roomTypeName || room.code}</p>
                            </div>
                          </div>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-600/0 to-gray-700/0 group-hover:from-gray-600/5 group-hover:to-gray-700/5 transition-opacity duration-300 pointer-events-none rounded-xl"></div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Room Detail & Camera View */}
          {selectedRoom && (
            <Card className="border-0 shadow-none">
              <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Phòng {selectedRoom.code}</h2>
                    {selectedRoom.roomTypeName && (
                      <p className="text-sm text-green-100 mt-1">{selectedRoom.roomTypeName}</p>
                    )}
                  </div>
                  <Button
                    onClick={handleBackToRooms}
                    variant="secondary"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  >
                    ← Quay lại
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="p-4 space-y-4">
                {/* Camera Section */}
                {showCamera && !doorStatus?.success && (
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        Vui lòng đưa khuôn mặt vào khung hình và nhấn nút để chụp ảnh và mở cửa.
                      </p>
                    </div>
                    
                    <div className="relative rounded overflow-hidden border border-gray-200 h-[450px] bg-gray-900 webcam-container" style={{ width: '100%' }}>
                      <WebcamComponent
                        ref={webcamRef as any}
                        audio={false}
                        className="w-full h-full object-cover webcam-video"
                        screenshotFormat="image/jpeg"
                        screenshotQuality={0.9}
                        videoConstraints={{ 
                          facingMode: "user",
                          width: { ideal: 800 },
                          height: { ideal: 600 },
                          frameRate: { ideal: 15, max: 30 }
                        }}
                        width={800}
                        height={600}
                        onUserMedia={(stream: MediaStream) => {
                          setCameraError(null);
                          // Get video element for face detection
                          if (webcamRef.current?.video) {
                            videoRef.current = webcamRef.current.video;
                            startFaceDetection();
                          }
                        }}
                        onUserMediaError={(e: unknown) => {
                          const name = (e as any)?.name;
                          if (name === "NotAllowedError") {
                            setCameraError("Bạn chưa cấp quyền camera. Vui lòng cho phép và thử lại.");
                          } else if (name === "NotFoundError" || name === "OverconstrainedError") {
                            setCameraError("Không tìm thấy thiết bị camera phù hợp.");
                          } else {
                            setCameraError("Không thể truy cập camera. Vui lòng thử lại.");
                          }
                          if (faceDetectionIntervalRef.current) {
                            clearInterval(faceDetectionIntervalRef.current);
                            faceDetectionIntervalRef.current = null;
                          }
                        }}
                      />
                      
                      {/* Face detection status */}
                      {faceDetected && autoCaptureCountdown !== null && !hasAutoCapturedRef.current && (
                        <div className="absolute top-4 left-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-20">
                          <p className="text-sm font-semibold">
                            Đã phát hiện khuôn mặt! Tự động chụp sau {autoCaptureCountdown} giây...
                          </p>
                        </div>
                      )}
                      
                      {/* Hiển thị lỗi trong khung camera */}
                      {(cameraError || (flash && flash.type === 'error')) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-95 z-10">
                          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mx-4 max-w-md text-center">
                            <div className="text-red-600 text-4xl mb-2">⚠️</div>
                            <p className="text-sm font-semibold text-red-800 mb-1">Lỗi</p>
                            <p className="text-sm text-red-700">{cameraError || flash?.text}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={handleOpenDoor}
                        disabled={loading || !!cameraError}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        {loading ? 'Đang xử lý...' : '📸 Chụp ảnh & Mở cửa'}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleBackToRooms}
                        disabled={loading}
                      >
                        Hủy
                      </Button>
                    </div>

                    {doorStatus?.error && !doorStatus.success && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-700">{doorStatus.error}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Success Message */}
                {doorStatus?.success && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-6 text-center mt-4">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-green-800 mb-4">Đã mở cửa thành công!</h3>
                    <p className="text-sm text-gray-700 mb-2">{doorStatus.message}</p>
                    {doorStatus.confidence && (
                      <p className="text-xs text-gray-600 mb-4">
                        Độ tin cậy: {(doorStatus.confidence * 100).toFixed(1)}%
                      </p>
                    )}
                    <Button
                      onClick={handleBackToRooms}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      Quay lại danh sách phòng
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

