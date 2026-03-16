"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X, ArrowRight } from "lucide-react";
import { healthApi, type LlmHealthResponse } from "@/lib/api";

export function LlmStatusBanner() {
  const [health, setHealth] = useState<LlmHealthResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    healthApi.llm().then(setHealth).catch(() => {});
  }, []);

  if (dismissed || !health || health.any_active) return null;

  const unconfigured = Object.entries(health.providers)
    .filter(([, v]) => !v.configured)
    .map(([k]) => k);

  const configuredButInactive = Object.entries(health.providers)
    .filter(([, v]) => v.configured && !v.active)
    .map(([k]) => k);

  let message: string;
  if (!health.any_configured) {
    message =
      "No LLM provider is configured. Add your OpenAI or Anthropic API keys to enable AI agents.";
  } else if (configuredButInactive.length > 0) {
    message = `LLM key${configuredButInactive.length > 1 ? "s" : ""} for ${configuredButInactive.join(", ")} ${configuredButInactive.length > 1 ? "are" : "is"} invalid or unreachable. Check your API keys.`;
  } else {
    message = `Missing API keys for: ${unconfigured.join(", ")}. Configure them to unlock all models.`;
  }

  return (
    <div className="flex items-center gap-3 border-b border-yellow-500/20 bg-yellow-500/10 px-4 py-2.5 text-sm text-yellow-200">
      <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" />
      <span className="flex-1">{message}</span>
      <Link
        href="/app/settings"
        className="inline-flex items-center gap-1 rounded-md bg-yellow-500/20 px-3 py-1 text-xs font-medium text-yellow-300 hover:bg-yellow-500/30 transition-colors"
      >
        Go to Settings
        <ArrowRight className="h-3 w-3" />
      </Link>
      <button
        onClick={() => setDismissed(true)}
        className="text-yellow-400/60 hover:text-yellow-300 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
