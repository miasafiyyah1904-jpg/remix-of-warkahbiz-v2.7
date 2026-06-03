import { useEffect, useState } from "react";

/**
 * Open-Meteo weather hook (no API key required).
 * Default coords: Kuala Lumpur. Boss can later override via settings.
 */
export interface DayWeather {
  date: string;          // ISO yyyy-mm-dd
  weatherCode: number;
  tMax: number;
  tMin: number;
  rainMm: number;        // total daily rain (mm)
  rainProb: number;      // % max precipitation probability
  emoji: string;
  label: string;
  severity: "ok" | "warn" | "alert";
  trafficAdjust: number; // % multiplier on foot traffic, e.g. -0.30 for heavy rain
}

const codeToMeta = (code: number, rainMm: number, rainProb: number, tMax: number) => {
  // WMO weather interpretation codes
  if ([95, 96, 99].includes(code)) return { emoji: "⛈️", label: "Ribut petir", severity: "alert" as const, trafficAdjust: -0.45 };
  if ([65, 67, 82].includes(code) || rainMm >= 15) return { emoji: "🌧️", label: "Hujan lebat", severity: "alert" as const, trafficAdjust: -0.30 };
  if ([61, 63, 80, 81].includes(code) || rainMm >= 5) return { emoji: "🌦️", label: "Hujan", severity: "warn" as const, trafficAdjust: -0.15 };
  if ([51, 53, 55, 56, 57].includes(code) || rainProb >= 60) return { emoji: "🌦️", label: "Renyai", severity: "warn" as const, trafficAdjust: -0.08 };
  if (tMax >= 35) return { emoji: "🥵", label: "Sangat panas", severity: "warn" as const, trafficAdjust: -0.05 };
  if ([0, 1].includes(code)) return { emoji: "☀️", label: "Cerah", severity: "ok" as const, trafficAdjust: 0.05 };
  if ([2, 3].includes(code)) return { emoji: "⛅", label: "Berawan", severity: "ok" as const, trafficAdjust: 0 };
  if ([45, 48].includes(code)) return { emoji: "🌫️", label: "Berjerebu", severity: "warn" as const, trafficAdjust: -0.05 };
  return { emoji: "🌤️", label: "Sederhana", severity: "ok" as const, trafficAdjust: 0 };
};

export function useWeather(lat = 3.139, lon = 101.6869, days = 7) {
  const [data, setData] = useState<DayWeather[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=Asia%2FKuala_Lumpur&forecast_days=${days}`;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const d = json?.daily;
        if (!d?.time) throw new Error("Bad weather data");
        const out: DayWeather[] = d.time.map((date: string, i: number) => {
          const code = d.weather_code[i];
          const tMax = d.temperature_2m_max[i];
          const tMin = d.temperature_2m_min[i];
          const rainMm = d.precipitation_sum[i] ?? 0;
          const rainProb = d.precipitation_probability_max[i] ?? 0;
          const meta = codeToMeta(code, rainMm, rainProb, tMax);
          return { date, weatherCode: code, tMax, tMin, rainMm, rainProb, ...meta };
        });
        setData(out);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e.message ?? "Tidak dapat ambil cuaca"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [lat, lon, days]);

  return { data, loading, error };
}