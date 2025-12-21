"use client";

import { useUserBookings, useMyServiceOrders } from "@/hooks/useApi";
import { useMemo } from "react";
import type { Booking, ServiceOrder } from "@/lib/types";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TBody } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

function getStatusBadgeTone(status: string): "checked-in" | "checked-out" | "pending" | "approved" | "cancelled" {
  if (status === "CHECKED_IN") return "checked-in";
  if (status === "CHECKED_OUT") return "checked-out";
  if (status === "PENDING") return "pending";
  if (status === "APPROVED") return "approved";
  if (status === "CANCELLED" || status === "REJECTED") return "cancelled";
  return "pending";
}

function getStatusText(status: string) {
  const statusMap: Record<string, string> = {
    PENDING: "Chờ duyệt",
    APPROVED: "Đã duyệt",
    CHECKED_IN: "Đã check-in",
    CHECKED_OUT: "Đã check-out",
    CANCELLED: "Đã hủy",
    REJECTED: "Từ chối",
  };
  return statusMap[status] || status;
}

export default function BookingHistoryPage() {
  const { data: bookingsData, loading: bookingsLoading } = useUserBookings();
  const { data: ordersData } = useMyServiceOrders();

  const bookings = useMemo(() => {
    if (!bookingsData) return [];
    const bookingList = Array.isArray(bookingsData) ? bookingsData : (bookingsData as any).items || [];
    return bookingList.sort((a: Booking, b: Booking) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [bookingsData]);

  const getOrderForBooking = (bookingId: number) => {
    if (!ordersData) return null;
    const orderList = Array.isArray(ordersData) ? ordersData : (ordersData as any).items || [];
    return orderList.find((o: ServiceOrder) => o.booking_id === bookingId);
  };

  return (
    <div className="px-4 lg:px-6 py-6">
      <div className="mb-4">
        <p className="text-sm text-gray-500">Lịch sử</p>
        <h1 className="text-lg font-semibold text-gray-900">Booking History</h1>
      </div>
      <Card>
        <CardHeader>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Lịch sử thuê phòng</h2>
            <p className="text-sm text-gray-500">
              Danh sách tất cả các lần đặt phòng và trạng thái.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          {bookingsLoading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Đang tải dữ liệu...
            </div>
          ) : (
            <>
              <Table>
                <THead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Phòng</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </THead>
                <TBody>
                  {bookings.map((b: Booking) => {
                    const order = getOrderForBooking(b.id);
                    return (
                      <tr key={b.id}>
                        <td className="font-medium">{b.code}</td>
                        <td>{b.roomCode || `Phòng #${b.roomId}`}</td>
                        <td>{new Date(b.checkinDate).toLocaleDateString("vi-VN")}</td>
                        <td>{new Date(b.checkoutDate).toLocaleDateString("vi-VN")}</td>
                        <td>
                          <Badge tone={getStatusBadgeTone(b.status)}>{getStatusText(b.status)}</Badge>
                        </td>
                        <td>
                          {order && (
                            <Link href="/user/orders">
                              <Button variant="ghost" className="text-xs">View Invoice</Button>
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </TBody>
              </Table>

              {bookings.length === 0 && (
                <div className="py-10 text-center text-sm text-gray-500">
                  Chưa có booking nào.
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}


