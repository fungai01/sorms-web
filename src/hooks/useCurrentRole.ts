"use client";

import { useEffect, useState } from "react";

export type AppRole = "admin" | "office" | "staff" | "user" | null;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(";").shift() || null;
  return null;
}

export function useCurrentRole(): AppRole {
  const [role, setRole] = useState<AppRole>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromCookie = readCookie("role");
    const fromStorage = localStorage.getItem("userRole");
    const r = (fromCookie || fromStorage) as AppRole;
  }, []);

  return role;
}


