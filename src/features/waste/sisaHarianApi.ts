// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/features/goals/impianApi";

export interface SisaRow {
  id: string;
  device_id: string;
  product_id: string;
  product_name: string;
  log_date: string; // YYYY-MM-DD
  prepared_qty: number;
  sold_qty: number;
  leftover_qty: number;
  leftover_value: number;
  unit_cost: number;
  ai_suggested_qty: number | null;
  created_at: string;
  updated_at: string;
}

export type SisaUpsert = Omit<SisaRow, "id" | "device_id" | "created_at" | "updated_at">;

export async function fetchSisaRange(fromDate: string, toDate: string): Promise<SisaRow[]> {
  const device_id = await getDeviceId();
  const { data, error } = await supabase
    .from("sisa_harian")
    .select("*")
    .eq("device_id", device_id)
    .gte("log_date", fromDate)
    .lte("log_date", toDate)
    .order("log_date", { ascending: true });
  if (error) {
    console.error("fetchSisaRange", error);
    return [];
  }
  return (data ?? []) as SisaRow[];
}

export async function fetchSisaForDate(date: string): Promise<SisaRow[]> {
  const device_id = await getDeviceId();
  const { data, error } = await supabase
    .from("sisa_harian")
    .select("*")
    .eq("device_id", device_id)
    .eq("log_date", date);
  if (error) {
    console.error("fetchSisaForDate", error);
    return [];
  }
  return (data ?? []) as SisaRow[];
}

export async function upsertSisaBatch(rows: SisaUpsert[]): Promise<boolean> {
  if (!rows.length) return true;
  const device_id = await getDeviceId();
  const payload = rows.map((r) => ({ ...r, device_id }));
  const { error } = await supabase
    .from("sisa_harian")
    .upsert(payload, { onConflict: "device_id,product_id,log_date" });
  if (error) {
    console.error("upsertSisaBatch", error);
    return false;
  }
  return true;
}
