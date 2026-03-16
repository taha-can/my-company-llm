"use client";

import { useEffect, useRef, useState } from "react";
import {
  ListTodo,
  Building2,
  Bot,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: React.ElementType;
  suffix?: string;
}

const COMMANDS: SlashCommand[] = [
  {
    command: "/task",
    label: "Create Task",
    description: "Add a task to the board",
    icon: ListTodo,
    suffix: " ",
  },
  {
    command: "/department",
    label: "Switch Department",
    description: "Route to a department lead",
    icon: Building2,
    suffix: " ",
  },
  {
    command: "/agent",
    label: "Switch Agent",
    description: "Chat with a specific agent",
    icon: Bot,
    suffix: " ",
  },
  {
    command: "/meeting",
    label: "Department Meeting",
    description: "Route to the department lead, who can consult the team",
    icon: Users,
    suffix: " ",
  },
  {
    command: "/auto",
    label: "Auto-route",
    description: "Pick the best department lead, then fall back to CEO Office",
    icon: RotateCcw,
  },
  {
    command: "/clear",
    label: "Clear Chat",
    description: "Clear conversation history",
    icon: Trash2,
  },
];

interface SlashCommandMenuProps {
  filter: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  visible: boolean;
}

export function SlashCommandMenu({
  filter,
  onSelect,
  onClose,
  visible,
}: SlashCommandMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = COMMANDS.filter((cmd) =>
    cmd.command.startsWith(filter.toLowerCase())
  );
  const safeActiveIndex = activeIndex >= filtered.length ? 0 : activeIndex;

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (filtered.length > 0) {
          e.preventDefault();
          onSelect(filtered[safeActiveIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [visible, filtered, safeActiveIndex, onSelect, onClose]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 right-0 mb-1 mx-4 rounded-lg border border-border bg-popover shadow-lg overflow-hidden z-30"
    >
      <div className="px-3 py-2 border-b border-border">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Commands
        </p>
      </div>
      <div className="py-1 max-h-[200px] overflow-y-auto">
        {filtered.map((cmd, i) => {
          const Icon = cmd.icon;
          return (
            <button
              key={cmd.command}
              type="button"
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                i === safeActiveIndex
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground hover:bg-accent/50"
              )}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(cmd);
              }}
            >
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <span className="text-sm font-medium">
                  <span className="font-mono text-primary">{cmd.command}</span>
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  {cmd.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { COMMANDS };
