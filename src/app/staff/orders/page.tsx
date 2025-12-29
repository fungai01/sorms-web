"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { apiClient } from "@/lib/api-client";

type ServiceOrderStatus = 'PENDING_STAFF_CONFIRMATION' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REJECTED' | 'FAILED';

type ServiceOrder = {
  id: number;
  code: string;
  bookingId: number;
  requestedBy: number;
  status: ServiceOrderStatus;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
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

export default function StaffOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [filterStatus, setFilterStatus] = useState<'ALL' | ServiceOrderStatus>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [adjustScheduleModalOpen, setAdjustScheduleModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [confirmNote, setConfirmNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [adjustedDate, setAdjustedDate] = useState('');
  const [adjustedTime, setAdjustedTime] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [completionNote, setCompletionNote] = useState('');

  // Auto-hide flash messages
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [flash]);

  // Helper function to get staff profile ID from account ID
  const getStaffProfileId = async (): Promise<number | null> => {
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
  };

  // Load orders assigned to current staff
  const loadOrders = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const staffId = await getStaffProfileId();
      
      if (!staffId) {
        setFlash({ type: 'error', text: 'Không tìm thấy thông tin nhân viên' });
        setLoading(false);
        return;
      }
      const status = filterStatus !== 'ALL' ? filterStatus : undefined;
      const response = await apiClient.getStaffTasksForOrder(staffId, status);
      
      if (response.success) {
        const data: any = response.data;
        const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        setOrders(items);
      } else {
        setFlash({ type: 'error', text: response.error || 'Không thể tải danh sách đơn hàng' });
        setOrders([]);
      }
    } catch (error: any) {
      console.error('Error loading orders:', error);
      setFlash({ type: 'error', text: error.message || 'Có lỗi xảy ra khi tải dữ liệu' });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [user?.id, filterStatus]);

  // Load order detail
  const loadOrderDetail = async (orderId: number) => {
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
        setDetailModalOpen(true);
      } else {
        setFlash({ type: 'error', text: response.error || 'Không thể tải chi tiết đơn hàng' });
      }
    } catch (error: any) {
      console.error('Error loading order detail:', error);
      setFlash({ type: 'error', text: error.message || 'Có lỗi xảy ra' });
    }
  };

  // Confirm order
  const handleConfirm = async () => {
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
      console.error('Error confirming order:', error);
      setFlash({ type: 'error', text: error.message || 'Có lỗi xảy ra' });
    }
  };

  // Reject order
  const handleReject = async () => {
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
      console.error('Error rejecting order:', error);
      setFlash({ type: 'error', text: error.message || 'Có lỗi xảy ra' });
    }
  };

  // Adjust schedule
  const handleAdjustSchedule = async () => {
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
      
      // Call API to update schedule (assuming backend supports this)
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

      setFlash({ type: 'success', text: 'Đã điều chỉnh lịch dịch vụ và gửi thông báo cho khách hàng' });
      setAdjustScheduleModalOpen(false);
      setAdjustedDate('');
      setAdjustedTime('');
      setAdjustmentNote('');
      await loadOrders();
    } catch (error: any) {
      console.error('Error adjusting schedule:', error);
      setFlash({ type: 'error', text: error.message || 'Có lỗi xảy ra' });
    }
  };

  // Complete service
  const handleComplete = async () => {
    if (!selectedOrder || !user?.id) return;

    try {
      const staffId = await getStaffProfileId();
      
      if (!staffId) {
        setFlash({ type: 'error', text: 'Không tìm thấy thông tin nhân viên' });
        return;
      }
      
      // Call API to complete service
      const response = await fetch(`/api/system/orders?action=complete&orderId=${selectedOrder.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          note: completionNote.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        setFlash({ type: 'error', text: error.error || 'Hoàn thành dịch vụ thất bại' });
        return;
      }

      setFlash({ type: 'success', text: 'Đã hoàn thành dịch vụ thành công' });
      setCompleteModalOpen(false);
      setCompletionNote('');
      await loadOrders();
    } catch (error: any) {
      console.error('Error completing service:', error);
      setFlash({ type: 'error', text: error.message || 'Có lỗi xảy ra' });
    }
  };

  const filteredOrders = useMemo(() => {
    if (filterStatus === 'ALL') return orders;
    return orders.filter(o => o.status === filterStatus);
  }, [orders, filterStatus]);

  const getStatusBadge = (status: ServiceOrderStatus) => {
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

  const pendingCount = orders.filter(o => o.status === 'PENDING_STAFF_CONFIRMATION').length;
  const completedCount = orders.filter(o => o.status === 'COMPLETED').length;
  const rejectedCount = orders.filter(o => o.status === 'REJECTED').length;

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Quản lý đơn hàng</h1>
              <p className="text-sm lg:text-base text-gray-600 mt-1">Xác nhận và quản lý đơn hàng được giao</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Flash Messages */}
          {flash && (
            <div className={`rounded-md border p-3 text-sm shadow-sm ${
              flash.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {flash.text}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardBody>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
                  <div className="text-sm text-gray-600">Chờ xác nhận</div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{completedCount}</div>
                  <div className="text-sm text-gray-600">Hoàn thành</div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
                  <div className="text-sm text-gray-600">Đã từ chối</div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Filters */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Lọc theo trạng thái</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                >
                  <option value="ALL">Tất cả</option>
                  <option value="PENDING_STAFF_CONFIRMATION">Chờ xác nhận</option>
                  <option value="PENDING_PAYMENT">Chờ thanh toán</option>
                  <option value="CONFIRMED">Đã xác nhận</option>
                  <option value="IN_PROGRESS">Đang xử lý</option>
                  <option value="COMPLETED">Hoàn thành</option>
                  <option value="REJECTED">Đã từ chối</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>
              <div className="text-sm text-gray-600">
                Hiển thị {filteredOrders.length} đơn hàng
              </div>
            </div>
          </div>

          {/* Orders List */}
          {loading ? (
            <Card>
              <CardBody>
                <div className="text-center py-10 text-gray-600">
                  <div className="animate-pulse">Đang tải...</div>
                </div>
              </CardBody>
            </Card>
          ) : filteredOrders.length === 0 ? (
            <Card>
              <CardBody>
                <div className="text-center py-10 text-gray-600">
                  <div className="mb-3">
                    <svg className="w-10 h-10 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-sm">Không có đơn hàng nào phù hợp bộ lọc.</div>
                </div>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <Card key={order.id} className={`${
                  order.status === 'PENDING_STAFF_CONFIRMATION' ? 'ring-2 ring-yellow-200 bg-yellow-50' : ''
                }`}>
                  <CardBody>
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <h3 className="text-lg font-semibold text-gray-900">Đơn hàng: {order.code}</h3>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600 mb-3">
                          <div><span className="font-medium">Booking ID:</span> {order.bookingId}</div>
                          <div><span className="font-medium">Tổng tiền:</span> {order.totalAmount.toLocaleString('vi-VN')} VNĐ</div>
                          <div><span className="font-medium">Ngày tạo:</span> {new Date(order.createdAt).toLocaleDateString('vi-VN')}</div>
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
                                setCompleteModalOpen(true);
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
            </div>
          )}
        </div>
      </div>

      {/* Order Detail Modal */}
      <Modal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedOrder(null);
        }}
        title="Chi tiết đơn hàng"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{selectedOrder.code}</h3>
                  <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-gray-500">Booking ID</div>
                <div className="font-medium text-gray-900">{selectedOrder.bookingId}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-gray-500">Tổng tiền</div>
                <div className="font-medium text-gray-900">{selectedOrder.totalAmount.toLocaleString('vi-VN')} VNĐ</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-gray-500">Ngày tạo</div>
                <div className="font-medium text-gray-900">{new Date(selectedOrder.createdAt).toLocaleString('vi-VN')}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-gray-500">Cập nhật</div>
                <div className="font-medium text-gray-900">{new Date(selectedOrder.updatedAt).toLocaleString('vi-VN')}</div>
              </div>
              {selectedOrder.scheduledDateTime && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 col-span-2">
                  <div className="text-gray-500">Lịch dịch vụ</div>
                  <div className="font-medium text-blue-900">
                    {new Date(selectedOrder.scheduledDateTime).toLocaleString('vi-VN')}
                  </div>
                </div>
              )}
            </div>

            {selectedOrder.note && (
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-gray-500 mb-1">Ghi chú</div>
                <div className="text-gray-900">{selectedOrder.note}</div>
              </div>
            )}

            {selectedOrder.items && selectedOrder.items.length > 0 && (
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-gray-500 mb-2 font-medium">Danh sách dịch vụ</div>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <div className="font-medium">{item.serviceName || `Service #${item.serviceId}`}</div>
                        <div className="text-sm text-gray-600">Số lượng: {item.quantity} x {item.unitPrice.toLocaleString('vi-VN')} VNĐ</div>
                      </div>
                      <div className="font-semibold">{item.lineTotal.toLocaleString('vi-VN')} VNĐ</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                  <div className="font-medium">Tổng cộng:</div>
                  <div className="text-lg font-bold text-blue-600">{selectedOrder.totalAmount.toLocaleString('vi-VN')} VNĐ</div>
                </div>
              </div>
            )}
          </div>
        )}
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
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
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
        open={completeModalOpen}
        onClose={() => {
          setCompleteModalOpen(false);
          setCompletionNote('');
        }}
        title="Hoàn thành dịch vụ"
        footer={
          <div className="flex justify-end gap-2">
            <Button 
              variant="secondary" 
              onClick={() => {
                setCompleteModalOpen(false);
                setCompletionNote('');
              }}
            >
              Hủy
            </Button>
            <Button 
              onClick={handleComplete}
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
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
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
    </>
  );
}

