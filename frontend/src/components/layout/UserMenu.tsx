"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Bot,
  Users,
  Globe,
  LogOut,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  ChevronUp,
  Save,
  Loader2,
} from "lucide-react";
import {
  departmentsApi,
  companyApi,
  type DepartmentOut,
  type WorkspaceSettings,
} from "@/lib/api";
import { getUser, logout } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import { toast } from "sonner";

export function UserMenu() {
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceSettings | null>(null);
  const [open, setOpen] = useState(false);

  const [editingDept, setEditingDept] = useState<DepartmentOut | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const [deletingDept, setDeletingDept] = useState<DepartmentOut | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { company } = useCompany();
  const user = getUser();

  const companyName = company?.company_name || "AI Workers";
  const userName = user?.name || "CEO";
  const userEmail = user?.email || "";
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (open) {
      departmentsApi.list().then(setDepartments).catch(() => {});
      companyApi.getWorkspace().then(setWorkspace).catch(() => {});
    }
  }, [open]);

  const workspaceConnected = !!(
    workspace?.workspace_provider && workspace?.workspace_domain
  );

  const handleEditDept = (dept: DepartmentOut) => {
    setEditingDept(dept);
    setEditName(dept.name);
    setEditDesc(dept.description || "");
    setOpen(false);
  };

  const handleSaveEdit = async () => {
    if (!editingDept || !editName.trim()) return;
    setSaving(true);
    try {
      const updated = await departmentsApi.update(editingDept.id, {
        name: editName.trim(),
        description: editDesc.trim(),
      });
      setDepartments((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      );
      toast.success(`Department renamed to "${updated.name}".`);
      setEditingDept(null);
    } catch {
      toast.error("Failed to update department.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDept = (dept: DepartmentOut) => {
    setDeletingDept(dept);
    setOpen(false);
  };

  const confirmDelete = async () => {
    if (!deletingDept) return;
    setDeleting(true);
    try {
      await departmentsApi.delete(deletingDept.id);
      setDepartments((prev) => prev.filter((d) => d.id !== deletingDept.id));
      toast.success(`Department "${deletingDept.name}" removed.`);
      setDeletingDept(null);
    } catch {
      toast.error("Failed to delete department.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-sidebar-accent transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-[11px] font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate">{userName}</p>
              <p className="text-[11px] text-sidebar-foreground/50 truncate">
                {userEmail || companyName}
              </p>
            </div>
            <ChevronUp className="h-3.5 w-3.5 text-sidebar-foreground/40 shrink-0" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="top"
          align="start"
          className="w-[220px]"
          sideOffset={8}
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {companyName}
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* Departments Sub-menu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Building2 className="h-4 w-4" />
              Departments
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-[220px]">
              {departments.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                  No departments yet
                </div>
              ) : (
                departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="flex items-center justify-between px-2 py-1.5 text-sm rounded-sm hover:bg-accent group"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="truncate block">{dept.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {dept.agent_count} agent{dept.agent_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditDept(dept);
                        }}
                        className="p-1 rounded hover:bg-muted"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDept(dept);
                        }}
                        className="p-1 rounded hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/app/agents">
                <Bot className="h-4 w-4" />
                Manage Agents
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/app/team">
                <Users className="h-4 w-4" />
                Manage Users
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          {/* Workspace Status */}
          <DropdownMenuItem asChild>
            <Link href="/app/settings" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span className="flex-1">Workspace</span>
              {workspaceConnected ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-red-500" />
              )}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem variant="destructive" onClick={() => logout()}>
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Department Dialog */}
      <Dialog
        open={!!editingDept}
        onOpenChange={(v) => !v && setEditingDept(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Department name"
                onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingDept(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={saving || !editName.trim()}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Department Confirmation */}
      <AlertDialog
        open={!!deletingDept}
        onOpenChange={(v) => !v && setDeletingDept(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingDept && deletingDept.agent_count > 0 ? (
                <>
                  <strong>{deletingDept.name}</strong> has{" "}
                  {deletingDept.agent_count} agent
                  {deletingDept.agent_count !== 1 ? "s" : ""} assigned. Deleting
                  it will leave those agents without a department.
                </>
              ) : (
                <>
                  Are you sure you want to delete{" "}
                  <strong>{deletingDept?.name}</strong>? This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
