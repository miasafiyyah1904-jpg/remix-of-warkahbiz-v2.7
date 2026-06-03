import { useState } from "react";
import { toast } from "sonner";
import { Plus, X, Pencil, Trash2, Phone, Search, ChevronDown, ArrowLeft } from "lucide-react";
import type { Supplier, SupplierCategory } from "@/types";
import { SUPPLIER_CATEGORIES } from "@/types";
import { useTranslation } from "@/context/LanguageContext";

const CATEGORY_EMOJI: Record<SupplierCategory, string> = {
  "Bahan Mentah":  "🥩",
  "Minuman":       "🧃",
  "Pembungkusan":  "📦",
  "Gas & Utiliti": "🔥",
  "Lain-lain":     "🏪",
};

export const SupplierView = ({
  suppliers,
  onSave,
  onDelete,
  onBack,
}: {
  suppliers: Supplier[];
  onSave: (s: Supplier) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}) => {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? suppliers.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.items.toLowerCase().includes(q),
      )
    : suppliers;

  return (
    <div className="pb-32 px-5 pt-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <button onClick={onBack} className="text-xs font-bold text-primary tap mb-1 inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> {t("backToProfile")}
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight">{t("suppliersTitle")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {suppliers.length === 0 ? t("suppliersNone") : t("suppliersCount").replace("{n}", String(suppliers.length))}
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setSheetOpen(true); }}
          className="w-11 h-11 rounded-2xl bg-gradient-profit text-profit-foreground grid place-items-center tap shadow-card"
          aria-label={t("addBtn")}
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>

      {suppliers.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("suppliersSearchPh")}
            className="w-full h-12 pl-11 pr-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      )}

      {suppliers.length === 0 && (
        <div className="text-center py-10 space-y-3">
          <div className="text-6xl">🏪</div>
          <h3 className="text-base font-extrabold">{t("suppliersEmptyTitle")}</h3>
          <p className="text-xs text-muted-foreground max-w-[260px] mx-auto">
            {t("suppliersEmptyDesc")}
          </p>
          <button
            onClick={() => { setEditing(null); setSheetOpen(true); }}
            className="mt-2 h-11 px-6 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap shadow-card"
          >
            {t("addFirstSupplier")}
          </button>
        </div>
      )}

      {suppliers.length > 0 && (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground">
              {t("noSupplierMatch")}
            </div>
          )}
          {filtered.map((s) => (
            <div key={s.id} className="flex items-start gap-3 p-4 rounded-2xl bg-surface border border-border">
              <div className="w-11 h-11 rounded-xl bg-gradient-profit text-profit-foreground grid place-items-center shrink-0 text-xl">
                {CATEGORY_EMOJI[s.category]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold truncate">{s.name}</span>
                  <span className="text-[10px] font-bold text-muted-foreground">{s.category}</span>
                </div>
                {s.items && (
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{s.items}</div>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {s.phone && (
                  <button
                    onClick={() => window.open("tel:" + s.phone)}
                    className="w-8 h-8 rounded-lg bg-background border border-border grid place-items-center tap text-profit"
                    aria-label="Call"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => { setEditing(s); setSheetOpen(true); }}
                  className="w-8 h-8 rounded-lg bg-background border border-border grid place-items-center tap"
                  aria-label="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteConfirm(s.id)}
                  className="w-8 h-8 rounded-lg bg-background border border-border grid place-items-center tap text-cost"
                  aria-label={t("deleteBtn")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sheetOpen && (
        <SupplierSheet
          initial={editing}
          onClose={() => setSheetOpen(false)}
          onSave={(s) => {
            onSave(s);
            setSheetOpen(false);
            toast.success(t("supplierSaved"));
          }}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-sm bg-surface rounded-3xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold">{t("deleteSupplierConfirm")}</h3>
            <p className="text-xs text-muted-foreground">{t("deleteCannotUndo")}</p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => setDeleteConfirm(null)} className="tap h-11 rounded-xl border border-border font-semibold">{t("cancel")}</button>
              <button
                onClick={() => { onDelete(deleteConfirm); setDeleteConfirm(null); toast.success(t("supplierDeleted")); }}
                className="tap h-11 rounded-xl bg-cost text-cost-foreground font-bold"
              >{t("deleteBtn")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function SupplierSheet({ initial, onClose, onSave }: {
  initial: Supplier | null;
  onClose: () => void;
  onSave: (s: Supplier) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name || "");
  const [category, setCategory] = useState<SupplierCategory>(initial?.category || SUPPLIER_CATEGORIES[0]);
  const [phone, setPhone] = useState(initial?.phone || "");
  const [items, setItems] = useState(initial?.items || "");
  const [note, setNote] = useState(initial?.note || "");

  const handleSave = () => {
    if (!name.trim()) { toast.error(t("pleaseEnterSupplierName")); return; }
    if (!items.trim()) { toast.error(t("pleaseEnterItems")); return; }
    onSave({
      id: initial?.id || `sup-${Date.now()}`,
      name: name.trim(),
      category,
      phone: phone.trim(),
      items: items.trim(),
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-full sm:max-w-[600px] md:max-w-[760px] mx-auto bg-surface rounded-t-3xl p-5 pb-10 animate-slide-up max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold">{initial ? t("editSupplier") : t("addSupplier")}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-background border border-border grid place-items-center tap">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label={t("supplierNameLabel")}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={t("supplierNamePh")}
              className="w-full h-12 px-4 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>
          <Field label={t("categoryLabel")}>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SupplierCategory)}
                className="w-full h-12 pl-4 pr-10 rounded-2xl bg-background border border-border text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {SUPPLIER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_EMOJI[c]} {c}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </div>
          </Field>
          <Field label={t("phoneLabel")}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\-\s]/g, "").slice(0, 20))}
              placeholder="012-3456789"
              className="w-full h-12 px-4 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>
          <Field label={t("itemsLabel")}>
            <input
              value={items}
              onChange={(e) => setItems(e.target.value)}
              maxLength={120}
              placeholder={t("itemsPh")}
              className="w-full h-12 px-4 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>
          <Field label={t("noteOptLabel")}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              rows={3}
              placeholder={t("notePh")}
              className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </Field>

          <button
            onClick={handleSave}
            className="w-full h-12 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap mt-3 shadow-card"
          >
            {t("saveBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="text-[11px] font-bold text-muted-foreground mb-1.5 ml-1">{label}</div>
    {children}
  </div>
);
