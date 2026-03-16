"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot, Crown, Mail, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/agents/FileUpload";
import type { AgentDefinition } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AgentCardProps {
  agent: AgentDefinition;
  onDelete?: (id: string) => void;
}

const statusColors: Record<string, string> = {
  idle: "bg-gray-500",
  working: "bg-emerald-500",
  error: "bg-red-500",
  disabled: "bg-yellow-500",
};

export function AgentCard({ agent, onDelete }: AgentCardProps) {
  return (
    <Card className="relative group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              {agent.avatar_url && <AvatarImage src={agent.avatar_url} alt={agent.name} />}
              <AvatarFallback
                className={cn(
                  "text-white text-sm",
                  agent.agent_type === "lead" ? "bg-violet-600" : "bg-emerald-600"
                )}
              >
                {agent.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                {agent.agent_type === "lead" ? (
                  <Crown className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                {agent.name}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{agent.role}</p>
              {agent.email && (
                <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                  <Mail className="h-2.5 w-2.5" />
                  {agent.email}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className={cn("h-2 w-2 rounded-full mr-1", statusColors[agent.status] || "bg-gray-500")} />
            <FileUpload
              agentId={agent.id}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              }
            />
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onDelete(agent.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground line-clamp-2">{agent.goal}</p>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-xs">
            {agent.department}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {agent.llm_model}
          </Badge>
          {agent.tools.slice(0, 3).map((tool) => (
            <Badge key={tool} variant="secondary" className="text-xs">
              {tool}
            </Badge>
          ))}
          {agent.tools.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{agent.tools.length - 3}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
