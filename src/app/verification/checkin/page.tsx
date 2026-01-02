"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import dynamic from "next/dynamic";
import { Html5Qrcode } from "html5-qrcode";
import * as faceapi from "face-api.js";
import { apiClient } from "@/lib/api-client";

const WebcamComponent = dynamic(() => import("react-webcam") as any, { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <p className="text-sm text-gray-500">Đang khởi động camera...</p>
    </div>
  )
}) as any;

type BookingInfo = {
  bookingId?: number;
  userId?: string;
  roomCode?: string;
  checkinDate?: string;
  checkoutDate?: string;
  numGuests?: number;
  bookingCode?: string;
};

type Step = 'scan' | 'info' | 'face' | 'success';

export default function CheckInPage() {
  const [step, setStep] = useState<Step>('scan');
  const [loading, setLoading] = useState(false);
  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [roomKey, setRoomKey] = useState<string | null>(null);
  
  const [scanning, setScanning] = useState(false);
  const [qrScanner, setQrScanner] = useState<Html5Qrcode | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);
  
  const webcamRef = useRef<any>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceModelLoaded, setFaceModelLoaded] = useState(false);
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (flash) {
      const timer = setTimeout(() => setFlash(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [flash]);

  // Load face-api.js models
  useEffect(() => {
    if (step !== 'face') {
      setFaceModelLoaded(false);
      setFaceBox(null);
      return;
    }

    let cancelled = false;

    const loadModels = async () => {
      try {
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
  }, [step]);

  // Detect face continuously
  useEffect(() => {
    if (step !== 'face' || !faceModelLoaded || !cameraReady) {
      setFaceBox(null);
      return;
    }

    let interval: any;
    let timeoutId: any;
    let isDetecting = false;

    timeoutId = setTimeout(() => {
      interval = setInterval(async () => {
        if (isDetecting) return;

        const video = webcamRef.current?.video as HTMLVideoElement | null;
        if (!video || video.readyState < 4 || video.paused || video.ended) return;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        isDetecting = true;
        try {
          const detection = await faceapi
            .detectSingleFace(
              video,
              new faceapi.TinyFaceDetectorOptions({
                inputSize: 512,
                scoreThreshold: 0.5,
              })
            )
            .withFaceLandmarks();

          if (!detection) {
            setFaceBox(null);
            return;
          }

          const box = detection.detection.box;
          const frameW = video.videoWidth || 1;
          const frameH = video.videoHeight || 1;

          // Mở rộng vùng box tương tự FaceCapture
          const paddingTopRatio = 0.6;
          const paddingBottomRatio = 0.1;
          const paddingSideRatio = 0.2;
          
          const paddingTop = box.height * paddingTopRatio;
          const paddingBottom = box.height * paddingBottomRatio;
          const paddingX = box.width * paddingSideRatio;
          
          const desiredY = box.y - paddingTop;
          const expandedY = Math.max(0, desiredY);
          const actualPaddingTop = box.y - expandedY;
          const expandedHeight = box.height + actualPaddingTop + paddingBottom;
          
          const expandedBox = {
            x: Math.max(0, box.x - paddingX),
            y: expandedY,
            width: Math.min(frameW, box.width + paddingX * 2),
            height: Math.min(frameH - expandedY, expandedHeight),
          };

          setFaceBox({
            x: expandedBox.x / frameW,
            y: expandedBox.y / frameH,
            width: expandedBox.width / frameW,
            height: expandedBox.height / frameH,
          });
        } catch (err) {
          console.error("Lỗi khi detect khuôn mặt:", err);
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
  }, [step, faceModelLoaded, cameraReady]);

  useEffect(() => {
    if (step !== 'scan') return;
    
    let isMounted = true;
    let scannerInstance: Html5Qrcode | null = null;

    const startScanning = async () => {
      if (!isMounted) return;
      const element = document.getElementById("qr-reader");
      if (!element || element.children.length > 0 || qrScanner) return;

      try {
        scannerInstance = new Html5Qrcode("qr-reader");
        if (!isMounted) { try { await scannerInstance.clear(); } catch {} return; }

        setQrScanner(scannerInstance);
        setScanning(true);
        
        const size = Math.min(window.innerWidth * 0.85, window.innerHeight * 0.5, 350);
        
        await scannerInstance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: size, height: size }, aspectRatio: 1.0 },
          async (decodedText) => {
            if (!isMounted || isProcessingRef.current) return;
            isProcessingRef.current = true;
            try {
              if (scannerInstance) { await scannerInstance.stop(); await scannerInstance.clear(); }
              setScanning(false);
              setQrScanner(null);
              await processQRCode(decodedText);
            } catch { isProcessingRef.current = false; }
          },
          () => {}
        );
      } catch {
        setFlash({ type: 'error', text: 'Không thể khởi động camera' });
        setScanning(false);
      }
    };

    const timer = setTimeout(() => { if (isMounted && scannerRef.current) startScanning(); }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerInstance) { try { scannerInstance.stop(); } catch {} try { scannerInstance.clear(); } catch {} }
    };
  }, [step]);

  const processQRCode = async (token: string) => {
    const tokenToProcess = (token || '').trim();
    if (!tokenToProcess) {
      setFlash({ type: 'error', text: 'Mã QR không hợp lệ' });
      isProcessingRef.current = false;
      return;
    }

    setLoading(true);

    let bookingId: number | null = null;
    let userId: string | null = null;

    const tryDecode = (t: string): any | null => {
      try { let b64 = t.replace(/-/g, '+').replace(/_/g, '/'); while (b64.length % 4 !== 0) b64 += '='; return JSON.parse(atob(b64)); } catch {}
      try { return JSON.parse(atob(t)); } catch {}
      try { return JSON.parse(t); } catch {}
      return null;
    };

    const payload = tryDecode(tokenToProcess);

    if (tokenToProcess.includes('|')) {
      const parts = tokenToProcess.split('|');
      if (parts.length >= 2 && /^\d+$/.test(parts[0].trim())) {
        bookingId = Number(parts[0].trim());
        userId = parts[1].trim() || null;
      }
    } else if (payload && typeof payload === 'object') {
      bookingId = Number(payload.bookingId || payload.id || payload.booking_id);
      userId = payload.userId ? String(payload.userId) : null;
    } else if (/^\d+$/.test(tokenToProcess)) {
      bookingId = Number(tokenToProcess);
    }

    if (!bookingId || Number.isNaN(bookingId)) {
      setLoading(false);
      setFlash({ type: 'error', text: 'Không thể đọc thông tin từ mã QR' });
      isProcessingRef.current = false;
      return;
    }

    try {
      const res = await fetch(`/api/system/bookings?id=${bookingId}`, { credentials: 'include' });
      if (!res.ok) {
        setLoading(false);
        setFlash({ type: 'error', text: 'Không tìm thấy thông tin đặt phòng' });
        isProcessingRef.current = false;
        return;
      }

      const b = await res.json();
      const finalUserId = userId || b.userId || b.user_id || b.accountId || b.account_id;

      if (!finalUserId) {
        setLoading(false);
        setFlash({ type: 'error', text: 'Thiếu thông tin người dùng' });
        isProcessingRef.current = false;
        return;
      }


      // Helper để lấy roomCode từ nhiều nguồn (ưu tiên name, sau đó code)
      const getRoomCode = async () => {
        // Ưu tiên tên phòng (name), sau đó mới đến code
        const roomName = b.roomName || 
                        b.room_name || 
                        b.room?.name ||
                        b.room?.roomName;
        
        const roomCode = b.roomCode || 
                        b.room_code || 
                        b.room?.code ||
                        b.room?.roomCode ||
                        b.room?.room_code;
        
        // Nếu đã có tên hoặc code từ booking object, trả về ngay
        if (roomName) return roomName;
        if (roomCode) return roomCode;
        
        // Nếu không có, thử gọi API để lấy thông tin room từ roomId
        const roomId = b.roomId || b.room_id;
        if (roomId) {
          try {
            const roomRes = await apiClient.getRoom(Number(roomId));
            if (roomRes.success && roomRes.data) {
              const roomData = roomRes.data as any;
              // Ưu tiên name, sau đó code
              return roomData.name?.trim() || roomData.code || 'N/A';
            }
          } catch (error) {
            console.error('Không thể lấy thông tin phòng từ API:', error);
          }
        }
        
        return 'N/A';
      };

      const resolvedRoomCode = await getRoomCode();
      
      setBookingInfo({
        bookingId,
        userId: finalUserId,
        bookingCode: b.code || b.bookingCode || `BK-${bookingId}`,
        roomCode: resolvedRoomCode,
        checkinDate: b.checkinDate || b.checkin_date || b.checkInDate,
        checkoutDate: b.checkoutDate || b.checkout_date || b.checkOutDate,
        numGuests: b.numGuests || b.num_guests || b.guests || 1,
      });
      
      setStep('info');
      setFlash({ type: 'success', text: 'Đã quét mã QR thành công!' });
    } catch {
      setFlash({ type: 'error', text: 'Lỗi kết nối đến server' });
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      setFlash({ type: 'error', text: 'Vui lòng chọn file ảnh' });
      return;
    }

    setLoading(true);
    try {
      const tempId = 'temp-qr-' + Date.now();
      const tempDiv = document.createElement('div');
      tempDiv.id = tempId;
      tempDiv.style.display = 'none';
      document.body.appendChild(tempDiv);

      const scanner = new Html5Qrcode(tempId);
      const result = await scanner.scanFile(file, true);
      document.body.removeChild(tempDiv);
      
      if (result) await processQRCode(result);
      else setFlash({ type: 'error', text: 'Không tìm thấy mã QR trong ảnh' });
    } catch {
      setFlash({ type: 'error', text: 'Không thể đọc mã QR từ ảnh' });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCheckIn = async () => {
    if (!bookingInfo?.bookingId || !bookingInfo?.userId || !webcamRef.current) return;

    if (bookingInfo.checkinDate && bookingInfo.checkoutDate) {
      const now = new Date();
      const checkin = new Date(bookingInfo.checkinDate);
      const checkout = new Date(bookingInfo.checkoutDate);
      
      if (now < checkin) {
        setFlash({ type: 'error', text: `Chưa đến thời gian check-in` });
        return;
      }
      if (now > checkout) {
        setFlash({ type: 'error', text: `Đã quá thời gian check-in` });
        return;
      }
    }

    setLoading(true);
    try {
      const screenshot = webcamRef.current.getScreenshot({ width: 640, height: 480, screenshotQuality: 0.9 });
      if (!screenshot) {
        setFlash({ type: 'error', text: 'Không thể chụp ảnh từ camera' });
        setLoading(false);
        return;
      }

      const imgRes = await fetch(screenshot);
      const blob = await imgRes.blob();
      const file = new File([blob], `checkin-${Date.now()}.jpg`, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('bookingId', String(bookingInfo.bookingId));
      formData.append('userId', String(bookingInfo.userId));
      formData.append('faceImage', file);
      formData.append('faceRef', 'true');

      const res = await fetch(`/api/system/bookings?id=${bookingInfo.bookingId}&action=checkin`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || (data.responseCode && data.responseCode !== 'S0000')) {
        // Kiểm tra nếu là lỗi face recognition không khớp
        const isFaceRecognitionError = 
          (data.responseCode === 'AU0001' || res.status === 401) && 
          step === 'face' && 
          file && file.size > 0;
        
        let errorMessage = data?.message || 'Không thể thực hiện check-in';
        
        if (isFaceRecognitionError) {
          // Hiển thị message cụ thể về lỗi face recognition
          if (data?.message && data.message.toLowerCase().includes('unauthenticated')) {
            errorMessage = 'Khuôn mặt không khớp với thông tin đăng ký. Vui lòng đảm bảo khuôn mặt rõ ràng và đúng người, sau đó thử lại.';
          } else {
            errorMessage = 'Khuôn mặt không khớp với thông tin đăng ký. Vui lòng thử lại hoặc đảm bảo khuôn mặt rõ ràng và đúng người.';
          }
        }
        
        setFlash({ type: 'error', text: errorMessage });
        setLoading(false);
        return;
      }

      setRoomKey(data?.data?.roomCode || bookingInfo.roomCode || `KEY-${bookingInfo.bookingId}`);
      setStep('success');
      setFlash({ type: 'success', text: 'Check-in thành công!' });
    } catch (error: any) {
      setFlash({ type: 'error', text: error?.message || 'Lỗi khi thực hiện check-in' });
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setStep('scan');
    setBookingInfo(null);
    setRoomKey(null);
    setCameraError(null);
    isProcessingRef.current = false;
  };

  const formatDate = (date?: string) => date ? new Date(date).toLocaleDateString('vi-VN') : 'N/A';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-2xl mx-auto px-6 pt-4 pb-6">
        {/* Header */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden mb-6">
          <div className="border-b border-gray-200/50 px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Xác thực</p>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Check-in</h1>
                <p className="text-sm text-gray-500 mt-1">Quét mã QR và xác thực khuôn mặt để nhận phòng</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden mb-6">
          <CardBody className="py-4">
            <div className="flex items-center justify-between">
              {['scan', 'info', 'face', 'success'].map((s, i) => (
                <div key={s} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-all ${
                      step === s ? 'bg-[hsl(var(--primary))] text-white scale-110' :
                      ['scan', 'info', 'face', 'success'].indexOf(step) > i ? 'bg-green-500 text-white' :
                      'bg-gray-200 text-gray-500'
                    }`}>
                      {['scan', 'info', 'face', 'success'].indexOf(step) > i ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span className={`text-xs mt-2 font-medium ${
                      step === s ? 'text-[hsl(var(--primary))]' :
                      ['scan', 'info', 'face', 'success'].indexOf(step) > i ? 'text-green-600' :
                      'text-gray-500'
                    }`}>
                      {s === 'scan' ? 'Quét QR' : s === 'info' ? 'Thông tin' : s === 'face' ? 'Xác thực' : 'Hoàn tất'}
                    </span>
                  </div>
                  {i < 3 && (
                    <div className={`flex-1 h-1 mx-2 rounded-full transition-all ${
                      ['scan', 'info', 'face', 'success'].indexOf(step) > i ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </div>

        {/* Flash */}
        {flash && (
          <div className={`mb-4 p-3 rounded-xl border shadow-sm animate-fade-in flex items-center gap-2 ${
            flash.type === 'success' ? 'bg-green-50 text-green-800 border-green-100' : 'bg-red-50 text-red-800 border-red-100'
          }`}>
            <svg className={`w-5 h-5 flex-shrink-0 ${flash.type === 'success' ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {flash.type === 'success' 
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              }
            </svg>
            <span className="text-sm font-medium">{flash.text}</span>
          </div>
        )}

        {/* Step 1: QR Scan */}
        {step === 'scan' && (
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[hsl(var(--primary))] rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Quét mã QR</h2>
                  <p className="text-sm text-gray-500">Đưa mã QR vào khung hình</p>
                </div>
              </div>
            </CardHeader>
            <CardBody className="p-6">
              <div className="relative aspect-square max-w-md mx-auto rounded-xl overflow-hidden bg-gray-100 mb-6 border-2 border-gray-200 shadow-inner">
                <div id="qr-reader" ref={scannerRef} className="w-full h-full" />
                
                {scanning && (
                  <div className="absolute top-4 left-4 bg-[hsl(var(--primary))] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    Đang quét...
                  </div>
                )}
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="qr-file" />
              <Button variant="secondary" className="w-full h-12 text-sm font-medium rounded-xl" disabled={loading} onClick={() => fileInputRef.current?.click()}>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {loading ? 'Đang xử lý...' : 'Tải ảnh QR từ thiết bị'}
              </Button>
            </CardBody>
          </Card>
        )}

        {/* Step 2: Booking Info */}
        {step === 'info' && bookingInfo && (
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[hsl(var(--primary))] rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Thông tin đặt phòng</h2>
                  <p className="text-sm text-gray-500">Kiểm tra thông tin trước khi tiếp tục</p>
                </div>
              </div>
            </CardHeader>
            <CardBody className="p-6">
              <div className="space-y-3 mb-6">
                <InfoRow label="Mã đặt phòng" value={bookingInfo.bookingCode || `#${bookingInfo.bookingId}`} />
                <InfoRow label="ID khách hàng" value={bookingInfo.userId || 'N/A'} />
                <InfoRow label="Phòng" value={bookingInfo.roomCode || 'N/A'} highlight />
                <InfoRow label="Số khách" value={String(bookingInfo.numGuests || 'N/A')} />
                <InfoRow label="Check-in" value={formatDate(bookingInfo.checkinDate)} />
                <InfoRow label="Check-out" value={formatDate(bookingInfo.checkoutDate)} />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Button variant="secondary" className="flex-1 h-12 text-sm font-medium rounded-xl" onClick={resetAll}>
                  Quay lại
                </Button>
                <Button variant="primary" className="flex-1 h-12 text-sm font-medium rounded-xl" onClick={() => setStep('face')}>
                  Tiếp tục
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Step 3: Face Capture */}
        {step === 'face' && bookingInfo && (
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[hsl(var(--primary))] rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Xác thực khuôn mặt</h2>
                  <p className="text-sm text-gray-500">Đưa khuôn mặt vào khung hình</p>
                </div>
              </div>
            </CardHeader>
            <CardBody className="p-6">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 mb-6 border-2 border-gray-200 shadow-inner">
                <WebcamComponent
                  ref={webcamRef}
                  audio={false}
                  className="w-full h-full object-cover"
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.9}
                  videoConstraints={{ facingMode: "user", width: 640, height: 480 }}
                  onUserMedia={() => {
                    setCameraError(null);
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
                    setCameraError("Không thể truy cập camera");
                    setCameraReady(false);
                  }}
                />
                
                {/* Vẽ khung khuôn mặt khi detect được */}
                {faceBox && (
                  <div
                    className="absolute border-4 rounded-xl pointer-events-none shadow-lg border-green-400"
                    style={{
                      left: `${faceBox.x * 100}%`,
                      top: `${faceBox.y * 100}%`,
                      width: `${faceBox.width * 100}%`,
                      height: `${faceBox.height * 100}%`,
                      boxSizing: "border-box",
                    }}
                  />
                )}

                {cameraError && (
                  <div className="absolute inset-0 bg-gray-900/90 flex items-center justify-center">
                    <div className="text-center p-4">
                      <svg className="w-12 h-12 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-red-400 text-sm font-medium">{cameraError}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Button variant="secondary" className="flex-1 h-12 text-sm font-medium rounded-xl" onClick={() => setStep('info')} disabled={loading}>
                  Quay lại
                </Button>
                <Button variant="primary" className="flex-1 h-12 text-sm font-medium rounded-xl" onClick={handleCheckIn} disabled={loading || !!cameraError}>
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      Check-in
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  )}
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Step 4: Success */}
        {step === 'success' && (
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardBody className="p-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Check-in thành công!</h2>
                <p className="text-gray-500 mb-6">Chào mừng bạn đến với hệ thống</p>
                
                <div className="bg-gradient-to-r from-[hsl(var(--primary))]/10 to-[hsl(var(--primary))]/5 rounded-xl p-6 mb-6 border-2 border-[hsl(var(--primary))]/20">
                  <p className="text-sm text-gray-600 mb-2 font-medium">Phòng của bạn</p>
                  <p className="text-3xl font-bold text-[hsl(var(--primary))]">{roomKey}</p>
                </div>

                <Button variant="primary" className="w-full h-12 text-sm font-medium rounded-xl" onClick={resetAll}>
                  Hoàn tất
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </Button>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
      highlight 
        ? 'bg-gradient-to-r from-[hsl(var(--primary))]/10 to-[hsl(var(--primary))]/5 border-[hsl(var(--primary))]/20' 
        : 'bg-gray-50 border-gray-200'
    }`}>
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span className={`font-bold text-base ${highlight ? 'text-[hsl(var(--primary))]' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}
