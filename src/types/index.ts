export type Tab = "today" | "bekalan" | "log" | "ai" | "profile";
export type StockLevel = "habis" | "sedikit" | "cukup" | "banyak";
export type TxnType = "in" | "out";
export type Unit = "kg" | "g" | "gram" | "liter" | "ml" | "biji" | "pek" | "paket" | "kotak" | "batang" | "helai" | "tong" | "papan" | "kampit" | "ekor" | "unit" | "pcs" | "box" | "pack" | "dozen" | "botol" | "ikat" | "tin" | "bungkus" | "sudu" | "cawan";
export type StockCategory = "Bahan Mentah" | "Minuman" | "Pembungkusan" | "Lain-lain";
export const STOCK_CATEGORIES: StockCategory[] = ["Bahan Mentah", "Minuman", "Pembungkusan", "Lain-lain"];

export type TxnCategory = "Jualan" | "Gaji" | "Belian Bahan" | "Kos Operasi" | "Aset" | "Liabiliti" | "Lain-lain";
export const TXN_CATEGORIES: TxnCategory[] = ["Jualan", "Gaji", "Belian Bahan", "Kos Operasi", "Aset", "Liabiliti", "Lain-lain"];
export const defaultTxnCategory = (type: TxnType): TxnCategory => type === "in" ? "Jualan" : "Kos Operasi";

export interface Txn {
  id: number;
  type: TxnType;
  emoji: string;
  label: string;
  amount: number;
  time: string; // display
  ts: number;   // sort
  createdAt?: string; // ISO date string
  category?: TxnCategory;
  notes?: string;
}


export interface BuyItem {
  id: string;
  emoji: string;
  name: string;
  cost: number;
  currentQty: number;
  recQty: number;
  unit: Unit;
  daysCover: number;
  reason: string;
  done: boolean;
  removing?: boolean;
  source?: "auto" | "manual";
  note?: string;
}

export interface StockItem {
  id: string;
  emoji: string;
  name: string;
  qty: number;
  unit: Unit;
  minQty: number;
  restockQty: number;
  maxQty?: number;
  category?: StockCategory;
  lastRestockedAt?: string;
  lastUsedAt?: string;
}

export interface CookingLog {
  id: number;
  ts: number;
  createdAt: string;
  productId: string;
  productName: string;
  productEmoji: string;
  batches: number;
  batchUnit: string;
}

export interface SafeStockItem {
  id: string;
  emoji: string;
  name: string;
  qty: number;
  unit: Unit;
  dailyUsage: number;
}

export interface ChatMsg {
  id: number;
  from: "user" | "bot";
  text: string;
}

export interface PettyEntry {
  id: number;
  type: "in" | "out";
  desc: string;
  emoji: string;
  amount: number;
  time: string;
  balance: number;
  createdAt?: string; // ISO date string
  ts?: number;
}

export interface ReceiptItem {
  emoji: string;
  name: string;
  qty: number;
  unit: Unit;
  price: number;
}

export const UNIT_STEP: Record<Unit, number> = {
  kg: 0.5, g: 50, gram: 50, liter: 0.5, ml: 100,
  biji: 1, pek: 1, paket: 1, kotak: 1, batang: 1, helai: 1,
  tong: 1, papan: 1, kampit: 1, ekor: 1,
  unit: 1, pcs: 1, box: 1, pack: 1, dozen: 1,
  botol: 1, ikat: 1, tin: 1, bungkus: 1, sudu: 1, cawan: 1,
};

export type OpExCategory =
  | "Kos Bahan"
  | "Utiliti"
  | "Pembungkusan"
  | "Gaji"
  | "Pengangkutan"
  | "Sewa Tapak"
  | "Lesen"
  | "Lain-lain";

export const OPEX_CATEGORIES: OpExCategory[] = [
  "Kos Bahan", "Utiliti", "Pembungkusan", "Gaji", "Pengangkutan", "Sewa Tapak", "Lesen", "Lain-lain",
];

export const OPEX_EMOJI: Record<OpExCategory, string> = {
  "Kos Bahan":    "🥩",
  "Utiliti":      "💡",
  "Pembungkusan": "📦",
  "Gaji":         "👷",
  "Pengangkutan": "🚚",
  "Sewa Tapak":   "🏪",
  "Lesen":        "📜",
  "Lain-lain":    "🏷️",
};

export interface OpExEntry {
  id: number;
  category: OpExCategory;
  desc: string;
  amount: number;
  time: string;
  ts: number;
  createdAt: string;
  paidFromPetty: boolean;
}

export interface ProductIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  predictedCost?: number;
  manualCost?: boolean;
  stockItemId?: string;
}

export interface ProductPackaging {
  type: string;
  costPerUnit: number;
}

export interface Product {
  id: string;
  emoji: string;
  name: string;
  description?: string;
  imageUrl?: string;
  ingredients?: ProductIngredient[];
  // Batch definition (new model)
  servingsPerBatch?: number;        // hidangan per 1 sesi masak
  servingUnit?: string;             // e.g. "bungkus", "biji", "pcs"
  cookingFrequencyDays?: number;    // 1 = setiap hari, 7 = sekali seminggu
  batchesFromIngredients?: number;  // berapa sesi masak boleh dari stok semasa
  // Legacy / backward-compat (still read by WasteTracker, CookingLogModal, Index)
  batchSize?: number;
  batchUnit?: string;
  cookingUnit?: string;
  servingsPerCookingUnit?: number;
  // Packaging per single unit
  packaging?: ProductPackaging;
  // Target profit scale 1-10
  targetProfitScale?: number;
  // Derived
  totalCost?: number;          // total batch cost (ingredients only)
  costPerUnit?: number;        // (totalCost / batchSize) + packaging.costPerUnit
  suggestedPrice?: number;     // per unit
  margin?: number;             // %
  // Legacy / optional
  sellingPrice?: number;
  costPrice?: number;
  category?: string;
  note?: string;
}

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export interface DayHours {
  day: DayKey;
  open: string;          // "HH:mm"
  close: string;         // "HH:mm"
  isClosed: boolean;
  // optional split (e.g. lunch break)
  hasSplit?: boolean;
  splitOpen?: string;
  splitClose?: string;
}

export interface BusinessHoursSettings {
  hours: DayHours[];
  vacationMode: boolean;
  vacationFrom?: string;  // ISO date
  vacationTo?: string;    // ISO date
  autoReplyEnabled: boolean;
  autoReplyMessage?: string;
  bufferMinutes: number;  // 0 - 120
}

export type SupplierCategory =
  | "Bahan Mentah"
  | "Minuman"
  | "Pembungkusan"
  | "Gas & Utiliti"
  | "Lain-lain";

export const SUPPLIER_CATEGORIES: SupplierCategory[] = [
  "Bahan Mentah", "Minuman", "Pembungkusan", "Gas & Utiliti", "Lain-lain",
];

export interface Supplier {
  id: string;
  name: string;
  category: SupplierCategory;
  phone: string;
  items: string;
  note?: string;
}

export type OutletType =
  | "Gerai"
  | "Kedai Lot"
  | "Kiosk"
  | "Lori Makanan"
  | "Online Sahaja"
  | "Lain-lain";

export const OUTLET_TYPES: OutletType[] = [
  "Gerai", "Kedai Lot", "Kiosk", "Lori Makanan", "Online Sahaja", "Lain-lain",
];

export interface OutletSettings {
  outletName: string;
  type: OutletType;
  address: string;
  isOpenToday: boolean;
  closedReason?: string;
  ssm?: string; // SSM / ROB registration number
}

export const DEFAULT_OUTLET: OutletSettings = {
  outletName: "",
  type: "Gerai",
  address: "",
  isOpenToday: true,
  ssm: "",
};


export type PaymentMethodType = "card" | "ewallet" | "bank";

export interface SavedCard {
  id: string;
  type: PaymentMethodType;
  // Card fields
  cardNumber?: string;
  cardHolder?: string;
  expiryMonth?: string;
  expiryYear?: string;
  network?: "visa" | "mastercard" | "amex" | "unknown";
  // E-wallet fields
  ewalletProvider?: string;
  ewalletPhone?: string;
  // Bank account fields
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  // Shared
  nickname?: string;
  isPrimary?: boolean;
  createdAt: string;
}

export interface CookingPreset {
  id: string;
  name: string;
  values: Record<string, number>; // productId -> batches
}
