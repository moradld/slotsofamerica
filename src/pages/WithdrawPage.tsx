import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Banknote, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionEmail } from "@/lib/sendTransactionEmail";

import { useAuth } from "@/contexts/AuthContext";
import { UserLayout } from "@/components/UserLayout";
import { toast } from "@/hooks/use-toast";
import { useVerificationCheck } from "@/hooks/useVerificationCheck";
import { VerificationRequiredModal } from "@/components/VerificationRequiredModal";
import { TransactionSuccessModal } from "@/components/TransactionSuccessModal";
import { WithdrawQrUpload } from "@/components/withdraw/WithdrawQrUpload";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

interface CustomField {
  key: string;
  label: string;
  type: "text" | "email" | "tel";
  required: boolean;
}

interface WithdrawMethod {
  id: string;
  name: string;
  logo_url: string | null;
  min_amount: number;
  max_amount: number;
  custom_fields: CustomField[];
  is_active: boolean;
}

const tipOptions = [1, 2, 5, 10, 50, 100];

const WithdrawPage = () => {
  const { user } = useAuth();
  const [methods, setMethods] = useState<WithdrawMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<WithdrawMethod | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState("");
  const [tip, setTip] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState("");
  const [useCustomTip, setUseCustomTip] = useState(false);
  const [balance, setBalance] = useState(0);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<{ transactionId: string; type: string; amount: number; baseAmount?: number; tip?: number; paymentMethod: string } | null>(null);
  const { isVerified } = useVerificationCheck();
  const [dailyLimit, setDailyLimit] = useState<number>(100);
  const [dailyUsed, setDailyUsed] = useState<number>(0);

  useEffect(() => {
    if (!user) return;

    // Fetch withdraw methods
    supabase.from("withdraw_methods").select("*").eq("is_active", true).order("name").then(({ data }) => {
      if (data) setMethods(data.map(d => ({ ...d, custom_fields: (d.custom_fields || []) as unknown as CustomField[] })));
      setLoading(false);
    });

    // Fetch balance
    supabase.from("profiles").select("balance").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) setBalance(Number(data.balance));
    });

    // Fetch daily limit
    supabase.from("app_settings").select("value").eq("key", "daily_withdraw_limit").maybeSingle().then(({ data }) => {
      if (data) setDailyLimit(parseFloat(data.value) || 100);
    });

    // Fetch today's withdraw total
    const since = new Date();
    since.setHours(since.getHours() - 24);
    supabase.from("transactions")
      .select("amount")
      .eq("user_id", user.id)
      .eq("type", "withdraw")
      .in("status", ["pending", "completed"])
      .gte("created_at", since.toISOString())
      .then(({ data }) => {
        if (data) setDailyUsed(data.reduce((s, t) => s + Number(t.amount), 0));
      });
  }, [user]);

  const activeTip = useCustomTip ? (parseFloat(customTip) || 0) : (tip || 0);
  const totalDeducted = (parseFloat(amount) || 0) + activeTip;
  const dailyRemaining = Math.max(0, dailyLimit - dailyUsed);

  const handleSelectMethod = (m: WithdrawMethod) => {
    setSelectedMethod(m);
    setFieldValues({});
    setTip(null);
    setCustomTip("");
    setUseCustomTip(false);
  };

  const handleSubmit = async () => {
    if (!isVerified) { setShowVerifyModal(true); return; }
    if (!selectedMethod) { toast({ title: "Please select a payment method", variant: "destructive" }); return; }

    // Validate custom fields
    for (const f of selectedMethod.custom_fields) {
      if (f.required && !fieldValues[f.key]?.trim()) {
        toast({ title: `${f.label} is required`, variant: "destructive" }); return;
      }
    }

    const amt = parseFloat(amount);
    if (!amount || amt < selectedMethod.min_amount) {
      toast({ title: `Minimum withdrawal: $${selectedMethod.min_amount.toFixed(2)}`, variant: "destructive" }); return;
    }
    if (amt > selectedMethod.max_amount) {
      toast({ title: `Maximum withdrawal: $${selectedMethod.max_amount.toFixed(2)}`, variant: "destructive" }); return;
    }
    if (totalDeducted > balance) {
      toast({ title: "Insufficient balance (amount + tip exceeds balance)", variant: "destructive" }); return;
    }
    if (amt > dailyRemaining) {
      toast({ title: `Daily limit exceeded. Remaining: $${dailyRemaining.toFixed(2)}`, variant: "destructive" }); return;
    }

    setSubmitting(true);

    const { data: gameData } = await supabase.from("games").select("id").eq("is_active", true).limit(1).maybeSingle();
    if (!gameData) { toast({ title: "No active games configured", variant: "destructive" }); setSubmitting(false); return; }

    const fieldNotes = selectedMethod.custom_fields.map(f => `${f.label}: ${fieldValues[f.key] || ''}`).join(" | ");
    const notes = [
      `Payment Method: ${selectedMethod.name}`,
      fieldNotes,
      `Withdraw Amount: $${amt.toFixed(2)}`,
      activeTip > 0 ? `Tip: $${activeTip.toFixed(2)}` : null,
      `Total Deducted: $${totalDeducted.toFixed(2)}`,
    ].filter(Boolean).join(" | ");

    const { data: txnId, error } = await supabase.rpc("submit_transaction", {
      _game_id: gameData.id,
      _type: "withdraw",
      _amount: totalDeducted,
      _notes: notes,
    } as any);

    if (!error && txnId && qrCodeUrl) {
      await supabase.rpc("attach_transaction_proof", {
        _transaction_id: txnId,
        _proof_url: qrCodeUrl,
      } as any);
    }

    if (error) {
      setSubmitting(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      sendTransactionEmail("withdraw", totalDeducted);
      const amt = parseFloat(amount);
      setLastTransaction({
        transactionId: txnId as string,
        type: "withdraw",
        amount: totalDeducted,
        baseAmount: amt,
        tip: activeTip > 0 ? activeTip : undefined,
        paymentMethod: selectedMethod.name,
      });
      setSubmitting(false);
      setAmount("");
      setFieldValues({});
      setTip(null);
      setCustomTip("");
      setUseCustomTip(false);
      setSelectedMethod(null);
      setQrCodeUrl(null);
      setDailyUsed(prev => prev + amt);
      setShowSuccessModal(true);
    }
  };

  return (
    <UserLayout showBackButton>
      <div className="py-16">
        <div className="mx-auto max-w-2xl px-4">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="text-center mb-8">
              <h2 className="font-display text-2xl font-bold tracking-wider gradient-text">WITHDRAW</h2>
              <p className="mt-2 text-sm text-muted-foreground">Transfer money from your main balance to your wallet.</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 glow-card space-y-5">
              {/* Daily limit info */}
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Daily Limit (24hrs)</span>
                  <span className="text-foreground font-medium">${dailyLimit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Used Today</span>
                  <span className="text-foreground font-medium">${dailyUsed.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Remaining</span>
                  <span className={`font-medium ${dailyRemaining <= 0 ? "text-destructive" : "text-green-500"}`}>${dailyRemaining.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Payment Method</label>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading payment methods...</p>
                ) : methods.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payment methods available.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {methods.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => handleSelectMethod(m)}
                        className={`group relative rounded-xl border-2 p-3 text-left transition-all duration-200 w-full ${
                          selectedMethod?.id === m.id
                            ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                            : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                        }`}
                      >
                        {selectedMethod?.id === m.id && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full gradient-bg flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                        <div className="flex flex-col items-center gap-2">
                          {m.logo_url ? (
                            <img src={m.logo_url} alt={m.name} className="h-10 w-10 rounded-lg object-contain bg-muted/50 p-1 border border-border" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-muted border border-border flex items-center justify-center text-sm font-bold text-muted-foreground">
                              {m.name.charAt(0)}
                            </div>
                          )}
                          <p className="text-xs font-semibold text-foreground text-center truncate w-full">{m.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dynamic Custom Fields */}
              {selectedMethod && selectedMethod.custom_fields.length > 0 && (
                <div className="space-y-3">
                  {selectedMethod.custom_fields.map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                        {f.label} {f.required && <span className="text-destructive">*</span>}
                      </label>
                      <input
                        type={f.type}
                        value={fieldValues[f.key] || ""}
                        onChange={(e) => setFieldValues({ ...fieldValues, [f.key]: e.target.value })}
                        placeholder={`Enter your ${f.label.toLowerCase()}`}
                        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Amount ($)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
                />
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>Balance: <span className="font-semibold text-foreground">${balance.toFixed(2)}</span></span>
                  {selectedMethod && (
                    <span>Min: ${selectedMethod.min_amount.toFixed(2)} · Max: ${selectedMethod.max_amount.toFixed(2)}</span>
                  )}
                </div>
              </div>

              {/* Tip Section */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Send a Tip ($USD)</label>
                <p className="text-[11px] text-muted-foreground mb-2">All tips go directly to our cashiers</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {tipOptions.map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTip(tip === t && !useCustomTip ? null : t); setUseCustomTip(false); setCustomTip(""); }}
                      className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-all ${
                        !useCustomTip && tip === t
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-foreground hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      ${t}
                    </button>
                  ))}
                  <button
                    onClick={() => { setUseCustomTip(true); setTip(null); }}
                    className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-all ${
                      useCustomTip
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-foreground hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {useCustomTip && (
                  <input
                    type="number" min="0" step="0.01"
                    value={customTip}
                    onChange={(e) => { const val = parseFloat(e.target.value); if (e.target.value === "" || val >= 0) setCustomTip(e.target.value); }}
                    placeholder="Enter custom tip amount"
                    className="mt-2 w-full rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
                  />
                )}
              </div>

              {/* QR Code Upload */}
              <WithdrawQrUpload
                onUploadComplete={(url) => setQrCodeUrl(url)}
                onRemove={() => setQrCodeUrl(null)}
                uploadedUrl={qrCodeUrl}
              />

              {/* Summary */}
              {(parseFloat(amount) > 0 || activeTip > 0) && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1 text-xs text-muted-foreground">
                  {parseFloat(amount) > 0 && (
                    <div className="flex justify-between">
                      <span>Withdraw</span>
                      <span className="text-foreground font-medium">${(parseFloat(amount) || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {activeTip > 0 && (
                    <div className="flex justify-between">
                      <span>Tip</span>
                      <span className="text-foreground font-medium">${activeTip.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-1 flex justify-between font-semibold text-foreground text-sm">
                    <span>Total</span>
                    <span>${totalDeducted.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || !selectedMethod || dailyRemaining <= 0}
                className="w-full rounded-xl gradient-bg py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Banknote className="h-4 w-4" /> {submitting ? "Submitting..." : "Withdraw Now"}
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

export default WithdrawPage;
