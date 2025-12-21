"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Table, THead, TBody } from "@/components/ui/Table";
import { Html5Qrcode } from "html5-qrcode";
import { createBookingNotification } from "@/lib/notifications";
import { useBookings, useRooms, useUsers } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import { authService } from "@/lib/auth-service";
import { useRouter } from "next/navigation";

type BookingRequest = {
  id: number;
  code: string;
  userId: number;
  userName?: string;  
  roomId: number;
  roomCode?: string;
  roomName?: string;
  checkinDate: string;
  checkoutDate: string;
  numGuests: number;
  note?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT';
  created_at: string;
  updated_at: string;
};

export default function OfficeBookingsPage() {
  const router = useRouter();

  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  // QR verify modal state (for CHECKED_IN bookings and APPROVED check-in)
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrScanning, setQrScanning] = useState(false);
  const [qrScanner, setQrScanner] = useState<Html5Qrcode | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [qrModalPurpose, setQrModalPurpose] = useState<'checkin' | 'verify'>('verify'); // 'checkin' for APPROVED, 'verify' for CHECKED_IN
  const [qrResult, setQrResult] = useState<{
    valid: boolean;
    message: string;
    bookingId?: number;
    userId?: string;
    userName?: string;
    userEmail?: string;
    roomCode?: string;
    bookingCode?: string;
    checkinDate?: string;
    checkoutDate?: string;
    numGuests?: number;
    backendValidated?: boolean;
    expired?: boolean;
    raw?: string;
  } | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT'>('ALL');

  // Use API hooks for data fetching (gửi status lên API nếu khác ALL)
  const { data: bookingsData, loading: bookingsLoading, error: bookingsError, refetch: refetchBookings } = useBookings(filterStatus);
  const { data: roomsData } = useRooms();
  const { data: usersData } = useUsers();
  
  // Transform API data - ensure array and normalize field names
  const rawBookings = Array.isArray(bookingsData)
    ? bookingsData
    : Array.isArray((bookingsData as any)?.items)
      ? (bookingsData as any).items
      : Array.isArray((bookingsData as any)?.data?.content)
        ? (bookingsData as any).data.content
        : Array.isArray((bookingsData as any)?.content)
          ? (bookingsData as any).content
          : Array.isArray((bookingsData as any)?.data)
            ? (bookingsData as any).data
            : [];
  
  // Normalize rooms and users data
  const rooms = Array.isArray(roomsData) ? roomsData : [];
  const users = Array.isArray(usersData) 
    ? usersData 
    : Array.isArray((usersData as any)?.items) 
      ? (usersData as any).items 
      : Array.isArray((usersData as any)?.data?.content)
        ? (usersData as any).data.content
        : [];
  
  // Normalize dữ liệu - chuyển snake_case sang camelCase và map user/room info
  const bookings: BookingRequest[] = useMemo(() => rawBookings.map((item: any) => {
    const userId = item.userId || item.user_id;
    const roomId = item.roomId || item.room_id;
    
    // Tìm room từ rooms data - thử nhiều cách match
    const room = rooms.find((r: any) => {
      const rId = r.id || r.roomId;
      return rId === roomId || 
             String(rId) === String(roomId) ||
             Number(rId) === Number(roomId);
    });
    
    // Tìm user từ users data
    const user = users.find((u: any) => 
      (u.id === userId) || 
      (u.userId === userId) ||
      (String(u.id) === String(userId)) ||
      (String(u.userId) === String(userId))
    );
    
    return {
      id: item.id,
      code: item.code || '',
      userId: userId,
      userName: item.userName || item.user_name || item.user?.name || item.user?.firstName || item.user?.email || item.user?.username || user?.name || user?.firstName || user?.email || user?.username || null,
      roomId: roomId,
      roomCode: item.roomCode || item.room_code || item.room?.code || room?.code || room?.roomCode || room?.roomNumber || null,
      roomName: item.roomName || item.room_name || item.room?.name || room?.name || room?.roomName || null,
      checkinDate: item.checkinDate || item.checkin_date || item.checkInDate || '',
      checkoutDate: item.checkoutDate || item.checkout_date || item.checkOutDate || '',
      numGuests: item.numGuests || item.num_guests || 1,
      note: item.note || '',
      status: item.status || 'PENDING',
      created_at: item.created_at || item.createdAt || '',
      updated_at: item.updated_at || item.updatedAt || ''
    };
  }), [rawBookings, rooms, users]);
  const [searchQuery, setSearchQuery] = useState('');
  const [compact, setCompact] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<number, BookingRequest['status']>>({});
  
  // Track seen bookings to avoid duplicate notifications
  const seenBookingIds = useRef<Set<number>>(new Set());
  const lastBookingCheck = useRef<number>(Date.now());

  // Advanced filters
  const [checkinFrom, setCheckinFrom] = useState('');
  const [checkinTo, setCheckinTo] = useState('');
  const [checkoutFrom, setCheckoutFrom] = useState('');
  const [checkoutTo, setCheckoutTo] = useState('');
  const [guestsMin, setGuestsMin] = useState('');
  const [guestsMax, setGuestsMax] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [roomIdFilter, setRoomIdFilter] = useState('');

  // QR Scanner helpers for CHECKED_IN verification
  const startQrScan = async () => {
    try {
      const el = document.getElementById('office-qr-reader');
      if (!el) return;
      if (qrScanner) {
        try {
          if (qrScanning) await qrScanner.stop();
          await qrScanner.clear();
        } catch {}
      }
      const scanner = new Html5Qrcode('office-qr-reader');
      setQrScanner(scanner);
      setQrScanning(true);
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 300, height: 300 }, aspectRatio: 1 },
        async (decodedText) => {
          try {
            await scanner.stop();
            await scanner.clear();
          } catch {}
          setQrScanning(false);
          setQrScanner(null);
          handleProcessOfficeQR(decodedText);
        },
        () => {}
      );
    } catch (e) {
      setQrScanning(false);
      setQrScanner(null);
      setFlash({ type: 'error', text: 'Không thể khởi động camera để quét QR' });
    }
  };

  const stopQrScan = async () => {
    try {
      if (qrScanner) {
        if (qrScanning) await qrScanner.stop();
        await qrScanner.clear();
      }
    } catch {} finally {
      setQrScanning(false);
      setQrScanner(null);
    }
  };

  const openQrModal = (booking: BookingRequest, purpose: 'checkin' | 'verify' = 'verify') => {
    setSelectedBooking(booking);
    setQrResult(null);
    setQrModalPurpose(purpose);
    setQrModalOpen(true);
    setTimeout(() => {
      startQrScan();
    }, 200);
  };

  const closeQrModal = () => {
    setQrModalOpen(false);
    setQrResult(null);
    stopQrScan();
  };

  const handleScanFile = async (file: File) => {
    if (!file) return;
    setUploadingFile(true);
    setFlash(null);
    try {
      await stopQrScan();
      const tempElementId = 'temp-qr-scanner-' + Date.now();
      const tempDiv = document.createElement('div');
      tempDiv.id = tempElementId;
      tempDiv.style.display = 'none';
      document.body.appendChild(tempDiv);
      try {
        const html5QrCode = new Html5Qrcode(tempElementId);
        const decodedText = await html5QrCode.scanFile(file, true);
        if (decodedText) {
          await handleProcessOfficeQR(decodedText);
        } else {
          setFlash({ type: 'error', text: 'Không tìm thấy mã QR trong ảnh. Vui lòng thử ảnh khác.' });
        }
      } finally {
        try {
          const tempEl = document.getElementById(tempElementId);
          if (tempEl) document.body.removeChild(tempEl);
        } catch {}
      }
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('No QR code found') || msg.includes('not found') || msg.includes('QR code parse error')) {
        setFlash({ type: 'error', text: 'Không tìm thấy mã QR trong ảnh. Vui lòng kiểm tra lại.' });
      } else {
        setFlash({ type: 'error', text: 'Lỗi khi đọc mã QR từ file.' });
      }
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setFlash({ type: 'error', text: 'Vui lòng chọn file ảnh (JPG, PNG, ...)' });
        return;
      }
      handleScanFile(file);
    }
  };

  const handleProcessOfficeQR = async (token: string) => {
    const tokenToProcess = (token || '').trim();
    if (!tokenToProcess) {
      setQrResult({ valid: false, message: 'Mã QR không hợp lệ', raw: tokenToProcess });
      return;
    }

    const tryDecode = (t: string): any | null => {
      try {
        let b64 = t.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4 !== 0) b64 += '=';
        const json = atob(b64);
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {}
      try {
        const json = atob(t);
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {}
      try {
        const parsed = JSON.parse(t);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {}
      return null;
    };

    let bookingId: number | null = null;
    let userIdFromToken: string | undefined;
    const payload = tryDecode(tokenToProcess);

    if (tokenToProcess.includes('|')) {
      const parts = tokenToProcess.split('|');
      if (parts.length >= 1 && /^\d+$/.test(parts[0].trim())) {
        bookingId = Number(parts[0].trim());
        if (parts.length >= 2) userIdFromToken = parts[1].trim();
      }
    } else if (payload) {
      bookingId = Number(payload.bookingId || payload.id || payload.booking_id);
      userIdFromToken = payload.userId ? String(payload.userId) : (payload.user_id ? String(payload.user_id) : undefined);
    } else if (/^\d+$/.test(tokenToProcess)) {
      bookingId = Number(tokenToProcess);
    }

    if (!bookingId) {
      setQrResult({ valid: false, message: 'QR không chứa bookingId', raw: tokenToProcess });
      return;
    }

    if (!selectedBooking) {
      setQrResult({ valid: false, message: 'Không xác định booking hiện tại', bookingId, raw: tokenToProcess });
      return;
    }

    if (Number(bookingId) !== Number(selectedBooking.id)) {
      setQrResult({ valid: false, message: `Mã QR không khớp booking này (QR: ${bookingId}, hiện tại: ${selectedBooking.id})`, bookingId, raw: tokenToProcess });
      return;
    }

    // 1) Thử gọi API xác thực token (Security route - có thể 403 nếu không có role)
    let backendValidated = false;
    let fromBackend: any = null;
    try {
      const verifyRes = await fetch('/api/system/verification/qr/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: tokenToProcess }),
      });
      if (verifyRes.ok) {
        fromBackend = await verifyRes.json();
        backendValidated = true;
      }
    } catch {}

    // 2) Luôn lấy thông tin booking hiện tại từ backend (đồng bộ trạng thái, thời gian)
    try {
      const res = await fetch(`/api/system/bookings?id=${bookingId}`, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.text().catch(() => '');
        setQrResult({ valid: false, message: err || 'Không tìm thấy thông tin đặt phòng từ server', bookingId, raw: tokenToProcess });
        return;
      }
      const b = await res.json();

      const status = b.status || selectedBooking.status;
      const bookingCode = b.code || b.bookingCode || selectedBooking.code;
      const userId = String(b.userId || b.user_id || userIdFromToken || '');
      const userName = fromBackend?.userName || b.userName || b.user?.fullName || b.user?.name || selectedBooking.userName;
      const userEmail = fromBackend?.userEmail || b.userEmail || b.user?.email || undefined;
      const roomCode = fromBackend?.roomCode || b.roomCode || b.room?.code || selectedBooking.roomCode;
      const checkinDate = fromBackend?.checkinDate || b.checkinDate || b.checkin_date || selectedBooking.checkinDate;
      const checkoutDate = fromBackend?.checkoutDate || b.checkoutDate || b.checkout_date || selectedBooking.checkoutDate;
      const numGuests = fromBackend?.numGuests || b.numGuests || b.num_guests || selectedBooking.numGuests;

      let expired = false;
      try {
        if (checkoutDate) {
          const now = new Date();
          const co = new Date(checkoutDate);
          if (!isNaN(co.getTime()) && now > co) expired = true;
        }
      } catch {}

      // Validate status based on purpose
      const isCheckinPurpose = qrModalPurpose === 'checkin';
      const requiredStatus = isCheckinPurpose ? 'APPROVED' : 'CHECKED_IN';
      const validStatus = String(status) === requiredStatus;

      setQrResult({
        valid: validStatus,
        backendValidated,
        expired,
        message: validStatus
          ? (backendValidated ? (expired ? 'Mã hợp lệ (backend xác thực) nhưng đã quá hạn' : 'Mã hợp lệ (backend xác thực)') : (expired ? 'Mã hợp lệ nhưng đã quá hạn' : 'Mã hợp lệ'))
          : `Trạng thái không hợp lệ: ${status}. Yêu cầu ${requiredStatus}`,
        bookingId,
        userId,
        userName,
        userEmail,  
        roomCode,
        bookingCode,
        checkinDate,
        checkoutDate,
        numGuests,
        raw: tokenToProcess,
      });

      // Nếu quét thành công và là mục đích check-in, tự động gọi check-in
      if (validStatus && isCheckinPurpose && selectedBooking) {
        setTimeout(async () => {
          try {
            const res = await fetch(`/api/system/bookings?action=checkin&id=${selectedBooking.id}`, {
              method: 'POST'
            });
            if (res.ok) {
              setFlash({ type: 'success', text: 'Check-in thành công sau khi xác thực QR!' });
              closeQrModal();
              refetchBookings();
              createBookingNotification(
                selectedBooking.id,
                selectedBooking.userName || `User #${selectedBooking.userId}`,
                selectedBooking.roomCode || `Room #${selectedBooking.roomId}`,
                'CONFIRMED'
              );
            } else {
              const err = await res.text();
              setFlash({ type: 'error', text: err || 'Xác thực QR thành công nhưng check-in thất bại' });
            }
          } catch (error) {
            setFlash({ type: 'error', text: 'Xác thực QR thành công nhưng check-in thất bại' });
            console.error('Check-in after QR verification error:', error);
          }
        }, 1000); // Delay 1s để user thấy kết quả xác thực
      }
    } catch (e: any) {
      setQrResult({ valid: false, message: e?.message || 'Lỗi khi xác thực với backend', bookingId, raw: tokenToProcess });
    }
  };

  useEffect(() => {
    if (!qrModalOpen) {
      stopQrScan();
    }
  }, [qrModalOpen]);

  // Auto-hide success/error messages
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [flash]);

  // Check for new bookings and add to notification system
  useEffect(() => {
    // Initialize seen bookings on first load
    if (bookings.length > 0 && seenBookingIds.current.size === 0) {
      bookings.forEach(b => {
        if (b.status === 'PENDING') {
          seenBookingIds.current.add(b.id);
        }
      });
      lastBookingCheck.current = Date.now();
      return;
    }

    // Check for new PENDING bookings
    const newPendingBookings = bookings.filter(b => 
      b.status === 'PENDING' && 
      !seenBookingIds.current.has(b.id) &&
      new Date(b.created_at).getTime() > lastBookingCheck.current
    );

    if (newPendingBookings.length > 0) {
      newPendingBookings.forEach(booking => {
        seenBookingIds.current.add(booking.id);
        
        // Add notification to the notification system (will appear in Header dropdown)
        const guestName = booking.userName || `User #${booking.userId}`;
        const roomInfo = booking.roomName || booking.roomCode || `Room #${booking.roomId}`;
        
        createBookingNotification(
          booking.id,
          guestName,
          roomInfo,
          'PENDING'
        );
      });
      
      lastBookingCheck.current = Date.now();
    }
  }, [bookings]);

  const bookingsWithOverride = useMemo(() => {
    if (!statusOverrides || Object.keys(statusOverrides).length === 0) return bookings;
    return bookings.map(b => ({ ...b, status: statusOverrides[b.id] || b.status }));
  }, [bookings, statusOverrides]);

      const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bookingsWithOverride.filter(booking => {
      // Search filter
      let searchMatch = true;
      if (q) {
        const hay = [
          booking.code,
          booking.userName || String(booking.userId),
          booking.roomCode || String(booking.roomId),
          booking.note || ''
        ].join(' ').toLowerCase();
        searchMatch = hay.includes(q);
      }

      // Advanced filters
      let advancedMatch = true;
      if (checkinFrom && booking.checkinDate < checkinFrom) advancedMatch = false;
      if (checkinTo && booking.checkinDate > checkinTo) advancedMatch = false;
      if (checkoutFrom && booking.checkoutDate < checkoutFrom) advancedMatch = false;
      if (checkoutTo && booking.checkoutDate > checkoutTo) advancedMatch = false;
      if (guestsMin && booking.numGuests < parseInt(guestsMin)) advancedMatch = false;
      if (guestsMax && booking.numGuests > parseInt(guestsMax)) advancedMatch = false;
      if (userIdFilter && booking.userId !== parseInt(userIdFilter)) advancedMatch = false;
      if (roomIdFilter && booking.roomId !== parseInt(roomIdFilter)) advancedMatch = false;

      return searchMatch && advancedMatch;
    });
  }, [bookingsWithOverride, searchQuery, checkinFrom, checkinTo, checkoutFrom, checkoutTo, guestsMin, guestsMax, userIdFilter, roomIdFilter, filterStatus]);

  const handleApprove = async (booking: BookingRequest) => {
    setApprovingId(booking.id);
    try {
      const token = authService.getAccessToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/system/bookings?action=approve&id=${booking.id}`, {
        method: 'POST',
        headers
      })
      if (res.ok) {
        // Cập nhật UI ngay lập tức
        setStatusOverrides(prev => ({ ...prev, [booking.id]: 'APPROVED' }));
        setFlash({ type: 'success', text: 'Đã duyệt đặt phòng thành công!' });
        // Đóng modal ngay để tránh cảm giác bị đứng
        setApprovalModalOpen(false);
        setSelectedBooking(null);
        // Refetch danh sách nhưng không chờ để UI không bị khựng
        refetchBookings();
        
        // Create notification
        createBookingNotification(
          booking.id,
          booking.userName || `User #${booking.userId}`,
          booking.roomCode || `Room #${booking.roomId}`,
          'CONFIRMED'
        );
      } else {
        const err = await res.text()
        setFlash({ type: 'error', text: err || 'Có lỗi xảy ra khi duyệt đặt phòng' });
      }
    } catch (error) {
      setFlash({ type: 'error', text: 'Có lỗi xảy ra khi duyệt đặt phòng' });
      console.error('Booking approval error:', error);
    } finally {
      setApprovingId(null);
    }
  };

  const handleCheckin = async (booking: BookingRequest) => {
    // Mở modal quét QR thay vì gọi API trực tiếp
    openQrModal(booking, 'checkin');
  };

  const handleCheckout = async (booking: BookingRequest) => {
    try {
      const response = await apiClient.updateBooking(booking.id, {
        ...booking,
        status: 'CHECKED_OUT'
      });

      if (response.success) {
        setFlash({ type: 'success', text: 'Check-out thành công!' });
        refetchBookings();
        // Create notification
        createBookingNotification(
          booking.id,
          booking.userName || `User #${booking.userId}`,
          booking.roomCode || `Room #${booking.roomId}`,
          'CONFIRMED'
        );
      } else {
        setFlash({ type: 'error', text: response.error || 'Có lỗi xảy ra khi check-out' });
      }
    } catch (error) {
      setFlash({ type: 'error', text: 'Có lỗi xảy ra khi check-out' });
      console.error('Booking checkout error:', error);
    }
  };

  const handleReject = async (booking: BookingRequest) => {
    if (!rejectionReason.trim()) {
      setFlash({ type: 'error', text: 'Vui lòng nhập lý do từ chối' });
      return;
    }

    setRejectingId(booking.id);
    try {
      const response = await apiClient.updateBooking(booking.id, {
        ...booking,
        status: 'REJECTED',
        rejectionReason
      });
      
      if (response.success) {
        // Cập nhật UI ngay lập tức
        setStatusOverrides(prev => ({ ...prev, [booking.id]: 'REJECTED' }));
        setFlash({ type: 'success', text: 'Đã từ chối đặt phòng' });
        setApprovalModalOpen(false);
        setSelectedBooking(null);
        setRejectionReason('');
        refetchBookings();
        
        // Create notification
        createBookingNotification(
          booking.id,
          booking.userName || `User #${booking.userId}`,
          booking.roomCode || `Room #${booking.roomId}`,
          'REJECTED'
        );
      } else {
        setFlash({ type: 'error', text: response.error || 'Có lỗi xảy ra khi từ chối đặt phòng' });
      }
    } catch (error) {
      setFlash({ type: 'error', text: 'Có lỗi xảy ra khi từ chối đặt phòng' });
      console.error('Booking rejection error:', error);
    } finally {
      setRejectingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge tone="warning">Chờ duyệt</Badge>;
      case 'APPROVED':
        return <Badge tone="available">Đã duyệt</Badge>;
      case 'REJECTED':
        return <Badge tone="rejected">Từ chối</Badge>;
      case 'CHECKED_IN':
        return <Badge tone="occupied">Đã nhận phòng</Badge>;
      case 'CHECKED_OUT':
        return <Badge tone="maintenance">Đã trả phòng</Badge>;
      case 'CANCELLED':
        return <Badge tone="rejected">Đã hủy</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const resetAdvancedFilters = () => {
    setCheckinFrom('');
    setCheckinTo('');
    setCheckoutFrom('');
    setCheckoutTo('');
    setGuestsMin('');
    setGuestsMax('');
    setUserIdFilter('');
    setRoomIdFilter('');
  };

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-transparent shadow-sm px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Quản lý đặt phòng</h1>
              <p className="text-sm lg:text-base text-gray-600 mt-1">Theo dõi và xử lý yêu cầu đặt phòng</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-5 sm:py-6">
        <div className="space-y-5 sm:space-y-6">
          {/* Flash Messages */}
          {flash && (
            <div className={`rounded-md border p-2 sm:p-3 text-xs sm:text-sm shadow-sm ${
              flash.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {flash.text}
            </div>
          )}

          {/* Toolbar */}
          <Card>
            <CardBody>
              <div className="space-y-4">
                {/* Search, Status Filter and View Toggle */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm đặt phòng theo mã, người đặt, phòng..."
                      className="w-full px-3 py-2 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Tìm kiếm đặt phòng"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      className="px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex-1 sm:flex-none min-w-[100px]"
                      aria-label="Lọc theo trạng thái"
                    >
                      <option value="ALL">Tất cả</option>
                      <option value="PENDING">Chờ duyệt</option>
                      <option value="APPROVED">Đã duyệt</option>
                      <option value="REJECTED">Từ chối</option>
                      <option value="CHECKED_IN">Đã nhận</option>
                      <option value="CHECKED_OUT">Đã trả</option>
                      <option value="CANCELLED">Đã hủy</option>
                    </select>
                    <Button
                      variant={showAdvanced ? "primary" : "secondary"}
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4"
                    >
                       Bộ lọc
                    </Button>
                  </div>
                </div>

                {/* Advanced Filters */}
                {showAdvanced && (
                  <div className="border-t pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Check-in từ</label>
                        <input
                          type="date"
                          value={checkinFrom}
                          onChange={(e) => setCheckinFrom(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Check-in đến</label>
                        <input
                          type="date"
                          value={checkinTo}
                          onChange={(e) => setCheckinTo(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Check-out từ</label>
                        <input
                          type="date"
                          value={checkoutFrom}
                          onChange={(e) => setCheckoutFrom(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Check-out đến</label>
                        <input
                          type="date"
                          value={checkoutTo}
                          onChange={(e) => setCheckoutTo(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Số khách tối thiểu</label>
                        <input
                          type="number"
                          min="1"
                          value={guestsMin}
                          onChange={(e) => setGuestsMin(e.target.value)}
                          placeholder="Min"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Số khách tối đa</label>
                        <input
                          type="number"
                          min="1"
                          value={guestsMax}
                          onChange={(e) => setGuestsMax(e.target.value)}
                          placeholder="Max"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">ID người dùng</label>
                        <input
                          type="number"
                          value={userIdFilter}
                          onChange={(e) => setUserIdFilter(e.target.value)}
                          placeholder="User ID"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">ID phòng</label>
                        <input
                          type="number"
                          value={roomIdFilter}
                          onChange={(e) => setRoomIdFilter(e.target.value)}
                          placeholder="Room ID"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button variant="secondary" onClick={resetAdvancedFilters} className="text-sm">
                        Đặt lại
                      </Button>
                      <Button variant="primary" onClick={() => setShowAdvanced(false)} className="text-sm">
                        Áp dụng
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Bookings Table */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">
                Danh sách đặt phòng ({filteredBookings.length})
              </h3>
            </CardHeader>
            <CardBody>
              {bookingsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-md bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500">Không có đặt phòng nào</p>
                  <div className="mt-4">
                    <Button variant="secondary" onClick={() => refetchBookings()}>
                      Làm mới
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="block md:hidden space-y-3">
                    {filteredBookings.map((booking) => (
                      <Card key={booking.id}>
                        <CardBody>
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 mb-1">{booking.code}</div>
                                <div className="text-sm text-gray-600">
                                  {booking.userName || `User #${booking.userId}`}
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                  {booking.roomName || booking.roomCode || `Room #${booking.roomId}`}
                                </div>
                              </div>
                              <div className="ml-2">
                                {getStatusBadge(booking.status)}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500">CI:</span> {booking.checkinDate}
                              </div>
                              <div>
                                <span className="text-gray-500">CO:</span> {booking.checkoutDate}
                              </div>
                              <div>
                                <span className="text-gray-500">Khách:</span> {booking.numGuests}
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 pt-2 border-t">
                              {booking.status === 'PENDING' && (
                                <>
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedBooking(booking);
                                      setApprovalModalOpen(true);
                                    }}
                                    variant="primary"
                                    className="text-xs flex-1 min-w-[80px]"
                                  >
                                    Duyệt
                                  </Button>
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedBooking(booking);
                                      setApprovalModalOpen(true);
                                    }}
                                    variant="danger"
                                    className="text-xs flex-1 min-w-[80px]"
                                  >
                                    Không duyệt
                                  </Button>
                                </>
                              )}
                              {booking.status === 'APPROVED' && (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCheckin(booking);
                                  }}
                                  variant="secondary"
                                  className="text-xs flex-1"
                                >
                                  Check-in
                                </Button>
                              )}
                              {booking.status === 'CHECKED_IN' && (
                                <>
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openQrModal(booking);
                                    }}
                                    variant="primary"
                                    className="text-xs flex-1"
                                  >
                                    Quét mã
                                  </Button>
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCheckout(booking);
                                    }}
                                    variant="secondary"
                                    className="text-xs flex-1"
                                  >
                                    Check-out
                                  </Button>
                                </>
                              )}
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBooking(booking);
                                  setDetailModalOpen(true);
                                }}
                                variant="secondary"
                                className="text-xs flex-1"
                              >
                                Xem chi tiết
                              </Button>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <div className="min-w-[800px]">
                      <Table>
                        <THead>
                          <tr>
                            <th className="px-3 lg:px-4 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap text-xs lg:text-sm">Mã đặt phòng</th>
                            <th className="px-2 lg:px-3 py-3 bg-gray-50 sticky top-0 z-10 text-center max-w-[120px] text-xs lg:text-sm">Người đặt</th>
                            <th className="px-3 lg:px-4 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap text-xs lg:text-sm">Phòng</th>
                            <th className="px-3 lg:px-4 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap text-xs lg:text-sm">Thời gian</th>
                            <th className="px-3 lg:px-4 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap text-xs lg:text-sm">Số khách</th>
                            <th className="px-3 lg:px-4 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap text-xs lg:text-sm">Trạng thái</th>
                            <th className="px-3 lg:px-4 py-3 bg-gray-50 sticky top-0 z-10 text-center whitespace-nowrap text-xs lg:text-sm">Thao tác</th>
                          </tr>
                        </THead>
                        <TBody>
                          {filteredBookings.map((booking) => (
                            <tr 
                              key={booking.id} 
                              className="odd:bg-white even:bg-gray-50 hover:bg-gray-100"
                            >
                              <td className="px-3 lg:px-4 py-3 align-middle whitespace-nowrap">
                                <div className="font-medium text-gray-900 text-xs lg:text-sm cursor-pointer hover:text-blue-600" onClick={() => {
                                  setSelectedBooking(booking);
                                  setDetailModalOpen(true);
                                }}>{booking.code}</div>
                              </td>
                              <td className="px-2 lg:px-3 py-3 align-middle max-w-[120px]">
                                <div className="font-medium text-gray-900 text-xs lg:text-sm break-words">
                                  {booking.userName || `User #${booking.userId}`}
                                </div>
                              </td>
                              <td className="px-3 lg:px-4 py-3 align-middle whitespace-nowrap">
                                <div className="font-medium text-gray-900 text-xs lg:text-sm">
                                  {booking.roomName || booking.roomCode || `Room #${booking.roomId}`}
                                </div>
                              </td>
                              <td className="px-3 lg:px-4 py-3 align-middle">
                                <div className="text-xs lg:text-sm">
                                  <div className="text-gray-900">CI: {booking.checkinDate}</div>
                                  <div className="text-gray-900">CO: {booking.checkoutDate}</div>
                                  <div className="text-gray-500 text-xs mt-1">
                                    Đặt lúc: {booking.created_at 
                                      ? (() => {
                                          const date = new Date(booking.created_at);
                                          return isNaN(date.getTime()) 
                                            ? booking.created_at 
                                            : date.toLocaleString('vi-VN');
                                        })()
                                      : 'N/A'}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 lg:px-4 py-3 align-middle whitespace-nowrap">
                                <div className="text-xs lg:text-sm text-gray-900">{booking.numGuests} khách</div>
                              </td>
                              <td className="px-3 lg:px-4 py-3 align-middle whitespace-nowrap">
                                {getStatusBadge(booking.status)}
                              </td>
                              <td className="px-3 lg:px-4 py-3 align-middle whitespace-nowrap">
                                <div className="flex gap-1 justify-center">
                                  {booking.status === 'PENDING' && (
                                    <>
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedBooking(booking);
                                          setApprovalModalOpen(true);
                                        }}
                                        variant="primary"
                                        className="text-xs px-2 py-1"
                                      >
                                        Duyệt
                                      </Button>
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedBooking(booking);
                                          setApprovalModalOpen(true);
                                        }}
                                        variant="danger"
                                        className="text-xs px-2 py-1"
                                      >
                                        Từ chối
                                      </Button>
                                    </>
                                  )}
                                  {booking.status === 'APPROVED' && (
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCheckin(booking);
                                      }}
                                      variant="secondary"
                                      className="text-xs px-2 py-1"
                                    >
                                      Check-in
                                    </Button>
                                  )}
                                  {booking.status === 'CHECKED_IN' && (
                                    <>
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openQrModal(booking);
                                        }}
                                        variant="primary"
                                        className="text-xs px-2 py-1"
                                      >
                                        Quét mã
                                      </Button>
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCheckout(booking);
                                        }}
                                        variant="secondary"
                                        className="text-xs px-2 py-1"
                                      >
                                        Check-out
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedBooking(booking);
                                      setDetailModalOpen(true);
                                    }}
                                    variant="secondary"
                                    className="text-xs px-2 py-1"
                                  >
                                    Chi tiết
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </TBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedBooking(null);
        }}
        title={selectedBooking ? `Chi tiết đặt phòng - ${selectedBooking.code}` : ''}
        size="xl"
        footer={
          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setDetailModalOpen(false);
                setSelectedBooking(null);
              }}
            >
              Đóng
            </Button>
          </div>
        }
      >
        {selectedBooking && (
          <div className="p-3 sm:p-4 md:p-6">
            <div className="space-y-4 sm:space-y-5 md:space-y-6">
              {/* Header Section - Mobile Optimized */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 sm:p-4 md:p-6 border border-blue-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  {/* Icon và Title */}
                  <div className="flex items-center gap-3 w-full sm:w-auto sm:flex-1 min-w-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                      <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 break-words">Đặt phòng {selectedBooking.code}</h2>
                      <div className="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2">
                        <span className="text-xs sm:text-sm text-gray-600">ID: {selectedBooking.id}</span>
                        <span className="hidden xs:inline text-gray-400">•</span>
                        <span className="text-xs sm:text-sm text-gray-600 truncate">{selectedBooking.userId} - {selectedBooking.userName || 'User'}</span>
                      </div>
                    </div>
                  </div>
                  {/* Status Badge */}
                  <div className="flex-shrink-0 w-full sm:w-auto sm:ml-auto">
                    <div className="flex justify-start sm:justify-end">
                      {getStatusBadge(selectedBooking.status)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Thông tin khách hàng */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Thông tin khách hàng</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-xs sm:text-sm font-semibold text-gray-700">Người đặt</span>
                    </div>
                    <p className="text-sm sm:text-base font-medium text-gray-900 break-words">
                      {selectedBooking.userName || `User #${selectedBooking.userId}`}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="text-xs sm:text-sm font-semibold text-gray-700">Số khách</span>
                    </div>
                    <p className="text-sm sm:text-base font-medium text-gray-900">{selectedBooking.numGuests} người</p>
                  </div>
                </div>
              </div>

              {/* Thông tin phòng */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Thông tin phòng</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="text-xs sm:text-sm font-semibold text-gray-700">Phòng</span>
                    </div>
                    <p className="text-sm sm:text-base font-medium text-gray-900 break-words">
                      {selectedBooking.roomName || selectedBooking.roomCode || `Room #${selectedBooking.roomId}`}
                      {(selectedBooking as any).roomCode ? ` - ${(selectedBooking as any).roomCode}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Thời gian đặt phòng */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Thời gian đặt phòng</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs sm:text-sm font-semibold text-gray-700">Ngày check-in</span>
                    </div>
                    <p className="text-sm sm:text-base font-medium text-gray-900 break-words">
                      {selectedBooking.checkinDate ? (() => {
                        const date = new Date(selectedBooking.checkinDate);
                        return date.toLocaleDateString('vi-VN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        });
                      })() : selectedBooking.checkinDate}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs sm:text-sm font-semibold text-gray-700">Ngày check-out</span>
                    </div>
                    <p className="text-sm sm:text-base font-medium text-gray-900 break-words">
                      {selectedBooking.checkoutDate ? (() => {
                        const date = new Date(selectedBooking.checkoutDate);
                        return date.toLocaleDateString('vi-VN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        });
                      })() : selectedBooking.checkoutDate}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mục đích và Ghi chú */}
              {selectedBooking.note && (
                <div className="space-y-3 sm:space-y-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Thông tin bổ sung</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {selectedBooking.note && (
                      <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-xs sm:text-sm font-semibold text-gray-700">Ghi chú</span>
                        </div>
                        <p className="text-sm sm:text-base text-gray-700 whitespace-pre-line break-words">{selectedBooking.note}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Thông tin hệ thống */}
              {(selectedBooking.created_at || selectedBooking.updated_at) && (
                <div className="space-y-3 sm:space-y-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Thông tin hệ thống</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {selectedBooking.created_at && (
                      <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs sm:text-sm font-semibold text-gray-600">Ngày tạo</span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-700 break-words">
                          {new Date(selectedBooking.created_at).toLocaleString('vi-VN', { 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            day: 'numeric',
                            month: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    )}
                    {selectedBooking.updated_at && (
                      <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs sm:text-sm font-semibold text-gray-600">Cập nhật lần cuối</span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-700 break-words">
                          {new Date(selectedBooking.updated_at).toLocaleString('vi-VN', {
                            hour: '2-digit', 
                            minute: '2-digit', 
                            day: 'numeric',
                            month: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* QR Verify Modal */}
      <Modal
        open={qrModalOpen}
        onClose={closeQrModal}
        title={selectedBooking 
          ? (qrModalPurpose === 'checkin' 
              ? `Quét mã QR để Check-in - ${selectedBooking.code}` 
              : `Quét mã xác thực - ${selectedBooking.code}`)
          : (qrModalPurpose === 'checkin' ? 'Quét mã QR để Check-in' : 'Quét mã xác thực')}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeQrModal}>Đóng</Button>
            <Button onClick={startQrScan} disabled={qrScanning}>Khởi động lại</Button>
          </div>
        }
      >
        <div className="space-y-4">
          {selectedBooking && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded">
              <div className="text-sm text-blue-900">
                {qrModalPurpose === 'checkin' 
                  ? `Quét mã QR để xác thực và check-in cho booking: `
                  : `Xác thực mã cho booking: `}
                <span className="font-semibold">{selectedBooking.code}</span> — Phòng: {selectedBooking.roomName || selectedBooking.roomCode || `#${selectedBooking.roomId}`}
              </div>
            </div>
          )}
          <div className="relative">
            <div
              id="office-qr-reader"
              ref={scannerRef as any}
              className="w-full max-w-sm mx-auto rounded-lg overflow-hidden border-2 border-blue-500 aspect-square"
            />
            {qrScanning && (
              <div className="absolute top-2 left-2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 z-10">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                Đang quét...
              </div>
            )}
          </div>

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
                onChange={handleFileChange as any}
                className="hidden"
                id="office-qr-file-input"
                disabled={uploadingFile}
              />
              <label htmlFor="office-qr-file-input" className="flex-1 cursor-pointer">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={uploadingFile}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingFile ? 'Đang đọc...' : 'Chọn ảnh QR từ máy tính'}
                </Button>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">Hỗ trợ các định dạng: JPG, PNG, GIF, WebP</p>
          </div>

          {qrResult && (
            <div className="space-y-3">
              <div className={`rounded-md border p-3 text-sm ${qrResult.valid ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {qrResult.message}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-1 rounded-full border ${qrResult.backendValidated ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                  {qrResult.backendValidated ? 'Backend đã xác thực' : 'Chưa xác thực từ backend'}
                </span>
                {typeof qrResult.expired !== 'undefined' && (
                  <span className={`text-xs px-2 py-1 rounded-full border ${qrResult.expired ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {qrResult.expired ? 'Đã quá hạn' : 'Còn hiệu lực'}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Mã đặt phòng</p>
                  <p className="font-medium text-gray-900">{qrResult.bookingCode || selectedBooking?.code || (qrResult.bookingId ? `#${qrResult.bookingId}` : 'N/A')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Khách hàng</p>
                  <p className="font-medium text-gray-900">{qrResult.userName || selectedBooking?.userName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Email</p>
                  <p className="font-medium text-gray-900">{qrResult.userEmail || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Phòng</p>
                  <p className="font-medium text-gray-900">{qrResult.roomCode || selectedBooking?.roomCode || selectedBooking?.roomName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Check-in</p>
                  <p className="font-medium text-gray-900">{qrResult.checkinDate ? new Date(qrResult.checkinDate).toLocaleString('vi-VN') : (selectedBooking?.checkinDate || 'N/A')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Check-out</p>
                  <p className="font-medium text-gray-900">{qrResult.checkoutDate ? new Date(qrResult.checkoutDate).toLocaleString('vi-VN') : (selectedBooking?.checkoutDate || 'N/A')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Số khách</p>
                  <p className="font-medium text-gray-900">{qrResult.numGuests ?? selectedBooking?.numGuests ?? 'N/A'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Approval Modal */}
      <Modal
        open={approvalModalOpen}
        onClose={() => {
          setApprovalModalOpen(false);
          setSelectedBooking(null);
          setRejectionReason('');
        }}
        title={selectedBooking ? `Xử lý đặt phòng - ${selectedBooking.code}` : ''}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setApprovalModalOpen(false);
                setSelectedBooking(null);
                setRejectionReason('');
              }}
            >
              Hủy
            </Button>
            {selectedBooking && (
              <>
                <Button
                  variant="danger"
                  onClick={() => handleReject(selectedBooking)}
                  disabled={approvingId === selectedBooking.id || rejectingId === selectedBooking.id}
                >
                  {rejectingId === selectedBooking.id ? 'Đang từ chối...' : 'Từ chối'}
                </Button>
                <Button
                  onClick={() => handleApprove(selectedBooking)}
                  disabled={approvingId === selectedBooking.id || rejectingId === selectedBooking.id}
                >
                  {approvingId === selectedBooking.id ? 'Đang duyệt...' : 'Duyệt'}
                </Button>
              </>
            )}
          </div>
        }
      >
        {selectedBooking && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-2">Thông tin đặt phòng</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="font-medium">Mã đặt phòng:</span> {selectedBooking.code}</div>
                <div><span className="font-medium">Người đặt:</span> {selectedBooking.userName || `User #${selectedBooking.userId}`}</div>
                <div><span className="font-medium">Phòng:</span> {selectedBooking.roomCode || selectedBooking.roomName || `Room #${selectedBooking.roomId}`}</div>
                <div><span className="font-medium">Số khách:</span> {selectedBooking.numGuests}</div>
                <div><span className="font-medium">Check-in:</span> {selectedBooking.checkinDate}</div>
                <div><span className="font-medium">Check-out:</span> {selectedBooking.checkoutDate}</div>
                {selectedBooking.note && <div className="col-span-2"><span className="font-medium">Ghi chú:</span> {selectedBooking.note}</div>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lý do từ chối (nếu có)</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Nhập lý do từ chối (nếu cần)"
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}


