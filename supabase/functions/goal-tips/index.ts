import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a friendly Malaysian small-business coach (warung/kedai/SME).
Always reply in casual Malay (Bahasa Malaysia) using "Boss" to address the user.
Be highly specific, concrete, action-oriented. Mention real Malaysian context where relevant
(TEKUN, MARA, SME Corp, JAKIM, MOH, MDEC, Shopee Food, Grab, FAMA, pasar borong).
Avoid generic advice. Numbers, percentages, and named agencies build credibility.`;

// ---------- Tool schemas per mode ----------
const tools = {
  // 3 short tips (used as legacy and as Flow 2 step-4 tips)
  tips: {
    type: "function",
    function: {
      name: "return_tips",
      description: "Return exactly 3 tailored, actionable tips.",
      parameters: {
        type: "object",
        properties: {
          tips: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
        },
        required: ["tips"],
        additionalProperties: false,
      },
    },
  },
  // Flow 1 step 3: benefits of buying this machine
  benefits: {
    type: "function",
    function: {
      name: "return_benefits",
      description: "Return 3 concrete benefits of acquiring this machine/equipment.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "1-sentence why-it's-worth-it summary" },
          benefits: { type: "array", minItems: 3, maxItems: 4, items: { type: "string" } },
        },
        required: ["summary", "benefits"],
        additionalProperties: false,
      },
    },
  },
  // Flow 1/3 step 5: 3 savings plan options
  plans: {
    type: "function",
    function: {
      name: "return_plans",
      description: "Return exactly 3 monthly savings plan options with months-to-goal.",
      parameters: {
        type: "object",
        properties: {
          plans: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                monthly: { type: "number", description: "RM saved per month" },
                months: { type: "number", description: "months to reach goal" },
                label: { type: "string", description: "short label e.g. 'Santai', 'Sederhana', 'Pantas'" },
              },
              required: ["monthly", "months", "label"],
              additionalProperties: false,
            },
          },
        },
        required: ["plans"],
        additionalProperties: false,
      },
    },
  },
  // Flow 2 step 3: monthly target -> daily breakdown
  salesBreakdown: {
    type: "function",
    function: {
      name: "return_sales_breakdown",
      description: "Break a monthly RM target into a realistic daily plan for a Malaysian warung.",
      parameters: {
        type: "object",
        properties: {
          weekdayTarget: { type: "number", description: "RM per weekday" },
          weekendTarget: { type: "number", description: "RM per weekend day" },
          dailyAverage: { type: "number", description: "Pure average RM/day" },
          insight: { type: "string", description: "1-2 sentence insight about the breakdown" },
        },
        required: ["weekdayTarget", "weekendTarget", "dailyAverage", "insight"],
        additionalProperties: false,
      },
    },
  },
  // Flow 3 step 2: location suggestions
  locations: {
    type: "function",
    function: {
      name: "return_locations",
      description: "Suggest 3 strategic locations for a new branch in Malaysia.",
      parameters: {
        type: "object",
        properties: {
          locations: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                reason: { type: "string" },
              },
              required: ["name", "reason"],
              additionalProperties: false,
            },
          },
        },
        required: ["locations"],
        additionalProperties: false,
      },
    },
  },
  // Flow 3 step 3: itemized cost breakdown for opening a branch
  costBreakdown: {
    type: "function",
    function: {
      name: "return_cost_breakdown",
      description: "Itemized startup cost checklist for opening a new branch at the given location.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            minItems: 4,
            maxItems: 8,
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                cost: { type: "number" },
                note: { type: "string" },
              },
              required: ["name", "cost"],
              additionalProperties: false,
            },
          },
          total: { type: "number" },
        },
        required: ["items", "total"],
        additionalProperties: false,
      },
    },
  },
};

// ---------- Fallbacks ----------
const FALLBACKS = {
  tips: {
    tips: [
      "Boss, mula dengan jumlah kecil dulu — kurangkan risiko sebelum komited modal besar.",
      "Cuba dapatkan 2-3 sebut harga berbeza sebelum bayar — biasanya jimat 10-15%.",
      "Catat hasil setiap minggu untuk pastikan pelaburan ni betul-betul bayar balik.",
    ],
  },
  benefits: {
    summary: "Mesin ni boleh tingkatkan output dan kurangkan kerja manual Boss.",
    benefits: [
      "Output harian boleh naik 2-3 kali ganda berbanding buat manual.",
      "Kualiti lebih konsisten — pelanggan dapat rasa yang sama setiap kali.",
      "Boss boleh fokus pada jualan dan pelanggan, bukan kerja kasar.",
    ],
  },
  plans: {
    plans: [
      { monthly: 200, months: 24, label: "Santai" },
      { monthly: 400, months: 12, label: "Sederhana" },
      { monthly: 800, months: 6, label: "Pantas" },
    ],
  },
  salesBreakdown: {
    weekdayTarget: 0,
    weekendTarget: 0,
    dailyAverage: 0,
    insight: "Tetapkan target Boss dulu untuk dapat pecahan harian.",
  },
  locations: {
    locations: [
      { name: "Kawasan pejabat di Bandar", reason: "Trafik tinggi waktu lunch (12-2pm)." },
      { name: "Tepi sekolah / kolej", reason: "Pelanggan tetap pelajar & guru, lepas sekolah ramai." },
      { name: "Pasar malam mingguan", reason: "Kos rendah, exposure tinggi, uji pasaran dulu." },
    ],
  },
  costBreakdown: {
    items: [
      { name: "Sewa & deposit (3 bulan)", cost: 3000 },
      { name: "Khemah / canopy & meja", cost: 1500 },
      { name: "Lesen & permit MBPJ/MBSA", cost: 500 },
      { name: "Stok permulaan", cost: 1500 },
    ],
    total: 6500,
  },
};

function buildUserPrompt(mode: string, body: Record<string, unknown>): string {
  const boss = body.businessName || "warung Boss";
  switch (mode) {
    case "benefits":
      return `Boss nak beli mesin/peralatan untuk ${boss}.
- Nama: ${body.goalName || "(tidak dinyatakan)"}
- Anggaran kos: RM ${Number(body.cost) || 0}
Senaraikan TEPAT 3-4 kelebihan konkrit untuk membeli mesin spesifik ni. Mula dengan satu ayat ringkasan.`;

    case "plans":
      return `Boss perlu kumpul RM ${Number(body.cost) || 0} untuk: ${body.goalName || "matlamat"}.
Boleh jimat dalam julat RM ${Number(body.canSavePerMonth) || 200}/bulan.
Cadangkan TEPAT 3 pelan simpanan bulanan (Santai, Sederhana, Pantas).
Kira months = ceil(cost / monthly). Pastikan jumlah bulan masuk akal (3-36 bulan).`;

    case "salesBreakdown":
      return `Boss target jualan RM ${Number(body.monthlyTarget) || 0} sebulan untuk ${boss}.
Pecahkan kepada target harian. Andaian: weekend (Sabtu/Ahad) lebih ramai pelanggan ~1.5-2x weekday.
Berikan: weekdayTarget, weekendTarget, dailyAverage (semua dalam RM), dan satu insight padat.`;

    case "salesTips":
      return `Boss nak naikkan jualan ${boss} kepada RM ${Number(body.monthlyTarget) || 0}/bulan.
Sekarang biasanya buat: ${body.currentSales ? `RM ${body.currentSales}/bulan` : "(tidak dinyatakan)"}.
Beri TEPAT 3 langkah operasi spesifik & boleh buat dalam 1 minggu (bundling, supplier, marketing, dsb).`;

    case "locations":
      return `Boss nak buka cawangan baru untuk ${boss}.
Bisnes: ${body.businessType || "F&B / warung"}.
Cadangkan 3 jenis lokasi strategik di Malaysia (boleh sebut contoh kawasan), dengan sebab ringkas setiap satu.`;

    case "costBreakdown":
      return `Boss nak buka cawangan baru di: ${body.location || "(lokasi belum ditentukan)"}.
Bisnes: ${body.businessType || "F&B / warung"}.
Senaraikan 4-7 item kos permulaan dengan anggaran RM realistik untuk Malaysia.
Termasuk: sewa+deposit, peralatan, lesen, stok permulaan, marketing, dsb.
Kira total = jumlah semua items.`;

    default:
      // legacy "tips" mode
      return `Bantu Boss buat keputusan pelaburan:
- Jenis: ${body.goalType}
- Nama: ${body.goalName || "(tidak dinyatakan)"}
- Kos: RM ${Number(body.cost) || 0}
- ROI break-even: ${body.paybackDays ? `${body.paybackDays} hari` : "tidak diketahui"}
- Faedah: ${body.benefit || "(tidak dinyatakan)"}
Hasilkan TEPAT 3 tip pendek, padat, boleh diambil tindakan dalam 1 minggu.`;
  }
}

function getToolForMode(mode: string) {
  switch (mode) {
    case "benefits": return tools.benefits;
    case "plans": return tools.plans;
    case "salesBreakdown": return tools.salesBreakdown;
    case "locations": return tools.locations;
    case "costBreakdown": return tools.costBreakdown;
    case "salesTips":
    case "tips":
    default:
      return tools.tips;
  }
}

function getFallback(mode: string) {
  switch (mode) {
    case "benefits": return FALLBACKS.benefits;
    case "plans": return FALLBACKS.plans;
    case "salesBreakdown": return FALLBACKS.salesBreakdown;
    case "locations": return FALLBACKS.locations;
    case "costBreakdown": return FALLBACKS.costBreakdown;
    case "salesTips":
    case "tips":
    default:
      return FALLBACKS.tips;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json().catch(() => ({}));
    const mode = (body?.mode as string) || "tips";
    const tool = getToolForMode(mode);
    const fallback = getFallback(mode);
    const userPrompt = buildUserPrompt(mode, body ?? {});

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: tool.function.name } },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error", aiResp.status, text);
      const status = aiResp.status === 429 || aiResp.status === 402 ? aiResp.status : 500;
      return new Response(JSON.stringify({ ...fallback, error: `gateway_${aiResp.status}` }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch (e) {
      console.error("Failed to parse tool args", e);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("goal-tips error", e);
    return new Response(JSON.stringify({ ...getFallback("tips"), error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
