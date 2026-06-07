import { useMemo, useRef, useEffect } from "react";
import { Check, Share2 } from "lucide-react";
import type { BuyItem, StockItem, Product, Unit } from "@/types";
import { emojiForItem } from "@/lib/stockEmoji";
import { useTranslation } from "@/context/LanguageContext";

export const BuyView = ({
  buy,
  stock,
  products,
  onToggleDone,
  onSyncNotepad,
}: {
  buy: BuyItem[];
  stock: StockItem[];
  products: Product[];
  onToggleDone: (id: string) => void;
  onResync?: () => void;
  onSyncNotepad: (items: BuyItem[]) => void;
  onBulkDone?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => void;
  onClearCompleted?: () => void;
  onGoToStock?: () => void;
}) => {
  const undone = buy.filter((b) => !b.done);
  const done = buy.filter((b) => b.done);

  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const focusIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (focusIdRef.current) {
      const el = inputsRef.current[focusIdRef.current];
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
      focusIdRef.current = null;
    }
  });

  const lowStockSuggestions = useMemo(() => {
    if (!products.length) return [];
    const ingredientNames = new Set<string>();
    products.forEach((p) =>
      (p.ingredients ?? []).forEach((ing) => {
        const n = ing.name.trim();
        if (n) ingredientNames.add(n.toLowerCase());
      }),
    );
    return stock.filter((s) => {
      if (!ingredientNames.has(s.name.toLowerCase())) return false;
      const peak = s.maxQty ?? 0;
      return peak > 0 && s.qty < peak * 0.2;
    });
  }, [products, stock]);

  const newItem = (name: string): BuyItem => ({
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    emoji: emojiForItem(name) || "🛒",
    name,
    cost: 0,
    currentQty: 0,
    recQty: 1,
    unit: "biji" as Unit,
    daysCover: 0,
    reason: "",
    done: false,
    source: "manual" as const,
  });

  const updateName = (id: string, name: string) => {
    onSyncNotepad(buy.map((b) => (b.id === id ? { ...b, name, emoji: emojiForItem(name) || b.emoji } : b)));
  };

  const removeItem = (id: string) => {
    onSyncNotepad(buy.filter((b) => b.id !== id));
  };

  const addAfter = (id: string | null) => {
    const item = newItem("");
    focusIdRef.current = item.id;
    if (id == null) {
      onSyncNotepad([...buy, item]);
      return;
    }
    const idx = buy.findIndex((b) => b.id === id);
    const next = [...buy];
    next.splice(idx + 1, 0, item);
    onSyncNotepad(next);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>, b: BuyItem) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addAfter(b.id);
    } else if (e.key === "Backspace" && b.name === "") {
      e.preventDefault();
      const list = buy;
      const idx = list.findIndex((x) => x.id === b.id);
      const prev = list.slice(0, idx).reverse().find((x) => true);
      removeItem(b.id);
      if (prev) {
        focusIdRef.current = prev.id;
      }
    }
  };

  const share = () => {
    const date = new Date().toLocaleDateString("ms-MY", {
      day: "numeric", month: "long", year: "numeric",
    });
    const lines = undone.map((b) => `[ ] ${b.name}`);
    const text = `🛒 *Senarai Nak Beli - WarkahBiz*\n📅 ${date}\n\n${lines.join("\n")}\n\n_Dijana oleh WarkahBiz App_`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => navigator.clipboard?.writeText(text));
    } else {
      navigator.clipboard?.writeText(text);
    }
  };

  if (products.length === 0) {
    return (
      <div className="px-5 pt-6 pb-32">
        <div className="rounded-2xl p-6 bg-surface border border-border text-center space-y-2">
          <div className="text-4xl">📋</div>
          <p className="text-sm text-muted-foreground">
            Tiada produk disimpan. Sila tambah produk dalam Profil untuk menggunakan ciri ini.
          </p>
        </div>
      </div>
    );
  }

  const total = buy.length;
  const doneCount = done.length;

  const renderRow = (b: BuyItem) => (
    <div
      key={b.id}
      className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-surface-elevated/60 group"
    >
      <button
        onClick={() => onToggleDone(b.id)}
        aria-label={b.done ? "Untick" : "Tick"}
        className={`w-5 h-5 rounded border-2 grid place-items-center shrink-0 tap ${
          b.done ? "bg-profit border-profit text-profit-foreground" : "border-border"
        }`}
      >
        {b.done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      </button>
      <span className="text-base shrink-0">{b.emoji}</span>
      <input
        ref={(el) => { inputsRef.current[b.id] = el; }}
        value={b.name}
        onChange={(e) => updateName(b.id, e.target.value)}
        onKeyDown={(e) => handleKey(e, b)}
        onBlur={() => {
          if (b.name.trim() === "") removeItem(b.id);
        }}
        placeholder="Tulis item..."
        className={`flex-1 bg-transparent text-sm font-medium focus:outline-none placeholder:text-muted-foreground/40 ${
          b.done ? "line-through text-muted-foreground" : ""
        }`}
      />
    </div>
  );

  return (
    <div className="px-5 pt-6 space-y-4 pb-32">
      <header className="animate-fade-in">
        <h1 className="text-2xl font-extrabold tracking-tight">Nak Beli 🛒</h1>
        <div className="text-xs font-semibold text-muted-foreground mt-2">
          {doneCount} / {total} selesai
        </div>
        <div className="mt-1 h-2 rounded-full bg-surface overflow-hidden">
          <div
            className="h-full bg-profit transition-all"
            style={{ width: total ? `${(doneCount / total) * 100}%` : "0%" }}
          />
        </div>
      </header>

      <div className="rounded-2xl bg-surface-elevated border-l-4 border-warn p-4 animate-fade-in">
        <div className="text-sm font-extrabold mb-1">📌 Tip Pembelian</div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Bila dah beli barang, tekan butang <span className="font-bold text-foreground">+</span> di bawah → pilih{" "}
          <span className="font-bold text-foreground">"Pembelian"</span> untuk rekod harga dan kemaskini stok secara automatik.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="px-4 py-2 border-b border-border bg-surface-elevated flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">📝 Senarai Nak Beli</span>
          <span className="ml-auto text-[10px] text-muted-foreground">tap untuk edit</span>
        </div>

        <div
          className="py-2 min-h-[160px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) addAfter(null);
          }}
        >
          {undone.length === 0 && done.length === 0 && (
            <button
              onClick={() => addAfter(null)}
              className="w-full text-left px-5 py-3 text-sm text-muted-foreground/50"
            >
              Tap di sini untuk mula tambah item...
            </button>
          )}

          {undone.map(renderRow)}

          {done.length > 0 && (
            <>
              <div className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Sudah Beli
              </div>
              {done.map(renderRow)}
            </>
          )}

          {lowStockSuggestions.length > 0 && (
            <div className="mx-3 mt-3 pt-3 border-t border-border/60">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Cadangan stok rendah:
              </div>
              <ul className="px-2 pb-1 space-y-0.5">
                {lowStockSuggestions.map((s) => (
                  <li key={s.id} className="text-xs text-muted-foreground">
                    • {s.name} — <span className="text-warn font-semibold">stok rendah</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-4 pb-3 pt-2 flex items-center gap-2 border-t border-border">
          <button
            onClick={() => addAfter(null)}
            className="h-8 px-3 rounded-xl bg-surface-elevated text-xs font-bold tap"
          >
            + Tambah
          </button>
          <span className="text-[10px] text-muted-foreground ml-1">
            {undone.length} item belum dibeli
          </span>
          <button
            onClick={share}
            className="ml-auto h-8 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold tap flex items-center gap-1"
          >
            <Share2 className="w-3 h-3" /> Kongsi
          </button>
        </div>
      </div>
    </div>
  );
};
