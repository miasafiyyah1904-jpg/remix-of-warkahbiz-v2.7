import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Save, Target, TrendingUp, Lightbulb, CheckCircle2, Loader2, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { fmt } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { DashboardImpian } from "./DashboardImpian";
import { createImpian, type SelectedPlan } from "./impianApi";
import { useTranslation } from "@/context/LanguageContext";

type GoalType = "machine" | "sales" | "branch";

const GOAL_TYPES: { id: GoalType; emoji: string; titleKey: string; descKey: string }[] = [
  { id: "machine", emoji: "🏭", titleKey: "goalTypeMachineTitle", descKey: "goalTypeMachineDesc" },
  { id: "sales",   emoji: "📈", titleKey: "goalTypeSalesTitle",   descKey: "goalTypeSalesDesc" },
  { id: "branch",  emoji: "🏠", titleKey: "goalTypeBranchTitle",  descKey: "goalTypeBranchDesc" },
];

const addressBoss = (n: string) => (n?.trim() ? n.trim() : "Boss");
const numVal = (n: number) => (n === 0 ? "" : String(n));

// ---------- AI response shapes ----------
type BenefitsResp = { summary: string; benefits: string[] };
type Plan = { monthly: number; months: number; label: string };
type PlansResp = { plans: Plan[] };
type SalesBreakdownResp = {
  weekdayTarget: number; weekendTarget: number; dailyAverage: number; insight: string;
};
type LocationsResp = { locations: { name: string; reason: string }[] };
type CostItem = { name: string; cost: number; note?: string };
type CostBreakdownResp = { items: CostItem[]; total: number };

// ---------- Generic AI invoker ----------
async function invokeGoalTips<T>(payload: Record<string, unknown>): Promise<T | null> {
  try {
    const { data, error } = await supabase.functions.invoke("goal-tips", { body: payload });
    if (error) {
      console.error("goal-tips error", error);
      return null;
    }
    return data as T;
  } catch (e) {
    console.error("goal-tips exception", e);
    return null;
  }
}

// =====================================================================
// MAIN COMPONENT — shows Dashboard first; wizard launches via FAB
// =====================================================================
export function GoalsPlanner({
  onClose,
  businessName,
}: {
  onClose: () => void;
  businessName: string;
}) {
  const boss = addressBoss(businessName);
  const { t } = useTranslation();
  const [view, setView] = useState<"dashboard" | "wizard">("dashboard");
  const [dashboardKey, setDashboardKey] = useState(0); // force reload after save
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const handlePickGoalType = (newType: GoalType) => {
    if (newType !== goalType) {
      setGoalType(newType);
      setResetKey((k) => k + 1);
    }
  };

  const handleSaved = () => {
    setView("dashboard");
    setGoalType(null);
    setDashboardKey((k) => k + 1);
  };

  const handleOpenWizard = () => {
    setGoalType(null);
    setView("wizard");
  };

  if (view === "dashboard") {
    return (
      <DashboardImpian
        key={dashboardKey}
        onClose={onClose}
        onNewGoal={handleOpenWizard}
        businessName={businessName}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-background overflow-y-auto animate-fade-in">
      <div className="mx-auto w-full max-w-full sm:max-w-[600px] md:max-w-[760px] lg:max-w-[960px] xl:max-w-[1140px] 2xl:max-w-[1280px] min-h-screen bg-background pb-32">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => setView("dashboard")} className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted tap" aria-label={t("goalsBack")}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-extrabold leading-tight">{t("goalsBuildNew")}</h1>
            <p className="text-xs text-muted-foreground">{t("goalsAiSubtitle")}</p>
          </div>
        </header>

        <div className="px-4 py-5 space-y-6">
          {/* Step 1: pick goal type */}
          <StepCard num={1} title={t("goalsPickType")}>
            <div className="grid grid-cols-1 gap-2">
              {GOAL_TYPES.map((g) => {
                const active = goalType === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => handlePickGoalType(g.id)}
                    className={`w-full text-left rounded-2xl p-4 border-2 tap flex items-center gap-3 transition-all ${
                      active ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="text-3xl">{g.emoji}</div>
                    <div className="flex-1">
                      <p className="font-extrabold">{t(g.titleKey)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t(g.descKey)}</p>
                    </div>
                    {active && <CheckCircle2 className="w-5 h-5 text-primary" />}
                  </button>
                );
              })}
            </div>
          </StepCard>


          {/* Conditional flow render (key forces remount = clean state) */}
          {goalType === "machine" && (
            <MachineFlow key={`machine-${resetKey}`} boss={boss} onSaved={handleSaved} />
          )}
          {goalType === "sales" && (
            <SalesFlow key={`sales-${resetKey}`} boss={boss} onSaved={handleSaved} />
          )}
          {goalType === "branch" && (
            <BranchFlow key={`branch-${resetKey}`} boss={boss} onSaved={handleSaved} />
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// FLOW 1: MACHINE
// =====================================================================
function MachineFlow({ boss, onSaved }: { boss: string; onSaved: () => void }) {
  const { t } = useTranslation();
  // Step 2 inputs
  const [name, setName] = useState("");
  const [cost, setCost] = useState(0);
  const step2Done = name.trim().length > 0 && cost > 0;

  // Step 3: AI benefits (auto-fetches when step 2 completes)
  const [benefits, setBenefits] = useState<BenefitsResp | null>(null);
  const [benefitsLoading, setBenefitsLoading] = useState(false);
  const benefitsReqId = useRef(0);

  useEffect(() => {
    if (!step2Done) { setBenefits(null); return; }
    const id = ++benefitsReqId.current;
    setBenefitsLoading(true);
    const t = setTimeout(async () => {
      const data = await invokeGoalTips<BenefitsResp>({
        mode: "benefits", goalName: name.trim(), cost, businessName: boss,
      });
      if (id !== benefitsReqId.current) return;
      setBenefits(data);
      setBenefitsLoading(false);
    }, 600);
    return () => clearTimeout(t);
  }, [step2Done, name, cost, boss]);

  // Step 4: current savings
  const [saved, setSaved] = useState(0);
  const [canSave, setCanSave] = useState(0);
  const step4Done = canSave > 0;
  const remaining = Math.max(cost - saved, 0);

  // Step 5: AI savings plans (selectable)
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [plansLoading, setPlansLoading] = useState(false);
  const [chosen, setChosen] = useState<Plan | null>(null);
  const plansReqId = useRef(0);

  useEffect(() => {
    if (!step4Done || remaining <= 0) { setPlans(null); setChosen(null); return; }
    const id = ++plansReqId.current;
    setPlansLoading(true);
    const t = setTimeout(async () => {
      const data = await invokeGoalTips<PlansResp>({
        mode: "plans", goalName: name.trim(), cost: remaining, canSavePerMonth: canSave,
      });
      if (id !== plansReqId.current) return;
      setPlans(data?.plans ?? null);
      setPlansLoading(false);
    }, 500);
    return () => clearTimeout(t);
  }, [step4Done, remaining, canSave, name]);

  return (
    <>
      <StepCard num={2} title={t("goalMachineDetails").replace("{boss}", boss)}>
        <FieldInput label={t("goalMachineNameLabel")} value={name} onChange={setName} placeholder={t("goalMachineNamePh")} />
        <FieldNumber label={t("goalCostNeededLabel")} value={cost} onChange={setCost} placeholder={t("goalCostNeededPh")} />
      </StepCard>

      {step2Done && (
        <StepCard num={3} title={t("goalBenefitsTitle")} icon={<Sparkles className="w-4 h-4 text-primary" />}>
          {benefitsLoading && !benefits ? (
            <SkeletonBlock />
          ) : benefits ? (
            <div className="rounded-2xl p-4 bg-primary/5 border border-primary/20 space-y-2">
              <p className="text-sm font-semibold">{benefits.summary}</p>
              <ul className="space-y-1.5 mt-2">
                {benefits.benefits.map((b, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </StepCard>
      )}

      {step2Done && benefits && (
        <StepCard num={4} title={t("goalSavingsTitle").replace("{boss}", boss)}>
          <FieldNumber label={t("goalSavedAmountLabel")} value={saved} onChange={setSaved} placeholder={t("goalSavedAmountPh")} />
          <FieldNumber label={t("goalCanSaveLabel")} value={canSave} onChange={setCanSave} placeholder={t("goalCanSavePh")} />
          {cost > 0 && (
            <div className="rounded-xl bg-card border border-border p-3 mt-2">
              <ProgressRow saved={saved} target={cost} />
              <p className="text-xs text-muted-foreground mt-1.5">{t("goalRemainingLabel")} <span className="font-bold text-foreground">{fmt(remaining)}</span></p>
            </div>
          )}
        </StepCard>
      )}

      {step4Done && remaining > 0 && (
        <StepCard num={5} title={t("goalPickPlanTitle")} icon={<Sparkles className="w-4 h-4 text-primary" />}>
          {plansLoading && !plans ? (
            <SkeletonBlock />
          ) : plans ? (
            <div className="space-y-2">
              {plans.map((p) => {
                const active = chosen?.monthly === p.monthly;
                return (
                  <button
                    key={p.monthly}
                    onClick={() => setChosen(p)}
                    className={`w-full text-left rounded-xl p-4 border-2 tap transition-all ${
                      active ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold">{t("goalPlanSaveLine").replace("{label}", p.label).replace("{amount}", fmt(p.monthly))}</p>
                      {active && <CheckCircle2 className="w-5 h-5 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("goalPlanReach")} <span className="font-bold text-foreground">{p.months} {t("goalMonthsSuffix")}</span>
                    </p>
                  </button>
                );
              })}
            </div>
          ) : null}
        </StepCard>
      )}

      {chosen && (
        <FinalCard title={t("goalRoadmap").replace("{name}", name)} boss={boss}>
          <Row label={t("goalTarget")} value={fmt(cost)} />
          <Row label={t("goalSavedSoFar")} value={fmt(saved)} />
          <Row label={t("goalRemainingNeeded")} value={fmt(remaining)} />
          <div className="border-t border-white/20 pt-3 mt-2">
            <Row label={t("goalSelectedPlan")} value={`${chosen.label} (${fmt(chosen.monthly)}/bln)`} />
            <Row label={t("goalEstDuration")} value={`${chosen.months} ${t("goalMonthsSuffix")}`} />
          </div>
          <p className="text-xs opacity-90 italic pt-2">
            {t("goalMachineEncouragement").replace("{boss}", boss).replace("{amount}", fmt(chosen.monthly))}
          </p>
        </FinalCard>
      )}


      {chosen && (
        <SaveButton
          payload={{
            goal_type: "machine",
            goal_name: name,
            target_amount: cost,
            current_saved: saved,
            selected_plan: chosen,
          }}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

// =====================================================================
// FLOW 2: SALES
// =====================================================================
function SalesFlow({ boss, onSaved }: { boss: string; onSaved: () => void }) {
  const { t: tr } = useTranslation();
  // Step 2: monthly target
  const [target, setTarget] = useState(0);
  const [currentSales, setCurrentSales] = useState(0);
  const step2Done = target > 0;

  // Step 3: AI breakdown
  const [breakdown, setBreakdown] = useState<SalesBreakdownResp | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const breakReqId = useRef(0);

  useEffect(() => {
    if (!step2Done) { setBreakdown(null); return; }
    const id = ++breakReqId.current;
    setBreakdownLoading(true);
    const timer = setTimeout(async () => {
      const data = await invokeGoalTips<SalesBreakdownResp>({
        mode: "salesBreakdown", monthlyTarget: target, businessName: boss,
      });
      if (id !== breakReqId.current) return;
      setBreakdown(data);
      setBreakdownLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [step2Done, target, boss]);

  // Step 4: AI tips
  const [tips, setTips] = useState<string[] | null>(null);
  const [tipsLoading, setTipsLoading] = useState(false);
  const tipsReqId = useRef(0);

  useEffect(() => {
    if (!breakdown) { setTips(null); return; }
    const id = ++tipsReqId.current;
    setTipsLoading(true);
    const timer = setTimeout(async () => {
      const data = await invokeGoalTips<{ tips: string[] }>({
        mode: "salesTips", monthlyTarget: target, currentSales, businessName: boss,
      });
      if (id !== tipsReqId.current) return;
      setTips(data?.tips ?? null);
      setTipsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [breakdown, target, currentSales, boss]);

  // Step 5: ROI = extra profit if hit target
  const extra = Math.max(target - currentSales, 0);

  return (
    <>
      <StepCard num={2} title={tr("goalSalesTargetTitle")}>
        <FieldNumber label={tr("goalMonthlyTargetLabel")} value={target} onChange={setTarget} placeholder={tr("goalMonthlyTargetPh")} />
        <FieldNumber label={tr("goalCurrentSalesLabel")} value={currentSales} onChange={setCurrentSales} placeholder={tr("goalCurrentSalesPh")} />
      </StepCard>

      {step2Done && (
        <StepCard num={3} title={tr("goalDailyBreakdownTitle")} icon={<Sparkles className="w-4 h-4 text-primary" />}>
          {breakdownLoading && !breakdown ? (
            <SkeletonBlock />
          ) : breakdown ? (
            <div className="rounded-2xl p-4 bg-primary/5 border border-primary/20 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Stat label={tr("goalWeekdayLabel")} value={fmt(breakdown.weekdayTarget)} />
                <Stat label={tr("goalWeekendLabel")} value={fmt(breakdown.weekendTarget)} accent />
              </div>
              <div className="text-center pt-2 border-t border-primary/20">
                <p className="text-xs text-muted-foreground">{tr("goalDailyAvg")}</p>
                <p className="text-xl font-extrabold text-primary">{fmt(breakdown.dailyAverage)}</p>
              </div>
              <p className="text-xs italic text-muted-foreground">{breakdown.insight}</p>
            </div>
          ) : null}
        </StepCard>
      )}

      {breakdown && (
        <StepCard num={4} title={tr("goalOpsStrategyTitle")} icon={<Lightbulb className="w-4 h-4 text-warn" />}>
          {tipsLoading && !tips ? (
            <SkeletonBlock />
          ) : tips ? (
            <div className="space-y-2">
              {tips.map((tip, i) => (
                <div key={i} className="rounded-2xl p-4 bg-warn-soft border border-warn/30">
                  <p className="text-sm leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          ) : null}
        </StepCard>
      )}

      {tips && (
        <FinalCard title={tr("goalReturnTitle")} boss={boss}>
          <Row label={tr("goalCurrentSales")} value={fmt(currentSales)} />
          <Row label={tr("goalNewTarget")} value={fmt(target)} />
          <Row label={tr("goalAddSalesMonth")} value={fmt(extra)} />
          <Row label={tr("goalAddSalesYear")} value={fmt(extra * 12)} />
          {extra > 0 ? (
            <p className="text-sm leading-relaxed pt-2 border-t border-white/20">
              {tr("goalSalesEncouragement")
                .replace("{boss}", boss)
                .replace("{month}", fmt(extra))
                .replace("{year}", fmt(extra * 12))}
            </p>
          ) : (
            <p className="text-xs opacity-90 italic pt-2">{tr("goalSalesEmptyHint")}</p>
          )}
        </FinalCard>
      )}

      {tips && (
        <SaveButton
          payload={{
            goal_type: "sales",
            goal_name: tr("goalSalesNameFmt").replace("{amount}", fmt(target)),
            target_amount: target,
            current_saved: currentSales,
            selected_plan: null,
          }}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

// =====================================================================
// FLOW 3: BRANCH
// =====================================================================
function BranchFlow({ boss, onSaved }: { boss: string; onSaved: () => void }) {
  const { t: tr } = useTranslation();
  // Step 2: location
  const [location, setLocation] = useState("");
  const [suggestions, setSuggestions] = useState<{ name: string; reason: string }[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const step2Done = location.trim().length > 0;

  const handleSuggest = async () => {
    setSuggestLoading(true);
    const data = await invokeGoalTips<LocationsResp>({
      mode: "locations", businessName: boss, businessType: "F&B / warung",
    });
    setSuggestions(data?.locations ?? null);
    setSuggestLoading(false);
  };

  // Step 3: AI cost breakdown
  const [costs, setCosts] = useState<CostBreakdownResp | null>(null);
  const [costsLoading, setCostsLoading] = useState(false);
  const costsReqId = useRef(0);

  useEffect(() => {
    if (!step2Done) { setCosts(null); return; }
    const id = ++costsReqId.current;
    setCostsLoading(true);
    const timer = setTimeout(async () => {
      const data = await invokeGoalTips<CostBreakdownResp>({
        mode: "costBreakdown", location: location.trim(), businessName: boss, businessType: "F&B / warung",
      });
      if (id !== costsReqId.current) return;
      setCosts(data);
      setCostsLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [step2Done, location, boss]);

  // Step 4: AI plans (based on total cost)
  const [canSave, setCanSave] = useState(0);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [plansLoading, setPlansLoading] = useState(false);
  const [chosen, setChosen] = useState<Plan | null>(null);
  const plansReqId = useRef(0);
  const totalCost = costs?.total ?? 0;
  const step4Done = totalCost > 0 && canSave > 0;

  useEffect(() => {
    if (!step4Done) { setPlans(null); setChosen(null); return; }
    const id = ++plansReqId.current;
    setPlansLoading(true);
    const timer = setTimeout(async () => {
      const data = await invokeGoalTips<PlansResp>({
        mode: "plans", goalName: `Buka cawangan di ${location}`, cost: totalCost, canSavePerMonth: canSave,
      });
      if (id !== plansReqId.current) return;
      setPlans(data?.plans ?? null);
      setPlansLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [step4Done, totalCost, canSave, location]);

  return (
    <>
      <StepCard num={2} title={tr("goalBranchLocTitle")}>
        <div>
          <Label className="text-xs">{tr("goalLocationLabel")}</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={tr("goalLocationPh")}
              className="h-12 rounded-xl flex-1"
            />
            <Button
              onClick={handleSuggest}
              disabled={suggestLoading}
              className="h-12 rounded-xl px-4 font-bold whitespace-nowrap"
              variant="outline"
            >
              {suggestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span className="ml-1">{tr("goalAiSuggest")}</span>
            </Button>
          </div>
        </div>
        {suggestions && (
          <div className="space-y-2 pt-2">
            <p className="text-xs text-muted-foreground font-semibold">{tr("goalClickToPick")}</p>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => setLocation(s.name)}
                className="w-full text-left rounded-xl p-3 bg-card border border-border hover:border-primary/40 tap"
              >
                <p className="text-sm font-bold">{s.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.reason}</p>
              </button>
            ))}
          </div>
        )}
      </StepCard>

      {step2Done && (
        <StepCard num={3} title={tr("goalCostBreakdownTitle")} icon={<Sparkles className="w-4 h-4 text-primary" />}>
          {costsLoading && !costs ? (
            <SkeletonBlock />
          ) : costs ? (
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              {costs.items.map((it, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-3 border-b border-border last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{it.name}</p>
                    {it.note && <p className="text-xs text-muted-foreground mt-0.5">{it.note}</p>}
                  </div>
                  <p className="text-sm font-bold whitespace-nowrap">{fmt(it.cost)}</p>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 bg-primary/10">
                <p className="text-sm font-extrabold">{tr("goalTotalEstimate")}</p>
                <p className="text-base font-extrabold text-primary">{fmt(costs.total)}</p>
              </div>
            </div>
          ) : null}
        </StepCard>
      )}

      {costs && (
        <StepCard num={4} title={tr("goalBranchSavingsTitle")}>
          <FieldNumber label={tr("goalCanSaveLabel")} value={canSave} onChange={setCanSave} placeholder={tr("goalBranchCanSavePh")} />
          {step4Done && (
            <>
              {plansLoading && !plans ? (
                <SkeletonBlock />
              ) : plans ? (
                <div className="space-y-2 pt-1">
                  {plans.map((p) => {
                    const active = chosen?.monthly === p.monthly;
                    return (
                      <button
                        key={p.monthly}
                        onClick={() => setChosen(p)}
                        className={`w-full text-left rounded-xl p-4 border-2 tap transition-all ${
                          active ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold">{tr("goalPlanLine").replace("{label}", p.label).replace("{amount}", fmt(p.monthly))}</p>
                          {active && <CheckCircle2 className="w-5 h-5 text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {tr("goalPlanReach")} <span className="font-bold text-foreground">{p.months} {tr("goalMonthsSuffix")}</span>
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </>
          )}
        </StepCard>
      )}

      {chosen && costs && (
        <FinalCard title={tr("goalBranchRoadmapTitle").replace("{loc}", location)} boss={boss}>
          <Row label={tr("goalTotalCapital")} value={fmt(costs.total)} />
          <Row label={tr("goalSelPlanLower")} value={`${chosen.label} (${fmt(chosen.monthly)}/bln)`} />
          <Row label={tr("goalEstDurationLower")} value={`${chosen.months} ${tr("goalMonthsSuffix")}`} />
          <p className="text-xs opacity-90 italic pt-2 border-t border-white/20 mt-2">
            {tr("goalBranchEncouragement")
              .replace("{boss}", boss)
              .replace("{loc}", location)
              .replace("{n}", String(chosen.months))}
          </p>
        </FinalCard>
      )}

      {chosen && costs && (
        <SaveButton
          payload={{
            goal_type: "branch",
            goal_name: `Cawangan ${location}`,
            target_amount: costs.total,
            current_saved: 0,
            selected_plan: chosen,
          }}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

// =====================================================================
// SHARED UI HELPERS
// =====================================================================
function StepCard({
  num, title, icon, children,
}: { num: number; title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3 animate-fade-in">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs">{num}</span>
        {title}
        {icon}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function FieldInput({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-12 rounded-xl mt-1" />
    </div>
  );
}

function FieldNumber({
  label, value, onChange, placeholder,
}: { label: string; value: number; onChange: (v: number) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number" inputMode="decimal"
        value={numVal(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={placeholder}
        className="h-12 rounded-xl mt-1"
      />
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl p-4 bg-muted/40 border border-border animate-pulse">
          <div className="h-3 bg-muted rounded w-3/4 mb-2" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center ${accent ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
      <p className={`text-[10px] uppercase tracking-wider font-semibold ${accent ? "opacity-90" : "text-muted-foreground"}`}>{label}</p>
      <p className="text-lg font-extrabold mt-0.5">{value}</p>
    </div>
  );
}

function ProgressRow({ saved, target }: { saved: number; target: number }) {
  const pct = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
  return (
    <>
      <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
        <span>{fmt(saved)}</span>
        <span className="text-muted-foreground">{fmt(target)} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-gradient-profit transition-all" style={{ width: `${pct}%` }} />
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="opacity-90">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function FinalCard({ title, boss, children }: { title: string; boss: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-5 bg-gradient-profit text-profit-foreground shadow-glow space-y-2 animate-fade-in">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-90">
        <Target className="w-4 h-4" /> Pelan AI {boss} — {title}
      </div>
      <div className="space-y-1.5 pt-1">{children}</div>
    </section>
  );
}

function SaveButton({
  payload, onSaved,
}: {
  payload: {
    goal_type: "machine" | "sales" | "branch";
    goal_name: string;
    target_amount: number;
    current_saved: number;
    selected_plan: SelectedPlan | null;
  };
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!payload.goal_name.trim() || payload.target_amount <= 0) {
      toast.error("Lengkapkan butiran impian dahulu.");
      return;
    }
    setSaving(true);
    try {
      await createImpian(payload);
      toast.success("Matlamat berjaya disimpan! 💪");
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error("Gagal simpan ke pangkalan data. Cuba lagi.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="sticky bottom-4 z-10 pt-2">
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-14 rounded-2xl text-base font-bold bg-gradient-profit text-profit-foreground shadow-fab disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
        💾 Simpan Impian Ini
      </Button>
    </div>
  );
}

// Suppress unused import warning (TrendingUp kept available for future use)
void TrendingUp;
