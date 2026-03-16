"use client";

import type { AgentDefinition } from "@/lib/api";

export interface ScenePoint {
  x: number;
  y: number;
}

export interface DepartmentTheme {
  accent: string;
  fill: string;
  glow: string;
  wall: string;
  text: string;
  icon: string;
}

export interface SceneDesk {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  facing: "left" | "right";
}

export interface SceneLane {
  id: string;
  points: ScenePoint[];
}

export interface DepartmentZoneModel {
  id: string;
  name: string;
  title: string;
  agents: AgentDefinition[];
  theme: DepartmentTheme;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  depth: number;
  desks: SceneDesk[];
  socialAnchor: ScenePoint;
  focusAnchor: ScenePoint;
  windowAnchor: ScenePoint;
}

export interface AgentSceneModel {
  id: string;
  agent: AgentDefinition;
  department: string;
  zoneId: string;
  desk: SceneDesk;
  home: ScenePoint;
  path: ScenePoint[];
  duration: number;
  delay: number;
}

export interface OfficeSceneModel {
  width: number;
  depth: number;
  corridorY: number;
  columns: number;
  rows: number;
  zones: DepartmentZoneModel[];
  agents: AgentSceneModel[];
  lanes: SceneLane[];
}

const DEPARTMENT_THEMES: Record<string, DepartmentTheme> = {
  engineering: {
    accent: "#8b5cf6",
    fill: "rgba(139, 92, 246, 0.16)",
    glow: "rgba(139, 92, 246, 0.35)",
    wall: "rgba(139, 92, 246, 0.22)",
    text: "#c4b5fd",
    icon: "⚙",
  },
  marketing: {
    accent: "#0ea5e9",
    fill: "rgba(14, 165, 233, 0.15)",
    glow: "rgba(14, 165, 233, 0.32)",
    wall: "rgba(14, 165, 233, 0.2)",
    text: "#7dd3fc",
    icon: "📣",
  },
  sales: {
    accent: "#10b981",
    fill: "rgba(16, 185, 129, 0.15)",
    glow: "rgba(16, 185, 129, 0.32)",
    wall: "rgba(16, 185, 129, 0.22)",
    text: "#6ee7b7",
    icon: "💼",
  },
  design: {
    accent: "#ec4899",
    fill: "rgba(236, 72, 153, 0.15)",
    glow: "rgba(236, 72, 153, 0.34)",
    wall: "rgba(236, 72, 153, 0.2)",
    text: "#f9a8d4",
    icon: "✦",
  },
  support: {
    accent: "#f59e0b",
    fill: "rgba(245, 158, 11, 0.15)",
    glow: "rgba(245, 158, 11, 0.34)",
    wall: "rgba(245, 158, 11, 0.22)",
    text: "#fcd34d",
    icon: "☏",
  },
  hr: {
    accent: "#14b8a6",
    fill: "rgba(20, 184, 166, 0.15)",
    glow: "rgba(20, 184, 166, 0.34)",
    wall: "rgba(20, 184, 166, 0.22)",
    text: "#5eead4",
    icon: "◎",
  },
  finance: {
    accent: "#eab308",
    fill: "rgba(234, 179, 8, 0.15)",
    glow: "rgba(234, 179, 8, 0.34)",
    wall: "rgba(234, 179, 8, 0.22)",
    text: "#fde047",
    icon: "◈",
  },
  operations: {
    accent: "#f97316",
    fill: "rgba(249, 115, 22, 0.15)",
    glow: "rgba(249, 115, 22, 0.34)",
    wall: "rgba(249, 115, 22, 0.22)",
    text: "#fdba74",
    icon: "➠",
  },
  general: {
    accent: "#64748b",
    fill: "rgba(100, 116, 139, 0.16)",
    glow: "rgba(148, 163, 184, 0.3)",
    wall: "rgba(148, 163, 184, 0.22)",
    text: "#cbd5e1",
    icon: "⌂",
  },
};

function titleize(department: string) {
  return department
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getTheme(department: string): DepartmentTheme {
  return DEPARTMENT_THEMES[department.toLowerCase()] ?? DEPARTMENT_THEMES.general;
}

function buildDesks(zone: {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  agentCount: number;
}): SceneDesk[] {
  const desks: SceneDesk[] = [];
  const columns = zone.agentCount > 7 ? 4 : zone.agentCount > 4 ? 3 : 2;
  const rows = Math.max(1, Math.ceil(Math.max(zone.agentCount, 3) / columns));
  const laneInset = 72;
  const stepX = Math.max(82, (zone.width - 112) / columns);
  const stepY = Math.max(58, (zone.depth - 132) / rows);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const index = row * columns + col;
      if (index >= Math.max(zone.agentCount, 2)) {
        continue;
      }

      desks.push({
        id: `${zone.id}-desk-${index}`,
        x: zone.x + 42 + col * stepX,
        y: zone.y + laneInset + row * stepY,
        width: 54,
        depth: 30,
        facing: col % 2 === 0 ? "right" : "left",
      });
    }
  }

  return desks;
}

function buildAgentPath(
  agent: AgentDefinition,
  desk: SceneDesk,
  zone: DepartmentZoneModel,
  index: number,
): ScenePoint[] {
  const deskPoint = {
    x: desk.x + desk.width / 2,
    y: desk.y + desk.depth / 2,
  };
  const corridorPoint = {
    x: zone.x + zone.width / 2 + (index % 2 === 0 ? -20 : 20),
    y: zone.y + zone.depth + 18,
  };
  const socialPoint = {
    x: zone.socialAnchor.x + ((index % 3) - 1) * 18,
    y: zone.socialAnchor.y + ((index % 2) === 0 ? -10 : 10),
  };
  const focusPoint = {
    x: zone.focusAnchor.x + ((index % 2) === 0 ? -12 : 12),
    y: zone.focusAnchor.y + ((index % 3) - 1) * 10,
  };

  if (agent.status === "disabled") {
    return [deskPoint];
  }

  if (agent.status === "working") {
    return [deskPoint, focusPoint, deskPoint];
  }

  if (agent.status === "error") {
    return [deskPoint, corridorPoint, socialPoint, deskPoint];
  }

  return [deskPoint];
}

export function buildOfficeScene(agents: AgentDefinition[]): OfficeSceneModel {
  const departmentMap = new Map<string, AgentDefinition[]>();

  for (const agent of agents) {
    const department = agent.department?.trim() || "general";
    if (!departmentMap.has(department)) {
      departmentMap.set(department, []);
    }
    departmentMap.get(department)?.push(agent);
  }

  const departments = Array.from(departmentMap.entries()).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  const columns = departments.length <= 2 ? 2 : Math.min(3, Math.max(2, departments.length));
  const zoneWidth = 320;
  const zoneDepth = 214;
  const gapX = 112;
  const gapY = 94;
  const paddingX = 160;
  const paddingY = 132;
  const corridorY = 72;

  const zones: DepartmentZoneModel[] = departments.map(([department, deptAgents], index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = paddingX + col * (zoneWidth + gapX);
    const y = paddingY + corridorY + row * (zoneDepth + gapY);
    const zone: DepartmentZoneModel = {
      id: department,
      name: department,
      title: titleize(department),
      agents: deptAgents,
      theme: getTheme(department),
      row,
      col,
      x,
      y,
      width: zoneWidth,
      depth: zoneDepth,
      desks: [],
      socialAnchor: {
        x: x + zoneWidth - 58,
        y: y + zoneDepth - 54,
      },
      focusAnchor: {
        x: x + zoneWidth / 2,
        y: y + 52,
      },
      windowAnchor: {
        x: x + zoneWidth - 74,
        y: y + 34,
      },
    };

    zone.desks = buildDesks({
      id: zone.id,
      x,
      y,
      width: zoneWidth,
      depth: zoneDepth,
      agentCount: deptAgents.length,
    });

    return zone;
  });

  const officeWidth =
    paddingX * 2 + columns * zoneWidth + Math.max(0, columns - 1) * gapX;
  const rows = Math.max(1, Math.ceil(zones.length / columns));
  const officeDepth =
    paddingY * 2 + corridorY + rows * zoneDepth + Math.max(0, rows - 1) * gapY + 240;

  const lanes: SceneLane[] = [
    {
      id: "main-hall",
      points: [
        { x: paddingX - 30, y: officeDepth - 124 },
        { x: officeWidth - paddingX + 30, y: officeDepth - 124 },
      ],
    },
    {
      id: "cross-hall",
      points: [
        { x: officeWidth / 2 - 70, y: paddingY + 30 },
        { x: officeWidth / 2 + 70, y: officeDepth - 58 },
      ],
    },
    {
      id: "lobby",
      points: [
        { x: paddingX + 40, y: officeDepth - 196 },
        { x: officeWidth - paddingX - 40, y: officeDepth - 196 },
      ],
    },
  ];

  const sceneAgents: AgentSceneModel[] = zones.flatMap((zone) =>
    zone.agents.map((agent, index) => {
      const desk = zone.desks[index % zone.desks.length];
      const home = {
        x: desk.x + desk.width / 2,
        y: desk.y + desk.depth / 2,
      };

      return {
        id: agent.id,
        agent,
        department: zone.name,
        zoneId: zone.id,
        desk,
        home,
        path: buildAgentPath(agent, desk, zone, index),
        duration:
          agent.status === "working" ? 9 : agent.status === "idle" ? 14 : 11,
        delay: (index % 5) * 0.6,
      };
    }),
  );

  return {
    width: officeWidth,
    depth: officeDepth,
    corridorY,
    columns,
    rows,
    zones,
    agents: sceneAgents,
    lanes,
  };
}

export function projectIso(point: ScenePoint, elevation = 0) {
  return {
    x: (point.x - point.y) * 0.76,
    y: (point.x + point.y) * 0.42 - elevation,
  };
}

export function getSceneFrame(scene: OfficeSceneModel) {
  const corners = [
    projectIso({ x: 0, y: 0 }),
    projectIso({ x: scene.width, y: 0 }),
    projectIso({ x: 0, y: scene.depth }),
    projectIso({ x: scene.width, y: scene.depth }),
  ];

  const minX = Math.min(...corners.map((corner) => corner.x));
  const maxX = Math.max(...corners.map((corner) => corner.x));
  const minY = Math.min(...corners.map((corner) => corner.y));
  const maxY = Math.max(...corners.map((corner) => corner.y));

  const padding = 120;

  return {
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
    offsetX: padding - minX,
    offsetY: padding - minY,
  };
}

export function toScreenPoint(
  point: ScenePoint,
  frame: ReturnType<typeof getSceneFrame>,
  elevation = 0,
) {
  const projected = projectIso(point, elevation);
  return {
    x: projected.x + frame.offsetX,
    y: projected.y + frame.offsetY,
  };
}
