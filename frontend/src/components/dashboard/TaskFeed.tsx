"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import type { TaskOut } from "@/lib/api";
import { tasksApi } from "@/lib/api";

interface TaskFeedProps {
  tasks: TaskOut[];
  onRefresh: () => void;
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  in_progress: "default",
  awaiting_approval: "secondary",
  approved: "default",
  rejected: "destructive",
  completed: "default",
  failed: "destructive",
};

export function TaskFeed({ tasks, onRefresh }: TaskFeedProps) {
  const handleApproval = async (taskId: string, action: "approve" | "reject") => {
    try {
      await tasksApi.approve(taskId, action);
      onRefresh();
    } catch (err) {
      console.error("Approval failed:", err);
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No tasks yet</p>
        <p className="text-sm mt-1">
          Tasks will appear here when you give directives to your agents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <Card key={task.id}>
          <CardContent className="flex items-start justify-between gap-4 py-4">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {task.agent_name}
                </span>
                <Badge
                  variant={statusVariants[task.status] || "outline"}
                  className="text-xs"
                >
                  {task.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {task.directive}
              </p>
              {task.result && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  Result: {task.result}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {new Date(task.created_at).toLocaleString()}
              </p>
            </div>

            {task.status === "awaiting_approval" && (
              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleApproval(task.id, "approve")}
                >
                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApproval(task.id, "reject")}
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
