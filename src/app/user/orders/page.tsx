"use client";

import { useState, useEffect } from "react";

import { useUserBookings } from "@/hooks/useApi";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { apiClient } from "@/lib/api-client";

type ServiceOrderStatus = 'PENDING' | 'PENDING_STAFF_CONFIRMATION' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REJECTED' | 'FAILED';

type ServiceOrder = {
  id: number;
  code: string;
  bookingId: number;
  requestedBy: number;
  status: ServiceOrderStatus;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
  items?: ServiceOrderItem[];
};

type ServiceOrderItem = {
  id: number;
  serviceOrderId: number;
  serviceId: number;
  serviceName?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type Booking = {
  id: number;
  code: string;
  roomId: number;
  roomCode?: string;
  checkinDate: string;
  checkoutDate: string;
  status: string;
};

export default function UserOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Load user bookings
  const { data: bookingsData, loading: bookingsLoading } = useUserBookings();

  useEffect(() => {
    if (bookingsData) {
      const items = Array.isArray((bookingsData as any).items) 
        ? (bookingsData as any).items 
        : (Array.isArray(bookingsData) ? bookingsData : []);
      setBookings(items);
      
      // Auto-select first booking if available
      if (items.length > 0 && !selectedBookingId) {
        setSelectedBookingId(items[0].id);
      }
    }
  }, [bookingsData]);

  // Load orders for selected booking
  const loadOrders = async (bookingId: number) => {
    setLoading(true);
    try {
      const response = await apiClient.getMyServiceOrders(bookingId);
      
      if (response.success) {
        const data: any = response.data;
        const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        setOrders(items);
      } else {
        setFlash({ type: 'error', text: response.error || 'Không thể tải danh sách đơn hàng' });
        setOrders([]);
      }
    } catch (error: any) {
      console.error('Error loading orders:', error);
      setFlash({ type: 'error', text: error.message || 'Có lỗi xảy ra khi tải dữ liệu' });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBookingId) {
      loadOrders(selectedBookingId);
    }
  }, [selectedBookingId]);

  // Load order detail
  const loadOrderDetail = async (orderId: number) => {
    try {
      const response = await apiClient.getServiceOrder(orderId);
      
      if (response.success) {
        setSelectedOrder(response.data as ServiceOrder);
        setDetailModalOpen(true);
      } else {
        setFlash({ type: 'error', text: response.error || 'Không thể tải chi tiết đơn hàng' });
      }
    } catch (error: any) {
      console.error('Error loading order detail:', error);
      setFlash({ type: 'error', text: error.message || 'Có lỗi xảy ra' });
    }
  };

  // Auto-hide flash messages
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [flash]);

  const getStatusBadge = (status: ServiceOrderStatus) => {
    switch (status) {
      case 'PENDING':
        return <Badge tone="warning">Chờ xử lý</Badge>;
      case 'PENDING_STAFF_CONFIRMATION':
        return <Badge tone="warning">Chờ NV xác nhận</Badge>;
      case 'PENDING_PAYMENT':
        return <Badge tone="warning">Chờ thanh toán</Badge>;
      case 'CONFIRMED':
        return <Badge tone="success">Đã xác nhận</Badge>;
      case 'IN_PROGRESS':
        return <Badge>Đang xử lý</Badge>;
      case 'COMPLETED':
        return <Badge tone="success">Hoàn thành</Badge>;
      case 'CANCELLED':
        return <Badge tone="muted">Đã hủy</Badge>;
      case 'REJECTED':
        return <Badge tone="muted">Đã từ chối</Badge>;
      case 'FAILED':
        return <Badge tone="error">Thanh toán thất bại</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const selectedBooking = bookings.find(b => b.id === selectedBookingId);
  const totalOrders = orders.length;
  const totalAmount = orders.reduce((sum, o) => sum + o.totalAmount, 0);

  const [payingOrderId, setPayingOrderId] = useState<number | null>(null);

  const handlePay = async (order: ServiceOrder, method: 'WALLET' | 'CASH') => {
    try {
      setPayingOrderId(order.id);
      setFlash(null);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const payRes = await apiClient.createPayment({
        serviceOrderId: order.id,
        method,
        returnUrl: `${origin}/user/orders?bookingId=${selectedBookingId ?? ''}`,
        cancelUrl: `${origin}/user/orders?bookingId=${selectedBookingId ?? ''}`,
      } as any);
      if (!payRes.success) {
        setFlash({ type: 'error', text: payRes.error || 'Không thể khởi tạo thanh toán' });
        return;
      }
      const paymentUrl = (payRes.data as any)?.paymentUrl;
      if (method === 'WALLET') {
        if (paymentUrl) {
          window.location.href = paymentUrl;
          return;
        }
        setFlash({ type: 'error', text: 'Không nhận được đường dẫn thanh toán từ PayOS' });
      } else {
        setFlash({ type: 'success', text: 'Đã khởi tạo giao dịch thanh toán tiền mặt' });
      }
    } catch (e: any) {
      setFlash({ type: 'error', text: e?.message || 'Có lỗi xảy ra khi khởi tạo thanh toán' });
    } finally {
      setPayingOrderId(null);
    }
  };

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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Đơn hàng của tôi</h1>
                  <p className="text-sm lg:text-base text-gray-600 mt-1">Xem lịch sử đơn hàng dịch vụ</p>
                </div>
              </div>
            </div>
            <Button 
              onClick={() => router.push('/user/services/create')}
              className="w-full sm:w-auto bg-blue-500 text-white hover:bg-blue-600 shadow-md font-semibold flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Đặt dịch vụ mới</span>
              <span className="sm:hidden">Đặt mới</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
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

          {/* Booking Selector */}
          {bookingsLoading ? (
            <Card>
              <CardBody>
                <div className="text-center py-4 text-gray-600">Đang tải bookings...</div>
              </CardBody>
            </Card>
          ) : bookings.length === 0 ? (
            <Card>
              <CardBody>
                <div className="text-center py-10 text-gray-600">
                  <div className="mb-3">
                    <svg className="w-10 h-10 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-sm">Bạn chưa có booking nào.</div>
                </div>
              </CardBody>
            </Card>
          ) : (
            <>
              <Card>
                <CardBody>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Chọn booking để xem đơn hàng
                      </label>
                      <select 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={selectedBookingId || ''} 
                        onChange={(e) => setSelectedBookingId(parseInt(e.target.value))}
                      >
                        <option value="">-- Chọn booking --</option>
                        {bookings.map((booking) => (
                          <option key={booking.id} value={booking.id}>
                            {booking.code} - {booking.roomCode || `Room #${booking.roomId}`} 
                            ({new Date(booking.checkinDate).toLocaleDateString('vi-VN')} - {new Date(booking.checkoutDate).toLocaleDateString('vi-VN')})
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedBooking && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="text-sm text-gray-700">
                          <div className="font-medium mb-1">Thông tin booking:</div>
                          <div>Mã: <strong>{selectedBooking.code}</strong></div>
                          <div>Phòng: <strong>{selectedBooking.roomCode || `Room #${selectedBooking.roomId}`}</strong></div>
                          <div>Check-in: {new Date(selectedBooking.checkinDate).toLocaleString('vi-VN')}</div>
                          <div>Check-out: {new Date(selectedBooking.checkoutDate).toLocaleString('vi-VN')}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>

              {/* Stats */}
              {selectedBookingId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
                    <CardBody className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Tổng đơn hàng</p>
                          <p className="text-3xl font-bold text-blue-600">{totalOrders}</p>
                        </div>
                        <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                          </svg>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50">
                    <CardBody className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Tổng tiền</p>
                          <p className="text-3xl font-bold text-green-600">{totalAmount.toLocaleString('vi-VN')}</p>
                          <p className="text-xs text-gray-500 mt-1">VNĐ</p>
                        </div>
                        <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              )}

              {/* Orders List */}
              {!selectedBookingId ? (
                <Card>
                  <CardBody>
                    <div className="text-center py-10 text-gray-600">
                      <div className="text-sm">Vui lòng chọn booking để xem đơn hàng</div>
                    </div>
                  </CardBody>
                </Card>
              ) : loading ? (
                <Card>
                  <CardBody>
                    <div className="text-center py-10 text-gray-600">
                      <div className="animate-pulse">Đang tải đơn hàng...</div>
                    </div>
                  </CardBody>
                </Card>
              ) : orders.length === 0 ? (
                <Card>
                  <CardBody>
                    <div className="text-center py-10 text-gray-600">
                      <div className="mb-3">
                        <svg className="w-10 h-10 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="text-sm">Booking này chưa có đơn hàng nào.</div>
                    </div>
                  </CardBody>
                </Card>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <Card key={order.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                      <CardBody className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">Đơn hàng: {order.code}</h3>
                              </div>
                              {getStatusBadge(order.status)}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                <p className="text-xs text-gray-500 mb-1">Tổng tiền</p>
                                <p className="text-sm font-bold text-blue-600">{order.totalAmount.toLocaleString('vi-VN')} VNĐ</p>
                              </div>
                              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <p className="text-xs text-gray-500 mb-1">Ngày tạo</p>
                                <p className="text-sm font-semibold text-gray-900">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</p>
                              </div>
                              <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                                <p className="text-xs text-gray-500 mb-1">Số items</p>
                                <p className="text-sm font-semibold text-purple-600">{order.items?.length || 0}</p>
                              </div>
                              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <p className="text-xs text-gray-500 mb-1">Trạng thái</p>
                                <p className="text-sm font-semibold text-gray-900">{order.status}</p>
                              </div>
                            </div>
                            {order.note && (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <div className="flex items-start gap-2">
                                  <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  <div>
                                    <p className="text-xs font-semibold text-amber-800 mb-1">Ghi chú</p>
                                    <p className="text-sm text-amber-900">{order.note}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 lg:min-w-[200px]">
                            {order.status === 'PENDING_PAYMENT' && (
                              <>
                                <Button
                                  onClick={() => handlePay(order, 'WALLET')}
                                  disabled={payingOrderId === order.id}
                                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg flex items-center justify-center gap-2"
                                >
                                  {payingOrderId === order.id ? (
                                    <>
                                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      Đang chuyển...
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                      </svg>
                                      Thanh toán PayOS
                                    </>
                                  )}
                                </Button>
                                <Button
                                  onClick={() => handlePay(order, 'CASH')}
                                  disabled={payingOrderId === order.id}
                                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg flex items-center justify-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                  {payingOrderId === order.id ? 'Đang xử lý...' : 'Thanh toán tiền mặt'}
                                </Button>
                              </>
                            )}
                            <Button 
                              variant="secondary"
                              onClick={() => loadOrderDetail(order.id)}
                              className="w-full flex items-center justify-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              Xem chi tiết
                            </Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Order Detail Modal */}
      <Modal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedOrder(null);
        }}
        title="Chi tiết đơn hàng"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{selectedOrder.code}</h3>
                  <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-gray-500">Booking ID</div>
                <div className="font-medium text-gray-900">{selectedOrder.bookingId}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-gray-500">Tổng tiền</div>
                <div className="font-medium text-gray-900">{selectedOrder.totalAmount.toLocaleString('vi-VN')} VNĐ</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-gray-500">Ngày tạo</div>
                <div className="font-medium text-gray-900">{new Date(selectedOrder.createdAt).toLocaleString('vi-VN')}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-gray-500">Cập nhật</div>
                <div className="font-medium text-gray-900">{new Date(selectedOrder.updatedAt).toLocaleString('vi-VN')}</div>
              </div>
            </div>

            {selectedOrder.note && (
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-gray-500 mb-1">Ghi chú</div>
                <div className="text-gray-900">{selectedOrder.note}</div>
              </div>
            )}

            {selectedOrder.items && selectedOrder.items.length > 0 && (
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-gray-500 mb-2 font-medium">Danh sách dịch vụ</div>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <div className="font-medium">{item.serviceName || `Service #${item.serviceId}`}</div>
                        <div className="text-sm text-gray-600">Số lượng: {item.quantity} x {item.unitPrice.toLocaleString('vi-VN')} VNĐ</div>
                      </div>
                      <div className="font-semibold">{item.lineTotal.toLocaleString('vi-VN')} VNĐ</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                  <div className="font-medium">Tổng cộng:</div>
                  <div className="text-lg font-bold text-blue-600">{selectedOrder.totalAmount.toLocaleString('vi-VN')} VNĐ</div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}







