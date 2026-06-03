import { useMemo } from "react";
import { ArrowLeft, FileText, Sparkles, AlertTriangle, CheckCircle2, Trophy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fmt } from "@/lib/format";

export interface DayResult {
  day: string;
  date: string;
  forecast: number;
  actual: number;
  weather: string;
}

interface AutopsyReportProps {
  onClose: () => void;
  businessName: string;
  results: DayResult[];
  eventName: string;
}

const addressBoss = (b: string) => (b?.trim() ? b.trim() : "Boss");

export function AutopsyReport({
  onClose,
  businessName,
  results,
  eventName,
}: AutopsyReportProps) {
  const boss = addressBoss(businessName);

  const hasData = results && results.length > 0;

  const stats = useMemo(() => {
    const open = (results ?? []).filter((r) => r.forecast > 0);
    const totalForecast = open.reduce((s, r) => s + r.forecast, 0);
    const totalActual = open.reduce((s, r) => s + r.actual, 0);
    const variance = totalActual - totalForecast;
    const accuracy = open.length
      ? Math.round(
          100 -
            (open.reduce((s, r) => s + Math.abs(r.actual - r.forecast) / r.forecast, 0) / open.length) * 100,
        )
      : 0;
    const matCost = totalActual * 0.45;
    const profit = totalActual - matCost;
    return { totalForecast, totalActual, variance, accuracy, matCost, profit };
  }, [results]);

  const wins = useMemo(() => {
    const arr: { title: string; desc: string }[] = [];
    const best = [...results].filter((r) => r.actual > 0).sort((a, b) => b.actual - a.actual)[0];
    if (best) arr.push({ title: `Hari terbaik: ${best.day}`, desc: `${boss} cetak rekod jualan ${fmt(best.actual)} pada ${best.date} (${best.weather}).` });
    if (stats.variance > 0) arr.push({ title: "Lebih dari ramalan", desc: `Jumlah jualan ${boss} mengatasi ramalan AI sebanyak ${fmt(stats.variance)} 🎉` });
    if (stats.accuracy >= 80) arr.push({ title: `Ramalan tepat ${stats.accuracy}%`, desc: "Model AI semakin pintar belajar corak gerai Boss." });
    return arr;
  }, [stats, boss, results]);

  const losses = useMemo(() => {
    const arr: { title: string; desc: string }[] = [];
    results.forEach((r) => {
      if (r.forecast === 0) return;
      const diff = r.actual - r.forecast;
      if (diff < -50) {
        arr.push({
          title: `${r.day} kurang dari ramalan`,
          desc: `Jualan ${fmt(r.actual)} berbanding ramalan ${fmt(r.forecast)} (${r.weather}). Kemungkinan punca: cuaca, atau stok cepat habis.`,
        });
      }
    });
    if (stats.variance < 0) arr.push({ title: "Stok berlebihan", desc: `${boss} mungkin sediakan lebih bahan dari diperlukan — semak Laporan Sisa & Corak Jualan.` });
    return arr;
  }, [stats, boss, results]);

  const lessons = [
    `Pasangkan rancangan stok hujung minggu dengan amaran cuaca — petang Sabtu lalu hujan menjatuhkan trafik ${boss}.`,
    `Item paling laris (ayam, beras) habis sebelum 1PM — kali depan tambah 15% buffer pada hari ramalan SANGAT TINGGI.`,
    `Promosi flash 30 minit terakhir boleh kurangkan sisa minuman botol.`,
  ];

  const share = () => toast.success("Laporan disalin — boleh kongsi dengan AJK 📋");

  if (!hasData) {
    return (
      <div className="fixed inset-0 z-40 bg-background overflow-y-auto animate-fade-in">
        <div className="mx-auto w-full max-w-[600px] min-h-screen pb-32">
          <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
            <button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted tap" aria-label="Tutup">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-extrabold leading-tight">Laporan Selepas Acara</h1>
          </header>
          <div className="px-4 py-10">
            <div className="rounded-2xl p-6 bg-card border border-border text-center space-y-3">
              <div className="text-4xl">📭</div>
              <p className="text-sm text-muted-foreground">
                Tiada data acara lagi. Jalankan acara dan rekodkan jualan untuk melihat laporan post-mortem.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-background overflow-y-auto animate-fade-in">
      <div className="mx-auto w-full max-w-full sm:max-w-[600px] md:max-w-[760px] lg:max-w-[960px] xl:max-w-[1140px] 2xl:max-w-[1280px] min-h-screen bg-background pb-32">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted tap" aria-label="Tutup">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-extrabold leading-tight">Laporan Selepas Acara</h1>
            <p className="text-xs text-muted-foreground">AI rumus apa yang berlaku — supaya {boss} lebih bijak kali depan</p>
          </div>
          <button onClick={share} className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted tap" aria-label="Kongsi">
            <Share2 className="w-5 h-5" />
          </button>
        </header>

        <div className="px-4 py-4 space-y-5">
          <section className="rounded-2xl p-5 bg-gradient-profit text-profit-foreground shadow-glow">
            <p className="text-xs font-bold uppercase tracking-wider opacity-90 flex items-center gap-1">
              <FileText className="w-3 h-3" /> {eventName}
            </p>
            <p className="text-3xl font-extrabold mt-2">{fmt(stats.totalActual)}</p>
            <p className="text-sm opacity-95">Jumlah jualan sebenar</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="Ramalan" value={fmt(stats.totalForecast)} />
              <Stat label={stats.variance >= 0 ? "Lebih" : "Kurang"} value={fmt(Math.abs(stats.variance))} />
              <Stat label="Tepat" value={`${stats.accuracy}%`} />
            </div>
          </section>

          <section className="rounded-2xl bg-card border border-border p-4 shadow-card space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Hari Demi Hari</h2>
            {results.map((r) => {
              const open = r.forecast > 0;
              const diff = r.actual - r.forecast;
              const pct = open ? Math.round((diff / r.forecast) * 100) : 0;
              const positive = diff >= 0;
              return (
                <div key={r.day} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="w-12 text-center">
                    <p className="text-xs font-bold">{r.day}</p>
                    <p className="text-[10px] text-muted-foreground">{r.date}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{open ? fmt(r.actual) : "Tutup"}</p>
                    <p className="text-[11px] text-muted-foreground">{r.weather} · ramal {fmt(r.forecast)}</p>
                  </div>
                  {open && (
                    <span className={`text-[11px] font-extrabold px-2 py-1 rounded-full ${positive ? "bg-primary/15 text-primary" : "bg-cost-soft text-cost"}`}>
                      {positive ? "+" : ""}{pct}%
                    </span>
                  )}
                </div>
              );
            })}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Apa yang menjadi 🏆</h2>
            {wins.map((w, i) => (
              <Card key={i} icon={<Trophy className="w-5 h-5 text-primary" />} title={w.title} desc={w.desc} bg="bg-primary/8 border-primary/25" />
            ))}
            {wins.length === 0 && <p className="text-xs text-muted-foreground italic">Tiada kemenangan besar minggu ini — masih banyak ruang untuk berkembang.</p>}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Apa yang boleh diperbaiki ⚠️</h2>
            {losses.map((l, i) => (
              <Card key={i} icon={<AlertTriangle className="w-5 h-5 text-warn" />} title={l.title} desc={l.desc} bg="bg-warn-soft border-warn/30" />
            ))}
            {losses.length === 0 && <Card icon={<CheckCircle2 className="w-5 h-5 text-primary" />} title="Tiada kelemahan ketara" desc={`${boss} jalankan acara dengan licin — teruskan!`} bg="bg-primary/10 border-primary/30" />}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Pelajaran untuk acara seterusnya 📘</h2>
            <ol className="space-y-2">
              {lessons.map((l, i) => (
                <li key={i} className="flex gap-2 rounded-2xl bg-muted/40 p-3 text-sm">
                  <span className="font-extrabold text-primary">{i + 1}.</span>
                  <span className="flex-1 leading-relaxed">{l}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl p-5 bg-gradient-income text-white shadow-card space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider opacity-90 flex items-center gap-1">
              <Sparkles className="w-4 h-4" /> Mesej AI untuk {boss}
            </p>
            <p className="text-sm leading-relaxed">
              Acara ini bawa untung dijangka <span className="font-extrabold">{fmt(stats.profit)}</span> selepas tolak kos bahan {fmt(stats.matCost)}.
              {stats.variance >= 0
                ? " Momentum bagus — guna kemenangan ini untuk reka promosi acara akan datang."
                : " Sedikit lari dari sasaran — pelajaran ini bernilai untuk bazar seterusnya."}
            </p>
          </section>

          <Button onClick={share} className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold">
            <Share2 className="w-4 h-4 mr-2" /> Salin & Kongsi Laporan
          </Button>
        </div>
      </div>
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-white/15 py-2">
    <p className="text-[10px] opacity-90 uppercase font-bold">{label}</p>
    <p className="text-sm font-extrabold mt-0.5">{value}</p>
  </div>
);

const Card = ({ icon, title, desc, bg }: { icon: React.ReactNode; title: string; desc: string; bg: string }) => (
  <div className={`rounded-2xl p-4 border ${bg} flex gap-3`}>
    <div className="w-10 h-10 rounded-xl bg-background/60 grid place-items-center shrink-0">{icon}</div>
    <div>
      <p className="font-bold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
    </div>
  </div>
);