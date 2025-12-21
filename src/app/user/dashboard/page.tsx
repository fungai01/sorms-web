"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useUserBookings, useMyServiceOrders } from "@/hooks/useApi";
import { useMemo } from "react";
import type { Booking, ServiceOrder } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

export default function UserDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: bookings, loading: bookingsLoading } = useUserBookings();
  const { data: orders, loading: ordersLoading } = useMyServiceOrders();

  // Get current active booking (CHECKED_IN or APPROVED)
  const currentBooking = useMemo(() => {
    if (!bookings) return null;
    const bookingList = Array.isArray(bookings) ? bookings : (bookings as any).items || [];
    return bookingList.find(
      (b: Booking) => b.status === "CHECKED_IN" || b.status === "APPROVED"
    ) || bookingList[0] || null;
  }, [bookings]);

  // Count active bookings
  const activeBookingsCount = useMemo(() => {
    if (!bookings) return 0;
    const bookingList = Array.isArray(bookings) ? bookings : (bookings as any).items || [];
    return bookingList.filter(
      (b: Booking) => b.status === "CHECKED_IN" || b.status === "APPROVED"
    ).length;
  }, [bookings]);

  // Count service orders
  const serviceOrdersCount = useMemo(() => {
    if (!orders) return 0;
    const orderList = Array.isArray(orders) ? orders : (orders as any).items || [];
    return orderList.length;
  }, [orders]);

  // Count unpaid orders
  const unpaidOrdersCount = useMemo(() => {
    if (!orders) return 0;
    const orderList = Array.isArray(orders) ? orders : (orders as any).items || [];
    return orderList.filter((o: ServiceOrder) => o.status !== "COMPLETED").length;
  }, [orders]);

  const userName = user?.name || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : null) || user?.email || "Người dùng";
  const isLoading = authLoading || bookingsLoading || ordersLoading;

  const getStatusBadgeTone = (status: string): "checked-in" | "approved" | "pending" | "checked-out" | "cancelled" => {
    if (status === "CHECKED_IN") return "checked-in";
    if (status === "APPROVED") return "approved";
    if (status === "PENDING") return "pending";
    if (status === "CHECKED_OUT") return "checked-out";
    if (status === "CANCELLED" || status === "REJECTED") return "cancelled";
    return "pending";
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      PENDING: "Chờ duyệt",
      APPROVED: "Đã duyệt",
      CHECKED_IN: "Đã check-in",
      CHECKED_OUT: "Đã check-out",
      CANCELLED: "Đã hủy",
      REJECTED: "Từ chối",
    };
    return statusMap[status] || status;
  };

  if (isLoading) {
    return (
      <div className="px-4 lg:px-6 py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-gray-500">Đang tải...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-6">
      {/* Welcome / hero */}
      <Card className="mb-6">
        <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-gray-500">Chào mừng trở lại,</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">
              {userName}
            </h1>
            <p className="text-sm text-gray-600 mt-2">
              Quản lý nhanh đặt phòng, dịch vụ và hóa đơn của bạn.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/user/rooms">
              <Button variant="primary">Đặt phòng</Button>
            </Link>
            <Link href="/user/services">
              <Button variant="secondary">Đặt dịch vụ</Button>
            </Link>
          </div>
        </CardBody>
      </Card>

      {/* Room info + actions */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {currentBooking ? "Phòng hiện tại" : "Chưa có phòng đặt"}
                </h2>
                <p className="text-sm text-gray-500">
                  {currentBooking
                    ? "Thông tin đặt phòng đang diễn ra"
                    : "Bạn chưa có phòng nào đang được đặt"}
                </p>
              </div>
              {currentBooking && (
                <Badge tone={getStatusBadgeTone(currentBooking.status)}>
                  {getStatusText(currentBooking.status)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardBody>
            {currentBooking ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm mb-4">
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <p className="text-gray-500">Phòng</p>
                    <p className="text-base font-semibold text-gray-900">
                      {currentBooking.roomCode || `Phòng #${currentBooking.roomId}`}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <p className="text-gray-500">Check-in</p>
                    <p className="text-base font-semibold text-gray-900">
                      {new Date(currentBooking.checkinDate).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <p className="text-gray-500">Check-out</p>
                    <p className="text-base font-semibold text-gray-900">
                      {new Date(currentBooking.checkoutDate).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/user/rooms">
                    <Button variant="primary">Đặt phòng mới</Button>
                  </Link>
                  <Link href="/user/services">
                    <Button variant="secondary">Đặt dịch vụ</Button>
                  </Link>
                  <Link href="/user/orders">
                    <Button variant="ghost">Xem hóa đơn</Button>
                  </Link>
                  {currentBooking && (
                    <Link href="/user/face-register">
                      <Button variant="ghost">Đăng ký khuôn mặt</Button>
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="text-gray-500 mb-4">Bạn chưa có phòng nào đang được đặt</p>
                <Link href="/user/rooms">
                  <Button variant="primary">Đặt phòng ngay</Button>
                </Link>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Tóm tắt</h3>
              <span className="h-2 w-2 rounded-full bg-green-500"></span>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Đặt phòng đang ở</span>
                <span className="font-semibold text-gray-900">{activeBookingsCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Dịch vụ đã đặt</span>
                <span className="font-semibold text-gray-900">{serviceOrdersCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Hóa đơn chờ</span>
                <span className="font-semibold text-gray-900">{unpaidOrdersCount}</span>
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-gray-200">
              <Link href="/user/history" className="block w-full">
                <Button variant="secondary" className="w-full">Xem lịch sử thuê</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

