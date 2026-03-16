"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { AgentCombobox } from "@/components/ui/agent-combobox";
import {
  User,
  CalendarDays,
  Tag,
  MessageSquare,
  ListTodo,
  Pencil,
  Check,
  X,
  Plus,
  Send,
  Loader2,
  CheckCircle2,
  Circle,
} from "lucide-react";
import {
  tasksApi,
  agentsApi,
  type TaskOut,
  type TaskComment,
  type AgentDefinition,
  type PriorityLevel,
  type LabelOut,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  awaiting_approval: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

interface TaskDetailDialogProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export function TaskDetailDialog({
  taskId,
  open,
  onOpenChange,
  onUpdated,
}: TaskDetailDialogProps) {
  const [task, setTask] = useState<TaskOut | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [subtasks, setSubtasks] = useState<TaskOut[]>([]);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [labels, setLabels] = useState<LabelOut[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");

  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [creatingSubtask, setCreatingSubtask] = useState(false);

  const [activeTab, setActiveTab] = useState<"comments" | "subtasks">("comments");

  const loadTask = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const [t, c, s, a, l] = await Promise.all([
        tasksApi.get(taskId),
        tasksApi.getComments(taskId),
        tasksApi.getSubtasks(taskId),
        agentsApi.listFlat(),
        tasksApi.listLabels().catch(() => [] as LabelOut[]),
      ]);
      setTask(t);
      setComments(c);
      setSubtasks(s);
      setAgents(a);
      setLabels(l);
    } catch {
      toast.error("Failed to load task.");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (open && taskId) {
      loadTask();
      setEditingTitle(false);
      setEditingDesc(false);
      setActiveTab("comments");
    }
  }, [open, taskId, loadTask]);

  const updateField = useCallback(
    async (data: Record<string, unknown>) => {
      if (!taskId) return;
      try {
        const updated = await tasksApi.update(taskId, data as Parameters<typeof tasksApi.update>[1]);
        setTask(updated);
        onUpdated?.();
      } catch {
        toast.error("Failed to update.");
      }
    },
    [taskId, onUpdated]
  );

  const saveTitle = async () => {
    if (!titleDraft.trim()) return;
    await updateField({ directive: titleDraft.trim() });
    setEditingTitle(false);
  };

  const saveDesc = async () => {
    await updateField({ description: descDraft });
    setEditingDesc(false);
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !taskId) return;
    setSendingComment(true);
    try {
      const comment = await tasksApi.addComment(taskId, newComment.trim());
      setComments((prev) => [...prev, comment]);
      setNewComment("");
      onUpdated?.();
    } catch {
      toast.error("Failed to add comment.");
    } finally {
      setSendingComment(false);
    }
  };

  const handleCreateSubtask = async () => {
    if (!subtaskDraft.trim() || !taskId) return;
    setCreatingSubtask(true);
    try {
      const sub = await tasksApi.create({
        directive: subtaskDraft.trim(),
        parent_task_id: taskId,
        agent_id: task?.agent_id || undefined,
      });
      setSubtasks((prev) => [...prev, sub]);
      setSubtaskDraft("");
      setShowSubtaskInput(false);
      onUpdated?.();
    } catch {
      toast.error("Failed to create subtask.");
    } finally {
      setCreatingSubtask(false);
    }
  };

  if (!task && !loading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogTitle className="sr-only">
          {task?.directive || "Task Details"}
        </DialogTitle>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : task ? (
          <>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {editingTitle ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        className="text-lg font-semibold"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveTitle();
                          if (e.key === "Escape") setEditingTitle(false);
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveTitle}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingTitle(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <h2
                      className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors group"
                      onClick={() => {
                        setTitleDraft(task.directive);
                        setEditingTitle(true);
                      }}
                    >
                      {task.directive}
                      <Pencil className="h-3 w-3 inline ml-2 opacity-0 group-hover:opacity-50" />
                    </h2>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className={cn("text-[11px] rounded-md px-2 py-0.5 font-medium", STATUS_COLORS[task.status] || STATUS_COLORS.pending)}>
                      {task.status.replace(/_/g, " ")}
                    </span>
                    <span className={cn("text-[11px] rounded-md px-2 py-0.5 font-medium", PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium)}>
                      {task.priority}
                    </span>
                    {task.labels.map((l) => (
                      <Badge key={l} variant="outline" className="text-[10px] gap-1">
                        <Tag className="h-2.5 w-2.5" />
                        {l}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="grid grid-cols-[1fr_220px] divide-x divide-border min-h-full">
                {/* Main content */}
                <div className="p-6 space-y-6">
                  {/* Description */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Description
                    </h3>
                    {editingDesc ? (
                      <div className="space-y-2">
                        <Textarea
                          value={descDraft}
                          onChange={(e) => setDescDraft(e.target.value)}
                          rows={4}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveDesc}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingDesc(false)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 rounded-md p-2 -m-2 min-h-[40px] transition-colors"
                        onClick={() => {
                          setDescDraft(task.description || "");
                          setEditingDesc(true);
                        }}
                      >
                        {task.description || "Click to add a description..."}
                      </div>
                    )}
                  </div>

                  {/* Tabs: Comments / Subtasks */}
                  <div>
                    <div className="flex gap-4 border-b border-border mb-4">
                      <button
                        className={cn(
                          "pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 -mb-px",
                          activeTab === "comments"
                            ? "border-primary text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setActiveTab("comments")}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Comments
                        {comments.length > 0 && (
                          <span className="text-[10px] bg-muted rounded-full px-1.5 py-0.5">{comments.length}</span>
                        )}
                      </button>
                      <button
                        className={cn(
                          "pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 -mb-px",
                          activeTab === "subtasks"
                            ? "border-primary text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setActiveTab("subtasks")}
                      >
                        <ListTodo className="h-3.5 w-3.5" />
                        Subtasks
                        {subtasks.length > 0 && (
                          <span className="text-[10px] bg-muted rounded-full px-1.5 py-0.5">{subtasks.length}</span>
                        )}
                      </button>
                    </div>

                    {activeTab === "comments" && (
                      <div className="space-y-4">
                        {comments.length === 0 && (
                          <p className="text-xs text-muted-foreground py-4 text-center">No comments yet</p>
                        )}
                        {comments.map((c) => (
                          <div key={c.id} className="flex gap-3">
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarFallback className={cn("text-[10px] text-white font-bold", c.role === "ceo" ? "bg-primary" : "bg-emerald-600")}>
                                {c.role === "ceo" ? "Y" : (c.agent_name || "A").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">
                                  {c.role === "ceo" ? "You" : c.agent_name || "Agent"}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                                </span>
                              </div>
                              <p className="text-sm mt-0.5 whitespace-pre-wrap">{c.content}</p>
                            </div>
                          </div>
                        ))}

                        <div className="flex gap-2 pt-2">
                          <Input
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Write a comment..."
                            className="text-sm"
                            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendComment()}
                          />
                          <Button
                            size="icon"
                            className="shrink-0 h-9 w-9"
                            onClick={handleSendComment}
                            disabled={sendingComment || !newComment.trim()}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {activeTab === "subtasks" && (
                      <div className="space-y-2">
                        {subtasks.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 hover:bg-muted/50 transition-colors"
                          >
                            {sub.status === "completed" || sub.status === "approved" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <span className={cn(
                              "text-sm flex-1",
                              (sub.status === "completed" || sub.status === "approved") && "line-through text-muted-foreground"
                            )}>
                              {sub.directive}
                            </span>
                            <span className={cn("text-[10px] rounded px-1.5 py-0.5", PRIORITY_COLORS[sub.priority])}>
                              {sub.priority}
                            </span>
                          </div>
                        ))}

                        {showSubtaskInput ? (
                          <div className="flex gap-2">
                            <Input
                              value={subtaskDraft}
                              onChange={(e) => setSubtaskDraft(e.target.value)}
                              placeholder="Subtask description..."
                              className="text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleCreateSubtask();
                                if (e.key === "Escape") setShowSubtaskInput(false);
                              }}
                            />
                            <Button size="sm" onClick={handleCreateSubtask} disabled={creatingSubtask || !subtaskDraft.trim()}>
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Add
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setShowSubtaskInput(false)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-dashed"
                            onClick={() => setShowSubtaskInput(true)}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Add Subtask
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sidebar details */}
                <div className="p-4 space-y-4 bg-muted/20">
                  <DetailField label="Status">
                    <Select
                      value={task.status}
                      onValueChange={(v) => updateField({ status: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["pending", "in_progress", "awaiting_approval", "completed"].map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {s.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DetailField>

                  <DetailField label="Priority">
                    <Select
                      value={task.priority}
                      onValueChange={(v) => updateField({ priority: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["low", "medium", "high", "urgent"] as const).map((p) => (
                          <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DetailField>

                  <DetailField label="Assignee">
                    <AgentCombobox
                      agents={agents}
                      value={task.agent_id || ""}
                      onChange={(v) => updateField({ agent_id: v || null })}
                    />
                  </DetailField>

                  <DetailField label="Board">
                    <Select
                      value={task.board}
                      onValueChange={(v) => updateField({ board: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["backlog", "in_progress", "review", "done"].map((b) => (
                          <SelectItem key={b} value={b} className="text-xs">
                            {b.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DetailField>

                  <DetailField label="Due Date">
                    <DatePicker
                      value={task.due_date ? new Date(task.due_date) : undefined}
                      onChange={(d) => updateField({ due_date: d ? d.toISOString() : null })}
                      placeholder="Set due date"
                    />
                  </DetailField>

                  <DetailField label="Labels">
                    <div className="flex flex-wrap gap-1">
                      {task.labels.map((l) => (
                        <Badge
                          key={l}
                          variant="secondary"
                          className="text-[10px] cursor-pointer hover:bg-destructive/20"
                          onClick={() => {
                            updateField({ labels: task.labels.filter((x) => x !== l) });
                          }}
                        >
                          {l} <X className="h-2.5 w-2.5 ml-0.5" />
                        </Badge>
                      ))}
                      {labels
                        .filter((l) => !task.labels.includes(l.name))
                        .slice(0, 5)
                        .map((l) => (
                          <Badge
                            key={l.id}
                            variant="outline"
                            className="text-[10px] cursor-pointer hover:bg-accent"
                            onClick={() => {
                              updateField({ labels: [...task.labels, l.name] });
                            }}
                          >
                            <Plus className="h-2.5 w-2.5 mr-0.5" />
                            {l.name}
                          </Badge>
                        ))}
                    </div>
                  </DetailField>

                  <div className="border-t border-border pt-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground">
                      Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Updated {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
