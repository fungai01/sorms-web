"use client";

import { useState, useMemo } from "react";
import { useServices, useUserBookings } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import { authService } from "@/lib/auth-service";
import type { Service, Booking } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function RequestServicePage() {
  const [serviceId, setServiceId] = useState<number | "">("");
  const [bookingId, setBookingId] = useState<number | "">("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: servicesData, loading: servicesLoading } = useServices({ isActive: true });
  const { data: bookingsData, loading: bookingsLoading } = useUserBookings();

  const services = useMemo(() => {
    if (!servicesData) return [];
    return Array.isArray(servicesData) ? servicesData : (servicesData as any).items || [];
  }, [servicesData]);

  const bookings = useMemo(() => {
    if (!bookingsData) return [];
    const bookingList = Array.isArray(bookingsData) ? bookingsData : (bookingsData as any).items || [];
    return bookingList.filter((b: Booking) => b.status === "APPROVED" || b.status === "CHECKED_IN");
  }, [bookingsData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId || !bookingId || !date) {
      alert("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      setSubmitting(true);
      
      // Get user ID for requestedBy
      const userInfo = authService.getUserInfo();
      if (!userInfo?.id) {
        alert("Vui lòng đăng nhập lại");
        return;
      }

      // Step 1: Create order cart
      const cartResponse = await apiClient.createOrderCart({ bookingId: Number(bookingId) });
      if (!cartResponse.success) {
        alert(cartResponse.error || "Không thể tạo giỏ hàng. Vui lòng thử lại.");
        return;
      }
      
      const orderId = (cartResponse.data as any)?.id;
      if (!orderId) {
        alert("Không thể lấy ID đơn hàng. Vui lòng thử lại.");
        return;
      }

      // Step 2: Add service item to cart
      // Format date to LocalDateTime format (yyyy-MM-dd'T'HH:mm:ss)
      const serviceTime = date ? `${date}T12:00:00` : undefined;
      
      const addItemResponse = await apiClient.addOrderItem(
        orderId,
        Number(serviceId),
        1, // quantity
        undefined, // serviceDate (not used in cart workflow)
        serviceTime, // serviceTime
        undefined // assignedStaffId (not needed for cart workflow)
      );

      if (!addItemResponse.success) {
        alert(addItemResponse.error || "Không thể thêm dịch vụ vào giỏ hàng. Vui lòng thử lại.");
        return;
      }

      // Step 3: Confirm order (optional - can be done later)
      // For now, we'll confirm immediately
      const confirmResponse = await apiClient.confirmOrder(orderId);
      
      if (confirmResponse.success) {
        alert("Yêu cầu dịch vụ đã được tạo thành công!");
        setServiceId("");
        setBookingId("");
        setDate("");
        setDescription("");
      } else {
        // Order was created but not confirmed - still show success
        alert("Đơn hàng đã được tạo. Vui lòng xác nhận đơn hàng sau.");
        setServiceId("");
        setBookingId("");
        setDate("");
        setDescription("");
      }
    } catch (error) {
      console.error("Error creating service order:", error);
      alert("Có lỗi xảy ra khi tạo yêu cầu dịch vụ. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 lg:px-6 py-6">
      <div className="mb-4">
        <p className="text-sm text-gray-500">Dịch vụ</p>
        <h1 className="text-lg font-semibold text-gray-900">Request Service</h1>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Service icons / quick selection */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Dịch vụ khả dụng</h2>
          </CardHeader>
          <CardBody>
            {servicesLoading ? (
              <div className="text-sm text-gray-500">Đang tải...</div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {services.map((service: Service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setServiceId(service.id)}
                    className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-3 transition-colors text-left ${
                      serviceId === service.id
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-sm">{service.name}</div>
                      <div className="text-xs text-gray-500">{service.description || service.code}</div>
                    </div>
                    <div className="text-xs font-semibold">
                      {service.unitPrice.toLocaleString("vi-VN")} VNĐ/{service.unitName}
                    </div>
                  </button>
                ))}
                {services.length === 0 && (
                  <div className="text-sm text-gray-500 text-center py-4">
                    Không có dịch vụ nào khả dụng
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Request form */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Thông tin yêu cầu dịch vụ</h2>
          </CardHeader>
          <CardBody>
            <form className="space-y-4 text-sm" onSubmit={handleSubmit}>
              <div>
                <label className="block text-gray-600 mb-1">Đặt phòng</label>
                <select
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value === "" ? "" : Number(e.target.value))}
                  className="block w-full rounded-md border border-gray-300 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))]"
                  required
                  disabled={bookingsLoading}
                >
                  <option value="">Chọn đặt phòng</option>
                  {bookings.map((booking: Booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.code} - {booking.roomCode || `Phòng #${booking.roomId}`} ({new Date(booking.checkinDate).toLocaleDateString("vi-VN")} - {new Date(booking.checkoutDate).toLocaleDateString("vi-VN")})
                    </option>
                  ))}
                </select>
                {bookings.length === 0 && !bookingsLoading && (
                  <p className="text-xs text-amber-600 mt-1">
                    Bạn cần có đặt phòng đã được duyệt để đặt dịch vụ
                  </p>
                )}
              </div>

              <div>
                <label className="block text-gray-600 mb-1">Loại dịch vụ</label>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value === "" ? "" : Number(e.target.value))}
                  className="block w-full rounded-md border border-gray-300 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))]"
                  required
                  disabled={servicesLoading}
                >
                  <option value="">Chọn dịch vụ</option>
                  {services.map((service: Service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} - {service.unitPrice.toLocaleString("vi-VN")} VNĐ/{service.unitName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-600 mb-1">Ngày mong muốn</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-gray-600 mb-1">Mô tả chi tiết</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="block w-full rounded-md border border-gray-300 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] resize-none"
                  placeholder="Ví dụ: Cần dọn phòng vào buổi sáng, thay chăn ga, kiểm tra điều hòa..."
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={submitting || !serviceId || !bookingId || !date}
                  variant="primary"
                  className="w-full"
                >
                  {submitting ? "Đang xử lý..." : "Request Service"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}


