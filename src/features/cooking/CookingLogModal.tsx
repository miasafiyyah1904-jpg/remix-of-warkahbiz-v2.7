import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChefHat, Minus, Plus, X, AlertTriangle, ChevronDown, ChevronUp, Pencil, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fmtQty } from "@/lib/format";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { Product, StockItem, CookingLog, CookingPreset, FinishedStock } from "@/types";
import { useTranslation } from "@/context/LanguageContext";

const DEFAULT_PRESETS: CookingPreset[] = [
  { id: "preset-1", name: "Hari Biasa", values: {} },
  { id: "preset-2", name: "Hari Sibuk", values: {} },
  { id: "preset-3", name: "Separuh", values: {} },
];

export const CookingLogModal = ({
  open,
  products,
  stock,
  cookingLog,
  finishedStock,
  onClose,
  onConfirm,
}: {
  open: boolean;
  products: Product[];
  stock: StockItem[];
  cookingLog: CookingLog[];
  finishedStock: FinishedStock[];
  onClose: () => void;
  onConfirm: (entries: { productId: string; batches: number }[]) => void;
}) => {
  const { t } = useTranslation();
  // Build last-known batches per product from history (most recent log per product)
  const lastBatches = useMemo(() => {
    const map: Record<string, number> = {};
    [...cookingLog].sort((a, b) => b.ts - a.ts).forEach((l) => {
      if (map[l.productId] === undefined) map[l.productId] = l.batches;
    });
    return map;
  }, [cookingLog]);

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [presets, setPresets] = useLocalStorage<CookingPreset[]>("warkahbiz_cooking_presets", DEFAULT_PRESETS);
  const [editingPreset, setEditingPreset] = useState<string | null>(null);

  // Initialize / refresh counts when opening
  useEffect(() => {
    if (!open) return;
    const initial: Record<string, number> = {};
    products.forEach((p) => {
      initial[p.id] = lastBatches[p.id] ?? 0;
    });
    setCounts(initial);
    setReviewOpen(false);
    setEditingPreset(null);
  }, [open, products, lastBatches]);

  const setCount = (id: string, v: number) =>
    setCounts((c) => ({ ...c, [id]: Math.max(0, v) }));

  const applyPreset = (preset: CookingPreset) => {
    const next: Record<string, number> = { ...counts };
    products.forEach((p) => {
      next[p.id] = preset.values[p.id] ?? 0;
    });
    setCounts(next);
    toast.success(`Preset "${preset.name}" digunakan`);
  };

  const savePreset = (presetId: string) => {
    setPresets((prev) => prev.map((p) => p.id === presetId ? { ...p, values: { ...counts } } : p));
    setEditingPreset(null);
    toast.success("Preset disimpan ✅");
  };

  // Aggregate ingredient deductions across all products
  const aggregated = useMemo(() => {
    const map = new Map<string, { name: string; unit: string; needed: number; available: number; hasStock: boolean }>();
    products.forEach((p) => {
      const batches = counts[p.id] ?? 0;
      if (batches <= 0) return;
      (p.ingredients ?? []).forEach((ing) => {
        const key = ing.name.trim().toLowerCase();
        if (!key) return;
        const need = +(ing.quantity * batches).toFixed(2);
        const existing = map.get(key);
        if (existing) {
          existing.needed = +(existing.needed + need).toFixed(2);
        } else {
          const s = ing.stockItemId
            ? stock.find((x) => x.id === ing.stockItemId)
            : stock.find((x) => x.name.trim().toLowerCase() === key);
          map.set(key, {
            name: ing.name,
            unit: ing.unit,
            needed: need,
            available: s?.qty ?? 0,
            hasStock: !!s,
          });
        }
      });
    });
    return Array.from(map.values()).map((d) => ({
      ...d,
      shortfall: Math.max(0, +(d.needed - d.available).toFixed(2)),
    }));
  }, [products, counts, stock]);

  const hasAnyToLog = Object.values(counts).some((v) => v > 0);
  const hasShortfall = aggregated.some((d) => d.shortfall > 0 || !d.hasStock);

  const handleConfirm = () => {
    const entries = products
      .map((p) => ({ productId: p.id, batches: counts[p.id] ?? 0 }))
      .filter((e) => e.batches > 0);
    if (entries.length === 0) {
      toast.error("Sila masukkan sekurang-kurangnya 1 produk");
      return;
    }
    onConfirm(entries);
    const totalBatches = entries.reduce((s, e) => s + e.batches, 0);
    toast.success(`✅ ${entries.length} produk (${totalBatches} unit) direkodkan — stok dikemaskini`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[520px] p-0 gap-0 max-h-[92vh] flex flex-col rounded-3xl overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-base font-extrabold flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-primary" />
            Log Masakan Hari Ini
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Berapa banyak setiap produk dimasak hari ini? Stok akan ditolak otomatik.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {products.length === 0 ? (
            <div className="rounded-2xl bg-muted/40 border border-border p-6 text-center">
              <div className="text-3xl mb-2">🍽️</div>
              <p className="text-xs text-muted-foreground">
                Tiada produk lagi. Sila tambah produk dalam Profil → Produk Saya.
              </p>
            </div>
          ) : (
            <>
              {/* Preset buttons */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Preset Pantas
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {presets.map((preset) => (
                    <div key={preset.id} className="relative">
                      <button
                        onClick={() => applyPreset(preset)}
                        className="w-full rounded-2xl border border-border bg-surface p-2 tap text-center hover:border-primary/40 transition-colors"
                      >
                        <div className="text-[11px] font-bold truncate">{preset.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {Object.values(preset.values).filter((v) => v > 0).length || 0} produk
                        </div>
                      </button>
                      <button
                        onClick={() => editingPreset === preset.id ? savePreset(preset.id) : setEditingPreset(preset.id)}
                        className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-background border border-border grid place-items-center tap shadow-sm"
                        aria-label="Edit preset"
                      >
                        {editingPreset === preset.id
                          ? <Check className="w-3 h-3 text-profit" />
                          : <Pencil className="w-3 h-3 text-muted-foreground" />}
                      </button>
                    </div>
                  ))}
                </div>
                {editingPreset && (
                  <p className="text-[10px] text-primary mt-1.5 font-semibold">
                    Laraskan kiraan di bawah, kemudian tap ✓ untuk simpan preset.
                  </p>
                )}
              </div>

              {/* Product list */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Produk yang dimasak
                </div>
                {products.map((p) => {
                  const batches = counts[p.id] ?? 0;
                  const cookUnit = p.cookingUnit || p.batchUnit || "batch";
                  const servings = p.servingsPerCookingUnit ?? p.batchSize ?? 0;
                  const totalServings = servings > 0 ? batches * servings : 0;
                  const last = lastBatches[p.id];
                  return (
                    <div key={p.id} className={`rounded-2xl border-2 p-3 transition-colors ${
                      batches > 0 ? "border-primary/40 bg-primary/5" : "border-border bg-surface"
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="text-2xl shrink-0">{p.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            unit memasak: {cookUnit}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => setCount(p.id, batches - 1)}
                            className="w-9 h-9 rounded-xl bg-background border border-border grid place-items-center tap"
                            aria-label="Kurang"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <div className="min-w-[44px] text-center">
                            <div className="text-xl font-extrabold tabular-nums leading-none">{batches}</div>
                            <div className="text-[9px] text-muted-foreground mt-0.5 truncate">{cookUnit}</div>
                          </div>
                          <button
                            onClick={() => setCount(p.id, batches + 1)}
                            className="w-9 h-9 rounded-xl bg-primary text-primary-foreground grid place-items-center tap"
                            aria-label="Tambah"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">
                          {last !== undefined ? `Log lepas: ${last} ${cookUnit}` : "Belum ada log"}
                        </span>
                        {batches > 0 && servings > 0 && (
                          <span className="font-semibold text-primary">
                            = {totalServings} {p.batchUnit ?? "pcs"} {p.name}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Collapsible review */}
              <div className="rounded-2xl border border-border bg-surface overflow-hidden">
                <button
                  onClick={() => setReviewOpen((v) => !v)}
                  className="w-full px-4 py-3 flex items-center justify-between tap"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">Semak Bahan</span>
                    {hasAnyToLog && hasShortfall && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cost/15 text-cost">
                        ada kurang
                      </span>
                    )}
                    {hasAnyToLog && !hasShortfall && aggregated.length > 0 && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-profit/15 text-profit">
                        cukup
                      </span>
                    )}
                  </div>
                  {reviewOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {reviewOpen && (
                  <div className="border-t border-border p-3">
                    {aggregated.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground text-center py-2">
                        Tiada bahan untuk ditolak. Tambah kuantiti pada produk di atas.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {aggregated.map((d, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex-1 min-w-0 truncate font-semibold">{d.name}</div>
                            <div className="text-muted-foreground shrink-0">{fmtQty(d.needed, d.unit as never)}</div>
                            {!d.hasStock ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warn/15 text-warn shrink-0">
                                tiada stok
                              </span>
                            ) : d.shortfall > 0 ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cost/15 text-cost shrink-0">
                                kurang {d.shortfall}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-profit/15 text-profit shrink-0">
                                cukup
                              </span>
                            )}
                          </div>
                        ))}
                        {hasShortfall && (
                          <div className="mt-2 rounded-xl bg-warn-soft border border-warn/30 p-2.5 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
                            <p className="text-[11px] text-warn-foreground/90 leading-snug">
                              Sebahagian bahan tidak mencukupi. Stok akan turun ke 0 untuk item kurang.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-border px-5 py-3 flex items-center justify-between gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-2xl">
            <X className="w-4 h-4" /> Batal
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!hasAnyToLog}
            className="rounded-2xl bg-gradient-profit text-profit-foreground"
          >
            Simpan & Tolak Stok
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
