"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Check for error query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    
    if (errorParam === 'inactive') {
      setError('Tài khoản của bạn chưa được kích hoạt. Vui lòng liên hệ admin để được kích hoạt.');
    } else if (errorParam === 'no_session') {
      setError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
    } else if (errorParam === 'create_user_failed') {
      setError('Không thể tạo tài khoản. Vui lòng thử lại.');
    }
  }, []);

  const roles = [
    { id: "admin", name: "Admin" },
    { id: "office", name: "Phòng Hành chính" },
    { id: "lecturer", name: "Giảng viên" },
    { id: "staff", name: "Nhân viên" },
    { id: "guest", name: "Khách mời" },
  ];

  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId);
    setIsDropdownOpen(false);
    setError("");
  };

  const handleGoogleSignIn = async () => {
    if (!selectedRole) {
      setError("Vui lòng chọn vai trò trước khi đăng nhập.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Sử dụng Next-Auth signIn với Google provider
      const result = await signIn("google", {
        callbackUrl: `/auth/callback?role=${selectedRole}`,
        redirect: true,
      });

      // Nếu có lỗi (không redirect)
      if (result?.error) {
        setError("Đăng nhập thất bại. Vui lòng thử lại.");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Sign in error:", error);
      setError("Có lỗi xảy ra khi đăng nhập. Vui lòng thử lại.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden font-[Inter]">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('https://cdn.tienphong.vn/images/814b5533c866dc3540018a126103e935e41e658c37f7e8dcbdb6292ed05c91a360f30cb27834f97679b7241f77c48cc540bbcbd3a527fa3765766ab79535fdcf/image003-7518-2471.jpg')",
        }}
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 via-indigo-900/70 to-purple-900/80 z-[1]" />

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
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
              <span className="text-white font-black text-3xl">S</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
            Đăng nhập SORMS
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

          {/* Role Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Chọn vai trò của bạn
            </label>
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-left flex items-center justify-between hover:border-blue-500 focus:outline-none focus:border-blue-500 transition-colors"
              >
                <span className={selectedRole ? "text-gray-800" : "text-gray-400"}>
                  {selectedRole
                    ? roles.find((r) => r.id === selectedRole)?.name
                    : "Chọn vai trò..."}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute z-20 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => handleRoleSelect(role.id)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors text-gray-700 hover:text-blue-600"
                    >
                      {role.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Google Sign-In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={!selectedRole || isLoading}
            className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-300 ${
              !selectedRole || isLoading
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 hover:shadow-lg hover:scale-105"
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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

          {/* Info Text */}
          <p className="mt-6 text-xs text-center text-gray-500">
            Chỉ cho phép đăng nhập bằng email @fpt.edu.vn, @fe.edu.vn, @gmail.com hoặc @outlook.com
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-sm text-gray-300">
          © 2025 SORMS – Smart Office Residence Management System
        </p>
      </div>
    </div>
  );
}

