import type { Metadata } from "next";
import { AppLayoutClient } from "./layout-client";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s | my-company-llm",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppLayoutClient>{children}</AppLayoutClient>;
}
