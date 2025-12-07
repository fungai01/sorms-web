"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import dynamic from "next/dynamic";
import { Html5Qrcode } from "html5-qrcode";

// Dynamic import Webcam để tránh SSR issues
const WebcamComponent = dynamic(
  // @ts-ignore - react-webcam type incompatibility with Next.js dynamic import
  () => import("react-webcam"),
  { 
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-900 flex items-center justify-center text-white">Đang tải camera...</div>
  }
) as any;

type QRVerificationResult = {
  valid: boolean;
  bookingId?: number;
  userId?: string;
  userName?: string;
  userEmail?: string;
  roomId?: number;
  roomCode?: string;
  checkinDate?: string;
  checkoutDate?: string;
  numGuests?: number;
  bookingCode?: string;
  error?: string;
};

type FaceVerificationResult = {
  success: boolean;
  match: boolean;
  confidence?: number;
  message?: string;
  error?: string;
};

type CheckInStep = 'qr' | 'face' | 'complete';

export default function SecurityDashboardPage() {
  // Set user role in sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('userRole', 'security');
    }
  }, []);

  const [qrToken, setQrToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QRVerificationResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // QR Scanner state
  const [scanMode, setScanMode] = useState<'manual' | 'scan'>('manual');
  const [scanning, setScanning] = useState(false);
  const [qrScanner, setQrScanner] = useState<Html5Qrcode | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  
  // Face verification state
  const [currentStep, setCurrentStep] = useState<CheckInStep>('qr');
  const [faceVerifying, setFaceVerifying] = useState(false);
  const [faceResult, setFaceResult] = useState<FaceVerificationResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [keyIssued, setKeyIssued] = useState(false);
  const [roomKey, setRoomKey] = useState<string | null>(null);
  
  const webcamRef = useRef<any>(null);

  // Auto-hide flash messages
  useEffect(() => {
    if (flash) {
      const timer = setTimeout(() => setFlash(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [flash]);

  // QR Scanner setup and cleanup
  useEffect(() => {
    if (scanMode === 'scan' && scannerRef.current && !qrScanner) {
      const startScanning = async () => {
        try {
          const scanner = new Html5Qrcode("qr-reader");
          setQrScanner(scanner);
          setScanning(true);
          
          await scanner.start(
            { facingMode: "environment" }, // Use back camera
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
            },
              async (decodedText) => {
              // QR code detected
              try {
                await scanner.stop();
                setScanning(false);
                setScanMode('manual');
                // Set token and verify
                setQrToken(decodedText);
                // Wait a bit for state to update, then verify
                setTimeout(() => {
                  handleProcessQRToken(decodedText);
                }, 100);
              } catch (err) {
                console.error('Error stopping scanner:', err);
                setScanning(false);
              }
            },
            (errorMessage) => {
              // Ignore errors (just keep scanning)
            }
          );
        } catch (error: any) {
          console.error('Error starting QR scanner:', error);
          setFlash({ type: 'error', text: 'Không thể khởi động camera. Vui lòng kiểm tra quyền truy cập camera.' });
          setScanMode('manual');
          setScanning(false);
        }
      };
      
      startScanning();
    }

    // Cleanup
    return () => {
      if (qrScanner && scanning) {
        (async () => {
          try {
            await qrScanner.stop();
            await qrScanner.clear();
          } catch (e) {
            // Ignore cleanup errors
          }
          setQrScanner(null);
          setScanning(false);
        })();
      }
    };
  }, [scanMode, qrScanner, scanning]);

  const handleStartScan = () => {
    setScanMode('scan');
    setQrToken("");
  };

  const handleStopScan = async () => {
    if (qrScanner) {
      try {
        if (scanning) {
          await qrScanner.stop();
        }
        await qrScanner.clear();
      } catch (e) {
        console.error('Error stopping scanner:', e);
      }
      setQrScanner(null);
    }
    setScanning(false);
    setScanMode('manual');
  };

  const handleProcessQRToken = async (token?: string) => {
    const tokenToProcess = (token || qrToken || '').trim();
    if (!tokenToProcess) {
      setFlash({ type: 'error', text: 'Vui lòng nhập mã QR token' });
      return;
    }

    // Try to decode token (base64 JSON or plain JSON), otherwise treat as bookingId
    const tryDecode = (t: string): any | null => {
      // Try base64 (URL-safe)
      try {
        let b64 = t.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4 !== 0) b64 += '=';
        const json = atob(b64);
        return JSON.parse(json);
      } catch {}
      // Try JSON directly
      try {
        return JSON.parse(t);
      } catch {}
      return null;
    };

    const payload = tryDecode(tokenToProcess);

    let bookingId: number | null = null;
    let userId: string | null = null;

    if (payload && typeof payload === 'object') {
      bookingId = Number(payload.bookingId || payload.id || payload.booking_id);
      userId = payload.userId ? String(payload.userId) : (payload.user_id ? String(payload.user_id) : null);
    } else if (/^\d+$/.test(tokenToProcess)) {
      bookingId = Number(tokenToProcess);
    }

    if (!bookingId || Number.isNaN(bookingId)) {
      setFlash({ type: 'error', text: 'Không thể đọc được bookingId từ mã QR' });
      setResult({ valid: false, error: 'QR token không hợp lệ' });
      setModalOpen(true);
      return;
    }

    // Fetch booking info to display correct details
    let bookingCode: string | undefined;
    let userName: string | undefined;
    let userEmail: string | undefined;
    let roomCode: string | undefined;
    let checkinDate: string | undefined;
    let checkoutDate: string | undefined;
    let numGuests: number | undefined;

    try {
      const infoRes = await fetch(`/api/system/bookings?id=${bookingId}`, { credentials: 'include' });
      if (infoRes.ok) {
        const b = await infoRes.json();
        // Map common fields with fallbacks
        bookingCode = b.code || b.bookingCode || undefined;
        userName = b.userName || b.user?.fullName || b.fullName || undefined;
        userEmail = b.userEmail || b.user?.email || b.email || undefined;
        roomCode = b.roomCode || b.room?.code || undefined;
        checkinDate = b.checkinDate || b.checkIn || undefined;
        checkoutDate = b.checkoutDate || b.checkOut || undefined;
        numGuests = b.numGuests || b.guests || undefined;
      }
    } catch (e) {
      // ignore fetch errors, will show minimal info
    }

    setResult({
      valid: true,
      bookingId,
      userId: userId || undefined,
      bookingCode,
      userName,
      userEmail,
      roomCode,
      checkinDate,
      checkoutDate,
      numGuests,
    } as any);
    setFlash({ type: 'success', text: 'Đã đọc mã QR. Vui lòng tiến hành xác thực khuôn mặt.' });
    setCurrentStep('face');
    setModalOpen(true);
  };

  const handleVerifyQR = () => {
    handleProcessQRToken();
  };

  const handleVerifyFace = async () => {
    if (!result?.userId || !webcamRef.current) {
      setFlash({ type: 'error', text: 'Không thể truy cập camera hoặc thiếu thông tin user' });
      return;
    }

    try {
      const screenshot = webcamRef.current.getScreenshot();
      if (!screenshot) {
        setFlash({ type: 'error', text: 'Không thể chụp ảnh từ camera' });
        return;
      }

      setFaceVerifying(true);
      setFaceResult(null);

      // Convert base64 to Blob
      const res = await fetch(screenshot);
      const blob = await res.blob();
      const file = new File([blob], `face-verify-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });

      // Create FormData
      const formData = new FormData();
      formData.append('image', file);
      formData.append('userId', String(result.userId));

      // Call face verification API
      const verifyRes = await fetch('/api/security/face/verify', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.match) {
        setFaceResult({
          success: false,
          match: false,
          error: verifyData.error || verifyData.message || 'Khuôn mặt không khớp',
        });
        setFlash({ type: 'error', text: verifyData.error || verifyData.message || 'Khuôn mặt không khớp' });
        return;
      }

      setFaceResult({
        success: true,
        match: true,
        confidence: verifyData.confidence,
        message: verifyData.message || 'Khuôn mặt khớp',
      });
      setFlash({ type: 'success', text: 'Xác thực khuôn mặt thành công!' });
      
      // Generate room key (có thể là mã phòng hoặc mã chìa khóa)
      const key = result.roomCode || `KEY-${result.bookingId}-${Date.now()}`;
      setRoomKey(key);
      setKeyIssued(true);
      setCurrentStep('complete');
    } catch (error: any) {
      setFaceResult({
        success: false,
        match: false,
        error: error.message || 'Lỗi khi xác thực khuôn mặt',
      });
      setFlash({ type: 'error', text: error.message || 'Lỗi khi xác thực khuôn mặt' });
    } finally {
      setFaceVerifying(false);
    }
  };

  const handleCheckIn = async () => {
    if (!result?.bookingId || !result?.userId || !webcamRef.current) return;

    try {
      setLoading(true);
      setFlash(null);

      const screenshot = webcamRef.current.getScreenshot();
      if (!screenshot) {
        setFlash({ type: 'error', text: 'Không thể chụp ảnh từ camera' });
        return;
      }

      const imgRes = await fetch(screenshot);
      const blob = await imgRes.blob();
      const file = new File([blob], `checkin-face-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });

      const formData = new FormData();
      formData.append('bookingId', String(result.bookingId));
      formData.append('userId', String(result.userId));
      formData.append('faceImage', file);
      formData.append('faceRef', 'true');

      const res = await fetch(`/api/security/bookings/${result.bookingId}/checkin`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFlash({ type: 'error', text: data?.error || 'Không thể thực hiện check-in' });
        return;
      }

      setFlash({ type: 'success', text: 'Check-in thành công và đã cấp chìa khóa!' });
      setRoomKey(result.roomCode || `KEY-${result.bookingId}-${Date.now()}`);
      setKeyIssued(true);
      setCurrentStep('complete');
    } catch (error: any) {
      setFlash({ type: 'error', text: error?.message || 'Lỗi khi thực hiện check-in' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Bảo vệ - Xác thực mã QR</h1>
              <p className="text-sm lg:text-base text-gray-600 mt-1">Quét hoặc nhập mã QR để xác thực đặt phòng và check-in</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Flash Messages */}
          {flash && (
            <div className={`rounded-md border p-3 text-sm shadow-sm ${
              flash.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {flash.text}
            </div>
          )}

          {/* QR Input Card */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <h2 className="text-xl font-semibold">Xác thực mã QR</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Mode Toggle */}
              <div className="flex gap-2">
                <Button
                  variant={scanMode === 'manual' ? undefined : 'secondary'}
                  onClick={() => {
                    handleStopScan();
                    setScanMode('manual');
                  }}
                  className={scanMode === 'manual' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                >
                  📝 Nhập thủ công
                </Button>
                <Button
                  variant={scanMode === 'scan' ? undefined : 'secondary'}
                  onClick={handleStartScan}
                  disabled={scanning}
                  className={scanMode === 'scan' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                >
                  📷 Quét QR Code
                </Button>
              </div>

              {scanMode === 'manual' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mã QR Token
                  </label>
                  <Input
                    type="text"
                    placeholder="Dán mã QR token hoặc quét mã QR..."
                    value={qrToken}
                    onChange={(e) => setQrToken(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleVerifyQR();
                      }
                    }}
                    className="text-base"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Nhập token thủ công hoặc nhấn "Quét QR Code" để sử dụng camera
                  </p>
                  <Button
                    onClick={handleVerifyQR}
                    disabled={loading || !qrToken.trim()}
                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loading ? 'Đang xác thực...' : 'Xác thực mã QR'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <div 
                      id="qr-reader" 
                      ref={scannerRef}
                      className="w-full rounded-lg overflow-hidden border-2 border-blue-500"
                      style={{ minHeight: '300px' }}
                    />
                    {scanning && (
                      <div className="absolute top-2 left-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        Đang quét...
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Đưa mã QR vào khung hình. Mã sẽ được tự động quét và xác thực.
                  </p>
                  <Button
                    onClick={handleStopScan}
                    variant="secondary"
                    className="w-full"
                  >
                    Dừng quét
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Instructions */}
          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">📋 Hướng dẫn sử dụng</h3>
              <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
                <li>Yêu cầu khách hàng mở mã QR trên điện thoại</li>
                <li>Quét mã QR bằng máy quét hoặc nhập token thủ công</li>
                <li>Nhấn "Xác thực mã QR" để kiểm tra thông tin</li>
                <li>Xác nhận thông tin đặt phòng và thực hiện check-in</li>
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Verification Result Modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          if (currentStep === 'complete' && keyIssued) {
            // Don't allow closing if key is already issued
            return;
          }
          setModalOpen(false);
          if (result?.valid && currentStep === 'qr') {
            setQrToken("");
            setResult(null);
          }
        }}
        title={
          currentStep === 'qr' 
            ? (result?.valid ? "✅ Xác thực QR thành công" : "❌ Xác thực QR thất bại")
            : currentStep === 'face'
            ? "🔐 Xác thực khuôn mặt"
            : "✅ Check-in hoàn tất"
        }
      >
        {currentStep === 'qr' && result?.valid ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-800 mb-2">
                Mã QR hợp lệ - Thông tin đặt phòng:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Mã đặt phòng</p>
                <p className="text-sm font-medium text-gray-900">{result.bookingCode || `#${result.bookingId}`}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Tên khách hàng</p>
                <p className="text-sm font-medium text-gray-900">{result.userName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Email</p>
                <p className="text-sm font-medium text-gray-900">{result.userEmail || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Phòng</p>
                <p className="text-sm font-medium text-gray-900">{result.roomCode || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Check-in</p>
                <p className="text-sm font-medium text-gray-900">
                  {result.checkinDate ? new Date(result.checkinDate).toLocaleString('vi-VN') : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Check-out</p>
                <p className="text-sm font-medium text-gray-900">
                  {result.checkoutDate ? new Date(result.checkoutDate).toLocaleString('vi-VN') : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Số khách</p>
                <p className="text-sm font-medium text-gray-900">{result.numGuests || 'N/A'}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={() => setCurrentStep('face')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Tiếp tục xác thực khuôn mặt →
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setModalOpen(false);
                  setQrToken("");
                  setResult(null);
                  setCurrentStep('qr');
                }}
                className="flex-1"
              >
                Đóng
              </Button>
            </div>
          </div>
        ) : currentStep === 'face' ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-800 mb-2">
                Thông tin đặt phòng đã xác thực:
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Khách hàng:</span>
                  <span className="font-medium ml-2">{result?.userName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Phòng:</span>
                  <span className="font-medium ml-2">{result?.roomCode || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Mã đặt phòng:</span>
                  <span className="font-medium ml-2">{result?.bookingCode || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Camera for face verification */}
            <div className="space-y-4">
              <div className="relative rounded overflow-hidden border border-gray-200 h-[300px] bg-gray-900">
                <WebcamComponent
                  ref={webcamRef as any}
                  audio={false}
                  className="w-full h-full object-cover"
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
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="rounded-full border-2 border-blue-500" style={{ width: "200px", height: "200px" }} />
                </div>
              </div>

              {cameraError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{cameraError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={handleCheckIn}
                  disabled={loading || !!cameraError}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {loading ? 'Đang xử lý...' : '📸 Chụp ảnh & Check-in'}
                </Button>
              </div>
            </div>
          </div>
        ) : currentStep === 'complete' && keyIssued ? (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-green-800 mb-2">Check-in thành công!</h3>
              <p className="text-sm text-gray-700 mb-4">Đã cấp chìa khóa cho khách hàng</p>
              
              {roomKey && (
                <div className="bg-white rounded-lg p-4 border-2 border-green-300">
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Mã chìa khóa phòng</p>
                  <p className="text-2xl font-bold text-green-600">{roomKey}</p>
                  <p className="text-xs text-gray-600 mt-2">Phòng: {result?.roomCode || 'N/A'}</p>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-800 mb-2">Thông tin khách hàng:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Tên:</span>
                  <span className="font-medium ml-2">{result?.userName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium ml-2">{result?.userEmail || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Mã đặt phòng:</span>
                  <span className="font-medium ml-2">{result?.bookingCode || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Check-in:</span>
                  <span className="font-medium ml-2">
                    {result?.checkinDate ? new Date(result.checkinDate).toLocaleString('vi-VN') : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <Button
              onClick={() => {
                setModalOpen(false);
                setQrToken("");
                setResult(null);
                setFaceResult(null);
                setKeyIssued(false);
                setRoomKey(null);
                setCurrentStep('qr');
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              Hoàn tất
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-800 mb-2">
                Mã QR không hợp lệ hoặc đã hết hạn
              </p>
              <p className="text-sm text-red-700">
                {result?.error || 'Vui lòng kiểm tra lại mã QR và thử lại.'}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setModalOpen(false);
                setQrToken("");
                setResult(null);
              }}
              className="w-full"
            >
              Đóng
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}




