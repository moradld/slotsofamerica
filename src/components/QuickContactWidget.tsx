import { useState, useEffect, useRef, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import livechatIcon from "@/assets/livechat-icon-sm.png";
import { ChannelIcon } from "@/components/ChannelIcons";

interface Channel {
  id: string;
  name: string;
  icon: string;
  link: string;
  sort_order: number;
}

type DisplayMode = "icons_only" | "icons_with_text";
type WidgetPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "custom";

interface CustomPosition {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

const POSITION_CLASSES: Record<string, string> = {
  "bottom-right": "fixed bottom-20 right-4 sm:bottom-24 sm:right-6 items-end",
  "bottom-left": "fixed bottom-20 left-4 sm:bottom-24 sm:left-6 items-start",
  "top-right": "fixed top-20 right-4 sm:top-24 sm:right-6 items-end",
  "top-left": "fixed top-20 left-4 sm:top-24 sm:left-6 items-start",
};

const PanelContent = ({
  iconsOnly,
  headerTitle,
  channels,
  sanitizeLink,
  handleOpenPancake,
  animateY,
}: {
  iconsOnly: boolean;
  headerTitle: string;
  channels: Channel[];
  sanitizeLink: (link: string) => string;
  handleOpenPancake: () => void;
  animateY: number;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: animateY, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: animateY, scale: 0.95 }}
      transition={{ type: "spring", damping: 22, stiffness: 300 }}
      className={`${animateY > 0 ? "mb-3" : "mt-3"} rounded-2xl border border-border bg-card shadow-2xl overflow-hidden ${iconsOnly ? "w-auto" : "w-56"}`}
    >
      {headerTitle && (
        <div className="px-3 pt-2.5 pb-1">
          <p className="text-xs font-semibold text-muted-foreground">{headerTitle}</p>
        </div>
      )}
      <div className="p-2">
        <div className={iconsOnly ? "flex flex-col items-center gap-1.5" : "flex flex-col gap-1"}>
          {/* Live Chat */}
          <button
            onClick={handleOpenPancake}
            title="Live Chat"
            className={iconsOnly
              ? "flex h-11 w-11 items-center justify-center rounded-xl bg-white hover:bg-gray-100 transition-colors"
              : "flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-primary/10 transition-colors w-full"
            }
          >
            <div className={iconsOnly ? "" : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white"}>
              <img src={livechatIcon} alt="Live Chat" className="h-7 w-7 rounded-full object-cover" />
            </div>
            {!iconsOnly && <span className="text-sm font-medium">Live Chat</span>}
          </button>

          {channels.map((ch) => (
            <a
              key={ch.id}
              href={sanitizeLink(ch.link)}
              target="_blank"
              rel="noopener noreferrer"
              title={ch.name}
              className={iconsOnly
                ? "flex h-11 w-11 items-center justify-center rounded-xl bg-muted hover:bg-muted/70 transition-colors"
                : "flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-primary/10 transition-colors w-full"
              }
            >
              <div className={iconsOnly ? "" : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted"}>
                <ChannelIcon iconKey={ch.icon} className="h-5 w-5" colored />
              </div>
              {!iconsOnly && <span className="text-sm font-medium">{ch.name}</span>}
            </a>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export const QuickContactWidget = forwardRef<HTMLDivElement>(function QuickContactWidget(_props, ref) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [open, setOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("icons_only");
  const [buttonLabel, setButtonLabel] = useState("More");
  const [headerTitle, setHeaderTitle] = useState("");
  const [position, setPosition] = useState<WidgetPosition>("bottom-right");
  const [customPosition, setCustomPosition] = useState<CustomPosition>({});
  const [buttonColor, setButtonColor] = useState("");
  const [textColor, setTextColor] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      supabase
        .from("support_channels")
        .select("id, name, icon, link, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["contact_display_mode", "contact_button_label", "contact_header_title", "contact_widget_position", "contact_button_color", "contact_text_color"]),
    ]).then(([channelsRes, settingsRes]) => {
      if (channelsRes.data) setChannels(channelsRes.data);
      if (settingsRes.data) {
        for (const s of settingsRes.data) {
          if (s.key === "contact_display_mode" && s.value === "icons_with_text") setDisplayMode("icons_with_text");
          if (s.key === "contact_button_label" && s.value) setButtonLabel(s.value);
          if (s.key === "contact_header_title") setHeaderTitle(s.value);
          if (s.key === "contact_widget_position" && s.value) {
            try {
              const parsed = JSON.parse(s.value);
              if (typeof parsed === "object" && parsed !== null) {
                setPosition("custom");
                setCustomPosition(parsed);
              } else {
                setPosition(s.value as WidgetPosition);
              }
            } catch {
              setPosition(s.value as WidgetPosition);
            }
          }
          if (s.key === "contact_button_color" && s.value) setButtonColor(s.value);
          if (s.key === "contact_text_color" && s.value) setTextColor(s.value);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (channels.length === 0) return null;

  const sanitizeLink = (link: string) => {
    const trimmed = link.trim();
    if (trimmed.toLowerCase().startsWith("javascript:")) return "#";
    if (/^(https?:|mailto:|tel:|viber:|tg:)/i.test(trimmed)) return trimmed;
    try { new URL(trimmed); return trimmed; } catch { return "#"; }
  };

  const handleOpenPancake = () => {
    try { (window as any).PancakeChatPlugin?.openChatBox?.(); } catch {}
    setOpen(false);
  };

  const iconsOnly = displayMode === "icons_only";
  const isBottom = position === "custom"
    ? !!customPosition.bottom || !customPosition.top
    : position.startsWith("bottom");

  const isCustom = position === "custom";
  const customStyle: React.CSSProperties = isCustom
    ? {
        ...(customPosition.top ? { top: `${customPosition.top}px` } : {}),
        ...(customPosition.bottom ? { bottom: `${customPosition.bottom}px` } : {}),
        ...(customPosition.left ? { left: `${customPosition.left}px` } : {}),
        ...(customPosition.right ? { right: `${customPosition.right}px` } : {}),
      }
    : {};

  const alignClass = isCustom
    ? (customPosition.right ? "items-end" : "items-start")
    : "";

  return (
    <div
      ref={(node) => {
        (panelRef as any).current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as any).current = node;
      }}
      className={`z-[45] flex flex-col ${isCustom ? `fixed ${alignClass}` : POSITION_CLASSES[position]}`}
      style={isCustom ? customStyle : undefined}
    >
      {/* Panel above button for bottom positions, below for top */}
      {isBottom && (
        <AnimatePresence>
          {open && (
            <PanelContent
              iconsOnly={iconsOnly}
              headerTitle={headerTitle}
              channels={channels}
              sanitizeLink={sanitizeLink}
              handleOpenPancake={handleOpenPancake}
              animateY={20}
            />
          )}
        </AnimatePresence>
      )}

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        style={{
          ...(buttonColor ? { backgroundColor: buttonColor } : {}),
          ...(textColor ? { color: textColor } : {}),
        }}
        className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-lg hover:shadow-xl transition-shadow ${!buttonColor ? "gradient-bg" : ""} ${!textColor ? "text-primary-foreground" : ""}`}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        <span>{buttonLabel}</span>
      </motion.button>

      {!isBottom && (
        <AnimatePresence>
          {open && (
            <PanelContent
              iconsOnly={iconsOnly}
              headerTitle={headerTitle}
              channels={channels}
              sanitizeLink={sanitizeLink}
              handleOpenPancake={handleOpenPancake}
              animateY={-20}
            />
          )}
        </AnimatePresence>
      )}
    </div>
  );
});
