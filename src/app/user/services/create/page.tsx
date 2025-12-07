"use client";

import { useState, useEffect } from "react";

import { useUserBookings, useServices } from "@/hooks/useApi";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { apiClient } from "@/lib/api-client";
import { type Service } from "@/lib/types";


type StaffProfile = {
  id: number;
  employeeId?: string;
  department?: string;
  position?: string;
  jobTitle?: string;
  workEmail?: string;
  workPhone?: string;
  isActive?: boolean;
};

type Booking = {
  id: number;
  code: string;
  roomId: number;
  roomCode?: string;
  checkinDate: string;
  checkoutDate: string;
  status: string;
};



export default function CreateServicePage() {
  const router = useRouter();
  const { data: bookingsData } = useUserBookings();
  const { data: servicesData } = useServices();
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [serviceDate, setServiceDate] = useState('');
  const [serviceTime, setServiceTime] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load bookings
  useEffect(() => {
    if (bookingsData) {
      const items = Array.isArray((bookingsData as any).items) 
        ? (bookingsData as any).items 
        : (Array.isArray(bookingsData) ? bookingsData : []);
      const activeBookings = items.filter((b: Booking) => 
        b.status === 'APPROVED' || b.status === 'CHECKED_IN'
      );
      setBookings(activeBookings);
      if (activeBookings.length > 0 && !selectedBookingId) {
        setSelectedBookingId(activeBookings[0].id);
      }
    }
  }, [bookingsData]);

  // Load services
  useEffect(() => {
    if (servicesData) {
      setServices(servicesData as Service[]);
    }
  }, [servicesData]);

  // Load staff profiles
  useEffect(() => {
    const loadStaff = async () => {
      setLoadingStaff(true);
      try {
        const response = await apiClient.getStaffProfiles();
        if (response.success) {
          const data: any = response.data;
          const rawItems = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
          // Normalize fields from backend StaffProfileResponse to FE type
          const items: StaffProfile[] = rawItems.map((s: any) => ({
            id: Number(s.id),
            employeeId: s.employeeId,
            department: s.department,
            position: s.position,
            jobTitle: s.jobTitle,
            workEmail: s.workEmail,
            workPhone: s.workPhone,
            isActive: s.isActive,
          }));
          const activeStaff = items.filter((s: StaffProfile) => s.isActive !== false);
          setStaffProfiles(activeStaff);
        }
      } catch (error) {
        console.error('Error loading staff:', error);
      } finally {
        setLoadingStaff(false);
      }
    };
    loadStaff();
  }, []);

  // Auto-hide flash messages
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [flash]);

  const selectedService = services.find(s => s.id === selectedServiceId);
  const selectedStaff = staffProfiles.find(s => s.id === selectedStaffId);
  
  const totalAmount = selectedService ? selectedService.unitPrice * quantity : 0;

  const handleSubmit = async () => {
    if (!selectedBookingId) {
      setFlash({ type: 'error', text: 'Vui lòng chọn booking' });
      return;
    }
    if (!selectedStaffId) {
      setFlash({ type: 'error', text: 'Vui lòng chọn nhân viên' });
      return;
    }
    if (!selectedServiceId) {
      setFlash({ type: 'error', text: 'Vui lòng chọn dịch vụ' });
      return;
    }
    if (!serviceDate || !serviceTime) {
      setFlash({ type: 'error', text: 'Vui lòng chọn ngày và giờ dịch vụ' });
      return;
    }

    try {
    setLoading(true);
      const orderData = {
        bookingId: selectedBookingId,
        assignedStaffId: selectedStaffId,
        serviceId: selectedServiceId,
        quantity: quantity,
        serviceTime: `${serviceDate}T${serviceTime.length === 5 ? serviceTime + ':00' : serviceTime}`,
        note: note.trim() || undefined,
      };

      const response = await apiClient.createServiceOrder(orderData);
      if (response.success) {
        setFlash({ type: 'success', text: 'Đặt dịch vụ thành công! Đơn hàng đang chờ nhân viên xác nhận.' });
        setTimeout(() => {
          const redirectUrl = selectedBookingId 
            ? `/user/orders?bookingId=${selectedBookingId}`
            : '/user/orders';
          router.push(redirectUrl);
        }, 1200);
      } else {
        setFlash({ type: 'error', text: response.error || 'Đặt dịch vụ thất bại' });
      }
    } catch (error: any) {
      console.error('Error creating service order:', error);
      setFlash({ type: 'error', text: error.message || 'Có lỗi xảy ra' });
    } finally {
      setLoading(false);
    }
  };

  // Set default date/time (tomorrow, 9 AM)
  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    setServiceDate(dateStr);
    setServiceTime('09:00');
  }, []);

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Đặt dịch vụ</h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">Chọn nhân viên, dịch vụ và thời gian</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
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

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Thông tin đặt dịch vụ</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Booking Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chọn booking <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedBookingId || ''}
                  onChange={(e) => setSelectedBookingId(Number(e.target.value))}
                >
                  <option value="">-- Chọn booking --</option>
                  {bookings.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.code} - {booking.roomCode || `Room #${booking.roomId}`}
                      ({new Date(booking.checkinDate).toLocaleDateString('vi-VN')} - {new Date(booking.checkoutDate).toLocaleDateString('vi-VN')})
                    </option>
                  ))}
                </select>
                {bookings.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">Bạn chưa có booking nào được duyệt</p>
                )}
              </div>

              {/* Staff Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chọn nhân viên <span className="text-red-500">*</span>
                </label>
                {loadingStaff ? (
                  <div className="text-sm text-gray-500">Đang tải danh sách nhân viên...</div>
                ) : (
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedStaffId || ''}
                    onChange={(e) => setSelectedStaffId(Number(e.target.value))}
                  >
                    <option value="">-- Chọn nhân viên --</option>
                    {staffProfiles.map((staff) => {
                      const labelParts: string[] = [];
                      if (staff.employeeId) labelParts.push(`#${staff.employeeId}`);
                      if (staff.jobTitle) labelParts.push(staff.jobTitle);
                      if (staff.position && staff.position !== staff.jobTitle) labelParts.push(staff.position);
                      if (staff.department) labelParts.push(`Dept: ${staff.department}`);
                      const label = labelParts.length ? labelParts.join(' - ') : `Staff ID ${staff.id}`;
                      return (
                      <option key={staff.id} value={staff.id}>
                          {label}
                      </option>
                      );
                    })}
                  </select>
                )}
                {selectedStaff && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {selectedStaff.employeeId && (
                        <p><span className="text-gray-600">Mã NV:</span> <span className="font-medium">#{selectedStaff.employeeId}</span></p>
                      )}
                      {selectedStaff.department && (
                        <p><span className="text-gray-600">Phòng ban:</span> <span className="font-medium">{selectedStaff.department}</span></p>
                      )}
                      {selectedStaff.jobTitle && (
                        <p><span className="text-gray-600">Chức danh:</span> <span className="font-medium">{selectedStaff.jobTitle}</span></p>
                      )}
                      {selectedStaff.position && selectedStaff.position !== selectedStaff.jobTitle && (
                        <p><span className="text-gray-600">Vị trí:</span> <span className="font-medium">{selectedStaff.position}</span></p>
                      )}
                      {selectedStaff.workEmail && (
                        <p className="sm:col-span-2"><span className="text-gray-600">Email công việc:</span> <span className="font-medium">{selectedStaff.workEmail}</span></p>
                      )}
                      {selectedStaff.workPhone && (
                        <p className="sm:col-span-2"><span className="text-gray-600">Điện thoại công việc:</span> <span className="font-medium">{selectedStaff.workPhone}</span></p>
                      )}
                      {!selectedStaff.employeeId && !selectedStaff.department && !selectedStaff.jobTitle && !selectedStaff.workEmail && !selectedStaff.workPhone && (
                        <p className="text-gray-600">Không có thêm thông tin hiển thị.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Service Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chọn dịch vụ <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedServiceId || ''}
                  onChange={(e) => setSelectedServiceId(Number(e.target.value))}
                >
                  <option value="">-- Chọn dịch vụ --</option>
                  {services.filter(s => s.isActive).map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} - {service.unitPrice.toLocaleString('vi-VN')} VNĐ/{service.unitName}
                    </option>
                  ))}
                </select>
                {selectedService && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                    <p className="font-medium">{selectedService.name}</p>
                    <p className="text-gray-600">
                      {selectedService.unitPrice.toLocaleString('vi-VN')} VNĐ / {selectedService.unitName}
                    </p>
                    {selectedService.description && (
                      <p className="text-gray-600 mt-1">{selectedService.description}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Quantity */}
              {selectedService && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Số lượng
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full"
                  />
                </div>
              )}

              {/* Service Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ngày dịch vụ <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Giờ dịch vụ <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="time"
                    value={serviceTime}
                    onChange={(e) => setServiceTime(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ghi chú
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nhập ghi chú (nếu có)..."
                />
              </div>

              {/* Total Amount */}
              {selectedService && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Tổng tiền:</span>
                    <span className="text-lg font-bold text-blue-600">
                      {totalAmount.toLocaleString('vi-VN')} VNĐ
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={loading || !selectedBookingId || !selectedStaffId || !selectedServiceId || !serviceDate || !serviceTime}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? 'Đang xử lý...' : 'Gửi yêu cầu dịch vụ'}
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>


    </>
  );
}







