import type { ReactNode } from "react";
import ConditionalLayout from "@/components/layouts/Layout";

export default function SecurityLayout({ children }: { children: ReactNode }) {
  return (
    <ConditionalLayout>
      {children}
    </ConditionalLayout>
  );
}




