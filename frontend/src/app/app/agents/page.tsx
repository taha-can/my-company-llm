"use client";

import { useCallback, useEffect, useState } from "react";
import { OrgChart } from "@/components/dashboard/OrgChart";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus } from "lucide-react";
import Link from "next/link";
import { agentsApi, type AgentDefinition } from "@/lib/api";

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agentsApi.list();
      setAgents(data);
    } catch (err) {
      console.error("Failed to load agents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleDelete = async (id: string) => {
    try {
      await agentsApi.delete(id);
      loadAgents();
    } catch (err) {
      console.error("Failed to delete agent:", err);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 h-14">
        <h1 className="text-lg font-semibold">Agents</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={loadAgents} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Link href="/app/agents/create">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Create Agent
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <OrgChart agents={agents} onDelete={handleDelete} />
      </div>
    </div>
  );
}
