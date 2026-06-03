import { useState } from "react";
import { FileText, FileSpreadsheet, MessageCircle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import type { Txn, Product, OpExEntry } from "@/types";

interface Props {
  onClose: () => void;
  txns?: Txn[];
  products?: Product[];
  opex?: OpExEntry[];
}

const fmt2 = (n: number) => Number(n || 0).toFixed(2);
const dateLabel = (iso?: string, ts?: number) => {
  const d = iso ? new Date(iso) : new Date(ts ?? Date.now());
  return d.toLocaleDateString("ms-MY", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const ddmmyyyy = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}`;
};

export const ExportSheet = ({ onClose, txns = [], products = [], opex = [] }: Props) => {
  const [loading, setLoading] = useState(false);

  const handleExcel = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const wb = XLSX.utils.book_new();

      const txnRows = [...txns]
        .sort((a, b) => (b.ts || 0) - (a.ts || 0))
        .map((t) => {
          const cat = t.category ?? (t.type === "in" ? "Jualan" : (t.label.startsWith("Beli ") ? "Belian Bahan" : "Kos Operasi"));
          return {
            Date: dateLabel(t.createdAt, t.ts),
            Time: t.time ?? "",
            Description: t.label,
            Category: cat,
            "Cash In": t.type === "in" ? Number(fmt2(t.amount)) : "",
            "Cash Out": t.type === "out" ? Number(("-" + fmt2(t.amount))) : "",
            Notes: t.notes ?? "",
          };
        });
      const ws1 = XLSX.utils.json_to_sheet(
        txnRows.length ? txnRows : [{ Date: "", Time: "", Description: "", Category: "", "Cash In": "", "Cash Out": "", Notes: "" }],
      );
      XLSX.utils.book_append_sheet(wb, ws1, "Transactions");


      const prodRows = products.map((p) => {
        const cost = p.costPerUnit ?? p.totalCost ?? p.costPrice ?? 0;
        const price = p.suggestedPrice ?? p.sellingPrice ?? 0;
        const profit = price - cost;
        const margin = price > 0 ? (profit / price) * 100 : 0;
        return {
          "Nama Produk": p.name,
          Kategori: p.category ?? "",
          "Kos Bahan (RM)": fmt2(cost),
          "Harga Jual (RM)": fmt2(price),
          "Untung/Unit (RM)": fmt2(profit),
          "Margin (%)": fmt2(margin),
        };
      });
      const ws2 = XLSX.utils.json_to_sheet(
        prodRows.length ? prodRows : [{ "Nama Produk": "", Kategori: "", "Kos Bahan (RM)": "", "Harga Jual (RM)": "", "Untung/Unit (RM)": "", "Margin (%)": "" }],
      );
      XLSX.utils.book_append_sheet(wb, ws2, "Produk");

      const opexRows = [...opex]
        .sort((a, b) => (b.ts || 0) - (a.ts || 0))
        .map((e) => ({
          Tarikh: dateLabel(e.createdAt, e.ts),
          Kategori: e.category,
          Penerangan: e.desc,
          "Jumlah (RM)": fmt2(e.amount),
        }));
      const ws3 = XLSX.utils.json_to_sheet(
        opexRows.length ? opexRows : [{ Tarikh: "", Kategori: "", Penerangan: "", "Jumlah (RM)": "" }],
      );
      XLSX.utils.book_append_sheet(wb, ws3, "Kos Operasi");

      XLSX.writeFile(wb, `WarkahBiz_Rekod_${ddmmyyyy()}.xlsx`);
      toast.success("Fail Excel berjaya dimuat turun!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Gagal export. Cuba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[440px] bg-surface rounded-t-[2rem] p-5 pb-8 animate-slide-up">
        <div className="grid place-items-center mb-3">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/40" />
        </div>
        <h3 className="font-extrabold text-lg mb-3">Export Rekod 📤</h3>

        <button disabled className="w-full h-14 mb-2 rounded-2xl bg-surface-elevated px-4 flex items-center gap-3 tap opacity-60">
          <FileText className="w-5 h-5" />
          <span className="font-semibold flex-1 text-left">PDF Ringkasan</span>
          <span className="text-[10px] text-muted-foreground">Akan datang</span>
        </button>

        <button
          onClick={handleExcel}
          disabled={loading}
          className="w-full h-14 mb-2 rounded-2xl bg-primary text-primary-foreground px-4 flex items-center gap-3 tap disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
          <span className="font-semibold flex-1 text-left">{loading ? "Sedang muat turun…" : "Excel (.xlsx)"}</span>
          <span className="text-2xl">📊</span>
        </button>

        <button disabled className="w-full h-14 mb-2 rounded-2xl bg-surface-elevated px-4 flex items-center gap-3 tap opacity-60">
          <MessageCircle className="w-5 h-5" />
          <span className="font-semibold flex-1 text-left">Kongsi WhatsApp</span>
          <span className="text-[10px] text-muted-foreground">Akan datang</span>
        </button>
      </div>
    </div>
  );
};
