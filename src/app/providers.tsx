"use client";

// Providers component - no longer uses NextAuth SessionProvider
// Custom auth is handled via useAuth hook and authService
export function Providers({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

