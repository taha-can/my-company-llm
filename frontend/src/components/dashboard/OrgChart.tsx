"use client";

import { AgentCard } from "@/components/agents/AgentCard";
import type { AgentDefinition } from "@/lib/api";

interface OrgChartProps {
  agents: AgentDefinition[];
  onDelete?: (id: string) => void;
}

export function OrgChart({ agents, onDelete }: OrgChartProps) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No agents yet</p>
        <p className="text-sm mt-1">
          Create your first agent from the &quot;Create Agent&quot; page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {agents.map((agent) => (
        <div key={agent.id}>
          <AgentCard agent={agent} onDelete={onDelete} />

          {agent.children && agent.children.length > 0 && (
            <div className="ml-8 mt-2 border-l-2 border-border pl-4 space-y-2">
              {agent.children.map((child) => (
                <AgentCard key={child.id} agent={child} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
