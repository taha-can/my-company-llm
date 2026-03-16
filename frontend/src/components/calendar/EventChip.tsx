"use client";

import type { CalendarEvent } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatEventTime, getEventChipColor } from "@/components/calendar/utils";

type EventChipProps = {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (event: CalendarEvent) => void;
};

export function EventChip({ event, compact = false, onClick }: EventChipProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(event)}
      className={cn(
        "w-full rounded-md border px-2 py-1 text-left transition hover:shadow-sm",
        getEventChipColor(event),
        compact ? "space-y-0 text-[11px]" : "space-y-1 text-xs",
      )}
    >
      <div className="truncate font-medium">{event.summary}</div>
      {!compact ? <div className="truncate opacity-80">{formatEventTime(event)}</div> : null}
    </button>
  );
}
