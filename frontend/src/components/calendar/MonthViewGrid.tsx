"use client";

import type { CalendarEvent } from "@/lib/api";
import { EventChip } from "@/components/calendar/EventChip";
import {
  eventSpansDay,
  getMonthGrid,
  isSameDay,
  startOfMonth,
  toDateKey,
  WEEKDAY_LABELS,
} from "@/components/calendar/utils";

type MonthViewGridProps = {
  anchorDate: Date;
  selectedDate: Date;
  events: CalendarEvent[];
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
};

export function MonthViewGrid({
  anchorDate,
  selectedDate,
  events,
  onSelectDate,
  onSelectEvent,
}: MonthViewGridProps) {
  const monthStart = startOfMonth(anchorDate);
  const days = getMonthGrid(anchorDate);
  const eventsByDay = new Map<string, CalendarEvent[]>();

  for (const day of days) {
    eventsByDay.set(
      toDateKey(day),
      events.filter((event) => eventSpansDay(event, day)),
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {days.map((day) => {
          const inCurrentMonth = day.getMonth() === monthStart.getMonth();
          const dayEvents = (eventsByDay.get(toDateKey(day)) || []).slice(0, 3);
          const isSelected = isSameDay(day, selectedDate);

          return (
            <div
              key={day.toISOString()}
              className="min-h-[132px] border-r border-b border-border p-2 align-top transition hover:bg-accent/20"
            >
              <button
                type="button"
                onClick={() => onSelectDate(day)}
                className={[
                  "mb-2 flex h-7 w-7 items-center justify-center rounded-full text-sm transition hover:bg-accent",
                  inCurrentMonth ? "text-foreground" : "text-muted-foreground",
                  isSelected ? "bg-primary text-primary-foreground hover:bg-primary" : "",
                ].join(" ")}
              >
                {day.getDate()}
              </button>

              <div className="space-y-1">
                {dayEvents.map((event) => (
                  <EventChip key={`${day.toISOString()}-${event.id}`} event={event} compact onClick={onSelectEvent} />
                ))}
                {(eventsByDay.get(toDateKey(day)) || []).length > 3 ? (
                  <div className="px-2 text-[11px] text-muted-foreground">
                    +{(eventsByDay.get(toDateKey(day)) || []).length - 3} more
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
