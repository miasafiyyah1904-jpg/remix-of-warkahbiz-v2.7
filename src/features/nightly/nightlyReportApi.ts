// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/features/goals/impianApi";

export interface NightlyReportRow {
  id: string;
  device_id: string;
  business_name: string | null;
  report_date: string;
  total_sales: number;
  total_expenses: number;
  net_profit: number;
  sales_change_pct: number | null;
  profit_change_pct: number | null;
  expense_change_pct: number | null;
  transaction_count: number;
  peak_hour: number | null;
  slow_hour: number | null;
  weekly_revenue: number;
  weekly_target: number;
  weekly_target_progress: number | null;
  weekly_expenses: number;
  weekly_budget: number;
  critical_stock_items: Array<{ name: string; qty: number; unit: string }> | null;
  low_stock_items: Array<{ name: string; qty: number; unit: string }> | null;
  ai_summary: string | null;
  ai_achievement: string | null;
  ai_warning: string | null;
  ai_recommendations: string[] | null;
  ai_motivation: string | null;
  read_at: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export interface ActionItemRow {
  id: string;
  device_id: string;
  report_id: string | null;
  report_date: string;
  action_text: string;
  is_done: boolean;
  done_at: string | null;
  created_at: string;
  updated_at: string;
}

export type NightlyReportInput = Omit<
  NightlyReportRow,
  "id" | "device_id" | "created_at" | "updated_at" | "generated_at" | "read_at"
> & { read_at?: string | null };

export async function upsertNightlyReport(input: NightlyReportInput): Promise<NightlyReportRow> {
  const device_id = await getDeviceId();
  const payload = { ...input, device_id, generated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("nightly_reports")
    .upsert(payload as never, { onConflict: "device_id,report_date" })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as NightlyReportRow;
}

export async function fetchNightlyReports(): Promise<NightlyReportRow[]> {
  const device_id = await getDeviceId();
  const { data, error } = await supabase
    .from("nightly_reports")
    .select("*")
    .eq("device_id", device_id)
    .order("report_date", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []) as unknown as NightlyReportRow[];
}

export async function fetchReportByDate(date: string): Promise<NightlyReportRow | null> {
  const device_id = await getDeviceId();
  const { data, error } = await supabase
    .from("nightly_reports")
    .select("*")
    .eq("device_id", device_id)
    .eq("report_date", date)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as NightlyReportRow) ?? null;
}

export async function markReportRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("nightly_reports")
    .update({ read_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function listActionItems(reportId: string): Promise<ActionItemRow[]> {
  const { data, error } = await supabase
    .from("action_items_log")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ActionItemRow[];
}

export async function createActionItems(
  reportId: string,
  reportDate: string,
  texts: string[],
): Promise<ActionItemRow[]> {
  if (!texts.length) return [];
  const device_id = await getDeviceId();
  const rows = texts.map((t) => ({
    device_id,
    report_id: reportId,
    report_date: reportDate,
    action_text: t,
    is_done: false,
  }));
  const { data, error } = await supabase
    .from("action_items_log")
    .insert(rows as never)
    .select();
  if (error) throw error;
  return (data ?? []) as unknown as ActionItemRow[];
}

export async function toggleActionItem(id: string, done: boolean): Promise<void> {
  const { error } = await supabase
    .from("action_items_log")
    .update({ is_done: done, done_at: done ? new Date().toISOString() : null } as never)
    .eq("id", id);
  if (error) throw error;
}
