"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Check,
  X,
  Loader2,
  Bot,
  User,
  Mail,
  Building2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Globe,
  MessageSquare,
  ImagePlus,
  Zap,
  Shield,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import {
  agentsApi,
  companyApi,
  departmentsApi,
  type AgentCreate,
  type DepartmentOut,
  type WorkspaceSettings,
} from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Step = "identity" | "workspace" | "profile" | "review";

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: "identity", label: "Identity", icon: User },
  { id: "workspace", label: "Workspace", icon: Globe },
  { id: "profile", label: "Profile & AI", icon: Sparkles },
  { id: "review", label: "Review & Create", icon: CheckCircle2 },
];

interface AgentDraft {
  name: string;
  firstName: string;
  lastName: string;
  department: string;
  role: string;
  email: string;
  agentType: "lead" | "worker";
  provisionWorkspace: boolean;
  provisionSlack: boolean;
  generateAvatar: boolean;
  avatarUrl: string;
  goal: string;
  systemPrompt: string;
  llmModel: string;
  tools: string[];
}

const INITIAL_DRAFT: AgentDraft = {
  name: "",
  firstName: "",
  lastName: "",
  department: "",
  role: "",
  email: "",
  agentType: "worker",
  provisionWorkspace: true,
  provisionSlack: true,
  generateAvatar: true,
  avatarUrl: "",
  goal: "",
  systemPrompt: "",
  llmModel: "gpt-4o-mini",
  tools: [],
};

function generateGoal(name: string, role: string, department: string, companyName: string): string {
  const company = companyName || "the company";
  return `Serve as the ${role} in the ${department} department at ${company}. ` +
    `Deliver high-quality work, collaborate with team members, and proactively contribute to departmental objectives.`;
}

function generateSystemPrompt(name: string, role: string, department: string, agentType: string, companyName: string): string {
  const company = companyName || "the company";
  const lines = [
    `You are ${name}, an AI team member working as ${role} in the ${department} department at ${company}.`,
    ``,
    `Your responsibilities:`,
    `- Act as a dedicated ${role} and handle all tasks assigned to you professionally.`,
    `- Communicate clearly, concisely, and in a friendly tone with colleagues.`,
    `- Proactively share updates, ask for clarification when needed, and collaborate with the team.`,
  ];

  if (agentType === "lead") {
    lines.push(
      `- Manage and coordinate workers in the ${department} department.`,
      `- Delegate tasks, review work, and ensure departmental goals are met.`,
      `- Report progress and blockers to leadership.`,
    );
  } else {
    lines.push(
      `- Execute tasks efficiently and report progress to your lead.`,
      `- Support other team members when they need help.`,
    );
  }

  lines.push(
    ``,
    `Always respond as ${name}. You are part of the team — not an external tool.`,
  );

  return lines.join("\n");
}

export function AgentCreatorChat() {
  const [currentStep, setCurrentStep] = useState<Step>("identity");
  const [draft, setDraft] = useState<AgentDraft>({ ...INITIAL_DRAFT });
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceSettings | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdAgent, setCreatedAgent] = useState<{ id: string; name: string; email: string } | null>(null);
  const [provisionStatus, setProvisionStatus] = useState<Record<string, { status: string; detail?: string }>>({});
  const [emailPreview, setEmailPreview] = useState<string>("");
  const [newDeptName, setNewDeptName] = useState("");
  const [showNewDept, setShowNewDept] = useState(false);
  const [goalManuallyEdited, setGoalManuallyEdited] = useState(false);
  const [promptManuallyEdited, setPromptManuallyEdited] = useState(false);

  const { company } = useCompany();
  const companyName = company?.company_name || "";

  useEffect(() => {
    departmentsApi.list().then(setDepartments).catch(() => {});
    companyApi.getWorkspace().then(setWorkspace).catch(() => {});
  }, []);

  const updateDraft = useCallback((updates: Partial<AgentDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  }, []);

  useEffect(() => {
    const name = `${draft.firstName} ${draft.lastName}`.trim();
    updateDraft({ name });

    if (name && workspace?.workspace_domain) {
      const timer = setTimeout(() => {
        agentsApi.generateEmail(name).then((res) => {
          if (res.email) {
            setEmailPreview(res.email);
            updateDraft({ email: res.email });
          }
        }).catch(() => {});
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [draft.firstName, draft.lastName, workspace, updateDraft]);

  useEffect(() => {
    const name = `${draft.firstName} ${draft.lastName}`.trim();
    if (!name || !draft.department || !draft.role) return;

    if (!goalManuallyEdited) {
      const autoGoal = generateGoal(name, draft.role, draft.department, companyName);
      setDraft((prev) => ({ ...prev, goal: autoGoal }));
    }
    if (!promptManuallyEdited) {
      const autoPrompt = generateSystemPrompt(name, draft.role, draft.department, draft.agentType, companyName);
      setDraft((prev) => ({ ...prev, systemPrompt: autoPrompt }));
    }
  }, [draft.firstName, draft.lastName, draft.department, draft.role, draft.agentType, companyName, goalManuallyEdited, promptManuallyEdited]);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const canGoNext = (() => {
    switch (currentStep) {
      case "identity":
        return draft.firstName.trim() && draft.lastName.trim() && draft.department && draft.role.trim();
      case "workspace":
        return true;
      case "profile":
        return true;
      case "review":
        return true;
      default:
        return false;
    }
  })();

  const goNext = () => {
    const idx = currentStepIndex;
    if (idx < STEPS.length - 1) {
      setCurrentStep(STEPS[idx + 1].id);
    }
  };

  const goPrev = () => {
    const idx = currentStepIndex;
    if (idx > 0) {
      setCurrentStep(STEPS[idx - 1].id);
    }
  };

  const handleCreateDepartment = async () => {
    if (!newDeptName.trim()) return;
    try {
      const dept = await departmentsApi.create({ name: newDeptName.trim() });
      setDepartments((prev) => [...prev, dept]);
      updateDraft({ department: dept.name });
      setNewDeptName("");
      setShowNewDept(false);
      toast.success(`Department "${dept.name}" created.`);
    } catch {
      toast.error("Failed to create department.");
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setProvisionStatus({});

    try {
      const agentData: AgentCreate = {
        name: draft.name,
        role: draft.role,
        goal: draft.goal || generateGoal(draft.name, draft.role, draft.department, companyName),
        system_prompt: draft.systemPrompt || generateSystemPrompt(draft.name, draft.role, draft.department, draft.agentType, companyName),
        agent_type: draft.agentType,
        llm_model: draft.llmModel,
        tools: draft.tools,
        parent_agent_id: null,
        department: draft.department,
        email: draft.email || null,
      };

      setProvisionStatus((prev) => ({ ...prev, create: { status: "in_progress" } }));
      const agent = await agentsApi.create(agentData);
      setProvisionStatus((prev) => ({ ...prev, create: { status: "done" } }));

      const shouldProvision =
        draft.provisionWorkspace || draft.provisionSlack || draft.generateAvatar;

      if (shouldProvision) {
        setProvisionStatus((prev) => ({
          ...prev,
          ...(draft.provisionWorkspace && workspace?.workspace_provider
            ? {
                workspace: {
                  status: "in_progress",
                  detail: "Setting up workspace...",
                },
              }
            : {}),
          ...(draft.provisionSlack
            ? {
                slack: {
                  status: "in_progress",
                  detail: "Inviting agent to Slack...",
                },
              }
            : {}),
          ...(draft.generateAvatar
            ? {
                avatar: {
                  status: "in_progress",
                  detail: "Generating avatar...",
                },
              }
            : {}),
        }));

        try {
          const result = await agentsApi.provision(agent.id, {
            provision_workspace: draft.provisionWorkspace,
            provision_slack: draft.provisionSlack,
            generate_avatar: draft.generateAvatar,
          });

          for (const step of result.steps) {
            const normalizedStatus =
              step.status === "provisioned" ||
              step.status === "invited" ||
              step.status === "generated" ||
              step.status === "done"
                ? "done"
                : step.status === "pending"
                  ? "pending"
                  : step.status === "fallback"
                    ? "fallback"
                    : "error";

            setProvisionStatus((prev) => ({
              ...prev,
              [step.step]: {
                status: normalizedStatus,
                detail: step.detail || step.reason || step.email || "",
              },
            }));
          }
        } catch (err) {
          setProvisionStatus((prev) => ({
            ...prev,
            ...(draft.provisionWorkspace && workspace?.workspace_provider
              ? {
                  workspace: {
                    status: "error",
                    detail: err instanceof Error ? err.message : "Provisioning failed",
                  },
                }
              : {}),
            ...(draft.provisionSlack
              ? {
                  slack: {
                    status: "error",
                    detail: err instanceof Error ? err.message : "Provisioning failed",
                  },
                }
              : {}),
            ...(draft.generateAvatar
              ? {
                  avatar: {
                    status: "error",
                    detail: err instanceof Error ? err.message : "Provisioning failed",
                  },
                }
              : {}),
          }));
        }
      }

      setCreated(true);
      setCreatedAgent({ id: agent.id, name: agent.name, email: draft.email });
      toast.success(`AI Agent "${agent.name}" has been onboarded!`);
    } catch (err) {
      setProvisionStatus((prev) => ({
        ...prev,
        create: { status: "error", detail: err instanceof Error ? err.message : "Failed" },
      }));
      toast.error("Failed to create agent.");
    } finally {
      setCreating(false);
    }
  };

  const handleReset = () => {
    setDraft({ ...INITIAL_DRAFT });
    setCurrentStep("identity");
    setCreated(false);
    setCreatedAgent(null);
    setProvisionStatus({});
    setEmailPreview("");
    setGoalManuallyEdited(false);
    setPromptManuallyEdited(false);
  };

  const initials = [draft.firstName, draft.lastName]
    .filter(Boolean)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Onboard AI Agent</h1>
            <p className="text-[11px] text-muted-foreground -mt-0.5">Create a new team member</p>
          </div>
        </div>
        {created && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Onboard Another
          </Button>
        )}
      </div>

      {/* Step Progress */}
      {!created && (
        <div className="border-b border-border px-6 py-3">
          <div className="flex items-center gap-1">
            {STEPS.map((step, i) => {
              const isActive = step.id === currentStep;
              const isPast = i < currentStepIndex;
              const Icon = step.icon;
              return (
                <div key={step.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => isPast && setCurrentStep(step.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                      isActive && "bg-primary text-primary-foreground shadow-sm",
                      isPast && "bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200",
                      !isActive && !isPast && "text-muted-foreground"
                    )}
                  >
                    {isPast ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                    {step.label}
                  </button>
                  {i < STEPS.length - 1 && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto p-6">
          {/* Identity Step */}
          {currentStep === "identity" && !created && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Agent Identity</h2>
                  <p className="text-sm text-muted-foreground">
                    Define your new AI team member just like onboarding a new employee.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={draft.firstName}
                    onChange={(e) => updateDraft({ firstName: e.target.value })}
                    placeholder="Selin"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={draft.lastName}
                    onChange={(e) => updateDraft({ lastName: e.target.value })}
                    placeholder="Yıldız"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Department <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {departments.map((dept) => (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => updateDraft({ department: dept.name })}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm transition-all",
                        draft.department === dept.name
                          ? "border-primary bg-primary/5 text-primary font-medium shadow-sm"
                          : "border-border hover:border-primary/50 hover:bg-muted"
                      )}
                    >
                      <Building2 className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                      {dept.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowNewDept(true)}
                    className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all"
                  >
                    + New Department
                  </button>
                </div>
                {showNewDept && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      placeholder="Department name..."
                      className="max-w-xs"
                      onKeyDown={(e) => e.key === "Enter" && handleCreateDepartment()}
                    />
                    <Button size="sm" onClick={handleCreateDepartment}>Create</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowNewDept(false); setNewDeptName(""); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Role / Job Title <span className="text-red-500">*</span>
                </label>
                <Input
                  value={draft.role}
                  onChange={(e) => updateDraft({ role: e.target.value })}
                  placeholder="Content Creator, Marketing Analyst, Customer Support..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Agent Level</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => updateDraft({ agentType: "worker" })}
                    className={cn(
                      "flex-1 rounded-lg border p-3 text-left transition-all",
                      draft.agentType === "worker"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Bot className="h-4 w-4" />
                      Worker
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Executes tasks, reports to leads</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDraft({ agentType: "lead" })}
                    className={cn(
                      "flex-1 rounded-lg border p-3 text-left transition-all",
                      draft.agentType === "lead"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Shield className="h-4 w-4" />
                      Lead
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Manages workers, delegates tasks</p>
                  </button>
                </div>
              </div>

              {/* Preview card */}
              {draft.firstName && (
                <Card className="bg-muted/30 border-dashed">
                  <CardContent className="flex items-center gap-3 py-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{draft.name || "Agent Name"}</p>
                      <p className="text-xs text-muted-foreground">
                        {draft.role || "Role"} · {draft.department || "Department"}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {draft.agentType}
                    </Badge>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Workspace Step */}
          {currentStep === "workspace" && !created && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-lg">
                  <Globe className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Workspace Setup</h2>
                  <p className="text-sm text-muted-foreground">
                    Create workspace accounts and integrations for your agent.
                  </p>
                </div>
              </div>

              {/* Email Preview */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-500" />
                    Email Account
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {workspace?.workspace_domain ? (
                    <>
                      <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                        <Mail className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-mono font-medium text-blue-700 dark:text-blue-300">
                          {emailPreview || `${draft.firstName.toLowerCase()}.${draft.lastName.toLowerCase()}@${workspace.workspace_domain}`}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Using <strong>{workspace.workspace_domain}</strong> domain
                        {workspace.workspace_provider && (
                          <> via <Badge variant="secondary" className="text-[10px] ml-1">
                            {workspace.workspace_provider === "google" ? "Google Workspace" : "Microsoft 365"}
                          </Badge></>
                        )}
                      </p>
                    </>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3">
                      <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                        <AlertCircle className="h-4 w-4" />
                        <span>No workspace domain configured.</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Go to <strong>Settings &gt; Workspace</strong> to connect Google Workspace or Microsoft 365 and set your domain.
                      </p>
                      <Input
                        value={draft.email}
                        onChange={(e) => updateDraft({ email: e.target.value })}
                        placeholder="agent@company.com"
                        className="mt-2"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Workspace Provisioning */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-emerald-500" />
                    Auto-Provisioning
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ToggleOption
                    checked={draft.provisionWorkspace}
                    onChange={(v) => updateDraft({ provisionWorkspace: v })}
                    icon={workspace?.workspace_provider === "microsoft" ? Globe : Mail}
                    title={workspace?.workspace_provider === "google" ? "Create Google Workspace Account" : workspace?.workspace_provider === "microsoft" ? "Create Microsoft 365 Account" : "Create Workspace Account"}
                    description="Auto-create email, calendar, and drive access"
                    disabled={!workspace?.workspace_domain}
                  />
                  <ToggleOption
                    checked={draft.provisionSlack}
                    onChange={(v) => updateDraft({ provisionSlack: v })}
                    icon={MessageSquare}
                    title="Add to Slack"
                    description="Invite agent to Slack workspace as a team member"
                  />
                  <ToggleOption
                    checked={draft.generateAvatar}
                    onChange={(v) => updateDraft({ generateAvatar: v })}
                    icon={ImagePlus}
                    title="Generate AI Profile Photo"
                    description="Create a professional avatar using AI"
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Profile & AI Step */}
          {currentStep === "profile" && !created && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">AI Configuration</h2>
                  <p className="text-sm text-muted-foreground">
                    Configure the AI brain and capabilities for {draft.name || "your agent"}.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">AI Model</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "gpt-4o-mini", label: "GPT-4o Mini", desc: "Fast, efficient", color: "from-green-500 to-emerald-600" },
                    { id: "gpt-4o", label: "GPT-4o", desc: "Advanced reasoning", color: "from-green-600 to-teal-700" },
                    { id: "anthropic/claude-sonnet-4-20250514", label: "Claude Sonnet", desc: "Creative writing", color: "from-orange-500 to-amber-600" },
                    { id: "anthropic/claude-haiku-3.5-20241022", label: "Claude Haiku", desc: "Ultra-fast", color: "from-orange-400 to-yellow-500" },
                  ].map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => updateDraft({ llmModel: model.id })}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-all",
                        draft.llmModel === model.id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${model.color}`} />
                        <span className="text-sm font-medium">{model.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{model.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Goal</label>
                  {!goalManuallyEdited && draft.goal && (
                    <Badge variant="secondary" className="text-[10px]">
                      <Sparkles className="h-2.5 w-2.5 mr-1" />
                      Auto-generated
                    </Badge>
                  )}
                  {goalManuallyEdited && (
                    <button
                      type="button"
                      onClick={() => {
                        setGoalManuallyEdited(false);
                        updateDraft({
                          goal: generateGoal(draft.name, draft.role, draft.department, companyName),
                        });
                      }}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Reset to auto
                    </button>
                  )}
                </div>
                <textarea
                  value={draft.goal}
                  onChange={(e) => {
                    setGoalManuallyEdited(true);
                    updateDraft({ goal: e.target.value });
                  }}
                  placeholder={`e.g. Handle ${draft.department || "team"} operations and deliver results as ${draft.role || "team member"}...`}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">System Prompt</label>
                  {!promptManuallyEdited && draft.systemPrompt && (
                    <Badge variant="secondary" className="text-[10px]">
                      <Sparkles className="h-2.5 w-2.5 mr-1" />
                      Auto-generated
                    </Badge>
                  )}
                  {promptManuallyEdited && (
                    <button
                      type="button"
                      onClick={() => {
                        setPromptManuallyEdited(false);
                        updateDraft({
                          systemPrompt: generateSystemPrompt(draft.name, draft.role, draft.department, draft.agentType, companyName),
                        });
                      }}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Reset to auto
                    </button>
                  )}
                </div>
                <textarea
                  value={draft.systemPrompt}
                  onChange={(e) => {
                    setPromptManuallyEdited(true);
                    updateDraft({ systemPrompt: e.target.value });
                  }}
                  placeholder={`Custom instructions for ${draft.name || "the agent"}...`}
                  rows={6}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono text-xs leading-relaxed"
                />
                <p className="text-xs text-muted-foreground">
                  This prompt defines how {draft.name || "the agent"} behaves, communicates, and handles tasks.
                </p>
              </div>
            </div>
          )}

          {/* Review Step */}
          {currentStep === "review" && !created && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Review & Create</h2>
                  <p className="text-sm text-muted-foreground">
                    Review the agent details before onboarding.
                  </p>
                </div>
              </div>

              {!workspace?.workspace_domain && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                    <AlertCircle className="h-4 w-4" />
                    Workspace Connection Required
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    You must configure a workspace connection before creating agents.
                    Go to <a href="/app/settings" className="underline font-medium">Settings &gt; Workspace</a> to connect Google Workspace or Microsoft 365.
                  </p>
                </div>
              )}

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-lg font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <h3 className="text-lg font-semibold">{draft.name}</h3>
                      <p className="text-sm text-muted-foreground">{draft.role}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="secondary">
                          <Building2 className="h-3 w-3 mr-1" />
                          {draft.department}
                        </Badge>
                        <Badge variant="outline">{draft.agentType}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3 border-t border-border pt-4">
                    <ReviewRow icon={Mail} label="Email" value={draft.email || "Will be generated"} />
                    <ReviewRow
                      icon={Globe}
                      label="Workspace"
                      value={
                        draft.provisionWorkspace && workspace?.workspace_provider
                          ? `${workspace.workspace_provider === "google" ? "Google Workspace" : "Microsoft 365"} account`
                          : "No workspace provisioning"
                      }
                    />
                    <ReviewRow
                      icon={MessageSquare}
                      label="Slack"
                      value={draft.provisionSlack ? "Will be invited to Slack" : "No Slack invitation"}
                    />
                    <ReviewRow
                      icon={ImagePlus}
                      label="Avatar"
                      value={draft.generateAvatar ? "AI-generated profile photo" : "Initials avatar"}
                    />
                    <ReviewRow
                      icon={Sparkles}
                      label="AI Model"
                      value={draft.llmModel}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Provisioning Progress */}
              {creating && (
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Onboarding in progress...
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <ProvisionStep
                      label="Creating agent record"
                      status={provisionStatus.create?.status || "pending"}
                    />
                    {draft.provisionWorkspace && workspace?.workspace_provider && (
                      <ProvisionStep
                        label={`Provisioning ${workspace.workspace_provider === "google" ? "Google Workspace" : "Microsoft 365"}`}
                        status={provisionStatus.workspace?.status || "pending"}
                        detail={provisionStatus.workspace?.detail}
                      />
                    )}
                    {draft.provisionWorkspace && workspace?.workspace_provider === "google" && (
                      <ProvisionStep
                        label="Linking workspace email"
                        status={provisionStatus.email_link?.status || "pending"}
                        detail={provisionStatus.email_link?.detail}
                      />
                    )}
                    {draft.provisionSlack && (
                      <ProvisionStep
                        label="Inviting to Slack"
                        status={provisionStatus.slack?.status || "pending"}
                        detail={provisionStatus.slack?.detail}
                      />
                    )}
                    {draft.generateAvatar && (
                      <ProvisionStep
                        label="Generating AI avatar"
                        status={provisionStatus.avatar?.status || "pending"}
                        detail={provisionStatus.avatar?.detail}
                      />
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Success State */}
          {created && createdAgent && (
            <div className="space-y-6 py-8">
              <div className="text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 mx-auto mb-4">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold">{createdAgent.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">has been successfully onboarded!</p>
              </div>

              <Card>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{createdAgent.name}</p>
                      <p className="text-sm text-muted-foreground">{draft.role} · {draft.department}</p>
                    </div>
                  </div>

                  {createdAgent.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono">{createdAgent.email}</span>
                    </div>
                  )}

                  <div className="border-t border-border pt-3 space-y-2">
                    {Object.entries(provisionStatus).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        {val.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                        {val.status === "pending" && <Clock className="h-4 w-4 text-amber-500" />}
                        {val.status === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
                        {val.status === "fallback" && <AlertCircle className="h-4 w-4 text-amber-500" />}
                        {val.status === "in_progress" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                        <span className="capitalize">{key.replace("_", " ")}</span>
                        {val.detail && <span className="text-muted-foreground text-xs">- {val.detail}</span>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={handleReset}>
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Onboard Another
                </Button>
                <Button asChild>
                  <a href="/app/agents">
                    <ArrowRight className="h-4 w-4 mr-1.5" />
                    View Team
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Bottom Navigation */}
      {!created && (
        <div className="flex items-center justify-between border-t border-border p-4">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={currentStepIndex === 0 || creating}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          {currentStep === "review" ? (
            <Button onClick={handleCreate} disabled={creating || !workspace?.workspace_domain}>
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Zap className="h-4 w-4 mr-1.5" />
              )}
              {creating ? "Onboarding..." : "Onboard Agent"}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!canGoNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}


function ToggleOption({
  checked,
  onChange,
  icon: Icon,
  title,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ElementType;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 w-full rounded-lg border p-3 text-left transition-all",
        checked && !disabled ? "border-primary bg-primary/5" : "border-border",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
        checked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className={cn(
        "h-5 w-9 rounded-full transition-colors shrink-0 relative",
        checked ? "bg-primary" : "bg-muted-foreground/30"
      )}>
        <div className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5"
        )} />
      </div>
    </button>
  );
}


function ReviewRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}


function ProvisionStep({
  label,
  status,
  detail,
}: {
  label: string;
  status: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
      {status === "in_progress" && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
      {status === "pending" && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
      {status === "error" && <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
      {status === "fallback" && <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />}
      <span className={cn(status === "done" ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      {detail && <span className="text-xs text-muted-foreground ml-auto truncate max-w-[200px]">{detail}</span>}
    </div>
  );
}
