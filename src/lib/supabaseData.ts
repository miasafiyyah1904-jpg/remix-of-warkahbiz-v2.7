import { supabase } from "@/integrations/supabase/client";
import type {
  Txn, StockItem, BuyItem, PettyEntry, OpExEntry, Product, CookingLog, SavedCard,
  BusinessHoursSettings, OutletSettings, FinishedStock,
} from "@/types";

/**
 * Registry of cloud-backed stores. Each entry knows how to:
 *  - fetch the user's data from Supabase
 *  - write the user's data back (full replace for lists, upsert for singletons)
 *
 * Keyed by the legacy localStorage baseKey so that callers can do a near
 * drop-in replacement of useLocalStorage.
 */

type Mode = "list" | "singleton";

export interface CloudStore<T = any> {
  table: string;
  mode: Mode;
  fetch: (userId: string) => Promise<T | null>;
  save: (userId: string, value: T) => Promise<boolean>;
  hasData?: (value: T) => boolean;
}

const swallow = (label: string, error: unknown) => {
  if (error) console.error(`[supabaseData] ${label}`, error);
};

/* ---------- list helpers ---------- */

async function replaceAll(table: string, userId: string, rows: any[]): Promise<boolean> {
  if (rows.length === 0) {
    const { error } = await supabase.from(table as any).delete().eq("user_id", userId);
    if (error) { swallow(`${table} clear`, error); return false; }
    return true;
  }

  const payload = rows.map((r) => ({ ...r, user_id: userId }));

  const { error: upsertErr } = await supabase
    .from(table as any)
    .upsert(payload as any, { onConflict: "user_id,id" });
  if (upsertErr) { swallow(`${table} upsert`, upsertErr); return false; }

  const currentIds = rows.map((r) => r.id);
  const { error: delErr } = await supabase
    .from(table as any)
    .delete()
    .eq("user_id", userId)
    .not("id", "in", `(${currentIds.join(",")})`);
  if (delErr) { swallow(`${table} delete stale`, delErr); return false; }

  return true;
}

async function fetchAll<T>(table: string, userId: string, map: (row: any) => T): Promise<T[] | null> {
  const { data, error } = await supabase.from(table as any).select("*").eq("user_id", userId);
  if (error) { swallow(`${table} fetch`, error); return null; }
  return (data ?? []).map(map);
}

/* ---------- mappers ---------- */

const txnMap = {
  to: (t: Txn) => ({
    id: t.id, type: t.type, emoji: t.emoji, label: t.label, amount: t.amount,
    time: t.time, ts: t.ts, created_at: t.createdAt ?? new Date(t.ts).toISOString(),
    category: t.category ?? (t.type === "in" ? "Jualan" : "Kos Operasi"),
    notes: t.notes ?? null,
  }),
  from: (r: any): Txn => ({
    id: Number(r.id), type: r.type, emoji: r.emoji ?? "", label: r.label ?? "",
    amount: Number(r.amount ?? 0), time: r.time ?? "", ts: Number(r.ts ?? 0),
    createdAt: r.created_at ?? undefined,
    category: r.category ?? (r.type === "in" ? "Jualan" : "Kos Operasi"),
    notes: r.notes ?? undefined,
  }),
};


const stockMap = {
  to: (s: StockItem) => ({
    id: s.id, emoji: s.emoji, name: s.name, qty: s.qty, unit: s.unit,
    min_qty: s.minQty, restock_qty: s.restockQty, max_qty: s.maxQty ?? null,
    category: s.category ?? null,
    last_restocked_at: s.lastRestockedAt ?? null,
    last_used_at: s.lastUsedAt ?? null,
  }),
  from: (r: any): StockItem => ({
    id: r.id, emoji: r.emoji ?? "", name: r.name ?? "", qty: Number(r.qty ?? 0),
    unit: r.unit, minQty: Number(r.min_qty ?? 0), restockQty: Number(r.restock_qty ?? 0),
    maxQty: r.max_qty != null ? Number(r.max_qty) : undefined,
    category: r.category ?? undefined,
    lastRestockedAt: r.last_restocked_at ?? undefined,
    lastUsedAt: r.last_used_at ?? undefined,
  }),
};

const buyMap = {
  to: (b: BuyItem) => ({
    id: b.id, emoji: b.emoji, name: b.name, cost: b.cost,
    current_qty: b.currentQty, rec_qty: b.recQty, unit: b.unit,
    days_cover: b.daysCover, reason: b.reason, done: !!b.done,
    source: b.source ?? null, note: b.note ?? null,
  }),
  from: (r: any): BuyItem => ({
    id: r.id, emoji: r.emoji ?? "", name: r.name ?? "", cost: Number(r.cost ?? 0),
    currentQty: Number(r.current_qty ?? 0), recQty: Number(r.rec_qty ?? 0),
    unit: r.unit, daysCover: Number(r.days_cover ?? 0), reason: r.reason ?? "",
    done: !!r.done, source: r.source ?? undefined, note: r.note ?? undefined,
  }),
};

const pettyMap = {
  to: (p: PettyEntry) => ({
    id: p.id, type: p.type, desc: p.desc, emoji: p.emoji, amount: p.amount,
    time: p.time, balance: p.balance,
    created_at: p.createdAt ?? new Date(p.ts ?? Date.now()).toISOString(),
    ts: p.ts ?? Date.now(),
  }),
  from: (r: any): PettyEntry => ({
    id: Number(r.id), type: r.type, desc: r.desc ?? "", emoji: r.emoji ?? "",
    amount: Number(r.amount ?? 0), time: r.time ?? "", balance: Number(r.balance ?? 0),
    createdAt: r.created_at ?? undefined, ts: r.ts != null ? Number(r.ts) : undefined,
  }),
};

const opexMap = {
  to: (o: OpExEntry) => ({
    id: o.id, category: o.category, desc: o.desc, amount: o.amount,
    time: o.time, ts: o.ts, created_at: o.createdAt,
    paid_from_petty: !!o.paidFromPetty,
  }),
  from: (r: any): OpExEntry => ({
    id: Number(r.id), category: r.category, desc: r.desc ?? "",
    amount: Number(r.amount ?? 0), time: r.time ?? "",
    ts: Number(r.ts ?? 0), createdAt: r.created_at,
    paidFromPetty: !!r.paid_from_petty,
  }),
};

const productMap = {
  to: (p: Product) => ({
    id: p.id, emoji: p.emoji, name: p.name, description: p.description ?? null,
    category: p.category ?? null,
    servings_per_batch: p.servingsPerBatch ?? null,
    serving_unit: p.servingUnit ?? null,
    cooking_frequency_days: p.cookingFrequencyDays ?? null,
    batches_from_ingredients: p.batchesFromIngredients ?? null,
    total_cost: p.totalCost ?? null,
    cost_per_unit: p.costPerUnit ?? null,
    suggested_price: p.suggestedPrice ?? null,
    margin: p.margin ?? null,
    target_profit_scale: p.targetProfitScale ?? null,
    packaging: p.packaging ?? null,
    ingredients: p.ingredients ?? null,
    note: p.note ?? null,
  }),
  from: (r: any): Product => ({
    id: r.id, emoji: r.emoji ?? "", name: r.name ?? "",
    description: r.description ?? undefined, category: r.category ?? undefined,
    servingsPerBatch: r.servings_per_batch ?? undefined,
    servingUnit: r.serving_unit ?? undefined,
    cookingFrequencyDays: r.cooking_frequency_days ?? undefined,
    batchesFromIngredients: r.batches_from_ingredients ?? undefined,
    totalCost: r.total_cost ?? undefined,
    costPerUnit: r.cost_per_unit ?? undefined,
    suggestedPrice: r.suggested_price ?? undefined,
    margin: r.margin ?? undefined,
    targetProfitScale: r.target_profit_scale ?? undefined,
    packaging: r.packaging ?? undefined,
    ingredients: r.ingredients ?? undefined,
    note: r.note ?? undefined,
  }),
};

const cookingMap = {
  to: (c: CookingLog) => ({
    id: c.id, product_id: c.productId, product_name: c.productName,
    product_emoji: c.productEmoji, batches: c.batches, batch_unit: c.batchUnit,
    created_at: c.createdAt, ts: c.ts,
  }),
  from: (r: any): CookingLog => ({
    id: Number(r.id), productId: r.product_id ?? "", productName: r.product_name ?? "",
    productEmoji: r.product_emoji ?? "", batches: Number(r.batches ?? 0),
    batchUnit: r.batch_unit ?? "", createdAt: r.created_at, ts: Number(r.ts ?? 0),
  }),
};

const cardMap = {
  to: (c: SavedCard) => ({
    id: c.id, type: c.type,
    ewallet_provider: c.ewalletProvider ?? null,
    ewallet_phone: c.ewalletPhone ?? null,
    bank_name: c.bankName ?? null,
    account_number: c.accountNumber ?? null,
    account_holder: c.accountHolder ?? null,
    nickname: c.nickname ?? null,
    is_primary: !!c.isPrimary,
    created_at: c.createdAt,
  }),
  from: (r: any): SavedCard => ({
    id: r.id, type: r.type,
    ewalletProvider: r.ewallet_provider ?? undefined,
    ewalletPhone: r.ewallet_phone ?? undefined,
    bankName: r.bank_name ?? undefined,
    accountNumber: r.account_number ?? undefined,
    accountHolder: r.account_holder ?? undefined,
    nickname: r.nickname ?? undefined,
    isPrimary: !!r.is_primary,
    createdAt: r.created_at,
  }),
};

/* ---------- chat ---------- */

import type { ChatMsg } from "@/types";
const chatMap = {
  to: (m: ChatMsg & { ts?: number }) => ({
    id: m.id, from: m.from, text: m.text, ts: (m as any).ts ?? m.id,
  }),
  from: (r: any): ChatMsg => ({
    id: Number(r.id), from: r.from, text: r.text ?? "",
  }),
};

/* ---------- registry ---------- */

function listStore<T>(table: string, to: (v: T) => any, from: (r: any) => T): CloudStore<T[]> {
  return {
    table, mode: "list",
    fetch: (userId) => fetchAll<T>(table, userId, from),
    save: (userId, value) => replaceAll(table, userId, value.map(to)),
    hasData: (value) => Array.isArray(value) && value.length > 0,
  };
}

const businessHoursStore: CloudStore<BusinessHoursSettings> = {
  table: "business_hours", mode: "singleton",
  fetch: async (userId) => {
    const { data, error } = await supabase.from("business_hours").select("settings").eq("user_id", userId).maybeSingle();
    if (error) { swallow("business_hours fetch", error); return null; }
    return (data?.settings as unknown as BusinessHoursSettings) ?? null;
  },
  save: async (userId, value) => {
    const { error } = await supabase.from("business_hours").upsert({ user_id: userId, settings: value as any });
    if (error) { swallow("business_hours save", error); return false; }
    return true;
  },
  hasData: (v) => !!v,
};

const outletStore: CloudStore<OutletSettings> = {
  table: "outlet_settings", mode: "singleton",
  fetch: async (userId) => {
    const { data, error } = await supabase.from("outlet_settings").select("settings").eq("user_id", userId).maybeSingle();
    if (error) { swallow("outlet_settings fetch", error); return null; }
    return (data?.settings as unknown as OutletSettings) ?? null;
  },
  save: async (userId, value) => {
    const { error } = await supabase.from("outlet_settings").upsert({ user_id: userId, settings: value as any });
    if (error) { swallow("outlet_settings save", error); return false; }
    return true;
  },
  hasData: (v) => !!v?.outletName || !!v?.address,
};

const pettyLimitStore: CloudStore<number> = {
  table: "petty_settings", mode: "singleton",
  fetch: async (userId) => {
    const { data, error } = await supabase.from("petty_settings").select("monthly_limit").eq("user_id", userId).maybeSingle();
    if (error) { swallow("petty_settings fetch", error); return null; }
    return data ? Number(data.monthly_limit ?? 0) : null;
  },
  save: async (userId, value) => {
    const { error } = await supabase.from("petty_settings").upsert({ user_id: userId, monthly_limit: value });
    if (error) { swallow("petty_settings save", error); return false; }
    return true;
  },
  hasData: (v) => typeof v === "number" && v > 0,
};

export const CLOUD_STORES: Record<string, CloudStore<any>> = {
  warkahbiz_txns: listStore<Txn>("transactions", txnMap.to, txnMap.from),
  warkahbiz_stock: listStore<StockItem>("stock_items", stockMap.to, stockMap.from),
  warkahbiz_buy: listStore<BuyItem>("buy_items", buyMap.to, buyMap.from),
  warkahbiz_petty: listStore<PettyEntry>("petty_entries", pettyMap.to, pettyMap.from),
  warkahbiz_opex: listStore<OpExEntry>("opex_entries", opexMap.to, opexMap.from),
  warkahbiz_products: listStore<Product>("products", productMap.to, productMap.from),
  warkahbiz_cooking_log: listStore<CookingLog>("cooking_logs", cookingMap.to, cookingMap.from),
  warkahbiz_cards: listStore<SavedCard>("saved_cards", cardMap.to, cardMap.from),
  warkahbiz_chat: listStore<ChatMsg>("chat_history", chatMap.to, chatMap.from),
  warkahbiz_business_hours: businessHoursStore,
  warkahbiz_outlet: outletStore,
  warkahbiz_petty_monthly_limit: pettyLimitStore,
};