"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Building2,
  Plus,
  Pencil,
  Trash2,
  Save,
  Loader2,
  Users,
} from "lucide-react";
import { departmentsApi, type DepartmentOut } from "@/lib/api";
import { toast } from "sonner";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [loading, setLoading] = useState(true);

  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingDept, setEditingDept] = useState<DepartmentOut | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingDept, setDeletingDept] = useState<DepartmentOut | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await departmentsApi.list();
      setDepartments(data);
    } catch {
      toast.error("Failed to load departments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await departmentsApi.create({
        name: createName.trim(),
        description: createDesc.trim() || undefined,
      });
      toast.success(`Department "${createName.trim()}" created.`);
      setShowCreate(false);
      setCreateName("");
      setCreateDesc("");
      await loadDepartments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create department.");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (dept: DepartmentOut) => {
    setEditingDept(dept);
    setEditName(dept.name);
    setEditDesc(dept.description || "");
  };

  const handleSaveEdit = async () => {
    if (!editingDept || !editName.trim()) return;
    setSaving(true);
    try {
      await departmentsApi.update(editingDept.id, {
        name: editName.trim(),
        description: editDesc.trim(),
      });
      toast.success(`Department updated to "${editName.trim()}".`);
      setEditingDept(null);
      await loadDepartments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update department.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingDept) return;
    setDeleting(true);
    try {
      await departmentsApi.delete(deletingDept.id);
      toast.success(`Department "${deletingDept.name}" removed.`);
      setDeletingDept(null);
      await loadDepartments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete department.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 h-14">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Departments</h1>
          <Badge variant="secondary" className="text-xs">
            {departments.length}
          </Badge>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Department
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <Building2 className="h-8 w-8" />
            <p className="text-sm">No departments yet.</p>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create your first department
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept) => (
              <Card key={dept.id} className="hover:border-primary/30 transition-colors group">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold truncate">{dept.name}</h3>
                        {dept.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {dept.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-2">
                          <Badge variant="outline" className="text-[10px]">
                            <Users className="h-2.5 w-2.5 mr-0.5" />
                            {dept.agent_count} agent{dept.agent_count !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => openEdit(dept)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setDeletingDept(dept)}
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

      {/* Create Department Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Department</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Marketing, Engineering..."
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="What does this department do?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={creating || !createName.trim()}>
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Plus className="h-3.5 w-3.5 mr-1" />
              )}
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog open={!!editingDept} onOpenChange={(v) => !v && setEditingDept(null)}>
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
            <Button variant="outline" size="sm" onClick={() => setEditingDept(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={saving || !editName.trim()}>
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
      <AlertDialog open={!!deletingDept} onOpenChange={(v) => !v && setDeletingDept(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingDept && deletingDept.agent_count > 0 ? (
                <>
                  <strong>{deletingDept.name}</strong> has {deletingDept.agent_count} agent
                  {deletingDept.agent_count !== 1 ? "s" : ""} assigned. You must reassign them
                  before deleting this department.
                </>
              ) : (
                <>
                  Are you sure you want to delete <strong>{deletingDept?.name}</strong>?
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting || (deletingDept?.agent_count ?? 0) > 0}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
