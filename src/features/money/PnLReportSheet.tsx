import { useMemo, useState } from "react";
import { FileText, FileSpreadsheet, ArrowLeft, Calendar, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Txn, OpExEntry, PettyEntry, OpExCategory } from "@/types";
import { fmt } from "@/lib/format";
import { useTranslation } from "@/context/LanguageContext";

interface Props {
  onClose: () => void;
  onOpenFullExport?: () => void;
  txns: Txn[];
  opex: OpExEntry[];
  petty: PettyEntry[];
  businessName?: string;
}

type Step = "menu" | "period" | "preview";
type PeriodKey = "today" | "7d" | "30d" | "month" | "3m" | "1y" | "custom";

const fmt2 = (n: number) => Number(n || 0).toFixed(2);
const rm = (n: number) => `RM ${Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const tsOf = (createdAt?: string, ts?: number) => (createdAt ? new Date(createdAt).getTime() : ts ?? 0);
const dateLabel = (iso?: string, ts?: number) => {
  const d = iso ? new Date(iso) : new Date(ts ?? Date.now());
  return d.toLocaleDateString("ms-MY", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const longDate = (ms: number) => new Date(ms).toLocaleDateString("ms-MY", { day: "numeric", month: "long", year: "numeric" });
const monthKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("ms-MY", { month: "long", year: "numeric" });
};

function computeRange(period: PeriodKey, customFrom?: string, customTo?: string) {
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  if (period === "today") { /* already today */ }
  else if (period === "7d") start.setDate(start.getDate() - 6);
  else if (period === "30d") start.setDate(start.getDate() - 29);
  else if (period === "month") start.setDate(1);
  else if (period === "3m") start.setMonth(start.getMonth() - 2, 1);
  else if (period === "1y") start.setFullYear(start.getFullYear() - 1, start.getMonth(), start.getDate() + 1);
  else if (period === "custom") {
    if (customFrom) { const d = new Date(customFrom); d.setHours(0,0,0,0); start.setTime(d.getTime()); }
    if (customTo) { const d = new Date(customTo); d.setHours(23,59,59,999); end.setTime(d.getTime()); }
  }
  return { start: start.getTime(), end: end.getTime() };
}

interface Report {
  start: number;
  end: number;
  jualanProduk: number;
  pendapatanLain: number;
  totalRevenue: number;
  kosBahan: number;
  kosPembungkusan: number;
  kosBekalanLain: number;
  totalCogs: number;
  grossProfit: number;
  grossMargin: number;
  opexBreakdown: Record<OpExCategory, number>;
  totalOpex: number;
  netProfit: number;
  netMargin: number;
  pettyOpening: number;
  pettyUsed: number;
  pettyClosing: number;
  txnsInPeriod: Txn[];
  opexInPeriod: OpExEntry[];
}

function buildReport(txns: Txn[], opex: OpExEntry[], petty: PettyEntry[], start: number, end: number): Report {
  const txnsInPeriod = txns.filter(t => { const ts = tsOf(t.createdAt, t.ts); return ts >= start && ts <= end; });
  const opexInPeriod = opex.filter(e => { const ts = tsOf(e.createdAt, e.ts); return ts >= start && ts <= end; });

  const jualanProduk = txnsInPeriod.filter(t => t.type === "in").reduce((s, t) => s + t.amount, 0);
  const pendapatanLain = 0;
  const totalRevenue = jualanProduk + pendapatanLain;

  const opexBreakdown: Record<OpExCategory, number> = {
    "Kos Bahan": 0, "Utiliti": 0, "Pembungkusan": 0, "Gaji": 0,
    "Pengangkutan": 0, "Sewa Tapak": 0, "Lesen": 0, "Lain-lain": 0,
  };
  opexInPeriod.forEach(e => { opexBreakdown[e.category] = (opexBreakdown[e.category] || 0) + e.amount; });

  const kosBahan = opexBreakdown["Kos Bahan"];
  const kosPembungkusan = opexBreakdown["Pembungkusan"];
  const kosBekalanLain = 0;
  const totalCogs = kosBahan + kosPembungkusan + kosBekalanLain;

  const grossProfit = totalRevenue - totalCogs;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const opCategories: OpExCategory[] = ["Utiliti", "Sewa Tapak", "Gaji", "Pengangkutan", "Lesen", "Lain-lain"];
  const totalOpex = opCategories.reduce((s, c) => s + opexBreakdown[c], 0);
  const netProfit = grossProfit - totalOpex;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Petty cash
  const sortedPetty = [...petty].sort((a, b) => tsOf(a.createdAt, a.ts) - tsOf(b.createdAt, b.ts));
  const before = sortedPetty.filter(p => tsOf(p.createdAt, p.ts) < start);
  const within = sortedPetty.filter(p => { const ts = tsOf(p.createdAt, p.ts); return ts >= start && ts <= end; });
  const pettyOpening = before.length ? before[before.length - 1].balance : 0;
  const pettyUsed = within.filter(p => p.type === "out").reduce((s, p) => s + p.amount, 0);
  const pettyClosing = within.length ? within[within.length - 1].balance : pettyOpening;

  return {
    start, end, jualanProduk, pendapatanLain, totalRevenue,
    kosBahan, kosPembungkusan, kosBekalanLain, totalCogs,
    grossProfit, grossMargin, opexBreakdown, totalOpex,
    netProfit, netMargin, pettyOpening, pettyUsed, pettyClosing,
    txnsInPeriod, opexInPeriod,
  };
}

const refNo = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `WB-PL-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

export const PnLReportSheet = ({ onClose, onOpenFullExport, txns, opex, petty, businessName }: Props) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("menu");
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportRef] = useState(refNo());

  const range = useMemo(() => computeRange(period, customFrom, customTo), [period, customFrom, customTo]);
  const report = useMemo(() => buildReport(txns, opex, petty, range.start, range.end), [txns, opex, petty, range]);
  const periodLabel = `${longDate(range.start)} — ${longDate(range.end)}`;
  const businessLabel = businessName?.trim() || t("pnl_yourBusiness");
  const isEmpty = report.txnsInPeriod.length === 0 && report.opexInPeriod.length === 0;

  const monthlyBreakdown = useMemo(() => {
    const map = new Map<string, { sales: number; cogs: number; opex: number; net: number }>();
    report.txnsInPeriod.forEach(t => {
      const k = monthKey(tsOf(t.createdAt, t.ts));
      const r = map.get(k) ?? { sales: 0, cogs: 0, opex: 0, net: 0 };
      if (t.type === "in") r.sales += t.amount;
      map.set(k, r);
    });
    report.opexInPeriod.forEach(e => {
      const k = monthKey(tsOf(e.createdAt, e.ts));
      const r = map.get(k) ?? { sales: 0, cogs: 0, opex: 0, net: 0 };
      if (e.category === "Kos Bahan" || e.category === "Pembungkusan") r.cogs += e.amount;
      else r.opex += e.amount;
      map.set(k, r);
    });
    map.forEach(r => { r.net = r.sales - r.cogs - r.opex; });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [report]);

  const handleExcel = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const wb = XLSX.utils.book_new();
      // Sheet 1: P&L
      const aoa: (string | number)[][] = [];
      aoa.push(["WarkahBiz - Laporan Untung Rugi"]);
      aoa.push([businessLabel]);
      aoa.push([`Tempoh: ${periodLabel}`]);
      aoa.push([`Dijana: ${new Date().toLocaleString("ms-MY")}`]);
      aoa.push([`Ruj: ${reportRef}`]);
      aoa.push([]);
      aoa.push(["A. PENDAPATAN", "RM"]);
      aoa.push(["Jualan Produk", report.jualanProduk]);
      aoa.push(["Pendapatan Lain", report.pendapatanLain]);
      aoa.push(["JUMLAH PENDAPATAN", report.totalRevenue]);
      aoa.push([]);
      aoa.push(["B. KOS BARANG DIJUAL (COGS)", "RM"]);
      aoa.push(["Kos Bahan-Bahan", report.kosBahan]);
      aoa.push(["Kos Pembungkusan", report.kosPembungkusan]);
      aoa.push(["Kos Bekalan Lain", report.kosBekalanLain]);
      aoa.push(["JUMLAH COGS", report.totalCogs]);
      aoa.push(["UNTUNG KASAR", report.grossProfit]);
      aoa.push([`Margin Untung Kasar (%)`, Number(report.grossMargin.toFixed(2))]);
      aoa.push([]);
      aoa.push(["C. KOS OPERASI", "RM"]);
      aoa.push(["Utiliti", report.opexBreakdown["Utiliti"]]);
      aoa.push(["Sewa Tapak", report.opexBreakdown["Sewa Tapak"]]);
      aoa.push(["Gaji & Upah", report.opexBreakdown["Gaji"]]);
      aoa.push(["Pengangkutan", report.opexBreakdown["Pengangkutan"]]);
      aoa.push(["Pembungkusan (Operasi)", 0]);
      aoa.push(["Lesen & Permit", report.opexBreakdown["Lesen"]]);
      aoa.push(["Lain-lain", report.opexBreakdown["Lain-lain"]]);
      aoa.push(["JUMLAH KOS OPERASI", report.totalOpex]);
      aoa.push([]);
      aoa.push(["D. KEUNTUNGAN BERSIH", "RM"]);
      aoa.push(["UNTUNG BERSIH SEBELUM CUKAI", report.netProfit]);
      aoa.push([`Margin Untung Bersih (%)`, Number(report.netMargin.toFixed(2))]);
      aoa.push([]);
      aoa.push(["E. PETTY CASH", "RM"]);
      aoa.push(["Baki Awal", report.pettyOpening]);
      aoa.push(["Jumlah Digunakan", report.pettyUsed]);
      aoa.push(["Baki Akhir", report.pettyClosing]);

      const ws1 = XLSX.utils.aoa_to_sheet(aoa);
      ws1["!cols"] = [{ wch: 36 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws1, "Untung Rugi");

      // Sheet 2: Daily transactions
      const txnRows = [
        ...report.txnsInPeriod.map(t => ({
          Tarikh: dateLabel(t.createdAt, t.ts),
          Kategori: t.type === "in" ? "Jualan" : (t.label.startsWith("Beli ") ? "Pembelian" : "Belanja"),
          Penerangan: t.label,
          "Jumlah (RM)": fmt2(t.amount),
          Jenis: t.type === "in" ? "Masuk" : "Keluar",
        })),
        ...report.opexInPeriod.map(e => ({
          Tarikh: dateLabel(e.createdAt, e.ts),
          Kategori: e.category,
          Penerangan: e.desc,
          "Jumlah (RM)": fmt2(e.amount),
          Jenis: "Kos Operasi",
        })),
      ].sort((a, b) => a.Tarikh.localeCompare(b.Tarikh));
      const ws2 = XLSX.utils.json_to_sheet(
        txnRows.length ? txnRows : [{ Tarikh: "", Kategori: "", Penerangan: "", "Jumlah (RM)": "", Jenis: "" }]
      );
      ws2["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 32 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Transaksi Harian");

      // Sheet 3: monthly summary if multiple months
      if (monthlyBreakdown.length > 1) {
        const monthly = monthlyBreakdown.map(([k, r]) => ({
          Bulan: monthLabel(k),
          "Pendapatan (RM)": fmt2(r.sales),
          "COGS (RM)": fmt2(r.cogs),
          "Kos Operasi (RM)": fmt2(r.opex),
          "Untung Bersih (RM)": fmt2(r.net),
        }));
        const ws3 = XLSX.utils.json_to_sheet(monthly);
        ws3["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws3, "Ringkasan Bulanan");
      }

      XLSX.writeFile(wb, `WarkahBiz_PnL_${reportRef}.xlsx`);
      toast.success(t("pnl_excelSuccess"));
    } catch (err) {
      console.error(err);
      toast.error(t("pnl_excelError"));
    } finally {
      setLoading(false);
    }
  };

  const handlePdf = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // Header bar
      doc.setFillColor(20, 83, 45); // #14532D
      doc.rect(0, 0, pageW, 70, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("WarkahBiz", 40, 32);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Laporan Untung Rugi (Profit & Loss Statement)", 40, 52);

      doc.setTextColor(0, 0, 0);
      let y = 90;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(businessLabel, 40, y); y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Tempoh: ${periodLabel}`, 40, y); y += 12;
      doc.text(`Dijana: ${new Date().toLocaleString("ms-MY")}`, 40, y); y += 12;
      doc.text(`Ruj: ${reportRef}`, 40, y); y += 16;

      // Summary boxes
      const boxes = [
        { label: "Pendapatan", value: rm(report.totalRevenue), color: [22, 163, 74] as [number, number, number] },
        { label: "Perbelanjaan", value: rm(report.totalCogs + report.totalOpex), color: [220, 38, 38] as [number, number, number] },
        { label: "Untung Bersih", value: rm(report.netProfit), color: report.netProfit >= 0 ? [22, 163, 74] as [number, number, number] : [220, 38, 38] as [number, number, number] },
        { label: "Margin", value: `${report.netMargin.toFixed(1)}%`, color: [37, 99, 235] as [number, number, number] },
      ];
      const boxW = (pageW - 80 - 30) / 4;
      boxes.forEach((b, i) => {
        const x = 40 + i * (boxW + 10);
        doc.setFillColor(245, 245, 245);
        doc.rect(x, y, boxW, 50, "F");
        doc.setTextColor(100);
        doc.setFontSize(8);
        doc.text(b.label.toUpperCase(), x + 8, y + 14);
        doc.setTextColor(...b.color);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(b.value, x + 8, y + 36);
        doc.setFont("helvetica", "normal");
      });
      doc.setTextColor(0);
      y += 70;

      const tableStyles = { fontSize: 9, cellPadding: 4 };
      const headStyles = { fillColor: [20, 83, 45] as [number, number, number], textColor: 255, fontStyle: "bold" as const };

      autoTable(doc, {
        startY: y,
        head: [["A. PENDAPATAN", "RM"]],
        body: [
          ["Jualan Produk", rm(report.jualanProduk)],
          ["Pendapatan Lain", rm(report.pendapatanLain)],
          [{ content: "JUMLAH PENDAPATAN", styles: { fontStyle: "bold" } }, { content: rm(report.totalRevenue), styles: { fontStyle: "bold" } }],
        ],
        styles: tableStyles, headStyles,
        columnStyles: { 1: { halign: "right", cellWidth: 120 } },
      });

      autoTable(doc, {
        head: [["B. KOS BARANG DIJUAL (COGS)", "RM"]],
        body: [
          ["Kos Bahan-Bahan", rm(report.kosBahan)],
          ["Kos Pembungkusan", rm(report.kosPembungkusan)],
          ["Kos Bekalan Lain", rm(report.kosBekalanLain)],
          [{ content: "JUMLAH COGS", styles: { fontStyle: "bold" } }, { content: rm(report.totalCogs), styles: { fontStyle: "bold" } }],
          [{ content: "UNTUNG KASAR", styles: { fontStyle: "bold", textColor: [22, 163, 74] } }, { content: rm(report.grossProfit), styles: { fontStyle: "bold", textColor: [22, 163, 74] } }],
          [`Margin Untung Kasar`, `${report.grossMargin.toFixed(2)}%`],
        ],
        styles: tableStyles, headStyles,
        columnStyles: { 1: { halign: "right", cellWidth: 120 } },
      });

      autoTable(doc, {
        head: [["C. KOS OPERASI", "RM"]],
        body: [
          ["Utiliti (Letrik, Air)", rm(report.opexBreakdown["Utiliti"])],
          ["Sewa Tapak", rm(report.opexBreakdown["Sewa Tapak"])],
          ["Gaji & Upah", rm(report.opexBreakdown["Gaji"])],
          ["Pengangkutan", rm(report.opexBreakdown["Pengangkutan"])],
          ["Pembungkusan", rm(0)],
          ["Lesen & Permit", rm(report.opexBreakdown["Lesen"])],
          ["Lain-lain", rm(report.opexBreakdown["Lain-lain"])],
          [{ content: "JUMLAH KOS OPERASI", styles: { fontStyle: "bold" } }, { content: rm(report.totalOpex), styles: { fontStyle: "bold" } }],
        ],
        styles: tableStyles, headStyles,
        columnStyles: { 1: { halign: "right", cellWidth: 120 } },
      });

      autoTable(doc, {
        head: [["D. KEUNTUNGAN BERSIH", "RM"]],
        body: [
          [
            { content: "UNTUNG BERSIH SEBELUM CUKAI", styles: { fontStyle: "bold", textColor: report.netProfit >= 0 ? [22, 163, 74] : [220, 38, 38] } },
            { content: rm(report.netProfit), styles: { fontStyle: "bold", textColor: report.netProfit >= 0 ? [22, 163, 74] : [220, 38, 38] } },
          ],
          ["Margin Untung Bersih", `${report.netMargin.toFixed(2)}%`],
        ],
        styles: tableStyles, headStyles,
        columnStyles: { 1: { halign: "right", cellWidth: 120 } },
      });

      autoTable(doc, {
        head: [["E. PETTY CASH", "RM"]],
        body: [
          ["Baki Petty Cash Awal", rm(report.pettyOpening)],
          ["Jumlah Digunakan", rm(report.pettyUsed)],
          [{ content: "Baki Petty Cash Akhir", styles: { fontStyle: "bold" } }, { content: rm(report.pettyClosing), styles: { fontStyle: "bold" } }],
        ],
        styles: tableStyles, headStyles,
        columnStyles: { 1: { halign: "right", cellWidth: 120 } },
      });

      // Footer on each page
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text("Laporan ini dijana secara automatik oleh WarkahBiz. Data berdasarkan rekod yang dimasukkan oleh pengguna.", 40, pageH - 30);
        doc.text(`Halaman ${i} / ${pageCount}`, pageW - 40, pageH - 30, { align: "right" });
      }

      doc.save(`WarkahBiz_PnL_${reportRef}.pdf`);
      toast.success(t("pnl_pdfSuccess"));
    } catch (err) {
      console.error(err);
      toast.error(t("pnl_pdfError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[480px] max-h-[90vh] overflow-y-auto bg-surface rounded-t-[2rem] p-5 pb-8 animate-slide-up">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {step !== "menu" && (
              <button onClick={() => setStep(step === "preview" ? "period" : "menu")} className="w-8 h-8 grid place-items-center rounded-full bg-surface-elevated tap">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h3 className="font-extrabold text-lg">
              {step === "menu" ? t("pnl_exportReport") : step === "period" ? t("pnl_choosePeriod") : t("pnl_previewReport")}
            </h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full bg-surface-elevated tap">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === "menu" && (
          <div className="space-y-2">
            <button
              onClick={() => setStep("period")}
              className="w-full h-16 rounded-2xl bg-primary text-primary-foreground px-4 flex items-center gap-3 tap"
            >
              <FileText className="w-5 h-5" />
              <div className="flex-1 text-left">
                <div className="font-bold">{t("pnl_plReport")}</div>
                <div className="text-[11px] opacity-80">{t("pnl_plReportDesc")}</div>
              </div>
            </button>
            <button
              onClick={() => { onClose(); onOpenFullExport?.(); }}
              className="w-full h-16 rounded-2xl bg-surface-elevated px-4 flex items-center gap-3 tap"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <div className="flex-1 text-left">
                <div className="font-bold">{t("pnl_fullTxnRecord")}</div>
                <div className="text-[11px] text-muted-foreground">{t("pnl_fullTxnRecordDesc")}</div>
              </div>
            </button>
          </div>
        )}

        {step === "period" && (
          <div className="space-y-2">
            {([
              { k: "today", label: t("periodToday") },
              { k: "7d", label: t("periodWeek") },
              { k: "30d", label: t("pnl_period30d") },
              { k: "month", label: t("periodMonth") },
              { k: "3m", label: t("period3Months") },
              { k: "1y", label: t("pnl_period1y") },
              { k: "custom", label: t("pnl_periodCustom") },
            ] as const).map(p => (
              <button
                key={p.k}
                onClick={() => setPeriod(p.k)}
                className={`w-full h-12 rounded-xl px-4 flex items-center gap-2 tap text-sm font-semibold ${period === p.k ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}
              >
                <Calendar className="w-4 h-4" />
                {p.label}
              </button>
            ))}
            {period === "custom" && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <label className="text-xs">
                  <span className="text-muted-foreground">{t("pnl_from")}</span>
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full mt-1 h-10 rounded-lg bg-surface-elevated px-2 text-sm" />
                </label>
                <label className="text-xs">
                  <span className="text-muted-foreground">{t("pnl_to")}</span>
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full mt-1 h-10 rounded-lg bg-surface-elevated px-2 text-sm" />
                </label>
              </div>
            )}
            <button
              onClick={() => setStep("preview")}
              className="w-full h-12 mt-2 rounded-xl bg-gradient-profit text-profit-foreground font-bold tap"
            >
              {t("pnl_generatePreview")}
            </button>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">{periodLabel}</div>

            {isEmpty ? (
              <div className="rounded-2xl p-6 bg-surface-elevated text-center">
                <div className="text-4xl mb-2">📭</div>
                <div className="font-bold mb-1">{t("pnl_noRecords")}</div>
                <div className="text-xs text-muted-foreground">{t("pnl_noRecordsHint")}</div>
              </div>
            ) : (
              <>
                <div className={`rounded-2xl p-5 text-center ${report.netProfit >= 0 ? "bg-profit/10" : "bg-cost/10"}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("pnl_netProfit")}</div>
                  <div className={`text-4xl font-extrabold mt-2 tabular-nums ${report.netProfit >= 0 ? "text-profit" : "text-cost"}`}>
                    {rm(report.netProfit)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{t("pnl_margin")} {report.netMargin.toFixed(1)}%</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <SummaryBox label={t("pnl_revenue")} value={rm(report.totalRevenue)} tone="profit" />
                  <SummaryBox label={t("pnl_expenses")} value={rm(report.totalCogs + report.totalOpex)} tone="cost" />
                  <SummaryBox label={t("pnl_grossProfit")} value={rm(report.grossProfit)} tone="profit" />
                  <SummaryBox label={t("pnl_grossMargin")} value={`${report.grossMargin.toFixed(1)}%`} tone="info" />
                </div>

                <Section title={t("pnl_sectionRevenue")}>
                  <Row label={t("pnl_salesProduct")} value={rm(report.jualanProduk)} positive />
                  <Row label={t("pnl_otherIncome")} value={rm(report.pendapatanLain)} positive />
                  <Row label={t("pnl_totalRevenue")} value={rm(report.totalRevenue)} positive bold />
                </Section>

                <Section title={t("pnl_sectionCogs")}>
                  <Row label={t("pnl_rawMaterials")} value={rm(report.kosBahan)} negative />
                  <Row label={t("pnl_packagingCost")} value={rm(report.kosPembungkusan)} negative />
                  <Row label={t("pnl_otherSupplies")} value={rm(report.kosBekalanLain)} negative />
                  <Row label={t("pnl_totalCogs")} value={rm(report.totalCogs)} negative bold />
                  <Row label={t("pnl_grossProfitLabel")} value={rm(report.grossProfit)} positive bold />
                  <Row label={t("pnl_grossMarginLabel")} value={`${report.grossMargin.toFixed(2)}%`} />
                </Section>

                <Section title={t("pnl_sectionOpex")}>
                  <Row label={t("pnl_utility")} value={rm(report.opexBreakdown["Utiliti"])} negative />
                  <Row label={t("pnl_rent")} value={rm(report.opexBreakdown["Sewa Tapak"])} negative />
                  <Row label={t("pnl_salary")} value={rm(report.opexBreakdown["Gaji"])} negative />
                  <Row label={t("pnl_transport")} value={rm(report.opexBreakdown["Pengangkutan"])} negative />
                  <Row label={t("pnl_license")} value={rm(report.opexBreakdown["Lesen"])} negative />
                  <Row label={t("pnl_others")} value={rm(report.opexBreakdown["Lain-lain"])} negative />
                  <Row label={t("pnl_totalOpex")} value={rm(report.totalOpex)} negative bold />
                </Section>

                <Section title={t("pnl_sectionNetProfit")}>
                  <Row label={t("pnl_netProfitBeforeTax")} value={rm(report.netProfit)} positive={report.netProfit >= 0} negative={report.netProfit < 0} bold />
                  <Row label={t("pnl_netMarginLabel")} value={`${report.netMargin.toFixed(2)}%`} />
                </Section>

                <Section title={t("pnl_sectionPettyCash")}>
                  <Row label={t("pnl_openingBalance")} value={rm(report.pettyOpening)} />
                  <Row label={t("pnl_amountUsed")} value={rm(report.pettyUsed)} negative />
                  <Row label={t("pnl_closingBalance")} value={rm(report.pettyClosing)} bold />
                </Section>
              </>
            )}

            {!isEmpty && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button onClick={handlePdf} disabled={loading} className="h-12 rounded-xl bg-primary text-primary-foreground font-bold tap flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  {t("pnl_downloadPdf")}
                </button>
                <button onClick={handleExcel} disabled={loading} className="h-12 rounded-xl bg-gradient-profit text-profit-foreground font-bold tap flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                  {t("pnl_downloadExcel")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const SummaryBox = ({ label, value, tone }: { label: string; value: string; tone: "profit" | "cost" | "info" }) => {
  const cls = tone === "profit" ? "text-profit" : tone === "cost" ? "text-cost" : "text-primary";
  return (
    <div className="rounded-xl p-3 bg-surface-elevated">
      <div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
      <div className={`text-base font-extrabold mt-1 ${cls}`}>{value}</div>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl bg-surface-elevated overflow-hidden">
    <div className="px-3 py-2 bg-primary/10 text-xs font-bold uppercase">{title}</div>
    <div className="divide-y divide-border">{children}</div>
  </div>
);

const Row = ({ label, value, positive, negative, bold }: { label: string; value: string; positive?: boolean; negative?: boolean; bold?: boolean }) => (
  <div className={`px-3 py-2 flex items-center justify-between ${bold ? "font-bold" : ""}`}>
    <span className="text-xs">{label}</span>
    <span className={`text-xs tabular-nums ${positive ? "text-profit" : negative ? "text-cost" : ""}`}>{value}</span>
  </div>
);
