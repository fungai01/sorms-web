"use client";

import { useUserBookings } from "@/hooks/useApi";
import { useMemo, useState } from "react";
import type { Booking } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

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
    CHECKED_IN: "Đang ở",
    CHECKED_OUT: "Đã trả",
    CANCELLED: "Đã hủy",
    REJECTED: "Từ chối",
  };
  return statusMap[status] || status;
}

export default function BookingHistoryPage() {
  const { data: bookingsData, loading: bookingsLoading } = useUserBookings();
  const [filter, setFilter] = useState<string>("all");
  const [qrModal, setQrModal] = useState<{ open: boolean; booking: Booking | null }>({
    open: false, booking: null
  });
  const [detailModal, setDetailModal] = useState<{ open: boolean; booking: Booking | null }>({
    open: false, booking: null
  });

  const bookings = useMemo(() => {
    if (!bookingsData) return [];
    const bookingList = Array.isArray(bookingsData) ? bookingsData : (bookingsData as any).items || (bookingsData as any).data || [];
    let filtered = bookingList;
    
    if (filter !== "all") {
      filtered = bookingList.filter((b: Booking) => b.status === filter);
    }
    
    return filtered.sort((a: Booking, b: Booking) => 
      new Date(b.checkinDate).getTime() - new Date(a.checkinDate).getTime()
    );
  }, [bookingsData, filter]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleViewDetail = (booking: Booking) => {
    setDetailModal({ open: true, booking });
  };

  const filters = [
    { value: "all", label: "Tất cả" },
    { value: "PENDING", label: "Chờ duyệt" },
    { value: "APPROVED", label: "Đã duyệt" },
    { value: "CHECKED_IN", label: "Đang ở" },
    { value: "CHECKED_OUT", label: "Đã trả" },
    { value: "CANCELLED", label: "Đã hủy" },
  ];

  return (
    <div className="px-6 pt-4 pb-6" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
          <div className="border-b border-gray-200/50 px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Lịch sử đặt phòng</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Danh sách tất cả các lần đặt phòng của bạn
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap gap-2">
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === f.value
                  ? "bg-[hsl(var(--primary))] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {filter === "all" ? "Tất cả booking" : filters.find(f => f.value === filter)?.label}
              </h2>
              <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                {bookings.length} kết quả
              </span>
            </div>
          </CardHeader>
          <CardBody className="p-6">
          {bookingsLoading ? (
            <div className="py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(var(--primary))] mb-3"></div>
              <p className="text-sm text-gray-500">Đang tải dữ liệu...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="py-12 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="text-sm text-gray-500 font-medium">Không có booking nào</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b: Booking) => (
                <div key={b.id} className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all bg-white">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{b.roomCode || `Phòng #${b.roomId}`}</span>
                        <Badge tone={getStatusBadgeTone(b.status)}>{getStatusText(b.status)}</Badge>
                        {b.code && <span className="text-xs text-gray-400">#{b.code}</span>}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(b.checkinDate)} - {formatDate(b.checkoutDate)}
                      </div>
                      {b.numGuests && (
                        <div className="text-xs text-gray-400">{b.numGuests} khách</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button 
                        variant="secondary" 
                        className="h-10 text-sm" 
                        onClick={() => handleViewDetail(b)}
                      >
                        Xem chi tiết
                      </Button>
                      {(b.status === "APPROVED" || b.status === "CHECKED_IN") && (b as any).qrImageUrl && (
                        <Button variant="secondary" className="h-10 text-sm" onClick={() => setQrModal({ open: true, booking: b })}>
                          Xem QR
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      </div>

      {/* QR Modal */}
      <Modal
        open={qrModal.open}
        onClose={() => setQrModal({ open: false, booking: null })}
        title="Mã QR Check-in"
      >
        <div className="text-center">
          {qrModal.booking && (
            <>
              <div className="mb-4">
                <p className="text-lg font-semibold text-gray-900">
                  {qrModal.booking.roomCode || `Phòng #${qrModal.booking.roomId}`}
                </p>
                <p className="text-sm text-gray-500">
                  {formatDate(qrModal.booking.checkinDate)} - {formatDate(qrModal.booking.checkoutDate)}
                </p>
              </div>
              
              {(qrModal.booking as any).qrImageUrl ? (
                <div className="bg-white p-4 rounded-lg inline-block border border-gray-200">
                  <img src={(qrModal.booking as any).qrImageUrl} alt="QR Code" className="w-48 h-48 mx-auto" />
                </div>
              ) : (
                <div className="py-8">
                  <p className="text-gray-500">Không có mã QR</p>
                </div>
              )}
              
              <div className="mt-4 flex gap-3">
                {(qrModal.booking as any).qrImageUrl && (
                  <Button 
                    variant="primary" 
                    className="flex-1"
                    onClick={async () => {
                      try {
                        const response = await fetch((qrModal.booking as any).qrImageUrl);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `QR_${qrModal.booking?.roomCode || qrModal.booking?.id}_checkin.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                      } catch {
                        window.open((qrModal.booking as any).qrImageUrl, '_blank');
                      }
                    }}
                  >
                    Tải về
                  </Button>
                )}
                <Button 
                  variant="secondary" 
                  className={(qrModal.booking as any).qrImageUrl ? "flex-1" : "w-full"}
                  onClick={() => setQrModal({ open: false, booking: null })}
                >
                  Đóng
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={detailModal.open}
        onClose={() => setDetailModal({ open: false, booking: null })}
        title="Chi tiết đặt phòng"
        size="lg"
      >
        {detailModal.booking && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-1">Mã phòng</p>
                <p className="font-semibold text-gray-900">
                  {detailModal.booking.roomCode || `Phòng #${detailModal.booking.roomId}`}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-1">Mã booking</p>
                <p className="font-semibold text-gray-900">{detailModal.booking.code}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-1">Trạng thái</p>
                <Badge tone={getStatusBadgeTone(detailModal.booking.status)}>
                  {getStatusText(detailModal.booking.status)}
                </Badge>
              </div>
              {detailModal.booking.numGuests && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">Số khách</p>
                  <p className="font-semibold text-gray-900">{detailModal.booking.numGuests}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-1">Ngày check-in</p>
                <p className="font-semibold text-gray-900">{formatDateTime(detailModal.booking.checkinDate)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-1">Ngày check-out</p>
                <p className="font-semibold text-gray-900">{formatDateTime(detailModal.booking.checkoutDate)}</p>
              </div>
            </div>
            {detailModal.booking.note && (
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-1">Ghi chú</p>
                <p className="text-gray-900">{detailModal.booking.note}</p>
              </div>
            )}
            <div className="pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setDetailModal({ open: false, booking: null })}
              >
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
