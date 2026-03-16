"use client";

import { useCallback, useEffect, useState } from "react";
import { format, isPast, isToday, formatDistanceToNow } from "date-fns";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { AgentCombobox } from "@/components/ui/agent-combobox";
import {
  Check,
  X,
  Trash2,
  Plus,
  RefreshCw,
  Circle,
  Loader2,
  CheckCircle2,
  Clock,
  KanbanSquare,
  MoreHorizontal,
  MoveRight,
  CalendarDays,
  AlertTriangle,
  GripVertical,
  User,
  Filter,
  XCircle,
  ListTodo,
  MessageSquare,
  Tag,
} from "lucide-react";
import {
  tasksApi,
  agentsApi,
  BOARD,
  DEFAULT_BOARDS,
  type TaskOut,
  type ChatEvent,
  type AgentDefinition,
  type PriorityLevel,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { TaskDetailDialog } from "@/components/dashboard/TaskDetailDialog";

interface TaskPanelProps {
  selectedAgentId?: string;
  selectedDepartment?: string;
  events: ChatEvent[];
  onAddTask?: (agentId: string, directive: string) => void;
  onRemoveTask?: (taskId: string) => void;
}

const boardMeta: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  backlog: { icon: Circle, color: "text-muted-foreground", bg: "bg-muted/40" },
  in_progress: { icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/5" },
  review: { icon: Clock, color: "text-amber-500", bg: "bg-amber-500/5" },
  done: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/5" },
};

function getBoardMeta(board: string) {
  return boardMeta[board] || { icon: Circle, color: "text-violet-500", bg: "bg-violet-500/5" };
}

function formatBoardName(board: string) {
  return board
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function TaskPanel({
  selectedAgentId,
  selectedDepartment,
  events,
  onAddTask,
  onRemoveTask,
}: TaskPanelProps) {
  const [tasks, setTasks] = useState<TaskOut[]>([]);
  const [boards, setBoards] = useState<string[]>(DEFAULT_BOARDS);
  const [loading, setLoading] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addBoardOpen, setAddBoardOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [filterAgent, setFilterAgent] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tasksApi.list();
      setTasks(data);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBoards = useCallback(async () => {
    try {
      const data = await tasksApi.listBoards();
      setBoards(data.length > 0 ? data : DEFAULT_BOARDS);
    } catch {
      setBoards(DEFAULT_BOARDS);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadBoards();
    agentsApi.listFlat().then(setAgents).catch(() => {});
  }, [loadTasks, loadBoards]);

  useEffect(() => {
    const lastEvent = events[events.length - 1];
    if (!lastEvent) return;
    if (
      lastEvent.type === "task_created" ||
      lastEvent.type === "task_updated" ||
      lastEvent.type === "task_removed"
    ) {
      loadTasks();
    }
  }, [events, loadTasks]);

  const handleTaskCreated = () => {
    setAddTaskOpen(false);
    loadTasks();
  };

  const handleRemoveTask = async (taskId: string) => {
    try {
      await tasksApi.delete(taskId);
      onRemoveTask?.(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error("Failed to remove task:", err);
    }
  };

  const handleMoveTask = async (taskId: string, targetBoard: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, board: targetBoard } : t))
    );
    try {
      await tasksApi.update(taskId, { board: targetBoard });
    } catch (err) {
      console.error("Failed to move task:", err);
      loadTasks();
    }
  };

  const handleApprove = async (taskId: string, action: "approve" | "reject") => {
    try {
      await tasksApi.approve(taskId, action);
      loadTasks();
    } catch (err) {
      console.error("Approval failed:", err);
    }
  };

  const handleAddBoard = async () => {
    const slug = newBoardName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    if (!slug || boards.includes(slug)) return;
    try {
      await tasksApi.createBoard(slug);
      setBoards((prev) => [...prev, slug]);
    } catch (err) {
      console.error("Failed to create board:", err);
    }
    setNewBoardName("");
    setAddBoardOpen(false);
  };

  const handleRemoveBoard = async (board: string) => {
    if (DEFAULT_BOARDS.includes(board)) return;
    try {
      await tasksApi.deleteBoard(board);
      setBoards((prev) => prev.filter((b) => b !== board));
    } catch (err) {
      console.error("Failed to delete board:", err);
    }
  };

  const onDragEnd = (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const targetBoard = destination.droppableId;
    const task = tasks.find((t) => t.id === draggableId);
    if (!task || task.board === targetBoard) return;
    handleMoveTask(draggableId, targetBoard);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 h-14 shrink-0">
        <div className="flex items-center gap-2">
          <KanbanSquare className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Board</h2>
          <Badge variant="secondary" className="text-xs">
            {tasks.length} tasks
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Task</DialogTitle>
              </DialogHeader>
              <AddTaskForm
                boards={boards}
                onCreated={handleTaskCreated}
                defaultBoard={BOARD.BACKLOG}
              />
            </DialogContent>
          </Dialog>

          {addBoardOpen ? (
            <div className="flex items-center gap-1">
              <Input
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="Board name..."
                className="h-7 w-32 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddBoard();
                  if (e.key === "Escape") setAddBoardOpen(false);
                }}
                autoFocus
              />
              <Button size="sm" className="h-7 px-2" onClick={handleAddBoard}>
                <Check className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => setAddBoardOpen(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setAddBoardOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Board
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => { loadTasks(); loadBoards(); }}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      {(filterAgent || filterPriority || filterStatus) ? (
        <div className="flex items-center gap-2 border-b border-border px-6 py-2 shrink-0 bg-muted/30">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">Filters:</span>
          {filterAgent && (
            <button
              onClick={() => setFilterAgent("")}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium hover:bg-primary/20"
            >
              {agents.find((a) => a.id === filterAgent)?.name || "Agent"}
              <XCircle className="h-3 w-3" />
            </button>
          )}
          {filterPriority && (
            <button
              onClick={() => setFilterPriority("")}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium hover:bg-primary/20"
            >
              {filterPriority}
              <XCircle className="h-3 w-3" />
            </button>
          )}
          {filterStatus && (
            <button
              onClick={() => setFilterStatus("")}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium hover:bg-primary/20"
            >
              {filterStatus.replace(/_/g, " ")}
              <XCircle className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => { setFilterAgent(""); setFilterPriority(""); setFilterStatus(""); }}
            className="text-[11px] text-muted-foreground hover:text-foreground ml-auto"
          >
            Clear all
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-b border-border px-6 py-2 shrink-0">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="h-6 rounded border-0 bg-transparent px-1 text-[11px] text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
          >
            <option value="">All Agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="h-6 rounded border-0 bg-transparent px-1 text-[11px] text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-6 rounded border-0 bg-transparent px-1 text-[11px] text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="awaiting_approval">Awaiting Approval</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      )}

      {/* Board columns with drag & drop */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
          <div
            className="grid gap-4 p-6 h-full auto-rows-[1fr]"
            style={{ gridTemplateColumns: `repeat(${boards.length}, minmax(260px, 1fr))` }}
          >
            {boards.map((board) => {
              let boardTasks = tasks.filter((t) => t.board === board);
              if (filterAgent) boardTasks = boardTasks.filter((t) => t.agent_id === filterAgent);
              if (filterPriority) boardTasks = boardTasks.filter((t) => t.priority === filterPriority);
              if (filterStatus) boardTasks = boardTasks.filter((t) => t.status === filterStatus);
              return (
              <BoardColumn
                key={board}
                board={board}
                tasks={boardTasks}
                allBoards={boards}
                isDefault={DEFAULT_BOARDS.includes(board)}
                onRemoveTask={handleRemoveTask}
                onMoveTask={handleMoveTask}
                onApprove={handleApprove}
                onRemoveBoard={handleRemoveBoard}
                onOpenAddTask={() => setAddTaskOpen(true)}
                onOpenDetail={(id) => { setDetailTaskId(id); setDetailOpen(true); }}
              />
              );
            })}
          </div>
        </div>
      </DragDropContext>

      <TaskDetailDialog
        taskId={detailTaskId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={() => { loadTasks(); loadBoards(); }}
      />
    </div>
  );
}

/* ── Priority helpers ──────────────────────────────── */

const PRIORITY_CONFIG: Record<
  PriorityLevel,
  { label: string; dotColor: string; badgeClass: string }
> = {
  low: {
    label: "Low",
    dotColor: "bg-slate-400",
    badgeClass: "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400",
  },
  medium: {
    label: "Medium",
    dotColor: "bg-blue-500",
    badgeClass: "border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400",
  },
  high: {
    label: "High",
    dotColor: "bg-amber-500",
    badgeClass: "border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400",
  },
  urgent: {
    label: "Urgent",
    dotColor: "bg-red-500",
    badgeClass: "border-red-200 text-red-700 dark:border-red-800 dark:text-red-400",
  },
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  awaiting_approval: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

/* ── Add Task Form ─────────────────────────────────── */

function AddTaskForm({
  boards,
  onCreated,
  defaultBoard,
}: {
  boards: string[];
  onCreated: () => void;
  defaultBoard: string;
}) {
  const [directive, setDirective] = useState("");
  const [agentId, setAgentId] = useState<string>("");
  const [board, setBoard] = useState(defaultBoard);
  const [priority, setPriority] = useState<PriorityLevel>("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    agentsApi.listFlat().then(setAgents).catch(console.error);
  }, []);

  const handleSubmit = async () => {
    if (!directive.trim()) return;
    setSubmitting(true);
    try {
      await tasksApi.create({
        directive: directive.trim(),
        agent_id: agentId || undefined,
        board,
        priority,
        due_date: dueDate ? dueDate.toISOString() : undefined,
      });
      onCreated();
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pt-2">
      <div className="space-y-2">
        <Label htmlFor="task-directive">Task description</Label>
        <Textarea
          id="task-directive"
          value={directive}
          onChange={(e) => setDirective(e.target.value)}
          placeholder="What needs to be done..."
          rows={3}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label>Assign to agent</Label>
        <AgentCombobox
          agents={agents}
          value={agentId}
          onChange={setAgentId}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Board</Label>
          <Select value={board} onValueChange={setBoard}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {boards.map((b) => (
                <SelectItem key={b} value={b}>
                  {formatBoardName(b)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as PriorityLevel)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRIORITY_CONFIG) as PriorityLevel[]).map((p) => (
                <SelectItem key={p} value={p}>
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${PRIORITY_CONFIG[p].dotColor}`} />
                    {PRIORITY_CONFIG[p].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Due date</Label>
        <DatePicker
          value={dueDate}
          onChange={setDueDate}
          placeholder="No due date"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={handleSubmit} disabled={!directive.trim() || submitting}>
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Plus className="h-4 w-4 mr-1" />
          )}
          Add Task
        </Button>
      </div>
    </div>
  );
}

/* ── Board Column ──────────────────────────────────── */

function BoardColumn({
  board,
  tasks,
  allBoards,
  isDefault,
  onRemoveTask,
  onMoveTask,
  onApprove,
  onRemoveBoard,
  onOpenAddTask,
  onOpenDetail,
}: {
  board: string;
  tasks: TaskOut[];
  allBoards: string[];
  isDefault: boolean;
  onRemoveTask: (id: string) => void;
  onMoveTask: (id: string, board: string) => void;
  onApprove: (id: string, action: "approve" | "reject") => void;
  onRemoveBoard: (board: string) => void;
  onOpenAddTask: () => void;
  onOpenDetail: (id: string) => void;
}) {
  const meta = getBoardMeta(board);
  const Icon = meta.icon;

  return (
    <div className="flex flex-col min-h-0 h-full overflow-hidden">
      <div
        className={`flex items-center gap-2 pb-3 border-b-2 shrink-0 ${meta.color.replace("text-", "border-")}`}
      >
        <Icon className={`h-4 w-4 ${meta.color}`} />
        <span className="text-xs font-semibold uppercase tracking-wider">
          {formatBoardName(board)}
        </span>
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 h-4 ml-auto"
        >
          {tasks.length}
        </Badge>
        {!isDefault && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete board</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the &quot;{formatBoardName(board)}&quot; board?
                  {tasks.length > 0 && (
                    <> This board has {tasks.length} task{tasks.length > 1 ? "s" : ""} that will become unassigned.</>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onRemoveBoard(board)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Droppable droppableId={board}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 min-h-0 overflow-y-auto mt-3 rounded-lg transition-colors ${
              snapshot.isDraggingOver ? `${meta.bg} ring-2 ring-inset ring-border/50` : ""
            }`}
          >
            <div className="space-y-2 pr-1 pb-2">
              {tasks.length === 0 && !snapshot.isDraggingOver && (
                <button
                  onClick={onOpenAddTask}
                  className="w-full border border-dashed border-border rounded-lg py-8 text-xs text-muted-foreground hover:border-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4 mx-auto mb-1 opacity-50" />
                  Add a task
                </button>
              )}
              {tasks.map((task, index) => (
                <Draggable key={task.id} draggableId={task.id} index={index}>
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      style={dragProvided.draggableProps.style}
                    >
                      <TaskCard
                        task={task}
                        allBoards={allBoards}
                        currentBoard={board}
                        onRemove={onRemoveTask}
                        onMove={onMoveTask}
                        onApprove={onApprove}
                        onOpenDetail={onOpenDetail}
                        isDragging={dragSnapshot.isDragging}
                        dragHandleProps={dragProvided.dragHandleProps}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          </div>
        )}
      </Droppable>
    </div>
  );
}

/* ── Task Card ─────────────────────────────────────── */

function TaskCard({
  task,
  allBoards,
  currentBoard,
  onRemove,
  onMove,
  onApprove,
  onOpenDetail,
  isDragging,
  dragHandleProps,
}: {
  task: TaskOut;
  allBoards: string[];
  currentBoard: string;
  onRemove: (id: string) => void;
  onMove: (id: string, board: string) => void;
  onApprove: (id: string, action: "approve" | "reject") => void;
  onOpenDetail: (id: string) => void;
  isDragging: boolean;
  dragHandleProps: Record<string, unknown> | null | undefined;
}) {
  const otherBoards = allBoards.filter((b) => b !== currentBoard);
  const priorityCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
  const statusStyle = STATUS_STYLES[task.status] ?? STATUS_STYLES.pending;

  const dueDateInfo = task.due_date
    ? (() => {
        const due = new Date(task.due_date);
        const overdue =
          isPast(due) && !isToday(due) && task.status !== "completed" && task.status !== "done";
        return { due, overdue };
      })()
    : null;

  return (
    <div
      className={`group relative rounded-lg border bg-card text-card-foreground transition-all ${
        isDragging
          ? "shadow-lg ring-2 ring-primary/20 rotate-[2deg] scale-[1.02]"
          : "shadow-sm hover:shadow-md"
      }`}
    >
      {/* Priority accent bar */}
      <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${priorityCfg.dotColor}`} />

      <div className="p-3.5 pl-4 space-y-2.5">
        {/* Top row: drag handle + directive + menu */}
        <div className="flex items-start gap-2">
          <div
            {...dragHandleProps}
            className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing shrink-0"
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          <button
            type="button"
            onClick={() => onOpenDetail(task.id)}
            className="text-sm leading-relaxed flex-1 font-medium text-left hover:text-primary transition-colors cursor-pointer"
          >
            {task.directive}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -mt-0.5"
              >
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {otherBoards.map((b) => (
                <DropdownMenuItem key={b} onClick={() => onMove(task.id, b)}>
                  <MoveRight className="h-3.5 w-3.5 mr-2" />
                  Move to {formatBoardName(b)}
                </DropdownMenuItem>
              ))}
              {task.status !== "in_progress" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onRemove(task.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Result preview */}
        {task.result && (
          <p className="text-xs text-muted-foreground line-clamp-2 pl-5.5">
            {task.result}
          </p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-1.5 pl-[22px]">
          {/* Agent */}
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 rounded-md px-1.5 py-0.5">
            <User className="h-3 w-3" />
            {task.agent_name}
          </span>

          {/* Priority (only show non-medium) */}
          {task.priority && task.priority !== "medium" && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] rounded-md px-1.5 py-0.5 border ${priorityCfg.badgeClass}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${priorityCfg.dotColor}`} />
              {priorityCfg.label}
            </span>
          )}

          {/* Status */}
          {task.status !== "pending" && (
            <span className={`text-[11px] rounded-md px-1.5 py-0.5 ${statusStyle}`}>
              {task.status.replace(/_/g, " ")}
            </span>
          )}

          {/* Labels */}
          {task.labels && task.labels.length > 0 && task.labels.map((l) => (
            <span key={l} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/60 rounded-md px-1.5 py-0.5">
              <Tag className="h-2.5 w-2.5" />{l}
            </span>
          ))}

          {/* Subtask & comment counts */}
          {task.subtask_count > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <ListTodo className="h-3 w-3" />{task.subtask_count}
            </span>
          )}
          {task.comment_count > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <MessageSquare className="h-3 w-3" />{task.comment_count}
            </span>
          )}
        </div>

        {/* Footer: due date + created */}
        <div className="flex items-center gap-2 pl-[22px]">
          {dueDateInfo && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] ${
                dueDateInfo.overdue ? "text-red-500 font-semibold" : "text-muted-foreground"
              }`}
            >
              {dueDateInfo.overdue && <AlertTriangle className="h-3 w-3" />}
              <CalendarDays className="h-3 w-3" />
              {format(dueDateInfo.due, "MMM d")}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/60 ml-auto">
            {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
          </span>
        </div>

        {/* Approval actions */}
        {task.status === "awaiting_approval" && (
          <div className="flex gap-1.5 pt-1 pl-[22px]">
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs flex-1"
              onClick={() => onApprove(task.id, "approve")}
            >
              <Check className="h-3 w-3 mr-1" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs flex-1"
              onClick={() => onApprove(task.id, "reject")}
            >
              <X className="h-3 w-3 mr-1" /> Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
