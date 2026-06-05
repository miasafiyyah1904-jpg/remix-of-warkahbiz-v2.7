import { useEffect, useLayoutEffect, useState } from "react";
import type { Tab } from "@/types";
import { useTranslation } from "@/hooks/useTranslation";

type Step = {
  selector: string;
  title: string;
  body: string;
  navigateTo?: Tab;
};

interface Props {
  userId: string;
  onComplete: () => void;
  onNavigate?: (tab: Tab) => void;
}

export default function OnboardingTutorial({ userId, onComplete, onNavigate }: Props) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const current = STEPS[step];

  // Navigate to the right tab when step changes
  useEffect(() => {
    if (done || !current?.navigateTo) return;
    onNavigate?.(current.navigateTo);
  }, [step, done]);

  // Measure target element
  useLayoutEffect(() => {
    if (done) return;
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(current.selector) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
    };
    // Wait a tick for tab content to render
    const t = setTimeout(() => {
      measure();
      raf = requestAnimationFrame(measure);
    }, 250);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [step, done, current?.selector]);

  const finish = () => {
    try {
      localStorage.setItem(`warkahbiz_tutorial_done_${userId}`, "true");
    } catch {}
    onNavigate?.("today");
    onComplete();
  };

  const skip = () => finish();

  const next = () => {
    if (step >= STEPS.length - 1) {
      setDone(true);
    } else {
      setStep((s) => s + 1);
    }
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center p-5 bg-black/70 backdrop-blur-sm animate-fade-in">
        <div className="relative w-full max-w-sm bg-surface rounded-3xl p-6 text-center animate-pop-in">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/40 grid place-items-center text-4xl">✅</div>
          <h3 className="font-extrabold text-2xl mt-4">Anda Dah Sedia!</h3>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            Tutorial selesai. Mula gunakan Warkah Biz untuk uruskan bisnes anda dengan lebih mudah.
          </p>
          <button
            onClick={finish}
            className="mt-6 w-full h-12 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-extrabold tap"
          >
            Mula Sekarang 🚀
          </button>
        </div>
      </div>
    );
  }

  // Position tooltip
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const placeBelow = rect ? rect.top < vh / 2 : true;
  const tooltipMaxWidth = 320;
  const padding = 6;
  const constrainedWidth = Math.min(tooltipMaxWidth, vw - 16);

  let tooltipStyle: React.CSSProperties;
  if (rect) {
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - constrainedWidth / 2),
      vw - constrainedWidth - 8,
    );
    tooltipStyle = placeBelow
      ? { top: rect.bottom + 16, left }
      : { bottom: vh - rect.top + 16, left };
  } else {
    tooltipStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {!rect && (
        <div className="absolute inset-0 bg-black/60 pointer-events-auto" />
      )}

      {rect && (
        <>
          {/* Top */}
          <div className="absolute bg-black/60 pointer-events-auto"
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - padding) }} />
          {/* Bottom */}
          <div className="absolute bg-black/60 pointer-events-auto"
            style={{ top: rect.bottom + padding, left: 0, right: 0, bottom: 0 }} />
          {/* Left */}
          <div className="absolute bg-black/60 pointer-events-auto"
            style={{ top: rect.top - padding, left: 0, width: Math.max(0, rect.left - padding), height: rect.height + padding * 2 }} />
          {/* Right */}
          <div className="absolute bg-black/60 pointer-events-auto"
            style={{ top: rect.top - padding, left: rect.right + padding, right: 0, height: rect.height + padding * 2 }} />

          <div
            className="absolute rounded-xl pointer-events-none"
            style={{
              top: rect.top - padding,
              left: rect.left - padding,
              width: rect.width + padding * 2,
              height: rect.height + padding * 2,
              boxShadow: "0 0 0 3px hsl(var(--primary)/0.8), 0 0 16px 4px hsl(var(--primary)/0.3)",
              zIndex: 12,
            }}
          />
          <button
            type="button"
            aria-label="Seterusnya"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); next(); }}
            className="absolute cursor-pointer bg-transparent border-0 p-0"
            style={{
              top: rect.top - padding,
              left: rect.left - padding,
              width: rect.width + padding * 2,
              height: rect.height + padding * 2,
              zIndex: 13,
              pointerEvents: "auto",
            }}
          />
        </>
      )}

      {/* Tooltip card */}
      <div
        className="absolute pointer-events-auto bg-surface text-foreground rounded-2xl shadow-2xl p-6 border border-border animate-fade-in"
        style={{
          ...tooltipStyle,
          width: `calc(100vw - 32px)`,
          maxWidth: `${tooltipMaxWidth}px`,
          backgroundImage: "linear-gradient(hsl(var(--primary) / 0.08), hsl(var(--primary) / 0.08))",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Langkah {step + 1} dari {STEPS.length}
          </span>
          <button
            onClick={skip}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground tap"
          >
            Langkau
          </button>
        </div>
        <h3 className="font-extrabold text-lg leading-snug">{current.title}</h3>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{current.body}</p>
        <button
          onClick={next}
          className="mt-4 w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold tap"
        >
          {step >= STEPS.length - 1 ? "Selesai →" : "Seterusnya →"}
        </button>
      </div>
    </div>
  );
}