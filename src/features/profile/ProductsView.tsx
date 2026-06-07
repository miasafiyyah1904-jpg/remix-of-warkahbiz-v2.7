import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Sparkles, Loader2, ChevronRight, ChevronDown, ArrowLeft, Package, ScanLine, AlertTriangle } from "lucide-react";

import { scanRecipe } from "@/lib/scanRecipe.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useTranslation } from "@/context/LanguageContext";
import { estimateIngredientCost } from "@/lib/estimateCost.functions";
import { multiplierFor, tierFor, tierLabelKey } from "./profitScale";
import type { Product, ProductIngredient, ProductPackaging, StockItem, Unit } from "@/types";

const UNITS: Unit[] = ["kg", "g", "gram", "liter", "ml", "biji", "pek", "paket", "kotak", "botol", "tin", "bungkus", "batang", "helai", "ikat", "tong", "papan", "kampit", "ekor", "sudu", "cawan", "unit", "pcs", "box", "pack", "dozen"];
const BATCH_UNITS = ["biji", "pcs", "servings", "kotak", "pek", "botol", "balang", "helai", "ketul"];

const PRODUCT_CATEGORIES = ["Makanan", "Minuman", "Pek & Set", "Lain-lain"] as const;

const EMOJI_SUGGESTIONS = [
  "🍛","🍜","🍝","🍲","🥘","🍱","🥗","🫕","🍔","🌮","🥙","🧆",
  "🍗","🥚","🐟","🦐","🥩","🧇","🥞","🫔",
  "☕","🧋","🥤","🍵","🧃","🍹","🍺","🥛",
  "🎂","🍰","🧁","🍩","🍪","🍡","🍫",
  "📦","🛍️","🎁","🏷️",
];

const fmt = (n: number) =>
  "RM " + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function niceRound(price: number) {
  const whole = Math.floor(price);
  const cents = Math.round((price - whole) * 100);
  if (cents === 0) return whole;
  if (cents <= 4) return whole;
  if (cents <= 54) return whole + 0.5;
  return whole + 1;
}



export const ProductsView = ({
  products,
  stock = [],
  onSave,
  onDelete,
  onBack,
}: {
  products: Product[];
  stock?: StockItem[];
  onSave: (p: Product) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}) => {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const openNew = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setSheetOpen(true); };

  const handleDelete = (id: string) => {
    onDelete(id);
    setDeleteConfirm(null);
    toast.success(t("pv_deleteSuccess"));
  };

  return (
    <div className="pb-32">
      <div className="px-5 pt-6 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button onClick={onBack} className="text-xs font-bold text-primary tap mb-1 inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> {t("pv_backToProfile")}
          </button>
          <h2 className="text-xl font-extrabold tracking-tight">{t("pv_title")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {products.length === 0 ? t("pv_noProducts") : t("pv_productCount").replace("{count}", String(products.length))}
          </p>
        </div>
        <button
          onClick={openNew}
          className="shrink-0 h-10 px-4 rounded-2xl bg-gradient-profit text-profit-foreground text-xs font-bold tap shadow-card flex items-center gap-1"
        >
          <Plus className="w-4 h-4" strokeWidth={3} /> Tambah
        </button>
      </div>

      {products.length === 0 && (
        <div className="mx-5 mt-6 rounded-3xl bg-surface border border-border p-8 flex flex-col items-center text-center">
          <div className="text-5xl mb-3">🍽️</div>
          <h3 className="font-extrabold text-base">{t("pv_emptyHeading")}</h3>
          <p className="text-xs text-muted-foreground mt-2 max-w-[280px]">
            {t("pv_emptyBody")}
          </p>
          <button
            onClick={openNew}
            className="mt-5 h-11 px-5 rounded-2xl bg-gradient-profit text-profit-foreground text-sm font-bold tap shadow-card"
          >
            {t("pv_addFirst")}
          </button>
        </div>
      )}

      {products.length > 0 && (
        <div className="px-5 space-y-3">
          {products.map((p) => {
            const unitCost = p.costPerUnit ?? p.costPrice ?? 0;
            const price = p.suggestedPrice ?? p.sellingPrice ?? 0;
            const margin = price > 0 && unitCost > 0 ? Math.round(((price - unitCost) / price) * 100) : null;
            const batchSize = p.batchSize ?? 1;
            const batchUnit = p.batchUnit ?? "unit";
            const ings = p.ingredients ?? [];
            return (
              <div key={p.id} className="rounded-2xl bg-surface border border-border p-3">
                <div className="flex items-start gap-3">
                  <div className="text-3xl shrink-0">{p.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-sm leading-tight truncate">{p.name}</div>
                    {p.category && (
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{p.category}</div>
                    )}
                    <div className="mt-2 flex items-end gap-3 flex-wrap">
                      {price > 0 && (
                        <span className="font-extrabold text-profit text-xl leading-none">
                          {fmt(price)}
                          <span className="text-[10px] font-semibold opacity-70 ml-0.5">/{batchUnit}</span>
                        </span>
                      )}
                      {margin !== null && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          margin >= 50 ? "bg-profit/20 text-profit"
                            : margin >= 30 ? "bg-warn/20 text-warn-foreground"
                            : "bg-cost/20 text-cost"
                        }`}>{margin}% margin</span>
                      )}
                    </div>
                    {unitCost > 0 && (
                      <div className="mt-1 text-sm font-semibold text-cost/90">
                        Kos: {fmt(unitCost)}
                      </div>
                    )}
                    {batchSize > 1 && (
                      <div className="text-[11px] text-muted-foreground mt-1">{t("pv_batchInfo").replace("{size}", String(batchSize)).replace("{unit}", batchUnit)}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => openEdit(p)} className="w-9 h-9 rounded-xl bg-background border border-border grid place-items-center tap" aria-label="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm(p.id)} className="w-9 h-9 rounded-xl bg-background border border-border grid place-items-center tap" aria-label="Padam">
                      <Trash2 className="w-4 h-4 text-cost" />
                    </button>
                  </div>
                </div>

                {ings.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      🥘 Bahan ({ings.length})
                    </div>
                    {ings.map((ing) => {
                      const s = stock.find((x) => x.name.toLowerCase() === ing.name.trim().toLowerCase());
                      const peak = s?.maxQty ?? 0;
                      const minStock = +(peak * 0.2).toFixed(2);
                      return (
                        <div key={ing.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <div className="flex-1 min-w-0 truncate font-semibold">
                            {ing.name || <span className="text-muted-foreground italic">(tanpa nama)</span>}
                          </div>
                          <div className="text-muted-foreground font-medium shrink-0">
                            {ing.quantity} {ing.unit}
                          </div>
                          <div className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                            Stok minimum: {minStock} {ing.unit}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ProductDialog
        key={editing?.id ?? "new"}
        open={sheetOpen}
        initial={editing}
        stock={stock}
        onClose={() => setSheetOpen(false)}
        onSave={(p) => {
          onSave(p);
          setSheetOpen(false);
          toast.success(editing ? t("pv_updateSuccess") : t("pv_addSuccess"));
        }}
      />

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-sm bg-surface rounded-3xl p-5 animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-extrabold text-base">{t("pv_deleteHeading")}</h3>
            <p className="text-xs text-muted-foreground mt-2">Tindakan ini tidak boleh dibatalkan.</p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={() => setDeleteConfirm(null)} className="tap h-11 rounded-xl border border-border font-semibold">Batal</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="tap h-11 rounded-xl bg-cost text-cost-foreground font-bold">Padam</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Multi-step product dialog
// ============================================================
type Step = 1 | 2 | 3;

const ProductDialog = ({
  open,
  initial,
  stock = [],
  onClose,
  onSave,
}: {
  open: boolean;
  initial: Product | null;
  stock?: StockItem[];
  onClose: () => void;
  onSave: (p: Product) => void;
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(1);

  // Step 1 — Basic info + Batch definition
  const [emoji, setEmoji] = useState(initial?.emoji || "🍛");
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || "");
  const [category, setCategory] = useState(initial?.category || "Makanan");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [servingsPerBatch, setServingsPerBatch] = useState<number>(
    initial?.servingsPerBatch ?? initial?.batchSize ?? 0
  );
  const [servingUnit, setServingUnit] = useState<string>(
    initial?.servingUnit || initial?.batchUnit || "bungkus"
  );
  const [cookingFrequencyDays, setCookingFrequencyDays] = useState<number>(
    initial?.cookingFrequencyDays ?? 1
  );
  const [batchesFromIngredients, setBatchesFromIngredients] = useState<number>(
    initial?.batchesFromIngredients ?? 0
  );

  // Step 2 — Ingredients + Packaging
  const [ingredients, setIngredients] = useState<ProductIngredient[]>(
    initial?.ingredients && initial.ingredients.length > 0 ? initial.ingredients : []
  );
  const [packagingEnabled, setPackagingEnabled] = useState<boolean>(
    !!initial?.packaging && (initial.packaging.costPerUnit > 0 || !!initial.packaging.type)
  );
  const [packagingType, setPackagingType] = useState<string>(initial?.packaging?.type || "");
  const [packagingCost, setPackagingCost] = useState<number>(initial?.packaging?.costPerUnit ?? 0);
  const [manualCostPerUnit, setManualCostPerUnit] = useState<number>(
    initial?.costPerUnit ?? initial?.costPrice ?? 0
  );

  // Step 3 — Profit scale
  const [profitScale, setProfitScale] = useState<number>(initial?.targetProfitScale ?? 5);

  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!open) setStep(1);
  }, [open]);

  const isDirty =
    name.trim().length > 0 ||
    description.trim().length > 0 ||
    ingredients.length > 0 ||
    packagingEnabled;

  const attemptClose = () => {
    if (isDirty) {
      setConfirmDiscard(true);
    } else {
      onClose();
    }
  };

  const totalBatchCost = useMemo(
    () => ingredients.reduce((s, i) => s + (i.predictedCost || 0), 0),
    [ingredients]
  );

  const safeBatchSize = Math.max(1, Number(servingsPerBatch) || 1);
  const ingredientPerUnit = totalBatchCost / safeBatchSize;
  const packagingPerUnit = packagingEnabled
    ? Math.max(0, Number(packagingCost) || 0) / safeBatchSize
    : 0;
  const hasIngredients = ingredients.length > 0;
  const baseCostPerUnit = hasIngredients
    ? ingredientPerUnit + packagingPerUnit
    : Math.max(0, Number(manualCostPerUnit) || 0) + packagingPerUnit;
  const effectiveTotalCost = hasIngredients
    ? totalBatchCost
    : Math.max(0, Number(manualCostPerUnit) || 0) * safeBatchSize;

  const pricing = useMemo(() => {
    if (baseCostPerUnit <= 0) return null;
    const multiplier = multiplierFor(profitScale);
    const suggestedRaw = baseCostPerUnit * multiplier;
    const suggestedPrice = niceRound(suggestedRaw);
    const realMargin = suggestedPrice > 0
      ? ((suggestedPrice - baseCostPerUnit) / suggestedPrice) * 100
      : 0;
    return { suggestedPrice, realMargin, multiplier };
  }, [baseCostPerUnit, profitScale]);

  const handleSave = () => {
    if (!name.trim()) { toast.error(t("pv_validationName")); setStep(1); return; }
    const packaging: ProductPackaging | undefined = packagingEnabled
      ? { type: packagingType.trim(), costPerUnit: packagingPerUnit }
      : undefined;

    onSave({
      id: initial?.id || `prod-${Date.now()}`,
      emoji,
      name: name.trim(),
      description: description.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      ingredients,
      servingsPerBatch: safeBatchSize,
      servingUnit,
      cookingFrequencyDays,
      batchesFromIngredients: Math.max(0, Number(batchesFromIngredients) || 0),
      // Backward-compat (other features still read these)
      batchSize: safeBatchSize,
      batchUnit: servingUnit,
      packaging,
      targetProfitScale: profitScale,
      totalCost: effectiveTotalCost || 0,
      costPerUnit: baseCostPerUnit || 0,
      suggestedPrice: pricing?.suggestedPrice,
      margin: pricing?.realMargin,
      category,
      // Legacy
      sellingPrice: pricing?.suggestedPrice,
      costPrice: baseCostPerUnit,
    });
  };

  const stepTitles: Record<Step, string> = {
    1: t("step1Short"),
    2: t("step2Short"),
    3: t("step3Short"),
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) attemptClose(); }}>
      <DialogContent
        className="max-w-[560px] p-0 gap-0 max-h-[92vh] flex flex-col rounded-3xl overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-base font-extrabold flex items-center gap-2">
            <span className="text-xl">{emoji}</span>
            {initial ? t("pv_editProductLabel") : t("pv_addProductLabel")}
          </DialogTitle>
          {/* 3-step Stepper */}
          <div className="mt-3 flex items-center gap-1.5">
            {([1, 2, 3] as Step[]).map((n, idx) => (
              <div key={n} className="flex items-center gap-1.5 flex-1">
                <div
                  className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-extrabold shrink-0 ${
                    step === n
                      ? "bg-primary text-primary-foreground"
                      : step > n
                        ? "bg-profit text-profit-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {n}
                </div>
                <span className={`text-[11px] font-semibold truncate ${step === n ? "text-primary" : "text-muted-foreground"}`}>
                  {stepTitles[n]}
                </span>
                {idx < 2 && <div className="h-px flex-1 bg-border" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 1 && (
            <>
              <BasicInfoStep
                emoji={emoji} setEmoji={setEmoji}
                emojiPickerOpen={emojiPickerOpen} setEmojiPickerOpen={setEmojiPickerOpen}
                name={name} setName={setName}
                description={description} setDescription={setDescription}
                imageUrl={imageUrl} setImageUrl={setImageUrl}
                category={category} setCategory={setCategory}
              />
              <div className="mt-5 pt-5 border-t border-border">
                <BatchDefinitionBlock
                  servingsPerBatch={servingsPerBatch} setServingsPerBatch={setServingsPerBatch}
                  servingUnit={servingUnit} setServingUnit={setServingUnit}
                  cookingFrequencyDays={cookingFrequencyDays} setCookingFrequencyDays={setCookingFrequencyDays}
                  batchesFromIngredients={batchesFromIngredients} setBatchesFromIngredients={setBatchesFromIngredients}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="mb-3 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 text-[11px] font-semibold text-primary flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                {t("perBatchNote")} — 1 sesi = {safeBatchSize} {servingUnit}
              </div>
              <IngredientsStep
                ingredients={ingredients}
                setIngredients={setIngredients}
                stock={stock}
                productName={name}
                batchSize={safeBatchSize}
                batchUnit={servingUnit}
              />
              <div className="mt-5 pt-5 border-t border-border">
                <PackagingBlock
                  enabled={packagingEnabled} setEnabled={setPackagingEnabled}
                  type={packagingType} setType={setPackagingType}
                  cost={packagingCost} setCost={setPackagingCost}
                />
              </div>
              {ingredients.length === 0 && (
                <div className="mt-5 pt-5 border-t border-border space-y-2">
                  <label className="text-xs font-bold">Kos per unit (RM)</label>
                  <p className="text-[11px] text-muted-foreground">
                    Tiada bahan ditambah? Masukkan kos seunit secara manual di sini.
                  </p>
                  <Input
                    type="number" inputMode="decimal" step="0.01"
                    value={manualCostPerUnit === 0 ? "" : manualCostPerUnit}
                    onChange={(e) => setManualCostPerUnit(e.target.value === "" ? 0 : Number(e.target.value))}
                    placeholder="0.00"
                    className="h-12 rounded-xl"
                  />
                </div>
              )}
              {totalBatchCost > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
                  <span className="text-xs font-semibold">{t("totalBatchCost")}</span>
                  <span className="text-sm font-extrabold">{fmt(totalBatchCost)}</span>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <ProfitScaleStep
              scale={profitScale}
              setScale={setProfitScale}
              ingredientPerUnit={ingredientPerUnit}
              packagingPerUnit={packagingPerUnit}
              batchSize={safeBatchSize}
              batchUnit={servingUnit}
              totalBatchCost={totalBatchCost}
              suggestedPrice={pricing?.suggestedPrice ?? 0}
              realMargin={pricing?.realMargin ?? 0}
            />
          )}
        </div>

        {/* Compact live footer (steps 2 & 3 once we have a cost) */}
        {pricing && step !== 3 && (
          <div className="border-t border-border bg-gradient-profit text-profit-foreground px-5 py-3 animate-pop-in">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-90">
              <Sparkles className="w-3 h-3" /> Live Pricing
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-white/90 text-[10px]">{t("costPerUnit")}</div>
                <div className="font-extrabold text-2xl leading-tight">{fmt(baseCostPerUnit)}</div>
              </div>
              <div>
                <div className="text-white/90 text-[10px]">{t("suggestedPricePerUnit")}</div>
                <div className="font-extrabold text-2xl leading-tight">{fmt(pricing.suggestedPrice)}</div>
              </div>
              <div>
                <div className="text-white/90 text-[10px]">{t("profitMargin")}</div>
                <div
                  className={`font-extrabold text-2xl leading-tight px-2 inline-block rounded-lg ${
                    pricing.realMargin >= 40
                      ? "bg-profit/30"
                      : pricing.realMargin >= 20
                        ? "bg-warn/40 text-warn-foreground"
                        : "bg-cost/40"
                  }`}
                >
                  {pricing.realMargin.toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-border px-5 py-3 flex items-center justify-between gap-2">
          {step === 1 && (
            <>
              <Button variant="outline" onClick={attemptClose} className="rounded-2xl">Batal</Button>
              <Button
                onClick={() => {
                  if (!name.trim()) { toast.error(t("pv_validationName")); return; }
                  setStep(2);
                }}
                className="rounded-2xl bg-gradient-profit text-profit-foreground"
              >
                {t("smartNext")} <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}
          {step === 2 && (() => {
            const unconfirmed = ingredients.filter(
              (i) => i.predictedCost !== undefined && i.predictedCost > 0 && !i.manualCost,
            ).length;
            return (
              <div className="flex-1 flex flex-col gap-2">
                {unconfirmed > 0 && (
                  <div className="rounded-xl bg-amber-100 dark:bg-warn/15 border border-amber-400 dark:border-warn/40 px-3 py-2 text-[12px] font-semibold text-amber-800 dark:text-warn-foreground flex items-center gap-2">
                    <span aria-hidden>⚠️</span>
                    <span>{unconfirmed} bahan masih menggunakan harga anggaran AI. Sila semak sebelum teruskan.</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="rounded-2xl">{t("smartBack")}</Button>
                  <Button
                    onClick={() => {
                      setStep(3);
                    }}
                    className="rounded-2xl bg-gradient-profit text-profit-foreground"
                  >
                    {t("smartNext")} <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })()}
          {step === 3 && (
            <>
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-2xl">{t("smartBack")}</Button>
              <Button onClick={handleSave} className="rounded-2xl bg-gradient-profit text-profit-foreground">
                {t("saveProduct")}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
    {confirmDiscard && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-5" onClick={() => setConfirmDiscard(false)}>
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative w-full max-w-sm bg-surface rounded-3xl p-5 animate-pop-in" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-extrabold text-base">Buang perubahan?</h3>
          <p className="text-xs text-muted-foreground mt-2">Maklumat yang anda masukkan tidak akan disimpan.</p>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button onClick={() => setConfirmDiscard(false)} className="tap h-11 rounded-xl border border-border font-semibold">Batal</button>
            <button
              onClick={() => { setConfirmDiscard(false); onClose(); }}
              className="tap h-11 rounded-xl bg-cost text-cost-foreground font-bold"
            >
              Ya, Buang
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

// ============================================================
// Batch Definition block (used inside Step 1)
// ============================================================
const SERVING_UNIT_OPTIONS = ["bungkus", "biji", "pcs", "pinggan", "cawan", "botol", "pek", "kotak"];
const COOKING_FREQ_OPTIONS = [
  { label: "Setiap hari", value: 1 },
  { label: "Setiap 2 hari", value: 2 },
  { label: "2x seminggu", value: 3.5 },
  { label: "Seminggu sekali", value: 7 },
];

const BatchDefinitionBlock = ({
  servingsPerBatch, setServingsPerBatch,
  servingUnit, setServingUnit,
  cookingFrequencyDays, setCookingFrequencyDays,
  batchesFromIngredients, setBatchesFromIngredients,
}: {
  servingsPerBatch: number; setServingsPerBatch: (n: number) => void;
  servingUnit: string; setServingUnit: (s: string) => void;
  cookingFrequencyDays: number; setCookingFrequencyDays: (n: number) => void;
  batchesFromIngredients: number; setBatchesFromIngredients: (n: number) => void;
}) => {
  const hasServings = servingsPerBatch > 0 && !!servingUnit;
  const showSummary =
    batchesFromIngredients > 0 && cookingFrequencyDays > 0 && servingsPerBatch > 0;
  const daysCover = batchesFromIngredients * cookingFrequencyDays;
  const totalOutput = batchesFromIngredients * servingsPerBatch;

  return (
    <div className="space-y-5">
      {/* Section 1 — Hasil 1 Sesi Masak */}
      <div className="space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Hasil 1 Sesi Masak 🍳
        </div>
        <div className="rounded-2xl bg-blue-500/10 border border-blue-500/30 p-3 text-[11px] text-blue-700 dark:text-blue-300 font-semibold">
          💡 Berapa hidangan boleh anda hasilkan setiap kali memasak?
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Bilangan hidangan">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={servingsPerBatch === 0 ? "" : servingsPerBatch}
              onChange={(e) =>
                setServingsPerBatch(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))
              }
              placeholder="cth: 15"
              className="h-12 rounded-2xl text-base font-bold"
            />
          </Field>
          <Field label="Unit">
            <div className="relative">
              <select
                value={servingUnit}
                onChange={(e) => setServingUnit(e.target.value)}
                className="w-full h-12 pl-4 pr-10 rounded-2xl bg-background border border-input text-base font-semibold appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {SERVING_UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </div>
          </Field>
        </div>
        {hasServings && (
          <div className="rounded-full bg-profit/15 text-profit border border-profit/30 px-3 py-2 text-[11px] font-bold text-center animate-pop-in">
            ✅ 1 sesi masak = {servingsPerBatch} {servingUnit} boleh dijual
          </div>
        )}
      </div>

      <div className="h-px w-full bg-border" />

      {/* Section 2 — Kekerapan Masak */}
      <div className="space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Kekerapan Masak 🔄
        </div>
        <Field label="Berapa kerap anda masak?">
          <div className="relative">
            <select
              value={cookingFrequencyDays}
              onChange={(e) => setCookingFrequencyDays(Number(e.target.value))}
              className="w-full h-12 pl-4 pr-10 rounded-2xl bg-background border border-input text-base font-semibold appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {COOKING_FREQ_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
        </Field>
      </div>

      <div className="h-px w-full bg-border" />

      {/* Section 3 — Stok Bahan Semasa */}
      <div className="space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Stok Bahan Semasa 🧺
        </div>
        <div>
          <div className="text-[11px] font-bold text-muted-foreground mb-0.5 ml-1">
            Bahan yang anda ada sekarang cukup untuk berapa sesi masak?
          </div>
          <div className="text-[10px] text-muted-foreground mb-1.5 ml-1 italic">
            Contoh: beli bahan seminggu = taip 7
          </div>
          <div className="w-1/2">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={batchesFromIngredients === 0 ? "" : batchesFromIngredients}
              onChange={(e) =>
                setBatchesFromIngredients(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))
              }
              placeholder="0"
              className="h-12 rounded-2xl text-base font-bold"
            />
          </div>
        </div>

        {showSummary && (
          <div className="space-y-2 animate-pop-in">
            <div className="rounded-2xl bg-muted/50 border border-border p-3 space-y-1.5 text-[12px] font-semibold">
              <div>🗓 Bahan tahan: ±{daysCover} hari</div>
              <div>🔄 Perlu restock: dalam {daysCover} hari</div>
              <div>🧺 Jumlah output: {totalOutput} {servingUnit}</div>
            </div>
            <div className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-3 py-2 text-[11px] font-bold text-center">
              {batchesFromIngredients} sesi × {servingsPerBatch} {servingUnit} = {totalOutput} {servingUnit} dari stok ini
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// Packaging block (used inside Step 2)
// ============================================================
const PackagingBlock = ({
  enabled, setEnabled, type, setType, cost, setCost,
}: {
  enabled: boolean; setEnabled: (b: boolean) => void;
  type: string; setType: (s: string) => void;
  cost: number; setCost: (n: number) => void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Package className="w-3 h-3" /> {t("packagingExtras")}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t("packagingHint")}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      {enabled && (
        <div className="space-y-2 animate-pop-in">
          <Field label={t("packagingType")}>
            <Input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder={t("packagingTypePh")}
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Jumlah Kos Pembungkusan (untuk 1 batch)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">RM</span>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={cost === 0 ? "" : cost}
                onChange={(e) => setCost(e.target.value === "" ? 0 : Number(e.target.value))}
                placeholder="Cth: RM5.00 untuk 1 batch"
                className="h-11 rounded-xl pl-10"
              />
            </div>
          </Field>
        </div>
      )}
      {!enabled && (
        <p className="text-[11px] text-muted-foreground italic px-1">
          🎁 Jangan lupa kos kotak/pelekat — selalu terlepas pandang!
        </p>
      )}
    </div>
  );
};

// ============================================================
// Step 3 — Profit Scale + Live Suggested Price
// ============================================================
const ProfitScaleStep = ({
  scale, setScale,
  ingredientPerUnit, packagingPerUnit,
  batchSize, batchUnit, totalBatchCost,
  suggestedPrice, realMargin,
}: {
  scale: number; setScale: (n: number) => void;
  ingredientPerUnit: number; packagingPerUnit: number;
  batchSize: number; batchUnit: string; totalBatchCost: number;
  suggestedPrice: number; realMargin: number;
}) => {
  const { t } = useTranslation();
  const tier = tierFor(scale);
  const tierKey = tierLabelKey(scale);
  const baseCostPerUnit = ingredientPerUnit + packagingPerUnit;

  // Emphasize price as scale grows (premium = bolder)
  const priceSizeClass = scale >= 8 ? "text-5xl" : scale >= 4 ? "text-4xl" : "text-3xl";
  const tierColor =
    tier === "premium" ? "text-profit"
    : tier === "standard" ? "text-primary"
    : "text-warn-foreground";

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("targetProfit")}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{t("targetProfitHint")}</p>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{t("targetProfit")}</div>
              <div className={`text-2xl font-extrabold ${tierColor}`}>{scale} / 10</div>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
              tier === "premium" ? "bg-profit/15 text-profit"
              : tier === "standard" ? "bg-primary/15 text-primary"
              : "bg-warn/15 text-warn-foreground"
            }`}>
              {t(tierKey)}
            </span>
          </div>

          {/* Slider with gradient track */}
          <div className="relative pt-1">
            <div
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full pointer-events-none opacity-40"
              style={{
                background: "linear-gradient(90deg, hsl(var(--warn,38 92% 50%)) 0%, hsl(var(--primary,221 83% 53%)) 50%, hsl(var(--profit,142 71% 45%)) 100%)",
              }}
            />
            <Slider
              value={[scale]}
              min={1}
              max={10}
              step={1}
              onValueChange={(v) => setScale(v[0])}
              className="relative"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-semibold mt-2 px-0.5">
              <span>1 · {t("scaleLow")}</span>
              <span>5 · {t("scaleStandard")}</span>
              <span>10 · {t("scalePremium")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Big animated suggested price */}
      <Card key={`${suggestedPrice}-${scale}`} className="rounded-3xl border-0 bg-gradient-profit text-profit-foreground shadow-glow animate-pop-in">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-90">
            <Sparkles className="w-3 h-3" /> {t("suggestedPricePerUnit")}
          </div>
          <div className={`font-extrabold leading-none transition-all ${priceSizeClass}`}>
            {fmt(suggestedPrice)}
          </div>
          <div className="text-[11px] opacity-90">
            per {batchUnit} · {t("profitMargin")}{" "}
            <span className="font-bold">{realMargin.toFixed(0)}%</span>
          </div>

          <div className="border-t border-white/20 pt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="opacity-80 text-[10px]">{t("totalBatchCost")}</div>
              <div className="font-bold text-sm">{fmt(totalBatchCost)}</div>
            </div>
            <div>
              <div className="opacity-80 text-[10px]">1 batch → {batchSize} {batchUnit}</div>
              <div className="font-bold text-sm">{fmt(ingredientPerUnit)} / unit</div>
            </div>
            {packagingPerUnit > 0 && (
              <>
                <div>
                  <div className="opacity-80 text-[10px]">Kos Bungkus/unit</div>
                  <div className="font-bold text-sm">{fmt(packagingPerUnit)}</div>
                </div>
                <div>
                  <div className="opacity-80 text-[10px]">{t("costPerUnit")}</div>
                  <div className="font-bold text-sm">{fmt(baseCostPerUnit)}</div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================================
// Step 1
// ============================================================
const BasicInfoStep = ({
  emoji, setEmoji, emojiPickerOpen, setEmojiPickerOpen,
  name, setName, description, setDescription,
  imageUrl, setImageUrl, category, setCategory,
}: {
  emoji: string; setEmoji: (s: string) => void;
  emojiPickerOpen: boolean; setEmojiPickerOpen: (b: boolean) => void;
  name: string; setName: (s: string) => void;
  description: string; setDescription: (s: string) => void;
  imageUrl: string; setImageUrl: (s: string) => void;
  category: string; setCategory: (s: string) => void;
}) => {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Saiz gambar terlalu besar (maks 5MB)");
      return;
    }
    if (!userId) {
      toast.error("Sila log masuk semula");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const uuid = (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const path = `${userId}/${uuid}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("Gambar berjaya dimuat naik");
    } catch (e: any) {
      toast.error("Gagal muat naik gambar. Cuba lagi.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {t("productBasicInfo")}
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
          className="w-20 h-20 rounded-3xl bg-background border-2 border-border text-4xl grid place-items-center tap"
        >
          {emoji}
        </button>
        <button className="text-xs font-bold text-primary tap" onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}>
          Tukar ikon
        </button>
      </div>

      {emojiPickerOpen && (
        <div className="grid grid-cols-8 gap-1 p-2 rounded-2xl bg-background border border-border">
          {EMOJI_SUGGESTIONS.map((e) => (
            <button
              key={e}
              onClick={() => { setEmoji(e); setEmojiPickerOpen(false); }}
              className={`text-xl h-9 rounded-xl tap grid place-items-center ${emoji === e ? "bg-primary/15" : "hover:bg-muted"}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <Field label="Nama Produk">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Cth: Nasi Lemak Ayam" className="h-12 rounded-2xl" />
      </Field>

      <Field label={t("productDescription")}>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder={t("productDescriptionPh")} className="rounded-2xl min-h-[72px]" />
      </Field>

      <Field label={t("productImage")}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {imageUrl ? (
          <div className="relative">
            <img src={imageUrl} alt="Produk" className="w-full h-32 object-cover rounded-2xl" />
            <button
              type="button"
              onClick={() => setImageUrl("")}
              className="absolute top-2 right-2 h-7 px-2 rounded-full bg-black/70 text-white text-xs font-bold tap"
            >
              ✕ Padam
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="w-full h-20 rounded-2xl border-2 border-dashed border-border bg-background text-sm font-semibold text-muted-foreground tap grid place-items-center disabled:opacity-60"
          >
            {uploading ? (
              <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat naik…</span>
            ) : (
              "📷 Muat naik gambar produk"
            )}
          </button>
        )}
      </Field>

      <Field label="Kategori">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full h-12 px-4 rounded-2xl bg-background border border-input text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
    </div>
  );
};

// ============================================================
// Step 2 — Ingredient Builder with AI estimation
// ============================================================
const IngredientsStep = ({
  ingredients,
  setIngredients,
  stock = [],
  productName,
  batchSize,
  batchUnit,
}: {
  ingredients: ProductIngredient[];
  setIngredients: React.Dispatch<React.SetStateAction<ProductIngredient[]>>;
  stock?: StockItem[];
  productName: string;
  batchSize: number;
  batchUnit: string;
}) => {
  const { t } = useTranslation();
  const recipeInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);

  const add = () => {
    setIngredients((prev) => [
      { id: `ing-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, name: "", quantity: 1, unit: "unit" as Unit, predictedCost: undefined },
      ...prev,
    ]);
  };

  const addMany = (n: number) => {
    setIngredients((prev) => {
      const base = Date.now();
      const newRows: ProductIngredient[] = [];
      for (let i = 0; i < n; i++) {
        newRows.push({ id: `ing-${base}-${i}-${Math.random().toString(36).slice(2,5)}`, name: "", quantity: 1, unit: "unit" as Unit, predictedCost: undefined });
      }
      return [...newRows, ...prev];
    });
  };

  const handleRecipeScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Saiz gambar terlalu besar (maks 8MB)");
      return;
    }
    setIsScanning(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await scanRecipe({ data: { imageBase64: base64, mimeType: file.type || "image/jpeg" } });
      if (!result.ok) {
        const msgs: Record<string, string> = {
          rate_limit: "Terlalu banyak permintaan. Cuba lagi sebentar.",
          no_credits: "Kredit AI habis.",
          missing_key: "AI belum disambungkan.",
          bad_json: "AI tidak dapat membaca bahan. Cuba gambar lebih jelas.",
        };
        toast.error(msgs[result.error ?? ""] ?? result.message ?? "Gagal imbas resepi.");
        return;
      }
      if (!result.items || result.items.length === 0) {
        toast.error("AI tidak jumpa bahan dalam gambar ini. Cuba gambar yang lebih jelas.");
        return;
      }
      const allowedUnits = new Set<Unit>(UNITS);
      const newIngs: ProductIngredient[] = result.items.map((item: { name?: string; qty?: number; unit?: string }, i: number) => {
        const rawUnit = (item.unit || "unit").toLowerCase();
        const unit = (allowedUnits.has(rawUnit as Unit) ? rawUnit : "unit") as Unit;
        // Auto-link to existing stock if name matches
        const match = stock.find((s) => s.name.trim().toLowerCase() === (item.name || "").trim().toLowerCase());
        return {
          id: `scan-${Date.now()}-${i}`,
          name: item.name || "Bahan",
          quantity: Number(item.qty) > 0 ? Number(item.qty) : 1,
          unit: match ? match.unit : unit,
          predictedCost: undefined,
        };
      });
      setIngredients((prev) => [...newIngs, ...prev]);
      toast.success(`${newIngs.length} bahan dikesan dari resepi ✅`);
      const unmatched = newIngs.filter((ing) => {
        return !stock.find((s) => s.name.trim().toLowerCase() === ing.name.trim().toLowerCase());
      });
      if (unmatched.length > 0) {
        const names = unmatched.map((u) => u.name).join(", ");
        toast.info(
          `${unmatched.length} bahan tidak dijumpai dalam stok anda: ${names}. Sila semak harga secara manual.`,
          { duration: 6000 }
        );
      }
    } catch (err) {
      console.error("Recipe scan error:", err);
      toast.error("Ralat semasa imbas resepi. Cuba lagi.");
    } finally {
      setIsScanning(false);
      if (recipeInputRef.current) recipeInputRef.current.value = "";
    }
  };

  const update = (id: string, patch: Partial<ProductIngredient>) => {
    setIngredients((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
  };

  const remove = (id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("productIngredients")}
        </div>
        <div className="flex items-center gap-1.5">
          <Button onClick={() => addMany(5)} size="sm" variant="ghost" className="rounded-xl h-8 text-[11px] px-2">
            +5 baris
          </Button>
          <Button onClick={add} size="sm" variant="outline" className="rounded-xl h-8 text-xs">
            <Plus className="w-3 h-3" /> Bahan
          </Button>
        </div>
      </div>

      <input
        ref={recipeInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleRecipeScan}
      />
      <button
        type="button"
        onClick={() => recipeInputRef.current?.click()}
        disabled={isScanning}
        className="w-full h-12 rounded-2xl border border-dashed border-primary/50 bg-primary/5 flex items-center justify-center gap-2 tap text-sm font-bold text-primary disabled:opacity-50"
      >
        {isScanning ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> AI sedang baca resepi...</>
        ) : (
          <><ScanLine className="w-4 h-4" /> Imbas Resepi (AI)</>
        )}
      </button>

      {stock.length > 0 && (
        <div className="rounded-xl bg-muted/40 border border-border px-3 py-2 text-[11px] text-muted-foreground">
          💡 Taip nama bahan — auto-cadang dari <span className="font-bold text-foreground">{stock.length}</span> stok sedia ada. Pilih untuk auto-isi unit.
        </div>
      )}

      {ingredients.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center">
            <div className="text-2xl mb-2">🥕</div>
            <p className="text-xs text-muted-foreground">{t("noIngredientsYet")}</p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <Button onClick={add} className="rounded-2xl bg-gradient-profit text-profit-foreground" size="sm">
                <Plus className="w-4 h-4" /> Tambah Bahan
              </Button>
              <Button onClick={() => addMany(5)} variant="outline" className="rounded-2xl" size="sm">
                +5 baris kosong
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <datalist id="stock-name-suggestions">
        {stock.map((s) => <option key={s.id} value={s.name} />)}
      </datalist>

      <div className="space-y-2">
        {ingredients.map((ing) => (
          <IngredientCard
            key={ing.id}
            ingredient={ing}
            stock={stock}
            productName={productName}
            batchSize={batchSize}
            batchUnit={batchUnit}
            onChange={(patch) => update(ing.id, patch)}
            onRemove={() => remove(ing.id)}
          />
        ))}
      </div>

      {ingredients.length > 0 && (
        <p className="text-[11px] text-muted-foreground text-center pt-1">
          💡 {t("manualOverride")}
        </p>
      )}
    </div>
  );
};

const IngredientCard = ({
  ingredient,
  stock = [],
  productName,
  batchSize,
  batchUnit,
  onChange,
  onRemove,
}: {
  ingredient: ProductIngredient;
  stock?: StockItem[];
  productName: string;
  batchSize: number;
  batchUnit: string;
  onChange: (patch: Partial<ProductIngredient>) => void;
  onRemove: () => void;
}) => {
  const linkedStock = ingredient.stockItemId
    ? stock.find((s) => s.id === ingredient.stockItemId)
    : undefined;
  const nameMatchedStock = stock.find((s) => s.name.trim().toLowerCase() === ingredient.name.trim().toLowerCase());
  const matchedStock = linkedStock ?? nameMatchedStock;
  const noStockLink = !linkedStock && !nameMatchedStock;
  const { t } = useTranslation();
  const estimate = estimateIngredientCost;
  const [estimating, setEstimating] = useState(false);
  const [aiSuggested, setAiSuggested] = useState<number | null>(
    !ingredient.manualCost && ingredient.predictedCost ? ingredient.predictedCost : null,
  );
  const [costDraft, setCostDraft] = useState(
    ingredient.predictedCost !== undefined ? String(ingredient.predictedCost) : "",
  );
  const [qtyDraft, setQtyDraft] = useState(ingredient.quantity === 0 ? "" : String(ingredient.quantity));
  const [userHasEdited, setUserHasEdited] = useState(
    ingredient.manualCost === true || (ingredient.predictedCost !== undefined && ingredient.predictedCost > 0)
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isStandardUnit = (UNITS as readonly string[]).includes(ingredient.unit as string);
  const [customUnitMode, setCustomUnitMode] = useState(!isStandardUnit && !!ingredient.unit);
  const [customUnitDraft, setCustomUnitDraft] = useState(!isStandardUnit ? String(ingredient.unit) : "");

  // Auto-estimate when name + qty change (debounced)
  useEffect(() => {
    if (ingredient.manualCost) return;
    if (!ingredient.name.trim() || ingredient.quantity <= 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setEstimating(true);
      try {
        const res = await estimate({
          data: {
            name: ingredient.name.trim(),
            quantity: ingredient.quantity,
            unit: String(ingredient.unit),
            productName: productName?.trim() || undefined,
            batchSize: batchSize > 0 ? batchSize : undefined,
            batchUnit: batchUnit || undefined,
            cookingUnit: batchUnit || undefined,
          },
        });
        if (res.ok && res.cost > 0) {
          setAiSuggested(res.cost);
          onChange({ predictedCost: res.cost, manualCost: false });
          setCostDraft(String(res.cost));
        }
      } catch (e) {
        console.error("estimate error", e);
      } finally {
        setEstimating(false);
      }
    }, 700);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredient.name, ingredient.quantity, ingredient.unit]);

  const commitCostEdit = () => {
    const v = parseFloat(costDraft);
    if (!isNaN(v) && v >= 0) {
      onChange({ predictedCost: v, manualCost: true });
    }
  };

  const hasAnyCost = ingredient.predictedCost !== undefined && ingredient.predictedCost > 0;
  const isConfirmed = userHasEdited && hasAnyCost;

  return (
    <Card className="rounded-2xl bg-white border-gray-200 dark:bg-card dark:border-border shadow-sm">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Input
              list="stock-name-suggestions"
              value={ingredient.name}
              onChange={(e) => {
                const newName = e.target.value;
                const match = stock.find((s) => s.name.trim().toLowerCase() === newName.trim().toLowerCase());
                if (match) {
                  onChange({ name: newName, unit: match.unit, manualCost: false, stockItemId: match.id });
                  setCustomUnitMode(false);
                } else {
                  onChange({ name: newName, manualCost: false });
                }
              }}
              placeholder="Cari atau taip nama bahan…"
              className="h-11 rounded-xl pr-16"
            />
            {matchedStock && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-profit/15 text-profit">
                ✓ stok
              </span>
            )}
            {noStockLink && ingredient.name.trim() && (
              <AlertTriangle
                className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-warn"
                aria-label="Tiada stok berkaitan — susutan tidak akan dikira"
              >
                <title>Tiada stok berkaitan — susutan tidak akan dikira</title>
              </AlertTriangle>
            )}
          </div>
          <button
            onClick={onRemove}
            className="w-11 h-11 grid place-items-center rounded-xl bg-cost-soft text-cost tap"
            aria-label="Padam"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {stock.length > 0 && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Stok berkaitan
            </label>
            <select
              value={ingredient.stockItemId ?? (nameMatchedStock?.id ?? "")}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) {
                  onChange({ stockItemId: undefined });
                } else {
                  const s = stock.find((x) => x.id === id);
                  onChange({ stockItemId: id, ...(s ? { unit: s.unit } : {}) });
                }
              }}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs"
            >
              <option value="">— Pilih stok (pilihan) —</option>
              {stock.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {noStockLink && (
              <p className="text-[10px] text-warn mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Tiada stok berkaitan — susutan tidak akan dikira semasa log masakan.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Input
            type="text"
            inputMode="decimal"
            value={qtyDraft}
            placeholder={t("ingredientQty")}
            className="h-11 rounded-xl"
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
                setQtyDraft(raw);
                const parsed = parseFloat(raw);
                if (!isNaN(parsed) && parsed >= 0) {
                  onChange({ quantity: parsed, manualCost: false });
                } else if (raw === "" || raw === "0.") {
                  onChange({ quantity: 0, manualCost: false });
                }
              }
            }}
            onBlur={() => {
              const parsed = parseFloat(qtyDraft);
              if (isNaN(parsed) || parsed < 0) {
                setQtyDraft("");
                onChange({ quantity: 0, manualCost: false });
              } else {
                setQtyDraft(String(parsed));
              }
            }}
          />
          {customUnitMode ? (
            <Input
              autoFocus
              value={customUnitDraft}
              onChange={(e) => setCustomUnitDraft(e.target.value)}
              onBlur={() => {
                const v = customUnitDraft.trim();
                if (!v) {
                  setCustomUnitMode(false);
                  onChange({ unit: "unit" as Unit, manualCost: false });
                } else {
                  onChange({ unit: v as unknown as Unit, manualCost: false });
                }
              }}
              placeholder="cth: periuk, talam, baldi"
              className="h-11 rounded-xl"
            />
          ) : (
            <select
              value={isStandardUnit ? (ingredient.unit as string) : "__custom__"}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__custom__") {
                  setCustomUnitMode(true);
                  setCustomUnitDraft("");
                } else {
                  onChange({ unit: v as Unit, manualCost: false });
                }
              }}
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
            >
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              <option value="__custom__">✏️ Lain-lain (taip sendiri)</option>
            </select>
          )}
        </div>

        {/* Always-visible AI estimate + manual cost block */}
        <div className="rounded-xl p-3 space-y-2 border-l-4 border-amber-500 bg-amber-100 dark:bg-warn/10 dark:border-warn">
          <div className="flex items-center justify-between gap-2 text-[12px] font-semibold text-amber-700 dark:text-warn-foreground">
            <span className="flex items-center gap-1.5">
              {estimating ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> AI sedang anggar…</>
              ) : aiSuggested !== null ? (
                <>🤖 Cadangan AI: <span className="font-extrabold">{fmt(aiSuggested)}</span></>
              ) : (
                <>🤖 Anggaran AI akan muncul selepas isi nama & kuantiti</>
              )}
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-foreground/80 mb-1">
              Harga bahan anda (RM)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none">RM</span>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={costDraft}
                placeholder={aiSuggested !== null ? aiSuggested.toFixed(2) : "0.00"}
                onFocus={(e) => e.target.select()}
                onChange={(e) => { setCostDraft(e.target.value); setUserHasEdited(true); }}
                onBlur={commitCostEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className={`h-11 rounded-xl pl-10 text-base font-bold border-2 ${
                  isConfirmed ? "border-green-500" : "border-amber-400"
                }`}
              />
            </div>
          </div>

          {hasAnyCost && (
            isConfirmed ? (
              <div className="rounded-full bg-green-200 text-green-800 dark:bg-profit/15 dark:text-profit border border-green-500 dark:border-profit/30 px-2.5 py-1 text-[11px] font-bold inline-flex items-center gap-1">
                ✓ Disahkan
              </div>
            ) : (
              <div className="rounded-full bg-amber-200 text-amber-800 dark:bg-warn/20 dark:text-warn-foreground border border-amber-500 dark:border-warn/40 px-2.5 py-1 text-[11px] font-bold inline-flex items-center gap-1">
                ⚠️ Belum disahkan — sila semak harga sebenar
              </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="text-[11px] font-bold text-muted-foreground mb-1.5 ml-1">{label}</div>
    {children}
  </div>
);
