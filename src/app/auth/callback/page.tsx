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

      // Xử lý user trong database
      const processUser = async () => {
        if (!role) {
          router.push("/login");
          return;
        }

        setIsProcessing(true);

        try {
          let userStatus = 'ACTIVE'; // Default status

          // Thử tạo user mới
          console.log('👤 Attempting to create/verify user...');
          const createResponse = await fetch('/api/system/users?action=create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userEmail,
              full_name: userName || userEmail,
              role: role
            })
          });

          if (createResponse.ok) {
            // User được tạo thành công
            console.log('✅ User created successfully');
            const createData = await createResponse.json();
            userStatus = createData.status || createData.user?.status || 'ACTIVE';
          } else {
            // Kiểm tra nếu lỗi là "User already exists"
            const errorText = await createResponse.text();

            try {
              const errorData = JSON.parse(errorText);
              const backendError = errorData.error ? JSON.parse(errorData.error.replace('Backend error: 400 - ', '')) : null;

              if (backendError?.responseCode === 'U0002') {
                // User đã tồn tại - đây là OK, lấy thông tin user
                console.log('ℹ️ User already exists, fetching user info...');

                // Gọi API để lấy thông tin user
                const checkResponse = await fetch(`/api/system/users/check?email=${encodeURIComponent(userEmail)}`);
                if (checkResponse.ok) {
                  const checkData = await checkResponse.json();
                  if (checkData.exists) {
                    userStatus = checkData.status || 'ACTIVE';
                    console.log('✅ User found with status:', userStatus);
                  }
                } else {
                  // Nếu không lấy được thông tin, assume ACTIVE (vì user đã tồn tại)
                  console.log('⚠️ Could not fetch user info, assuming ACTIVE');
                  userStatus = 'ACTIVE';
                }
              } else {
                // Lỗi khác
                console.error('❌ Failed to create user:', errorText);
                throw new Error('Failed to create user');
              }
            } catch (parseError) {
              console.error('❌ Error parsing error response:', parseError);
              throw new Error('Failed to create user');
            }
          }

          // Kiểm tra status
          if (userStatus === 'INACTIVE') {
            console.log('❌ User INACTIVE, redirect về login');
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

          console.log('✅ Login thành công, redirect tới:', redirectUrl);
          router.push(redirectUrl);
        } catch (error) {
          console.error('❌ Error processing user:', error);
          router.push("/login?error=create_user_failed");
        }
      };

      processUser();
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

