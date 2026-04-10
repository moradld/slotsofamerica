import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  Users, Search, Loader2, Mail, Calendar, Wallet, Trash2,
  UserPlus, Shield, ShieldCheck, User, Hash, ChevronLeft, ChevronRight,
  Download, FileUp, Phone, CheckCircle2, XCircle, Flag, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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

interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  balance: number;
  created_at: string;
  phone: string | null;
  country: string | null;
  first_name: string | null;
  last_name: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  is_flagged: boolean;
  flagged_at: string | null;
  flagged_reason: string | null;
  role?: string;
}

const roleColors: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  manager: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  user: "bg-green-500/10 text-green-400 border-green-500/20",
};

const roleIcons: Record<string, typeof Shield> = {
  admin: ShieldCheck,
  manager: Shield,
  user: User,
};

const PAGE_SIZE = 10;

const AdminUsers = () => {
  const { role: currentRole, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [firstAdminId, setFirstAdminId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "manager" | "user">("all");
  const [flagFilter, setFlagFilter] = useState<"all" | "flagged" | "unflagged">("all");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createRole, setCreateRole] = useState<"admin" | "manager">("manager");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createUsername, setCreateUsername] = useState("");
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [changingRole, setChangingRole] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

  const fetchUsers = async () => {
    const [profilesRes, firstAdminRes] = await Promise.all([
      supabase.from("profiles")
        .select("id, username, display_name, email, balance, created_at, phone, country, first_name, last_name, email_verified, phone_verified, is_flagged, flagged_at, flagged_reason")
        .order("created_at", { ascending: false }),
      supabase.rpc("get_first_admin_id"),
    ]);

    if (firstAdminRes.data) {
      setFirstAdminId(firstAdminRes.data as string);
    }

    const allUsers = (profilesRes.data || []) as UserProfile[];

    if (allUsers.length > 0) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));
      allUsers.forEach((u) => {
        u.role = roleMap.get(u.id) || "user";
      });
    }

    setUsers(allUsers);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.trim().toLowerCase();
      const matchesSearch = !q ||
        (u.username || "").toLowerCase().includes(q) ||
        (u.display_name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q);
      const matchesRole = roleFilter === "all" || (u.role || "user") === roleFilter;
      const matchesFlag = flagFilter === "all" || (flagFilter === "flagged" ? u.is_flagged : !u.is_flagged);
      return matchesSearch && matchesRole && matchesFlag;
    });
  }, [users, search, roleFilter, flagFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length && paginated.every((u) => selectedIds.has(u.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map((u) => u.id)));
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    if (deleteUser.id === firstAdminId) {
      toast({ title: "Error", description: "The primary admin account cannot be deleted", variant: "destructive" });
      setDeleteUser(null);
      return;
    }
    setDeleting(true);
    const { error } = await supabase.rpc("admin_delete_user", { _user_id: deleteUser.id });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "User deleted successfully" });
      if (selectedUser?.id === deleteUser.id) setSelectedUser(null);
      fetchUsers();
    }
    setDeleting(false);
    setDeleteUser(null);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      let deleted = 0;
      for (const id of selectedIds) {
        // Skip admin users and first admin
        const user = users.find((u) => u.id === id);
        if (user?.role === "admin") continue;
        if (id === firstAdminId) continue;
        const { error } = await supabase.rpc("admin_delete_user", { _user_id: id });
        if (!error) deleted++;
      }
      toast({ title: "Users Deleted", description: `${deleted} user(s) removed.` });
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "admin" | "manager" | "user") => {
    if (userId === firstAdminId) {
      toast({ title: "Error", description: "Cannot change the primary admin's role", variant: "destructive" });
      return;
    }
    setChangingRole(true);
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Role updated to ${newRole}` });
      setSelectedUser((prev) => prev ? { ...prev, role: newRole } : null);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
    }
    setChangingRole(false);
  };

  const handleCreate = async () => {
    if (!createEmail || !createPassword || !createUsername) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    if (createPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setCreating(true);

    const { data, error: invokeError } = await supabase.functions.invoke("create-staff", {
      body: {
        email: createEmail,
        password: createPassword,
        username: createUsername,
        role: createRole,
      },
    });

    if (invokeError) {
      toast({ title: "Error", description: invokeError.message, variant: "destructive" });
      setCreating(false);
      return;
    }

    if (data?.error) {
      toast({ title: "Error", description: data.error, variant: "destructive" });
      setCreating(false);
      return;
    }

    toast({ title: `${createRole.charAt(0).toUpperCase() + createRole.slice(1)} account created!` });

    setCreating(false);
    setShowCreateModal(false);
    setCreateEmail("");
    setCreatePassword("");
    setCreateUsername("");
    setTimeout(() => fetchUsers(), 1000);
  };

  // Export users
  const handleExport = () => {
    setExporting(true);
    try {
      const exportData = users.map((u) => ({
        username: u.username,
        display_name: u.display_name,
        email: u.email,
        balance: u.balance,
        phone: u.phone,
        country: u.country,
        first_name: u.first_name,
        last_name: u.last_name,
        role: u.role,
        created_at: u.created_at,
      }));
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `users-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: `${exportData.length} user(s) exported.` });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-wide">Users</h1>
          <p className="text-muted-foreground mt-1">
            {users.length} registered user{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleExport} disabled={exporting || users.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
          </button>
          {currentRole === "admin" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-xl gradient-bg px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <UserPlus className="h-4 w-4" />
              Create Staff Account
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by username, name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-input bg-muted/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value as any); setPage(1); }}
          className="rounded-lg border border-input bg-muted/50 py-2.5 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors cursor-pointer">
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="user">User</option>
        </select>
        <select value={flagFilter} onChange={(e) => { setFlagFilter(e.target.value as any); setPage(1); }}
          className="rounded-lg border border-input bg-muted/50 py-2.5 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors cursor-pointer">
          <option value="all">All Status</option>
          <option value="flagged">🚩 Flagged</option>
          <option value="unflagged">Clean</option>
        </select>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && currentRole === "admin" && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 flex-wrap">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
          <button onClick={() => setBulkDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors">
            <Trash2 className="h-3.5 w-3.5" /> Delete Selected
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden glow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                {currentRole === "admin" && (
                  <th className="pl-4 pr-1 py-3 w-10">
                    <input type="checkbox"
                      checked={paginated.length > 0 && paginated.every((u) => selectedIds.has(u.id))}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
                  </th>
                )}
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium text-right">Balance</th>
                <th className="px-6 py-3 font-medium text-right">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={currentRole === "admin" ? 6 : 5} className="px-6 py-12 text-center text-muted-foreground">
                    {search || roleFilter !== "all" ? "No users match your filters." : "No users found."}
                  </td>
                </tr>
              ) : (
                paginated.map((u) => {
                  const RoleIcon = roleIcons[u.role || "user"] || User;
                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedUser(u)}
                      className={`hover:bg-muted/20 transition-colors cursor-pointer ${selectedIds.has(u.id) ? "bg-primary/5" : ""}`}
                    >
                      {currentRole === "admin" && (
                        <td className="pl-4 pr-1 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)}
                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full gradient-bg text-xs font-bold text-primary-foreground uppercase relative">
                            {(u.username || u.display_name || "?")[0]}
                            {u.is_flagged && (
                              <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-destructive flex items-center justify-center">
                                <Flag className="h-2 w-2 text-destructive-foreground" />
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground flex items-center gap-1.5">
                              {u.display_name || u.username || "—"}
                              {u.is_flagged && <span className="text-[10px] font-semibold text-destructive bg-destructive/10 border border-destructive/20 rounded px-1">FLAGGED</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">@{u.username || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="text-xs">{u.email || "—"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${roleColors[u.role || "user"]}`}>
                          <RoleIcon className="h-3 w-3" />
                          {u.role || "user"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                          <Wallet className="h-3.5 w-3.5 text-primary" />
                          ${Number(u.balance).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span className="text-xs">{new Date(u.created_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}{"\u2013"}{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1]) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === "..." ? (
                    <span key={`e${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
                        page === p
                          ? "gradient-bg text-primary-foreground shadow"
                          : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="sm:max-w-md border-border bg-card">
          {selectedUser && (() => {
            const RoleIcon = roleIcons[selectedUser.role || "user"] || User;
            return (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full gradient-bg text-lg font-bold text-primary-foreground uppercase">
                      {(selectedUser.username || selectedUser.display_name || "?")[0]}
                    </div>
                    <div>
                      <span>{selectedUser.display_name || selectedUser.username || "Unknown"}</span>
                      <p className="text-xs text-muted-foreground font-normal mt-0.5">@{selectedUser.username || "—"}</p>
                    </div>
                  </DialogTitle>
                </DialogHeader>

                <div className="mt-5 space-y-4">
                  {/* Balance */}
                  <div className="rounded-xl border border-border bg-muted/20 p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Balance</p>
                    <p className="text-3xl font-display font-bold">${Number(selectedUser.balance).toFixed(2)}</p>
                  </div>

                  {/* Info rows */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Shield className="h-3 w-3" />Role</span>
                      {currentRole === "admin" && selectedUser.id !== firstAdminId ? (
                        <div className="flex items-center gap-1.5">
                          {changingRole && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                          <select
                            value={selectedUser.role || "user"}
                            onChange={(e) => handleRoleChange(selectedUser.id, e.target.value as "admin" | "manager" | "user")}
                            disabled={changingRole}
                            className="rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs font-semibold capitalize text-foreground outline-none focus:border-primary transition-colors disabled:opacity-50"
                          >
                            <option value="user">User</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${roleColors[selectedUser.role || "user"]}`}>
                          <RoleIcon className="h-3 w-3" />
                          {selectedUser.role || "user"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" />Email</span>
                      <span className="text-sm font-medium">{selectedUser.email || "—"}</span>
                    </div>

                    {selectedUser.first_name && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5"><User className="h-3 w-3" />Name</span>
                        <span className="text-sm font-medium">{selectedUser.first_name} {selectedUser.last_name || ""}</span>
                      </div>
                    )}

                    {selectedUser.phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Hash className="h-3 w-3" />Phone</span>
                        <span className="text-sm font-medium">{selectedUser.phone}</span>
                      </div>
                    )}

                    {selectedUser.country && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Hash className="h-3 w-3" />Country</span>
                        <span className="text-sm font-medium">{selectedUser.country}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3" />Joined</span>
                      <span className="text-sm font-medium">
                        {new Date(selectedUser.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </span>
                    </div>

                    {/* Verification Status */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" />Email Verified</span>
                      <div className="flex items-center gap-2">
                        {selectedUser.email_verified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-400"><CheckCircle2 className="h-3.5 w-3.5" /> Verified</span>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><XCircle className="h-3.5 w-3.5" /> Not verified</span>
                            {currentRole === "admin" && (
                              <button
                                onClick={async () => {
                                  const { error } = await supabase.rpc("admin_verify_user", { _user_id: selectedUser.id, _type: "email" });
                                  if (error) {
                                    toast({ title: "Error", description: error.message, variant: "destructive" });
                                    return;
                                  }
                                  setSelectedUser({ ...selectedUser, email_verified: true });
                                  setUsers((prev) => prev.map((u) => u.id === selectedUser.id ? { ...u, email_verified: true } : u));
                                  toast({ title: "Email marked as verified" });
                                }}
                                className="rounded-lg bg-green-500/10 border border-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-colors"
                              >
                                Verify
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" />Phone Verified</span>
                      <div className="flex items-center gap-2">
                        {selectedUser.phone_verified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-400"><CheckCircle2 className="h-3.5 w-3.5" /> Verified</span>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><XCircle className="h-3.5 w-3.5" /> Not verified</span>
                            {currentRole === "admin" && (
                              <button
                                onClick={async () => {
                                  const { error } = await supabase.rpc("admin_verify_user", { _user_id: selectedUser.id, _type: "phone" });
                                  if (error) {
                                    toast({ title: "Error", description: error.message, variant: "destructive" });
                                    return;
                                  }
                                  setSelectedUser({ ...selectedUser, phone_verified: true });
                                  setUsers((prev) => prev.map((u) => u.id === selectedUser.id ? { ...u, phone_verified: true } : u));
                                  toast({ title: "Phone marked as verified" });
                                }}
                                className="rounded-lg bg-green-500/10 border border-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-colors"
                              >
                                Verify
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Hash className="h-3 w-3" />User ID</span>
                      <span className="text-xs font-mono text-muted-foreground">{selectedUser.id.slice(0, 12)}…</span>
                    </div>
                  </div>

                  {/* Flag/Unflag toggle (admin only) */}
                  {currentRole === "admin" && selectedUser.role !== "admin" && (
                    <button
                      onClick={async () => {
                        const newFlagged = !selectedUser.is_flagged;
                        const updateData: any = {
                          is_flagged: newFlagged,
                          flagged_at: newFlagged ? new Date().toISOString() : null,
                          flagged_reason: newFlagged ? "Manually flagged by admin" : null,
                        };
                        const { error } = await supabase.from("profiles").update(updateData).eq("id", selectedUser.id);
                        if (error) {
                          toast({ title: "Error", description: error.message, variant: "destructive" });
                        } else {
                          toast({ title: newFlagged ? "Account flagged" : "Account unflagged" });
                          setSelectedUser({ ...selectedUser, is_flagged: newFlagged, flagged_at: updateData.flagged_at, flagged_reason: updateData.flagged_reason });
                          setUsers((prev) => prev.map((u) => u.id === selectedUser.id ? { ...u, is_flagged: newFlagged } : u));

                          // Log audit
                          await supabase.from("audit_logs").insert({
                            admin_id: (await supabase.auth.getUser()).data.user?.id || "",
                            action: newFlagged ? "flagged_user" : "unflagged_user",
                            target_type: "user",
                            target_id: selectedUser.id,
                            details: { reason: updateData.flagged_reason },
                          });
                        }
                      }}
                      className={`w-full flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                        selectedUser.is_flagged
                          ? "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
                          : "bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20"
                      }`}
                    >
                      {selectedUser.is_flagged ? (
                        <><AlertTriangle className="h-4 w-4" /> Unflag Account</>
                      ) : (
                        <><Flag className="h-4 w-4" /> Flag Account</>
                      )}
                    </button>
                  )}

                  {/* Flagged info */}
                  {selectedUser.is_flagged && selectedUser.flagged_reason && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                      <p className="text-xs text-destructive font-medium flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3" /> Flagged
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{selectedUser.flagged_reason}</p>
                      {selectedUser.flagged_at && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(selectedUser.flagged_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Deactivate manager button (admin only, manager role only) */}
                  {currentRole === "admin" && selectedUser.role === "manager" && (
                    <button
                      onClick={async () => {
                        setChangingRole(true);
                        const { error } = await supabase
                          .from("user_roles")
                          .update({ role: "user" })
                          .eq("user_id", selectedUser.id);
                        if (error) {
                          toast({ title: "Error", description: error.message, variant: "destructive" });
                        } else {
                          toast({ title: "Manager deactivated", description: `${selectedUser.display_name || selectedUser.username} is now a regular user.` });
                          setSelectedUser({ ...selectedUser, role: "user" });
                          setUsers((prev) => prev.map((u) => u.id === selectedUser.id ? { ...u, role: "user" } : u));
                        }
                        setChangingRole(false);
                      }}
                      disabled={changingRole}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                    >
                      {changingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                      Deactivate Manager
                    </button>
                  )}

                  {/* Delete button (admin only) */}
                  {currentRole === "admin" && selectedUser.id !== firstAdminId && (
                    <button
                      onClick={() => { setSelectedUser(null); setDeleteUser(selectedUser); }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete User
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">{deleteUser?.display_name || deleteUser?.username}</span>? This will permanently remove their account, transactions, and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteConfirm} onOpenChange={(v) => !v && setBulkDeleteConfirm(false)}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display tracking-wider">Delete {selectedIds.size} User(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedIds.size}</strong> selected user(s)? Admin accounts will be skipped. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border" disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete {selectedIds.size} User(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Staff Account Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Create Staff Account
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Role Selection */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-2">Role</label>
              <div className="flex gap-2">
                {(["admin", "manager"] as const).map((r) => {
                  const Icon = roleIcons[r];
                  return (
                    <button
                      key={r}
                      onClick={() => setCreateRole(r)}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold capitalize transition-all ${
                        createRole === r
                          ? `${roleColors[r]} border-current`
                          : "border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {r}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {createRole === "manager"
                  ? "Managers can only handle transaction requests and password requests."
                  : "Admins have full access to all features."}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Username</label>
              <input
                type="text"
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
                placeholder="johndoe"
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Email</label>
              <input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Password</label>
              <input
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full rounded-xl gradient-bg py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {creating ? "Creating..." : `Create ${createRole.charAt(0).toUpperCase() + createRole.slice(1)} Account`}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
