import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ArrowLeft,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Trophy,
  Share2,
  History,
  FileDown,
  Plus,
  Loader2,
  Target as TargetIcon,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { fmt } from "@/lib/format";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { supabase } from "@/integrations/supabase/client";
import { aggregateDailyReport, dayNameMs, monthNameMs, formatDateLong, type DailyAggregate } from "./aggregate";
import {
  upsertNightlyReport,
  fetchNightlyReports,
  fetchReportByDate,
  markReportRead,
  listActionItems,
  createActionItems,
  toggleActionItem,
  type NightlyReportRow,
  type ActionItemRow,
} from "./nightlyReportApi";
import type { Txn, OpExEntry, StockItem, FinishedStock, Product } from "@/types";
import { useTranslation } from "@/context/LanguageContext";

const addressBoss = (b: string) => (b?.trim() ? b.trim() : "Boss");
const isBefore8PM = () => new Date().getHours() < 20;

interface AIAnalysis {
  ringkasan: string;
  pencapaian: string;
  amaran: string;
  cadangan_esok: string[];
  motivasi: string;
}

interface Props {
  onClose: () => void;
  businessName: string;
  txns: Txn[];
  opex: OpExEntry[];
  stock: StockItem[];
  finishedStock: FinishedStock[];
  products: Product[];
}

export function LaporanMalam({ onClose, businessName, txns, opex, stock, finishedStock, products }: Props) {
  const { t } = useTranslation();
  const boss = addressBoss(businessName);
  const [view, setView] = useState<"report" | "history">("report");
  const [historyDate, setHistoryDate] = useState<string | null>(null);

  // Editable settings stored locally
  const [weeklyTarget, setWeeklyTarget] = useLocalStorage<number>("warkahbiz_weekly_target", 5000);
  const [weeklyBudget, setWeeklyBudget] = useLocalStorage<number>("warkahbiz_weekly_budget", 3000);

  // Live aggregation
  const aggregate = useMemo(() => aggregateDailyReport(txns, opex, stock), [txns, opex, stock]);

  const [report, setReport] = useState<NightlyReportRow | null>(null);
  const [actions, setActions] = useState<ActionItemRow[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [hideEarlyBanner, setHideEarlyBanner] = useState(false);

  const noDataToday = aggregate.transactionCount === 0 && aggregate.totalSales === 0;
  const beforeReportTime = isBefore8PM();

  const ruleBasedActions = useMemo(() => buildRuleBasedActions(aggregate, weeklyTarget, t), [aggregate, weeklyTarget, t]);

  const generateReport = useCallback(async () => {
    setGenerating(true);
    setAiError(null);
    try {
      // 1. Save base report (without AI yet) so we have an id immediately
      const weeklyPct = weeklyTarget > 0 ? (aggregate.weeklyRevenue / weeklyTarget) * 100 : 0;
      const baseRow = await upsertNightlyReport({
        business_name: businessName || null,
        report_date: aggregate.reportDate,
        total_sales: aggregate.totalSales,
        total_expenses: aggregate.totalExpenses,
        net_profit: aggregate.netProfit,
        sales_change_pct: aggregate.salesChangePct,
        profit_change_pct: aggregate.profitChangePct,
        expense_change_pct: aggregate.expenseChangePct,
        transaction_count: aggregate.transactionCount,
        peak_hour: aggregate.peakHour,
        slow_hour: aggregate.slowHour,
        weekly_revenue: aggregate.weeklyRevenue,
        weekly_target: weeklyTarget,
        weekly_target_progress: weeklyPct,
        weekly_expenses: aggregate.weeklyExpenses,
        weekly_budget: weeklyBudget,
        critical_stock_items: aggregate.criticalItems,
        low_stock_items: aggregate.lowItems,
        ai_summary: null,
        ai_achievement: null,
        ai_warning: null,
        ai_recommendations: null,
        ai_motivation: null,
      });
      setReport(baseRow);

      // 2. Call AI for analysis — compute enriched 30-day context
      setAiLoading(true);
      const now = Date.now();
      const thirtyAgo = now - 30 * 24 * 60 * 60 * 1000;
      const fifteenAgo = now - 15 * 24 * 60 * 60 * 1000;
      const sumWindow = (start: number, end: number) => {
        const s = txns.filter((t) => t.type === "in" && t.ts >= start && t.ts < end).reduce((a, t) => a + t.amount, 0);
        const o = opex.filter((e) => e.ts >= start && e.ts < end).reduce((a, e) => a + e.amount, 0);
        return s - o;
      };
      const firstHalf = sumWindow(thirtyAgo, fifteenAgo);
      const secondHalf = sumWindow(fifteenAgo, now);
      let profitTrend: "improving" | "declining" | "stable" = "stable";
      const denom = Math.max(Math.abs(firstHalf), 1);
      const delta = (secondHalf - firstHalf) / denom;
      if (delta > 0.1) profitTrend = "improving";
      else if (delta < -0.1) profitTrend = "declining";
      const revMap = new Map<string, number>();
      txns.filter((t) => t.type === "in" && t.ts >= thirtyAgo).forEach((t) => {
        const k = (t.label || "").trim() || "—";
        revMap.set(k, (revMap.get(k) || 0) + t.amount);
      });
      const topProductName = revMap.size > 0
        ? [...revMap.entries()].sort((a, b) => b[1] - a[1])[0][0]
        : null;

      const { data, error } = await supabase.functions.invoke("nightly-analysis", {
        body: {
          businessName: businessName || "WarkahBiz",
          totalSales: aggregate.totalSales,
          yesterdaySales: aggregate.yesterdaySales,
          salesChangePct: aggregate.salesChangePct,
          totalExpenses: aggregate.totalExpenses,
          netProfit: aggregate.netProfit,
          weeklyTarget,
          weeklyRevenue: aggregate.weeklyRevenue,
          weeklyPct,
          criticalItems: aggregate.criticalItems.map((i) => `${i.name} (${i.qty} ${i.unit})`),
          lowItems: aggregate.lowItems.map((i) => `${i.name} (${i.qty} ${i.unit})`),
          peakHour: aggregate.peakHour,
          profitTrend,
          topProductName,
          wasteRatePercent: null,
        },
      });


      let analysis: AIAnalysis | null = null;
      if (error || !data || data.error || !data.analysis) {
        setAiError(data?.error || "ai_unavailable");
      } else {
        analysis = data.analysis as AIAnalysis;
        const updated = await upsertNightlyReport({
          ...baseRow,
          ai_summary: analysis.ringkasan,
          ai_achievement: analysis.pencapaian,
          ai_warning: analysis.amaran,
          ai_recommendations: analysis.cadangan_esok,
          ai_motivation: analysis.motivasi,
        });
        setReport(updated);
      }
      setAiLoading(false);

      // 3. Build & save action items (combine AI + rule-based, dedupe, max 5)
      const combined = [
        ...ruleBasedActions,
        ...(analysis?.cadangan_esok ?? []),
      ];
      const seen = new Set<string>();
      const deduped = combined.filter((t) => {
        const key = t.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 5);

      // Replace any existing items for this report
      const existing = await listActionItems(baseRow.id);
      if (existing.length === 0 && deduped.length > 0) {
        const created = await createActionItems(baseRow.id, baseRow.report_date, deduped);
        setActions(created);
      } else {
        setActions(existing);
      }

      // Mark as read
      await markReportRead(baseRow.id);
    } catch (e) {
      console.error("generate report failed", e);
      toast.error(t("lm_reportError"));
    } finally {
      setGenerating(false);
      setAiLoading(false);
    }
  }, [aggregate, weeklyTarget, weeklyBudget, businessName, ruleBasedActions]);

  // On open: try to load today's existing report; otherwise auto-generate (unless no data)
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const existing = await fetchReportByDate(aggregate.reportDate);
        if (cancel) return;
        if (existing) {
          setReport(existing);
          const items = await listActionItems(existing.id);
          if (!cancel) setActions(items);
          if (!existing.read_at) await markReportRead(existing.id);
        } else if (!noDataToday) {
          await generateReport();
        } else if (beforeReportTime) {
          // Show yesterday if available
          const y = new Date(aggregate.reportDate + "T00:00:00");
          y.setDate(y.getDate() - 1);
          const yIso = y.toISOString().slice(0, 10);
          const prev = await fetchReportByDate(yIso);
          if (!cancel && prev) {
            setReport(prev);
            const items = await listActionItems(prev.id);
            if (!cancel) setActions(items);
          }
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (view === "history") {
    return (
      <HistoryView
        onBack={() => {
          setView("report");
          setHistoryDate(null);
        }}
        onSelect={(date) => {
          setHistoryDate(date);
          setView("report");
        }}
        onClose={onClose}
      />
    );
  }

  // If user picked a past report
  if (historyDate && historyDate !== aggregate.reportDate) {
    return (
      <PastReportView
        date={historyDate}
        boss={boss}
        onBack={() => {
          setHistoryDate(null);
          setView("history");
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <ReportContent
      report={report}
      actions={actions}
      aggregate={aggregate}
      boss={boss}
      businessName={businessName}
      weeklyTarget={weeklyTarget}
      weeklyBudget={weeklyBudget}
      onChangeTarget={setWeeklyTarget}
      onChangeBudget={setWeeklyBudget}
      noDataToday={noDataToday}
      beforeReportTime={beforeReportTime && !hideEarlyBanner}
      onDismissEarlyBanner={() => setHideEarlyBanner(true)}
      generating={generating}
      aiLoading={aiLoading}
      aiError={aiError}
      onGenerate={generateReport}
      txns={txns}
      finishedStock={finishedStock}
      products={products}
      onToggleAction={async (id, done) => {
        await toggleActionItem(id, done);
        setActions((prev) => prev.map((a) => (a.id === id ? { ...a, is_done: done } : a)));
      }}
      onClose={onClose}
      onOpenHistory={() => setView("history")}
    />
  );
}

// ============= Rule-based action generation =============
function buildRuleBasedActions(agg: DailyAggregate, weeklyTarget: number, t: (key: string, params?: Record<string, string | number>) => string): string[] {
  const actions: string[] = [];

  // Stock purchases
  agg.criticalItems.slice(0, 2).forEach((it) => {
    actions.push(t("lm_action_buy_stock").replace("{name}", it.name).replace("{qty}", String(it.qty)).replace("{unit}", it.unit));
  });

  // Tomorrow's sales target (5% above today as simple heuristic)
  const tomorrowTarget = Math.max(agg.totalSales * 1.05, agg.totalSales + 50);
  if (agg.totalSales > 0) {
    actions.push(t("lm_action_tomorrow_target").replace("{target}", tomorrowTarget.toFixed(0)));
  }

  // Behind weekly target?
  const remaining = weeklyTarget - agg.weeklyRevenue;
  const daysLeft = Math.max(7 - agg.weeklyDayIndex - 1, 1);
  if (remaining > 0 && weeklyTarget > 0) {
    const dailyNeed = remaining / daysLeft;
    actions.push(t("lm_action_weekly_gap").replace("{daily}", dailyNeed.toFixed(0)));
  }

  return actions;
}

// ============= Report Content =============
interface ReportContentProps {
  report: NightlyReportRow | null;
  actions: ActionItemRow[];
  aggregate: DailyAggregate;
  boss: string;
  businessName: string;
  weeklyTarget: number;
  weeklyBudget: number;
  onChangeTarget: (n: number) => void;
  onChangeBudget: (n: number) => void;
  noDataToday: boolean;
  beforeReportTime: boolean;
  onDismissEarlyBanner?: () => void;
  generating: boolean;
  aiLoading: boolean;
  aiError: string | null;
  onGenerate: () => Promise<void> | void;
  onToggleAction: (id: string, done: boolean) => Promise<void>;
  onClose: () => void;
  onOpenHistory: () => void;
  txns: Txn[];
  finishedStock: FinishedStock[];
  products: Product[];
}

function ReportContent(p: ReportContentProps) {
  const { t } = useTranslation();
  const r = p.report;
  const agg = p.aggregate;
  const weeklyPct = p.weeklyTarget > 0 ? (agg.weeklyRevenue / p.weeklyTarget) * 100 : 0;
  const spendingPct = p.weeklyBudget > 0 ? (agg.weeklyExpenses / p.weeklyBudget) * 100 : 0;
  const spendStatus = spendingPct > 80 ? "red" : spendingPct > 60 ? "amber" : "green";

  const finishedGoodsStats = useMemo(() => {
    return (p.finishedStock ?? [])
      .map(fs => {
        const product = (p.products ?? []).find(pr => pr.id === fs.productId);
        const price = product?.suggestedPrice ?? product?.sellingPrice ?? 0;
        const soldToday = p.txns
          .filter(tx => {
            const iso = new Date(tx.ts).toISOString().slice(0, 10);
            return iso === agg.reportDate &&
              tx.type === "in" &&
              tx.soldItems?.some(s => s.productId === fs.productId);
          })
          .reduce((sum, tx) => {
            const item = tx.soldItems?.find(s => s.productId === fs.productId);
            return sum + (item?.qty ?? 0);
          }, 0);
        const unsold = fs.qty;
        const cooked = soldToday + unsold;
        const sellThrough = cooked > 0 ? Math.round((soldToday / cooked) * 100) : null;
        const wasteValue = unsold * price;
        return {
          productId: fs.productId,
          productName: fs.productName,
          productEmoji: fs.productEmoji,
          soldToday,
          unsold,
          cooked,
          sellThrough,
          wasteValue,
          price,
        };
      })
      .filter(s => s.cooked > 0);
  }, [p.finishedStock, p.products, p.txns, agg.reportDate]);

  const totalWasteValue = finishedGoodsStats.reduce((sum, s) => sum + s.wasteValue, 0);

  const handleWhatsApp = () => {
    const text = buildWhatsAppText({
      report: r,
      aggregate: agg,
      businessName: p.businessName,
      weeklyTarget: p.weeklyTarget,
      actions: p.actions,
      t,
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handlePDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const date = formatDateLong(agg.reportDate);
      let y = 18;
      doc.setFontSize(18);
      doc.text(t("lm_pdf_title"), 14, y);
      y += 8;
      doc.setFontSize(11);
      doc.text(`${p.businessName || "WarkahBiz"} — ${date}`, 14, y);
      y += 12;

      doc.setFontSize(13);
      doc.text(t("lm_pdf_daily_summary"), 14, y);
      y += 7;
      doc.setFontSize(11);
      const rows: [string, string][] = [
        [t("lm_sales"), `RM ${agg.totalSales.toFixed(2)}`],
        [t("lm_expenses"), `RM ${agg.totalExpenses.toFixed(2)}`],
        [t("lm_netProfit"), `RM ${agg.netProfit.toFixed(2)}`],
        [t("lm_pdf_txn_count"), String(agg.transactionCount)],
        [t("lm_pdf_yesterday_sales"), `RM ${agg.yesterdaySales.toFixed(2)}`],
        [
          t("lm_pdf_sales_change"),
          agg.salesChangePct === null ? "—" : `${agg.salesChangePct.toFixed(1)}%`,
        ],
      ];
      rows.forEach(([k, v]) => {
        doc.text(`${k}:`, 16, y);
        doc.text(v, 100, y);
        y += 6;
      });

      y += 4;
      doc.setFontSize(13);
      doc.text(t("lm_weeklyTarget"), 14, y);
      y += 7;
      doc.setFontSize(11);
      doc.text(`RM ${agg.weeklyRevenue.toFixed(2)} / RM ${p.weeklyTarget.toFixed(2)} (${weeklyPct.toFixed(0)}%)`, 16, y);
      y += 10;

      if (agg.criticalItems.length) {
        doc.setFontSize(13);
        doc.text(t("lm_pdf_critical_stock"), 14, y);
        y += 7;
        doc.setFontSize(11);
        agg.criticalItems.forEach((i) => {
          doc.text(`• ${i.name}: ${i.qty} ${i.unit}`, 16, y);
          y += 6;
        });
        y += 4;
      }

      if (finishedGoodsStats.length > 0) {
        y += 8;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(t("lm_fg_title"), 14, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        finishedGoodsStats.forEach(s => {
          if (y > 280) { doc.addPage(); y = 18; }
          doc.text(
            `${s.productEmoji} ${s.productName}: ${t("lm_fg_cooked")} ${s.cooked} | ${t("lm_fg_sold")} ${s.soldToday} | ${t("lm_fg_unsold")} ${s.unsold}${s.sellThrough !== null ? ` | ${s.sellThrough}%` : ""}`,
            14,
            y
          );
          y += 5;
        });
        if (totalWasteValue > 0) {
          doc.text(`${t("lm_fg_wasteTotal")}: RM ${totalWasteValue.toFixed(2)}`, 14, y);
          y += 5;
        }
      }


      if (p.actions.length) {
        doc.setFontSize(13);
        doc.text(t("lm_tomorrowActions"), 14, y);
        y += 7;
        doc.setFontSize(11);
        p.actions.forEach((a) => {
          const lines = doc.splitTextToSize(`• ${a.action_text}`, 180);
          lines.forEach((ln: string) => {
            if (y > 280) { doc.addPage(); y = 18; }
            doc.text(ln, 16, y);
            y += 6;
          });
        });
        y += 4;
      }

      if (r?.ai_summary) {
        if (y > 240) { doc.addPage(); y = 18; }
        doc.setFontSize(13);
        doc.text(t("lm_pdf_ai_analysis"), 14, y);
        y += 7;
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(r.ai_summary, 180);
        lines.forEach((ln: string) => {
          if (y > 280) { doc.addPage(); y = 18; }
          doc.text(ln, 16, y);
          y += 5;
        });
      }

      doc.setFontSize(9);
      doc.text(t("lm_pdf_footer"), 14, 290);
      doc.save(`Laporan-${agg.reportDate}.pdf`);
      toast.success(t("lm_pdfSuccess"));
    } catch (e) {
      console.error(e);
      toast.error(t("lm_pdfError"));
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-background overflow-y-auto animate-fade-in">
      <div className="mx-auto w-full max-w-full sm:max-w-[600px] md:max-w-[760px] lg:max-w-[960px] min-h-screen pb-32">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-2">
          <button onClick={p.onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted tap" aria-label={t("lm_close")}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-extrabold leading-tight">{t("lm_pageTitle")}</h1>
            <p className="text-xs text-muted-foreground">{r ? formatDateLong(r.report_date) : formatDateLong(agg.reportDate)}</p>
          </div>
          <button onClick={p.onOpenHistory} className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted tap" aria-label={t("lm_historyAriaLabel")}>
            <History className="w-5 h-5" />
          </button>
        </header>

        <div className="px-4 py-4 space-y-5">
          {p.beforeReportTime && (
            <div className="rounded-2xl p-3 bg-primary/10 border border-primary/30 text-xs flex items-start gap-2">
              <span className="flex-1">
                {t("lm_earlyBanner")}
              </span>
              {p.onDismissEarlyBanner && (
                <button
                  onClick={p.onDismissEarlyBanner}
                  className="text-xs font-bold text-primary tap shrink-0"
                  aria-label={t("lm_dismissAlert")}
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {p.noDataToday && !r && (
            <div className="rounded-2xl p-5 bg-warn-soft border border-warn/30 text-center space-y-3">
              <p className="text-3xl">📭</p>
              <p className="font-bold">{p.boss} {t("lm_noSalesTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t("lm_noSalesHint").replace("{boss}", p.boss)}
              </p>
              <button
                onClick={p.onClose}
                className="inline-flex items-center gap-2 h-11 px-5 rounded-2xl bg-primary text-primary-foreground font-bold tap"
              >
                <Plus className="w-4 h-4" /> {t("lm_recordSalesNow")}
              </button>
            </div>
          )}

          {(r || !p.noDataToday) && (
            <>
              {/* Hero */}
              <section className="rounded-2xl p-5 bg-gradient-profit text-profit-foreground shadow-glow">
                <p className="text-xs font-bold uppercase tracking-wider opacity-90">{t("lm_netProfitToday")}</p>
                <p className="text-4xl font-extrabold mt-2">{fmt(agg.netProfit)}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat
                    label={t("lm_sales")}
                    value={fmt(agg.totalSales)}
                    delta={agg.salesChangePct}
                  />
                  <Stat label={t("lm_expenses")} value={fmt(agg.totalExpenses)} delta={agg.expenseChangePct} invert />
                  <Stat label={t("lm_transactions")} value={String(agg.transactionCount)} />
                </div>
              </section>

              {/* Weekly target */}
              <section className="rounded-2xl bg-card border border-border p-4 shadow-card space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <TargetIcon className="w-4 h-4 text-primary" /> {t("lm_weeklyTarget")}
                  </h2>
                  <input
                    type="number"
                    value={p.weeklyTarget}
                    onChange={(e) => p.onChangeTarget(Number(e.target.value) || 0)}
                    className="w-24 h-8 px-2 text-xs text-right rounded-lg border border-border bg-background"
                  />
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-profit"
                    style={{ width: `${Math.min(weeklyPct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {fmt(agg.weeklyRevenue)} / {fmt(p.weeklyTarget)} ({weeklyPct.toFixed(0)}%)
                </p>
              </section>

              {/* Spending alert */}
              <section className={`rounded-2xl p-4 border ${
                spendStatus === "red" ? "bg-cost-soft border-cost/30" :
                spendStatus === "amber" ? "bg-warn-soft border-warn/30" :
                "bg-primary/10 border-primary/30"
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-bold">{t("lm_weeklyBudget")}</h2>
                  <input
                    type="number"
                    value={p.weeklyBudget}
                    onChange={(e) => p.onChangeBudget(Number(e.target.value) || 0)}
                    className="w-24 h-8 px-2 text-xs text-right rounded-lg border border-border bg-background"
                  />
                </div>
                <p className="text-xs">
                  {fmt(agg.weeklyExpenses)} / {fmt(p.weeklyBudget)} ({spendingPct.toFixed(0)}%)
                  {spendStatus === "red" && ` ${t("lm_spendTooHigh")}`}
                  {spendStatus === "amber" && ` ${t("lm_spendWatch")}`}
                  {spendStatus === "green" && ` ${t("lm_spendOk")}`}
                </p>
              </section>

              {/* Stock alerts */}
              {(agg.criticalItems.length > 0 || agg.lowItems.length > 0) && (
                <section className="rounded-2xl bg-card border border-border p-4 shadow-card space-y-2">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <Package className="w-4 h-4" /> {t("lm_stockAlert")}
                  </h2>
                  {agg.criticalItems.map((i) => (
                    <div key={i.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full bg-cost" />
                      <span className="font-bold">{i.name}</span>
                      <span className="text-muted-foreground">— {i.qty} {i.unit} ({t("lm_critical")})</span>
                    </div>
                  ))}
                  {agg.lowItems.map((i) => (
                    <div key={i.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full bg-warn" />
                      <span className="font-bold">{i.name}</span>
                      <span className="text-muted-foreground">— {i.qty} {i.unit} ({t("lm_low")})</span>
                    </div>
                  ))}
                </section>
              )}

              {/* Finished goods */}
              {finishedGoodsStats.length > 0 && (
                <section className="rounded-2xl bg-card border border-border p-4 shadow-card space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold flex items-center gap-2">
                      🍱 {t("lm_fg_title")}
                    </h2>
                    {totalWasteValue > 0 && (
                      <span className="text-xs font-bold text-cost">
                        {t("lm_fg_wasteTotal")} RM {totalWasteValue.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {finishedGoodsStats.map(s => (
                      <div key={s.productId} className="rounded-xl border border-border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold">
                            {s.productEmoji} {s.productName}
                          </span>
                          {s.sellThrough !== null && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              s.sellThrough >= 80
                                ? "bg-profit/15 text-profit"
                                : s.sellThrough >= 50
                                ? "bg-warn/15 text-warn"
                                : "bg-cost/15 text-cost"
                            }`}>
                              {s.sellThrough}% {t("lm_fg_soldOut")}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg bg-muted py-2">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">
                              {t("lm_fg_cooked")}
                            </p>
                            <p className="text-base font-extrabold mt-0.5">{s.cooked}</p>
                          </div>
                          <div className="rounded-lg bg-profit/10 py-2">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">
                              {t("lm_fg_sold")}
                            </p>
                            <p className="text-base font-extrabold mt-0.5 text-profit">{s.soldToday}</p>
                          </div>
                          <div className={`rounded-lg py-2 ${s.unsold > 0 ? "bg-cost/10" : "bg-muted"}`}>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">
                              {t("lm_fg_unsold")}
                            </p>
                            <p className={`text-base font-extrabold mt-0.5 ${s.unsold > 0 ? "text-cost" : "text-muted-foreground"}`}>
                              {s.unsold}
                            </p>
                          </div>
                        </div>

                        {s.unsold > 0 && s.price > 0 && (
                          <p className="text-xs text-cost">
                            ⚠️ {t("lm_fg_wasteValue").replace("{value}", `RM ${s.wasteValue.toFixed(2)}`)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-muted-foreground">{t("lm_fg_note")}</p>
                </section>
              )}

              {/* AI Section */}
              <AISection report={r} loading={p.aiLoading} error={p.aiError} boss={p.boss} />

              {/* Tomorrow's actions */}
              {p.actions.length > 0 && (
                <section className="rounded-2xl bg-card border border-border p-4 shadow-card space-y-2">
                  <h2 className="text-sm font-bold">{t("lm_tomorrowActions")}</h2>
                  {p.actions.map((a) => (
                    <label key={a.id} className="flex items-start gap-2 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={a.is_done}
                        onChange={(e) => p.onToggleAction(a.id, e.target.checked)}
                        className="mt-1 w-4 h-4 accent-primary"
                      />
                      <span className={`text-sm flex-1 ${a.is_done ? "line-through text-muted-foreground" : ""}`}>
                        {a.action_text}
                      </span>
                    </label>
                  ))}
                </section>
              )}

              {/* Regenerate */}
              {!p.generating && (
                <button
                  onClick={p.onGenerate}
                  className="w-full h-11 rounded-2xl bg-surface border border-border text-sm font-bold tap"
                >
                  🔄 Jana semula laporan
                </button>
              )}
              {p.generating && (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t("lm_generating")}
                </div>
              )}

              {/* Export buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleWhatsApp}
                  className="h-12 rounded-2xl bg-[#25D366] text-white font-bold tap flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" /> WhatsApp
                </button>
                <button
                  onClick={handlePDF}
                  className="h-12 rounded-2xl bg-primary text-primary-foreground font-bold tap flex items-center justify-center gap-2"
                >
                  <FileDown className="w-4 h-4" /> PDF
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AISection({
  report,
  loading,
  error,
  boss,
}: {
  report: NightlyReportRow | null;
  loading: boolean;
  error: string | null;
  boss: string;
}) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <section className="rounded-2xl p-5 bg-gradient-income text-white shadow-card">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <p className="text-sm font-bold">{t("lm_aiAnalysing").replace("{boss}", boss)}</p>
        </div>
      </section>
    );
  }
  if (error || !report?.ai_summary) {
    return (
      <section className="rounded-2xl p-4 bg-muted/30 border border-border text-xs text-muted-foreground">
        {t("lm_aiUnavailable")}
      </section>
    );
  }
  return (
    <div className="space-y-3">
      <section className="rounded-2xl p-5 bg-gradient-income text-white shadow-card space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider opacity-90 flex items-center gap-1">
          <Sparkles className="w-4 h-4" /> {t("lm_aiSummary")}
        </p>
        <p className="text-sm leading-relaxed">{report.ai_summary}</p>
      </section>
      {report.ai_achievement && (
        <Card icon={<Trophy className="w-5 h-5 text-primary" />} title={t("lm_todayAchievement")} desc={report.ai_achievement} bg="bg-primary/8 border-primary/25" />
      )}
      {report.ai_warning && (
        <Card icon={<AlertTriangle className="w-5 h-5 text-warn" />} title={t("lm_needsAttention")} desc={report.ai_warning} bg="bg-warn-soft border-warn/30" />
      )}
      {report.ai_motivation && (
        <Card icon={<CheckCircle2 className="w-5 h-5 text-primary" />} title={t("lm_forBoss").replace("{boss}", boss)} desc={report.ai_motivation} bg="bg-primary/10 border-primary/30" />
      )}
    </div>
  );
}

// ============= History view =============
function HistoryView({ onBack, onSelect, onClose }: { onBack: () => void; onSelect: (date: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [reports, setReports] = useState<NightlyReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    fetchNightlyReports()
      .then((rs) => { if (!cancel) setReports(rs); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  const stats = useMemo(() => {
    const thisMonth = new Date().getMonth();
    const monthReports = reports.filter((r) => new Date(r.report_date + "T00:00:00").getMonth() === thisMonth);
    if (!monthReports.length) return null;
    const best = [...monthReports].sort((a, b) => b.total_sales - a.total_sales)[0];
    const avgProfit = monthReports.reduce((s, r) => s + Number(r.net_profit), 0) / monthReports.length;
    const hits = monthReports.filter((r) => r.weekly_target_progress && r.weekly_target_progress >= 100).length;
    return { best, avgProfit, hits, total: monthReports.length };
  }, [reports]);

  return (
    <div className="fixed inset-0 z-40 bg-background overflow-y-auto animate-fade-in">
      <div className="mx-auto w-full max-w-full sm:max-w-[600px] md:max-w-[760px] min-h-screen pb-32">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-2">
          <button onClick={onBack} className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted tap">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-extrabold leading-tight">{t("lm_historyTitle")}</h1>
            <p className="text-xs text-muted-foreground">{t("lm_historySubtitle")}</p>
          </div>
          <button onClick={onClose} className="text-xs font-bold text-muted-foreground tap">Tutup</button>
        </header>

        <div className="px-4 py-4 space-y-4">
          {stats && (
            <section className="rounded-2xl bg-card border border-border p-4 shadow-card grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">{t("lm_bestThisMonth")}</p>
                <p className="text-sm font-extrabold mt-1">{fmt(Number(stats.best.total_sales))}</p>
                <p className="text-[10px] text-muted-foreground">{formatDateLong(stats.best.report_date).split(",")[0]}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">{t("lm_avgProfit")}</p>
                <p className="text-sm font-extrabold mt-1">{fmt(stats.avgProfit)}</p>
                <p className="text-[10px] text-muted-foreground">{t("lm_perDay")}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">{t("lm_targetAchieved")}</p>
                <p className="text-sm font-extrabold mt-1">{stats.hits} / {stats.total}</p>
                <p className="text-[10px] text-muted-foreground">{t("days")}</p>
              </div>
            </section>
          )}

          {loading && <p className="text-center text-sm text-muted-foreground py-8">{t("lm_loading")}</p>}
          {!loading && reports.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">{t("lm_noReports")}</p>
          )}

          <div className="space-y-2">
            {reports.map((r) => {
              const hitTarget = (r.weekly_target_progress ?? 0) >= 100;
              const profit = Number(r.net_profit);
              const unread = !r.read_at;
              return (
                <button
                  key={r.id}
                  onClick={() => onSelect(r.report_date)}
                  className="w-full rounded-2xl bg-card border border-border p-4 tap flex items-center gap-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">{formatDateLong(r.report_date)}</p>
                      {unread && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("lm_sales")} <span className="text-primary font-bold">{fmt(Number(r.total_sales))}</span>
                      {" · "}
                      {t("lm_profit")} <span className={profit >= 0 ? "text-primary font-bold" : "text-cost font-bold"}>{fmt(profit)}</span>
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${hitTarget ? "bg-primary/15 text-primary" : "bg-warn-soft text-warn-foreground"}`}>
                    {hitTarget ? t("lm_achieved") : t("lm_below")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= Past Report view (read-only) =============
function PastReportView({ date, boss, onBack, onClose }: { date: string; boss: string; onBack: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [report, setReport] = useState<NightlyReportRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    fetchReportByDate(date)
      .then((r) => { if (!cancel) setReport(r); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [date]);

  return (
    <div className="fixed inset-0 z-40 bg-background overflow-y-auto animate-fade-in">
      <div className="mx-auto w-full max-w-full sm:max-w-[600px] md:max-w-[760px] min-h-screen pb-32">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-2">
          <button onClick={onBack} className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted tap">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-extrabold leading-tight">{t("lm_pastReport")}</h1>
            <p className="text-xs text-muted-foreground">{formatDateLong(date)}</p>
          </div>
          <button onClick={onClose} className="text-xs font-bold text-muted-foreground tap">Tutup</button>
        </header>

        <div className="px-4 py-4 space-y-4">
          {loading && <p className="text-center text-sm text-muted-foreground py-8">Memuatkan...</p>}
          {!loading && !report && <p className="text-center text-sm text-muted-foreground py-8">{t("lm_noRecord")}</p>}
          {report && (
            <>
              <section className="rounded-2xl p-5 bg-gradient-profit text-profit-foreground shadow-glow">
                <p className="text-xs font-bold uppercase tracking-wider opacity-90">{t("lm_netProfit")}</p>
                <p className="text-4xl font-extrabold mt-2">{fmt(Number(report.net_profit))}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <Stat label={t("lm_sales")} value={fmt(Number(report.total_sales))} />
                  <Stat label={t("lm_expenses")} value={fmt(Number(report.total_expenses))} />
                </div>
              </section>
              {report.ai_summary && (
                <section className="rounded-2xl p-5 bg-gradient-income text-white shadow-card space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-90">Ringkasan AI</p>
                  <p className="text-sm leading-relaxed">{report.ai_summary}</p>
                </section>
              )}
              {report.ai_recommendations && report.ai_recommendations.length > 0 && (
                <section className="rounded-2xl bg-card border border-border p-4 space-y-2">
                  <h2 className="text-sm font-bold">{t("lm_aiRecommendations")}</h2>
                  {report.ai_recommendations.map((c, i) => (
                    <p key={i} className="text-xs">• {c}</p>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============= Building blocks =============
function buildWhatsAppText({
  report,
  aggregate: agg,
  businessName,
  weeklyTarget,
  actions,
  t,
}: {
  report: NightlyReportRow | null;
  aggregate: DailyAggregate;
  businessName: string;
  weeklyTarget: number;
  actions: ActionItemRow[];
  t: (key: string) => string;
}) {
  const d = new Date(agg.reportDate + "T00:00:00");
  const dateLine = `${dayNameMs(d)}, ${d.getDate()} ${monthNameMs(d)} ${d.getFullYear()}`;
  const arrow = agg.salesChangePct === null ? "" : agg.salesChangePct >= 0 ? "↑" : "↓";
  const pct = agg.salesChangePct === null ? "" : ` ${arrow}${Math.abs(agg.salesChangePct).toFixed(0)}%`;
  const weeklyPct = weeklyTarget > 0 ? (agg.weeklyRevenue / weeklyTarget) * 100 : 0;

  let txt = `📊 *${t("lm_pdf_title")}*\n📅 ${dateLine}\n🏪 ${businessName || "WarkahBiz"}\n\n`;
  txt += `💰 *${t("lm_sales")}:* RM ${agg.totalSales.toFixed(2)}${pct}\n`;
  txt += `💸 *${t("lm_expenses")}:* RM ${agg.totalExpenses.toFixed(2)}\n`;
  txt += `✅ *${t("lm_netProfit")}:* RM ${agg.netProfit.toFixed(2)}\n\n`;
  txt += `📈 *${t("lm_weeklyTarget")}:* ${weeklyPct.toFixed(0)}% tercapai\n   RM ${agg.weeklyRevenue.toFixed(2)} / RM ${weeklyTarget.toFixed(2)}\n`;

  if (agg.criticalItems.length) {
    txt += `\n⚠️ *${t("lm_pdf_critical_stock")}:*\n`;
    agg.criticalItems.forEach((i) => { txt += `• ${i.name}: ${i.qty} ${i.unit}\n`; });
  }

  if (actions.length) {
    txt += `\n📋 *${t("lm_tomorrowActions")}:*\n`;
    actions.forEach((a) => { txt += `• ${a.action_text}\n`; });
  }

  txt += `\n_${t("lm_pdf_footer")}_ 🚀`;
  return txt;
}

function Stat({ label, value, delta, invert }: { label: string; value: string; delta?: number | null; invert?: boolean }) {
  const showDelta = typeof delta === "number" && !Number.isNaN(delta);
  const positive = showDelta && (invert ? delta! < 0 : delta! >= 0);
  return (
    <div className="rounded-xl bg-white/15 py-2 px-1">
      <p className="text-[10px] opacity-90 uppercase font-bold">{label}</p>
      <p className="text-sm font-extrabold mt-0.5">{value}</p>
      {showDelta && (
        <p className={`text-[10px] font-bold mt-0.5 ${positive ? "opacity-90" : "opacity-90"}`}>
          {positive ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />}
          {" "}{Math.abs(delta!).toFixed(0)}%
        </p>
      )}
    </div>
  );
}

function Card({ icon, title, desc, bg }: { icon: React.ReactNode; title: string; desc: string; bg: string }) {
  return (
    <div className={`rounded-2xl p-4 border ${bg} flex gap-3`}>
      <div className="w-10 h-10 rounded-xl bg-background/60 grid place-items-center shrink-0">{icon}</div>
      <div>
        <p className="font-bold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
