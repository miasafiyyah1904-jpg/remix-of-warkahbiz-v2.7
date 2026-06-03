import { supabase } from "@/integrations/supabase/client";

export async function askWarkahAI(args: { data: { systemPrompt: string; messages: Array<{ role: "user" | "assistant"; content: string }> } }) {
  const { data, error } = await supabase.functions.invoke("ai-chat", { body: args.data });
  if (error) {
    console.error("askWarkahAI error", error);
    return { reply: "Maaf, ada masalah sambungan. Cuba lagi.", error: "exception" as const };
  }
  return data as { reply: string; error: string | null };
}
