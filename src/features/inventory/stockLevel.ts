import type { StockLevel } from "@/types";

export const STOCK_ORDER: StockLevel[] = ["habis", "sedikit", "cukup", "banyak"];

export const STOCK_META: Record<StockLevel, { label: string; dot: string; bar: string; text: string }> = {
  habis:   { label: "🔴 Habis",   dot: "bg-cost",   bar: "bg-cost/20 text-cost",     text: "text-cost" },
  sedikit: { label: "🟡 Sedikit", dot: "bg-warn",   bar: "bg-warn/20 text-warn",     text: "text-warn" },
  cukup:   { label: "🟢 Cukup",   dot: "bg-profit", bar: "bg-profit/20 text-profit", text: "text-profit" },
  banyak:  { label: "🟢 Banyak",  dot: "bg-profit", bar: "bg-profit/25 text-profit", text: "text-profit" },
};

export const levelOf = (s: { qty: number; minQty: number; restockQty: number }): StockLevel => {
  if (s.qty <= s.minQty) return "habis";
  if (s.qty <= s.restockQty) return "sedikit";
  if (s.qty >= s.restockQty * 2) return "banyak";
  return "cukup";
};
