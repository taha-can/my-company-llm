"use client";

import { CalendarDays, ExternalLink, MapPin, Pencil, Trash2, Video } from "lucide-react";

import type { CalendarEvent } from "@/lib/api";
import { formatEventTime } from "@/components/calendar/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type EventDetailsDialogProps = {
  event: CalendarEvent | null;
  open: boolean;
  writable: boolean;
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
};

export function EventDetailsDialog({
  event,
  open,
  writable,
  deleting,
  onOpenChange,
  onEdit,
  onDelete,
}: EventDetailsDialogProps) {
  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{event.summary}</DialogTitle>
          <DialogDescription>{formatEventTime(event)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>{formatEventTime(event)}</div>
          </div>

          {event.location ? (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>{event.location}</div>
            </div>
          ) : null}

          {event.conference_link ? (
            <div className="flex items-start gap-3">
              <Video className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <a href={event.conference_link} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {event.conference_link}
              </a>
            </div>
          ) : null}

          {event.description ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 whitespace-pre-wrap">
              {event.description}
            </div>
          ) : null}

          {event.attendees.length > 0 ? (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Attendees
              </div>
              <div className="space-y-1">
                {event.attendees.map((attendee) => (
                  <div key={attendee.email} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span>{attendee.display_name || attendee.email}</span>
                    <span className="text-xs capitalize text-muted-foreground">
                      {attendee.response_status || "needsAction"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {event.organizer_email ? <span>Organizer: {event.organizer_email}</span> : null}
            {event.html_link ? (
              <a href={event.html_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Open in Google
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="destructive" disabled={!writable || deleting} onClick={() => onDelete(event)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <Button variant="outline" disabled={!writable} onClick={() => onEdit(event)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
