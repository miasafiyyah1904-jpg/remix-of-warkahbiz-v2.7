import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import type { BusinessHoursSettings, DayKey, OutletSettings } from "@/types";
import { OUTLET_TYPES } from "@/types";
import { DAY_KEYS } from "@/types";
import { useTranslation } from "@/context/LanguageContext";

const DAY_LABEL: Record<DayKey, string> = {
  mon: "Isnin", tue: "Selasa", wed: "Rabu", thu: "Khamis",
  fri: "Jumaat", sat: "Sabtu", sun: "Ahad",
};

function summarizeHours(bh: BusinessHoursSettings): string {
  const lines: string[] = [];
  DAY_KEYS.forEach((k) => {
    const d = bh.hours.find((x) => x.day === k);
    if (!d) return;
    if (d.isClosed) {
      lines.push(`${DAY_LABEL[k]}: Tutup`);
    } else {
      let s = `${DAY_LABEL[k]}: ${d.open} - ${d.close}`;
      if (d.hasSplit && d.splitOpen && d.splitClose) {
        s += `, ${d.splitOpen} - ${d.splitClose}`;
      }
      lines.push(s);
    }
  });
  return lines.join("\n");
}

function buildShareText(o: OutletSettings, bh: BusinessHoursSettings, fallbackName: string): string {
  const name = o.outletName.trim() || fallbackName || "Outlet Saya";
  const addr = o.address.trim() || "—";
  const hours = summarizeHours(bh);
  const statusLine = o.isOpenToday
    ? "🟢 Status: Buka hari ini"
    : `🔴 Status: Tutup hari ini${o.closedReason?.trim() ? `: ${o.closedReason.trim()}` : ""}`;
  return `🏪 *${name}*
📍 ${addr}
🕐 Waktu Operasi:
${hours}
${statusLine}

_Dijana oleh WarkahBiz_`;
}

export const OutletView = ({
  outlet,
  onSave,
  onBack,
  businessName,
  businessHours,
}: {
  outlet: OutletSettings;
  onSave: (s: OutletSettings) => void;
  onBack: () => void;
  businessName: string;
  businessHours: BusinessHoursSettings;
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<OutletSettings>(outlet);

  const fallbackName = businessName || "Outlet Saya";
  const shareText = useMemo(
    () => buildShareText(draft, businessHours, fallbackName),
    [draft, businessHours, fallbackName],
  );

  const updateAndPersist = (next: OutletSettings) => {
    setDraft(next);
    onSave(next);
  };

  const handleToggleOpen = (checked: boolean) => {
    const next: OutletSettings = {
      ...draft,
      isOpenToday: checked,
      closedReason: checked ? undefined : draft.closedReason,
    };
    updateAndPersist(next);
  };

  const handleReason = (v: string) => {
    const next = { ...draft, closedReason: v };
    setDraft(next);
    onSave(next);
  };

  const handleSaveInfo = () => {
    onSave(draft);
    toast.success(t("ov_outlet_info_saved"));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success(t("ov_copied"));
    } catch {
      toast.error(t("ov_copy_failed"));
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: unknown }).share) {
      try {
        await (navigator as Navigator & { share: (d: { text: string }) => Promise<void> }).share({ text: shareText });
        return;
      } catch {
        // user cancelled — fall through to copy
      }
    }
    handleCopy();
  };

  return (
    <div className="pb-32 px-5 pt-6 space-y-5">
      <div>
        <button onClick={onBack} className="text-xs font-bold text-primary tap mb-1 inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> {t("ov_back_to_profile")}
        </button>
        <h1 className="text-lg font-extrabold">{t("ov_my_outlet")}</h1>
      </div>

      {/* Section A — Status */}
      <div className="rounded-2xl bg-surface border border-border p-4 space-y-3">
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t("ov_outlet_status")}</div>
        <div className="flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center gap-2 px-3 h-9 rounded-full text-sm font-bold ${
              draft.isOpenToday
                ? "bg-profit/15 text-profit"
                : "bg-cost/15 text-cost"
            }`}
          >
            {draft.isOpenToday ? t("ov_open_now") : t("ov_closed_today")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-sm font-semibold">{t("ov_open_today_q")}</span>
          <Switch checked={draft.isOpenToday} onCheckedChange={handleToggleOpen} />
        </div>
        {!draft.isOpenToday && (
          <Field label={t("ov_closed_reason")}>
            <input
              value={draft.closedReason || ""}
              onChange={(e) => handleReason(e.target.value.slice(0, 80))}
              maxLength={80}
              placeholder={t("ov_closed_reason_placeholder")}
              className="w-full h-12 px-4 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>
        )}
      </div>

      {/* Section B — Info form */}
      <div className="rounded-2xl bg-surface border border-border p-4 space-y-3">
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t("ov_outlet_info")}</div>

        <Field label={t("ov_outlet_name")}>
          <input
            value={draft.outletName}
            onChange={(e) => setDraft({ ...draft, outletName: e.target.value.slice(0, 80) })}
            maxLength={80}
            placeholder={t("ov_outlet_name_placeholder")}
            className="w-full h-12 px-4 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label={t("ov_outlet_type")}>
          <div className="relative">
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as OutletSettings["type"] })}
              className="w-full h-12 pl-4 pr-10 rounded-2xl bg-background border border-border text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {OUTLET_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
        </Field>

        <Field label={t("ov_ssm")}>
          <input
            value={draft.ssm || ""}
            onChange={(e) => setDraft({ ...draft, ssm: e.target.value.slice(0, 40) })}
            maxLength={40}
            placeholder={t("ov_ssm_placeholder")}
            className="w-full h-12 px-4 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label={t("ov_address")}>
          <textarea
            value={draft.address}
            onChange={(e) => setDraft({ ...draft, address: e.target.value.slice(0, 300) })}
            maxLength={300}
            rows={3}
            placeholder={t("ov_address_placeholder")}
            className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </Field>


        <button
          onClick={handleSaveInfo}
          className="w-full h-12 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap shadow-card"
        >
          {t("save")}
        </button>
      </div>

      {/* Section C — Share card */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t("ov_outlet_card")}</div>
        <div className="rounded-2xl bg-surface border-2 border-dashed border-border p-4">
          <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed font-sans">
{shareText}
          </pre>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleCopy}
            className="h-12 rounded-2xl bg-surface border border-border flex items-center justify-center gap-2 tap text-sm font-bold"
          >
            <Copy className="w-4 h-4" /> {t("ov_copy_text")}
          </button>
          <button
            onClick={handleShare}
            className="h-12 rounded-2xl bg-surface border border-border flex items-center justify-center gap-2 tap text-sm font-bold"
          >
            <Share2 className="w-4 h-4" /> {t("ov_share")}
          </button>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="text-[11px] font-bold text-muted-foreground mb-1.5 ml-1">{label}</div>
    {children}
  </div>
);
