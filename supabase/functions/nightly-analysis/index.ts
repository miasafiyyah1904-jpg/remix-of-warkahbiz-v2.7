import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.105.1/cors";

interface AnalysisInput {
  businessName: string;
  totalSales: number;
  yesterdaySales: number;
  salesChangePct: number | null;
  totalExpenses: number;
  netProfit: number;
  weeklyTarget: number;
  weeklyRevenue: number;
  weeklyPct: number;
  criticalItems: string[];
  lowItems: string[];
  peakHour: number | null;
  // Enriched context
  profitTrend?: "improving" | "declining" | "stable" | null;
  topProductName?: string | null;
  wasteRatePercent?: number | null;
}

const SYSTEM_PROMPT = `Kau adalah penasihat perniagaan peribadi untuk peniaga mikro F&B Malaysia.
Tulis dalam Bahasa Melayu yang mesra dan mudah.
Jangan sekali-kali guna perkataan "kau" — sentiasa guna "Boss" atau nama bisnes.
Nada: seperti kawan yang faham bisnes, bukan seperti akaun atau bank.
Pendek, padat, terus ke point. Tiada fluff.

Gunakan konteks tambahan jika ada:
- Trend untung 30 hari (improving/declining/stable) — sebut dalam ringkasan jika bukan stable.
- Produk paling laku — guna nama produk dalam cadangan apabila relevan.
- Kadar pembaziran (%) — jika tinggi (>10%), sertakan amaran atau cadangan kurangkan waste.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return json({ error: "missing_key" }, 200);
    }

    const d = (await req.json()) as AnalysisInput;
    if (!d || typeof d.totalSales !== "number") {
      return json({ error: "invalid_input" }, 400);
    }

    const userPrompt = `Bisnes: ${d.businessName}
Ini data perniagaan hari ini:

Jualan hari ini: RM ${d.totalSales.toFixed(2)}
Jualan semalam: RM ${d.yesterdaySales.toFixed(2)}
Perubahan: ${d.salesChangePct === null ? "tiada data" : d.salesChangePct.toFixed(1) + "%"}

Belanja hari ini: RM ${d.totalExpenses.toFixed(2)}
Keuntungan hari ini: RM ${d.netProfit.toFixed(2)}

Target minggu: RM ${d.weeklyTarget.toFixed(2)}
Jualan minggu ini: RM ${d.weeklyRevenue.toFixed(2)} (${d.weeklyPct.toFixed(0)}%)

Stok kritikal: ${d.criticalItems.length ? d.criticalItems.join(", ") : "tiada"}
Stok rendah: ${d.lowItems.length ? d.lowItems.join(", ") : "tiada"}

Masa jualan terbanyak hari ini: ${d.peakHour === null ? "belum ada" : d.peakHour + ":00"}

Trend untung 30 hari: ${d.profitTrend ?? "tiada data"}
Produk paling laku 30 hari: ${d.topProductName ?? "tiada data"}
Kadar pembaziran: ${typeof d.wasteRatePercent === "number" ? d.wasteRatePercent.toFixed(1) + "%" : "tiada data"}

Sila berikan analisis dalam Bahasa Melayu mesra menggunakan tool 'nightly_summary'.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "nightly_summary",
              description: "Hasilkan ringkasan laporan malam untuk Boss.",
              parameters: {
                type: "object",
                properties: {
                  ringkasan: { type: "string", description: "2-3 ayat ringkasan hari ini" },
                  pencapaian: { type: "string", description: "1 perkara positif hari ini" },
                  amaran: { type: "string", description: "1 perkara yang perlu diberi perhatian" },
                  cadangan_esok: {
                    type: "array",
                    items: { type: "string" },
                    description: "3 tindakan untuk esok",
                  },
                  motivasi: { type: "string", description: "1-2 ayat semangat untuk Boss" },
                },
                required: ["ringkasan", "pencapaian", "amaran", "cadangan_esok", "motivasi"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "nightly_summary" } },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("nightly-analysis gateway error", res.status, errText);
      if (res.status === 429) return json({ error: "rate_limit" }, 200);
      if (res.status === 402) return json({ error: "no_credits" }, 200);
      return json({ error: `http_${res.status}` }, 200);
    }

    const data = await res.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "no_tool_call" }, 200);

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("parse error", e);
      return json({ error: "parse_failed" }, 200);
    }

    return json({ analysis: parsed, error: null });
  } catch (e) {
    console.error("nightly-analysis exception", e);
    return json({ error: "exception" }, 200);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
