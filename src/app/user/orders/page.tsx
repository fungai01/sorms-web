"use client";

import { useUserBookings } from "@/hooks/useApi";
import { useMemo, useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { apiClient } from "@/lib/api-client";

function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

function getStatusBadgeTone(status: string): "completed" | "cancelled" | "in-progress" | "pending" | "error" | "warning" {
  switch (status) {
    case "COMPLETED": return "completed";
    case "CANCELLED": 
    case "REJECTED":
    case "FAILED": return "cancelled";
    case "IN_PROGRESS": return "in-progress";
    case "PENDING_PAYMENT":
    case "CONFIRMED": return "warning";
    default: return "pending";
  }
}

function getStatusText(status: string) {
  const statusMap: Record<string, string> = {
    PENDING: "Chờ xử lý",
    PENDING_STAFF_CONFIRMATION: "Chờ nhân viên xác nhận",
    REJECTED: "Bị từ chối",
    CONFIRMED: "Đã xác nhận",
    PENDING_PAYMENT: "Chờ thanh toán",
    IN_PROGRESS: "Đang xử lý",
    COMPLETED: "Hoàn thành",
    FAILED: "Thất bại",
    CANCELLED: "Đã hủy",
  };
  return statusMap[status] || status;
}

export default function OrdersPage() {
  const { data: bookingsData } = useUserBookings();
  const [filter, setFilter] = useState<string>("all");
  const [payingId, setPayingId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [detailModal, setDetailModal] = useState<{ open: boolean; order: any | null }>({ open: false, order: null });
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const bookings = useMemo(() => {
    if (!bookingsData) return [];
    return Array.isArray(bookingsData) ? bookingsData : (bookingsData as any).items || [];
  }, [bookingsData]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (bookings.length === 0) {
        setLoading(false);
        return;
      }
      
      try {
        const allOrders: any[] = [];
        for (const booking of bookings) {
          try {
            const res = await apiClient.getMyOrders(booking.id);
            if (res.success && Array.isArray(res.data)) {
              allOrders.push(...res.data);
            }
          } catch {}
        }
        setOrders(allOrders);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    
    if (bookings.length > 0) {
      fetchOrders();
    }
  }, [bookings]);

  const filteredOrders = useMemo(() => {
    let filtered = orders;
    if (filter !== "all") {
      filtered = orders.filter((o: any) => o.status === filter);
    }
    return filtered.sort((a: any, b: any) => 
      new Date(b.createdDate || b.created_at).getTime() - new Date(a.createdDate || a.created_at).getTime()
    );
  }, [orders, filter]);

  const formatDate = (date: string) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatMoney = (amount: number | string | undefined) => {
    if (!amount) return "0 đ";
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toLocaleString("vi-VN") + " đ";
  };

  const handlePay = async (order: any) => {
    const amount = order.totalAmount || order.total_amount || 0;
    if (!confirm(`Thanh toán đơn hàng #${order.code || order.id} với số tiền ${formatMoney(amount)}?`)) {
      return;
    }

    try {
      setPayingId(order.id);
      const response = await apiClient.createPayment({
        serviceOrderId: order.id,
        method: "BANK_TRANSFER",
        returnUrl: `${window.location.origin}/user/orders`,
        cancelUrl: `${window.location.origin}/user/orders`,
      });

      if (response.success) {
        const paymentData = response.data as any;
        if (paymentData?.paymentUrl) {
          window.location.href = paymentData.paymentUrl;
        } else {
          alert("Thanh toán đã được khởi tạo!");
          window.location.reload();
        }
      } else {
        alert(response.error || "Khởi tạo thanh toán thất bại");
      }
    } catch (error) {
      alert("Có lỗi xảy ra khi thanh toán");
    } finally {
      setPayingId(null);
    }
  };

  const handleCancel = async (order: any) => {
    if (!confirm(`Bạn có chắc muốn hủy đơn hàng #${order.code || order.id}?`)) {
      return;
    }

    try {
      setCancellingId(order.id);
      const response = await apiClient.cancelOrder(order.id);
      if (response.success) {
        alert("Đã hủy đơn hàng");
        window.location.reload();
      } else {
        alert(response.error || "Không thể hủy đơn hàng");
      }
    } catch {
      alert("Có lỗi xảy ra");
    } finally {
      setCancellingId(null);
    }
  };

  const canPay = (status: string) => ["PENDING_PAYMENT", "CONFIRMED"].includes(status);
  const canCancel = (status: string) => ["PENDING", "PENDING_STAFF_CONFIRMATION", "CONFIRMED"].includes(status);

  const filters = [
    { value: "all", label: "Tất cả" },
    { value: "PENDING_STAFF_CONFIRMATION", label: "Chờ xác nhận" },
    { value: "PENDING_PAYMENT", label: "Chờ thanh toán" },
    { value: "IN_PROGRESS", label: "Đang xử lý" },
    { value: "COMPLETED", label: "Hoàn thành" },
    { value: "CANCELLED", label: "Đã hủy" },
  ];

  const totalPending = useMemo(() => {
    return orders
      .filter((o: any) => canPay(o.status))
      .reduce((sum: number, o: any) => sum + (parseFloat(o.totalAmount || o.total_amount) || 0), 0);
  }, [orders]);

  return (
    <div className="px-6 pt-4 pb-6" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
          <div className="border-b border-gray-200/50 px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Đơn hàng dịch vụ</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Quản lý các đơn hàng dịch vụ của bạn
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        {totalPending > 0 && (
          <div className="py-3 rounded-xl px-4 border shadow-sm bg-orange-50 text-orange-800 border-orange-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Tổng cần thanh toán</p>
              <p className="text-xl font-bold text-orange-900">{formatMoney(totalPending)}</p>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex flex-wrap gap-2">
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === f.value
                  ? "bg-[hsl(var(--primary))] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Orders List */}
        <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Danh sách đơn hàng</h2>
              <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                {filteredOrders.length} đơn
              </span>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-12 text-center">
                <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm text-gray-500 font-medium">Không có đơn hàng nào</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredOrders.map((order: any) => {
                  const amount = order.totalAmount || order.total_amount || 0;
                  return (
                    <div key={order.id} className="p-4 lg:p-6 hover:bg-[#f2f8fe] transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">#{order.code || order.id}</span>
                            <Badge tone={getStatusBadgeTone(order.status)}>{getStatusText(order.status)}</Badge>
                          </div>
                          <div className="text-lg font-bold text-[hsl(var(--primary))]">{formatMoney(amount)}</div>
                          <div className="text-xs text-gray-400">
                            Ngày tạo: {formatDate(order.createdDate || order.created_at)}
                          </div>
                          {order.items && order.items.length > 0 && (
                            <div className="text-xs text-gray-500">
                              {order.items.length} dịch vụ
                            </div>
                          )}
                          {order.rejectionReason && (
                            <div className="text-xs text-red-500">
                              Lý do từ chối: {order.rejectionReason}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button 
                            variant="secondary" 
                            className="h-9 px-4 text-sm bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                            onClick={() => setDetailModal({ open: true, order })}
                          >
                            Chi tiết
                          </Button>
                          {canCancel(order.status) && (
                            <Button 
                              variant="secondary" 
                              className="h-9 px-4 text-sm"
                              onClick={() => handleCancel(order)}
                              disabled={cancellingId === order.id}
                            >
                              {cancellingId === order.id ? "Đang hủy..." : "Hủy"}
                            </Button>
                          )}
                          {canPay(order.status) && (
                            <Button 
                              variant="primary" 
                              className="h-9 px-4 text-sm"
                              onClick={() => handlePay(order)}
                              disabled={payingId === order.id}
                            >
                              {payingId === order.id ? "Đang xử lý..." : "Thanh toán"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Detail Modal */}
      <Modal
        open={detailModal.open}
        onClose={() => setDetailModal({ open: false, order: null })}
        title={`Chi tiết đơn hàng #${detailModal.order?.code || detailModal.order?.id || ''}`}
      >
        {detailModal.order && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge tone={getStatusBadgeTone(detailModal.order.status)}>
                {getStatusText(detailModal.order.status)}
              </Badge>
              <span className="text-sm text-gray-500">
                {formatDate(detailModal.order.createdDate || detailModal.order.created_at)}
              </span>
            </div>

            {detailModal.order.items && detailModal.order.items.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-[hsl(var(--page-bg))]/40 px-4 py-2 text-sm font-medium text-gray-700">
                  Danh sách dịch vụ
                </div>
                <div className="divide-y divide-gray-100">
                  {detailModal.order.items.map((item: any, idx: number) => (
                    <div key={idx} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{item.serviceName || item.service_name || `Dịch vụ #${item.serviceId}`}</p>
                        <p className="text-xs text-gray-500">SL: {item.quantity}</p>
                      </div>
                      <p className="font-semibold text-gray-900">{formatMoney(item.totalPrice || item.total_price)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-[hsl(var(--page-bg))]/40 rounded-xl p-4 space-y-2">
              {detailModal.order.subtotalAmount && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tạm tính</span>
                  <span>{formatMoney(detailModal.order.subtotalAmount)}</span>
                </div>
              )}
              {detailModal.order.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Giảm giá</span>
                  <span className="text-green-600">-{formatMoney(detailModal.order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg border-t border-gray-200 pt-2">
                <span>Tổng cộng</span>
                <span className="text-[hsl(var(--primary))]">{formatMoney(detailModal.order.totalAmount || detailModal.order.total_amount)}</span>
              </div>
            </div>

            {detailModal.order.note && (
              <div className="text-sm">
                <span className="text-gray-500">Ghi chú: </span>
                <span>{detailModal.order.note}</span>
              </div>
            )}

            <Button 
              variant="secondary" 
              className="w-full"
              onClick={() => setDetailModal({ open: false, order: null })}
            >
              Đóng
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
