"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  try {
    return <SessionProvider>{children}</SessionProvider>;
  } catch (error) {
    console.error("SessionProvider error:", error);
    // Fallback if SessionProvider fails
    return <>{children}</>;
  }
}

