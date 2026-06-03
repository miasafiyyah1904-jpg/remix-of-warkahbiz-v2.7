import { supabase } from "@/integrations/supabase/client";

export async function scanRecipe(args: { data: { imageBase64: string; mimeType?: string } }) {
  const { data, error } = await supabase.functions.invoke("scan-recipe", { body: args.data });
  if (error) {
    console.error("scanRecipe error", error);
    return { ok: false as const, error: "exception", message: "Masalah sambungan. Cuba lagi.", items: [] };
  }
  return data as { ok: boolean; items: Array<{ name: string; qty: number; unit: string }>; error?: string; message?: string };
}
