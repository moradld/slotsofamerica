import { supabase } from "@/integrations/supabase/client";

export async function sendTransactionEmail(
  transactionType: "deposit" | "withdraw" | "transfer" | "redeem",
  amount: number
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.functions.invoke("send-transaction-email", {
      body: {
        transaction_type: transactionType,
        amount: amount.toFixed(2),
        status: "Pending",
      },
    });
  } catch {
    // Silently fail — email is non-critical
  }
}
