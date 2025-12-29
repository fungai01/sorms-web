"use client";

import { useUserBookings, useServices, useStaffProfilesFiltered } from "@/hooks/useApi";
import { useMemo, useState, useEffect } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { apiClient } from "@/lib/api-client";

function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

// Helper function to normalize status string
function normalizeStatus(status: any): string {
  if (!status) return "";
  // Handle both string and object cases
  const statusStr = typeof status === "string" ? status : String(status);
  // Remove spaces, convert to uppercase, handle both underscore and camelCase
  return statusStr
    .replace(/\s+/g, "_")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toUpperCase()
    .trim();
}

function getStatusBadgeTone(status: string | any): "completed" | "cancelled" | "in-progress" | "pending" | "error" | "warning" {
  // Normalize status to uppercase for comparison
  const normalizedStatus = normalizeStatus(status);
  
  switch (normalizedStatus) {
    case "COMPLETED": 
      return "completed";
    case "CANCELLED": 
    case "REJECTED":
    case "FAILED": 
      return "cancelled";
    case "IN_PROGRESS": 
    case "INPROGRESS":
      return "in-progress";
    case "PENDING_PAYMENT":
    case "PENDINGPAYMENT":
    case "CONFIRMED": 
      return "warning";
    case "PENDING":
    case "PENDING_STAFF_CONFIRMATION":
    case "PENDINGSTAFFCONFIRMATION":
    default: 
      return "pending";
  }
}

function getStatusText(status: string | any) {
  // Normalize status to uppercase for comparison
  const normalizedStatus = normalizeStatus(status);
  
  const statusMap: Record<string, string> = {
    PENDING: "Chờ xử lý",
    PENDING_STAFF_CONFIRMATION: "Chờ nhân viên xác nhận",
    PENDINGSTAFFCONFIRMATION: "Chờ nhân viên xác nhận",
    REJECTED: "Bị từ chối",
    CONFIRMED: "Đã xác nhận",
    PENDING_PAYMENT: "Chờ thanh toán",
    PENDINGPAYMENT: "Chờ thanh toán",
    IN_PROGRESS: "Đang xử lý",
    INPROGRESS: "Đang xử lý",
    COMPLETED: "Hoàn thành",
    FAILED: "Thất bại",
    CANCELLED: "Đã hủy",
  };
  
  const displayText = statusMap[normalizedStatus] || normalizedStatus || "Không xác định";
  
  // Debug log nếu status không được map (chỉ trong development)
  if (process.env.NODE_ENV === "development" && !statusMap[normalizedStatus] && normalizedStatus) {
    console.warn(`Status chưa được map: "${normalizedStatus}" (từ giá trị gốc: "${status}")`);
  }
  
  return displayText;
}

function EditOrderItemRow({ 
  item, 
  orderId, 
  onUpdateQuantity, 
  onRemove, 
  editingItemId,
  formatMoney 
}: { 
  item: any; 
  orderId: number; 
  onUpdateQuantity: (orderId: number, itemId: number, quantity: number) => void | Promise<void>;
  onRemove: (orderId: number, itemId: number) => void;
  editingItemId: number | null;
  formatMoney: (amount: number | string | undefined) => string;
}) {
  const [quantity, setQuantity] = useState(item.quantity || 1);
  const [isUpdating, setIsUpdating] = useState(false);

  // Sync quantity with item when item changes
  useEffect(() => {
    setQuantity(item.quantity || 1);
  }, [item.quantity]);

  const handleQuantityChange = async (newQty: number) => {
    if (newQty <= 0) {
      alert("Số lượng phải lớn hơn 0");
      setQuantity(item.quantity || 1);
      return;
    }
    setIsUpdating(true);
    await onUpdateQuantity(orderId, item.id, newQty);
    setIsUpdating(false);
  };

  return (
    <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">
            {item.serviceName || item.service_name || `Dịch vụ ${item.serviceId}`}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatMoney(item.unitPrice || item.unit_price || 0)} / đơn vị
          </p>
        </div>
        <p className="font-semibold text-gray-900 ml-2 text-right whitespace-nowrap text-sm">
          {formatMoney(
            item.totalPrice ??
            item.total_price ??
            (Number(item.unitPrice ?? item.unit_price ?? 0) * Number(item.quantity ?? 0))
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-600 whitespace-nowrap">Số lượng:</label>
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => {
            const newQty = parseInt(e.target.value) || 1;
            setQuantity(newQty);
          }}
          onBlur={(e) => {
            const newQty = parseInt(e.target.value) || 1;
            if (newQty !== item.quantity) {
              handleQuantityChange(newQty);
            } else {
              setQuantity(item.quantity || 1);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
          disabled={editingItemId === item.id || isUpdating}
        />
        <Button
          variant="secondary"
          className="h-7 px-3 text-xs text-red-600 hover:bg-red-50 border border-red-200"
          onClick={() => onRemove(orderId, item.id)}
          disabled={editingItemId === item.id || isUpdating}
        >
          {editingItemId === item.id ? "Đang xóa..." : "Xóa"}
        </Button>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { data: bookingsData } = useUserBookings();
  const [filter, setFilter] = useState<string>("all");
  const [payingId, setPayingId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [detailModal, setDetailModal] = useState<{ open: boolean; order: any | null }>({ open: false, order: null });
  const [payConfirmModal, setPayConfirmModal] = useState<{ open: boolean; order: any | null }>({ open: false, order: null });
  const [editModal, setEditModal] = useState<{ open: boolean; order: any | null }>({ open: false, order: null });
  const [cancelConfirmModal, setCancelConfirmModal] = useState<{ open: boolean; order: any | null }>({ open: false, order: null });
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddService, setShowAddService] = useState(false);
  const [newServiceId, setNewServiceId] = useState<number | "">("");
  const [newServiceQuantity, setNewServiceQuantity] = useState<number>(1);
  const [newServiceTime, setNewServiceTime] = useState<string>("");
  const [addingService, setAddingService] = useState(false);
  
  const { data: servicesData } = useServices({ isActive: true });
  const { data: staffProfilesData } = useStaffProfilesFiltered("ACTIVE");
  const services = useMemo(() => {
    if (!servicesData) return [];
    return Array.isArray(servicesData) ? servicesData : (servicesData as any).items || [];
  }, [servicesData]);

  const staffNameById = useMemo(() => {
    const list = !staffProfilesData
      ? []
      : Array.isArray(staffProfilesData)
        ? staffProfilesData
        : (staffProfilesData as any).items || [];

    const map = new Map<number, string>();
    for (const sp of list as any[]) {
      const id = Number(sp?.id);
      if (!Number.isFinite(id)) continue;
      const name = sp?.fullName || sp?.name || sp?.accountName || sp?.workEmail
      map.set(id, String(name));
    }
    return map;
  }, [staffProfilesData]);

  const getAssignedStaffLabel = (order: any) => {
    const raw = order?.assignedStaffId ?? order?.assigned_staff_id ?? null;
    const id = raw != null ? Number(raw) : NaN;
    if (!Number.isFinite(id)) return null;
    const name = staffNameById.get(id);
    return name ? `${name}` : null;
  };

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

    if (filter && filter !== "all") {
      const filterStatusNormalized = normalizeStatus(filter);

      // Local mapping for grouped filters (avoid referencing `filters` before declaration)
      const grouped: Record<string, string[]> = {
        PENDING: ["PENDING", "PENDING_STAFF_CONFIRMATION", "CONFIRMED"],
        CANCELLED: ["CANCELLED", "REJECTED", "FAILED"],
      };

      const groupStatuses = grouped[filterStatusNormalized];

      if (groupStatuses) {
        const normalizedStatuses = groupStatuses.map(s => normalizeStatus(s));
        filtered = orders.filter((o: any) => {
          if (!o || !o.status) return false;
          const orderStatusNormalized = normalizeStatus(o.status);
          return normalizedStatuses.includes(orderStatusNormalized);
        });
      } else {
        filtered = orders.filter((o: any) => {
          if (!o || !o.status) return false;
          const orderStatusNormalized = normalizeStatus(o.status);
          return orderStatusNormalized === filterStatusNormalized;
        });
      }
    }

    return filtered.sort((a: any, b: any) =>
      new Date(b.createdDate || b.created_at).getTime() - new Date(a.createdDate || a.created_at).getTime()
    );
  }, [orders, filter]);

  const formatDate = (date: string) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatMoney = (amount: number | string | null | undefined) => {
    if (amount === null || amount === undefined) return "0 đ";
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (!Number.isFinite(num)) return "0 đ";
    return num.toLocaleString("vi-VN") + " đ";
  };

  const handlePay = async (order: any) => {
    const amount = order.totalAmount || order.total_amount || 0;
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
    setCancelConfirmModal({ open: true, order });
  };

  const handleConfirmCancel = async () => {
    const order = cancelConfirmModal.order;
    if (!order) return;

    try {
      setCancellingId(order.id);
      const response = await apiClient.cancelOrder(order.id);
      if (response.success) {
        setCancelConfirmModal({ open: false, order: null });
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

  const handleUpdateItemQuantity = async (orderId: number, itemId: number, quantity: number) => {
    if (quantity <= 0) {
      alert("Số lượng phải lớn hơn 0");
      return;
    }

    try {
      setEditingItemId(itemId);
      const response = await apiClient.updateOrderItem(orderId, itemId, quantity);
      if (response.success) {
        // Refresh orders list
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
        
        // Update edit modal order with fresh data
        if (editModal.order && editModal.order.id === orderId) {
          const updatedOrder = allOrders.find(o => o.id === orderId);
          if (updatedOrder) {
            setEditModal({ ...editModal, order: updatedOrder });
          }
        }
      } else {
        alert(response.error || "Không thể cập nhật số lượng");
      }
    } catch (error) {
      alert("Có lỗi xảy ra khi cập nhật");
    } finally {
      setEditingItemId(null);
    }
  };

  const handleRemoveItem = async (orderId: number, itemId: number) => {
    if (!confirm("Bạn có chắc muốn xóa dịch vụ này khỏi đơn hàng?")) {
      return;
    }

    try {
      setEditingItemId(itemId);
      const response = await apiClient.removeOrderItem(orderId, itemId);
      if (response.success) {
        // Refresh orders list
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
        
        // Update edit modal order with fresh data
        if (editModal.order && editModal.order.id === orderId) {
          const updatedOrder = allOrders.find(o => o.id === orderId);
          if (updatedOrder) {
            setEditModal({ ...editModal, order: updatedOrder });
          } else {
            // Order might be deleted if no items left, close modal
            setEditModal({ open: false, order: null });
            alert("Đã xóa dịch vụ. Đơn hàng đã được cập nhật.");
          }
        }
      } else {
        alert(response.error || "Không thể xóa dịch vụ");
      }
    } catch (error) {
      alert("Có lỗi xảy ra khi xóa");
    } finally {
      setEditingItemId(null);
    }
  };

  const handleAddService = async (orderId: number) => {
    if (!newServiceId || newServiceQuantity <= 0) {
      alert("Vui lòng chọn dịch vụ và nhập số lượng hợp lệ");
      return;
    }

    try {
      setAddingService(true);
      const serviceTime = newServiceTime || undefined;
      const response = await apiClient.addOrderItem(
        orderId,
        Number(newServiceId),
        newServiceQuantity,
        undefined,
        serviceTime,
        undefined
      );
      
      if (response.success) {
        // Refresh orders list
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
        
        // Update edit modal order with fresh data
        if (editModal.order && editModal.order.id === orderId) {
          const updatedOrder = allOrders.find(o => o.id === orderId);
          if (updatedOrder) {
            setEditModal({ ...editModal, order: updatedOrder });
          }
        }
        
        // Reset form
        setNewServiceId("");
        setNewServiceQuantity(1);
        setNewServiceTime("");
        setShowAddService(false);
        alert("Đã thêm dịch vụ vào đơn hàng");
      } else {
        alert(response.error || "Không thể thêm dịch vụ");
      }
    } catch (error) {
      alert("Có lỗi xảy ra khi thêm dịch vụ");
    } finally {
      setAddingService(false);
    }
  };

  const canPay = (status: string | any) => {
    const normalized = normalizeStatus(status);
    return ["PENDING_PAYMENT", "PENDINGPAYMENT", "CONFIRMED"].includes(normalized);
  };
  
  const canCancel = (status: string | any) => {
    const normalized = normalizeStatus(status);
    return ["PENDING", "PENDING_STAFF_CONFIRMATION", "PENDINGSTAFFCONFIRMATION", "CONFIRMED"].includes(normalized);
  };
  
  const canEdit = (status: string | any) => {
    const normalized = normalizeStatus(status);
    return normalized === "PENDING";
  };

  const filters = [
    { value: "all", label: "Tất cả" },
    { value: "pending", label: "Chờ xử lý", statuses: ["PENDING", "PENDING_STAFF_CONFIRMATION", "CONFIRMED"] },
    { value: "PENDING_PAYMENT", label: "Chờ thanh toán" },
    { value: "IN_PROGRESS", label: "Đang xử lý" },
    { value: "COMPLETED", label: "Hoàn thành" },
    { value: "cancelled", label: "Đã hủy", statuses: ["CANCELLED", "REJECTED", "FAILED"] },
  ];


  const totalPending = useMemo(() => {
    return orders
      .filter((o: any) => canPay(o.status))
      .reduce((sum: number, o: any) => sum + (parseFloat(o.totalAmount || o.total_amount) || 0), 0);
  }, [orders]);

  return (
    <div className="px-6 pt-4 pb-6" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header + Filters (Admin pattern container) */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="border-b border-gray-200/50 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Đơn hàng của tôi</h1>
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
                const isActive =
                  filter === f.value || (filter && filter !== "all" && normalizeStatus(filter) === normalizeStatus(f.value));

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

        {/* Orders list container (Admin pattern card) */}
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
          <div className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Danh sách đơn hàng</h2>
              <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                {filteredOrders.length} đơn
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <p className="text-gray-500 font-medium">Không có đơn hàng nào</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order: any, index: number) => {
                  return (
                    <div
                      key={order.id}
                      className={`rounded-2xl border border-gray-200 p-4 transition-colors hover:bg-[#f2f8fe] ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-bold text-lg text-gray-900">{order.code || order.id}</span>
                            <span className="text-sm text-gray-600">
                              {formatDate(order.createdDate || order.created_at)}
                            </span>
                          </div>
                          
                          {getAssignedStaffLabel(order) && (
                            <div className="text-sm text-gray-600">
                              Nhân viên: {getAssignedStaffLabel(order)}
                            </div>
                          )}
                        </div>

                        <Button
                          variant="secondary"
                          className="h-9 bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)] text-sm whitespace-nowrap"
                          onClick={() => setDetailModal({ open: true, order })}
                        >
                          Chi tiết
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal
        open={detailModal.open}
        onClose={() => setDetailModal({ open: false, order: null })}
        title={`Chi tiết đơn hàng ${detailModal.order?.code || detailModal.order?.id || ''}`}
      >
        {detailModal.order && (
          <div className="space-y-4">
            {/* Header row: left title, right status */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-700">Danh sách dịch vụ</h3>
              </div>
              <div className="shrink-0">
                <Badge tone={getStatusBadgeTone(detailModal.order.status)}>
                  {getStatusText(detailModal.order.status)}
                </Badge>
              </div>
            </div>

            {/* Services */}
            {detailModal.order.items && detailModal.order.items.length > 0 && (
              <div>
                <div className="space-y-2">
                  {detailModal.order.items.map((item: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-2 gap-3 text-sm">
                      <div className="text-gray-500">Dịch vụ:</div>
                      <div className="font-medium text-gray-900 text-right">
                        {item.serviceName || item.service_name || `Dịch vụ ${item.serviceId}`}
                      </div>
                      <div className="text-gray-500">Số lượng:</div>
                      <div className="font-medium text-gray-900 text-right">{item.quantity}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Created date */}
            <div className="text-sm text-gray-500">
              Ngày tạo: {formatDate(detailModal.order.createdDate || detailModal.order.created_at)}
            </div>

            {/* Total */}
            <div className="pt-3 border-t border-gray-200">
              <div className="flex justify-between font-semibold text-base">
                <span>Tổng cộng:</span>
                <span className="text-[hsl(var(--primary))]">
                  {formatMoney(detailModal.order.totalAmount || detailModal.order.total_amount)}
                </span>
              </div>
            </div>

            {/* Staff */}
            {getAssignedStaffLabel(detailModal.order) && (
              <div className="text-sm flex justify-between gap-3">
                <span className="text-gray-500">Nhân viên thực hiện:</span>
                <span className="font-semibold text-gray-900 text-right break-all">
                  {getAssignedStaffLabel(detailModal.order)}
                </span>
              </div>
            )}

            {detailModal.order.note && (
              <div className="text-sm">
                <span className="text-gray-500">Ghi chú: </span>
                <span>{detailModal.order.note}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => setPayConfirmModal({ open: true, order: detailModal.order })}
                disabled={payingId === detailModal.order.id}
              >
                {payingId === detailModal.order.id ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Đang xử lý...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Thanh toán
                  </span>
                )}
              </Button>
              <Button
                variant="secondary"
                className="flex-1 bg-white text-[hsl(var(--primary))] border border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                onClick={() => setDetailModal({ open: false, order: null })}
              >
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Pay Confirmation Modal */}
      <Modal
        open={payConfirmModal.open}
        onClose={() => setPayConfirmModal({ open: false, order: null })}
        title="Xác nhận thanh toán"
      >
        {payConfirmModal.order && (
          <div className="space-y-4 text-sm">
            <p>
              Bạn có chắc muốn thanh toán đơn hàng{" "}
              <span className="font-semibold">
                {payConfirmModal.order.code || payConfirmModal.order.id}
              </span>{" "}
              với số tiền{" "}
              <span className="font-semibold">
                {formatMoney(payConfirmModal.order.totalAmount || payConfirmModal.order.total_amount)}
              </span>
              ?
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setPayConfirmModal({ open: false, order: null })}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  if (!payConfirmModal.order) return;
                  await handlePay(payConfirmModal.order);
                  setPayConfirmModal({ open: false, order: null });
                }}
                disabled={payingId === payConfirmModal.order.id}
              >
                {payingId === payConfirmModal.order.id ? "Đang xử lý..." : "Xác nhận thanh toán"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal - Minimalist */}
      <Modal
        open={editModal.open}
        onClose={() => {
          setEditModal({ open: false, order: null });
          setShowAddService(false);
          setNewServiceId("");
          setNewServiceQuantity(1);
          setNewServiceTime("");
        }}
        title={`Chỉnh sửa ${editModal.order?.code || editModal.order?.id || ''}`}
      >
        {editModal.order && (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <Badge tone={getStatusBadgeTone(editModal.order.status)}>
                {getStatusText(editModal.order.status)}
              </Badge>
              <span className="text-sm text-gray-500">
                {formatDate(editModal.order.createdDate || editModal.order.created_at)}
              </span>
            </div>

            {/* Add Service Section - Compact */}
            {!showAddService ? (
              <Button
                variant="primary"
                className="h-9 px-4 text-sm font-medium whitespace-nowrap"
                onClick={() => setShowAddService(true)}
              >
                Thêm dịch vụ
              </Button>
            ) : (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Thêm dịch vụ</h3>
                  <button
                    onClick={() => {
                      setShowAddService(false);
                      setNewServiceId("");
                      setNewServiceQuantity(1);
                      setNewServiceTime("");
                    }}
                    className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Dịch vụ</label>
                  <select
                    value={newServiceId}
                    onChange={(e) => setNewServiceId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                    disabled={addingService}
                  >
                    <option value="">-- Chọn dịch vụ --</option>
                    {services.map((service: any) => (
                      <option key={service.id} value={service.id}>
                        {service.name} - {formatMoney(service.price)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Số lượng</label>
                    <input
                      type="number"
                      min="1"
                      value={newServiceQuantity}
                      onChange={(e) => setNewServiceQuantity(parseInt(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                      disabled={addingService}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Thời gian</label>
                    <input
                      type="datetime-local"
                      value={newServiceTime}
                      onChange={(e) => setNewServiceTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                      disabled={addingService}
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="primary"
                    className="flex-1 h-9 text-sm"
                    onClick={() => handleAddService(editModal.order.id)}
                    disabled={addingService || !newServiceId}
                  >
                    {addingService ? "Đang thêm..." : "Thêm"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-9 px-3 text-sm whitespace-nowrap"
                    onClick={() => {
                      setEditModal({ open: false, order: null });
                      setShowAddService(false);
                      setNewServiceId("");
                      setNewServiceQuantity(1);
                      setNewServiceTime("");
                    }}
                    disabled={addingService}
                  >
                    Đóng
                  </Button>
                </div>
              </div>
            )}

            {/* Services List - Compact */}
            {editModal.order.items && editModal.order.items.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">Dịch vụ trong đơn</h3>
                <div className="space-y-2">
                  {editModal.order.items.map((item: any, idx: number) => (
                    <EditOrderItemRow
                      key={item.id || idx}
                      item={item}
                      orderId={editModal.order.id}
                      onUpdateQuantity={handleUpdateItemQuantity}
                      onRemove={handleRemoveItem}
                      editingItemId={editingItemId}
                      formatMoney={formatMoney}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                <p className="text-sm">Chưa có dịch vụ nào</p>
              </div>
            )}

            {/* Summary - Compact */}
            <div className="pt-3 border-t border-gray-200 space-y-2">
              {editModal.order.subtotalAmount && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Tạm tính</span>
                  <span>{formatMoney(editModal.order.subtotalAmount)}</span>
                </div>
              )}
              {editModal.order.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Giảm giá</span>
                  <span className="text-green-600">-{formatMoney(editModal.order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="font-semibold text-gray-900">Tổng cộng</span>
                <span className="text-xl font-bold text-[hsl(var(--primary))]">
                  {formatMoney(editModal.order.totalAmount || editModal.order.total_amount)}
                </span>
              </div>
            </div>

            <Button 
              variant="secondary" 
              className="w-full mt-3 h-9 text-sm"
              onClick={() => {
                setEditModal({ open: false, order: null });
                setShowAddService(false);
                setNewServiceId("");
                setNewServiceQuantity(1);
                setNewServiceTime("");
              }}
            >
              Đóng
            </Button>
          </div>
        )}
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        open={cancelConfirmModal.open}
        onClose={() => setCancelConfirmModal({ open: false, order: null })}
        title="Xác nhận hủy đơn hàng"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Bạn có chắc muốn hủy đơn hàng <span className="font-semibold">{cancelConfirmModal.order?.code || cancelConfirmModal.order?.id}</span>?
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              variant="danger"
              onClick={handleConfirmCancel}
              disabled={cancellingId === cancelConfirmModal.order?.id}
            >
              {cancellingId === cancelConfirmModal.order?.id ? "Đang hủy..." : "Xác nhận"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
