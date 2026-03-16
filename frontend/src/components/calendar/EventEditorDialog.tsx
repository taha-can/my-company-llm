"use client";

import { useMemo, useState } from "react";

import type { CalendarEvent, CalendarEventUpsert } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type EventDraft = {
  event: CalendarEvent | null;
  start: Date;
  end: Date;
  allDay: boolean;
};

type EventEditorDialogProps = {
  draft: EventDraft | null;
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CalendarEventUpsert, existingEventId?: string) => void;
};

function toLocalDateTimeValue(date: Date) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 16);
}

function toDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function EventEditorDialog({
  draft,
  open,
  saving,
  onOpenChange,
  onSubmit,
}: EventEditorDialogProps) {
  const [summary, setSummary] = useState(draft?.event?.summary || "");
  const [allDay, setAllDay] = useState(draft?.allDay ?? false);
  const [start, setStart] = useState(draft ? (draft.allDay ? toDateValue(draft.start) : toLocalDateTimeValue(draft.start)) : "");
  const [end, setEnd] = useState(draft ? (draft.allDay ? toDateValue(draft.end) : toLocalDateTimeValue(draft.end)) : "");
  const [description, setDescription] = useState(draft?.event?.description || "");
  const [location, setLocation] = useState(draft?.event?.location || "");
  const [attendees, setAttendees] = useState(draft?.event?.attendees.map((attendee) => attendee.email).join(", ") || "");

  const title = useMemo(() => (draft?.event ? "Edit event" : "Create event"), [draft]);

  if (!draft) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {draft.event ? "Update the details for this calendar event." : "Create a new event in your Google Calendar."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="calendar-summary">Title</Label>
            <Input id="calendar-summary" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Event title" />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(event) => {
                const nextAllDay = event.target.checked;
                setAllDay(nextAllDay);
                setStart((current) => (nextAllDay ? current.slice(0, 10) : `${current.slice(0, 10)}T09:00`));
                setEnd((current) => (nextAllDay ? current.slice(0, 10) : `${current.slice(0, 10)}T10:00`));
              }}
            />
            All day
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="calendar-start">Start</Label>
              <Input
                id="calendar-start"
                type={allDay ? "date" : "datetime-local"}
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="calendar-end">End</Label>
              <Input
                id="calendar-end"
                type={allDay ? "date" : "datetime-local"}
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="calendar-location">Location</Label>
            <Input
              id="calendar-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Meeting room or address"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="calendar-attendees">Attendees</Label>
            <Input
              id="calendar-attendees"
              value={attendees}
              onChange={(event) => setAttendees(event.target.value)}
              placeholder="name@example.com, other@example.com"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="calendar-description">Description</Label>
            <Textarea
              id="calendar-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() =>
              onSubmit(
                {
                  summary,
                  start,
                  end,
                  all_day: allDay,
                  description,
                  location,
                  attendees: attendees
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                },
                draft.event?.id,
              )
            }
            disabled={saving}
          >
            {saving ? "Saving..." : draft.event ? "Save changes" : "Create event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
