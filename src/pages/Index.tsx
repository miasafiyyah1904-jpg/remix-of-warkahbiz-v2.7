import { useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import {
  Home, Package, BarChart3, Plus, MessageCircle,
  Calculator, Target, LineChart, Trash2, FileText, User,
} from "lucide-react";
import AppHeader from "@/components/AppHeader.jsx";
import SettingsPanel from "@/components/SettingsPanel.jsx";
import { BuyView } from "@/features/inventory/BuyView";
import { StockView } from "@/features/inventory/StockView";
import { LogView } from "@/features/money/LogView";
import { QuickInputModal } from "@/features/money/QuickInputModal";
import { ExportSheet } from "@/features/money/ExportSheet";
import { PnLReportSheet } from "@/features/money/PnLReportSheet";
import { IncomeStatementSheet } from "@/features/money/IncomeStatementSheet";
import { ProfitProjectionSheet } from "@/features/money/ProfitProjectionSheet";

import { ChatView } from "@/features/ai/ChatView";
import type { BusinessSnapshot } from "@/features/ai/buildSystemPrompt";
import { PricingCalculator } from "@/features/pricing/PricingCalculator";
import { GoalsPlanner } from "@/features/goals/GoalsPlanner";
import { SalesForecast } from "@/features/forecast/SalesForecast";
import { WasteTracker } from "@/features/waste/WasteTracker";
import { LaporanMalam } from "@/features/nightly/LaporanMalam";
import { NotificationCenter, getActiveOpportunityCount } from "@/features/notifications/NotificationCenter";
import { ProfileView } from "@/features/profile/ProfileView";
import { CookingLogModal } from "@/features/cooking/CookingLogModal";
import OnboardingTutorial from "@/components/OnboardingTutorial";
import { OnboardingBanner, getOnboardingDismissKey } from "@/components/OnboardingBanner";

import { CookingLogPrompt } from "@/features/cooking/CookingLogPrompt";
import { fmt } from "@/lib/format";
import { emojiForItem } from "@/lib/stockEmoji";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSupabaseData } from "@/hooks/useSupabaseData";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";
import type {
  Tab, Txn, BuyItem, StockItem, ChatMsg, PettyEntry, ReceiptItem, Unit, OpExEntry, OpExCategory, Product, SavedCard, BusinessHoursSettings, OutletSettings, CookingLog, FinishedStock,
} from "@/types";
import { DEFAULT_OUTLET } from "@/types";
import { DEFAULT_BUSINESS_HOURS } from "@/features/profile/BusinessHoursView";
import { OPEX_CATEGORIES, OPEX_EMOJI } from "@/types";

const Index = () => {
  const { userId, user, signOut } = useAuth();
  const { t, language } = useTranslation();
  const [tab, setTab] = useState<Tab>("today");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Txn | null>(null);

  const [exportOpen, setExportOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [incomeStatementOpen, setIncomeStatementOpen] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [forecastOpen, setForecastOpen] = useState(false);
  const [wasteOpen, setWasteOpen] = useState(false);
  const [autopsyOpen, setAutopsyOpen] = useState(false);
  const [projectionOpen, setProjectionOpen] = useState(false);
  const [nightlyBannerShown, setNightlyBannerShown] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cookingLogOpen, setCookingLogOpen] = useState(false);

  const [profileName, setProfileName] = useLocalStorage<string>("warkahbiz_profile_name", "");
  const [businessName, setBusinessName] = useLocalStorage<string>("warkahbiz_business_name", "");

  const [txns, setTxns] = useSupabaseData<Txn[]>("warkahbiz_txns", []);
  const [stock, setStock] = useSupabaseData<StockItem[]>("warkahbiz_stock", []);
  const [buy, setBuy] = useSupabaseData<BuyItem[]>("warkahbiz_buy", []);
  const [petty, setPetty] = useSupabaseData<PettyEntry[]>("warkahbiz_petty", []);
  const [pettyMonthlyLimit, setPettyMonthlyLimit] = useSupabaseData<number>("warkahbiz_petty_monthly_limit", 0);
  const [opex, setOpex] = useSupabaseData<OpExEntry[]>("warkahbiz_opex", []);
  const [products, setProducts] = useSupabaseData<Product[]>("warkahbiz_products", []);
  const [cookingLog, setCookingLog] = useSupabaseData<CookingLog[]>("warkahbiz_cooking_log", []);
  const [cards, setCards] = useSupabaseData<SavedCard[]>("warkahbiz_cards", []);
  const [businessHours, setBusinessHours] = useSupabaseData<BusinessHoursSettings>("warkahbiz_business_hours", DEFAULT_BUSINESS_HOURS);
  const [outlet, setOutlet] = useSupabaseData<OutletSettings>("warkahbiz_outlet", DEFAULT_OUTLET);
  const [dismissedAuto, setDismissedAuto] = useState<Set<string>>(new Set());
  const [chat, setChat] = useSupabaseData<ChatMsg[]>("warkahbiz_chat", []);
  const [chatLoading, setChatLoading] = useState(false);

  const WELCOME_MSG: ChatMsg = { id: 1, from: "bot", text: "Hai Boss! Tanya saya apa-apa pasal untung, stok, atau harga. 😊" };
  const displayChat = chat.length === 0 ? [WELCOME_MSG] : chat;

  // 9PM nightly report banner — show once per day after 8PM
  useEffect(() => {
    if (!userId) return;
    const check = () => {
      const now = new Date();
      if (now.getHours() < 20) return;
      const todayKey = `warkahbiz_nightly_banner_${now.toISOString().slice(0, 10)}_${userId}`;
      if (localStorage.getItem(todayKey)) return;
      if (autopsyOpen) return;
      setNightlyBannerShown(true);
      localStorage.setItem(todayKey, "1");
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [autopsyOpen, userId]);

  // Pre-fill profile from auth session on first login
  useEffect(() => {
    if (!userId || !user) return;
    if (!profileName && user.user_metadata?.full_name) {
      setProfileName(user.user_metadata.full_name);
    }
    const emailKey = `warkahbiz_profile_email_${userId}`;
    if (!localStorage.getItem(emailKey) && user.email) {
      localStorage.setItem(emailKey, user.email);
    }
  }, [user, userId, profileName, setProfileName]);

  const isPeribadi = (label: string, emoji: string) =>
    emoji === "🧑" || /peribadi/i.test(label);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dateKeyOf = (createdAt?: string, ts?: number) => {
    const d = createdAt ? new Date(createdAt) : new Date(ts ?? Date.now());
    return d.toISOString().slice(0, 10);
  };

  const today = useMemo(() => {
    const todays = txns.filter((x) => dateKeyOf(x.createdAt, x.ts) === todayKey && !isPeribadi(x.label, x.emoji));
    const incoming = todays.filter((x) => x.type === "in").reduce((s, x) => s + x.amount, 0);
    const outgoing = todays.filter((x) => x.type === "out").reduce((s, x) => s + x.amount, 0);
    return { in: incoming, out: outgoing, profit: incoming - outgoing };
  }, [txns, todayKey]);

  const week = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = txns.filter((x) => x.ts >= cutoff && !isPeribadi(x.label, x.emoji));
    const i = recent.filter((x) => x.type === "in").reduce((s, x) => s + x.amount, 0);
    const o = recent.filter((x) => x.type === "out").reduce((s, x) => s + x.amount, 0);
    return { in: i, out: o, profit: i - o };
  }, [txns]);

  const lastWeek = useMemo(() => {
    const now = Date.now();
    const start = now - 14 * 24 * 60 * 60 * 1000;
    const end = now - 7 * 24 * 60 * 60 * 1000;
    const recent = txns.filter((x) => x.ts >= start && x.ts < end && !isPeribadi(x.label, x.emoji));
    const i = recent.filter((x) => x.type === "in").reduce((s, x) => s + x.amount, 0);
    const o = recent.filter((x) => x.type === "out").reduce((s, x) => s + x.amount, 0);
    return { in: i, out: o, profit: i - o };
  }, [txns]);

  const month = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = txns.filter((x) => x.ts >= cutoff && !isPeribadi(x.label, x.emoji));
    const i = recent.filter((x) => x.type === "in").reduce((s, x) => s + x.amount, 0);
    const o = recent.filter((x) => x.type === "out").reduce((s, x) => s + x.amount, 0);
    return { in: i, out: o, profit: i - o };
  }, [txns]);

  const todayCogs = useMemo(() => {
    return opex
      .filter((e) => e.category === "Kos Bahan" && dateKeyOf(e.createdAt, e.ts) === todayKey)
      .reduce((s, e) => s + e.amount, 0);
  }, [opex, todayKey]);

  const todayOtherOpex = useMemo(() => {
    return opex.filter((e) => e.category !== "Kos Bahan" && dateKeyOf(e.createdAt, e.ts) === todayKey).reduce((s, e) => s + e.amount, 0);
  }, [opex, todayKey]);

  const todayNetProfit = useMemo(() => today.in - todayCogs - todayOtherOpex, [today.in, todayCogs, todayOtherOpex]);

  const nowTime = () =>
    new Date().toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase().replace(" ", "");

  const handleSaveTxn = (t: Omit<Txn, "id" | "ts" | "time">) => {
    setTxns((prev) => [...prev, { ...t, id: Date.now(), ts: Date.now(), time: nowTime(), createdAt: new Date().toISOString() }]);
  };

  // Track the highest qty ever recorded for each stock item (used to auto-derive minQty)
  const bumpPeak = (item: StockItem): StockItem => {
    const peak = Math.max(item.maxQty ?? 0, item.qty);
    const minQty = +(peak * 0.2).toFixed(2);
    return { ...item, maxQty: peak, minQty };
  };

  const handleReceiptConfirm = (items: ReceiptItem[]) => {
    const time = nowTime();
    const newTxns: Txn[] = items.map((r, i) => ({ id: Date.now() + i, ts: Date.now() + i, time, createdAt: new Date().toISOString(), type: "out", emoji: r.emoji, label: `Beli ${r.name}`, amount: r.price }));
    setTxns((prev) => [...prev, ...newTxns]);
    toast.success(`${items.length} item berjaya disimpan! 🎉`);
  };

  const handleLogCooking = (entries: { productId: string; batches: number }[]) => {
    if (entries.length === 0) return;
    const now = new Date();
    const nowIso = now.toISOString();
    const ts = Date.now();

    // Aggregate ingredient deductions across all entries.
    // Prefer stockItemId (explicit link); fall back to name match.
    const deductionsById = new Map<string, number>();
    const deductionsByName = new Map<string, number>();
    const involved: { product: Product; batches: number }[] = [];
    entries.forEach(({ productId, batches }) => {
      const product = products.find((p) => p.id === productId);
      if (!product || batches <= 0) return;
      involved.push({ product, batches });
      (product.ingredients ?? []).forEach((ing) => {
        const need = ing.quantity * batches;
        if (ing.stockItemId) {
          deductionsById.set(ing.stockItemId, (deductionsById.get(ing.stockItemId) ?? 0) + need);
        } else {
          const key = ing.name.trim().toLowerCase();
          if (!key) return;
          deductionsByName.set(key, (deductionsByName.get(key) ?? 0) + need);
        }
      });
    });

    setStock((prev) => prev.map((s) => {
      const needById = deductionsById.get(s.id);
      const needByName = deductionsByName.get(s.name.trim().toLowerCase());
      const need = (needById ?? 0) + (needByName ?? 0);
      if (need <= 0) return s;
      const newQty = Math.max(0, +(s.qty - need).toFixed(2));
      return { ...s, qty: newQty, lastUsedAt: nowIso };
    }));

    setCookingLog((prev) => [
      ...prev,
      ...involved.map(({ product, batches }, i) => ({
        id: ts + i,
        ts: ts + i,
        createdAt: nowIso,
        productId: product.id,
        productName: product.name,
        productEmoji: product.emoji,
        batches,
        batchUnit: product.cookingUnit ?? product.batchUnit ?? "batch",
      })),
    ]);
  };

  const handleBought = (id: string) => setBuy((prev) => prev.map((b) => b.id === id ? { ...b, done: !b.done } : b));

  const handleAdjustStock = (id: string, delta: number) => {
    setStock((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      const qty = Math.max(0, +(s.qty + delta).toFixed(2));
      return bumpPeak({ ...s, qty });
    }));
  };

  const handleSaveStock = (item: StockItem) => {
    setStock((prev) => {
      const next = bumpPeak(item);
      const exists = prev.find((s) => s.id === item.id);
      return exists ? prev.map((s) => s.id === item.id ? next : s) : [...prev, next];
    });
    toast.success("Stok disimpan ✅");
  };

  const handleDeleteStock = (id: string) => { setStock((prev) => prev.filter((s) => s.id !== id)); toast.success("Item dipadam"); };

  useEffect(() => {
    setBuy((prevBuy) => {
      let nextBuy = [...prevBuy];
      stock.forEach((s) => {
        if (s.qty > s.restockQty) return;
        const autoId = `auto-${s.id}`;
        if (dismissedAuto.has(autoId)) return;
        if (nextBuy.some((b) => b.id === autoId)) return;
        if (nextBuy.some((b) => b.name.toLowerCase() === s.name.toLowerCase() && b.source !== "auto")) return;
        const need = Math.max(s.restockQty - s.qty, s.restockQty);
        nextBuy.push({ id: autoId, emoji: s.emoji, name: s.name, cost: 0, currentQty: s.qty, recQty: +need.toFixed(1), unit: s.unit, daysCover: 0, reason: s.qty <= s.minQty ? "Habis!" : "Hampir habis", done: false, source: "auto" });
      });
      nextBuy = nextBuy.filter((b) => {
        if (b.source !== "auto") return true;
        const s = stock.find((x) => x.id === b.id.replace(/^auto-/, ""));
        return !s || s.qty <= s.restockQty || b.done;
      });
      return nextBuy;
    });
  }, [stock, dismissedAuto]);

  const handleResync = () => { setDismissedAuto(new Set()); toast.success("Senarai dikemaskini dari Stok"); };

  const handleAddBuy = (d: { emoji: string; name: string; recQty: number; unit: Unit; note?: string }) => {
    setBuy((prev) => [...prev, { id: `m-${Date.now()}`, emoji: d.emoji || "🛒", name: d.name, cost: 0, currentQty: 0, recQty: d.recQty, unit: d.unit, daysCover: 0, reason: "", done: false, source: "manual", note: d.note }]);
  };

  const handleDeleteBuy = (id: string) => {
    setBuy((prev) => prev.filter((b) => b.id !== id));
    if (id.startsWith("auto-")) setDismissedAuto((prev) => new Set(prev).add(id));
  };

  const handleBulkDone = (ids: string[]) => setBuy((prev) => prev.map((b) => ids.includes(b.id) ? { ...b, done: true } : b));

  const handleBulkDelete = (ids: string[]) => {
    setBuy((prev) => prev.filter((b) => !ids.includes(b.id)));
    setDismissedAuto((prev) => { const next = new Set(prev); ids.filter((id) => id.startsWith("auto-")).forEach((id) => next.add(id)); return next; });
  };

  const handleClearCompleted = () => {
    setBuy((prev) => {
      const autoIds = prev.filter((b) => b.done && b.id.startsWith("auto-")).map((b) => b.id);
      if (autoIds.length) setDismissedAuto((d) => { const next = new Set(d); autoIds.forEach((id) => next.add(id)); return next; });
      return prev.filter((b) => !b.done);
    });
  };

  const handleAddPetty = (type: "in" | "out", amount: number, desc: string, emoji: string) => {
    setPetty((prev) => {
      const last = prev[prev.length - 1]?.balance ?? 0;
      const balance = +(type === "in" ? last + amount : last - amount).toFixed(2);
      const now = new Date();
      return [...prev, { id: Date.now(), type, desc, emoji, amount, time: nowTime(), balance, createdAt: now.toISOString(), ts: now.getTime() }];
    });
  };

  const handleAddOpEx = (category: OpExCategory, amount: number, desc: string, paidFromPetty: boolean) => {
    const now = new Date();
    const entry: OpExEntry = { id: Date.now(), category, desc, amount, paidFromPetty, ts: Date.now(), createdAt: now.toISOString(), time: now.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase().replace(" ", "") };
    setOpex((prev) => [...prev, entry]);
    if (paidFromPetty) {
      setPetty((prev) => { const last = prev[prev.length - 1]?.balance ?? 0; return [...prev, { id: Date.now() + 1, type: "out" as const, desc: `[OpEx] ${category}: ${desc}`, emoji: "💸", amount, time: entry.time, balance: +(last - amount).toFixed(2), createdAt: now.toISOString(), ts: now.getTime() }]; });
    }
  };

  const handleDeleteOpex = (id: number) => {
    setOpex(prev => prev.filter(e => e.id !== id));
    toast.success(t("opex_deleted"));
  };

  const handleSendChat = async (text: string, snapshot: BusinessSnapshot) => {
    const userMsg: ChatMsg = { id: Date.now(), from: "user", text };
    setChat((prev) => [...prev, userMsg].slice(-50));
    setChatLoading(true);
    try {
      const { sendToClaudeAPI } = await import("@/features/ai/claudeChat");
      const reply = await sendToClaudeAPI(text, [...chat, userMsg], snapshot);
      setChat((prev) => [...prev, { id: Date.now(), from: "bot" as const, text: reply }].slice(-50));
    } catch {
      setChat((prev) => [...prev, { id: Date.now(), from: "bot" as const, text: "Maaf Boss, ada masalah sambungan. Cuba lagi sebentar. 🙏" }].slice(-50));
    } finally {
      setChatLoading(false);
    }
  };

  const handleSaveProduct = (p: Product) => {
    const isFirstEver = products.length === 0;
    setProducts((prev) => {
      const exists = prev.find((x) => x.id === p.id);
      return exists ? prev.map((x) => x.id === p.id ? p : x) : [...prev, p];
    });
    if (isFirstEver) {
      // Wipe stock, buy list, and purchase history
      setStock([]);
      setBuy([]);
      setDismissedAuto(new Set());
      setTxns((prev) => prev.filter((t) => !(t.type === "out" && t.label.startsWith("Beli "))));
      toast.success("Profil produk disimpan. Data lama telah dipadamkan.");
    }
    // Seed stock entries from product ingredients (only those not yet tracked)
    setStock((prev) => {
      const next = [...prev];
      (p.ingredients ?? []).forEach((ing) => {
        const name = ing.name.trim();
        if (!name) return;
        const exists = next.find((s) => s.name.toLowerCase() === name.toLowerCase());
        if (exists) return;
        next.push({
          id: `s-${ing.id}`,
          emoji: emojiForItem(name),
          name,
          qty: 0,
          unit: ing.unit,
          minQty: 0,
          restockQty: Math.max(ing.quantity, 1),
          maxQty: 0,
          category: "Bahan Mentah",
        });
      });
      return next;
    });
  };

  const handleDeleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSaveCard = (c: SavedCard) => {
    setCards((prev) => {
      const exists = prev.find((x) => x.id === c.id);
      return exists ? prev.map((x) => x.id === c.id ? c : x) : [...prev, c];
    });
  };

  const handleDeleteCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSetPrimaryCard = (id: string) => {
    setCards((prev) => prev.map((c) => ({ ...c, isPrimary: c.id === id })));
  };

  const handleBoughtItems = (items: Array<{ name: string; qty: number; unit: string; isOpEx?: boolean }>) => {
    const isMatch = (a: string, b: string) => { const x = a.toLowerCase().trim(); const y = b.toLowerCase().trim(); return x === y || x.includes(y) || y.includes(x); };
    const nowIso = new Date().toISOString();
    items.forEach((item) => {
      setStock(prev => {
        const idx = prev.findIndex(s => isMatch(s.name, item.name));
        if (idx === -1) {
          // New ingredient — create a stock entry
          const newItem: StockItem = {
            id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            emoji: emojiForItem(item.name),
            name: item.name,
            qty: +item.qty.toFixed(2),
            unit: (item.unit as Unit) || "unit",
            minQty: 0,
            restockQty: 0,
            maxQty: item.qty,
            category: "Bahan Mentah",
            lastRestockedAt: nowIso,
          };
          return [...prev, newItem];
        }
        const updated = [...prev];
        const merged = { ...updated[idx], qty: +(updated[idx].qty + item.qty).toFixed(2), lastRestockedAt: nowIso };
        updated[idx] = bumpPeak(merged);
        return updated;
      });
      setBuy(prev => prev.map(b => isMatch(b.name, item.name) && !b.done ? { ...b, done: true } : b));
    });
    toast.success(`${items.length} item dikemaskini dalam Stok & Senarai ✅`);
  };

  const handleSyncNotepad = (items: BuyItem[]) => setBuy(items);

  const saveProfile = (name: string, biz: string) => {
    setProfileName(name); setBusinessName(biz);
    setSettingsOpen(false);
    toast.success("Profil disimpan ✅");
  };

  const urgentCount = buy.filter((b) => !b.done).length;
  const notifCount = getActiveOpportunityCount();

  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialKey, setTutorialKey] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const key = `warkahbiz_tutorial_done_${userId}`;
    if (localStorage.getItem(key) !== "true") {
      const t = setTimeout(() => setShowTutorial(true), 600);
      return () => clearTimeout(t);
    }
  }, [userId]);

  // Onboarding banner state
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [goalsTick, setGoalsTick] = useState(0);
  useEffect(() => {
    if (!userId) return;
    setOnboardingOpen(localStorage.getItem(getOnboardingDismissKey(userId)) !== "1");
  }, [userId]);
  // Refresh goals detection whenever goals planner closes
  useEffect(() => {
    if (!goalsOpen) setGoalsTick((n) => n + 1);
  }, [goalsOpen]);
  const dismissOnboarding = () => {
    try { localStorage.setItem(getOnboardingDismissKey(userId), "1"); } catch {}
    setOnboardingOpen(false);
  };
  const reopenOnboarding = () => {
    try { localStorage.removeItem(getOnboardingDismissKey(userId)); } catch {}
    setGoalsTick((n) => n + 1);
    setOnboardingOpen(true);
    setTab("today");
  };
  const hasStockMin = useMemo(() => stock.some((s) => (s.minQty ?? 0) > 0), [stock]);
  const hasUserChatMsg = useMemo(() => chat.some((m) => m.from === "user"), [chat]);

  return (
    <div className="bg-gradient-shell min-h-screen text-foreground">
      <div className="mx-auto w-full max-w-[440px] min-h-screen relative bg-background shadow-card overflow-hidden flex flex-col">
        <AppHeader
          businessName={businessName || profileName}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenNotifications={() => setNotifOpen(true)}
          notificationCount={notifCount}
          showNotificationDot={urgentCount > 0 || notifCount > 0}
          onReplayTutorial={() => { setTutorialKey((k) => k + 1); setShowTutorial(true); }}
          onShowGettingStarted={reopenOnboarding}
        />

        <div className="flex-1 overflow-y-auto pb-32 pt-0">
          {tab === "today" && (
            <>
              <OnboardingBanner
                userId={userId}
                productsCount={products.length}
                txnsCount={txns.length}
                hasStockMin={hasStockMin}
                hasUserChatMsg={hasUserChatMsg}
                goalsTick={goalsTick}
                open={onboardingOpen}
                onDismiss={dismissOnboarding}
                actions={{
                  onAddProduct: () => setTab("profile"),
                  onLogSale: () => setModalOpen(true),
                  onSetMinStock: () => setTab("bekalan"),
                  onSetGoal: () => setGoalsOpen(true),
                  onAskAI: () => setTab("ai"),
                }}
              />
              <TodayView
                today={today}
                profileName={profileName} businessName={businessName}
                duitKeluar={todayCogs + todayOtherOpex + today.out}
                cookingLog={cookingLog}
                onOpenCookingLog={() => setCookingLogOpen(true)}
                onOpenCalc={() => setCalcOpen(true)}
                onOpenGoals={() => setGoalsOpen(true)}
                onOpenForecast={() => setForecastOpen(true)}
                onOpenWaste={() => setWasteOpen(true)}
                onOpenAutopsy={() => setAutopsyOpen(true)}
                onOpenProjection={() => setProjectionOpen(true)}
                txns={txns}
                onEditTxn={(t) => { setEditingTxn(t); setModalOpen(true); }}
              />
            </>
          )}
          {tab === "bekalan" && (
            <div className="pb-32 [&>*:first-child]:pb-2 [&>*:nth-child(3)]:pt-2">
              <BuyView buy={buy} stock={stock} products={products} onToggleDone={handleBought} onResync={handleResync} onBulkDone={handleBulkDone} onBulkDelete={handleBulkDelete} onClearCompleted={handleClearCompleted} onSyncNotepad={handleSyncNotepad} onGoToStock={() => {}} />
              <div className="mx-5 my-2 border-t border-border" />
              <StockView
                stock={stock}
                products={products}
                onGoToBuy={() => {}}
                onAdjust={handleAdjustStock}
                onSave={handleSaveStock}
              />
            </div>
          )}
          {tab === "log" && (
            <LogView txns={txns} today={today} week={week} month={month} opex={opex} todayCogs={todayCogs} todayOtherOpex={todayOtherOpex} todayNetProfit={todayNetProfit} onExport={() => setExportOpen(true)} onExportReport={() => setReportOpen(true)} onOpenIncomeStatement={() => setIncomeStatementOpen(true)} onAddOpEx={handleAddOpEx} onDeleteOpex={handleDeleteOpex} onEditTxn={(t) => { setEditingTxn(t); setModalOpen(true); }} />
          )}
          {tab === "ai" && (
            <ChatView messages={displayChat} onSend={handleSendChat} onClear={() => setChat([])} isLoading={chatLoading} txns={txns} stock={stock} opex={opex} petty={petty} businessName={businessName || profileName || "WarkahBiz"} products={products} />
          )}
          {tab === "profile" && (
            <ProfileView
              stock={stock}
              profileName={profileName}
              businessName={businessName}
              onSaveProfile={saveProfile}
              onAdjustStock={handleAdjustStock}
              onSaveStock={handleSaveStock}
              onDeleteStock={handleDeleteStock}
              onGoToBuy={() => setTab("bekalan")}
              products={products}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              cards={cards}
              onSaveCard={handleSaveCard}
              onDeleteCard={handleDeleteCard}
              onSetPrimaryCard={handleSetPrimaryCard}
              businessHours={businessHours}
              onSaveBusinessHours={setBusinessHours}
              outlet={outlet}
              onSaveOutlet={setOutlet}
            />
          )}
        </div>

        <button data-tutorial="fab-add" onClick={() => setModalOpen(true)} className={`fixed left-1/2 -translate-x-1/2 bottom-24 z-30 w-16 h-16 rounded-full bg-gradient-profit text-profit-foreground grid place-items-center shadow-fab tap ${urgentCount > 0 ? "animate-pulse-ring" : ""}`}>
          <Plus className="w-8 h-8" strokeWidth={3} />
        </button>

        <nav className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-[440px] z-20 bg-surface/90 backdrop-blur-xl border-t border-border">
          <div className="grid grid-cols-5 pt-2 pb-6 px-1">
            <TabBtn dataTutorial="tab-today" icon={<Home />} label={t("tabToday")} active={tab === "today"} onClick={() => setTab("today")} />
            <TabBtn dataTutorial="tab-bekalan" icon={<Package />} label={t("tabSupplies")} active={tab === "bekalan"} onClick={() => setTab("bekalan")} badge={urgentCount || undefined} />
            <TabBtn dataTutorial="tab-log" icon={<BarChart3 />} label={t("tabRecord")} active={tab === "log"} onClick={() => setTab("log")} />
            <TabBtn dataTutorial="tab-ai" icon={<MessageCircle />} label={t("tabAskAI")} active={tab === "ai"} onClick={() => setTab("ai")} />
            <TabBtn dataTutorial="tab-profile" icon={<User />} label={t("tabProfile")} active={tab === "profile"} onClick={() => setTab("profile")} />
          </div>
        </nav>

        {modalOpen && <QuickInputModal products={products} editingTxn={editingTxn} onUpdate={(t) => { setTxns(prev => prev.map(x => x.id === t.id ? t : x)); setEditingTxn(null); }} onClose={() => { setModalOpen(false); setEditingTxn(null); }} onSave={(t) => { handleSaveTxn(t); }} onReceiptConfirm={(items) => { handleReceiptConfirm(items); setModalOpen(false); }} onBoughtItems={handleBoughtItems} />}
        {exportOpen && <ExportSheet onClose={() => setExportOpen(false)} txns={txns} products={products} opex={opex} />}
        {reportOpen && <PnLReportSheet onClose={() => setReportOpen(false)} onOpenFullExport={() => setExportOpen(true)} txns={txns} opex={opex} petty={petty} businessName={businessName} />}
        {incomeStatementOpen && <IncomeStatementSheet onClose={() => setIncomeStatementOpen(false)} txns={txns} opex={opex} outlet={outlet} businessName={businessName || profileName} />}
        {projectionOpen && <ProfitProjectionSheet onClose={() => setProjectionOpen(false)} txns={txns} opex={opex} />}

        {settingsOpen && <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} profileName={profileName || "Boss"} businessName={businessName || "WarkahBiz"} onSaveProfile={saveProfile} onLogout={signOut} />}
        {calcOpen && <PricingCalculator onClose={() => setCalcOpen(false)} businessName={businessName || profileName} onSave={() => setCalcOpen(false)} />}
        {goalsOpen && <GoalsPlanner onClose={() => setGoalsOpen(false)} businessName={businessName || profileName} />}
        {forecastOpen && <SalesForecast onClose={() => setForecastOpen(false)} businessName={businessName || profileName} txns={txns} products={products} onSendToBuy={(items) => items.forEach(handleAddBuy)} finishedStock={[]} />}
        {wasteOpen && <WasteTracker onClose={() => setWasteOpen(false)} businessName={businessName || profileName} products={products} stock={stock} onSendToBuy={(items) => items.forEach(handleAddBuy)} />}
        {autopsyOpen && (
          <LaporanMalam
            onClose={() => setAutopsyOpen(false)}
            businessName={businessName || profileName}
            txns={txns}
            opex={opex}
            stock={stock}
          />
        )}
        {notifOpen && <NotificationCenter onClose={() => setNotifOpen(false)} />}
        {nightlyBannerShown && !autopsyOpen && (
          <button
            onClick={() => { setNightlyBannerShown(false); setAutopsyOpen(true); }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-[420px] w-[92%] bg-gradient-profit text-profit-foreground rounded-2xl px-4 py-3 shadow-glow tap flex items-center gap-3 animate-pop-in"
          >
            <span className="text-2xl">📊</span>
            <div className="flex-1 text-left">
              <p className="text-sm font-extrabold">{t("nightlyBannerTitle")}</p>
              <p className="text-[11px] opacity-90">{t("nightlyBannerSub")}</p>
            </div>
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); setNightlyBannerShown(false); }}
              className="text-xs opacity-80 px-2"
            >✕</span>
          </button>
        )}
        {cookingLogOpen && (
          <CookingLogModal
            open={cookingLogOpen}
            products={products}
            stock={stock}
            cookingLog={cookingLog}
            onClose={() => setCookingLogOpen(false)}
            onConfirm={handleLogCooking}
          />
        )}
        {showTutorial && userId && (
          <OnboardingTutorial
            key={tutorialKey}
            userId={userId}
            onNavigate={(t: Tab) => setTab(t)}
            onComplete={() => setShowTutorial(false)}
          />
        )}
      </div>
    </div>
  );
};

const TabBtn = ({ icon, label, active, onClick, badge, dataTutorial }: { icon: ReactNode; label: string; active: boolean; onClick: () => void; badge?: number; dataTutorial?: string }) => (
  <button data-tutorial={dataTutorial} onClick={onClick} className="flex flex-col items-center gap-1 py-1 tap relative">
    <div className={`w-12 h-9 grid place-items-center rounded-2xl transition-all ${active ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
      <div className="w-5 h-5">{icon}</div>
    </div>
    <span className={`text-[11px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
    {badge ? <span className="absolute top-0 right-3 min-w-5 h-5 px-1 grid place-items-center text-[10px] font-bold bg-cost text-cost-foreground rounded-full animate-pop-in">{badge}</span> : null}
  </button>
);

const TodayView = ({
  today, profileName, businessName, duitKeluar,
  cookingLog, onOpenCookingLog,
  onOpenCalc, onOpenGoals, onOpenForecast, onOpenWaste, onOpenAutopsy, onOpenProjection,
  txns, onEditTxn,
}: {
  today: { in: number; out: number; profit: number };
  profileName: string; businessName: string;
  duitKeluar: number;
  cookingLog: CookingLog[]; onOpenCookingLog: () => void;
  onOpenCalc: () => void; onOpenGoals: () => void; onOpenForecast: () => void;
  onOpenWaste: () => void; onOpenAutopsy: () => void; onOpenProjection: () => void;
  txns: Txn[];
  onEditTxn: (t: Txn) => void;
}) => {
  void onOpenCalc;
  const isPeribadi = (label: string, emoji: string) =>
    emoji === "🧑" || /peribadi/i.test(label);
  const { t, language } = useTranslation();
  const [insight, setInsight] = useState<string | null>(null);
  const dateLocale = language === "en" ? "en-MY" : "ms-MY";
  const todayLabel = new Date().toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t("greetingMorning");
    if (h < 15) return t("greetingNoon");
    if (h < 19) return t("greetingAfternoon");
    return t("greetingNight");
  };
  const todayKey = new Date().toISOString().slice(0, 10);
  const recentTxns = txns
    .filter(x =>
      (x.createdAt?.slice(0, 10) ?? new Date(x.ts).toISOString().slice(0, 10)) === todayKey &&
      !isPeribadi(x.label, x.emoji)
    )
    .slice(-5)
    .reverse();
  return (
    <div className="px-5 pt-6 space-y-5">
      <header className="animate-fade-in space-y-1">
        <p className="text-muted-foreground text-sm font-medium">{greeting()}, {profileName || "Boss"}! 👋</p>
        <h1 className="text-2xl font-extrabold tracking-tight">{businessName || "WarkahBiz"}</h1>
        <p className="text-xs text-muted-foreground font-semibold">📅 {todayLabel}</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl p-6 bg-gradient-income text-white shadow-card animate-fade-in">
          <div className="text-xs font-bold uppercase tracking-wider opacity-90">{t("moneyIn")}</div>
          <div className="text-3xl font-extrabold mt-3">{fmt(today.in)}</div>
          <div className="text-[11px] opacity-80 mt-1">{t("homeToday")}</div>
        </div>
        <div className="rounded-3xl p-6 bg-gradient-cost text-white shadow-card animate-fade-in">
          <div className="text-xs font-bold uppercase tracking-wider opacity-90">{t("moneyOut")}</div>
          <div className="text-3xl font-extrabold mt-3">{fmt(duitKeluar)}</div>
          <div className="text-[11px] opacity-80 mt-1">{t("homeToday")}</div>
        </div>
      </div>

      {recentTxns.length > 0 && (
        <section className="space-y-3 animate-fade-in">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">
            {t("home_recentTxns")}
          </h2>
          <div className="space-y-2">
            {recentTxns.map(txn => (
              <button
                key={txn.id}
                onClick={() => onEditTxn(txn)}
                className="w-full rounded-2xl p-3 bg-surface border border-border flex items-center gap-3 tap text-left"
              >
                <div className="w-10 h-10 rounded-xl grid place-items-center text-xl bg-muted/40">
                  {txn.emoji || (txn.type === "in" ? "💰" : "🛒")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{txn.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(txn.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div className={`font-extrabold text-sm ${txn.type === "in" ? "text-profit" : "text-cost"}`}>
                  {txn.type === "in" ? "+" : "−"}RM {txn.amount.toFixed(2)}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <CookingLogPrompt logs={cookingLog} onOpen={onOpenCookingLog} />


      <section className="space-y-3 animate-fade-in">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">{t("toolsAiHeader")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onOpenGoals} className="rounded-2xl p-4 bg-surface border border-border tap text-left space-y-1 hover:border-primary/40 transition-colors">
            <Target className="w-6 h-6 text-primary" />
            <div className="font-bold text-sm">{t("toolGoals")}</div>
            <div className="text-xs text-muted-foreground">{t("toolGoalsDesc")}</div>
          </button>
          <button onClick={onOpenForecast} className="rounded-2xl p-4 bg-surface border border-border tap text-left space-y-1 hover:border-primary/40 transition-colors">
            <LineChart className="w-6 h-6 text-primary" />
            <div className="font-bold text-sm">{t("toolForecast")}</div>
            <div className="text-xs text-muted-foreground">{t("toolForecastDesc")}</div>
          </button>
          <button onClick={onOpenWaste} className="rounded-2xl p-4 bg-surface border border-border tap text-left space-y-1 hover:border-primary/40 transition-colors">
            <Trash2 className="w-6 h-6 text-primary" />
            <div className="font-bold text-sm">{t("toolWaste")}</div>
            <div className="text-xs text-muted-foreground">{t("toolWasteDesc")}</div>
          </button>
          <button onClick={onOpenAutopsy} className="rounded-2xl p-4 bg-surface border border-border tap text-left space-y-1 hover:border-primary/40 transition-colors">
            <FileText className="w-6 h-6 text-primary" />
            <div className="font-bold text-sm">{t("toolNightly")}</div>
            <div className="text-xs text-muted-foreground">{t("toolNightlyDesc")}</div>
          </button>
          <button onClick={onOpenProjection} className="rounded-2xl p-4 bg-surface border border-border tap text-left space-y-1 hover:border-primary/40 transition-colors col-span-2">
            <LineChart className="w-6 h-6 text-primary" />
            <div className="font-bold text-sm">{t("toolProjection")}</div>
            <div className="text-xs text-muted-foreground">{t("toolProjectionDesc")}</div>
          </button>
        </div>
      </section>


      {insight && (
        <div className="fixed inset-0 z-40 grid place-items-center p-5" onClick={() => setInsight(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm bg-surface rounded-3xl p-6 animate-pop-in">
            <div className="text-3xl">💡</div>
            <h3 className="font-extrabold text-lg mt-2">{t("tipsTitle")}</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{insight}</p>
            <button onClick={() => setInsight(null)} className="mt-5 w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold tap">{t("tipsOk")}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
