"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import { authService } from "@/lib/auth-service";

export default function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useCurrentRole();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!pathname) {
      setIsChecking(false);
      return;
    }

    const checkAccess = async () => {
      try {
        // Public routes that don't require authentication
        const publicRoutes = ["/verification/checkin", "/verification/open-door"];
        if (publicRoutes.includes(pathname)) {
          setIsChecking(false);
          return;
        }

        // Check if user is authenticated
        const isAuthenticated = authService.isAuthenticated();
        
        if (!isAuthenticated) {
          // Not authenticated, redirect to home
          router.replace("/");
          return;
        }

        // Get role from multiple sources for reliability
        let currentRole = role;
        
        // If role is not available from hook, try to get from localStorage or introspect
        if (!currentRole) {
          const roleFromStorage = typeof window !== 'undefined' 
            ? localStorage.getItem('userRole') 
            : null;
          
          if (roleFromStorage && ['admin', 'office', 'security', 'staff', 'user'].includes(roleFromStorage)) {
            currentRole = roleFromStorage as any;
          } else {
            // Try to get from user info
            const userInfo = authService.getUserInfo();
            if (userInfo?.role) {
              currentRole = userInfo.role as any;
            } else {
              // Try introspect as last resort
              const introspectedUser = await authService.introspectToken();
              if (introspectedUser?.role) {
                currentRole = introspectedUser.role as any;
              }
            }
          }
        }

        if (!currentRole) {
          setIsChecking(false);
          return;
        }

        // Determine required role by path
        const requires: { [key: string]: string } = {
          "/admin": "admin",
          "/office": "office",
          "/staff": "staff",
          "/user": "user",
        };

        const entry = Object.keys(requires).find((p) => pathname.startsWith(p));
        
        // If path doesn't match any protected route, allow access
        if (!entry) {
          setIsChecking(false);
          return;
        }

        // Skip role check for public verification routes
        if (pathname === "/verification/checkin" || pathname === "/verification/open-door") {
          setIsChecking(false);
          return;
        }

        const required = requires[entry];

        // Map role to dashboard path
        const roleToBase: Record<string, string> = {
          admin: "/admin/dashboard",
          office: "/office/dashboard",
          staff: "/staff/dashboard",
          security: "/user/dashboard", // Security users go to user dashboard
          user: "/user/dashboard",
        };

        // If role does not match required area, redirect to correct dashboard
        if (required !== currentRole) {
          console.log(`❌ Access denied: User with role "${currentRole}" tried to access "${required}" area`);
          const target = roleToBase[currentRole] || "/";
          router.replace(target);
          return;
        }

        // Access granted
        setIsChecking(false);
      } catch (error) {
        console.error('RoleGuard error:', error);
        setIsChecking(false);
      }
    };

    checkAccess();
  }, [pathname, role, router]);

  // Show loading while checking
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 font-medium">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}


