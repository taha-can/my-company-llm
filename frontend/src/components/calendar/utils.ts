"use client";

import type { CalendarEvent } from "@/lib/api";

export type CalendarViewMode = "month" | "week" | "day";

export const HOURS = Array.from({ length: 24 }, (_, index) => index);
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function startOfWeek(date: Date) {
  return addDays(startOfDay(date), -startOfDay(date).getDay());
}

export function endOfWeek(date: Date) {
  return endOfDay(addDays(startOfWeek(date), 6));
}

export function getRangeForView(view: CalendarViewMode, anchorDate: Date) {
  if (view === "day") {
    return { start: startOfDay(anchorDate), end: endOfDay(anchorDate) };
  }
  if (view === "week") {
    return { start: startOfWeek(anchorDate), end: endOfWeek(anchorDate) };
  }
  return { start: startOfWeek(startOfMonth(anchorDate)), end: endOfWeek(endOfMonth(anchorDate)) };
}

export function getTitleForView(view: CalendarViewMode, anchorDate: Date) {
  if (view === "day") {
    return anchorDate.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  if (view === "week") {
    const start = startOfWeek(anchorDate);
    const end = addDays(start, 6);
    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString([], { month: "long" })} ${start.getDate()} - ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${start.toLocaleDateString([], { month: "short", day: "numeric" })} - ${end.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return anchorDate.toLocaleDateString([], { month: "long", year: "numeric" });
}

export function shiftAnchorDate(view: CalendarViewMode, anchorDate: Date, direction: -1 | 1) {
  if (view === "day") return addDays(anchorDate, direction);
  if (view === "week") return addDays(anchorDate, 7 * direction);
  return addMonths(anchorDate, direction);
}

export function toDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function parseEventDate(value: string, allDay: boolean) {
  if (allDay) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

export function isSameDay(left: Date, right: Date) {
  return toDateKey(left) === toDateKey(right);
}

export function formatEventTime(event: CalendarEvent) {
  if (event.all_day) return "All day";

  const start = new Date(event.start);
  const end = new Date(event.end);
  const sameDay = toDateKey(start) === toDateKey(end);
  const startText = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const endText = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (sameDay) return `${startText} - ${endText}`;
  return `${start.toLocaleString()} - ${end.toLocaleString()}`;
}

export function formatHourLabel(hour: number) {
  const period = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 || 12;
  return `${normalized} ${period}`;
}

export function eachDayBetween(start: Date, end: Date) {
  const dates: Date[] = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);

  while (cursor <= last) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function eventSpansDay(event: CalendarEvent, date: Date) {
  const start = parseEventDate(event.start, event.all_day);
  const end = parseEventDate(event.end, event.all_day);
  return start <= endOfDay(date) && end >= startOfDay(date);
}

export function getMonthGrid(anchorDate: Date) {
  const monthStart = startOfMonth(anchorDate);
  const gridStart = startOfWeek(monthStart);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export function getWeekDays(anchorDate: Date) {
  const start = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function getEventChipColor(event: CalendarEvent) {
  const palette = [
    "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20",
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
    "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20",
    "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
  ];
  const input = event.color_id || event.id;
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return palette[hash % palette.length];
}

export function getTimedEventMetrics(event: CalendarEvent) {
  if (event.all_day) {
    return { startMinutes: 0, durationMinutes: 60 };
  }

  const start = new Date(event.start);
  const end = new Date(event.end);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const rawDuration = Math.round((end.getTime() - start.getTime()) / 60000);
  return { startMinutes, durationMinutes: Math.max(rawDuration, 30) };
}

export function clampEventToDay(event: CalendarEvent, day: Date) {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const start = parseEventDate(event.start, event.all_day);
  const end = parseEventDate(event.end, event.all_day);
  return {
    start: start < dayStart ? dayStart : start,
    end: end > dayEnd ? dayEnd : end,
  };
}
