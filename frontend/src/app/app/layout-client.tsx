"use client";

import { CompanyProvider } from "@/lib/company-context";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "sonner";

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <CompanyProvider>
      <AppShell>{children}</AppShell>
      <Toaster theme="dark" richColors position="bottom-right" />
    </CompanyProvider>
  );
}
