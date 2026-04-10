import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface PreloadedSettings {
  site_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
}

const FALLBACK_TITLE = "Slots of America";

// Store preloaded settings so the React context can pick them up without re-fetching
let _preloaded: PreloadedSettings | null = null;
export function getPreloadedSettings() {
  return _preloaded;
}

function revealPage() {
  document.body.classList.add("settings-loaded");
}

export async function preloadSiteSettings(): Promise<PreloadedSettings | null> {
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await client
      .from("site_settings_public" as any)
      .select("site_name, logo_url, favicon_url, seo_title, seo_description")
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      document.title = FALLBACK_TITLE;
      revealPage();
      return null;
    }

    _preloaded = data as PreloadedSettings;

    // Apply title immediately
    document.title = data.seo_title || data.site_name || FALLBACK_TITLE;

    // Apply favicon immediately
    if (data.favicon_url) {
      let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        link.type = "image/png";
        document.head.appendChild(link);
      }
      link.type = "image/png";
      link.href = data.favicon_url;
    }

    // Apply meta description
    if (data.seo_description) {
      let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (meta) meta.content = data.seo_description;

      let ogDesc = document.querySelector('meta[property="og:description"]') as HTMLMetaElement | null;
      if (ogDesc) ogDesc.content = data.seo_description;
    }

    // Apply OG title
    const title = data.seo_title || data.site_name || FALLBACK_TITLE;
    let ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
    if (ogTitle) ogTitle.content = title;

    revealPage();
    return _preloaded;
  } catch (err) {
    console.warn("Failed to preload site settings:", err);
    document.title = FALLBACK_TITLE;
    revealPage();
    return null;
  }
}
