"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";

// ===== Orders types =====
type ServiceOrderStatus = 'PENDING_STAFF_CONFIRMATION' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REJECTED' | 'FAILED';

type ServiceOrder = {
  id: number;
  code: string;
  bookingId: number;
  requestedBy: number | string;
  status: ServiceOrderStatus;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  note?: string;
  createdDate?: string; // Backend trả về createdDate
  createdAt?: string; // Fallback
  updatedAt?: string; // Không có trong backend, nhưng giữ để tương thích
  confirmedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  items?: ServiceOrderItem[];
  assignedStaffId?: number;
  scheduledDateTime?: string;
};

type ServiceOrderItem = {
  id: number;
  serviceOrderId: number;
  serviceId: number;
  serviceName?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

// ===== UI Components =====
function KPICard({ 
  title, 
  value, 
  hint
}: { 
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

export default function StaffDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Số lượng đơn hàng hiển thị trên dashboard (chỉ preview)
  const DASHBOARD_ORDERS_LIMIT = 5;

  // ===== Orders =====
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  // Dashboard luôn lọc theo trạng thái chờ xác nhận
  const filterOrderStatus: ServiceOrderStatus = 'PENDING_STAFF_CONFIRMATION';

  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [orderDetailModalOpen, setOrderDetailModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [adjustScheduleModalOpen, setAdjustScheduleModalOpen] = useState(false);
  const [completeServiceModalOpen, setCompleteServiceModalOpen] = useState(false);

  const [confirmNote, setConfirmNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [adjustedDate, setAdjustedDate] = useState('');
  const [adjustedTime, setAdjustedTime] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [completionServiceNote, setCompletionServiceNote] = useState('');

  // Shared flash
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('userRole', 'staff');
    }
  }, []);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [flash]);

  // Helper function to get staff profile ID from account ID
  const getStaffProfileId = useCallback(async (): Promise<number | null> => {
    if (!user?.id) return null;
    
    const accountId = String(user.id);
    const allStaffProfiles = await apiClient.getStaffProfiles();
    
    if (allStaffProfiles.success && allStaffProfiles.data) {
      const profiles = Array.isArray(allStaffProfiles.data) 
        ? allStaffProfiles.data 
        : (Array.isArray((allStaffProfiles.data as any)?.items) ? (allStaffProfiles.data as any).items : []);
      
      const staffProfile = profiles.find((p: any) => 
        String(p.accountId || p.account_id || p.accountID) === accountId
      );
      
      return staffProfile?.id || null;
    }
    
    return null;
  }, [user?.id]);

  // Helper function to get full staff profile information
  const getStaffProfile = useCallback(async (): Promise<any | null> => {
    if (!user?.id) return null;
    
    const accountId = String(user.id);
    const allStaffProfiles = await apiClient.getStaffProfiles();
    
    if (allStaffProfiles.success && allStaffProfiles.data) {
      const profiles = Array.isArray(allStaffProfiles.data) 
        ? allStaffProfiles.data 
        : (Array.isArray((allStaffProfiles.data as any)?.items) ? (allStaffProfiles.data as any).items : []);
      
      const staffProfile = profiles.find((p: any) => 
        String(p.accountId || p.account_id || p.accountID) === accountId
      );
      
      return staffProfile || null;
    }
    
    return null;
  }, [user?.id]);

  // Helper function to generate auto-filled note/reason with staff and order info
  const generateAutoNote = useCallback(async (action: 'confirm' | 'reject'): Promise<string> => {
    const staffProfile = await getStaffProfile();
    const staffName = user?.name || user?.firstName || user?.username || 'Nhân viên';
    const staffPhone = staffProfile?.workPhone || user?.phoneNumber || 'N/A';
    const employeeId = staffProfile?.employeeId || 'N/A';
    const orderCode = selectedOrder?.code || 'N/A';
    const orderTotal = selectedOrder?.totalAmount ? selectedOrder.totalAmount.toLocaleString('vi-VN') + ' VNĐ' : 'N/A';
    
    const currentDate = new Date().toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (action === 'confirm') {
      return `Xác nhận đơn hàng ${orderCode}

Thông tin nhân viên:
- Tên: ${staffName}
- Mã nhân viên: ${employeeId}
- Số điện thoại: ${staffPhone}

Thông tin đơn hàng:
- Mã đơn hàng: ${orderCode}
- Tổng tiền: ${orderTotal}

Thời gian xác nhận: ${currentDate}`;
    } else {
      return `Từ chối đơn hàng ${orderCode}

Thông tin nhân viên:
- Tên: ${staffName}
- Mã nhân viên: ${employeeId}
- Số điện thoại: ${staffPhone}

Thông tin đơn hàng:
- Mã đơn hàng: ${orderCode}
- Tổng tiền: ${orderTotal}

Thời gian từ chối: ${currentDate}

Lý do từ chối: [Vui lòng nhập lý do cụ thể]`;
    }
  }, [user, selectedOrder, getStaffProfile]);

  // Auto-fill confirm note when modal opens
  useEffect(() => {
    if (confirmModalOpen && selectedOrder) {
      generateAutoNote('confirm').then((note) => {
        setConfirmNote(note);
      }).catch(() => {
        // Fallback nếu không lấy được thông tin
        const fallbackNote = `Xác nhận đơn hàng ${selectedOrder.code}\n\nThông tin nhân viên:\n- Tên: ${user?.name || user?.username || 'Nhân viên'}\n- Số điện thoại: ${user?.phoneNumber || 'N/A'}\n\nThông tin đơn hàng:\n- Mã đơn hàng: ${selectedOrder.code}\n- Tổng tiền: ${selectedOrder.totalAmount.toLocaleString('vi-VN')} VNĐ\n\nThời gian xác nhận: ${new Date().toLocaleString('vi-VN')}`;
        setConfirmNote(fallbackNote);
      });
    }
  }, [confirmModalOpen, selectedOrder, generateAutoNote, user]);

  // Auto-fill reject reason when modal opens
  useEffect(() => {
    if (rejectModalOpen && selectedOrder) {
      generateAutoNote('reject').then((note) => {
        setRejectReason(note);
      }).catch(() => {
        // Fallback nếu không lấy được thông tin
        const fallbackNote = `Từ chối đơn hàng ${selectedOrder.code}\n\nThông tin nhân viên:\n- Tên: ${user?.name || user?.username || 'Nhân viên'}\n- Số điện thoại: ${user?.phoneNumber || 'N/A'}\n\nThông tin đơn hàng:\n- Mã đơn hàng: ${selectedOrder.code}\n- Tổng tiền: ${selectedOrder.totalAmount.toLocaleString('vi-VN')} VNĐ\n\nThời gian từ chối: ${new Date().toLocaleString('vi-VN')}\n\nLý do từ chối: [Vui lòng nhập lý do cụ thể]`;
        setRejectReason(fallbackNote);
      });
    }
  }, [rejectModalOpen, selectedOrder, generateAutoNote, user]);

  // Load orders assigned to current staff
  const loadOrders = useCallback(async () => {
    if (!user?.id) return;
    
    setLoadingOrders(true);
    try {
      const staffId = await getStaffProfileId();
      if (!staffId) {
        setFlash({ type: 'error', text: 'Không tìm thấy thông tin nhân viên (orders)' });
        setLoadingOrders(false);
        return;
      }
      const response = await apiClient.getStaffTasksForOrder(staffId, filterOrderStatus);
      
      if (response.success) {
        const data: any = response.data;
        const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        setOrders(items);
      } else {
        setFlash({ type: 'error', text: response.error || 'Không thể tải danh sách đơn hàng' });
        setOrders([]);
      }
    } catch (error: any) {
      setFlash({ type: 'error', text: `Lỗi tải đơn hàng: ${error.message}` });
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, [user?.id, getStaffProfileId]);


  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    // Dashboard luôn chỉ hiển thị đơn hàng chờ xác nhận
    return orders.filter(o => o.status === 'PENDING_STAFF_CONFIRMATION');
  }, [orders]);

  // Chỉ hiển thị một vài đơn hàng mới nhất trên dashboard
  const displayedOrders = useMemo(() => {
    // Sắp xếp theo ngày tạo mới nhất
    const sorted = [...filteredOrders].sort((a, b) => {
      const dateA = (a as any).createdDate || a.createdAt || '';
      const dateB = (b as any).createdDate || b.createdAt || '';
      if (!dateA || !dateB) return 0;
      try {
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      } catch {
        return 0;
      }
    });
    return sorted.slice(0, DASHBOARD_ORDERS_LIMIT);
  }, [filteredOrders, DASHBOARD_ORDERS_LIMIT]);

  // Load order detail
  const loadOrderDetail = useCallback(async (orderId: number) => {
    if (!user?.id) return;
    
    try {
      const staffId = await getStaffProfileId();
      if (!staffId) {
        setFlash({ type: 'error', text: 'Không tìm thấy thông tin nhân viên' });
        return;
      }
      const response = await apiClient.getStaffTaskDetailForOrder(staffId, orderId);
      
      if (response.success) {
        setSelectedOrder(response.data as ServiceOrder);
        setOrderDetailModalOpen(true);
      } else {
        setFlash({ type: 'error', text: response.error || 'Không thể tải chi tiết đơn hàng' });
      }
    } catch (error: any) {
      setFlash({ type: 'error', text: `Lỗi tải chi tiết đơn hàng: ${error.message}` });
    }
  }, [user?.id, getStaffProfileId]);

  // Confirm order
  const handleConfirm = useCallback(async () => {
    if (!selectedOrder || !user?.id) return;
    
    if (!confirmNote.trim()) {
      setFlash({ type: 'error', text: 'Vui lòng nhập ghi chú xác nhận' });
      return;
    }

    try {
      const staffId = await getStaffProfileId();
      if (!staffId) {
        setFlash({ type: 'error', text: 'Không tìm thấy thông tin nhân viên' });
        return;
      }

      const response = await apiClient.staffConfirmOrder(selectedOrder.id, staffId, confirmNote);
      
      if (response.success) {
        setFlash({ type: 'success', text: 'Đã xác nhận đơn hàng thành công' });
        setConfirmModalOpen(false);
        setConfirmNote('');
        await loadOrders();
      } else {
        setFlash({ type: 'error', text: response.error || 'Xác nhận đơn hàng thất bại' });
      }
    } catch (error: any) {
      setFlash({ type: 'error', text: `Lỗi xác nhận đơn hàng: ${error.message}` });
    }
  }, [selectedOrder, user?.id, confirmNote, getStaffProfileId, loadOrders]);

  // Reject order
  const handleReject = useCallback(async () => {
    if (!selectedOrder || !user?.id) return;
    
    if (!rejectReason.trim()) {
      setFlash({ type: 'error', text: 'Vui lòng nhập lý do từ chối' });
      return;
    }

    try {
      const staffId = await getStaffProfileId();
      if (!staffId) {
        setFlash({ type: 'error', text: 'Không tìm thấy thông tin nhân viên' });
        return;
      }

      const response = await apiClient.staffRejectOrder(selectedOrder.id, staffId, rejectReason);
      
      if (response.success) {
        setFlash({ type: 'success', text: 'Đã từ chối đơn hàng thành công' });
        setRejectModalOpen(false);
        setRejectReason('');
        await loadOrders();
      } else {
        setFlash({ type: 'error', text: response.error || 'Từ chối đơn hàng thất bại' });
      }
    } catch (error: any) {
      setFlash({ type: 'error', text: `Lỗi từ chối đơn hàng: ${error.message}` });
    }
  }, [selectedOrder, user?.id, rejectReason, getStaffProfileId, loadOrders]);

  // Adjust schedule
  const handleAdjustSchedule = useCallback(async () => {
    if (!selectedOrder || !user?.id) return;
    
    if (!adjustedDate || !adjustedTime) {
      setFlash({ type: 'error', text: 'Vui lòng chọn ngày và giờ mới' });
      return;
    }

    try {
      const staffId = await getStaffProfileId();
      if (!staffId) {
        setFlash({ type: 'error', text: 'Không tìm thấy thông tin nhân viên' });
        return;
      }

      const newDateTime = new Date(`${adjustedDate}T${adjustedTime}`).toISOString();
      
      const response = await fetch(`/api/system/orders?action=adjustSchedule&orderId=${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledDateTime: newDateTime,
          note: adjustmentNote.trim() || undefined,
          staffId,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        setFlash({ type: 'error', text: error.error || 'Điều chỉnh lịch thất bại' });
        return;
      }

      setFlash({ type: 'success', text: 'Đã điều chỉnh lịch dịch vụ và gửi thông báo' });
      setAdjustScheduleModalOpen(false);
      setAdjustedDate('');
      setAdjustedTime('');
      setAdjustmentNote('');
      await loadOrders();
    } catch (error: any) {
      setFlash({ type: 'error', text: `Lỗi điều chỉnh lịch: ${error.message}` });
    }
  }, [selectedOrder, user?.id, adjustedDate, adjustedTime, adjustmentNote, getStaffProfileId, loadOrders]);

  // Complete service
  const handleCompleteService = useCallback(async () => {
    if (!selectedOrder || !user?.id) return;

    try {
      const staffId = await getStaffProfileId();
      if (!staffId) {
        setFlash({ type: 'error', text: 'Không tìm thấy thông tin nhân viên' });
        return;
      }
      
      const response = await fetch(`/api/system/orders?action=complete&orderId=${selectedOrder.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          note: completionServiceNote.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        setFlash({ type: 'error', text: error.error || 'Hoàn thành dịch vụ thất bại' });
        return;
      }

      setFlash({ type: 'success', text: 'Đã hoàn thành dịch vụ thành công' });
      setCompleteServiceModalOpen(false);
      setCompletionServiceNote('');
      await loadOrders();
    } catch (error: any) {
      setFlash({ type: 'error', text: `Lỗi hoàn thành dịch vụ: ${error.message}` });
    }
  }, [selectedOrder, user?.id, completionServiceNote, getStaffProfileId, loadOrders]);

  // Order status badge
  const getOrderStatusBadge = (status: ServiceOrderStatus) => {
    switch (status) {
      case 'PENDING_STAFF_CONFIRMATION':
        return <Badge tone="warning">Chờ xác nhận</Badge>;
      case 'PENDING_PAYMENT':
        return <Badge tone="info">Chờ thanh toán</Badge>;
      case 'CONFIRMED':
        return <Badge tone="success">Đã xác nhận</Badge>;
      case 'IN_PROGRESS':
        return <Badge>Đang xử lý</Badge>;
      case 'COMPLETED':
        return <Badge tone="success">Hoàn thành</Badge>;
      case 'REJECTED':
        return <Badge tone="error">Đã từ chối</Badge>;
      case 'CANCELLED':
        return <Badge tone="muted">Đã hủy</Badge>;
      case 'FAILED':
        return <Badge tone="error">Thất bại</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Stats - Orders
  const pendingOrdersCount = orders.filter(o => o.status === 'PENDING_STAFF_CONFIRMATION').length;
  const completedOrdersCount = orders.filter(o => o.status === 'COMPLETED').length;
  const rejectedOrdersCount = orders.filter(o => o.status === 'REJECTED').length;

  return (
    <div className="px-6 pt-4 pb-6" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Chào mừng bạn đến với hệ thống SORMS,</p>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard nhân viên</h1>
              </div>
              <div className="flex gap-3">
                <Button 
                  onClick={() => {
                    loadOrders();
                  }} 
                  variant="secondary"
                >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Làm mới
              </Button>
                <Button 
                  onClick={() => router.push('/staff/orders')}
                  variant="primary"
                >
                  Xem tất cả
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Flash Messages */}
        {flash && (
          <div className={`py-2.5 rounded-xl px-4 border shadow-sm animate-fade-in flex items-center gap-2 ${
            flash.type === 'success' ? 'bg-green-50 text-green-800 border-green-100' : 'bg-red-50 text-red-800 border-red-100'
          }`}>
            <svg className={`w-5 h-5 ${flash.type === 'success' ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {flash.type === 'success' 
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              }
            </svg>
            <span className="text-sm font-medium">{flash.text}</span>
          </div>
        )}

       {/* KPIs */}
<section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
  {loadingOrders ? (
    Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={i} className="h-28" />
    ))
  ) : (
    <>
      <KPICard 
        title="Đơn hàng cần xác nhận" 
        value={`${pendingOrdersCount ?? 0} đơn hàng mới`}
        
      />
      <KPICard 
        title="Đơn hàng đã hoàn thành" 
        value={`${completedOrdersCount ?? 0} đã hoàn thành`}
        
      />
      <KPICard 
        title="Đơn hàng đã từ chối" 
        value={`${rejectedOrdersCount ?? 0} đã từ chối`}
        
      />
    </>
  )}
</section>

        {/* Orders List */}
        <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-[hsl(var(--page-bg))]/40 border-b border-gray-200 !px-6 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Đơn hàng gần đây</h2>
              <span className="text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] px-3 py-1 rounded-full">
                {displayedOrders.length} / {filteredOrders.length} đơn hàng
              </span>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {loadingOrders ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : displayedOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                </svg>
                <div className="text-sm">Không có đơn hàng nào</div>
              </div>
            ) : (
              <div className="space-y-4 p-6">
                {displayedOrders.map((order) => (
                  <Card 
                    key={order.id} 
                    className={`${
                      order.status === 'PENDING_STAFF_CONFIRMATION' ? 'ring-2 ring-yellow-200 bg-yellow-50' : ''
                    }`}
                  >
                    <CardBody>
                      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <h3 className="text-lg font-semibold text-gray-900">Đơn hàng: {order.code}</h3>
                            {getOrderStatusBadge(order.status)}
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600 mb-3">
                            <div><span className="font-medium">Booking ID:</span> {order.bookingId}</div>
                            <div><span className="font-medium">Tổng tiền:</span> {order.totalAmount.toLocaleString('vi-VN')} VNĐ</div>
                            <div><span className="font-medium">Ngày tạo:</span> {(() => {
                              const dateStr = (order as any).createdDate || order.createdAt;
                              if (!dateStr) return '—';
                              try {
                                const date = new Date(dateStr);
                                return !isNaN(date.getTime()) ? date.toLocaleDateString('vi-VN') : dateStr;
                              } catch {
                                return dateStr;
                              }
                            })()}</div>
                            <div><span className="font-medium">Số items:</span> {order.items?.length || 0}</div>
                          </div>
                          
                          {order.note && (
                            <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                              <span className="font-medium">Ghi chú:</span> {order.note}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button 
                            variant="secondary"
                            onClick={() => loadOrderDetail(order.id)}
                            className="w-full sm:w-auto"
                          >
                            Xem chi tiết
                          </Button>
                          
                          {order.status === 'PENDING_STAFF_CONFIRMATION' && (
                            <>
                              <Button 
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setConfirmModalOpen(true);
                                }}
                                className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                              >
                                Xác nhận
                              </Button>
                              <Button 
                                variant="danger"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setRejectModalOpen(true);
                                }}
                                className="w-full sm:w-auto"
                              >
                                Từ chối
                              </Button>
                            </>
                          )}
                          
                          {(order.status === 'CONFIRMED' || order.status === 'IN_PROGRESS') && (
                            <>
                              <Button 
                                onClick={() => {
                                  setSelectedOrder(order);
                                  if (order.scheduledDateTime) {
                                    const dt = new Date(order.scheduledDateTime);
                                    setAdjustedDate(dt.toISOString().split('T')[0]);
                                    setAdjustedTime(dt.toTimeString().slice(0, 5));
                                  }
                                  setAdjustScheduleModalOpen(true);
                                }}
                                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                              >
                                Điều chỉnh lịch
                              </Button>
                              <Button 
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setCompleteServiceModalOpen(true);
                                }}
                                className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                              >
                                Hoàn thành
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
                {filteredOrders.length > DASHBOARD_ORDERS_LIMIT && (
                  <div className="p-6 border-t border-gray-200">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-3">
                        Đang hiển thị {displayedOrders.length} trong tổng số {filteredOrders.length} đơn hàng
                      </p>
                      <Button
                        onClick={() => router.push('/staff/orders')}
                        variant="secondary"
                        className="text-sm"
                      >
                        Xem tất cả đơn hàng
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Order Detail Modal */}
      <Modal
        open={orderDetailModalOpen}
        onClose={() => {
          setOrderDetailModalOpen(false);
          setSelectedOrder(null);
        }}
        title="Chi tiết đơn hàng"
        size="xl"
      >
        {selectedOrder && (() => {
          // Helper function để format ngày tháng
          const formatDateTime = (dateStr: string | null | undefined): string => {
            if (!dateStr) return '—';
            try {
              const date = new Date(dateStr);
              if (isNaN(date.getTime())) return '—';
              return date.toLocaleString('vi-VN', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
              });
            } catch {
              return '—';
            }
          };

          // Lấy các ngày tháng quan trọng
          const createdDate = formatDateTime((selectedOrder as any).createdDate || (selectedOrder as any).createdAt || (selectedOrder as any).created_at);
          const orderNote = (selectedOrder as any).note || selectedOrder.note;

          return (
            <div className="space-y-5">
              {/* Thông tin cơ bản */}
              <div className="bg-gradient-to-r from-[hsl(var(--primary))]/5 to-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20 rounded-xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-[hsl(var(--primary))] rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{selectedOrder.code}</h3>
                      <div className="flex flex-wrap items-center gap-3">
                        {getOrderStatusBadge(selectedOrder.status)}
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Booking ID:</span> {selectedOrder.bookingId}
                        </div>
                        {selectedOrder.assignedStaffId && (
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Nhân viên:</span> ID {selectedOrder.assignedStaffId}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-sm text-gray-600 mb-1">Tổng tiền</div>
                    <div className="text-2xl font-bold text-[hsl(var(--primary))]">
                      {selectedOrder.totalAmount.toLocaleString('vi-VN')} VNĐ
                    </div>
                  </div>
                </div>

                {/* Thông tin ngày tháng */}
                <div className="mt-4 pt-4 border-t border-gray-200/50 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-gray-600">Ngày tạo:</span>
                    <span className="font-medium text-gray-900">{createdDate}</span>
                  </div>
                  {(() => {
                    let statusDateLabel = '';
                    let statusDateValue = '—';
                    
                    if (selectedOrder.status === 'REJECTED') {
                      statusDateLabel = 'Ngày từ chối';
                      statusDateValue = formatDateTime((selectedOrder as any).rejectedAt || (selectedOrder as any).rejected_at);
                    } else if (selectedOrder.status === 'COMPLETED' || selectedOrder.status === 'CONFIRMED') {
                      statusDateLabel = 'Ngày xác nhận';
                      statusDateValue = formatDateTime((selectedOrder as any).confirmedAt || (selectedOrder as any).confirmed_at);
                    } else if (selectedOrder.status === 'IN_PROGRESS') {
                      statusDateLabel = 'Ngày bắt đầu';
                      statusDateValue = formatDateTime((selectedOrder as any).updatedAt || (selectedOrder as any).updated_at);
                    }
                    
                    if (statusDateValue !== '—' && statusDateLabel) {
                      return (
                        <div className="flex items-center gap-2 text-sm">
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-gray-600">{statusDateLabel}:</span>
                          <span className="font-medium text-gray-900">{statusDateValue}</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Lịch dịch vụ */}
              {selectedOrder.scheduledDateTime && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-blue-900 mb-1">Lịch dịch vụ</div>
                      <div className="text-base font-medium text-blue-800">
                        {(() => {
                          try {
                            const date = new Date(selectedOrder.scheduledDateTime);
                            if (!isNaN(date.getTime())) {
                              return date.toLocaleString('vi-VN', { 
                                weekday: 'long',
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              });
                            }
                          } catch {}
                          return selectedOrder.scheduledDateTime;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Danh sách dịch vụ */}
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Danh sách dịch vụ ({selectedOrder.items.length})
                  </h4>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item, index) => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-8 h-8 bg-[hsl(var(--primary))]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-semibold text-[hsl(var(--primary))]">{index + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 mb-1">
                              {item.serviceName || `Dịch vụ #${item.serviceId}`}
                            </div>
                            <div className="text-sm text-gray-600">
                              Số lượng: {item.quantity} × {item.unitPrice.toLocaleString('vi-VN')} VNĐ
                            </div>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-lg font-bold text-gray-900">
                            {item.lineTotal.toLocaleString('vi-VN')} VNĐ
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Tổng tiền */}
                  <div className="mt-5 pt-4 border-t-2 border-gray-300 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Tạm tính:</span>
                      <span className="font-medium text-gray-900">
                        {selectedOrder.subtotalAmount.toLocaleString('vi-VN')} VNĐ
                      </span>
                    </div>
                    {selectedOrder.discountAmount > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Giảm giá:</span>
                        <span className="font-medium text-red-600">
                          -{selectedOrder.discountAmount.toLocaleString('vi-VN')} VNĐ
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-200">
                      <span className="text-base font-semibold text-gray-900">Tổng cộng:</span>
                      <span className="text-xl font-bold text-[hsl(var(--primary))]">
                        {selectedOrder.totalAmount.toLocaleString('vi-VN')} VNĐ
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Ghi chú - chỉ hiển thị khi có ghi chú */}
              {orderNote && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Ghi chú
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                      {orderNote}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Confirm Order Modal */}
      <Modal
        open={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false);
          setConfirmNote('');
        }}
        title="Xác nhận đơn hàng"
        footer={
          <div className="flex justify-end gap-2">
            <Button 
              variant="secondary" 
              onClick={() => {
                setConfirmModalOpen(false);
                setConfirmNote('');
              }}
            >
              Hủy
            </Button>
            <Button 
              onClick={handleConfirm}
              className="bg-green-600 hover:bg-green-700"
            >
              Xác nhận
            </Button>
          </div>
        }
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="text-sm text-gray-700">
              Bạn có chắc muốn xác nhận đơn hàng <strong>{selectedOrder.code}</strong>?
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ghi chú xác nhận *
              </label>
              <textarea
                className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập ghi chú xác nhận..."
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                required
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Order Modal */}
      <Modal
        open={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectReason('');
        }}
        title="Từ chối đơn hàng"
        footer={
          <div className="flex justify-end gap-2">
            <Button 
              variant="secondary" 
              onClick={() => {
                setRejectModalOpen(false);
                setRejectReason('');
              }}
            >
              Hủy
            </Button>
            <Button 
              variant="danger"
              onClick={handleReject}
            >
              Từ chối
            </Button>
          </div>
        }
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="text-sm text-gray-700">
              Bạn có chắc muốn từ chối đơn hàng <strong>{selectedOrder.code}</strong>?
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lý do từ chối *
              </label>
              <textarea
                className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Nhập lý do từ chối..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Adjust Schedule Modal */}
      <Modal
        open={adjustScheduleModalOpen}
        onClose={() => {
          setAdjustScheduleModalOpen(false);
          setAdjustedDate('');
          setAdjustedTime('');
          setAdjustmentNote('');
        }}
        title="Điều chỉnh lịch dịch vụ"
        footer={
          <div className="flex justify-end gap-2">
            <Button 
              variant="secondary" 
              onClick={() => {
                setAdjustScheduleModalOpen(false);
                setAdjustedDate('');
                setAdjustedTime('');
                setAdjustmentNote('');
              }}
            >
              Hủy
            </Button>
            <Button 
              onClick={handleAdjustSchedule}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Gửi thông báo
            </Button>
          </div>
        }
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-800 mb-1">Lịch hiện tại:</p>
              <p className="text-sm text-gray-700">
                {selectedOrder.scheduledDateTime 
                  ? new Date(selectedOrder.scheduledDateTime).toLocaleString('vi-VN')
                  : 'Chưa có lịch'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ngày mới *
                </label>
                <Input
                  type="date"
                  value={adjustedDate}
                  onChange={(e) => setAdjustedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Giờ mới *
                </label>
                <Input
                  type="time"
                  value={adjustedTime}
                  onChange={(e) => setAdjustedTime(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ghi chú cho khách hàng
              </label>
              <textarea
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập ghi chú giải thích lý do điều chỉnh..."
                value={adjustmentNote}
                onChange={(e) => setAdjustmentNote(e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-500">
              Thông báo sẽ được gửi đến khách hàng về việc điều chỉnh lịch dịch vụ.
            </p>
          </div>
        )}
      </Modal>

      {/* Complete Service Modal */}
      <Modal
        open={completeServiceModalOpen}
        onClose={() => {
          setCompleteServiceModalOpen(false);
          setCompletionServiceNote('');
        }}
        title="Hoàn thành dịch vụ"
        footer={
          <div className="flex justify-end gap-2">
            <Button 
              variant="secondary" 
              onClick={() => {
                setCompleteServiceModalOpen(false);
                setCompletionServiceNote('');
              }}
            >
              Hủy
            </Button>
            <Button 
              onClick={handleCompleteService}
              className="bg-green-600 hover:bg-green-700"
            >
              Hoàn thành
            </Button>
          </div>
        }
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm font-medium text-green-800 mb-1">
                Xác nhận hoàn thành dịch vụ cho đơn hàng <strong>{selectedOrder.code}</strong>?
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ghi chú hoàn thành (tùy chọn)
              </label>
              <textarea
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Nhập ghi chú về việc hoàn thành dịch vụ..."
                value={completionServiceNote}
                onChange={(e) => setCompletionServiceNote(e.target.value)}
              />
            </div>
            {selectedOrder.items && selectedOrder.items.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Dịch vụ đã hoàn thành:</p>
                <ul className="space-y-1">
                  {selectedOrder.items.map((item) => (
                    <li key={item.id} className="text-sm text-gray-600">
                      • {item.serviceName || `Service #${item.serviceId}`} x {item.quantity}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

