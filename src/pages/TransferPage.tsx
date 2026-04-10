import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionEmail } from "@/lib/sendTransactionEmail";

import { useAuth } from "@/contexts/AuthContext";
import { UserLayout } from "@/components/UserLayout";
import { toast } from "@/hooks/use-toast";
import { useVerificationCheck } from "@/hooks/useVerificationCheck";
import { VerificationRequiredModal } from "@/components/VerificationRequiredModal";
import { TransactionSuccessModal } from "@/components/TransactionSuccessModal";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

const TransferPage = () => {
  const { user } = useAuth();
  const [games, setGames] = useState<{ id: string; name: string }[]>([]);
  const [gameId, setGameId] = useState("");
  const [gameUsername, setGameUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<{ transactionId: string; type: string; amount: number; paymentMethod: string } | null>(null);
  const { isVerified } = useVerificationCheck();

  useEffect(() => {
    if (!user) return;
    // Only show games where user has approved access
    supabase
      .from("game_unlock_requests")
      .select("game_id, games:game_id(id, name)")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .then(({ data }) => {
        if (data) {
          const uniqueGames = data
            .filter((d: any) => d.games)
            .map((d: any) => ({ id: d.games.id, name: d.games.name }));
          setGames(uniqueGames);
        }
      });
    supabase.from("profiles").select("balance").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) setBalance(Number(data.balance));
    });
  }, [user]);

  // When game is selected, fetch the user's username from their profile
  useEffect(() => {
    if (!gameId || !user) { setGameUsername(""); return; }
    supabase
      .from("game_unlock_requests")
      .select("username")
      .eq("game_id", gameId)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .maybeSingle()
      .then(({ data }) => {
        setGameUsername(data?.username || "");
      });
  }, [gameId, user]);

  const handleSubmit = async () => {
    if (!isVerified) {
      setShowVerifyModal(true);
      return;
    }
    const amt = parseFloat(amount);
    if (!gameId || !amount || amt <= 0) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    if (amt > balance) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data: txnId, error } = await supabase.rpc("submit_transaction", {
      _game_id: gameId, _type: "transfer", _amount: amt,
      _notes: `Transfer for game account: ${gameUsername}`,
    });
    if (error) {
      setSubmitting(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const selectedGame = games.find(g => g.id === gameId);
      sendTransactionEmail("transfer", amt);
      setLastTransaction({
        transactionId: txnId as string,
        type: "transfer",
        amount: amt,
        paymentMethod: selectedGame?.name || "Game Transfer",
      });
      setSubmitting(false);
      setAmount("");
      setShowSuccessModal(true);
    }
  };

  return (
    <UserLayout showBackButton>
      <div className="py-16">
        <div className="mx-auto max-w-2xl px-4">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="text-center mb-8">
              <h2 className="font-display text-2xl font-bold tracking-wider gradient-text">TRANSFER</h2>
              <p className="mt-2 text-sm text-muted-foreground">Transfer funds to another player's gaming account.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 glow-card space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Select Game</label>
                <select value={gameId} onChange={(e) => setGameId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors appearance-none">
                  <option value="" className="bg-card text-muted-foreground">Select a game</option>
                  {games.map((g) => <option key={g.id} value={g.id} className="bg-card">{g.name}</option>)}
                </select>
              </div>
              {gameUsername && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Game Username</label>
                  <div className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground">
                    {gameUsername}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Amount ($)</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground">Available balance: <span className="font-semibold text-foreground">${balance.toFixed(2)} USD</span></p>
              <button onClick={handleSubmit} disabled={submitting || !gameId}
                className="w-full rounded-xl gradient-bg py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50">
                <Send className="h-4 w-4" /> {submitting ? "Submitting..." : "Transfer Now"}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
      <VerificationRequiredModal open={showVerifyModal} onClose={() => setShowVerifyModal(false)} />
      <TransactionSuccessModal open={showSuccessModal} onClose={() => setShowSuccessModal(false)} transaction={lastTransaction} />
    </UserLayout>
  );
};

export default TransferPage;
