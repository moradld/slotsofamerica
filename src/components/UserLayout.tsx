import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { VerificationBanner } from "@/components/VerificationBanner";
import { motion, AnimatePresence } from "framer-motion";
import { QuickContactWidget } from "@/components/QuickContactWidget";
import {
  Gamepad2, Menu, X, Bell, CreditCard, LogOut, Settings,
  ChevronDown, DollarSign, Copy, Send, Gift, Banknote, KeyRound, ArrowLeft, Shield, UserCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

const TOP_MENUS = [
  { label: "Deposit", href: "/deposit", icon: DollarSign },
  { label: "Transfer", href: "/transfer", icon: Send },
  { label: "Redeem", href: "/redeem", icon: Gift },
  { label: "Withdraw", href: "/withdraw", icon: Banknote },
];

const BALANCE_DROPDOWN = [
  { label: "Deposit History", href: "/transactions?type=deposit" },
  { label: "Transfer History", href: "/transactions?type=transfer" },
  { label: "Redeem History", href: "/transactions?type=redeem" },
  { label: "Withdraw History", href: "/transactions?type=withdraw" },
];

interface UserLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
}

export function UserLayout({ children, showBackButton }: UserLayoutProps) {
  const { user, signOut, role } = useAuth();
  const isAdminOrManager = role === "admin" || role === "manager";
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [balanceDropdown, setBalanceDropdown] = useState(false);
  const [notifDropdown, setNotifDropdown] = useState(false);
  const [profile, setProfile] = useState<{ username: string | null; display_name: string | null; balance: number; avatar_url: string | null } | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const balanceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifDropdown(false);
      if (balanceRef.current && !balanceRef.current.contains(e.target as Node)) setBalanceDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [profileRes, notifRes] = await Promise.all([
      supabase.from("profiles").select("username, display_name, balance, avatar_url").eq("id", user.id).maybeSingle(),
      supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    ]);
    if (profileRes.data) setProfile(profileRes.data);
    if (notifRes.data) setNotifications(notifRes.data as NotificationItem[]);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const displayName = profile?.display_name || profile?.username || "Player";
  const userBalance = profile?.balance ?? 0;
  const userId = user?.id?.substring(0, 8).toUpperCase() || "---";

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ─── TOP NAV ─── */}
      <header className="sticky top-0 z-50 glass border-b border-border">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            {showBackButton && (
              <button onClick={() => navigate("/home")} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <Link to="/home" className="flex items-center gap-2">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt={settings.site_name} className="h-14 max-w-[200px] object-contain py-[5px]" />
              ) : (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-bg shadow-lg">
                    <Gamepad2 className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="hidden sm:inline font-display text-lg font-bold tracking-wider gradient-text">
                    {settings.site_name || "SOA"}
                  </span>
                </>
              )}
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {TOP_MENUS.map((m) => (
                <Link
                  key={m.label}
                  to={m.href}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {m.label}
                </Link>
              ))}
              {isAdminOrManager && (
                <Link
                  to={role === "manager" ? "/admin/game-access" : "/admin"}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 transition-colors flex items-center gap-1"
                >
                  <Shield className="h-3 w-3" />
                  {role === "manager" ? "Manager Panel" : "Admin Dashboard"}
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Balance dropdown */}
            <div className="relative" ref={balanceRef}>
              <button
                onClick={() => { setBalanceDropdown(!balanceDropdown); setNotifDropdown(false); }}
                className="flex items-center gap-1 sm:gap-2 rounded-lg border border-border bg-card px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold hover:bg-muted transition-colors"
              >
                <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                <span className="tabular-nums">${userBalance.toFixed(2)}</span>
                <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform hidden sm:block ${balanceDropdown ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {balanceDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                    className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card p-2 shadow-lg z-50"
                  >
                    {BALANCE_DROPDOWN.map((item) => (
                      <Link
                        key={item.label}
                        to={item.href}
                        onClick={() => setBalanceDropdown(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile avatar - navigates to settings */}
            <button
              onClick={() => navigate("/settings")}
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors shrink-0"
              title="Profile Settings"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover border border-border" />
              ) : (
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full gradient-bg flex items-center justify-center text-[10px] sm:text-xs font-bold text-primary-foreground">
                  {(displayName?.[0] || "U").toUpperCase()}
                </div>
              )}
            </button>

            {/* Notification dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setNotifDropdown(!notifDropdown); setBalanceDropdown(false); }}
                className="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
              >
                <Bell className="h-5 w-5" />
                {notifications.some((n) => !n.is_read) && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full gradient-bg animate-pulse-glow" />
                )}
              </button>
              <AnimatePresence>
                {notifDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                    className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-80 rounded-xl border border-border bg-card shadow-xl z-50"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold">Notifications</p>
                      <Link to="/notifications" onClick={() => setNotifDropdown(false)} className="text-xs text-primary hover:underline">
                        View all
                      </Link>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">No notifications</p>
                      ) : (
                        notifications.slice(0, 5).map((n) => (
                          <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 ${n.is_read ? "" : "bg-primary/5"}`}>
                            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${n.is_read ? "bg-muted" : "bg-primary/10"}`}>
                              <Bell className={`h-3.5 w-3.5 ${n.is_read ? "text-muted-foreground" : "text-primary"}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium leading-tight">{n.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                            </div>
                            {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full gradient-bg" />}
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            >
              <Menu className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── SIDEBAR DRAWER ─── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-72 border-l border-border bg-card shadow-2xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="h-10 w-10 rounded-full object-cover border border-border" />
                  ) : (
                    <div className="h-10 w-10 rounded-full gradient-bg flex items-center justify-center text-sm font-bold text-primary-foreground">
                      {(displayName?.[0] || "U").toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold">{displayName}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      ID: {userId}
                      <button onClick={() => navigator.clipboard.writeText(userId)}><Copy className="h-3 w-3" /></button>
                    </p>
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="p-3 space-y-1">
                {/* Admin Dashboard link for admin/manager */}
                {isAdminOrManager && (
                  <>
                    <Link to={role === "manager" ? "/admin/game-access" : "/admin"} onClick={() => setSidebarOpen(false)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors">
                      <Shield className="h-4 w-4" /> {role === "manager" ? "Manager Panel" : "Admin Dashboard"}
                    </Link>
                    <div className="border-t border-border my-2" />
                  </>
                )}
                {/* Mobile-only transaction links */}
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest md:hidden">Actions</p>
                {TOP_MENUS.map(({ label, href, icon: Icon }) => (
                  <Link key={label} to={href} onClick={() => setSidebarOpen(false)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors md:hidden">
                    <Icon className="h-4 w-4" /> {label}
                  </Link>
                ))}
                <div className="border-t border-border my-2 md:hidden" />

                {[
                  { icon: Bell, label: "Notifications", badge: notifications.filter((n) => !n.is_read).length || undefined, href: "/notifications" },
                  { icon: CreditCard, label: "Transactions", href: "/transactions" },
                  { icon: KeyRound, label: "Password Requests", href: "/password-requests" },
                  { icon: Settings, label: "Profile Settings", href: "/settings" },
                ].map(({ icon: Icon, label, badge, href }) => (
                  <Link key={label} to={href} onClick={() => setSidebarOpen(false)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <span className="flex items-center gap-3"><Icon className="h-4 w-4" />{label}</span>
                    {badge && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full gradient-bg text-[10px] font-bold text-primary-foreground">{badge}</span>
                    )}
                  </Link>
                ))}

                <div className="border-t border-border my-2" />
                <button
                  onClick={() => { setSidebarOpen(false); handleLogout(); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ─── VERIFICATION BANNER ─── */}
      <VerificationBanner />

      {/* ─── PAGE CONTENT ─── */}
      {children}

      {/* ─── QUICK CONTACT WIDGET ─── */}
      <QuickContactWidget />
    </div>
  );
}
