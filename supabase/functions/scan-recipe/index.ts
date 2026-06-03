const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_UNITS = ["kg", "g", "liter", "ml", "biji", "pek", "paket", "kotak", "botol", "tin", "bungkus", "batang", "helai", "ikat", "tong", "papan", "kampit", "ekor", "sudu", "cawan", "unit", "pcs", "box", "pack", "dozen"];

const SYSTEM_PROMPT = `You are a recipe reader for a Malaysian food stall owner app.
Extract all ingredients from the recipe image and return them via the provided tool.

Rules:
- "name" must be in Bahasa Malaysia, the GENERIC INGREDIENT KEY NAME (short, no brand, no size).
  * "Tepung Gandum Cap Kapal 1kg" → "tepung gandum"
  * "MAGGI Sos Cili 500g" → "sos cili"
- "unit" MUST be EXACTLY one of: ${ALLOWED_UNITS.join(", ")}.
- UNIT PRESERVATION (CRITICAL): If the recipe explicitly writes a packaging unit such as "kotak", "botol", "tin", "bungkus", "pek", "paket", "kampit", "ikat", "helai", "batang", "biji", "ekor", "sudu", "cawan" — return that EXACT word as the unit. Do NOT convert "kotak" to "box" or "pcs". Do NOT convert "botol" to "bottle". Keep Malay packaging units verbatim.
  * "2 kotak susu" → qty 2, unit "kotak"
  * "1 botol kicap" → qty 1, unit "botol"
  * "3 bungkus mi" → qty 3, unit "bungkus"
  * "1 tin sardin" → qty 1, unit "tin"
- Convert only these: gram/gm → "g", L/litre → "liter", ml/mL → "ml", ulas/sk/sb → "sudu", btg → "batang".
- "qty" must be a positive number. Default 1 if unclear.
- Skip non-measured items (garnish text, instructions).
- If image is not a recipe, return empty items.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "return_recipe",
    description: "Return parsed recipe ingredients",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              qty: { type: "number" },
              unit: { type: "string", enum: ALLOWED_UNITS },
            },
            required: ["name", "qty", "unit"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }, status,
  });
}

function normalizeUnit(u: string): string {
  const x = (u || "").toString().toLowerCase().trim();
  const map: Record<string, string> = {
    gram: "g", gm: "g", grams: "g",
    kilogram: "kg", kilo: "kg", kgs: "kg",
    l: "liter", litre: "liter", litres: "liter", liters: "liter",
    millilitre: "ml", milliliter: "ml", mls: "ml",
    ulas: "sudu", sk: "sudu", sb: "sudu", tsp: "sudu", tbsp: "sudu",
    btg: "batang",
    box: "kotak", boxes: "kotak",
    bottle: "botol", btl: "botol",
    can: "tin", tins: "tin",
    packet: "paket", packets: "paket", pkt: "paket",
    bag: "bungkus",
  };
  if (map[x]) return map[x];
  if (ALLOWED_UNITS.includes(x)) return x;
  return "unit";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ ok: false, error: "missing_key", message: "AI belum tersedia.", items: [] });

    const body = await req.json() as { imageBase64: string; mimeType?: string };
    if (!body?.imageBase64 || body.imageBase64.length < 50) {
      return json({ ok: false, error: "invalid_input", message: "Imej tak sah.", items: [] }, 400);
    }
    const mimeType = body.mimeType || "image/jpeg";
    const dataUrl = body.imageBase64.startsWith("data:") ? body.imageBase64 : `data:${mimeType};base64,${body.imageBase64}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: "Extract all ingredients from this recipe image. Preserve Malay packaging units like 'kotak', 'botol', 'bungkus', 'tin' exactly as written." },
            { type: "image_url", image_url: { url: dataUrl } },
          ] },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "return_recipe" } },
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("scan-recipe gateway error", res.status, t);
      if (res.status === 429) return json({ ok: false, error: "rate_limit", message: "Terlalu banyak permintaan.", items: [] });
      if (res.status === 402) return json({ ok: false, error: "no_credits", message: "Kredit AI habis.", items: [] });
      return json({ ok: false, error: `http_${res.status}`, message: "Gagal imbas resepi.", items: [] });
    }

    const data = await res.json();
    const argsStr = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) return json({ ok: false, error: "no_tool_call", message: "AI tak dapat baca resepi.", items: [] });
    let parsed: { items: Array<{ name: string; qty: number; unit: string }> };
    try { parsed = JSON.parse(argsStr); } catch { return json({ ok: false, error: "bad_json", message: "Format salah.", items: [] }); }
    const items = Array.isArray(parsed.items)
      ? parsed.items.map((it) => ({
          name: String(it.name || "").trim() || "Bahan",
          qty: Number(it.qty) > 0 ? Number(it.qty) : 1,
          unit: normalizeUnit(String(it.unit || "unit")),
        }))
      : [];
    return json({ ok: true, items });
  } catch (e) {
    console.error("scan-recipe exception", e);
    return json({ ok: false, error: "exception", message: "Masalah sambungan.", items: [] });
  }
});
