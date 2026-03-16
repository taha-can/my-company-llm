"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  CheckCircle2,
  Save,
  Globe,
  Mail,
  Info,
} from "lucide-react";
import { companyApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function WorkspacePage() {
  const [provider, setProvider] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    companyApi.getWorkspace().then((ws) => {
      setProvider(ws.workspace_provider);
      setDomain(ws.workspace_domain);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await companyApi.saveWorkspace({ workspace_provider: provider, workspace_domain: domain });
      toast.success("Workspace settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 h-14">
        <h1 className="text-lg font-semibold">Workspace</h1>
      </div>

      <div className="flex-1 overflow-auto p-6 lg:p-8">
        <div className="max-w-2xl space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Workspace Connection</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your workspace to auto-provision accounts for AI agents.
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                  <Globe className="h-[18px] w-[18px] text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-sm">Workspace Provider</CardTitle>
                  <CardDescription className="text-xs">Choose your email and productivity suite</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "google", label: "Google Workspace", desc: "Gmail, Calendar, Drive", iconColor: "text-red-500", bgColor: "bg-red-500/10" },
                  { id: "microsoft", label: "Microsoft 365", desc: "Outlook, Teams, OneDrive", iconColor: "text-blue-500", bgColor: "bg-blue-500/10" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className={cn(
                      "relative rounded-xl border-2 p-5 text-left transition-all",
                      provider === p.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/30 hover:shadow-sm"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", p.bgColor)}>
                        {p.id === "google" ? (
                          <Mail className={cn("h-5 w-5", p.iconColor)} />
                        ) : (
                          <Globe className={cn("h-5 w-5", p.iconColor)} />
                        )}
                      </div>
                      {provider === p.id && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="text-sm font-semibold">{p.label}</div>
                    <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Mail className="h-[18px] w-[18px] text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm">Domain Configuration</CardTitle>
                  <CardDescription className="text-xs">Set your company domain for agent email accounts</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Domain <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="company.com"
                  />
                </div>
                {domain && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Agent emails will be created as <strong className="text-foreground">firstname.lastname@{domain}</strong>
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {provider && (
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15">
                    <Info className="h-[18px] w-[18px] text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm text-blue-800 dark:text-blue-200">Setup Instructions</CardTitle>
                    <CardDescription className="text-xs text-blue-600/80 dark:text-blue-400/80">
                      Follow these steps to complete the {provider === "google" ? "Google Workspace" : "Microsoft 365"} connection
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {provider === "google" ? (
                  <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-2.5">
                    <li className="flex gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[11px] font-bold text-blue-600 dark:text-blue-300">1</span>
                      <span>Create a Service Account in Google Cloud Console</span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[11px] font-bold text-blue-600 dark:text-blue-300">2</span>
                      <span>Enable Domain-wide Delegation for the service account</span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[11px] font-bold text-blue-600 dark:text-blue-300">3</span>
                      <span>Enable the Admin SDK API</span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[11px] font-bold text-blue-600 dark:text-blue-300">4</span>
                      <span>Go to <strong>Integrations</strong> and add the service account JSON under &ldquo;Google Workspace Admin&rdquo;</span>
                    </li>
                  </ol>
                ) : (
                  <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-2.5">
                    <li className="flex gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[11px] font-bold text-blue-600 dark:text-blue-300">1</span>
                      <span>Register an App in Azure AD / Entra ID</span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[11px] font-bold text-blue-600 dark:text-blue-300">2</span>
                      <span>Grant <strong>User.ReadWrite.All</strong> application permission</span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[11px] font-bold text-blue-600 dark:text-blue-300">3</span>
                      <span>Create a client secret</span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[11px] font-bold text-blue-600 dark:text-blue-300">4</span>
                      <span>Go to <strong>Integrations</strong> and add Tenant ID, Client ID, and Client Secret under &ldquo;Microsoft 365 Admin&rdquo;</span>
                    </li>
                  </ol>
                )}
              </CardContent>
            </Card>
          )}

          <Button onClick={handleSave} disabled={saving || !domain.trim()} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Saving..." : "Save Workspace Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
