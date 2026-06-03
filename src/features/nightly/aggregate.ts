import type { Txn, OpExEntry, StockItem } from "@/types";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dateOnlyISO(d: Date) {
  const x = startOfDay(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayRange(offsetDays: number) {
  const start = startOfDay(new Date());
  start.setDate(start.getDate() - offsetDays);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime(), iso: dateOnlyISO(start) };
}

function weekRange() {
  // Monday as start of week
  const today = startOfDay(new Date());
  const day = today.getDay(); // 0 sun .. 6 sat
  const offset = day === 0 ? 6 : day - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - offset);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return { start: monday.getTime(), end: nextMonday.getTime(), dayIndex: offset };
}

export interface DailyAggregate {
  reportDate: string;
  // today
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
  transactionCount: number;
  peakHour: number | null;
  slowHour: number | null;
  // yesterday
  yesterdaySales: number;
  yesterdayExpenses: number;
  yesterdayProfit: number;
  // changes
  salesChangePct: number | null;
  expenseChangePct: number | null;
  profitChangePct: number | null;
  // week
  weeklyRevenue: number;
  weeklyExpenses: number;
  weeklyProfit: number;
  weeklyDayIndex: number;
  // stock
  criticalItems: Array<{ name: string; qty: number; unit: string }>;
  lowItems: Array<{ name: string; qty: number; unit: string }>;
}

function expensesInRange(_txns: Txn[], opex: OpExEntry[], start: number, end: number) {
  // Opex is the single source of truth for categorised business expenses.
  // txns.type === "out" is intentionally excluded to prevent double-counting
  // (purchase flows often write both a txn and an opex entry).
  return opex
    .filter((e) => e.ts >= start && e.ts < end)
    .reduce((s, e) => s + e.amount, 0);
}

function salesInRange(txns: Txn[], start: number, end: number) {
  return txns
    .filter((t) => t.type === "in" && t.ts >= start && t.ts < end)
    .reduce((s, t) => s + t.amount, 0);
}

export function aggregateDailyReport(
  txns: Txn[],
  opex: OpExEntry[],
  stock: StockItem[],
): DailyAggregate {
  const today = dayRange(0);
  const yesterday = dayRange(1);
  const week = weekRange();

  const totalSales = salesInRange(txns, today.start, today.end);
  const totalExpenses = expensesInRange(txns, opex, today.start, today.end);
  const netProfit = totalSales - totalExpenses;

  const todayInTxns = txns.filter((t) => t.ts >= today.start && t.ts < today.end);
  const transactionCount = todayInTxns.length;

  // Hourly buckets for sales only
  const hourly: Record<number, number> = {};
  todayInTxns
    .filter((t) => t.type === "in")
    .forEach((t) => {
      const h = new Date(t.ts).getHours();
      hourly[h] = (hourly[h] ?? 0) + t.amount;
    });
  const hourEntries = Object.entries(hourly);
  let peakHour: number | null = null;
  let slowHour: number | null = null;
  if (hourEntries.length) {
    hourEntries.sort((a, b) => b[1] - a[1]);
    peakHour = Number(hourEntries[0][0]);
    slowHour = Number(hourEntries[hourEntries.length - 1][0]);
  }

  const yesterdaySales = salesInRange(txns, yesterday.start, yesterday.end);
  const yesterdayExpenses = expensesInRange(txns, opex, yesterday.start, yesterday.end);
  const yesterdayProfit = yesterdaySales - yesterdayExpenses;

  const pct = (a: number, b: number) => (b === 0 ? null : ((a - b) / Math.abs(b)) * 100);

  const weeklyRevenue = salesInRange(txns, week.start, week.end);
  const weeklyExpenses = expensesInRange(txns, opex, week.start, week.end);
  const weeklyProfit = weeklyRevenue - weeklyExpenses;

  const criticalItems = stock
    .filter((s) => s.minQty > 0 && s.qty <= s.minQty)
    .map((s) => ({ name: s.name, qty: s.qty, unit: s.unit }));
  const lowItems = stock
    .filter((s) => {
      const threshold = s.restockQty > 0 ? s.restockQty : s.minQty * 2;
      return threshold > 0 && s.qty > s.minQty && s.qty <= threshold;
    })
    .map((s) => ({ name: s.name, qty: s.qty, unit: s.unit }));

  return {
    reportDate: today.iso,
    totalSales,
    totalExpenses,
    netProfit,
    transactionCount,
    peakHour,
    slowHour,
    yesterdaySales,
    yesterdayExpenses,
    yesterdayProfit,
    salesChangePct: pct(totalSales, yesterdaySales),
    expenseChangePct: pct(totalExpenses, yesterdayExpenses),
    profitChangePct: pct(netProfit, yesterdayProfit),
    weeklyRevenue,
    weeklyExpenses,
    weeklyProfit,
    weeklyDayIndex: week.dayIndex,
    criticalItems,
    lowItems,
  };
}

export const dayNameMs = (date: Date) =>
  ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"][date.getDay()];

export const monthNameMs = (date: Date) =>
  ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogs", "Sep", "Okt", "Nov", "Dis"][date.getMonth()];

export const formatDateLong = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${dayNameMs(d)}, ${d.getDate()} ${monthNameMs(d)} ${d.getFullYear()}`;
};
