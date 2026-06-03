import type { Txn, StockItem, PettyEntry, Product } from "@/types";
import type { OpExEntry } from "@/types";
import { getUpcomingHolidays, isRamadanPeriod } from "@/lib/malaysianHolidays";

export type PromptLanguage = "ms" | "en";

export interface BusinessSnapshot {
  txns: Txn[];
  stock: StockItem[];
  opex: OpExEntry[];
  petty: PettyEntry[];
  businessName: string;
  language?: PromptLanguage;
  products?: Product[];
  wasteRatePercent?: number;
  weatherNextWeek?: string;
}

function compute30DayContext(data: BusinessSnapshot, now: Date) {
  const thirtyAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const txns30 = data.txns.filter((t) => t.ts >= thirtyAgo);
  const opex30 = data.opex.filter((e) => e.ts >= thirtyAgo);
  const sales30 = txns30.filter((t) => t.type === "in").reduce((s, t) => s + t.amount, 0);
  const out30 = txns30.filter((t) => t.type === "out").reduce((s, t) => s + t.amount, 0);
  const opexSum30 = opex30.reduce((s, e) => s + e.amount, 0);
  const profit30 = sales30 - Math.max(out30, opexSum30);
  const last30DayAvgDailyProfit = +(profit30 / 30).toFixed(2);

  // Top product: group sales-type txns by label over last 30 days
  const revMap = new Map<string, number>();
  txns30
    .filter((t) => t.type === "in")
    .forEach((t) => {
      const k = (t.label || "").trim() || "—";
      revMap.set(k, (revMap.get(k) || 0) + t.amount);
    });
  let topProduct: { name: string; revenue: number; margin: number } | null = null;
  if (revMap.size > 0) {
    const [name, revenue] = [...revMap.entries()].sort((a, b) => b[1] - a[1])[0];
    const match = data.products?.find(
      (p) => p.name.trim().toLowerCase() === name.toLowerCase(),
    );
    const margin = typeof match?.margin === "number" ? +match.margin.toFixed(1) : 0;
    topProduct = { name, revenue: +revenue.toFixed(2), margin };
  }

  return { last30DayAvgDailyProfit, topProduct };
}

export function buildSystemPrompt(data: BusinessSnapshot, language: PromptLanguage = data.language ?? "ms"): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

  const todayTxns = data.txns.filter((t) => t.ts >= todayStart);
  const weekTxns  = data.txns.filter((t) => t.ts >= weekStart);

  const todaySales    = todayTxns.filter(t => t.type === "in").reduce((s, t) => s + t.amount, 0);
  const weekSales     = weekTxns.filter(t => t.type === "in").reduce((s, t) => s + t.amount, 0);
  const weekExpenses  = weekTxns.filter(t => t.type === "out").reduce((s, t) => s + t.amount, 0);

  const todayOpex      = data.opex.filter(e => e.ts >= todayStart);
  const cogsToday      = todayOpex.filter(e => e.category === "Kos Bahan").reduce((s, e) => s + e.amount, 0);
  const utilitiToday   = todayOpex.filter(e => e.category === "Utiliti").reduce((s, e) => s + e.amount, 0);
  const bungkusToday   = todayOpex.filter(e => e.category === "Pembungkusan").reduce((s, e) => s + e.amount, 0);
  const gajiToday      = todayOpex.filter(e => e.category === "Gaji").reduce((s, e) => s + e.amount, 0);
  const transportToday = todayOpex.filter(e => e.category === "Pengangkutan").reduce((s, e) => s + e.amount, 0);
  const lainToday      = todayOpex.filter(e => e.category === "Lain-lain").reduce((s, e) => s + e.amount, 0);
  const totalOpex      = todayOpex.reduce((s, e) => s + e.amount, 0);

  const grossProfit    = todaySales - cogsToday;
  const netProfit      = grossProfit - (totalOpex - cogsToday);
  const grossMarginPct = todaySales > 0 ? ((grossProfit / todaySales) * 100).toFixed(1) : "0";
  const weekExpRatio   = weekSales > 0 ? ((weekExpenses / weekSales) * 100).toFixed(1) : "0";
  const pettyBalance   = data.petty[data.petty.length - 1]?.balance ?? 0;

  const isEn = language === "en";
  const locale = isEn ? "en-MY" : "ms-MY";

  const L = isEn
    ? {
        lowStock: " ⚠️ LOW",
        noStock: "  (no stock recorded)",
        replyInstr: "Reply in simple English.",
        suggestion: "Suggestion",
        warnExpRatio: (r: string) => `⚠️ This week's expense ratio ${r}% — too high (limit: 70%)`,
        warnLowStock: (n: string) => `⚠️ Stock running low: ${n}`,
        warnNoAfternoon: "⚠️ No sales after 2PM today",
        warnPetty: (b: string) => `⚠️ Petty Cash balance low: RM ${b}`,
        business: "Business",
        date: "Date",
        todayHeader: "=== TODAY'S DATA ===",
        grossSales: "Gross Sales:",
        cogs: "Material Cost (COGS):",
        grossProfit: "Gross Profit:",
        utilities: "Utilities:",
        packaging: "Packaging:",
        salary: "Salary:",
        transport: "Transport:",
        other: "Other:",
        totalOpex: "TOTAL OPERATING COST:",
        netProfit: "Net Profit:",
        margin: "margin",
        thisWeek: "THIS WEEK:",
        sales: "Sales",
        expenses: "Expenses",
        ratio: "Ratio",
        stock: "STOCK:",
        petty: "PETTY CASH:",
        activeWarnings: "=== ACTIVE WARNINGS ===",
        noWarnings: "=== No warnings — finances stable ===",
        rulesHeader: "=== CALCULATION RULES ===",
      }
    : {
        lowStock: " ⚠️ RENDAH",
        noStock: "  (tiada stok direkod)",
        replyInstr: "Reply in simple Malay.",
        suggestion: "Cadangan",
        warnExpRatio: (r: string) => `⚠️ Nisbah perbelanjaan minggu ini ${r}% — terlalu tinggi (had: 70%)`,
        warnLowStock: (n: string) => `⚠️ Stok hampir habis: ${n}`,
        warnNoAfternoon: "⚠️ Tiada jualan selepas 2PM hari ini",
        warnPetty: (b: string) => `⚠️ Baki Petty Cash rendah: RM ${b}`,
        business: "Perniagaan",
        date: "Tarikh",
        todayHeader: "=== DATA HARI INI ===",
        grossSales: "Jualan Kasar:",
        cogs: "Kos Bahan (COGS):",
        grossProfit: "Untung Kasar:",
        utilities: "Utiliti:",
        packaging: "Pembungkusan:",
        salary: "Gaji:",
        transport: "Pengangkutan:",
        other: "Lain-lain:",
        totalOpex: "JUMLAH KOS OPERASI:",
        netProfit: "Untung Bersih:",
        margin: "margin",
        thisWeek: "MINGGU INI:",
        sales: "Jualan",
        expenses: "Perbelanjaan",
        ratio: "Nisbah",
        stock: "STOK:",
        petty: "PETTY CASH:",
        activeWarnings: "=== AMARAN AKTIF ===",
        noWarnings: "=== Tiada amaran — kewangan stabil ===",
        rulesHeader: "=== PERATURAN KIRAAN ===",
      };

  const lowStock = data.stock.filter(s => s.qty <= s.restockQty);
  const stockLines = data.stock.length > 0
    ? data.stock.map(s => `  ${s.emoji} ${s.name}: ${s.qty}${s.unit} (min restock: ${s.restockQty}${s.unit})${s.qty <= s.restockQty ? L.lowStock : ""}`).join("\n")
    : L.noStock;

  const lastSale = todayTxns.filter(t => t.type === "in").sort((a, b) => b.ts - a.ts)[0];
  const lastSaleHour = lastSale ? new Date(lastSale.ts).getHours() : -1;

  const warnings: string[] = [];
  if (weekSales > 0 && parseFloat(weekExpRatio) > 70) warnings.push(L.warnExpRatio(weekExpRatio));
  if (lowStock.length > 0) warnings.push(L.warnLowStock(lowStock.map(s => s.name).join(", ")));
  if (todaySales > 0 && lastSaleHour >= 0 && lastSaleHour < 14 && now.getHours() >= 14) warnings.push(L.warnNoAfternoon);
  if (pettyBalance < 20 && data.petty.length > 0) warnings.push(L.warnPetty(pettyBalance.toFixed(2)));

  const rulesBody = isEn
    ? `1. DAILY P&L — when asked profit/loss/P&L:
   Gross Profit = Gross Sales − COGS
   Net Profit = Gross Profit − Total Operating Cost (excluding COGS)
   Show the full breakdown.

2. BREAK-EVEN — when asked about minimum sales/payback:
   Monthly Break-even = Fixed Cost ÷ (Margin% / 100)
   Daily Break-even = Monthly ÷ operating days
   If no data, estimate from today's data.

3. PRODUCT MARGIN — when asked profit per unit/product:
   Profit per Unit = Selling Price − Total Cost per Unit
   Margin% = (Profit ÷ Selling Price) × 100

4. CASH FLOW WARNINGS — check EVERY reply:
   If there are active warnings above, MUST mention them at the end.`
    : `1. P&L HARIAN — bila ditanya untung/rugi/P&L:
   Untung Kasar = Jualan Kasar − COGS
   Untung Bersih = Untung Kasar − Jumlah Kos Operasi (tidak termasuk COGS)
   Tunjuk pecahan lengkap.

2. BREAK-EVEN — bila ditanya modal balik/minimum jualan:
   Break-even Bulanan = Kos Tetap ÷ (Margin% / 100)
   Break-even Harian = Bulanan ÷ hari operasi
   Jika tiada data, anggar dari data hari ini.

3. MARGIN PRODUK — bila ditanya untung per unit/produk:
   Untung per Unit = Harga Jual − Jumlah Kos per Unit
   Margin% = (Untung ÷ Harga Jual) × 100

4. AMARAN CASH FLOW — semak SETIAP jawapan:
   Jika ada amaran aktif di atas, WAJIB sebut di hujung jawapan.`;

 return `You are WarkahBiz AI, a sharp financial assistant for a Malaysian micro F&B business. Rules:
- ${L.replyInstr} Max 4–6 lines per response. No long paragraphs.
- Lead with the direct answer or key number. Skip greetings and filler.
- Use **bold** only for the most important figure (1–2 per reply max).
- For calculations, show only the final breakdown — no step-by-step explanation unless asked.
- End every reply with ONE line: "💡 ${L.suggestion}: [concrete, specific]"
- If there are active warnings, mention them in one line at the end only.

${L.business}: ${data.businessName || "WarkahBiz"}
${L.date}: ${now.toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

${L.todayHeader}
${L.grossSales}      RM ${todaySales.toFixed(2)}
${L.cogs}  RM ${cogsToday.toFixed(2)}
${L.grossProfit}      RM ${grossProfit.toFixed(2)} (${L.margin}: ${grossMarginPct}%)
${L.utilities}           RM ${utilitiToday.toFixed(2)}
${L.packaging}      RM ${bungkusToday.toFixed(2)}
${L.salary}              RM ${gajiToday.toFixed(2)}
${L.transport}      RM ${transportToday.toFixed(2)}
${L.other}         RM ${lainToday.toFixed(2)}
${L.totalOpex} RM ${totalOpex.toFixed(2)}
${L.netProfit}     RM ${netProfit.toFixed(2)}

${L.thisWeek}
${L.sales}: RM ${weekSales.toFixed(2)} | ${L.expenses}: RM ${weekExpenses.toFixed(2)} | ${L.ratio}: ${weekExpRatio}%

${L.stock}
${stockLines}

${L.petty} RM ${pettyBalance.toFixed(2)}

${(() => {
  const ctx = compute30DayContext(data, now);
  const holidays = getUpcomingHolidays(now, 14);
  const ramadan = isRamadanPeriod(now);
  const lines: string[] = ["=== 30-DAY CONTEXT ==="];
  lines.push(`Avg Daily Profit (30d): RM ${ctx.last30DayAvgDailyProfit.toFixed(2)}`);
  if (ctx.topProduct) {
    lines.push(
      `Top Product (30d): ${ctx.topProduct.name} — RM ${ctx.topProduct.revenue.toFixed(2)} revenue, ${ctx.topProduct.margin}% margin`,
    );
  }
  if (typeof data.wasteRatePercent === "number") {
    lines.push(`Waste Rate: ${data.wasteRatePercent.toFixed(1)}%`);
  }
  if (holidays.length > 0) {
    lines.push(`Upcoming MY Holidays (14d): ${holidays.map((h) => `${h.date} ${h.name}`).join("; ")}`);
  }
  lines.push(`Ramadan Period: ${ramadan ? "YES (expect changed buying patterns)" : "no"}`);
  if (data.weatherNextWeek) {
    lines.push(`Weather Next Week: ${data.weatherNextWeek}`);
  }
  return lines.join("\n");
})()}

${warnings.length > 0 ? `${L.activeWarnings}\n${warnings.join("\n")}` : L.noWarnings}

${L.rulesHeader}

${rulesBody}`;
}
