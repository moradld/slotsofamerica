import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Gift, ArrowLeft } from "lucide-react";
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

const RedeemPage = () => {
  const { user } = useAuth();
  const [games, setGames] = useState<{ id: string; name: string }[]>([]);
  const [gameId, setGameId] = useState("");
  const [gameUsername, setGameUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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

  useEffect(() => {
    if (!gameId || !user) { setGameUsername(""); return; }
    supabase
      .from("game_unlock_requests")
      .select("username")
      .eq("game_id", gameId)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .maybeSingle()
      .then(({ data }) => { setGameUsername(data?.username || ""); });
  }, [gameId, user]);

  const handleContinue = () => {
    if (!isVerified) {
      setShowVerifyModal(true);
      return;
    }
    const amt = parseFloat(amount);
    if (!gameId || !amount || amt < 20) {
      toast({ title: "Please fill all fields. Minimum redeem: $20.00", variant: "destructive" });
      return;
    }
    setShowConfirm(true);
  };

  const selectedGameName = games.find((g) => g.id === gameId)?.name || "";

  const handleSubmit = async () => {
    setSubmitting(true);
    const { data: txnId, error } = await supabase.rpc("submit_transaction", {
      _game_id: gameId, _type: "redeem", _amount: parseFloat(amount),
      _notes: `Redeem for username: ${gameUsername}`,
    });
    if (error) {
      setSubmitting(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      sendTransactionEmail("redeem", parseFloat(amount));
      setLastTransaction({
        transactionId: txnId as string,
        type: "redeem",
        amount: parseFloat(amount),
        paymentMethod: selectedGameName || "Game Redeem",
      });
      setSubmitting(false);
      setAmount(""); setShowConfirm(false);
      setShowSuccessModal(true);
    }
  };

  return (
    <UserLayout showBackButton>
      <div className="py-16">
        <div className="mx-auto max-w-2xl px-4">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="text-center mb-8">
              <h2 className="font-display text-2xl font-bold tracking-wider gradient-text">REDEEM</h2>
              <p className="mt-2 text-sm text-muted-foreground">Convert your in-game earnings to wallet balance.</p>
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
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Amount Earned ($)</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground">Available balance: <span className="font-semibold text-foreground">${balance.toFixed(2)} USD</span></p>
              <button onClick={handleContinue}
                className="w-full rounded-xl gradient-bg py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50">
                <Gift className="h-4 w-4" /> Continue
              </button>
            </div>

            {/* Confirmation Step */}
            {showConfirm && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 rounded-xl border border-primary/30 bg-card p-6 glow-card space-y-4"
              >
                <h3 className="text-sm font-bold text-foreground text-center">Confirm Redeem Request</h3>
                <div className="space-y-2 rounded-lg bg-muted/30 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Game</span>
                    <span className="font-medium text-foreground">{selectedGameName}</span>
                  </div>
                  {gameUsername && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Username</span>
                      <span className="font-medium text-foreground">{gameUsername}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold text-primary">${parseFloat(amount).toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  This amount will be added to your wallet after admin approval.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowConfirm(false)}
                    className="flex-1 rounded-xl border border-border py-3 text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <button onClick={handleSubmit} disabled={submitting}
                    className="flex-1 rounded-xl gradient-bg py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50">
                    <Gift className="h-4 w-4" /> {submitting ? "Submitting..." : "Redeem Now"}
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
      <VerificationRequiredModal open={showVerifyModal} onClose={() => setShowVerifyModal(false)} />
      <TransactionSuccessModal open={showSuccessModal} onClose={() => setShowSuccessModal(false)} transaction={lastTransaction} />
    </UserLayout>
  );
};

export default RedeemPage;
