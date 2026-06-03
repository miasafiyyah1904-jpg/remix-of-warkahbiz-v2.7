import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Check, Camera, Upload, Loader2 } from "lucide-react";
import type { Unit, ReceiptItem } from "@/types";
import { scanReceipt } from "@/lib/scanReceipt.functions";
import { useTranslation } from "@/context/LanguageContext";

type Phase = "pick" | "preview" | "scanning" | "result" | "error";
type Classification = "business" | "personal";

const KNOWN_UNITS: Unit[] = ["kg", "g", "liter", "ml", "biji", "pek", "kotak", "batang", "helai", "tong", "papan", "kampit", "ekor", "unit", "pcs", "box", "pack", "dozen"];
const normalizeUnit = (u: string): Unit => {
  const v = (u || "").toLowerCase().trim() as Unit;
  return KNOWN_UNITS.includes(v) ? v : "unit";
};

// Keywords that strongly suggest a personal (non-business) purchase.
const PERSONAL_KEYWORDS = [
  // toiletries
  "shampoo", "syampu", "conditioner", "sabun mandi", "body wash", "shower gel",
  "toothpaste", "ubat gigi", "toothbrush", "berus gigi", "mouthwash",
  "deodorant", "perfume", "minyak wangi", "lotion", "moisturizer",
  "pad", "tampon", "pampers", "diaper", "lampin",
  "razor", "shaver", "pencukur", "tisu muka", "facial tissue",
  // clothing / personal apparel
  "baju", "seluar", "kemeja", "shirt", "tshirt", "t-shirt", "jeans",
  "tudung", "scarf", "kasut", "shoe", "shoes", "sandal", "selipar",
  "stoking", "socks", "underwear", "bra", "panties",
  // personal grooming / cosmetics
  "lipstik", "lipstick", "mascara", "foundation", "bedak", "makeup",
  "skincare", "serum", "cream muka",
];

const fileToDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(new Error("read_failed"));
    r.readAsDataURL(f);
  });

const MONEY_TOLERANCE = 0.10;

const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;
const sumReceiptItems = (list: ReceiptItem[]) => roundMoney(list.reduce((sum, item) => sum + item.price, 0));

const distributeIncludedTax = (list: ReceiptItem[], amount: number): ReceiptItem[] => {
  const centsToAdd = Math.round(amount * 100);
  if (!list.length || centsToAdd <= 0) return list;

  const baseCents = list.map((item) => Math.round(item.price * 100));
  const totalCents = baseCents.reduce((sum, cents) => sum + Math.max(cents, 0), 0);
  const weighted = list.map((_, idx) => {
    const weight = totalCents > 0 ? Math.max(baseCents[idx], 0) / totalCents : 1 / list.length;
    const exact = weight * centsToAdd;
    return { idx, cents: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let allocated = weighted.reduce((sum, item) => sum + item.cents, 0);
  weighted.sort((a, b) => b.fraction - a.fraction).forEach((item) => {
    if (allocated < centsToAdd) {
      item.cents += 1;
      allocated += 1;
    }
  });

  const addByIndex = new Map(weighted.map((item) => [item.idx, item.cents]));
  return list.map((item, idx) => ({ ...item, price: roundMoney(item.price + (addByIndex.get(idx) || 0) / 100) }));
};

const suggestClassification = (name: string, knownSet: Set<string>): Classification => {
  const n = (name || "").toLowerCase().trim();
  if (!n) return "business";
  if (knownSet.has(n)) return "business";
  for (const k of knownSet) {
    if (k && (n.includes(k) || k.includes(n))) return "business";
  }
  for (const kw of PERSONAL_KEYWORDS) {
    if (n.includes(kw)) return "personal";
  }
  return "business";
};

export const ReceiptScanner = ({ onClose, onConfirm, knownIngredients = [] }: {
  onClose: () => void;
  onConfirm: (stockItems: ReceiptItem[], personalItems: ReceiptItem[]) => void;
  knownIngredients?: string[];
}) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("pick");
  const [classifyMap, setClassifyMap] = useState<Record<number, Classification>>({});
  const [imageUrl, setImageUrl] = useState<string>("");
  const [vendor, setVendor] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [tax, setTax] = useState<number>(0);
  const [receiptTotal, setReceiptTotal] = useState<number>(0);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [errMsg, setErrMsg] = useState<string>("");
  const [mismatchWarn, setMismatchWarn] = useState<null | { sum: number; receipt: number; diff: number }>(null);
  const [includedTaxAdjustment, setIncludedTaxAdjustment] = useState<null | { amount: number; rawSum: number; adjustedSum: number }>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const knownSet = useMemo(
    () => new Set(knownIngredients.map((n) => n.toLowerCase().trim()).filter(Boolean)),
    [knownIngredients],
  );

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-pick same file
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error(t("rs_pick_image"));
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error(t("rs_image_too_large"));
      return;
    }
    try {
      const url = await fileToDataUrl(f);
      setImageUrl(url);
      setPhase("preview");
    } catch {
      toast.error(t("rs_read_failed"));
    }
  };

  const doScan = async () => {
    if (!imageUrl) return;
    setPhase("scanning");
    setMismatchWarn(null);
    setIncludedTaxAdjustment(null);
    try {
      const result = await scanReceipt({ data: { imageBase64: imageUrl, mimeType: "image/jpeg", knownIngredients } });
      if (!result.ok) {
        setErrMsg(result.message || t("rs_scan_failed"));
        setPhase("error");
        return;
      }
      const rawParsed: ReceiptItem[] = (result.items || []).map((i: { emoji?: string; name?: string; qty?: number; unit?: string; price?: number }) => ({
        emoji: i.emoji || "🛒",
        name: i.name || "Item",
        qty: Number(i.qty) || 1,
        unit: normalizeUnit(i.unit || "unit"),
        price: roundMoney(Number(i.price) || 0),
      }));
      const printedTotal = roundMoney(result.total || 0);
      const printedTax = roundMoney(result.tax || 0);
      const rawSum = sumReceiptItems(rawParsed);
      const missingIncludedTax = printedTotal > 0 && printedTax > 0 && Math.abs(roundMoney(rawSum + printedTax - printedTotal)) <= MONEY_TOLERANCE && Math.abs(rawSum - printedTotal) > MONEY_TOLERANCE;
      const parsed = missingIncludedTax ? distributeIncludedTax(rawParsed, printedTax) : rawParsed;
      if (parsed.length === 0) {
        setErrMsg(t("rs_no_items_found"));
        setPhase("error");
        return;
      }
      setVendor(result.vendor);
      setDate(result.date);
      setTax(printedTax);
      setReceiptTotal(printedTotal);
      setItems(parsed);

      // Auto-suggest classification per item.
      const initMap: Record<number, Classification> = {};
      parsed.forEach((it, idx) => {
        initMap[idx] = suggestClassification(it.name, knownSet);
      });
      setClassifyMap(initMap);

      if (missingIncludedTax) {
        setIncludedTaxAdjustment({ amount: printedTax, rawSum, adjustedSum: sumReceiptItems(parsed) });
      }

      const sum = sumReceiptItems(parsed);
      const diff = Math.abs(roundMoney(sum - printedTotal));
      if (printedTotal > 0 && diff > MONEY_TOLERANCE) {
        setMismatchWarn({ sum, receipt: printedTotal, diff });
      }
      setPhase("result");
    } catch (e) {
      console.error(e);
      setErrMsg(t("rs_connection_error"));
      setPhase("error");
    }
  };

  const itemsTotal = sumReceiptItems(items);

  const businessItems = items.filter((_, i) => (classifyMap[i] ?? "business") === "business");
  const personalItems = items.filter((_, i) => (classifyMap[i] ?? "business") === "personal");
  const businessTotal = sumReceiptItems(businessItems);
  const personalTotal = sumReceiptItems(personalItems);

  const handleConfirm = () => {
    if (businessItems.length === 0) {
      toast.error(t("rs_no_business_items"));
      return;
    }
    // Personal items are discarded — not saved anywhere.
    onConfirm(businessItems, []);
    toast.success(
      t("rs_saved_business").replace("{n}", String(businessItems.length))
        + (personalItems.length > 0
          ? " · " + t("rs_discarded_personal").replace("{n}", String(personalItems.length))
          : ""),
    );
  };

  return (
    <div className="absolute inset-0 z-50 bg-background flex flex-col animate-fade-in">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-extrabold">{t("rs_title")}</h3>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-surface-elevated grid place-items-center tap">
          <X className="w-5 h-5" />
        </button>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {phase === "pick" && (
        <div className="flex-1 grid place-items-center p-6">
          <div className="w-full max-w-xs space-y-3">
            <div className="text-center text-sm text-muted-foreground mb-4">
              {t("rs_pick_prompt")}
            </div>
            <button
              onClick={() => cameraRef.current?.click()}
              className="w-full h-14 rounded-2xl bg-gradient-profit text-profit-foreground font-bold flex items-center justify-center gap-2 tap shadow-card"
            >
              <Camera className="w-5 h-5" /> {t("rs_take_photo")}
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              className="w-full h-14 rounded-2xl bg-surface-elevated border border-border font-bold flex items-center justify-center gap-2 tap"
            >
              <Upload className="w-5 h-5" /> {t("rs_pick_gallery")}
            </button>
          </div>
        </div>
      )}

      {phase === "preview" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="rounded-2xl overflow-hidden bg-surface border border-border">
            <img src={imageUrl} alt="Receipt preview" className="w-full max-h-[60vh] object-contain" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setImageUrl(""); setPhase("pick"); }} className="h-12 rounded-2xl bg-surface-elevated border border-border font-bold tap">
              {t("rs_change_image")}
            </button>
            <button onClick={doScan} className="h-12 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap shadow-card">
              {t("rs_scan_button")}
            </button>
          </div>
        </div>
      )}

      {phase === "scanning" && (
        <div className="flex-1 grid place-items-center p-6">
          <div className="relative w-full aspect-[3/4] max-w-xs rounded-3xl bg-black/60 border-2 border-dashed border-warn/50 grid place-items-center overflow-hidden">
            {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />}
            <span className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-warn rounded-tl-lg" />
            <span className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-warn rounded-tr-lg" />
            <span className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-warn rounded-bl-lg" />
            <span className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-warn rounded-br-lg" />
            <div className="absolute inset-x-0 h-0.5 bg-warn animate-pulse" style={{ top: "50%" }} />
            <div className="relative flex flex-col items-center gap-2 text-warn font-bold text-sm">
              <Loader2 className="w-6 h-6 animate-spin" />
              {t("rs_scanning")}
            </div>
          </div>
        </div>
      )}

      {phase === "result" && (
        <div className="flex-1 overflow-y-auto p-4 pb-40 space-y-4 no-scrollbar">
          <div className="rounded-2xl bg-surface border border-profit/30 p-4 animate-pop-in">
            <div className="text-profit font-bold text-sm flex items-center gap-2">
              <Check className="w-4 h-4" /> {t("rs_found")}
            </div>
            {(vendor || date) && (
              <div className="mt-2 text-sm">
                {vendor && <div><span className="text-muted-foreground">{t("rs_vendor")}:</span> <span className="font-semibold">{vendor}</span></div>}
                {date && <div><span className="text-muted-foreground">{t("rs_date")}:</span> <span className="font-semibold">{date}</span></div>}
              </div>
            )}

            <div className="mt-3 border-t border-border pt-3 space-y-2">
              {items.map((it, idx) => {
                const choice = classifyMap[idx] ?? "business";
                return (
                  <div key={idx} className="rounded-xl bg-surface-elevated/60 border border-border p-2 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-xl">{it.emoji}</span>
                      <span className="flex-1 font-semibold truncate">{it.name}</span>
                      <span className="text-muted-foreground text-xs">{it.qty} {it.unit}</span>
                      <span className="font-bold w-20 text-right">RM {it.price.toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => setClassifyMap((m) => ({ ...m, [idx]: "business" }))}
                        className={`h-9 rounded-lg text-xs font-bold tap border ${choice === "business" ? "bg-profit text-profit-foreground border-profit" : "bg-surface border-border text-muted-foreground"}`}
                      >
                        {t("rs_business")}
                      </button>
                      <button
                        onClick={() => setClassifyMap((m) => ({ ...m, [idx]: "personal" }))}
                        className={`h-9 rounded-lg text-xs font-bold tap border ${choice === "personal" ? "bg-cost text-white border-cost" : "bg-surface border-border text-muted-foreground"}`}
                      >
                        {t("rs_personal")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 border-t border-border pt-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("rs_items_total")}</span>
                <span className="font-semibold">RM {itemsTotal.toFixed(2)}</span>
              </div>
              {tax > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("rs_tax_included")}</span>
                  <span className="font-semibold">RM {tax.toFixed(2)}</span>
                </div>
              )}
              {includedTaxAdjustment && (
                <div className="rounded-xl bg-profit/10 border border-profit/30 p-2 text-xs leading-relaxed">
                  {t("rs_tax_adjusted")
                    .replace("{raw}", includedTaxAdjustment.rawSum.toFixed(2))
                    .replace("{adj}", includedTaxAdjustment.adjustedSum.toFixed(2))}
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="font-bold uppercase text-xs tracking-wider">{t("rs_receipt_total")}</span>
                <span className="font-extrabold text-cost text-lg">RM {(receiptTotal > 0 ? receiptTotal : itemsTotal).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {mismatchWarn && (
            <div className="rounded-2xl bg-warn-soft border border-warn/40 p-4 space-y-3 animate-pop-in">
              <div className="flex items-start gap-2">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <div className="font-extrabold text-sm text-warn-foreground">
                    {t("rs_mismatch_title")}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {t("rs_mismatch_desc")
                      .replace("{sum}", mismatchWarn.sum.toFixed(2))
                      .replace("{receipt}", mismatchWarn.receipt.toFixed(2))
                      .replace("{diff}", mismatchWarn.diff.toFixed(2))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMismatchWarn(null)}
                  className="h-10 rounded-xl bg-surface border border-border text-xs font-bold tap"
                >
                  {t("rs_ignore")}
                </button>
                <button
                  onClick={doScan}
                  className="h-10 rounded-xl bg-warn text-warn-foreground text-xs font-bold tap"
                >
                  {t("rs_rescan")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "result" && (
        <div className="absolute bottom-0 inset-x-0 border-t border-border bg-surface/95 backdrop-blur p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-profit/10 border border-profit/30 p-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{t("rs_footer_business")}</div>
              <div className="font-extrabold text-profit text-base">RM {businessTotal.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground">{businessItems.length} {t("rs_items")}</div>
            </div>
            <div className="rounded-xl bg-cost/10 border border-cost/30 p-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{t("rs_footer_personal")}</div>
              <div className="font-extrabold text-cost text-base">RM {personalTotal.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground">{personalItems.length} {t("rs_items")}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setPhase("pick"); setImageUrl(""); setItems([]); setClassifyMap({}); setMismatchWarn(null); }}
              className="h-11 rounded-2xl bg-surface-elevated border border-border font-bold tap text-sm"
            >
              {t("rs_scan_another")}
            </button>
            <button
              onClick={handleConfirm}
              className="h-11 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap shadow-card text-sm"
            >
              {t("rs_save_business_btn")}
            </button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="flex-1 grid place-items-center p-6">
          <div className="text-center space-y-4 max-w-xs">
            <div className="text-4xl">⚠️</div>
            <div className="font-bold">{errMsg}</div>
            <button onClick={() => setPhase(imageUrl ? "preview" : "pick")} className="h-12 px-6 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap shadow-card">
              {t("rs_try_again")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
