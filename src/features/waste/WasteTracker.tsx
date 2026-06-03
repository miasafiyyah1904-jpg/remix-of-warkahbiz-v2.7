import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Trash2, Sparkles, TrendingDown, TrendingUp, Save, ShoppingCart, Calendar as CalendarIcon, FileText, ChevronDown, ChevronRight, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fmt } from "@/lib/format";
import type { Product, StockItem, Unit } from "@/types";
import { fetchSisaRange, upsertSisaBatch, type SisaRow, type SisaUpsert } from "./sisaHarianApi";

type RangeKey = "7" | "14" | "30" | "month" | "custom";

const addressBoss = (b: string) => (b?.trim() ? b.trim() : "Boss");

const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const DAY_NAMES_MS = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
const DAY_NAMES_SHORT = ["Ahd", "Isn", "Sel", "Rab", "Kha", "Jum", "Sab"];

const todayISO = () => toISODate(new Date());
const yesterdayISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toISODate(d);
};

const dayOfWeekFromISO = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=Sun..6=Sat
};

interface DraftRow {
  productId: string;
  emoji: string;
  name: string;
  unit: Unit;
  unitCost: number;
  prepared: number;
  unsold: number;
  aiSuggested?: number;
  availableStock: number | null;
}

interface Props {
  onClose: () => void;
  businessName: string;
  products: Product[];
  stock: StockItem[];
  onSendToBuy: (items: { emoji: string; name: string; recQty: number; unit: Unit; note?: string }[]) => void;
}

export function WasteTracker({ onClose, businessName, products, stock, onSendToBuy }: Props) {
  const boss = addressBoss(businessName);

  // ---------- DATE RANGE ----------
  const [rangeKey, setRangeKey] = useState<RangeKey>("7");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const { fromDate, toDate, rangeLabel } = useMemo(() => {
    const today = new Date();
    let from = new Date();
    let label = "7 hari terakhir";
    if (rangeKey === "7") { from.setDate(today.getDate() - 6); label = "7 hari terakhir"; }
    else if (rangeKey === "14") { from.setDate(today.getDate() - 13); label = "14 hari terakhir"; }
    else if (rangeKey === "30") { from.setDate(today.getDate() - 29); label = "30 hari terakhir"; }
    else if (rangeKey === "month") { from = new Date(today.getFullYear(), today.getMonth(), 1); label = "Bulan ini"; }
    else if (rangeKey === "custom" && customFrom && customTo) {
      return { fromDate: customFrom, toDate: customTo, rangeLabel: `${customFrom} → ${customTo}` };
    }
    return { fromDate: toISODate(from), toDate: toISODate(today), rangeLabel: label };
  }, [rangeKey, customFrom, customTo]);

  // ---------- DATA ----------
  const [rows, setRows] = useState<SisaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);

  const reload = async () => {
    setLoading(true);
    // Fetch wider range so we can show "previous 7 days" trend even when user picks 7 days
    const wider = new Date();
    wider.setDate(wider.getDate() - 60);
    const data = await fetchSisaRange(toISODate(wider), todayISO());
    setRows(data);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  // ---------- TODAY'S DRAFT ROWS ----------
  const todayStr = todayISO();
  const yStr = yesterdayISO();

  const drafts = useMemo<DraftRow[]>(() => {
    return products.map((p) => {
      const todayRow = rows.find((r) => r.product_id === p.id && r.log_date === todayStr);
      const yesterdayRow = rows.find((r) => r.product_id === p.id && r.log_date === yStr);
      const unitCost = +(p.costPerUnit ?? p.costPrice ?? 0).toFixed(2);
      const aiSuggested = yesterdayRow?.ai_suggested_qty ?? undefined;
      const fallbackPrepared = aiSuggested ?? Math.max(1, Math.round((p.batchSize ?? 0) || 10));
      const perBatch = p.servingsPerBatch ?? p.batchSize ?? 1;
      const stockServings = Math.floor((p.batchesFromIngredients ?? 0) * perBatch);
      const availableStock = stockServings > 0 ? stockServings : null;
      return {
        productId: p.id,
        emoji: p.emoji || "🍽️",
        name: p.name,
        unit: (p.batchUnit as Unit) || "unit",
        unitCost,
        prepared: todayRow?.prepared_qty ?? fallbackPrepared,
        unsold: todayRow?.leftover_qty ?? 0,
        aiSuggested,
        availableStock,
      };
    });
  }, [products, rows, todayStr, yStr]);

  const [draftEdits, setDraftEdits] = useState<Record<string, { prepared?: number; unsold?: number }>>({});

  const getDraftValue = (d: DraftRow, key: "prepared" | "unsold") => {
    const edit = draftEdits[d.productId]?.[key];
    return edit !== undefined ? edit : d[key];
  };

  const setDraft = (productId: string, key: "prepared" | "unsold", v: number) => {
    setDraftEdits((prev) => ({ ...prev, [productId]: { ...prev[productId], [key]: Math.max(0, v) } }));
  };

  const isDraftInvalid = (d: DraftRow) => {
    const prepared = getDraftValue(d, "prepared");
    const unsold = getDraftValue(d, "unsold");
    if (d.availableStock != null && prepared > d.availableStock) return true;
    if (unsold > prepared) return true;
    return false;
  };
  const hasInvalidDraft = drafts.some(isDraftInvalid);

  const saveTodayBatch = async () => {
    if (!products.length) {
      toast.error("Boss belum tambah produk lagi.");
      return;
    }
    setSaving(true);
    const upserts: SisaUpsert[] = drafts.map((d) => {
      const prepared = getDraftValue(d, "prepared");
      const unsold = getDraftValue(d, "unsold");
      const leftover = Math.max(0, Math.min(unsold, prepared));
      const sold = Math.max(0, prepared - leftover);
      const leftoverValue = +(leftover * d.unitCost).toFixed(2);
      return {
        product_id: d.productId,
        product_name: d.name,
        log_date: todayStr,
        prepared_qty: prepared,
        sold_qty: sold,
        leftover_qty: leftover,
        leftover_value: leftoverValue,
        unit_cost: d.unitCost,
        ai_suggested_qty: null, // computed from patterns later
      };
    });
    const ok = await upsertSisaBatch(upserts);
    setSaving(false);
    if (!ok) {
      toast.error("Tak dapat simpan rekod. Cuba lagi.");
      return;
    }
    setDraftEdits({});
    toast.success(`Rekod hari ini disimpan (${upserts.length} produk) ✅`);
    reload();
  };

  // ---------- FILTERED ROWS BY RANGE ----------
  const filtered = useMemo(() => rows.filter((r) => r.log_date >= fromDate && r.log_date <= toDate), [rows, fromDate, toDate]);

  // ---------- SUMMARY ----------
  const summary = useMemo(() => {
    let totalLeftoverUnits = 0;
    let totalLeftoverValue = 0;
    let totalSold = 0;
    let totalPrepared = 0;
    const perProduct: Record<string, { name: string; emoji: string; unit: string; days: number; leftover: number; sold: number; prepared: number; value: number }> = {};
    filtered.forEach((r) => {
      totalLeftoverUnits += Number(r.leftover_qty) || 0;
      totalLeftoverValue += Number(r.leftover_value) || 0;
      totalSold += Number(r.sold_qty) || 0;
      totalPrepared += Number(r.prepared_qty) || 0;
      const product = products.find((p) => p.id === r.product_id);
      const key = r.product_id;
      if (!perProduct[key]) {
        perProduct[key] = {
          name: r.product_name,
          emoji: product?.emoji || "🍽️",
          unit: product?.batchUnit || "unit",
          days: 0, leftover: 0, sold: 0, prepared: 0, value: 0,
        };
      }
      perProduct[key].days += 1;
      perProduct[key].leftover += Number(r.leftover_qty) || 0;
      perProduct[key].sold += Number(r.sold_qty) || 0;
      perProduct[key].prepared += Number(r.prepared_qty) || 0;
      perProduct[key].value += Number(r.leftover_value) || 0;
    });
    const worstProduct = Object.entries(perProduct).sort((a, b) => b[1].leftover - a[1].leftover)[0];
    const wastePct = totalPrepared > 0 ? (totalLeftoverUnits / totalPrepared) * 100 : 0;
    return { totalLeftoverUnits, totalLeftoverValue, totalSold, totalPrepared, perProduct, worstProduct, wastePct };
  }, [filtered, products]);

  // ---------- PATTERN ENGINE ----------
  const patterns = useMemo(() => {
    // Group by product, then by day-of-week
    type DowStats = { count: number; leftover: number; sold: number; prepared: number };
    const perProductDow: Record<string, { name: string; emoji: string; unit: string; unitCost: number; dow: DowStats[] }> = {};

    products.forEach((p) => {
      perProductDow[p.id] = {
        name: p.name,
        emoji: p.emoji || "🍽️",
        unit: (p.batchUnit as Unit) || "unit",
        unitCost: +(p.costPerUnit ?? p.costPrice ?? 0).toFixed(2),
        dow: Array.from({ length: 7 }, () => ({ count: 0, leftover: 0, sold: 0, prepared: 0 })),
      };
    });

    filtered.forEach((r) => {
      const bucket = perProductDow[r.product_id];
      if (!bucket) return;
      const d = dayOfWeekFromISO(r.log_date);
      const stat = bucket.dow[d];
      stat.count += 1;
      stat.leftover += Number(r.leftover_qty) || 0;
      stat.sold += Number(r.sold_qty) || 0;
      stat.prepared += Number(r.prepared_qty) || 0;
    });

    // Trend detection per product (last 7 days vs previous 7 days)
    const trendByProduct: Record<string, "improving" | "worsening" | "stable"> = {};
    products.forEach((p) => {
      const last7Cut = new Date(); last7Cut.setDate(last7Cut.getDate() - 6);
      const prev7Cut = new Date(); prev7Cut.setDate(prev7Cut.getDate() - 13);
      const last7 = rows.filter((r) => r.product_id === p.id && r.log_date >= toISODate(last7Cut));
      const prev7 = rows.filter((r) => r.product_id === p.id && r.log_date >= toISODate(prev7Cut) && r.log_date < toISODate(last7Cut));
      if (!last7.length || !prev7.length) { trendByProduct[p.id] = "stable"; return; }
      const avgL = last7.reduce((s, r) => s + Number(r.leftover_qty), 0) / last7.length;
      const avgP = prev7.reduce((s, r) => s + Number(r.leftover_qty), 0) / prev7.length;
      if (avgL > avgP * 1.15) trendByProduct[p.id] = "worsening";
      else if (avgL < avgP * 0.85) trendByProduct[p.id] = "improving";
      else trendByProduct[p.id] = "stable";
    });

    // Optimal qty per day-of-week per product (avg sold * 1.10)
    const optimalByProduct: Record<string, number[]> = {};
    Object.entries(perProductDow).forEach(([pid, b]) => {
      optimalByProduct[pid] = b.dow.map((s) => (s.count > 0 ? Math.round((s.sold / s.count) * 1.10) : 0));
    });

    return { perProductDow, trendByProduct, optimalByProduct };
  }, [filtered, rows, products]);

  // ---------- INSIGHT CARDS ----------
  const insightCards = useMemo(() => {
    const cards: { kind: "warning" | "trend" | "good"; title: string; reason: string; suggestion: string; emoji: string }[] = [];
    Object.entries(patterns.perProductDow).forEach(([pid, b]) => {
      // Highest waste day-of-week
      const sorted = b.dow
        .map((s, i) => ({ dow: i, avg: s.count > 0 ? s.leftover / s.count : 0, count: s.count }))
        .filter((x) => x.count >= 2)
        .sort((a, b) => b.avg - a.avg);
      if (sorted.length >= 2 && sorted[0].avg >= 3) {
        const top = sorted[0];
        const dayName = DAY_NAMES_MS[top.dow];
        cards.push({
          kind: "warning",
          emoji: "📅",
          title: `Hari ${dayName}, ${b.name} selalu lebih`,
          reason: "Hari tu permintaan biasa kurang berbanding hari lain.",
          suggestion: `Kurangkan ${Math.round(top.avg)} ${b.unit} pada ${dayName}.`,
        });
      }
      // Trend
      const trend = patterns.trendByProduct[pid];
      if (trend === "worsening") {
        cards.push({
          kind: "trend",
          emoji: "📈",
          title: `Sisa ${b.name} makin meningkat`,
          reason: "Mungkin harga dah tak kompetitif atau produk lain lebih popular.",
          suggestion: "Review harga atau buat promosi pada waktu akhir operasi.",
        });
      }
      // Positive: weekend near zero
      const weekendStats = [b.dow[6], b.dow[0]]; // Sat, Sun
      const weekendTotal = weekendStats.reduce((s, x) => s + x.leftover, 0);
      const weekendCount = weekendStats.reduce((s, x) => s + x.count, 0);
      if (weekendCount >= 3 && weekendTotal / weekendCount < 1.5) {
        const sat = patterns.optimalByProduct[pid]?.[6] ?? 0;
        const avgPrep = b.dow[6].count > 0 ? b.dow[6].prepared / b.dow[6].count : 0;
        const extra = Math.max(0, sat - Math.round(avgPrep));
        cards.push({
          kind: "good",
          emoji: "✅",
          title: `${b.name} hampir habis hujung minggu`,
          reason: "Permintaan hujung minggu tinggi.",
          suggestion: extra > 0 ? `Boleh tambah ${extra} ${b.unit} pada Sabtu untuk jualan lebih.` : "Teruskan kuantiti macam sekarang — sweet spot.",
        });
      }
    });
    return cards.slice(0, 6);
  }, [patterns]);

  // ---------- POTENTIAL SAVING ----------
  const potentialSaving = useMemo(() => {
    let saving = 0;
    Object.entries(patterns.perProductDow).forEach(([pid, b]) => {
      const optimal = patterns.optimalByProduct[pid] || [];
      b.dow.forEach((s, dow) => {
        if (s.count === 0) return;
        const avgPrep = s.prepared / s.count;
        const opt = optimal[dow];
        const reduce = Math.max(0, avgPrep - opt);
        saving += reduce * b.unitCost * s.count; // for the period
      });
    });
    return saving;
  }, [patterns]);

  // ---------- WEEKLY PREP RECOMMENDATIONS ----------
  const weeklyPrep = useMemo(() => {
    return Object.entries(patterns.perProductDow).map(([pid, b]) => {
      const optimal = patterns.optimalByProduct[pid] || [];
      const overallAvg = b.dow.reduce((s, x) => s + x.sold, 0) / Math.max(1, b.dow.reduce((s, x) => s + x.count, 0));
      const week = optimal.map((qty, dow) => {
        const stat = b.dow[dow];
        const avg = stat.count > 0 ? stat.sold / stat.count : overallAvg;
        const diffPct = overallAvg > 0 ? ((avg - overallAvg) / overallAvg) * 100 : 0;
        let note = "";
        if (stat.count === 0) note = "kurang data";
        else if (diffPct < -10) note = `hari paling slow (-${Math.round(Math.abs(diffPct))}%)`;
        else if (diffPct > 15) note = `permintaan naik (+${Math.round(diffPct)}%)`;
        else note = "stabil";
        return { dow, day: DAY_NAMES_MS[dow], qty, note };
      });
      return { productId: pid, name: b.name, emoji: b.emoji, unit: b.unit, week, hasData: b.dow.some((x) => x.count > 0) };
    });
  }, [patterns]);

  const sendOneToBuy = (productId: string) => {
    const w = weeklyPrep.find((x) => x.productId === productId);
    if (!w) return;
    const totalWeek = w.week.reduce((s, d) => s + d.qty, 0);
    if (totalWeek === 0) {
      toast.error("Belum cukup data untuk produk ini.");
      return;
    }
    onSendToBuy([{ emoji: w.emoji, name: `${w.name} (rancangan minggu depan)`, recQty: totalWeek, unit: w.unit as Unit, note: `Cadangan AI dari corak ${rangeLabel}` }]);
    toast.success(`Cadangan ${w.name} dihantar ke Nak Beli ✅`);
  };

  const sendAllToBuy = () => {
    const items = weeklyPrep
      .filter((w) => w.hasData)
      .map((w) => ({ emoji: w.emoji, name: `${w.name} (rancangan minggu depan)`, recQty: w.week.reduce((s, d) => s + d.qty, 0), unit: w.unit as Unit, note: `Cadangan AI dari corak ${rangeLabel}` }))
      .filter((x) => x.recQty > 0);
    if (!items.length) { toast.error("Belum cukup data."); return; }
    onSendToBuy(items);
    toast.success(`${items.length} produk dihantar ke Nak Beli ✅`);
  };

  // ---------- INGREDIENT WASTE LINKAGE ----------
  const ingredientWasteToday = useMemo(() => {
    const todayRows = rows.filter((r) => r.log_date === todayStr);
    const map: Record<string, { qty: number; unit: Unit; cost: number }> = {};
    todayRows.forEach((r) => {
      if (r.leftover_qty <= 0) return;
      const product = products.find((p) => p.id === r.product_id);
      if (!product || !product.ingredients) return;
      const batchSize = product.batchSize || 1;
      const perUnitFactor = batchSize > 0 ? 1 / batchSize : 1;
      product.ingredients.forEach((ing) => {
        const wastedQty = Number(r.leftover_qty) * ing.quantity * perUnitFactor;
        const stockMatch = stock.find((s) => s.name.trim().toLowerCase() === ing.name.trim().toLowerCase());
        const unit = stockMatch?.unit ?? ing.unit;
        const cost = (ing.predictedCost ?? 0) * perUnitFactor * Number(r.leftover_qty);
        if (!map[ing.name]) map[ing.name] = { qty: 0, unit, cost: 0 };
        map[ing.name].qty += wastedQty;
        map[ing.name].cost += cost;
      });
    });
    const list = Object.entries(map).map(([name, v]) => ({ name, qty: +v.qty.toFixed(2), unit: v.unit, cost: +v.cost.toFixed(2) }));
    const total = list.reduce((s, x) => s + x.cost, 0);
    return { list, total };
  }, [rows, products, stock, todayStr]);

  // ---------- REPORT (WhatsApp) ----------
  const generateReport = async () => {
    const lines: string[] = [];
    lines.push("📊 *Laporan Sisa — WarkahBiz*");
    lines.push(`📅 ${rangeLabel}`);
    lines.push(`🏪 ${boss}`);
    lines.push("");
    lines.push("♻️ *Ringkasan Sisa:*");
    lines.push(`Jumlah sisa: ${summary.totalLeftoverUnits} unit`);
    lines.push(`Kerugian: ${fmt(summary.totalLeftoverValue)}`);
    lines.push(`Pembaziran: ${summary.wastePct.toFixed(1)}% daripada disediakan`);
    lines.push("");
    const top3 = Object.values(summary.perProduct).sort((a, b) => b.leftover - a.leftover).slice(0, 3);
    if (top3.length) {
      lines.push("📉 *Produk Paling Banyak Sisa:*");
      top3.forEach((p) => {
        const avg = p.days > 0 ? p.leftover / p.days : 0;
        lines.push(`- ${p.name}: ${avg.toFixed(1)} ${p.unit}/hari purata`);
      });
      lines.push("");
    }
    if (insightCards.length) {
      lines.push("🧠 *Corak AI Kesan:*");
      insightCards.slice(0, 3).forEach((c) => lines.push(`- ${c.title}`));
      lines.push("");
    }
    lines.push("💡 *Jika ikut cadangan AI minggu depan:*");
    lines.push(`Potensi penjimatan: ${fmt(potentialSaving)}/${rangeKey === "month" ? "bulan" : "tempoh"}`);
    lines.push("");
    lines.push("_Dijana oleh WarkahBiz_ 🚀");
    const text = lines.join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ text, title: "Laporan Sisa WarkahBiz" });
        return;
      }
    } catch { /* user cancelled */ }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  // ---------- TABLE ROWS ----------
  const tableRows = useMemo(() => {
    const byDate: Record<string, SisaRow[]> = {};
    filtered.forEach((r) => {
      if (!byDate[r.log_date]) byDate[r.log_date] = [];
      byDate[r.log_date].push(r);
    });
    return Object.entries(byDate)
      .map(([date, items]) => {
        const totalPrepared = items.reduce((s, r) => s + Number(r.prepared_qty), 0);
        const totalLeftover = items.reduce((s, r) => s + Number(r.leftover_qty), 0);
        const totalLoss = items.reduce((s, r) => s + Number(r.leftover_value), 0);
        const pct = totalPrepared > 0 ? (totalLeftover / totalPrepared) * 100 : 0;
        let status: "high" | "med" | "low" = "low";
        if (pct > 30) status = "high";
        else if (pct >= 15) status = "med";
        return { date, dow: DAY_NAMES_MS[dayOfWeekFromISO(date)], items, totalLeftover, totalLoss, pct, status };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [filtered]);

  const distinctDays = useMemo(() => new Set(rows.map((r) => r.log_date)).size, [rows]);

  // ---------- RENDER ----------
  if (loading) {
    return (
      <div className="fixed inset-0 z-40 bg-background grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-background overflow-y-auto animate-fade-in">
      <div className="mx-auto w-full max-w-full sm:max-w-[600px] md:max-w-[760px] lg:max-w-[960px] xl:max-w-[1140px] 2xl:max-w-[1280px] min-h-screen bg-background pb-32">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted tap" aria-label="Tutup">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold leading-tight truncate">Laporan Sisa &amp; Corak Jualan</h1>
            <p className="text-xs text-muted-foreground truncate">AI kesan corak sisa &amp; jualan untuk {boss}</p>
          </div>
          <Button onClick={generateReport} size="sm" variant="outline" className="rounded-full font-bold">
            <Share2 className="w-4 h-4 mr-1" /> Laporan
          </Button>
        </header>

        <div className="px-4 py-4 space-y-5">
          {/* ============ EMPTY STATE ============ */}
          {distinctDays < 3 && (
            <section className="rounded-2xl p-5 bg-primary/8 border border-primary/20">
              <p className="text-2xl">🎉</p>
              <p className="font-extrabold mt-2">{boss} baru mula rekod sisa — bagus!</p>
              <p className="text-sm text-muted-foreground mt-1">AI perlukan sekurang-kurangnya 7 hari data untuk kesan corak dengan tepat.</p>
              <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, (distinctDays / 7) * 100)}%` }} />
              </div>
              <p className="text-xs font-bold mt-2 text-primary">{distinctDays} / 7 hari rekod ✅</p>
              <p className="text-xs text-muted-foreground mt-2">Teruskan rekod setiap hari supaya AI boleh bantu {boss} jimat lebih!</p>
            </section>
          )}

          {/* ============ DAILY ENTRY FORM ============ */}
          <section className="rounded-2xl bg-card border border-border p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-base">Rekod Sisa Hari Ini</h2>
                <p className="text-xs text-muted-foreground">Isi berapa tidak terjual — AI auto-kira kerugian</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-muted">{todayStr}</span>
            </div>

            {!products.length ? (
              <div className="rounded-xl bg-muted/40 p-4 text-sm text-center text-muted-foreground">
                {boss} belum tambah produk. Pergi ke Profil → Produk untuk daftar dulu.
              </div>
            ) : (
              <div className="space-y-2">
                {drafts.map((d) => {
                  const prepared = getDraftValue(d, "prepared");
                  const unsold = getDraftValue(d, "unsold");
                  const leftover = Math.max(0, Math.min(unsold, prepared));
                  const loss = leftover * d.unitCost;
                  const overStock = d.availableStock != null && prepared > d.availableStock;
                  const overPrepared = unsold > prepared;
                  return (
                    <div key={d.productId} className="rounded-xl border border-border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{d.emoji}</span>
                        <p className="font-extrabold flex-1 truncate">{d.name}</p>
                        {d.aiSuggested != null && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">AI: {d.aiSuggested}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Disediakan</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={prepared}
                            max={d.availableStock ?? undefined}
                            onChange={(e) => setDraft(d.productId, "prepared", Number(e.target.value) || 0)}
                            className={`mt-1 w-full h-10 rounded-lg border bg-background px-3 font-extrabold text-center ${overStock ? "border-cost" : "border-border"}`}
                          />
                          {d.availableStock != null && (
                            <span className="block mt-1 text-[10px] text-muted-foreground">
                              Stok semasa: {d.availableStock} hidangan
                            </span>
                          )}
                          {overStock && (
                            <span className="block mt-1 text-[10px] font-bold text-cost">
                              Stok semasa hanya {d.availableStock} hidangan
                            </span>
                          )}
                        </label>
                        <label className="block">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tidak Terjual</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={unsold}
                            placeholder="cth: 3 tidak terjual"
                            onChange={(e) => setDraft(d.productId, "unsold", Number(e.target.value) || 0)}
                            className={`mt-1 w-full h-10 rounded-lg border bg-background px-3 font-extrabold text-center ${overPrepared ? "border-cost" : "border-border"}`}
                          />
                          {overPrepared && (
                            <span className="block mt-1 text-[10px] font-bold text-cost">
                              Tidak boleh lebih daripada disediakan
                            </span>
                          )}
                        </label>
                      </div>
                      <p className={`text-xs font-bold ${leftover > 0 ? "text-cost" : "text-primary"}`}>
                        {leftover} {d.unit} tidak terjual hari ini = {fmt(loss)} kerugian
                      </p>
                    </div>
                  );
                })}
                <Button onClick={saveTodayBatch} disabled={saving || hasInvalidDraft} className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Simpan Rekod Hari Ini
                </Button>
              </div>
            )}

            {/* Ingredient waste collapsible */}
            {ingredientWasteToday.list.length > 0 && (
              <div className="rounded-xl bg-muted/40 border border-border">
                <button onClick={() => setShowIngredients((v) => !v)} className="w-full flex items-center gap-2 p-3 text-left">
                  {showIngredients ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="font-bold text-sm flex-1">Bahan yang terbuang hari ini</span>
                  <span className="text-xs font-bold text-cost">{fmt(ingredientWasteToday.total)}</span>
                </button>
                {showIngredients && (
                  <ul className="px-3 pb-3 space-y-1 text-sm">
                    {ingredientWasteToday.list.map((it) => (
                      <li key={it.name} className="flex justify-between">
                        <span>{it.name}: {it.qty} {it.unit}</span>
                        <span className="text-muted-foreground">{fmt(it.cost)}</span>
                      </li>
                    ))}
                    <li className="pt-1 border-t border-border flex justify-between font-bold">
                      <span>Total bahan terbuang</span>
                      <span>{fmt(ingredientWasteToday.total)}</span>
                    </li>
                    <li className="text-[11px] text-muted-foreground pt-1">
                      Insight kos sahaja — bahan dah dipotong dari stok semasa masak.
                    </li>
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* ============ DATE FILTER ============ */}
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Tempoh Laporan</h2>
            <div className="flex flex-wrap gap-2">
              {([
                ["7", "7 Hari"],
                ["14", "14 Hari"],
                ["30", "30 Hari"],
                ["month", "Bulan Ini"],
                ["custom", "Pilih Tarikh"],
              ] as [RangeKey, string][]).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setRangeKey(k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${rangeKey === k ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:bg-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {rangeKey === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dari</span>
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="mt-1 w-full h-10 rounded-lg border border-border bg-background px-3" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hingga</span>
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="mt-1 w-full h-10 rounded-lg border border-border bg-background px-3" />
                </label>
              </div>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {rangeLabel}</p>
          </section>

          {/* ============ SUMMARY CARDS ============ */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SummaryCard tone="red" label="Jumlah Sisa" big={`${summary.totalLeftoverUnits} unit`} sub={fmt(summary.totalLeftoverValue)} icon={<Trash2 className="w-4 h-4" />} />
            <SummaryCard
              tone="amber"
              label="Produk Paling Banyak Sisa"
              big={summary.worstProduct ? summary.worstProduct[1].name : "—"}
              sub={summary.worstProduct ? `Purata ${(summary.worstProduct[1].leftover / Math.max(1, summary.worstProduct[1].days)).toFixed(1)} ${summary.worstProduct[1].unit}/hari` : "Belum ada data"}
              icon={<TrendingUp className="w-4 h-4" />}
            />
            <SummaryCard
              tone="green"
              label="Penjimatan Boleh Dibuat"
              big={fmt(potentialSaving)}
              sub="Jika ikut cadangan AI"
              icon={<TrendingDown className="w-4 h-4" />}
            />
          </section>

          {/* ============ PATTERN TABLE ============ */}
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Catatan Mengikut Tarikh</h2>
            {tableRows.length === 0 ? (
              <div className="rounded-xl bg-muted/40 p-4 text-sm text-center text-muted-foreground">
                Belum ada rekod dalam tempoh ini.
              </div>
            ) : (
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="grid grid-cols-12 text-[10px] font-bold uppercase tracking-wider bg-muted/50 px-3 py-2">
                  <span className="col-span-3">Tarikh</span>
                  <span className="col-span-2">Hari</span>
                  <span className="col-span-3 text-right">Sisa</span>
                  <span className="col-span-2 text-right">Kerugian</span>
                  <span className="col-span-2 text-right">Status</span>
                </div>
                {tableRows.map((r) => {
                  const bg = r.status === "high" ? "bg-cost/10" : r.status === "med" ? "bg-amber-500/10" : "bg-primary/8";
                  const dot = r.status === "high" ? "bg-cost" : r.status === "med" ? "bg-amber-500" : "bg-primary";
                  const lbl = r.status === "high" ? "TINGGI" : r.status === "med" ? "SEDERHANA" : "TERKAWAL";
                  return (
                    <div key={r.date} className={`grid grid-cols-12 px-3 py-2 text-xs border-t border-border ${bg}`}>
                      <span className="col-span-3 font-bold">{r.date.slice(5)}</span>
                      <span className="col-span-2">{r.dow}</span>
                      <span className="col-span-3 text-right font-bold">{r.totalLeftover} unit</span>
                      <span className="col-span-2 text-right">{fmt(r.totalLoss)}</span>
                      <span className="col-span-2 text-right flex items-center justify-end gap-1">
                        <span className={`w-2 h-2 rounded-full ${dot}`} />
                        <span className="font-bold">{lbl}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ============ INSIGHT CARDS ============ */}
          {insightCards.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Corak yang AI Kesan</h2>
              <div className="grid grid-cols-1 gap-2">
                {insightCards.map((c, i) => (
                  <div
                    key={i}
                    className={`rounded-2xl border p-4 space-y-1 ${
                      c.kind === "good" ? "bg-primary/8 border-primary/30" :
                      c.kind === "warning" ? "bg-cost-soft border-cost/30" :
                      "bg-amber-500/10 border-amber-500/30"
                    }`}
                  >
                    <p className="font-extrabold text-sm flex items-center gap-1">
                      <span>{c.emoji}</span> {c.title}
                    </p>
                    <p className="text-xs"><span className="font-bold">SEBAB:</span> {c.reason}</p>
                    <p className="text-xs"><span className="font-bold">CADANGAN:</span> {c.suggestion}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ============ WEEKLY PREP RECOMMENDATIONS ============ */}
          {weeklyPrep.some((w) => w.hasData) && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Cadangan Penyediaan Minggu Depan</h2>
              {weeklyPrep.filter((w) => w.hasData).map((w) => (
                <div key={w.productId} className="rounded-2xl border border-border bg-card p-4 space-y-2 shadow-card">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{w.emoji}</span>
                    <p className="font-extrabold flex-1">{w.name}</p>
                    <Button onClick={() => sendOneToBuy(w.productId)} size="sm" variant="outline" className="rounded-full text-xs font-bold">
                      <ShoppingCart className="w-3 h-3 mr-1" /> Hantar
                    </Button>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {w.week.map((d) => (
                      <div key={d.dow} className="rounded-lg bg-muted/40 p-2 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{DAY_NAMES_SHORT[d.dow]}</p>
                        <p className="text-lg font-extrabold leading-tight">{d.qty}</p>
                        <p className="text-[9px] text-muted-foreground leading-tight">{d.note}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl bg-primary/8 border border-primary/20 p-2 text-[11px] space-y-0.5">
                    <p className="font-bold text-primary flex items-center gap-1"><Sparkles className="w-3 h-3" /> SEBAB CADANGAN INI:</p>
                    <p>• Berdasarkan corak {rangeLabel}</p>
                    <p>• Hari paling slow dikurangkan</p>
                    <p>• Hari peak ditambah ikut purata jualan</p>
                    <p>• Buffer 10% ditambah untuk safety</p>
                  </div>
                </div>
              ))}
              <Button onClick={sendAllToBuy} className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold">
                <ShoppingCart className="w-4 h-4 mr-2" /> Hantar Semua ke Nak Beli
              </Button>
            </section>
          )}

          <Button onClick={generateReport} variant="outline" className="w-full h-12 rounded-2xl font-bold">
            <FileText className="w-4 h-4 mr-2" /> Janakan Laporan WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}

const SummaryCard = ({ tone, label, big, sub, icon }: { tone: "red" | "amber" | "green"; label: string; big: string; sub: string; icon: React.ReactNode }) => {
  const cls = tone === "red"
    ? "bg-cost-soft border-cost/30 text-cost"
    : tone === "amber"
    ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
    : "bg-primary/8 border-primary/30 text-primary";
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 flex items-center gap-1">{icon} {label}</p>
      <p className="text-xl font-extrabold mt-1 truncate text-foreground">{big}</p>
      <p className="text-xs mt-0.5 text-muted-foreground">{sub}</p>
    </div>
  );
};
