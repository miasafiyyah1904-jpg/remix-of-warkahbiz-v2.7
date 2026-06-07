import { useMemo, useState } from "react";
import { ArrowLeft, Copy, Calculator } from "lucide-react";
import { toast } from "sonner";
import { fmt } from "@/lib/format";
import { useTranslation } from "@/context/LanguageContext";

const segBtn = (active: boolean) =>
  `flex-1 h-11 rounded-xl text-xs font-bold tap transition-all duration-150 ${
    active
      ? "bg-gradient-profit text-profit-foreground shadow-card border-transparent"
      : "text-muted-foreground"
  }`;

// EPF — Malaysian/PR, under 60
const EPF_EMPLOYEE_RATE = 0.11;
const EPF_EMPLOYER_RATE = 0.13;
// EPF — above 60 (Malaysian/PR)
const EPF_EMPLOYEE_RATE_60 = 0;
const EPF_EMPLOYER_RATE_60 = 0.04;
// EPF — foreign worker (mandatory from Oct 2025)
const EPF_FOREIGN_EMPLOYEE = 0.02;
const EPF_FOREIGN_EMPLOYER = 0.02;

// SOCSO — wage ceiling RM6,000
const SOCSO_EMPLOYER_RATE = 0.0175;
const SOCSO_EMPLOYEE_RATE = 0.005;
const SOCSO_CEILING = 6000;
// SOCSO — above 60 (Employment Injury Scheme only)
const SOCSO_EMPLOYER_60_RATE = 0.0125;

// EIS — 0.2% each, ceiling RM6,000, max RM11.90 each
const EIS_RATE = 0.002;
const EIS_CEILING = 6000;
const EIS_MAX = 11.9;

type Citizenship = "local" | "foreign";
type AgeGroup = "under60" | "over60";
type WageType = "monthly" | "daily";

const r2 = (n: number) => Math.round(n * 100) / 100;

export function SalaryCalculator({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [grossInput, setGrossInput] = useState<string>("");
  const [daysInput, setDaysInput] = useState<string>("26");
  const [citizenship, setCitizenship] = useState<Citizenship>("local");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("under60");
  const [wageType, setWageType] = useState<WageType>("monthly");

  const calc = useMemo(() => {
    const rawGross = Math.max(0, Number(grossInput) || 0);
    const days = Math.max(0, Number(daysInput) || 0);
    const grossMonthly =
      wageType === "monthly" ? rawGross : rawGross * days;

    const socsoBase = Math.min(grossMonthly, SOCSO_CEILING);
    const eisBase = Math.min(grossMonthly, EIS_CEILING);

    // EPF rates
    let epfEeRate = EPF_EMPLOYEE_RATE;
    let epfErRate = EPF_EMPLOYER_RATE;
    if (citizenship === "foreign") {
      epfEeRate = EPF_FOREIGN_EMPLOYEE;
      epfErRate = EPF_FOREIGN_EMPLOYER;
    } else if (ageGroup === "over60") {
      epfEeRate = EPF_EMPLOYEE_RATE_60;
      epfErRate = EPF_EMPLOYER_RATE_60;
    }

    const epfEmployee = Math.round(grossMonthly * epfEeRate);
    const epfEmployer = Math.round(grossMonthly * epfErRate);

    const socsoEmployee =
      ageGroup === "over60" ? 0 : r2(socsoBase * SOCSO_EMPLOYEE_RATE);
    const socsoEmployer =
      ageGroup === "over60"
        ? r2(socsoBase * SOCSO_EMPLOYER_60_RATE)
        : r2(socsoBase * SOCSO_EMPLOYER_RATE);

    const eisApplicable = citizenship === "local" && ageGroup === "under60";
    const eisEmployee = eisApplicable
      ? Math.min(r2(eisBase * EIS_RATE), EIS_MAX)
      : 0;
    const eisEmployer = eisApplicable
      ? Math.min(r2(eisBase * EIS_RATE), EIS_MAX)
      : 0;

    const totalDeductions = epfEmployee + socsoEmployee + eisEmployee;
    const takehomePay = grossMonthly - totalDeductions;
    const totalEmployerCost =
      grossMonthly + epfEmployer + socsoEmployer + eisEmployer;

    return {
      grossMonthly,
      epfEmployee,
      epfEmployer,
      epfEeRate,
      epfErRate,
      socsoEmployee,
      socsoEmployer,
      eisEmployee,
      eisEmployer,
      eisApplicable,
      totalDeductions,
      takehomePay,
      totalEmployerCost,
    };
  }, [grossInput, daysInput, citizenship, ageGroup, wageType]);

  const slipText = useMemo(() => {
    return [
      "🧾 *Slip Gaji Ringkas*",
      `👷 Gaji Kasar: ${fmt(calc.grossMonthly)}`,
      `➖ EPF: ${fmt(calc.epfEmployee)} | SOCSO: ${fmt(calc.socsoEmployee)} | EIS: ${fmt(calc.eisEmployee)}`,
      `✅ *Gaji Bersih: ${fmt(calc.takehomePay)}*`,
      `🏭 Kos Majikan: ${fmt(calc.totalEmployerCost)}`,
      "",
      "_Dikira oleh WarkahBiz_",
    ].join("\n");
  }, [calc]);

  const copySlip = async () => {
    try {
      await navigator.clipboard.writeText(slipText);
      toast.success("Slip disalin!");
    } catch {
      toast.error("Gagal salin slip");
    }
  };

  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <button onClick={onBack} className="text-xs font-bold text-primary tap mb-1 inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> {t("prof_backToProfile")}
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold leading-tight inline-flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" /> Kalkulator Gaji
          </h1>
          <p className="text-xs text-muted-foreground">
            Kira EPF, SOCSO & EIS ikut kadar 2026
          </p>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* Section A — Inputs */}
        <section className="rounded-2xl bg-surface border border-border p-4 space-y-3">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
            Maklumat Pekerja
          </div>

          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
              Jenis Gaji
            </label>
            <div className="flex p-1 rounded-2xl bg-background border border-border gap-1 mt-1">
              {[
                { value: "monthly", label: "Bulanan" },
                { value: "daily", label: "Harian" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setWageType(opt.value as WageType)}
                  className={segBtn(wageType === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
              {wageType === "monthly" ? "Gaji Kasar (RM)" : "Kadar Harian (RM)"}
            </label>
            <input
              inputMode="decimal"
              value={grossInput}
              onChange={(e) => setGrossInput(e.target.value)}
              placeholder={wageType === "monthly" ? "Cth: 1800" : "Cth: 80"}
              className="w-full h-12 px-4 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary mt-1"
            />
          </div>

          {wageType === "daily" && (
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                Bilangan Hari Kerja Sebulan
              </label>
              <input
                inputMode="numeric"
                value={daysInput}
                onChange={(e) => setDaysInput(e.target.value)}
                placeholder="Cth: 26"
                className="w-full h-12 px-4 rounded-2xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary mt-1"
              />
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
              Jenis Pekerja
            </label>
            <div className="flex p-1 rounded-2xl bg-background border border-border gap-1 mt-1">
              {[
                { value: "local", label: "Warganegara / PR" },
                { value: "foreign", label: "Warga Asing" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCitizenship(opt.value as Citizenship)}
                  className={segBtn(citizenship === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
              Umur Pekerja
            </label>
            <div className="flex p-1 rounded-2xl bg-background border border-border gap-1 mt-1">
              {[
                { value: "under60", label: "Bawah 60" },
                { value: "over60", label: "60 ke atas" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAgeGroup(opt.value as AgeGroup)}
                  className={segBtn(ageGroup === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Section B — Results */}
        <section className="rounded-2xl p-5 bg-gradient-profit text-profit-foreground shadow-glow space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider opacity-90">
            Bahagian Pekerja
          </div>
          <div className="space-y-1.5 text-sm">
            <Row label="Gaji Kasar" value={fmt(calc.grossMonthly)} />
            <Row
              label={`Tolak EPF Pekerja (${pct(calc.epfEeRate)})`}
              value={`- ${fmt(calc.epfEmployee)}`}
            />
            <Row
              label="Tolak SOCSO Pekerja"
              value={
                ageGroup === "over60"
                  ? "Tidak terpakai"
                  : `- ${fmt(calc.socsoEmployee)}`
              }
              muted={ageGroup === "over60"}
            />
            <Row
              label="Tolak EIS Pekerja"
              value={
                calc.eisApplicable
                  ? `- ${fmt(calc.eisEmployee)}`
                  : "Tidak terpakai"
              }
              muted={!calc.eisApplicable}
            />
          </div>
          <div className="border-t border-white/20 pt-3">
            <div className="text-xs font-bold opacity-90">
              GAJI BERSIH (TAKE HOME)
            </div>
            <div className="text-4xl font-extrabold mt-1">
              {fmt(calc.takehomePay)}
            </div>
          </div>

          <div className="border-t border-white/20 pt-3">
            <div className="text-xs font-bold uppercase tracking-wider opacity-90 mb-2">
              Bahagian Majikan
            </div>
            <div className="space-y-1.5 text-sm">
              <Row
                label={`Caruman EPF Majikan (${pct(calc.epfErRate)})`}
                value={fmt(calc.epfEmployer)}
              />
              <Row
                label="Caruman SOCSO Majikan"
                value={fmt(calc.socsoEmployer)}
              />
              <Row
                label="Caruman EIS Majikan"
                value={
                  calc.eisApplicable
                    ? fmt(calc.eisEmployer)
                    : "Tidak terpakai"
                }
                muted={!calc.eisApplicable}
              />
            </div>
            <div className="border-t border-white/20 pt-3 mt-3 flex items-center justify-between">
              <span className="text-sm font-bold">JUMLAH KOS MAJIKAN</span>
              <span className="text-lg font-extrabold">
                {fmt(calc.totalEmployerCost)}
              </span>
            </div>
          </div>
        </section>

        {/* Section C — WhatsApp slip */}
        <section className="rounded-2xl border-2 border-dashed border-border bg-surface p-4 space-y-3">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            Slip Ringkas
          </div>
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">
{slipText}
          </pre>
          <button
            onClick={copySlip}
            className="w-full h-12 rounded-2xl bg-surface border border-border flex items-center justify-center gap-2 tap text-sm font-bold"
          >
            <Copy className="w-4 h-4" /> Salin Slip
          </button>
        </section>

        <p className="text-[11px] text-muted-foreground px-1">
          Kiraan ini adalah anggaran berdasarkan kadar 2026. Rujuk KWSP, PERKESO
          dan portal rasmi untuk angka tepat.
        </p>
      </div>
    </div>
  );
}

const Row = ({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) => (
  <div className="flex items-center justify-between">
    <span className="opacity-90">{label}</span>
    <span className={`font-bold ${muted ? "opacity-60 italic font-normal" : ""}`}>
      {value}
    </span>
  </div>
);
