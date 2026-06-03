import { useState, useRef, useEffect } from "react";
import { Bot, Send, Trash2 } from "lucide-react";
import type { ChatMsg, Txn, StockItem, PettyEntry, OpExEntry, Product } from "@/types";
import type { BusinessSnapshot } from "./buildSystemPrompt";
import { useLanguage } from "@/context/LanguageContext";
import { useWeather } from "@/features/weather/useWeather";

const QUICK_CHIP_KEYS = [
  "chatQuickPnl",
  "chatQuickBreakeven",
  "chatQuickMargin",
  "chatQuickCashflow",
  "chatQuickStock",
];

export const ChatView = ({
  messages, onSend, onClear, isLoading, txns, stock, opex, petty, businessName, products,
}: {
  messages: ChatMsg[];
  onSend: (t: string, snapshot: BusinessSnapshot) => void;
  onClear?: () => void;
  isLoading: boolean;
  txns: Txn[];
  stock: StockItem[];
  opex: OpExEntry[];
  petty: PettyEntry[];
  businessName: string;
  products?: Product[];
}) => {
  const [input, setInput] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { language, t } = useLanguage();
  const { data: weather } = useWeather();
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);
  const submit = (text: string) => {
    if (!text.trim() || isLoading) return;
    const weatherNextWeek = weather
      ? weather
          .slice(0, 7)
          .map((w) => `${w.date}:${w.label}${w.emoji}(${Math.round(w.tMax)}°,${w.rainProb}%)`)
          .join(" | ")
      : undefined;
    onSend(text, { txns, stock, opex, petty, businessName, language, products, weatherNextWeek });
    setInput("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <header className="px-5 pt-6 pb-3 flex items-center gap-3 border-b border-border">
        <div className="w-11 h-11 rounded-full bg-gradient-profit grid place-items-center shadow-glow">
          <Bot className="w-6 h-6 text-profit-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-extrabold leading-tight">Tanya AI 💬</h1>
          <p className="text-[11px] text-profit font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-profit inline-block" /> Online sentiasa
          </p>
        </div>
        {onClear && (
          <button
            onClick={() => setConfirmClear(true)}
            className="h-9 px-3 rounded-full bg-surface-elevated border border-border text-xs font-semibold text-muted-foreground tap flex items-center gap-1.5"
            aria-label="Kosongkan Sembang"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Kosongkan
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 no-scrollbar">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
            <div className={`max-w-[78%] px-3.5 py-2.5 text-sm leading-snug rounded-2xl ${
              m.from === "user"
                ? "bg-gradient-profit text-profit-foreground rounded-br-md"
                : "bg-surface-elevated text-foreground rounded-bl-md border border-border"
            }`}>
              {m.text.split("**").map((part, i) =>
                i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start animate-fade-in">
            <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-surface-elevated border border-border">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {confirmClear && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5" onClick={() => setConfirmClear(false)}>
          <div className="bg-surface rounded-2xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-extrabold text-base mb-2">Padam semua sejarah sembang?</h3>
            <p className="text-sm text-muted-foreground mb-4">Ini tidak boleh dibatalkan.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmClear(false)} className="flex-1 h-11 rounded-xl bg-surface-elevated border border-border font-semibold tap">
                Batal
              </button>
              <button onClick={() => { onClear?.(); setConfirmClear(false); }} className="flex-1 h-11 rounded-xl bg-cost text-cost-foreground font-semibold tap">
                Padam
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-3 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
        {QUICK_CHIP_KEYS.map((key) => {
          const label = t(key);
          return (
            <button key={key} onClick={() => submit(label)} className="shrink-0 h-9 px-3 rounded-full bg-surface border border-border text-xs font-semibold text-muted-foreground tap">
              {label}
            </button>
          );
        })}
      </div>

      <div className="px-3 pb-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(input)}
          placeholder={t("chatInputPlaceholder")}
          className="flex-1 h-12 px-4 rounded-full bg-surface-elevated border border-border focus:outline-none focus:border-primary text-sm"
        />
        <button disabled={isLoading} onClick={() => submit(input)} className="w-12 h-12 rounded-full bg-gradient-profit text-profit-foreground grid place-items-center tap shadow-card disabled:opacity-50">
          <Send className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};
