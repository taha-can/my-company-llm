"use client";

import type { AgentDefinition } from "@/lib/api";

interface DepartmentRoomProps {
  department: string;
  agents: AgentDefinition[];
  position: { row: number; col: number };
  onAgentClick?: (agent: AgentDefinition) => void;
}

export function DepartmentRoom({ department, agents }: DepartmentRoomProps) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
      The legacy room renderer for <span className="font-medium text-slate-200">{department}</span>{" "}
      is no longer used. {agents.length} agents are now rendered in the shared office simulator scene.
    </div>
  );
}
