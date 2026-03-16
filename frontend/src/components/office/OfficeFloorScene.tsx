"use client";

import { useMemo } from "react";
import type { AgentDefinition } from "@/lib/api";
import { WorkerSprite } from "./WorkerSprite";
import {
  getSceneFrame,
  toScreenPoint,
  type DepartmentZoneModel,
  type OfficeSceneModel,
  type SceneDesk,
} from "./scene-model";

interface OfficeFloorSceneProps {
  scene: OfficeSceneModel;
  focusedDepartment: string | null;
  selectedAgentId: string | null;
  onZoneClick: (department: string) => void;
  onAgentClick: (agent: AgentDefinition) => void;
}

function polygonPoints(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function compactLabel(label: string) {
  const withoutParenthetical = label.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (withoutParenthetical.length <= 22) {
    return withoutParenthetical;
  }
  return `${withoutParenthetical.slice(0, 19).trim()}...`;
}

function zonePolygon(zone: DepartmentZoneModel, frame: ReturnType<typeof getSceneFrame>) {
  return polygonPoints([
    toScreenPoint({ x: zone.x, y: zone.y }, frame),
    toScreenPoint({ x: zone.x + zone.width, y: zone.y }, frame),
    toScreenPoint({ x: zone.x + zone.width, y: zone.y + zone.depth }, frame),
    toScreenPoint({ x: zone.x, y: zone.y + zone.depth }, frame),
  ]);
}

function wallPolygon(
  zone: DepartmentZoneModel,
  frame: ReturnType<typeof getSceneFrame>,
  side: "left" | "right",
) {
  const elevation = 42;
  if (side === "left") {
    return polygonPoints([
      toScreenPoint({ x: zone.x, y: zone.y }, frame),
      toScreenPoint({ x: zone.x, y: zone.y + zone.depth }, frame),
      toScreenPoint({ x: zone.x, y: zone.y + zone.depth }, frame, elevation),
      toScreenPoint({ x: zone.x, y: zone.y }, frame, elevation),
    ]);
  }

  return polygonPoints([
    toScreenPoint({ x: zone.x + zone.width, y: zone.y }, frame),
    toScreenPoint({ x: zone.x + zone.width, y: zone.y + zone.depth }, frame),
    toScreenPoint({ x: zone.x + zone.width, y: zone.y + zone.depth }, frame, elevation),
    toScreenPoint({ x: zone.x + zone.width, y: zone.y }, frame, elevation),
  ]);
}

function roomTop(
  x: number,
  y: number,
  width: number,
  depth: number,
  frame: ReturnType<typeof getSceneFrame>,
) {
  return polygonPoints([
    toScreenPoint({ x, y }, frame),
    toScreenPoint({ x: x + width, y }, frame),
    toScreenPoint({ x: x + width, y: y + depth }, frame),
    toScreenPoint({ x, y: y + depth }, frame),
  ]);
}

function deskPolygons(desk: SceneDesk, frame: ReturnType<typeof getSceneFrame>) {
  const top = [
    toScreenPoint({ x: desk.x, y: desk.y }, frame, 16),
    toScreenPoint({ x: desk.x + desk.width, y: desk.y }, frame, 16),
    toScreenPoint({ x: desk.x + desk.width, y: desk.y + desk.depth }, frame, 16),
    toScreenPoint({ x: desk.x, y: desk.y + desk.depth }, frame, 16),
  ];
  const left = [
    toScreenPoint({ x: desk.x, y: desk.y + desk.depth }, frame),
    toScreenPoint({ x: desk.x, y: desk.y + desk.depth }, frame, 16),
    toScreenPoint({ x: desk.x + desk.width, y: desk.y + desk.depth }, frame, 16),
    toScreenPoint({ x: desk.x + desk.width, y: desk.y + desk.depth }, frame),
  ];
  const right = [
    toScreenPoint({ x: desk.x + desk.width, y: desk.y }, frame),
    toScreenPoint({ x: desk.x + desk.width, y: desk.y }, frame, 16),
    toScreenPoint({ x: desk.x + desk.width, y: desk.y + desk.depth }, frame, 16),
    toScreenPoint({ x: desk.x + desk.width, y: desk.y + desk.depth }, frame),
  ];

  return { top: polygonPoints(top), left: polygonPoints(left), right: polygonPoints(right) };
}

function DeskCluster({
  zone,
  frame,
}: {
  zone: DepartmentZoneModel;
  frame: ReturnType<typeof getSceneFrame>;
}) {
  return (
    <>
      {zone.desks.map((desk) => {
        const polygons = deskPolygons(desk, frame);
        const monitor = toScreenPoint(
          {
            x: desk.x + (desk.facing === "right" ? 14 : 22),
            y: desk.y + 6,
          },
          frame,
          26,
        );

        return (
          <g key={desk.id} opacity={0.95}>
            <polygon points={polygons.left} fill="rgba(146, 97, 56, 0.7)" />
            <polygon points={polygons.right} fill="rgba(112, 71, 39, 0.82)" />
            <polygon points={polygons.top} fill="rgba(214, 174, 124, 0.98)" />
            <rect
              x={monitor.x - 9}
              y={monitor.y - 9}
              width={18}
              height={12}
              rx={3}
              fill="rgba(44, 56, 89, 0.96)"
              stroke="rgba(255, 255, 255, 0.28)"
            />
            <rect
              x={monitor.x - 6}
              y={monitor.y - 6}
              width={12}
              height={6}
              rx={2}
              fill="rgba(96, 223, 255, 0.38)"
            />
          </g>
        );
      })}
    </>
  );
}

function DepartmentZone({
  zone,
  frame,
  focused,
  onClick,
}: {
  zone: DepartmentZoneModel;
  frame: ReturnType<typeof getSceneFrame>;
  focused: boolean;
  onClick: () => void;
}) {
  const center = toScreenPoint(
    {
      x: zone.x + zone.width / 2,
      y: zone.y + zone.depth / 2,
    },
    frame,
    48,
  );
  const social = toScreenPoint(zone.socialAnchor, frame, 10);
  const focus = toScreenPoint(zone.focusAnchor, frame, 20);
  const windowSpot = toScreenPoint(zone.windowAnchor, frame, 18);
  const wallOpacity = focused ? 0.9 : 0.65;
  const zoneLabel = compactLabel(zone.title);

  return (
    <g className="cursor-pointer" onClick={onClick}>
      <polygon
        points={zonePolygon(zone, frame)}
        fill={zone.theme.fill}
        stroke={focused ? zone.theme.text : zone.theme.wall}
        strokeWidth={focused ? 3 : 2}
      />
      <polygon points={wallPolygon(zone, frame, "left")} fill={zone.theme.wall} opacity={wallOpacity} />
      <polygon points={wallPolygon(zone, frame, "right")} fill="rgba(255, 255, 255, 0.18)" opacity={0.8} />
      <DeskCluster zone={zone} frame={frame} />
      <ellipse cx={social.x} cy={social.y} rx={34} ry={18} fill="rgba(255, 206, 113, 0.28)" />
      <ellipse cx={focus.x} cy={focus.y} rx={38} ry={18} fill={zone.theme.glow} opacity={0.9} />
      <g opacity={0.95}>
        <rect
          x={windowSpot.x - 18}
          y={windowSpot.y - 8}
          width={46}
          height={22}
          rx={8}
          fill="rgba(196, 236, 255, 0.5)"
          stroke="rgba(255, 255, 255, 0.38)"
        />
        <circle cx={windowSpot.x + 52} cy={windowSpot.y + 25} r={11} fill="rgba(122, 214, 153, 0.62)" />
        <rect
          x={windowSpot.x + 46}
          y={windowSpot.y + 30}
          width={12}
          height={14}
          rx={4}
          fill="rgba(135, 97, 60, 0.8)"
        />
      </g>
      <g transform={`translate(${center.x}, ${center.y})`}>
        <rect
          x={-74}
          y={-24}
          width={148}
          height={42}
          rx={18}
          fill="rgba(255, 250, 245, 0.85)"
          stroke="rgba(255, 255, 255, 0.75)"
        />
        <text
          x={0}
          y={0}
          textAnchor="middle"
          fill="rgba(46, 65, 96, 0.95)"
          style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em" }}
        >
          {zoneLabel.toUpperCase()}
        </text>
        <text
          x={0}
          y={15}
          textAnchor="middle"
          fill="rgba(76, 93, 126, 0.78)"
          style={{ fontSize: "11px" }}
        >
          {zone.agents.length} agents
        </text>
      </g>
      <text
        x={center.x - 102}
        y={center.y - 22}
        fill={zone.theme.text}
        style={{ fontSize: "24px" }}
      >
        {zone.theme.icon}
      </text>
    </g>
  );
}

function DecorativeRooms({
  scene,
  frame,
}: {
  scene: OfficeSceneModel;
  frame: ReturnType<typeof getSceneFrame>;
}) {
  const lounge = {
    x: scene.width / 2 - 180,
    y: scene.depth - 250,
    width: 220,
    depth: 124,
  };
  const meeting = {
    x: scene.width - 320,
    y: 84,
    width: 180,
    depth: 120,
  };
  const reception = {
    x: 92,
    y: 74,
    width: 190,
    depth: 128,
  };

  const rooms = [
    {
      ...reception,
      fill: "rgba(255, 230, 199, 0.88)",
      accent: "rgba(255, 184, 108, 0.45)",
      label: "Reception",
      icon: "☀",
    },
    {
      ...meeting,
      fill: "rgba(214, 232, 255, 0.84)",
      accent: "rgba(129, 183, 255, 0.46)",
      label: "Meeting",
      icon: "✦",
    },
    {
      ...lounge,
      fill: "rgba(232, 222, 255, 0.88)",
      accent: "rgba(177, 135, 255, 0.42)",
      label: "Lounge",
      icon: "☕",
    },
  ];

  return (
    <>
      {rooms.map((room) => {
        const center = toScreenPoint(
          { x: room.x + room.width / 2, y: room.y + room.depth / 2 },
          frame,
          40,
        );
        return (
          <g key={room.label}>
            <polygon
              points={roomTop(room.x, room.y, room.width, room.depth, frame)}
              fill={room.fill}
              stroke="rgba(255,255,255,0.52)"
              strokeWidth="2"
            />
            <polygon
              points={polygonPoints([
                toScreenPoint({ x: room.x, y: room.y }, frame),
                toScreenPoint({ x: room.x, y: room.y + room.depth }, frame),
                toScreenPoint({ x: room.x, y: room.y + room.depth }, frame, 36),
                toScreenPoint({ x: room.x, y: room.y }, frame, 36),
              ])}
              fill={room.accent}
            />
            <polygon
              points={polygonPoints([
                toScreenPoint({ x: room.x + room.width, y: room.y }, frame),
                toScreenPoint({ x: room.x + room.width, y: room.y + room.depth }, frame),
                toScreenPoint({ x: room.x + room.width, y: room.y + room.depth }, frame, 36),
                toScreenPoint({ x: room.x + room.width, y: room.y }, frame, 36),
              ])}
              fill="rgba(255,255,255,0.16)"
            />
            <ellipse cx={center.x} cy={center.y + 16} rx={42} ry={18} fill="rgba(255,255,255,0.18)" />
            <text
              x={center.x}
              y={center.y - 6}
              textAnchor="middle"
              fill="rgba(47, 63, 94, 0.95)"
              style={{ fontSize: "12px", fontWeight: 700 }}
            >
              {room.label}
            </text>
            <text
              x={center.x - 54}
              y={center.y - 2}
              fill="rgba(47, 63, 94, 0.9)"
              style={{ fontSize: "18px" }}
            >
              {room.icon}
            </text>
          </g>
        );
      })}
    </>
  );
}

export function OfficeFloorScene({
  scene,
  focusedDepartment,
  selectedAgentId,
  onZoneClick,
  onAgentClick,
}: OfficeFloorSceneProps) {
  const frame = useMemo(() => getSceneFrame(scene), [scene]);
  const officeFloor = polygonPoints([
    toScreenPoint({ x: 24, y: 0 }, frame),
    toScreenPoint({ x: scene.width - 24, y: 0 }, frame),
    toScreenPoint({ x: scene.width, y: scene.depth - 16 }, frame),
    toScreenPoint({ x: 0, y: scene.depth - 16 }, frame),
  ]);

  const stageZones = scene.zones.map((zone) => ({
    zone,
    focused: zone.name === focusedDepartment,
  }));

  return (
    <div
      className="relative office-simulator-shell overflow-hidden rounded-[32px] border border-white/50 bg-slate-950/70 shadow-2xl"
      style={{ width: frame.width, height: frame.height }}
    >
      <div className="office-simulator-grid absolute inset-0 opacity-90" />
      <div className="office-simulator-haze absolute inset-0" />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${frame.width} ${frame.height}`}
        fill="none"
      >
        <defs>
          <linearGradient id="officeFloorFill" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255, 242, 226, 0.98)" />
            <stop offset="100%" stopColor="rgba(221, 238, 255, 0.98)" />
          </linearGradient>
          <linearGradient id="hallLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(255, 167, 122, 0)" />
            <stop offset="50%" stopColor="rgba(255, 167, 122, 0.72)" />
            <stop offset="100%" stopColor="rgba(255, 167, 122, 0)" />
          </linearGradient>
        </defs>

        <ellipse
          cx={frame.width / 2}
          cy={frame.height / 2}
          rx={frame.width * 0.48}
          ry={frame.height * 0.34}
          fill="rgba(255, 194, 128, 0.14)"
        />
        <ellipse
          cx={frame.width * 0.74}
          cy={frame.height * 0.24}
          rx={190}
          ry={72}
          fill="rgba(134, 212, 255, 0.14)"
        />
        <polygon points={officeFloor} fill="url(#officeFloorFill)" stroke="rgba(255, 255, 255, 0.55)" />

        {scene.lanes.map((lane) => {
          const points = polygonPoints(lane.points.map((point) => toScreenPoint(point, frame, 1)));
          return (
            <polyline
              key={lane.id}
              points={points}
              stroke="url(#hallLine)"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.78"
              strokeDasharray="16 24"
            />
          );
        })}

        <DecorativeRooms scene={scene} frame={frame} />

        {stageZones.map(({ zone, focused }) => (
          <g key={zone.id}>
            <DepartmentZone
              zone={zone}
              frame={frame}
              focused={focused}
              onClick={() => onZoneClick(zone.name)}
            />
          </g>
        ))}

        <g opacity="0.85">
          <circle
            cx={toScreenPoint({ x: scene.width / 2, y: scene.depth - 160 }, frame).x}
            cy={toScreenPoint({ x: scene.width / 2, y: scene.depth - 160 }, frame).y}
            r="34"
            fill="rgba(255, 255, 255, 0.58)"
          />
          <circle
            cx={toScreenPoint({ x: scene.width / 2, y: scene.depth - 160 }, frame).x}
            cy={toScreenPoint({ x: scene.width / 2, y: scene.depth - 160 }, frame).y - 22}
            r="16"
            fill="rgba(255, 191, 92, 0.95)"
          />
        </g>
      </svg>

      {scene.agents.map((sceneAgent) => (
        <WorkerSprite
          key={sceneAgent.id}
          sceneAgent={sceneAgent}
          frame={frame}
          selected={sceneAgent.id === selectedAgentId}
          dimmed={
            Boolean(focusedDepartment) && sceneAgent.department !== focusedDepartment
          }
          onClick={() => onAgentClick(sceneAgent.agent)}
        />
      ))}
    </div>
  );
}
