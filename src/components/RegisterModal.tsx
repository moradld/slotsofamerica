import { useState, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, EyeOff, Eye, Gamepad2, Loader2 } from "lucide-react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { registerSchema, parseApiError } from "@/lib/validation";

interface RegisterModalProps {
  open: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

const RegisterModal = ({ open, onClose, onSwitchToLogin }: RegisterModalProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [ageConfirm, setAgeConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!acceptTerms) {
      setError("Please accept the Terms and Conditions.");
      return;
    }
    if (!ageConfirm) {
      setError("You must be 21+ years old to register.");
      return;
    }

    // Auto-generate username: take part before @, replace non-alphanumeric/underscore chars, ensure not empty
    const rawUsername = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "") || "user";
    const result = registerSchema.safeParse({ username: rawUsername, email, password });
    if (!result.success) {
      setError(result.error.errors[0]?.message || "Invalid input");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const { error: authError } = await signUp(result.data.email, result.data.password, result.data.username);
      if (authError) {
        setError(parseApiError(authError));
        setLoading(false);
        return;
      }
      onClose();
      navigate("/home");
    } catch (err) {
      setError(parseApiError(err));
    }
    setLoading(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-md"
          >
            {/* Character / Logo topper */}
            <div className="flex justify-center -mb-8 relative z-10">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt={settings.site_name} className="h-14 max-w-[180px] object-contain drop-shadow-lg" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full gradient-bg shadow-lg ring-4 ring-card">
                  <Gamepad2 className="h-8 w-8 text-primary-foreground" />
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card pt-12 pb-8 px-8 shadow-2xl max-h-[85vh] overflow-y-auto">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-14 right-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Header */}
              <h2 className="text-center font-display text-xl font-black tracking-wider">
                REGISTER TO PLAY NOW
              </h2>

              {/* Error placeholder */}
              {error && (
                <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Your email address"
                      className="w-full rounded-lg border border-input bg-muted/50 px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    />
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      className="w-full rounded-lg border border-input bg-muted/50 px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full rounded-lg border border-input bg-muted/50 px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-input bg-muted/50 accent-primary"
                    />
                    <span className="text-sm text-muted-foreground">
                      I accept the{" "}
                      <span className="text-primary hover:underline cursor-pointer">Terms and Conditions</span>
                      {" | "}
                      <span className="text-primary hover:underline cursor-pointer">Privacy Policy</span>
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ageConfirm}
                      onChange={(e) => setAgeConfirm(e.target.checked)}
                      className="h-4 w-4 rounded border-input bg-muted/50 accent-primary"
                    />
                    <span className="text-sm text-muted-foreground">I am 21+ years old</span>
                  </label>
                </div>

                {/* Register button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg gradient-bg py-3.5 text-sm font-bold text-primary-foreground shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Register Now
                </button>
              </form>

              {/* Footer */}
              <div className="mt-5 text-center space-y-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  By clicking "Register Now", you agree to {settings.site_name || "Slots of America"} Terms and Privacy Policy,
                  and consent to receive Emails and SMS for updates and marketing.
                </p>
                <p className="text-xs text-muted-foreground">
                  Already have an account?{" "}
                  <button onClick={onSwitchToLogin} className="text-primary hover:underline font-medium">
                    Login
                  </button>
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RegisterModal;
