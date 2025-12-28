"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/img/Logo.png";
import Bg from "@/img/bg.jpg";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/lib/auth-service";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Check for error query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    
    if (errorParam === 'inactive') {
      setError('Tài khoản của bạn chưa được kích hoạt. Vui lòng liên hệ quản trị viên.');
    } else if (errorParam === 'no_session') {
      setError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
    } else if (errorParam === 'create_user_failed') {
      setError('Không tạo được tài khoản. Vui lòng thử lại.');
    } else if (errorParam === 'EmailNotProvided') {
      setError('Không tìm thấy email trong thông tin đăng nhập. Vui lòng thử lại.');
    } else if (errorParam === 'InvalidEmailDomain') {
      setError('Tên miền email của bạn không được phép sử dụng.');
    } else if (errorParam === 'code_expired') {
      setError('Mã xác thực đã hết hạn. Vui lòng thử lại.');
    } else if (errorParam === 'redirect_uri_mismatch') {
      setError('Lỗi cấu hình xác thực. Vui lòng thử lại hoặc liên hệ quản trị viên.');
    } else if (errorParam === 'auth_failed') {
      setError('Xác thực thất bại. Vui lòng thử lại.');
    } else if (errorParam === 'user_not_found') {
      setError('Tài khoản của bạn chưa được đăng ký. Vui lòng liên hệ quản trị viên.');
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError("");

    try {
      // Lấy Google OAuth URL từ backend
      const redirectUrl = await authService.getGoogleOAuthUrl();
      
      // Mở popup window để đăng nhập Google
      const width = 500;
      const height = 600;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      const popup = window.open(
        redirectUrl,
        'google-login',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        throw new Error('Không thể mở cửa sổ đăng nhập. Vui lòng cho phép popup và thử lại.');
      }

      // Kiểm tra khi popup đóng mà không có message (user hủy)
      let checkPopupClosed: NodeJS.Timeout;
      
      // Lắng nghe message từ popup
      const messageListener = (event: MessageEvent) => {
        // Kiểm tra origin để đảm bảo an toàn
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data.type === 'GOOGLE_LOGIN_SUCCESS') {
          // Đóng popup
          popup.close();
          window.removeEventListener('message', messageListener);
          if (checkPopupClosed) {
            clearInterval(checkPopupClosed);
          }
          
          // Redirect đến dashboard (callback page đã lưu token vào localStorage)
          const redirectUrl = event.data.redirectUrl || '/user/dashboard';
          window.location.href = redirectUrl;
        } else if (event.data.type === 'GOOGLE_LOGIN_ERROR') {
          // Đóng popup
          popup.close();
          window.removeEventListener('message', messageListener);
          if (checkPopupClosed) {
            clearInterval(checkPopupClosed);
          }
          
          // Hiển thị lỗi
          setError(event.data.error || 'Đăng nhập thất bại. Vui lòng thử lại.');
          setIsLoading(false);
        }
      };

      window.addEventListener('message', messageListener);

      checkPopupClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopupClosed);
          window.removeEventListener('message', messageListener);
          
          // Kiểm tra xem có message nào được gửi không
          // If there's no message and the popup is closed, it means the user cancelled
          setIsLoading(false);
          setError('Bạn đã hủy đăng nhập Google. Nếu muốn đăng nhập, vui lòng thử lại.');
        }
      }, 500);

      // Cleanup sau 10 phút (timeout)
      setTimeout(() => {
        if (checkPopupClosed) {
          clearInterval(checkPopupClosed);
        }
        window.removeEventListener('message', messageListener);
        if (!popup.closed) {
          popup.close();
        }
        setIsLoading(false);
        setError('Quá thời gian đăng nhập. Vui lòng thử lại.');
      }, 600000); // 10 phút

    } catch (error: any) {
      console.error("Sign in error:", error);
      setError(error.message || 'Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại.');
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen relative overflow-hidden font-[Inter]" suppressHydrationWarning>
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${Bg.src})`,
        }}
        suppressHydrationWarning
      />

      {/* Gradient Overlay - cool blue/indigo only */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 via-blue-800/70 to-indigo-900/80 z-[1]" />

      {/* Pattern Background */}
      <div
        className="absolute inset-0 z-[2]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)`,
          backgroundSize: '16px 16px'
        }}
      />

      {/* Content Overlay */}
      <div className="absolute inset-0 bg-black/30 z-[3]" />

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {/* Login Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Image src={Logo} alt="SORMS logo" width={100} height={100} priority className="rounded-2xl shadow-xl" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
            Đăng nhập vào SORMS
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Hệ thống quản lý nhà công vụ thông minh
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm text-center">{error}</p>
            </div>
          )}

          {/* Google Sign-In Button - use soft primary blue palette */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300 ${
              isLoading
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Đang xử lý...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Đăng nhập với Google</span>
              </div>
            )}
          </button>

        </div>

        {/* Footer */}
        <div className="mt-8 text-sm text-gray-300">
          <p className="mb-2">
            © 2025 SORMS – Smart Office Residence Management System
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
            <Link 
              href="/policy" 
              className="text-gray-300 hover:text-white underline underline-offset-2 transition-colors duration-200"
            >
              Chính sách bảo mật
            </Link>
            <span className="text-gray-400">|</span>
            <Link 
              href="/terms" 
              className="text-gray-300 hover:text-white underline underline-offset-2 transition-colors duration-200"
            >
              Điều khoản sử dụng
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

