"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

type QRVerificationResult = {
  valid: boolean;
  bookingId?: number;
  userId?: string;
  userName?: string;
  userEmail?: string;
  roomId?: number;
  roomCode?: string;
  checkinDate?: string;
  checkoutDate?: string;
  numGuests?: number;
  bookingCode?: string;
  error?: string;
};

export default function SecurityDashboardPage() {
  // Set user role in sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('userRole', 'security');
    }
  }, []);

  const [qrToken, setQrToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QRVerificationResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-hide flash messages
  useEffect(() => {
    if (flash) {
      const timer = setTimeout(() => setFlash(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [flash]);

  const handleVerifyQR = async () => {
    if (!qrToken.trim()) {
      setFlash({ type: 'error', text: 'Vui lòng nhập mã QR token' });
      return;
    }

    setLoading(true);
    setResult(null);
    setFlash(null);

    try {
      const res = await fetch('/api/security/qr/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token: qrToken.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({
          valid: false,
          error: data.error || 'Không thể xác thực mã QR',
        });
        setFlash({ type: 'error', text: data.error || 'Mã QR không hợp lệ' });
        setModalOpen(true);
        return;
      }

      setResult({
        valid: true,
        bookingId: data.bookingId,
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        roomId: data.roomId,
        roomCode: data.roomCode,
        checkinDate: data.checkinDate,
        checkoutDate: data.checkoutDate,
        numGuests: data.numGuests,
        bookingCode: data.bookingCode,
      });
      setFlash({ type: 'success', text: 'Xác thực mã QR thành công!' });
      setModalOpen(true);
    } catch (error) {
      setResult({
        valid: false,
        error: 'Lỗi kết nối đến server',
      });
      setFlash({ type: 'error', text: 'Lỗi kết nối đến server' });
      setModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!result?.bookingId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/security/bookings/${result.bookingId}/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        setFlash({ type: 'error', text: error.error || 'Không thể thực hiện check-in' });
        return;
      }

      setFlash({ type: 'success', text: 'Check-in thành công!' });
      setQrToken("");
      setResult(null);
      setModalOpen(false);
    } catch (error) {
      setFlash({ type: 'error', text: 'Lỗi khi thực hiện check-in' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Bảo vệ - Xác thực mã QR</h1>
              <p className="text-sm lg:text-base text-gray-600 mt-1">Quét hoặc nhập mã QR để xác thực đặt phòng và check-in</p>
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

          {/* QR Input Card */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <h2 className="text-xl font-semibold">Nhập mã QR</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mã QR Token
                </label>
                <Input
                  type="text"
                  placeholder="Dán mã QR token hoặc quét mã QR..."
                  value={qrToken}
                  onChange={(e) => setQrToken(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleVerifyQR();
                    }
                  }}
                  className="text-base"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Quét mã QR từ điện thoại của khách hàng hoặc nhập token thủ công
                </p>
              </div>
              <Button
                onClick={handleVerifyQR}
                disabled={loading || !qrToken.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? 'Đang xác thực...' : 'Xác thực mã QR'}
              </Button>
            </CardBody>
          </Card>

          {/* Instructions */}
          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">📋 Hướng dẫn sử dụng</h3>
              <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
                <li>Yêu cầu khách hàng mở mã QR trên điện thoại</li>
                <li>Quét mã QR bằng máy quét hoặc nhập token thủ công</li>
                <li>Nhấn "Xác thực mã QR" để kiểm tra thông tin</li>
                <li>Xác nhận thông tin đặt phòng và thực hiện check-in</li>
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Verification Result Modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          if (result?.valid) {
            setQrToken("");
            setResult(null);
          }
        }}
        title={result?.valid ? "✅ Xác thực thành công" : "❌ Xác thực thất bại"}
      >
        {result?.valid ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-800 mb-2">
                Mã QR hợp lệ - Thông tin đặt phòng:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Mã đặt phòng</p>
                <p className="text-sm font-medium text-gray-900">{result.bookingCode || `#${result.bookingId}`}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Tên khách hàng</p>
                <p className="text-sm font-medium text-gray-900">{result.userName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Email</p>
                <p className="text-sm font-medium text-gray-900">{result.userEmail || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Phòng</p>
                <p className="text-sm font-medium text-gray-900">{result.roomCode || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Check-in</p>
                <p className="text-sm font-medium text-gray-900">
                  {result.checkinDate ? new Date(result.checkinDate).toLocaleString('vi-VN') : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Check-out</p>
                <p className="text-sm font-medium text-gray-900">
                  {result.checkoutDate ? new Date(result.checkoutDate).toLocaleString('vi-VN') : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Số khách</p>
                <p className="text-sm font-medium text-gray-900">{result.numGuests || 'N/A'}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={handleCheckIn}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {loading ? 'Đang xử lý...' : '✓ Xác nhận Check-in'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setModalOpen(false);
                  setQrToken("");
                  setResult(null);
                }}
                className="flex-1"
              >
                Đóng
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-800 mb-2">
                Mã QR không hợp lệ hoặc đã hết hạn
              </p>
              <p className="text-sm text-red-700">
                {result?.error || 'Vui lòng kiểm tra lại mã QR và thử lại.'}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setModalOpen(false);
                setQrToken("");
                setResult(null);
              }}
              className="w-full"
            >
              Đóng
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}




