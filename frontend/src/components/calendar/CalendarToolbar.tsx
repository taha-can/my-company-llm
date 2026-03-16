"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CalendarViewMode } from "@/components/calendar/utils";
import { cn } from "@/lib/utils";

type CalendarToolbarProps = {
  title: string;
  view: CalendarViewMode;
  writable: boolean;
  onToday: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onViewChange: (view: CalendarViewMode) => void;
  onCreateEvent: () => void;
};

const viewOptions: CalendarViewMode[] = ["month", "week", "day"];

export function CalendarToolbar({
  title,
  view,
  writable,
  onToday,
  onPrevious,
  onNext,
  onViewChange,
  onCreateEvent,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onCreateEvent} disabled={!writable}>
          <Plus className="h-4 w-4" />
          Create
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>
          Today
        </Button>
        <div className="flex items-center rounded-md border border-border bg-background">
          <Button variant="ghost" size="icon-sm" onClick={onPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="ml-1 text-base font-semibold">{title}</div>
      </div>

      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-md border border-border bg-background p-1">
          {viewOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onViewChange(option)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-sm font-medium capitalize transition",
                view === option
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
