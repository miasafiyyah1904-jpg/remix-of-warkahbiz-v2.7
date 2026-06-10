import type { Txn, Product, Unit } from "@/types";

export interface WeekdayStats {
  /** index 0..6 where 0 = Mon ... 6 = Sun */
  perWeekdayAvg: number[];
  /** how many distinct dates contributed per weekday */
  perWeekdaySamples: number[];
  /** overall daily average (all sales / distinct days) */
  baseline: number;
  /** distinct days with any sale */
  distinctDays: number;
  /** rough coefficient of variation of daily sales */
  noiseCV: number;
}

const dateKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const dayIndexMonFirst = (d: Date) => {
  const w = d.getDay(); // 0 Sun..6 Sat
  return w === 0 ? 6 : w - 1;
};

export function computeWeekdayStats(txns: Txn[], lookbackDays = 30): WeekdayStats {
  const cutoff = Date.now() - lookbackDays * 86400000;
  const sales = txns.filter((t) => t.type === "in" && t.ts >= cutoff);

  // Sum per (weekday, date)
  const dailyTotals = new Map<string, { weekday: number; total: number }>();
  for (const t of sales) {
    const d = new Date(t.ts);
    const key = dateKey(t.ts);
    const cur = dailyTotals.get(key);
    if (cur) cur.total += t.amount;
    else dailyTotals.set(key, { weekday: dayIndexMonFirst(d), total: t.amount });
  }

  const sums = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  const allTotals: number[] = [];
  dailyTotals.forEach(({ weekday, total }) => {
    sums[weekday] += total;
    counts[weekday] += 1;
    allTotals.push(total);
  });

  const perWeekdayAvg = sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
  const distinctDays = dailyTotals.size;
  const baseline = distinctDays > 0
    ? allTotals.reduce((a, b) => a + b, 0) / distinctDays
    : 0;

  // CV
  let noiseCV = 0.15;
  if (allTotals.length >= 3 && baseline > 0) {
    const mean = baseline;
    const variance = allTotals.reduce((s, v) => s + (v - mean) ** 2, 0) / allTotals.length;
    noiseCV = Math.min(0.5, Math.max(0.05, Math.sqrt(variance) / mean));
  }

  // Fill missing weekdays with the baseline so the curve is still meaningful
  const filled = perWeekdayAvg.map((v) => (v > 0 ? v : baseline));

  return {
    perWeekdayAvg: filled,
    perWeekdaySamples: counts,
    baseline,
    distinctDays,
    noiseCV,
  };
}

export interface StockPrep {
  emoji: string;
  name: string;
  qty: number;
  unit: Unit;
}

/** Estimate stock prep for a target sales day from products & ingredients. */
export function predictStockPrep(
  products: Product[],
  predictedRevenue: number,
  baseline: number,
): StockPrep[] {
  if (!products.length || baseline <= 0 || predictedRevenue <= 0) return [];
  const scale = predictedRevenue / baseline;
  const map = new Map<string, StockPrep>();
  for (const p of products) {
    // Primary: use avg_daily_units if available and > 0
    // Fallback: estimate from servingsPerBatch ÷ cookFreq
    //   cookFreq = days between cooks (1 = daily, 2 = every 2 days, 7 = weekly)
    //   daily output = servingsPerBatch / cookFreq
    const avgDailyUnits =
      (p as { avg_daily_units?: number }).avg_daily_units ?? 0;
    const fallbackDailyUnits = (() => {
      const servings = p.servingsPerBatch ?? p.batchSize ?? 1;
      const freq = (p as { cookFreq?: number }).cookFreq ?? 1;
      return servings / freq;
    })();
    const dailyUnits = avgDailyUnits > 0 ? avgDailyUnits : fallbackDailyUnits;
    const projectedUnits = Math.ceil(dailyUnits * scale);
    if (projectedUnits <= 0) continue;
    for (const ing of p.ingredients ?? []) {
      const need = ing.quantity * projectedUnits;
      const cur = map.get(ing.name);
      if (cur) cur.qty += need;
      else map.set(ing.name, {
        emoji: "📦",
        name: ing.name,
        qty: need,
        unit: ing.unit,
      });
    }
  }
  return Array.from(map.values())
    .map((s) => ({ ...s, qty: +s.qty.toFixed(1) }))
    .sort((a, b) => b.qty - a.qty);
}
