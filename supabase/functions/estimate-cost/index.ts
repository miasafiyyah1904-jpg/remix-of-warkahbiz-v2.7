import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.105.1/cors";

const SYSTEM_PROMPT = `You are a Malaysian market price estimator for small F&B businesses.

Use the following reference prices from an Econsave supermarket catalogue (May 2026) as your PRIMARY source. Always prefer these over general knowledge. For items not on this list, estimate based on typical Malaysian wet market / kedai runcit / Mydin / Giant pricing (2025-2026 levels).

Reference prices (retail, per unit as stated):

FRESH PRODUCE:
- Kubis Bulat Cameron: RM 1.99 per kg
- Pak Choy: RM 2.99 per kg
- Lada Benggala Hijau Cameron: RM 3.99 per kg
- Cendawan Campur: RM 6.99 per pkt
- Ubi Kayu: RM 2.99 per kg
- Keledek Oren: RM 5.99 per kg
- Ubi Bit: RM 5.99 per kg
- Bawang Kecil Siam: RM 6.99 per kg
- Akar Burdock: RM 8.99 per kg
- Lobak Merah Import: RM 2.49 per kg
- Japanese Sweet Potato: RM 5.99 per kg
- Lemon: RM 1.59 per pcs
- Epal Hijau (M): RM 5.90 per 5pcs
- Oren Mandarin Wokan: RM 3.99 per pkt

MEAT & SEAFOOD:
- Rusuk Ayam: RM 6.99 per kg
- Chicken Drummet: RM 13.59 per kg
- Kepak Ayam: RM 13.59 per kg
- Ikan Sardin: RM 9.59 per kg
- Ikan Rebus: RM 18.90 per kg
- Ikan Masin Gelama Belah: RM 1.49 per 100g
- Ikan Bilis Kim Sua Langkawi: RM 3.99 per 100g
- Udang Geragau: RM 1.79 per 100g
- Frz Loligo Squid (10/20): RM 25.90 per pkt
- Frz Sotong Ring Berkulit/Tanpa Kulit: RM 15.90 per pkt

DRY GOODS & GRAINS:
- Kacang Dhali Australia: RM 0.35 per 100g (RM 15.00 per 5kg)
- Kacang Kuda Hitam: RM 0.55 per 100g (RM 22.50 per 5kg)
- Biji Sawi: RM 0.79 per 100g (RM 17.50 per 3kg)
- Jintan Manis: RM 0.99 per 100g (RM 21.90 per 3kg)

RICE & NOODLES:
- Sunflower Fragrant Rice: RM 37.90 per 10kg (RM 3.79 per kg)
- Cap Merak Import Rice: RM 26.90 per 10kg (RM 2.69 per kg)
- Saga Asli Super Special White Rice: RM 29.90 per 10kg (RM 2.99 per kg)
- Jasmine LaSella Parboiled/Steamed Rice: RM 29.40 per 5kg (RM 5.88 per kg)
- Taj Mahal Ponni Rice: RM 30.80 per 5kg (RM 6.16 per kg)
- Ecobrown's Original Unpolished Brown Rice: RM 17.90 per 5kg (RM 3.58 per kg)
- Mi Sedaap Goreng Asli (5s x 90gm): RM 4.69 per pack
- Nuuna Mi Segera (10+1 x 70gm): RM 4.70 per pack
- Maggi Syiok Instant Noodles (5s x 80-88gm): RM 7.30 per pack
- Mi Sedaap Instant Soup Noodles Assorted (5s x 66-83gm): RM 4.39 per pack

CONDIMENTS & SAUCES:
- Econsave Kicap Lemak Manis 2L: RM 13.90
- Tirana Kicap Lemak Manis 645ml: RM 6.90
- Mahsuri Kicap Manis/Pedas/Lemak Manis 410ml: RM 4.99
- Econsave Choice Kicap Pedas 360ml: RM 3.99
- Lee Kum Kee Oyster Flavoured Sauce 770ml: RM 6.30
- Machi Sos Tiram 800gm: RM 2.90
- Prego Pasta Sauce Assorted 290gm-300gm: RM 4.60
- Life Chilli Sauce/Tomato Ketchup 500gm/485gm: RM 4.20
- Puteri Chilli Sauce 900gm: RM 4.30
- Bon Chef Mayonnaise 1L: RM 6.90
- Naco Coconut Milk 1L: RM 10.90
- Adabi Serbuk Kari Ikan/Ayam/Daging 250gm: RM 4.90
- Adabi Tepung Goreng Ayam Asli/Pedas 250gm: RM 3.40
- Eva Peanut Butter Creamy/Crunchy 500gm: RM 10.90
- Maggi Marinate Paste 80gm/100gm: RM 7.99 (Buy 2)
- Senta Thin Rice Paper 120gm/150gm: RM 2.70

DAIRY & FROZEN:
- Marigold HL Milk Plain/Advance 1.89L: RM 13.90
- Westgold Salted/Unsalted Butter 250gm: RM 12.90
- Chesdale Cheese Plain 500gm: RM 20.50
- Farm Fresh Natural Set Yogurt 1.4kg: RM 15.50
- Fusipim Jumbo Beef Ball 500gm: RM 7.90
- Saudi Minced Chicken/Meat 400gm: RM 8.90
- CCM French Fries Crinkle/Shoestring 1kg: RM 6.50
- KG Bun Assorted 360gm: RM 4.90

BEVERAGES:
- Econsave Chocomalt 2kg: RM 25.90
- Indocafe Original Blend Refill Pack 500gm: RM 30.50
- Old Town 3in1 White Coffee Assorted: RM 15.50
- Klassno Colombian Blend Assorted: RM 8.50
- Ah Huat Teh C/Hainan Tea 15s x 32gm: RM 16.50
- Lipton Yellow Label Teabag 25s x 2gm: RM 4.70
- Marigold Sweetened Cream 1kg: RM 5.90
- Season's Asian Drink Assorted 6 x 250ml: RM 4.40
- Aik Cheong Chocolate/Cappuccino/Matcha/Mocha Drinks 12s x 25-40gm: RM 10.99

PACKAGING (relevant for F&B):
- Kenware Paper Cup 50s Plain/Printed 6oz: RM 2.50
- Toli Disposable PP Plate 7" 50s: RM 5.90
- Toli Disposable PP Plate 9" 50s: RM 8.90
- Toli Disposable PP Plate 10" 30s: RM 10.90
- Shamoji Paper Plate Plain 50s 6": RM 3.90
- Shamoji Paper Plate Plain 50s 7": RM 5.90
- Shamoji Paper Plate Plain 50s 9": RM 8.90
- Shamoji Disposable Cooking Paper Tray 50s 16cm: RM 4.90
- Shamoji Aluminium Foil 30cm x 7.62m: RM 3.90
- Shamoji Aluminium Foil 45cm x 7.62m: RM 6.20
- Matahari Hawker Paper 70s Size C (305x387mm): RM 4.20
- Matahari Hawker Paper 70s Size D (305x294mm): RM 3.20
- Econsave Charcoal Briquette 5kg: RM 15.90

Rules:
- Return the cost in RM for the EXACT quantity requested (not per kg unless asked).
- Be realistic; no taxes. Round to 2 decimal places.
- If the ingredient is unclear or non-food, return 0 and confidence "low".
- confidence: "high" if item matches the reference list above, "medium" for close matches or common staples not on the list, "low" for unusual items.
- Always return via the tool.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "return_estimate",
    parameters: {
      type: "object",
      properties: {
        cost: { type: "number" },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        note: { type: "string" },
      },
      required: ["cost", "confidence", "note"],
      additionalProperties: false,
    },
  },
};

function json(p: unknown, status = 200) {
  return new Response(JSON.stringify(p), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ ok: false, error: "missing_key", cost: 0 });

    const body = await req.json() as {
      name: string; quantity: number; unit: string;
      productName?: string; batchSize?: number; batchUnit?: string; cookingUnit?: string;
    };
    if (!body?.name || typeof body.quantity !== "number" || !body?.unit) {
      return json({ ok: false, error: "invalid_input", cost: 0 }, 400);
    }

    const contextLines: string[] = [];
    if (body.productName) contextLines.push(`Final product being made: ${body.productName}`);
    if (body.batchSize && body.batchUnit) {
      contextLines.push(`Recipe yields ${body.batchSize} ${body.batchUnit} per batch`);
    }
    if (body.cookingUnit) contextLines.push(`Cooking vessel/scale: ${body.cookingUnit}`);
    const contextBlock = contextLines.length
      ? `\nContext (use to gauge realistic per-ingredient portion cost):\n- ${contextLines.join("\n- ")}\n`
      : "";

    const userPrompt = `Estimate the Malaysian retail cost for: ${body.quantity} ${body.unit} of ${body.name}.${contextBlock}\nReturn the cost in RM for that exact quantity (not per kg). Use current Malaysian wet market / kedai runcit / Mydin / Giant pricing.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          tools: [TOOL_SCHEMA],
          tool_choice: { type: "function", function: { name: "return_estimate" } },
        }),
      });
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("estimate-cost fetch aborted/failed", err);
      return json({ ok: false, error: "timeout", cost: 0 });
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("estimate-cost error", res.status, t);
      if (res.status === 429) return json({ ok: false, error: "rate_limit", cost: 0 });
      if (res.status === 402) return json({ ok: false, error: "no_credits", cost: 0 });
      return json({ ok: false, error: `http_${res.status}`, cost: 0 });
    }

    const data = await res.json();
    const argsStr = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) return json({ ok: false, error: "no_tool_call", cost: 0 });
    let parsed: { cost: number; confidence: string; note: string };
    try { parsed = JSON.parse(argsStr); } catch { return json({ ok: false, error: "bad_json", cost: 0 }); }
    return json({ ok: true, cost: Math.max(0, Number(parsed.cost) || 0), confidence: parsed.confidence || "low", note: parsed.note || "" });
  } catch (e) {
    console.error("estimate-cost exception", e);
    return json({ ok: false, error: "exception", cost: 0 });
  }
});
