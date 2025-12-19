"use client";

import { useEffect, useState } from "react";
import { authService } from "@/lib/auth-service";
import { cookieManager, type AppRole as HttpAppRole } from "@/lib/http";

export type AppRole = "admin" | "office" | "security" | "staff" | "user" | null;

export function useCurrentRole(): AppRole {
  const [role, setRole] = useState<AppRole>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const loadRole = async () => {
      // Try multiple sources for role
      const fromCookie = cookieManager.getRole() as HttpAppRole | null;
      const fromStorage = localStorage.getItem("userRole");
      
      let currentRole = (fromCookie || fromStorage) as AppRole;
      
      // If no role found, try to get from user info
      if (!currentRole && authService.isAuthenticated()) {
        const userInfo = authService.getUserInfo();
        if (userInfo?.role) {
          currentRole = userInfo.role as AppRole;
        } else {
          // Try introspect as last resort
          const introspectedUser = await authService.introspectToken();
          if (introspectedUser?.role) {
            currentRole = introspectedUser.role as AppRole;
          }
        }
      }
      
      // Validate role
      if (currentRole && ["admin","office","security","staff","user"].includes(currentRole)) {
        setRole(currentRole);
      }
    };

    loadRole();
  }, []);

  return role;
}

/**
 * Hook to check if current user has a specific role
 */
export function useHasRole(requiredRole: AppRole): boolean {
  const currentRole = useCurrentRole();
  return currentRole === requiredRole;
}

/**
 * Hook to check if current user has any of the specified roles
 */
export function useHasAnyRole(roles: AppRole[]): boolean {
  const currentRole = useCurrentRole();
  return roles.includes(currentRole);
}
