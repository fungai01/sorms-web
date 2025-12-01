"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authService } from "@/lib/auth-service";

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
  
  // Lấy role từ sessionStorage (đã lưu khi login)
  const role = typeof window !== 'undefined' ? sessionStorage.getItem('selectedRole') : null;

  useEffect(() => {
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
        setError(`Lỗi OAuth: ${errorParam}`);
        setIsProcessing(false);
        setTimeout(() => {
          router.push('/login?error=oauth_error');
        }, 2000);
        return;
      }

      // Kiểm tra nếu không có code
      if (!code) {
        setError('Không nhận được mã xác thực từ Google');
        setIsProcessing(false);
        setTimeout(() => {
          router.push('/login?error=no_code');
        }, 2000);
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

        // Introspect token để lấy user info
        console.log('🔄 Introspecting token...');
        const userInfo = await authService.introspectToken();
        
        if (!userInfo || !userInfo.email) {
          throw new Error('Không thể lấy thông tin người dùng');
        }

        console.log('✅ User info:', userInfo);

        // Kiểm tra user đã tồn tại trong database chưa
        // Lưu ý: Nếu introspect token thành công, nghĩa là user đã tồn tại trong backend
        // Chỉ check để lấy thêm thông tin (status, role) từ database
        console.log('🔍 Checking if user exists in database...', {
          email: userInfo.email,
          userId: userInfo.id,
          rolesFromToken: userInfo.roles || userInfo.roleName,
        });
        
        let userExists = false;
        let databaseRole: string | null = null;
        let userStatus: string | null = null;
        
        try {
          const checkResponse = await fetch(`/api/system/users/check?email=${encodeURIComponent(userInfo.email)}`, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_access_token') || ''}`
            }
          });

          console.log('📋 Check response status:', checkResponse.status);

          if (checkResponse.ok) {
            const checkData = await checkResponse.json();
            console.log('📋 User check response:', JSON.stringify(checkData, null, 2));
            
            if (checkData.exists) {
              userExists = true;
              databaseRole = checkData.user?.role || null;
              userStatus = checkData.user?.status || null;
              
              console.log('✅ User exists in database:', {
                email: checkData.user?.email,
                status: userStatus,
                role: databaseRole
              });
              
              // Kiểm tra user status
              if (userStatus === 'INACTIVE') {
                console.log('❌ User INACTIVE, needs admin activation');
                await authService.logout();
                router.push('/login?error=inactive');
                return;
              }
            } else {
              // User CHƯA tồn tại trong database → Tự động tạo user mới
              console.log('ℹ️ User not found in database, creating new user...');
              
              // Lấy role từ token hoặc selectedRole để tạo user với role đúng
              const rolesFromToken = userInfo.roles || userInfo.roleName || [];
              const roleToCreate = role || rolesFromToken[0] || userInfo.role || 'user';
              
              console.log('🔑 Creating user with role:', {
                roleToCreate: roleToCreate,
                selectedRole: role,
                rolesFromToken: rolesFromToken,
                userInfoRole: userInfo.role
              });
              
              try {
                // Tạo user mới với thông tin từ Google OAuth và role
                const createUserResponse = await fetch('/api/system/users?action=create', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_access_token') || ''}`
                  },
                  body: JSON.stringify({
                    email: userInfo.email,
                    full_name: userInfo.name || userInfo.firstName && userInfo.lastName 
                      ? `${userInfo.firstName} ${userInfo.lastName}`
                      : userInfo.email,
                    firstName: userInfo.firstName || '',
                    lastName: userInfo.lastName || '',
                    phone_number: userInfo.phoneNumber || '',
                    role: roleToCreate, // Gửi role để backend lưu vào database
                  })
                });

                console.log('📋 Create user response status:', createUserResponse.status);

                if (createUserResponse.ok) {
                  const createData = await createUserResponse.json();
                  console.log('✅ User created successfully:', createData);
                  
                  // Lấy role từ user mới tạo hoặc từ token
                  databaseRole = createData.role || userInfo.roles?.[0] || userInfo.role || 'user';
                  userStatus = createData.status || 'ACTIVE';
                  userExists = true;
                  
                  console.log('✅ New user created with role:', databaseRole);
                } else {
                  let errorData: any = {};
                  try {
                    errorData = await createUserResponse.json();
                  } catch (parseError) {
                    const errorText = await createUserResponse.text().catch(() => 'Unknown error');
                    console.error('❌ Failed to parse error response:', errorText);
                    errorData = { error: errorText };
                  }
                  
                  console.error('❌ Failed to create user:', errorData);
                  
                  // Nếu lỗi là email đã tồn tại, có thể user đã được tạo ở request khác
                  const errorMessage = typeof errorData.error === 'string' ? errorData.error : '';
                  const isDuplicateError = errorData.responseCode === 'U0002' || 
                    (errorMessage && errorMessage.includes('đã tồn tại'));
                  
                  if (isDuplicateError) {
                    console.warn('⚠️ User might already exist, trying to continue...');
                    // Sử dụng role từ token
                    const rolesFromToken = userInfo.roles || userInfo.roleName || [];
                    databaseRole = rolesFromToken[0] || userInfo.role || 'user';
                    userExists = true;
                  } else {
                    // Lỗi khác, không thể tạo user
                    const errorMsg = typeof errorData.error === 'string' 
                      ? errorData.error 
                      : (typeof errorData.message === 'string' 
                        ? errorData.message 
                        : 'Không thể tạo tài khoản');
                    throw new Error(errorMsg);
                  }
                }
              } catch (createError) {
                console.error('❌ Error creating user:', createError);
                throw new Error('Không thể tạo tài khoản. Vui lòng liên hệ admin.');
              }
            }
          } else {
            // Nếu API check fail (500, etc), thử tạo user mới
            const errorText = await checkResponse.text().catch(() => 'Unknown error');
            console.error('❌ Check API failed:', {
              status: checkResponse.status,
              error: errorText
            });
            
            console.log('ℹ️ Check API failed, trying to create user...');
            
            // Lấy role từ token hoặc selectedRole
            const rolesFromToken = userInfo.roles || userInfo.roleName || [];
            const roleToCreate = role || rolesFromToken[0] || userInfo.role || 'user';
            
            try {
              // Tạo user mới với thông tin từ Google OAuth và role
              const createUserResponse = await fetch('/api/system/users?action=create', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('auth_access_token') || ''}`
                },
                body: JSON.stringify({
                  email: userInfo.email,
                  full_name: userInfo.name || userInfo.firstName && userInfo.lastName 
                    ? `${userInfo.firstName} ${userInfo.lastName}`
                    : userInfo.email,
                  firstName: userInfo.firstName || '',
                  lastName: userInfo.lastName || '',
                  phone_number: userInfo.phoneNumber || '',
                  role: roleToCreate, // Gửi role để backend lưu vào database
                })
              });

              if (createUserResponse.ok) {
                const createData = await createUserResponse.json();
                console.log('✅ User created successfully:', createData);
                
                databaseRole = createData.role || userInfo.roles?.[0] || userInfo.role || 'user';
                userStatus = createData.status || 'ACTIVE';
                userExists = true;
              } else {
                let errorData: any = {};
                try {
                  errorData = await createUserResponse.json();
                } catch (parseError) {
                  const errorText = await createUserResponse.text().catch(() => 'Unknown error');
                  console.error('❌ Failed to parse error response:', errorText);
                  errorData = { error: errorText };
                }
                
                // Nếu lỗi là email đã tồn tại, có thể user đã được tạo
                const errorMessage = typeof errorData.error === 'string' ? errorData.error : '';
                const isDuplicateError = errorData.responseCode === 'U0002' || 
                  (errorMessage && errorMessage.includes('đã tồn tại'));
                
                if (isDuplicateError) {
                  console.warn('⚠️ User might already exist, using role from token');
                  const rolesFromToken = userInfo.roles || userInfo.roleName || [];
                  databaseRole = rolesFromToken[0] || userInfo.role || 'user';
                  userExists = true;
                } else {
                  const errorMsg = typeof errorData.error === 'string' 
                    ? errorData.error 
                    : (typeof errorData.message === 'string' 
                      ? errorData.message 
                      : 'Không thể tạo tài khoản');
                  throw new Error(errorMsg);
                }
              }
            } catch (createError) {
              console.error('❌ Error creating user:', createError);
              // Nếu không thể tạo user, vẫn thử tiếp tục với role từ token
              const rolesFromToken = userInfo.roles || userInfo.roleName || [];
              databaseRole = rolesFromToken[0] || userInfo.role || 'user';
              userExists = true; // Vẫn cho phép login vì introspect đã thành công
              console.warn('⚠️ Could not create user, but introspect succeeded, allowing login with role from token');
            }
          }
        } catch (checkError) {
          console.error('❌ Error checking user existence:', checkError);
          
          // Thử tạo user mới
          console.log('ℹ️ Check API error, trying to create user...');
          
          // Lấy role từ token hoặc selectedRole
          const rolesFromToken = userInfo.roles || userInfo.roleName || [];
          const roleToCreate = role || rolesFromToken[0] || userInfo.role || 'user';
          
          try {
            const createUserResponse = await fetch('/api/system/users?action=create', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_access_token') || ''}`
              },
              body: JSON.stringify({
                email: userInfo.email,
                full_name: userInfo.name || userInfo.firstName && userInfo.lastName 
                  ? `${userInfo.firstName} ${userInfo.lastName}`
                  : userInfo.email,
                firstName: userInfo.firstName || '',
                lastName: userInfo.lastName || '',
                phone_number: userInfo.phoneNumber || '',
                role: roleToCreate, // Gửi role để backend lưu vào database
              })
            });

            if (createUserResponse.ok) {
              const createData = await createUserResponse.json();
              console.log('✅ User created successfully:', createData);
              
              databaseRole = createData.role || userInfo.roles?.[0] || userInfo.role || 'user';
              userStatus = createData.status || 'ACTIVE';
              userExists = true;
            } else {
              let errorData: any = {};
              try {
                errorData = await createUserResponse.json();
              } catch (parseError) {
                const errorText = await createUserResponse.text().catch(() => 'Unknown error');
                console.error('❌ Failed to parse error response:', errorText);
                errorData = { error: errorText };
              }
              
              const errorMessage = typeof errorData.error === 'string' ? errorData.error : '';
              const isDuplicateError = errorData.responseCode === 'U0002' || 
                (errorMessage && errorMessage.includes('đã tồn tại'));
              
              if (isDuplicateError) {
                console.warn('⚠️ User might already exist, using role from token');
                const rolesFromToken = userInfo.roles || userInfo.roleName || [];
                databaseRole = rolesFromToken[0] || userInfo.role || 'user';
                userExists = true;
              } else {
                // Nếu không thể tạo, vẫn cho phép login với role từ token
                const rolesFromToken = userInfo.roles || userInfo.roleName || [];
                databaseRole = rolesFromToken[0] || userInfo.role || 'user';
                userExists = true;
                console.warn('⚠️ Could not create user, but introspect succeeded, allowing login');
              }
            }
          } catch (createError) {
            console.error('❌ Error creating user:', createError);
            // Nếu không thể tạo, vẫn cho phép login với role từ token
            const rolesFromToken = userInfo.roles || userInfo.roleName || [];
            databaseRole = rolesFromToken[0] || userInfo.role || 'user';
            userExists = true;
            console.warn('⚠️ Could not create user, but introspect succeeded, allowing login');
          }
        }

        // Nếu vẫn không có user (không thể tạo và không có trong database)
        if (!userExists) {
          console.log('❌ User not found and could not be created, blocking login');
          await authService.logout();
          router.push('/login?error=user_not_found');
          return;
        }

        // Kiểm tra role: User chỉ có thể đăng nhập với role của mình trong database
        // Chỉ admin mới có thể đăng nhập với role khác
        const selectedRoleFromLogin = role; // Role đã chọn trong login page
        
        console.log('🔍 Role validation:', {
          databaseRole: databaseRole,
          selectedRole: selectedRoleFromLogin,
          userInfoRole: userInfo.role,
          rolesFromToken: userInfo.roles || userInfo.roleName,
          isAdmin: databaseRole === 'admin'
        });

        if (databaseRole && databaseRole !== 'admin') {
          // Nếu không phải admin, phải đăng nhập với role của mình
          if (selectedRoleFromLogin && selectedRoleFromLogin !== databaseRole) {
            console.log('❌ Role mismatch: User tried to login with different role', {
              databaseRole: databaseRole,
              selectedRole: selectedRoleFromLogin
            });
            await authService.logout();
            router.push('/login?error=role_mismatch');
            return;
          }
        }
        // Nếu là admin, có thể đăng nhập với bất kỳ role nào (hoặc role đã chọn)

        // Sử dụng role từ database hoặc token (role thực tế), không phải role đã chọn
        const actualRole = databaseRole || userInfo.role || 'user';
        console.log('💾 Saving user info, role from database/token:', actualRole);
        
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

        // Redirect dựa trên role từ database/token
        const redirectUrl = (() => {
          switch (actualRole) {
            case 'admin':
              return '/admin/dashboard';
            case 'office':
              return '/office/dashboard';
            case 'lecturer':
            case 'guest':
              return '/user/dashboard';
            case 'staff':
              return '/staff/dashboard';
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
        
        router.push(redirectUrl);
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
        
        // Redirect về login sau 2 giây với error code
        setTimeout(() => {
          router.push(`/login?error=${errorParam}`);
        }, 2000);
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

