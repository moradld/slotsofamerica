import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setupChatBubbleInterceptor } from "@/lib/openChatWithProfile";
import type { User, Session } from "@supabase/supabase-js";

const ACTIVITY_KEY = "lc_last_activity";
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

type AppRole = "admin" | "manager" | "user";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signUp: (email: string, password: string, username?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    try {
      // Fetch all roles for this user — in case of duplicates, prioritize admin > manager > user
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      
      if (!data || data.length === 0) {
        setRole("user");
        return;
      }

      const roles = data.map((r) => r.role as AppRole);
      // Priority: admin > manager > user
      if (roles.includes("admin")) {
        setRole("admin");
      } else if (roles.includes("manager")) {
        setRole("manager");
      } else {
        setRole("user");
      }
    } catch {
      setRole("user");
    }
  };

  // Track user activity to reset the 24h timer
  const updateActivity = useCallback(() => {
    localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
  }, []);

  // Check if session has expired due to inactivity
  const isSessionExpired = useCallback(() => {
    const last = localStorage.getItem(ACTIVITY_KEY);
    if (!last) return false;
    return Date.now() - parseInt(last, 10) > SESSION_TIMEOUT_MS;
  }, []);

  useEffect(() => {
    let isMounted = true;
    let activityInterval: ReturnType<typeof setInterval>;

    // Listener for ONGOING auth changes (does NOT control loading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          updateActivity();
          setTimeout(() => fetchRole(session.user.id), 0);
        } else {
          setRole(null);
        }
      }
    );

    // INITIAL load — check inactivity before restoring session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        // If there's a session but user was inactive for 24h+, force sign out
        if (session?.user && isSessionExpired()) {
          localStorage.removeItem(ACTIVITY_KEY);
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setRole(null);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          updateActivity();
          await fetchRole(session.user.id);
          setupChatBubbleInterceptor();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    // Track activity via user interactions
    const handleActivity = () => updateActivity();
    window.addEventListener("click", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("scroll", handleActivity);

    // Periodically check for inactivity timeout (every 5 min)
    activityInterval = setInterval(async () => {
      if (user && isSessionExpired()) {
        localStorage.removeItem(ACTIVITY_KEY);
        setUser(null);
        setSession(null);
        setRole(null);
        setLoading(false);
        await supabase.auth.signOut();
      }
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      clearInterval(activityInterval);
    };
  }, []);

  const signUp = async (email: string, password: string, username?: string) => {
    try {
      const visitorToken = localStorage.getItem("lc_visitor_token") || undefined;

      const { data, error: invokeError } = await supabase.functions.invoke("custom-signup", {
        body: {
          email,
          password,
          username: username || email.split("@")[0],
          redirectTo: window.location.origin,
          visitor_token: visitorToken,
        },
      });

      if (invokeError) {
        return { error: invokeError.message };
      }

      if (data?.success === false || data?.message) {
        return { error: data.message || data.error || "Registration failed" };
      }

      // Auto-login: if the edge function returned a session, set it
      if (data?.session?.access_token && data?.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || "Registration failed" };
    }
  };

  const signIn = async (emailOrUsername: string, password: string) => {
    let loginEmail = emailOrUsername;
    if (!emailOrUsername.includes("@")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("username", emailOrUsername)
        .maybeSingle();
      if (!profile?.email) return { error: "No account found with that username" };
      loginEmail = profile.email;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    // Clear state BEFORE the async call to prevent stale renders
    setUser(null);
    setSession(null);
    setRole(null);
    setLoading(false);
    localStorage.removeItem(ACTIVITY_KEY);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
