import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle, XCircle, Loader2, ArrowLeftRight,
  Clock, Hash, Calendar, FileText, User, DollarSign,
  ArrowDownToLine, ArrowUpFromLine, Gift,
  ChevronLeft, ChevronRight, Search, Undo2, Pencil, Copy,
  ShieldCheck, History, Download, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  notes: string | null;
  user_id: string;
  game_id: string | null;
  deposit_proof_url: string | null;
  username?: string;
  email?: string;
  game_name?: string;
  game_image?: string | null;
  game_username?: string;
  reviewer_name?: string;
}

interface TransactionLog {
  id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  old_amount: number | null;
  new_amount: number | null;
  action_by: string;
  action_at: string;
  note: string | null;
  actor_name?: string;
}

const statusConfig: Record<string, { bg: string; icon: typeof Clock }> = {
  pending: { bg: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: Clock },
  completed: { bg: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle },
  approved: { bg: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle },
  rejected: { bg: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
};

const typeConfig: Record<string, { bg: string; icon: typeof DollarSign; label: string }> = {
  deposit: { bg: "bg-green-500/10 text-green-400", icon: ArrowDownToLine, label: "Deposit" },
  withdraw: { bg: "bg-orange-500/10 text-orange-400", icon: ArrowUpFromLine, label: "Withdraw" },
  redeem: { bg: "bg-purple-500/10 text-purple-400", icon: Gift, label: "Redeem" },
  transfer: { bg: "bg-blue-500/10 text-blue-400", icon: ArrowLeftRight, label: "Transfer" },
};

const TYPE_TABS = ["deposit", "transfer", "redeem", "withdraw"] as const;
const STATUS_TABS = ["pending", "completed", "rejected"] as const;
const PAGE_SIZE = 15;

const copyText = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast({ title: "Copied", description: `${label} copied.` });
};

const AdminTransactions = () => {
  const [searchParams] = useSearchParams();
  const initialType = TYPE_TABS.includes(searchParams.get("type") as any) ? searchParams.get("type")! : "deposit";
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeTab, setTypeTab] = useState<string>(initialType);
  const [statusTab, setStatusTab] = useState<string>("pending");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Modals
  const [detailTxn, setDetailTxn] = useState<Transaction | null>(null);
  const [proofModal, setProofModal] = useState<string | null>(null);
  const [undoModal, setUndoModal] = useState<Transaction | null>(null);
  const [editModal, setEditModal] = useState<Transaction | null>(null);
  const [rejectModal, setRejectModal] = useState<Transaction | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [undoReason, setUndoReason] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editReason, setEditReason] = useState("");
  const [logsModal, setLogsModal] = useState<Transaction | null>(null);
  const [logs, setLogs] = useState<TransactionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionConfirm, setBulkActionConfirm] = useState<"approve" | "reject" | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});

  const fetchPendingCounts = useCallback(async () => {
    const counts: Record<string, number> = {};
    const promises = TYPE_TABS.map(async (t) => {
      const { count, error } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("type", t)
        .eq("status", "pending");
      counts[t] = error ? 0 : (count || 0);
    });
    await Promise.all(promises);
    setPendingCounts(counts);
  }, []);

  useEffect(() => {
    fetchPendingCounts();
  }, [fetchPendingCounts]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("id, type, amount, status, created_at, reviewed_at, reviewed_by, notes, user_id, game_id, deposit_proof_url, games(name, image_url)")
      .eq("type", typeTab)
      .eq("status", statusTab)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const txns = (data || []) as any[];
    const userIds = [...new Set(txns.map(t => t.user_id))];
    const reviewerIds = [...new Set(txns.map(t => t.reviewed_by).filter(Boolean))];
    const allIds = [...new Set([...userIds, ...reviewerIds])];

    let profileMap = new Map<string, { username: string; email: string }>();
    if (allIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, email")
        .in("id", allIds);
      profileMap = new Map((profiles || []).map(p => [p.id, {
        username: p.display_name || p.username || p.email?.split("@")[0] || "Unknown",
        email: p.email || "",
      }]));
    }

    // Fetch game usernames from game_unlock_requests for non-deposit types
    let gameUsernameMap = new Map<string, string>();
    if (typeTab === "redeem" || typeTab === "transfer") {
      const gameUserIds = [...new Set(txns.filter(t => t.game_id).map(t => t.user_id))];
      const gameIds = [...new Set(txns.filter(t => t.game_id).map(t => t.game_id))];
      if (gameUserIds.length > 0 && gameIds.length > 0) {
        const { data: gur } = await supabase
          .from("game_unlock_requests")
          .select("user_id, game_id, username")
          .in("user_id", gameUserIds)
          .in("game_id", gameIds)
          .eq("status", "approved");
        (gur || []).forEach(r => {
          gameUsernameMap.set(`${r.user_id}_${r.game_id}`, r.username);
        });
      }
    }

    const enriched: Transaction[] = txns.map(t => ({
      ...t,
      username: profileMap.get(t.user_id)?.username || "Unknown",
      email: profileMap.get(t.user_id)?.email || "",
      game_name: t.games?.name || "—",
      game_image: t.games?.image_url || null,
      game_username: t.game_id ? gameUsernameMap.get(`${t.user_id}_${t.game_id}`) || "" : "",
      reviewer_name: t.reviewed_by ? profileMap.get(t.reviewed_by)?.username || "Admin" : null,
    }));

    setTransactions(enriched);
    setLoading(false);
  }, [typeTab, statusTab]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
    fetchTransactions();

    const channel = supabase
      .channel('admin-txns-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => { fetchTransactions(); fetchPendingCounts(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchTransactions]);

  const searched = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.trim().toLowerCase();
    return transactions.filter(t =>
      (t.username || "").toLowerCase().includes(q) ||
      (t.email || "").toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      (t.game_name || "").toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const totalPages = Math.max(1, Math.ceil(searched.length / PAGE_SIZE));
  const paginated = searched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Bulk helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (paginated.length > 0 && paginated.every((t) => selectedIds.has(t.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map((t) => t.id)));
    }
  };

  // Actions
  const handleAction = async (txnId: string, action: "approved" | "rejected") => {
    setProcessingId(txnId);
    const { error } = await supabase.rpc("process_transaction", {
      _transaction_id: txnId,
      _action: action,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: action === "approved" ? "Transaction Completed" : "Transaction Rejected" });
      if (detailTxn?.id === txnId) setDetailTxn(null);
      fetchTransactions();
    }
    setProcessingId(null);
  };

  const handleBulkAction = async () => {
    if (selectedIds.size === 0 || !bulkActionConfirm) return;
    setBulkProcessing(true);
    const action = bulkActionConfirm === "approve" ? "approved" : "rejected";
    let success = 0;
    let failed = 0;
    for (const id of selectedIds) {
      const { error } = await supabase.rpc("process_transaction", {
        _transaction_id: id,
        _action: action,
      });
      if (error) failed++;
      else success++;
    }
    toast({
      title: `Bulk ${bulkActionConfirm === "approve" ? "Approval" : "Rejection"} Complete`,
      description: `${success} processed${failed > 0 ? `, ${failed} failed` : ""}.`,
    });
    setSelectedIds(new Set());
    setBulkActionConfirm(null);
    setBulkProcessing(false);
    fetchTransactions();
  };

  const handleUndo = async () => {
    if (!undoModal) return;
    setProcessingId(undoModal.id);
    const { error } = await supabase.rpc("undo_transaction", {
      _transaction_id: undoModal.id,
      _reason: undoReason.trim() || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Transaction Undone", description: "Status reverted to pending." });
      setUndoModal(null);
      setUndoReason("");
      fetchTransactions();
    }
    setProcessingId(null);
  };

  const handleEditAmount = async () => {
    if (!editModal) return;
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setProcessingId(editModal.id);
    const { error } = await supabase.rpc("edit_transaction_amount", {
      _transaction_id: editModal.id,
      _new_amount: amt,
      _reason: editReason.trim() || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Amount Updated" });
      setEditModal(null);
      setEditAmount("");
      setEditReason("");
      fetchTransactions();
    }
    setProcessingId(null);
  };

  const fetchLogs = async (txn: Transaction) => {
    setLogsModal(txn);
    setLogsLoading(true);
    const { data } = await supabase
      .from("transaction_logs" as any)
      .select("*")
      .eq("transaction_id", txn.id)
      .order("action_at", { ascending: false });

    const logData = (data || []) as any[];
    const actorIds = [...new Set(logData.map(l => l.action_by).filter(Boolean))];
    let actorMap = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", actorIds);
      actorMap = new Map((profiles || []).map(p => [p.id, p.display_name || p.username || "Admin"]));
    }

    setLogs(logData.map(l => ({ ...l, actor_name: actorMap.get(l.action_by) || "System" })));
    setLogsLoading(false);
  };

  const handleExport = () => {
    setExporting(true);
    try {
      const data = transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        status: t.status,
        user: t.username,
        email: t.email,
        game: t.game_name,
        notes: t.notes,
        created_at: t.created_at,
        reviewed_at: t.reviewed_at,
        reviewed_by: t.reviewer_name,
      }));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-${typeTab}-${statusTab}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: `${data.length} transaction(s) exported.` });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const parseNotes = (notes: string | null) => {
    if (!notes) return [];
    return notes.split(" | ").map(s => {
      const idx = s.indexOf(": ");
      return idx > -1 ? { key: s.slice(0, idx), value: s.slice(idx + 2) } : { key: "Note", value: s };
    });
  };

  // Helper to extract tip from notes
  const getTip = (notes: string | null) => {
    const parsed = parseNotes(notes);
    const tipEntry = parsed.find(n => n.key === "Tip");
    return tipEntry?.value || null;
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-slide-in overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-wide">Transactions</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1">Enterprise transaction management</p>
        </div>
        <button onClick={handleExport} disabled={exporting || transactions.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 self-start sm:self-auto">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
        </button>
      </div>

      {/* Type Tabs - grid on mobile for equal sizing */}
      <div className="grid grid-cols-4 gap-1.5 sm:flex sm:gap-2">
        {TYPE_TABS.map(t => {
          const cfg = typeConfig[t];
          const Icon = cfg.icon;
          return (
            <button
              key={t}
              onClick={() => { setTypeTab(t); setPage(1); setSelectedIds(new Set()); }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 rounded-lg px-1 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-sm font-semibold transition-all relative ${
                typeTab === t
                  ? "gradient-bg text-primary-foreground shadow-md"
                  : "border border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{cfg.label}</span>
              {(pendingCounts[t] || 0) > 0 && (
                <span className="absolute -top-1 -right-1 sm:static sm:ml-1 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                  {pendingCounts[t]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Status Sub-tabs + Search */}
      <div className="flex flex-col gap-3">
        <div className="inline-flex rounded-lg bg-muted p-1">
          {STATUS_TABS.map(s => (
            <button
              key={s}
              onClick={() => { setStatusTab(s); setPage(1); setSelectedIds(new Set()); }}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-md px-3 sm:px-5 py-2 text-[11px] sm:text-xs font-semibold capitalize transition-all ${
                statusTab === s
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "pending" && <Clock className="h-3 w-3" />}
              {s === "completed" && <CheckCircle className="h-3 w-3" />}
              {s === "rejected" && <XCircle className="h-3 w-3" />}
              {s}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by user, email, ID, or game..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full sm:max-w-sm rounded-lg border border-input bg-muted/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 sm:gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 sm:px-4 py-2.5 flex-wrap">
          <span className="text-xs sm:text-sm font-medium text-foreground">{selectedIds.size} selected</span>
          {statusTab === "pending" && (
            <>
              <button onClick={() => setBulkActionConfirm("approve")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/10 border border-green-500/20 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-colors">
                <CheckCircle className="h-3.5 w-3.5" /> Approve
              </button>
              <button onClick={() => setBulkActionConfirm("reject")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors">
                <XCircle className="h-3.5 w-3.5" /> Reject
              </button>
            </>
          )}
          <button onClick={() => setSelectedIds(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">
            Clear
          </button>
        </div>
      )}

      {/* Content */}
      <div className="rounded-xl border border-border bg-card overflow-hidden glow-card">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : searched.length === 0 ? (
          <div className="text-center py-16">
            <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No {statusTab} {typeTab} transactions found.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table - hidden on mobile */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pl-3 pr-1 py-3 w-9">
                      <input type="checkbox"
                        checked={paginated.length > 0 && paginated.every((t) => selectedIds.has(t.id))}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
                    </th>
                    <th className="px-2 py-3 font-medium w-[90px]">Txn ID</th>
                    <th className="px-2 py-3 font-medium min-w-[120px]">User</th>
                    {(typeTab === "redeem" || typeTab === "transfer") && <th className="px-2 py-3 font-medium w-[100px]">Game</th>}
                    {(typeTab === "redeem" || typeTab === "transfer") && <th className="px-2 py-3 font-medium w-[130px]">Game Username</th>}
                    {(typeTab === "deposit" || typeTab === "withdraw") && <th className="px-2 py-3 font-medium w-[60px]">Proof</th>}
                    <th className="px-2 py-3 font-medium w-[80px]">Amount</th>
                    {typeTab === "withdraw" && <th className="px-2 py-3 font-medium w-[60px]">Tip</th>}
                    <th className="px-2 py-3 font-medium text-center w-[80px]">Status</th>
                    <th className="px-2 py-3 font-medium w-[120px]">Created</th>
                    <th className="px-2 py-3 font-medium w-[100px]">Processed</th>
                    <th className="px-2 py-3 font-medium text-right w-[150px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map(txn => {
                    const sc = statusConfig[txn.status] || statusConfig.pending;
                    return (
                      <tr key={txn.id} className={`hover:bg-muted/20 transition-colors ${selectedIds.has(txn.id) ? "bg-primary/5" : ""}`}>
                        <td className="pl-3 pr-1 py-2.5 w-9" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(txn.id)} onChange={() => toggleSelect(txn.id)}
                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
                        </td>
                        <td className="px-2 py-2.5">
                          <button
                            onClick={() => copyText(txn.id, "Transaction ID")}
                            className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors group"
                            title={txn.id}
                          >
                            {txn.id.slice(0, 8)}…
                            <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-xs truncate">{txn.username}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{txn.email}</p>
                          </div>
                        </td>
                        {(typeTab === "redeem" || typeTab === "transfer") && (
                          <td className="px-2 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {txn.game_image ? (
                                <img src={txn.game_image} alt="" className="h-5 w-5 rounded object-cover shrink-0" />
                              ) : null}
                              <span className="text-foreground text-xs truncate">{txn.game_name}</span>
                            </div>
                          </td>
                        )}
                        {(typeTab === "redeem" || typeTab === "transfer") && (
                          <td className="px-2 py-2.5">
                            {txn.game_username ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); copyText(txn.game_username!, "Game Username"); }}
                                className="flex items-center gap-1 text-xs font-mono text-foreground hover:text-primary transition-colors group truncate"
                                title={`Click to copy: ${txn.game_username}`}
                              >
                                <span className="truncate">{txn.game_username}</span>
                                <Copy className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity shrink-0" />
                              </button>
                            ) : (
                              <span className="text-muted-foreground/50 text-xs">—</span>
                            )}
                          </td>
                        )}
                        {(typeTab === "deposit" || typeTab === "withdraw") && (
                          <td className="px-2 py-2.5">
                            {txn.deposit_proof_url ? (
                              <button
                                onClick={() => setProofModal(txn.deposit_proof_url)}
                                className="group relative"
                                title="View deposit proof"
                              >
                                <img
                                  src={txn.deposit_proof_url}
                                  alt="Proof"
                                  className="h-8 w-8 rounded object-cover border border-border group-hover:border-primary transition-colors"
                                />
                              </button>
                            ) : (
                              <span className="text-muted-foreground/50 text-xs">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-2 py-2.5 font-bold text-foreground text-xs">${Number(txn.amount).toFixed(2)}</td>
                        {typeTab === "withdraw" && (
                          <td className="px-2 py-2.5 text-xs">
                            {(() => {
                              const tipVal = getTip(txn.notes);
                              return tipVal ? (
                                <span className="font-semibold text-green-400">{tipVal}</span>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              );
                            })()}
                          </td>
                        )}
                        <td className="px-2 py-2.5 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${sc.bg}`}>
                            {(() => { const I = sc.icon; return <I className="h-2.5 w-2.5" />; })()}
                            {txn.status}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                          {new Date(txn.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-2 py-2.5 text-xs">
                          {txn.reviewed_at ? (
                            <div>
                              <p className="text-muted-foreground whitespace-nowrap">{new Date(txn.reviewed_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                              {txn.reviewer_name && <p className="text-[10px] text-muted-foreground/70 truncate">by {txn.reviewer_name}</p>}
                            </div>
                          ) : <span className="text-muted-foreground/50">—</span>}
                        </td>
                        <td className="px-2 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {txn.status === "pending" && (
                              <>
                                <button
                                  onClick={() => handleAction(txn.id, "approved")}
                                  disabled={!!processingId}
                                  className="rounded-lg bg-green-500/10 border border-green-500/20 px-2.5 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                                >
                                  {processingId === txn.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Accept"}
                                </button>
                                <button
                                  onClick={() => { setRejectModal(txn); setRejectNote(""); }}
                                  disabled={!!processingId}
                                  className="rounded-lg bg-destructive/10 border border-destructive/20 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {(txn.status === "completed" || txn.status === "rejected") && (
                              <button
                                onClick={() => { setUndoModal(txn); setUndoReason(""); }}
                                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                                title="Undo"
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {(txn.status === "pending" || txn.status === "completed") && txn.type !== "withdraw" && (
                              <button
                                onClick={() => { setEditModal(txn); setEditAmount(String(txn.amount)); setEditReason(""); }}
                                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                                title="Edit Amount"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => fetchLogs(txn)}
                              className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                              title="View Logs"
                            >
                              <History className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards - shown only on mobile */}
            <div className="md:hidden">
              {/* Select all bar */}
              <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border bg-muted/20">
                <input type="checkbox"
                  checked={paginated.length > 0 && paginated.every((t) => selectedIds.has(t.id))}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
                <span className="text-xs text-muted-foreground font-medium">Select all</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{searched.length} result{searched.length !== 1 ? "s" : ""}</span>
              </div>

              <div className="p-2 space-y-2">
                {paginated.map(txn => {
                  const sc = statusConfig[txn.status] || statusConfig.pending;
                  const tipVal = typeTab === "withdraw" ? getTip(txn.notes) : null;
                  const tc = typeConfig[txn.type] || typeConfig.deposit;
                  return (
                    <div
                      key={txn.id}
                      className={`rounded-xl border transition-all ${
                        selectedIds.has(txn.id)
                          ? "border-primary/40 bg-primary/5 shadow-sm shadow-primary/10"
                          : "border-border bg-card hover:border-border/80"
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(txn.id)}
                          onChange={() => toggleSelect(txn.id)}
                          className="h-4 w-4 rounded border-border accent-primary cursor-pointer shrink-0"
                        />
                        <div className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${tc.bg}`}>
                          {(() => { const I = tc.icon; return <I className="h-4 w-4" />; })()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-[13px] leading-tight truncate">{txn.username}</p>
                          <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">{txn.email}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize shrink-0 ${sc.bg}`}>
                          {(() => { const I = sc.icon; return <I className="h-2.5 w-2.5" />; })()}
                          {txn.status}
                        </span>
                      </div>

                      {/* Amount highlight strip */}
                      <div className="mx-3 rounded-lg bg-muted/40 px-3 py-2 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Amount</p>
                          <p className="text-lg font-bold text-foreground leading-tight">${Number(txn.amount).toFixed(2)}</p>
                        </div>
                        {typeTab === "withdraw" && (
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tip</p>
                            <p className={`text-sm font-bold leading-tight ${tipVal ? "text-green-400" : "text-muted-foreground/40"}`}>
                              {tipVal || "—"}
                            </p>
                          </div>
                        )}
                        {(typeTab === "deposit" || (typeTab !== "withdraw" && typeTab !== "redeem" && typeTab !== "transfer")) && txn.deposit_proof_url && (
                          <button onClick={() => setProofModal(txn.deposit_proof_url)} className="group">
                            <img src={txn.deposit_proof_url} alt="Proof" className="h-10 w-10 rounded-lg object-cover border-2 border-border group-hover:border-primary transition-colors" />
                          </button>
                        )}
                      </div>

                      {/* Details grid */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 pt-2.5 pb-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Hash className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                          <button
                            onClick={() => copyText(txn.id, "Transaction ID")}
                            className="flex items-center gap-1 font-mono text-muted-foreground hover:text-foreground transition-colors truncate"
                          >
                            {txn.id.slice(0, 8)}… <Copy className="h-2.5 w-2.5 shrink-0 opacity-60" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                          <span className="text-muted-foreground truncate">
                            {new Date(txn.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {(typeTab === "redeem" || typeTab === "transfer") && txn.game_name !== "—" && (
                          <div className="flex items-center gap-1.5">
                            {txn.game_image ? (
                              <img src={txn.game_image} alt="" className="h-3.5 w-3.5 rounded object-cover shrink-0" />
                            ) : (
                              <Gift className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                            )}
                            <span className="text-foreground truncate">{txn.game_name}</span>
                          </div>
                        )}
                        {(typeTab === "redeem" || typeTab === "transfer") && txn.game_username && (
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                            <button
                              onClick={() => copyText(txn.game_username!, "Game Username")}
                              className="flex items-center gap-1 font-mono text-foreground hover:text-primary transition-colors truncate"
                            >
                              <span className="truncate">{txn.game_username}</span>
                              <Copy className="h-2.5 w-2.5 shrink-0 opacity-60" />
                            </button>
                          </div>
                        )}
                        {typeTab === "withdraw" && txn.deposit_proof_url && (
                          <div className="flex items-center gap-1.5 col-span-2">
                            <FileText className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                            <button onClick={() => setProofModal(txn.deposit_proof_url)} className="text-primary text-xs hover:underline">
                              View QR Code
                            </button>
                          </div>
                        )}
                        {txn.reviewed_at && (
                          <div className="flex items-center gap-1.5 col-span-2 text-muted-foreground">
                            <ShieldCheck className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                            <span className="truncate">
                              {new Date(txn.reviewed_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              {txn.reviewer_name && <span className="text-muted-foreground/60"> · {txn.reviewer_name}</span>}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions footer */}
                      <div className="flex items-center gap-1.5 px-3 pb-3 pt-1 border-t border-border/50 mt-1">
                        {txn.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleAction(txn.id, "approved")}
                              disabled={!!processingId}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-500/15 border border-green-500/25 px-3 py-2 text-xs font-bold text-green-400 hover:bg-green-500/25 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                              {processingId === txn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle className="h-3.5 w-3.5" /> Accept</>}
                            </button>
                            <button
                              onClick={() => { setRejectModal(txn); setRejectNote(""); }}
                              disabled={!!processingId}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/25 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/20 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                          </>
                        )}
                        {(txn.status === "completed" || txn.status === "rejected") && (
                          <button
                            onClick={() => { setUndoModal(txn); setUndoReason(""); }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                          >
                            <Undo2 className="h-3 w-3" /> Undo
                          </button>
                        )}
                        {(txn.status === "pending" || txn.status === "completed") && txn.type !== "withdraw" && (
                          <button
                            onClick={() => { setEditModal(txn); setEditAmount(String(txn.amount)); setEditReason(""); }}
                            className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                            title="Edit Amount"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => fetchLogs(txn)}
                          className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors ml-auto"
                          title="View Logs"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 sm:px-6 py-3">
                <span className="text-xs text-muted-foreground">
                  Page {page}/{totalPages} ({searched.length})
                </span>
                <div className="flex gap-1">
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
          </>
        )}
      </div>

      {/* Bulk Action Confirm */}
      <Dialog open={bulkActionConfirm !== null} onOpenChange={(v) => !v && setBulkActionConfirm(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm border-border bg-card">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">
              {bulkActionConfirm === "approve" ? "Approve" : "Reject"} {selectedIds.size} Transaction(s)
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to {bulkActionConfirm === "approve" ? "approve" : "reject"} <strong>{selectedIds.size}</strong> selected transaction(s)?
              {bulkActionConfirm === "approve" && " User wallets will be adjusted accordingly."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setBulkActionConfirm(null)} disabled={bulkProcessing}>Cancel</Button>
            <Button
              variant={bulkActionConfirm === "reject" ? "destructive" : "default"}
              onClick={handleBulkAction}
              disabled={bulkProcessing}
            >
              {bulkProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {bulkActionConfirm === "approve" ? "Approve" : "Reject"} {selectedIds.size}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Undo Modal */}
      <Dialog open={!!undoModal} onOpenChange={() => setUndoModal(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-primary" />
              Undo Transaction
            </DialogTitle>
            <DialogDescription>
              Revert this {undoModal?.status} transaction back to pending. Wallet adjustments will be reversed.
            </DialogDescription>
          </DialogHeader>
          {undoModal && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User:</span>
                  <span className="font-medium text-foreground">{undoModal.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium text-foreground">${Number(undoModal.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Status:</span>
                  <span className="font-medium text-foreground capitalize">{undoModal.status}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Reason *</label>
                <textarea
                  value={undoReason}
                  onChange={e => setUndoReason(e.target.value)}
                  placeholder="Why is this being undone?"
                  rows={3}
                  className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setUndoModal(null)}>Cancel</Button>
                <Button onClick={handleUndo} disabled={!undoReason.trim() || !!processingId}>
                  {processingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Undo to Pending
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Amount Modal */}
      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Transaction Amount
            </DialogTitle>
            <DialogDescription>
              {editModal?.status === "completed"
                ? "This transaction is completed. Editing will recalculate the wallet difference."
                : "Update the pending transaction amount."}
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
                  <span className="text-muted-foreground">Current Amount:</span>
                  <span className="font-medium text-foreground">${Number(editModal.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium text-foreground capitalize">{editModal.status}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">New Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Reason</label>
                <textarea
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  placeholder="Reason for edit..."
                  rows={2}
                  className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {editModal.status === "completed" && parseFloat(editAmount) !== editModal.amount && (
                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-xs text-yellow-400">
                  <ShieldCheck className="h-3.5 w-3.5 inline mr-1" />
                  Wallet will be adjusted by ${(parseFloat(editAmount || "0") - editModal.amount).toFixed(2)} for this user.
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setEditModal(null)}>Cancel</Button>
                <Button onClick={handleEditAmount} disabled={!!processingId || !editAmount}>
                  {processingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transaction Logs Modal */}
      <Dialog open={!!logsModal} onOpenChange={() => setLogsModal(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Transaction History
            </DialogTitle>
            <DialogDescription>
              Audit log for transaction {logsModal?.id.slice(0, 8)}…
            </DialogDescription>
          </DialogHeader>
          {(logsModal?.type === "deposit" || logsModal?.type === "withdraw") && logsModal.deposit_proof_url && (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs font-semibold text-foreground mb-2">{logsModal?.type === "withdraw" ? "QR Code" : "Deposit Proof"}</p>
              <button onClick={() => { setProofModal(logsModal.deposit_proof_url); }} className="group">
                <img
                  src={logsModal.deposit_proof_url}
                  alt="Deposit proof"
                  className="h-24 w-auto rounded-lg object-cover border border-border group-hover:border-primary transition-colors"
                />
              </button>
            </div>
          )}
          {logsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No logs recorded yet.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold capitalize text-foreground">{log.action}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(log.action_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <p>By: <span className="text-foreground">{log.actor_name}</span></p>
                    {log.old_status !== log.new_status && (
                      <p>Status: {log.old_status} → <span className="text-foreground">{log.new_status}</span></p>
                    )}
                    {log.old_amount !== null && log.new_amount !== null && log.old_amount !== log.new_amount && (
                      <p>Amount: ${Number(log.old_amount).toFixed(2)} → <span className="text-foreground">${Number(log.new_amount).toFixed(2)}</span></p>
                    )}
                    {log.note && <p>Note: <span className="text-foreground">{log.note}</span></p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Proof Image Modal */}
      <Dialog open={!!proofModal} onOpenChange={() => setProofModal(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg border-border bg-card">
          <DialogHeader>
            <DialogTitle>Deposit Proof</DialogTitle>
            <DialogDescription>Screenshot uploaded by the user.</DialogDescription>
          </DialogHeader>
          {proofModal && (
            <div className="flex flex-col items-center gap-3">
              <img
                src={proofModal}
                alt="Deposit proof"
                className="max-h-[60vh] w-full rounded-lg object-contain border border-border"
              />
              <div className="flex items-center gap-4">
                <a
                  href={proofModal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  Open full image
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 gap-1.5"
                  onClick={async () => {
                    try {
                      const res = await fetch(proofModal);
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `deposit-proof-${Date.now()}.${blob.type.split("/")[1] || "jpg"}`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      window.open(proofModal, "_blank");
                    }
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject with Note Modal */}
      <Dialog open={!!rejectModal} onOpenChange={() => setRejectModal(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Reject Transaction
            </DialogTitle>
            <DialogDescription>
              Add a reason for rejecting this transaction.
            </DialogDescription>
          </DialogHeader>
          {rejectModal && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User:</span>
                  <span className="font-medium text-foreground">{rejectModal.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium text-foreground">${Number(rejectModal.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium text-foreground capitalize">{rejectModal.type}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Rejection Reason *</label>
                <textarea
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  placeholder="Why is this transaction being rejected?"
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-1">{rejectNote.length}/500</p>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    const txnId = rejectModal.id;
                    setProcessingId(txnId);
                    const currentNotes = rejectModal.notes;
                    const updatedNotes = currentNotes
                      ? `${currentNotes} | Rejection Reason: ${rejectNote.trim()}`
                      : `Rejection Reason: ${rejectNote.trim()}`;
                    await supabase.from("transactions").update({ notes: updatedNotes }).eq("id", txnId);
                    const { error } = await supabase.rpc("process_transaction", {
                      _transaction_id: txnId,
                      _action: "rejected",
                    });
                    if (error) {
                      toast({ title: "Error", description: error.message, variant: "destructive" });
                    } else {
                      toast({ title: "Transaction Rejected" });
                      setRejectModal(null);
                      setRejectNote("");
                      fetchTransactions();
                    }
                    setProcessingId(null);
                  }}
                  disabled={!rejectNote.trim() || !!processingId}
                >
                  {processingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Reject Transaction
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTransactions;
