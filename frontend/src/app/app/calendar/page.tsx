"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { GoogleButton } from "@/components/auth/GoogleButton";
import { CalendarToolbar } from "@/components/calendar/CalendarToolbar";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import { EventDetailsDialog } from "@/components/calendar/EventDetailsDialog";
import { EventEditorDialog } from "@/components/calendar/EventEditorDialog";
import { MonthViewGrid } from "@/components/calendar/MonthViewGrid";
import { TimeGridView } from "@/components/calendar/TimeGridView";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { calendarApi, type CalendarEvent, type CalendarEventUpsert, type CalendarStatus } from "@/lib/api";
import { getUser } from "@/lib/auth";
import {
  type CalendarViewMode,
  getRangeForView,
  getTitleForView,
  shiftAnchorDate,
  startOfDay,
} from "@/components/calendar/utils";

export default function CalendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [eventsError, setEventsError] = useState("");
  const [statusLoading, setStatusLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [view, setView] = useState<CalendarViewMode>("month");
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editorDraft, setEditorDraft] = useState<{
    event: CalendarEvent | null;
    start: Date;
    end: Date;
    allDay: boolean;
  } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const user = getUser();

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "admin") {
      router.replace("/app");
      toast.error("Calendar is only available to admin users.");
    }
  }, [router, user]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (!connected && !error) return;

    if (connected) {
      toast.success("Google Calendar connected.");
    }
    if (error) {
      toast.error(error);
    }
    router.replace("/app/calendar");
  }, [router, searchParams]);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError("");
    try {
      setStatus(await calendarApi.status());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load calendar status";
      setStatus(null);
      setStatusError(message);
      toast.error(message);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async (targetView: CalendarViewMode, targetDate: Date) => {
    setEventsLoading(true);
    setEventsError("");
    try {
      const range = getRangeForView(targetView, targetDate);
      const data = await calendarApi.events(range.start.toISOString(), range.end.toISOString());
      setEvents(data.events.filter((event) => event.status !== "cancelled"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load calendar events";
      setEvents([]);
      setEventsError(message);
      toast.error(message);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!status?.connected) return;
    loadEvents(view, anchorDate);
  }, [anchorDate, loadEvents, status?.connected, view]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const { url } = await calendarApi.getConnectUrl();
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start Google Calendar connection");
      setConnecting(false);
    }
  }, []);

  const title = useMemo(() => getTitleForView(view, anchorDate), [anchorDate, view]);

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    if (view !== "month") {
      setAnchorDate(date);
    }
  }, [view]);

  const openCreateDialog = useCallback((date: Date, hour?: number) => {
    const base = startOfDay(date);
    const start = hour === undefined ? base : new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour);
    const end = hour === undefined
      ? base
      : new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour + 1);

    setEditorDraft({
      event: null,
      start,
      end,
      allDay: hour === undefined,
    });
    setEditorOpen(true);
  }, []);

  const openEditDialog = useCallback((event: CalendarEvent) => {
    setDetailsOpen(false);
    setEditorDraft({
      event,
      start: event.all_day ? new Date(`${event.start}T00:00:00`) : new Date(event.start),
      end: event.all_day ? new Date(`${event.end}T00:00:00`) : new Date(event.end),
      allDay: event.all_day,
    });
    setEditorOpen(true);
  }, []);

  const handleSaveEvent = useCallback(async (payload: CalendarEventUpsert, existingEventId?: string) => {
    setSavingEvent(true);
    try {
      const updatedEvent = existingEventId
        ? await calendarApi.updateEvent(existingEventId, payload)
        : await calendarApi.createEvent(payload);
      toast.success(existingEventId ? "Event updated." : "Event created.");
      setEditorOpen(false);
      setEditorDraft(null);
      setSelectedEvent(updatedEvent);
      setDetailsOpen(true);
      await loadEvents(view, anchorDate);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save event");
    } finally {
      setSavingEvent(false);
    }
  }, [anchorDate, loadEvents, view]);

  const handleDeleteEvent = useCallback(async (event: CalendarEvent) => {
    setDeletingEvent(true);
    try {
      await calendarApi.deleteEvent(event.id);
      toast.success("Event deleted.");
      setDetailsOpen(false);
      setSelectedEvent(null);
      await loadEvents(view, anchorDate);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete event");
    } finally {
      setDeletingEvent(false);
    }
  }, [anchorDate, loadEvents, view]);

  const statusCard = (() => {
    if (statusLoading) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading calendar status...
        </div>
      );
    }

    if (statusError) {
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <div>
                <CardTitle>Sign in again to access Calendar</CardTitle>
                <CardDescription>
                  {statusError.includes("401")
                    ? "Your current app session is no longer valid for protected calendar requests."
                    : statusError}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push("/login")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!status?.configured) {
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <div>
                <CardTitle>Google OAuth not configured</CardTitle>
                <CardDescription>
                  Add Google OAuth app credentials in backend settings or save Google integration credentials in the app before connecting a calendar.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      );
    }

    if (!status.connected) {
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Connect Google Calendar</CardTitle>
                <CardDescription>
                  Connect your Google account to load your primary calendar in this workspace.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <GoogleButton onClick={handleConnect} loading={connecting} className="sm:w-auto">
              Connect Google Calendar
            </GoogleButton>
          </CardContent>
        </Card>
      );
    }

    return null;
  })();

  if (!user || user.role !== "admin") {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {status?.connected ? (
        <CalendarToolbar
          title={title}
          view={view}
          writable={status.writable}
          onToday={() => {
            const today = new Date();
            setAnchorDate(today);
            setSelectedDate(today);
          }}
          onPrevious={() => setAnchorDate((current) => shiftAnchorDate(view, current, -1))}
          onNext={() => setAnchorDate((current) => shiftAnchorDate(view, current, 1))}
          onViewChange={(nextView) => setView(nextView)}
          onCreateEvent={() => openCreateDialog(selectedDate, 9)}
        />
      ) : (
        <div className="flex h-14 items-center border-b border-border px-4">
          <div>
            <h1 className="text-lg font-semibold">Calendar</h1>
            <p className="text-xs text-muted-foreground">View your Google Calendar without leaving the app.</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <div className="h-full">
          {statusCard}

          {status?.connected ? (
            <div className="flex h-full">
              <CalendarSidebar
                anchorDate={anchorDate}
                selectedDate={selectedDate}
                status={status}
                connecting={connecting}
                onConnect={handleConnect}
                onSelectDate={(date) => {
                  setSelectedDate(date);
                  setAnchorDate(date);
                }}
                onMonthChange={setAnchorDate}
                onRefresh={() => loadEvents(view, anchorDate)}
              />

              <div className="flex min-w-0 flex-1 flex-col bg-card">
                {eventsError ? (
                  <div className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
                    {eventsError}
                  </div>
                ) : null}
                {eventsLoading ? (
                  <div className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
                    Loading events...
                  </div>
                ) : null}
                <div className="min-h-0 flex-1 overflow-hidden">
                  {view === "month" ? (
                    <MonthViewGrid
                      anchorDate={anchorDate}
                      selectedDate={selectedDate}
                      events={events}
                      onSelectDate={(date) => {
                        setSelectedDate(date);
                        if (date.getMonth() !== anchorDate.getMonth()) {
                          setAnchorDate(date);
                        }
                      }}
                      onSelectEvent={(event) => {
                        setSelectedEvent(event);
                        setDetailsOpen(true);
                      }}
                    />
                  ) : (
                    <TimeGridView
                      view={view}
                      anchorDate={anchorDate}
                      selectedDate={selectedDate}
                      events={events}
                      onSelectDate={handleSelectDate}
                      onSelectEvent={(event) => {
                        setSelectedEvent(event);
                        setDetailsOpen(true);
                      }}
                      onCreateSlot={openCreateDialog}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <EventDetailsDialog
        event={selectedEvent}
        open={detailsOpen}
        writable={!!status?.writable && !!selectedEvent?.can_edit}
        deleting={deletingEvent}
        onOpenChange={setDetailsOpen}
        onEdit={openEditDialog}
        onDelete={handleDeleteEvent}
      />

      <EventEditorDialog
        key={editorDraft ? `${editorDraft.event?.id || "new"}-${editorDraft.start.toISOString()}-${editorDraft.allDay ? "all" : "timed"}` : "closed"}
        draft={editorDraft}
        open={editorOpen}
        saving={savingEvent}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setEditorDraft(null);
          }
        }}
        onSubmit={handleSaveEvent}
      />
    </div>
  );
}
