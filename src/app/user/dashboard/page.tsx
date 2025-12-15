"use client";

import { useState, useEffect, Suspense, useMemo, useRef } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { createBookingNotification } from "@/lib/notifications";
import { useAvailableRooms, useUserBookings, useServiceOrders, useServices, useStaffUsers, useRoomTypes } from "@/hooks/useApi";
import { useRouter, useSearchParams } from "next/navigation";
import { authService } from "@/lib/auth-service";
import { apiClient } from "@/lib/api-client";
import { getFaceStatus, deleteFace } from "@/lib/face-service";
import { getBookingQr } from "@/lib/qr-service";
import { generateBookingCode } from "@/lib/utils";
import QRCode from "qrcode";

type Room = {
  id: number;
  building: string;
  roomNumber: string;
  roomType: string | null;
  name?: string;
  floor?: number;
  capacity?: number;
  amenities: string[];
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  description: string;
};

type RoomBooking = {
  id: number;
  roomId: number;
  roomType: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  createdAt: string;
  purpose: string; // Mục đích sử dụng
  guestName: string;
  guestEmail: string;
  phoneNumber: string;
  building: string;
  roomNumber: string;
  rejectionReason?: string;
  confirmedAt?: string;
  originalStatus?: string; // Trạng thái gốc từ API (để track CHECKED_IN)
  userId?: number; // User ID để hiển thị trong QR
};

type ServiceOrder = {
  id: number;
  serviceName: string;
  serviceCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  orderDate: string;
  deliveryDate?: string;
  note?: string;
};

type Payment = {
  id: number;
  bookingId?: number;
  serviceOrderId?: number;
  description: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  dueDate: string;
  paidDate?: string;
  paymentMethod?: string;
};

const parseBookingNote = (note?: string) => {
  const defaultPurpose = 'Công tác để ở';
  if (!note) {
    return {
      purpose: defaultPurpose,
      guestName: undefined,
      guestEmail: undefined,
      phoneNumber: undefined,
    };
  }
  const lines = note.split('\n').map((l) => l.trim());
  let purpose = defaultPurpose;
  let guestName: string | undefined;
  let guestEmail: string | undefined;
  let phoneNumber: string | undefined;

  lines.forEach((line) => {
    const lower = line.toLowerCase();
    // Hỗ trợ cả format tiếng Anh và tiếng Việt
    if (lower.startsWith('mục đích:') || lower.startsWith('purpose:')) {
      const value = line.split(':').slice(1).join(':').trim();
      if (value) purpose = value;
    } else if (lower.startsWith('tên:') || lower.startsWith('guest:')) {
      const value = line.split(':').slice(1).join(':').trim();
      if (value) guestName = value;
    } else if (lower.startsWith('email:')) {
      const value = line.split(':').slice(1).join(':').trim();
      if (value) guestEmail = value;
    } else if (lower.startsWith('phone:') || lower.startsWith('số điện thoại:')) {
      const value = line.split(':').slice(1).join(':').trim();
      if (value) phoneNumber = value;
    }
  });

  return {
    purpose,
    guestName,
    guestEmail,
    phoneNumber,
  };
};

function UserPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Set user role in sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      let role = 'guest'; // default
      
      // Check sessionStorage first
      const storedRole = sessionStorage.getItem('userRole');
      if (storedRole) {
        role = storedRole;
      } else {
        // Check cookies
        const cookies = document.cookie.split(';');
        const roleCookie = cookies.find(cookie => cookie.trim().startsWith('role='));
        if (roleCookie) {
          role = roleCookie.split('=')[1];
        }
      }
      
      sessionStorage.setItem('userRole', role);
    }
  }, []);

  const [activeTab, setActiveTab] = useState<'rooms' | 'booking' | 'services' | 'payments' | 'history'>('rooms');
  
  // Tự động mở tab booking nếu có bookingId trong query
  useEffect(() => {
    const bookingId = searchParams.get('bookingId');
    if (bookingId) {
      setActiveTab('booking');
      // Xóa query parameter sau khi đã xử lý
      const url = new URL(window.location.href);
      url.searchParams.delete('bookingId');
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [searchParams, router]);
  const [loading, setLoading] = useState({ rooms: true, bookings: true, services: true });
  
  // Determine if user is lecturer
  const [isLecturer, setIsLecturer] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const role = sessionStorage.getItem('userRole') || 'guest';
      setIsLecturer(role === 'lecturer');
    }
  }, []);

  const { data: bookingsData, loading: bookingsLoading, error: bookingsError, refetch: refetchUserBookings } = useUserBookings();
  const { data: serviceOrdersData, loading: serviceOrdersLoading, error: serviceOrdersError, refetch: refetchServiceOrders } = useServiceOrders();
  const { data: servicesData, loading: servicesLoading } = useServices();
  const { data: staffUsersData, loading: staffUsersLoading } = useStaffUsers();

  // Memoize bookings to prevent unnecessary re-renders and API calls
  const bookings: RoomBooking[] = useMemo(() => {
    return (Array.isArray(bookingsData) ? bookingsData : []).map((booking: any) => {
      const parsed = parseBookingNote(booking.note);
      return {
        id: booking.id,
        roomId: booking.roomId,
        roomType: booking.roomTypeName || 'Phòng tiêu chuẩn',
        checkIn: booking.checkinDate,
        checkOut: booking.checkoutDate,
        guests: booking.numGuests,
        status:
          booking.status === 'APPROVED' || booking.status === 'CHECKED_IN'
            ? 'CONFIRMED'
            : booking.status === 'REJECTED' || booking.status === 'CANCELLED'
            ? 'REJECTED'
            : 'PENDING',
        createdAt: booking.createdDate || booking.created_at || new Date().toISOString(),
        purpose: parsed.purpose,
        guestName: booking.userName || parsed.guestName || 'N/A',
        guestEmail: booking.userEmail || parsed.guestEmail || 'N/A',
        phoneNumber: booking.phoneNumber || parsed.phoneNumber || 'N/A',
        building: booking.roomCode?.charAt(0) || 'A',
        roomNumber: booking.roomCode?.slice(1) || booking.roomId.toString(),
        originalStatus: booking.status, // Lưu trạng thái gốc để track CHECKED_IN
        userId: booking.userId, // Lưu user ID
      };
    });
  }, [bookingsData]);

  // Transform service orders from backend format
  const serviceOrders: ServiceOrder[] = ((serviceOrdersData as any) || []).map((order: any) => ({
    id: order.id,
    serviceName: order.serviceName || order.service_name || 'N/A',
    serviceCode: order.serviceCode || order.service_code || '',
    quantity: order.quantity || 1,
    unitPrice: order.unitPrice || order.unit_price || 0,
    totalPrice: order.totalPrice || order.total_price || 0,
    status: order.status || 'PENDING',
    orderDate: order.createdDate || order.created_at || new Date().toISOString(),
    deliveryDate: order.deliveryDate || order.delivery_date,
    note: order.note || '',
  }));
  
  // Bookings are now loaded from API via useBookings hook

  // Services are now loaded from API via useServices hook

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedBookingForCheckout, setSelectedBookingForCheckout] = useState<RoomBooking | null>(null);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutNote, setCheckoutNote] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bookingFormMessage, setBookingFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [serviceFormMessage, setServiceFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bookingErrors, setBookingErrors] = useState<Record<string, string>>({});
  const [serviceErrors, setServiceErrors] = useState<Record<string, string>>({});
  const phoneRegex = /^[0-9]{10}$/;
  const [roomsFilterFrom, setRoomsFilterFrom] = useState('');
  const [roomsFilterTo, setRoomsFilterTo] = useState('');

  // Default filters to today on first load
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = addDays(today, 1)
    setRoomsFilterFrom(today)
    setRoomsFilterTo(tomorrow)
  }, [])
  const [roomsFilterError, setRoomsFilterError] = useState<string | null>(null);

  const filterStartTime = roomsFilterFrom ? `${roomsFilterFrom}T00:00:00` : undefined;
  const filterEndTime = roomsFilterTo ? `${roomsFilterTo}T23:59:59` : undefined;

  const { data: roomsData, loading: roomsLoading, error: roomsError, refetch: refetchRooms } = useAvailableRooms(filterStartTime, filterEndTime);
  const { data: roomTypesData } = useRoomTypes();
  const [roomTypes, setRoomTypes] = useState<any[]>([]);

  // Sync roomTypes data
  useEffect(() => {
    if (Array.isArray(roomTypesData)) {
      setRoomTypes(roomTypesData as any[]);
    } else if (roomTypesData && Array.isArray((roomTypesData as any).data)) {
      setRoomTypes((roomTypesData as any).data);
    } else if (roomTypesData == null) {
      setRoomTypes([]);
    }
  }, [roomTypesData]);

  // Helper function to get room type name
  const getRoomTypeName = (roomTypeId: number | null | undefined) => {
    if (!roomTypeId) return null;
    const roomType = roomTypes.find(rt => Number(rt.id) === Number(roomTypeId));
    if (roomType && roomType.name && roomType.name.trim() !== '') {
      return roomType.name;
    }
    return null;
  };

  // Trạng thái khuôn mặt & QR theo từng booking
  const [faceStates, setFaceStates] = useState<Record<number, {
    loading: boolean;
    registered?: boolean;
    qrToken?: string | null;
    qrDataUrl?: string | null;
    qrImageUrl?: string | null; // URL ảnh QR từ backend
    error?: string | null;
  }>>({});
  
  // State cho QR code modal
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedQrData, setSelectedQrData] = useState<{
    qrDataUrl: string;
    bookingId: number;
    bookingData?: any;
  } | null>(null);
  
  // Track các booking đã hiển thị QR sau check-in (để tránh hiển thị lại)
  const [shownCheckInQr, setShownCheckInQr] = useState<Set<number>>(new Set());
  
  // Track processed bookings to prevent duplicate API calls
  const processedBookingsRef = useRef<Set<number>>(new Set());
  const loadingBookingsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    setLoading({ rooms: roomsLoading, bookings: bookingsLoading, services: serviceOrdersLoading })
  }, [roomsLoading, bookingsLoading, serviceOrdersLoading])

  // Transform API data to match component types (rooms)
  const rooms: Room[] = (Array.isArray(roomsData) ? roomsData : []).map((room: any) => {
    // Lấy capacity từ nhiều nguồn có thể: roomType.maxOccupancy, maxOccupancy, capacity, roomTypeMaxOccupancy
    // Chỉ lấy nếu có giá trị hợp lệ (không phải null, undefined, hoặc 0)
    const capacityCandidate = room.roomType?.maxOccupancy 
      || room.roomTypeMaxOccupancy 
      || room.maxOccupancy 
      || room.capacity;
    const capacity = (capacityCandidate && capacityCandidate > 0) ? capacityCandidate : undefined;
    
    // Lấy roomTypeName từ nhiều nguồn, nếu không có thì dùng roomTypeId để lookup từ roomTypes
    const roomTypeName = room.roomTypeName 
      || room.roomType?.name 
      || room.room_type_name 
      || room.room_type?.name 
      || (room.roomTypeId ? getRoomTypeName(room.roomTypeId) : null)
      || null;
    
    return {
      id: room.id,
      building: room.code?.charAt(0) || 'A',
      roomNumber: room.code?.slice(1) || room.id.toString(),
      roomType: roomTypeName,
      name: room.name,
      floor: room.floor,
      capacity: capacity,
      amenities: room.description ? room.description.split(',').map((a: string) => a.trim()) : ['WiFi', 'Điều hòa'],
      status: room.status === 'OUT_OF_SERVICE' ? 'MAINTENANCE' : room.status,
      description: room.description || `Phòng ${room.code}`,
    };
  });

  // Auto-hide success/error messages after a few seconds
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [flash]);

  // Form states for new booking
  const [newBooking, setNewBooking] = useState({
    checkIn: '',
    checkInTime: '12:00',
    checkOut: '',
    checkOutTime: '10:00',
    guests: 1,
    purpose: 'Công tác để ở',
    guestName: '',
    guestEmail: '',
    phoneNumber: ''
  });

  // Helpers for date handling
  const addDays = (dateStr: string, days: number) => {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }
  const todayStr = new Date().toISOString().slice(0, 10)
  const toISODateTime = (dateStr: string, timeStr?: string) => {
    const t = (timeStr && timeStr.length >= 4) ? timeStr : '00:00'
    const normalized = t.length === 5 ? `${t}:00` : t
    // Backend LocalDateTime mong đợi format ISO 8601: "2025-12-08T12:00:00"
    // Giữ nguyên thời gian local (không convert timezone) để backend nhận đúng giờ VN
    return `${dateStr}T${normalized}`
  }

  // Initialize booking form dates with today/tomorrow on first load
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = addDays(today, 1)
    setNewBooking(prev => ({
      ...prev,
      checkIn: prev.checkIn || today,
      checkOut: prev.checkOut || tomorrow,
      checkInTime: prev.checkInTime || '12:00',
      checkOutTime: prev.checkOutTime || '10:00', // Mặc định 10:00
    }))
  }, [])

  // Form states for new service order
  const [newServiceOrder, setNewServiceOrder] = useState({
    orderId: 0,
    serviceId: 0,
    serviceName: '',
    serviceCode: '',
    quantity: 1,
    unitPrice: 0,
    unitName: '',
    userName: '',
    userEmail: '',
    userPhone: '',
    note: '',
    staffId: 0, // ID nhân viên được chọn
    staffName: '' // Tên nhân viên được chọn
  });

  const handleCheckFaceStatus = async (bookingId: number) => {
    setFaceStates(prev => ({
      ...prev,
      [bookingId]: {
        ...prev[bookingId],
        loading: true,
        error: null
      }
    }));
    try {
      const result = await getFaceStatus(bookingId);
      const isRegistered = !!result?.registered;
      
      setFaceStates(prev => ({
        ...prev,
        [bookingId]: {
          ...prev[bookingId],
          loading: false,
          registered: isRegistered,
          // Không reset qrToken ở đây để user vẫn xem lại nếu đã tải trước đó
          error: null
        }
      }));

      // Nếu chưa có khuôn mặt, tự động chuyển đến trang đăng ký
      if (!isRegistered) {
        router.push(`/user/face-registration?bookingId=${bookingId}`);
      } else {
        // Nếu đã có khuôn mặt, hiển thị thông báo và có thể xóa/tạo mới
        setFlash({ 
          type: 'success', 
          text: 'Đã có khuôn mặt đã đăng ký. Bạn có thể xóa để tạo mới hoặc tiếp tục sử dụng.' 
        });
      }
    } catch (e) {
      setFaceStates(prev => ({
        ...prev,
        [bookingId]: {
          ...prev[bookingId],
          loading: false,
          error:
            e instanceof Error
              ? e.message
              : "Không thể kiểm tra trạng thái khuôn mặt. Vui lòng thử lại."
        }
      }));
      
      // Nếu lỗi, vẫn cho phép chuyển đến trang đăng ký
      const shouldRedirect = confirm('Không thể kiểm tra trạng thái. Bạn có muốn đăng ký khuôn mặt mới không?');
      if (shouldRedirect) {
        router.push(`/user/face-registration?bookingId=${bookingId}`);
      }
    }
  };

  const handleDeleteFace = async (bookingId: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa khuôn mặt đã đăng ký? Bạn sẽ cần đăng ký lại để sử dụng tính năng check-in bằng khuôn mặt.')) {
      return;
    }
    
    setFaceStates(prev => ({
      ...prev,
      [bookingId]: {
        ...prev[bookingId],
        loading: true,
        error: null
      }
    }));
    
    try {
      await deleteFace(bookingId);
      setFaceStates(prev => ({
        ...prev,
        [bookingId]: {
          ...prev[bookingId],
          loading: false,
          registered: false,
          qrToken: null,
          qrDataUrl: null,
          qrImageUrl: null,
          error: null
        }
      }));
      
      // Sau khi xóa thành công, hỏi có muốn đăng ký mới không
      const shouldRegister = confirm('Đã xóa khuôn mặt thành công. Bạn có muốn đăng ký khuôn mặt mới ngay bây giờ không?');
      if (shouldRegister) {
        router.push(`/user/face-registration?bookingId=${bookingId}`);
      } else {
        setFlash({ type: 'success', text: 'Đã xóa khuôn mặt thành công. Bạn có thể đăng ký lại bất cứ lúc nào.' });
      }
      
      refetchUserBookings();
    } catch (e) {
      setFaceStates(prev => ({
        ...prev,
        [bookingId]: {
          ...prev[bookingId],
          loading: false,
          error: e instanceof Error ? e.message : 'Không thể xóa khuôn mặt'
        }
      }));
      setFlash({ type: 'error', text: e instanceof Error ? e.message : 'Không thể xóa khuôn mặt' });
    }
  };

  const handleLoadQrForBooking = async (bookingId: number) => {
    setFaceStates(prev => ({
      ...prev,
      [bookingId]: {
        ...prev[bookingId],
        loading: true,
        error: null
      }
    }));
    try {
      // Đảm bảo đã có thông tin đã đăng ký khuôn mặt
      let current = faceStates[bookingId];
      if (!current || current.registered === undefined) {
        const result = await getFaceStatus(bookingId);
        current = { ...(current || {}), registered: !!result?.registered };
      }

      if (!current.registered) {
        setFaceStates(prev => ({
          ...prev,
          [bookingId]: {
            ...prev[bookingId],
            loading: false,
            error: "Bạn chưa đăng ký khuôn mặt cho đặt phòng này."
          }
        }));
        return;
      }

      const qr = await getBookingQr(bookingId);
      
      // Chỉ sử dụng qrImageUrl từ backend (Cloudinary), không generate từ token
      let qrImageUrl: string | null = null;
      
      if (qr.qrImageUrl) {
        // Chỉ lưu nếu có qrImageUrl từ backend
        qrImageUrl = qr.qrImageUrl;
      } else {
        // Nếu không có qrImageUrl, báo lỗi
        setFaceStates(prev => ({
          ...prev,
          [bookingId]: {
            ...prev[bookingId],
            loading: false,
            error: "Mã QR chưa được tạo. Vui lòng liên hệ quản trị viên."
          }
        }));
        return;
      }
      
      setFaceStates(prev => ({
        ...prev,
        [bookingId]: {
          ...prev[bookingId],
          loading: false,
          registered: true,
          qrToken: qr.token,
          qrDataUrl: qrImageUrl, // Dùng qrImageUrl làm qrDataUrl để hiển thị
          qrImageUrl: qrImageUrl,
          error: null
        }
      }));
    } catch (e) {
      setFaceStates(prev => ({
        ...prev,
        [bookingId]: {
          ...prev[bookingId],
          loading: false,
          error:
            e instanceof Error
              ? e.message
              : "Không thể lấy mã QR cho đặt phòng này. Vui lòng thử lại."
        }
      }));
    }
  };

  // Tự động kiểm tra trạng thái khuôn mặt và load QR code cho các booking đã confirmed
  // Use booking IDs instead of entire array to prevent unnecessary re-runs
  const confirmedBookingIds = useMemo(() => 
    bookings.filter(b => b.status === 'CONFIRMED').map(b => b.id),
    [bookings]
  );
  
  useEffect(() => {
    const autoLoadFaceAndQr = async () => {
      for (const bookingId of confirmedBookingIds) {
        // Skip if already processing or processed
        if (loadingBookingsRef.current.has(bookingId) || processedBookingsRef.current.has(bookingId)) {
          continue;
        }
        
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || booking.status !== 'CONFIRMED') continue;
        
        const faceState = faceStates[bookingId];
        
        // Nếu chưa có thông tin face state, kiểm tra trạng thái
        if (!faceState || faceState.registered === undefined) {
          loadingBookingsRef.current.add(bookingId);
          try {
            const result = await getFaceStatus(bookingId);
            const isRegistered = !!result?.registered;
            
            setFaceStates(prev => ({
              ...prev,
              [bookingId]: {
                ...prev[bookingId],
                registered: isRegistered,
                loading: false,
              }
            }));
            
            // Nếu đã đăng ký khuôn mặt, tự động load QR code
            if (isRegistered) {
              await handleLoadQrForBooking(bookingId);
            }
            
            processedBookingsRef.current.add(bookingId);
          } catch (e) {
            // Ignore errors, sẽ hiển thị khi user click button
            processedBookingsRef.current.add(bookingId); // Mark as processed even on error to prevent retry loops
          } finally {
            loadingBookingsRef.current.delete(bookingId);
          }
        } 
        // Nếu đã đăng ký khuôn mặt nhưng chưa có QR code, tự động load
        else if (faceState.registered && !faceState.qrDataUrl && !faceState.loading) {
          loadingBookingsRef.current.add(bookingId);
          try {
            await handleLoadQrForBooking(bookingId);
            processedBookingsRef.current.add(bookingId);
          } catch (e) {
            processedBookingsRef.current.add(bookingId);
          } finally {
            loadingBookingsRef.current.delete(bookingId);
          }
        } else {
          // Already processed
          processedBookingsRef.current.add(bookingId);
        }
      }
    };
    
    if (confirmedBookingIds.length > 0) {
      autoLoadFaceAndQr();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedBookingIds.join(',')]); // Use string of IDs instead of array

  // Tự động hiển thị QR code khi check-in thành công (status = CHECKED_IN)
  // Use checked-in booking IDs to prevent unnecessary re-runs
  const checkedInBookingIds = useMemo(() => 
    bookings.filter(b => b.originalStatus === 'CHECKED_IN').map(b => b.id),
    [bookings]
  );
  
  useEffect(() => {
    const handleCheckInSuccess = async () => {
      for (const bookingId of checkedInBookingIds) {
        // Skip if already shown
        if (shownCheckInQr.has(bookingId)) {
          continue;
        }
        
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || booking.originalStatus !== 'CHECKED_IN') continue;
        
        // Đánh dấu đã xử lý booking này
        setShownCheckInQr(prev => new Set(prev).add(bookingId));
        
        try {
          // Load QR code trực tiếp
          const qr = await getBookingQr(bookingId);
          
          // Chỉ sử dụng qrImageUrl từ backend (Cloudinary), không generate từ token
          if (qr.qrImageUrl) {
            // Cập nhật face state với QR code
            setFaceStates(prev => ({
              ...prev,
              [bookingId]: {
                ...prev[bookingId],
                loading: false,
                qrToken: qr.token,
                qrDataUrl: qr.qrImageUrl,
                qrImageUrl: qr.qrImageUrl,
                error: null
              }
            }));
            
            // Hiển thị modal QR với thông tin bookingID và userID
            setSelectedQrData({
              qrDataUrl: qr.qrImageUrl,
              bookingId: bookingId,
              bookingData: {
                ...booking,
                userId: booking.userId || qr.payload?.userId,
                bookingId: bookingId,
                roomType: booking.roomType,
                roomNumber: booking.roomNumber,
                guestName: booking.guestName,
                userName: booking.guestName
              }
            });
            setQrModalOpen(true);
            
            // Hiển thị thông báo thành công
            setFlash({ 
              type: 'success', 
              text: `Check-in thành công! Mã QR của bạn (Booking ID: ${bookingId}, User ID: ${booking.userId || qr.payload?.userId || 'N/A'})` 
            });
          }
        } catch (e) {
          console.error('Error loading QR after check-in:', e);
          // Nếu lỗi, vẫn đánh dấu đã xử lý để tránh retry liên tục
        }
      }
    };

    if (checkedInBookingIds.length > 0) {
      handleCheckInSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedInBookingIds.join(',')]); // Use string of IDs instead of array

  // Get user info from session and API for Service Order Modal
  useEffect(() => {
    const loadUserInfo = async () => {
      if (typeof window === 'undefined' || !serviceModalOpen) return;

      // Lấy email từ localStorage hoặc session
      const userEmail = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail') || '';
      const userName = localStorage.getItem('userName') || sessionStorage.getItem('userName') || '';

      // Nếu có email, fetch thông tin đầy đủ từ API
      if (userEmail) {
        try {
          const accessToken = authService.getAccessToken();
          const res = await fetch('/api/system/users?self=1', {
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            credentials: 'include'
          });

          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
            const found = list.find((u: any) => (u.email || '').toLowerCase() === userEmail.toLowerCase());

            if (found) {
              // Tìm thấy user trong database - dùng thông tin từ API
              setNewServiceOrder(prev => ({
                ...prev,
                userEmail: found.email || userEmail,
                userName: found.full_name || found.fullName || userName || userEmail,
                userPhone: found.phone_number || found.phoneNumber || ''
              }));
              return;
            }
          }
        } catch (error) {
          console.error('Error fetching user info:', error);
        }
      }

      // Fallback: dùng thông tin từ localStorage/sessionStorage
      setNewServiceOrder(prev => ({
        ...prev,
        userEmail,
        userName: userName || userEmail,
        userPhone: ''
      }));
    };

    loadUserInfo();
  }, [serviceModalOpen]);

  // Get user info from session and API for Booking Modal
  useEffect(() => {
    const loadUserInfoForBooking = async () => {
      if (typeof window === 'undefined' || !bookingModalOpen) return;

      // Lấy email từ localStorage hoặc session
      const userEmail = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail') || '';
      const userName = localStorage.getItem('userName') || sessionStorage.getItem('userName') || '';

      // Nếu có email, fetch thông tin đầy đủ từ API
      if (userEmail) {
        try {
          const accessToken = authService.getAccessToken();
          const res = await fetch('/api/system/users?self=1', {
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            credentials: 'include'
          });

          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
            const found = list.find((u: any) => (u.email || '').toLowerCase() === userEmail.toLowerCase());

            if (found) {
              // Tìm thấy user trong database - dùng thông tin từ API
              setNewBooking(prev => ({
                ...prev,
                guestEmail: found.email || userEmail,
                guestName: found.full_name || found.fullName || userName || userEmail,
                phoneNumber: found.phone_number || found.phoneNumber || ''
              }));
              return;
            }
          }
        } catch (error) {
          console.error('Error fetching user info for booking:', error);
        }
      }

      // Fallback: dùng thông tin từ localStorage/sessionStorage
      setNewBooking(prev => ({
        ...prev,
        guestEmail: userEmail,
        guestName: userName || userEmail,
        phoneNumber: ''
      }));
    };

    loadUserInfoForBooking();
  }, [bookingModalOpen]);

  // Form states for payment
  const [paymentData, setPaymentData] = useState({
    method: '',
    amount: 0
  });

  const handleCreateBooking = async () => {
    const nextErrors: Record<string, string> = {}
    if (!selectedRoom) {
      nextErrors.room = 'Vui lòng chọn phòng'
    }
    // Validate thông tin khách hàng (sẽ được thêm vào note)
    if (!newBooking.guestName.trim()) {
      nextErrors.guestName = 'Tên khách hàng bắt buộc'
    }
    if (!newBooking.guestEmail.trim()) {
      nextErrors.guestEmail = 'Email bắt buộc'
    }
    if (!newBooking.phoneNumber.trim()) {
      nextErrors.phoneNumber = 'Số điện thoại bắt buộc'
    } else if (!phoneRegex.test(newBooking.phoneNumber.trim())) {
      nextErrors.phoneNumber = 'Số điện thoại phải đúng 10 chữ số'
    }
    if (!newBooking.checkIn) {
      nextErrors.checkIn = 'Vui lòng chọn ngày check-in'
    }
    if (!newBooking.checkOut) {
      nextErrors.checkOut = 'Vui lòng chọn ngày check-out'
    }
    if (newBooking.checkIn && newBooking.checkOut) {
      const ci = new Date(toISODateTime(newBooking.checkIn, newBooking.checkInTime))
      const co = new Date(toISODateTime(newBooking.checkOut, newBooking.checkOutTime))
      if (!(ci < co)) {
        nextErrors.checkOut = 'Thời điểm trả phòng phải sau thời điểm nhận phòng'
      }
    }
    if (selectedRoom?.capacity && newBooking.guests > selectedRoom.capacity) {
      nextErrors.guests = `Tối đa ${selectedRoom.capacity} người`
    }
    setBookingErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setBookingFormMessage({ type: 'error', text: 'Vui lòng kiểm tra lại các trường bị đánh dấu.' })
      return
    }
    if (!selectedRoom) {
      return
    }

    try {
      // Format data to match API expectations (CreateBookingRequest)
      // API spec: { code, userId, roomId, checkinDate, checkoutDate, numGuests, note }
      const checkinDate = toISODateTime(newBooking.checkIn, newBooking.checkInTime);
      const checkoutDate = toISODateTime(newBooking.checkOut, newBooking.checkOutTime);
      const checkinDateFormatted = new Date(checkinDate).toLocaleString('vi-VN');
      const checkoutDateFormatted = new Date(checkoutDate).toLocaleString('vi-VN');
      
      // Format note với đầy đủ thông tin: Tên ở đầu, Note ở cuối
      const note = `Tên: ${newBooking.guestName}\nEmail: ${newBooking.guestEmail}\nPhone: ${newBooking.phoneNumber}\nSố lượng: ${newBooking.guests} người\nCheck in: ${checkinDateFormatted}\nCheck out: ${checkoutDateFormatted}\nMục đích: ${newBooking.purpose}`;
      
      // Lấy userId từ token (API route sẽ kiểm tra lại để đảm bảo an toàn)
      const accessToken = authService.getAccessToken();
      let userId: string | undefined = undefined;
      if (accessToken) {
        try {
          // Decode JWT để lấy userId
          const tokenParts = accessToken.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            if (payload.userId) {
              userId = String(payload.userId);
            }
          }
        } catch (e) {
          console.warn('Could not decode token for userId:', e);
        }
      }
      
      // Generate booking code
      const code = generateBookingCode();
      
      // Backend format: CreateBookingRequest { code: String, userId: String, roomId: Long, checkinDate: LocalDateTime, checkoutDate: LocalDateTime, numGuests: Integer, note: String }
      const bookingData = {
        code: code, // String
        userId: userId || '', // String - API route sẽ tự thêm từ token nếu để trống
        roomId: Number(selectedRoom.id), // Long (number)
        checkinDate: checkinDate, // LocalDateTime (ISO datetime string)
        checkoutDate: checkoutDate, // LocalDateTime (ISO datetime string)
        numGuests: Number(newBooking.guests), // Integer (number)
        note: note, // String
      };

      console.log('📤 Sending booking request (user dashboard) via Next API:', bookingData);
      const res = await fetch('/api/system/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(bookingData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        const errorMessage = err.error || err.message || `Lỗi ${res.status}: ${res.statusText}` || 'Có lỗi xảy ra khi đặt phòng';
        console.error('Booking creation failed:', { status: res.status, error: err });
        setBookingFormMessage({ type: 'error', text: errorMessage });
        setFlash({ type: 'error', text: `Đặt phòng thất bại: ${errorMessage}` });
        return;
      }

      const created = await res.json().catch(() => ({} as any));

      setFlash({ type: 'success', text: 'Gửi yêu cầu đặt phòng thành công! Hành chính sẽ xác nhận trong thời gian sớm nhất.' });
      setBookingFormMessage({ type: 'success', text: 'Đã gửi yêu cầu đặt phòng.' });
      setBookingErrors({});
      setBookingModalOpen(false);
      setSelectedRoom(null);
      setNewBooking({ 
        checkIn: '', 
        checkInTime: '12:00',
        checkOut: '', 
        checkOutTime: '10:00',
        guests: 1, 
        purpose: 'Công tác để ở',
        guestName: '',
        guestEmail: '',
        phoneNumber: ''
      });
      
      // Refresh data after successful booking
      await Promise.all([
        refetchRooms(),
        refetchUserBookings()
      ]);
      
      // Create notification
      createBookingNotification(
        (created as any)?.id || Date.now(),
        newBooking.guestName,
        `${selectedRoom.building} - ${selectedRoom.roomNumber}`,
        'PENDING'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.';
      console.error('Booking creation error:', error);
      setBookingFormMessage({ type: 'error', text: errorMessage });
      setFlash({ type: 'error', text: `Đặt phòng thất bại: ${errorMessage}` });
      setBookingErrors({});
    } finally {
      // Reset loading state if needed
    }
  };

  const handleCreateServiceOrder = async () => {
    // Validation
    const nextErrors: Record<string, string> = {}
    if (newServiceOrder.orderId <= 0) {
      nextErrors.orderId = 'Vui lòng nhập mã đơn hàng (orderId)'
    }
    if (newServiceOrder.serviceId <= 0) {
      nextErrors.serviceId = 'Vui lòng chọn dịch vụ'
    }
    if (newServiceOrder.quantity <= 0) {
      nextErrors.quantity = 'Số lượng phải lớn hơn 0'
    }
    if (!newServiceOrder.userName.trim()) {
      nextErrors.userName = 'Tên người đặt bắt buộc'
    }
    if (!newServiceOrder.userEmail.trim()) {
      nextErrors.userEmail = 'Email bắt buộc'
    }
    setServiceErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setServiceFormMessage({ type: 'error', text: 'Vui lòng kiểm tra lại các trường bị đánh dấu.' })
      return
    }

    try {
      const payload = {
        orderId: newServiceOrder.orderId,
        serviceId: newServiceOrder.serviceId,
        quantity: newServiceOrder.quantity
      };

      const accessToken = authService.getAccessToken();
      const res = await fetch(`/api/system/orders?action=addItem&orderId=${newServiceOrder.orderId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        setServiceModalOpen(false);
        setNewServiceOrder({
          orderId: 0,
          serviceId: 0,
          serviceName: '',
          serviceCode: '',
          quantity: 1,
          unitPrice: 0,
          unitName: '',
          userName: '',
          userEmail: '',
          userPhone: '',
          note: '',
          staffId: 0,
          staffName: ''
        });
        setFlash({ type: 'success', text: 'Đặt dịch vụ thành công!' });
        setServiceFormMessage({ type: 'success', text: 'Đã gửi yêu cầu dịch vụ.' });
        setServiceErrors({});
        
        // Refresh service orders data
        refetchServiceOrders();
        const totalPrice = newServiceOrder.unitPrice * newServiceOrder.quantity;
        if (totalPrice > 0) {
          try {
            const payRes = await fetch('/api/system/payments?action=create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: totalPrice, description: `Thanh toán dịch vụ: ${newServiceOrder.serviceName}` })
            })
            if (!payRes.ok) {
              const errText = await payRes.text()
              setFlash({ type: 'error', text: errText || 'Không thể tạo giao dịch thanh toán' })
            } else {
              setFlash({ type: 'success', text: 'Đã tạo giao dịch thanh toán cho dịch vụ' })
            }
          } catch (e) {
            setFlash({ type: 'error', text: 'Không thể tạo giao dịch thanh toán' })
          }
        }
      } else {
        const err = await res.text()
        setServiceFormMessage({ type: 'error', text: err || 'Có lỗi xảy ra khi đặt dịch vụ' });
      }
    } catch (error) {
      setServiceFormMessage({ type: 'error', text: 'Có lỗi xảy ra khi đặt dịch vụ' });
      console.error('Service order creation error:', error);
    }
  };

  const handleCheckout = async () => {
    if (!selectedBookingForCheckout) {
      setCheckoutError('Không có booking được chọn');
      return;
    }

    setCheckoutSubmitting(true);
    setCheckoutError(null);

    try {
      // Lấy userId từ token
      let userId: string | undefined = undefined;
      const accessToken = authService.getAccessToken();
      if (accessToken) {
        try {
          const tokenParts = accessToken.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            if (payload.userId) {
              userId = String(payload.userId);
            } else if (payload.sub) {
              userId = String(payload.sub);
            }
          }
        } catch (e) {
          console.warn('Could not decode token for userId:', e);
        }
      }

      // Gọi API checkout
      const response = await apiClient.checkoutBooking(selectedBookingForCheckout.id, userId);

      if (response.success) {
        setFlash({ type: 'success', text: 'Check-out thành công! Vui lòng trả chìa khóa tại bàn bảo vệ.' });
        setCheckoutModalOpen(false);
        setSelectedBookingForCheckout(null);
        setCheckoutNote("");
        // Refresh bookings
        await refetchUserBookings();
      } else {
        setCheckoutError(response.error || 'Không thể thực hiện check-out. Vui lòng thử lại.');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setCheckoutError(err.message || 'Có lỗi xảy ra khi thực hiện check-out. Vui lòng thử lại.');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentData.method || paymentData.amount <= 0) {
      setFlash({ type: 'error', text: 'Vui lòng điền đầy đủ thông tin thanh toán' });
      return;
    }

    if (selectedPayment) {
      try {
        const paymentDataToSend = {
          paymentId: selectedPayment.id,
          amount: paymentData.amount,
          method: paymentData.method,
          status: 'PAID',
          paidDate: new Date().toISOString()
        };

        // Payment API not available yet - simulate success
        setPaymentModalOpen(false);
        setSelectedPayment(null);
        setPaymentData({ method: '', amount: 0 });
        setFlash({ type: 'success', text: 'Thanh toán thành công!' });
      } catch (error) {
        setFlash({ type: 'error', text: 'Có lỗi xảy ra khi thanh toán' });
        console.error('Payment error:', error);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge tone="warning">Chờ xử lý</Badge>;
      case 'CONFIRMED':
        return <Badge tone="success">Đã xác nhận</Badge>;
      case 'CANCELLED':
        return <Badge tone="error">Đã hủy</Badge>;
      case 'COMPLETED':
        return <Badge tone="success">Hoàn thành</Badge>;
      case 'PAID':
        return <Badge tone="success">Đã thanh toán</Badge>;
      case 'OVERDUE':
        return <Badge tone="error">Quá hạn</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter(b => b.status === 'CONFIRMED').length;
  const totalServiceOrders = serviceOrders.length;
  const completedServiceOrders = serviceOrders.filter(so => so.status === 'COMPLETED').length;
  // Payments functionality temporarily disabled
  const totalPayments = 0;
  const paidPayments = 0;
  const pendingPayments = 0;
  const overduePayments = 0;

  // Dữ liệu bookings của user (chỉ dùng để hiển thị lịch sử/QR), không còn dùng để chặn phòng
  const allBookingsRaw: any[] = Array.isArray(bookingsData) 
    ? (bookingsData as any[]) 
    : (bookingsData && typeof bookingsData === 'object' && Array.isArray((bookingsData as any).items))
      ? (bookingsData as any).items
      : [];
  const relevantStatusesForAvailability: string[] = [];

  const isMaintenanceRoom = (room: Room): boolean => {
    if (['MAINTENANCE', 'OUT_OF_SERVICE'].includes(room.status)) return true;
    return (room.amenities || []).some(a => a.toLowerCase().includes('bảo trì'));
  };

  const fromStr = roomsFilterFrom || todayStr;
  const toStr = roomsFilterTo || todayStr;
  const rangeFrom = new Date(fromStr);
  const rangeTo = new Date(toStr);
  const rangeValid =
    !Number.isNaN(rangeFrom.getTime()) &&
    !Number.isNaN(rangeTo.getTime()) &&
    rangeTo.getTime() > rangeFrom.getTime();

  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const endOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

  const evaluateRoomState = (room: Room): 'available' | 'reserved' | 'unavailable' => {
    // Nếu phòng đang bảo trì / ngừng hoạt động thì luôn không khả dụng
    if (isMaintenanceRoom(room)) {
      return 'unavailable';
    }

    // Phòng đã được backend lọc sẵn theo status AVAILABLE và khoảng ngày => xem là available
    return 'available';
  };

  const filteredAvailableRooms = rooms
    .filter(r => !['MAINTENANCE', 'OUT_OF_SERVICE'].includes(r.status))
    .filter(room => evaluateRoomState(room) === 'available');

  const reservedRooms = rooms
    .filter(r => !['MAINTENANCE', 'OUT_OF_SERVICE'].includes(r.status))
    .filter(room => evaluateRoomState(room) === 'reserved');

  // Phòng đang bảo trì / ngừng hoạt động vẫn hiển thị nhưng không cho đặt
  const maintenanceRooms = rooms.filter(r => ['MAINTENANCE', 'OUT_OF_SERVICE'].includes(r.status));

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-transparent shadow-sm px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                    {isLecturer ? 'Giảng viên' : 'Khách hàng'}
                  </h1>
                  <p className="text-sm lg:text-base text-gray-600 mt-1">
                    {isLecturer ? 'Quản lý đặt phòng và dịch vụ cho giảng viên' : 'Quản lý đặt phòng và dịch vụ'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="space-y-6">
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

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="border border-gray-200 shadow-md bg-white hover:shadow-lg transition-shadow rounded-xl">
              <CardBody className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Tổng đặt phòng</p>
                    <p className="text-2xl sm:text-3xl font-bold text-blue-500">{totalBookings}</p>
                    <p className="text-xs text-gray-500 mt-1 truncate">{confirmedBookings} đã xác nhận</p>
                  </div>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-2">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>
                </div>
              </CardBody>
            </Card>
            <Card className="border border-gray-200 shadow-md bg-white hover:shadow-lg transition-shadow rounded-xl">
              <CardBody className="p-4 sm:p-6"> 
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Dịch vụ đã đặt</p>
                    <p className="text-2xl sm:text-3xl font-bold text-green-500">{totalServiceOrders}</p>
                    <p className="text-xs text-gray-500 mt-1 truncate">{completedServiceOrders} hoàn thành</p>
                  </div>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-2">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </CardBody>
            </Card>
            <Card className="border border-gray-200 shadow-md bg-white hover:shadow-lg transition-shadow rounded-xl">
              <CardBody className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Hóa đơn</p>
                    <p className="text-2xl sm:text-3xl font-bold text-purple-500">{totalPayments}</p>
                    <p className="text-xs text-gray-500 mt-1 truncate">{paidPayments} đã thanh toán</p>
                  </div>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-2">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
              </CardBody>
            </Card>
            <Card className="border border-gray-200 shadow-md bg-white hover:shadow-lg transition-shadow rounded-xl">
              <CardBody className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Chờ thanh toán</p>
                    <p className="text-2xl sm:text-3xl font-bold text-orange-500">{pendingPayments + overduePayments}</p>
                    <p className="text-xs text-gray-500 mt-1 truncate">{overduePayments} quá hạn</p>
                  </div>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-2">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 sm:p-2">
            <nav className="grid grid-cols-2 sm:flex sm:space-x-1 sm:space-x-2 gap-2 sm:gap-0" role="tablist" aria-label="User sections">
              <button
                onClick={() => setActiveTab('rooms')}
                className={`py-2 px-2 sm:py-3 sm:px-4 rounded-lg font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'rooms'
                    ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                role="tab"
                aria-selected={activeTab === 'rooms'}
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="hidden sm:inline">Tìm phòng</span>
                <span className="sm:hidden">Tìm phòng</span>
                <span className="ml-1 text-xs opacity-90">({rooms.filter(r => r.status === 'AVAILABLE').length})</span>
              </button>
              <button
                onClick={() => setActiveTab('booking')}
                className={`py-2 px-2 sm:py-3 sm:px-4 rounded-lg font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'booking'
                    ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                role="tab"
                aria-selected={activeTab === 'booking'}
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Đặt phòng</span>
                <span className="sm:hidden">Đặt phòng</span>
                <span className="ml-1 text-xs opacity-90">({totalBookings})</span>
              </button>
              <button
                onClick={() => setActiveTab('services')}
                className={`py-2 px-2 sm:py-3 sm:px-4 rounded-lg font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'services'
                    ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                role="tab"
                aria-selected={activeTab === 'services'}
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Dịch vụ</span>
                <span className="sm:hidden">Dịch vụ</span>
                <span className="ml-1 text-xs opacity-90">({totalServiceOrders})</span>
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`py-2 px-2 sm:py-3 sm:px-4 rounded-lg font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'payments'
                    ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                role="tab"
                aria-selected={activeTab === 'payments'}
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Hóa đơn</span>
                <span className="sm:hidden">Hóa đơn</span>
                <span className="ml-1 text-xs opacity-90">({totalPayments})</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-2 px-2 sm:py-3 sm:px-4 rounded-lg font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap col-span-2 sm:col-span-1 ${
                  activeTab === 'history'
                    ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                role="tab"
                aria-selected={activeTab === 'history'}
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden sm:inline">Lịch sử</span>
                <span className="sm:hidden">Lịch sử</span>
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'rooms' && (
            <div className="space-y-4">
              {loading.rooms ? (
                <Card>
                  <CardBody>
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="h-24 bg-gray-200 rounded"></div>
                        <div className="h-24 bg-gray-200 rounded"></div>
                        <div className="h-24 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ) : (
                <Card>
                  <CardBody className="space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">Phòng có sẵn</h2>
                        <p className="text-sm text-gray-600">
                          Chọn khoảng thời gian để kiểm tra phòng trống và phòng đang giữ chỗ
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="success">Trống: {filteredAvailableRooms.length}</Badge>
                        <Badge tone="warning">Giữ chỗ: {reservedRooms.length}</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Từ ngày
                        </label>
                        <Input
                          type="date"
                          min={new Date().toISOString().slice(0,10)}
                          value={roomsFilterFrom}
                          onChange={(e) => {
                            const todayStr = new Date().toISOString().slice(0,10);
                            let v = e.target.value;
                            if (!v || v < todayStr) v = todayStr; // không cho chọn ngày đã qua
                            // nếu To rỗng hoặc <= From, tự set To = From + 1
                            const nextDay = (() => { const d = new Date(v); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })();
                            setRoomsFilterFrom(v);
                            if (!roomsFilterTo || roomsFilterTo <= v) {
                              setRoomsFilterTo(nextDay);
                            }
                            setRoomsFilterError(null);
                          }}
                          className="text-xs sm:text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Đến ngày
                        </label>
                        <Input
                          type="date"
                          min={new Date().toISOString().slice(0,10)}
                          value={roomsFilterTo}
                          onChange={(e) => {
                            const todayStr = new Date().toISOString().slice(0,10);
                            let to = e.target.value;
                            if (!to || to < todayStr) to = todayStr; // không cho chọn ngày đã qua
                            // Nếu chọn Đến ngày là hôm nay: to = hôm nay + 1, from = hôm nay
                            if (to === todayStr) {
                              const next = (() => { const d = new Date(todayStr); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })();
                              setRoomsFilterFrom(todayStr);
                              setRoomsFilterTo(next);
                              setRoomsFilterError(null);
                              return;
                            }
                            // Nếu to <= from thì set to = from + 1
                            const from = roomsFilterFrom && roomsFilterFrom > todayStr ? roomsFilterFrom : (roomsFilterFrom || todayStr);
                            if (!from || to <= from) {
                              const next = (() => { const d = new Date(from); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })();
                              setRoomsFilterTo(next);
                            } else {
                              setRoomsFilterTo(to);
                            }
                            setRoomsFilterError(null);
                          }}
                          className="text-xs sm:text-sm"
                        />
                      </div>
                    </div>

                    {roomsFilterFrom && roomsFilterTo && !rangeValid && (
                      <p className="text-xs text-red-600">
                        Ngày <strong>Đến</strong> phải lớn hơn ngày <strong>Từ</strong>.
                      </p>
                    )}

                    <div className="space-y-4">
                      {filteredAvailableRooms.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                          <p className="text-sm text-gray-600">
                            Không có phòng trống trong khoảng thời gian này. Hãy thử chọn khoảng khác.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                          {filteredAvailableRooms.map((room) => {
                            const maintenanceFlag = isMaintenanceRoom(room);
                            return (
                            <div 
                              key={room.id} 
                              onClick={() => {
                                if (!maintenanceFlag) {
                                  setSelectedRoom(room);
                                  const today = new Date().toISOString().slice(0, 10)
                                  const from = roomsFilterFrom || today
                                  const to = addDays(from, 1) // Tự động set ngày trả = ngày nhận + 1
                                  setNewBooking(prev => ({
                                    ...prev,
                                    checkIn: from,
                                    checkOut: to,
                                    checkInTime: prev.checkInTime || '12:00',
                                    checkOutTime: '10:00', // Mặc định 10:00
                                  }))
                                  setBookingModalOpen(true);
                                }
                              }}
                              className={`group relative bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 ${
                                maintenanceFlag ? 'cursor-not-allowed' : 'cursor-pointer'
                              }`}
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
                                    <Badge tone={maintenanceFlag ? 'warning' : 'success'}>
                                      {maintenanceFlag ? 'Bảo trì' : 'Trống'}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="absolute bottom-3 left-3">
                                  <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1">
                                    <p className="text-white font-bold text-lg">{room.name || `${room.building}-${room.roomNumber}`}</p>
                                  </div>
                                </div>
                                <div className="absolute bottom-3 right-3">
                                  <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-lg px-3 py-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <p className="text-sm font-bold text-green-600">Miễn phí</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="relative p-5 space-y-4 bg-gradient-to-r from-blue-50/30 via-indigo-50/30 to-purple-50/30">
                                {/* Gradient Border Top */}
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50"></div>
                                {/* Layout 2 cột: Trái (Tên phòng, Dãy Tòa) - Phải (Tầng, Trạng thái) */}
                                <div className="grid grid-cols-2 gap-4">
                                  {/* Cột trái: Tên phòng và Dãy Tòa */}
                                  <div className="space-y-3">
                                    {room.name && (
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                          </svg>
                                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tên phòng</span>
                                        </div>
                                        <p className="text-lg font-semibold text-gray-900">{room.name}</p>
                                      </div>
                                    )}
                                    
                                    {room.roomType && (
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                          </svg>
                                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dãy Tòa</span>
                                        </div>
                                        <p className="text-lg font-semibold text-gray-900">{room.roomType}</p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Cột phải: Tầng và Trạng thái */}
                                  <div className="space-y-3">
                                    {room.floor !== undefined && room.floor !== null && (
                                      <div className="flex items-start gap-2">
                                        <div className="flex-shrink-0 mt-0.5">
                                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                                          </svg>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Tầng</p>
                                          <p className="text-base font-semibold text-gray-900">{room.floor}</p>
                                        </div>
                                      </div>
                                    )}
                                    <div className="flex items-start gap-2">
                                      <div className="flex-shrink-0 mt-0.5">
                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500">Trạng thái</p>
                                        <p className="text-base font-semibold text-gray-900">
                                          {room.status === 'AVAILABLE' ? 'Trống' : 
                                           room.status === 'OCCUPIED' ? 'Đang sử dụng' : 
                                           room.status === 'MAINTENANCE' ? 'Bảo trì' : room.status}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Mô tả - dưới cùng */}
                                {room.description && (
                                  <div className="pt-2 border-t border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 mb-1">Mô tả</p>
                                    <p className="text-sm text-gray-700 line-clamp-2">{room.description}</p>
                                  </div>
                                )}

                                {/* Button Đặt phòng */}
                                <div className="pt-3 border-t border-gray-100">
                                  <Button 
                                    onClick={(e) => {
                                      e.stopPropagation(); // Ngăn event bubble lên card
                                      if (!maintenanceFlag) {
                                        setSelectedRoom(room);
                                        const today = new Date().toISOString().slice(0, 10)
                                        const from = roomsFilterFrom || today
                                        const to = addDays(from, 1) // Tự động set ngày trả = ngày nhận + 1
                                        setNewBooking(prev => ({
                                          ...prev,
                                          checkIn: from,
                                          checkOut: to,
                                          checkInTime: prev.checkInTime || '12:00',
                                          checkOutTime: '10:00', // Mặc định 10:00
                                        }))
                                        setBookingModalOpen(true);
                                      }
                                    }}
                                    className={`w-full font-semibold py-2.5 shadow-md hover:shadow-lg transition-all duration-200 ${
                                      maintenanceFlag
                                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                        : 'bg-gray-700 hover:bg-gray-800 text-white transform hover:scale-[1.02]'
                                    }`}
                                    disabled={maintenanceFlag}
                                  >
                                    <span className="flex items-center justify-center gap-2">
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      {maintenanceFlag ? 'Tạm ngừng đặt' : 'Đặt phòng này'}
                                    </span>
                                  </Button>
                                </div>
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-br from-gray-600/0 to-gray-700/0 group-hover:from-gray-600/5 group-hover:to-gray-700/5 transition-opacity duration-300 pointer-events-none rounded-xl"></div>
                            </div>
                            )})}
                        </div>
                      )}
                    </div>

                    {reservedRooms.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900">Phòng đang được giữ chỗ</h3>
                          <span className="text-sm text-gray-500">{reservedRooms.length} phòng</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                          {reservedRooms.map((room) => (
                            <div
                              key={`reserved-${room.id}`}
                              className="relative bg-gray-100 rounded-xl border border-gray-200 overflow-hidden shadow-sm"
                            >
                              <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10"></div>
                              <div className="relative z-20 p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs text-gray-500 uppercase">Phòng</p>
                                    <p className="text-lg font-semibold text-gray-900">{room.name || `${room.building}-${room.roomNumber}`}</p>
                                  </div>
                                  <Badge tone="warning">Đang giữ chỗ</Badge>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-gray-500 mb-1">Dãy Tòa</p>
                                  <p className="text-sm font-semibold text-gray-800">{room.roomType}</p>
                                </div>
                                <p className="text-sm text-gray-600">
                                  Phòng này đang được giữ cho một yêu cầu đặt phòng chờ xử lý trong khoảng thời gian bạn chọn.
                                </p>
                                <Button disabled className="w-full justify-center bg-gray-300 text-gray-600 cursor-not-allowed">
                                  Đang giữ chỗ
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {maintenanceRooms.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900">Phòng đang bảo trì / ngừng hoạt động</h3>
                          <span className="text-sm text-gray-500">{maintenanceRooms.length} phòng</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                          {maintenanceRooms.map((room) => (
                            <div
                              key={`maintenance-${room.id}`}
                              className="relative bg-gray-100 rounded-xl border border-gray-200 overflow-hidden shadow-sm"
                            >
                              <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10"></div>
                              <div className="relative z-20 p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs text-gray-500 uppercase">Phòng</p>
                                    <p className="text-lg font-semibold text-gray-900">{room.name || `${room.building}-${room.roomNumber}`}</p>
                                  </div>
                                  <Badge tone="error">
                                    {room.status === 'MAINTENANCE' ? 'Bảo trì' : 'Ngừng hoạt động'}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-gray-500 mb-1">Dãy Tòa</p>
                                  <p className="text-sm font-semibold text-gray-800">{room.roomType}</p>
                                </div>
                                <p className="text-sm text-gray-600">
                                  Phòng này đang tạm thời không nhận đặt do {room.status === 'MAINTENANCE' ? 'bảo trì' : 'ngừng hoạt động'}.
                                </p>
                                <Button disabled className="w-full justify-center bg-gray-300 text-gray-600 cursor-not-allowed">
                                  Tạm ngừng đặt
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </CardBody>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'booking' && (
            <div className="space-y-4">
              {loading.bookings && (
                <Card>
                  <CardBody>
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-20 bg-gray-200 rounded"></div>
                      <div className="h-20 bg-gray-200 rounded"></div>
                    </div>
                  </CardBody>
                </Card>
              )}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Đặt phòng</h2>
                <Button onClick={() => setBookingModalOpen(true)} className="w-full sm:w-auto bg-gray-700 hover:bg-gray-800 text-white text-sm sm:text-base">
                  Đặt phòng mới
                </Button>
              </div>
              
              <div className="grid gap-3 sm:gap-4">
                {bookings.map((booking) => {
                  const faceState = faceStates[booking.id];
                  return (
                    <Card key={booking.id}>
                      <CardBody className="p-4 sm:p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                                Phòng {booking.roomType}
                              </h3>
                              {getStatusBadge(booking.status)}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600">
                              <div className="truncate"><span className="font-medium">Khách hàng:</span> <span className="truncate">{booking.guestName}</span></div>
                              <div className="truncate"><span className="font-medium">Email:</span> <span className="truncate">{booking.guestEmail}</span></div>
                              <div className="truncate"><span className="font-medium">SĐT:</span> {booking.phoneNumber}</div>
                              <div><span className="font-medium">Số khách:</span> {booking.guests}</div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600 mt-2">
                              <div><span className="font-medium">Tòa:</span> {booking.building}</div>
                              <div><span className="font-medium">Phòng:</span> {booking.roomNumber}</div>
                              <div className="truncate"><span className="font-medium">Check-in:</span> {booking.checkIn}</div>
                              <div className="truncate"><span className="font-medium">Check-out:</span> {booking.checkOut}</div>
                            </div>
                            <div className="mt-2 text-sm text-gray-600">
                              <span className="font-medium">Mục đích:</span> {booking.purpose}
                            </div>
                            <div className="mt-2 text-sm text-green-600 font-medium">
                              Miễn phí
                            </div>
                            <div className="text-sm text-gray-500 mt-2">
                              Đặt lúc: {new Date(booking.createdAt).toLocaleString('vi-VN')}
                            </div>

                            {booking.status === 'CONFIRMED' && (
                              <div className="mt-4 border-t pt-3">
                                {/* Face Status Info - Compact */}
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                      faceState?.loading
                                        ? 'bg-gray-400 animate-pulse'
                                        : faceState?.error
                                        ? 'bg-red-500'
                                        : faceState?.registered
                                        ? 'bg-green-500'
                                        : 'bg-yellow-500'
                                    }`}></div>
                                    <span className="text-xs text-gray-600">
                                      {faceState?.loading
                                        ? 'Đang kiểm tra...'
                                        : faceState?.error
                                        ? <span className="text-red-600">Lỗi</span>
                                        : faceState?.registered
                                        ? <span className="text-green-700 font-semibold">Đã đăng ký</span>
                                        : <span className="text-yellow-700">Chưa đăng ký</span>}
                                    </span>
                                  </div>
                                </div>

                                {/* Checkout Warning */}
                                {(() => { 
                                  const co = new Date(booking.checkOut);
                                  const diff = co.getTime() - Date.now();
                                  const oneDay = 12 * 60 * 60 * 1000;
                                  if (!Number.isNaN(co.getTime()) && diff <= oneDay) {
                                    return (
                                      <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <p className="text-xs text-yellow-800">⚠️ Sắp đến giờ trả phòng. Vui lòng chuẩn bị trả chìa khóa hoặc thực hiện Check-out trực tuyến.</p>
                                      </div>
                                    )
                                  }
                                  return null
                                })()}

                                {/* Action Buttons - Compact Design */}
                                <div className="flex flex-wrap items-center gap-2">
                                  {/* Check-out Button */}
                                  {(() => { 
                                    const co = new Date(booking.checkOut);
                                    const diff = co.getTime() - Date.now();
                                    const oneDay = 24 * 60 * 60 * 1000;
                                    if (booking.originalStatus === 'CHECKED_IN' || (!Number.isNaN(co.getTime()) && diff <= oneDay)) {
                                      return (
                                        <Button
                                          className="text-xs px-2 sm:px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white shadow-sm flex-1 sm:flex-initial min-w-[100px]"
                                          onClick={() => {
                                            setSelectedBookingForCheckout(booking);
                                            setCheckoutModalOpen(true);
                                            setCheckoutNote("");
                                            setCheckoutError(null);
                                          }}
                                        >
                                          <svg className="w-3.5 h-3.5 mr-1 sm:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                          </svg>
                                          <span className="hidden sm:inline">Check-out</span>
                                          <span className="sm:hidden">Out</span>
                                        </Button>
                                      )
                                    }
                                    return null
                                  })()}

                                  {/* Face Management Button */}
                                  <Button
                                    variant="secondary"
                                    className="text-xs px-2 sm:px-3 py-1.5 flex-1 sm:flex-initial min-w-[100px]"
                                    onClick={() =>
                                      router.push(`/user/face-registration?bookingId=${booking.id}`)
                                    }
                                  >
                                    <svg className="w-3.5 h-3.5 mr-1 sm:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span className="hidden sm:inline">Khuôn mặt</span>
                                    <span className="sm:hidden">Face</span>
                                  </Button>

                                  {/* QR Code Button */}
                                  <Button
                                    variant="secondary"
                                    className="text-xs px-2 sm:px-3 py-1.5 flex-1 sm:flex-initial min-w-[80px]"
                                    onClick={async () => {
                                      if (!faceState?.qrImageUrl) {
                                        await handleLoadQrForBooking(booking.id);
                                        setTimeout(() => {
                                          const updatedState = faceStates[booking.id];
                                          if (updatedState?.qrImageUrl) {
                                            setSelectedQrData({
                                              qrDataUrl: updatedState.qrImageUrl,
                                              bookingId: booking.id,
                                              bookingData: {
                                                ...booking,
                                                userId: booking.userId
                                              }
                                            });
                                            setQrModalOpen(true);
                                          }
                                        }, 100);
                                      } else {
                                        setSelectedQrData({
                                          qrDataUrl: faceState.qrImageUrl,
                                          bookingId: booking.id,
                                          bookingData: {
                                            ...booking,
                                            userId: booking.userId
                                          }
                                        });
                                        setQrModalOpen(true);
                                      }
                                    }}
                                    disabled={faceState?.loading || !faceState?.qrImageUrl}
                                  >
                                    <svg className="w-3.5 h-3.5 mr-1 sm:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 12h2a1 1 0 001-1v-2a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                    </svg>
                                    QR
                                  </Button>

                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-4">
              {loading.services && (
                <Card>
                  <CardBody>
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-20 bg-gray-200 rounded"></div>
                      <div className="h-20 bg-gray-200 rounded"></div>
                    </div>
                  </CardBody>
                </Card>
              )}
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Dịch vụ đã đặt</h2>
                <div className="flex gap-2">
                  <Button 
                    variant="secondary"
                    onClick={() => router.push('/user/orders')}
                  >
                    Xem tất cả
                  </Button>
                  <Button 
                    onClick={() => router.push('/user/services/create')} 
                    className="bg-gray-700 hover:bg-gray-800 text-white"
                  >
                    Đặt dịch vụ mới
                  </Button>
                </div>
              </div>

              {serviceOrders.length === 0 ? (
                <Card>
                  <CardBody>
                    <div className="text-center py-8 text-gray-500">
                      <p>Bạn chưa đặt dịch vụ nào</p>
                      <p className="text-sm mt-2">Nhấn "Đặt dịch vụ mới" để bắt đầu</p>
                    </div>
                  </CardBody>
                </Card>
              ) : (
                <>
                  <div className="grid gap-4">
                    {/* Chỉ hiển thị 5 orders gần nhất */}
                    {serviceOrders.slice(0, 5).map((order) => (
                      <Card key={order.id}>
                        <CardBody>
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {order.serviceName}
                                </h3>
                                {getStatusBadge(order.status)}
                              </div>
                              {order.note && (
                                <p className="text-sm text-gray-600 mb-2">{order.note}</p>
                              )}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-gray-600">
                                <div><span className="font-medium">Số lượng:</span> {order.quantity}</div>
                                <div><span className="font-medium">Đơn giá:</span> {order.unitPrice.toLocaleString()} VND</div>
                                <div><span className="font-medium">Tổng tiền:</span> <span className="text-green-600 font-semibold">{order.totalPrice.toLocaleString()} VND</span></div>
                              </div>

                              {/* Hiển thị thông tin nhân viên nếu có */}
                              {(order as any).staffName && (
                                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-blue-900">👤 Nhân viên thực hiện:</span>
                                    <span className="font-semibold text-blue-700">{(order as any).staffName}</span>
                                  </div>
                                </div>
                              )}

                              <div className="mt-2 text-sm text-gray-500">
                                Đặt lúc: {new Date(order.orderDate).toLocaleString('vi-VN')}
                              </div>
                              {order.deliveryDate && (
                                <div className="text-sm text-gray-500">
                                  Giao hàng: {new Date(order.deliveryDate).toLocaleString('vi-VN')}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                  {serviceOrders.length > 5 && (
                    <Card>
                      <CardBody>
                        <Button 
                          variant="secondary"
                          onClick={() => router.push('/user/orders')}
                          className="w-full"
                        >
                          Xem thêm {serviceOrders.length - 5} đơn hàng khác
                        </Button>
                      </CardBody>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Hóa đơn</h2>
              </div>
              
              <div className="text-center py-8 text-gray-500">
                <p>Chức năng thanh toán đang được phát triển</p>
              </div>
            </div>
          )}



          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Lịch sử hoạt động</h2>
              </div>
              <Card>
                <CardBody>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Chế độ</label>
                      <select 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onChange={(e) => {
                          const mode = e.target.value
                          const now = new Date()
                          if (mode === 'week') {
                            const start = new Date(now)
                            start.setDate(now.getDate() - 7)
                            ;(window as any).__historyFilter = { start: start.toISOString().slice(0,10), end: now.toISOString().slice(0,10) }
                          } else if (mode === 'month') {
                            const start = new Date(now.getFullYear(), now.getMonth(), 1)
                            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                            ;(window as any).__historyFilter = { start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) }
                          } else {
                            (window as any).__historyFilter = undefined
                          }
                        }}
                      >
                        <option value="all">Tất cả</option>
                        <option value="week">7 ngày qua</option>
                        <option value="month">Tháng này</option>
                      </select>
                    </div>
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader>
                  <h3 className="text-md font-semibold text-gray-900">Đặt phòng</h3>
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3">
                    {(() => {
                      const f = (window as any).__historyFilter
                      const list = !f ? bookings : bookings.filter(b => {
                        const d = (b.createdAt || b.checkIn || '').slice(0,10)
                        return (!f?.start || d >= f.start) && (!f?.end || d <= f.end)
                      })
                      if (list.length === 0) return <div className="text-sm text-gray-500">Chưa có đặt phòng nào</div>
                      return list.map(b => (
                        <div key={b.id} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium">{b.roomType}</span> • {b.building}-{b.roomNumber}
                            <div className="text-gray-500 text-xs">{b.checkIn} → {b.checkOut}</div>
                          </div>
                          {getStatusBadge(b.status)}
                        </div>
                      ))
                    })()}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader>
                  <h3 className="text-md font-semibold text-gray-900">Dịch vụ đã đặt</h3>
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3">
                    {(() => {
                      const f = (window as any).__historyFilter
                      const list = !f ? serviceOrders : (serviceOrders as any[]).filter((so: any) => {
                        const d = (so.orderDate || '').slice(0,10)
                        return (!f?.start || d >= f.start) && (!f?.end || d <= f.end)
                      })
                      if (list.length === 0) return <div className="text-sm text-gray-500">Chưa có dịch vụ nào</div>
                      return list.map((so: any) => (
                        <div key={so.id} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium">{so.serviceName}</span>
                            <div className="text-gray-500 text-xs">
                              {so.quantity} x {so.unitPrice?.toLocaleString?.() || 0} VND = {so.totalPrice?.toLocaleString?.() || 0} VND
                            </div>
                          </div>
                          {getStatusBadge(so.status)}
                        </div>
                      ))
                    })()}
                  </div>
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* New Booking Modal */}
      <Modal
        open={bookingModalOpen}
        onClose={() => {
          setBookingModalOpen(false);
          setSelectedRoom(null);
          setBookingFormMessage(null);
          setBookingErrors({});
        }}
        title="Đặt phòng mới"
        footer={
          <div className="flex justify-end gap-2">
            <Button 
              variant="secondary" 
              onClick={() => {
                setBookingModalOpen(false);
                setSelectedRoom(null);
                setBookingFormMessage(null);
                setBookingErrors({});
              }}
            >
              Hủy
            </Button>
            <Button onClick={handleCreateBooking} className="bg-gray-700 hover:bg-gray-800 text-white">
              Gửi yêu cầu đặt phòng
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {selectedRoom && (
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <h3 className="font-medium text-gray-900 mb-2">Thông tin phòng đã chọn</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="font-medium">Tên phòng:</span> {selectedRoom.name || `${selectedRoom.building} - ${selectedRoom.roomNumber}`}</div>
                <div><span className="font-medium">Loại:</span> {selectedRoom.roomType}</div>
                <div><span className="font-medium">Mô tả:</span> {selectedRoom.description || 'Không có mô tả'}</div>
                <div><span className="font-medium">Giá:</span> <span className="text-green-600 font-medium">Miễn phí</span></div>
              </div>
            </div>
          )}
          {bookingErrors.room && (
            <p className="text-sm text-red-600">{bookingErrors.room}</p>
          )}

          {/* Thông báo lỗi/thành công */}
          {bookingFormMessage && (
            <div
              className={`mb-3 rounded-md px-3 py-2 text-sm ${
                bookingFormMessage.type === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-green-50 border border-green-200 text-green-700'
              }`}
            >
              {bookingFormMessage.text}
            </div>
          )}

          {/* Thông tin khách hàng - Tự động điền từ user info và sẽ được thêm vào note */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">Thông tin khách hàng</h4>
              {newBooking.guestEmail && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Đã tự động điền
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên khách hàng <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="Nhập tên khách hàng"
                  value={newBooking.guestName}
                  onChange={(e) => setNewBooking(prev => ({ ...prev, guestName: e.target.value }))}
                  className={newBooking.guestName ? 'bg-green-50' : ''}
                />
                {newBooking.guestName && (
                  <p className="text-xs text-gray-500 mt-1">Thông tin này sẽ được thêm vào ghi chú đặt phòng</p>
                )}
                {bookingErrors.guestName && (
                  <p className="mt-1 text-xs text-red-600">{bookingErrors.guestName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  placeholder="Nhập email"
                  value={newBooking.guestEmail}
                  onChange={(e) => setNewBooking(prev => ({ ...prev, guestEmail: e.target.value }))}
                  className={newBooking.guestEmail ? 'bg-green-50' : ''}
                />
                {newBooking.guestEmail && (
                  <p className="text-xs text-gray-500 mt-1">Thông tin này sẽ được thêm vào ghi chú đặt phòng</p>
                )}
                {bookingErrors.guestEmail && (
                  <p className="mt-1 text-xs text-red-600">{bookingErrors.guestEmail}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <Input
                  type="tel"
                  placeholder="Nhập số điện thoại"
                  value={newBooking.phoneNumber}
                  onChange={(e) => setNewBooking(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  maxLength={10}
                  className={newBooking.phoneNumber ? 'bg-green-50' : ''}
                />
                {newBooking.phoneNumber && (
                  <p className="text-xs text-gray-500 mt-1">Thông tin này sẽ được thêm vào ghi chú đặt phòng</p>
                )}
                {bookingErrors.phoneNumber && (
                  <p className="mt-1 text-xs text-red-600">{bookingErrors.phoneNumber}</p>
                )}
              </div>
            </div>
          </div>

          {/* Thông tin đặt phòng */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Thông tin đặt phòng</h4>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ngày nhận phòng <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={newBooking.checkIn}
                    min={todayStr}
                    onChange={(e) => {
                      const v = e.target.value
                      // Tự động set ngày trả phòng = ngày nhận phòng + 1 ngày
                      const nextDay = addDays(v, 1)
                      setNewBooking(prev => ({ 
                        ...prev, 
                        checkIn: v,
                        checkOut: nextDay,
                        checkOutTime: '10:00' // Mặc định 10:00
                      }))
                    }}
                  />
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Giờ nhận phòng</label>
                    <Input
                      type="time"
                      value={newBooking.checkInTime}
                      onChange={(e) => setNewBooking(prev => ({ ...prev, checkInTime: e.target.value }))}
                    />
                  </div>
                {bookingErrors.checkIn && (
                  <p className="mt-1 text-xs text-red-600">{bookingErrors.checkIn}</p>
                )}
                </div>
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ngày trả phòng <span className="text-red-500">*</span>
                  </label>                  <Input
                    type="date"
                    value={newBooking.checkOut}
                    min={(newBooking.checkIn || todayStr)}
                    onChange={(e) => {
                      const today = new Date().toISOString().slice(0,10);
                      const from = newBooking.checkIn || today;
                      let to = e.target.value;
                      if (!to || to <= from) {
                        const d = new Date(from);
                        d.setDate(d.getDate() + 1);
                        to = d.toISOString().slice(0,10);
                      }
                      setNewBooking(prev => ({ ...prev, checkOut: to }));
                    }}
                  />
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Giờ trả phòng</label>
                    <Input
                      type="time"
                      value={newBooking.checkOutTime}
                      disabled
                      className="bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                {bookingErrors.checkOut && (
                  <p className="mt-1 text-xs text-red-600">{bookingErrors.checkOut}</p>
                )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số khách <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  max={selectedRoom?.capacity || 10}
                  value={newBooking.guests}
                  onChange={(e) => setNewBooking(prev => ({ ...prev, guests: parseInt(e.target.value) || 1 }))}
                />
                {selectedRoom && (
                  <p className="text-xs text-gray-500 mt-1">Tối đa {selectedRoom.capacity} người</p>
                )}
                {bookingErrors.guests && (
                  <p className="mt-1 text-xs text-red-600">{bookingErrors.guests}</p>
                )}
              </div>

              {/* Mục đích sử dụng - Ẩn, sử dụng giá trị mặc định */}
            </div>
          </div>
        </div>
      </Modal>

      {/* New Service Order Modal */}
      <Modal
        open={serviceModalOpen}
        onClose={() => {
          setServiceModalOpen(false);
          setServiceFormMessage(null);
          setServiceErrors({});
        }}
        title="Đặt dịch vụ mới"
        footer={
          <div className="flex justify-end gap-2">
            <Button 
              variant="secondary" 
              onClick={() => {
                setServiceModalOpen(false);
                setServiceFormMessage(null);
                setServiceErrors({});
              }}
            >
              Hủy
            </Button>
            <Button onClick={handleCreateServiceOrder} className="bg-gray-700 hover:bg-gray-800 text-white">
              Đặt dịch vụ
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {serviceFormMessage && (
            <div
              className={`rounded-md px-3 py-2 text-sm ${
                serviceFormMessage.type === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-green-50 border border-green-200 text-green-700'
              }`}
            >
              {serviceFormMessage.text}
            </div>
          )}
          {/* Mã đơn dịch vụ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mã đơn dịch vụ (orderId) *</label>
            <Input
              type="number"
              min="1"
              value={newServiceOrder.orderId}
              onChange={(e) => setNewServiceOrder(prev => ({ ...prev, orderId: parseInt(e.target.value) || 0 }))}
              placeholder="Nhập ID đơn dịch vụ đã có"
            />
            {serviceErrors.orderId && (
              <p className="mt-1 text-xs text-red-600">{serviceErrors.orderId}</p>
            )}
          </div>

          {/* Chọn dịch vụ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chọn dịch vụ *</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={newServiceOrder.serviceId}
              onChange={(e) => {
                const serviceId = parseInt(e.target.value);
                const service = (Array.isArray(servicesData) ? servicesData : []).find((s: any) => s.id === serviceId) as any;
                if (service) {
                  setNewServiceOrder(prev => ({
                    ...prev,
                    serviceId: service.id,
                    serviceName: service.name,
                    serviceCode: service.code,
                    unitPrice: service.unitPrice || 0,
                    unitName: service.unitName || 'lần'
                  }));
                }
              }}
            >
              <option value="0">-- Chọn dịch vụ --</option>
              {(Array.isArray(servicesData) ? servicesData : []).map((service: any) => (
                <option key={service.id} value={service.id}>
                  {service.name} - {service.unitPrice?.toLocaleString() || 0} VND/{service.unitName || 'lần'}
                </option>
              ))}
            </select>
            {serviceErrors.serviceId && (
              <p className="mt-1 text-xs text-red-600">{serviceErrors.serviceId}</p>
            )}
          </div>

          {/* Thông tin dịch vụ đã chọn */}
          {newServiceOrder.serviceId > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Thông tin dịch vụ</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-600">Tên:</div>
                <div className="font-medium">{newServiceOrder.serviceName}</div>
                <div className="text-gray-600">Mã:</div>
                <div className="font-medium">{newServiceOrder.serviceCode}</div>
                <div className="text-gray-600">Đơn giá:</div>
                <div className="font-medium text-green-600">{newServiceOrder.unitPrice.toLocaleString()} VND/{newServiceOrder.unitName}</div>
              </div>
            </div>
          )}

          {/* Số lượng */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng *</label>
            <Input
              type="number"
              min="1"
              value={newServiceOrder.quantity}
              onChange={(e) => setNewServiceOrder(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
            />
            {serviceErrors.quantity && (
              <p className="mt-1 text-xs text-red-600">{serviceErrors.quantity}</p>
            )}
          </div>

          {/* Tổng tiền */}
          {newServiceOrder.serviceId > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Tổng tiền:</span>
                <span className="text-lg font-bold text-green-600">
                  {(newServiceOrder.quantity * newServiceOrder.unitPrice).toLocaleString()} VND
                </span>
              </div>
            </div>
          )}

          {/* Chọn nhân viên thực hiện */}
          {newServiceOrder.serviceId > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Chọn nhân viên thực hiện</h4>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={newServiceOrder.staffId}
                onChange={(e) => {
                  const staffId = parseInt(e.target.value);
                  const staff = (Array.isArray(staffUsersData) ? staffUsersData : []).find((s: any) => s.id === staffId) as any;
                  if (staff) {
                    setNewServiceOrder(prev => ({
                      ...prev,
                      staffId: staff.id,
                      staffName: staff.name || staff.email
                    }));
                  } else {
                    setNewServiceOrder(prev => ({
                      ...prev,
                      staffId: 0,
                      staffName: ''
                    }));
                  }
                }}
              >
                <option value="0">-- Chọn nhân viên (tùy chọn) --</option>
                {(Array.isArray(staffUsersData) ? staffUsersData : []).map((staff: any) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name || staff.email} {staff.phone ? `- ${staff.phone}` : ''}
                  </option>
                ))}
              </select>
              {newServiceOrder.staffId > 0 && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <span className="text-blue-900">✓ Đã chọn: <strong>{newServiceOrder.staffName}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Thông tin người đặt */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">Thông tin người đặt</h4>
              {newServiceOrder.userEmail && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Đã tự động điền
                </span>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Họ tên <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={newServiceOrder.userName}
                  onChange={(e) => setNewServiceOrder(prev => ({ ...prev, userName: e.target.value }))}
                  placeholder="Nhập họ tên"
                  className={newServiceOrder.userName ? 'bg-green-50' : ''}
                />
                <p className="text-xs text-gray-500 mt-1">Bạn có thể chỉnh sửa nếu thông tin không chính xác</p>
                {serviceErrors.userName && (
                  <p className="mt-1 text-xs text-red-600">{serviceErrors.userName}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="email"
                    value={newServiceOrder.userEmail}
                    onChange={(e) => setNewServiceOrder(prev => ({ ...prev, userEmail: e.target.value }))}
                    placeholder="email@example.com"
                    className={newServiceOrder.userEmail ? 'bg-green-50' : ''}
                  />
                  {serviceErrors.userEmail && (
                    <p className="mt-1 text-xs text-red-600">{serviceErrors.userEmail}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                  <Input
                    type="tel"
                    value={newServiceOrder.userPhone}
                    onChange={(e) => setNewServiceOrder(prev => ({ ...prev, userPhone: e.target.value }))}
                    placeholder="0123456789"
                    className={newServiceOrder.userPhone ? 'bg-green-50' : ''}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  value={newServiceOrder.note}
                  onChange={(e) => setNewServiceOrder(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Ghi chú thêm (nếu có)"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Payment Modal */}
      <Modal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Thanh toán hóa đơn"
        footer={
          <div className="flex justify-end gap-2">
            <Button 
              variant="secondary" 
              onClick={() => setPaymentModalOpen(false)}
            >
              Hủy
            </Button>
            <Button onClick={handlePayment} className="bg-gray-700 hover:bg-gray-800 text-white">
              Thanh toán
            </Button>
          </div>
        }
      >
        {selectedPayment && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="font-medium text-gray-900 mb-2">Thông tin hóa đơn</h3>
              <p className="text-sm text-gray-600 mb-1">{selectedPayment.description}</p>
              <p className="text-lg font-semibold text-gray-900">
                Số tiền: {selectedPayment.amount.toLocaleString()} VND
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phương thức thanh toán *</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={paymentData.method}
                onChange={(e) => setPaymentData(prev => ({ ...prev, method: e.target.value }))}
              >
                <option value="">Chọn phương thức</option>
                <option value="Tiền mặt">Tiền mặt</option>
                <option value="Chuyển khoản">Chuyển khoản</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền thanh toán *</label>
              <Input
                type="number"
                min="0"
                value={paymentData.amount}
                onChange={(e) => setPaymentData(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Checkout Modal */}
      <Modal
        open={checkoutModalOpen}
        onClose={() => {
          setCheckoutModalOpen(false);
          setSelectedBookingForCheckout(null);
          setCheckoutNote("");
          setCheckoutError(null);
        }}
        title="Check-out phòng"
      >
        {selectedBookingForCheckout && (
          <div className="space-y-6">
            {/* Booking Info */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900 mb-2">Thông tin booking</p>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p><span className="font-medium">Phòng:</span> {selectedBookingForCheckout.roomType} - {selectedBookingForCheckout.roomNumber}</p>
                    <p><span className="font-medium">Check-in:</span> {new Date(selectedBookingForCheckout.checkIn).toLocaleString('vi-VN')}</p>
                    <p><span className="font-medium">Check-out:</span> {new Date(selectedBookingForCheckout.checkOut).toLocaleString('vi-VN')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-blue-900 mb-1">Thông tin quan trọng</p>
                  <p className="text-sm text-blue-800">
                    Sau khi gửi yêu cầu check-out, bạn sẽ cần trả chìa khóa tại bàn bảo vệ để hoàn tất thủ tục.
                  </p>
                </div>
              </div>
            </div>

            {/* Note Field */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Ghi chú (tùy chọn)
              </label>
              <textarea
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                rows={4}
                value={checkoutNote}
                onChange={(e) => setCheckoutNote(e.target.value)}
                placeholder="Ví dụ: Tình trạng phòng trước khi rời đi, số chìa khóa bàn giao, thời gian dự kiến trả chìa khóa..."
              />
            </div>

            {/* Error Message */}
            {checkoutError && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {checkoutError}
                </p>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-900 mb-2">📋 Hướng dẫn sau khi check-out:</p>
              <ul className="space-y-1 text-sm text-amber-800">
                {[
                  'Thu dọn đồ đạc và đảm bảo không bỏ quên tài sản cá nhân',
                  'Tắt các thiết bị điện, nước',
                  'Đóng cửa sổ, khóa cửa phòng',
                  'Trả chìa khóa tại bàn bảo vệ'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold mt-0.5">{idx + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={() => {
                  setCheckoutModalOpen(false);
                  setSelectedBookingForCheckout(null);
                  setCheckoutNote("");
                  setCheckoutError(null);
                }}
                className="flex items-center justify-center gap-2"
                disabled={checkoutSubmitting}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Hủy
              </Button>
              <Button
                onClick={handleCheckout}
                disabled={checkoutSubmitting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white shadow-md flex items-center justify-center gap-2 disabled:bg-gray-400"
              >
                {checkoutSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Xác nhận check-out
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* QR Code Modal */}
      <Modal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title="📱 Mã QR Check-in"
      >
        {selectedQrData && (
          <div className="space-y-6">
            <div className="text-center">
        
              {selectedQrData.bookingData && 
               selectedQrData.bookingId && 
               selectedQrData.bookingData.userId && 
               (selectedQrData.bookingData.roomType || selectedQrData.bookingData.roomName) && 
               selectedQrData.bookingData.roomNumber && 
               (selectedQrData.bookingData.guestName || selectedQrData.bookingData.userName) && (
                <div className="bg-gray-50 p-3 rounded-lg mb-4 text-left">
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Thông tin đặt phòng</p>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-gray-500">Booking ID:</p>
                        <p className="text-sm font-bold text-blue-600">{selectedQrData.bookingId}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">User ID:</p>
                        <p className="text-sm font-bold text-green-600">{selectedQrData.bookingData.userId}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-900">
                        Phòng {selectedQrData.bookingData.roomType || selectedQrData.bookingData.roomName} - {selectedQrData.bookingData.roomNumber}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {selectedQrData.bookingData.guestName || selectedQrData.bookingData.userName}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {selectedQrData.qrDataUrl && selectedQrData.qrDataUrl.startsWith('http') && (
              <div className="flex justify-center">
                <div className="bg-white p-6 rounded-lg border-2 border-blue-200 shadow-lg">
                  <img 
                    src={selectedQrData.qrDataUrl} 
                    alt="QR Code" 
                    className="w-64 h-64 object-contain"
                    onError={(e) => {
                      console.error('Error loading QR image:', e);
                      setFlash({ type: 'error', text: 'Không thể tải ảnh QR code' });
                    }}
                  />
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {selectedQrData.qrDataUrl && selectedQrData.qrDataUrl.startsWith('http') && (
                <Button
                  onClick={async () => {
                    if (selectedQrData.qrDataUrl) {
                      try {
                        // Download ảnh từ URL Cloudinary
                        const response = await fetch(selectedQrData.qrDataUrl);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `check-in-qr-${selectedQrData.bookingId}.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                      } catch (error) {
                        console.error('Error downloading QR:', error);
                        setFlash({ type: 'error', text: 'Không thể tải mã QR' });
                      }
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  ⬇️ Tải mã QR
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => setQrModalOpen(false)}
              >
                Đóng
              </Button>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800 font-semibold mb-1">💡 Hướng dẫn:</p>
              <ul className="text-xs text-blue-700 space-y-1 ml-4 list-disc">
                <li>Lưu hoặc chụp ảnh mã QR này</li>
                <li>Xuất trình mã QR tại lễ tân khi check-in</li>
                <li>Nhân viên sẽ quét mã để xác nhận thông tin của bạn</li>
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function UserPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card>
          <CardBody>
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-sm text-gray-600">Đang tải...</p>
            </div>
          </CardBody>
        </Card>
      </div>
    }>
      <UserPageContent />
    </Suspense>
  );
}

