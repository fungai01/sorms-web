"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useUserBookings, useMyServiceOrders } from "@/hooks/useApi";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { Booking, ServiceOrder } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { getFaceStatus, registerFace, deleteFace } from "@/lib/services";
import { FaceCapture } from "@/components/ui/FaceCapture";

// ===== UI Components =====
function KPICard({ title, value, hint }: { 
  title: string; 
  value: string; 
  hint?: string; 
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
          {hint && <p className="text-sm text-gray-500">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

export default function UserDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: bookings, loading: bookingsLoading, refetch: refetchBookings } = useUserBookings();
  const { data: orders, loading: ordersLoading } = useMyServiceOrders();

  const [faceRegistered, setFaceRegistered] = useState<boolean | null>(null);
  const [faceLoading, setFaceLoading] = useState(false);
  const [qrModal, setQrModal] = useState<{ open: boolean; booking: Booking | null; qrData: string | null; loading: boolean }>({
    open: false,
    booking: null,
    qrData: null,
    loading: false,
  });
  const [detailModal, setDetailModal] = useState<{ open: boolean; booking: Booking | null }>({
    open: false, booking: null
  });
  const [editModal, setEditModal] = useState<{ open: boolean; booking: Booking | null }>({
    open: false, booking: null
  });
  const [cancelModal, setCancelModal] = useState<{ open: boolean; booking: Booking | null }>({
    open: false, booking: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    checkinDate: "",
    checkinTime: "14:00",
    checkoutDate: "",
    checkoutTime: "12:00",
    numGuests: 1,
    note: "",
  });
  const [cancelReason, setCancelReason] = useState("");

  // Face registration states
  const [faceCaptureOpen, setFaceCaptureOpen] = useState(false);
  const [faceConfirmModalOpen, setFaceConfirmModalOpen] = useState(false);
  const [faceCaptureStep, setFaceCaptureStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [faceCaptureImages, setFaceCaptureImages] = useState<{
    faceFront: string | null;
    faceLeft: string | null;
    faceRight: string | null;
    cccdFront: string | null;
    cccdBack: string | null;
  }>({
    faceFront: null,
    faceLeft: null,
    faceRight: null,
    cccdFront: null,
    cccdBack: null,
  });
  const [faceRegistering, setFaceRegistering] = useState(false);

  // Parse bookings
  const bookingList = useMemo(() => {
    if (!bookings) return [];
    return Array.isArray(bookings)
      ? bookings
      : (bookings as any).items || (bookings as any).data?.items || (bookings as any).data?.content || [];
  }, [bookings]);

  const activeBookings = useMemo(() => {
    const filtered = bookingList.filter((b: Booking) => b.status === "CHECKED_IN" || b.status === "APPROVED");
    // Sắp xếp theo checkinDate giảm dần để lấy mới nhất trước
    return filtered.sort((a: Booking, b: Booking) => {
      const dateA = new Date(a.checkinDate || 0).getTime();
      const dateB = new Date(b.checkinDate || 0).getTime();
      return dateB - dateA; // Giảm dần (mới nhất trước)
    });
  }, [bookingList]);

  const pendingBookings = useMemo(() => {
    const filtered = bookingList.filter((b: Booking) => b.status === "PENDING");
    // Sắp xếp theo checkinDate giảm dần để lấy mới nhất trước
    return filtered.sort((a: Booking, b: Booking) => {
      const dateA = new Date(a.checkinDate || 0).getTime();
      const dateB = new Date(b.checkinDate || 0).getTime();
      return dateB - dateA; // Giảm dần (mới nhất trước)
    });
  }, [bookingList]);

  // Parse orders
  const orderList = useMemo(() => {
    if (!orders) return [];
    return Array.isArray(orders) ? orders : (orders as any).items || (orders as any).data?.items || [];
  }, [orders]);

  const pendingOrders = useMemo(() => 
    orderList.filter((o: ServiceOrder) => o.status === "PENDING" || o.status === "CONFIRMED"), 
    [orderList]
  );

  const userName = user?.name || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : null) || user?.email || "Người dùng";
  const isLoading = authLoading || bookingsLoading || ordersLoading;

  useEffect(() => {
    const checkFace = async () => {
      if (!user) return;
      try {
        setFaceLoading(true);
        const res = await getFaceStatus(0);
        setFaceRegistered(!!res?.registered);
      } catch {
        setFaceRegistered(false);
      } finally {
        setFaceLoading(false);
      }
    };
    checkFace();
  }, [user]);

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
      CHECKED_IN: "Đang ở",
      CHECKED_OUT: "Đã trả",
      CANCELLED: "Đã hủy",
      REJECTED: "Từ chối",
      CONFIRMED: "Đã xác nhận",
      COMPLETED: "Hoàn thành",
    };
    return statusMap[status] || status;
  };

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

  const handleEdit = (booking: Booking) => {
    // Extract date and time from datetime string
    const checkinDateTime = booking.checkinDate.split('T');
    const checkoutDateTime = booking.checkoutDate.split('T');
    const checkinDate = checkinDateTime[0];
    const checkinTime = checkinDateTime[1] ? checkinDateTime[1].substring(0, 5) : "14:00";
    const checkoutDate = checkoutDateTime[0];
    const checkoutTime = checkoutDateTime[1] ? checkoutDateTime[1].substring(0, 5) : "12:00";
    setEditForm({
      checkinDate,
      checkinTime,
      checkoutDate,
      checkoutTime,
      numGuests: booking.numGuests || 1,
      note: booking.note || "",
    });
    setEditModal({ open: true, booking });
  };

  const handleSaveEdit = async () => {
    if (!editModal.booking) return;

    // Validate dates
    const checkinDate = new Date(editForm.checkinDate);
    const checkoutDate = new Date(editForm.checkoutDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkinDate < today) {
      setError("Ngày check-in không thể là ngày trong quá khứ");
      return;
    }
    if (checkoutDate <= checkinDate) {
      setError("Ngày check-out phải sau ngày check-in");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.updateBooking(editModal.booking.id, {
        roomId: editModal.booking.roomId,
        checkinDate: `${editForm.checkinDate}T${editForm.checkinTime}:00`,
        checkoutDate: `${editForm.checkoutDate}T${editForm.checkoutTime}:00`,
        numGuests: editForm.numGuests,
        note: editForm.note,
      });

      if (response.success) {
        setEditModal({ open: false, booking: null });
        await refetchBookings();
        setError(null);
      } else {
        setError(response.error || "Cập nhật thất bại. Vui lòng thử lại.");
      }
    } catch (err: any) {
      console.error("Error updating booking:", err);
      setError(err?.message || "Có lỗi xảy ra khi cập nhật booking");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelModal.booking) return;

    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.deleteBooking(cancelModal.booking.id);

      if (response.success) {
        setCancelModal({ open: false, booking: null });
        setCancelReason("");
        await refetchBookings();
        setError(null);
      } else {
        setError(response.error || "Xóa booking thất bại. Vui lòng thử lại.");
      }
    } catch (err: any) {
      console.error("Error deleting booking:", err);
      setError(err?.message || "Có lỗi xảy ra khi xóa booking");
    } finally {
      setLoading(false);
    }
  };

  const getDaysRemaining = (checkoutDate: string) => {
    const today = new Date();
    const checkout = new Date(checkoutDate);
    const diff = Math.ceil((checkout.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const handleShowQR = (booking: Booking) => {
    const qrUrl = (booking as any).qrImageUrl || null;
    setQrModal({ open: true, booking, qrData: qrUrl, loading: false });
  };

  const handleCheckout = async (bookingId: number) => {
    window.location.href = `/user/checkout?bookingId=${bookingId}`;
  };

  // Face registration handlers
  const handleCapturedFaceImage = async (imageSrc: string) => {
    const stepMap: { [k in 1 | 2 | 3 | 4 | 5]: keyof typeof faceCaptureImages } = {
      1: "faceFront",
      2: "faceLeft",
      3: "faceRight",
      4: "cccdFront",
      5: "cccdBack",
    };

    const key = stepMap[faceCaptureStep];

    setFaceCaptureImages((prev) => ({
      ...prev,
      [key]: imageSrc,
    }));

    // Nếu còn bước tiếp theo: chuyển sang bước tiếp theo và giữ modal mở để chụp tiếp
    // Nếu đã là bước 5: đóng FaceCapture modal và mở modal xác nhận
    if (faceCaptureStep < 5) {
      const next = (faceCaptureStep + 1) as 1 | 2 | 3 | 4 | 5;
      setFaceCaptureStep(next);
    } else {
      setFaceCaptureOpen(false);
      setFaceConfirmModalOpen(true);
    }
  };

  const allFaceImagesCaptured =
    faceCaptureImages.faceFront &&
    faceCaptureImages.faceLeft &&
    faceCaptureImages.faceRight &&
    faceCaptureImages.cccdFront &&
    faceCaptureImages.cccdBack;

  const handleSubmitFaceRegister = async () => {
    if (!allFaceImagesCaptured) {
      return;
    }

    try {
      setFaceRegistering(true);

      // Nếu đã có dữ liệu khuôn mặt thì xóa trước khi đăng ký lại
      if (faceRegistered) {
        try {
          await deleteFace(0); // backend dùng userId từ token, tham số này không quan trọng
        } catch (e) {
          console.warn("Xóa dữ liệu khuôn mặt cũ thất bại (bỏ qua, tiếp tục đăng ký mới):", e);
        }
      }

      const imageSrcs = [
        faceCaptureImages.faceFront,
        faceCaptureImages.faceLeft,
        faceCaptureImages.faceRight,
        faceCaptureImages.cccdFront,
        faceCaptureImages.cccdBack,
      ].filter(Boolean) as string[];

      const blobs = await Promise.all(
        imageSrcs.map((src, idx) =>
          fetch(src)
            .then((res) => res.blob())
            .then(
              (blob) =>
                new File([blob], `face-${idx}-${Date.now()}.jpg`, {
                  type: "image/jpeg",
                })
            )
        )
      );

      const formData = new FormData();
      blobs.forEach((file) => formData.append("images", file));

      await registerFace(formData);

      setFaceRegistered(true);
      setFaceConfirmModalOpen(false);
      // Reset state
      setFaceCaptureImages({
        faceFront: null,
        faceLeft: null,
        faceRight: null,
        cccdFront: null,
        cccdBack: null,
      });
      setFaceCaptureStep(1);
      // Refresh face status
      try {
        const res = await getFaceStatus(0);
        setFaceRegistered(!!res?.registered);
      } catch {
        // ignore
      }
    } catch (err: any) {
      console.error("Face register error:", err);
      const rawMessage = err?.message || "";
      let friendly = rawMessage || "Đăng ký khuôn mặt thất bại. Vui lòng thử lại.";

      if (
        rawMessage.toLowerCase().includes("unauthenticated") ||
        rawMessage.toLowerCase().includes("not authenticated") ||
        rawMessage.toLowerCase().includes("unauthorized")
      ) {
        friendly = "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng xuất và đăng nhập lại trước khi đăng ký khuôn mặt.";
      }

      alert(friendly);
    } finally {
      setFaceRegistering(false);
    }
  };

  const handleOpenFaceRegistration = () => {
    setFaceCaptureImages({
      faceFront: null,
      faceLeft: null,
      faceRight: null,
      cccdFront: null,
      cccdBack: null,
    });
    setFaceCaptureStep(1);
    setFaceCaptureOpen(true);
  };

  return (
    <div className="px-6 pt-4 pb-6" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
          <div className="border-b border-gray-200/50 px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">Chào mừng trở lại,</p>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">{userName}</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Quản lý đặt phòng, dịch vụ và hóa đơn của bạn
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
            </div>
          </div>
        </div>

        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoading ? (
            <>
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </>
          ) : (
            <>
              <KPICard 
                title="Phòng đang ở" 
                value={String(activeBookings.length)} 
                hint="Phòng hiện tại"
              />
              <KPICard 
                title="Chờ duyệt" 
                value={String(pendingBookings.length)} 
                hint="Yêu cầu đang chờ"
              />
              <KPICard 
                title="Đơn dịch vụ" 
                value={String(pendingOrders.length)} 
                hint="Đang xử lý"
              />
            </>
          )}
        </section>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Bookings */}
          <div className="xl:col-span-2 space-y-6">
            {/* Active Bookings */}
            <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {activeBookings.length > 0 ? "Phòng hiện tại" : "Chưa có phòng đặt"}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {activeBookings.length > 0
                        ? "Các phòng bạn đang ở hoặc đã được duyệt"
                        : "Bạn chưa có phòng nào đang được đặt"}
                    </p>
                  </div>
                  {activeBookings.length > 0 && (
                    <Link href="/user/history" className="text-sm text-[hsl(var(--primary))] hover:underline font-medium">
                      Xem tất cả
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardBody className="p-6">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20" />
                  </div>
                ) : activeBookings.length > 0 ? (
                  <div className="space-y-3">
                    {activeBookings.slice(0, 2).map((b: Booking) => {
                      const daysLeft = getDaysRemaining(b.checkoutDate);
                      const showCheckout = b.status === "CHECKED_IN" && daysLeft <= 2;
                      return (
                        <div
                          key={b.id}
                          className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors hover:bg-[#f2f8fe]"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">
                                  {b.roomCode || `Phòng #${b.roomId}`}
                                </span>
                                <Badge tone={getStatusBadgeTone(b.status)}>
                                  {getStatusText(b.status)}
                                </Badge>
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatDate(b.checkinDate)} - {formatDate(b.checkoutDate)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {b.status === "CHECKED_IN" && daysLeft > 0 && (
                                <span className="text-sm text-gray-500">
                                  Còn <span className="font-semibold text-[hsl(var(--primary))]">{daysLeft} ngày</span>
                                </span>
                              )}
                              <Button 
                                variant="secondary" 
                                className="h-9 px-4 text-sm bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                                onClick={() => handleShowQR(b)}
                              >
                                Xem QR
                              </Button>
                              {showCheckout && (
                                <Button 
                                  variant="primary" 
                                  className="h-9 px-4 text-sm"
                                  onClick={() => handleCheckout(b.id)}
                                >
                                  Check-out
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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

            {/* Pending Bookings */}
            {pendingBookings.length > 0 && (
              <Card className="bg-white/80 backdrop-blur-sm border border-orange-200/50 shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="bg-orange-50/40 border-b border-orange-200 !px-6 py-3">
                  <h2 className="text-xl font-bold text-gray-900">Đang chờ duyệt</h2>
                  <p className="text-sm text-gray-500">{pendingBookings.length} yêu cầu đang chờ xử lý</p>
                </CardHeader>
                <CardBody className="p-6">
                  <div className="space-y-3">
                    {pendingBookings.slice(0, 2).map((b: Booking) => (
                      <div key={b.id} className="border border-orange-200 bg-orange-50/50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className="font-medium text-gray-900">{b.roomCode || `Phòng #${b.roomId}`}</span>
                            <p className="text-sm text-gray-500 mt-1">
                              {formatDate(b.checkinDate)} - {formatDate(b.checkoutDate)}
                            </p>
                          </div>
                          <Badge tone="pending">Chờ duyệt</Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button 
                            variant="secondary" 
                            className="h-8 text-xs px-3" 
                            onClick={() => handleViewDetail(b)}
                          >
                            Chi tiết
                          </Button>
                          <Button 
                            variant="secondary" 
                            className="h-8 text-xs px-3 bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200" 
                            onClick={() => handleEdit(b)}
                          >
                            Điều chỉnh
                          </Button>
                          <Button 
                            variant="secondary" 
                            className="h-8 text-xs px-3 bg-red-50 text-red-700 border-red-200 hover:bg-red-100" 
                            onClick={() => setCancelModal({ open: true, booking: b })}
                          >
                            Hủy
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-6">
            {/* Summary */}
            <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">Tóm tắt</h3>
                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                </div>
              </CardHeader>
              <CardBody className="p-6">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">Phòng đang ở</span>
                    <span className="font-bold text-gray-900">{activeBookings.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">Chờ duyệt</span>
                    <span className="font-bold text-gray-900">{pendingBookings.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">Đơn dịch vụ</span>
                    <span className="font-bold text-gray-900">{pendingOrders.length}</span>
                  </div>
                  <div 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={handleOpenFaceRegistration}
                  >
                    <span className="text-gray-600">Xác thực khuôn mặt</span>
                    <span className="font-bold text-gray-900">
                      {faceLoading ? "-" : faceRegistered ? "Đã đăng ký" : "Chưa"}
                    </span>
                  </div>
                </div>
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <Link href="/user/history" className="block w-full">
                    <Button variant="secondary" className="w-full">Xem lịch sử thuê</Button>
                  </Link>
                </div>
              </CardBody>
            </Card>

            {/* Face Registration Alert */}
            {!faceLoading && !faceRegistered && (
              <Card className="border-orange-200 bg-orange-50/50 rounded-2xl overflow-hidden">
                <CardBody className="p-6">
                  <h4 className="font-semibold text-orange-800 mb-1">Chưa xác thực khuôn mặt</h4>
                  <p className="text-sm text-orange-600 mb-3">
                    Đăng ký khuôn mặt để check-in nhanh hơn
                  </p>
                  <Link href="/user/rooms">
                    <Button variant="primary" className="w-full">Đăng ký ngay</Button>
                  </Link>
                </CardBody>
              </Card>
            )}

          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      <Modal
        open={qrModal.open}
        onClose={() => setQrModal({ open: false, booking: null, qrData: null, loading: false })}
        title="Mã QR Check-in"
      >
        <div className="text-center">
          {qrModal.booking && (
            <div className="mb-4">
              <p className="text-lg font-semibold text-gray-900">
                {qrModal.booking.roomCode || `Phòng #${qrModal.booking.roomId}`}
              </p>
              <p className="text-sm text-gray-500">
                {formatDate(qrModal.booking.checkinDate)} - {formatDate(qrModal.booking.checkoutDate)}
              </p>
            </div>
          )}
          
          {qrModal.loading ? (
            <div className="py-12">
              <div className="w-8 h-8 border-4 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-gray-500 mt-3">Đang tải mã QR...</p>
            </div>
          ) : qrModal.qrData ? (
            <div className="bg-white p-4 rounded-lg inline-block border border-gray-200">
              <img 
                src={qrModal.qrData} 
                alt="QR Code" 
                className="w-48 h-48 mx-auto"
              />
            </div>
          ) : (
            <div className="py-8">
              <p className="text-gray-500">Không thể tải mã QR</p>
            </div>
          )}
          
          <p className="text-xs text-gray-500 mt-4">
            Đưa mã QR này cho nhân viên để check-in
          </p>
          
          <div className="mt-4 flex gap-3">
            {qrModal.qrData && (
              <Button 
                variant="primary" 
                className="flex-1"
                onClick={async () => {
                  try {
                    const response = await fetch(qrModal.qrData!);
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
                    window.open(qrModal.qrData!, '_blank');
                  }
                }}
              >
                Tải về
              </Button>
            )}
            <Button 
              variant="secondary" 
              className={qrModal.qrData ? "flex-1" : "w-full"}
              onClick={() => setQrModal({ open: false, booking: null, qrData: null, loading: false })}
            >
              Đóng
            </Button>
          </div>
        </div>
      </Modal>

      {/* Face Capture Modal */}
      <FaceCapture
        open={faceCaptureOpen}
        onClose={() => {
          setFaceCaptureOpen(false);
          // Reset về bước 1 khi đóng
          setFaceCaptureStep(1);
        }}
        loading={faceRegistering}
        onCapture={handleCapturedFaceImage}
        title={
          faceCaptureStep === 4
            ? "Chụp CCCD mặt trước"
            : faceCaptureStep === 5
            ? "Chụp CCCD mặt sau"
            : "Chụp ảnh khuôn mặt"
        }
        overlayType={
          faceCaptureStep === 1
            ? "front"
            : faceCaptureStep === 2
            ? "left"
            : faceCaptureStep === 3
            ? "right"
            : undefined
        }
      />

      {/* Face Registration Submit Modal - hiển thị khi đã chụp đủ 5 ảnh */}
      {allFaceImagesCaptured && (
        <Modal
          open={faceConfirmModalOpen}
          onClose={() => {
            setFaceConfirmModalOpen(false);
            // Reset về bước 1
            setFaceCaptureStep(1);
            setFaceCaptureImages({
              faceFront: null,
              faceLeft: null,
              faceRight: null,
              cccdFront: null,
              cccdBack: null,
            });
          }}
          title="Xác nhận đăng ký khuôn mặt"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Bạn đã chụp đủ 5 ảnh. Bạn có muốn gửi để đăng ký khuôn mặt không?
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {faceCaptureImages.faceFront && (
                <div>
                  <p className="text-xs text-gray-600 mb-1">Khuôn mặt chính diện</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={faceCaptureImages.faceFront}
                    alt="Khuôn mặt chính diện"
                    className="w-full aspect-video object-cover rounded border"
                  />
                </div>
              )}
              {faceCaptureImages.faceLeft && (
                <div>
                  <p className="text-xs text-gray-600 mb-1">Khuôn mặt bên trái</p>
                  <img
                    src={faceCaptureImages.faceLeft}
                    alt="Khuôn mặt bên trái"
                    className="w-full aspect-video object-cover rounded border"
                  />
                </div>
              )}
              {faceCaptureImages.faceRight && (
                <div>
                  <p className="text-xs text-gray-600 mb-1">Khuôn mặt bên phải</p>
                  <img
                    src={faceCaptureImages.faceRight}
                    alt="Khuôn mặt bên phải"
                    className="w-full aspect-video object-cover rounded border"
                  />
                </div>
              )}
              {faceCaptureImages.cccdFront && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">CCCD mặt trước</p>
                  <img
                    src={faceCaptureImages.cccdFront}
                    alt="CCCD mặt trước"
                    className="w-full aspect-video object-cover rounded border"
                  />
                </div>
              )}
              {faceCaptureImages.cccdBack && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">CCCD mặt sau</p>
                  <img
                    src={faceCaptureImages.cccdBack}
                    alt="CCCD mặt sau"
                    className="w-full aspect-video object-cover rounded border"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setFaceConfirmModalOpen(false);
                  // Reset về bước 1
                  setFaceCaptureStep(1);
                  setFaceCaptureImages({
                    faceFront: null,
                    faceLeft: null,
                    faceRight: null,
                    cccdFront: null,
                    cccdBack: null,
                  });
                }}
                className="flex-1"
                disabled={faceRegistering}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmitFaceRegister}
                className="flex-1"
                disabled={faceRegistering}
              >
                {faceRegistering ? "Đang đăng ký..." : "Gửi đăng ký"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

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
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-600 mb-1">Ngày check-in</p>
              <p className="font-semibold text-gray-900">{formatDateTime(detailModal.booking.checkinDate)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-600 mb-1">Ngày check-out</p>
              <p className="font-semibold text-gray-900">{formatDateTime(detailModal.booking.checkoutDate)}</p>
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

      {/* Edit Modal */}
      <Modal
        open={editModal.open}
        onClose={() => {
          setEditModal({ open: false, booking: null });
          setError(null);
        }}
        title="Điều chỉnh thông tin đặt phòng"
        size="lg"
      >
        {editModal.booking && (
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Ngày check-in <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="date"
                  value={editForm.checkinDate}
                  onChange={(e) => setEditForm({ ...editForm, checkinDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
                <Input
                  type="time"
                  value={editForm.checkinTime}
                  onChange={(e) => setEditForm({ ...editForm, checkinTime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Ngày check-out <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="date"
                  value={editForm.checkoutDate}
                  onChange={(e) => setEditForm({ ...editForm, checkoutDate: e.target.value })}
                  min={editForm.checkinDate || new Date().toISOString().split('T')[0]}
                />
                <Input
                  type="time"
                  value={editForm.checkoutTime}
                  onChange={(e) => setEditForm({ ...editForm, checkoutTime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Số khách
              </label>
              <Input
                type="number"
                value={editForm.numGuests}
                onChange={(e) => setEditForm({ ...editForm, numGuests: parseInt(e.target.value) || 1 })}
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Ghi chú
              </label>
              <textarea
                value={editForm.note}
                onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                className="block w-full rounded-md border border-gray-300 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))]"
                rows={3}
                placeholder="Nhập ghi chú (nếu có)"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setEditModal({ open: false, booking: null });
                  setError(null);
                }}
                disabled={loading}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleSaveEdit}
                disabled={loading}
              >
                {loading ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Modal */}
      <Modal
        open={cancelModal.open}
        onClose={() => {
          setCancelModal({ open: false, booking: null });
          setCancelReason("");
          setError(null);
        }}
        title="Xóa đặt phòng"
      >
        {cancelModal.booking && (
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                {error}
              </div>
            )}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                Bạn có chắc chắn muốn xóa đặt phòng <strong>{cancelModal.booking.roomCode || `Phòng #${cancelModal.booking.roomId}`}</strong> không?
              </p>
              <p className="text-xs text-amber-700 mt-2">
                Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setCancelModal({ open: false, booking: null });
                  setCancelReason("");
                  setError(null);
                }}
                disabled={loading}
              >
                Không xóa
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={handleCancel}
                disabled={loading}
              >
                {loading ? "Đang xóa..." : "Xác nhận xóa"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
