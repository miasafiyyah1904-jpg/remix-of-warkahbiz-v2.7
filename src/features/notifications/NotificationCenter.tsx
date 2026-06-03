import { useMemo, useState } from "react";
import { X, MapPin, CalendarDays, Flame, Sparkles, Trash2, BellOff } from "lucide-react";
import { OPPORTUNITIES, REFERENCE_TODAY, type Opportunity } from "./opportunities";

type Status = "ongoing" | "upcoming" | "past";

const fmtRange = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  if (start === end) return s.toLocaleDateString("ms-MY", opts);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${e.toLocaleDateString("ms-MY", { month: "short", year: "numeric" })}`;
  }
  return `${s.toLocaleDateString("ms-MY", opts)} – ${e.toLocaleDateString("ms-MY", opts)}`;
};

const getStatus = (o: Opportunity, today: Date): Status => {
  const s = new Date(o.start);
  const e = new Date(o.end);
  if (e < today) return "past";
  if (s <= today && e >= today) return "ongoing";
  return "upcoming";
};

const isPriority = (o: Opportunity, status: Status) =>
  status !== "past" && (o.forcePriority || status === "ongoing");

export function NotificationCenter({ onClose }: { onClose: () => void }) {
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "retail" | "food">("all");

  // Compare against later of: real today and reference April 30, 2026.
  const today = useMemo(() => {
    const real = new Date();
    return real > REFERENCE_TODAY ? real : REFERENCE_TODAY;
  }, []);

  const items = useMemo(() => {
    return OPPORTUNITIES
      .filter((o) => !cleared.has(o.id))
      .filter((o) => filter === "all" || o.category === filter)
      .map((o) => {
        const status = getStatus(o, today);
        return { o, status, priority: isPriority(o, status) };
      })
      .sort((a, b) => {
        // Past goes to bottom.
        if (a.status === "past" && b.status !== "past") return 1;
        if (b.status === "past" && a.status !== "past") return -1;
        // Priority first.
        if (a.priority !== b.priority) return a.priority ? -1 : 1;
        // Ongoing before upcoming.
        if (a.status !== b.status) {
          if (a.status === "ongoing") return -1;
          if (b.status === "ongoing") return 1;
        }
        // Soonest start first (or most recent end for past).
        if (a.status === "past" && b.status === "past") {
          return new Date(b.o.end).getTime() - new Date(a.o.end).getTime();
        }
        return new Date(a.o.start).getTime() - new Date(b.o.start).getTime();
      });
  }, [cleared, filter, today]);

  const groups = useMemo(() => {
    const retail = items.filter((i) => i.o.category === "retail");
    const food = items.filter((i) => i.o.category === "food");
    return { retail, food };
  }, [items]);

  const unreadCount = items.filter((i) => i.status !== "past").length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-full sm:max-w-[600px] md:max-w-[760px] lg:max-w-[960px] xl:max-w-[1140px] 2xl:max-w-[1280px] h-full bg-background shadow-card flex flex-col animate-slide-in-right"
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border bg-surface">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Notifikasi Boss 🔔</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {unreadCount} peluang aktif untuk Boss
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCleared(new Set(OPPORTUNITIES.map((o) => o.id)))}
                className="tap text-xs font-semibold px-3 py-2 rounded-xl text-muted-foreground hover:bg-muted flex items-center gap-1"
                aria-label="Clear all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Kosongkan
              </button>
              <button
                onClick={onClose}
                className="tap w-9 h-9 rounded-full grid place-items-center hover:bg-muted"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mt-3">
            {(["all", "retail", "food"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 h-11 rounded-xl text-xs font-bold tap transition-all duration-150 ${
                  filter === f
                    ? "bg-gradient-profit text-profit-foreground shadow-card border-transparent"
                    : "bg-surface border border-border text-muted-foreground"
                }`}
              >
                {f === "all" ? "Semua" : f === "retail" ? "Retail/Bazaar" : "Food Festival"}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-6">
              <div className="w-16 h-16 rounded-full bg-muted grid place-items-center">
                <BellOff className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="mt-4 font-bold text-foreground">Boss dah lihat semua!</p>
              <p className="text-sm text-muted-foreground mt-1">
                You're all caught up on opportunities!
              </p>
            </div>
          ) : (
            <>
              {(filter === "all" || filter === "retail") && groups.retail.length > 0 && (
                <Section title="Retail & Lifestyle Bazaars" emoji="🛍️" items={groups.retail} onClear={(id) => setCleared((p) => new Set(p).add(id))} />
              )}
              {(filter === "all" || filter === "food") && groups.food.length > 0 && (
                <Section title="Food & Hospitality Festivals" emoji="🍽️" items={groups.food} onClear={(id) => setCleared((p) => new Set(p).add(id))} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  emoji,
  items,
  onClear,
}: {
  title: string;
  emoji: string;
  items: { o: Opportunity; status: Status; priority: boolean }[];
  onClear: (id: string) => void;
}) {
  return (
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">
        {emoji} {title}
      </h3>
      <div className="space-y-2.5">
        {items.map(({ o, status, priority }) => (
          <NotificationCard key={o.id} o={o} status={status} priority={priority} onClear={() => onClear(o.id)} />
        ))}
      </div>
    </section>
  );
}

function NotificationCard({
  o,
  status,
  priority,
  onClear,
}: {
  o: Opportunity;
  status: Status;
  priority: boolean;
  onClear: () => void;
}) {
  const isPast = status === "past";
  const isOngoing = status === "ongoing";

  const borderClass = isPast
    ? "border-border"
    : isOngoing
    ? "border-l-4 border-l-profit border-y border-r border-border shadow-card"
    : priority
    ? "border-l-4 border-l-warn border-y border-r border-border shadow-card"
    : "border border-border";

  const bgClass = isPast ? "bg-muted/40" : "bg-surface";
  const textMuted = isPast ? "opacity-60" : "";

  return (
    <button
      onClick={() => {}}
      className={`w-full text-left rounded-2xl p-4 tap transition-all ${borderClass} ${bgClass} ${textMuted}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            {isOngoing && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-profit/15 text-profit">
                <Flame className="w-3 h-3" /> Hot Opportunity
              </span>
            )}
            {!isOngoing && priority && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-warn/15 text-warn-foreground">
                <Sparkles className="w-3 h-3" /> Upcoming
              </span>
            )}
            {isPast && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                Past
              </span>
            )}
          </div>
          <h4 className="font-extrabold text-sm leading-snug text-foreground">{o.title}</h4>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {o.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="w-3 h-3" /> {fmtRange(o.start, o.end)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{o.description}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="tap shrink-0 w-7 h-7 rounded-full grid place-items-center text-muted-foreground hover:bg-muted"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </button>
  );
}

export function getActiveOpportunityCount(): number {
  const real = new Date();
  const today = real > REFERENCE_TODAY ? real : REFERENCE_TODAY;
  return OPPORTUNITIES.filter((o) => new Date(o.end) >= today).length;
}
