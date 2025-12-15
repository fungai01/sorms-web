"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { apiClient } from "@/lib/api-client";
import { authService } from "@/lib/auth-service";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookingIdParam = searchParams.get("bookingId");
  const bookingId = bookingIdParam ? Number(bookingIdParam) : NaN;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!bookingId || Number.isNaN(bookingId)) {
      setError("bookingId không hợp lệ.");
    }
  }, [bookingId]);

  const handleSubmit = async () => {
    if (!bookingId || Number.isNaN(bookingId)) {
      setError("bookingId không hợp lệ.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Lấy userId từ token
      let userId: string | undefined = undefined;
      const accessToken = authService.getAccessToken();
      if (accessToken) {
        try {
          const tokenParts = accessToken.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            if (payload.userId) {
              userId = String(payload.userId);
            } else if (payload.sub) {
              userId = String(payload.sub);
            }
          }
        } catch (e) {
          console.warn('Could not decode token for userId:', e);
        }
      }

      // Gọi API checkout
      const response = await apiClient.checkoutBooking(bookingId, userId);

      if (response.success) {
        setSuccess(true);
        // Refresh bookings data if needed
        setTimeout(() => {
          router.push('/user/dashboard');
        }, 2000);
      } else {
        setError(response.error || 'Không thể thực hiện check-out. Vui lòng thử lại.');
        setSubmitting(false);
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Có lỗi xảy ra khi thực hiện check-out. Vui lòng thử lại.');
      setSubmitting(false);
    }
  }

  if (!bookingId || Number.isNaN(bookingId)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card>
          <CardBody>
            <p className="text-red-600 text-sm">Thiếu tham số bookingId.</p>
            <Button className="mt-3" onClick={() => router.push("/user/dashboard")}>Về trang người dùng</Button>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-transparent shadow-sm px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Check-out phòng</h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5">Booking #{bookingId}</p>
              </div>
            </div>
            <Button 
              variant="secondary" 
              onClick={() => router.back()} 
              className="w-full sm:w-auto bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Quay lại
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">

        {success ? (
          <Card className="border-0 shadow-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Check-out thành công!</h2>
                  <p className="text-green-100 mt-1">Yêu cầu của bạn đã được gửi thành công</p>
                </div>
              </div>
            </CardHeader>
            <CardBody className="p-6 space-y-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-5">
                <div className="flex items-start gap-3 mb-3">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-green-900">Vui lòng thực hiện các bước sau trước khi rời phòng:</p>
                </div>
                <ul className="space-y-2 ml-8">
                  {[
                    'Thu dọn đồ đạc và đảm bảo không bỏ quên tài sản cá nhân',
                    'Tắt các thiết bị điện, nước',
                    'Đóng cửa sổ, khóa cửa phòng',
                    'Trả chìa khóa tại bàn bảo vệ'
                  ].map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-green-800">
                      <span className="text-green-600 font-bold mt-0.5">{idx + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={() => router.push('/user/dashboard')} 
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Về trang người dùng
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => router.push('/user/dashboard')}
                  className="flex-1 border-gray-300"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Xem hướng dẫn
                </Button>
              </div>
            </CardBody>
          </Card>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-md border p-3 text-sm bg-red-50 border-red-200 text-red-800">{error}</div>
            )}

            <Card className="border-0 shadow-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Xác nhận check-out</h2>
                    <p className="text-xs text-blue-100 mt-0.5">Gửi yêu cầu check-out phòng</p>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="space-y-6 p-6">
                {/* Info box */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">Thông tin quan trọng</p>
                      <p className="text-sm text-blue-800">
                        Sau khi gửi yêu cầu check-out, bạn sẽ cần trả chìa khóa tại bàn bảo vệ để hoàn tất thủ tục.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Note field */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Ghi chú (tùy chọn)
                  </label>
                  <textarea
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ví dụ: Tình trạng phòng trước khi rời đi, số chìa khóa bàn giao, thời gian dự kiến trả chìa khóa..."
                  />
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
                  <Button 
                    variant="secondary" 
                    onClick={() => router.push('/user/dashboard')}
                    className="flex items-center justify-center gap-2"
                    disabled={submitting}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Hủy
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={submitting} 
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg disabled:from-gray-400 disabled:to-gray-500 min-w-[160px]"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Đang gửi...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Xác nhận check-out
                      </>
                    )}
                  </Button>
                </div>
              </CardBody>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50">
              <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold">Hướng dẫn trả chìa khóa</h2>
                </div>
              </CardHeader>
              <CardBody className="p-6 space-y-4">
                <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-amber-200">
                  <p className="text-sm font-medium text-gray-800 mb-3">
                    Sau khi gửi check-out, vui lòng đến bàn bảo vệ để trả chìa khóa phòng. Nhân viên bảo vệ sẽ xác nhận và hoàn tất thủ tục.
                  </p>
                  <ul className="space-y-2">
                    {[
                      'Trả chìa khóa trong phong bì (nếu có)',
                      'Thông báo số phòng và mã đặt phòng cho bảo vệ',
                      'Giữ biên nhận (nếu được cấp)'
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">Đang tải...</p>
          </CardBody>
        </Card>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}

