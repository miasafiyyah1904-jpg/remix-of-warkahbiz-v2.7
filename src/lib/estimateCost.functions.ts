import { supabase } from "@/integrations/supabase/client";

export async function estimateIngredientCost(args: {
  data: {
    name: string;
    quantity: number;
    unit: string;
    productName?: string;
    batchSize?: number;
    batchUnit?: string;
    cookingUnit?: string;
  };
}) {
  const { data, error } = await supabase.functions.invoke("estimate-cost", { body: args.data });
  if (error) {
    console.error("estimateIngredientCost error", error);
    return { ok: false as const, cost: 0, error: "exception" };
  }
  return data as { ok: boolean; cost: number; confidence?: string; note?: string; error?: string };
}
