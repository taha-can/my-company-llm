"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { companyApi, type CompanySettings } from "@/lib/api";

interface CompanyContextValue {
  company: CompanySettings | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue>({
  company: null,
  loading: true,
  refresh: async () => {},
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await companyApi.get();
      setCompany(data);
    } catch {
      setCompany({ company_name: "", company_description: "", industry: "", brand_voice: "", is_onboarded: false, workspace_provider: "", workspace_domain: "" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <CompanyContext.Provider value={{ company, loading, refresh }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
