"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Upload,
  FileText,
  Image,
  FileSpreadsheet,
  File as FileIcon,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
} from "lucide-react";
import { filesApi, agentsApi, type AgentDefinition, type FileUploadResult } from "@/lib/api";

interface FileUploadProps {
  agentId?: string;
  onUploaded?: () => void;
  trigger?: React.ReactNode;
}

const fileTypeIcons: Record<string, React.ElementType> = {
  ".pdf": FileText,
  ".docx": FileText,
  ".txt": FileText,
  ".md": FileText,
  ".csv": FileSpreadsheet,
  ".xlsx": FileSpreadsheet,
  ".png": Image,
  ".jpg": Image,
  ".jpeg": Image,
  ".gif": Image,
  ".webp": Image,
};

function getFileIcon(filename: string) {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  return fileTypeIcons[ext] || FileIcon;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface QueuedFile {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  result?: FileUploadResult;
  error?: string;
}

export function FileUpload({ agentId, onUploaded, trigger }: FileUploadProps) {
  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [targetAgent, setTargetAgent] = useState<string>(agentId || "");
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    agentsApi.listFlat().then(setAgents).catch(console.error);
  }, []);

  useEffect(() => {
    if (agentId) setTargetAgent(agentId);
  }, [agentId]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles: QueuedFile[] = Array.from(files).map((file) => ({
      file,
      status: "pending" as const,
    }));
    setQueue((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleUploadAll = async () => {
    setUploading(true);

    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status !== "pending") continue;

      setQueue((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "uploading" } : item
        )
      );

      try {
        const result = await filesApi.upload(
          queue[i].file,
          targetAgent || undefined
        );
        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "done", result } : item
          )
        );
      } catch (err) {
        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: "error",
                  error: err instanceof Error ? err.message : "Upload failed",
                }
              : item
          )
        );
      }
    }

    setUploading(false);
    onUploaded?.();
  };

  const pendingCount = queue.filter((f) => f.status === "pending").length;
  const doneCount = queue.filter((f) => f.status === "done").length;
  const totalChunks = queue.reduce(
    (sum, f) => sum + (f.result?.chunks || 0),
    0
  );

  const handleClose = () => {
    setOpen(false);
    setQueue([]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Upload className="h-3.5 w-3.5" />
            Upload Files
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Files to Knowledge Base</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Agent selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Store in</label>
            <select
              value={targetAgent}
              onChange={(e) => setTargetAgent(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Shared Company Knowledge</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}&apos;s Memory ({agent.department})
                </option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
              dragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            }`}
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOCX, TXT, MD, CSV, XLSX, images
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              accept=".txt,.md,.pdf,.docx,.xlsx,.xls,.csv,.tsv,.json,.xml,.html,.htm,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.log"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* File queue */}
          {queue.length > 0 && (
            <div className="space-y-2 max-h-52 overflow-auto">
              {queue.map((item, i) => {
                const Icon = getFileIcon(item.file.name);
                return (
                  <div
                    key={`${item.file.name}-${i}`}
                    className="flex items-center gap-3 rounded-md border border-border p-2.5"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(item.file.size)}
                        {item.result && ` — ${item.result.chunks} chunks`}
                        {item.error && ` — ${item.error}`}
                      </p>
                    </div>
                    {item.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(i);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {item.status === "uploading" && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
                    )}
                    {item.status === "done" && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}
                    {item.status === "error" && (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary + upload button */}
          {queue.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {doneCount > 0 && (
                  <Badge variant="secondary">{doneCount} uploaded</Badge>
                )}
                {totalChunks > 0 && (
                  <Badge variant="secondary">{totalChunks} chunks</Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClose}>
                  {doneCount === queue.length && doneCount > 0 ? "Done" : "Cancel"}
                </Button>
                {pendingCount > 0 && (
                  <Button size="sm" onClick={handleUploadAll} disabled={uploading}>
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    Upload {pendingCount} file{pendingCount > 1 ? "s" : ""}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
