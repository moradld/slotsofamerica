import { useState, useRef, useEffect, useCallback } from "react";
import { X, Loader2, Mail, Phone, ShieldCheck, Clock, Copy, Check, MessageCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  type: "email" | "phone";
  onClose: () => void;
  onVerified: () => void;
}

const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN = 60;

export function VerificationOtpModal({ type, onClose, onVerified }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<"send" | "verify" | "whatsapp-code" | "manual-request">("send");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [phone, setPhone] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [manualRequesting, setManualRequesting] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (type === "phone") {
      supabase.from("site_settings_public" as any).select("whatsapp_number").limit(1).maybeSingle().then(({ data }: any) => {
        if (data?.whatsapp_number) setWhatsappNumber(data.whatsapp_number);
      });
    }
  }, [type]);

  useEffect(() => {
    if (type === "phone" && user) {
      supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data?.phone) setPhone(data.phone);
      });
    }
  }, [type, user]);

  useEffect(() => {
    if (resendCooldown > 0) {
      cooldownRef.current = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => { if (cooldownRef.current) clearTimeout(cooldownRef.current); };
  }, [resendCooldown]);

  useEffect(() => {
    if (step === "verify") {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const extractErrorMessage = async (error: any, data: any): Promise<string> => {
    if (data?.error) return data.error;
    if (error?.context?.body) {
      try {
        const text = await new Response(error.context.body).text();
        const parsed = JSON.parse(text);
        return parsed?.error || error.message;
      } catch { /* ignore */ }
    }
    if (error?.message && !error.message.includes("non-2xx")) return error.message;
    return "Something went wrong. Please try again.";
  };

  // === EMAIL: Send OTP via SMTP ===
  // === PHONE: Generate OTP for WhatsApp ===
  const handleSendOtp = useCallback(async () => {
    if (resendCooldown > 0) return;
    setSending(true);
    try {
      if (type === "email") {
        const { data, error } = await supabase.functions.invoke("email-verify", {
          body: { action: "send_otp" },
        });
        if (error || data?.error) {
          const msg = await extractErrorMessage(error, data);
          toast({ title: "Error", description: msg, variant: "destructive" });
          setSending(false);
          return;
        }
        setStep("verify");
        setResendCooldown(RESEND_COOLDOWN);
        setAttempts(0);
        toast({ title: "Verification code sent to your email" });
      } else {
        const digits = phone.replace(/\D/g, "");
        const fullPhone = digits.length === 10 ? `+1${digits}` : phone;
        const { data, error } = await supabase.functions.invoke("phone-verify", {
          body: { action: "send_otp", phone: fullPhone },
        });
        if (error || data?.error) {
          const msg = await extractErrorMessage(error, data);
          toast({ title: "Error", description: msg, variant: "destructive" });
          setSending(false);
          return;
        }
        setPhoneOtpCode(data?.code || "");
        setStep("whatsapp-code");
        setResendCooldown(RESEND_COOLDOWN);
        toast({ title: "Verification code generated" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSending(false);
  }, [type, phone, resendCooldown]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < text.length; i++) newOtp[i] = text[i];
    setOtp(newOtp);
    if (text.length > 0) inputRefs.current[Math.min(text.length, 5)]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      toast({ title: "Please enter the 6-digit code", variant: "destructive" });
      return;
    }
    if (attempts >= MAX_ATTEMPTS) {
      toast({ title: "Too many attempts", description: "Please request a new code.", variant: "destructive" });
      return;
    }
    setVerifying(true);
    setAttempts((a) => a + 1);
    try {
      const fnName = type === "email" ? "email-verify" : "phone-verify";
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { action: "verify_otp", otp: code },
      });
      if (error || data?.error) {
        const msg = await extractErrorMessage(error, data);
        toast({ title: "Verification failed", description: msg, variant: "destructive" });
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        setVerifying(false);
        return;
      }
      toast({ title: `${type === "email" ? "Email" : "Phone"} verified successfully! 🎉` });
      onVerified();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setVerifying(false);
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    setOtp(["", "", "", "", "", ""]);
    setAttempts(0);
    handleSendOtp();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(phoneOtpCode);
    setCopied(true);
    toast({ title: "Code copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppSend = () => {
    if (!whatsappNumber) {
      toast({ title: "WhatsApp number not configured", variant: "destructive" });
      return;
    }
    const cleanNumber = whatsappNumber.replace(/\D/g, "");
    const msg = encodeURIComponent(`My verification code is: ${phoneOtpCode}`);
    window.open(`https://wa.me/${cleanNumber}?text=${msg}`, "_blank");
  };

  const handleManualRequest = async () => {
    const digits = phone.replace(/\D/g, "");
    const fullPhone = digits.length === 10 ? `+1${digits}` : phone;
    setManualRequesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-verify", {
        body: { action: "request_manual", phone: fullPhone },
      });
      if (error || data?.error) {
        const msg = await extractErrorMessage(error, data);
        toast({ title: "Error", description: msg, variant: "destructive" });
      } else {
        toast({ title: "Request submitted", description: "An admin will review your verification request." });
        onClose();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setManualRequesting(false);
  };

  const Icon = type === "email" ? Mail : Phone;
  const remainingAttempts = MAX_ATTEMPTS - attempts;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
        >
          <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>

          <div className="text-center mb-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Icon className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground">
              Verify Your {type === "email" ? "Email" : "Phone"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === "send" && type === "email" && "We'll send a 6-digit code to your email address."}
              {step === "send" && type === "phone" && "We'll generate a code for you to send via WhatsApp."}
              {step === "verify" && type === "email" && "Check your email inbox and enter the 6-digit code."}
              {step === "verify" && type === "phone" && "Enter the 6-digit code to verify."}
              {step === "whatsapp-code" && "Send this code to our WhatsApp support to verify your phone."}
              {step === "manual-request" && "Request manual verification from our team."}
            </p>
          </div>

          {/* SEND STEP */}
          {step === "send" && (
            <div className="space-y-4">
              {type === "phone" && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              )}
              <button
                onClick={handleSendOtp}
                disabled={sending || (type === "phone" && phone.replace(/\D/g, "").length < 10)}
                className="w-full rounded-xl gradient-bg py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                {sending ? "Sending..." : type === "email" ? "Send Verification Code" : "Generate Verification Code"}
              </button>

              {type === "phone" && (
                <button
                  onClick={() => setStep("manual-request")}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Don't have WhatsApp? Request manual verification
                </button>
              )}
            </div>
          )}

          {/* EMAIL / PHONE VERIFY STEP (OTP Input) */}
          {step === "verify" && (
            <div className="space-y-5">
              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className="h-12 w-11 sm:w-12 rounded-xl border border-border bg-muted/50 text-center text-lg font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                ))}
              </div>

              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Expires in 5 min
                </span>
                {attempts > 0 && (
                  <span className={remainingAttempts <= 2 ? "text-destructive" : ""}>
                    {remainingAttempts} attempt{remainingAttempts !== 1 ? "s" : ""} left
                  </span>
                )}
              </div>

              <button
                onClick={handleVerify}
                disabled={verifying || otp.join("").length !== 6 || attempts >= MAX_ATTEMPTS}
                className="w-full rounded-xl gradient-bg py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {verifying ? "Verifying..." : "Verify Code"}
              </button>

              <button
                onClick={handleResend}
                disabled={sending || resendCooldown > 0}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive a code? Resend"}
              </button>
            </div>
          )}

          {/* WHATSAPP CODE DISPLAY STEP */}
          {step === "whatsapp-code" && (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-muted/30 p-5 text-center">
                <p className="text-xs text-muted-foreground mb-3">Your verification code</p>
                <div className="text-3xl font-bold tracking-[0.5em] text-foreground font-mono">
                  {phoneOtpCode}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Code expires in 5 minutes</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleCopyCode}
                  className="rounded-xl border border-border bg-muted/50 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy Code"}
                </button>
                <button
                  onClick={handleWhatsAppSend}
                  className="rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle className="h-4 w-4" /> Send via WhatsApp
                </button>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <MessageCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">How to verify via WhatsApp:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Copy the code above or tap "Send via WhatsApp"</li>
                      <li>Send the code to our official WhatsApp number</li>
                      <li>Our team will verify your phone shortly</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setStep("verify"); setOtp(["", "", "", "", "", ""]); }}
                  className="flex-1 rounded-xl border border-border bg-muted/30 py-3 text-sm font-semibold text-foreground hover:bg-muted/60 transition-colors"
                >
                  Enter OTP Myself
                </button>
                <button
                  onClick={() => setStep("manual-request")}
                  className="flex-1 rounded-xl border border-border bg-muted/30 py-3 text-sm font-semibold text-foreground hover:bg-muted/60 transition-colors"
                >
                  No WhatsApp?
                </button>
              </div>
            </div>
          )}

          {/* MANUAL VERIFICATION REQUEST */}
          {step === "manual-request" && (
            <div className="space-y-5">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">Manual Verification</p>
                    <p>If you don't have WhatsApp, you can request manual verification. An admin will review and verify your phone number.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <button
                onClick={handleManualRequest}
                disabled={manualRequesting || phone.replace(/\D/g, "").length < 10}
                className="w-full rounded-xl gradient-bg py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {manualRequesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {manualRequesting ? "Submitting..." : "Request Manual Verification"}
              </button>

              <button
                onClick={() => setStep("send")}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to WhatsApp verification
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
