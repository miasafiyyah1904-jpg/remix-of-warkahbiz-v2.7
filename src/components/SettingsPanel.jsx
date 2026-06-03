import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/context/ThemeContext.jsx";
import { useTranslation } from "@/hooks/useTranslation.js";
import { useAuth } from "@/context/AuthContext";
import { seedDemoData, clearDemoData } from "@/components/DemoSeeder";

function initials(name) {
  const p = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "WB";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/**
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   profileName: string;
 *   businessName: string;
 *   onSaveProfile: (name: string, business: string) => void;
 *   onLogout: () => void;
 * }} props
 */
export default function SettingsPanel({ open, onClose, profileName, businessName, onSaveProfile, onLogout }) {
  const { t, language, setLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { userId } = useAuth();
  const [name, setName] = useState(profileName);
  const [biz, setBiz] = useState(businessName);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  const demoActive = typeof window !== "undefined" && localStorage.getItem("warkahbiz_demo_mode_active") === "1";

  if (!open) return null;

  const handleLoadDemo = async () => {
    if (!userId || demoBusy) return;
    setDemoBusy(true);
    try {
      await seedDemoData(userId);
      toast.success("✅ Data demo berjaya dimuat!");
    } catch (e) {
      toast.error(`Ralat: ${e?.message || "gagal memuatkan data demo"}`);
    } finally {
      setDemoBusy(false);
    }
  };

  const handleClearDemo = async () => {
    if (!userId || demoBusy) return;
    setDemoBusy(true);
    try {
      await clearDemoData(userId);
      toast.success("🗑️ Data demo telah dipadam");
    } catch (e) {
      toast.error(`Ralat: ${e?.message || "gagal memadam data demo"}`);
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/50 tap" aria-label={t("no")} onClick={onClose} />
      <div className="relative w-[80%] max-w-sm h-full bg-background border-l border-border shadow-2xl flex flex-col animate-slide-up overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-extrabold text-lg">{t("settings")}</h2>
          <button type="button" onClick={onClose} className="tap w-9 h-9 rounded-full grid place-items-center bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-6 flex-1">
          <section>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-profit text-profit-foreground font-extrabold text-xl grid place-items-center shadow-glow">
                {initials(businessName || profileName)}
              </div>
              <div className="font-bold mt-2">{profileName}</div>
              <div className="text-sm text-muted-foreground">{businessName}</div>
              <button type="button" className="text-xs font-semibold text-primary mt-1 tap">
                {t("editProfile")}
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{t("theme")}</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`tap h-12 rounded-2xl font-bold text-sm border ${theme === "light" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
              >
                ☀️ {t("lightMode")}
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`tap h-12 rounded-2xl font-bold text-sm border ${theme === "dark" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
              >
                🌙 {t("darkMode")}
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{t("language")}</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLanguage("ms")}
                className={`tap h-12 rounded-2xl font-bold text-sm border ${language === "ms" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
              >
                🇲🇾 Bahasa Melayu
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`tap h-12 rounded-2xl font-bold text-sm border ${language === "en" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
              >
                🇬🇧 English
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{t("account")}</h3>
            <div className="space-y-2">
              <label className="block text-xs text-muted-foreground">👤 {t("profileName")}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-11 px-3 rounded-xl border border-input bg-background" />
              <label className="block text-xs text-muted-foreground">🏪 {t("profileBusiness")}</label>
              <input value={biz} onChange={(e) => setBiz(e.target.value)} className="w-full h-11 px-3 rounded-xl border border-input bg-background" />
            </div>
            <button
              type="button"
              onClick={() => {
                onSaveProfile(name, biz);
              }}
              className="tap w-full h-12 mt-3 rounded-2xl bg-primary text-primary-foreground font-bold"
            >
              {t("saveChanges")}
            </button>
          </section>

          {demoActive ? (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Mod Demo 🎬</h3>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleLoadDemo}
                  disabled={demoBusy}
                  className="tap w-full h-12 rounded-2xl bg-profit text-profit-foreground font-bold disabled:opacity-60"
                >
                  {demoBusy ? "Memuatkan..." : "🚀 Muat Data Demo"}
                </button>
                <button
                  type="button"
                  onClick={handleClearDemo}
                  disabled={demoBusy}
                  className="tap w-full h-12 rounded-2xl bg-cost text-cost-foreground font-bold disabled:opacity-60"
                >
                  {demoBusy ? "Memadam..." : "🗑️ Padam Data Demo"}
                </button>
                <p className="text-xs text-muted-foreground text-center mt-1">Untuk tujuan demonstrasi sahaja</p>
              </div>
            </section>
          ) : null}
        </div>

        <div className="p-4 border-t border-border">
          <button type="button" onClick={() => setLogoutOpen(true)} className="tap w-full h-12 rounded-2xl border-2 border-cost text-cost font-bold">
            🚪 {t("logout")}
          </button>
        </div>
      </div>

      {logoutOpen ? (
        <div className="absolute inset-0 z-[70] grid place-items-center p-6 bg-black/50" onClick={() => setLogoutOpen(false)}>
          <div className="bg-card rounded-3xl p-6 max-w-sm w-full border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-center">{t("logoutConfirm")}</p>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button type="button" onClick={() => setLogoutOpen(false)} className="tap h-11 rounded-xl border border-border font-semibold">
                {t("no")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLogoutOpen(false);
                  onClose();
                  onLogout();
                }}
                className="tap h-11 rounded-xl bg-cost text-cost-foreground font-bold"
              >
                {t("yes")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
