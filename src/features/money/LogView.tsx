import { useMemo, useState } from "react";
import { Share2, ChevronDown, ChevronRight, FileText, Trash2, X } from "lucide-react";
import type { Txn, OpExEntry, OpExCategory } from "@/types";
import { OPEX_CATEGORIES, OPEX_EMOJI } from "@/types";
import { fmt } from "@/lib/format";
import { useTranslation } from "@/context/LanguageContext";
import { OpExInputSheet } from "./OpExInputSheet";


const MONTHS_MS = ["Januari","Februari","Mac","April","Mei","Jun","Julai","Ogos","September","Oktober","November","Disember"];

const isPeribadi = (label: string, emoji: string) =>
  emoji === "🧑" || /peribadi/i.test(label);

const dateKeyOf = (createdAt?: string, ts?: number) => {
  const d = createdAt ? new Date(createdAt) : new Date(ts ?? Date.now());
  return d.toISOString().slice(0, 10);
};

const dateOf = (createdAt?: string, ts?: number) =>
  createdAt ? new Date(createdAt) : new Date(ts ?? Date.now());

const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const weekIndexInMonth = (day: number) => {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
};

const weekRangeLabel = (year: number, month0: number, weekIdx: number) => {
  const startDay = (weekIdx - 1) * 7 + 1;
  const lastDay = new Date(year, month0 + 1, 0).getDate();
  const endDay = weekIdx === 4 ? lastDay : weekIdx * 7;
  return `${startDay} ${MONTHS_MS[month0]} – ${endDay} ${MONTHS_MS[month0]} ${year}`;
};

const MiniStat = ({ label, value, tone }: { label: string; value: number; tone: "income" | "cost" | "profit" }) => {
  const styles = {
    income: "bg-gradient-income text-white",
    cost:   "bg-gradient-cost text-white",
    profit: "bg-gradient-profit text-profit-foreground",
  }[tone];
  return (
    <div className={`rounded-2xl p-3 ${styles}`}>
      <div className="text-[10px] font-bold uppercase opacity-90">{label}</div>
      <div className="text-base font-extrabold mt-1">{fmt(value)}</div>
    </div>
  );
};

type Filter = "all" | "in" | "out" | "opex" | "untung";

export const LogView = ({ txns, today, week, month, opex, todayCogs, todayOtherOpex, todayNetProfit, onExport, onExportReport, onOpenIncomeStatement, onAddOpEx, onDeleteOpex, onEditTxn }: {
  txns: Txn[];
  today: { in: number; out: number; profit: number };
  week: { in: number; out: number; profit: number };
  month: { in: number; out: number; profit: number };
  opex: OpExEntry[];
  todayCogs: number;
  todayOtherOpex: number;
  todayNetProfit: number;
  onExport: () => void;
  onExportReport: () => void;
  onOpenIncomeStatement?: () => void;
  onAddOpEx: (category: OpExCategory, amount: number, desc: string, paidFromPetty: boolean) => void;
  onDeleteOpex: (id: number) => void;
  onEditTxn?: (t: Txn) => void;
}) => {


  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? "en-MY" : "ms-MY";
  const [range, setRange] = useState<"today" | "week" | "month">("today");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [opexSheet, setOpexSheet] = useState(false);
  const [expandedPeribadi, setExpandedPeribadi] = useState<Set<string>>(new Set());
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const toggleDate = (k: string) => setCollapsedDates(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleShowAll = (k: string) => setExpandedDates(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const filteredTxns = useMemo(() => {
    if (!selectedDate) return txns;
    return txns.filter(t => dateKeyOf(t.createdAt, t.ts) === selectedDate);
  }, [txns, selectedDate]);

  const sum = range === "today" ? today : range === "week" ? week : month;



  // Group sales by date when filter === "in"
  const salesByDate = useMemo(() => {
    if (filter !== "in") return [];
    const map = new Map<string, { dateKey: string; label: string; total: number; items: Txn[] }>();
    filteredTxns.filter(t => t.type === "in").forEach(t => {
      const d = dateOf(t.createdAt, t.ts);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const cur = map.get(key) ?? { dateKey: key, label, total: 0, items: [] };
      cur.total += t.amount;
      cur.items.push(t);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filter, filteredTxns]);

  // Group all/out txns by date
  const txnsByDate = useMemo(() => {
    if (filter !== "all" && filter !== "out") return [];
    const subset = filter === "all" ? filteredTxns : filteredTxns.filter(t => t.type === "out");
    const map = new Map<string, { dateKey: string; label: string; items: Txn[]; peribadi: Txn[] }>();
    subset.forEach(t => {
      const d = dateOf(t.createdAt, t.ts);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const cur = map.get(key) ?? { dateKey: key, label, items: [], peribadi: [] };
      if (isPeribadi(t.label, t.emoji)) cur.peribadi.push(t);
      else cur.items.push(t);
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map(g => ({ ...g, items: g.items.slice().reverse(), peribadi: g.peribadi.slice().reverse() }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filter, filteredTxns]);

  const opexByCategory = OPEX_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = opex.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
    return acc;
  }, {} as Record<OpExCategory, number>);
  const opexTotal = opex.reduce((s, e) => s + e.amount, 0);
  const grossProfit = today.in - todayCogs;

  // === Untung calculations ===
  const untungWeekly = useMemo(() => {
    type Row = { key: string; year: number; month0: number; weekIdx: number; sales: number; cogs: number; isCurrent: boolean };
    const map = new Map<string, Row>();
    const cur = new Date();
    const curKey = `${cur.getFullYear()}-${cur.getMonth()}-${weekIndexInMonth(cur.getDate())}`;

    txns.forEach(t => {
      if (isPeribadi(t.label, t.emoji)) return;
      const d = dateOf(t.createdAt, t.ts);
      const wk = weekIndexInMonth(d.getDate());
      const key = `${d.getFullYear()}-${d.getMonth()}-${wk}`;
      const row = map.get(key) ?? { key, year: d.getFullYear(), month0: d.getMonth(), weekIdx: wk, sales: 0, cogs: 0, isCurrent: key === curKey };
      if (t.type === "in") row.sales += t.amount;
      else if (t.type === "out" && t.label.startsWith("Beli ")) row.cogs += t.amount;
      map.set(key, row);
    });
    opex.forEach(e => {
      if (e.category !== "Kos Bahan") return;
      const d = dateOf(e.createdAt, e.ts);
      const wk = weekIndexInMonth(d.getDate());
      const key = `${d.getFullYear()}-${d.getMonth()}-${wk}`;
      const row = map.get(key) ?? { key, year: d.getFullYear(), month0: d.getMonth(), weekIdx: wk, sales: 0, cogs: 0, isCurrent: key === curKey };
      row.cogs += e.amount;
      map.set(key, row);
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month0 !== b.month0) return b.month0 - a.month0;
      return b.weekIdx - a.weekIdx;
    });
  }, [txns, opex]);

  const untungMonthly = useMemo(() => {
    type Row = { key: string; year: number; month0: number; sales: number; cogs: number; opex: number; isCurrent: boolean };
    const map = new Map<string, Row>();
    const cur = new Date();
    const curKey = `${cur.getFullYear()}-${cur.getMonth()}`;

    const ensure = (d: Date): Row => {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const r = map.get(key) ?? { key, year: d.getFullYear(), month0: d.getMonth(), sales: 0, cogs: 0, opex: 0, isCurrent: key === curKey };
      map.set(key, r);
      return r;
    };

    txns.forEach(t => {
      if (isPeribadi(t.label, t.emoji)) return;
      const r = ensure(dateOf(t.createdAt, t.ts));
      if (t.type === "in") r.sales += t.amount;
      else if (t.type === "out" && t.label.startsWith("Beli ")) r.cogs += t.amount;
    });
    opex.forEach(e => {
      const r = ensure(dateOf(e.createdAt, e.ts));
      if (e.category === "Kos Bahan") r.cogs += e.amount;
      else r.opex += e.amount;
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month0 - a.month0;
    });
  }, [txns, opex]);

  const togglePeribadi = (key: string) => {
    setExpandedPeribadi(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };


  const filterLabels: Record<Filter, string> = {
    all:    t("allRecords"),
    in:     `💰 ${t("lv_sales")}`,
    out:    `💸 ${t("lv_filterExpense")}`,
    opex:   `💼 ${t("lv_filterOpex")}`,

    untung: `📈 ${t("lv_filterUntung")}`,
  };

  return (
    <div className="px-5 pt-6 pb-28 space-y-5">
      <header className="flex items-start justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t("recordsTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("recordsSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onExportReport} className="h-10 px-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold tap flex items-center gap-1.5">
            <FileText className="w-4 h-4" /> {t("reportBtn")}
          </button>
          <button onClick={onExport} className="h-10 px-3 rounded-full bg-surface border border-border text-sm font-semibold tap flex items-center gap-1.5">
            <Share2 className="w-4 h-4" /> {t("exportBtn")}
          </button>
        </div>
      </header>

      {onOpenIncomeStatement && (
        <button onClick={onOpenIncomeStatement} className="w-full rounded-2xl p-4 bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30 tap flex items-center gap-3 text-left">
          <div className="w-11 h-11 rounded-xl bg-primary/20 grid place-items-center text-xl">📑</div>
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-sm">{t("lv_income_statement_card")}</div>
            <div className="text-xs text-muted-foreground">{t("lv_income_statement_desc")}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      )}


      <div className="flex flex-wrap gap-1.5">
        {(["all", "in", "out", "opex", "untung"] as Filter[]).map(k => (

          <button key={k} onClick={() => setFilter(k)}
            className={`h-11 px-3 rounded-xl text-xs font-bold tap transition-all duration-150 ${filter === k ? "bg-gradient-profit text-profit-foreground shadow-card border-transparent" : "bg-surface border border-border text-muted-foreground"}`}>
            {filterLabels[k]}
          </button>
        ))}
      </div>

      {filter === "all" || filter === "in" || filter === "out" ? (
        <>
          <div className="flex p-1 rounded-2xl bg-surface border border-border gap-1">
            {(["today", "week", "month"] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`flex-1 h-11 rounded-xl text-xs font-bold tap transition-all duration-150 ${range === r ? "bg-gradient-profit text-profit-foreground shadow-card border-transparent" : "text-muted-foreground"}`}
              >
                {r === "today" ? t("logRangeToday") : r === "week" ? t("logRangeWeek") : t("logRangeMonth")}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MiniStat label={t("colIn")}     value={sum.in}     tone="income" />
            <MiniStat label={t("colOut")}    value={sum.out}    tone="cost" />
            <MiniStat label={t("colProfit")} value={sum.profit} tone="profit" />
          </div>

          {filter === "in" ? (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">{t("salesByDateHeader")}</h2>
              {salesByDate.length === 0 ? (
                <div className="rounded-2xl p-6 bg-surface border border-dashed border-border text-center text-sm text-muted-foreground">
                  {t("noSalesRecorded")}
                </div>
              ) : (
                salesByDate.map((group, gi) => {
                  const isCollapsed = gi === 0 ? collapsedDates.has(group.dateKey) : !expandedDates.has(`open-${group.dateKey}`);
                  const items = group.items.slice().reverse();
                  const showAll = expandedDates.has(group.dateKey);
                  const visible = showAll ? items : items.slice(0, 3);
                  const hidden = items.length - visible.length;
                  return (
                  <div key={group.dateKey} className="rounded-2xl bg-surface border border-border overflow-hidden">
                    <button
                      onClick={() => gi === 0 ? toggleDate(group.dateKey) : toggleShowAll(`open-${group.dateKey}`)}
                      className="w-full px-4 py-2.5 bg-surface-elevated flex items-center justify-between tap"
                    >
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        📅 {group.label}
                      </span>
                      <span className="font-extrabold text-profit">+{fmt(group.total)}</span>
                    </button>
                    {!isCollapsed && (
                      <div className="divide-y divide-border">
                        {visible.map(t => (
                          <button key={t.id} type="button" onClick={() => onEditTxn?.(t)} className="w-full text-left px-4 py-2.5 flex items-center gap-3 tap hover:bg-surface-elevated/60">
                            <span className="text-xl">{t.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">{t.label}</div>
                              <div className="text-[11px] text-muted-foreground">{t.time}</div>
                            </div>
                            <div className="font-bold text-sm text-profit">+{fmt(t.amount)}</div>
                          </button>

                        ))}
                        {hidden > 0 && (
                          <button onClick={() => toggleShowAll(group.dateKey)} className="w-full px-4 py-2.5 text-xs font-bold text-primary tap">
                            {t("viewMore").replace("{n}", String(hidden))}
                          </button>
                        )}
                        {showAll && items.length > 3 && (
                          <button onClick={() => toggleShowAll(group.dateKey)} className="w-full px-4 py-2.5 text-xs font-bold text-muted-foreground tap">
                            {t("collapse")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })
              )}
            </section>
          ) : (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">{t("txnsByDateHeader")}</h2>
              {txnsByDate.length === 0 ? (
                <div className="rounded-2xl p-6 bg-surface border border-dashed border-border text-center text-sm text-muted-foreground">
                  {t("noTxnsRecorded")}
                </div>
              ) : (
                txnsByDate.map((group, gi) => {
                  const dayTotal = group.items.reduce((s, t) => s + (t.type === "in" ? t.amount : -t.amount), 0);
                  const peribadiTotal = group.peribadi.reduce((s, t) => s + t.amount, 0);
                  const expanded = expandedPeribadi.has(group.dateKey);
                  const isCollapsed = gi === 0 ? collapsedDates.has(group.dateKey) : !expandedDates.has(`open-${group.dateKey}`);
                  const showAll = expandedDates.has(group.dateKey);
                  const visible = showAll ? group.items : group.items.slice(0, 3);
                  const hidden = group.items.length - visible.length;
                  return (
                    <div key={group.dateKey} className="rounded-2xl bg-surface border border-border overflow-hidden">
                      <button
                        onClick={() => gi === 0 ? toggleDate(group.dateKey) : toggleShowAll(`open-${group.dateKey}`)}
                        className="w-full px-4 py-2.5 bg-surface-elevated flex items-center justify-between tap"
                      >
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          📅 {group.label}
                        </span>
                        <span className={`font-extrabold ${dayTotal >= 0 ? "text-profit" : "text-cost"}`}>
                          {dayTotal >= 0 ? "+" : "−"}{fmt(Math.abs(dayTotal))}
                        </span>
                      </button>
                      {!isCollapsed && (
                      <div className="divide-y divide-border">
                        {visible.map(t => (
                          <button key={t.id} type="button" onClick={() => onEditTxn?.(t)} className="w-full text-left px-4 py-2.5 flex items-center gap-3 tap hover:bg-surface-elevated/60">
                            <span className="text-xl">{t.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">{t.label}</div>
                              <div className="text-[11px] text-muted-foreground">{t.time}</div>
                            </div>
                            <div className={`font-bold text-sm ${t.type === "in" ? "text-profit" : "text-cost"}`}>
                              {t.type === "in" ? "+" : "−"}{fmt(t.amount)}
                            </div>
                          </button>
                        ))}

                        {hidden > 0 && (
                          <button onClick={() => toggleShowAll(group.dateKey)} className="w-full px-4 py-2.5 text-xs font-bold text-primary tap">
                            {t("viewMore").replace("{n}", String(hidden))}
                          </button>
                        )}
                        {showAll && group.items.length > 3 && (
                          <button onClick={() => toggleShowAll(group.dateKey)} className="w-full px-4 py-2.5 text-xs font-bold text-muted-foreground tap">
                            {t("collapse")}
                          </button>
                        )}
                        {group.peribadi.length > 0 && (
                          <>
                            <button
                              onClick={() => togglePeribadi(group.dateKey)}
                              className="w-full px-4 py-2.5 flex items-center gap-3 tap text-left bg-surface-elevated/40"
                            >
                              {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                              <span className="text-xl">🧑</span>
                              <div className="flex-1">
                                <div className="text-sm font-semibold">{t("lv_peribadi")}</div>
                                <div className="text-[11px] text-muted-foreground">{group.peribadi.length} item · {t("lv_peribadiSubtitle")}</div>
                              </div>
                              <div className="font-bold text-sm text-cost">−{fmt(peribadiTotal)}</div>
                            </button>
                            {expanded && group.peribadi.map(t => (
                              <button key={t.id} type="button" onClick={() => onEditTxn?.(t)} className="w-full text-left px-4 py-2 pl-12 flex items-center gap-3 bg-surface-elevated/20 tap hover:bg-surface-elevated/40">
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs truncate text-muted-foreground">{t.label.replace(/^Peribadi:\s*/i, "")}</div>
                                </div>
                                <div className="font-semibold text-xs text-cost">−{fmt(t.amount)}</div>
                              </button>
                            ))}

                          </>
                        )}
                      </div>
                      )}
                    </div>
                  );
                })
              )}
            </section>
          )}
        </>
      ) : filter === "untung" ? (

        <>
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">📊 {t("lv_untungWeeklyHeader")}</h2>
            <p className="text-[11px] text-muted-foreground px-1 -mt-2">{t("lv_untungWeeklyDesc")}</p>
            {untungWeekly.length === 0 ? (
              <div className="rounded-2xl p-6 bg-surface border border-dashed border-border text-center text-sm text-muted-foreground">
                {t("lv_noDataYet")}
              </div>
            ) : untungWeekly.map(w => {
              const profit = w.sales - w.cogs;
              return (
                <div key={w.key} className="rounded-2xl p-4 bg-surface border border-border space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-extrabold">📅 {t("lv_weekLabel")} {w.weekIdx} — {weekRangeLabel(w.year, w.month0, w.weekIdx)}</div>
                    {w.isCurrent && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warn/20 text-warn">{t("lv_currentPeriod")}</span>}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">{t("lv_sales")}</span><span className="font-bold text-profit">+{fmt(w.sales)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t("lv_cogs")}</span><span className="font-bold text-cost">−{fmt(w.cogs)}</span></div>
                    <div className="border-t border-border pt-2 flex justify-between text-base">
                      <span className="font-extrabold">{t("lv_grossProfit")}</span>
                      <span className={`font-extrabold ${profit >= 0 ? "text-profit" : "text-cost"}`}>{fmt(profit)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="space-y-3 pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">💼 {t("lv_untungMonthlyHeader")}</h2>
            <p className="text-[11px] text-muted-foreground px-1 -mt-2">{t("lv_untungMonthlyDesc")}</p>
            {untungMonthly.length === 0 ? (
              <div className="rounded-2xl p-6 bg-surface border border-dashed border-border text-center text-sm text-muted-foreground">
                {t("lv_noDataYet")}
              </div>
            ) : untungMonthly.map(m => {
              const profit = m.sales - m.cogs - m.opex;
              return (
                <div key={m.key} className="rounded-2xl p-4 bg-surface border border-border space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-extrabold">📅 {MONTHS_MS[m.month0]} {m.year}</div>
                    {m.isCurrent && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warn/20 text-warn">{t("lv_currentPeriod")}</span>}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>💰 {t("lv_sales")}</span><span className="font-bold text-profit">+{fmt(m.sales)}</span></div>
                    <div className="border-t border-border pt-1.5 flex justify-between"><span className="text-muted-foreground">🛒 {t("lv_cogs")}</span><span className="font-bold text-cost">−{fmt(m.cogs)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">💼 {t("lv_rowOpex")}</span><span className="font-bold text-cost">−{fmt(m.opex)}</span></div>
                    <div className="border-t border-border pt-2 flex justify-between text-base">
                      <span className="font-extrabold">✅ {t("lv_netProfit")}</span>
                      <span className={`font-extrabold ${profit >= 0 ? "text-profit" : "text-cost"}`}>{fmt(profit)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        </>
      ) : (
        <>
          {/* OPEX */}
          <div className="rounded-3xl p-5 bg-surface border border-border space-y-4 animate-pop-in">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("lv_opexTotalLabel")}</div>
                <div className="text-3xl font-extrabold mt-1 text-cost">RM {opexTotal.toFixed(2)}</div>
              </div>
              <button
                data-tutorial="add-opex"
                onClick={() => setOpexSheet(true)}
                className="h-12 px-4 rounded-2xl bg-gradient-cost text-white font-bold shadow-card text-sm tap"
              >
                {t("lv_addOpex")}
              </button>
            </div>
            <div className="space-y-1.5 pt-3 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("lv_grossSales")}</span>
                <span className="font-bold text-profit">+RM {today.in.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("lv_cogsMaterials")}</span>
                <div className="text-right">
                  <span className="font-bold text-cost">−RM {todayCogs.toFixed(2)}</span>
                  <div className="text-[10px] text-muted-foreground">{t("lv_cogsIncludesNote")}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-border pt-1.5">
                <span className="font-semibold">{t("lv_grossProfit")}</span>
                <span className={`font-extrabold ${grossProfit >= 0 ? "text-profit" : "text-cost"}`}>RM {grossProfit.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("lv_otherOpex")}</span>
                <span className="font-bold text-cost">−RM {todayOtherOpex.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-base border-t border-border pt-2">
                <span className="font-extrabold">{t("lv_netProfit")}</span>
                <span className={`font-extrabold ${todayNetProfit >= 0 ? "text-profit" : "text-cost"}`}>RM {todayNetProfit.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">{t("lv_opexCategoryBreakdown")}</h2>
            <div className="space-y-2">
              {OPEX_CATEGORIES.map((cat) => {
                const total = opexByCategory[cat];
                const pct = opexTotal > 0 ? (total / opexTotal) * 100 : 0;
                return (
                  <div key={cat} className="rounded-2xl p-3 bg-surface border border-border flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl grid place-items-center text-xl bg-cost/15">
                      {OPEX_EMOJI[cat]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{cat}</span>
                        <span className="font-extrabold text-sm">RM {total.toFixed(2)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                        <div className="h-full bg-cost rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">{pct.toFixed(0)}% {t("lv_pctOfTotalCost")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">{t("lv_opexLog")}</h2>
            {opex.length === 0 ? (
              <div className="rounded-2xl p-6 bg-surface border border-dashed border-border text-center text-sm text-muted-foreground">
                {t("lv_opexEmpty")}
              </div>
            ) : (
              <div className="space-y-2">
                {[...opex].reverse().map((e) => (
                  <div key={e.id} className="rounded-2xl p-3 bg-surface border border-border flex items-center gap-3 animate-fade-in">
                    <div className="w-10 h-10 rounded-xl grid place-items-center text-xl bg-cost/15">
                      {OPEX_EMOJI[e.category]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{e.desc}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        <span>{e.category} • {e.time}</span>
                      </div>

                    </div>
                    <div className="font-extrabold text-sm text-cost">−RM {e.amount.toFixed(2)}</div>
                    <button
                      onClick={() => onDeleteOpex(e.id)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-cost hover:bg-cost/10 tap transition-colors"
                      aria-label={t("lv_deleteOpex")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {opexSheet && (
            <OpExInputSheet
              onClose={() => setOpexSheet(false)}
              onSave={(cat, amt, desc, fromPetty) => {
                onAddOpEx(cat, amt, desc, fromPetty);
                setOpexSheet(false);
              }}
            />
          )}
        </>
      )}
    </div>
  );
};
