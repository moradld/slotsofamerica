import { useState, useEffect, useCallback } from "react";
import { Bell, Loader2, Check, CheckCheck, Clock, AlertTriangle, CheckCircle, Info, Send, Users, User, Gamepad2, KeyRound, ArrowDownLeft, ArrowUpRight, RefreshCw, DollarSign, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  is_read: boolean;
  created_at: string;
}

interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
}

const CATEGORIES = [
  { key: "all", label: "All", icon: Bell },
  { key: "game_access", label: "Game Access", icon: Gamepad2 },
  { key: "password_request", label: "Password", icon: KeyRound },
  { key: "deposit", label: "Deposit", icon: ArrowDownLeft },
  { key: "transfer", label: "Transfer", icon: ArrowUpRight },
  { key: "redeem", label: "Redeem", icon: RefreshCw },
  { key: "withdraw", label: "Withdraw", icon: DollarSign },
  { key: "system", label: "System", icon: Megaphone },
  { key: "other", label: "Other", icon: Info },
];

const typeStyles: Record<string, string> = {
  success: "border-green-500/30 bg-green-500/5 hover:border-green-500/50",
  warning: "border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50",
  info: "border-primary/30 bg-primary/5 hover:border-primary/50",
};

const typeStylesRead: Record<string, string> = {
  success: "border-border bg-card hover:border-green-500/20 hover:bg-green-500/5",
  warning: "border-border bg-card hover:border-yellow-500/20 hover:bg-yellow-500/5",
  info: "border-border bg-card hover:border-primary/20 hover:bg-primary/5",
};

const typeIcon: Record<string, string> = {
  success: "bg-green-500/10 text-green-400",
  warning: "bg-yellow-500/10 text-yellow-400",
  info: "bg-primary/10 text-primary",
};

const typeDetailBg: Record<string, string> = {
  success: "bg-green-500/5 border-green-500/20",
  warning: "bg-yellow-500/5 border-yellow-500/20",
  info: "bg-primary/5 border-primary/20",
};

const typeLabelMap: Record<string, string> = {
  success: "Success",
  warning: "Warning",
  info: "Information",
};

const categoryLabelMap: Record<string, string> = {
  game_access: "Game Access",
  password_request: "Password Request",
  deposit: "Deposit",
  transfer: "Transfer",
  redeem: "Redeem",
  withdraw: "Withdraw",
  system: "System",
  other: "Other",
};

const CategoryIcon = ({ category, className }: { category: string; className?: string }) => {
  const cat = CATEGORIES.find(c => c.key === category);
  if (!cat) return <Bell className={className} />;
  const Icon = cat.icon;
  return <Icon className={className} />;
};

const TypeIconComponent = ({ type, className }: { type: string; className?: string }) => {
  switch (type) {
    case "success": return <CheckCircle className={className} />;
    case "warning": return <AlertTriangle className={className} />;
    default: return <Info className={className} />;
  }
};

const Notifications = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");

  // Admin create notification state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createMessage, setCreateMessage] = useState("");
  const [createType, setCreateType] = useState("info");
  const [createTarget, setCreateTarget] = useState<"all" | "specific">("all");
  const [createUserId, setCreateUserId] = useState("");
  const [sending, setSending] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserProfile[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setNotifications((data as Notification[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast({ title: "All notifications marked as read" });
  };

  const handleCardClick = (n: Notification) => {
    setSelectedNotification(n);
    if (!n.is_read) markAsRead(n.id);
  };

  // Admin: search users
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) { setUserResults([]); return; }
    setSearchingUsers(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, email")
      .or(`username.ilike.%${query}%,email.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(10);
    setUserResults((data as UserProfile[]) || []);
    setSearchingUsers(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (userSearch) searchUsers(userSearch); }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, searchUsers]);

  const handleSendNotification = async () => {
    if (!createTitle.trim() || !createMessage.trim()) {
      toast({ title: "Error", description: "Title and message are required", variant: "destructive" });
      return;
    }
    if (createTarget === "specific" && !createUserId) {
      toast({ title: "Error", description: "Please select a user", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.rpc("admin_send_notification", {
        _title: createTitle.trim(),
        _message: createMessage.trim(),
        _type: createType,
        _category: "system",
        _target_user_id: createTarget === "specific" ? createUserId : null,
      });
      if (error) throw error;
      toast({ title: "Notification Sent!", description: `Sent to ${data} user(s)` });
      setShowCreateModal(false);
      setCreateTitle("");
      setCreateMessage("");
      setCreateType("info");
      setCreateTarget("all");
      setCreateUserId("");
      setUserSearch("");
      fetchNotifications();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const filtered = activeCategory === "all"
    ? notifications
    : notifications.filter(n => n.category === activeCategory);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Count per category for badges
  const categoryCounts = CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    if (cat.key === "all") {
      acc[cat.key] = notifications.filter(n => !n.is_read).length;
    } else {
      acc[cat.key] = notifications.filter(n => n.category === cat.key && !n.is_read).length;
    }
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-wide">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "You're all caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-lg gradient-bg px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity shadow-md shadow-primary/20"
            >
              <Send className="h-4 w-4" />
              Send Notification
            </button>
          )}
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const count = categoryCounts[cat.key] || 0;
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                isActive
                  ? "gradient-bg text-primary-foreground"
                  : "border border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {cat.label}
              {count > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notifications Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center glow-card">
          <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {activeCategory === "all" ? "No notifications yet." : `No ${categoryLabelMap[activeCategory] || activeCategory} notifications.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((n) => (
            <div
              key={n.id}
              onClick={() => handleCardClick(n)}
              className={`relative cursor-pointer rounded-2xl border p-5 transition-all duration-200 group ${
                n.is_read
                  ? typeStylesRead[n.type] || typeStylesRead.info
                  : typeStyles[n.type] || typeStyles.info
              }`}
            >
              {!n.is_read && (
                <span className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full gradient-bg shadow-sm shadow-primary/30" />
              )}

              <div className="flex items-center gap-2 mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  n.is_read ? "bg-muted" : typeIcon[n.type] || typeIcon.info
                }`}>
                  <CategoryIcon category={n.category} className={`h-5 w-5 ${n.is_read ? "text-muted-foreground" : ""}`} />
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                  n.is_read ? "border-border bg-muted/50 text-muted-foreground" : "border-current/20 opacity-70"
                }`}>
                  {categoryLabelMap[n.category] || n.category}
                </span>
              </div>

              <h3 className="text-sm font-semibold text-foreground line-clamp-1 mb-1">{n.title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{n.message}</p>

              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/50">
                <Clock className="h-3 w-3 text-muted-foreground/60" />
                <span className="text-[11px] text-muted-foreground/60">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </span>
              </div>

              {!n.is_read && (
                <button
                  onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                  className="absolute bottom-3 right-3 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100"
                  title="Mark as read"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedNotification} onOpenChange={() => setSelectedNotification(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-display tracking-wide">Notification Details</DialogTitle>
          </DialogHeader>
          {selectedNotification && (
            <div className="space-y-5">
              <div className={`flex items-center gap-3 rounded-xl border p-4 ${typeDetailBg[selectedNotification.type] || typeDetailBg.info}`}>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${typeIcon[selectedNotification.type] || typeIcon.info}`}>
                  <CategoryIcon category={selectedNotification.category} className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider opacity-80">
                      {categoryLabelMap[selectedNotification.category] || selectedNotification.category}
                    </span>
                    <span className="rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider opacity-60">
                      {typeLabelMap[selectedNotification.type] || "Notification"}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-foreground">{selectedNotification.title}</h3>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1.5 block">Message</label>
                  <div className="rounded-lg bg-muted/30 border border-border p-4">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selectedNotification.message}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1.5 block">Date & Time</label>
                    <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                      <p className="text-sm font-medium text-foreground">
                        {format(new Date(selectedNotification.created_at), "MMM dd, yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(selectedNotification.created_at), "hh:mm:ss a")}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1.5 block">Status</label>
                    <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                      <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        {selectedNotification.is_read ? (
                          <><CheckCheck className="h-3.5 w-3.5 text-green-400" /> Read</>
                        ) : (
                          <><span className="h-2 w-2 rounded-full gradient-bg" /> Unread</>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(selectedNotification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1.5 block">Category</label>
                    <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                      <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <CategoryIcon category={selectedNotification.category} className="h-3.5 w-3.5" />
                        {categoryLabelMap[selectedNotification.category] || selectedNotification.category}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1.5 block">Type</label>
                    <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                      <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <TypeIconComponent type={selectedNotification.type} className="h-3.5 w-3.5" />
                        {typeLabelMap[selectedNotification.type] || selectedNotification.type}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1.5 block">Notification ID</label>
                  <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                    <p className="text-[11px] font-mono text-muted-foreground break-all">{selectedNotification.id}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Create Notification Dialog */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-display tracking-wide flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Send Notification
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Target */}
            <div>
              <label className="text-xs font-medium text-foreground mb-2 block">Send To</label>
              <div className="flex gap-2">
                <button
                  onClick={() => { setCreateTarget("all"); setCreateUserId(""); setUserSearch(""); }}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
                    createTarget === "all" ? "gradient-bg text-primary-foreground border-transparent" : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Users className="h-4 w-4" /> All Users
                </button>
                <button
                  onClick={() => setCreateTarget("specific")}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
                    createTarget === "specific" ? "gradient-bg text-primary-foreground border-transparent" : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <User className="h-4 w-4" /> Specific User
                </button>
              </div>
            </div>

            {/* User Search */}
            {createTarget === "specific" && (
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Search User</label>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by username or email..."
                  className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {searchingUsers && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-2" />}
                {userResults.length > 0 && (
                  <div className="mt-2 rounded-lg border border-border bg-card max-h-40 overflow-y-auto">
                    {userResults.map(u => (
                      <button
                        key={u.id}
                        onClick={() => { setCreateUserId(u.id); setUserSearch(u.username || u.display_name || u.email || ""); setUserResults([]); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors border-b border-border last:border-0 ${
                          createUserId === u.id ? "bg-primary/10" : ""
                        }`}
                      >
                        <span className="font-medium text-foreground">{u.username || u.display_name || "—"}</span>
                        <span className="text-muted-foreground ml-2">{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                {createUserId && (
                  <p className="text-[11px] text-green-400 mt-1 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> User selected
                  </p>
                )}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Title</label>
              <input
                type="text"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Notification title..."
                className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Message */}
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Message</label>
              <textarea
                value={createMessage}
                onChange={(e) => setCreateMessage(e.target.value)}
                placeholder="Write the notification message..."
                rows={4}
                className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-xs font-medium text-foreground mb-2 block">Notification Type</label>
              <div className="flex gap-2">
                {([
                  { value: "info", label: "Info", icon: Info, cls: "text-primary border-primary/30 bg-primary/10" },
                  { value: "success", label: "Success", icon: CheckCircle, cls: "text-green-400 border-green-500/30 bg-green-500/10" },
                  { value: "warning", label: "Warning", icon: AlertTriangle, cls: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" },
                ] as const).map(t => (
                  <button
                    key={t.value}
                    onClick={() => setCreateType(t.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                      createType === t.value ? t.cls : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSendNotification}
              disabled={sending || !createTitle.trim() || !createMessage.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl gradient-bg px-4 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity shadow-md shadow-primary/20 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {createTarget === "all" ? "Send to All Users" : "Send to User"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Notifications;
