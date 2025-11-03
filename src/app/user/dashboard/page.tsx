"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { createBookingNotification } from "@/lib/notifications";
import { useRooms, useBookings, useServices } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";

type Room = {
  id: number;
  building: string;
  roomNumber: string;
  roomType: string;
  capacity: number;
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
};

type Service = {
  id: number;
  name: string;
  description: string;
  price: number;
  status: 'AVAILABLE' | 'COMPLETED' | 'CANCELLED';
};

type ServiceOrder = {
  id: number;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  orderDate: string;
  deliveryDate?: string;
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

export default function UserPage() {
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

  const [activeTab, setActiveTab] = useState<'rooms' | 'booking' | 'services' | 'payments' | 'history' | 'calendar'>('rooms');
  const [loading, setLoading] = useState({ rooms: true, bookings: true, services: true });
  
  // Determine if user is lecturer
  const [isLecturer, setIsLecturer] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const role = sessionStorage.getItem('userRole') || 'guest';
      setIsLecturer(role === 'lecturer');
    }
  }, []);

  // Use API hooks for data fetching
  const { data: roomsData, loading: roomsLoading, error: roomsError, refetch: refetchRooms } = useRooms();
  const { data: bookingsData, loading: bookingsLoading, error: bookingsError, refetch: refetchBookings } = useBookings();
  const { data: servicesData, loading: servicesLoading, error: servicesError, refetch: refetchServices } = useServices();

  useEffect(() => {
    setLoading({ rooms: roomsLoading, bookings: bookingsLoading, services: servicesLoading })
  }, [roomsLoading, bookingsLoading, servicesLoading])

  // Transform API data to match component types
  const rooms: Room[] = (roomsData as any) || [];
  const bookings: RoomBooking[] = (bookingsData as any) || [];
  const services: Service[] = (servicesData as any) || [];
  
  // Bookings are now loaded from API via useBookings hook

  // Services are now loaded from API via useServices hook

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-hide success/error messages after a few seconds
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [flash]);

  // Form states for new booking
  const [newBooking, setNewBooking] = useState({
    checkIn: '',
    checkOut: '',
    guests: 1,
    purpose: 'Công tác để ở',
    guestName: '',
    guestEmail: '',
    phoneNumber: ''
  });

  // Form states for new service order
  const [newServiceOrder, setNewServiceOrder] = useState({
    serviceName: '',
    quantity: 1,
    unitPrice: 0
  });

  // Form states for payment
  const [paymentData, setPaymentData] = useState({
    method: '',
    amount: 0
  });

  const handleCreateBooking = async () => {
    if (!selectedRoom) {
      setFlash({ type: 'error', text: 'Vui lòng chọn phòng' });
      return;
    }

    // Validation
    if (!newBooking.guestName.trim()) {
      setFlash({ type: 'error', text: 'Vui lòng nhập tên khách hàng' });
      return;
    }
    if (!newBooking.guestEmail.trim()) {
      setFlash({ type: 'error', text: 'Vui lòng nhập email' });
      return;
    }
    if (!newBooking.phoneNumber.trim()) {
      setFlash({ type: 'error', text: 'Vui lòng nhập số điện thoại' });
      return;
    }
    if (!newBooking.checkIn) {
      setFlash({ type: 'error', text: 'Vui lòng chọn ngày check-in' });
      return;
    }
    if (!newBooking.checkOut) {
      setFlash({ type: 'error', text: 'Vui lòng chọn ngày check-out' });
      return;
    }
    if (new Date(newBooking.checkIn) >= new Date(newBooking.checkOut)) {
      setFlash({ type: 'error', text: 'Ngày check-out phải sau ngày check-in' });
      return;
    }
    if (newBooking.guests > selectedRoom.capacity) {
      setFlash({ type: 'error', text: `Số khách không được vượt quá ${selectedRoom.capacity} người` });
      return;
    }

    try {
      // Format data to match API expectations (CreateBookingRequest)
      const bookingData = {
        code: `BK${Date.now()}`, // Auto-generate booking code
        userId: 1, // TODO: Get from authenticated user session
        roomId: selectedRoom.id,
        checkinDate: newBooking.checkIn,
        checkoutDate: newBooking.checkOut,
        numGuests: newBooking.guests,
        note: `Purpose: ${newBooking.purpose}\nGuest: ${newBooking.guestName}\nEmail: ${newBooking.guestEmail}\nPhone: ${newBooking.phoneNumber}`
      };

      console.log('📤 Sending booking request:', bookingData);
      const response = await apiClient.createBooking(bookingData);
      
      if (response.success) {
        setFlash({ type: 'success', text: 'Gửi yêu cầu đặt phòng thành công! Hành chính sẽ xác nhận trong thời gian sớm nhất.' });
        setBookingModalOpen(false);
        setSelectedRoom(null);
        setNewBooking({ 
          checkIn: '', 
          checkOut: '', 
          guests: 1, 
          purpose: 'Công tác để ở',
          guestName: '',
          guestEmail: '',
          phoneNumber: ''
        });
        
        // Refresh bookings data
        refetchBookings();
        
        // Create notification
        createBookingNotification(
          (response.data as any)?.id || Date.now(),
          newBooking.guestName,
          `${selectedRoom.building} - ${selectedRoom.roomNumber}`,
          'PENDING'
        );
      } else {
        setFlash({ type: 'error', text: response.error || 'Có lỗi xảy ra khi đặt phòng' });
      }
    } catch (error) {
      setFlash({ type: 'error', text: 'Có lỗi xảy ra khi đặt phòng' });
      console.error('Booking creation error:', error);
    }
  };

  const handleCreateServiceOrder = async () => {
    if (!newServiceOrder.serviceName || newServiceOrder.quantity <= 0) {
      setFlash({ type: 'error', text: 'Vui lòng điền đầy đủ thông tin đặt dịch vụ' });
      return;
    }

    try {
      const serviceOrderData = {
        serviceName: newServiceOrder.serviceName,
        quantity: newServiceOrder.quantity,
        unitPrice: newServiceOrder.unitPrice,
        totalPrice: newServiceOrder.quantity * newServiceOrder.unitPrice
      };

      const res = await fetch('/api/system/orders?action=cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceOrderData)
      })
      
      if (res.ok) {
        setServiceModalOpen(false);
        setNewServiceOrder({ serviceName: '', quantity: 1, unitPrice: 0 });
        setFlash({ type: 'success', text: 'Đặt dịch vụ thành công!' });
        
        // Refresh service orders data
        refetchServices();
        if (serviceOrderData.totalPrice > 0) {
          try {
            const payRes = await fetch('/api/system/payments?action=create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: serviceOrderData.totalPrice, description: `Thanh toán dịch vụ: ${serviceOrderData.serviceName}` })
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
        setFlash({ type: 'error', text: err || 'Có lỗi xảy ra khi đặt dịch vụ' });
      }
    } catch (error) {
      setFlash({ type: 'error', text: 'Có lỗi xảy ra khi đặt dịch vụ' });
      console.error('Service order creation error:', error);
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
  const totalServices = services.length;
  const completedServices = services.filter(s => s.status === 'COMPLETED').length;
  // Payments functionality temporarily disabled
  const totalPayments = 0;
  const paidPayments = 0;
  const pendingPayments = 0;
  const overduePayments = 0;

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-transparent shadow-sm px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardBody>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{totalBookings}</div>
                  <div className="text-sm text-gray-600">Tổng đặt phòng</div>
                  <div className="text-xs text-gray-500">{confirmedBookings} đã xác nhận</div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{totalServices}</div>
                  <div className="text-sm text-gray-600">Dịch vụ đã đặt</div>
                  <div className="text-xs text-gray-500">{completedServices} hoàn thành</div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{totalPayments}</div>
                  <div className="text-sm text-gray-600">Hóa đơn</div>
                  <div className="text-xs text-gray-500">{paidPayments} đã thanh toán</div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{pendingPayments + overduePayments}</div>
                  <div className="text-sm text-gray-600">Chờ thanh toán</div>
                  <div className="text-xs text-gray-500">{overduePayments} quá hạn</div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" role="tablist" aria-label="User sections">
              <button
                onClick={() => setActiveTab('rooms')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'rooms'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                role="tab"
                aria-selected={activeTab === 'rooms'}
              >
                Phòng có sẵn ({rooms.filter(r => r.status === 'AVAILABLE').length})
              </button>
              <button
                onClick={() => setActiveTab('booking')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'booking'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                role="tab"
                aria-selected={activeTab === 'booking'}
              >
                Đặt phòng ({totalBookings})
              </button>
              <button
                onClick={() => setActiveTab('services')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'services'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                role="tab"
                aria-selected={activeTab === 'services'}
              >
                Dịch vụ ({totalServices})
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'payments'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                role="tab"
                aria-selected={activeTab === 'payments'}
              >
                Hóa đơn ({totalPayments})
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'calendar'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                role="tab"
                aria-selected={activeTab === 'calendar'}
              >
                Lịch
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                role="tab"
                aria-selected={activeTab === 'history'}
              >
                Lịch sử
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'rooms' && (
            <div className="space-y-4">
              {loading.rooms && (
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
              )}
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Phòng có sẵn</h2>
                <div className="text-sm text-gray-600">
                  Hiển thị {rooms.filter(r => r.status === 'AVAILABLE').length} phòng trống
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {rooms.filter(room => room.status === 'AVAILABLE').map((room) => (
                  <div 
                    key={room.id} 
                    className="group relative bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100"
                  >
                    {/* Gradient Header with Status */}
                    <div className="relative h-32 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 overflow-hidden">
                      {/* Pattern Overlay */}
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute inset-0" style={{
                          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.1) 10px, rgba(255,255,255,.1) 20px)`
                        }}></div>
                      </div>
                      
                      {/* Room Image Placeholder */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-16 h-16 text-white opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                      
                      {/* Status Badge */}
                      <div className="absolute top-3 right-3">
                        <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-md px-2 py-0.5">
                          <Badge tone="success">
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Trống
                            </span>
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Room Code */}
                      <div className="absolute bottom-3 left-3">
                        <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1">
                          <p className="text-white font-bold text-lg">{room.building}-{room.roomNumber}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Card Content */}
                    <div className="p-5 space-y-4">
                      {/* Room Type */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Loại phòng</span>
                        </div>
                        <p className="text-lg font-semibold text-gray-900">{room.roomType || 'Phòng tiêu chuẩn'}</p>
                      </div>
                      
                      {/* Room Details Grid */}
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                        {/* Capacity */}
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 mt-0.5">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Sức chứa</p>
                            <p className="text-base font-semibold text-gray-900">{room.capacity} người</p>
                          </div>
                        </div>
                        
                        {/* Price */}
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 mt-0.5">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Giá</p>
                            <p className="text-base font-bold text-green-600">Miễn phí</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Description */}
                      {room.description && (
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-sm text-gray-600 line-clamp-2">{room.description}</p>
                        </div>
                      )}
                      
                      {/* Amenities */}
                      {(room.amenities && room.amenities.length > 0) && (
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-2">Tiện ích:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {room.amenities.slice(0, 3).map((amenity, index) => (
                              <Badge key={index} tone="info">
                                <span className="text-xs">{amenity}</span>
                              </Badge>
                            ))}
                            {room.amenities.length > 3 && (
                              <Badge tone="muted">
                                <span className="text-xs">+{room.amenities.length - 3} khác</span>
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Action Button */}
                      <div className="pt-3 border-t border-gray-100">
                        <Button 
                          onClick={() => {
                            setSelectedRoom(room);
                            setBookingModalOpen(true);
                          }}
                          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2.5 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
                        >
                          <span className="flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Đặt phòng này
                          </span>
                        </Button>
                      </div>
                    </div>
                    
                    {/* Hover Effect Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 to-indigo-600/0 group-hover:from-blue-600/5 group-hover:to-indigo-600/5 transition-opacity duration-300 pointer-events-none rounded-xl"></div>
                  </div>
                ))}
              </div>
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
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Đặt phòng</h2>
                <Button onClick={() => setBookingModalOpen(true)}>
                  Đặt phòng mới
                </Button>
              </div>
              
              <div className="grid gap-4">
                {bookings.map((booking) => (
                  <Card key={booking.id}>
                    <CardBody>
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              Phòng {booking.roomType}
                            </h3>
                            {getStatusBadge(booking.status)}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600">
                            <div><span className="font-medium">Khách hàng:</span> {booking.guestName}</div>
                            <div><span className="font-medium">Email:</span> {booking.guestEmail}</div>
                            <div><span className="font-medium">SĐT:</span> {booking.phoneNumber}</div>
                            <div><span className="font-medium">Số khách:</span> {booking.guests}</div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600 mt-2">
                            <div><span className="font-medium">Tòa:</span> {booking.building}</div>
                            <div><span className="font-medium">Phòng:</span> {booking.roomNumber}</div>
                            <div><span className="font-medium">Check-in:</span> {booking.checkIn}</div>
                            <div><span className="font-medium">Check-out:</span> {booking.checkOut}</div>
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
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
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
                <h2 className="text-lg font-semibold text-gray-900">Dịch vụ</h2>
                <Button onClick={() => setServiceModalOpen(true)}>
                  Đặt dịch vụ mới
                </Button>
              </div>
              
              <div className="grid gap-4">
                {services.map((service) => (
                  <Card key={service.id}>
                    <CardBody>
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {service.name}
                            </h3>
                            {getStatusBadge(service.status)}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                            <div><span className="font-medium">Giá:</span> {service.price.toLocaleString()} VND</div>
                            <div><span className="font-medium">Trạng thái:</span> {service.status}</div>
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
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

          {activeTab === 'calendar' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Lịch đặt phòng</h2>
              </div>
              <Card>
                <CardBody>
                  <div className="grid grid-cols-7 gap-2 text-sm">
                    {Array.from({ length: 14 }).map((_, idx) => {
                      const date = new Date();
                      date.setDate(date.getDate() + idx);
                      const dateStr = date.toISOString().slice(0, 10);
                      const dayBookings = bookings.filter(b => b.checkIn?.slice(0,10) === dateStr);
                      return (
                        <div key={idx} className="p-2 border rounded">
                          <div className="text-gray-600 text-xs mb-1">{dateStr}</div>
                          {dayBookings.length === 0 ? (
                            <div className="text-gray-400">Trống</div>
                          ) : (
                            <div className="space-y-1">
                              {dayBookings.slice(0,3).map(b => (
                                <div key={b.id} className="text-xs bg-blue-50 text-blue-700 rounded px-1 py-0.5">
                                  {b.roomType} - {b.status}
                                </div>
                              ))}
                              {dayBookings.length > 3 && (
                                <div className="text-xs text-gray-500">+{dayBookings.length - 3} nữa</div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardBody>
              </Card>
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
                  <h3 className="text-md font-semibold text-gray-900">Dịch vụ</h3>
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3">
                    {(() => {
                      const f = (window as any).__historyFilter
                      const list = !f ? services : (services as any[]).filter((s: any) => {
                        const d = (s.orderDate || '').slice(0,10)
                        return (!f?.start || d >= f.start) && (!f?.end || d <= f.end)
                      })
                      if (list.length === 0) return <div className="text-sm text-gray-500">Chưa có dịch vụ nào</div>
                      return list.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium">{s.name}</span>
                            <div className="text-gray-500 text-xs">Giá: {s.price?.toLocaleString?.() || 0} VND</div>
                          </div>
                          {getStatusBadge(s.status)}
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
        }}
        title="Đặt phòng mới"
        footer={
          <div className="flex justify-end gap-2">
            <Button 
              variant="secondary" 
              onClick={() => {
                setBookingModalOpen(false);
                setSelectedRoom(null);
              }}
            >
              Hủy
            </Button>
            <Button onClick={handleCreateBooking}>
              Gửi yêu cầu đặt phòng
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {selectedRoom && (
            <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-2">Thông tin phòng đã chọn</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="font-medium">Phòng:</span> {selectedRoom.building} - {selectedRoom.roomNumber}</div>
                <div><span className="font-medium">Loại:</span> {selectedRoom.roomType}</div>
                <div><span className="font-medium">Sức chứa:</span> {selectedRoom.capacity} người</div>
                <div><span className="font-medium">Giá:</span> <span className="text-green-600 font-medium">Miễn phí</span></div>
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên khách hàng *</label>
            <Input
              type="text"
              placeholder="Nhập tên khách hàng"
              value={newBooking.guestName}
              onChange={(e) => setNewBooking(prev => ({ ...prev, guestName: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <Input
              type="email"
              placeholder="Nhập email"
              value={newBooking.guestEmail}
              onChange={(e) => setNewBooking(prev => ({ ...prev, guestEmail: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại *</label>
            <Input
              type="tel"
              placeholder="Nhập số điện thoại"
              value={newBooking.phoneNumber}
              onChange={(e) => setNewBooking(prev => ({ ...prev, phoneNumber: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check-in *</label>
              <Input
                type="date"
                value={newBooking.checkIn}
                onChange={(e) => setNewBooking(prev => ({ ...prev, checkIn: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check-out *</label>
              <Input
                type="date"
                value={newBooking.checkOut}
                onChange={(e) => setNewBooking(prev => ({ ...prev, checkOut: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số khách *</label>
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
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mục đích sử dụng</label>
            <Input
              type="text"
              value={newBooking.purpose}
              onChange={(e) => setNewBooking(prev => ({ ...prev, purpose: e.target.value }))}
              readOnly
            />
          </div>
        </div>
      </Modal>

      {/* New Service Order Modal */}
      <Modal
        open={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        title="Đặt dịch vụ mới"
        footer={
          <div className="flex justify-end gap-2">
            <Button 
              variant="secondary" 
              onClick={() => setServiceModalOpen(false)}
            >
              Hủy
            </Button>
            <Button onClick={handleCreateServiceOrder}>
              Đặt dịch vụ
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên dịch vụ *</label>
            <Input
              type="text"
              placeholder="Nhập tên dịch vụ"
              value={newServiceOrder.serviceName}
              onChange={(e) => setNewServiceOrder(prev => ({ ...prev, serviceName: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng *</label>
              <Input
                type="number"
                min="1"
                value={newServiceOrder.quantity}
                onChange={(e) => setNewServiceOrder(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Đơn giá (VND) *</label>
              <Input
                type="number"
                min="0"
                value={newServiceOrder.unitPrice}
                onChange={(e) => setNewServiceOrder(prev => ({ ...prev, unitPrice: parseInt(e.target.value) || 0 }))}
              />
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
            <Button onClick={handlePayment}>
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
                <option value="Thẻ tín dụng">Thẻ tín dụng</option>
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
    </>
  );
}
