"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Bot,
  Crown,
  Maximize2,
  RefreshCw,
  Sparkles,
  Users,
  Warehouse,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AgentDefinition } from "@/lib/api";
import { OfficeFloorScene } from "./OfficeFloorScene";
import { buildOfficeScene } from "./scene-model";

interface OfficeMapProps {
  agents: AgentDefinition[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idle: { label: "Idle", color: "text-slate-400" },
  working: { label: "Working", color: "text-emerald-400" },
  error: { label: "Error", color: "text-red-400" },
  disabled: { label: "Disabled", color: "text-amber-400" },
};

function AmbientParticles() {
  const particles = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => ({
      id: i,
      x: ((Math.sin(i * 17.13) + 1) / 2) * 100,
      y: ((Math.cos(i * 11.71) + 1) / 2) * 100,
      size: 2 + (((Math.sin(i * 3.1) + 1) / 2) * 5),
      opacity: 0.08 + (((Math.cos(i * 5.27) + 1) / 2) * 0.14),
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-cyan-300/10"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            opacity: p.opacity,
          }}
        />
      ))}
    </div>
  );
}

function StatsBar({
  departmentCount,
  agentCount,
  leadCount,
  activeCount,
  errorCount,
}: {
  departmentCount: number;
  agentCount: number;
  leadCount: number;
  activeCount: number;
  errorCount: number;
}) {
  const stats = [
    { icon: Warehouse, label: "Zones", value: departmentCount, color: "text-cyan-300" },
    { icon: Users, label: "Agents", value: agentCount, color: "text-violet-300" },
    { icon: Crown, label: "Leads", value: leadCount, color: "text-amber-300" },
    { icon: Sparkles, label: "Active", value: activeCount, color: "text-emerald-300" },
  ];

  if (errorCount > 0) {
    stats.push({ icon: RefreshCw, label: "Alerts", value: errorCount, color: "text-rose-300" });
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/70 bg-white/72 px-4 py-3 shadow-lg backdrop-blur-xl">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-center gap-1.5">
          <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
          <span className="text-xs text-slate-500">{stat.label}:</span>
          <span className={`text-sm font-bold ${stat.color}`}>{stat.value}</span>
        </div>
      ))}

      <div className="ml-auto rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2 py-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
          Live updates
        </span>
      </div>
    </div>
  );
}

function AgentDetailPanel({
  agent,
  onClose,
}: {
  agent: AgentDefinition;
  onClose: () => void;
}) {
  const status = STATUS_LABELS[agent.status] || STATUS_LABELS.idle;

  return (
    <motion.div
      className="fixed right-4 top-20 z-50 w-80 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/92 shadow-2xl backdrop-blur-2xl"
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
    >
      {/* Header */}
      <div className="relative border-b border-white/[0.08] bg-gradient-to-r from-cyan-400/10 via-violet-400/[0.08] to-transparent p-4">
        <button
          onClick={onClose}
          className="absolute right-2 top-2 rounded-md p-1 transition-colors hover:bg-white/[0.08]"
        >
            <X className="h-4 w-4 text-slate-400" />
        </button>
        <div className="flex items-center gap-3">
          <motion.div
            className={`flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/20 text-sm font-bold text-white ${
              agent.agent_type === "lead"
                ? "bg-gradient-to-br from-amber-400 to-yellow-500"
                : "bg-gradient-to-br from-cyan-500 to-violet-500"
            }`}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {agent.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)}
          </motion.div>
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white">
              {agent.agent_type === "lead" ? (
                <Crown className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Bot className="h-3.5 w-3.5 text-slate-400" />
              )}
              {agent.name}
            </h3>
            <p className="text-xs text-slate-300">{agent.role}</p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-3 p-4 text-slate-100">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Status</span>
          <div className={`text-sm font-medium ${status.color} flex items-center gap-1.5 mt-0.5`}>
            <motion.div
              className={`w-2 h-2 rounded-full ${
                agent.status === "working" ? "bg-emerald-500" :
                agent.status === "error" ? "bg-red-500" :
                agent.status === "disabled" ? "bg-amber-500" : "bg-slate-500"
              }`}
              animate={agent.status === "working" ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            />
            {status.label}
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Goal</span>
          <p className="mt-0.5 line-clamp-3 text-xs text-slate-200/90">{agent.goal}</p>
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Department</span>
          <p className="text-xs mt-0.5">
            <Badge variant="outline" className="border-white/[0.12] bg-white/[0.04] text-[10px] text-slate-100">
              {agent.department}
            </Badge>
          </p>
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Type</span>
          <p className="text-xs mt-0.5">
            <Badge variant="secondary" className="bg-white/[0.08] text-[10px] text-slate-100">
              {agent.agent_type === "lead" ? "Team Lead" : "Worker"}
            </Badge>
          </p>
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Model</span>
          <p className="mt-0.5 text-xs text-slate-300">{agent.llm_model}</p>
        </div>

        {agent.tools.length > 0 && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Tools</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {agent.tools.map((tool) => (
                <Badge key={tool} variant="secondary" className="bg-white/[0.08] text-[10px] text-slate-100">
                  {tool}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {agent.email && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Identity</span>
            <p className="mt-0.5 text-xs text-slate-300">{agent.email}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function DepartmentLegend({
  departments,
  departmentStats,
  focusedDepartment,
  onDepartmentClick,
}: {
  departments: string[];
  departmentStats: Map<string, { count: number; active: number }>;
  focusedDepartment: string | null;
  onDepartmentClick: (department: string | null) => void;
}) {
  return (
    <motion.div
      className="fixed bottom-4 right-4 z-40 w-64 overflow-hidden rounded-2xl border border-white/70 bg-white/78 shadow-xl backdrop-blur-xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1 }}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.24em] text-slate-500">
          <Building2 className="h-3 w-3" />
          Navigator
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-slate-600"
          onClick={() => onDepartmentClick(null)}
        >
          <Maximize2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="space-y-1.5 px-3 py-3">
        {departments.map((dept) => {
          const stats = departmentStats.get(dept) ?? { count: 0, active: 0 };
          const focused = focusedDepartment === dept;
          return (
            <button
              key={dept}
              type="button"
              className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[11px] transition ${
                focused
                  ? "border-sky-300 bg-sky-100/80 text-sky-700"
                  : "border-white/70 bg-white/65 text-slate-600 hover:bg-white"
              }`}
              onClick={() => onDepartmentClick(focused ? null : dept)}
            >
              <div className="h-2.5 w-2.5 rounded-full bg-cyan-300/80" />
              <span className="capitalize">{dept}</span>
              <span className="ml-auto text-slate-400">{stats.count}</span>
              {stats.active > 0 ? <span className="text-emerald-600">{stats.active}</span> : null}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

export function OfficeMap({ agents }: OfficeMapProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);
  const [focusedDepartment, setFocusedDepartment] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.8);
  const containerRef = useRef<HTMLDivElement>(null);

  const flatAgents = useMemo(() => {
    const result: AgentDefinition[] = [];
    for (const agent of agents) {
      result.push(agent);
      if (agent.children) {
        result.push(...agent.children);
      }
    }
    return result;
  }, [agents]);

  const departmentMap = useMemo(() => {
    const map = new Map<string, AgentDefinition[]>();
    for (const agent of flatAgents) {
      const dept = agent.department || "general";
      if (!map.has(dept)) {
        map.set(dept, []);
      }
      map.get(dept)?.push(agent);
    }
    return map;
  }, [flatAgents]);
  const departments = useMemo(() => Array.from(departmentMap.keys()).sort(), [departmentMap]);
  const departmentStats = useMemo(() => {
    const stats = new Map<string, { count: number; active: number }>();
    for (const [department, deptAgents] of departmentMap.entries()) {
      let active = 0;
      for (const agent of deptAgents) {
        if (agent.status === "working") {
          active += 1;
        }
      }
      stats.set(department, { count: deptAgents.length, active });
    }
    return stats;
  }, [departmentMap]);
  const officeStats = useMemo(() => {
    let activeCount = 0;
    let leadCount = 0;
    let errorCount = 0;

    for (const agent of flatAgents) {
      if (agent.status === "working") {
        activeCount += 1;
      }
      if (agent.status === "error") {
        errorCount += 1;
      }
      if (agent.agent_type === "lead") {
        leadCount += 1;
      }
    }

    return {
      departmentCount: departments.length,
      agentCount: flatAgents.length,
      leadCount,
      activeCount,
      errorCount,
    };
  }, [departments.length, flatAgents]);
  const scene = useMemo(() => buildOfficeScene(flatAgents), [flatAgents]);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.15, 1.5)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.15, 0.5)), []);
  const handleZoomReset = useCallback(() => setZoom(0.8), []);

  if (flatAgents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Building2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Office is empty</p>
          <p className="text-sm mt-1">Create agents to populate the office.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden bg-background">
      <AmbientParticles />

      {/* Zoom controls */}
      <div className="absolute right-4 top-4 z-30 flex items-center gap-1 rounded-xl border border-white/70 bg-white/70 p-1 shadow-lg backdrop-blur-sm">
        <Button variant="ghost" size="icon-sm" className="text-slate-700" onClick={handleZoomIn}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <span className="w-10 text-center text-[10px] text-slate-500">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon-sm" className="text-slate-700" onClick={handleZoomOut}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" className="text-slate-700" onClick={handleZoomReset}>
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Scrollable office area */}
      <div ref={containerRef} className="h-full overflow-auto p-6 office-scroll">
        <div
          className="mx-auto flex w-max min-w-full flex-col gap-6 pb-10"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            transition: "transform 180ms ease-out",
          }}
        >
          <StatsBar {...officeStats} />

          <div className="flex items-center justify-end px-1">
            {focusedDepartment ? (
              <Badge className="border border-sky-300/50 bg-white/75 text-sky-700">
                Focused: {focusedDepartment}
              </Badge>
            ) : (
              <Badge className="border border-white/70 bg-white/75 text-slate-700">
                All departments
              </Badge>
            )}
          </div>

          <OfficeFloorScene
            scene={scene}
            focusedDepartment={focusedDepartment}
            selectedAgentId={selectedAgent?.id ?? null}
            onZoneClick={setFocusedDepartment}
            onAgentClick={(agent) => {
              setSelectedAgent(agent);
              setFocusedDepartment(agent.department || null);
            }}
          />
        </div>
      </div>

      {/* Agent detail panel */}
      <AnimatePresence>
        {selectedAgent && (
          <AgentDetailPanel
            agent={selectedAgent}
            onClose={() => setSelectedAgent(null)}
          />
        )}
      </AnimatePresence>

      <DepartmentLegend
        departments={departments}
        departmentStats={departmentStats}
        focusedDepartment={focusedDepartment}
        onDepartmentClick={setFocusedDepartment}
      />
    </div>
  );
}
