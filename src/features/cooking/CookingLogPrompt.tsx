import { ChefHat, ChevronRight } from "lucide-react";
import type { CookingLog } from "@/types";
import { useTranslation } from "@/context/LanguageContext";

export const CookingLogPrompt = ({
  logs,
  onOpen,
}: {
  logs: CookingLog[];
  onOpen: () => void;
}) => {
  const { t } = useTranslation();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayLogs = logs.filter((l) => l.ts >= todayStart.getTime());
  const totalBatches = todayLogs.reduce((s, l) => s + l.batches, 0);

  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-3xl p-5 bg-surface border-2 border-primary/30 tap animate-fade-in hover:border-primary/60 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/15 grid place-items-center shrink-0">
          <ChefHat className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-bold text-primary">
            {t("cookingLogHeader")}
          </div>
          <div className="font-extrabold text-base mt-0.5">
            {todayLogs.length === 0
              ? t("cookingLogPromptEmpty")
              : t("cookingLogPromptDone").replace("{n}", String(totalBatches))}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {todayLogs.length === 0
              ? t("cookingLogTipEmpty")
              : todayLogs.map((l) => `${l.productEmoji} ${l.batches}×${l.productName}`).join(" • ")}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
      </div>
    </button>
  );
};
