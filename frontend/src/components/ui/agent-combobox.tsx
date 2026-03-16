"use client";

import * as React from "react";
import { Check, ChevronsUpDown, UserCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AgentDefinition } from "@/lib/api";

interface AgentComboboxProps {
  agents: AgentDefinition[];
  value: string;
  onChange: (agentId: string) => void;
  disabled?: boolean;
  className?: string;
}

export function AgentCombobox({
  agents,
  value,
  onChange,
  disabled,
  className,
}: AgentComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedAgent = agents.find((a) => a.id === value);

  const departments = React.useMemo(() => {
    const deptMap = new Map<string, AgentDefinition[]>();
    for (const agent of agents) {
      const dept = agent.department || "general";
      if (!deptMap.has(dept)) deptMap.set(dept, []);
      deptMap.get(dept)!.push(agent);
    }
    return deptMap;
  }, [agents]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <UserCircle className="h-4 w-4 shrink-0" />
            {selectedAgent
              ? selectedAgent.name
              : "Select agent..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search agents..." />
          <CommandList>
            <CommandEmpty>No agents found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__unassigned__"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !value ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="text-muted-foreground">Unassigned</span>
              </CommandItem>
            </CommandGroup>
            {Array.from(departments.entries()).map(([dept, deptAgents]) => (
              <CommandGroup
                key={dept}
                heading={dept.charAt(0).toUpperCase() + dept.slice(1)}
              >
                {deptAgents.map((agent) => (
                  <CommandItem
                    key={agent.id}
                    value={`${agent.name} ${agent.department}`}
                    onSelect={() => {
                      onChange(agent.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === agent.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{agent.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground truncate">
                      {agent.role}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
