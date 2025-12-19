"use client";

import type { ReactNode } from "react";
import ConditionalLayout from "@/components/layouts/Layout";

export default function OfficeLayout({ children }: { children: ReactNode }) {
  return (
    <ConditionalLayout>
      <div className="pb-6 sm:pb-8">
        {children}
      </div>
    </ConditionalLayout>
  );
}
