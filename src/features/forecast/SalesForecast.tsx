import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, TrendingUp, Sparkles, ShoppingCart, CheckCircle2, Clock, Trophy, ChartBar, CloudRain, AlertTriangle, Activity, LineChart as LineChartIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fmt } from "@/lib/format";
import type { Unit, Txn, Product } from "@/types";
import { useWeather } from "@/features/weather/useWeather";
import { forecastDay, clampMultiplier } from "@/lib/forecastModel";
import { computeWeekdayStats, predictStockPrep } from "./realAggregate";
import { saveForecasts, fetchPastAccuracy } from "./forecastApi";
import { emojiForItem } from "@/lib/stockEmoji";
import { useTranslation } from "@/context/LanguageContext";
import { getCulturalMultiplier, getPaydayMultiplier, type CulturalSignal, type PaydaySignal } from "@/lib/malaysianHolidays";

const DAY_NAMES_MS = ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu", "Ahad"];
const MONTH_SHORT = ["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ogs","Sep","Okt","Nov","Dis"];

type Level = "tutup" | "rendah" | "normal" | "tinggi" | "sangat-tinggi";

const LEVEL_META: Record<Level, { labelKey: string; emoji: string; chipClass: string; cardClass: string }> = {
  "tutup":        { labelKey: "sf_levelClose",    emoji: "⚪", chipClass: "bg-muted text-muted-foreground",    cardClass: "bg-muted/40 border-border" },
  "rendah":       { labelKey: "sf_levelLow",      emoji: "🔵", chipClass: "bg-muted text-muted-foreground",    cardClass: "bg-muted/40 border-border" },
  "normal":       { labelKey: "sf_levelNormal",   emoji: "🟢", chipClass: "bg-primary/15 text-primary",        cardClass: "bg-primary/5 border-primary/20" },
  "tinggi":       { labelKey: "sf_levelHigh",     emoji: "🟡", chipClass: "bg-warn-soft text-warn",            cardClass: "bg-warn-soft border-warn/30" },
  "sangat-tinggi":{ labelKey: "sf_levelVeryHigh", emoji: "🔴", chipClass: "bg-cost-soft text-cost",            cardClass: "bg-cost-soft border-cost/30" },
};

const addressBoss = (businessName: string) => businessName?.trim() ? businessName.trim() : "Boss";

function classifyLevel(expected: number, baseline: number): Level {
  if (baseline <= 0) return "normal";
  const ratio = expected / baseline;
  if (ratio >= 1.4) return "sangat-tinggi";
  if (ratio >= 1.15) return "tinggi";
  if (ratio >= 0.85) return "normal";
  return "rendah";
}

interface DayCalc {
  dayName: string;
  dateLabel: string;
  isoDate: string;
  weekdayIdx: number; // 0=Mon
  baselineForDay: number;
  expected: number;
  low: number;
  high: number;
  probHit: number;
  level: Level;
  reasons: string[];
  weather: ReturnType<typeof useWeather>["data"] extends (infer U)[] | null ? U | undefined : undefined;
  weatherMult: number;
  culturalSignal: CulturalSignal;
  paydaySignal:   PaydaySignal;
  stock: { emoji: string; name: string; need: number; unit: Unit }[];
}

export function SalesForecast({
  onClose,
  businessName,
  txns,
  products,
  onSendToBuy,
  finishedStock,
}: {
  onClose: () => void;
  businessName: string;
  txns: Txn[];
  products: Product[];
  onSendToBuy: (items: { emoji: string; name: string; recQty: number; unit: Unit; note?: string }[]) => void;
  finishedStock?: { productId: string; qty: number }[];
}) {
  const { t } = useTranslation();
  const boss = addressBoss(businessName);
  const { data: weather, loading: weatherLoading, error: weatherError } = useWeather();

  // ── Manual multiplier toggles ─────────────────────────────────────────
  const [heavyRainOn, setHeavyRainOn] = useState(false);
  const RAIN_MULT = 0.8;
  const manualMult = heavyRainOn ? RAIN_MULT : 1;

  // ── Real historical stats ─────────────────────────────────────────────
  const stats = useMemo(() => computeWeekdayStats(txns, 30), [txns]);
  const hasEnoughData = stats.distinctDays >= 7;


  // ── Build 7-day forward calc ──────────────────────────────────────────
  const days: DayCalc[] = useMemo(() => {
    if (!hasEnoughData) return [];
    const out: DayCalc[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const weekdayIdx = (date.getDay() === 0 ? 6 : date.getDay() - 1);
      const baselineForDay = stats.perWeekdayAvg[weekdayIdx] || stats.baseline;

      const w = weather?.[i];
      const weatherMult = clampMultiplier(1 + (w?.trafficAdjust ?? 0));
      const culturalSignal = getCulturalMultiplier(date);
      const paydaySignal   = getPaydayMultiplier(date);
      const combinedMult = clampMultiplier(
        weatherMult *
        culturalSignal.multiplier *
        paydaySignal.multiplier *
        manualMult
      );
      const point = forecastDay(weekdayIdx, baselineForDay, 0.55, combinedMult, stats.noiseCV, 0.85);


      const reasons: string[] = [];
      const samples = stats.perWeekdaySamples[weekdayIdx];
      if (samples > 0) reasons.push(`${t("sf_avgDay")} ${DAY_NAMES_MS[weekdayIdx]} (${samples} ${t("sf_records")}): ${fmt(baselineForDay)}`);
      if (w && w.severity !== "ok") reasons.push(`${t("sf_weather")}: ${w.label} ${w.emoji} (${w.trafficAdjust >= 0 ? "+" : ""}${Math.round(w.trafficAdjust * 100)}% ${t("sf_traffic")})`);
      if (culturalSignal.label) {
        const dir = culturalSignal.multiplier >= 1 ? "+" : "";
        reasons.push(`${culturalSignal.label} (${dir}${Math.round((culturalSignal.multiplier - 1) * 100)}% jangkaan)`);
      }
      if (paydaySignal.label) {
        reasons.push(`${paydaySignal.label} (+${Math.round((paydaySignal.multiplier - 1) * 100)}% jangkaan)`);
      }
      if (baselineForDay > stats.baseline * 1.15) reasons.push(`${DAY_NAMES_MS[weekdayIdx]} ${t("sf_usuallyBusy")} ${boss}`);
      if (baselineForDay < stats.baseline * 0.85) reasons.push(`${DAY_NAMES_MS[weekdayIdx]} ${t("sf_usuallySlow")}`);

      const stockPrep = predictStockPrep(products, point.expected, stats.baseline);
      const level = classifyLevel(point.expected, stats.baseline);

      out.push({
        dayName: DAY_NAMES_MS[weekdayIdx],
        dateLabel: `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`,
        isoDate: date.toISOString().slice(0, 10),
        weekdayIdx,
        baselineForDay,
        expected: point.expected,
        low: point.low,
        high: point.high,
        probHit: point.probHitExpected,
        level,
        reasons,
        weather: w,
        weatherMult,
        culturalSignal,
        paydaySignal,
        stock: stockPrep.map((s) => ({
          emoji: emojiForItem(s.name),
          name: s.name,
          need: s.qty,
          unit: s.unit,
        })),
      });
    }
    return out;
  }, [hasEnoughData, stats, weather, products, t, manualMult, boss]);

  // ── Save forecasts to DB once weather loaded ──────────────────────────
  useEffect(() => {
    if (!days.length || weatherLoading) return;
    saveForecasts(
      days.map((d) => ({
        forecast_date: d.isoDate,
        day_index: d.weekdayIdx,
        baseline: d.baselineForDay,
        predicted_revenue: d.expected,
        predicted_low: d.low,
        predicted_high: d.high,
        weather_adjust: d.weatherMult - 1,
        weather_label: d.weather?.label ?? null,
        cultural_adjust: d.culturalSignal.multiplier,
        cultural_label:  d.culturalSignal.label ?? null,
        payday_adjust:   d.paydaySignal.multiplier,
        payday_label:    d.paydaySignal.label ?? null,
      })),
    ).catch(() => {});
  }, [days, weatherLoading]);

  // ── Past accuracy ─────────────────────────────────────────────────────
  const [accuracy, setAccuracy] = useState<{ avgAccuracy: number; sampleSize: number } | null>(null);
  useEffect(() => {
    fetchPastAccuracy().then(setAccuracy).catch(() => {});
  }, []);

  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [prepOpen, setPrepOpen] = useState(false);
  const detail = days.find((d) => d.isoDate === selectedIso) ?? days[0];
  const stormDay = days.find((d) => d.weather?.severity === "alert");

  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, "tepat" | "lebih-kurang" | "meleset">>({});

  const selectedDay = days.find(d => d.isoDate === (selectedIso ?? days[0]?.isoDate));
  const isPastDay = selectedDay
    ? new Date(selectedDay.isoDate) < new Date(new Date().toISOString().slice(0, 10))
    : false;

  const handleFeedback = async (
    isoDate: string,
    fb: "tepat" | "lebih-kurang" | "meleset"
  ) => {
    setFeedbackGiven(prev => ({ ...prev, [isoDate]: fb }));
    const day = days.find(d => d.isoDate === isoDate);
    if (!day) return;
    const actualMap = {
      "tepat":        day.expected,
      "lebih-kurang": (day.low + day.high) / 2,
      "meleset":      day.low * 0.7,
    };
    const estimatedActual = actualMap[fb];
    const accuracyPct = Math.max(0,
      Math.round(100 - Math.abs((estimatedActual - day.expected) / day.expected) * 100)
    );
    const { supabase } = await import("@/integrations/supabase/client");
    const { getDeviceId } = await import("@/features/goals/impianApi");
    const device_id = await getDeviceId();
    supabase
      .from("forecasts")
      .update({
        actual_revenue: Math.round(estimatedActual),
        accuracy_pct:   accuracyPct,
      } as never)
      .eq("device_id" as never, device_id as never)
      .eq("forecast_date", isoDate)
      .then(() => {});
  };

  useEffect(() => {
    if (!txns.length || !days.length) return;

    const run = async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { getDeviceId } = await import("@/features/goals/impianApi");
      const device_id = await getDeviceId();

      const dailyCashIn = new Map<string, number>();
      txns
        .filter(t => t.type === "in")
        .forEach(t => {
          const iso = new Date(t.ts).toISOString().slice(0, 10);
          dailyCashIn.set(iso, (dailyCashIn.get(iso) ?? 0) + t.amount);
        });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const pastDays = days.filter(d =>
        new Date(d.isoDate) < today && dailyCashIn.has(d.isoDate)
      );

      for (const d of pastDays) {
        const actual = dailyCashIn.get(d.isoDate)!;
        const acc = Math.max(0,
          Math.round(100 - Math.abs((actual - d.expected) / d.expected) * 100)
        );
        await supabase
          .from("forecasts")
          .update({ actual_revenue: Math.round(actual), accuracy_pct: acc } as never)
          .eq("device_id" as never, device_id as never)
          .eq("forecast_date", d.isoDate)
          .is("actual_revenue", null);
      }
    };

    run();
  }, [days, txns]);

  const totalRevenue = useMemo(() => days.reduce((s, d) => s + d.expected, 0), [days]);
  const matCost = totalRevenue * 0.45;
  const profit = totalRevenue - matCost;

  // Aggregated weekly checklist
  const weeklyChecklist = useMemo(() => {
    const map = new Map<string, { emoji: string; name: string; total: number; unit: Unit }>();
    days.forEach((d) => d.stock.forEach((s) => {
      const cur = map.get(s.name);
      if (cur) cur.total += s.need;
      else map.set(s.name, { emoji: s.emoji, name: s.name, total: s.need, unit: s.unit });
    }));
    return Array.from(map.values())
      .map((w) => ({ ...w, total: +w.total.toFixed(1) }))
      .sort((a, b) => b.total - a.total);
  }, [days]);

  const [checked, setChecked] = useState<Set<string>>(new Set());

  const handleSendDayToBuy = () => {
    if (!detail) return;
    const items = detail.stock.map((s) => ({
      emoji: s.emoji, name: s.name, recQty: s.need, unit: s.unit,
      note: `${t("sf_prepNote")} ${detail.dayName} ${detail.dateLabel}`,
    }));
    if (!items.length) { toast.error(t("sf_noStockToast")); return; }
    onSendToBuy(items);
    toast.success(`${items.length} ${t("sf_itemsAddedToBuy")} ✅`);
  };

  const handleSendWeekToBuy = () => {
    const items = weeklyChecklist
      .filter((w) => !checked.has(w.name))
      .map((w) => ({ emoji: w.emoji, name: w.name, recQty: w.total, unit: w.unit, note: t("sf_prepWeekNote") }));
    if (items.length === 0) { toast.error(t("sf_noItemsToSend")); return; }
    onSendToBuy(items);
    toast.success(`${items.length} ${t("sf_itemsSentToBuy")} ✅`);
  };

  return (
    <div className="fixed inset-0 z-40 bg-background overflow-y-auto animate-fade-in">
      <div className="mx-auto w-full max-w-full sm:max-w-[600px] md:max-w-[760px] lg:max-w-[960px] xl:max-w-[1140px] 2xl:max-w-[1280px] min-h-screen bg-background pb-32">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted tap" aria-label={t("back")}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-extrabold leading-tight">{t("sf_title")}</h1>
            <p className="text-xs text-muted-foreground">{t("sf_subtitle")} {boss}</p>
          </div>
        </header>

        {/* ── EMPTY STATE ────────────────────────────────────────── */}
        {!hasEnoughData ? (
          <div className="px-5 py-10 space-y-5">
            <div className="rounded-3xl p-6 bg-card border border-border text-center space-y-3 animate-fade-in">
              <div className="text-5xl">📊</div>
              <h2 className="text-lg font-extrabold">{t("sf_notEnoughTitle")}, {boss}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("sf_notEnoughDesc1")} <span className="font-bold text-foreground">{t("sf_notEnoughDesc2")}</span> {t("sf_notEnoughDesc3")}
                {t("sf_notEnoughDesc4")} <span className="font-bold text-primary">{stats.distinctDays} {t("sf_days")}</span>.
              </p>
              <div className="rounded-2xl bg-muted/40 p-4 text-left space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("sf_tips")}</p>
                <p className="text-sm">• {t("sf_tip1")} <span className="font-bold">+</span></p>
                <p className="text-sm">• {t("sf_tip2")}</p>
                <p className="text-sm">• {t("sf_tip3")} 🚀</p>
              </div>
              <Button onClick={onClose} className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold mt-2">
                {t("sf_okUnderstand")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-5">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary">
                <Sparkles className="w-3 h-3" /> {t("sf_basedOn")} {stats.distinctDays} {t("sf_realRecords")}
              </span>
              {accuracy ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-profit/10 text-profit">
                  <CheckCircle2 className="w-3 h-3" /> {t("sf_aiAccuracy")} {accuracy.avgAccuracy}% ({accuracy.sampleSize} {t("sf_pastForecasts")})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
                  <LineChartIcon className="w-3 h-3" /> {t("sf_accuracyPending")}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-accent/15 text-accent-foreground">
                <Activity className="w-3 h-3" /> {t("sf_confidence85")} {Math.round(stats.noiseCV * 100)}%
              </span>
              {weather && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-muted text-foreground">
                  ☁️ {t("sf_weatherLive")}
                </span>
              )}
            </div>

            {/* Auto-detected signals + manual override */}
            <section className="rounded-2xl bg-card border border-border p-3 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("sf_multiplierTitle")}</p>

              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground self-center mr-1">{t("sf_autoDetected")}:</span>
                {days.filter(d => d.culturalSignal.label || d.paydaySignal.label).slice(0, 3).map(d => (
                  <ActiveChip key={d.isoDate} label={`${d.dayName}: ${d.culturalSignal.label ?? d.paydaySignal.label}`} />
                ))}
                {days.every(d => !d.culturalSignal.label && !d.paydaySignal.label) && (
                  <span className="text-[11px] text-muted-foreground italic">{t("sf_noAutoEvents")}</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 items-center pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">{t("sf_manualOverride")}:</span>
                <MultiplierToggle active={heavyRainOn} onClick={() => setHeavyRainOn(v => !v)} label={t("sf_multRain")} mult={RAIN_MULT} />
              </div>
            </section>



            {/* Storm alert */}
            {stormDay?.weather && (
              <div className="rounded-2xl bg-cost-soft border border-cost/30 p-4 flex gap-3 animate-fade-in">
                <div className="w-10 h-10 rounded-xl bg-cost/15 grid place-items-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-cost" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-cost">
                    {t("sf_weatherAlertLabel")} {stormDay.weather.label} {stormDay.weather.emoji} {t("sf_weatherAlertOn")} {stormDay.dayName}
                  </p>
                  <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
                    {t("sf_weatherAlertDesc1")} {boss} {t("sf_weatherAlertDesc2")} {Math.round(Math.abs(stormDay.weather.trafficAdjust) * 100)}%.
                    {" "}{t("sf_weatherAlertDesc3")}
                  </p>
                </div>
              </div>
            )}
            {weatherError && (
              <p className="text-xs text-muted-foreground italic">{t("sf_weatherError")}</p>
            )}

            {/* 7-day strip */}
            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t("sf_7dayHeading")}</h2>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
                {days.map((d) => {
                  const meta = LEVEL_META[d.level];
                  const active = (selectedIso ?? days[0].isoDate) === d.isoDate;
                  const max = Math.max(...days.map((x) => x.expected));
                  const barPct = max > 0 ? (d.expected / max) * 100 : 0;
                  const w = d.weather;
                  return (
                    <button
                      key={d.isoDate}
                      onClick={() => { setSelectedIso(d.isoDate); setPrepOpen(false); }}
                      className={`shrink-0 w-[120px] rounded-2xl p-3 border-2 text-left tap transition-all duration-150 ${active ? "border-transparent bg-gradient-profit text-profit-foreground shadow-card scale-[1.02]" : meta.cardClass}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold">{d.dayName}</p>
                          <p className="text-[10px] text-muted-foreground">{d.dateLabel}</p>
                        </div>
                        {w && <span className="text-base leading-none" title={`${w.label} · ${Math.round(w.tMax)}°`}>{w.emoji}</span>}
                      </div>
                      {(d.culturalSignal.label || d.paydaySignal.label) && (
                        <span className="mt-1 block text-[9px] font-semibold text-muted-foreground truncate" title={d.culturalSignal.label ?? d.paydaySignal.label ?? ""}>
                          {d.culturalSignal.label ?? d.paydaySignal.label}
                        </span>
                      )}
                      <span className={`mt-2 inline-block text-[9px] font-bold px-2 py-0.5 rounded-full ${meta.chipClass}`}>
                        {meta.emoji} {t(meta.labelKey)}
                      </span>
                      <p className="text-base font-extrabold mt-1">{fmt(d.expected)}</p>
                      <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                        {fmt(d.low)}–{fmt(d.high)}
                      </p>
                      {new Date(d.isoDate) < new Date(new Date().toISOString().slice(0,10)) && (
                        feedbackGiven[d.isoDate] ? (
                          <span className="mt-1 inline-block text-[9px] font-semibold text-profit">
                            ✓ {feedbackGiven[d.isoDate] === "tepat" ? "Tepat" :
                               feedbackGiven[d.isoDate] === "lebih-kurang" ? "Lebih kurang" : "Meleset"}
                          </span>
                        ) : (
                          <span className="mt-1 inline-block text-[9px] font-semibold text-muted-foreground italic">
                            Hari lepas
                          </span>
                        )
                      )}
                      {d.stock.length > 0 ? (
                        <div className="mt-1.5 space-y-0.5">
                          {d.stock.slice(0, 2).map(s => (
                            <p key={s.name} className="text-[9px] leading-tight truncate">
                              {s.emoji} {s.name} — {s.need}{s.unit}
                            </p>
                          ))}
                          {d.stock.length > 2 && (
                            <p className="text-[9px] text-muted-foreground italic">
                              +{d.stock.length - 2} lagi…
                            </p>
                          )}
                        </div>
                      ) : products.length === 0 ? (
                        <p className="mt-1.5 text-[9px] text-muted-foreground italic">
                          Set produk dulu
                        </p>
                      ) : null}
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${barPct}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
              {weatherLoading && (
                <p className="text-[11px] text-muted-foreground italic">{t("sf_fetchingWeather")} {boss}…</p>
              )}
            </section>

            {/* Detail */}
            {detail && (
              <section className="rounded-2xl bg-card border-l-4 border-primary border-y border-r border-border p-4 shadow-card space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">📅 {detail.dayName}, {detail.dateLabel}</p>
                  <p className="text-base font-extrabold mt-1">
                    {LEVEL_META[detail.level].emoji} {t(LEVEL_META[detail.level].labelKey)} — {t("sf_expected")} <span className="text-primary">{fmt(detail.expected)}</span>
                  </p>
                </div>

                {/* PREP HERO */}
                {detail.stock.length > 0 ? (
                  <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 space-y-3">
                    <div>
                      <p className="text-sm font-extrabold flex items-center gap-1.5">
                        🧑‍🍳 {t("sf_prepTitle")} — {detail.dayName}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t("sf_prepBased")} {fmt(detail.expected)}
                      </p>
                    </div>

                    <button
                      onClick={() => setPrepOpen(prev => !prev)}
                      className="w-full flex items-center justify-between rounded-xl bg-muted/50 border border-border px-4 py-3 tap"
                    >
                      <span className="text-sm font-semibold">
                        📋 {detail.stock.length} {t("sf_prepIngCount")}
                      </span>
                      <span className="text-muted-foreground text-xs flex items-center gap-1">
                        {prepOpen ? t("sf_prepHide") : t("sf_prepShow")}
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${prepOpen ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    {prepOpen && (
                      <div className="rounded-xl border border-border overflow-hidden">
                        {detail.stock.map((s, i) => (
                          <div
                            key={s.name}
                            className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                              i % 2 === 0 ? "bg-muted/30" : "bg-surface"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>{s.emoji}</span>
                              <span className="font-medium">{s.name}</span>
                              {(() => {
                                const fs = (finishedStock ?? []).find(
                                  f => f.productName.toLowerCase() === s.name.toLowerCase()
                                );
                                const fsQty = fs?.qty ?? 0;
                                return fsQty > 0 ? (
                                  <span className="text-[10px] font-semibold text-profit bg-profit/10 px-1.5 py-0.5 rounded-full">
                                    ✅ {fsQty} {t("sf_readyToSell")}
                                  </span>
                                ) : null;
                              })()}
                            </span>
                            <span className="font-bold text-primary">
                              {s.need} <span className="text-xs font-normal text-muted-foreground">{s.unit}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {stats.distinctDays < 14 && (
                      <p className="text-[11px] text-muted-foreground italic">
                        * {t("sf_prepLowDataWarning")}
                      </p>
                    )}

                    <Button onClick={handleSendDayToBuy} className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold">
                      <ShoppingCart className="w-4 h-4 mr-2" /> {t("sf_addToBuy")}
                    </Button>
                  </div>
                ) : products.length === 0 ? (
                  <div className="rounded-2xl bg-muted/40 border border-border p-6 text-center space-y-2">
                    <p className="text-4xl">📦</p>
                    <p className="text-sm font-extrabold">{t("sf_noProductsTitle")}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t("sf_noProductsDesc")}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">{t("sf_noStock")}</p>
                )}

                {/* Feedback card for past days */}
                {isPastDay && (
                  <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
                    {feedbackGiven[detail?.isoDate ?? ""] ? (
                      <div className="flex items-center gap-2 text-sm text-profit">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-semibold">
                          {t("sf_feedbackThanks")}
                        </span>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-bold">
                          {t("sf_feedbackTitle")} — {detail?.dayName}?
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            [
                              { key: "tepat",        emoji: "✅", label: t("sf_feedbackTepat") },
                              { key: "lebih-kurang", emoji: "🤷", label: t("sf_feedbackClose") },
                              { key: "meleset",      emoji: "❌", label: t("sf_feedbackOff") },
                            ] as const
                          ).map(opt => (
                            <button
                              key={opt.key}
                              onClick={() => detail && handleFeedback(detail.isoDate, opt.key)}
                              className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/40 hover:bg-muted p-3 tap transition-colors"
                            >
                              <span className="text-2xl">{opt.emoji}</span>
                              <span className="text-[11px] font-semibold text-center leading-tight">
                                {opt.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* AI model probability */}
                <div className="rounded-xl bg-accent/10 border border-accent/30 p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-accent-foreground/80 flex items-center gap-1">
                    <Activity className="w-3 h-3" /> {t("sf_aiModelTitle")}
                  </p>
                  <p className="text-sm mt-1 leading-relaxed">
                    {boss}, {t("sf_aiProb1")} <span className="font-extrabold">{detail.probHit}% {t("sf_aiProb2")}</span> {t("sf_aiProb3")}{" "}
                    <span className="font-extrabold text-primary">{fmt(detail.expected)}</span>
                    {" "}{t("sf_aiPrepRange")} <span className="font-semibold">{fmt(detail.low)}–{fmt(detail.high)}</span>.
                    {detail.stock.length > 0 && (
                      <span className="block mt-1 text-xs text-muted-foreground">
                        {t("sf_aiPrepSuffix")}{" "}
                        {detail.stock.slice(0, 3).map((s, i) => (
                          <span key={s.name}>
                            {s.emoji} {s.name} {s.need}{s.unit}{i < Math.min(detail.stock.length, 3) - 1 ? ", " : ""}
                          </span>
                        ))}
                        {detail.stock.length > 3 && (
                          <span> +{detail.stock.length - 3} {t("sf_moreItems")}</span>
                        )}
                      </span>
                    )}
                  </p>
                  {detail.weather && detail.weather.severity !== "ok" && (
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                      <CloudRain className="w-3 h-3" /> {detail.weather.label} {detail.weather.emoji}
                      {" "}({detail.weather.trafficAdjust >= 0 ? "+" : ""}{Math.round(detail.weather.trafficAdjust * 100)}% {t("sf_traffic")})
                    </p>
                  )}
                  {detail.culturalSignal.label && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      🗓️ {detail.culturalSignal.label}
                      {" "}({detail.culturalSignal.multiplier >= 1 ? "+" : ""}{Math.round((detail.culturalSignal.multiplier - 1) * 100)}% jangkaan)
                    </p>
                  )}
                  {detail.paydaySignal.label && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      💰 {detail.paydaySignal.label}
                      {" "}(+{Math.round((detail.paydaySignal.multiplier - 1) * 100)}% jangkaan)
                    </p>
                  )}
                </div>

                {detail.reasons.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{t("sf_whyAI")}</p>
                    <ul className="space-y-1">
                      {detail.reasons.map((r, i) => (
                        <li key={i} className="text-sm flex gap-2"><span className="text-primary">•</span>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* Pattern insights */}
            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t("sf_patternsHeading")} {boss}</h2>
              {(() => {
                const idxBest = stats.perWeekdayAvg.reduce((bi, v, i, a) => (v > a[bi] ? i : bi), 0);
                const idxWorst = stats.perWeekdayAvg.reduce((bi, v, i, a) => (v < a[bi] ? i : bi), 0);
                return (
                  <>
                    <InsightCard icon={<Trophy className="w-5 h-5 text-warn" />}
                      title={`${t("sf_bestDay")} ${boss}`}
                      desc={`${DAY_NAMES_MS[idxBest]} ${t("sf_bestDayDesc")} ${fmt(stats.perWeekdayAvg[idxBest])}.`}
                      bg="bg-warn-soft border-warn/30" />
                    <InsightCard icon={<Clock className="w-5 h-5 text-primary" />}
                      title={t("sf_slowDay")}
                      desc={`${DAY_NAMES_MS[idxWorst]} ${t("sf_slowDayDesc")} ${fmt(stats.perWeekdayAvg[idxWorst])}. ${t("sf_slowDayTip")}`}
                      bg="bg-primary/10 border-primary/30" />
                    <InsightCard icon={<TrendingUp className="w-5 h-5 text-profit" />}
                      title={t("sf_dailyAvg")}
                      desc={`${t("sf_dailyAvgDesc1")} ${stats.distinctDays} ${t("sf_dailyAvgDesc2")} ${boss} ${t("sf_dailyAvgDesc3")} ${fmt(stats.baseline)}.`}
                      bg="bg-profit/10 border-profit/30" />
                  </>
                );
              })()}
            </section>

            {/* Weekly summary */}
            <section className="rounded-2xl p-5 bg-gradient-profit text-profit-foreground shadow-glow space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-90">
                <ChartBar className="w-4 h-4" /> {t("sf_weekSummaryTitle")}
              </div>
              <div className="space-y-1.5 text-sm">
                <Row label={t("sf_projectedSales")} value={fmt(totalRevenue)} />
                <Row label={t("sf_materialCost")} value={fmt(matCost)} />
                <Row label={t("sf_projectedProfit")} value={fmt(profit)} />
              </div>
              <p className="text-xs italic opacity-95 pt-2 border-t border-white/20">
                {boss} {t("sf_capitalNote")} <span className="font-bold">{fmt(matCost)}</span> {t("sf_capitalNote2")}
              </p>
            </section>

            {/* Weekly checklist */}
            {weeklyChecklist.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t("sf_weekChecklistTitle")}</h2>
                <div className="rounded-2xl bg-card border border-border p-2 shadow-sm">
                  {weeklyChecklist.map((w, i) => {
                    const isChecked = checked.has(w.name);
                    return (
                      <button
                        key={w.name}
                        onClick={() => setChecked((prev) => {
                          const next = new Set(prev);
                          if (next.has(w.name)) next.delete(w.name); else next.add(w.name);
                          return next;
                        })}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 tap text-left"
                      >
                        <div className={`w-6 h-6 rounded-md border-2 grid place-items-center transition-all ${isChecked ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                          {isChecked && <CheckCircle2 className="w-4 h-4 text-primary-foreground" />}
                        </div>
                        <span className="text-lg">{w.emoji}</span>
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${isChecked ? "line-through text-muted-foreground" : ""}`}>
                            {t("sf_buyItem")} {w.name} — {w.total} {w.unit} {i === 0 && <span className="text-cost">({t("sf_mostImportant")})</span>}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button onClick={handleSendWeekToBuy} className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold">
                  <ShoppingCart className="w-4 h-4 mr-2" /> {t("sf_sendToShopList")}
                </Button>
              </section>
            )}

            {/* AI summary */}
            <section className="rounded-2xl p-5 bg-gradient-income text-white shadow-card space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-90">
                <Sparkles className="w-4 h-4" /> {t("sf_aiMessageTitle")}
              </div>
              <p className="text-sm leading-relaxed">
                {boss}, {t("sf_aiMsg1")} {stats.distinctDays} {t("sf_aiMsg2")} <span className="font-extrabold">{fmt(totalRevenue)}</span>.
                {" "}{t("sf_aiMsg3")} <span className="font-extrabold">{days.reduce((b, d) => d.expected > b.expected ? d : b, days[0]).dayName}</span>.
              </p>
              <p className="text-sm leading-relaxed pt-2 border-t border-white/20">
                {t("sf_aiMsg4")} 💪
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="opacity-90">{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);

const InsightCard = ({ icon, title, desc, bg }: { icon: React.ReactNode; title: string; desc: string; bg: string }) => (
  <div className={`rounded-2xl p-4 border ${bg} flex gap-3`}>
    <div className="w-10 h-10 rounded-xl bg-background/60 grid place-items-center shrink-0">{icon}</div>
    <div>
      <p className="font-bold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
    </div>
  </div>
);

const MultiplierToggle = ({ active, onClick, label, mult }: { active: boolean; onClick: () => void; label: string; mult: number }) => (
  <button
    onClick={onClick}
    className={`text-xs font-semibold px-3 py-1.5 rounded-full border tap transition-colors ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-muted/40 text-foreground border-border hover:bg-muted"
    }`}
  >
    {label} ×{mult}
  </button>
);

const ActiveChip = ({ label }: { label: string }) => (
  <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
    {label}
  </span>
);

