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
