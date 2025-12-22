import type { ReactNode } from "react";
import ConditionalLayout from "@/components/layouts/Layout";

export default function OfficeLayout({ children }: { children: ReactNode }) {
  return (
    <ConditionalLayout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50" suppressHydrationWarning>
        <div className="w-full max-w-7xl mx-auto" suppressHydrationWarning>
          {children}
        </div>
      </div>
    </ConditionalLayout>
  );
}
