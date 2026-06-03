import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, Sparkles, AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { fmt } from "@/lib/format";
import { useTranslation } from "@/context/LanguageContext";

type IngUnit = "kg" | "gram" | "liter" | "ml" | "unit" | "pek";
const UNITS: IngUnit[] = ["kg", "gram", "liter", "ml", "unit", "pek"];

interface Ingredient {
  id: string;
  name: string;
  qty: number;
  unit: IngUnit;
  cost: number;
}

const initialIngredients: Ingredient[] = [
  { id: "1", name: "Ayam", qty: 0.25, unit: "kg", cost: 2.5 },
  { id: "2", name: "Beras", qty: 0.15, unit: "kg", cost: 0.45 },
  { id: "3", name: "Santan", qty: 0.1, unit: "liter", cost: 0.8 },
  { id: "4", name: "Pembungkusan", qty: 1, unit: "unit", cost: 0.2 },
];

function niceRound(price: number) {
  const whole = Math.floor(price);
  const cents = Math.round((price - whole) * 100);
  if (cents === 0) return whole;
  if (cents <= 4) return whole;
  if (cents <= 50) return whole + 0.5;
  if (cents <= 54) return whole + 0.5;
  return whole + 1;
}

const addressBoss = (businessName: string) => businessName?.trim() ? businessName.trim() : "Boss";

export function PricingCalculator({
  onClose,
  businessName,
  onSave,
}: {
  onClose: () => void;
  businessName: string;
  onSave: (data: { name: string; cost: number; price: number; margin: number }) => void;
}) {
  const { t } = useTranslation();
  const [productName, setProductName] = useState("Nasi Lemak Ayam");
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [rentMonthly, setRentMonthly] = useState<number | "">(900);
  const [utilMonthly, setUtilMonthly] = useState<number | "">(300);
  const [unitsPerDay, setUnitsPerDay] = useState<number | "">(80);
  const [operatingDays, setOperatingDays] = useState<number | "">(26);
  const [margin, setMargin] = useState(35);
  const [currentPrice, setCurrentPrice] = useState<number | "">("");

  const boss = addressBoss(businessName);

  // Sum of bulk ingredient costs (one batch / one day's worth of raw materials)
  const totalBatchCost = useMemo(
    () => ingredients.reduce((s, i) => s + (Number(i.cost) || 0), 0),
    [ingredients],
  );

  const units = Number(unitsPerDay) || 0;

  // Raw material cost per single unit
  const ingredientPerUnit = units > 0 ? totalBatchCost / units : 0;

  const overheadPerUnit = useMemo(() => {
    const r = Number(rentMonthly) || 0;
    const u = Number(utilMonthly) || 0;
    const days = Math.min(31, Math.max(1, Number(operatingDays) || 26));
    const dailyFixed = (r + u) / days;
    return units > 0 ? dailyFixed / units : 0;
  }, [rentMonthly, utilMonthly, units, operatingDays]);

  const totalCost = ingredientPerUnit + overheadPerUnit;
  const marginAmount = totalCost * (margin / 100);
  const suggestedRaw = totalCost + marginAmount;
  const suggestedNice = niceRound(suggestedRaw);
  const realMargin = suggestedNice > 0 ? ((suggestedNice - totalCost) / suggestedNice) * 100 : 0;

  const lossPerUnit = currentPrice !== "" && Number(currentPrice) < suggestedNice
    ? suggestedNice - Number(currentPrice)
    : 0;
  const lossDay = lossPerUnit * (Number(unitsPerDay) || 0);
  const lossMonth = lossDay * 30;
  const lossYear = lossDay * 365;

  const breakEvenUnits = marginAmount > 0
    ? Math.ceil(((Number(rentMonthly) || 0) + (Number(utilMonthly) || 0)) / marginAmount / Math.min(31, Math.max(1, Number(operatingDays) || 26)))
    : 0;

  const updateIng = (id: string, patch: Partial<Ingredient>) => {
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const addIng = () => {
    setIngredients((prev) => [
      ...prev,
      { id: `i-${Date.now()}`, name: "", qty: 1, unit: "unit", cost: 0 },
    ]);
  };

  const removeIng = (id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSave = () => {
    if (!productName.trim()) {
      toast.error(t("pc_fillProductName"));
      return;
    }
    onSave({
      name: productName,
      cost: totalCost,
      price: suggestedNice,
      margin: realMargin,
    });
    toast.success(boss + ", " + t("pc_priceSaved"));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 bg-background overflow-y-auto animate-fade-in">
      <div className="mx-auto w-full max-w-full sm:max-w-[600px] md:max-w-[760px] lg:max-w-[960px] xl:max-w-[1140px] 2xl:max-w-[1280px] min-h-screen bg-background pb-32">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted tap" aria-label={t("pc_close")}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-extrabold leading-tight">{t("pc_calcTitle")}</h1>
            <p className="text-xs text-muted-foreground">{t("pc_calcSubtitle")}</p>
          </div>
        </header>

        <div className="px-4 py-5 space-y-5">
          {/* Step 1 — product */}
          <section className="space-y-2">
            <Label className="text-sm font-bold">{t("pc_productName")}</Label>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder={t("pc_productNamePlaceholder")}
              className="h-12 text-base rounded-2xl"
            />
          </section>

          {/* Step 2 — ingredients */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t("pc_ingredientList")}</h2>
            <div className="space-y-2">
              {ingredients.map((ing) => (
                <div key={ing.id} className="rounded-2xl bg-card border border-border p-3 shadow-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={ing.name}
                      onChange={(e) => updateIng(ing.id, { name: e.target.value })}
                      placeholder={t("pc_ingredientName")}
                      className="h-12 flex-1 rounded-xl"
                    />
                    <button
                      onClick={() => removeIng(ing.id)}
                      className="w-12 h-12 grid place-items-center rounded-xl bg-cost-soft text-cost tap"
                      aria-label={t("pc_delete")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={ing.qty === 0 ? "" : ing.qty}
                      onChange={(e) => updateIng(ing.id, { qty: e.target.value === "" ? 0 : Number(e.target.value) })}
                      placeholder={t("pc_quantity")}
                      className="h-12 rounded-xl"
                    />
                    <select
                      value={ing.unit}
                      onChange={(e) => updateIng(ing.id, { unit: e.target.value as IngUnit })}
                      className="h-12 rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">RM</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={ing.cost === 0 ? "" : ing.cost}
                        onChange={(e) => updateIng(ing.id, { cost: e.target.value === "" ? 0 : Number(e.target.value) })}
                        placeholder="0.00"
                        className="h-12 rounded-xl pl-10"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={addIng} variant="outline" className="w-full h-12 rounded-2xl">
              <Plus className="w-4 h-4 mr-1" /> {t("pc_addIngredient")}
            </Button>
            <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
              <span className="text-sm font-medium">{t("pc_totalBatchCost")}</span>
              <span className="text-base font-extrabold">{fmt(totalBatchCost)}</span>
            </div>
            <p className="text-xs text-muted-foreground -mt-1 px-1">
              {t("pc_batchCostHint")}
            </p>
          </section>

          {/* Step 3 — overheads */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t("pc_dailyOpCost")}</h2>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t("pc_monthlyRent")}</Label>
                <Input
                  type="number" inputMode="decimal"
                  value={rentMonthly}
                  onChange={(e) => setRentMonthly(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder={t("pc_eg900")}
                  className="h-12 rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{t("pc_monthlyUtil")}</Label>
                <Input
                  type="number" inputMode="decimal"
                  value={utilMonthly}
                  onChange={(e) => setUtilMonthly(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder={t("pc_eg300")}
                  className="h-12 rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{t("pc_unitsSoldPerDay")}</Label>
                <Input
                  type="number" inputMode="numeric"
                  value={unitsPerDay}
                  onChange={(e) => setUnitsPerDay(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder={t("pc_eg80")}
                  className="h-12 rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{t("pc_operatingDaysMonth")}</Label>
                <Input
                  type="number" inputMode="numeric" min={1} max={31}
                  value={operatingDays}
                  onChange={(e) => setOperatingDays(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder={t("pc_eg26")}
                  className="h-12 rounded-xl mt-1"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
              <span className="text-sm font-medium">{t("pc_overheadPerUnit")}</span>
              <span className="text-base font-extrabold">{fmt(overheadPerUnit)}</span>
            </div>
          </section>

          {/* Step 4 — margin */}
          <section className="space-y-3 rounded-2xl bg-card border border-border p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold">{t("targetProfit")} {boss}</Label>
              <span className="text-sm font-extrabold text-primary">{margin}%</span>
            </div>
            <Slider
              value={[margin]}
              min={10}
              max={80}
              step={1}
              onValueChange={(v) => setMargin(v[0])}
            />
            <p className="text-xs text-muted-foreground">
              {boss} {t("pc_wantProfitOf")} <span className="font-bold text-foreground">{margin}%</span> {t("pc_perSale")}
            </p>
          </section>

          {/* AI Result */}
          <section className="rounded-2xl p-5 bg-gradient-profit text-profit-foreground shadow-glow space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-90">
              <Sparkles className="w-4 h-4" /> {t("pc_aiSuggestedPrice")}
            </div>
            <div className="space-y-1.5 text-sm">
              <Row label={t("pc_ingredientCostPerUnit")} value={fmt(ingredientPerUnit)} />
              <Row label={t("pc_overheadCostPerUnit")} value={fmt(overheadPerUnit)} />
              <Row label={t("costPerUnit")} value={fmt(totalCost)} />
              <Row label={`${t("pc_marginLabel")} (${margin}%)`} value={fmt(marginAmount)} />
            </div>
            <div className="border-t border-white/20 pt-3">
              <div className="flex items-center gap-2 text-sm font-bold opacity-90">
                <CheckCircle2 className="w-4 h-4" /> {t("suggestedPricePerUnit")}
              </div>
              <div className="text-4xl font-extrabold mt-1">{fmt(suggestedRaw)}</div>
              <p className="text-xs opacity-90 mt-1">{t("pc_roundTo")} <span className="font-bold">{fmt(suggestedNice)}</span></p>
              <p className="text-xs opacity-90 mt-2">{t("pc_actualMargin")}: <span className="font-bold">{realMargin.toFixed(1)}%</span></p>
            </div>
            <p className="text-xs italic opacity-95 pt-2 border-t border-white/20">
              {boss}, {t("pc_priceAt")} {fmt(suggestedNice)} {t("pc_priceCompetitiveEnd")} 💚
            </p>
          </section>

          {/* Current price warning */}
          <section className="space-y-2">
            <Label className="text-sm font-bold">{t("pc_currentPriceLabel")} {boss} (RM)</Label>
            <Input
              type="number" inputMode="decimal" step="0.10"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder={t("pc_currentPricePlaceholder")}
              className="h-12 rounded-2xl"
            />
          </section>

          {lossPerUnit > 0 && (
            <section className="rounded-2xl p-5 bg-cost-soft border-2 border-cost/30 space-y-3 animate-pop-in">
              <div className="flex items-center gap-2 text-cost font-bold">
                <AlertTriangle className="w-5 h-5" /> {t("pc_priceWarning")}
              </div>
              <p className="text-sm text-foreground">
                {boss} {t("pc_sellsAt")} <span className="font-bold">{fmt(Number(currentPrice))}</span> {t("pc_nowBelowCost")}
              </p>
              <div className="space-y-1.5 text-sm">
                <Row label={t("pc_lossPerUnit")} value={fmt(lossPerUnit)} dark />
                <Row label={t("pc_lossPerDay")} value={`${fmt(lossDay)} (${Number(unitsPerDay) || 0} unit × ${fmt(lossPerUnit)})`} dark />
                <Row label={t("pc_lossPerMonth")} value={fmt(lossMonth)} dark />
                <Row label={t("pc_lossPerYear")} value={`${fmt(lossYear)} 😱`} dark />
              </div>
              <p className="text-xs text-muted-foreground italic">
                {t("pc_raiseBy")} {fmt(suggestedNice - Number(currentPrice))} {t("pc_priceRaiseEnd")}
              </p>
            </section>
          )}

          {/* Break-even */}
          <section className="rounded-2xl p-4 bg-warn-soft border border-warn/30">
            <p className="text-sm">
              {t("pc_breakEvenPrefix")} {boss} {t("pc_breakEvenMid")}{" "}
              <span className="font-extrabold text-warn">{breakEvenUnits} unit</span> {t("pc_breakEvenSuffix")}
            </p>
          </section>

          {/* Save */}
          <Button onClick={handleSave} className="w-full h-14 rounded-2xl text-base font-bold bg-gradient-profit text-profit-foreground shadow-fab">
            <Save className="w-5 h-5 mr-2" /> {t("pc_saveProductPrice")}
          </Button>
        </div>
      </div>
    </div>
  );
}

const Row = ({ label, value, dark }: { label: string; value: string; dark?: boolean }) => (
  <div className="flex items-center justify-between">
    <span className={dark ? "text-muted-foreground" : "opacity-90"}>{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);
