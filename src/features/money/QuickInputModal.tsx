import { useMemo, useRef, useState } from "react";
import { X, Check, Delete, Camera, Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { Txn, TxnType, ReceiptItem, Product, Unit, TxnCategory } from "@/types";
import { TXN_CATEGORIES, defaultTxnCategory } from "@/types";
import { ReceiptScanner } from "@/features/inventory/ReceiptScanner";
import { emojiForItem } from "@/lib/stockEmoji";
import { useTranslation } from "@/context/LanguageContext";


const ALLOWED_UNITS: Unit[] = [
  "ekor", "kotak", "kg", "gram", "paket", "liter", "botol",
  "biji", "ikat", "tin", "bungkus", "sudu", "cawan",
];
const CUSTOM_UNIT_KEY = "__custom__";

type PurchaseLine = { name: string; qty: number; unit: string; amount: number };
type Step = "name" | "qty" | "amount";
type OutMode = "choose" | "manual";

export const QuickInputModal = ({ onClose, onSave, onUpdate, onReceiptConfirm, onBoughtItems, products, editingTxn }: {
  onClose: () => void;
  onSave: (t: Omit<Txn, "id" | "ts" | "time">) => void;
  onUpdate?: (t: Txn) => void;
  onReceiptConfirm?: (items: ReceiptItem[]) => void;
  onBoughtItems?: (items: Array<{ name: string; qty: number; unit: string; isOpEx: boolean }>) => void;
  products: Product[];
  editingTxn?: Txn | null;
}) => {
  const { t } = useTranslation();

  const incomeSuggestions = [
    t("qim_jualan_pagi"),
    t("qim_jualan_petang"),
    t("qim_penghantaran"),
  ];

  const isEditing = !!editingTxn;

  const [mode, setMode] = useState<TxnType>(editingTxn?.type ?? "in");
  const [amount, setAmount] = useState(editingTxn ? String(editingTxn.amount) : "0"); // for income & edit
  const [note, setNote] = useState(editingTxn?.notes ?? "");
  const [categoryIn, setCategoryIn] = useState<TxnCategory>(
    editingTxn?.type === "in" ? (editingTxn.category ?? defaultTxnCategory("in")) : defaultTxnCategory("in"),
  );
  const [categoryOut, setCategoryOut] = useState<TxnCategory>(
    editingTxn?.type === "out" ? (editingTxn.category ?? defaultTxnCategory("out")) : defaultTxnCategory("out"),
  );
  const [outNote, setOutNote] = useState("");
  const [success, setSuccess] = useState(false);
  const [scanner, setScanner] = useState(false);

  // POS income mode
  type InMode = "pick" | "manual" | "pos";
  const [inMode, setInMode] = useState<InMode>(
    !isEditing && (products?.length ?? 0) > 0 ? "pick" : "manual"
  );
  const [cart, setCart] = useState<Record<string, number>>({});
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const priceOf = (p: Product) => p.suggestedPrice ?? p.sellingPrice ?? 0;
  const cartUnits = Object.values(cart).reduce((s, q) => s + q, 0);
  const cartTotal = Object.entries(cart).reduce((s, [pid, q]) => {
    const p = products.find(x => x.id === pid);
    return s + (p ? priceOf(p) : 0) * q;
  }, 0);

  const incrementProduct = (p: Product) => {
    if (priceOf(p) <= 0) {
      toast.error(t("pos_no_price_toast"));
      return;
    }
    setCart(prev => ({ ...prev, [p.id]: (prev[p.id] ?? 0) + 1 }));
  };
  const decrementProduct = (p: Product) => {
    setCart(prev => {
      const cur = prev[p.id] ?? 0;
      if (cur <= 0) return prev;
      const next = { ...prev };
      if (cur - 1 <= 0) delete next[p.id];
      else next[p.id] = cur - 1;
      toast(t("pos_decrement_toast").replace("{name}", p.name));
      return next;
    });
  };

  const handleSavePOS = () => {
    const entries = Object.entries(cart).filter(([, qty]) => qty > 0);
    if (entries.length === 0) return;
    const total = entries.reduce((sum, [productId, qty]) => {
      const p = products.find(x => x.id === productId);
      const price = p?.suggestedPrice ?? p?.sellingPrice ?? 0;
      return sum + price * qty;
    }, 0);
    if (total <= 0) return;
    const label = entries.map(([productId, qty]) => {
      const p = products.find(x => x.id === productId);
      return `${p?.name ?? productId}${qty > 1 ? ` ×${qty}` : ""}`;
    }).join(", ");
    setSuccess(true);
    setTimeout(() => {
      onSave({
        type: "in",
        emoji: "🛍️",
        label,
        amount: parseFloat(total.toFixed(2)),
        category: categoryIn,
        notes: note,
        soldItems: entries.map(([productId, qty]) => ({ productId, qty })),
      });
      onClose();
    }, 800);
  };

  // Multi-item purchase session
  const [items, setItems] = useState<PurchaseLine[]>([]);
  const [outMode, setOutMode] = useState<OutMode>("choose");
  const [step, setStep] = useState<Step>("name");
  const [draftAmount, setDraftAmount] = useState("0");

  const [draftName, setDraftName] = useState("");
  const [draftQty, setDraftQty] = useState("1");
  const [draftUnit, setDraftUnit] = useState<string>("kg");
  const [customUnit, setCustomUnit] = useState<string>("");
  const [confirming, setConfirming] = useState(false);

  // Unique ingredient list across all products
  const ingredientOptions = useMemo(() => {
    const seen = new Map<string, Unit>();
    products.forEach(p => (p.ingredients ?? []).forEach(ing => {
      const key = ing.name.trim();
      if (!key) return;
      if (!seen.has(key.toLowerCase())) seen.set(key.toLowerCase(), ing.unit);
    }));
    return Array.from(seen.entries()).map(([k, u]) => ({
      name: products.flatMap(p => p.ingredients ?? []).find(i => i.name.trim().toLowerCase() === k)?.name.trim() ?? k,
      unit: u,
    }));
  }, [products]);

  const hasProducts = true; // Allow purchases even without products (free-text)

  const press = (k: string, target: "income" | "draft") => {
    const setter = target === "income" ? setAmount : setDraftAmount;
    setter(prev => {
      if (k === "del") return prev.length <= 1 ? "0" : prev.slice(0, -1);
      if (k === ".") return prev.includes(".") ? prev : prev + ".";
      if (prev === "0") return k;
      return prev + k;
    });
  };

  const handleSaveIncome = () => {
    if (parseFloat(amount) <= 0) return;
    setSuccess(true);
    setTimeout(() => {
      onSave({ type: "in", emoji: "💰", label: note || categoryIn, amount: parseFloat(amount), category: categoryIn, notes: note });
      onClose();
    }, 800);
  };

  const handleSaveEdit = () => {
    if (!editingTxn || !onUpdate) return;
    const amt = parseFloat(amount);
    if (amt <= 0) return;
    setSuccess(true);
    setTimeout(() => {
      const cat = mode === "in" ? categoryIn : categoryOut;
      onUpdate({
        ...editingTxn,
        type: mode,
        amount: amt,
        category: cat,
        notes: note,
        label: note || editingTxn.label || cat,
      });
      onClose();
    }, 600);
  };


  // === Purchase flow handlers ===
  const resetDraft = () => {
    setStep("name");
    setDraftAmount("0");
    setDraftName("");
    setDraftQty("1");
    setDraftUnit(ingredientOptions[0]?.unit ?? "kg");
  };

  const commitDraft = () => {
    const amt = parseFloat(draftAmount) || 0;
    const qty = parseFloat(draftQty) || 0;
    if (!draftName || amt <= 0 || qty <= 0) return;
    setItems(prev => [...prev, { name: draftName, qty, unit: draftUnit, amount: amt }]);
    resetDraft();
    setConfirming(true);
  };

  const handleAddMore = () => {
    // From confirmation: go back to step 1 to add another item
    resetDraft();
    setConfirming(false);
  };

  const handleConfirmFinal = () => {
    if (items.length === 0) return;
    setSuccess(true);
    setTimeout(() => {
      items.forEach(it => {
        onSave({ type: "out", emoji: "🛒", label: `Beli ${it.name}`, amount: it.amount, category: categoryOut, notes: outNote });
      });
      if (onBoughtItems) {
        onBoughtItems(items.map(it => ({ name: it.name, qty: it.qty, unit: it.unit, isOpEx: false })));
      }
      onClose();
    }, 800);
  };

  // Receipt scan -> classify, then feed into confirmation screen
  const handleScannerConfirm = (scanned: ReceiptItem[], personal: ReceiptItem[] = []) => {
    if (personal.length > 0) {
      personal.forEach((p) => {
        onSave({ type: "out", emoji: "🧑", label: `Peribadi: ${p.name}`, amount: p.price || 0 });
      });
    }
    const mapped: PurchaseLine[] = scanned.map(s => ({
      name: s.name,
      qty: s.qty || 1,
      unit: (ALLOWED_UNITS.includes(s.unit as Unit) ? (s.unit as Unit) : "biji"),
      amount: s.price || 0,
    }));
    setItems(prev => [...prev, ...mapped]);
    setScanner(false);
    if (mapped.length > 0) setConfirming(true);
    else if (personal.length > 0) onClose();
  };

  const totalSpent = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[440px] h-[88vh] bg-surface rounded-t-[2.5rem] animate-slide-up flex flex-col"
      >
        <div className="pt-3 pb-1 grid place-items-center">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/40" />
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-elevated grid place-items-center tap z-10">
          <X className="w-5 h-5" />
        </button>

        {isEditing && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 mt-2">
              <div className="rounded-2xl p-1 bg-surface-elevated grid grid-cols-2 gap-1">
                <button
                  onClick={() => setMode("in")}
                  className={`py-3 rounded-xl font-bold text-sm tap ${mode === "in" ? "bg-gradient-profit text-profit-foreground shadow-card" : "text-muted-foreground"}`}
                >
                  {t("qim_dapat_duit")}
                </button>
                <button
                  onClick={() => setMode("out")}
                  className={`py-3 rounded-xl font-bold text-sm tap ${mode === "out" ? "bg-gradient-cost text-white shadow-card" : "text-muted-foreground"}`}
                >
                  {t("qim_pembelian")}
                </button>
              </div>
            </div>
            <div className="px-5 mt-4">
              <div className={`rounded-3xl p-5 text-center ${mode === "in" ? "bg-profit/10" : "bg-cost/10"}`}>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {mode === "in" ? t("qim_how_much_received") : t("qim_how_much_price")}
                </div>
                <div className={`text-5xl font-extrabold mt-2 ${mode === "in" ? "text-profit" : "text-cost"}`}>RM {amount}</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 mt-4 space-y-4 no-scrollbar">
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kategori</div>
                <div className="flex flex-wrap gap-2">
                  {TXN_CATEGORIES.map((c) => {
                    const sel = mode === "in" ? categoryIn === c : categoryOut === c;
                    return (
                      <button
                        key={c}
                        onClick={() => mode === "in" ? setCategoryIn(c) : setCategoryOut(c)}
                        className={`px-3 h-9 rounded-full text-xs font-semibold border tap ${sel ? "bg-primary text-primary-foreground border-primary" : "bg-surface-elevated border-border text-muted-foreground"}`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nota</div>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nota (pilihan)"
                  className="w-full h-12 px-4 rounded-2xl bg-surface-elevated border border-border text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="px-5 mt-3 grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9",".","0","del"].map(k => (
                <button key={k} onClick={() => press(k, "income")} className="h-12 rounded-2xl bg-surface-elevated text-xl font-bold tap grid place-items-center">
                  {k === "del" ? <Delete className="w-5 h-5" /> : k}
                </button>
              ))}
            </div>
            <div className="px-5 pt-3 pb-6">
              <button
                disabled={parseFloat(amount) <= 0}
                onClick={handleSaveEdit}
                className={`w-full h-14 rounded-2xl font-extrabold text-lg tap shadow-card transition-opacity ${mode === "in" ? "bg-gradient-profit text-profit-foreground" : "bg-gradient-cost text-white"} ${parseFloat(amount) <= 0 ? "opacity-50" : ""}`}
              >
                {t("save")}
              </button>
            </div>
          </div>
        )}

        {!isEditing && !confirming && inMode !== "pos" && (

          <div className="px-5 mt-2">
            <div className="rounded-2xl p-1 bg-surface-elevated grid grid-cols-2 gap-1">
              <button
                onClick={() => { setMode("in"); setInMode("pick"); setCart({}); }}
                className={`py-3 rounded-xl font-bold text-sm tap ${mode === "in" ? "bg-gradient-profit text-profit-foreground shadow-card" : "text-muted-foreground"}`}
              >
                {t("qim_dapat_duit")}
              </button>
              <button
                onClick={() => { setMode("out"); setOutMode("choose"); if (!draftUnit && ingredientOptions[0]) setDraftUnit(ingredientOptions[0].unit); }}
                className={`py-3 rounded-xl font-bold text-sm tap ${mode === "out" ? "bg-gradient-cost text-white shadow-card" : "text-muted-foreground"}`}
              >
                {t("qim_pembelian")}
              </button>
            </div>
          </div>
        )}

        {/* PURCHASE / OUT MODE */}
        {!isEditing && mode === "out" && !confirming && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {!hasProducts ? (
              <div className="flex-1 grid place-items-center px-6">
                <div className="text-center space-y-4 max-w-xs">
                  <div className="text-5xl">📋</div>
                  <p className="text-sm font-semibold">
                    {t("qim_no_products_msg")}
                  </p>
                  <button onClick={onClose} className="h-12 px-6 rounded-2xl bg-primary text-primary-foreground font-bold tap">
                    {t("qim_tutup")}
                  </button>
                </div>
              </div>
            ) : outMode === "choose" ? (
              // === SCANNER-FIRST CHOICE SCREEN ===
              <div className="flex-1 overflow-y-auto px-5 mt-6 space-y-5 pb-6 animate-fade-in">
                <button
                  onClick={() => setScanner(true)}
                  className="w-full rounded-3xl p-6 bg-gradient-profit text-profit-foreground tap shadow-glow flex flex-col items-center gap-3"
                >
                  <div className="w-16 h-16 rounded-2xl bg-white/20 grid place-items-center">
                    <Camera className="w-9 h-9" strokeWidth={2.4} />
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-extrabold">{t("qim_scan_receipt")}</div>
                    <div className="text-xs opacity-90 mt-1">{t("qim_scan_subtitle")}</div>
                  </div>
                </button>

                <div className="text-center">
                  <button
                    onClick={() => { resetDraft(); setOutMode("manual"); }}
                    className="text-sm font-semibold text-muted-foreground underline underline-offset-4 tap"
                  >
                    {t("qim_or_manual")}
                  </button>
                </div>

                {items.length > 0 && (
                  <div className="rounded-2xl bg-background border border-border p-3 space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("qim_items_in_session", { count: items.length })}
                    </div>
                    {items.map((it, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 font-semibold">{it.name}</span>
                        <span className="text-xs text-muted-foreground">{it.qty} {it.unit}</span>
                        <span className="font-bold w-16 text-right">RM {it.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => setConfirming(true)}
                      className="w-full h-11 rounded-2xl bg-gradient-cost text-white font-bold tap text-sm mt-2"
                    >
                      {t("qim_to_confirm")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // === MANUAL FLOW: name → qty → amount ===
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto px-5 mt-4 space-y-4 pb-4">
                  <button
                    onClick={() => setOutMode("choose")}
                    className="text-xs font-semibold text-muted-foreground tap flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" /> {t("qim_back_to_choice")}
                  </button>

                  {items.length > 0 && (
                    <div className="rounded-2xl bg-background border border-border p-3 space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {t("qim_items_in_session", { count: items.length })}
                      </div>
                      {items.map((it, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 font-semibold">{it.name}</span>
                          <span className="text-xs text-muted-foreground">{it.qty} {it.unit}</span>
                          <span className="font-bold w-16 text-right">RM {it.amount.toFixed(2)}</span>
                          <button
                            onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                            className="w-6 h-6 rounded-md bg-cost/10 text-cost grid place-items-center tap"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <div className="border-t border-border pt-2 flex justify-between text-sm">
                        <span className="font-bold text-muted-foreground">{t("total")}</span>
                        <span className="font-extrabold text-cost">RM {totalSpent.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl bg-background border-2 border-primary/20 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("qim_new_item")}
                      <span className="ml-auto text-[10px] normal-case font-semibold text-primary">
                        {t("qim_step_of", { step: step === "name" ? "1" : step === "qty" ? "2" : "3" })}
                      </span>
                    </div>

                    {step === "name" && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {t("qim_what_bought")}
                        </div>
                        <input
                          type="text"
                          list="quick-ingredient-suggestions"
                          value={draftName}
                          onChange={(e) => {
                            const name = e.target.value;
                            setDraftName(name);
                            const found = ingredientOptions.find(i => i.name.toLowerCase() === name.toLowerCase());
                            if (found) setDraftUnit(found.unit);
                          }}
                          placeholder={t("qim_search_or_type")}
                          className="w-full h-12 px-3 rounded-2xl bg-surface-elevated border border-border text-sm font-semibold focus:outline-none focus:border-primary"
                        />
                        <datalist id="quick-ingredient-suggestions">
                          {ingredientOptions.map(opt => (
                            <option key={opt.name} value={opt.name} />
                          ))}
                        </datalist>
                        {draftName && !ingredientOptions.some(i => i.name.toLowerCase() === draftName.toLowerCase()) && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 px-1">
                            <span className="text-base">{emojiForItem(draftName)}</span>
                            <span>{t("qim_new_item_emoji")}</span>
                          </div>
                        )}
                        <button
                          disabled={!draftName.trim()}
                          onClick={() => setStep("qty")}
                          className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold tap disabled:opacity-50"
                        >
                          {t("next")}
                        </button>
                      </div>
                    )}

                    {step === "qty" && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {t("qim_how_much_unit")}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={draftQty}
                            onChange={(e) => setDraftQty(e.target.value)}
                            className="h-12 px-3 rounded-2xl bg-surface-elevated border border-border text-base font-semibold focus:outline-none focus:border-primary"
                            placeholder={t("qty")}
                          />
                          {draftUnit === CUSTOM_UNIT_KEY ? (
                            <input
                              type="text"
                              autoFocus
                              value={customUnit}
                              onChange={(e) => setCustomUnit(e.target.value)}
                              onBlur={() => { if (!customUnit.trim()) setDraftUnit("kg"); else setDraftUnit(customUnit.trim()); }}
                              placeholder={t("qim_custom_unit_placeholder")}
                              className="h-12 px-3 rounded-2xl bg-surface-elevated border border-border text-sm font-semibold focus:outline-none focus:border-primary"
                            />
                          ) : (
                            <select
                              value={ALLOWED_UNITS.includes(draftUnit as Unit) ? draftUnit : CUSTOM_UNIT_KEY}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === CUSTOM_UNIT_KEY) { setDraftUnit(CUSTOM_UNIT_KEY); setCustomUnit(""); }
                                else setDraftUnit(v);
                              }}
                              className="h-12 px-3 rounded-2xl bg-surface-elevated border border-border text-sm font-semibold focus:outline-none focus:border-primary"
                            >
                              {ALLOWED_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                              <option value={CUSTOM_UNIT_KEY}>{t("qim_other_custom")}</option>
                            </select>
                          )}
                        </div>
                        <div className="rounded-xl bg-surface-elevated p-3 text-xs">
                          <div className="font-bold">{draftName}</div>
                          <div className="text-muted-foreground mt-0.5">
                            {draftQty} {draftUnit}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => setStep("name")} className="h-12 rounded-2xl bg-surface-elevated border border-border font-bold tap flex items-center justify-center gap-1">
                            <ArrowLeft className="w-4 h-4" /> {t("back")}
                          </button>
                          <button
                            disabled={parseFloat(draftQty) <= 0}
                            onClick={() => setStep("amount")}
                            className="h-12 rounded-2xl bg-primary text-primary-foreground font-bold tap disabled:opacity-50"
                          >
                            {t("next")}
                          </button>
                        </div>
                      </div>
                    )}

                    {step === "amount" && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {t("qim_how_much_price")}
                        </div>
                        <div className="rounded-2xl p-4 text-center bg-cost/10">
                          <div className="text-4xl font-extrabold text-cost">RM {draftAmount}</div>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {["1","2","3","4","5","6","7","8","9","0",".",".00","del","C",""].map((k, idx) => {
                            if (k === "") return <div key={idx} />;
                            return (
                              <button
                                key={k + idx}
                                onClick={() => {
                                  if (k === "C") { setDraftAmount("0"); return; }
                                  if (k === ".00") { setDraftAmount(p => p.includes(".") ? p : p + ".00"); return; }
                                  press(k, "draft");
                                }}
                                className="h-10 rounded-xl bg-surface-elevated text-base font-bold tap grid place-items-center"
                              >
                                {k === "del" ? <Delete className="w-4 h-4" /> : k}
                              </button>
                            );
                          })}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => setStep("qty")} className="h-12 rounded-2xl bg-surface-elevated border border-border font-bold tap flex items-center justify-center gap-1">
                            <ArrowLeft className="w-4 h-4" /> {t("back")}
                          </button>
                          <button
                            disabled={parseFloat(draftAmount) <= 0}
                            onClick={commitDraft}
                            className="h-12 rounded-2xl bg-primary text-primary-foreground font-bold tap disabled:opacity-50"
                          >
                            {t("next")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CONFIRMATION SCREEN */}
        {!isEditing && confirming && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <h2 className="text-xl font-extrabold">{t("qim_confirm_purchase")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t("qim_check_list")}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="rounded-2xl bg-background border border-border p-3 flex items-center gap-2">
                  <div className="flex-1">
                    <div className="font-bold text-sm">{it.name}</div>
                    <div className="text-xs text-muted-foreground">{it.qty} {it.unit} · RM {(it.amount / Math.max(it.qty, 1)).toFixed(2)} / {it.unit}</div>
                  </div>
                  <div className="font-extrabold text-cost">RM {it.amount.toFixed(2)}</div>
                  <button
                    onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                    className="w-7 h-7 rounded-md bg-cost/10 text-cost grid place-items-center tap"
                    aria-label={t("deleteBtn")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="rounded-2xl bg-surface-elevated border border-border p-3 space-y-3 mt-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Kategori</div>
                  <div className="flex flex-wrap gap-1.5">
                    {TXN_CATEGORIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCategoryOut(c)}
                        className={`px-2.5 h-8 rounded-full text-[11px] font-semibold border tap ${categoryOut === c ? "bg-primary text-primary-foreground border-primary" : "bg-surface border-border text-muted-foreground"}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  value={outNote}
                  onChange={(e) => setOutNote(e.target.value)}
                  placeholder="Nota (pilihan)"
                  className="w-full h-10 px-3 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div className="rounded-2xl bg-cost/10 border border-cost/30 p-4 flex items-center justify-between mt-3">
                <span className="font-bold uppercase tracking-wider text-xs">{t("qim_total_spent")}</span>
                <span className="font-extrabold text-cost text-xl">RM {totalSpent.toFixed(2)}</span>
              </div>
            </div>

            <div className="px-5 pt-3 pb-6 space-y-2 shrink-0">
              <button
                onClick={handleAddMore}
                className="w-full h-12 rounded-2xl bg-surface-elevated border-2 border-primary text-primary font-bold tap flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> {t("qim_add_more")}
              </button>
              <button
                onClick={handleConfirmFinal}
                disabled={items.length === 0}
                className="w-full h-14 rounded-2xl font-extrabold text-base tap shadow-card bg-gradient-profit text-profit-foreground disabled:opacity-50"
              >
                {t("qim_save_update_stock")}
              </button>
            </div>
          </div>
        )}

        {/* INCOME MODE - PICK */}
        {!isEditing && mode === "in" && !confirming && inMode === "pick" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-5 mt-6 space-y-4 pb-6 animate-fade-in">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">
                {t("pos_pick_heading")}
              </div>
              <button
                onClick={() => setInMode("pos")}
                className="w-full rounded-3xl p-5 bg-profit/10 border-2 border-profit/30 tap flex items-center gap-4 text-left"
              >
                <div className="w-14 h-14 rounded-2xl bg-profit/20 grid place-items-center text-3xl shrink-0">🛍️</div>
                <div className="flex-1">
                  <div className="text-base font-extrabold">{t("pos_card_product_title")}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t("pos_card_product_sub")}</div>
                </div>
              </button>
              <button
                onClick={() => setInMode("manual")}
                className="w-full rounded-3xl p-5 bg-surface-elevated border border-border tap flex items-center gap-4 text-left"
              >
                <div className="w-14 h-14 rounded-2xl bg-background grid place-items-center text-3xl shrink-0">🔢</div>
                <div className="flex-1">
                  <div className="text-base font-extrabold">{t("pos_card_manual_title")}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t("pos_card_manual_sub")}</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* INCOME MODE - POS GRID */}
        {!isEditing && mode === "in" && !confirming && inMode === "pos" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 mt-4 flex items-center gap-3">
              <button
                onClick={() => { setInMode("pick"); setCart({}); }}
                className="w-9 h-9 rounded-full bg-surface-elevated grid place-items-center tap"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="text-base font-extrabold">{t("pos_screen_title")}</div>
            </div>

            {cartUnits > 0 && (
              <div className="px-5 mt-3">
                <div className="rounded-2xl bg-profit/10 border border-profit/30 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm font-semibold">{t("pos_cart_items").replace("{n}", String(cartUnits))}</span>
                  <span className="text-base font-extrabold text-profit">RM {cartTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 mt-3 pb-4">
              <div className="grid grid-cols-2 gap-3">
                {products.map(p => {
                  const price = priceOf(p);
                  const qty = cart[p.id] ?? 0;
                  const hasPrice = price > 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { if (!longPressFired.current) incrementProduct(p); longPressFired.current = false; }}
                      onContextMenu={(e) => { e.preventDefault(); if (qty > 0) decrementProduct(p); }}
                      onPointerDown={() => {
                        longPressFired.current = false;
                        if (longPressTimer.current) clearTimeout(longPressTimer.current);
                        longPressTimer.current = setTimeout(() => {
                          longPressFired.current = true;
                          if ((cart[p.id] ?? 0) > 0) decrementProduct(p);
                        }, 500);
                      }}
                      onPointerUp={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                      onPointerLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                      className={`relative rounded-2xl p-3 bg-surface-elevated border-2 tap flex flex-col items-center gap-1 ${qty > 0 ? "border-profit" : "border-border"}`}
                    >
                      {qty > 0 && (
                        <span className="absolute top-1.5 right-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full bg-profit text-profit-foreground text-[11px] font-extrabold grid place-items-center">
                          {qty}
                        </span>
                      )}
                      <div className="text-3xl">{p.emoji || "🍽️"}</div>
                      <div className="text-xs font-bold text-center line-clamp-1 w-full">{p.name}</div>
                      <div className={`text-xs font-semibold ${hasPrice ? "text-profit" : "text-muted-foreground"}`}>
                        {hasPrice ? `RM ${price.toFixed(2)}` : t("pos_no_price")}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {cartUnits > 0 && (
              <div className="px-5 pt-3 pb-6 shrink-0">
                <button
                  onClick={handleSavePOS}
                  className="w-full h-14 rounded-2xl font-extrabold text-base tap shadow-card bg-gradient-profit text-profit-foreground"
                >
                  {t("pos_save_button").replace("{total}", cartTotal.toFixed(2))}
                </button>
              </div>
            )}
          </div>
        )}

        {/* INCOME MODE - MANUAL */}
        {!isEditing && mode === "in" && !confirming && inMode === "manual" && (
          <>
            {products.length > 0 && (
              <div className="px-5 mt-2">
                <button
                  onClick={() => setInMode("pick")}
                  className="text-xs font-semibold text-muted-foreground tap"
                >
                  {t("pos_back_to_pick")}
                </button>
              </div>
            )}
            <div className="px-5 mt-3">
              <div className="rounded-3xl p-5 text-center bg-profit/10">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("qim_how_much_received")}</div>
                <div className="text-5xl font-extrabold mt-2 text-profit">RM {amount}</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 mt-4 no-scrollbar">
              <div className="space-y-3">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("qim_what_sold")}
                  className="w-full h-12 px-4 rounded-2xl bg-surface-elevated border border-border text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary"
                />
                <div className="flex flex-wrap gap-2">
                  {incomeSuggestions.map(s => (
                    <button key={s} onClick={() => setNote(s)} className={`px-3 h-10 rounded-full text-sm font-semibold border tap ${note === s ? "bg-primary text-primary-foreground border-primary" : "bg-surface-elevated border-border text-muted-foreground"}`}>
                      {s}
                    </button>
                  ))}
                </div>
                <div className="space-y-2 pt-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kategori</div>
                  <div className="flex flex-wrap gap-2">
                    {TXN_CATEGORIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCategoryIn(c)}
                        className={`px-3 h-9 rounded-full text-xs font-semibold border tap ${categoryIn === c ? "bg-primary text-primary-foreground border-primary" : "bg-surface-elevated border-border text-muted-foreground"}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 mt-3 grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9",".","0","del"].map(k => (
                <button key={k} onClick={() => press(k, "income")} className="h-12 rounded-2xl bg-surface-elevated text-xl font-bold tap grid place-items-center">
                  {k === "del" ? <Delete className="w-5 h-5" /> : k}
                </button>
              ))}
            </div>
            <div className="px-5 pt-3 pb-6">
              <button
                disabled={parseFloat(amount) <= 0}
                onClick={handleSaveIncome}
                className={`w-full h-14 rounded-2xl font-extrabold text-lg tap shadow-card transition-opacity bg-gradient-profit text-profit-foreground ${parseFloat(amount) <= 0 ? "opacity-50" : ""}`}
              >
                {t("save")}
              </button>
            </div>
          </>
        )}

        {success && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur grid place-items-center z-20">
            <div className="w-24 h-24 rounded-full bg-gradient-profit grid place-items-center animate-check-pop shadow-glow">
              <Check className="w-14 h-14 text-profit-foreground" strokeWidth={3} />
            </div>
          </div>
        )}

        {scanner && (
          <ReceiptScanner
            onClose={() => setScanner(false)}
            onConfirm={handleScannerConfirm}
            knownIngredients={ingredientOptions.map((i) => i.name)}
          />
        )}
      </div>
    </div>
  );
};
