"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Bot,
  Crown,
  Mail,
  MessageSquare,
  Globe,
  User,
  Users,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Save,
  UserPlus,
} from "lucide-react";
import {
  agentsApi,
  usersApi,
  departmentsApi,
  type AgentDefinition,
  type User as UserType,
  type DepartmentOut,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusColors: Record<string, { bg: string; label: string }> = {
  idle: { bg: "bg-gray-400", label: "Idle" },
  working: { bg: "bg-emerald-500", label: "Working" },
  error: { bg: "bg-red-500", label: "Error" },
  disabled: { bg: "bg-amber-500", label: "Disabled" },
  active: { bg: "bg-emerald-500", label: "Active" },
  invited: { bg: "bg-blue-500", label: "Invited" },
};

type TeamMember = {
  type: "agent" | "human";
  id: string;
  name: string;
  role: string;
  email: string | null;
  avatarUrl: string | null;
  status: string;
  department?: string;
  isLead?: boolean;
  workspaceProvider?: string;
  slackConnected?: boolean;
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "agents" | "humans">("all");
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);

  // Edit state
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "", email: "", department: "", status: "" });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Invite user state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "viewer" as "admin" | "manager" | "viewer" });
  const [inviting, setInviting] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const [agents, users, depts] = await Promise.all([
        agentsApi.listFlat(),
        usersApi.list().catch(() => [] as UserType[]),
        departmentsApi.list().catch(() => [] as DepartmentOut[]),
      ]);

      setDepartments(depts);

      const agentMembers: TeamMember[] = agents.map((a) => ({
        type: "agent",
        id: a.id,
        name: a.name,
        role: a.role,
        email: a.email,
        avatarUrl: a.avatar_url,
        status: a.status,
        department: a.department,
        isLead: a.agent_type === "lead",
        workspaceProvider: a.workspace_provisioned !== "none" ? a.workspace_provisioned : undefined,
        slackConnected: !!a.slack_member_id,
      }));

      const humanMembers: TeamMember[] = users.map((u) => ({
        type: "human",
        id: u.id,
        name: u.name,
        role: u.role,
        email: u.email,
        avatarUrl: u.avatar_url,
        status: u.status,
      }));

      setMembers([...humanMembers, ...agentMembers]);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const openEdit = (member: TeamMember) => {
    setEditingMember(member);
    setEditForm({
      name: member.name,
      role: member.role,
      email: member.email || "",
      department: member.department || "",
      status: member.status,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingMember || !editForm.name.trim()) return;
    setSaving(true);
    try {
      if (editingMember.type === "agent") {
        await agentsApi.update(editingMember.id, {
          name: editForm.name.trim(),
          role: editForm.role.trim(),
          department: editForm.department,
          email: editForm.email.trim() || null,
        });
      } else {
        await usersApi.update(editingMember.id, {
          name: editForm.name.trim(),
          role: editForm.role as "admin" | "manager" | "viewer",
          status: editForm.status as "active" | "disabled",
        });
      }
      toast.success(`${editingMember.name} updated.`);
      setEditingMember(null);
      await loadMembers();
    } catch {
      toast.error("Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingMember) return;
    setDeleting(true);
    try {
      if (deletingMember.type === "agent") {
        await agentsApi.delete(deletingMember.id);
      } else {
        await usersApi.delete(deletingMember.id);
      }
      toast.success(`${deletingMember.name} removed.`);
      setDeletingMember(null);
      await loadMembers();
    } catch {
      toast.error("Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) return;
    setInviting(true);
    try {
      await usersApi.create({
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim(),
        role: inviteForm.role,
      });
      toast.success(`Invitation sent to ${inviteForm.email}.`);
      setShowInvite(false);
      setInviteForm({ name: "", email: "", role: "viewer" });
      await loadMembers();
    } catch {
      toast.error("Failed to invite user.");
    } finally {
      setInviting(false);
    }
  };

  const filtered = members.filter((m) => {
    if (filter === "agents") return m.type === "agent";
    if (filter === "humans") return m.type === "human";
    return true;
  });

  const agentCount = members.filter((m) => m.type === "agent").length;
  const humanCount = members.filter((m) => m.type === "human").length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 h-14">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Team</h1>
          <Badge variant="secondary" className="text-xs">
            {members.length} members
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowInvite(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Invite User
          </Button>
          <Button size="sm" asChild>
            <a href="/app/agents/create">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Onboard AI Agent
            </a>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        {([
          { id: "all" as const, label: "All", count: members.length, icon: Users },
          { id: "humans" as const, label: "People", count: humanCount, icon: User },
          { id: "agents" as const, label: "AI Agents", count: agentCount, icon: Bot },
        ]).map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <f.icon className="h-3.5 w-3.5" />
            {f.label}
            <span className="ml-0.5 opacity-70">{f.count}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <Users className="h-8 w-8" />
            <p className="text-sm">No team members found.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((member) => (
              <Card key={`${member.type}-${member.id}`} className="hover:border-primary/30 transition-colors group">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <Avatar className="h-11 w-11">
                        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name} />}
                        <AvatarFallback
                          className={cn(
                            "text-white text-sm font-bold",
                            member.type === "agent"
                              ? member.isLead ? "bg-violet-600" : "bg-emerald-600"
                              : "bg-blue-600"
                          )}
                        >
                          {member.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                        statusColors[member.status]?.bg || "bg-gray-400"
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {member.type === "agent" ? (
                          member.isLead ? (
                            <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          ) : (
                            <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )
                        ) : (
                          <User className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        )}
                        <span className="text-sm font-semibold truncate">{member.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{member.role}</p>

                      {member.email && (
                        <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1 mt-0.5 truncate">
                          <Mail className="h-2.5 w-2.5 shrink-0" />
                          {member.email}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant={member.type === "agent" ? "secondary" : "outline"} className="text-[10px]">
                          {member.type === "agent" ? "AI Agent" : "Human"}
                        </Badge>
                        {member.department && (
                          <Badge variant="outline" className="text-[10px]">{member.department}</Badge>
                        )}
                        {member.workspaceProvider && (
                          <Badge variant="outline" className="text-[10px]">
                            <Globe className="h-2.5 w-2.5 mr-0.5" />
                            {member.workspaceProvider === "google" ? "GWS" : "M365"}
                          </Badge>
                        )}
                        {member.slackConnected && (
                          <Badge variant="outline" className="text-[10px]">
                            <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                            Slack
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Edit / Delete Actions */}
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => openEdit(member)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setDeletingMember(member)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Member Dialog */}
      <Dialog open={!!editingMember} onOpenChange={(v) => !v && setEditingMember(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Edit {editingMember?.type === "agent" ? "Agent" : "User"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            {editingMember?.type === "agent" ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Role</label>
                  <Input
                    value={editForm.role}
                    onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Department</label>
                  <select
                    value={editForm.department}
                    onChange={(e) => setEditForm((p) => ({ ...p, department: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="agent@company.com"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingMember(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={saving || !editForm.name.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingMember} onOpenChange={(v) => !v && setDeletingMember(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deletingMember?.type === "agent" ? "Agent" : "User"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deletingMember?.name}</strong>?
              {deletingMember?.type === "agent"
                ? " This will delete the agent and all its memory."
                : " This will revoke their access."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite User Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={inviteForm.name}
                onChange={(e) => setInviteForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="user@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Role</label>
              <select
                value={inviteForm.role}
                onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value as "admin" | "manager" | "viewer" }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleInvite}
              disabled={inviting || !inviteForm.name.trim() || !inviteForm.email.trim()}
            >
              {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <UserPlus className="h-3.5 w-3.5 mr-1" />}
              {inviting ? "Inviting..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
