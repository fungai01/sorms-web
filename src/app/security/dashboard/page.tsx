"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import dynamic from "next/dynamic";
import { Html5Qrcode } from "html5-qrcode";
import { cookieManager } from "@/lib/http";
import { API_CONFIG } from "@/lib/config";

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

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QRVerificationResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // QR Scanner state - chỉ dùng quét QR, không có nhập thủ công
  const [scanning, setScanning] = useState(false);
  const [qrScanner, setQrScanner] = useState<Html5Qrcode | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  
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

  // QR Scanner setup and cleanup - tự động bật khi component mount
  useEffect(() => {
    let isMounted = true;
    let scannerInstance: Html5Qrcode | null = null;

    const startScanning = async () => {
      if (!isMounted) return;

      // Kiểm tra xem element có tồn tại và chưa có scanner không
      const element = document.getElementById("qr-reader");
      if (!element) {
        return;
      }

      // Kiểm tra xem đã có scanner instance chưa
      if (element.children.length > 0 || qrScanner) {
        return;
      }

      try {
        scannerInstance = new Html5Qrcode("qr-reader");
        if (!isMounted) {
          // Component đã unmount, cleanup ngay
          try {
            await scannerInstance.clear();
          } catch (e) {}
          return;
        }

        setQrScanner(scannerInstance);
        setScanning(true);
        
        await scannerInstance.start(
          { facingMode: "environment" }, // Use back camera
          {
            fps: 10,
            qrbox: { width: 500, height: 500 },
            aspectRatio: 1.0,
          },
          async (decodedText) => {
            // QR code detected
            if (!isMounted) return;
            
            try {
              if (scannerInstance) {
                await scannerInstance.stop();
                await scannerInstance.clear();
              }
              setScanning(false);
              setQrScanner(null);
              scannerInstance = null;
              // Xử lý token ngay lập tức
              handleProcessQRToken(decodedText);
            } catch (err) {
              console.error('Error stopping scanner:', err);
              setScanning(false);
              setQrScanner(null);
              scannerInstance = null;
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

    // Delay một chút để đảm bảo DOM đã render
    const timer = setTimeout(() => {
      if (isMounted && scannerRef.current) {
        startScanning();
      }
    }, 300);

    // Cleanup khi unmount
    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerInstance) {
        (async () => {
          try {
            await scannerInstance.stop();
            await scannerInstance.clear();
          } catch (e) {
            // Ignore cleanup errors
          }
        })();
      }
      if (qrScanner) {
        (async () => {
          try {
            await qrScanner.stop();
            await qrScanner.clear();
          } catch (e) {
            // Ignore cleanup errors
          }
        })();
      }
    };
  }, []); // Chỉ chạy 1 lần khi mount

  const handleRestartScan = async () => {
    // Dừng scanner hiện tại
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
    
    // Xóa element để đảm bảo không còn instance cũ
    const element = document.getElementById("qr-reader");
    if (element) {
      element.innerHTML = '';
    }
    
    // Khởi động lại scanner sau một chút
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader");
        setQrScanner(scanner);
        setScanning(true);
        
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 500, height: 500 },
            aspectRatio: 1.0,
          },
          async (decodedText) => {
            try {
              await scanner.stop();
              await scanner.clear();
              setScanning(false);
              setQrScanner(null);
              handleProcessQRToken(decodedText);
            } catch (err) {
              console.error('Error stopping scanner:', err);
              setScanning(false);
              setQrScanner(null);
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
      // Tạo một element tạm thời để scan file (không hiển thị)
      const tempElementId = 'temp-qr-scanner-' + Date.now();
      const tempDiv = document.createElement('div');
      tempDiv.id = tempElementId;
      tempDiv.style.display = 'none';
      document.body.appendChild(tempDiv);

      try {
        // Tạo instance Html5Qrcode với element tạm thời
        const html5QrCode = new Html5Qrcode(tempElementId);
        
        // Scan file ảnh trực tiếp
        const decodedText = await html5QrCode.scanFile(file, true);
        
        if (decodedText) {
          // Xử lý token từ file
          await handleProcessQRToken(decodedText);
        } else {
          setFlash({ type: 'error', text: 'Không tìm thấy mã QR trong ảnh. Vui lòng thử lại với ảnh khác.' });
        }
      } finally {
        // Cleanup: xóa element tạm thời
        try {
          const tempEl = document.getElementById(tempElementId);
          if (tempEl) {
            document.body.removeChild(tempEl);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
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
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Kiểm tra loại file
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

    // Try to decode token (base64 JSON or plain JSON), otherwise treat as bookingId
    const tryDecode = (t: string): any | null => {
      // Try base64 (URL-safe and standard)
      try {
        let b64 = t.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4 !== 0) b64 += '=';
        const json = atob(b64);
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch {}
      
      // Try base64 without padding fix
      try {
        const json = atob(t);
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch {}
      
      // Try JSON directly
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

    // Kiểm tra format: bookingId|userId (ví dụ: 24|98ae5023-e953-4010-9975-d4aa97588992)
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
      // Format JSON (base64 hoặc plain)
      bookingId = Number(payload.bookingId || payload.id || payload.booking_id);
      userId = payload.userId ? String(payload.userId) : (payload.user_id ? String(payload.user_id) : null);
    } else if (/^\d+$/.test(tokenToProcess)) {
      // Nếu chỉ là số, coi như bookingId
      bookingId = Number(tokenToProcess);
    }

    if (!bookingId || Number.isNaN(bookingId)) {
      setLoading(false);
      setFlash({ type: 'error', text: 'Không thể đọc được bookingId từ mã QR. Vui lòng kiểm tra lại mã QR.' });
      setResult({ valid: false, error: 'QR token không hợp lệ hoặc không chứa bookingId' });
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
    let bookingUserId: string | undefined;

    try {
      const infoRes = await fetch(`/api/system/bookings?id=${bookingId}`, { credentials: 'include' });
      if (infoRes.ok) {
        const b = await infoRes.json();
        console.log('Booking data from API:', b); // Debug log
        
        // Map common fields with fallbacks - kiểm tra nhiều field name khác nhau
        bookingCode = b.code || b.bookingCode || b.booking_code || undefined;
        userName = b.userName || b.userName || b.user?.fullName || b.user?.full_name || b.user?.name || b.fullName || b.full_name || b.name || undefined;
        userEmail = b.userEmail || b.user_email || b.user?.email || b.email || undefined;
        roomCode = b.roomCode || b.room_code || b.room?.code || b.roomCode || undefined;
        checkinDate = b.checkinDate || b.checkin_date || b.checkIn || b.check_in || undefined;
        checkoutDate = b.checkoutDate || b.checkout_date || b.checkOut || b.check_out || undefined;
        numGuests = b.numGuests || b.num_guests || b.guests || b.numberOfGuests || undefined;
        bookingUserId = b.userId ? String(b.userId) : (b.user_id ? String(b.user_id) : (b.user?.id ? String(b.user.id) : undefined));
        
        // Nếu không có userName/userEmail, thử fetch từ user API
        if ((!userName || !userEmail) && bookingUserId) {
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
              }
            }
          } catch (userErr) {
            console.error('Error fetching user info:', userErr);
          }
        }
        
        // Nếu không có roomCode, thử fetch từ room API
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

    // Sử dụng userId từ token nếu có, nếu không thì dùng từ booking
    const finalUserId = userId || bookingUserId;

    if (!finalUserId) {
      setLoading(false);
      setFlash({ type: 'error', text: 'Không tìm thấy thông tin user. Vui lòng kiểm tra lại mã QR.' });
      setResult({ valid: false, error: 'Thiếu thông tin userId' });
      setModalOpen(true);
      return;
    }

    setResult({
      valid: true,
      bookingId,
      userId: finalUserId,
      bookingCode,
      userName,
      userEmail,
      roomCode,
      checkinDate,
      checkoutDate,
      numGuests,
    } as any);
    setLoading(false);
    setFlash({ type: 'success', text: 'Đã đọc mã QR thành công. Vui lòng tiến hành xác thực khuôn mặt.' });
    setCurrentStep('face');
    setModalOpen(true);
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

      // Validate thời gian check-in trước khi gọi API
      if (result.checkinDate && result.checkoutDate) {
        const now = new Date();
        const checkinDate = new Date(result.checkinDate);
        const checkoutDate = new Date(result.checkoutDate);
        
        // Kiểm tra thời gian hiện tại có trong khoảng check-in đến check-out không
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

      const screenshot = webcamRef.current.getScreenshot();
      if (!screenshot) {
        setFlash({ type: 'error', text: 'Không thể chụp ảnh từ camera' });
        setLoading(false);
        return;
      }

      const imgRes = await fetch(screenshot);
      const blob = await imgRes.blob();
      const file = new File([blob], `checkin-face-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });

      // Validate required fields
      if (!result.bookingId || !result.userId) {
        setFlash({ type: 'error', text: 'Thiếu thông tin booking hoặc user. Vui lòng quét lại mã QR.' });
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('bookingId', String(result.bookingId));
      formData.append('userId', String(result.userId));
      formData.append('faceImage', file);
      formData.append('faceRef', 'true'); // Backend expects boolean, Spring will convert string "true" to boolean

      // Get token from cookie using cookieManager
      let token: string | null = null
      try {
        token = cookieManager.getAccessToken()
        if (!token) {
          const userInfo = cookieManager.getUserInfo<any>()
          if (userInfo?.token) {
            token = userInfo.token
          }
        }
      } catch (error) {
        console.warn('[Check-in] Error getting token from cookie:', error)
      }

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      } else {
        console.warn('[Check-in] No token found, request may fail at backend')
      }

      // Build backend URL directly
      const backendUrl = `${API_CONFIG.BASE_URL}/bookings/${result.bookingId}/checkin`
      
      console.log('[Check-in] Sending request to backend:', {
        url: backendUrl,
        bookingId: result.bookingId,
        userId: result.userId,
        hasToken: !!token,
        fileSize: file.size,
        fileName: file.name
      })

      const res = await fetch(backendUrl, {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include', // Include cookies for CORS
      });

      // Parse response
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
      
      console.log('[Check-in] Response:', { status: res.status, data })
      
      // Handle error responses
      if (!res.ok) {
        const responseCode = data?.responseCode || data?.error
        let errorMessage = data?.message || data?.error || `Lỗi ${res.status}: Không thể thực hiện check-in`
        
        setFlash({ type: 'error', text: errorMessage })
        setLoading(false)
        return
      }

      // Check responseCode in success response (backend format: { responseCode: 'S0000', data: {...} })
      if (data.responseCode && data.responseCode !== 'S0000') {
        let errorMessage = data?.message || data?.error || 'Không thể thực hiện check-in'
        
        // Handle non-success response codes
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

      // Extract check-in data from response
      const checkInData = data?.data || data;
      const successMessage = data?.message || 'Check-in thành công và đã cấp chìa khóa!';
      
      setFlash({ type: 'success', text: successMessage });
      
      // Use room code from check-in response if available, otherwise use existing roomCode
      const finalRoomKey = checkInData?.roomCode || result.roomCode || `KEY-${result.bookingId}-${Date.now()}`;
      setRoomKey(finalRoomKey);
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
              <p className="text-sm lg:text-base text-gray-600 mt-1">Quét mã QR để xác thực đặt phòng và check-in</p>
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

          {/* QR Scanner Card */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <h2 className="text-xl font-semibold">Quét mã QR</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="relative">
                <div 
                  id="qr-reader" 
                  ref={scannerRef}
                  className="w-full rounded-lg overflow-hidden border-2 border-blue-500"
                  style={{ minHeight: '700px', height: '80vh' }}
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
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hoặc tải ảnh mã QR từ máy tính
                </label>
                <div className="flex gap-2">
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
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Hỗ trợ các định dạng: JPG, PNG, GIF, WebP
                </p>
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

          {/* Instructions */}
          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">📋 Hướng dẫn sử dụng</h3>
              <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
                <li>Yêu cầu khách hàng mở mã QR trên điện thoại</li>
                <li>Đưa mã QR vào khung hình camera</li>
                <li>Hệ thống sẽ tự động quét và xác thực mã QR</li>
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
                  setResult(null);
                  setCurrentStep('qr');
                  handleRestartScan();
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
                setResult(null);
                setFaceResult(null);
                setKeyIssued(false);
                setRoomKey(null);
                setCurrentStep('qr');
                handleRestartScan();
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
                setResult(null);
                handleRestartScan();
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




