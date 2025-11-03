"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [selectedRole, setSelectedRole] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const role = searchParams.get("role");

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && session?.user?.email) {
      const userEmail = session?.user?.email || ""
      const userName = session?.user?.name || ""
      // Tạo user trong database nếu chưa tồn tại
      const createUser = async () => {
        if (!role) {
          router.push("/login");
          return;
        }

        setIsProcessing(true);

        try {
          // Tạo user trong database
          const response = await fetch('/api/system/users?action=create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userEmail,
              full_name: userName || userEmail,
              role: role
            })
          });

          if (!response.ok) {
            throw new Error('Failed to create user');
          }

          const data = await response.json();

          // Check user status
          const userStatus = data.user?.status;

          // Nếu user INACTIVE, redirect về login với error
          if (userStatus === 'INACTIVE') {
            router.push("/login?error=inactive");
            return;
          }

          // Lưu role vào localStorage và cookie (chỉ để UI, không dùng cho auth)
          localStorage.setItem("userRole", role);
          localStorage.setItem("isLoggedIn", "true");
          localStorage.setItem("userEmail", userEmail);
          localStorage.setItem("userName", userName || "");
          document.cookie = `role=${role}; path=/; max-age=86400`;

          // Redirect dựa trên role
          const redirectUrl = (() => {
            switch (role) {
              case "admin":
                return "/admin/dashboard";
              case "office":
                return "/office/dashboard";
              case "lecturer":
              case "guest":
                return "/user/dashboard";
              case "staff":
                return "/staff/dashboard";
              default:
                return "/";
            }
          })();

          router.push(redirectUrl);
        } catch (error) {
          console.error('Error creating user:', error);
          router.push("/login?error=create_user_failed");
        }
      };

      createUser();
    }
  }, [status, session, role, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-700 text-lg">
            {isProcessing ? "Đang xử lý..." : "Đang xác thực..."}
          </p>
          <p className="text-gray-500 text-sm mt-2">Vui lòng đợi trong giây lát</p>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Đang tải...</div>}>
      <AuthCallbackInner />
    </Suspense>
  )
}

