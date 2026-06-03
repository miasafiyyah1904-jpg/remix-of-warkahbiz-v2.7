import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.105.1/cors";

interface ChatBody {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ reply: "AI belum tersedia.", error: "missing_key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const body = (await req.json()) as ChatBody;
    if (!body?.systemPrompt || !Array.isArray(body?.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: body.systemPrompt }, ...body.messages],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("ai-chat gateway error", res.status, errText);
      if (res.status === 429) return json({ reply: "Terlalu banyak permintaan sekejap. Cuba lagi sebentar. ⏳", error: "rate_limit" });
      if (res.status === 402) return json({ reply: "Kredit AI dah habis. Sila tambah kredit di Lovable Cloud.", error: "no_credits" });
      return json({ reply: "Maaf, ada masalah teknikal. Cuba lagi.", error: `http_${res.status}` });
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content ?? "Maaf, tiada jawapan.";
    return json({ reply, error: null });
  } catch (e) {
    console.error("ai-chat exception", e);
    return json({ reply: "Maaf, ada masalah sambungan. Cuba lagi.", error: "exception" });
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }, status,
  });
}
