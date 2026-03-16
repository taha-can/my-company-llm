"use client";

import type { CalendarEvent } from "@/lib/api";
import { EventChip } from "@/components/calendar/EventChip";
import {
  clampEventToDay,
  eventSpansDay,
  formatHourLabel,
  getTimedEventMetrics,
  getEventChipColor,
  getWeekDays,
  HOURS,
  isSameDay,
  startOfDay,
  WEEKDAY_LABELS,
} from "@/components/calendar/utils";

type TimeGridViewProps = {
  view: "week" | "day";
  anchorDate: Date;
  selectedDate: Date;
  events: CalendarEvent[];
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onCreateSlot: (date: Date, hour?: number) => void;
};

type PositionedEvent = {
  event: CalendarEvent;
  lane: number;
  laneCount: number;
  top: number;
  height: number;
};

const HOUR_HEIGHT = 64;

function buildPositionedEvents(events: CalendarEvent[], day: Date): PositionedEvent[] {
  const sorted = events
    .filter((event) => !event.all_day && eventSpansDay(event, day))
    .sort((left, right) => left.start.localeCompare(right.start));

  const activeLaneEndTimes: number[] = [];
  const positioned: PositionedEvent[] = [];

  for (const event of sorted) {
    const clamped = clampEventToDay(event, day);
    const startMinutes = clamped.start.getHours() * 60 + clamped.start.getMinutes();
    const rawDuration = Math.max(30, Math.round((clamped.end.getTime() - clamped.start.getTime()) / 60000));

    let lane = activeLaneEndTimes.findIndex((value) => value <= startMinutes);
    if (lane === -1) {
      lane = activeLaneEndTimes.length;
      activeLaneEndTimes.push(startMinutes + rawDuration);
    } else {
      activeLaneEndTimes[lane] = startMinutes + rawDuration;
    }

    positioned.push({
      event,
      lane,
      laneCount: 1,
      top: (startMinutes / 60) * HOUR_HEIGHT,
      height: Math.max((rawDuration / 60) * HOUR_HEIGHT, 30),
    });
  }

  const laneCount = activeLaneEndTimes.length || 1;
  return positioned.map((item) => ({ ...item, laneCount }));
}

export function TimeGridView({
  view,
  anchorDate,
  selectedDate,
  events,
  onSelectDate,
  onSelectEvent,
  onCreateSlot,
}: TimeGridViewProps) {
  const days = view === "day" ? [startOfDay(anchorDate)] : getWeekDays(anchorDate);

  return (
    <div className="flex h-full flex-col">
      <div className={`grid border-b border-border ${view === "day" ? "grid-cols-[72px_1fr]" : "grid-cols-[72px_repeat(7,minmax(0,1fr))]"}`}>
        <div className="border-r border-border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          All day
        </div>
        {days.map((day, index) => {
          const allDayEvents = events.filter((event) => event.all_day && eventSpansDay(event, day));
          return (
            <div key={day.toISOString()} className="border-r border-border px-2 py-2 last:border-r-0">
              <button
                type="button"
                onClick={() => onSelectDate(day)}
                className={`mb-2 flex items-center gap-2 rounded-md px-2 py-1 text-left ${isSameDay(day, selectedDate) ? "bg-primary/10 text-primary" : "hover:bg-accent/40"}`}
              >
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  {view === "day" ? day.toLocaleDateString([], { weekday: "long" }) : WEEKDAY_LABELS[index]}
                </span>
                <span className="text-sm font-semibold">{day.getDate()}</span>
              </button>
              <div className="space-y-1">
                {allDayEvents.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onCreateSlot(day)}
                    className="w-full rounded-md border border-dashed border-border px-2 py-2 text-left text-xs text-muted-foreground hover:bg-accent/30"
                  >
                    Add all-day event
                  </button>
                ) : (
                  allDayEvents.map((event) => (
                    <EventChip key={event.id} event={event} compact onClick={onSelectEvent} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto">
        <div className={`grid min-h-full ${view === "day" ? "grid-cols-[72px_1fr]" : "grid-cols-[72px_repeat(7,minmax(0,1fr))]"}`}>
          <div className="border-r border-border bg-muted/20">
            {HOURS.map((hour) => (
              <div key={hour} className="relative h-16 border-b border-border px-2">
                <span className="absolute -top-2 right-2 bg-background px-1 text-[11px] text-muted-foreground">
                  {formatHourLabel(hour)}
                </span>
              </div>
            ))}
          </div>

          {days.map((day) => {
            const positionedEvents = buildPositionedEvents(events, day);

            return (
              <div key={day.toISOString()} className="relative border-r border-border last:border-r-0">
                {HOURS.map((hour) => (
                  <button
                    key={`${day.toISOString()}-${hour}`}
                    type="button"
                    onClick={() => onCreateSlot(day, hour)}
                    className="block h-16 w-full border-b border-border text-transparent hover:bg-accent/20"
                  >
                    {hour}
                  </button>
                ))}

                {positionedEvents.map((positioned) => (
                  <button
                    key={`${day.toISOString()}-${positioned.event.id}`}
                    type="button"
                    onClick={() => onSelectEvent(positioned.event)}
                    className={`absolute z-10 overflow-hidden rounded-md border px-2 py-1 text-left text-xs shadow-sm ${getEventChipColor(positioned.event)}`}
                    style={{
                      top: positioned.top + 2,
                      height: positioned.height - 4,
                      left: `calc(${(positioned.lane * 100) / positioned.laneCount}% + 4px)`,
                      width: `calc(${100 / positioned.laneCount}% - 8px)`,
                    }}
                  >
                    <div className="font-semibold">{positioned.event.summary}</div>
                    <div className="text-[11px] opacity-80">
                      {positioned.event.all_day
                        ? "All day"
                        : (() => {
                            const metrics = getTimedEventMetrics(positioned.event);
                            const startHour = Math.floor(metrics.startMinutes / 60);
                            const startMinute = metrics.startMinutes % 60;
                            return `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;
                          })()}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
