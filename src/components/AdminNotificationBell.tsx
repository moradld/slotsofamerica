import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X, Check, CheckCheck, Gamepad2, Key, DollarSign, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  user_id: string | null;
  transaction_id: string | null;
  status: string;
  created_at: string;
}

const NOTIFICATION_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  transaction: { icon: DollarSign, color: "from-emerald-500 to-emerald-600" },
  game_access: { icon: Gamepad2, color: "from-sky-500 to-sky-600" },
  password_request: { icon: Key, color: "from-amber-500 to-amber-600" },
};

export const AdminNotificationBell = React.forwardRef<HTMLDivElement>(function AdminNotificationBell(_props, ref) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Preload audio
  useEffect(() => {
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.volume = 0.5;
    audio.load();
    audioRef.current = audio;
  }, []);

  const playSound = useCallback(() => {
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } catch {}
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const showDesktopNotification = useCallback((title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      const n = new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: "admin-alert-" + Date.now(),
      });
      n.onclick = () => { window.focus(); n.close(); };
    }
  }, []);

  // Fetch existing notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("admin_notifications" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setNotifications(data as unknown as AdminNotification[]);
    };
    fetchNotifications();
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("admin-notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        (payload) => {
          const newNotif = payload.new as AdminNotification;
          setNotifications((prev) => [newNotif, ...prev].slice(0, 50));
          playSound();
          showDesktopNotification(newNotif.title, newNotif.message);
          toast({
            title: newNotif.title,
            description: newNotif.message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playSound, showDesktopNotification]);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  const markAsRead = async (id: string) => {
    await supabase.from("admin_notifications" as any).update({ status: "read" } as any).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, status: "read" } : n));
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => n.status === "unread").map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("admin_notifications" as any).update({ status: "read" } as any).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, status: "read" })));
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="relative" ref={(node) => {
      (panelRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full gradient-bg px-1 text-[10px] font-bold text-primary-foreground shadow-lg shadow-primary/30 animate-pulse-glow">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 z-50 w-[380px] max-h-[500px] rounded-2xl border border-border bg-card shadow-2xl shadow-black/20 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="rounded-full gradient-bg px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const config = typeConfig[n.type] || { icon: AlertCircle, color: "from-muted to-muted" };
                  const Icon = config.icon;
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer",
                        n.status === "unread" && "bg-primary/5"
                      )}
                      onClick={() => n.status === "unread" && markAsRead(n.id)}
                    >
                      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow-sm", config.color)}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn("text-sm font-semibold truncate", n.status === "unread" ? "text-foreground" : "text-muted-foreground")}>
                            {n.title}
                          </p>
                          {n.status === "unread" && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      {n.status === "unread" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                          className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Mark as read"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
