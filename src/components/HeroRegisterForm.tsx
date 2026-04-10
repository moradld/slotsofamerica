import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, EyeOff, Eye, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { registerSchema, parseApiError } from "@/lib/validation";

interface HeroRegisterFormProps {
  onSwitchToLogin: () => void;
}

const HeroRegisterForm = ({ onSwitchToLogin }: HeroRegisterFormProps) => {
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
      navigate("/home");
    } catch (err) {
      setError(parseApiError(err));
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="w-full max-w-md"
    >
      <div className="rounded-2xl border border-border/40 glass-card p-6 sm:p-8 shadow-2xl sm:max-w-none max-w-md mx-auto" style={{ boxShadow: 'var(--shadow-glow-strong)' }}>
        <h3 className="font-display text-lg font-bold tracking-wider text-center gradient-text mb-1">
          CREATE YOUR ACCOUNT
        </h3>
        <p className="text-xs text-muted-foreground text-center mb-5">
          Join thousands of winners — it's free to start
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full rounded-lg border border-input bg-muted/50 px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-lg border border-input bg-muted/50 px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full rounded-lg border border-input bg-muted/50 px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showConfirm ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input bg-muted/50 accent-primary"
              />
              <span className="text-xs text-muted-foreground">
                I accept the{" "}
                <span className="text-primary hover:underline cursor-pointer">Terms & Conditions</span>
                {" and "}
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
              <span className="text-xs text-muted-foreground">I am 21+ years old</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group w-full btn-glow rounded-xl gradient-bg py-3.5 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/25 hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Register Now — It's Free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <button onClick={onSwitchToLogin} className="text-primary hover:underline font-medium">
            Login here
          </button>
        </p>
      </div>
    </motion.div>
  );
};

export default HeroRegisterForm;
