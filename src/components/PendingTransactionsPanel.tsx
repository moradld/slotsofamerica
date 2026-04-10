import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
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

interface PendingTransaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
  notes: string | null;
  game_id: string | null;
  game_name?: string;
}

const typeColors: Record<string, string> = {
  deposit: "bg-green-500/10 text-green-500 border-green-500/20",
  withdraw: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  redeem: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  transfer: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

const typeLabels: Record<string, string> = {
  deposit: "Deposit",
  withdraw: "Withdrawal",
  redeem: "Redeem",
  transfer: "Transfer",
};

interface Props {
  userId: string;
  compact?: boolean;
  onAction?: () => void;
}

const PendingTransactionsPanel = ({ userId, compact = false, onAction }: Props) => {
  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{ txnId: string; action: "approved" | "rejected"; amount: number; type: string } | null>(null);

  const fetchPendingTransactions = useCallback(async () => {
    setLoading(true);
    const { data: txns } = await supabase
      .from("transactions")
      .select("id, type, amount, status, created_at, notes, game_id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (txns && txns.length > 0) {
      // Fetch game names
      const gameIds = [...new Set(txns.map(t => t.game_id).filter(Boolean))] as string[];
      let gameMap: Record<string, string> = {};
      if (gameIds.length > 0) {
        const { data: games } = await supabase
          .from("games")
          .select("id, name")
          .in("id", gameIds);
        gameMap = Object.fromEntries((games || []).map(g => [g.id, g.name]));
      }

      setTransactions(txns.map(t => ({
        ...t,
        game_name: t.game_id ? gameMap[t.game_id] || "Unknown" : undefined,
      })));
    } else {
      setTransactions([]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchPendingTransactions();
  }, [fetchPendingTransactions]);

  const handleAction = async (txnId: string, action: "approved" | "rejected") => {
    setProcessing(txnId);
    try {
      const { error } = await supabase.rpc("process_transaction", {
        _transaction_id: txnId,
        _action: action,
      });
      if (error) throw error;
      toast({
        title: action === "approved" ? "Transaction Approved" : "Transaction Rejected",
        description: `Transaction has been ${action}.`,
      });
      setTransactions(prev => prev.filter(t => t.id !== txnId));
      onAction?.();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || `Failed to ${action === "approved" ? "approve" : "reject"} transaction`,
        variant: "destructive",
      });
    }
    setProcessing(null);
  };

  if (loading) return null;
  if (transactions.length === 0) return null;

  return (
    <div className={`border-b border-border ${compact ? "p-2" : "p-3"} bg-muted/20`}>
      <div className="flex items-center gap-1.5 mb-2">
        <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
        <span className={`font-semibold text-yellow-500 ${compact ? "text-[10px]" : "text-xs"}`}>
          {transactions.length} Pending Transaction{transactions.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {transactions.map((txn) => (
          <div
            key={txn.id}
            className={`rounded-lg border p-2 ${typeColors[txn.type] || "bg-muted/50 border-border"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`font-bold uppercase ${compact ? "text-[10px]" : "text-[11px]"}`}>
                    {typeLabels[txn.type] || txn.type}
                  </span>
                  <span className={`font-bold ${compact ? "text-[11px]" : "text-xs"}`}>
                    ${txn.amount}
                  </span>
                </div>
                {txn.game_name && (
                  <p className={`text-muted-foreground truncate ${compact ? "text-[9px]" : "text-[10px]"}`}>
                    {txn.game_name}
                  </p>
                )}
                <p className={`text-muted-foreground ${compact ? "text-[9px]" : "text-[10px]"}`}>
                  {new Date(txn.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {processing === txn.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <button
                      onClick={() => setConfirmAction({ txnId: txn.id, action: "approved", amount: txn.amount, type: txn.type })}
                      className="h-7 px-2 rounded-md bg-green-500/20 text-green-500 hover:bg-green-500/30 transition-colors flex items-center gap-1 text-[10px] font-semibold"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      {!compact && "Approve"}
                    </button>
                    <button
                      onClick={() => setConfirmAction({ txnId: txn.id, action: "rejected", amount: txn.amount, type: txn.type })}
                      className="h-7 px-2 rounded-md bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors flex items-center gap-1 text-[10px] font-semibold"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {!compact && "Reject"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === "approved" ? "Approve" : "Reject"} Transaction?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmAction?.action === "approved" ? "approve" : "reject"} this{" "}
              <span className="font-semibold">{typeLabels[confirmAction?.type || ""] || confirmAction?.type}</span>{" "}
              of <span className="font-semibold">${confirmAction?.amount}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.action === "approved" ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:bg-destructive/90"}
              onClick={() => {
                if (confirmAction) {
                  handleAction(confirmAction.txnId, confirmAction.action);
                  setConfirmAction(null);
                }
              }}
            >
              {confirmAction?.action === "approved" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PendingTransactionsPanel;
