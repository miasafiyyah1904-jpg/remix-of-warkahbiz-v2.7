export type OpportunityCategory = "retail" | "food";

export interface Opportunity {
  id: string;
  title: string;
  location: string;
  start: string; // ISO date
  end: string;   // ISO date
  description: string;
  category: OpportunityCategory;
  forcePriority?: boolean;
}

// Anchor "today" to late April 2026 per spec, but compare with real date too.
export const REFERENCE_TODAY = new Date("2026-04-30");

export const OPPORTUNITIES: Opportunity[] = [
  // Retail / Lifestyle Bazaars
  {
    id: "mytown-mrt",
    title: "MyTOWNKL MRT Tunnel",
    location: "Kuala Lumpur",
    start: "2026-04-04",
    end: "2026-12-31",
    description: "Pasar hujung minggu — jenama terpilih, barangan handmade, makanan & dessert.",
    category: "retail",
    forcePriority: true,
  },
  {
    id: "ekocheras-artisan",
    title: "EkoCheras — The Artisan Market",
    location: "Kuala Lumpur",
    start: "2026-04-03",
    end: "2026-04-19",
    description: "Pasar bertemakan barangan kraf & artisan di EkoCheras Mall.",
    category: "retail",
  },
  {
    id: "ekocheras-five1",
    title: "EkoCheras — Five1 Bazaar",
    location: "Kuala Lumpur",
    start: "2026-04-20",
    end: "2026-05-03",
    description: "Bazaar bertema Five1 — peluang jualan untuk vendor F&B & lifestyle.",
    category: "retail",
    forcePriority: true,
  },
  {
    id: "ekocheras-mami",
    title: "EkoCheras — Mami Market",
    location: "Kuala Lumpur",
    start: "2026-05-04",
    end: "2026-05-17",
    description: "Mami Market — vendor makanan, minuman & lifestyle.",
    category: "retail",
    forcePriority: true,
  },
  {
    id: "curve-lurve-1",
    title: "The Curve — Lurve Market",
    location: "Mutiara Damansara, Selangor",
    start: "2026-04-17",
    end: "2026-04-19",
    description: "Pasar hujung minggu di The Curve.",
    category: "retail",
  },
  {
    id: "curve-lurve-2",
    title: "The Curve — Lurve Market",
    location: "Mutiara Damansara, Selangor",
    start: "2026-04-24",
    end: "2026-04-26",
    description: "Pasar hujung minggu di The Curve (sesi kedua).",
    category: "retail",
  },
  {
    id: "nu-sentral",
    title: "NU Sentral — Pop-up Bazaar",
    location: "Kuala Lumpur",
    start: "2026-04-27",
    end: "2026-05-17",
    description: "Bazaar di Centre Court — kawasan trafik tinggi.",
    category: "retail",
    forcePriority: true,
  },
  {
    id: "1montkiara",
    title: "1 Mont Kiara — Concourse Bazaar",
    location: "Kuala Lumpur",
    start: "2026-05-26",
    end: "2026-06-15",
    description: "Bazaar di kawasan Concourse 1 Mont Kiara.",
    category: "retail",
    forcePriority: true,
  },
  {
    id: "kloe-klove-11",
    title: "KLoé Hotel — KLove Market #11",
    location: "Kuala Lumpur",
    start: "2026-05-09",
    end: "2026-05-09",
    description: "Pasar sehari menampilkan jenama tempatan terpilih.",
    category: "retail",
    forcePriority: true,
  },
  {
    id: "setia-payday",
    title: "Setia City Mall — Payday Bazaar",
    location: "Selangor",
    start: "2026-05-29",
    end: "2026-06-07",
    description: "Bazaar payday — peluang jualan akhir bulan.",
    category: "retail",
    forcePriority: true,
  },
  {
    id: "gurney-switch",
    title: "Switch World @ Gurney Plaza",
    location: "Pulau Pinang",
    start: "2026-06-04",
    end: "2026-06-07",
    description: "Acara teknologi & lifestyle dengan rakan strategik.",
    category: "retail",
    forcePriority: true,
  },

  // Food & Hospitality
  {
    id: "lovefoodfest",
    title: "Love Food Fest x Lapar Society",
    location: "Stadium Batu Kawan, Pulau Pinang",
    start: "2026-04-24",
    end: "2026-04-26",
    description: "9 pagi – 11 malam. Festival makanan besar dengan ramai vendor.",
    category: "food",
  },
  {
    id: "mft-carnival",
    title: "MFT Food Carnival",
    location: "Taman Bandar Kwasa Damansara",
    start: "2026-04-24",
    end: "2026-04-26",
    description: "40+ vendor makanan viral, muzik live & cake picnic.",
    category: "food",
  },
  {
    id: "klfoodie",
    title: "KL Foodie Fest 2026",
    location: "MAEPS Serdang",
    start: "2026-10-24",
    end: "2026-10-25",
    description: "Festival besar untuk pencipta makanan tempatan.",
    category: "food",
    forcePriority: true,
  },
  {
    id: "selangor-mega",
    title: "Selangor Mega Food Festival 2026",
    location: "Selangor",
    start: "2026-10-03",
    end: "2026-10-04",
    description: "Inisiatif Visit Selangor 2026 — masakan tempatan & demo masakan live.",
    category: "food",
    forcePriority: true,
  },
  {
    id: "sial-2026",
    title: "Food & Drinks Malaysia by SIAL 2026",
    location: "MITEC, Kuala Lumpur",
    start: "2026-10-01",
    end: "2026-10-31",
    description: "Fokus pada inovasi makanan & perdagangan industri.",
    category: "food",
    forcePriority: true,
  },
  {
    id: "foodicious",
    title: "Foodicious Food & Beverage Expo",
    location: "Wilayah Utara",
    start: "2026-10-01",
    end: "2026-10-31",
    description: "200+ peserta pameran — gourmet & pengeluar berskala besar.",
    category: "food",
    forcePriority: true,
  },
  {
    id: "fhm-2027",
    title: "Food & Hospitality Malaysia (FHM) 2027",
    location: "KL Convention Centre",
    start: "2027-09-21",
    end: "2027-09-24",
    description: "Edisi ke-19 — platform perdagangan utama industri F&B.",
    category: "food",
    forcePriority: true,
  },
];
