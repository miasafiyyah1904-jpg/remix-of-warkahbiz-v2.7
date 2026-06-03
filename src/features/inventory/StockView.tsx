import { useMemo, useState } from "react";
import { Search, X, AlertTriangle, Pencil, Check, X as XIcon, ChevronUp } from "lucide-react";
import type { StockItem, Product } from "@/types";
import { fmtQty } from "@/lib/format";
import { emojiForItem } from "@/lib/stockEmoji";
import { levelOf } from "@/features/inventory/stockLevel";
import { useTranslation } from "@/context/LanguageContext";

const isLow = (s: StockItem) => {
  const lvl = levelOf(s);
  return lvl === "habis" || lvl === "sedikit";
};

const isSufficient = (s: StockItem) => {
  const lvl = levelOf(s);
  return lvl === "cukup" || lvl === "banyak";
};

type TFn = (key: string) => string;

const relTime = (iso: string | undefined, t: TFn): string | null => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return t("sv_justNow");
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return t("sv_justNow");
  if (mins < 60) return t("sv_minsAgo").replace("{n}", String(mins));
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("sv_hrsAgo").replace("{n}", String(hrs));
  const days = Math.floor(hrs / 24);
  if (days < 7) return t("sv_daysAgo").replace("{n}", String(days));
  const wks = Math.floor(days / 7);
  return t("sv_wksAgo").replace("{n}", String(wks));
};

type TabKey = "all" | "low" | "sufficient";

export const StockView = ({
  stock,
  products,
  onGoToBuy,
  onSave,
}: {
  stock: StockItem[];
  products: Product[];
  onAdjust?: (id: string, delta: number) => void;
  onSave?: (item: StockItem) => void;
  onDelete?: (id: string) => void;
  onGoToBuy: () => void;
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [editingId, setEditingId] = useState<string | null>(null);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stock.filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [stock, query]);

  const filtered = useMemo(() => {
    if (activeTab === "low") return searched.filter(isLow);
    if (activeTab === "sufficient") return searched.filter(isSufficient);
    return searched;
  }, [searched, activeTab]);

  const lowCount = stock.filter(isLow).length;

  if (!products || products.length === 0) {
    return (
      <div className="px-5 pt-6 pb-6">
        <header className="animate-fade-in mb-5">
          <h1 className="text-2xl font-extrabold tracking-tight">{t("sv_stockTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("sv_stockInventorySubtitle")}</p>
        </header>
        <div className="rounded-2xl p-8 bg-surface border border-border text-center space-y-3">
          <div className="text-4xl">📭</div>
          <p className="font-bold text-sm">
            {t("sv_stockNoProducts")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 space-y-4 pb-6">
      <header className="animate-fade-in">
        <h1 className="text-2xl font-extrabold tracking-tight">{t("sv_stockTitle")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("sv_stockReadOnly")}
        </p>
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        <Chip label={t("total")} value={stock.length} tone="muted" />
        <Chip label={t("sv_stockLowLabel")} value={lowCount} tone="warn" />
      </div>

      {lowCount > 0 && (
        <button
          onClick={onGoToBuy}
          className="w-full text-left rounded-2xl p-4 bg-warn-soft border border-warn/30 flex items-center gap-3 tap animate-fade-in"
        >
          <AlertTriangle className="w-5 h-5 text-warn shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{t("sv_stockLowAlert").replace("{count}", String(lowCount))}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("sv_checkBuy")}</p>
          </div>
        </button>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("sv_searchStockPh")}
          className="w-full h-11 pl-9 pr-9 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label={t("sv_clearSearch")}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="flex gap-1.5 p-1 bg-surface-soft rounded-xl border border-border">
        {([
          { key: "all", label: t("sv_tabAll") },
          { key: "low", label: t("sv_tabLow") },
          { key: "sufficient", label: t("sv_tabSufficient") },
        ] as { key: TabKey; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 h-9 rounded-lg text-xs font-bold tap transition-colors ${
              activeTab === tab.key
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl p-8 bg-surface border border-border text-center">
          <p className="text-sm text-muted-foreground">
            {activeTab === "low"
              ? t("sv_emptyLow")
              : activeTab === "sufficient"
              ? t("sv_emptySufficient")
              : t("sv_noItemFound")}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((s) => (
            <StockRow
              key={s.id}
              item={s}
              onSave={onSave}
              editing={editingId === s.id}
              onToggleEdit={() =>
                setEditingId((id) => (id === s.id ? null : s.id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

const StockRow = ({
  item,
  onSave,
  editing,
  onToggleEdit,
}: {
  item: StockItem;
  onSave?: (item: StockItem) => void;
  editing: boolean;
  onToggleEdit: () => void;
}) => {
  const { t } = useTranslation();
  const low = isLow(item);
  const restocked = relTime(item.lastRestockedAt, t);
  const used = relTime(item.lastUsedAt, t);
  const emoji = item.emoji || emojiForItem(item.name);

  const [draftQty, setDraftQty] = useState<string>(String(item.qty));
  const [draftMin, setDraftMin] = useState<string>(String(item.minQty));

  const startEdit = () => {
    setDraftQty(String(item.qty));
    setDraftMin(String(item.minQty));
    onToggleEdit();
  };

  const save = () => {
    const n = Number(draftQty);
    const m = Number(draftMin);
    if (!Number.isFinite(n) || n < 0) return;
    if (!Number.isFinite(m) || m < 0) return;
    onSave?.({ ...item, qty: +n.toFixed(2), minQty: +m.toFixed(2) });
    onToggleEdit();
  };

  const canEdit = !!onSave;

  return (
    <div className={`rounded-xl bg-surface border transition-colors ${low ? "border-warn/25" : "border-border"}`}>
      <div
        className={`flex items-center gap-3 px-3 py-3 tap ${canEdit ? "cursor-pointer" : ""}`}
        onClick={canEdit ? onToggleEdit : undefined}
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${low ? "bg-cost" : "bg-profit"}`} />
        <div className="w-7 h-7 rounded-lg bg-surface-soft grid place-items-center text-base shrink-0">
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{item.name}</p>
          {(restocked || used) && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {restocked && (
                <span>
                  {t("sv_restock")} {restocked}
                  {used && " · "}
                </span>
              )}
              {used && (
                <span>
                  {t("sv_used")} {used}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-extrabold">{fmtQty(item.qty, item.unit)}</p>
          {item.minQty > 0 && (
            <p className="text-[10px] text-muted-foreground">min {item.minQty}</p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (editing) {
              onToggleEdit();
            } else {
              startEdit();
            }
          }}
          className="w-8 h-8 rounded-lg hover:bg-surface-soft grid place-items-center tap shrink-0"
          aria-label={t("sv_adjustStock")}
        >
          {editing ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Pencil className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {editing && (
        <div className="px-3 pb-3 pt-1 border-t border-border/60 space-y-3 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                {t("qty")}
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={draftQty}
                onChange={(e) => setDraftQty(e.target.value)}
                className="w-full h-10 mt-1 px-2 rounded-lg border border-border bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                {t("sv_minThreshold")}
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={draftMin}
                onChange={(e) => setDraftMin(e.target.value)}
                className="w-full h-10 mt-1 px-2 rounded-lg border border-border bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-bold tap inline-flex items-center justify-center gap-1"
            >
              <Check className="w-3 h-3" /> {t("sv_saveBtn")}
            </button>
            <button
              onClick={onToggleEdit}
              className="flex-1 h-9 rounded-lg bg-muted text-xs font-bold tap inline-flex items-center justify-center gap-1"
            >
              <XIcon className="w-3 h-3" /> {t("no")}
            </button>
          </div>
          <p className="text-[9px] text-muted-foreground leading-tight">
            {t("sv_adjustStockHint")}
          </p>
        </div>
      )}
    </div>
  );
};

const Chip = ({ label, value, tone }: { label: string; value: number; tone: "muted" | "warn" }) => {
  const styles =
    tone === "warn"
      ? "bg-warn-soft text-warn border-warn/30"
      : "bg-surface text-foreground border-border";
  return (
    <div className={`px-3 h-9 rounded-full border flex items-center gap-2 text-xs font-bold ${styles}`}>
      <span>{label}</span>
      <span className="px-1.5 h-5 rounded-full bg-background/60 grid place-items-center min-w-5">{value}</span>
    </div>
  );
};
