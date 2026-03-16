"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Plus,
  Trash2,
  CheckCircle2,
  Globe,
  HardDrive,
  MessageSquare,
  Search,
  Database,
  Cable,
  Plug,
  Play,
  Wrench,
  ExternalLink,
  Terminal,
  Radio,
  ChevronDown,
  ChevronUp,
  Power,
  PowerOff,
  Github,
} from "lucide-react";
import { mcpApi, type McpServerConfig, type McpPreset, type McpServerCreate } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const presetIconMap: Record<string, React.ElementType> = {
  Globe,
  HardDrive,
  Github,
  Database,
  Search,
  MessageSquare,
  Cable,
  Plug,
};

function PresetIcon({ name }: { name: string }) {
  const Icon = presetIconMap[name] || Cable;
  return <Icon className="h-5 w-5" />;
}

export default function McpServersPage() {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [presets, setPresets] = useState<McpPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [srvs, prsts] = await Promise.all([mcpApi.list(), mcpApi.presets()]);
      setServers(srvs);
      setPresets(prsts);
    } catch (err) {
      console.error("Failed to load MCP data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addedPresetIds = new Set(
    servers.filter((s) => s.is_preset).map((s) => s.name.toLowerCase().replace(/ /g, "_"))
  );

  const handleAddPreset = async (preset: McpPreset) => {
    const envVars: Record<string, string> = {};
    preset.env_keys.forEach((k) => { envVars[k] = ""; });

    try {
      const created = await mcpApi.create({
        name: preset.name,
        description: preset.description,
        icon: preset.icon,
        connection_type: preset.connection_type,
        command: preset.command,
        args: preset.args,
        env_vars: envVars,
        is_preset: true,
      });
      setServers((prev) => [...prev, created]);
      toast.success(`${preset.name} added.`);
    } catch (err) {
      toast.error("Failed to add server.");
    }
  };

  const handleDiscover = async (id: string) => {
    setDiscoveringId(id);
    try {
      const res = await mcpApi.discover(id);
      if (res.success) {
        toast.success(`Discovered ${res.tools.length} tools.`);
        await loadData();
      }
    } catch (err) {
      toast.error("Discovery failed. Check server configuration.");
    } finally {
      setDiscoveringId(null);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await mcpApi.test(id);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error("Connection test failed.");
    } finally {
      setTestingId(null);
    }
  };

  const handleToggle = async (srv: McpServerConfig) => {
    try {
      await mcpApi.update(srv.id, { enabled: !srv.enabled });
      setServers((prev) =>
        prev.map((s) => (s.id === srv.id ? { ...s, enabled: !s.enabled } : s))
      );
      toast.success(srv.enabled ? "Server disabled." : "Server enabled.");
    } catch {
      toast.error("Failed to update.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await mcpApi.delete(id);
      setServers((prev) => prev.filter((s) => s.id !== id));
      toast.success("Server removed.");
    } catch {
      toast.error("Failed to delete.");
    }
  };

  const connectedCount = servers.filter((s) => s.enabled).length;
  const totalTools = servers.reduce((sum, s) => sum + s.discovered_tools.length, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 h-14">
        <h1 className="text-lg font-semibold">MCP Servers</h1>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Custom
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6 lg:p-8 space-y-8">
        <div>
          <p className="text-sm text-muted-foreground">
            Connect MCP servers to extend your agents with external tools and capabilities.
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-emerald-500/15 px-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              {connectedCount}
            </span>
            <span className="text-muted-foreground">connected</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-2 text-sm">
            <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[11px] font-bold text-primary">
              {totalTools}
            </span>
            <span className="text-muted-foreground">tools available</span>
          </div>
          <div className="ml-auto">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadData} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Connected Servers */}
        {servers.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Connected Servers
              </h2>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground/60">{servers.length}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {servers.map((srv) => {
                const expanded = expandedServer === srv.id;
                return (
                  <Card
                    key={srv.id}
                    className={cn(
                      "transition-all",
                      srv.enabled
                        ? "border-emerald-200/60 dark:border-emerald-800/40"
                        : "opacity-60"
                    )}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl",
                            srv.enabled
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          )}>
                            <PresetIcon name={srv.icon} />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm">{srv.name}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {srv.description}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggle(srv)}
                          className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                          title={srv.enabled ? "Disable" : "Enable"}
                        >
                          {srv.enabled ? (
                            <Power className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <PowerOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[11px] font-medium">
                          {srv.connection_type === "stdio" ? (
                            <><Terminal className="h-3 w-3 mr-1" />stdio</>
                          ) : (
                            <><Radio className="h-3 w-3 mr-1" />SSE</>
                          )}
                        </Badge>
                        <Badge variant="secondary" className="text-[11px] font-medium">
                          <Wrench className="h-3 w-3 mr-1" />
                          {srv.discovered_tools.length} tools
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs flex-1"
                          onClick={() => handleDiscover(srv.id)}
                          disabled={discoveringId === srv.id}
                        >
                          {discoveringId === srv.id ? (
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Search className="h-3 w-3 mr-1" />
                          )}
                          Discover
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs flex-1"
                          onClick={() => handleTest(srv.id)}
                          disabled={testingId === srv.id}
                        >
                          {testingId === srv.id ? (
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3 mr-1" />
                          )}
                          Test
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(srv.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {srv.discovered_tools.length > 0 && (
                        <button
                          onClick={() => setExpandedServer(expanded ? null : srv.id)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full pt-1 border-t border-border/50"
                        >
                          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {expanded ? "Hide" : "Show"} {srv.discovered_tools.length} tools
                        </button>
                      )}

                      {expanded && srv.discovered_tools.length > 0 && (
                        <div className="space-y-1 max-h-40 overflow-auto">
                          {srv.discovered_tools.map((tool) => (
                            <div key={tool.name} className="flex items-start gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5">
                              <Wrench className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">{tool.name}</p>
                                {tool.description && (
                                  <p className="text-[11px] text-muted-foreground line-clamp-1">{tool.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-border/50">
                        {srv.enabled ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                            Disabled
                          </span>
                        )}
                        {srv.is_preset && (
                          <Badge variant="outline" className="text-[10px] border-dashed">Preset</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Preset Catalog */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Available Presets
            </h2>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {presets.map((preset) => {
              const isAdded = addedPresetIds.has(preset.id);
              return (
                <Card
                  key={preset.id}
                  className={cn(
                    "group transition-all",
                    isAdded
                      ? "border-emerald-200/60 dark:border-emerald-800/40"
                      : "hover:border-primary/40 hover:shadow-md"
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                        isAdded
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                      )}>
                        <PresetIcon name={preset.icon} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm">{preset.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{preset.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[11px] font-medium">
                        <Terminal className="h-3 w-3 mr-1" />
                        {preset.connection_type}
                      </Badge>
                      {preset.env_keys.length > 0 && (
                        <Badge variant="outline" className="text-[11px] font-medium border-dashed text-muted-foreground/70">
                          {preset.env_keys.length} env {preset.env_keys.length === 1 ? "var" : "vars"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      {isAdded ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Added
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleAddPreset(preset)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Server
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {servers.length === 0 && presets.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
              <Cable className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No MCP servers available</p>
          </div>
        )}
      </div>

      {/* Add Custom Server Dialog */}
      <AddCustomServerDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onCreated={(srv) => {
          setServers((prev) => [...prev, srv]);
          setShowAddDialog(false);
        }}
      />
    </div>
  );
}


function AddCustomServerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (srv: McpServerConfig) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [connType, setConnType] = useState<"stdio" | "sse">("stdio");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName("");
    setDescription("");
    setConnType("stdio");
    setCommand("");
    setArgs("");
    setUrl("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (connType === "stdio" && !command.trim()) {
      toast.error("Command is required for stdio servers.");
      return;
    }
    if (connType === "sse" && !url.trim()) {
      toast.error("URL is required for SSE servers.");
      return;
    }

    setSaving(true);
    try {
      const data: McpServerCreate = {
        name: name.trim(),
        description: description.trim(),
        connection_type: connType,
      };
      if (connType === "stdio") {
        data.command = command.trim();
        data.args = args.trim() ? args.split(/\s+/) : [];
      } else {
        data.url = url.trim();
      }

      const created = await mcpApi.create(data);
      toast.success(`${name} added.`);
      onCreated(created);
      resetForm();
    } catch (err) {
      toast.error("Failed to add server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Cable className="h-4 w-4 text-primary" />
            </div>
            Add Custom MCP Server
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name <span className="text-red-500">*</span></label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My MCP Server" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this server provide?" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Connection Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConnType("stdio")}
                className={cn(
                  "rounded-lg border-2 p-3 text-left transition-all text-sm",
                  connType === "stdio"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                )}
              >
                <div className="flex items-center gap-2 font-medium">
                  <Terminal className="h-4 w-4" />
                  stdio
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Local process</p>
              </button>
              <button
                type="button"
                onClick={() => setConnType("sse")}
                className={cn(
                  "rounded-lg border-2 p-3 text-left transition-all text-sm",
                  connType === "sse"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                )}
              >
                <div className="flex items-center gap-2 font-medium">
                  <Radio className="h-4 w-4" />
                  SSE / HTTP
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Remote server</p>
              </button>
            </div>
          </div>

          {connType === "stdio" ? (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Command <span className="text-red-500">*</span></label>
                <Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Arguments</label>
                <Input value={args} onChange={(e) => setArgs(e.target.value)} placeholder="@playwright/mcp@latest" />
                <p className="text-[11px] text-muted-foreground">Space-separated arguments</p>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">URL <span className="text-red-500">*</span></label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/mcp" />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { resetForm(); onOpenChange(false); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {saving ? "Adding..." : "Add Server"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
