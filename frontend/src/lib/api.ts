const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const localToken = localStorage.getItem("fact_token");
  if (localToken) return localToken;

  const cookieToken = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("fact_token="))
    ?.split("=")[1];

  return cookieToken || null;
}

export async function apiAuthFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  goal: string;
  system_prompt: string;
  agent_type: "lead" | "worker";
  llm_model: string;
  tools: string[];
  parent_agent_id: string | null;
  department: string;
  status: "idle" | "working" | "error" | "disabled";
  email: string | null;
  avatar_url: string | null;
  workspace_provisioned: "none" | "google" | "microsoft";
  slack_member_id: string | null;
  created_at: string;
  updated_at: string;
  children?: AgentDefinition[];
}

export interface AgentCreate {
  name: string;
  role: string;
  goal: string;
  system_prompt: string;
  agent_type: "lead" | "worker";
  llm_model: string;
  tools: string[];
  parent_agent_id: string | null;
  department: string;
  email?: string | null;
  avatar_url?: string | null;
}

export interface AgentProvisionRequest {
  agent_id: string;
  provision_workspace?: boolean;
  provision_slack?: boolean;
  generate_avatar?: boolean;
}

export interface ProvisionResult {
  agent_id: string;
  steps: Array<{
    step: string;
    status: string;
    email?: string;
    provider?: string;
    reason?: string;
    member_id?: string;
    avatar_url?: string;
  }>;
  agent: AgentDefinition;
}

export type PriorityLevel = "low" | "medium" | "high" | "urgent";

export const BOARD = {
  BACKLOG: "backlog",
  IN_PROGRESS: "in_progress",
  DONE: "done",
} as const;

export const DEFAULT_BOARDS = [BOARD.BACKLOG, BOARD.IN_PROGRESS, BOARD.DONE] as const;

export interface TaskOut {
  id: string;
  agent_id: string | null;
  agent_name: string;
  directive: string;
  description: string;
  status: string;
  board: string;
  priority: PriorityLevel;
  labels: string[];
  due_date: string | null;
  result: string | null;
  parent_task_id: string | null;
  subtask_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string | null;
  role: string;
  agent_id: string | null;
  agent_name: string | null;
  content: string;
  created_at: string;
}

export interface LabelOut {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ContextSource {
  [key: string]: number;
}

export interface ChatEvent {
  type: string;
  agent_id?: string;
  agent_name?: string;
  content?: string;
  department?: string;
  reasoning?: string;
  tool?: string;
  arguments?: Record<string, unknown>;
  result?: string;
  error?: string;
  task_id?: string;
  directive?: string;
  status?: string;
  // context_info fields
  context_percentage?: number;
  tokens_used?: number;
  context_window?: number;
  sources?: ContextSource;
}

export interface FileUploadResult {
  success: boolean;
  filename: string;
  chunks: number;
  characters?: number;
  target: string;
  error?: string;
}

export interface BatchUploadResult {
  files_processed: number;
  total_chunks: number;
  results: FileUploadResult[];
}

export const filesApi = {
  upload: async (file: File, agentId?: string): Promise<FileUploadResult> => {
    const form = new FormData();
    form.append("file", file);
    if (agentId) form.append("agent_id", agentId);

    const res = await fetch(`${API_BASE}/api/files/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Upload failed: ${text}`);
    }
    return res.json();
  },

  uploadBatch: async (files: File[], agentId?: string): Promise<BatchUploadResult> => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    if (agentId) form.append("agent_id", agentId);

    const res = await fetch(`${API_BASE}/api/files/upload/batch`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Batch upload failed: ${text}`);
    }
    return res.json();
  },
};

export interface IntegrationField {
  key: string;
  label: string;
  placeholder: string;
  secret: boolean;
  required: boolean;
  help_text: string;
  has_value: boolean;
}

export interface IntegrationOut {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tool_names: string[];
  fields: IntegrationField[];
  configured: boolean;
}

export const credentialsApi = {
  listIntegrations: (agentId?: string) => {
    const qs = agentId ? `?agent_id=${agentId}` : "";
    return apiFetch<IntegrationOut[]>(`/api/credentials/integrations${qs}`);
  },
  save: (data: { integration: string; credentials: { key: string; value: string }[]; agent_id?: string | null }) =>
    apiFetch<{ success: boolean }>("/api/credentials", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  delete: (integration: string, agentId?: string) => {
    const qs = agentId ? `?agent_id=${agentId}` : "";
    return apiFetch<{ success: boolean }>(`/api/credentials/${integration}${qs}`, {
      method: "DELETE",
    });
  },
};

export interface CalendarStatus {
  configured: boolean;
  connected: boolean;
  writable: boolean;
  external_email: string | null;
}

export interface CalendarConnectUrl {
  url: string;
}

export interface CalendarEventAttendee {
  email: string;
  display_name: string | null;
  response_status: string | null;
  organizer: boolean;
  self: boolean;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  all_day: boolean;
  status: string;
  html_link: string | null;
  description: string;
  location: string;
  creator_email: string | null;
  organizer_email: string | null;
  conference_link: string | null;
  attendees: CalendarEventAttendee[];
  color_id: string | null;
  recurring_event_id: string | null;
  timezone: string | null;
  can_edit: boolean;
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
}

export interface CalendarEventUpsert {
  summary: string;
  start: string;
  end: string;
  all_day: boolean;
  description?: string;
  location?: string;
  attendees?: string[];
  color_id?: string | null;
  timezone?: string | null;
}

export const calendarApi = {
  status: () => apiAuthFetch<CalendarStatus>("/api/calendar/status"),
  getConnectUrl: () => apiAuthFetch<CalendarConnectUrl>("/api/calendar/connect-url"),
  events: (start: string, end: string) => {
    const params = new URLSearchParams({ start, end });
    return apiAuthFetch<CalendarEventsResponse>(`/api/calendar/events?${params.toString()}`);
  },
  createEvent: (data: CalendarEventUpsert) =>
    apiAuthFetch<CalendarEvent>("/api/calendar/events", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateEvent: (eventId: string, data: CalendarEventUpsert) =>
    apiAuthFetch<CalendarEvent>(`/api/calendar/events/${eventId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteEvent: (eventId: string) =>
    apiAuthFetch<{ deleted: boolean; event_id: string }>(`/api/calendar/events/${eventId}`, {
      method: "DELETE",
    }),
};

export interface CompanySettings {
  company_name: string;
  company_description: string;
  industry: string;
  brand_voice: string;
  is_onboarded: boolean;
  workspace_provider: string;
  workspace_domain: string;
}

export interface WorkspaceSettings {
  workspace_provider: string;
  workspace_domain: string;
}

export interface OnboardingAgent {
  name: string;
  role: string;
}

export interface OnboardingSetupRequest {
  company_name: string;
  company_description?: string;
  industry?: string;
  department_name: string;
  agents: OnboardingAgent[];
}

export interface OnboardingResult {
  company: CompanySettings;
  department_id: string;
  department_name: string;
  agents_created: number;
}

export const companyApi = {
  get: () => apiFetch<CompanySettings>("/api/company"),
  save: (data: { company_name: string; company_description?: string; industry?: string; brand_voice?: string }) =>
    apiFetch<CompanySettings>("/api/company", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  onboarding: (data: OnboardingSetupRequest) =>
    apiFetch<OnboardingResult>("/api/company/onboarding", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getWorkspace: () => apiFetch<WorkspaceSettings>("/api/company/workspace"),
  saveWorkspace: (data: WorkspaceSettings) =>
    apiFetch<WorkspaceSettings>("/api/company/workspace", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export interface DepartmentOut {
  id: string;
  name: string;
  description: string;
  agent_count: number;
  created_at: string;
  updated_at: string;
}

export interface DepartmentCreate {
  name: string;
  description?: string;
}

export interface DepartmentUpdate {
  name?: string;
  description?: string;
}

export const departmentsApi = {
  list: () => apiFetch<DepartmentOut[]>("/api/departments"),
  get: (id: string) => apiFetch<DepartmentOut>(`/api/departments/${id}`),
  create: (data: DepartmentCreate) =>
    apiFetch<DepartmentOut>("/api/departments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: DepartmentUpdate) =>
    apiFetch<DepartmentOut>(`/api/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/api/departments/${id}`, { method: "DELETE" }),
};

export interface LlmProviderStatus {
  configured: boolean;
  active: boolean;
}

export interface LlmHealthResponse {
  providers: Record<string, LlmProviderStatus>;
  any_active: boolean;
  any_configured: boolean;
}

export const healthApi = {
  llm: () => apiFetch<LlmHealthResponse>("/api/health/llm"),
};

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "manager" | "viewer";
  avatar_url: string | null;
  status: "invited" | "active" | "disabled";
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  name: string;
  email: string;
  role: "admin" | "manager" | "viewer";
}

export interface UserUpdate {
  name?: string;
  role?: "admin" | "manager" | "viewer";
  status?: "active" | "disabled";
}

export const usersApi = {
  list: () => apiFetch<User[]>("/api/users"),
  create: (data: UserCreate) =>
    apiFetch<User>("/api/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: UserUpdate) =>
    apiFetch<User>(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/api/users/${id}`, { method: "DELETE" }),
  resendInvite: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/users/${id}/resend-invite`, { method: "POST" }),
};

export const agentsApi = {
  list: () => apiFetch<AgentDefinition[]>("/api/agents"),
  listFlat: () => apiFetch<AgentDefinition[]>("/api/agents/flat"),
  get: (id: string) => apiFetch<AgentDefinition>(`/api/agents/${id}`),
  create: (data: AgentCreate) =>
    apiFetch<AgentDefinition>("/api/agents", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<AgentCreate>) =>
    apiFetch<AgentDefinition>(`/api/agents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/api/agents/${id}`, { method: "DELETE" }),
  generate: (description: string) =>
    apiFetch<AgentCreate>("/api/agents/generate", {
      method: "POST",
      body: JSON.stringify({ description }),
    }),
  provision: (agentId: string, data?: Partial<AgentProvisionRequest>) =>
    apiFetch<ProvisionResult>(`/api/agents/${agentId}/provision`, {
      method: "POST",
      body: JSON.stringify({ agent_id: agentId, ...data }),
    }),
  generateEmail: (name: string) =>
    apiFetch<{ email: string | null; domain?: string; reason?: string }>("/api/agents/generate-email", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
};

export const tasksApi = {
  list: (params?: { status?: string; board?: string; agent_id?: string; priority?: string; search?: string; label?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.board) qs.set("board", params.board);
    if (params?.agent_id) qs.set("agent_id", params.agent_id);
    if (params?.priority) qs.set("priority", params.priority);
    if (params?.search) qs.set("search", params.search);
    if (params?.label) qs.set("label", params.label);
    const query = qs.toString();
    return apiFetch<TaskOut[]>(`/api/tasks${query ? `?${query}` : ""}`);
  },
  listByAgent: (agentId: string) =>
    apiFetch<TaskOut[]>(`/api/tasks/by-agent/${agentId}`),
  listBoards: () => apiFetch<string[]>("/api/tasks/boards"),
  createBoard: (name: string) =>
    apiFetch<{ name: string; created: boolean }>("/api/tasks/boards", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  deleteBoard: (name: string) =>
    apiFetch<{ deleted: boolean }>(`/api/tasks/boards/${name}`, { method: "DELETE" }),
  get: (id: string) => apiFetch<TaskOut>(`/api/tasks/${id}`),
  getSubtasks: (id: string) => apiFetch<TaskOut[]>(`/api/tasks/${id}/subtasks`),
  getComments: (id: string) => apiFetch<TaskComment[]>(`/api/tasks/${id}/messages`),
  addComment: (id: string, content: string) =>
    apiFetch<TaskComment>(`/api/tasks/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  create: (data: {
    directive: string;
    description?: string;
    agent_id?: string;
    board?: string;
    priority?: PriorityLevel;
    labels?: string[];
    due_date?: string;
    parent_task_id?: string;
  }) =>
    apiFetch<TaskOut>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: {
    board?: string;
    directive?: string;
    description?: string;
    agent_id?: string | null;
    status?: string;
    priority?: PriorityLevel;
    labels?: string[];
    due_date?: string | null;
    result?: string;
  }) =>
    apiFetch<TaskOut>(`/api/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/api/tasks/${id}`, { method: "DELETE" }),
  approve: (id: string, action: "approve" | "reject", feedback?: string) =>
    apiFetch<TaskOut>(`/api/tasks/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ action, feedback }),
    }),
  listLabels: () => apiFetch<LabelOut[]>("/api/tasks/labels"),
  createLabel: (name: string, color: string) =>
    apiFetch<LabelOut>("/api/tasks/labels", {
      method: "POST",
      body: JSON.stringify({ name, color }),
    }),
  deleteLabel: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/api/tasks/labels/${id}`, { method: "DELETE" }),
};

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
  description: string;
  context_window: number;
  max_output: number;
  is_default: boolean;
  category: string;
}

export interface ModelCategory {
  id: string;
  name: string;
  description: string;
}

export interface ModelsResponse {
  models: ModelInfo[];
  categories: ModelCategory[];
}

export const modelsApi = {
  list: (category?: string) => {
    const qs = category ? `?category=${category}` : "";
    return apiFetch<ModelsResponse>(`/api/models${qs}`);
  },
  categories: () => apiFetch<ModelCategory[]>("/api/models/categories"),
};

// ── MCP Servers ──────────────────────────────────────

export interface McpToolInfo {
  name: string;
  description: string;
  input_schema?: Record<string, unknown>;
}

export interface McpServerConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  connection_type: "stdio" | "sse";
  command?: string;
  args: string[];
  env_vars: Record<string, string>;
  url?: string;
  headers: Record<string, string>;
  is_preset: boolean;
  enabled: boolean;
  discovered_tools: McpToolInfo[];
  created_at: string;
}

export interface McpPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  connection_type: "stdio" | "sse";
  command?: string;
  args: string[];
  env_keys: string[];
}

export interface McpServerCreate {
  name: string;
  description?: string;
  icon?: string;
  connection_type: "stdio" | "sse";
  command?: string;
  args?: string[];
  env_vars?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  is_preset?: boolean;
}

export const mcpApi = {
  list: () => apiFetch<McpServerConfig[]>("/api/mcp-servers"),
  presets: () => apiFetch<McpPreset[]>("/api/mcp-servers/presets"),
  create: (data: McpServerCreate) =>
    apiFetch<McpServerConfig>("/api/mcp-servers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<McpServerCreate> & { enabled?: boolean }) =>
    apiFetch<McpServerConfig>(`/api/mcp-servers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/mcp-servers/${id}`, { method: "DELETE" }),
  discover: (id: string) =>
    apiFetch<{ success: boolean; tools: McpToolInfo[] }>(`/api/mcp-servers/${id}/discover`, {
      method: "POST",
    }),
  test: (id: string) =>
    apiFetch<{ success: boolean; message: string }>(`/api/mcp-servers/${id}/test`, {
      method: "POST",
    }),
};

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  message_count: number;
}

export interface SessionMessages {
  session: { id: string; title: string };
  events: ChatEvent[];
}

export const chatApi = {
  createSession: (title?: string) =>
    apiFetch<ChatSession>("/ws/sessions", {
      method: "POST",
      body: JSON.stringify({ title: title || "New Chat" }),
    }),
  listSessions: (limit?: number) => {
    const qs = limit ? `?limit=${limit}` : "";
    return apiFetch<ChatSession[]>(`/ws/sessions${qs}`);
  },
  getSessionMessages: (sessionId: string) =>
    apiFetch<SessionMessages>(`/ws/sessions/${sessionId}/messages`),
  deleteSession: (sessionId: string) =>
    apiFetch<{ deleted: boolean }>(`/ws/sessions/${sessionId}`, { method: "DELETE" }),
};
