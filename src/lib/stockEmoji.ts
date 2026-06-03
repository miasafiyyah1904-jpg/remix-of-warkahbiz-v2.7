// Auto-assign emoji based on item name (Malaysian kitchen / retail context)
export function emojiForItem(name: string): string {
  const n = name.toLowerCase().trim();
  // Exact or substring match in priority order
  const map: [string[], string][] = [
    // Sauces & condiments
    [["sos cili", "cili sos", "chili sauce"], "🌶️"],
    [["sos tomato", "tomato sos", "tomato sauce"], "🍅"],
    [["mayonis", "mayonnaise", "mayo"], "🥚"],
    [["sos tiram", "oyster sauce", "tiram"], "🦪"],
    [["kicap", "soy sauce", "soy sos"], "🍶"],
    [["cuka", "vinegar"], "🍾"],
    [["sos salad", "salad dressing"], "🥗"],
    // Staples
    [["beras", "rice"], "🍚"],
    [["tepung", "flour"], "🌾"],
    [["gula", "sugar"], "🍬"],
    [["garam", "salt"], "🧂"],
    [["minyak", "oil"], "🛢️"],
    [["minyak masak", "cooking oil"], "🛢️"],
    [["santan", "coconut milk"], "🥥"],
    // Proteins
    [["ayam", "chicken"], "🐔"],
    [["daging", "beef", "meat"], "🥩"],
    [["ikan", "fish"], "🐟"],
    [["udang", "prawn", "shrimp"], "🦐"],
    [["sotong", "squid", "cuttlefish"], "🦑"],
    [["telur", "egg"], "🥚"],
    // Produce
    [["bawang", "onion"], "🧅"],
    [["bawang putih", "garlic"], "🧄"],
    [["cili", "chili"], "🌶️"],
    [["tomato"], "🍅"],
    [["timun", "cucumber"], "🥒"],
    [["lobak", "carrot", "lobak merah"], "🥕"],
    [["kobis", "cabbage"], "🥬"],
    [["sayur", "vegetable"], "🥬"],
    [["buah", "fruit"], "🍎"],
    [["limau", "orange", "lemon", "lime"], "🍋"],
    [["pisang", "banana"], "🍌"],
    // Dairy & beverages
    [["susu", "milk"], "🥛"],
    [["kopi", "coffee"], "☕"],
    [["teh", "tea"], "🍵"],
    [["air", "water"], "💧"],
    [["minuman", "drink", "beverage"], "🥤"],
    // Noodles & bread
    [["mee", "noodle", "mi"], "🍜"],
    [["roti", "bread"], "🍞"],
    // Snacks / nuts
    [["kacang", "nut", "peanut"], "🥜"],
    // Packaging & disposables
    [["tisu", "tissue"], "🧻"],
    [["plastik", "plastic bag", "beg"], "🛍️"],
    [["pek sampah", "sampah", "trash bag", "garbage"], "🗑️"],
    [["kotak", "box", "carton"], "📦"],
    [["bungkus", "pack", "wrapper"], "📦"],
    [["cawan", "cup"], "🥤"],
    [["sudu", "spoon"], "🥄"],
    [["garfu", "fork"], "🍴"],
    [["pinggan", "plate"], "🍽️"],
    // Cleaning
    [["sabun", "soap"], "🧼"],
    [["deterjen", "detergent"], "🫧"],
    [["pembersih", "cleaner"], "🧴"],
    // Gas / utilities
    [["gas", "lpg"], "🔥"],
    // Generic fallback cues
    [["sos"], "🥫"],
    [["serbuk"], "🧂"],
  ];
  for (const [keywords, emoji] of map) {
    for (const kw of keywords) {
      if (n.includes(kw)) return emoji;
    }
  }
  return "📦";
}
