"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  CheckCircle2,
  Save,
  Trash2,
  Eye,
  EyeOff,
  Twitter,
  Linkedin,
  Instagram,
  Brain,
  Plug,
  Building2,
  Mail,
  Calendar,
  HardDrive,
  MessageSquare,
  Info,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import {
  credentialsApi,
  agentsApi,
  type IntegrationOut,
  type AgentDefinition,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const iconMap: Record<string, React.ElementType> = {
  Twitter,
  Linkedin,
  Instagram,
  Brain,
  Sparkles,
  Mail,
  Calendar,
  HardDrive,
  Building2,
  MessageSquare,
};

function IntegrationIcon({ name }: { name: string }) {
  const Icon = iconMap[name] || Plug;
  return <Icon className="h-5 w-5" />;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationOut[]>([]);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingIntegration, setEditingIntegration] = useState<IntegrationOut | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [intgs, ags] = await Promise.all([
        credentialsApi.listIntegrations(selectedAgent || undefined),
        agentsApi.listFlat(),
      ]);
      setIntegrations(intgs);
      setAgents(ags);
    } catch (err) {
      console.error("Failed to load integrations:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedAgent]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openEditor = (intg: IntegrationOut) => {
    setEditingIntegration(intg);
    const values: Record<string, string> = {};
    intg.fields.forEach((f) => {
      values[f.key] = "";
    });
    setFormValues(values);
    setShowSecrets({});
  };

  const handleSave = async () => {
    if (!editingIntegration) return;
    setSaving(true);

    try {
      const credentials = Object.entries(formValues)
        .filter(([, v]) => v.trim())
        .map(([key, value]) => ({ key, value }));

      if (credentials.length === 0) {
        toast.error("Enter at least one credential value.");
        setSaving(false);
        return;
      }

      await credentialsApi.save({
        integration: editingIntegration.id,
        credentials,
        agent_id: selectedAgent || null,
      });

      toast.success(`${editingIntegration.name} credentials saved.`);
      await loadData();

      setTimeout(() => {
        setEditingIntegration(null);
      }, 600);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (intgId: string) => {
    try {
      await credentialsApi.delete(intgId, selectedAgent || undefined);
      toast.success("Credentials removed.");
      await loadData();
    } catch {
      toast.error("Failed to delete credentials.");
    }
  };

  const grouped = integrations.reduce(
    (acc, intg) => {
      const cat = intg.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(intg);
      return acc;
    },
    {} as Record<string, IntegrationOut[]>
  );

  const configuredCount = integrations.filter((i) => i.configured).length;
  const selectedAgentRecord = agents.find((a) => a.id === selectedAgent);
  const isWorkspaceProvisionedGoogle = selectedAgentRecord?.workspace_provisioned === "google";

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 h-14">
          <h1 className="text-lg font-semibold">Integrations</h1>
        </div>

        <div className="flex-1 overflow-auto p-6 lg:p-8 space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              Manage API keys and tokens for third-party services your agents use.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Slack onboarding and Google Workspace admin credentials are configured here in `Integrations`.
            Workspace-provisioned Google agents can use delegated Gmail, Calendar, and Drive access without a manual OAuth login.
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-emerald-500/15 px-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  {configuredCount}
                </span>
                <span className="text-muted-foreground">connected</span>
              </div>
              <span className="text-border">|</span>
              <div className="flex items-center gap-2 text-sm">
                <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-bold text-muted-foreground">
                  {integrations.length - configuredCount}
                </span>
                <span className="text-muted-foreground">available</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-medium"
              >
                <option value="">Global Credentials</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadData} disabled={loading}>
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {selectedAgent && (
            <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3">
              <Info className="h-4 w-4 text-blue-500 shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Showing credentials for{" "}
                <strong>{selectedAgentRecord?.name}</strong>.
                Agent-specific credentials override global ones.
              </p>
            </div>
          )}

          {isWorkspaceProvisionedGoogle && (
            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 px-4 py-3">
              <Info className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                <strong>{selectedAgentRecord?.name}</strong> is already provisioned in Google Workspace.
                Gmail, Calendar, and Drive can use the linked workspace account automatically; manual OAuth fields are optional fallback only.
              </p>
            </div>
          )}

          {Object.entries(grouped).map(([category, intgs]) => (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  {category}
                </h2>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground/60">{intgs.length}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {intgs.map((intg) => (
                  <Card
                    key={intg.id}
                    className={cn(
                      "group cursor-pointer transition-all hover:shadow-md",
                      intg.configured
                        ? "border-emerald-200/60 dark:border-emerald-800/40 hover:border-emerald-300 dark:hover:border-emerald-700"
                        : "hover:border-primary/40"
                    )}
                    onClick={() => openEditor(intg)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                            intg.configured
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                          )}>
                            <IntegrationIcon name={intg.icon} />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm">{intg.name}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {intg.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {intg.fields.map((f) => (
                          <Badge
                            key={f.key}
                            variant={f.has_value ? "default" : "outline"}
                            className={cn(
                              "text-[11px] font-medium",
                              !f.has_value && "border-dashed text-muted-foreground/70"
                            )}
                          >
                            {f.has_value && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {f.label}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-border/50">
                        {intg.configured ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                            Not configured
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          Configure
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {integrations.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                <Plug className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No integrations available</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Integrations will appear here once configured on the server.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={!!editingIntegration}
        onOpenChange={(v) => !v && setEditingIntegration(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingIntegration && (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <IntegrationIcon name={editingIntegration.icon} />
                </div>
              )}
              {editingIntegration?.name} Credentials
            </DialogTitle>
          </DialogHeader>

          {editingIntegration && (
            <div className="space-y-4">
              {selectedAgent && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3 py-2">
                  <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    These credentials will only apply to{" "}
                    <strong>{agents.find((a) => a.id === selectedAgent)?.name}</strong>.
                  </p>
                </div>
              )}

              {editingIntegration.id === "slack" && (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Slack onboarding uses the global workspace bot token configured on this page. Add the bot token here before enabling Slack during agent onboarding.
                </div>
              )}

              {isWorkspaceProvisionedGoogle && ["google_gmail", "google_calendar", "google_drive"].includes(editingIntegration.id) && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
                  This agent already has a Google Workspace account. The linked workspace email is used automatically through domain-wide delegation, so manual OAuth fields are optional.
                </div>
              )}

              {editingIntegration.fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1">
                    {field.label}
                    {field.required && <span className="text-red-500 text-xs">*</span>}
                    {field.has_value && (
                      <Badge variant="secondary" className="text-[10px] ml-1">configured</Badge>
                    )}
                  </label>
                  <div className="relative">
                    <Input
                      type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                      placeholder={
                        field.has_value
                          ? "••••••• (leave blank to keep current)"
                          : field.placeholder
                      }
                      value={formValues[field.key] || ""}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    />
                    {field.secret && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowSecrets((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showSecrets[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                  {field.help_text && (
                    <p className="text-xs text-muted-foreground">{field.help_text}</p>
                  )}
                </div>
              ))}

              <div className="flex justify-between pt-2">
                {editingIntegration.configured && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { handleDelete(editingIntegration.id); setEditingIntegration(null); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" size="sm" onClick={() => setEditingIntegration(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Save className="h-3.5 w-3.5 mr-1" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
