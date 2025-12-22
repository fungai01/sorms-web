"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useServices, useUserBookings } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import type { Service, Booking } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";

export default function RequestServicePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [serviceId, setServiceId] = useState<number | "">("");
  const [bookingId, setBookingId] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number>(1);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<{ open: boolean; service: Service | null }>({
    open: false,
    service: null
  });
  const [orderModalOpen, setOrderModalOpen] = useState(false); // Modal đóng mặc định, mở khi click giỏ hàng
  const [cartId, setCartId] = useState<number | null>(null); // Lưu cart ID sau khi tạo
  const [creatingCart, setCreatingCart] = useState(false); // Trạng thái đang tạo cart
  const creatingCartRef = useRef(false); // Ref để track việc đang tạo cart, tránh spam request
  
  // Pagination và search state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12); // 12 items per page (3 columns x 4 rows)
  const [searchQuery, setSearchQuery] = useState("");

  const { data: servicesData, loading: servicesLoading } = useServices({ 
    isActive: true,
    page: currentPage,
    size: pageSize,
    q: searchQuery || undefined
  });
  const { data: bookingsData, loading: bookingsLoading } = useUserBookings();

  const services = useMemo(() => {
    if (!servicesData) return [];
    return Array.isArray(servicesData) ? servicesData : (servicesData as any).items || [];
  }, [servicesData]);

  // Filter services locally nếu backend không hỗ trợ search
  const filteredServices = useMemo(() => {
    if (!searchQuery) return services;
    const query = searchQuery.toLowerCase();
    return services.filter((s: Service) => 
      s.name.toLowerCase().includes(query) || 
      s.description?.toLowerCase().includes(query)
    );
  }, [services, searchQuery]);

  const bookings = useMemo(() => {
    if (!bookingsData) return [];
    const bookingList = Array.isArray(bookingsData) ? bookingsData : (bookingsData as any).items || [];
    
    // Chỉ hiển thị các booking đang CHECKED_IN hoặc APPROVED và còn active
    return bookingList.filter((b: Booking) => 
      (b.status === "CHECKED_IN" || b.status === "APPROVED") && b.isActive !== false
    );
  }, [bookingsData]);

  const selectedService = useMemo(() => {
    if (!serviceId) return null;
    return filteredServices.find((s: Service) => s.id === serviceId);
  }, [serviceId, filteredServices]);

  const selectedBooking = useMemo(() => {
    if (!bookingId) return null;
    return bookings.find((b: Booking) => b.id === bookingId);
  }, [bookingId, bookings]);

  const totalPrice = useMemo(() => {
    if (!selectedService) return 0;
    return selectedService.unitPrice * quantity;
  }, [selectedService, quantity]);

  const formatMoney = (amount: number) => {
    return amount?.toLocaleString("vi-VN") + " đ";
  };

  // Tạo cart khi chọn booking
  const createCart = useCallback(async (bookingIdParam: number) => {
    if (!user?.id) {
      setError("Vui lòng đăng nhập để đặt dịch vụ");
      return false;
    }

    if (cartId) {
      // Cart đã tồn tại, không cần tạo lại
      return true;
    }

    // Tránh spam request - nếu đang tạo cart thì không tạo lại
    if (creatingCartRef.current) {
      return false;
    }

    try {
      creatingCartRef.current = true;
      setCreatingCart(true);
      const cartResponse = await apiClient.createOrderCart({ 
        bookingId: bookingIdParam,
        requestedBy: String(user.id)
      });
      
      // Kiểm tra xem có data trong response không, ngay cả khi success = false
      // Vì backend có thể tạo order thành công nhưng trả về error code (như SYSTEM_ERROR)
      const responseData = cartResponse.data as any;
      const orderId = responseData?.id || responseData?.orderId;
      
      if (orderId) {
        // Có ID trong response, coi như thành công và tiếp tục
        setCartId(orderId);
        // Không hiển thị lỗi nếu đã có orderId, vì backend đã tạo thành công
        return true;
      }
      
      // Không có ID trong response - chỉ báo lỗi nếu thực sự không có data
      if (!cartResponse.success && !responseData) {
        setError(cartResponse.error || "Không thể tạo giỏ hàng");
        return false;
      }
      
      setError("Không thể lấy ID giỏ hàng từ response");
      return false;
    } catch (err) {
      console.error("Error creating cart:", err);
      setError("Có lỗi xảy ra khi tạo giỏ hàng");
      return false;
    } finally {
      creatingCartRef.current = false;
      setCreatingCart(false);
    }
  }, [user?.id, cartId]);

  // Tự động tạo cart khi chọn booking
  useEffect(() => {
    if (bookingId && typeof bookingId === 'number' && user?.id && !cartId && !creatingCartRef.current) {
      createCart(bookingId);
    }
  }, [bookingId, user?.id, cartId, createCart]);

  // Reset cart khi booking bị xóa
  useEffect(() => {
    if (!bookingId) {
      setCartId(null);
      creatingCartRef.current = false;
    }
  }, [bookingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!serviceId || !bookingId || !date) {
      setError("Vui lòng điền đầy đủ thông tin");
      return;
    }

    // Kiểm tra booking còn active và đang CHECKED_IN hoặc APPROVED
    const selectedBooking = bookings.find((b: Booking) => b.id === bookingId);
    if (!selectedBooking) {
      setError("Booking không tồn tại hoặc không còn hoạt động");
      return;
    }
    if (selectedBooking.status !== "CHECKED_IN" && selectedBooking.status !== "APPROVED") {
      setError("Booking phải ở trạng thái đã duyệt hoặc đã check-in để đặt dịch vụ");
      return;
    }
    if (selectedBooking.isActive === false) {
      setError("Booking không còn hoạt động. Vui lòng chọn booking khác");
      return;
    }

    if (!user?.id) {
      setError("Vui lòng đăng nhập để đặt dịch vụ");
      return;
    }

    // Tạo cart nếu chưa có
    const cartCreated = await createCart(Number(bookingId));
    if (!cartCreated || !cartId) {
      return; // Error đã được set trong createCart
    }

    try {
      setSubmitting(true);
      const serviceTime = date ? `${date}T12:00:00` : undefined;
      const addItemResponse = await apiClient.addOrderItem(cartId, Number(serviceId), quantity, undefined, serviceTime, undefined);

      if (!addItemResponse.success) {
        setError(addItemResponse.error || "Không thể thêm dịch vụ");
        return;
      }

      // Confirm order sau khi thêm item
      await apiClient.confirmOrder(cartId);
      setSuccess(true);
      setCartId(null); // Reset cart sau khi confirm
      setTimeout(() => router.push("/user/orders"), 2000);
    } catch (err) {
      console.error("Error:", err);
      setError("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (success) {
    return (
      <div className="px-4 lg:px-6 py-6 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardBody>
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Đặt dịch vụ thành công!</h2>
              <p className="text-gray-500 mb-4">Đang chuyển đến trang đơn hàng...</p>
              <Button variant="primary" onClick={() => router.push("/user/orders")}>Xem đơn hàng</Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Đặt dịch vụ</h1>
          <p className="text-sm text-gray-500 mt-1">Chọn dịch vụ và điền thông tin để đặt</p>
        </div>
        {/* Giỏ hàng Button */}
        <button
          onClick={() => setOrderModalOpen(true)}
          className="relative p-3 bg-white border-2 border-gray-200 rounded-xl hover:border-[hsl(var(--primary))] transition-all shadow-sm hover:shadow-md"
        >
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {serviceId && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[hsl(var(--primary))] text-white text-xs font-bold rounded-full flex items-center justify-center">
              1
            </span>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <div className={`flex items-center gap-1.5 ${serviceId ? 'text-[hsl(var(--primary))]' : 'text-gray-400'}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${serviceId ? 'bg-[hsl(var(--primary))] text-white' : 'bg-gray-200 text-gray-500'}`}>1</span>
          <span className="hidden sm:inline">Chọn dịch vụ</span>
        </div>
        <div className="w-8 h-px bg-gray-300"></div>
        <div className={`flex items-center gap-1.5 ${bookingId ? 'text-[hsl(var(--primary))]' : 'text-gray-400'}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${bookingId ? 'bg-[hsl(var(--primary))] text-white' : 'bg-gray-200 text-gray-500'}`}>2</span>
          <span className="hidden sm:inline">Chọn phòng</span>
        </div>
        <div className="w-8 h-px bg-gray-300"></div>
        <div className={`flex items-center gap-1.5 ${date ? 'text-[hsl(var(--primary))]' : 'text-gray-400'}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${date ? 'bg-[hsl(var(--primary))] text-white' : 'bg-gray-200 text-gray-500'}`}>3</span>
          <span className="hidden sm:inline">Xác nhận</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Service Grid */}
        <div className="space-y-4">
          {/* Search và Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-gray-900">Danh sách dịch vụ</h2>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial sm:min-w-[250px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset về trang đầu khi search
                  }}
                  placeholder="Tìm kiếm dịch vụ..."
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))]"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="text-sm text-gray-500 whitespace-nowrap">{filteredServices.length} dịch vụ</span>
            </div>
          </div>
          
          {/* Services Grid */}
          {servicesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2 mt-4"></div>
                </div>
              ))}
            </div>
          ) : filteredServices.length === 0 ? (
            <Card>
              <CardBody>
                <div className="py-12 text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-gray-500 font-medium">
                    {searchQuery ? "Không tìm thấy dịch vụ phù hợp" : "Không có dịch vụ"}
                  </p>
                </div>
              </CardBody>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredServices.map((service: Service) => (
                  <div
                    key={service.id}
                    className={`bg-white border-2 rounded-xl p-4 transition-all hover:shadow-md flex flex-col h-full ${
                      serviceId === service.id
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)] shadow-md ring-2 ring-[hsl(var(--primary))/0.2]"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {/* Service Name */}
                    <div className="mb-3 flex-shrink-0">
                      <h3 
                        className="font-semibold text-gray-900 text-base cursor-pointer"
                        onClick={() => setServiceId(service.id)}
                      >
                        {service.name}
                      </h3>
                    </div>

                    {/* Price */}
                    <div className="mb-4 flex-shrink-0">
                      <div className="cursor-pointer" onClick={() => setServiceId(service.id)}>
                        <p className="text-xl font-bold text-[hsl(var(--primary))]">{formatMoney(service.unitPrice)}</p>
                        <p className="text-xs text-gray-500">/{service.unitName}</p>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 mt-auto flex-shrink-0">
                      <Button
                        variant="secondary"
                        className="flex-1 text-xs py-2 h-9"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailModal({ open: true, service });
                        }}
                      >
                        Chi tiết
                      </Button>
                      <Button
                        variant="primary"
                        className="flex-1 text-xs py-2 h-9"
                        onClick={(e) => {
                          e.stopPropagation();
                          setServiceId(service.id);
                        }}
                      >
                        Chọn
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {filteredServices.length >= pageSize && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </Button>
                  <span className="px-4 py-2 text-sm text-gray-700">
                    Trang {currentPage}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={filteredServices.length < pageSize}
                    className="px-4 py-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>


      {/* Order Form Modal */}
      <Modal
        open={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        title="Đơn đặt dịch vụ"
        size="lg"
      >
        <form className="space-y-6" onSubmit={handleSubmit}>
                {/* Selected Service Summary */}
                {selectedService ? (
                  <div className="bg-gradient-to-br from-[hsl(var(--primary)/0.1)] via-[hsl(var(--primary)/0.05)] to-transparent rounded-xl p-5 border-2 border-[hsl(var(--primary)/0.3)] shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-[hsl(var(--primary))] rounded-lg flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dịch vụ đã chọn</p>
                          <Badge tone="info" className="shrink-0">{formatMoney(selectedService.unitPrice)}/{selectedService.unitName}</Badge>
                        </div>
                        <h4 className="font-bold text-gray-900 text-lg mb-1">{selectedService.name}</h4>
                        {selectedService.description && (
                          <p className="text-sm text-gray-600 line-clamp-2">{selectedService.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-6 text-center border-2 border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Chưa chọn dịch vụ</p>
                    <p className="text-xs text-gray-500">Vui lòng chọn dịch vụ từ danh sách phía trên</p>
                  </div>
                )}

                {/* Booking Select */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Phòng đang ở
                  </label>
                  {bookingsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[hsl(var(--primary))]"></div>
                      <span className="ml-2 text-sm text-gray-500">Đang tải...</span>
                    </div>
                  ) : bookings.length === 0 ? (
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-orange-900 mb-1">Chưa có phòng đang ở</p>
                          <p className="text-xs text-orange-700">Bạn cần có đặt phòng đã được duyệt và đang check-in để đặt dịch vụ</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {bookings.map((booking: Booking) => (
                        <div
                          key={booking.id}
                          onClick={() => setBookingId(booking.id)}
                          className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
                            bookingId === booking.id
                              ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)] shadow-md ring-2 ring-[hsl(var(--primary))/0.2]"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                bookingId === booking.id 
                                  ? "bg-[hsl(var(--primary))] text-white" 
                                  : "bg-gray-100 text-gray-600"
                              }`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 mb-1">{booking.roomCode || `Phòng #${booking.roomId}`}</p>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  {new Date(booking.checkinDate).toLocaleDateString("vi-VN")} - {new Date(booking.checkoutDate).toLocaleDateString("vi-VN")}
                                </p>
                              </div>
                            </div>
                            {bookingId === booking.id && (
                              <div className="w-6 h-6 bg-[hsl(var(--primary))] rounded-full flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quantity & Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                      Số lượng
                    </label>
                    <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden hover:border-[hsl(var(--primary))] transition-colors">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="px-4 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors font-medium"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full text-center py-2.5 text-base font-bold text-gray-900 focus:outline-none bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.min(99, quantity + 1))}
                        className="px-4 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors font-medium"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Ngày sử dụng
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] hover:border-gray-300 transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Ghi chú (tùy chọn)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] resize-none hover:border-gray-300 transition-colors"
                    placeholder="Nhập yêu cầu đặc biệt hoặc ghi chú..."
                  />
                </div>

                {/* Total */}
                {selectedService && (
                  <div className="bg-gradient-to-br from-[hsl(var(--primary)/0.1)] via-[hsl(var(--primary)/0.05)] to-transparent rounded-xl p-5 shadow-md border-2 border-[hsl(var(--primary)/0.3)]">
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span className="text-gray-600 text-sm font-medium">Chi tiết đơn hàng</span>
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Dịch vụ</span>
                        <span className="text-gray-900 font-medium">{selectedService.name}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Số lượng</span>
                        <span className="text-gray-900 font-medium">x {quantity}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Đơn giá</span>
                        <span className="text-gray-900 font-medium">{formatMoney(selectedService.unitPrice)}/{selectedService.unitName}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t-2 border-gray-200">
                      <span className="text-lg font-semibold text-gray-900">Tổng cộng</span>
                      <span className="text-3xl font-bold text-[hsl(var(--primary))]">{formatMoney(totalPrice)}</span>
                    </div>
                  </div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={submitting || !serviceId || !bookingId || !date || bookings.length === 0}
                  variant="primary"
                  className="w-full py-3"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Đang xử lý...
                    </span>
                  ) : "Đặt dịch vụ"}
                </Button>
              </form>
      </Modal>
      </div>

      {/* Service Detail Modal */}
      <Modal
        open={detailModal.open}
        onClose={() => setDetailModal({ open: false, service: null })}
        title="Chi tiết dịch vụ"
        size="lg"
      >
        {detailModal.service && (
          <div className="space-y-6">
            {/* Service Header */}
            <div className="bg-gradient-to-r from-[hsl(var(--primary)/0.1)] to-[hsl(var(--primary)/0.05)] rounded-xl p-6 border border-[hsl(var(--primary)/0.2)]">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-[hsl(var(--primary))] rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">{detailModal.service.name}</h3>
                      {detailModal.service.code && (
                        <p className="text-sm text-gray-500 mt-1">Mã dịch vụ: #{detailModal.service.code}</p>
                      )}
                    </div>
                  </div>
                </div>
                <Badge tone="info" className="text-base px-4 py-2">
                  {formatMoney(detailModal.service.unitPrice)}/{detailModal.service.unitName}
                </Badge>
              </div>
            </div>

            {/* Service Description */}
            {detailModal.service.description && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Mô tả dịch vụ
                </h4>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {detailModal.service.description}
                  </p>
                </div>
              </div>
            )}

            {/* Service Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Đơn giá</p>
                <p className="text-lg font-bold text-[hsl(var(--primary))]">
                  {formatMoney(detailModal.service.unitPrice)}
                </p>
                <p className="text-xs text-gray-400 mt-1">/{detailModal.service.unitName}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Trạng thái</p>
                <Badge tone={detailModal.service.isActive ? "info" : "cancelled"} className="mt-1">
                  {detailModal.service.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
                </Badge>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setDetailModal({ open: false, service: null })}
              >
                Đóng
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => {
                  setServiceId(detailModal.service!.id);
                  setDetailModal({ open: false, service: null });
                }}
              >
                Chọn dịch vụ này
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
