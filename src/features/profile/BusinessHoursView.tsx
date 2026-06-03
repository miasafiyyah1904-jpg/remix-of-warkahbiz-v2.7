import { useMemo, useState } from "react";
import { ArrowLeft, Copy, Plane, MessageCircle, Timer, ChevronDown, Clock } from "lucide-react";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/context/LanguageContext";
import type { BusinessHoursSettings, DayHours, DayKey } from "@/types";
import { DAY_KEYS } from "@/types";

const DEFAULT_HOURS: DayHours[] = DAY_KEYS.map((d) => ({
  day: d,
  open: "09:00",
  close: "18:00",
  isClosed: d === "sun",
}));

export const DEFAULT_BUSINESS_HOURS: BusinessHoursSettings = {
  hours: DEFAULT_HOURS,
  vacationMode: false,
  autoReplyEnabled: false,
  autoReplyMessage: "Maaf, kami tutup. Kami akan balas semasa waktu operasi 🙏",
  bufferMinutes: 0,
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function parseHM(v: string): { h: number; m: number } {
  const [h, m] = (v || "09:00").split(":").map((x) => parseInt(x, 10) || 0);
  return { h, m };
}

function isWithin(now: Date, open: string, close: string) {
  const cur = now.getHours() * 60 + now.getMinutes();
  const o = parseHM(open);
  const c = parseHM(close);
  return cur >= o.h * 60 + o.m && cur <= c.h * 60 + c.m;
}

function dayKeyForDate(d: Date): DayKey {
  // JS: 0=Sun ... 6=Sat. Map to Mon..Sun
  const map: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[d.getDay()];
}

function withinVacation(s: BusinessHoursSettings, now: Date): boolean {
  if (!s.vacationMode || !s.vacationFrom || !s.vacationTo) return false;
  const t = now.getTime();
  const f = new Date(s.vacationFrom).getTime();
  const u = new Date(s.vacationTo).getTime() + 24 * 60 * 60 * 1000 - 1;
  return t >= f && t <= u;
}

export function isBusinessOpen(settings: BusinessHoursSettings, now = new Date()): boolean {
  if (withinVacation(settings, now)) return false;
  const todayKey = dayKeyForDate(now);
  const day = settings.hours.find((d) => d.day === todayKey);
  if (!day || day.isClosed) return false;
  if (isWithin(now, day.open, day.close)) return true;
  if (day.hasSplit && day.splitOpen && day.splitClose && isWithin(now, day.splitOpen, day.splitClose)) return true;
  return false;
}

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = ["00", "15", "30", "45"];

function TimePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { h, m } = parseHM(value);
  const selH = pad(h);
  const selM = pad(Math.round(m / 15) * 15 % 60);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`h-10 px-3 rounded-xl bg-background border border-border text-sm font-bold tap inline-flex items-center gap-1.5 ${
            disabled ? "opacity-40 pointer-events-none" : ""
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          {value || "--:--"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex gap-2">
          <div className="h-48 overflow-y-auto w-16 scroll-smooth">
            {HOURS.map((hh) => (
              <button
                type="button"
                key={hh}
                onClick={() => onChange(`${hh}:${selM}`)}
                className={`w-full h-9 rounded-lg text-sm font-semibold tap ${
                  hh === selH ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {hh}
              </button>
            ))}
          </div>
          <div className="h-48 overflow-y-auto w-16 scroll-smooth">
            {MINUTES.map((mm) => (
              <button
                type="button"
                key={mm}
                onClick={() => onChange(`${selH}:${mm}`)}
                className={`w-full h-9 rounded-lg text-sm font-semibold tap ${
                  mm === selM ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {mm}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function BusinessHoursView({
  settings,
  onSave,
  onBack,
}: {
  settings: BusinessHoursSettings;
  onSave: (s: BusinessHoursSettings) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<BusinessHoursSettings>({
    ...DEFAULT_BUSINESS_HOURS,
    ...settings,
    hours: DAY_KEYS.map((k) => settings.hours?.find((d) => d.day === k) ?? DEFAULT_HOURS.find((d) => d.day === k)!),
  });

  const openDays = useMemo(
    () => draft.hours.filter((d) => !d.isClosed).map((d) => d.day),
    [draft.hours]
  );

  const isOpenNow = useMemo(() => isBusinessOpen(draft), [draft]);

  const dayLabel = (k: DayKey) => {
    const map: Record<DayKey, string> = {
      mon: t("dayMon") || "Isnin",
      tue: t("dayTue") || "Selasa",
      wed: t("dayWed") || "Rabu",
      thu: t("dayThu") || "Khamis",
      fri: t("dayFri") || "Jumaat",
      sat: t("daySat") || "Sabtu",
      sun: t("daySun") || "Ahad",
    };
    return map[k];
  };

  const dayShort = (k: DayKey) => dayLabel(k).slice(0, 3);

  const updateDay = (day: DayKey, patch: Partial<DayHours>) => {
    setDraft((d) => ({
      ...d,
      hours: d.hours.map((h) => (h.day === day ? { ...h, ...patch } : h)),
    }));
  };

  const handleToggleDays = (vals: string[]) => {
    setDraft((d) => ({
      ...d,
      hours: d.hours.map((h) => ({ ...h, isClosed: !vals.includes(h.day) })),
    }));
  };

  const copyFromPrev = (idx: number) => {
    if (idx === 0) return;
    const prev = draft.hours[idx - 1];
    const cur = draft.hours[idx];
    updateDay(cur.day, {
      open: prev.open,
      close: prev.close,
      hasSplit: prev.hasSplit,
      splitOpen: prev.splitOpen,
      splitClose: prev.splitClose,
      isClosed: prev.isClosed,
    });
    toast.success(t("copiedFromPrev") || "Disalin dari hari sebelum ✅");
  };

  const handleSave = () => {
    onSave(draft);
    toast.success(t("hoursSaved") || "Tetapan disimpan ✅");
    onBack();
  };

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <button onClick={onBack} className="text-xs font-bold text-primary tap mb-1 inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Kembali ke Profil
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold leading-tight">{t("businessHoursTitle") || "Waktu Operasi"}</h1>
          <p className="text-xs text-muted-foreground">{t("businessHoursSub") || "Tetapkan hari & masa perniagaan anda"}</p>
        </div>
      </div>

      {/* Live status */}
      <div className="px-5 pb-4">
        <div className="rounded-2xl border border-border bg-surface p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              {t("businessStatus") || "Status Perniagaan"}
            </div>
            <div className="text-sm font-bold mt-0.5">
              {new Date().toLocaleDateString(undefined, { weekday: "long" })}
            </div>
          </div>
          <Badge
            className={`text-xs font-extrabold px-3 py-1.5 ${
              isOpenNow
                ? "bg-profit text-profit-foreground hover:bg-profit"
                : "bg-cost text-cost-foreground hover:bg-cost"
            }`}
          >
            {isOpenNow ? `🟢 ${t("openNow") || "Buka Sekarang"}` : `🔴 ${t("closedNow") || "Tutup"}`}
          </Badge>
        </div>
      </div>

      {/* Day picker */}
      <div className="px-5 pb-3">
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
          {t("operatingDays") || "Hari Operasi"}
        </div>
        <ToggleGroup
          type="multiple"
          value={openDays}
          onValueChange={handleToggleDays}
          className="grid grid-cols-7 gap-1.5"
        >
          {draft.hours.map((d) => (
            <ToggleGroupItem
              key={d.day}
              value={d.day}
              className="h-12 rounded-xl text-[11px] font-bold border border-border data-[state=on]:bg-gradient-profit data-[state=on]:text-profit-foreground data-[state=on]:border-transparent"
            >
              {dayShort(d.day)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Per-day hours */}
      <div className="px-5 space-y-2">
        {draft.hours.map((d, idx) => (
          <div
            key={d.day}
            className={`rounded-2xl border border-border bg-surface p-3 transition-opacity ${
              d.isClosed ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold w-16">{dayLabel(d.day)}</span>
                <Switch
                  checked={!d.isClosed}
                  onCheckedChange={(v) => updateDay(d.day, { isClosed: !v })}
                />
                <span className="text-[11px] text-muted-foreground">
                  {d.isClosed ? t("closedLabel") || "Tutup" : t("openLabel") || "Buka"}
                </span>
              </div>
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => copyFromPrev(idx)}
                  className="text-[10px] font-bold text-primary tap inline-flex items-center gap-1"
                  title={t("sameAsPrev") || "Sama seperti sebelumnya"}
                >
                  <Copy className="w-3 h-3" /> {t("sameAsPrev") || "Sama seperti sebelumnya"}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <TimePicker value={d.open} onChange={(v) => updateDay(d.day, { open: v })} disabled={d.isClosed} />
              <span className="text-xs text-muted-foreground">→</span>
              <TimePicker value={d.close} onChange={(v) => updateDay(d.day, { close: v })} disabled={d.isClosed} />

              <button
                type="button"
                disabled={d.isClosed}
                onClick={() =>
                  updateDay(d.day, {
                    hasSplit: !d.hasSplit,
                    splitOpen: d.splitOpen || "13:00",
                    splitClose: d.splitClose || "14:00",
                  })
                }
                className={`ml-auto text-[10px] font-bold tap px-2 py-1 rounded-lg border ${
                  d.hasSplit ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground"
                } ${d.isClosed ? "opacity-40 pointer-events-none" : ""}`}
              >
                {d.hasSplit ? `− ${t("removeBreak") || "Buang rehat"}` : `+ ${t("addBreak") || "Tambah rehat"}`}
              </button>
            </div>

            {d.hasSplit && !d.isClosed && (
              <div className="mt-2 pl-4 border-l-2 border-primary/30 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  {t("breakLabel") || "Rehat"}
                </span>
                <TimePicker
                  value={d.splitOpen || "13:00"}
                  onChange={(v) => updateDay(d.day, { splitOpen: v })}
                />
                <span className="text-xs text-muted-foreground">→</span>
                <TimePicker
                  value={d.splitClose || "14:00"}
                  onChange={(v) => updateDay(d.day, { splitClose: v })}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Advanced */}
      <div className="px-5 mt-5">
        <Accordion type="single" collapsible className="rounded-2xl border border-border bg-surface px-4">
          <AccordionItem value="adv" className="border-b-0">
            <AccordionTrigger className="text-sm font-bold">
              <span className="inline-flex items-center gap-2">
                <ChevronDown className="w-4 h-4 hidden" />
                {t("advancedSettings") || "Tetapan Lanjut"}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {/* Vacation */}
              <div className="rounded-xl bg-background border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Plane className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold">{t("vacationMode") || "Mode Cuti"}</span>
                  </div>
                  <Switch
                    checked={draft.vacationMode}
                    onCheckedChange={(v) => setDraft((d) => ({ ...d, vacationMode: v }))}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">
                  {t("vacationHint") || "Tutup perniagaan sementara mengikut tarikh"}
                </p>
                {draft.vacationMode && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground mb-1">
                        {t("from") || "Dari"}
                      </div>
                      <input
                        type="date"
                        value={draft.vacationFrom || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, vacationFrom: e.target.value }))}
                        className="w-full h-10 px-3 rounded-xl bg-surface border border-border text-sm"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground mb-1">
                        {t("to") || "Hingga"}
                      </div>
                      <input
                        type="date"
                        value={draft.vacationTo || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, vacationTo: e.target.value }))}
                        className="w-full h-10 px-3 rounded-xl bg-surface border border-border text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Auto reply */}
              <div className="rounded-xl bg-background border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold">{t("autoReply") || "AI Auto-Reply"}</span>
                  </div>
                  <Switch
                    checked={draft.autoReplyEnabled}
                    onCheckedChange={(v) => setDraft((d) => ({ ...d, autoReplyEnabled: v }))}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">
                  {t("autoReplyHint") || "Aktifkan balasan automatik semasa tutup"}
                </p>
                {draft.autoReplyEnabled && (
                  <textarea
                    rows={3}
                    value={draft.autoReplyMessage || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, autoReplyMessage: e.target.value }))}
                    placeholder={t("autoReplyPh") || "Mesej balas auto..."}
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                )}
              </div>

              {/* Buffer */}
              <div className="rounded-xl bg-background border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold">{t("bufferTime") || "Buffer Persediaan"}</span>
                  </div>
                  <span className="text-sm font-extrabold text-primary">{draft.bufferMinutes} min</span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">
                  {t("bufferHint") || "Masa tersembunyi sebelum/selepas waktu operasi"}
                </p>
                <input
                  type="range"
                  min={0}
                  max={120}
                  step={15}
                  value={draft.bufferMinutes}
                  onChange={(e) => setDraft((d) => ({ ...d, bufferMinutes: parseInt(e.target.value, 10) }))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>0</span><span>30</span><span>60</span><span>90</span><span>120</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Save */}
      <div className="px-5 mt-5">
        <button
          onClick={handleSave}
          className="w-full h-12 rounded-2xl bg-gradient-profit text-profit-foreground font-extrabold tap shadow-card"
        >
          {t("save") || "Simpan"} 💾
        </button>
      </div>
    </div>
  );
}
