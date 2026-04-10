import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionEmail } from "@/lib/sendTransactionEmail";

import { useAuth } from "@/contexts/AuthContext";
import { UserLayout } from "@/components/UserLayout";
import { toast } from "@/hooks/use-toast";
import { useVerificationCheck } from "@/hooks/useVerificationCheck";
import { VerificationRequiredModal } from "@/components/VerificationRequiredModal";
import { TransactionSuccessModal } from "@/components/TransactionSuccessModal";
import { PaymentMethodCard } from "@/components/deposit/PaymentMethodCard";
import { PaymentDetails } from "@/components/deposit/PaymentDetails";
import { DepositScreenshotUpload } from "@/components/deposit/DepositScreenshotUpload";
import { DepositHelpModal } from "@/components/deposit/DepositHelpModal";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

interface PaymentGateway {
  id: string;
  name: string;
  address: string;
  logo_url: string | null;
  qr_code_url: string | null;
  minimum_amount: number;
  instructions: string | null;
  deep_link: string | null;
}

interface GatewayAccount {
  id: string;
  gateway_id: string;
  account_name: string;
  account_number: string;
  deep_link: string | null;
  qr_code_url: string | null;
  is_active: boolean;
  priority_order: number;
}

const HELP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const DepositPage = () => {
  const { user } = useAuth();
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [gatewayAccounts, setGatewayAccounts] = useState<GatewayAccount[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway | null>(null);
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<{
    transactionId: string;
    type: string;
    amount: number;
    paymentMethod: string;
  } | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const { isVerified } = useVerificationCheck();

  // Screenshot upload
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  // Rotating accounts
  const [skippedAccountIds, setSkippedAccountIds] = useState<Set<string>>(new Set());

  // Help timer
  const [showHelpModal, setShowHelpModal] = useState(false);
  const helpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSubmittedRef = useRef(false);

  // Fetch gateways & accounts
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from("payment_gateways")
        .select("*")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("payment_gateway_accounts")
        .select("*")
        .eq("is_active", true)
        .order("priority_order"),
      supabase
        .from("profiles")
        .select("balance")
        .eq("id", user.id)
        .maybeSingle(),
    ]).then(([gwRes, accRes, balRes]) => {
      if (gwRes.data) setGateways(gwRes.data as PaymentGateway[]);
      if (accRes.data) setGatewayAccounts(accRes.data as GatewayAccount[]);
      if (balRes.data) setBalance(Number(balRes.data.balance));
      setLoading(false);
    });
  }, [user]);

  // 5-minute help timer
  useEffect(() => {
    helpTimerRef.current = setTimeout(() => {
      if (!hasSubmittedRef.current) {
        setShowHelpModal(true);
      }
    }, HELP_TIMEOUT_MS);

    return () => {
      if (helpTimerRef.current) clearTimeout(helpTimerRef.current);
    };
  }, []);

  // Get active accounts for selected gateway (excluding skipped)
  const getActiveAccounts = useCallback(() => {
    if (!selectedGateway) return [];
    return gatewayAccounts
      .filter(
        (a) =>
          a.gateway_id === selectedGateway.id &&
          a.is_active &&
          !skippedAccountIds.has(a.id)
      )
      .sort((a, b) => a.priority_order - b.priority_order);
  }, [selectedGateway, gatewayAccounts, skippedAccountIds]);

  const allAccountsForGateway = selectedGateway
    ? gatewayAccounts.filter((a) => a.gateway_id === selectedGateway.id && a.is_active)
    : [];
  const hasMultipleAccounts = allAccountsForGateway.length > 1;
  const activeAccounts = getActiveAccounts();
  const currentAccount = activeAccounts.length > 0 ? activeAccounts[0] : null;
  const noMoreAccounts = allAccountsForGateway.length > 0 && activeAccounts.length === 0;

  const handleSelectGateway = (gw: PaymentGateway) => {
    setSelectedGateway(gw);
    setAmount("");
    setProofUrl(null);
    setSkippedAccountIds(new Set());
  };

  const handleRequestNewAccount = () => {
    if (currentAccount) {
      setSkippedAccountIds((prev) => new Set([...prev, currentAccount.id]));
    }
  };

  const canConfirm = !!selectedGateway && !!proofUrl && !!amount && parseFloat(amount) >= (selectedGateway?.minimum_amount || 0);

  const handleSubmit = async () => {
    if (!isVerified) {
      setShowVerifyModal(true);
      return;
    }
    if (!selectedGateway) {
      toast({ title: "Please select a payment method", variant: "destructive" });
      return;
    }
    const amt = parseFloat(amount);
    if (!amount || amt < selectedGateway.minimum_amount) {
      toast({ title: `Minimum deposit: $${selectedGateway.minimum_amount.toFixed(2)}`, variant: "destructive" });
      return;
    }
    if (!proofUrl) {
      toast({ title: "Please upload your deposit screenshot", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    hasSubmittedRef.current = true;

    const { data: gameData } = await supabase
      .from("games")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (!gameData) {
      toast({ title: "No active games configured", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    const accountInfo = currentAccount
      ? ` — Account: ${currentAccount.account_name} (${currentAccount.account_number})`
      : ` — Address: ${selectedGateway.address}`;

    const { data: txnId, error } = await supabase.rpc("submit_transaction", {
      _game_id: gameData.id,
      _type: "deposit",
      _amount: amt,
      _notes: `Payment via ${selectedGateway.name}${accountInfo}`,
      _payment_gateway_id: selectedGateway.id,
    } as any);

    if (error) {
      setSubmitting(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Save proof URL on transaction
    if (txnId && proofUrl) {
      await supabase
        .from("transactions")
        .update({ deposit_proof_url: proofUrl } as any)
        .eq("id", txnId as string);
    }

    sendTransactionEmail("deposit", amt);
    setLastTransaction({
      transactionId: txnId as string,
      type: "deposit",
      amount: amt,
      paymentMethod: selectedGateway.name,
    });
    setSubmitting(false);
    setAmount("");
    setSelectedGateway(null);
    setProofUrl(null);
    setShowSuccessModal(true);
  };

  return (
    <UserLayout showBackButton>
      <div className="py-8 sm:py-16">
        <div className="mx-auto max-w-2xl px-4">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="font-display text-2xl font-bold tracking-wider gradient-text">
                DEPOSIT
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Select a payment method and add funds to your wallet.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 sm:p-6 glow-card space-y-5">
              {/* Payment Method Selection */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-3">
                  Select Payment Method
                </label>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading payment methods...</p>
                ) : gateways.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No payment methods available. Please contact support.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {gateways.map((gw) => (
                      <PaymentMethodCard
                        key={gw.id}
                        gateway={gw}
                        selected={selectedGateway?.id === gw.id}
                        onSelect={() => handleSelectGateway(gw)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Amount ($){" "}
                  {selectedGateway && (
                    <span className="text-muted-foreground font-normal">
                      — Min: ${selectedGateway.minimum_amount.toFixed(2)}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-3 text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
                />
              </div>

              {/* Payment Details */}
              {selectedGateway && (
                <PaymentDetails
                  gateway={selectedGateway}
                  account={currentAccount}
                  amount={amount}
                  onRequestNewAccount={handleRequestNewAccount}
                  noMoreAccounts={noMoreAccounts}
                  hasMultipleAccounts={hasMultipleAccounts}
                />
              )}

              {/* Screenshot Upload */}
              {selectedGateway && (
                <DepositScreenshotUpload
                  onUploadComplete={(url) => setProofUrl(url)}
                  onRemove={() => setProofUrl(null)}
                  uploadedUrl={proofUrl}
                />
              )}

              <p className="text-[11px] text-muted-foreground">
                Available balance:{" "}
                <span className="font-semibold text-foreground">
                  ${balance.toFixed(2)} USD
                </span>
              </p>

              {/* Confirm Button — always visible, disabled until ready */}
              <div className="sticky bottom-4 z-10">
                <button
                  onClick={handleSubmit}
                  disabled={!canConfirm || submitting}
                  className="w-full rounded-xl gradient-bg py-3.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                >
                  <DollarSign className="h-4 w-4" />{" "}
                  {submitting ? "Submitting..." : "Confirm Deposit"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      <VerificationRequiredModal open={showVerifyModal} onClose={() => setShowVerifyModal(false)} />
      <TransactionSuccessModal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        transaction={lastTransaction}
      />
      <DepositHelpModal open={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </UserLayout>
  );
};

export default DepositPage;
