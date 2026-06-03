import { useMemo, useState } from "react";
import { X, Loader2, Download } from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import type { Txn, OpExEntry, OutletSettings } from "@/types";
import { fmt } from "@/lib/format";
import { useTranslation } from "@/context/LanguageContext";

type Period = "today" | "7d" | "month" | "3m" | "year";

interface Props {
  onClose: () => void;
  txns: Txn[];
  opex: OpExEntry[];
  outlet: OutletSettings;
  businessName: string;
}

const startOf = (p: Period): number => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === "today") return d.getTime();
  if (p === "7d") return d.getTime() - 6 * 86400000;
  if (p === "month") return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  if (p === "3m") return new Date(d.getFullYear(), d.getMonth() - 2, 1).getTime();
  return new Date(d.getFullYear(), 0, 1).getTime();
};

const periodLabel = (p: Period, t: (k: string) => string) => ({
  today: t("is_period_today"),
  "7d": t("is_period_7d"),
  month: t("is_period_month"),
  "3m": t("is_period_3m"),
  year: t("is_period_year"),
}[p]);

const periodRangeLabel = (p: Period) => {
  const from = new Date(startOf(p));
  const to = new Date();
  const fmtD = (d: Date) => d.toLocaleDateString("ms-MY", { day: "2-digit", month: "short", year: "numeric" });
  return `${fmtD(from)} – ${fmtD(to)}`;
};

export const IncomeStatementSheet = ({ onClose, txns, opex, outlet, businessName }: Props) => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>("month");
  const [exporting, setExporting] = useState(false);

  const isPeribadi = (label: string, emoji: string) => emoji === "🧑" || /peribadi/i.test(label);

  const figures = useMemo(() => {
    const from = startOf(period);
    const inTxns = txns.filter(x => x.ts >= from && !isPeribadi(x.label, x.emoji));
    const inOpex = opex.filter(e => e.ts >= from);

    let jualan = 0;
    let belianBahan = 0;
    let gaji = 0;
    let kosOperasi = 0;
    let lainLain = 0;

    inTxns.forEach(x => {
      const cat = x.category ?? (x.type === "in" ? "Jualan" : "Kos Operasi");
      if (x.type === "in") {
        if (cat === "Jualan") jualan += x.amount;
        else if (cat === "Lain-lain") lainLain += x.amount; // misc income — treat as revenue? Better add to lainLain in revenue section. Simpler: still add to jualan as "other revenue". Keep separate.
      } else {
        // legacy: "Beli xxx" → Belian Bahan
        const legacyBuy = x.label.startsWith("Beli ");
        if (cat === "Belian Bahan" || (cat === "Kos Operasi" && legacyBuy)) belianBahan += x.amount;
        else if (cat === "Gaji") gaji += x.amount;
        else if (cat === "Kos Operasi") kosOperasi += x.amount;
        else if (cat === "Lain-lain") lainLain += x.amount;
        // Aset / Liabiliti excluded from P&L
      }
    });

    inOpex.forEach(e => {
      if (e.category === "Kos Bahan") belianBahan += e.amount;
      else if (e.category === "Gaji") gaji += e.amount;
      else kosOperasi += e.amount;
    });

    const totalRevenue = jualan;
    const grossProfit = totalRevenue - belianBahan;
    const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const totalOpex = gaji + kosOperasi + lainLain;
    const netProfit = grossProfit - totalOpex;

    return { jualan, belianBahan, gaji, kosOperasi, lainLain, totalRevenue, grossProfit, margin, totalOpex, netProfit };
  }, [txns, opex, period]);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const name = (outlet.outletName || businessName || "—").toString();
      const ssm = (outlet.ssm || "—").toString();
      const generated = new Date().toLocaleString("ms-MY", { dateStyle: "long", timeStyle: "short" });
      const rangeLbl = periodRangeLabel(period);

      let y = 18;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(t("is_pdf_title"), 105, y, { align: "center" });
      y += 7;
      doc.setFontSize(12);
      doc.text(name, 105, y, { align: "center" });
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`${t("is_ssm")}: ${ssm}`, 105, y, { align: "center" });
      y += 5;
      doc.text(`${t("is_period_label")}: ${rangeLbl}`, 105, y, { align: "center" });
      y += 5;
      doc.text(`${t("is_generated_at")}: ${generated}`, 105, y, { align: "center" });
      y += 8;
      doc.setDrawColor(180); doc.line(20, y, 190, y); y += 8;

      const row = (label: string, val: number, opts: { bold?: boolean; indent?: number; rule?: boolean; large?: boolean; color?: [number, number, number] } = {}) => {
        if (opts.rule) { doc.setDrawColor(200); doc.line(20 + (opts.indent ?? 0), y - 2, 190, y - 2); }
        doc.setFont("helvetica", opts.bold ? "bold" : "normal");
        doc.setFontSize(opts.large ? 14 : 11);
        if (opts.color) doc.setTextColor(...opts.color); else doc.setTextColor(20);
        doc.text(label, 20 + (opts.indent ?? 0), y);
        doc.text(`RM ${val.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, y, { align: "right" });
        doc.setTextColor(20);
        y += opts.large ? 9 : 6;
      };

      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text(t("is_revenue").toUpperCase(), 20, y); y += 6;
      row(t("is_jualan"), figures.jualan, { indent: 5 });
      row(t("is_total_revenue"), figures.totalRevenue, { bold: true, rule: true });
      y += 3;

      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text(t("is_direct_costs").toUpperCase(), 20, y); y += 6;
      row(t("is_belian_bahan"), figures.belianBahan, { indent: 5 });
      row(`${t("is_gross_profit")} (${figures.margin.toFixed(1)}%)`, figures.grossProfit, { bold: true, rule: true });
      y += 3;

      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text(t("is_opex").toUpperCase(), 20, y); y += 6;
      row(t("is_gaji"), figures.gaji, { indent: 5 });
      row(t("is_kos_operasi"), figures.kosOperasi, { indent: 5 });
      row(t("is_lain_lain"), figures.lainLain, { indent: 5 });
      row(t("is_total_opex"), figures.totalOpex, { bold: true, rule: true });
      y += 5;

      doc.setDrawColor(40); doc.setLineWidth(0.6); doc.line(20, y, 190, y); y += 8;
      const netColor: [number, number, number] = figures.netProfit >= 0 ? [0, 120, 60] : [180, 30, 30];
      row(t("is_net_profit").toUpperCase(), figures.netProfit, { bold: true, large: true, color: netColor });
      doc.line(20, y - 4, 190, y - 4);
      doc.setLineWidth(0.2);

      doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(120);
      doc.text(t("is_pdf_footer"), 105, 285, { align: "center" });

      doc.save(`Income_Statement_${period}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(t("is_pdf_saved"));
    } catch (e) {
      console.error(e);
      toast.error(t("is_pdf_failed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[440px] max-h-[92vh] bg-surface rounded-t-[2rem] animate-slide-up flex flex-col">
        <div className="pt-3 pb-1 grid place-items-center">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/40" />
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-elevated grid place-items-center tap z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="px-5 pt-2 pb-3">
          <h2 className="text-xl font-extrabold">{t("is_title")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{outlet.outletName || businessName || "—"}</p>
          <p className="text-[10px] text-muted-foreground">{t("is_ssm")}: {outlet.ssm || "—"} · {periodRangeLabel(period)}</p>
        </div>

        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {(["today", "7d", "month", "3m", "year"] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`h-9 px-3 rounded-xl text-xs font-bold tap ${period === p ? "bg-gradient-profit text-profit-foreground" : "bg-surface-elevated text-muted-foreground"}`}>
              {periodLabel(p, t)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
          <Section title={t("is_revenue")}>
            <Line label={t("is_jualan")} value={figures.jualan} />
            <Total label={t("is_total_revenue")} value={figures.totalRevenue} />
          </Section>

          <Section title={t("is_direct_costs")}>
            <Line label={t("is_belian_bahan")} value={figures.belianBahan} negative />
            <Total label={`${t("is_gross_profit")} (${figures.margin.toFixed(1)}%)`} value={figures.grossProfit} highlight />
          </Section>

          <Section title={t("is_opex")}>
            <Line label={t("is_gaji")} value={figures.gaji} negative />
            <Line label={t("is_kos_operasi")} value={figures.kosOperasi} negative />
            <Line label={t("is_lain_lain")} value={figures.lainLain} negative />
            <Total label={t("is_total_opex")} value={figures.totalOpex} negative />
          </Section>

          <div className="rounded-3xl p-5 bg-gradient-to-br from-surface-elevated to-surface border-2 border-border">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">{t("is_net_profit")}</div>
            <div className={`text-4xl font-extrabold mt-2 text-center ${figures.netProfit >= 0 ? "text-profit" : "text-cost"}`}>
              {figures.netProfit >= 0 ? "" : "−"}{fmt(Math.abs(figures.netProfit))}
            </div>
          </div>
        </div>

        <div className="px-5 pt-2 pb-6 shrink-0 border-t border-border">
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold tap flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t("is_download_pdf")}
          </button>
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl bg-surface-elevated/40 border border-border p-3">
    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const Line = ({ label, value, negative }: { label: string; value: number; negative?: boolean }) => (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-semibold ${negative ? "text-cost" : "text-foreground"}`}>{negative && value > 0 ? "−" : ""}{fmt(value)}</span>
  </div>
);

const Total = ({ label, value, highlight, negative }: { label: string; value: number; highlight?: boolean; negative?: boolean }) => (
  <div className={`flex justify-between border-t border-border pt-2 mt-1 ${highlight ? "text-base" : "text-sm"}`}>
    <span className="font-extrabold">{label}</span>
    <span className={`font-extrabold ${highlight ? (value >= 0 ? "text-profit" : "text-cost") : negative ? "text-cost" : "text-foreground"}`}>
      {negative && value > 0 ? "−" : ""}{fmt(Math.abs(value))}
    </span>
  </div>
);
