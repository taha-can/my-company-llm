"use client";

import { memo, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Bot, Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSceneFrame, toScreenPoint, type AgentSceneModel } from "./scene-model";

interface WorkerSpriteProps {
  sceneAgent: AgentSceneModel;
  frame: ReturnType<typeof getSceneFrame>;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}

const STATUS_STYLES: Record<
  string,
  {
    dot: string;
    shadow: string;
    ring: string;
    bubble: string;
  }
> = {
  idle: {
    dot: "bg-sky-300",
    shadow: "shadow-orange-950/20",
    ring: "ring-white/70",
    bubble: "text-slate-700",
  },
  working: {
    dot: "bg-emerald-400",
    shadow: "shadow-emerald-500/25",
    ring: "ring-emerald-200/80",
    bubble: "text-emerald-700",
  },
  error: {
    dot: "bg-rose-400",
    shadow: "shadow-rose-500/30",
    ring: "ring-rose-200/80",
    bubble: "text-rose-700",
  },
  disabled: {
    dot: "bg-amber-300",
    shadow: "shadow-slate-400/20",
    ring: "ring-amber-100/70",
    bubble: "text-amber-700",
  },
};

const SUIT_COLORS = [
  "from-violet-300 via-violet-200 to-fuchsia-200",
  "from-cyan-300 via-sky-200 to-blue-200",
  "from-emerald-300 via-teal-200 to-cyan-200",
  "from-amber-300 via-orange-200 to-yellow-100",
  "from-pink-300 via-rose-200 to-orange-100",
  "from-indigo-300 via-sky-200 to-cyan-100",
];

function hashIndex(value: string, max: number) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % max;
}

function WorkerSpriteComponent({
  sceneAgent,
  frame,
  selected = false,
  dimmed = false,
  onClick,
}: WorkerSpriteProps) {
  const [hovered, setHovered] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const { agent } = sceneAgent;
  const statusStyle = STATUS_STYLES[agent.status] ?? STATUS_STYLES.idle;
  const initials = agent.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const keyframes = useMemo(
    () =>
      sceneAgent.path.map((point) => {
        const projected = toScreenPoint(point, frame, 20);
        return {
          x: projected.x - 22,
          y: projected.y - 64,
        };
      }),
    [frame, sceneAgent.path],
  );
  const shouldRoam = useMemo(() => {
    if (agent.status !== "working" || sceneAgent.path.length <= 1) {
      return false;
    }

    return agent.agent_type === "lead" || hashIndex(agent.id, 3) === 0;
  }, [agent.agent_type, agent.id, agent.status, sceneAgent.path.length]);
  const displayPath = shouldRoam ? keyframes : keyframes.slice(0, 1);
  const firstPoint = displayPath[0];
  const times =
    displayPath.length === 1
      ? [0]
      : displayPath.map((_, index) => index / (displayPath.length - 1));
  const suit = SUIT_COLORS[hashIndex(agent.id, SUIT_COLORS.length)];
  const facingLeft =
    displayPath.length > 1 && displayPath[1] ? displayPath[1].x < displayPath[0].x : false;

  return (
    <motion.button
      type="button"
      className="absolute z-20 cursor-pointer bg-transparent text-left outline-none"
      style={{ left: 0, top: 0 }}
      initial={firstPoint}
      animate={{
        x: displayPath.map((point) => point.x),
        y: displayPath.map((point) => point.y),
        opacity: dimmed ? 0.42 : 1,
      }}
      transition={{
        duration: shouldRoam ? Math.max(sceneAgent.duration, 4) : 0.2,
        times,
        ease: "easeInOut",
        repeat: shouldRoam ? Infinity : 0,
        repeatDelay: shouldRoam ? 1.6 : 0,
        delay: sceneAgent.delay,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={onClick}
    >
      <div className="relative">
        <div
          className={cn(
            "absolute left-1/2 top-[54px] h-3.5 -translate-x-1/2 rounded-full bg-[#70543c]/25 blur-[1px] transition-opacity duration-150",
            selected ? "w-14" : "w-10",
          )}
          style={{ opacity: hovered ? 0.55 : 0.3 }}
        />

        <div className="relative flex flex-col items-center">
          <div className="relative h-10 w-8 rounded-t-full bg-[#ffe5cf]" />
          <div
            className={cn(
              "relative -mt-1 h-12 w-11 rounded-[16px] border border-white/60 bg-gradient-to-b shadow-xl",
              suit,
              statusStyle.shadow,
              selected && "ring-2 ring-sky-300 ring-offset-2 ring-offset-[#fff5ee]",
              facingLeft && "-scale-x-100",
            )}
          >
            <div className="absolute inset-x-1.5 top-1.5 h-5 rounded-full bg-white/35" />
            <div className="absolute left-1/2 top-[32px] h-5 w-1 -translate-x-1/2 rounded-full bg-slate-950/12" />
          </div>
          <div
            className={cn(
              "absolute -top-1 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-[3px] border-white/90 bg-white shadow-lg ring-2 transition-transform duration-150",
              statusStyle.ring,
              (hovered || selected) && "scale-[1.08]",
            )}
          >
            {agent.avatar_url && !imageFailed ? (
              <>
                {/* Avatar URLs can be remote and user-provided, so a plain img fallback is safer here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={agent.avatar_url}
                  alt={agent.name}
                  className="h-full w-full object-cover"
                  onError={() => setImageFailed(true)}
                />
              </>
            ) : (
              <span
                className={cn(
                  "bg-gradient-to-br bg-clip-text text-sm font-bold text-transparent",
                  suit,
                  facingLeft && "-scale-x-100",
                )}
              >
                {initials}
              </span>
            )}
          </div>

          <div
            className={cn(
              "absolute -right-0.5 top-5 h-3.5 w-3.5 rounded-full border-2 border-white/90",
              statusStyle.dot,
            )}
          />

          {agent.agent_type === "lead" && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <Crown className="h-4 w-4 text-amber-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.5)]" />
            </div>
          )}

          {agent.status === "working" && (
            <motion.div
              className="absolute -right-3 top-0 text-emerald-300"
              animate={{ opacity: [0.65, 1, 0.65] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </motion.div>
          )}

          {agent.status === "error" && (
            <div className="absolute -right-3 top-0 text-rose-300">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
          )}
        </div>

        <AnimatePresence>
          {(hovered || selected) && (
            <motion.div
              className="absolute -top-24 left-1/2 min-w-[11rem] -translate-x-1/2 rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-xs text-slate-700 shadow-2xl backdrop-blur-xl"
              initial={{ opacity: 0, y: 6, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
            >
              <div className="flex items-center gap-1 font-semibold">
                {agent.agent_type === "lead" ? (
                  <Crown className="h-3.5 w-3.5 text-amber-300" />
                ) : (
                  <Bot className="h-3.5 w-3.5 text-slate-500" />
                )}
                {agent.name}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">{agent.role}</div>
              <div className={cn("mt-1 text-[10px] uppercase tracking-[0.24em]", statusStyle.bubble)}>
                {agent.status}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-2 text-center">
          <span className="rounded-full border border-white/70 bg-white/75 px-2.5 py-0.5 text-[10px] font-medium text-slate-700 shadow-sm backdrop-blur">
            {agent.name.split(" ")[0]}
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function areWorkerSpritePropsEqual(previous: WorkerSpriteProps, next: WorkerSpriteProps) {
  return (
    previous.sceneAgent === next.sceneAgent &&
    previous.frame === next.frame &&
    previous.selected === next.selected &&
    previous.dimmed === next.dimmed
  );
}

export const WorkerSprite = memo(WorkerSpriteComponent, areWorkerSpritePropsEqual);
