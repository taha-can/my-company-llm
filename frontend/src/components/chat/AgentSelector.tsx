"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Bot, Crown, Radio, Users, ChevronDown } from "lucide-react";
import { agentsApi, type AgentDefinition } from "@/lib/api";

export interface ChatTarget {
  type: "auto" | "agent" | "department";
  id?: string;
  name: string;
  department?: string;
}

interface AgentSelectorProps {
  target: ChatTarget;
  onSelect: (target: ChatTarget) => void;
}

export function AgentSelector({ target, onSelect }: AgentSelectorProps) {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);

  useEffect(() => {
    agentsApi.listFlat().then(setAgents).catch(console.error);
  }, []);

  const departments = [...new Set(agents.map((a) => a.department))];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 min-w-0 overflow-hidden">
          {target.type === "auto" && <Radio className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
          {target.type === "agent" && <Bot className="h-3.5 w-3.5 shrink-0 text-violet-500" />}
          {target.type === "department" && <Users className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
          <span className="truncate">{target.name}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => onSelect({ type: "auto", name: "Auto-route" })}
          >
            <Radio className="h-4 w-4 mr-2 text-emerald-500" />
            <div>
              <p className="text-sm font-medium">Auto-route</p>
              <p className="text-xs text-muted-foreground">AI chooses the best department lead or falls back to CEO Office</p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Department Meetings
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          {departments.map((dept) => (
            <DropdownMenuItem
              key={`dept-${dept}`}
              onClick={() =>
                onSelect({ type: "department", id: dept, name: `${dept} dept`, department: dept })
              }
            >
              <Users className="h-4 w-4 mr-2 shrink-0 text-blue-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium capitalize truncate">{dept} Department</p>
                <p className="text-xs text-muted-foreground">
                  {agents.filter((a) => a.department === dept).length} agent(s), routed through the lead when available
                </p>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Direct Message
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          {agents.map((agent) => (
            <DropdownMenuItem
              key={agent.id}
              onClick={() =>
                onSelect({
                  type: "agent",
                  id: agent.id,
                  name: agent.name,
                  department: agent.department,
                })
              }
            >
              {agent.agent_type === "lead" ? (
                <Crown className="h-4 w-4 mr-2 shrink-0 text-amber-500" />
              ) : (
                <Bot className="h-4 w-4 mr-2 shrink-0 text-violet-500" />
              )}
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">{agent.name}</p>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                    {agent.department}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {agent.email || agent.role}
                  </span>
                </div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
