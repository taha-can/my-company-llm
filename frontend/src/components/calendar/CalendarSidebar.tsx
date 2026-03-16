"use client";

import { Calendar as CalendarIcon, RefreshCw } from "lucide-react";

import { Calendar as MiniCalendar } from "@/components/ui/calendar";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Button } from "@/components/ui/button";
import type { CalendarStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

type CalendarSidebarProps = {
  anchorDate: Date;
  selectedDate: Date;
  status: CalendarStatus;
  connecting: boolean;
  onConnect: () => void;
  onSelectDate: (date: Date) => void;
  onMonthChange: (date: Date) => void;
  onRefresh: () => void;
};

export function CalendarSidebar({
  anchorDate,
  selectedDate,
  status,
  connecting,
  onConnect,
  onSelectDate,
  onMonthChange,
  onRefresh,
}: CalendarSidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-background lg:w-[300px]">
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">My calendar</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {status.external_email ? `Connected as ${status.external_email}` : "Connect your Google Calendar"}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {!status.connected ? (
          <div className="mt-4">
            <GoogleButton onClick={onConnect} loading={connecting}>
              Connect Google Calendar
            </GoogleButton>
          </div>
        ) : null}

        {status.connected && !status.writable ? (
          <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            Reconnect Google Calendar to enable create, edit, and delete actions.
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        <MiniCalendar
          mode="single"
          month={anchorDate}
          selected={selectedDate}
          onSelect={(date) => date && onSelectDate(date)}
          onMonthChange={onMonthChange}
          className="rounded-lg border"
        />

        <div className="mt-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Connected calendars
          </div>
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm",
              status.connected ? "bg-primary/5 border-primary/10" : "bg-muted/40",
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="font-medium">Primary calendar</div>
              <div className="truncate text-xs text-muted-foreground">
                {status.external_email || "Not connected"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
