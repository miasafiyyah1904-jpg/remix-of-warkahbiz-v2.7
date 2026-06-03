import { useMemo, useState } from "react";
import { X, Minus, Plus, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import type { Txn, OpExEntry } from "@/types";
import { fmt } from "@/lib/format";
import { useTranslation } from "@/context/LanguageContext";

interface Props {
  onClose: () => void;
  txns: Txn[];
  opex: OpExEntry[];
}

const isPeribadi = (label: string, emoji: string) =>
  emoji === "🧑" || /peribadi/i.test(label);

const fmtAmt = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ProfitProjectionSheet = ({ onClose, txns, opex }: Props) => {
  const { t } = useTranslation();

  // Last 30 days window
  const stats = useMemo(() => {
    const now = Date.now();
    const cutoff = now - 30 * 86400000;

    const txWindow = txns.filter(x => x.ts >= cutoff && !isPeribadi(x.label, x.emoji));
    const opexWindow = opex.filter(e => e.ts >= cutoff);

    let revenue = 0;
    let directCosts = 0;
    let opExpenses = 0;

    txWindow.forEach(x => {
      const cat = x.category;
      if (x.type === "in") {
        if (cat === "Jualan" || !cat) revenue += x.amount;
      } else {
        if (cat === "Belian Bahan") directCosts += x.amount;
        else if (cat === "Aset" || cat === "Liabiliti") {
          // exclude
        } else {
          opExpenses += x.amount;
        }
      }
    });
    opexWindow.forEach(e => {
      if (e.category === "Kos Bahan") directCosts += e.amount;
      else opExpenses += e.amount;
    });

    const netProfit = revenue - directCosts - opExpenses;
    const dailyAvg = netProfit / 30;

    // Days with any activity (revenue or expense)
    const daySet = new Set<string>();
    txWindow.forEach(x => daySet.add(new Date(x.ts).toISOString().slice(0, 10)));
    opexWindow.forEach(e => daySet.add(new Date(e.ts).toISOString().slice(0, 10)));
    const daysWithData = daySet.size;

    return { revenue, directCosts, opExpenses, netProfit, dailyAvg, daysWithData };
  }, [txns, opex]);

  // Scenario sliders
  const [wastePct, setWastePct] = useState(10);
  const [pricePct, setPricePct] = useState(5);
  const [newProductPct, setNewProductPct] = useState(15);

  const annualRevenue = (stats.revenue / 30) * 365;
  const annualDirect = (stats.directCosts / 30) * 365;

  const extraWaste = annualDirect * (wastePct / 100);
  const extraPrice = annualRevenue * (pricePct / 100);
  const extraNew = annualRevenue * (newProductPct / 100);

  const projections = [
    { key: "pp_horizon_7d", label: t("pp_horizon_7d"), days: 7, value: stats.dailyAvg * 7 },
    { key: "pp_horizon_30d", label: t("pp_horizon_30d"), days: 30, value: stats.dailyAvg * 30 },
    { key: "pp_horizon_1y", label: t("pp_horizon_1y"), days: 365, value: stats.dailyAvg * 365 },
    { key: "pp_horizon_5y", label: t("pp_horizon_5y"), days: 365 * 5, value: stats.dailyAvg * 365 * 5 },
  ];

  const showEmpty = stats.daysWithData < 7;

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

        <div className="px-5 pt-2 pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-extrabold">{t("pp_title")}</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{t("pp_subtitle")}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-5">
          {showEmpty ? (
            <div className="rounded-2xl p-8 bg-surface-elevated border border-dashed border-border text-center">
              <div className="text-4xl mb-2">📊</div>
              <p className="text-sm text-muted-foreground">{t("pp_empty")}</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl p-4 bg-gradient-profit text-profit-foreground text-center">
                <div className="text-[11px] font-bold uppercase opacity-90">{t("pp_dailyAvg")}</div>
                <div className="text-2xl font-extrabold mt-1">{fmt(stats.dailyAvg)}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {projections.map(p => (
                  <div key={p.key} className="rounded-2xl p-4 bg-surface-elevated border border-border text-center">
                    <div className="text-[11px] font-bold uppercase text-muted-foreground">{p.label}</div>
                    <div className={`text-xl font-extrabold mt-1 ${p.value >= 0 ? "text-profit" : "text-cost"}`}>
                      {p.value >= 0 ? "+" : "−"}{fmt(Math.abs(p.value))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl p-3 bg-surface-elevated border border-border">
                <div className="text-[11px] font-bold uppercase text-muted-foreground px-1 pb-2">{t("pp_chart_title")}</div>
                <div className="w-full h-44">
                  <ResponsiveContainer>
                    <BarChart data={projections.map(p => ({ label: p.label, value: Math.round(p.value) }))}>
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} width={50} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(v: number) => fmt(v)}
                        contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {projections.map((p, i) => (
                          <Cell key={i} fill={p.value >= 0 ? "hsl(var(--profit))" : "hsl(var(--cost))"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">{t("pp_scenarios")}</h3>

                <ScenarioCard
                  emoji="♻️"
                  name={t("pp_scenario_waste")}
                  assumeKey="pp_scenario_waste_assume"
                  pct={wastePct}
                  onChange={setWastePct}
                  extra={extraWaste}
                  extraLabel={t("pp_scenario_extra", { amt: fmtAmt(extraWaste) })}
                />
                <ScenarioCard
                  emoji="💰"
                  name={t("pp_scenario_price")}
                  assumeKey="pp_scenario_price_assume"
                  pct={pricePct}
                  onChange={setPricePct}
                  extra={extraPrice}
                  extraLabel={t("pp_scenario_extra", { amt: fmtAmt(extraPrice) })}
                />
                <ScenarioCard
                  emoji="✨"
                  name={t("pp_scenario_new")}
                  assumeKey="pp_scenario_new_assume"
                  pct={newProductPct}
                  onChange={setNewProductPct}
                  extra={extraNew}
                  extraLabel={t("pp_scenario_extra", { amt: fmtAmt(extraNew) })}
                />
              </div>

              <p className="text-[11px] text-muted-foreground italic px-1 pt-2">{t("pp_disclaimer")}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ScenarioCard = ({ emoji, name, assumeKey, pct, onChange, extra, extraLabel }: {
  emoji: string;
  name: string;
  assumeKey: string;
  pct: number;
  onChange: (n: number) => void;
  extra: number;
  extraLabel: string;
}) => {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl p-3 bg-surface-elevated border border-border space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <div className="flex-1">
          <div className="font-bold text-sm">{name}</div>
          <div className="text-[11px] text-muted-foreground">{t(assumeKey, { pct })}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(0, pct - 1))} className="w-8 h-8 rounded-full bg-surface border border-border grid place-items-center tap">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 text-center text-sm font-extrabold">{pct}%</div>
        <button onClick={() => onChange(Math.min(100, pct + 1))} className="w-8 h-8 rounded-full bg-surface border border-border grid place-items-center tap">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className={`text-sm font-extrabold text-right ${extra > 0 ? "text-profit" : "text-muted-foreground"}`}>{extraLabel}</div>
    </div>
  );
};
