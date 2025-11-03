import type { ReactNode } from "react";
import ConditionalLayout from "@/components/layouts/ConditionalLayout";

export default function NotificationsLayout({ children }: { children: ReactNode }) {
  return (
    <ConditionalLayout>
      {children}
    </ConditionalLayout>
  );
}
