"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentRole } from "@/hooks/useCurrentRole";

export default function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useCurrentRole();

  useEffect(() => {
    if (!pathname) return;

    // Important: do NOT redirect to home when role is null on first render.
    // Middleware will enforce auth on the server. Here we only correct mismatches when role is known.
    if (!role) return;

    // Determine required role by path
    const requires: { [key: string]: string } = {
      "/admin": "admin",
      "/office": "office", // office routes behave like user area
      "/staff": "staff",
      "/lecturer": "user", // lecturer maps to user area in app
      "/guest": "user",
      "/user": "user",
    };

    const entry = Object.keys(requires).find((p) => pathname.startsWith(p));
    if (!entry) return;
    const required = requires[entry];

    const roleToBase: Record<string, string> = {
      admin: "/admin/dashboard",
      office: "/office/dashboard", // office should land on user area
      staff: "/staff/dashboard",
      user: "/user/dashboard",
    };

    // If role does not match required area, push to correct base
    if (required !== role) {
      const target = roleToBase[role] || "/";
      router.replace(target);
    }
  }, [pathname, role, router]);

  return <>{children}</>;
}


