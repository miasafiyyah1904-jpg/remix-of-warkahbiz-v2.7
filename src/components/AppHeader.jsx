import { useRef } from "react";
import { Bell, Settings, HelpCircle, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation.js";

/**
 * @param {{ businessName: string; onOpenSettings: () => void; onOpenNotifications?: () => void; notificationCount?: number; showNotificationDot?: boolean; onReplayTutorial?: () => void; onShowGettingStarted?: () => void }} props
 */
export default function AppHeader({ businessName, onOpenSettings, onOpenNotifications, notificationCount, showNotificationDot, onReplayTutorial, onShowGettingStarted }) {
  const { t } = useTranslation();
  const count = notificationCount || 0;
  const tapsRef = useRef([]);

  const handleLogoTap = () => {
    const now = Date.now();
    tapsRef.current = [...tapsRef.current.filter((t) => now - t < 3000), now];
    if (tapsRef.current.length >= 5) {
      tapsRef.current = [];
      try {
        if (localStorage.getItem("warkahbiz_demo_mode_active") !== "1") {
          localStorage.setItem("warkahbiz_demo_mode_active", "1");
          toast.success("🎬 Mod Demo diaktifkan");
        }
      } catch {}
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="flex items-center min-w-0">
        <button type="button" onClick={handleLogoTap} aria-label="WarkahBiz" className="tap">
          <img src="/warkahbiz-logo.png" alt="WarkahBiz" className="h-8 w-auto" />
        </button>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onShowGettingStarted ? (
          <button
            type="button"
            onClick={onShowGettingStarted}
            title={t("ob_reopen")}
            aria-label={t("ob_reopen")}
            className="tap w-10 h-10 rounded-full grid place-items-center text-muted-foreground hover:bg-muted"
          >
            <ListChecks className="w-5 h-5" />
          </button>
        ) : null}
        {onReplayTutorial ? (
          <button
            type="button"
            onClick={onReplayTutorial}
            title="Ulang Tutorial"
            aria-label="Ulang Tutorial"
            className="tap w-10 h-10 rounded-full grid place-items-center text-muted-foreground hover:bg-muted"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        ) : null}
        <button type="button" onClick={onOpenNotifications} className="tap relative w-10 h-10 rounded-full grid place-items-center text-muted-foreground hover:bg-muted" aria-label={t("notifications")}>
          <Bell className="w-5 h-5" />
          {count > 0 ? (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 grid place-items-center text-[10px] font-bold bg-cost text-cost-foreground rounded-full animate-pop-in">
              {count > 99 ? "99+" : count}
            </span>
          ) : showNotificationDot ? (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cost" />
          ) : null}
        </button>
        <button type="button" onClick={onOpenSettings} className="tap w-10 h-10 rounded-full grid place-items-center text-muted-foreground hover:bg-muted" aria-label={t("settings")}>
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
