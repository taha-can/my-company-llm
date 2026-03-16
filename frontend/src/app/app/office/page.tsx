"use client";

import { useCallback, useEffect, useState } from "react";
import { OfficeMap } from "@/components/office/OfficeMap";
import { Button } from "@/components/ui/button";
import { RefreshCw, Building2 } from "lucide-react";
import { agentsApi, type AgentDefinition } from "@/lib/api";

function areAgentListsEqual(left: AgentDefinition[], right: AgentDefinition[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftAgent = left[index];
    const rightAgent = right[index];

    if (
      leftAgent.id !== rightAgent.id ||
      leftAgent.name !== rightAgent.name ||
      leftAgent.role !== rightAgent.role ||
      leftAgent.department !== rightAgent.department ||
      leftAgent.agent_type !== rightAgent.agent_type ||
      leftAgent.status !== rightAgent.status ||
      leftAgent.goal !== rightAgent.goal ||
      leftAgent.llm_model !== rightAgent.llm_model ||
      leftAgent.email !== rightAgent.email ||
      leftAgent.avatar_url !== rightAgent.avatar_url
    ) {
      return false;
    }

    if (leftAgent.tools.length !== rightAgent.tools.length) {
      return false;
    }

    for (let toolIndex = 0; toolIndex < leftAgent.tools.length; toolIndex += 1) {
      if (leftAgent.tools[toolIndex] !== rightAgent.tools[toolIndex]) {
        return false;
      }
    }

    const leftChildren = leftAgent.children ?? [];
    const rightChildren = rightAgent.children ?? [];
    if (!areAgentListsEqual(leftChildren, rightChildren)) {
      return false;
    }
  }

  return true;
}

export default function OfficePage() {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAgents = useCallback(async (mode: "initial" | "manual" | "poll" = "manual") => {
    if (mode === "initial") {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const data = await agentsApi.list();
      setAgents((current) => (areAgentListsEqual(current, data) ? current : data));
    } catch (err) {
      console.error("Failed to load agents:", err);
    } finally {
      if (mode === "initial") {
        setInitialLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadAgents("initial");
  }, [loadAgents]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadAgents("poll");
    }, 15000);
    return () => clearInterval(interval);
  }, [loadAgents]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 h-14">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Office Simulator</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void loadAgents("manual")}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {initialLoading && agents.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading simulator...</p>
            </div>
          </div>
        ) : (
          <OfficeMap agents={agents} />
        )}
      </div>
    </div>
  );
}
