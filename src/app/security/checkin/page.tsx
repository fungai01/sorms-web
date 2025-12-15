"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
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
  phoneNumber?: string;
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

export default function CheckInPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QRVerificationResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // QR Scanner state
  const [scanning, setScanning] = useState(false);
  const [qrScanner, setQrScanner] = useState<Html5Qrcode | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const isProcessingRef = useRef(false); // Flag để ngăn scanner quét lại khi đang xử lý
  
  // Face verification state
  const [faceVerifying, setFaceVerifying] = useState(false);
  const [faceResult, setFaceResult] = useState<FaceVerificationResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [keyIssued, setKeyIssued] = useState(false);
  const [roomKey, setRoomKey] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false); // State để điều khiển hiển thị camera
  
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
    let isMounted = true;
    let scannerInstance: Html5Qrcode | null = null;

    const startScanning = async () => {
      if (!isMounted) return;

      const element = document.getElementById("qr-reader");
      if (!element) return;

      if (element.children.length > 0 || qrScanner) return;

      try {
        scannerInstance = new Html5Qrcode("qr-reader");
        if (!isMounted) {
          try {
            await scannerInstance.clear();
          } catch (e) {}
          return;
        }

        setQrScanner(scannerInstance);
        setScanning(true);
        
        // Tính toán kích thước qrbox dựa trên kích thước màn hình - đảm bảo hình vuông
        const getQrBoxSize = () => {
          if (typeof window === 'undefined') return { width: 600, height: 600 };
          const width = window.innerWidth;
          const height = window.innerHeight;
          // Lấy giá trị nhỏ hơn giữa 90% width và 80% height để đảm bảo hình vuông vừa màn hình
          const size = Math.min(width * 0.9, height * 0.8);
          // Đảm bảo tối thiểu 400px
          const finalSize = Math.max(400, size);
          return { width: finalSize, height: finalSize };
        };
        
        const qrBoxSize = getQrBoxSize();
        
        await scannerInstance.start(
          { 
            facingMode: "environment"
          },
          {
            fps: 10, // Tăng FPS lên để video mượt hơn
            qrbox: qrBoxSize,
            aspectRatio: 1.0,
            disableFlip: false
          },
          async (decodedText) => {
            if (!isMounted || isProcessingRef.current) return;
            
            // Đánh dấu đang xử lý để ngăn quét lại
            isProcessingRef.current = true;
            
            try {
              if (scannerInstance) {
                await scannerInstance.stop();
                await scannerInstance.clear();
              }
              setScanning(false);
              setQrScanner(null);
              scannerInstance = null;
              await handleProcessQRToken(decodedText);
            } catch (err) {
              console.error('Error stopping scanner:', err);
              setScanning(false);
              setQrScanner(null);
              scannerInstance = null;
              isProcessingRef.current = false; // Reset flag nếu có lỗi
            }
          },
          (errorMessage) => {
            // Ignore errors (just keep scanning)
          }
        );
      } catch (error: any) {
        console.error('Error starting QR scanner:', error);
        if (isMounted) {
          setFlash({ type: 'error', text: 'Không thể khởi động camera. Vui lòng kiểm tra quyền truy cập camera.' });
          setScanning(false);
          setQrScanner(null);
        }
        scannerInstance = null;
      }
    };

    const timer = setTimeout(() => {
      if (isMounted && scannerRef.current) {
        startScanning();
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerInstance) {
        (async () => {
          try {
            await scannerInstance.stop();
            await scannerInstance.clear();
          } catch (e) {}
        })();
      }
      if (qrScanner) {
        (async () => {
          try {
            await qrScanner.stop();
            await qrScanner.clear();
          } catch (e) {}
        })();
      }
    };
  }, []);

  const handleRestartScan = async () => {
    // Reset processing flag
    isProcessingRef.current = false;
    
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
    
    const element = document.getElementById("qr-reader");
    if (element) {
      element.innerHTML = '';
    }
    
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader");
        setQrScanner(scanner);
        setScanning(true);
        
        // Tính toán kích thước qrbox - đảm bảo hình vuông
        const getQrBoxSize = () => {
          if (typeof window === 'undefined') return { width: 600, height: 600 };
          const width = window.innerWidth;
          const height = window.innerHeight;
          // Lấy giá trị nhỏ hơn giữa 90% width và 80% height để đảm bảo hình vuông
          const size = Math.min(width * 0.9, height * 0.8);
          // Đảm bảo tối thiểu 400px
          const finalSize = Math.max(400, size);
          return { width: finalSize, height: finalSize };
        };
        
        const qrBoxSize = getQrBoxSize();
        
        await scanner.start(
          { 
            facingMode: "environment"
          },
          {
            fps: 10, // Tăng FPS lên để video mượt hơn
            qrbox: qrBoxSize,
            aspectRatio: 1.0,
            disableFlip: false
          },
          async (decodedText) => {
            if (isProcessingRef.current) return;
            
            // Đánh dấu đang xử lý để ngăn quét lại
            isProcessingRef.current = true;
            
            try {
              await scanner.stop();
              await scanner.clear();
              setScanning(false);
              setQrScanner(null);
              await handleProcessQRToken(decodedText);
            } catch (err) {
              console.error('Error stopping scanner:', err);
              setScanning(false);
              setQrScanner(null);
              isProcessingRef.current = false; // Reset flag nếu có lỗi
            }
          },
          (errorMessage) => {
            // Ignore errors
          }
        );
      } catch (error: any) {
        console.error('Error restarting QR scanner:', error);
        setFlash({ type: 'error', text: 'Không thể khởi động lại camera.' });
        setScanning(false);
        setQrScanner(null);
      }
    }, 300);
  };

  const handleScanFile = async (file: File) => {
    if (!file) return;

    setUploadingFile(true);
    setFlash(null);

    try {
      const tempElementId = 'temp-qr-scanner-' + Date.now();
      const tempDiv = document.createElement('div');
      tempDiv.id = tempElementId;
      tempDiv.style.display = 'none';
      document.body.appendChild(tempDiv);

      try {
        const html5QrCode = new Html5Qrcode(tempElementId);
        const decodedText = await html5QrCode.scanFile(file, true);
        
        if (decodedText) {
          await handleProcessQRToken(decodedText);
        } else {
          setFlash({ type: 'error', text: 'Không tìm thấy mã QR trong ảnh. Vui lòng thử lại với ảnh khác.' });
        }
      } finally {
        try {
          const tempEl = document.getElementById(tempElementId);
          if (tempEl) {
            document.body.removeChild(tempEl);
          }
        } catch (e) {}
      }
    } catch (error: any) {
      console.error('Error scanning file:', error);
      const errorMessage = error.message || '';
      if (errorMessage.includes('No QR code found') || errorMessage.includes('not found') || errorMessage.includes('QR code parse error')) {
        setFlash({ type: 'error', text: 'Không tìm thấy mã QR trong ảnh. Vui lòng kiểm tra lại ảnh.' });
      } else {
        setFlash({ type: 'error', text: 'Lỗi khi đọc mã QR từ file. Vui lòng thử lại với ảnh khác.' });
      }
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setFlash({ type: 'error', text: 'Vui lòng chọn file ảnh (JPG, PNG, etc.)' });
        return;
      }
      handleScanFile(file);
    }
  };

  const handleProcessQRToken = async (token: string) => {
    const tokenToProcess = (token || '').trim();
    if (!tokenToProcess) {
      setFlash({ type: 'error', text: 'Mã QR không hợp lệ' });
      return;
    }

    setLoading(true);
    setFlash(null);

    const tryDecode = (t: string): any | null => {
      try {
        let b64 = t.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4 !== 0) b64 += '=';
        const json = atob(b64);
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch {}
      
      try {
        const json = atob(t);
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch {}
      
      try {
        const parsed = JSON.parse(t);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch {}
      
      return null;
    };

    const payload = tryDecode(tokenToProcess);

    let bookingId: number | null = null;
    let userId: string | null = null;

    if (tokenToProcess.includes('|')) {
      const parts = tokenToProcess.split('|');
      if (parts.length >= 2) {
        const idPart = parts[0].trim();
        const userPart = parts[1].trim();
        if (/^\d+$/.test(idPart)) {
          bookingId = Number(idPart);
          userId = userPart || null;
        }
      }
    } else if (payload && typeof payload === 'object') {
      bookingId = Number(payload.bookingId || payload.id || payload.booking_id);
      userId = payload.userId ? String(payload.userId) : (payload.user_id ? String(payload.user_id) : null);
    } else if (/^\d+$/.test(tokenToProcess)) {
      bookingId = Number(tokenToProcess);
    }

    if (!bookingId || Number.isNaN(bookingId)) {
      setLoading(false);
      setFlash({ type: 'error', text: 'Không thể đọc được bookingId từ mã QR. Vui lòng kiểm tra lại mã QR.' });
      setResult({ valid: false, error: 'QR token không hợp lệ hoặc không chứa bookingId' });
      setModalOpen(true);
      return;
    }

    // Fetch booking info
    let bookingCode: string | undefined;
    let userName: string | undefined;
    let userEmail: string | undefined;
    let phoneNumber: string | undefined;
    let roomCode: string | undefined;
    let checkinDate: string | undefined;
    let checkoutDate: string | undefined;
    let numGuests: number | undefined;
    let bookingUserId: string | undefined;

    try {
      const infoRes = await fetch(`/api/system/bookings?id=${bookingId}`, { credentials: 'include' });
      if (infoRes.ok) {
        const b = await infoRes.json();
        
        bookingCode = b.code || b.bookingCode || b.booking_code || undefined;
        userName = b.userName || b.userName || b.user?.fullName || b.user?.full_name || b.user?.name || b.fullName || b.full_name || b.name || undefined;
        userEmail = b.userEmail || b.user_email || b.user?.email || b.email || undefined;
        roomCode = b.roomCode || b.room_code || b.room?.code || b.roomCode || undefined;
        checkinDate = b.checkinDate || b.checkin_date || b.checkIn || b.check_in || undefined;
        checkoutDate = b.checkoutDate || b.checkout_date || b.checkOut || b.check_out || undefined;
        numGuests = b.numGuests || b.num_guests || b.guests || b.numberOfGuests || undefined;
        bookingUserId = b.userId ? String(b.userId) : (b.user_id ? String(b.user_id) : (b.user?.id ? String(b.user.id) : undefined));
        
        if ((!userName || !userEmail || !phoneNumber) && bookingUserId) {
          try {
            const userRes = await fetch(`/api/system/users?id=${bookingUserId}`, { credentials: 'include' });
            if (userRes.ok) {
              const userData = await userRes.json();
              const user = Array.isArray(userData) ? userData.find((u: any) => String(u.id) === String(bookingUserId)) : userData;
              if (user) {
                if (!userName) {
                  userName = user.fullName || user.full_name || user.name || user.userName || undefined;
                }
                if (!userEmail) {
                  userEmail = user.email || undefined;
                }
                if (!phoneNumber) {
                  phoneNumber = user.phoneNumber || user.phone_number || user.phone || undefined;
                }
              }
            }
          } catch (userErr) {
            console.error('Error fetching user info:', userErr);
          }
        }
        
        // Try to get phoneNumber from booking if not found in user
        if (!phoneNumber) {
          phoneNumber = b.phoneNumber || b.phone_number || b.phone || b.user?.phoneNumber || b.user?.phone_number || b.user?.phone || undefined;
        }
        
        if (!roomCode && b.roomId) {
          try {
            const roomRes = await fetch(`/api/system/rooms?id=${b.roomId}`, { credentials: 'include' });
            if (roomRes.ok) {
              const roomData = await roomRes.json();
              const room = Array.isArray(roomData) ? roomData.find((r: any) => String(r.id) === String(b.roomId)) : roomData;
              if (room) {
                roomCode = room.code || room.roomCode || room.room_code || undefined;
              }
            }
          } catch (roomErr) {
            console.error('Error fetching room info:', roomErr);
          }
        }
      } else {
        const errorData = await infoRes.json().catch(() => ({}));
        console.error('Booking API error:', errorData);
        setLoading(false);
        setFlash({ type: 'error', text: 'Không tìm thấy thông tin đặt phòng. Vui lòng kiểm tra lại mã QR.' });
        setResult({ valid: false, error: 'Không tìm thấy booking với ID: ' + bookingId });
        setModalOpen(true);
        return;
      }
    } catch (e) {
      console.error('Error fetching booking info:', e);
      setLoading(false);
      setFlash({ type: 'error', text: 'Lỗi khi tải thông tin đặt phòng. Vui lòng thử lại.' });
      setResult({ valid: false, error: 'Lỗi kết nối đến server' });
      setModalOpen(true);
      return;
    }

    const finalUserId = userId || bookingUserId;

    if (!finalUserId) {
      setLoading(false);
      setFlash({ type: 'error', text: 'Không tìm thấy thông tin user. Vui lòng kiểm tra lại mã QR.' });
      setResult({ valid: false, error: 'Thiếu thông tin userId' });
      setModalOpen(true);
      return;
    }

    // Dừng QR scanner khi đã quét thành công
    if (qrScanner && scanning) {
      try {
        await qrScanner.stop();
        await qrScanner.clear();
      } catch (e) {
        console.error('Error stopping scanner after success:', e);
      }
      setScanning(false);
      setQrScanner(null);
    }

    setResult({
      valid: true,
      bookingId,
      userId: finalUserId,
      bookingCode,
      userName,
      userEmail,
      phoneNumber,
      roomCode,
      checkinDate,
      checkoutDate,
      numGuests,
    } as any);
    setLoading(false);
    setFlash({ type: 'success', text: 'Đã đọc mã QR thành công. Vui lòng kiểm tra thông tin và tiến hành check-in.' });
    setShowCamera(false); // Reset camera state
    setModalOpen(true);
    
    // Reset processing flag sau khi hiển thị modal
    setTimeout(() => {
      isProcessingRef.current = false;
    }, 1000);
  };

  const handleCheckIn = async () => {
    if (!result?.bookingId || !result?.userId || !webcamRef.current) return;

    try {
      setLoading(true);
      setFlash(null);

      if (result.checkinDate && result.checkoutDate) {
        const now = new Date();
        const checkinDate = new Date(result.checkinDate);
        const checkoutDate = new Date(result.checkoutDate);
        
        if (now < checkinDate) {
          setFlash({ 
            type: 'error', 
            text: `Thời gian check-in chưa đến. Ngày check-in bắt đầu từ: ${checkinDate.toLocaleString('vi-VN')}` 
          });
          setLoading(false);
          return;
        }
        
        if (now > checkoutDate) {
          setFlash({ 
            type: 'error', 
            text: `Thời gian check-in đã quá hạn. Ngày check-out là: ${checkoutDate.toLocaleString('vi-VN')}` 
          });
          setLoading(false);
          return;
        }
      }

      // Lấy kích thước container camera để chụp đúng kích thước
      const cameraContainer = document.querySelector('.webcam-container');
      const containerWidth = cameraContainer?.clientWidth || 640;
      const containerHeight = cameraContainer?.clientHeight || 480;
      
      // Chụp ảnh với kích thước khớp với container
      const screenshot = webcamRef.current.getScreenshot({
        width: containerWidth,
        height: containerHeight,
        screenshotQuality: 0.9,
        screenshotFormat: 'image/jpeg'
      });
      
      if (!screenshot) {
        setFlash({ type: 'error', text: 'Không thể chụp ảnh từ camera' });
        setLoading(false);
        return;
      }

      const imgRes = await fetch(screenshot);
      const blob = await imgRes.blob();
      const file = new File([blob], `checkin-face-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });

      if (!result.bookingId || !result.userId) {
        setFlash({ type: 'error', text: 'Thiếu thông tin booking hoặc user. Vui lòng quét lại mã QR.' });
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('bookingId', String(result.bookingId));
      formData.append('userId', String(result.userId));
      formData.append('faceImage', file);
      formData.append('faceRef', 'true');

      // Use Next.js API route as proxy
      const res = await fetch(`/api/bookings/${result.bookingId}/checkin`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      let data: any = {}
      try {
        const text = await res.text()
        if (text) {
          data = JSON.parse(text)
        }
      } catch (parseError) {
        console.error('[Check-in] Failed to parse response:', parseError)
        if (!res.ok) {
          setFlash({ type: 'error', text: `Lỗi từ server: ${res.status} ${res.statusText}` })
          setLoading(false)
          return
        }
      }
      
      if (!res.ok) {
        const responseCode = data?.responseCode || data?.error
        let errorMessage = data?.message || data?.error || `Lỗi ${res.status}: Không thể thực hiện check-in`
        
        setFlash({ type: 'error', text: errorMessage })
        setLoading(false)
        return
      }

      if (data.responseCode && data.responseCode !== 'S0000') {
        let errorMessage = data?.message || data?.error || 'Không thể thực hiện check-in'
        
        if (data.responseCode === 'S0004' || data.responseCode === 'INVALID_REQUEST') {
          errorMessage = 'Thời gian check-in không hợp lệ.\n' +
            'Vui lòng kiểm tra:\n' +
            '• Thời gian hiện tại phải trong khoảng từ ngày check-in đến ngày check-out\n' +
            '• Booking phải ở trạng thái APPROVED'
        }
        
        setFlash({ type: 'error', text: errorMessage })
        setLoading(false)
        return
      }

      const checkInData = data?.data || data;
      const successMessage = data?.message || 'Check-in thành công và đã cấp chìa khóa!';
      
      setFlash({ type: 'success', text: successMessage });
      
      const finalRoomKey = checkInData?.roomCode || result.roomCode || `KEY-${result.bookingId}-${Date.now()}`;
      setRoomKey(finalRoomKey);
      setKeyIssued(true);
    } catch (error: any) {
      setFlash({ type: 'error', text: error?.message || 'Lỗi khi thực hiện check-in' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Check-in</h1>
              <p className="text-sm text-gray-600 mt-1">Quét mã QR để xác thực và check-in</p>
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

          {/* QR Scanner Card */}
          <Card className="border-0 shadow-none">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-4">
              <h2 className="text-lg font-semibold">Quét mã QR</h2>
            </CardHeader>
            <CardBody className="space-y-4 p-4">
              <div className="relative flex justify-center items-center">
                <div 
                  id="qr-reader" 
                  ref={scannerRef}
                  className="rounded-lg overflow-hidden border-2 border-blue-500 qr-scanner-container"
                  style={{ 
                    aspectRatio: '1 / 1',
                    width: 'min(85vw, 70vh, 600px)',
                    maxWidth: '100%',
                    maxHeight: '70vh',
                    position: 'relative'
                  }}
                />
                {scanning && (
                  <div className="absolute top-2 left-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 z-10">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    Đang quét mã QR...
                  </div>
                )}
                {!scanning && !qrScanner && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-90 z-10">
                    <div className="text-center">
                      <p className="text-gray-600 mb-2">Camera chưa sẵn sàng</p>
                      <Button
                        onClick={handleRestartScan}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Khởi động camera
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600 text-center">
                Đưa mã QR vào khung hình. Mã sẽ được tự động quét và xác thực.
              </p>
              
              {/* Upload file QR code */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Hoặc tải ảnh mã QR từ máy tính
                </label>
                <div className="flex gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="qr-file-input"
                    disabled={uploadingFile}
                  />
                  <label
                    htmlFor="qr-file-input"
                    className="flex-1 cursor-pointer"
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      disabled={uploadingFile}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingFile ? 'Đang đọc...' : '📁 Chọn ảnh QR từ máy tính'}
                    </Button>
                  </label>
                </div>
              </div>

              {scanning && (
                <Button
                  onClick={handleRestartScan}
                  variant="secondary"
                  className="w-full"
                >
                  🔄 Khởi động lại quét
                </Button>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Verification Result Modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          if (keyIssued) {
            return;
          }
          setModalOpen(false);
          setShowCamera(false);
          if (result?.valid) {
            setResult(null);
          }
          // Không tự động restart scanner - để người dùng tự quyết định
        }}
        title={result?.valid ? "✅ Xác thực QR thành công" : "❌ Xác thực QR thất bại"}
      >
        {result?.valid ? (
          <div className="space-y-4">
            {/* Thông tin đặt phòng - chỉ hiển thị khi chưa mở camera */}
            {!showCamera && !keyIssued && (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-green-800">
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
                    <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Số điện thoại</p>
                    <p className="text-sm font-medium text-gray-900">{result.phoneNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Phòng</p>
                    <p className="text-sm font-medium text-gray-900">{result.roomCode || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Số khách</p>
                    <p className="text-sm font-medium text-gray-900">{result.numGuests || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Ngày check-in</p>
                    <p className="text-sm font-medium text-gray-900">
                      {result.checkinDate ? new Date(result.checkinDate).toLocaleString('vi-VN') : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Ngày check-out</p>
                    <p className="text-sm font-medium text-gray-900">
                      {result.checkoutDate ? new Date(result.checkoutDate).toLocaleString('vi-VN') : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Nút để bắt đầu xác thực check-in */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={() => setShowCamera(true)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    🔐 Tiến hành xác thực check-in
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setModalOpen(false);
                      setResult(null);
                      setShowCamera(false);
                      // Không tự động restart scanner
                    }}
                  >
                    Đóng
                  </Button>
                </div>
              </>
            )}

            {/* Camera for face verification - hiển thị khi showCamera = true */}
            {showCamera && !keyIssued && (
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    Vui lòng đưa khuôn mặt vào khung hình và nhấn nút để chụp ảnh và check-in.
                  </p>
                </div>
                
                <div className="relative rounded overflow-hidden border border-gray-200 h-[300px] bg-gray-900 webcam-container" style={{ width: '100%' }}>
                  <WebcamComponent
                    ref={webcamRef as any}
                    audio={false}
                    className="w-full h-full object-cover webcam-video"
                    screenshotFormat="image/jpeg"
                    screenshotQuality={0.9}
                    videoConstraints={{ 
                      facingMode: "user",
                      width: { ideal: 640 },
                      height: { ideal: 480 },
                      frameRate: { ideal: 15, max: 30 } // Tăng FPS lên để video mượt hơn
                    }}
                    width={640}
                    height={480}
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
                    onClick={handleCheckIn}
                    disabled={loading || !!cameraError}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {loading ? 'Đang xử lý...' : '📸 Chụp ảnh & Check-in'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowCamera(false)}
                    disabled={loading}
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            )}

            {keyIssued && roomKey && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-6 text-center mt-4">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-green-800 mb-4">Check-in thành công!</h3>
                <div className="bg-white rounded-lg p-4 border-2 border-green-300 mb-4">
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Mã chìa khóa phòng</p>
                  <p className="text-2xl font-bold text-green-600">{roomKey}</p>
                  <p className="text-sm text-gray-600 mt-2">Phòng: {result?.roomCode || 'N/A'}</p>
                </div>
                <Button
                  onClick={() => {
                    setModalOpen(false);
                    setResult(null);
                    setKeyIssued(false);
                    setRoomKey(null);
                    handleRestartScan();
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  Hoàn tất
                </Button>
              </div>
            )}
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
                setResult(null);
                // Không tự động restart scanner
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

