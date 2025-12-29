"use client";

import { useRoomsByIds, useUserBookings } from "@/hooks/useApi";
import { useMemo, useState, useEffect } from "react";
import type { Booking } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { createBookingNotification } from "@/lib/notifications";

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

// Key lưu snapshot trạng thái booking cho user hiện tại trong localStorage
const BOOKING_SNAPSHOT_KEY = "sorms_user_booking_status_snapshot";

type NotificationBookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED"
  | "CHECKED_IN"
  | "CHECKED_OUT";

// Map BookingStatus (có APPROVED) sang status dùng trong hệ thống notification
function mapBookingStatusToNotificationStatus(status: string): NotificationBookingStatus {
  if (status === "APPROVED") {
    return "CONFIRMED";
  }
  return status as NotificationBookingStatus;
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

  // Collect unique roomIds from bookings to lookup roomName
  const roomIds = useMemo(() => {
    if (!bookingsData) return [] as number[]
    const bookingList = Array.isArray(bookingsData)
      ? bookingsData
      : (bookingsData as any).items || (bookingsData as any).data || []

    const ids = new Set<number>()
    for (const b of bookingList as any[]) {
      const rid = Number((b as any).roomId ?? (b as any).room_id)
      if (Number.isFinite(rid)) ids.add(rid)
    }
    return Array.from(ids)
  }, [bookingsData])

  // Fetch rooms info for these ids
  const { data: roomsData } = useRoomsByIds(roomIds)

  const roomMap = useMemo(() => {
    const map = new Map<number, { name?: string; code?: string }>()
    const rooms: any[] = Array.isArray(roomsData) ? roomsData : []

    for (const r of rooms) {
      const rid = Number((r as any).id ?? (r as any).roomId)
      if (!Number.isFinite(rid)) continue
      const name = (r as any).name || (r as any).roomName
      const code = (r as any).code || (r as any).roomCode
      map.set(rid, {
        name: name ? String(name) : undefined,
        code: code ? String(code) : undefined,
      })
    }

    return map
  }, [roomsData])

  const bookings = useMemo(() => {
    if (!bookingsData) return []
    const bookingList = Array.isArray(bookingsData)
      ? bookingsData
      : (bookingsData as any).items || (bookingsData as any).data || []

    // Enrich booking with roomName/roomCode from roomMap (so UI can render)
    const enriched = (bookingList as any[]).map((b) => {
      const rid = Number((b as any).roomId ?? (b as any).room_id)
      const mapped = Number.isFinite(rid) ? roomMap.get(rid) : undefined
      return {
        ...b,
        roomName: (b as any).roomName || (b as any).room_name || mapped?.name,
        roomCode: (b as any).roomCode || (b as any).room_code || mapped?.code,
      }
    })

    let filtered: any[] = enriched
    if (filter !== "all") {
      filtered = enriched.filter((b: Booking) => b.status === filter)
    }

    return filtered.sort(
      (a: Booking, b: Booking) => new Date(b.checkinDate).getTime() - new Date(a.checkinDate).getTime()
    )
  }, [bookingsData, filter, roomMap])

  // Tự động tạo thông báo trên trình duyệt user khi trạng thái booking của chính họ thay đổi
  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentBookings: Booking[] = Array.isArray(bookings) ? bookings : [];
    if (currentBookings.length === 0) {
      // Không có booking, xóa snapshot cũ nếu có
      try {
        window.localStorage.removeItem(BOOKING_SNAPSHOT_KEY);
      } catch {
        // ignore
      }
      return;
    }

    let previousSnapshot: Record<number, string> = {};
    try {
      const raw = window.localStorage.getItem(BOOKING_SNAPSHOT_KEY);
      if (raw) {
        previousSnapshot = JSON.parse(raw);
      }
    } catch {
      previousSnapshot = {};
    }

    const isFirstSnapshot = !previousSnapshot || Object.keys(previousSnapshot).length === 0;
    const nextSnapshot: Record<number, string> = {};

    for (const booking of currentBookings) {
      const currentStatus = booking.status;
      nextSnapshot[booking.id] = currentStatus;

      if (!isFirstSnapshot) {
        const prevStatus = previousSnapshot[booking.id];
        if (prevStatus && prevStatus !== currentStatus) {
          // Chỉ tạo thông báo khi trạng thái thực sự thay đổi
          const notificationStatus = mapBookingStatusToNotificationStatus(currentStatus);
          const guestName =
            (booking as any).userName ||
            (booking as any).user_name ||
            "Bạn";
          const roomInfo =
            (booking as any).roomName ||
            (booking as any).room_name ||
            (booking as any).roomCode ||
            (booking as any).room_code ||
            `Phòng #${(booking as any).roomId}`;

          try {
            createBookingNotification(
              booking.id,
              guestName,
              roomInfo,
              notificationStatus
            );
          } catch (error) {
            // Không để lỗi notification làm hỏng UI lịch sử
            console.error("Error creating user booking notification:", error);
          }
        }
      }
    }

    try {
      window.localStorage.setItem(BOOKING_SNAPSHOT_KEY, JSON.stringify(nextSnapshot));
    } catch {
      // ignore storage errors
    }
  }, [bookings]);

  // Resolve room label: now roomName should be present after enrichment above
  const getRoomLabel = (booking: Booking) => {
    const b: any = booking as any

    if (b.roomName) return b.roomName
    if (b.room_name) return b.room_name
    if (b.room?.name) return b.room.name
    if (b.bookingData?.roomName) return b.bookingData.roomName

    if (b.roomCode) return b.roomCode
    if (b.room_code) return b.room_code
    if (b.roomNumber) return b.roomNumber
    if (b.room_number) return b.room_number

    const rid = Number(b.roomId ?? b.room_id)
    if (Number.isFinite(rid)) return `Phòng #${rid}`
    return "Phòng ?"
  }

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

  const formatDateTimeLine = (date: string) => {
    const d = new Date(date);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const mmMonth = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${hh}:${mm} ${dd}/${mmMonth}/${yyyy}`;
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
        {/* Header + Filters */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="border-b border-gray-200/50 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Lịch sử đặt phòng</h1>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white px-6 py-4">
            {/* Mobile */}
            <div className="lg:hidden space-y-3">
              <div className="relative w-full rounded-xl border border-gray-300 bg-white overflow-hidden">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 text-sm focus:outline-none appearance-none bg-transparent border-0"
                >
                  {filters.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Desktop */}
            <div className="hidden lg:flex flex-wrap gap-2">
              {filters.map((f) => {
                const isActive = filter === f.value;

                return (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={`relative px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border ${
                      isActive
                        ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))] shadow-sm"
                        : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bookings list container */}
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
          <div className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Danh sách đặt phòng</h2>
              <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                {bookings.length} kết quả
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {bookingsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse rounded-xl bg-gray-100 h-24" />
                ))}
              </div>
            ) : bookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <p className="text-gray-500 font-medium">Không có booking nào</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((b: Booking, index: number) => (
                  <div
                    key={b.id}
                    className={`rounded-2xl border border-gray-200 p-4 transition-colors hover:bg-[#f2f8fe] ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }`}
                  >
                  <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-lg text-gray-900">{getRoomLabel(b)}</span>
                          <Badge tone={getStatusBadgeTone(b.status)} className="text-xs rounded-full">
                            {getStatusText(b.status)}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {formatDate(b.checkinDate)} - {formatDate(b.checkoutDate)}
                          </span>
                        </div>
                       
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="secondary"
                          className="h-9 bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)] text-sm whitespace-nowrap"
                          onClick={() => handleViewDetail(b)}
                        >
                          Chi tiết
                        </Button>
                        {(b.status === "APPROVED" || b.status === "CHECKED_IN") && (b as any).qrImageUrl && (
                          <Button 
                            variant="secondary" 
                            className="h-9 text-sm whitespace-nowrap"
                            onClick={() => setQrModal({ open: true, booking: b })}
                          >
                            Xem QR
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
              <div className="flex items-center justify-between gap-4">
    <p className="text-lg font-semibold text-gray-900">
      Phòng: {getRoomLabel(qrModal.booking)}
    </p>
    <p className="text-sm text-gray-500 ml-auto">
      Ngày: {formatDate(qrModal.booking.checkinDate)} - {formatDate(qrModal.booking.checkoutDate)}
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
        title={`Chi tiết đặt phòng #${detailModal.booking?.code || detailModal.booking?.id || ''}`}
      >
        {detailModal.booking && (
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-[hsl(var(--page-bg))]/40 px-4 py-2 space-y-2">
                <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                  <span>Thông tin đặt phòng</span>
                  <Badge tone={getStatusBadgeTone(detailModal.booking.status)}>
                    {getStatusText(detailModal.booking.status)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div>
                    {detailModal.booking.numGuests && (
                      <span>Số khách: <span className="font-semibold text-gray-900">{detailModal.booking.numGuests}</span></span>
                    )}
                  </div>
                  <div>
                    Ngày: {formatDate(detailModal.booking.checkinDate)} - {formatDate(detailModal.booking.checkoutDate)}
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
              <div className="px-4 py-3 space-y-1.5">
              <p className="text-sm text-gray-900 flex">
  <span className="text-gray-500">Tên phòng: </span>
  <span className="font-medium ml-auto">{getRoomLabel(detailModal.booking)}</span>
</p>



  <p className="text-sm text-gray-900 flex">
    <span className="text-gray-500">Ngày check-in: </span>
    <span className="font-medium ml-auto">{formatDateTimeLine(detailModal.booking.checkinDate)}</span>
  </p>

  <p className="text-sm text-gray-900 flex">
    <span className="text-gray-500">Ngày check-out: </span>
    <span className="font-medium ml-auto">{formatDateTimeLine(detailModal.booking.checkoutDate)}</span>
  </p>
</div>

              </div>
            </div>

            {detailModal.booking.note && (
              <div className="text-sm">
                <span className="text-gray-500">Ghi chú: </span>
                <span>{detailModal.booking.note}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                className="flex-1 bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
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
