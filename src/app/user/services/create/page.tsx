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
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg px-4 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white">Đặt dịch vụ</h1>
              <p className="text-sm lg:text-base text-indigo-100 mt-1">Chọn nhân viên, dịch vụ và thời gian</p>
            </div>
          </div>
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

          <Card className="border-0 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-gray-900">Thông tin đặt dịch vụ</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-5 p-6">
              {/* Booking Selection */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Chọn booking <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
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
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Bạn chưa có booking nào được duyệt
                    </p>
                  </div>
                )}
              </div>

              {/* Staff Selection */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Chọn nhân viên <span className="text-red-500">*</span>
                </label>
                {loadingStaff ? (
                  <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm text-gray-600">Đang tải danh sách nhân viên...</span>
                  </div>
                ) : (
                  <select
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
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
                  <div className="mt-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900 mb-2">Thông tin nhân viên</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          {selectedStaff.employeeId && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">Mã NV:</span>
                              <span className="font-semibold text-blue-700">#{selectedStaff.employeeId}</span>
                            </div>
                          )}
                          {selectedStaff.department && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">Phòng ban:</span>
                              <span className="font-semibold text-gray-900">{selectedStaff.department}</span>
                            </div>
                          )}
                          {selectedStaff.jobTitle && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">Chức danh:</span>
                              <span className="font-semibold text-gray-900">{selectedStaff.jobTitle}</span>
                            </div>
                          )}
                          {selectedStaff.position && selectedStaff.position !== selectedStaff.jobTitle && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">Vị trí:</span>
                              <span className="font-semibold text-gray-900">{selectedStaff.position}</span>
                            </div>
                          )}
                          {selectedStaff.workEmail && (
                            <div className="sm:col-span-2 flex items-center gap-2">
                              <span className="text-gray-600">Email:</span>
                              <span className="font-semibold text-gray-900">{selectedStaff.workEmail}</span>
                            </div>
                          )}
                          {selectedStaff.workPhone && (
                            <div className="sm:col-span-2 flex items-center gap-2">
                              <span className="text-gray-600">Điện thoại:</span>
                              <span className="font-semibold text-gray-900">{selectedStaff.workPhone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Service Selection */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </label>
                <select
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
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
                  <div className="mt-3 p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 mb-1">{selectedService.name}</p>
                        <p className="text-sm font-semibold text-green-700 mb-2">
                          {selectedService.unitPrice.toLocaleString('vi-VN')} VNĐ / {selectedService.unitName}
                        </p>
                        {selectedService.description && (
                          <p className="text-sm text-gray-700">{selectedService.description}</p>
                        )}
                      </div>
                    </div>
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
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-base font-semibold text-gray-700">Tổng tiền:</span>
                    </div>
                    <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      {totalAmount.toLocaleString('vi-VN')} VNĐ
                    </span>
                  </div>
                  {quantity > 1 && (
                    <p className="text-xs text-gray-600 mt-2 text-right">
                      ({quantity} x {selectedService.unitPrice.toLocaleString('vi-VN')} VNĐ)
                    </p>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={loading || !selectedBookingId || !selectedStaffId || !selectedServiceId || !serviceDate || !serviceTime}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg py-3 text-base font-semibold flex items-center justify-center gap-2 disabled:from-gray-400 disabled:to-gray-500"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Gửi yêu cầu dịch vụ
                  </>
                )}
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>


    </>
  );
}
