"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Input from "@/components/ui/Input";
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
import { formatDate, formatDateTime } from "@/lib/utils";
import { API_CONFIG } from "@/lib/config";

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
  created_at: string | null;
  updated_at: string | null;
};

const statusOptions: ('PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT')[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'CHECKED_IN', 'CHECKED_OUT'];

const statusLabels: Record<'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT', string> = {
  "PENDING": "Chờ duyệt",
  "APPROVED": "Đã duyệt",
  "REJECTED": "Đã từ chối",
  "CANCELLED": "Đã hủy",
  "CHECKED_IN": "Đã nhận phòng",
  "CHECKED_OUT": "Đã trả phòng"
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

  // Face images state
  const [faceImages, setFaceImages] = useState<Record<string, string[] | null>>({});
  const [loadingFaces, setLoadingFaces] = useState<Record<string, boolean>>({});
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

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
  
  // Helper: Get full name for a user
  const getUserFullName = useCallback((userId: string | number | undefined) => {
    if (!userId) return null;
    const userIdStr = String(userId);
    const user = users.find((u: any) => 
      String(u.id) === userIdStr || String(u.userId) === userIdStr
    );
    return user?.full_name || user?.fullName || null;
  }, [users]);

  // Helper: Get face image URL for a user
  // IMPORTANT: Prefer AI face images cache first. Only fallback to avatarUrl when no AI face image.
  const getUserFaceImage = useCallback((userId: string | number | undefined) => {
    if (!userId) return null;
    const userIdStr = String(userId);

    // 1) Prefer AI face image (from GET /ai/recognition/faces/{id}/images)
    const aiFaces = faceImages[userIdStr];
    if (Array.isArray(aiFaces) && aiFaces.length > 0) return aiFaces[0];

    // 2) Fallback to user avatar
    const user = users.find((u: any) => 
      String(u.id) === userIdStr || String(u.userId) === userIdStr
    );
    if (user?.avatarUrl) return user.avatarUrl;

    return null;
  }, [faceImages, users]);

  // Fetch face image for a user
  // Backend endpoint: GET /ai/recognition/faces/{id}/images
  const fetchFaceImage = useCallback(async (userId: string) => {
    if (!userId || faceImages[userId] !== undefined || loadingFaces[userId]) {
      return; // Already fetched or loading
    }

    setLoadingFaces(prev => ({ ...prev, [userId]: true }));
    try {
      // 1) Prefer actual face images endpoint
      const imagesRes = await apiClient.getUserFaceImages(userId);

      if (imagesRes?.success && imagesRes?.data) {
        // Backend actual shape:
        // imagesRes.data = {
        //   success: true,
        //   message: "Retrieved ...",
        //   images: [ { image_name, image_base64, image_path, file_size }, ... ],
        //   student_id,
        //   total_images
        // }
        const raw: any = imagesRes.data;

        const items: any[] = Array.isArray(raw?.images) ? raw.images : [];
        const dataUrls: string[] = items
          .map((it: any) => {
            const b64 = it?.image_base64;
            if (!b64 || typeof b64 !== 'string') return null;
            // BE sends pure base64 (no data: prefix)
            return b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
          })
          .filter(Boolean) as string[];

        setFaceImages(prev => ({ ...prev, [userId]: dataUrls.length > 0 ? dataUrls : null }));
        return;
      }

      // 2) Fallback to face info (metadata) endpoint
      const infoRes = await apiClient.getUserFaceInfo(userId);
      if (infoRes?.success) {
        // If we only have metadata, fallback to avatarUrl from users list
        const user = users.find((u: any) => String(u.id) === String(userId));
        const imageUrl = user?.avatarUrl || null;
        setFaceImages(prev => ({ ...prev, [userId]: imageUrl ? [imageUrl] : null }));
      } else {
        setFaceImages(prev => ({ ...prev, [userId]: null }));
      }
    } catch (error) {
      console.error(`Failed to fetch face image for user ${userId}:`, error);
      setFaceImages(prev => ({ ...prev, [userId]: null }));
    } finally {
      setLoadingFaces(prev => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
    }
  }, [faceImages, loadingFaces, users]);

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
      created_at: item.created_at || item.createdAt || item.createdDate || item.created || item.dateCreated || item.bookingCreatedAt || null,
      updated_at: item.updated_at || item.updatedAt || item.updatedDate || item.updated || item.dateUpdated || null
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

  const openQrModal = (booking: BookingRequest) => {
    setSelectedBooking(booking);
    setQrResult(null);
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
      const requiredStatus = 'CHECKED_IN';
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


    } catch (e: any) {
      setQrResult({ valid: false, message: e?.message || 'Lỗi khi xác thực với backend', bookingId, raw: tokenToProcess });
    }
  };

  useEffect(() => {
    if (!qrModalOpen) {
      stopQrScan();
    }
  }, [qrModalOpen]);

  // Reset image index when modal opens or selected booking changes
  useEffect(() => {
    if (faceModalOpen && selectedBooking) {
      setCurrentImageIndex(0);
    }
  }, [faceModalOpen, selectedBooking]);

  // Fetch face images for all bookings when users are loaded
  useEffect(() => {
    if (users.length === 0) return; // Wait for users to load
    bookings.forEach(booking => {
      if (booking.userId) {
        const userIdStr = String(booking.userId);
        // Only fetch if not already cached and user exists
        if (faceImages[userIdStr] === undefined && !loadingFaces[userIdStr]) {
          fetchFaceImage(userIdStr).catch(console.error);
        }
      }
    });
  }, [bookings, users, faceImages, loadingFaces, fetchFaceImage]);

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
      b.created_at && new Date(b.created_at).getTime() > lastBookingCheck.current
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
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const prevStatus = statusOverrides[booking.id];

    // Optimistic UI: đóng modal + set status ngay để tránh cảm giác chờ
    setApprovingId(booking.id);
    setStatusOverrides(prev => ({ ...prev, [booking.id]: 'APPROVED' }));
    setApprovalModalOpen(false);
    setSelectedBooking(null);

    try {
      const token = authService.getAccessToken();
      const userInfo = authService.getUserInfo();

      // Direct backend call to reduce latency (skip Next.js route handler hop)
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_CONFIG.BASE_URL}/bookings/${booking.id}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          bookingId: booking.id,
          approverId: userInfo?.id || undefined,
          decision: 'APPROVED',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        setFlash({ type: 'success', text: 'Đã duyệt đặt phòng thành công!' });
        refetchBookings(); // không chờ để UI không khựng

        createBookingNotification(
          booking.id,
          booking.userName || `User #${booking.userId}`,
          booking.roomCode || `Room #${booking.roomId}`,
          'CONFIRMED'
        );
      } else {
        const err = await res.text().catch(() => '');
        // Rollback
        setStatusOverrides(prev => ({ ...prev, [booking.id]: prevStatus || booking.status }));
        setFlash({ type: 'error', text: err || 'Có lỗi xảy ra khi duyệt đặt phòng' });
      }
    } catch (error: any) {
      // Rollback khi lỗi/timeout
      setStatusOverrides(prev => ({ ...prev, [booking.id]: prevStatus || booking.status }));
      setFlash({
        type: 'error',
        text: error?.name === 'AbortError'
          ? 'Yêu cầu duyệt quá lâu, vui lòng thử lại'
          : 'Có lỗi xảy ra khi duyệt đặt phòng'
      });
      console.error('Booking approval error:', error);
    } finally {
      clearTimeout(timeoutId);
      setApprovingId(null);
      const endedAt = performance.now();
      console.log('handleApprove duration(ms):', Math.round(endedAt - startedAt));
    }
  };

  const handleCheckout = async (booking: BookingRequest) => {
    try {
      const token = authService.getAccessToken();
      const userInfo = authService.getUserInfo();
      const userId = booking.userId ? String(booking.userId) : (userInfo?.id ? String(userInfo.id) : undefined);

      const response = await apiClient.checkoutBooking(booking.id, userId);

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

    const startedAt = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const prevStatus = statusOverrides[booking.id];

    // Optimistic UI
    setRejectingId(booking.id);
    setStatusOverrides(prev => ({ ...prev, [booking.id]: 'REJECTED' }));
    setApprovalModalOpen(false);
    setSelectedBooking(null);

    try {
      const token = authService.getAccessToken();
      const userInfo = authService.getUserInfo();

      // Direct backend call to reduce latency (skip Next.js route handler hop)
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }



      const res = await fetch(`${API_CONFIG.BASE_URL}/bookings/${booking.id}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          bookingId: booking.id,
          approverId: userInfo?.id || undefined,
          decision: 'REJECTED',
          reason: rejectionReason.trim(),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        setFlash({ type: 'success', text: 'Đã từ chối đặt phòng' });
        setRejectionReason('');
        refetchBookings();

        createBookingNotification(
          booking.id,
          booking.userName || `User #${booking.userId}`,
          booking.roomCode || `Room #${booking.roomId}`,
          'REJECTED'
        );
      } else {
        const err = await res.text().catch(() => '');
        setStatusOverrides(prev => ({ ...prev, [booking.id]: prevStatus || booking.status }));
        setFlash({ type: 'error', text: err || 'Có lỗi xảy ra khi từ chối đặt phòng' });
      }
    } catch (error: any) {
      setStatusOverrides(prev => ({ ...prev, [booking.id]: prevStatus || booking.status }));
      setFlash({
        type: 'error',
        text: error?.name === 'AbortError'
            ? 'Yêu cầu từ chối quá lâu, vui lòng thử lại'
            : 'Có lỗi xảy ra khi từ chối đặt phòng'
      });
      console.error('Booking rejection error:', error);
    } finally {
      clearTimeout(timeoutId);
      setRejectingId(null);
      const endedAt = performance.now();
      console.log('handleReject duration(ms):', Math.round(endedAt - startedAt));
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
      <div className="px-6 pt-4 pb-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header & Filters Card */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
            <div className="header border-b border-gray-200/50 px-6 py-4">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Quản lý đặt phòng</h1>
              </div>
            </div>

            <div className="bg-white px-6 py-4">
              <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="flex-1 min-w-0 w-full">
                  <Input
                    placeholder="Tìm kiếm đặt phòng..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border-gray-300 rounded-xl focus:ring-0 focus:border-gray-300"
                  />
                </div>
                <div className="w-full lg:w-48 flex-shrink-0 relative rounded-xl border border-gray-300 bg-white overflow-hidden">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    {statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Success/Error Messages */}
          {flash && (
            <div className={`py-2.5 rounded-xl px-4 border shadow-sm animate-fade-in flex items-center gap-2 ${
              flash.type === 'success' ? 'bg-green-50 text-green-800 border-green-100' : 'bg-red-50 text-red-800 border-red-100'
            }`}>
              <svg className={`w-5 h-5 ${flash.type === 'success' ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {flash.type === 'success' 
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                }
              </svg>
              <span className="text-sm font-medium">{flash.text}</span>
            </div>
          )}

          {/* Table Card */}
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Danh sách đặt phòng</h2>
                <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                  {filteredBookings.length} đặt phòng
                </span>
              </div>
            </CardHeader>
            <CardBody className="p-0">
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
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {(() => {
                                  const faceImageUrl = getUserFaceImage(booking.userId);
                                  return faceImageUrl ? (
                                    <img 
                                      src={faceImageUrl} 
                                      alt={booking.userName || `User #${booking.userId}`}
                                      className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 flex-shrink-0"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200 flex-shrink-0">
                                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                    </div>
                                  );
                                })()}
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-gray-900 mb-1">{booking.code}</div>
                                  <div className="text-sm text-gray-600">
                                    {getUserFullName(booking.userId) || booking.userName || `User #${booking.userId}`}
                                  </div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    {booking.roomName || booking.roomCode || `Room #${booking.roomId}`}
                                  </div>
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
                            
                            <div className="space-y-2 pt-2 border-t">
                              {/* Dòng 1: Các nút theo status */}
                              <div className="flex gap-2">
                                {booking.status === 'PENDING' && (
                                  <>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBooking(booking);
                                        setApprovalModalOpen(true);
                                      }}
                                      variant="primary"
                                      className="text-xs flex-1"
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
                                      className="text-xs flex-1"
                                    >
                                      Từ chối
                                    </Button>
                                  </>
                                )}
                                {booking.status === 'CHECKED_IN' && (
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
                                )}
                              </div>
                              {/* Dòng 2: Ảnh và Chi tiết */}
                              <div className="flex gap-2">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBooking(booking);
                                    if (booking.userId) fetchFaceImage(String(booking.userId));
                                    setFaceModalOpen(true);
                                  }}
                                  variant="secondary"
                                  className="text-xs flex-1"
                                >
                                  Ảnh
                                </Button>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBooking(booking);
                                    setDetailModalOpen(true);
                                  }}
                                  variant="secondary"
                                  className="text-xs flex-1"
                                >
                                  Chi tiết
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden lg:block">
                    <Table className="table-fixed w-full">
                      <THead>
                        <tr>
                          <th className="px-2 py-3 text-center text-sm font-bold w-[10%]">Mã Booking</th>
                          <th className="px-2 py-3 text-left text-sm font-bold w-[20%]">Người đặt phòng</th>
                          <th className="px-2 py-3 text-center text-sm font-bold w-[12%]">Phòng Đặt</th>
                          <th className="px-2 py-3 text-center text-sm font-bold w-[20%]">Thời gian</th>
                          <th className="px-2 py-3 text-center text-sm font-bold w-[13%]">Trạng thái</th>
                          <th className="px-2 py-3 text-center text-sm font-bold w-[20%]">Thao tác</th>
                        </tr>
                      </THead>
                      <TBody>
                          {filteredBookings.map((booking, index) => {
                            const faceImageUrl = getUserFaceImage(booking.userId);
                            return (
                              <tr key={booking.id} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:bg-[#f2f8fe]`}>
                                <td className="px-2 py-3 font-medium text-center text-gray-900 break-words line-clamp-2" title={booking.code}>{booking.code}</td>
                                <td className="px-2 py-3 text-left text-gray-700">
                                  <div className="flex items-start gap-2">
                                    {faceImageUrl ? (
                                      <img 
                                        src={faceImageUrl} 
                                        alt={getUserFullName(booking.userId) || booking.userName || `User #${booking.userId}`}
                                        className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 flex-shrink-0 mt-0.5"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-[hsl(var(--primary)/0.12)] flex items-center justify-center border-2 border-gray-200 flex-shrink-0 mt-0.5">
                                        <svg className="w-4 h-4 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                      </div>
                                    )}
                                    <span className="break-words line-clamp-2 flex-1 min-w-0" title={getUserFullName(booking.userId) || booking.userName || `User #${booking.userId}`}>{getUserFullName(booking.userId) || booking.userName || `User #${booking.userId}`}</span>
                                  </div>
                                </td>
                                <td className="px-2 py-3 text-center text-gray-700 font-semibold break-words line-clamp-2" title={booking.roomName || booking.roomCode || `Room #${booking.roomId}`}>{booking.roomName || booking.roomCode || `Room #${booking.roomId}`}</td>
                                <td className="px-2 py-3 text-center text-gray-700 text-sm" title={`Check-in: ${booking.checkinDate ? formatDate(booking.checkinDate) : booking.checkinDate} - Check-out: ${booking.checkoutDate ? formatDate(booking.checkoutDate) : booking.checkoutDate}`}>
                                  <div className="break-words">
                                    <span className="text-gray-500 font-medium">Check-in:</span>{" "}
                                    <span className="break-words">{booking.checkinDate ? formatDate(booking.checkinDate) : booking.checkinDate}</span>
                                  </div>
                                  <div className="break-words">
                                    <span className="text-gray-500 font-medium">Check-out:</span>{" "}
                                    <span className="break-words">{booking.checkoutDate ? formatDate(booking.checkoutDate) : booking.checkoutDate}</span>
                                  </div>
                                </td>
                                <td className="px-2 py-3 text-center">
                                  {getStatusBadge(booking.status)}
                                </td>
                                <td className="px-2 py-3 text-center">
                                  <div className="flex flex-col gap-1 items-center">
                                    {/* Dòng 1: Các nút theo status */}
                                    <div className="flex gap-1 flex-wrap justify-center">
                                      {booking.status === 'PENDING' && (
                                        <>
                                          <Button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedBooking(booking);
                                              setApprovalModalOpen(true);
                                            }}
                                            variant="primary"
                                            className="text-xs px-1.5 py-0.5"
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
                                            className="text-xs px-1.5 py-0.5"
                                          >
                                            Từ chối
                                          </Button>
                                        </>
                                      )}
                                      {booking.status === 'CHECKED_IN' && (
                                        <Button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCheckout(booking);
                                          }}
                                          variant="secondary"
                                          className="text-xs px-1.5 py-0.5"
                                        >
                                          Check-out
                                        </Button>
                                      )}
                                    </div>
                                    {/* Dòng 2: Ảnh và Chi tiết */}
                                    <div className="flex gap-1 flex-wrap justify-center">
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedBooking(booking);
                                          if (booking.userId) fetchFaceImage(String(booking.userId));
                                          setFaceModalOpen(true);
                                        }}
                                        variant="secondary"
                                        className="text-xs px-1.5 py-0.5"
                                      >
                                        Ảnh
                                      </Button>
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedBooking(booking);
                                          setDetailModalOpen(true);
                                        }}
                                        variant="secondary"
                                        className="text-xs px-1.5 py-0.5"
                                      >
                                        Chi tiết
                                      </Button>
                                    </div>
                                  </div>
                                </td>
                            </tr>
                          );
                        })}
                      </TBody>
                    </Table>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={detailModalOpen} onClose={() => {
        setDetailModalOpen(false);
        setSelectedBooking(null);
      }} title="Chi tiết đặt phòng" size="lg">
        <div className="p-4 sm:p-6">
          {selectedBooking && (
            <div className="space-y-6">
              {/* Header với thông tin chính */}
              <div className="bg-gradient-to-r from-[hsl(var(--page-bg))] to-[hsl(var(--primary)/0.08)] rounded-xl p-4 sm:p-6 border border-[hsl(var(--primary)/0.25)]">
                <div className="space-y-4">
                  {/* Header với icon và status */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[hsl(var(--primary))] rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                          Mã đặt phòng {selectedBooking.code}
                        </h2>
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-full sm:w-auto">
                      {getStatusBadge(selectedBooking.status)}
                    </div>
                  </div>

                  {/* Thông tin nhanh */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                      <p className="text-sm sm:text-base font-semibold text-gray-700">
                        <span className="text-gray-600">ID:</span>{" "}
                        <span className="font-bold text-[hsl(var(--primary))]">{selectedBooking.id}</span>
                      </p>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                      <p className="text-sm sm:text-base font-semibold text-gray-700">
                        <span className="text-gray-600">Số khách:</span>{" "}
                        <span className="font-bold text-[hsl(var(--primary))]">{selectedBooking.numGuests}</span>
                      </p>
                    </div>
                  </div>

                  {/* Người đặt phòng và Phòng */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const faceImageUrl = getUserFaceImage(selectedBooking.userId);
                          return faceImageUrl ? (
                            <img 
                              src={faceImageUrl} 
                              alt={getUserFullName(selectedBooking.userId) || selectedBooking.userName || `User #${selectedBooking.userId}`}
                              className="w-16 h-16 rounded-full object-cover border-2 border-[hsl(var(--primary)/0.25)] flex-shrink-0"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-[hsl(var(--primary)/0.12)] flex items-center justify-center border-2 border-[hsl(var(--primary)/0.25)] flex-shrink-0">
                              <svg className="w-8 h-8 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          );
                        })()}
                        <div className="min-w-0">
                          <p className="text-xs text-gray-600 mb-1">Người đặt phòng:</p>
                          <p className="text-sm sm:text-base font-bold text-[hsl(var(--primary))] break-words">
                            {getUserFullName(selectedBooking.userId) || selectedBooking.userName || `User #${selectedBooking.userId}`}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                      <p className="text-sm sm:text-base font-semibold text-gray-700 break-words leading-relaxed">
                        <span className="text-gray-600">Phòng:</span>{" "}
                        <span className="font-bold text-[hsl(var(--primary))]">{selectedBooking.roomName || selectedBooking.roomCode || `Room #${selectedBooking.roomId}`}</span>
                      </p>
                    </div>
                  </div>

                  {/* Thời gian */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                      <p className="text-sm sm:text-base font-semibold text-gray-700">
                        <span className="text-gray-600">Check-in:</span>{" "}
                        <span className="font-bold text-[hsl(var(--primary))]">{selectedBooking.checkinDate ? formatDate(selectedBooking.checkinDate) : selectedBooking.checkinDate}</span>
                      </p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-[hsl(var(--primary)/0.25)]">
                      <p className="text-sm sm:text-base font-semibold text-gray-700">
                        <span className="text-gray-600">Check-out:</span>{" "}
                        <span className="font-bold text-[hsl(var(--primary))]">{selectedBooking.checkoutDate ? formatDate(selectedBooking.checkoutDate) : selectedBooking.checkoutDate}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {selectedBooking.note && (
                <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-gray-200">
                  <p className="text-sm text-gray-800 whitespace-pre-line">
                    <span className="font-semibold text-gray-600">Ghi chú:</span>{" "}
                    {selectedBooking.note}
                  </p>
                </div>
              )}

              {(selectedBooking.created_at || selectedBooking.updated_at) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {selectedBooking.created_at && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-gray-200">
                      <div className="text-xs sm:text-sm font-semibold text-gray-500 mb-1">Ngày tạo</div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDateTime(selectedBooking.created_at)}
                      </p>
                    </div>
                  )}
                  {selectedBooking.updated_at && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-gray-200">
                      <div className="text-xs sm:text-sm font-semibold text-gray-500 mb-1">Cập nhật gần nhất</div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDateTime(selectedBooking.updated_at)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

    


      {/* Face Images Modal */}
      <Modal open={faceModalOpen} onClose={() => setFaceModalOpen(false)} title="Ảnh nhận dạng khuôn mặt" size="md">
        <div className="p-0 max-h-[calc(100vh-8rem)] flex flex-col">
          {selectedBooking && (
            <div className="space-y-0 flex flex-col flex-1 min-h-0">
              {/* Header Section */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 border-b border-gray-200 flex-shrink-0">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-0.5">
                    Người đặt phòng: {getUserFullName(selectedBooking.userId) || selectedBooking.userName || `User #${selectedBooking.userId}`}
                  </h3>
                  <div className="text-xs text-gray-700">
                    <span className="font-medium">Mã đặt phòng:</span>
                    <span className="text-gray-900 font-semibold ml-1">{selectedBooking.code}</span>
                  </div>
                </div>
              </div>

              {/* Images Section */}
              <div className="p-3 bg-gray-50 flex-1 min-h-0 flex items-center justify-center">
                {(() => {
                  const uid = String(selectedBooking.userId);
                  const images = faceImages[uid];

                  // Helper function to get label for each image based on index
                  const getImageLabel = (index: number): string => {
                    const labels = ['Chính diện', 'Trái', 'Phải', 'CCCD trước', 'CCCD sau'];
                    return labels[index] || `Ảnh ${index + 1}`;
                  };

                  // Loading state
                  if (loadingFaces[uid]) {
                    return (
                      <div className="flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                        <p className="text-gray-700 font-semibold text-sm mb-0.5">Đang tải ảnh...</p>
                        <p className="text-xs text-gray-500">Vui lòng đợi</p>
                      </div>
                    );
                  }

                  if (Array.isArray(images) && images.length > 0) {
                    const currentImage = images[currentImageIndex];
                    const currentLabel = getImageLabel(currentImageIndex);
                    const hasPrev = currentImageIndex > 0;
                    const hasNext = currentImageIndex < images.length - 1;

                    return (
                      <div className="w-full max-w-md mx-auto">
                        {/* Main Image Container */}
                        <div className="relative w-full">
                          {/* Previous Button */}
                          {hasPrev && (
                            <button
                              onClick={() => setCurrentImageIndex(prev => Math.max(0, prev - 1))}
                              className="absolute left-1 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 hover:text-blue-600 p-1.5 rounded-full shadow-lg transition-all z-10"
                              aria-label="Ảnh trước"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                          )}

                          {/* Image */}
                          <div className="bg-white rounded-lg overflow-hidden shadow-md">
                            <div className="relative bg-gray-100" style={{ maxHeight: '50vh', minHeight: '300px' }}>
                              <img
                                src={currentImage}
                                alt={`${currentLabel} - ${selectedBooking.userName || `User #${selectedBooking.userId}`}`}
                                className="w-full h-full object-contain"
                                style={{ maxHeight: '50vh' }}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = `
                                      <div class="w-full h-full flex items-center justify-center bg-gray-100" style="min-height: 300px;">
                                        <svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                      </div>
                                    `;
                                  }
                                }}
                              />
                            </div>
                            {/* Label */}
                            <div className="px-3 py-2 bg-gray-50 text-center">
                              <p className="text-xs font-semibold text-gray-800">
                                {currentLabel}
                              </p>
                              <p className="text-xs text-gray-500">
                                {currentImageIndex + 1} / {images.length}
                              </p>
                            </div>
                          </div>

                          {/* Next Button */}
                          {hasNext && (
                            <button
                              onClick={() => setCurrentImageIndex(prev => Math.min(images.length - 1, prev + 1))}
                              className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 hover:text-blue-600 p-1.5 rounded-full shadow-lg transition-all z-10"
                              aria-label="Ảnh tiếp theo"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">Không có ảnh nhận dạng</p>
                      <p className="text-xs text-gray-500 text-center max-w-xs">Người đặt phòng này chưa có ảnh nhận dạng khuôn mặt trong hệ thống</p>
                    </div>
                  );
                })()}
              </div>
              
              {/* Footer */}
              <div className="bg-white px-4 py-2 border-t border-gray-200 flex justify-end flex-shrink-0">
                <Button 
                  variant="secondary"
                  onClick={() => setFaceModalOpen(false)}
                  className="px-4 py-1.5 text-xs h-8"
                >
                  Đóng
                </Button>
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
                <div><span className="font-medium">Người đặt:</span> {getUserFullName(selectedBooking.userId) || selectedBooking.userName || `User #${selectedBooking.userId}`}</div>
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
