import { forwardRef } from "react";
import { Gamepad2 } from "lucide-react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

export const Logo = forwardRef<HTMLDivElement, { collapsed?: boolean }>(
  function Logo({ collapsed = false }, ref) {
    const { settings } = useSiteSettings();

    return (
      <div ref={ref} className="flex items-center gap-3 px-4 py-6">
        {settings.logo_url ? (
          <img
            src={settings.logo_url}
            alt={settings.site_name}
            className={`shrink-0 object-contain ${collapsed ? "h-10 w-10" : "h-14 max-w-[180px]"}`}
          />
        ) : (
          <>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-bg shadow-lg">
              <Gamepad2 className="h-5 w-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="font-display text-lg font-bold tracking-wider gradient-text">
                  {settings.site_name || "SOA"}
                </h1>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);
