// @ts-nocheck
/**
 * WarkahBiz COMPLETE Demo Data Seeder v3
 * =========================================
 * Gerai Nasi Lemak Pak Arif — Putrajaya
 * 180 hari data (Nov 2025 – Apr 2026)
 *
 * COVERS EVERY FEATURE:
 *  ✅ transactions (180 days, seasonal arc, Ramadan buka puasa sessions)
 *  ✅ opex_entries  (ALL 8 categories: Kos Bahan, Utiliti, Pembungkusan,
 *                   Gaji, Pengangkutan, Sewa Tapak, Lesen, Lain-lain)
 *  ✅ stock_items   (2 critical alerts baked in)
 *  ✅ buy_items     (5 items at varying urgency)
 *  ✅ petty_entries + petty_settings (monthly_limit)
 *  ✅ products      (9 items with full ingredients, packaging, margin)
 *  ✅ cooking_logs  (daily, with Ramadan & weekend variants)
 *  ✅ chat_history  (10 realistic AI exchanges)
 *  ✅ saved_cards   (TNG + Maybank)
 *  ✅ business_hours
 *  ✅ outlet_settings
 *  ✅ sisa_harian   (60 days waste tracker — device_id = userId)
 *  ✅ user_impian   (2 goals, 53% + 15% funded)
 *  ✅ nightly_reports (60 days pre-generated with AI fields)
 *  ✅ action_items_log (linked to nightly reports)
 *  ✅ forecasts     (30 days past accuracy data)
 *  ✅ profiles      (display name, phone)
 *  ✅ localStorage: warkahbiz_suppliers_{userId}
 *  ✅ localStorage: warkahbiz_cooking_presets (with product values)
 *  ✅ localStorage: warkahbiz_weekly_target + warkahbiz_weekly_budget
 *  ✅ localStorage: warkahbiz_profile_name + warkahbiz_business_name
 *
 * HOW TO USE IN LOVABLE:
 * 1. Replace src/components/DemoSeeder.tsx with this file
 * 2. Add <DemoSeeder /> as first child in Index.tsx return()
 * 3. Log in → press "Load Demo Data"
 * 4. Refresh page, then remove <DemoSeeder /> from Index.tsx
 */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const ts = (daysAgo: number, hour = 8, min = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, min, 0, 0);
  return d.getTime();
};

const iso = (daysAgo: number, hour = 8) =>
  new Date(ts(daysAgo, hour)).toISOString();

const isoDate = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
};

const timeFmt = (hour: number, min = 0) => {
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h}:${String(min).padStart(2, "0")}${hour >= 12 ? "pm" : "am"}`;
};

// Deterministic pseudo-random — same output every run
const rng = (day: number, salt: number) =>
  ((day * 17 + salt * 31) % 100) / 100;

// Seasonal daily revenue base
function salesBase(daysAgo: number): number {
  if (daysAgo >= 150) return 278;  // Nov — normal
  if (daysAgo >= 120) return 213;  // Dec — slow (school hols)
  if (daysAgo >= 90)  return 268;  // Jan — rebound
  if (daysAgo >= 60)  return 292;  // Feb — pre-Ramadan
  if (daysAgo >= 30)  return 492;  // Mar — Ramadan peak ⭐
  if (daysAgo >= 10)  return 197;  // Apr early — post-Raya dip
  return 270;                       // Apr mid — recovery
}

const isRamadan = (d: number) => d >= 30 && d < 60;
const isDecSlow = (d: number) => d >= 120 && d < 150;

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

const PRODUCTS = [
  {
    id: "prod-nasi-lemak", emoji: "🍛", name: "Nasi Lemak Biasa", category: "Makanan",
    servings_per_batch: 50, serving_unit: "bungkus", cooking_frequency_days: 1,
    batches_from_ingredients: 4, total_cost: 62.5, cost_per_unit: 1.25,
    suggested_price: 2.5, margin: 50, target_profit_scale: 6,
    packaging: { type: "bungkus nasi", costPerUnit: 0.08 },
    ingredients: [
      { id: "ing-1", name: "Beras", quantity: 5, unit: "kg", predictedCost: 18 },
      { id: "ing-2", name: "Santan", quantity: 4, unit: "liter", predictedCost: 16 },
      { id: "ing-3", name: "Ikan Bilis", quantity: 0.5, unit: "kg", predictedCost: 9 },
      { id: "ing-4", name: "Kacang Tanah", quantity: 0.5, unit: "kg", predictedCost: 4.5 },
      { id: "ing-5", name: "Timun", quantity: 10, unit: "biji", predictedCost: 5 },
      { id: "ing-6", name: "Telur", quantity: 25, unit: "biji", predictedCost: 10 },
    ],
    note: "Asas gerai. 4 periuk sehari, 5 semasa Sabtu & Ramadan.",
  },
  {
    id: "prod-ayam", emoji: "🍗", name: "Ayam Masak Merah", category: "Makanan",
    servings_per_batch: 30, serving_unit: "ketul", cooking_frequency_days: 1,
    batches_from_ingredients: 2, total_cost: 45, cost_per_unit: 1.5,
    suggested_price: 3.0, margin: 50, target_profit_scale: 6, packaging: null,
    ingredients: [
      { id: "ing-7", name: "Ayam", quantity: 1.5, unit: "kg", predictedCost: 18 },
      { id: "ing-8", name: "Cili Kering", quantity: 0.15, unit: "kg", predictedCost: 4 },
      { id: "ing-9", name: "Bawang Merah", quantity: 0.3, unit: "kg", predictedCost: 3 },
      { id: "ing-10", name: "Bawang Putih", quantity: 0.1, unit: "kg", predictedCost: 2 },
      { id: "ing-11", name: "Minyak Masak", quantity: 0.2, unit: "liter", predictedCost: 2 },
    ],
    note: "Lauk paling laris — habis sebelum 10AM hari biasa.",
  },
  {
    id: "prod-sotong", emoji: "🦑", name: "Sotong Sambal", category: "Makanan",
    servings_per_batch: 20, serving_unit: "ketul", cooking_frequency_days: 1,
    batches_from_ingredients: 1, total_cost: 55, cost_per_unit: 2.75,
    suggested_price: 4.0, margin: 31.25, target_profit_scale: 4, packaging: null,
    ingredients: [
      { id: "ing-12", name: "Sotong", quantity: 1, unit: "kg", predictedCost: 28 },
      { id: "ing-13", name: "Cili Kering", quantity: 0.1, unit: "kg", predictedCost: 3 },
      { id: "ing-14", name: "Bawang Merah", quantity: 0.2, unit: "kg", predictedCost: 2 },
    ],
    note: "Margin rendah (31%). Naik harga ke RM4.50 disyorkan.",
  },
  {
    id: "prod-paru", emoji: "🫀", name: "Paru-paru Goreng", category: "Makanan",
    servings_per_batch: 25, serving_unit: "ketul", cooking_frequency_days: 1,
    batches_from_ingredients: 3, total_cost: 19.5, cost_per_unit: 0.78,
    suggested_price: 2.5, margin: 68.8, target_profit_scale: 8, packaging: null,
    ingredients: [
      { id: "ing-15", name: "Paru-paru", quantity: 1, unit: "kg", predictedCost: 12 },
      { id: "ing-16", name: "Kunyit", quantity: 0.02, unit: "kg", predictedCost: 1 },
      { id: "ing-17", name: "Cili Kering", quantity: 0.08, unit: "kg", predictedCost: 2 },
    ],
    note: "Margin terbaik (68.8%). Promosikan lebih!",
  },
  {
    id: "prod-daging", emoji: "🥩", name: "Daging Masak Hitam", category: "Makanan",
    servings_per_batch: 20, serving_unit: "ketul", cooking_frequency_days: 1,
    batches_from_ingredients: 1, total_cost: 60, cost_per_unit: 3.0,
    suggested_price: 5.0, margin: 40, target_profit_scale: 5, packaging: null,
    ingredients: [
      { id: "ing-18", name: "Daging Lembu", quantity: 1, unit: "kg", predictedCost: 38 },
      { id: "ing-19", name: "Kicap Pekat", quantity: 0.1, unit: "liter", predictedCost: 3 },
      { id: "ing-20", name: "Halia", quantity: 0.05, unit: "kg", predictedCost: 2 },
    ],
    note: "Premium item — pelanggan setia beli tiap minggu.",
  },
  {
    id: "prod-bihun", emoji: "🍜", name: "Bihun Goreng", category: "Makanan",
    servings_per_batch: 40, serving_unit: "pinggan", cooking_frequency_days: 1,
    batches_from_ingredients: 2, total_cost: 48, cost_per_unit: 1.2,
    suggested_price: 3.5, margin: 65.7, target_profit_scale: 7, packaging: null,
    ingredients: [
      { id: "ing-21", name: "Bihun", quantity: 2, unit: "kg", predictedCost: 12 },
      { id: "ing-22", name: "Telur", quantity: 10, unit: "biji", predictedCost: 4 },
      { id: "ing-23", name: "Sayur Kobis", quantity: 0.5, unit: "kg", predictedCost: 3 },
      { id: "ing-24", name: "Kicap Masin", quantity: 0.1, unit: "liter", predictedCost: 2 },
    ],
    note: "Alternatif popular untuk yang tak makan nasi.",
  },
  {
    id: "prod-mee", emoji: "🍝", name: "Mi Goreng", category: "Makanan",
    servings_per_batch: 40, serving_unit: "pinggan", cooking_frequency_days: 1,
    batches_from_ingredients: 2, total_cost: 50, cost_per_unit: 1.25,
    suggested_price: 3.5, margin: 64.3, target_profit_scale: 7, packaging: null,
    ingredients: [
      { id: "ing-25", name: "Mi Kuning", quantity: 2, unit: "kg", predictedCost: 10 },
      { id: "ing-26", name: "Telur", quantity: 10, unit: "biji", predictedCost: 4 },
      { id: "ing-27", name: "Udang Kering", quantity: 0.1, unit: "kg", predictedCost: 6 },
      { id: "ing-28", name: "Kicap Masin", quantity: 0.1, unit: "liter", predictedCost: 2 },
    ],
    note: "Sama laris dengan bihun.",
  },
  {
    id: "prod-minuman", emoji: "🧋", name: "Minuman Harian", category: "Minuman",
    servings_per_batch: 30, serving_unit: "gelas", cooking_frequency_days: 1,
    batches_from_ingredients: 1, total_cost: 15, cost_per_unit: 0.5,
    suggested_price: 1.5, margin: 66.7, target_profit_scale: 7,
    packaging: { type: "gelas plastik", costPerUnit: 0.1 },
    ingredients: [
      { id: "ing-29", name: "Teh / Milo", quantity: 1, unit: "balang", predictedCost: 12 },
      { id: "ing-30", name: "Gula", quantity: 0.5, unit: "kg", predictedCost: 1.5 },
      { id: "ing-31", name: "Susu Pekat", quantity: 1, unit: "tin", predictedCost: 3 },
    ],
    note: "Tukar jenis setiap hari — Teh Ais, Milo, Bandung, Sirap, Nescafe.",
  },
  {
    id: "prod-rendang", emoji: "🍖", name: "Rendang Daging", category: "Makanan",
    servings_per_batch: 15, serving_unit: "ketul", cooking_frequency_days: 2,
    batches_from_ingredients: 1, total_cost: 72, cost_per_unit: 4.8,
    suggested_price: 7.0, margin: 31.4, target_profit_scale: 5, packaging: null,
    ingredients: [
      { id: "ing-32", name: "Daging Lembu", quantity: 1.2, unit: "kg", predictedCost: 46 },
      { id: "ing-33", name: "Kelapa Parut", quantity: 0.5, unit: "kg", predictedCost: 8 },
      { id: "ing-34", name: "Serai & Lengkuas", quantity: 1, unit: "ikat", predictedCost: 5 },
    ],
    note: "Item khas Sabtu. Boleh naikkan harga ke RM7.50.",
  },
];

// ─── STOCK ITEMS ──────────────────────────────────────────────────────────────

const STOCK_ITEMS = [
  { id: "stk-beras",    emoji: "🌾", name: "Beras",          qty: 18,  unit: "kg",    min_qty: 5,   restock_qty: 10,  max_qty: 25,  category: "Bahan Mentah",  last_restocked_at: iso(2) },
  { id: "stk-santan",   emoji: "🥥", name: "Santan",         qty: 8,   unit: "liter", min_qty: 2,   restock_qty: 4,   max_qty: 12,  category: "Bahan Mentah",  last_restocked_at: iso(2) },
  { id: "stk-ikan",     emoji: "🐟", name: "Ikan Bilis",     qty: 1.2, unit: "kg",    min_qty: 0.3, restock_qty: 0.5, max_qty: 2,   category: "Bahan Mentah",  last_restocked_at: iso(3) },
  { id: "stk-kacang",   emoji: "🥜", name: "Kacang Tanah",   qty: 1.5, unit: "kg",    min_qty: 0.3, restock_qty: 0.5, max_qty: 2,   category: "Bahan Mentah",  last_restocked_at: iso(3) },
  { id: "stk-timun",    emoji: "🥒", name: "Timun",           qty: 22,  unit: "biji",  min_qty: 5,   restock_qty: 10,  max_qty: 30,  category: "Bahan Mentah",  last_restocked_at: iso(1) },
  { id: "stk-telur",    emoji: "🥚", name: "Telur",           qty: 45,  unit: "biji",  min_qty: 10,  restock_qty: 20,  max_qty: 60,  category: "Bahan Mentah",  last_restocked_at: iso(1) },
  { id: "stk-ayam",     emoji: "🍗", name: "Ayam",            qty: 2.5, unit: "kg",    min_qty: 0.5, restock_qty: 1.0, max_qty: 4,   category: "Bahan Mentah",  last_restocked_at: iso(1) },
  // ⚠️ CRITICAL LOW — triggers alert
  { id: "stk-sotong",   emoji: "🦑", name: "Sotong",          qty: 0.3, unit: "kg",    min_qty: 0.3, restock_qty: 0.5, max_qty: 2,   category: "Bahan Mentah",  last_restocked_at: iso(5) },
  { id: "stk-paru",     emoji: "🫀", name: "Paru-paru",       qty: 2.2, unit: "kg",    min_qty: 0.5, restock_qty: 1.0, max_qty: 3,   category: "Bahan Mentah",  last_restocked_at: iso(2) },
  // ⚠️ CRITICAL LOW — triggers alert
  { id: "stk-daging",   emoji: "🥩", name: "Daging Lembu",    qty: 0.4, unit: "kg",    min_qty: 0.3, restock_qty: 0.5, max_qty: 2,   category: "Bahan Mentah",  last_restocked_at: iso(6) },
  { id: "stk-bihun",    emoji: "🍜", name: "Bihun",           qty: 3,   unit: "kg",    min_qty: 1,   restock_qty: 2,   max_qty: 5,   category: "Bahan Mentah",  last_restocked_at: iso(3) },
  { id: "stk-mee",      emoji: "🍝", name: "Mi Kuning",       qty: 2.5, unit: "kg",    min_qty: 1,   restock_qty: 2,   max_qty: 5,   category: "Bahan Mentah",  last_restocked_at: iso(3) },
  { id: "stk-cili",     emoji: "🌶️", name: "Cili Kering",    qty: 0.4, unit: "kg",    min_qty: 0.1, restock_qty: 0.2, max_qty: 0.6, category: "Bahan Mentah",  last_restocked_at: iso(6) },
  { id: "stk-bawangm",  emoji: "🧅", name: "Bawang Merah",    qty: 0.8, unit: "kg",    min_qty: 0.2, restock_qty: 0.4, max_qty: 1.5, category: "Bahan Mentah",  last_restocked_at: iso(4) },
  { id: "stk-bawangp",  emoji: "🧄", name: "Bawang Putih",    qty: 0.3, unit: "kg",    min_qty: 0.1, restock_qty: 0.2, max_qty: 0.6, category: "Bahan Mentah",  last_restocked_at: iso(4) },
  { id: "stk-minyak",   emoji: "🫙", name: "Minyak Masak",    qty: 2,   unit: "liter", min_qty: 0.5, restock_qty: 1,   max_qty: 5,   category: "Bahan Mentah",  last_restocked_at: iso(7) },
  { id: "stk-teh",      emoji: "🧋", name: "Teh / Milo",      qty: 1,   unit: "balang",min_qty: 0,   restock_qty: 0,   max_qty: 2,   category: "Minuman",       last_restocked_at: iso(0) },
  { id: "stk-gula",     emoji: "🍬", name: "Gula",            qty: 1.5, unit: "kg",    min_qty: 0.3, restock_qty: 0.5, max_qty: 3,   category: "Bahan Mentah",  last_restocked_at: iso(5) },
  { id: "stk-susu",     emoji: "🥛", name: "Susu Pekat",      qty: 3,   unit: "tin",   min_qty: 1,   restock_qty: 2,   max_qty: 6,   category: "Minuman",       last_restocked_at: iso(5) },
  { id: "stk-bungkus",  emoji: "📦", name: "Bungkus Nasi",    qty: 180, unit: "pcs",   min_qty: 30,  restock_qty: 80,  max_qty: 300, category: "Pembungkusan",  last_restocked_at: iso(7) },
  { id: "stk-gelas",    emoji: "🥤", name: "Gelas Plastik",   qty: 85,  unit: "pcs",   min_qty: 20,  restock_qty: 40,  max_qty: 150, category: "Pembungkusan",  last_restocked_at: iso(7) },
];

// ─── BUY ITEMS ────────────────────────────────────────────────────────────────

const BUY_ITEMS = [
  { id: "buy-1", emoji: "🥩", name: "Daging Lembu",  cost: 38, current_qty: 0.4, rec_qty: 2,   unit: "kg",  days_cover: 1, reason: "⚠️ Kritikal — stok tinggal 0.4kg, cukup hari ini sahaja", done: false, source: "auto" },
  { id: "buy-2", emoji: "🦑", name: "Sotong",         cost: 28, current_qty: 0.3, rec_qty: 2,   unit: "kg",  days_cover: 1, reason: "⚠️ Hampir habis — pada tahap minimum", done: false, source: "auto" },
  { id: "buy-3", emoji: "🌾", name: "Beras",          cost: 18, current_qty: 18,  rec_qty: 25,  unit: "kg",  days_cover: 4, reason: "Restock minggu depan — 4 hari lagi habis", done: false, source: "auto" },
  { id: "buy-4", emoji: "🧋", name: "Teh Boh / Milo", cost: 42, current_qty: 1,   rec_qty: 3,   unit: "tin", days_cover: 7, reason: "Restock mingguan — harga borong lebih jimat", done: false, source: "manual" },
  { id: "buy-5", emoji: "📦", name: "Bungkus Nasi",   cost: 12, current_qty: 180, rec_qty: 300, unit: "pcs", days_cover: 3, reason: "Habis dalam 3 hari — order segera", done: false, source: "auto" },
];

// ─── TRANSACTIONS (180 days) ──────────────────────────────────────────────────

function generateTransactions() {
  const txns: any[] = [];
  let id = 1700000000000;
  const drinks = ["Teh Ais", "Milo Ais", "Bandung Ais", "Sirap Laici", "Nescafe Ais", "Teh O Ais", "Milo Tabur", "Barli Ais"];

  for (let day = 179; day >= 0; day--) {
    const d = new Date(); d.setDate(d.getDate() - day);
    const dow = d.getDay();
    if (dow === 0) continue;

    const isSat = dow === 6, isFri = dow === 5;
    const ram = isRamadan(day);
    const base = salesBase(day);
    const satMult = isSat ? 1.35 : isFri ? 1.15 : 1.0;
    const target = Math.round(base * satMult + rng(day, 1) * 80 - 20);

    // Morning sessions
    const nSessions = ram ? (isSat ? 4 : 3) : (isSat ? 6 : isFri ? 5 : 3 + Math.floor(rng(day, 2) * 3));
    let acc = 0;
    const morningLabels = ["Jualan Pagi", "Nasi Lemak + Lauk", "Jualan Awal Pagi", "Jualan Terus", "Waktu Tengah Pagi"];

    for (let s = 0; s < nSessions; s++) {
      const isBuka = ram && s === nSessions - 1;
      const hour = isBuka ? 17 : 6 + Math.floor((s / (nSessions - (ram ? 1 : 0))) * 5);
      const minute = Math.floor(rng(day * 10 + s, 3) * 60);
      const bukaFrac = ram ? 0.38 : 0;
      let amount: number;
      if (isBuka) { amount = Math.floor(target * bukaFrac); }
      else if (s === nSessions - 1) { amount = target - acc; }
      else {
        const slots = nSessions - (ram ? 1 : 0);
        amount = Math.floor(((target * (1 - bukaFrac)) / slots) * (0.8 + rng(day + s, 4) * 0.4));
      }
      acc += Math.max(0, amount);
      id += 100;
      txns.push({
        id, type: "in",
        emoji: isBuka ? "🌙" : "💰",
        label: isBuka ? "Jualan Buka Puasa 🌙" : morningLabels[s % morningLabels.length],
        amount: Math.max(0, amount),
        time: timeFmt(hour, minute),
        ts: ts(day, hour, minute),
        created_at: new Date(ts(day, hour, minute)).toISOString(),
      });
    }

    // Drink sales
    const drinkAmt = ram ? Math.floor(rng(day, 5) * 35 + 55) : Math.floor(rng(day, 5) * 20 + 25);
    id += 100;
    txns.push({
      id, type: "in", emoji: "🧋",
      label: drinks[day % drinks.length],
      amount: drinkAmt,
      time: timeFmt(ram ? 17 : 8, 30),
      ts: ts(day, ram ? 17 : 8, 30),
      created_at: new Date(ts(day, ram ? 17 : 8, 30)).toISOString(),
    });
  }

  // ── TODAY'S MOCK JUALAN (Sabtu 10 Mei 2026) ─────────────────────────────────
  const todayTxns = [
    { id: id + 200, type: "in" as const, emoji: "💰", label: "Jualan Awal Pagi",
      amount: 88, time: timeFmt(6, 15), ts: ts(0, 6, 15),
      created_at: new Date(ts(0, 6, 15)).toISOString() },
    { id: id + 210, type: "in" as const, emoji: "💰", label: "Nasi Lemak + Lauk",
      amount: 112, time: timeFmt(7, 30), ts: ts(0, 7, 30),
      created_at: new Date(ts(0, 7, 30)).toISOString() },
    { id: id + 220, type: "in" as const, emoji: "🧋", label: "Teh Ais & Milo Ais",
      amount: 46, time: timeFmt(8, 0), ts: ts(0, 8, 0),
      created_at: new Date(ts(0, 8, 0)).toISOString() },
    { id: id + 230, type: "in" as const, emoji: "💰", label: "Jualan Pagi",
      amount: 94, time: timeFmt(9, 10), ts: ts(0, 9, 10),
      created_at: new Date(ts(0, 9, 10)).toISOString() },
    { id: id + 240, type: "in" as const, emoji: "💰", label: "Waktu Tengah Pagi",
      amount: 67, time: timeFmt(10, 30), ts: ts(0, 10, 30),
      created_at: new Date(ts(0, 10, 30)).toISOString() },
    { id: id + 250, type: "in" as const, emoji: "💰", label: "Jualan Terus",
      amount: 52, time: timeFmt(11, 45), ts: ts(0, 11, 45),
      created_at: new Date(ts(0, 11, 45)).toISOString() },
  ];
  todayTxns.forEach(t => txns.push(t));
  // ── END TODAY'S MOCK ──────────────────────────────────────────────────────────

  return txns;
}

// ─── OPEX ENTRIES — ALL 8 CATEGORIES (180 days) ───────────────────────────────

function generateOpex() {
  const entries: any[] = [];
  let id = 1700500000000;

  const push = (day: number, hour: number, min: number, category: string, desc: string, amount: number, fromPetty = false) => {
    id += 10;
    entries.push({
      id, category, desc, amount,
      time: timeFmt(hour, min),
      ts: ts(day, hour, min),
      created_at: new Date(ts(day, hour, min)).toISOString(),
      paid_from_petty: fromPetty,
    });
  };

  for (let day = 179; day >= 0; day--) {
    const d = new Date(); d.setDate(d.getDate() - day);
    const dow = d.getDay();
    if (dow === 0) continue;

    const isSat = dow === 6, isFri = dow === 5;
    const ram = isRamadan(day);

    // ① KOS BAHAN — every 2-3 days, higher during Ramadan
    if (day % 3 === 0 || isSat) {
      const base = ram ? 78 : isSat ? 58 : 40;
      push(day, 5, 30, "Kos Bahan", "Beras, santan, ikan bilis — Pasar Borong", base + Math.floor(rng(day, 6) * 20));
    }
    if (day % 4 === 1) {
      const base = ram ? 68 : 48;
      push(day, 5, 45, "Kos Bahan", "Ayam, paru-paru, daging — pembekal Ustaz Hamid", base + Math.floor(rng(day, 8) * 25));
    }
    if (day % 5 === 2) {
      push(day, 6, 0, "Kos Bahan", "Sayuran & rempah — Pasar Presint 9", 12 + Math.floor(rng(day, 13) * 8));
    }

    // ② UTILITI — gas every 2 weeks, elektrik monthly
    if (day % 14 === 0) {
      push(day, 7, 0, "Utiliti", "Gas masak — isi semula 2 tong", 70);
    }
    if (day % 30 === 5) {
      push(day, 9, 0, "Utiliti", "Bil elektrik gerai — TNB", 45 + Math.floor(rng(day, 14) * 20));
    }
    if (day % 30 === 12) {
      push(day, 9, 15, "Utiliti", "Bil air — SPAN", 18);
    }

    // ③ PEMBUNGKUSAN — weekly
    if (day % 7 === 0) {
      push(day, 6, 0, "Pembungkusan", "Bungkus nasi & gelas plastik — borong", 18 + Math.floor(rng(day, 9) * 8), true);
    }
    if (day % 14 === 3) {
      push(day, 6, 10, "Pembungkusan", "Beg plastik hitam & tisu meja", 14 + Math.floor(rng(day, 15) * 6), true);
    }
    // Extra packaging during Ramadan
    if (ram && day % 7 === 2) {
      push(day, 6, 5, "Pembungkusan", "Bekas tapau (100 pcs) — Ramadan demand", 22, true);
    }

    // ④ GAJI — Norizan part-time Fri & Sat
    if (isFri) {
      push(day, 11, 30, "Gaji", "Upah Norizan — Pembantu Jumaat", 50, true);
    }
    if (isSat) {
      push(day, 12, 0, "Gaji", "Upah Norizan — Pembantu Sabtu (separuh hari)", 65, true);
    }
    // Extra help during Ramadan buka puasa session
    if (ram && (isFri || isSat)) {
      push(day, 19, 0, "Gaji", "Upah Norizan — Sesi Buka Puasa (Ramadan)", 40, true);
    }

    // ⑤ PENGANGKUTAN — petrol weekly, parking per trip
    if (day % 7 === 1) {
      push(day, 6, 30, "Pengangkutan", "Minyak kereta — ke Pasar Borong & balik", 25 + Math.floor(rng(day, 11) * 15));
    }
    if (day % 5 === 0) {
      push(day, 5, 15, "Pengangkutan", "Parkir van — Pasar Borong Putrajaya", 4, true);
    }
    // Monthly toll
    if (day % 30 === 8) {
      push(day, 6, 0, "Pengangkutan", "Reload Touch 'n Go — tol & parkir bulan ini", 30);
    }
  }

  // ⑥ SEWA TAPAK — monthly (fixed, 6 months)
  [175, 145, 115, 85, 55, 25].forEach((day) => {
    push(day, 9, 0, "Sewa Tapak", "Sewa tapak gerai — Majlis Bandaraya Putrajaya", 450);
  });

  // ⑦ LESEN — annual renewal + signboard
  push(160, 10, 0, "Lesen", "Lesen perniagaan tahunan — MBPJ", 120);
  push(158, 10, 30, "Lesen", "Lesen papan tanda gerai — MBPJ", 60);
  push(75, 11, 0, "Lesen", "Pembaharuan sijil halal (tambahan dokumen)", 35);

  // ⑧ LAIN-LAIN — maintenance, marketing, misc
  push(165, 14, 0, "Lain-lain", "Servis kompressor peti ais — penyelenggaraan", 85);
  push(130, 13, 30, "Lain-lain", "Tukar burner dapur — paip bocor", 45);
  push(110, 10, 0, "Lain-lain", "Beli kuali besar (wok) baru — ganti pecah", 75);
  push(90, 9, 0, "Lain-lain", "Kos ubahsuai meja kaunter — papan jati baru", 180);
  push(65, 10, 0, "Lain-lain", "Cetak banner baru (4×2 kaki) — promosi Ramadan", 55);
  push(60, 11, 0, "Lain-lain", "Cetak menu baru (laminasi A3, 5 keping)", 22);
  push(40, 14, 0, "Lain-lain", "Bayar hutang pembekal — invois Oktober tertunggak", 120);
  push(30, 9, 0, "Lain-lain", "Beli seragam kerja baru (2 set) — Raya prep", 55);
  push(15, 8, 0, "Lain-lain", "Langganan WhatsApp Business — 3 bulan", 45);
  push(5, 10, 0, "Lain-lain", "Ubahsuai papan tanda harga — tukar font", 28);

  // ── TODAY'S MOCK PERBELANJAAN (Sabtu 10 Mei 2026) ──────────────────────────
  const todayOpex = [
    { id: id + 10, category: "Kos Bahan" as const,
      desc: "Beras, santan, ikan bilis — Pasar Borong Presint 9",
      amount: 68, time: timeFmt(5, 30), ts: ts(0, 5, 30),
      created_at: new Date(ts(0, 5, 30)).toISOString(), paid_from_petty: false },
    { id: id + 20, category: "Kos Bahan" as const,
      desc: "Ayam & paru-paru — Pembekal Ustaz Hamid",
      amount: 74, time: timeFmt(5, 50), ts: ts(0, 5, 50),
      created_at: new Date(ts(0, 5, 50)).toISOString(), paid_from_petty: false },
    { id: id + 30, category: "Kos Bahan" as const,
      desc: "Sayuran segar & rempah ratus — pasar pagi",
      amount: 17, time: timeFmt(6, 5), ts: ts(0, 6, 5),
      created_at: new Date(ts(0, 6, 5)).toISOString(), paid_from_petty: true },
    { id: id + 40, category: "Pembungkusan" as const,
      desc: "Bungkus nasi tambahan (500 pcs) — restock Sabtu",
      amount: 22, time: timeFmt(7, 15), ts: ts(0, 7, 15),
      created_at: new Date(ts(0, 7, 15)).toISOString(), paid_from_petty: true },
    { id: id + 50, category: "Utiliti" as const,
      desc: "Gas masak — isi semula 1 tong (stok hampir habis)",
      amount: 35, time: timeFmt(7, 45), ts: ts(0, 7, 45),
      created_at: new Date(ts(0, 7, 45)).toISOString(), paid_from_petty: false },
    { id: id + 60, category: "Pengangkutan" as const,
      desc: "Tambang van — hantar & ambil stok pasar borong",
      amount: 25, time: timeFmt(8, 0), ts: ts(0, 8, 0),
      created_at: new Date(ts(0, 8, 0)).toISOString(), paid_from_petty: true },
    { id: id + 70, category: "Lain-lain" as const,
      desc: "Sabun cuci & sarung tangan nitrile — 2 kotak",
      amount: 14, time: timeFmt(8, 30), ts: ts(0, 8, 30),
      created_at: new Date(ts(0, 8, 30)).toISOString(), paid_from_petty: true },
  ];
  todayOpex.forEach(e => entries.push(e));
  // ── END TODAY'S MOCK ──────────────────────────────────────────────────────────

  return entries;
}

// ─── PETTY CASH (180 days) ────────────────────────────────────────────────────

function generatePetty() {
  const entries: any[] = [];
  let id = 1700900000000;
  let balance = 0;

  const events = [
    { day: 179, type: "in",  emoji: "💵", desc: "Modal awal petty cash dibuka semula",          amount: 300 },
    { day: 172, type: "out", emoji: "🧹", desc: "Sabun & berus pinggan mangkuk (2 botol)",       amount: 12 },
    { day: 168, type: "out", emoji: "🧻", desc: "Tisu dapur 6 roll + tisu basah",                amount: 16 },
    { day: 162, type: "in",  emoji: "💵", desc: "Top-up petty cash",                             amount: 200 },
    { day: 158, type: "out", emoji: "🛍️", desc: "Plastik zipper 2 pek — simpan lebihan lauk",   amount: 10 },
    { day: 153, type: "out", emoji: "🎀", desc: "Getah rambut — ikat bungkus nasi 1 kotak",      amount: 4 },
    { day: 148, type: "out", emoji: "💡", desc: "Lampu LED 3 biji — ganti yang rosak",           amount: 22 },
    { day: 142, type: "in",  emoji: "💵", desc: "Top-up petty cash",                             amount: 200 },
    { day: 138, type: "out", emoji: "🔪", desc: "Pisau dapur baru (stainless steel)",            amount: 28 },
    { day: 132, type: "out", emoji: "🧴", desc: "Sabun tangan refill + cecair basuh pinggan",    amount: 14 },
    { day: 125, type: "out", emoji: "🍳", desc: "Wok baru (periuk besar) — ganti yang pecah",   amount: 65 },
    { day: 120, type: "in",  emoji: "💵", desc: "Top-up petty cash — tambah untuk Q1",           amount: 250 },
    { day: 115, type: "out", emoji: "👕", desc: "Serbet & apron baru (2 set)",                   amount: 38 },
    { day: 108, type: "out", emoji: "🐜", desc: "Spray anti-serangga dapur (racun semut/lipas)", amount: 14 },
    { day: 102, type: "out", emoji: "🪣", desc: "Baldi & berus lantai baru",                     amount: 18 },
    { day: 96,  type: "in",  emoji: "💵", desc: "Top-up petty cash",                             amount: 200 },
    { day: 92,  type: "out", emoji: "🔥", desc: "Gas lighter dapur 3 biji + penggantung senduk", amount: 9 },
    { day: 88,  type: "out", emoji: "🛍️", desc: "Beg plastik hitam 1 kodi",                     amount: 8 },
    { day: 83,  type: "out", emoji: "🎀", desc: "Tali bungkus & pelekat label nama gerai",       amount: 9 },
    { day: 78,  type: "out", emoji: "🧻", desc: "Tisu meja 12 kotak — restock bulanan",          amount: 18 },
    { day: 72,  type: "in",  emoji: "💵", desc: "Top-up petty cash",                             amount: 200 },
    { day: 68,  type: "out", emoji: "🧴", desc: "Hand sanitizer 2 botol — letak di kaunter",     amount: 12 },
    { day: 63,  type: "out", emoji: "🏷️", desc: "Sticker label gerai — 200 pcs (packaging)",    amount: 18 },
    { day: 57,  type: "in",  emoji: "💵", desc: "Top-up petty cash — persediaan Ramadan",        amount: 350 },
    { day: 53,  type: "out", emoji: "📦", desc: "Bekas plastik tapau 200 pcs — Ramadan",         amount: 30 },
    { day: 48,  type: "out", emoji: "🧹", desc: "Penyapu & mop baru — spring clean Ramadan",    amount: 24 },
    { day: 44,  type: "out", emoji: "💡", desc: "Lampu suluh LED 2 biji — kaunter gelap",        amount: 19 },
    { day: 39,  type: "in",  emoji: "💵", desc: "Top-up petty cash",                             amount: 200 },
    { day: 36,  type: "out", emoji: "🧻", desc: "Tisu dapur 10 roll + tisu basah 3 pek",         amount: 22 },
    { day: 32,  type: "out", emoji: "👕", desc: "Uniform baru 2 set — persediaan Raya",          amount: 55 },
    { day: 27,  type: "out", emoji: "🎁", desc: "Duit raya untuk Norizan (pembantu gerai)",      amount: 50 },
    { day: 22,  type: "in",  emoji: "💵", desc: "Top-up petty cash — lepas Raya",                amount: 200 },
    { day: 18,  type: "out", emoji: "🪣", desc: "Baldi baru — baldi lama pecah",                 amount: 12 },
    { day: 12,  type: "out", emoji: "🧹", desc: "Sabun & tisu — restock biasa",                  amount: 11 },
    { day: 7,   type: "in",  emoji: "💵", desc: "Top-up petty cash",                             amount: 200 },
    { day: 5,   type: "out", emoji: "🔥", desc: "Gas lighter & pelekat",                         amount: 6 },
    { day: 2,   type: "out", emoji: "🧴", desc: "Sabun basuh tangan 2 refill",                   amount: 10 },
  ];

  events.forEach((e) => {
    balance = e.type === "in" ? balance + e.amount : balance - e.amount;
    id += 10;
    entries.push({
      id, type: e.type, desc: e.desc, emoji: e.emoji, amount: e.amount,
      time: timeFmt(7, 30),
      balance: Math.max(0, Math.round(balance * 100) / 100),
      created_at: iso(e.day, 7),
      ts: ts(e.day, 7),
    });
  });
  return entries;
}

// ─── COOKING LOGS (180 days) ──────────────────────────────────────────────────

function generateCookingLogs() {
  const logs: any[] = [];
  let id = 1701200000000;

  const prods = [
    { id: "prod-nasi-lemak", name: "Nasi Lemak Biasa",   emoji: "🍛", unit: "periuk" },
    { id: "prod-ayam",       name: "Ayam Masak Merah",   emoji: "🍗", unit: "kuali" },
    { id: "prod-bihun",      name: "Bihun Goreng",       emoji: "🍜", unit: "kuali" },
    { id: "prod-mee",        name: "Mi Goreng",           emoji: "🍝", unit: "kuali" },
    { id: "prod-paru",       name: "Paru-paru Goreng",   emoji: "🫀", unit: "kuali" },
    { id: "prod-sotong",     name: "Sotong Sambal",       emoji: "🦑", unit: "kuali" },
    { id: "prod-daging",     name: "Daging Masak Hitam", emoji: "🥩", unit: "periuk" },
    { id: "prod-rendang",    name: "Rendang Daging",      emoji: "🍖", unit: "periuk" },
    { id: "prod-minuman",    name: "Minuman Harian",      emoji: "🧋", unit: "periuk" },
  ];

  for (let day = 179; day >= 0; day--) {
    const d = new Date(); d.setDate(d.getDate() - day);
    if (d.getDay() === 0) continue;
    const isSat = d.getDay() === 6;
    const ram = isRamadan(day);

    prods.forEach((p, i) => {
      if (p.id === "prod-rendang" && !isSat) return;
      if (i > 1 && rng(day + i, 12) > 0.72) return;

      let batches = 1;
      if (p.id === "prod-nasi-lemak")  batches = isSat ? 5 : ram ? 5 : 4;
      else if (p.id === "prod-minuman") batches = 1;
      else if (ram && isSat)            batches = 2;

      id += 5;
      logs.push({
        id, product_id: p.id, product_name: p.name, product_emoji: p.emoji,
        batches, batch_unit: p.unit,
        created_at: new Date(ts(day, 5, 0)).toISOString(),
        ts: ts(day, 5, 0),
      });
    });
  }
  return logs;
}

// ─── WASTE TRACKER / SISA HARIAN (60 days) ───────────────────────────────────

function generateSisaHarian(userId: string) {
  const rows: any[] = [];
  const prods = [
    { id: "prod-nasi-lemak", name: "Nasi Lemak Biasa",   unitCost: 1.25 },
    { id: "prod-ayam",       name: "Ayam Masak Merah",   unitCost: 1.5 },
    { id: "prod-bihun",      name: "Bihun Goreng",       unitCost: 1.2 },
    { id: "prod-paru",       name: "Paru-paru Goreng",   unitCost: 0.78 },
    { id: "prod-sotong",     name: "Sotong Sambal",       unitCost: 2.75 },
    { id: "prod-mee",        name: "Mi Goreng",           unitCost: 1.25 },
  ];

  for (let day = 59; day >= 0; day--) {
    const d = new Date(); d.setDate(d.getDate() - day);
    if (d.getDay() === 0) continue;
    const isSat = d.getDay() === 6;
    const ram = isRamadan(day);

    prods.forEach((p) => {
      const prepared = p.id === "prod-nasi-lemak"
        ? (isSat ? 250 : ram ? 210 : 200)
        : (isSat ? 35 : 25);

      const leftoverRate = p.id === "prod-nasi-lemak"
        ? (ram ? 0.02 : 0.07) + rng(day + p.id.length, 3) * 0.06
        : 0.10 + rng(day + p.id.length, 5) * 0.15;

      const leftover = Math.floor(prepared * leftoverRate);
      const sold = prepared - leftover;

      rows.push({
        device_id: userId,
        product_id: p.id, product_name: p.name,
        log_date: isoDate(day),
        prepared_qty: prepared, sold_qty: sold, leftover_qty: leftover,
        leftover_value: parseFloat((leftover * p.unitCost).toFixed(2)),
        unit_cost: p.unitCost,
        ai_suggested_qty: Math.floor(prepared * (1 - leftoverRate * 0.5)),
      });
    });
  }
  return rows;
}

// ─── NIGHTLY REPORTS (60 days pre-generated) ─────────────────────────────────

function generateNightlyReports(userId: string) {
  const reports: any[] = [];

  const summaries = [
    "Hari yang produktif! Jualan pagi mencecah target awal, terutama sesi 7–9 pagi.",
    "Jualan stabil. Ayam Masak Merah habis sebelum 10AM — tanda permintaan tinggi.",
    "Sedikit perlahan berbanding semalam, kemungkinan kerana cuaca mendung.",
    "Ramadan membawa lonjakan luar biasa! Sesi buka puasa menyumbang 38% jualan.",
    "Sabtu yang baik — rekod minggu ini. Pelanggan ramai dari awal pagi lagi.",
    "Jualan baik walaupun hari biasa. Paru-paru Goreng habis rekod pantas hari ini.",
  ];

  const achievements = [
    "Margin kasar 54% — melebihi sasaran 50%.",
    "Tiada sisa makanan hari ini — batch tepat untuk permintaan.",
    "Rekod jualan Sabtu minggu ini — RM 528.",
    "Norizan hadir tepat masa — operasi lancar.",
    "Kos bahan di bawah 45% — terima kasih kepada harga borong beras yang turun.",
  ];

  const warnings = [
    "Stok sotong hampir habis. Perlu beli esok pagi sebelum buka.",
    "Perbelanjaan petty cash melebihi 80% had bulan ini.",
    "Tiada jualan selepas 11AM — kemungkinan stok habis awal.",
    "Kos bahan naik 12% berbanding minggu lepas — semak harga supplier.",
  ];

  const recs = [
    ["Tambah 10% batch ayam esok — permintaan konsisten", "Rekod masa habis lauk untuk optimalkan batch saiz", "Semak harga supplier untuk bawang merah"],
    ["Beli daging lembu & sotong esok pagi sebelum buka gerai", "Pertimbang promosi flash pukul 10:30AM untuk kurangkan sisa"],
    ["Naikkan harga Sotong Sambal ke RM4.50 — margin sekarang terlalu rendah", "Masak Paru-paru lebih 1 batch — selalu habis cepat"],
    ["Tambah satu lagi pekerja sambilan pada Sabtu Ramadan", "Promosikan pakej Buka Puasa 3 item RM10 via WhatsApp"],
  ];

  for (let day = 59; day >= 1; day--) {
    const d = new Date(); d.setDate(d.getDate() - day);
    if (d.getDay() === 0) continue;

    const isSat = d.getDay() === 6;
    const ram = isRamadan(day);
    const base = salesBase(day);
    const totalSales = Math.round(base * (isSat ? 1.35 : 1.0) + rng(day, 1) * 60 - 10);
    const totalExpenses = Math.round(totalSales * (0.42 + rng(day, 2) * 0.08));
    const netProfit = totalSales - totalExpenses;
    const prevSales = Math.round(base + rng(day + 1, 1) * 60 - 10);

    const criticalStock = day < 7
      ? [{ name: "Daging Lembu", qty: 0.4, unit: "kg" }, { name: "Sotong", qty: 0.3, unit: "kg" }]
      : day < 14
      ? [{ name: "Sotong", qty: 0.5, unit: "kg" }]
      : [];

    const lowStock = day < 20
      ? [{ name: "Bungkus Nasi", qty: 180, unit: "pcs" }]
      : [];

    const recIdx = day % recs.length;
    const reportDate = isoDate(day);

    reports.push({
      device_id: userId,
      business_name: "Gerai Nasi Lemak Pak Arif",
      report_date: reportDate,
      total_sales: totalSales,
      total_expenses: totalExpenses,
      net_profit: netProfit,
      sales_change_pct: prevSales > 0 ? parseFloat((((totalSales - prevSales) / prevSales) * 100).toFixed(1)) : null,
      profit_change_pct: null,
      expense_change_pct: null,
      transaction_count: ram ? 5 + Math.floor(rng(day, 3) * 3) : 4 + Math.floor(rng(day, 3) * 2),
      peak_hour: isSat ? 7 : 8,
      slow_hour: ram ? 13 : 10,
      weekly_revenue: totalSales * 5 + Math.floor(rng(day, 7) * 200),
      weekly_target: 7000,
      weekly_target_progress: parseFloat(((totalSales * 5 / 7000) * 100).toFixed(1)),
      weekly_expenses: totalExpenses * 5,
      weekly_budget: 4200,
      critical_stock_items: criticalStock.length ? criticalStock : null,
      low_stock_items: lowStock.length ? lowStock : null,
      ai_summary: summaries[day % summaries.length],
      ai_achievement: achievements[day % achievements.length],
      ai_warning: day < 20 ? warnings[day % warnings.length] : null,
      ai_recommendations: recs[recIdx],
      ai_motivation: ram
        ? "Pak Arif, Ramadan ni jualan naik 60% — teruskan prestasi cemerlang! 💪"
        : "Setiap pagi yang awal adalah langkah ke arah impian Boss. Teruskan! 🌟",
      read_at: day > 3 ? iso(day, 21) : null,
      generated_at: iso(day, 20),
    });
  }
  return reports;
}

// ─── ACTION ITEMS TEMPLATE (report_id filled in after nightly_reports insert) ─

const ACTION_ITEMS_DATA = [
  { day: 3,  done: false, text: "Beli daging lembu & sotong esok pagi sebelum buka gerai" },
  { day: 3,  done: false, text: "Naikkan harga Sotong Sambal ke RM4.50" },
  { day: 5,  done: false, text: "Semak harga borong beras — supplier baru?" },
  { day: 7,  done: true,  text: "Rekod masa habis lauk untuk optimalkan batch saiz" },
  { day: 10, done: true,  text: "Promosikan pakej Buka Puasa 3 item RM10 via WhatsApp" },
  { day: 14, done: true,  text: "Tambah 10% batch ayam pada hari Sabtu" },
  { day: 20, done: true,  text: "Hubungi Ustaz Hamid untuk harga daging bulan depan" },
  { day: 25, done: true,  text: "Cetak menu baru dengan harga terbaru" },
  { day: 30, done: true,  text: "Top-up petty cash untuk bulan Ramadan" },
];

function buildActionItems(userId: string, reportIdByDate: Record<string, string>) {
  const items: any[] = [];
  ACTION_ITEMS_DATA.forEach((a) => {
    const date = isoDate(a.day);
    const report_id = reportIdByDate[date];
    if (!report_id) return; // skip if no matching report
    items.push({
      device_id: userId,
      report_id,
      report_date: date,
      action_text: a.text,
      is_done: a.done,
      done_at: a.done ? iso(a.day - 1, 7) : null,
    });
  });
  return items;
}

// ─── FORECAST ACCURACY DATA (30 days past) ───────────────────────────────────

function generateForecasts(userId: string) {
  const rows: any[] = [];

  for (let day = 30; day >= 1; day--) {
    const d = new Date(); d.setDate(d.getDate() - day);
    if (d.getDay() === 0) continue;

    const dow = d.getDay();
    const dayIndex = dow === 0 ? 6 : dow - 1; // Mon=0..Sun=6
    const base = salesBase(day);
    const predicted = Math.round(base * (dow === 6 ? 1.35 : dow === 5 ? 1.15 : 1.0));
    const actual = Math.round(predicted * (0.85 + rng(day, 20) * 0.30));
    const accuracy = Math.round(100 - (Math.abs(actual - predicted) / predicted) * 100);

    rows.push({
      device_id: userId,
      forecast_date: isoDate(day),
      day_index: dayIndex,
      baseline: base,
      predicted_revenue: predicted,
      predicted_low: Math.round(predicted * 0.8),
      predicted_high: Math.round(predicted * 1.2),
      weather_adjust: 1.0 + (rng(day, 21) * 0.1 - 0.05),
      weather_label: ["Cerah", "Mendung", "Hujan Renyai", "Panas", "Cerah Bersinar"][day % 5],
      actual_revenue: actual,
      accuracy_pct: Math.max(0, accuracy),
    });
  }
  return rows;
}

// ─── AI CHAT HISTORY — 10 realistic exchanges ────────────────────────────────

function generateChatHistory(userId: string) {
  let id = 1703000000000;
  const msgs: any[] = [];

  const convos = [
    // 4+ months ago: just started, basic question
    { day: 120, from: "user", text: "untung hari ni berapa?" },
    { day: 120, from: "bot",  text: "**Untung Bersih hari ni: RM 142.00** 💚\n\nJualan: RM 264.00\nKos Bahan (COGS): RM 80.00\nUntung Kasar: RM 184.00\nKos Operasi (gas, bungkus, parking): RM 42.00\nUntung Bersih: **RM 142.00** (margin 53.8%)\n\n💡 Cadangan: Cuba rekod lauk mana yang habis dulu setiap hari — data tu boleh bantu Pak Arif tahu produk paling laris dan kurangkan sisa." },

    // 3 months ago: break-even question
    { day: 95, from: "user", text: "berapa minimum kena jual sehari supaya tak rugi?" },
    { day: 95, from: "bot",  text: "Break-even harian Pak Arif anggaran **RM 182/hari** 📊\n\nKiraan:\n- Kos Tetap Bulanan: Sewa RM450 + Gas RM70 + Lesen RM15 + Utiliti RM63 = **RM 598**\n- Hari Operasi Sebulan: ~26 hari → Kos Tetap Harian: **RM 23**\n- Margin Kasar Purata: ~52%\n- Break-even Kos Tetap: RM 23 ÷ 52% = **RM 44**\n- Tambah COGS harian (~RM 138) → **Jumlah break-even: RM 182**\n\nPak Arif dah jauh melebihi tu setiap hari — syabas! 🎉\n\n💡 Cadangan: Pada hari hujan atau perlahan (bawah RM 200), kurangkan batch masak 15% untuk jimat kos bahan." },

    // Dec slow season
    { day: 72, from: "user", text: "kenapa Disember ni jualan slow sangat?" },
    { day: 72, from: "bot",  text: "Berdasarkan data 2 bulan Pak Arif, **jualan Disember turun ~23%** — ini sangat biasa untuk gerai pagi kawasan pejabat.\n\n3 sebab utama:\n1. **Cuti sekolah akhir tahun** — ramai pekerja & keluarga balik kampung atau bercuti\n2. **Musim hujan** — kurang orang keluar sarapan pagi\n3. **Gaji lambat** — pengguna jimat hujung bulan Disember\n\nData Pak Arif:\n- Nov purata: **RM 278/hari**\n- Des sekarang: **RM 215/hari** (turun RM 63)\n\n💡 Cadangan: Kurangkan batch masak 20% sepanjang Disember untuk elak sisa. Penjimatan bahan RM ~5/hari = RM 130 dalam sebulan — simpan dalam tabung!" },

    // Pre-Ramadan advice
    { day: 55, from: "user", text: "bulan depan Ramadan, apa tips untuk tingkatkan jualan?" },
    { day: 55, from: "bot",  text: "Bagus Pak Arif tanya awal! 🌙 Ramadan boleh bawa **lonjakan jualan 60–80%** untuk gerai F&B.\n\n**5 strategi konkrit:**\n1. **Buka sesi petang 5–7PM** untuk buka puasa takeaway → potensi +RM 180/hari\n2. **Pakej Buka Puasa** — 5 bungkus nasi + 1 lauk RM 14 (jimat RM 1.50) → tingkat purata transaksi\n3. **Bungkus 2x lebih** — order packaging berganda minggu ni juga\n4. **Norizan tambah jadual** — ambil dia setiap hari sepanjang Ramadan\n5. **WhatsApp broadcast** kepada pelanggan setia — bagi tau menu & waktu buka\n\nTarget realistik: **RM 490/hari** → 26 hari × RM 490 = **RM 12,740 jualan bulan Ramadan**\n\n💡 Cadangan: Set reminder untuk beli stok beras & santan double minggu sebelum Ramadan. Jangan beli last minute — harga naik." },

    // During Ramadan record day
    { day: 42, from: "user", text: "alhamdulillah hari ni rekod! RM 538 jualan" },
    { day: 42, from: "bot",  text: "🎉 **Tahniah Pak Arif — Rekod baru RM 538!**\n\nBandingkan dengan Ramadan minggu ini:\n- Purata harian: RM 493\n- Hari ni: **RM 538** (+9.1% atas purata)\n- Rekod sebelum: RM 512 (Sabtu 2 minggu lepas)\n\nAnggaran untung bersih hari ni: **RM 223**\n(Jualan RM 538 − COGS RM 160 − Kos Op RM 155)\n\n⚠️ Amaran: Stok sotong mungkin akan habis dalam 2–3 hari. Whatsapp Ustaz Hamid malam ni untuk order.\n\n💡 Cadangan: Screenshot ini dan post di WhatsApp status gerai. \"Rekod jualan hari ni alhamdulillah 🙏\" — pemasaran percuma yang paling berkesan!" },

    // Post-Raya check-in
    { day: 18, from: "user", text: "dah habis raya ni jualan teruk la.. normal tak?" },
    { day: 18, from: "bot",  text: "Normal sangat, Pak Arif — jangan risau 😊 **Post-Raya dip** berlaku setiap tahun untuk semua gerai.\n\nData Pak Arif:\n- Ramadan puncak: RM 492/hari purata\n- Minggu lepas Raya: **RM 197/hari** (turun 60%)\n\nSebab: Ramai pelanggan belum balik dari kampung, pejabat belum penuh, orang masih ada sisa makanan Raya.\n\n**Jangkaan pemulihan:** 10–14 hari selepas Hari Raya — kira-kira minggu depan.\n\n**Apa perlu buat sekarang:**\n- Kurangkan batch 30% untuk jimat kos bahan\n- Jangan hire Norizan full-time lagi minggu ni\n- Guna masa lapang untuk kira **P&L Ramadan penuh** — berapa sebenarnya untung yang masuk?\n\n💡 Cadangan: Ini masa terbaik nak review Tabung Impian. Berapa dah tersimpan untuk mesin penggoreng baru?" },

    // Goal check
    { day: 5, from: "user",  text: "boleh tunjuk berapa dah saved untuk mesin penggoreng?" },
    { day: 5, from: "bot",  text: "Dengan senang hati! Dari Tabung Impian Pak Arif:\n\n🏭 **Mesin Penggoreng Automatik**\nSasaran: **RM 3,500**\nDah tersimpan: **RM 1,850** ✅ (52.9%)\nBaki diperlukan: **RM 1,650**\n\nPada kadar simpanan RM 200/bulan → **8 bulan lagi** (Dis 2026)\n**Tapi!** Kalau Pak Arif tambah RM 150 sebulan → hanya **5 bulan** (Sep 2026) 🎯\n\n---\n🏠 **Gerai Kedua — Presint 11**\nSasaran: **RM 15,000**\nDah tersimpan: **RM 2,200** (14.7%)\nPada RM 600/bulan → ~21 bulan lagi\n\n💡 Cadangan: Ramadan bulan ni Pak Arif untung lebih. Tetapkan auto-transfer RM 350 dari hasil jualan terus ke akaun tabungan pada 1hb setiap bulan. Jangan tunggu — buat sekarang!" },
  ];

  convos.forEach((c) => {
    id += 50;
    msgs.push({
      id, user_id: userId, from: c.from, text: c.text,
      ts: ts(c.day, 10, 0), created_at: iso(c.day, 10),
    });
  });
  return msgs;
}

// ─── GOALS / USER IMPIAN ──────────────────────────────────────────────────────

function generateImpian(userId: string) {
  return [
    {
      device_id: userId, goal_type: "machine",
      goal_name: "Mesin Penggoreng Automatik",
      target_amount: 3500, current_saved: 1850,
      selected_plan: { monthly: 350, months: 5, label: "Agresif — 5 bulan" },
    },
    {
      device_id: userId, goal_type: "branch",
      goal_name: "Buka Gerai Kedua di Presint 11",
      target_amount: 15000, current_saved: 2200,
      selected_plan: { monthly: 600, months: 21, label: "Sederhana — 21 bulan" },
    },
  ];
}

// ─── SUPPLIERS (localStorage) ─────────────────────────────────────────────────

const SUPPLIERS = [
  {
    id: "sup-hamid", name: "Ustaz Hamid (Pembekal Daging)", category: "Bahan Mentah",
    phone: "019-3421870",
    items: "Daging lembu, paru-paru, tulang. Hantar setiap Isnin & Khamis pagi.",
    note: "Harga baik untuk order ≥2kg. Boleh WhatsApp malam sebelum.",
  },
  {
    id: "sup-borong", name: "Pasar Borong Putrajaya", category: "Bahan Mentah",
    phone: "088-0000000",
    items: "Beras, santan, sayur, ikan bilis, kacang, rempah, telur, santan kotak.",
    note: "Buka 4:30AM. Parking RM2 per masuk. Harga borong jimat ~15% vs kedai runcit.",
  },
  {
    id: "sup-cik-ros", name: "Cik Ros — Pembekal Minuman", category: "Minuman",
    phone: "012-7654321",
    items: "Teh Boh, Milo, Ovaltine, Horlicks, Milo tin, Susu pekat Carnation.",
    note: "Antar ke gerai setiap Jumaat pagi. Minimum order RM50.",
  },
  {
    id: "sup-pek", name: "AZ Packaging Sdn Bhd", category: "Pembungkusan",
    phone: "03-8765 4321",
    items: "Bungkus nasi, gelas plastik, bekas foil, straw, beg plastik, label sticker.",
    note: "WhatsApp order, antar dalam 2 hari. Diskaun 5% untuk order >RM100.",
  },
  {
    id: "sup-gas", name: "Syarikat Gas Putrajaya", category: "Gas & Utiliti",
    phone: "03-8888 9999",
    items: "Tong gas 12kg & 14kg. Servis paip gas dapur.",
    note: "Tong 14kg RM38. Boleh tukar tong, antar ke gerai dengan bayar RM5 penghantaran.",
  },
];

// ─── COOKING PRESETS (localStorage) ──────────────────────────────────────────

const COOKING_PRESETS = [
  {
    id: "preset-1",
    name: "Hari Biasa",
    values: {
      "prod-nasi-lemak": 4, "prod-ayam": 1, "prod-bihun": 1,
      "prod-mee": 1, "prod-paru": 1, "prod-minuman": 1,
    },
  },
  {
    id: "preset-2",
    name: "Hari Sibuk (Jumaat/Sabtu)",
    values: {
      "prod-nasi-lemak": 5, "prod-ayam": 2, "prod-bihun": 2,
      "prod-mee": 2, "prod-paru": 2, "prod-sotong": 1,
      "prod-daging": 1, "prod-minuman": 1,
    },
  },
  {
    id: "preset-3",
    name: "Ramadan (Sahur)",
    values: {
      "prod-nasi-lemak": 5, "prod-ayam": 2, "prod-bihun": 1,
      "prod-paru": 2, "prod-minuman": 1,
    },
  },
  {
    id: "preset-4",
    name: "Sabtu Penuh (Rendang)",
    values: {
      "prod-nasi-lemak": 5, "prod-ayam": 2, "prod-rendang": 1,
      "prod-bihun": 2, "prod-mee": 1, "prod-sotong": 1,
      "prod-paru": 1, "prod-minuman": 1,
    },
  },
];

// ─── EXPORTED ACTIONS (no UI) ─────────────────────────────────────────────────

export async function seedDemoData(userId: string): Promise<void> {
  if (!userId) throw new Error("missing userId");
  const setS = (_s: string, _p: number) => {};
  const setProgress = (_p: number) => {};
  {

    try {
      // ── 1. localStorage (instant) ──────────────────────────────────────────
      setS("Memuatkan profil & tetapan...", 2);
      localStorage.setItem("warkahbiz_profile_name",   "Arif");
      localStorage.setItem("warkahbiz_business_name",  "Gerai Nasi Lemak Pak Arif");
      localStorage.setItem("warkahbiz_weekly_target",  "7000");
      localStorage.setItem("warkahbiz_weekly_budget",  "4200");
      localStorage.setItem(`warkahbiz_suppliers_${userId}`, JSON.stringify(SUPPLIERS));
      localStorage.setItem("warkahbiz_cooking_presets", JSON.stringify(COOKING_PRESETS));
      // Mark tutorial done so demo user skips onboarding
      localStorage.setItem(`warkahbiz_tutorial_done_${userId}`, "true");

      // ── 2. Products ────────────────────────────────────────────────────────
      setS("Memuatkan produk (9 item)...", 5);
      await supabase.from("products").delete().eq("user_id", userId);
      await supabase.from("products").insert(PRODUCTS.map(p => ({ ...p, user_id: userId })));

      // ── 3. Stock ───────────────────────────────────────────────────────────
      setS("Memuatkan stok (21 item)...", 10);
      await supabase.from("stock_items").delete().eq("user_id", userId);
      await supabase.from("stock_items").insert(STOCK_ITEMS.map(s => ({ ...s, user_id: userId })));

      // ── 4. Transactions ────────────────────────────────────────────────────
      setS("Memuatkan transaksi 180 hari...", 14);
      const txns = generateTransactions();
      await supabase.from("transactions").delete().eq("user_id", userId);
      for (let i = 0; i < txns.length; i += 100) {
        await supabase.from("transactions").insert(txns.slice(i, i + 100).map(t => ({ ...t, user_id: userId })));
        setProgress(14 + Math.floor((i / txns.length) * 16));
      }

      // ── 5. OpEx (ALL 8 categories) ─────────────────────────────────────────
      setS("Memuatkan perbelanjaan — 8 kategori (180 hari)...", 30);
      const opex = generateOpex();
      await supabase.from("opex_entries").delete().eq("user_id", userId);
      for (let i = 0; i < opex.length; i += 100) {
        await supabase.from("opex_entries").insert(opex.slice(i, i + 100).map(o => ({ ...o, user_id: userId })));
        setProgress(30 + Math.floor((i / opex.length) * 8));
      }

      // ── 6. Petty Cash ──────────────────────────────────────────────────────
      setS("Memuatkan petty cash (38 transaksi)...", 39);
      const petty = generatePetty();
      await supabase.from("petty_entries").delete().eq("user_id", userId);
      await supabase.from("petty_entries").insert(petty.map(p => ({ ...p, user_id: userId })));
      await supabase.from("petty_settings").upsert({ user_id: userId, monthly_limit: 400 });

      // ── 7. Cooking Logs ────────────────────────────────────────────────────
      setS("Memuatkan log masakan (180 hari)...", 44);
      const logs = generateCookingLogs();
      await supabase.from("cooking_logs").delete().eq("user_id", userId);
      for (let i = 0; i < logs.length; i += 100) {
        await supabase.from("cooking_logs").insert(logs.slice(i, i + 100).map(c => ({ ...c, user_id: userId })));
        setProgress(44 + Math.floor((i / logs.length) * 8));
      }

      // ── 8. Buy Items ───────────────────────────────────────────────────────
      setS("Memuatkan senarai beli...", 53);
      await supabase.from("buy_items").delete().eq("user_id", userId);
      await supabase.from("buy_items").insert(BUY_ITEMS.map(b => ({ ...b, user_id: userId })));

      // helper that surfaces errors instead of silently swallowing them
      const run = async (label: string, fn: () => Promise<{ error: any } | void>) => {
        const res = await fn();
        if (res && (res as any).error) {
          console.error(`[seeder] ${label}`, (res as any).error);
          toast.error(`${label}: ${(res as any).error.message ?? "gagal"}`);
        }
      };

      // ── 9. Sisa Harian (Waste Tracker) ────────────────────────────────────
      setS("Memuatkan data sisa harian (60 hari)...", 56);
      const sisa = generateSisaHarian(userId);
      await run("sisa_harian delete", () => supabase.from("sisa_harian").delete().eq("device_id", userId));
      for (let i = 0; i < sisa.length; i += 100) {
        await run("sisa_harian insert", () => supabase.from("sisa_harian").insert(sisa.slice(i, i + 100)));
        setProgress(56 + Math.floor((i / sisa.length) * 6));
      }

      // ── 10. User Impian (Goals) ────────────────────────────────────────────
      setS("Memuatkan Tabung Impian (2 matlamat)...", 63);
      await run("user_impian delete", () => supabase.from("user_impian").delete().eq("device_id", userId));
      await run("user_impian insert", () => supabase.from("user_impian").insert(generateImpian(userId)));

      // ── 11. Nightly Reports (insert + capture generated UUIDs) ─────────────
      setS("Memuatkan laporan malam (60 hari)...", 67);
      const reports = generateNightlyReports(userId);
      await run("nightly_reports delete", () => supabase.from("nightly_reports").delete().eq("device_id", userId));
      const reportIdByDate: Record<string, string> = {};
      for (let i = 0; i < reports.length; i += 50) {
        const { data, error } = await supabase
          .from("nightly_reports")
          .insert(reports.slice(i, i + 50))
          .select("id, report_date");
        if (error) {
          console.error("[seeder] nightly_reports insert", error);
          toast.error(`nightly_reports: ${error.message}`);
        } else {
          (data ?? []).forEach((r: any) => { reportIdByDate[r.report_date] = r.id; });
        }
        setProgress(67 + Math.floor((i / reports.length) * 8));
      }

      // ── 12. Action Items (linked via report UUIDs) ────────────────────────
      setS("Memuatkan item tindakan...", 76);
      await run("action_items_log delete", () => supabase.from("action_items_log").delete().eq("device_id", userId));
      const actions = buildActionItems(userId, reportIdByDate);
      if (actions.length) {
        await run("action_items_log insert", () => supabase.from("action_items_log").insert(actions));
      }

      // ── 13. Forecast Accuracy ──────────────────────────────────────────────
      setS("Memuatkan data ramalan (30 hari)...", 80);
      await run("forecasts delete", () => supabase.from("forecasts").delete().eq("device_id", userId));
      await run("forecasts insert", () => supabase.from("forecasts").insert(generateForecasts(userId)));

      // ── 14. AI Chat History ────────────────────────────────────────────────
      setS("Memuatkan sejarah chat AI (10 perbualan)...", 84);
      const chats = generateChatHistory(userId);
      await supabase.from("chat_history").delete().eq("user_id", userId);
      await supabase.from("chat_history").insert(chats);

      // ── 15. Saved Cards ────────────────────────────────────────────────────
      setS("Memuatkan kaedah pembayaran...", 88);
      await supabase.from("saved_cards").delete().eq("user_id", userId);
      await supabase.from("saved_cards").insert([
        {
          id: "card-tng", user_id: userId, type: "ewallet",
          ewallet_provider: "Touch 'n Go", ewallet_phone: "0123456789",
          nickname: "TNG Utama", is_primary: true, created_at: iso(150),
        },
        {
          id: "card-maybank", user_id: userId, type: "bank",
          bank_name: "Maybank", account_number: "1234-5678-9012",
          account_holder: "Arif Bin Hassan", nickname: "Maybank Simpanan",
          is_primary: false, created_at: iso(150),
        },
      ]);

      // ── 16. Business Hours ─────────────────────────────────────────────────
      setS("Memuatkan waktu operasi...", 91);
      await supabase.from("business_hours").upsert({
        user_id: userId,
        settings: {
          hours: [
            { day: "mon", open: "06:00", close: "11:00", isClosed: false },
            { day: "tue", open: "06:00", close: "11:00", isClosed: false },
            { day: "wed", open: "06:00", close: "11:00", isClosed: false },
            { day: "thu", open: "06:00", close: "11:00", isClosed: false },
            { day: "fri", open: "06:00", close: "11:30", isClosed: false },
            { day: "sat", open: "06:00", close: "12:00", isClosed: false },
            { day: "sun", open: "00:00", close: "00:00", isClosed: true },
          ],
          vacationMode: false, autoReplyEnabled: true,
          autoReplyMessage: "Gerai Pak Arif buka 6–11AM Isnin–Sabtu. Jumaat & Sabtu ada Rendang! 🍛",
          bufferMinutes: 15,
        },
      });

      // ── 17. Outlet Settings ────────────────────────────────────────────────
      setS("Memuatkan maklumat outlet...", 94);
      await supabase.from("outlet_settings").upsert({
        user_id: userId,
        settings: {
          outletName: "Gerai Nasi Lemak Pak Arif",
          type: "Gerai",
          address: "Lorong 3, Presint 9, Putrajaya 62250",
          isOpenToday: true,
        },
      });

      // ── 18. Profile record ─────────────────────────────────────────────────
      setS("Memuatkan profil akaun...", 96);
      try {
        await supabase.from("profiles").upsert({
          id: userId,
          display_name: "Arif bin Hassan",
          phone: "012-3456789",
          updated_at: iso(0),
        });
      } catch (e) { console.warn("profiles skip:", e); }

      // ── 19. Clear localStorage caches ─────────────────────────────────────
      setS("Membersih cache...", 98);
      const cacheKeys = [
        "warkahbiz_txns", "warkahbiz_stock", "warkahbiz_buy",
        "warkahbiz_petty", "warkahbiz_opex", "warkahbiz_products",
        "warkahbiz_cooking_log", "warkahbiz_cards", "warkahbiz_chat",
      ];
      cacheKeys.forEach(k => {
        localStorage.removeItem(`${k}_${userId}`);
        localStorage.removeItem(`warkahbiz_migrated_${k}_${userId}`);
      });

      setS("✅ Selesai!", 100);
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  }
}

export async function clearDemoData(userId: string): Promise<void> {
  if (!userId) throw new Error("missing userId");
  const tables = [
    "transactions", "stock_items", "buy_items", "petty_entries", "opex_entries",
    "products", "cooking_logs", "saved_cards", "chat_history",
  ];
  for (const t of tables) await supabase.from(t as any).delete().eq("user_id", userId);
  try { await supabase.from("sisa_harian").delete().eq("device_id", userId); } catch {}
  try { await supabase.from("user_impian").delete().eq("device_id", userId); } catch {}
  try { await supabase.from("nightly_reports").delete().eq("device_id", userId); } catch {}
  try { await supabase.from("action_items_log").delete().eq("device_id", userId); } catch {}
  try { await supabase.from("forecasts").delete().eq("device_id", userId); } catch {}
  try { await supabase.from("profiles").delete().eq("id", userId); } catch {}
  await supabase.from("business_hours").delete().eq("user_id", userId);
  await supabase.from("outlet_settings").delete().eq("user_id", userId);
  await supabase.from("petty_settings").delete().eq("user_id", userId);
  [
    "warkahbiz_profile_name", "warkahbiz_business_name",
    "warkahbiz_weekly_target", "warkahbiz_weekly_budget",
    "warkahbiz_cooking_presets",
    `warkahbiz_suppliers_${userId}`,
    `warkahbiz_tutorial_done_${userId}`,
  ].forEach(k => localStorage.removeItem(k));
}

export default function DemoSeeder() { return null; }
