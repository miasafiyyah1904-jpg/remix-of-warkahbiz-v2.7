// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/features/goals/impianApi";

export interface ForecastSavePayload {
  forecast_date: string; // yyyy-mm-dd
  day_index: number;
  baseline: number;
  predicted_revenue: number;
  predicted_low: number;
  predicted_high: number;
  weather_adjust: number;
  weather_label?: string | null;
  cultural_adjust?: number;
  cultural_label?:  string | null;
  payday_adjust?:   number;
  payday_label?:    string | null;
}

export async function saveForecasts(items: ForecastSavePayload[]) {
  if (!items.length) return { error: null };
  const device_id = await getDeviceId();
  const rows = items.map((i) => ({ ...i, device_id }));
  const { error } = await supabase
    .from("forecasts")
    .upsert(rows as never, { onConflict: "device_id,forecast_date" });
  return { error };
}

export async function fetchPastAccuracy(limit = 30) {
  const device_id = await getDeviceId();
  const { data, error } = await supabase
    .from("forecasts")
    .select("predicted_revenue, actual_revenue, accuracy_pct, forecast_date")
    .eq("device_id", device_id)
    .not("actual_revenue", "is", null)
    .order("forecast_date", { ascending: false })
    .limit(limit);
  if (error || !data?.length) return null;
  const avg = data.reduce((s, r) => s + (r.accuracy_pct ?? 0), 0) / data.length;
  return { avgAccuracy: Math.round(avg), sampleSize: data.length };
}
