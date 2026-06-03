import { useEffect, useState } from "react";
import { Package, ShoppingCart, AlertTriangle, Target, MessageCircle, Check, X, ChevronRight } from "lucide-react";
import { useTranslation } from "@/context/LanguageContext";
import { listImpian } from "@/features/goals/impianApi";

export type OnboardingActions = {
  onAddProduct: () => void;
  onLogSale: () => void;
  onSetMinStock: () => void;
  onSetGoal: () => void;
  onAskAI: () => void;
};

type Props = {
  userId: string | null | undefined;
  productsCount: number;
  txnsCount: number;
  hasStockMin: boolean;
  hasUserChatMsg: boolean;
  goalsTick?: number; // bump to force refetch
  open: boolean;
  onDismiss: () => void;
  actions: OnboardingActions;
};

export function OnboardingBanner({
  userId,
  productsCount,
  txnsCount,
  hasStockMin,
  hasUserChatMsg,
  goalsTick = 0,
  open,
  onDismiss,
  actions,
}: Props) {
  const { t } = useTranslation();
  const [hasGoal, setHasGoal] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    listImpian()
      .then((rows) => { if (alive) setHasGoal(rows.length > 0); })
      .catch(() => { if (alive) setHasGoal(false); });
    return () => { alive = false; };
  }, [open, goalsTick, userId]);

  if (!open) return null;

  const steps: Array<{ key: string; icon: React.ReactNode; title: string; cta: string; done: boolean; onAction: () => void }> = [
    { key: "product", icon: <Package className="w-4 h-4" />, title: t("ob_step1_title"), cta: t("ob_step1_cta"), done: productsCount > 0, onAction: actions.onAddProduct },
    { key: "sale",    icon: <ShoppingCart className="w-4 h-4" />, title: t("ob_step2_title"), cta: t("ob_step2_cta"), done: txnsCount > 0, onAction: actions.onLogSale },
    { key: "min",     icon: <AlertTriangle className="w-4 h-4" />, title: t("ob_step3_title"), cta: t("ob_step3_cta"), done: hasStockMin, onAction: actions.onSetMinStock },
    { key: "goal",    icon: <Target className="w-4 h-4" />, title: t("ob_step4_title"), cta: t("ob_step4_cta"), done: hasGoal, onAction: actions.onSetGoal },
    { key: "ai",      icon: <MessageCircle className="w-4 h-4" />, title: t("ob_step5_title"), cta: t("ob_step5_cta"), done: hasUserChatMsg, onAction: actions.onAskAI },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const pct = Math.round((doneCount / total) * 100);
  const allDone = doneCount === total;

  return (
    <section className="mx-4 mt-3 rounded-2xl bg-surface border border-border shadow-card overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground">{t("ob_eyebrow")}</div>
          <div className="font-extrabold text-sm">
            {allDone ? t("ob_all_done_title") : t("ob_title")}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-profit">
            {t("ob_progress").replace("{done}", String(doneCount)).replace("{total}", String(total))}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("ob_dismiss")}
            title={t("ob_dismiss")}
            className="tap w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4">
        <div className="h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden">
          <div className="h-full bg-gradient-profit transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="px-3 py-2 space-y-1.5">
        {steps.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={s.onAction}
              className={`w-full tap flex items-center gap-3 px-2 py-2 rounded-xl border ${s.done ? "bg-profit/5 border-profit/20" : "bg-surface-elevated border-border"}`}
            >
              <span className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${s.done ? "bg-profit text-profit-foreground" : "bg-surface text-muted-foreground border border-border"}`}>
                {s.done ? <Check className="w-4 h-4" strokeWidth={3} /> : s.icon}
              </span>
              <span className={`flex-1 text-left text-sm font-bold ${s.done ? "line-through text-muted-foreground" : ""}`}>
                {s.title}
              </span>
              {!s.done && (
                <span className="text-[11px] font-bold text-profit flex items-center gap-0.5">
                  {s.cta} <ChevronRight className="w-3.5 h-3.5" />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {allDone && (
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={onDismiss}
            className="w-full h-10 rounded-xl bg-gradient-profit text-profit-foreground font-bold text-sm tap shadow-card"
          >
            {t("ob_close_done")}
          </button>
        </div>
      )}
    </section>
  );
}

export function getOnboardingDismissKey(userId: string | null | undefined): string {
  return `warkahbiz_onboarding_dismissed_${userId || "anon"}`;
}
