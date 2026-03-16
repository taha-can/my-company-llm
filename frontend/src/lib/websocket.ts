"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatEvent } from "./api";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/chat";

export interface SendOptions {
  agentId?: string;
  department?: string;
  sessionId?: string;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<ChatEvent[]>([]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try {
        const event: ChatEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);
      } catch {}
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback(
    (content: string, opts?: SendOptions) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;

      setEvents((prev) => [
        ...prev,
        { type: "ceo_message", content, agent_name: "You" },
      ]);

      const payload: Record<string, string> = { action: "message", content };
      if (opts?.agentId) payload.agent_id = opts.agentId;
      if (opts?.department) payload.department = opts.department;
      if (opts?.sessionId) payload.session_id = opts.sessionId;

      wsRef.current.send(JSON.stringify(payload));
    },
    []
  );

  const addTask = useCallback((agentId: string, directive: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({ action: "add_task", agent_id: agentId, directive })
    );
  }, []);

  const createTask = useCallback(
    (directive: string, opts?: { board?: string; priority?: string; agent_id?: string }) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(
        JSON.stringify({ action: "create_task", directive, ...opts })
      );
    },
    []
  );

  const removeTask = useCallback((taskId: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ action: "remove_task", task_id: taskId }));
  }, []);

  const updateTaskStatus = useCallback(
    (taskId: string, status: string, feedback?: string) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(
        JSON.stringify({ action: "update_task_status", task_id: taskId, status, feedback })
      );
    },
    []
  );

  const clearEvents = useCallback(() => setEvents([]), []);

  const prependEvents = useCallback((history: ChatEvent[]) => {
    setEvents((prev) => [...history, ...prev]);
  }, []);

  return {
    connected,
    events,
    sendMessage,
    addTask,
    createTask,
    removeTask,
    updateTaskStatus,
    clearEvents,
    prependEvents,
  };
}
