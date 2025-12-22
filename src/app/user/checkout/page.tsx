"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useMyServiceOrders } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import type { Booking, ServiceOrder, PaymentTransaction } from "@/lib/types";

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookingId = searchParams.get("bookingId");
  const { user } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Get service orders for this booking
  const { data: serviceOrdersData, loading: serviceOrdersLoading } = useMyServiceOrders(
    bookingId ? Number(bookingId) : undefined
  );

  useEffect(() => {
    const fetchBooking = async () => {
      if (!bookingId) {
        setError("Không tìm thấy mã đặt phòng");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Fetch booking details
        const response = await apiClient.getBooking(Number(bookingId));
        
        if (response.success && response.data) {
          setBooking(response.data as Booking);
        } else {
          setError(response.error || "Không thể tải thông tin đặt phòng");
        }
      } catch (err: any) {
        console.error("Error fetching booking:", err);
        setError(err?.message || "Có lỗi xảy ra khi tải thông tin đặt phòng");
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);

  // Fetch payments for service orders
  useEffect(() => {
    const fetchPayments = async () => {
      if (!serviceOrdersData || !bookingId) return;

      try {
        setPaymentsLoading(true);
        const response = await apiClient.getPaymentTransactions();
        
        if (response.success && response.data) {
          const allPayments = Array.isArray(response.data) 
            ? response.data 
            : (response.data as any).items || (response.data as any).data?.items || [];
          
          const serviceOrders = Array.isArray(serviceOrdersData)
            ? serviceOrdersData
            : (serviceOrdersData as any).items || (serviceOrdersData as any).data?.items || [];
          
          const serviceOrderIds = serviceOrders.map((so: ServiceOrder) => so.id);
          
          // Filter payments related to service orders of this booking
          const relatedPayments = allPayments.filter((p: PaymentTransaction) =>
            serviceOrderIds.includes(p.service_order_id)
          );
          
          setPayments(relatedPayments);
        }
      } catch (err) {
        console.error("Error fetching payments:", err);
        // Don't show error to user, just log it
      } finally {
        setPaymentsLoading(false);
      }
    };

    if (serviceOrdersData) {
      fetchPayments();
    }
  }, [serviceOrdersData, bookingId]);

  // Calculate total payment amount and status
  const paymentInfo = useMemo(() => {
    if (!payments.length) {
      return {
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        status: "NO_PAYMENT" as const,
        hasPending: false,
        hasPaid: false,
      };
    }

    const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const paidAmount = payments
      .filter((p) => p.status === "SUCCEEDED")
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const pendingAmount = payments
      .filter((p) => p.status === "PENDING")
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const hasPending = payments.some((p) => p.status === "PENDING");
    const hasPaid = payments.some((p) => p.status === "SUCCEEDED");

    let status: "NO_PAYMENT" | "PENDING" | "PARTIAL" | "PAID" = "NO_PAYMENT";
    if (hasPaid && hasPending) {
      status = "PARTIAL";
    } else if (hasPending) {
      status = "PENDING";
    } else if (hasPaid) {
      status = "PAID";
    }

    return {
      totalAmount,
      paidAmount,
      pendingAmount,
      status,
      hasPending,
      hasPaid,
    };
  }, [payments]);

  const handleCheckout = async () => {
    if (!booking || !bookingId) return;

    if (!user?.id) {
      setError("Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
      return;
    }

    // Kiểm tra payment status trước khi checkout
    if (paymentInfo.hasPending && paymentInfo.pendingAmount > 0) {
      const confirmMessage = `Bạn còn ${paymentInfo.pendingAmount.toLocaleString("vi-VN")} VNĐ chưa thanh toán. Bạn có chắc chắn muốn check-out không?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    try {
      setCheckingOut(true);
      setError(null);

      const response = await apiClient.checkoutBooking(Number(bookingId), user.id);

      if (response.success) {
        setSuccess(true);
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push("/user/dashboard");
        }, 2000);
      } else {
        setError(response.error || "Check-out thất bại. Vui lòng thử lại.");
      }
    } catch (err: any) {
      console.error("Error checking out:", err);
      setError(err?.message || "Có lỗi xảy ra khi thực hiện check-out");
    } finally {
      setCheckingOut(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadgeTone = (status: string): "checked-in" | "checked-out" | "pending" | "approved" | "cancelled" => {
    if (status === "CHECKED_IN") return "checked-in";
    if (status === "CHECKED_OUT") return "checked-out";
    if (status === "APPROVED") return "approved";
    if (status === "PENDING") return "pending";
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
    };
    return statusMap[status] || status;
  };

  const getPaymentStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      PENDING: "Chờ thanh toán",
      SUCCEEDED: "Đã thanh toán",
      FAILED: "Thanh toán thất bại",
      REFUNDED: "Đã hoàn tiền",
      NO_PAYMENT: "Chưa có thanh toán",
      PARTIAL: "Thanh toán một phần",
      PAID: "Đã thanh toán đủ",
    };
    return statusMap[status] || status;
  };

  const getPaymentMethodText = (method: string) => {
    const methodMap: Record<string, string> = {
      CASH: "Tiền mặt",
      CARD: "Thẻ",
      BANK_TRANSFER: "Chuyển khoản",
      WALLET: "Ví điện tử",
    };
    return methodMap[method] || method;
  };

  if (loading) {
    return (
      <div className="px-6 pt-4 pb-6" suppressHydrationWarning>
        <div className="max-w-3xl mx-auto">
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardBody className="p-12">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sm text-gray-500">Đang tải thông tin đặt phòng...</p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="px-6 pt-4 pb-6" suppressHydrationWarning>
        <div className="max-w-3xl mx-auto">
          <Card className="bg-white/80 backdrop-blur-sm border border-red-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardBody className="p-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Lỗi</h2>
                <p className="text-sm text-gray-600 mb-6">{error}</p>
                <Button variant="primary" onClick={() => router.push("/user/dashboard")}>
                  Quay lại Dashboard
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="px-6 pt-4 pb-6" suppressHydrationWarning>
        <div className="max-w-3xl mx-auto">
          <Card className="bg-white/80 backdrop-blur-sm border border-green-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardBody className="p-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Check-out thành công!</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Bạn đã check-out thành công. Đang chuyển về trang chủ...
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  if (!booking) {
    return null;
  }

  const canCheckout = booking.status === "CHECKED_IN";
  const hasUnpaidDebt = paymentInfo.hasPending && paymentInfo.pendingAmount > 0;

  return (
    <div className="px-6 pt-4 pb-6" suppressHydrationWarning>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
          <div className="border-b border-gray-200/50 px-6 py-4">
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">Check-out</h1>
            <p className="mt-1 text-sm text-gray-500">
              Xác nhận trả phòng và hoàn tất đặt phòng
            </p>
          </div>
        </div>

        {/* Booking Info */}
        <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Thông tin đặt phòng</h2>
              <Badge tone={getStatusBadgeTone(booking.status)}>
                {getStatusText(booking.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardBody className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600 font-medium">Mã phòng:</span>
                <span className="font-bold text-gray-900">
                  {booking.roomCode || `Phòng #${booking.roomId}`}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600 font-medium">Mã đặt phòng:</span>
                <span className="font-bold text-gray-900">{booking.code}</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600 font-medium">Ngày check-in:</span>
                <span className="font-bold text-gray-900">{formatDate(booking.checkinDate)}</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600 font-medium">Ngày check-out:</span>
                <span className="font-bold text-gray-900">{formatDate(booking.checkoutDate)}</span>
              </div>

              {booking.numGuests && (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="text-gray-600 font-medium">Số khách:</span>
                  <span className="font-bold text-gray-900">{booking.numGuests}</span>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Payment Info */}
        {(payments.length > 0 || paymentsLoading) && (
          <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
              <h2 className="text-xl font-bold text-gray-900">Thông tin thanh toán</h2>
            </CardHeader>
            <CardBody className="p-6">
              {paymentsLoading ? (
                <div className="text-center py-4">
                  <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Đang tải thông tin thanh toán...</p>
                </div>
              ) : payments.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600 font-medium">Tổng tiền:</span>
                    <span className="font-bold text-gray-900">
                      {paymentInfo.totalAmount.toLocaleString("vi-VN")} VNĐ
                    </span>
                  </div>
                  
                  {paymentInfo.paidAmount > 0 && (
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                      <span className="text-green-700 font-medium">Đã thanh toán:</span>
                      <span className="font-bold text-green-700">
                        {paymentInfo.paidAmount.toLocaleString("vi-VN")} VNĐ
                      </span>
                    </div>
                  )}
                  
                  {paymentInfo.pendingAmount > 0 && (
                    <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl">
                      <span className="text-amber-700 font-medium">Chờ thanh toán:</span>
                      <span className="font-bold text-amber-700">
                        {paymentInfo.pendingAmount.toLocaleString("vi-VN")} VNĐ
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600 font-medium">Trạng thái:</span>
                    <Badge 
                      tone={
                        paymentInfo.status === "PAID"
                          ? "success"
                          : paymentInfo.status === "PENDING" || paymentInfo.status === "PARTIAL"
                          ? "warning"
                          : "default"
                      }
                    >
                      {getPaymentStatusText(paymentInfo.status)}
                    </Badge>
                  </div>

                  {/* Payment Details */}
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Chi tiết thanh toán:</h3>
                    <div className="space-y-2">
                      {payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {payment.amount.toLocaleString("vi-VN")} VNĐ
                            </p>
                            <p className="text-xs text-gray-500">
                              {getPaymentMethodText(payment.method)} - {getPaymentStatusText(payment.status)}
                            </p>
                            {payment.paid_at && (
                              <p className="text-xs text-gray-400">
                                Thanh toán: {new Date(payment.paid_at).toLocaleDateString("vi-VN")}
                              </p>
                            )}
                          </div>
                          <Badge
                            tone={
                              payment.status === "SUCCEEDED"
                                ? "success"
                                : payment.status === "PENDING"
                                ? "warning"
                                : "default"
                            }
                          >
                            {getPaymentStatusText(payment.status)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">Chưa có thông tin thanh toán</p>
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Warning if cannot checkout */}
        {!canCheckout && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm text-amber-800">
              Phòng này không thể check-out. Chỉ có thể check-out các phòng đang ở (CHECKED_IN).
            </p>
          </div>
        )}

        {/* Warning if has unpaid debt */}
        {canCheckout && hasUnpaidDebt && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-800 mb-1">
                  Cảnh báo: Còn khoản thanh toán chưa hoàn tất
                </p>
                <p className="text-sm text-orange-700">
                  Bạn còn <span className="font-bold">{paymentInfo.pendingAmount.toLocaleString("vi-VN")} VNĐ</span> chưa thanh toán. 
                  Bạn vẫn có thể check-out, nhưng vui lòng thanh toán sớm để tránh phát sinh phí.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => router.push("/user/dashboard")}
            className="flex-1"
            disabled={checkingOut}
          >
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={handleCheckout}
            className="flex-1"
            disabled={!canCheckout || checkingOut}
          >
            {checkingOut ? (
              <span className="flex items-center gap-2">
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                Đang xử lý...
              </span>
            ) : (
              "Xác nhận Check-out"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

