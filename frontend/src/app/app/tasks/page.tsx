"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  RefreshCw,
  Search,
  Plus,
  User,
  CalendarDays,
  MessageSquare,
  ListTodo,
  AlertTriangle,
  Loader2,
  Tag,
} from "lucide-react";
import {
  tasksApi,
  agentsApi,
  type TaskOut,
  type AgentDefinition,
  type LabelOut,
} from "@/lib/api";
import { TaskDetailDialog } from "@/components/dashboard/TaskDetailDialog";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format, isPast, isToday } from "date-fns";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  awaiting_approval: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const PRIORITY_DOTS: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskOut[]>([]);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [labels, setLabels] = useState<LabelOut[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterLabel, setFilterLabel] = useState("");

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tasksApi.list({
        status: filterStatus || undefined,
        agent_id: filterAgent || undefined,
        priority: filterPriority || undefined,
        search: search || undefined,
        label: filterLabel || undefined,
      });
      setTasks(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterAgent, filterPriority, search, filterLabel]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    agentsApi.listFlat().then(setAgents).catch(() => {});
    tasksApi.listLabels().then(setLabels).catch(() => {});
  }, []);

  const openDetail = (taskId: string) => {
    setSelectedTaskId(taskId);
    setDetailOpen(true);
  };

  const statusCounts = tasks.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalCount = tasks.length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 h-14 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Tasks</h1>
          <Badge variant="secondary" className="text-xs">
            {totalCount}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={loadTasks}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-2 border-b border-border px-6 py-2.5 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="h-8 pl-8 text-xs"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="awaiting_approval">Awaiting Approval</option>
          <option value="completed">Completed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        {labels.length > 0 && (
          <select
            value={filterLabel}
            onChange={(e) => setFilterLabel(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">All Labels</option>
            {labels.map((l) => (
              <option key={l.id} value={l.name}>{l.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Status summary bar */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-2 shrink-0">
        {Object.entries(statusCounts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([status, count]) => (
            <button
              key={status}
              onClick={() => setFilterStatus(filterStatus === status ? "" : status)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all",
                filterStatus === status ? "ring-2 ring-primary ring-offset-1" : "",
                STATUS_STYLES[status] || STATUS_STYLES.pending
              )}
            >
              {status.replace(/_/g, " ")}
              <span className="font-bold">{count}</span>
            </button>
          ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <ListTodo className="h-8 w-8" />
            <p className="text-sm font-medium">No tasks found</p>
            <p className="text-xs">Create tasks from the Command Center board or use /task in chat</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tasks.map((task) => {
              const due = task.due_date ? new Date(task.due_date) : null;
              const overdue = due && isPast(due) && !isToday(due) && task.status !== "completed" && task.status !== "approved";

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => openDetail(task.id)}
                  className="w-full flex items-center gap-4 px-6 py-3 text-left hover:bg-muted/40 transition-colors group"
                >
                  {/* Priority dot */}
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", PRIORITY_DOTS[task.priority] || PRIORITY_DOTS.medium)} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {task.directive}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <User className="h-2.5 w-2.5" />
                        {task.agent_name}
                      </span>
                      {task.labels.length > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Tag className="h-2.5 w-2.5" />
                          {task.labels.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-2 shrink-0">
                    {task.subtask_count > 0 && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <ListTodo className="h-3 w-3" />
                        {task.subtask_count}
                      </span>
                    )}
                    {task.comment_count > 0 && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <MessageSquare className="h-3 w-3" />
                        {task.comment_count}
                      </span>
                    )}
                    {due && (
                      <span className={cn(
                        "text-[10px] flex items-center gap-0.5",
                        overdue ? "text-red-500 font-semibold" : "text-muted-foreground"
                      )}>
                        {overdue && <AlertTriangle className="h-3 w-3" />}
                        <CalendarDays className="h-3 w-3" />
                        {format(due, "MMM d")}
                      </span>
                    )}
                    <span className={cn(
                      "text-[10px] rounded-md px-1.5 py-0.5 font-medium shrink-0",
                      STATUS_STYLES[task.status] || STATUS_STYLES.pending
                    )}>
                      {task.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 w-16 text-right">
                      {formatDistanceToNow(new Date(task.created_at), { addSuffix: true }).replace("about ", "")}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <TaskDetailDialog
        taskId={selectedTaskId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={loadTasks}
      />
    </div>
  );
}
