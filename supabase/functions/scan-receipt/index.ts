import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.105.1/cors";

const SYSTEM_PROMPT = `You are a receipt OCR assistant for a Malaysian small business app.
Parse the receipt image and extract structured data. Return ONLY a JSON object via the provided tool.

Rules:
- Detect vendor name and date (format date as readable string e.g. "24 April 2026", or empty if unknown).
- Extract the printed grand total (after tax/rounding) into "total". Extract total tax (SST/GST/service charge) into "tax". Use 0 if absent.
- Each item: name, qty (number), unit (one of: kg, g, liter, ml, biji, pek, kotak, batang, helai, tong, papan, kampit, ekor, unit, pcs, box, pack, dozen), price (RM, total for that line, number).
- NAME RULE (CRITICAL): Return only the GENERIC INGREDIENT KEY NAME in Malay — short, lowercase-friendly, NO brand, NO size, NO packaging descriptors, NO flavour modifiers unless essential.
  * "MAGGI TOMATO KETCHUP 500G" → "sos tomato"
  * "LIFE MAYONNAISE 380ML" → "mayonis"
  * "ADABI SERBUK CILI 1KG" → "serbuk cili"
  * "KILANG BERAS SUPER 5KG" → "beras"
  * "KACANG TANAH GORENG 200G" → "kacang tanah"
  * "PLASTIC BAG BLACK L" → "pek sampah"
  * "PREMIER TISSUE 10S" → "tisu"
  * Drop brand words (MAGGI, ADABI, LIFE, AYAM BRAND, KARA, etc.), drop sizes (500G, 1KG, 380ML), drop pack counts (10S, x6).
- KNOWN INGREDIENTS MATCHING: A list of existing ingredient key names will be provided. If a receipt item refers to the SAME generic ingredient as one in the list (even with a different brand/size/variant), reuse that EXACT existing key name (case + spelling). Only invent a new key name when there is no semantic match.
- Pick a relevant emoji per item (🍗 ayam, 🥚 telur, 🍚 beras, 🛢️ minyak, 🌾 tepung, 🥤 gula, 🧂 garam, 🧅 bawang, 🌶️ cili, 🥛 santan, 🥫 sos, 🧻 tisu, 🥜 kacang, 🛍️ pek sampah, 📦 bungkus, 🛒 generic).
- If qty/unit unclear, default qty=1 unit="unit".
- Skip subtotal/tax/total LINES from the items list — they are returned separately as total/tax fields.
- PRICE PRECISION (CRITICAL): Malaysian prices ALWAYS have exactly 2 decimal places. Read every digit carefully:
  * "6.90" must be 6.90 (NOT 6.9 or 6.09). "12.05" must be 12.05 (NOT 12.5).
  * Pay close attention to trailing zeros — RM 6.90, RM 10.00, RM 2.50 are common.
  * If a printed price looks like "X.X", it is almost certainly "X.X0" — re-read the receipt.
- Tax in Malaysia (SST/GST) is INCLUDED in the printed total, not added on top. The "total" field must be the final printed amount.
- Verify your work: sum(item prices) should equal the printed total (within RM 0.10 rounding). If it does NOT match, RE-READ each item price digit by digit, paying special attention to the cents (last 2 digits) before returning.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "return_receipt",
    description: "Return parsed receipt data",
    parameters: {
      type: "object",
      properties: {
        vendor: { type: "string" },
        date: { type: "string" },
        tax: { type: "number", description: "Total tax amount in RM, or 0 if none" },
        total: { type: "number", description: "Grand total printed on the receipt in RM" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              emoji: { type: "string" },
              name: { type: "string" },
              qty: { type: "number" },
              unit: { type: "string" },
              price: { type: "number" },
            },
            required: ["emoji", "name", "qty", "unit", "price"],
            additionalProperties: false,
          },
        },
      },
      required: ["vendor", "date", "tax", "total", "items"],
      additionalProperties: false,
    },
  },
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }, status,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ ok: false, error: "missing_key", message: "AI belum tersedia." });

    const body = await req.json() as { imageBase64: string; mimeType?: string; knownIngredients?: string[] };
    if (!body?.imageBase64 || body.imageBase64.length < 50) {
      return json({ ok: false, error: "invalid_input", message: "Imej tak sah." }, 400);
    }
    const mimeType = body.mimeType || "image/jpeg";
    const dataUrl = body.imageBase64.startsWith("data:") ? body.imageBase64 : `data:${mimeType};base64,${body.imageBase64}`;
    const known = (body.knownIngredients || []).filter((s) => typeof s === "string" && s.trim()).slice(0, 200);
    const knownBlock = known.length
      ? `Existing ingredient key names (reuse the EXACT spelling if the receipt item is the same generic ingredient, even with a different brand/size):\n${known.map((n) => `- ${n}`).join("\n")}`
      : `No existing ingredients yet — invent concise generic key names (no brand, no size).`;

    const callGateway = (model: string) => fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: `Parse this receipt and return the items via the tool. Remember: item "name" must be the GENERIC INGREDIENT KEY NAME only (no brand, no size).\n\n${knownBlock}` },
            { type: "image_url", image_url: { url: dataUrl } },
          ] },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "return_receipt" } },
      }),
    });

    // Retry chain: try primary, then back off on 429, then fall back to a less-busy model.
    const attempts: Array<{ model: string; waitMs: number }> = [
      { model: "google/gemini-2.5-flash", waitMs: 0 },
      { model: "google/gemini-2.5-flash", waitMs: 1500 },
      { model: "google/gemini-2.5-flash-lite", waitMs: 800 },
      { model: "google/gemini-2.5-flash-lite", waitMs: 2500 },
    ];
    let res: Response | null = null;
    let lastStatus = 0;
    let lastBody = "";
    for (const a of attempts) {
      if (a.waitMs) await new Promise((r) => setTimeout(r, a.waitMs));
      const r = await callGateway(a.model);
      if (r.ok) { res = r; break; }
      lastStatus = r.status;
      lastBody = await r.text().catch(() => "");
      console.warn("scan-receipt attempt failed", a.model, r.status);
      if (r.status !== 429 && r.status !== 503) break; // only retry on rate-limit / transient
    }

    if (!res) {
      console.error("scan-receipt gateway error", lastStatus, lastBody);
      if (lastStatus === 429) return json({ ok: false, error: "rate_limit", message: "AI sibuk sekarang. Cuba lagi sekejap." });
      if (lastStatus === 402) return json({ ok: false, error: "no_credits", message: "Kredit AI habis." });
      return json({ ok: false, error: `http_${lastStatus}`, message: "Gagal scan resit." });
    }

    const data = await res.json();
    const argsStr = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) return json({ ok: false, error: "no_tool_call", message: "AI tak dapat baca resit." });
    let parsed: { vendor: string; date: string; tax?: number; total?: number; items: Array<{ emoji: string; name: string; qty: number; unit: string; price: number }> };
    try { parsed = JSON.parse(argsStr); } catch { return json({ ok: false, error: "bad_json", message: "Format salah." }); }
    return json({ ok: true, vendor: parsed.vendor || "", date: parsed.date || "", tax: Number(parsed.tax) || 0, total: Number(parsed.total) || 0, items: parsed.items || [] });
  } catch (e) {
    console.error("scan-receipt exception", e);
    return json({ ok: false, error: "exception", message: "Masalah sambungan." });
  }
});
