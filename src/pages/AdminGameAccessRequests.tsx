import { useState, useEffect, useCallback } from "react";
import { Loader2, Search, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Copy, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface GameAccessRequest {
  id: string;
  user_id: string;
  game_id: string;
  username: string;
  email: string;
  status: string;
  admin_note: string | null;
  game_password: string | null;
  created_at: string;
  approved_at: string | null;
  game_name?: string;
  game_image?: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  approved: "bg-green-500/10 text-green-400 border-green-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const PAGE_SIZE = 15;

const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast({ title: "Copied!", description: `${label} copied to clipboard.` });
};

const CopyCell = ({ value, label }: { value: string; label: string }) => (
  <div className="flex items-center gap-1.5 group">
    <span className="truncate max-w-[160px]">{value}</span>
    <button
      onClick={() => copyToClipboard(value, label)}
      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted/50"
      title={`Copy ${label}`}
    >
      <Copy className="h-3 w-3 text-muted-foreground" />
    </button>
  </div>
);

const AdminGameAccessRequests = () => {
  const [requests, setRequests] = useState<GameAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [page, setPage] = useState(1);

  const [actionModal, setActionModal] = useState<{ request: GameAccessRequest; action: "approved" | "rejected" } | null>(null);
  const [editModal, setEditModal] = useState<GameAccessRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [gamePassword, setGamePassword] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editNote, setEditNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchRequests = useCallback(async () => {
    let query = supabase
      .from("game_unlock_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const gameIds = [...new Set((data || []).map(r => r.game_id))];
    const userIds = [...new Set((data || []).map(r => r.user_id))];
    let gameMap = new Map<string, { name: string; image_url: string | null }>();
    let profileMap = new Map<string, { username: string; email: string }>();

    if (gameIds.length > 0) {
      const { data: gamesData } = await supabase.from("games").select("id, name, image_url").in("id", gameIds);
      gameMap = new Map((gamesData || []).map(g => [g.id, { name: g.name, image_url: g.image_url }]));
    }
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase.from("profiles").select("id, username, display_name, email").in("id", userIds);
      profileMap = new Map((profilesData || []).map(p => [p.id, {
        username: p.display_name || p.username || p.email?.split("@")[0] || "unknown",
        email: p.email || "unknown",
      }]));
    }

    const enriched: GameAccessRequest[] = (data || []).map(r => {
      const profile = profileMap.get(r.user_id);
      const game = gameMap.get(r.game_id);
      return {
        ...r,
        username: profile?.username || r.username || "unknown",
        email: profile?.email || r.email || "unknown",
        game_name: game?.name || "Unknown Game",
        game_image: game?.image_url || null,
        game_password: r.game_password || null,
      };
    });

    setRequests(enriched);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const filtered = requests.filter(r =>
    r.username.toLowerCase().includes(search.toLowerCase()) ||
    r.email.toLowerCase().includes(search.toLowerCase()) ||
    (r.game_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleAction = async () => {
    if (!actionModal) return;
    if (actionModal.action === "rejected" && !adminNote.trim()) {
      toast({ title: "Note required", description: "Please provide a reason for rejection.", variant: "destructive" });
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase.rpc("process_game_access_request", {
        _request_id: actionModal.request.id,
        _action: actionModal.action,
        _note: adminNote.trim() || null,
        _game_password: actionModal.action === "approved" && gamePassword.trim() ? gamePassword.trim() : null,
      });
      if (error) throw error;
      toast({ title: actionModal.action === "approved" ? "Request Approved" : "Request Rejected" });
      setActionModal(null);
      setAdminNote("");
      setGamePassword("");
      fetchRequests();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleEdit = async () => {
    if (!editModal) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("game_unlock_requests")
        .update({
          game_password: editPassword.trim() || null,
          admin_note: editNote.trim() || null,
        })
        .eq("id", editModal.id);
      if (error) throw error;
      toast({ title: "Updated", description: "Request details updated." });
      setEditModal(null);
      fetchRequests();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-wide">Game Access Requests</h1>
          <p className="text-muted-foreground mt-1">
            Review and manage user game access requests
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-400">
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by username, email, or game..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-input bg-muted/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {["pending", "approved", "rejected", ""].map(s => (
            <button
              key={s || "all"}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                statusFilter === s
                  ? "gradient-bg text-primary-foreground"
                  : "border border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden glow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Username</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Password</th>
                <th className="px-4 py-3 font-medium">Game</th>
                <th className="px-4 py-3 font-medium">Requested</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No requests found.
                  </td>
                </tr>
              ) : (
                paginated.map((req) => (
                  <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-foreground">
                      <CopyCell value={req.username} label="Username" />
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      <CopyCell value={req.email} label="Email" />
                    </td>
                    <td className="px-4 py-3.5">
                      {req.game_password ? (
                        <CopyCell value={req.game_password} label="Password" />
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {req.game_image ? (
                          <img src={req.game_image} alt={req.game_name} className="h-7 w-7 rounded-md object-cover shrink-0" />
                        ) : (
                          <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-muted-foreground">{(req.game_name || "?")[0]}</span>
                          </div>
                        )}
                        <span className="text-foreground font-medium">{req.game_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(req.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize ${STATUS_BADGE[req.status] || ""}`}>
                        {req.status === "pending" && <Clock className="h-2.5 w-2.5" />}
                        {req.status === "approved" && <CheckCircle className="h-2.5 w-2.5" />}
                        {req.status === "rejected" && <XCircle className="h-2.5 w-2.5" />}
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {req.status === "pending" && (
                          <>
                            <button
                              onClick={() => { setActionModal({ request: req, action: "approved" }); setAdminNote(""); setGamePassword(""); }}
                              className="rounded-lg bg-green-500/10 border border-green-500/20 px-2.5 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => { setActionModal({ request: req, action: "rejected" }); setAdminNote(""); }}
                              className="rounded-lg bg-destructive/10 border border-destructive/20 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setEditModal(req);
                            setEditPassword(req.game_password || "");
                            setEditNote(req.admin_note || "");
                          }}
                          className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages} ({filtered.length} total)
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted/50 disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted/50 disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Approve/Reject Modal */}
      <Dialog open={!!actionModal} onOpenChange={() => setActionModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionModal?.action === "approved" ? "Approve" : "Reject"} Game Access
            </DialogTitle>
            <DialogDescription>
              {actionModal?.action === "approved"
                ? `Confirm access for ${actionModal?.request.username} (${actionModal?.request.email}) on ${actionModal?.request.game_name}.`
                : `Provide a reason for rejecting ${actionModal?.request.username}'s request.`}
            </DialogDescription>
          </DialogHeader>

          {actionModal && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User:</span>
                  <span className="font-medium text-foreground">{actionModal.request.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium text-foreground">{actionModal.request.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Game:</span>
                  <span className="font-medium text-foreground">{actionModal.request.game_name}</span>
                </div>
              </div>

              {actionModal.action === "approved" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Game Password (optional)
                  </label>
                  <input
                    type="text"
                    value={gamePassword}
                    onChange={(e) => setGamePassword(e.target.value)}
                    placeholder="Enter the game account password..."
                    className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">This password will be visible to the user on their game card.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {actionModal.action === "rejected" ? "Rejection Reason *" : "Note (optional)"}
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder={actionModal.action === "rejected" ? "Provide a reason..." : "Optional note..."}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setActionModal(null)} disabled={processing}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAction}
                  disabled={processing}
                  className={actionModal.action === "approved"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"}
                >
                  {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {actionModal.action === "approved" ? "Confirm Approval" : "Reject Request"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Request</DialogTitle>
            <DialogDescription>
              Update password or note for {editModal?.username}'s request on {editModal?.game_name}.
            </DialogDescription>
          </DialogHeader>

          {editModal && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User:</span>
                  <span className="font-medium text-foreground">{editModal.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium text-foreground">{editModal.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_BADGE[editModal.status] || ""}`}>
                    {editModal.status}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Game Password</label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Enter or update password..."
                  className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Admin Note</label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Add or update note..."
                  rows={3}
                  className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setEditModal(null)} disabled={processing}>
                  Cancel
                </Button>
                <Button onClick={handleEdit} disabled={processing}>
                  {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminGameAccessRequests;