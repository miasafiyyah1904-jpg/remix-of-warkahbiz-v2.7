// Malaysian federal public holidays for 2026.
// Source: hard-coded list per request. Names kept short for AI/UI consumption.
export interface MYHoliday {
  date: string; // ISO yyyy-mm-dd
  name: string;
}

export const MY_HOLIDAYS_2026: MYHoliday[] = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-01-14", name: "YDPA Birthday" },
  { date: "2026-02-01", name: "Federal Territory Day" },
  { date: "2026-02-17", name: "Chinese New Year" },
  { date: "2026-02-18", name: "Chinese New Year (Day 2)" },
  { date: "2026-03-20", name: "Nuzul Al-Quran" },
  { date: "2026-03-21", name: "Hari Raya Aidilfitri" },
  { date: "2026-03-22", name: "Hari Raya Aidilfitri (Day 2)" },
  { date: "2026-05-01", name: "Labour Day" },
  { date: "2026-05-01", name: "Wesak Day" }, // approx
  { date: "2026-05-27", name: "Hari Raya Aidiladha" },
  { date: "2026-06-06", name: "YDPA Official Birthday" },
  { date: "2026-06-17", name: "Awal Muharram" },
  { date: "2026-08-25", name: "Maulidur Rasul" },
  { date: "2026-08-31", name: "Hari Kebangsaan" },
  { date: "2026-09-16", name: "Malaysia Day" },
  { date: "2026-11-08", name: "Deepavali" },
  { date: "2026-12-25", name: "Christmas Day" },
];

// Ramadan (approx): 2026 ≈ 17 Feb – 19 Mar; 2027 ≈ 7 Feb – 8 Mar.
// Request specifies 20 Feb – 20 Mar 2026 window — used verbatim.
const RAMADAN_RANGES: Array<[string, string]> = [
  ["2026-02-20", "2026-03-20"],
  ["2027-02-07", "2027-03-08"],
];

export function isRamadanPeriod(now: Date = new Date()): boolean {
  const iso = now.toISOString().slice(0, 10);
  return RAMADAN_RANGES.some(([s, e]) => iso >= s && iso <= e);
}

export function getUpcomingHolidays(now: Date = new Date(), withinDays = 14): MYHoliday[] {
  const start = now.toISOString().slice(0, 10);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + withinDays);
  const end = endDate.toISOString().slice(0, 10);
  return MY_HOLIDAYS_2026.filter((h) => h.date >= start && h.date <= end);
}

export const MY_SCHOOL_HOLIDAYS_2026: Array<{start:string; end:string; label:string}> = [
  { start:"2026-01-01", end:"2026-01-02", label:"Cuti Tahun Baru" },
  { start:"2026-03-14", end:"2026-03-22", label:"Cuti Sekolah Pertengahan" },
  { start:"2026-05-16", end:"2026-05-31", label:"Cuti Sekolah Pertengahan Tahun" },
  { start:"2026-08-08", end:"2026-08-16", label:"Cuti Sekolah Pertengahan" },
  { start:"2026-11-21", end:"2026-12-31", label:"Cuti Sekolah Akhir Tahun" },
];

const RAYA_WINDOWS: Array<{start:string; end:string}> = [
  { start:"2026-03-21", end:"2026-04-04" },
  { start:"2027-03-10", end:"2027-03-24" },
];

export interface CulturalSignal {
  multiplier: number;
  label: string | null;
  type: "ramadan" | "raya" | "holiday" | "school" | null;
}

export function getCulturalMultiplier(date: Date): CulturalSignal {
  const iso = date.toISOString().slice(0, 10);

  for (const w of RAYA_WINDOWS) {
    if (iso >= w.start && iso <= w.end) {
      const daysIn = Math.round((date.getTime() - new Date(w.start).getTime()) / 86400000);
      if (daysIn === 0) return { multiplier:0.40, label:"Hari Raya Hari 1", type:"raya" };
      if (daysIn === 1) return { multiplier:0.45, label:"Hari Raya Hari 2", type:"raya" };
      if (daysIn <= 6)  return { multiplier:0.65, label:"Minggu Raya", type:"raya" };
      return             { multiplier:0.85, label:"Pasca Raya", type:"raya" };
    }
  }

  for (const [start, end] of RAMADAN_RANGES) {
    if (iso >= start && iso <= end) {
      const startMs   = new Date(start).getTime();
      const endMs     = new Date(end).getTime();
      const totalDays = Math.round((endMs - startMs) / 86400000) + 1;
      const dayNum    = Math.round((date.getTime() - startMs) / 86400000) + 1;

      if (dayNum >= totalDays - 2) return { multiplier:1.30, label:"3 Hari Sebelum Raya 🎉", type:"ramadan" };
      if (dayNum >= totalDays - 6) return { multiplier:1.10, label:"Akhir Ramadan", type:"ramadan" };
      if (dayNum > totalDays / 2)  return { multiplier:0.70, label:"Pertengahan Ramadan", type:"ramadan" };
      return { multiplier:0.75, label:"Awal Ramadan", type:"ramadan" };
    }
  }

  const isHoliday = MY_HOLIDAYS_2026.some(h => h.date === iso);
  if (isHoliday) {
    const holiday = MY_HOLIDAYS_2026.find(h => h.date === iso)!;
    const tomorrowDate = new Date(date); tomorrowDate.setDate(tomorrowDate.getDate()+1);
    const tomorrow = tomorrowDate.toISOString().slice(0,10);
    const isLongWeekend = MY_HOLIDAYS_2026.some(h => h.date === tomorrow);
    return { multiplier: isLongWeekend ? 0.65 : 0.75, label: holiday.name, type:"holiday" };
  }
  const tomorrow = new Date(date); tomorrow.setDate(tomorrow.getDate()+1);
  const tIso = tomorrow.toISOString().slice(0,10);
  if (MY_HOLIDAYS_2026.some(h => h.date === tIso)) {
    return { multiplier:1.05, label:"Hujung Minggu Panjang", type:"holiday" };
  }

  for (const sh of MY_SCHOOL_HOLIDAYS_2026) {
    if (iso >= sh.start && iso <= sh.end) {
      return { multiplier:0.90, label:sh.label, type:"school" };
    }
  }

  return { multiplier:1.0, label:null, type:null };
}

export interface PaydaySignal {
  multiplier: number;
  label: string | null;
}

export function getPaydayMultiplier(date: Date): PaydaySignal {
  const day   = date.getDate();
  const month = date.getMonth();
  const isBonusMonth = month === 11 || month === 5;

  if (day === 1)                    return { multiplier: isBonusMonth ? 1.20 : 1.15, label:"Gaji Kerajaan 💰" };
  if (day === 2 || day === 3)       return { multiplier:1.08, label:"Pasca Gaji Kerajaan" };
  if (day === 15)                   return { multiplier:1.08, label:"Pertengahan Bulan" };
  if (day >= 25 && day <= 28)       return { multiplier: isBonusMonth ? 1.18 : 1.10, label:"Gaji Swasta 💰" };
  if (day >= 29)                    return { multiplier: isBonusMonth ? 1.20 : 1.12, label:"Hujung Bulan" };
  if (day >= 8  && day <= 12)       return { multiplier:0.94, label:null };
  if (day >= 20 && day <= 23)       return { multiplier:0.93, label:null };

  return { multiplier:1.0, label:null };
}
