import type { Unit } from "@/types";

export const fmtQty = (q: number, u: Unit) => {
  const v = Number.isInteger(q) ? q.toString() : q.toFixed(1);
  return `${v} ${u}`;
};

export const fmt = (n: number) =>
  `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
