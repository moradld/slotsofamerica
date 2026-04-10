import { useState, useEffect } from "react";
import { Loader2, Upload, Save, Palette, Code, Globe, FileCode, Trash2, Type, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

const TABS = [
  { key: "brand", label: "Brand", icon: Upload },
  { key: "colors", label: "Colors", icon: Palette },
  { key: "fonts", label: "Fonts", icon: Type },
  { key: "seo", label: "SEO", icon: Globe },
  { key: "scripts", label: "Scripts", icon: Code },
  { key: "css", label: "Custom CSS", icon: FileCode },
] as const;

type TabKey = typeof TABS[number]["key"];

// Simplified 6-color system for easy admin customization
const SIMPLE_COLORS = [
  { key: "primary", label: "Primary", description: "Main brand color — buttons, links, highlights" },
  { key: "primary-foreground", label: "Button Text", description: "Text color on buttons and primary elements" },
  { key: "secondary", label: "Secondary", description: "Accent color — badges, gradients, hover effects" },
  { key: "background", label: "Background", description: "Page background color" },
  { key: "foreground", label: "Text", description: "Main text color across the site" },
  { key: "card", label: "Cards & Panels", description: "Background color for cards, modals, and panels" },
];

const AdminSiteSettings = () => {
  const { settings, refetch } = useSiteSettings();
  const [tab, setTab] = useState<TabKey>("brand");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [siteName, setSiteName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [headerScripts, setHeaderScripts] = useState("");
  const [bodyScripts, setBodyScripts] = useState("");
  const [footerScripts, setFooterScripts] = useState("");
  const [customCss, setCustomCss] = useState("");
  
  const [fonts, setFonts] = useState({ primary: "", secondary: "", button: "" });




  // Load settings into form
  useEffect(() => {
    if (!settings.id) return;
    setSiteName(settings.site_name);
    setLogoUrl(settings.logo_url);
    setFaviconUrl(settings.favicon_url);
    setColors(settings.colors);
    setSeoTitle(settings.seo_title || "");
    setSeoDescription(settings.seo_description || "");
    setSeoKeywords(settings.seo_keywords || "");
    setHeaderScripts(settings.header_scripts);
    setBodyScripts(settings.body_scripts);
    setFooterScripts(settings.footer_scripts);
    setCustomCss(settings.custom_css);
    setFonts(settings.fonts);
  }, [settings]);

  const handleUpload = async (file: File, type: "logo" | "favicon") => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${type}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(path);
    if (type === "logo") setLogoUrl(urlData.publicUrl);
    else setFaviconUrl(urlData.publicUrl);
    setUploading(false);
    toast({ title: `${type === "logo" ? "Logo" : "Favicon"} uploaded` });
  };

  const ensureSettingsRow = async (): Promise<string | null> => {
    if (settings.id) return settings.id;
    // Auto-create a default row if none exists
    const { data, error } = await supabase
      .from("site_settings")
      .insert({ site_name: "GameVault" })
      .select("id")
      .single();
    if (error || !data) {
      toast({ title: "Failed to initialize settings", description: error?.message, variant: "destructive" });
      return null;
    }
    await refetch();
    return data.id;
  };

  const handleSave = async () => {
    setSaving(true);
    const rowId = await ensureSettingsRow();
    if (!rowId) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("site_settings")
      .update({
        site_name: siteName,
        logo_url: logoUrl,
        favicon_url: faviconUrl,
        colors,
        seo_title: seoTitle || null,
        seo_description: seoDescription || null,
        seo_keywords: seoKeywords || null,
        header_scripts: headerScripts,
        body_scripts: bodyScripts,
        footer_scripts: footerScripts,
        custom_css: customCss,
        fonts: fonts as any,
      })
      .eq("id", rowId);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Settings saved successfully" });
      await refetch();
    }
    setSaving(false);
  };

  const updateColor = (key: string, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
  };

  const resetColor = (key: string) => {
    setColors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const hslToHex = (hsl: string): string => {
    try {
      const parts = hsl.trim().split(/\s+/);
      const h = parseFloat(parts[0]);
      const s = parseFloat(parts[1]) / 100;
      const l = parseFloat(parts[2]) / 100;
      const a = s * Math.min(l, 1 - l);
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, "0");
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    } catch {
      return "#000000";
    }
  };

  const hexToHsl = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  const getCurrentHslValue = (key: string): string => {
    if (colors[key]) return colors[key];
    const computed = getComputedStyle(document.documentElement).getPropertyValue(`--${key}`).trim();
    return computed || "0 0% 0%";
  };

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-wide">Site Settings</h1>
          <p className="text-muted-foreground mt-1">Manage branding, colors, SEO, scripts, and navigation</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg gradient-bg px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium capitalize transition-all ${
                tab === t.key
                  ? "gradient-bg text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border border-border bg-card p-6 glow-card">
        {/* Brand Tab */}
        {tab === "brand" && (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-semibold text-foreground">Site Name</label>
              <p className="text-xs text-muted-foreground mb-2">This name appears in the sidebar logo area</p>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="w-full max-w-md rounded-lg border border-input bg-muted/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-foreground">Logo</label>
                <p className="text-xs text-muted-foreground mb-2">Displayed in the sidebar and navbar</p>
                {logoUrl && (
                  <div className="mb-3 p-3 rounded-lg bg-muted/30 border border-border inline-block">
                    <img src={logoUrl} alt="Logo" className="h-16 max-w-[200px] object-contain" />
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-border bg-muted/20 hover:bg-muted/40 px-4 py-3 text-sm text-muted-foreground transition-colors">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {logoUrl ? "Change Logo" : "Upload Logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "logo")}
                  />
                </label>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground">Favicon</label>
                <p className="text-xs text-muted-foreground mb-2">Browser tab icon (recommended: 32x32 or 64x64 PNG)</p>
                {faviconUrl && (
                  <div className="mb-3 p-3 rounded-lg bg-muted/30 border border-border inline-block">
                    <img src={faviconUrl} alt="Favicon" className="h-10 w-10 object-contain" />
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-border bg-muted/20 hover:bg-muted/40 px-4 py-3 text-sm text-muted-foreground transition-colors">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {faviconUrl ? "Change Favicon" : "Upload Favicon"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "favicon")}
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Colors Tab */}
        {tab === "colors" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Theme Colors</h3>
              <p className="text-xs text-muted-foreground mb-6">Pick 5 colors to style your entire site. All other colors are auto-derived.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SIMPLE_COLORS.map((cv) => {
                const currentHsl = getCurrentHslValue(cv.key);
                const hexValue = hslToHex(currentHsl);
                const isOverridden = cv.key in colors;
                return (
                  <div key={cv.key} className={`rounded-xl border p-4 transition-all ${isOverridden ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="relative">
                        <input
                          type="color"
                          value={hexValue}
                          onChange={(e) => updateColor(cv.key, hexToHsl(e.target.value))}
                          className="h-10 w-10 rounded-lg cursor-pointer border-2 border-border bg-transparent"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{cv.label}</p>
                        <p className="text-[11px] text-muted-foreground">{cv.description}</p>
                      </div>
                    </div>
                    {isOverridden && (
                      <button
                        onClick={() => resetColor(cv.key)}
                        className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        Reset to default
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Live preview */}
            <div className="rounded-xl border border-border p-5 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Preview</p>
              <div className="flex flex-wrap gap-3 items-center">
                <button className="rounded-lg gradient-bg px-5 py-2.5 text-sm font-semibold text-primary-foreground">
                  Primary Button
                </button>
                <span className="rounded-full bg-secondary/20 border border-secondary/30 px-3 py-1 text-xs font-medium text-foreground">
                  Secondary Badge
                </span>
                <span className="text-sm text-foreground">Sample Text</span>
                <span className="text-sm text-muted-foreground">Muted Text</span>
              </div>
            </div>
          </div>
        )}

        {/* Fonts Tab */}
        {tab === "fonts" && (
          <div className="space-y-6 max-w-xl">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Typography</h3>
              <p className="text-xs text-muted-foreground mb-4">Set custom Google Fonts for different parts of your site. Leave empty to use defaults (Orbitron / Inter).</p>
            </div>

            {([
              { key: "primary" as const, label: "Primary Font (Headers & Display)", description: "Used for headings, logo text, and display elements", placeholder: "e.g. Orbitron, Montserrat, Bebas Neue" },
              { key: "secondary" as const, label: "Secondary Font (Body Text)", description: "Used for paragraphs, labels, and general content", placeholder: "e.g. Inter, Roboto, Open Sans" },
              { key: "button" as const, label: "Button Font", description: "Used specifically for button text", placeholder: "e.g. Poppins, Raleway, Nunito" },
            ]).map((item) => (
              <div key={item.key} className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{item.label}</label>
                <p className="text-xs text-muted-foreground">{item.description}</p>
                <input
                  type="text"
                  value={fonts[item.key]}
                  onChange={(e) => setFonts((prev) => ({ ...prev, [item.key]: e.target.value }))}
                  placeholder={item.placeholder}
                  className="w-full rounded-lg border border-input bg-muted/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {fonts[item.key] && (
                  <div
                    className="rounded-lg border border-border bg-muted/20 p-4"
                    style={{ fontFamily: `'${fonts[item.key]}', sans-serif` }}
                  >
                    <p className="text-lg font-bold">The quick brown fox jumps over the lazy dog</p>
                    <p className="text-sm mt-1">ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789</p>
                  </div>
                )}
              </div>
            ))}

            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">
                💡 Enter any <a href="https://fonts.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Font</a> name exactly as it appears (e.g. "Bebas Neue", "Space Grotesk"). The font will be loaded automatically.
              </p>
            </div>
          </div>
        )}

        {/* SEO Tab */}
        {tab === "seo" && (
          <div className="space-y-4 max-w-xl">
            <div>
              <label className="text-sm font-semibold text-foreground">Page Title</label>
              <p className="text-xs text-muted-foreground mb-2">Shown in browser tab and search results (max 60 chars)</p>
              <input
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="My Gaming Platform"
                maxLength={60}
                className="w-full rounded-lg border border-input bg-muted/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground">Meta Description</label>
              <p className="text-xs text-muted-foreground mb-2">Shown below title in search results (max 160 chars)</p>
              <textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="Describe your site in 1-2 sentences..."
                maxLength={160}
                rows={3}
                className="w-full rounded-lg border border-input bg-muted/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground">Keywords</label>
              <p className="text-xs text-muted-foreground mb-2">Comma-separated keywords for search engines</p>
              <input
                type="text"
                value={seoKeywords}
                onChange={(e) => setSeoKeywords(e.target.value)}
                placeholder="gaming, online games, entertainment"
                className="w-full rounded-lg border border-input bg-muted/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {/* Scripts Tab */}
        {tab === "scripts" && (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-semibold text-foreground">Header Scripts</label>
              <p className="text-xs text-muted-foreground mb-2">Injected into &lt;head&gt; — analytics, meta tags, etc.</p>
              <textarea
                value={headerScripts}
                onChange={(e) => setHeaderScripts(e.target.value)}
                rows={6}
                placeholder="<!-- Google Analytics, etc. -->"
                className="w-full rounded-lg border border-input bg-muted/50 px-4 py-2.5 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground">Body Scripts</label>
              <p className="text-xs text-muted-foreground mb-2">Injected at the start of &lt;body&gt; — chat widgets, etc.</p>
              <textarea
                value={bodyScripts}
                onChange={(e) => setBodyScripts(e.target.value)}
                rows={6}
                placeholder="<!-- Chat widget, etc. -->"
                className="w-full rounded-lg border border-input bg-muted/50 px-4 py-2.5 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground">Footer Scripts</label>
              <p className="text-xs text-muted-foreground mb-2">Injected before &lt;/body&gt; — tracking pixels, etc.</p>
              <textarea
                value={footerScripts}
                onChange={(e) => setFooterScripts(e.target.value)}
                rows={6}
                placeholder="<!-- Footer scripts -->"
                className="w-full rounded-lg border border-input bg-muted/50 px-4 py-2.5 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
              />
            </div>
          </div>
        )}

        {/* Custom CSS Tab */}
        {tab === "css" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-foreground">Custom CSS</label>
              <p className="text-xs text-muted-foreground mb-2">Add custom styles that override the default theme</p>
              <textarea
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
                rows={15}
                placeholder="/* Custom CSS overrides */"
                className="w-full rounded-lg border border-input bg-muted/50 px-4 py-2.5 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
              />
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

export default AdminSiteSettings;
