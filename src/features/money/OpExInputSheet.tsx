import { useState } from "react";
import { Delete } from "lucide-react";
import { OPEX_CATEGORIES, OPEX_EMOJI } from "@/types";
import type { OpExCategory } from "@/types";

export const OpExInputSheet = ({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (category: OpExCategory, amount: number, desc: string, paidFromPetty: boolean) => void;
}) => {
  const [amount, setAmount] = useState("0");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<OpExCategory>("Kos Bahan");
  const [paidFromPetty, setPaidFromPetty] = useState(false);

  const press = (k: string) => {
    setAmount((prev) => {
      if (k === "del") return prev.length <= 1 ? "0" : prev.slice(0, -1);
      if (k === ".") return prev.includes(".") ? prev : prev + ".";
      if (prev === "0") return k;
      return prev + k;
    });
  };

  const canSave = parseFloat(amount) > 0 && desc.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[440px] bg-surface rounded-t-[2rem] p-5 pb-6 animate-slide-up space-y-4 max-h-[92vh] overflow-y-auto"
      >
        <div className="grid place-items-center">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/40" />
        </div>

        <h3 className="font-extrabold text-lg">Tambah Kos Operasi 💼</h3>

        <div className="rounded-2xl p-4 text-center bg-cost/10">
          <div className="text-4xl font-extrabold text-cost">RM {amount}</div>
        </div>

        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Keterangan (cth: Bayar bil letrik)"
          className="w-full h-12 px-4 rounded-2xl bg-surface-elevated border border-border focus:outline-none focus:border-primary text-sm"
        />

        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kategori</div>
          <div className="grid grid-cols-3 gap-2">
            {OPEX_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold border transition-all tap ${
                  category === cat
                    ? "bg-cost/15 border-cost text-cost"
                    : "bg-surface-elevated border-border text-muted-foreground"
                }`}
              >
                <span className="text-lg leading-none">{OPEX_EMOJI[cat]}</span>
                <span>{cat}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setPaidFromPetty((v) => !v)}
          className={`w-full h-12 rounded-2xl flex items-center justify-between px-4 border transition-all tap ${
            paidFromPetty
              ? "bg-warn/15 border-warn/50"
              : "bg-surface-elevated border-border text-muted-foreground"
          }`}
        >
          <span className="text-sm font-semibold">🪙 Bayar dari Petty Cash?</span>
          <span className={`text-xs font-extrabold ${paidFromPetty ? "text-warn" : ""}`}>
            {paidFromPetty ? "YA" : "TIDAK"}
          </span>
        </button>

        <div className="grid grid-cols-3 gap-2">
          {["1","2","3","4","5","6","7","8","9",".","0","del"].map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              className="h-11 rounded-2xl bg-surface-elevated text-lg font-bold grid place-items-center tap"
            >
              {k === "del" ? <Delete className="w-5 h-5" /> : k}
            </button>
          ))}
        </div>

        <button
          disabled={!canSave}
          onClick={() => {
            if (!canSave) return;
            onSave(category, parseFloat(amount), desc.trim(), paidFromPetty);
            onClose();
          }}
          className={`w-full py-3 rounded-2xl font-extrabold shadow-card bg-gradient-cost text-white tap ${!canSave ? "opacity-40" : ""}`}
        >
          {canSave ? "Simpan Kos 💾" : "Isi jumlah & keterangan dulu"}
        </button>
      </div>
    </div>
  );
};
