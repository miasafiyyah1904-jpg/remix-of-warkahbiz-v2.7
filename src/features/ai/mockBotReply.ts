export const mockBotReply = (text: string): string => {
  const t = text.toLowerCase();
  if (t.includes("untung") || t.includes("profit"))
    return "Minggu ni Boss Zila untung **RM 2,360**! Bulan lepas lebih sikit — RM 2,580. Cuba kurangkan belanja minyak masak. 💡";
  if (t.includes("beli") || t.includes("stok"))
    return "Ayam dah nak habis! Cadangan beli **3 kg** hari ni. Anggaran kos: **RM 32**. 🛒";
  if (t.includes("harga") || t.includes("naik"))
    return "Berdasarkan rekod Boss, minyak masak naik **RM 2 seunit** berbanding bulan lepas. Cuba cari alternatif atau tambah sikit harga jual. 📈";
  if (t.includes("simpan") || t.includes("tabung") || t.includes("jimat"))
    return "Kalau Boss simpan **RM 200 sebulan**, dalam 6 bulan dah boleh beli mesin baru! 💰";
  return "Maaf, saya tak faham soalan tu. Cuba tanya pasal 'untung', 'stok', atau 'harga'. 😊";
};
