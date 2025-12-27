"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useServices, useUserBookings } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import type { Service, Booking } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TBody } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";

export default function RequestServicePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [serviceId, setServiceId] = useState<number | "">("");
  const [bookingId, setBookingId] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number>(1);
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<{ open: boolean; service: Service | null }>({
    open: false,
    service: null,
  });
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [cartId, setCartId] = useState<number | null>(null);
  const creatingCartRef = useRef(false);
  const findingCartRef = useRef(false);

  // Pagination + filters
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: servicesData, loading: servicesLoading } = useServices({
    isActive: true,
    page: currentPage,
    size: pageSize,
    q: searchQuery || undefined,
  });
  const { data: bookingsData, loading: bookingsLoading } = useUserBookings();

  const services = useMemo(() => {
    if (!servicesData) return [];
    return Array.isArray(servicesData) ? servicesData : (servicesData as any).items || [];
  }, [servicesData]);

  const filteredServices = useMemo(() => {
    if (!searchQuery) return services;
    const query = searchQuery.toLowerCase();
    return services.filter(
      (s: Service) => s.name.toLowerCase().includes(query) || s.description?.toLowerCase().includes(query)
    );
  }, [services, searchQuery]);

  const bookings = useMemo(() => {
    if (!bookingsData) return [];
    const bookingList = Array.isArray(bookingsData) ? bookingsData : (bookingsData as any).items || [];

    return bookingList.filter((b: Booking) => b.status === "CHECKED_IN" && b.isActive !== false);
  }, [bookingsData]);

  const getBookingStatus = (status?: Booking["status"]) => {
    switch (status) {
      case "CHECKED_IN":
        return { label: "Đang ở", tone: "checked-in" as const };
      default:
        return { label: status || "Không xác định", tone: "muted" as const };
    }
  };

  const selectedService = useMemo(() => {
    if (!serviceId) return null;
    return filteredServices.find((s: Service) => s.id === serviceId);
  }, [serviceId, filteredServices]);

  const totalPrice = useMemo(() => {
    if (!selectedService) return 0;
    return selectedService.unitPrice * quantity;
  }, [selectedService, quantity]);

  const formatMoney = (amount: number) => {
    return amount?.toLocaleString("vi-VN") + " đ";
  };

  const findExistingCart = useCallback(
    async (bookingIdParam: number) => {
      if (!user?.id || findingCartRef.current) return null;

      try {
        findingCartRef.current = true;
        const existingOrdersRes = await apiClient.getMyOrders(bookingIdParam);
        if (existingOrdersRes.success && Array.isArray(existingOrdersRes.data)) {
          const existingCart = (existingOrdersRes.data as any[]).find((order: any) => {
            const status = order.status || order.orderStatus;
            return status === "PENDING" || status === "IN_PROGRESS";
          });
          if (existingCart?.id) {
            setCartId(existingCart.id);
            return existingCart.id as number;
          }
        }
      } catch (err) {
        console.error("Error finding existing cart:", err);
      } finally {
        findingCartRef.current = false;
      }
      return null;
    },
    [user?.id]
  );

  const createCart = useCallback(
    async (bookingIdParam: number) => {
      if (!user?.id) {
        setError("Vui lòng đăng nhập để đặt dịch vụ");
        return false;
      }

      if (cartId) return true;

      const existingId = await findExistingCart(bookingIdParam);
      if (existingId) return true;

      if (creatingCartRef.current) {
        return false;
      }

      try {
        creatingCartRef.current = true;
        const cartResponse = await apiClient.createOrderCart({
          bookingId: bookingIdParam,
          requestedBy: String(user.id),
        });

        const responseData = cartResponse.data as any;
        const orderId = responseData?.id || responseData?.orderId;

        if (orderId) {
          setCartId(orderId);
          return true;
        }

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
      }
    },
    [user?.id, user?.id, cartId, findExistingCart]
  );

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

    const selectedBooking = bookings.find((b: Booking) => b.id === bookingId);
    if (!selectedBooking) {
      setError("Booking không tồn tại hoặc không còn hoạt động");
      return;
    }
    if (selectedBooking.status !== "CHECKED_IN") {
      setError("Booking phải ở trạng thái đã check-in để đặt dịch vụ");
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

    const cartCreated = await createCart(Number(bookingId));
    if (!cartCreated || !cartId) {
      return;
    }

    try {
      setSubmitting(true);
      const serviceTime = date ? `${date}T12:00:00` : undefined;
      const addItemResponse = await apiClient.addOrderItem(
        cartId,
        Number(serviceId),
        quantity,
        undefined,
        serviceTime,
        undefined
      );

      if (!addItemResponse.success) {
        setError(addItemResponse.error || "Không thể thêm dịch vụ");
        return;
      }

      await apiClient.confirmOrder(cartId);
      setSuccess(true);
      setCartId(null);
      setTimeout(() => router.push("/user/orders"), 2000);
    } catch (err) {
      console.error("Error:", err);
      setError("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="px-6 pt-4 pb-6" suppressHydrationWarning>
        <div className="max-w-7xl mx-auto">
          <div className="max-w-md w-full mx-auto bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">

            <div className="p-6">
              <div className="py-6 text-center">
                <div className="w-14 h-14 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Đặt dịch vụ thành công!</h3>
                <p className="text-sm text-gray-600 mb-6">Đang chuyển đến trang đơn hàng...</p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="secondary"
                    className="flex-1 bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                    onClick={() => router.push("/user/services")}
                  >
                    Tiếp tục đặt dịch vụ
                  </Button>
                  <Button variant="primary" className="flex-1" onClick={() => router.push("/user/orders")}>
                    Xem đơn hàng
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pt-4 pb-6" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header + Filters */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
          <div className="border-b border-gray-200/50 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Đặt dịch vụ</h1>
                <p className="mt-1 text-sm text-gray-500">Chọn dịch vụ và tạo đơn đặt dịch vụ</p>
              </div>

              <Button
                variant="secondary"
                className="h-10 px-4 text-sm font-medium bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                onClick={() => setOrderModalOpen(true)}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Tạo đơn
              </Button>
            </div>
          </div>

          <div className="bg-white px-6 py-4">
            {/* Mobile */}
            <div className="lg:hidden space-y-3">
              <div className="relative w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Tìm kiếm dịch vụ..."
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 pl-10 text-sm focus:outline-none focus:ring-0 focus:border-gray-300"
                />
                <svg
                  className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

            </div>

            {/* Desktop */}
            <div className="hidden lg:flex flex-row gap-4 items-center">
              <div className="flex-1 min-w-0 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Tìm kiếm dịch vụ..."
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 pl-10 text-sm focus:outline-none focus:ring-0 focus:border-gray-300"
                />
                <svg
                  className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>


              
            </div>
          </div>
        </div>

        {/* Services list */}
        <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Danh sách dịch vụ</h2>
              <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                {filteredServices.length} dịch vụ
              </span>
            </div>
          </CardHeader>

          <CardBody className="p-0">
            <div className="hidden lg:block overflow-x-auto">
              {servicesLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="p-12 text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-gray-500 font-medium">{searchQuery ? "Không tìm thấy dịch vụ phù hợp" : "Không có dịch vụ"}</p>
                </div>
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-bold">Tên dịch vụ</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Đơn vị</th>
                      <th className="px-4 py-3 text-right text-sm font-bold">Đơn giá</th>
                      <th className="px-4 py-3 text-center text-sm font-bold">Thao tác</th>
                    </tr>
                  </THead>
                  <TBody>
                    {filteredServices.map((service: Service, index: number) => (
                      <tr
                        key={service.id}
                        className={`transition-colors ${index % 2 === 0 ? "bg-white" : "bg-gray-100"} hover:bg-[#f2f8fe]`}
                      >
                        <td className="px-4 py-3 text-left">
                          <div className="font-semibold text-gray-900">{service.name}</div>
                          {service.description && <div className="text-xs text-gray-500 line-clamp-1">{service.description}</div>}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">{service.unitName || "-"}</td>
                        <td className="px-4 py-3 text-right font-bold text-[hsl(var(--primary))]">{formatMoney(service.unitPrice)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button
                              variant="secondary"
                              className="h-8 px-3 text-xs bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                              onClick={() => setDetailModal({ open: true, service })}
                            >
                              Xem
                            </Button>
                            <Button
                              variant="primary"
                              className="h-8 px-3 text-xs"
                              onClick={() => {
                                setServiceId(service.id);
                                setOrderModalOpen(true);
                              }}
                            >
                              Chọn
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>

            <div className="lg:hidden p-4 space-y-3">
              {servicesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="py-12 text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-gray-500 font-medium">{searchQuery ? "Không tìm thấy dịch vụ phù hợp" : "Không có dịch vụ"}</p>
                </div>
              ) : (
                filteredServices.map((service: Service) => (
                  <div
                    key={service.id}
                    className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 transition-colors hover:bg-[#f2f8fe]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-gray-900 truncate">{service.name}</h3>
                        {service.description && <p className="text-xs text-gray-500 line-clamp-2 mt-1">{service.description}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-base font-bold text-[hsl(var(--primary))]">{formatMoney(service.unitPrice)}</div>
                        <div className="text-xs text-gray-500">/{service.unitName}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <Badge tone={service.isActive ? "info" : "muted"} className="rounded-full">
                        {service.isActive ? "Đang hoạt động" : "Ngừng"}
                      </Badge>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="secondary"
                          className="h-9 px-3 text-sm bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                          onClick={() => setDetailModal({ open: true, service })}
                        >
                          Xem
                        </Button>
                        <Button
                          variant="primary"
                          className="h-9 px-3 text-sm"
                          onClick={() => {
                            setServiceId(service.id);
                            setOrderModalOpen(true);
                          }}
                        >
                          Chọn
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {!servicesLoading && filteredServices.length >= pageSize && (
              <div className="bg-gradient-to-r from-gray-50 to-[hsl(var(--page-bg))] px-6 py-6 border-t border-gray-200/50">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="text-center sm:text-left">
                    <div className="text-sm text-gray-600 mb-1">Trang hiện tại</div>
                    <div className="text-lg font-bold text-gray-900">
                      <span className="text-[hsl(var(--primary))]">{currentPage}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="secondary"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="h-10 px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Trước
                    </Button>

                    <Button
                      variant="secondary"
                      disabled={filteredServices.length < pageSize}
                      onClick={() => setCurrentPage((p) => p + 1)}
                      className="h-10 px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Sau
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Order Form Modal */}
        <Modal
          open={orderModalOpen}
          onClose={() => setOrderModalOpen(false)}
          title="Đơn đặt dịch vụ"
          size="lg"
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Error */}
            {error && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl overflow-hidden">
              <div className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900">Thông tin đơn</div>
                    <div className="text-xs text-gray-500">Chọn phòng, số lượng và ngày sử dụng</div>
                  </div>
                  {selectedService ? (
                    <Badge tone="info" className="rounded-full">
                      Đã chọn dịch vụ
                    </Badge>
                  ) : (
                    <Badge tone="muted" className="rounded-full">
                      Chưa chọn
                    </Badge>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Selected service */}
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500 mb-1">Dịch vụ</div>
                      {selectedService ? (
                        <div>
                          <div className="text-base font-bold text-gray-900 truncate">{selectedService.name}</div>
                          {selectedService.description && (
                            <div className="text-xs text-gray-500 line-clamp-2 mt-1">{selectedService.description}</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600">Vui lòng chọn dịch vụ từ danh sách</div>
                      )}
                    </div>

                    {selectedService && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-8 px-3 text-xs bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                        onClick={() => {
                          setServiceId("");
                          setQuantity(1);
                        }}
                      >
                        Bỏ chọn
                      </Button>
                    )}
                  </div>

                  {selectedService && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                        <div className="text-xs text-gray-500">Đơn giá</div>
                        <div className="text-sm font-bold text-[hsl(var(--primary))]">{formatMoney(selectedService.unitPrice)}</div>
                        <div className="text-xs text-gray-500">/{selectedService.unitName}</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                        <div className="text-xs text-gray-500">Tạm tính</div>
                        <div className="text-sm font-bold text-gray-900">{formatMoney(totalPrice)}</div>
                        <div className="text-xs text-gray-500">&nbsp;</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Booking */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phòng đang ở</label>
                  {bookingsLoading ? (
                    <div className="text-sm text-gray-500">Đang tải phòng...</div>
                  ) : bookings.length === 0 ? (
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                      <div className="text-sm font-semibold text-orange-900">Chưa có phòng đang ở</div>
                      <div className="text-xs text-orange-700 mt-1">Bạn cần có booking đang check-in để đặt dịch vụ</div>
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        value={bookingId || ""}
                        onChange={(e) => setBookingId(e.target.value ? Number(e.target.value) : "")}
                        className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:outline-none appearance-none bg-white"
                      >
                        <option value="">-- Chọn phòng --</option>
                        {bookings.map((booking: Booking) => (
                          <option key={booking.id} value={booking.id}>
                            {booking.roomCode || `Phòng #${booking.roomId}`} ({getBookingStatus(booking.status).label})
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quantity + date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sử dụng</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      min={today}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (tùy chọn)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none resize-none"
                    placeholder="Nhập yêu cầu đặc biệt hoặc ghi chú..."
                  />
                </div>

                {/* Total */}
                <div className="rounded-2xl border border-gray-200 bg-[hsl(var(--page-bg))]/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">Tổng cộng</span>
                    <span className="text-xl font-bold text-[hsl(var(--primary))]">{formatMoney(totalPrice)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1 bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                onClick={() => setOrderModalOpen(false)}
                disabled={submitting}
              >
                Đóng
              </Button>
              <Button
                type="submit"
                disabled={submitting || !serviceId || !bookingId || !date || bookings.length === 0}
                variant="primary"
                className="flex-1"
              >
                {submitting ? "Đang xử lý..." : "Đặt dịch vụ"}
              </Button>
            </div>
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
          <div className="space-y-4">
            <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl overflow-hidden">
              <div className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{detailModal.service.name}</h3>
                    {detailModal.service.code && (
                      <p className="text-xs text-gray-500 mt-1">Mã dịch vụ: #{detailModal.service.code}</p>
                    )}
                  </div>
                  <Badge tone={detailModal.service.isActive ? "info" : "muted"} className="rounded-full">
                    {detailModal.service.isActive ? "Đang hoạt động" : "Ngừng"}
                  </Badge>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                    <div className="text-xs text-gray-500">Đơn giá</div>
                    <div className="text-lg font-bold text-[hsl(var(--primary))]">{formatMoney(detailModal.service.unitPrice)}</div>
                    <div className="text-xs text-gray-500">/{detailModal.service.unitName}</div>
                  </div>

                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                    <div className="text-xs text-gray-500">Đơn vị</div>
                    <div className="text-sm font-semibold text-gray-900">{detailModal.service.unitName || "-"}</div>
                    <div className="text-xs text-gray-500">&nbsp;</div>
                  </div>
                </div>

                {detailModal.service.description && (
                  <div>
                    <div className="text-sm font-bold text-gray-900 mb-2">Mô tả</div>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{detailModal.service.description}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-3 border-t border-gray-200">
                  <Button
                    variant="secondary"
                    className="flex-1 bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
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
                      setOrderModalOpen(true);
                    }}
                  >
                    Chọn
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
