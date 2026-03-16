"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Bot,
  Plus,
  LayoutDashboard,
  Calendar,
  Upload,
  Settings,
  Building2,
  Users,
  Map,
  Zap,
  Circle,
  Globe,
  Plug,
  Cable,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/company-context";
import { FileUpload } from "@/components/agents/FileUpload";
import { UserMenu } from "@/components/layout/UserMenu";
import { agentsApi, departmentsApi, tasksApi } from "@/lib/api";
import { getUser } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  countKey?: "agents" | "departments" | "tasks" | "team";
}

const sections: { label: string; items: NavItem[] }[] = [
  {
    label: "Organization",
    items: [
      { href: "/app/agents", label: "Agents", icon: Bot, countKey: "agents" },
      { href: "/app/departments", label: "Departments", icon: Building2, countKey: "departments" },
      { href: "/app/office", label: "Office Map", icon: Map },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/app/tasks", label: "Tasks", icon: LayoutDashboard, countKey: "tasks" },
      { href: "/app/calendar", label: "Calendar", icon: Calendar },
      { href: "/app/team", label: "Team", icon: Users, countKey: "team" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/app/workspace", label: "Workspace", icon: Globe },
      { href: "/app/integrations", label: "Integrations", icon: Plug },
      { href: "/app/mcp", label: "MCP Servers", icon: Cable },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { company } = useCompany();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const user = getUser();

  const companyName = company?.company_name || "AI Workers";
  const workspaceConnected = !!(company?.workspace_provider && company?.workspace_domain);
  const visibleSections = sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.href !== "/app/calendar" || user?.role === "admin"),
  }));

  useEffect(() => {
    Promise.allSettled([
      agentsApi.listFlat(),
      departmentsApi.list(),
      tasksApi.list(),
    ]).then(([agentsRes, deptsRes, tasksRes]) => {
      setCounts({
        agents: agentsRes.status === "fulfilled" ? agentsRes.value.length : 0,
        departments: deptsRes.status === "fulfilled" ? deptsRes.value.length : 0,
        tasks: tasksRes.status === "fulfilled" ? tasksRes.value.length : 0,
        team: (agentsRes.status === "fulfilled" ? agentsRes.value.length : 0),
      });
    });
  }, []);

  const isActive = (href: string) => {
    if (href === "/app") return pathname === "/app";
    return pathname.startsWith(href);
  };

  return (
    <aside className="flex w-56 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/app" className="flex items-center gap-2.5 min-w-0">
          <Image
            src="/logo.png"
            alt="my-company-llm"
            width={28}
            height={28}
            className="h-7 w-7 rounded-md shrink-0"
          />
          <span className="text-sm font-bold tracking-tight truncate">{companyName}</span>
          <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
            Beta
          </span>
        </Link>
      </div>

      {/* Create Agent CTA */}
      <div className="px-3 pt-3 pb-1">
        <Link
          href="/app/agents/create"
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all",
            isActive("/app/agents/create")
              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
              : "bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary hover:text-sidebar-primary-foreground hover:shadow-sm"
          )}
        >
          <Plus className="h-4 w-4" />
          New Agent
        </Link>
      </div>

      {/* Command Center */}
      <div className="px-3 pt-2">
        <Link
          href="/app"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
            isActive("/app") && !pathname.startsWith("/app/")
              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs"
              : pathname === "/app"
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
        >
          <div className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md shrink-0",
            pathname === "/app"
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "bg-sidebar-accent text-sidebar-foreground/60"
          )}>
            <Zap className="h-3.5 w-3.5" />
          </div>
          Command Center
        </Link>
      </div>

      {/* Nav Sections */}
      <nav className="flex-1 overflow-y-auto px-3 pt-3 pb-2 space-y-4">
        {visibleSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-sidebar-foreground/40">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon, countKey }) => {
                const active = isActive(href);
                const count = countKey ? counts[countKey] : undefined;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all relative",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-sidebar-primary" />
                    )}
                    <Icon className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70"
                    )} />
                    <span className="flex-1">{label}</span>
                    {count !== undefined && count > 0 && (
                      <span className={cn(
                        "min-w-[20px] text-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                        active
                          ? "bg-sidebar-primary/15 text-sidebar-primary"
                          : "bg-sidebar-foreground/8 text-sidebar-foreground/50"
                      )}>
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Utilities */}
      <div className="border-t border-sidebar-border px-3 py-2 space-y-0.5">
        <FileUpload
          trigger={
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all">
              <Upload className="h-4 w-4 shrink-0" />
              Upload Files
            </button>
          }
        />

        <Link
          href="/app/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all relative",
            isActive("/app/settings")
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
        >
          {isActive("/app/settings") && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-sidebar-primary" />
          )}
          <Settings className={cn(
            "h-4 w-4 shrink-0",
            isActive("/app/settings") ? "text-sidebar-primary" : ""
          )} />
          <span className="flex-1">Settings</span>
          <Circle className={cn(
            "h-2 w-2 shrink-0 fill-current",
            workspaceConnected ? "text-emerald-500" : "text-red-400"
          )} />
        </Link>
      </div>

      {/* User */}
      <div className="border-t border-sidebar-border p-2">
        <UserMenu />
      </div>
    </aside>
  );
}
