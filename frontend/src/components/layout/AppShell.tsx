"use client";

import { useCompany } from "@/lib/company-context";
import { Sidebar } from "@/components/layout/Sidebar";
import { WelcomeScreen } from "@/components/onboarding/WelcomeScreen";
import { LlmStatusBanner } from "@/components/layout/LlmStatusBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { company, loading } = useCompany();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!company?.is_onboarded) {
    return <WelcomeScreen />;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <LlmStatusBanner />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
