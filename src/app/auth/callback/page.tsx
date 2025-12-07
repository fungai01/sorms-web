"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authService, mapRoleToAppRole } from "@/lib/auth-service";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProcessed, setHasProcessed] = useState(false);

  // Lấy code và state từ URL (Google OAuth callback)
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  
  // Lấy role từ sessionStorage (đã lưu khi login) - optional, chỉ dùng để validate
  const role = typeof window !== 'undefined' ? sessionStorage.getItem('selectedRole') : null;

  useEffect(() => {

    // Backend đã tự động tạo user trong OutboundAuthenticationService.createNewAccountFromOAuth()
    // Frontend không cần check/create user nữa
    // Chỉ cần lấy role từ token/introspect response (đã được backend xác thực)
    const getUserRoleFromToken = (userInfo: any): string => {
      // Ưu tiên roles từ token/introspect response
      const roles = userInfo.roles || userInfo.roleName || [];
      if (Array.isArray(roles) && roles.length > 0) {
        return String(roles[0]);
      }
      // Fallback to role field
      if (userInfo.role) {
        return String(userInfo.role);
      }
      // Default to USER
      return 'USER';
    };

    // Đảm bảo chỉ xử lý 1 lần (tránh React strict mode hoặc re-render)
    if (hasProcessed) {
      console.log('⚠️ Callback already processed, skipping...');
      return;
    }

    const processCallback = async () => {
      // Đánh dấu đã bắt đầu xử lý
      setHasProcessed(true);
      // Kiểm tra nếu có lỗi từ OAuth
      if (errorParam) {
        const errorMessage = `Lỗi OAuth: ${errorParam}`;
        setError(errorMessage);
        setIsProcessing(false);
        
        // Kiểm tra xem có phải đang trong popup không
        if (window.opener && !window.opener.closed) {
          // Gửi message về parent window với lỗi
          window.opener.postMessage({
            type: 'GOOGLE_LOGIN_ERROR',
            error: errorMessage
          }, window.location.origin);
          
          // Đóng popup sau một chút để đảm bảo message được gửi
          setTimeout(() => {
            window.close();
          }, 100);
        } else {
          setTimeout(() => {
            router.push('/login?error=oauth_error');
          }, 2000);
        }
        return;
      }

      // Kiểm tra nếu không có code
      if (!code) {
        const errorMessage = 'Không nhận được mã xác thực từ Google';
        setError(errorMessage);
        setIsProcessing(false);
        
        // Kiểm tra xem có phải đang trong popup không
        if (window.opener && !window.opener.closed) {
          // Gửi message về parent window với lỗi
          window.opener.postMessage({
            type: 'GOOGLE_LOGIN_ERROR',
            error: errorMessage
          }, window.location.origin);
          
          // Đóng popup sau một chút để đảm bảo message được gửi
          setTimeout(() => {
            window.close();
          }, 100);
        } else {
          setTimeout(() => {
            router.push('/login?error=no_code');
          }, 2000);
        }
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        // Get redirect URI from localStorage (đã lưu khi lấy OAuth URL)
        // Phải khớp với redirectUri đã gửi khi lấy OAuth URL
        const redirectUri = typeof window !== 'undefined' 
          ? localStorage.getItem('oauth_redirect_uri') || `${window.location.origin}/api/auth/callback/google`
          : 'http://localhost:3000/api/auth/callback/google';

        // Exchange code for tokens
        console.log('🔄 Exchanging OAuth code for tokens...');
        const tokens = await authService.handleOAuthCallback(code, state || undefined);
        console.log('✅ Tokens received successfully');

        // Lấy user info từ localStorage (đã được lưu trong handleOAuthCallback)
        // Nếu không có, gọi introspectToken để lấy từ backend
        let userInfo = authService.getUserInfo();
        
        if (!userInfo || !userInfo.email) {
          console.log('🔄 User info not found in storage, introspecting token...');
          userInfo = await authService.introspectToken();
          
          if (!userInfo || !userInfo.email) {
            throw new Error('Không thể lấy thông tin người dùng. Vui lòng thử đăng nhập lại.');
          }
        }

        console.log('✅ User info:', {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          roles: userInfo.roles,
          role: userInfo.role,
        });

        // Backend đã tự động tạo user trong OAuth flow
        // Lấy role từ token/introspect response (đã được backend xác thực)
        const databaseRole = getUserRoleFromToken(userInfo);
        const selectedRoleFromLogin = role; // Role user selected on login page (optional)

        // Kiểm tra role: User chỉ có thể đăng nhập với role của mình trong database
        // Chỉ admin mới có thể đăng nhập với role khác
        console.log('🔍 Role validation:', {
          databaseRole,
          selectedRole: selectedRoleFromLogin,
          userInfoRole: userInfo.role,
          rolesFromToken: userInfo.roles || userInfo.roleName,
          isAdmin: databaseRole.toUpperCase() === 'ADMIN'
        });

        // Map backend role to app role for comparison
        const mappedDatabaseRole = mapRoleToAppRole(databaseRole);
        const mappedSelectedRole = selectedRoleFromLogin ? mapRoleToAppRole(selectedRoleFromLogin) : null;

        if (mappedDatabaseRole !== 'admin' && mappedSelectedRole && mappedSelectedRole !== mappedDatabaseRole) {
          // Non-admin user tried to login with different role
          console.log('❌ Role mismatch: User tried to login with different role', {
            databaseRole: mappedDatabaseRole,
            selectedRole: mappedSelectedRole
          });
          await authService.logout();
          router.push('/login?error=role_mismatch');
          return;
        }
        // Admin có thể đăng nhập với bất kỳ role nào (hoặc role đã chọn)

        // Sử dụng role từ token (role thực tế từ backend)
        const rawActualRole = databaseRole;
        const actualRole = (await import('@/lib/auth-service')).mapRoleToAppRole(rawActualRole as string);
        console.log('💾 Saving user info, role from database/token (mapped):', { rawActualRole, actualRole });
        
        localStorage.setItem('userRole', actualRole);
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userEmail', userInfo.email);
        localStorage.setItem('userName', userInfo.name || userInfo.email);
        if (userInfo.picture) {
          localStorage.setItem('userPicture', userInfo.picture);
        }
        
        // Xóa selectedRole và oauth_redirect_uri từ storage
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('selectedRole');
          localStorage.removeItem('oauth_redirect_uri');
        }
        
        document.cookie = `role=${actualRole}; path=/; max-age=86400`;
        document.cookie = `isLoggedIn=true; path=/; max-age=86400`;

        // Redirect dựa trên role FE (đã map từ backend role sang: admin | office | staff | user)
        const redirectUrl = (() => {
          switch (actualRole) {
            case 'admin':
              return '/admin/dashboard';
            case 'office':
              return '/office/dashboard';
            case 'staff':
              return '/staff/dashboard';
            case 'security':
              return '/security/dashboard';
            default:
              return '/user/dashboard';
          }
        })();

        console.log('✅ Login thành công, redirect tới:', redirectUrl);
        
        // Xóa code khỏi URL để tránh sử dụng lại (OAuth code chỉ dùng 1 lần)
        if (typeof window !== 'undefined' && code) {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('code');
          newUrl.searchParams.delete('state');
          window.history.replaceState({}, '', newUrl.toString());
        }
        
        // Kiểm tra xem có phải đang trong popup không
        if (window.opener && !window.opener.closed) {
          // Gửi message về parent window
          window.opener.postMessage({
            type: 'GOOGLE_LOGIN_SUCCESS',
            redirectUrl: redirectUrl
          }, window.location.origin);
          
          // Đóng popup sau một chút để đảm bảo message được gửi
          setTimeout(() => {
            window.close();
          }, 100);
        } else {
          // Nếu không phải popup, redirect bình thường
          router.push(redirectUrl);
        }
      } catch (err) {
        console.error('❌ OAuth callback error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Có lỗi xảy ra trong quá trình xác thực';
        setError(errorMessage);
        
        // Clear auth data và storage
        authService.clearAuth();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('oauth_redirect_uri');
          sessionStorage.removeItem('selectedRole');
          
          // Xóa code khỏi URL để tránh retry với code đã hết hạn
          if (code) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('code');
            newUrl.searchParams.delete('state');
            window.history.replaceState({}, '', newUrl.toString());
          }
        }
        
        // Xác định error code để redirect với message phù hợp
        let errorParam = 'auth_failed';
        if (errorMessage.includes('hết hạn') || errorMessage.includes('đã được sử dụng') || errorMessage.includes('expired') || errorMessage.includes('used')) {
          errorParam = 'code_expired';
        } else if (errorMessage.includes('RedirectUri') || errorMessage.includes('redirect_uri')) {
          errorParam = 'redirect_uri_mismatch';
        }
        
        // Kiểm tra xem có phải đang trong popup không
        if (window.opener && !window.opener.closed) {
          // Gửi message về parent window với lỗi
          window.opener.postMessage({
            type: 'GOOGLE_LOGIN_ERROR',
            error: errorMessage
          }, window.location.origin);
          
          // Đóng popup sau một chút để đảm bảo message được gửi
          setTimeout(() => {
            window.close();
          }, 100);
        } else {
          // Nếu không phải popup, redirect về login sau 2 giây với error code
          setTimeout(() => {
            router.push(`/login?error=${errorParam}`);
          }, 2000);
        }
      } finally {
        setIsProcessing(false);
      }
    };

    // Chỉ xử lý nếu có code hoặc error
    if (code || errorParam) {
      processCallback();
    }
  }, [code, state, errorParam, role, router, hasProcessed]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex flex-col items-center space-y-4">
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 font-medium">Đang xác thực...</p>
          </>
        ) : error ? (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-600 text-lg font-semibold">Lỗi xác thực</p>
            <p className="text-gray-700 text-sm text-center max-w-md">{error}</p>
            <p className="text-gray-500 text-xs mt-2">Đang chuyển về trang đăng nhập...</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 font-medium">Đang xác thực...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 font-medium">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}

