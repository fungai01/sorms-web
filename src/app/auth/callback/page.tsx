"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

// Helper: Check if email is super admin
function isSuperAdminEmail(email: string): boolean {
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAIL_WHITELIST || 'quyentnqe170062@fpt.edu.vn,sangpdpqe170196@fpt.edu.vn').split(',');
  return adminEmails.some(adminEmail =>
    email.toLowerCase() === adminEmail.trim().toLowerCase()
  );
}

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

      // Xử lý user trong database - Fixed U0002 handling
      const processUser = async () => {
        setIsProcessing(true);

        try {
          let userStatus = 'ACTIVE';
          let actualRole = 'user'; // Default role for new users

          // Bước 1: Kiểm tra user đã tồn tại chưa
          console.log('👤 Checking if user exists...');
          const checkResponse = await fetch(`/api/system/users/check?email=${encodeURIComponent(userEmail)}`);

          if (checkResponse.ok) {
            const checkData = await checkResponse.json();

            if (checkData.exists && checkData.user) {
              // User đã tồn tại - lấy role và status từ backend
              console.log('✅ User exists in database');
              userStatus = checkData.user.status || checkData.status || 'ACTIVE';

              // Check if super admin
              const isSuperAdmin = isSuperAdminEmail(userEmail);
              if (isSuperAdmin) {
                // Super admin can choose role from URL parameter
                actualRole = role || 'admin';
                console.log('🔑 Super admin can choose role:', actualRole);
              } else {
                // Regular user - use role from backend
                actualRole = checkData.user.role || checkData.role || 'user';
                console.log('📋 Regular user role from backend:', actualRole);
              }
            } else {
              // User mới - tạo với role "user" mặc định
              console.log('🆕 New user detected, creating with role "user"...');
              const createResponse = await fetch('/api/system/users?action=create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: userEmail,
                  full_name: userName || userEmail,
                  role: 'user' // ALWAYS create new users as "user"
                })
              });

              if (createResponse.ok) {
                console.log('✅ User created successfully with role "user"');
                const createData = await createResponse.json();
                userStatus = createData.status || 'ACTIVE';
                actualRole = 'user';
              } else {
                // Kiểm tra nếu lỗi là "User already exists" (U0002)
                const errorData = await createResponse.json().catch(() => ({}));
                console.log('⚠️ Create user response:', errorData);

                if (errorData.responseCode === 'U0002') {
                  // User đã tồn tại - thử fetch lại thông tin user
                  console.log('✅ User already exists in backend, fetching user info...');

                  // Check if super admin first
                  const isSuperAdmin = isSuperAdminEmail(userEmail);
                  if (isSuperAdmin) {
                    console.log('🔑 Super admin detected, can choose any role');
                    userStatus = 'ACTIVE';
                    // Super admin can choose role from URL parameter
                    actualRole = role || 'admin'; // Use selected role or default to admin
                    console.log('🔑 Super admin selected role:', actualRole);
                  } else {
                    // Try to fetch role from backend for non-super-admin users
                    try {
                      const recheckResponse = await fetch(`/api/system/users/check?email=${encodeURIComponent(userEmail)}`);
                      if (recheckResponse.ok) {
                        const recheckData = await recheckResponse.json();
                        if (recheckData.exists && recheckData.user) {
                          userStatus = recheckData.user.status || 'ACTIVE';
                          actualRole = recheckData.user.role || 'user';
                          console.log('✅ Fetched existing user info:', { role: actualRole, status: userStatus });
                        } else {
                          // Không fetch được - dùng default
                          console.log('⚠️ Could not fetch user info, using defaults');
                          userStatus = 'ACTIVE';
                          actualRole = 'user';
                        }
                      } else {
                        // API lỗi - dùng default
                        console.log('⚠️ Recheck API failed, using defaults');
                        userStatus = 'ACTIVE';
                        actualRole = 'user';
                      }
                    } catch (e) {
                      console.log('⚠️ Error rechecking user, using defaults:', e);
                      userStatus = 'ACTIVE';
                      actualRole = 'user';
                    }
                  }
                } else {
                  // Lỗi khác - thực sự fail
                  console.error('❌ Failed to create user:', errorData);
                  throw new Error('Failed to create user');
                }
              }
            }
          } else {
            console.error('❌ Failed to check user existence');
            throw new Error('Failed to check user');
          }

          // Kiểm tra status
          if (userStatus === 'INACTIVE') {
            console.log('❌ User INACTIVE, needs admin activation');
            router.push("/login?error=inactive");
            return;
          }

          // Lưu ACTUAL ROLE từ backend (không tin role từ URL)
          console.log('💾 Saving actual role from backend:', actualRole);
          localStorage.setItem("userRole", actualRole);
          localStorage.setItem("isLoggedIn", "true");
          localStorage.setItem("userEmail", userEmail);
          localStorage.setItem("userName", userName || "");
          document.cookie = `role=${actualRole}; path=/; max-age=86400`;

          // Redirect dựa trên ACTUAL ROLE từ backend
          const redirectUrl = (() => {
            switch (actualRole) {
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
                return "/user/dashboard"; // Default to user dashboard
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

