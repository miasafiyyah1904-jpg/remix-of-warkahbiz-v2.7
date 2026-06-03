import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import ms from "@/translations/ms.js";
import en from "@/translations/en.js";

export type Language = "ms" | "en";

const DICTS: Record<Language, Record<string, string>> = {
  ms: ms as Record<string, string>,
  en: en as Record<string, string>,
};

const STORAGE_KEY = "warkahbiz_language";

interface Ctx {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<Ctx | null>(null);

function readInitial(): Language {
  if (typeof window === "undefined") return "ms";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "en" || v === "ms" ? v : "ms";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => readInitial());

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = language;
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(STORAGE_KEY, language); } catch {}
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState("ms");
    setTimeout(() => setLanguageState(lang), 0);
  };

  const dict = DICTS[language] ?? DICTS.ms;
  const t = (key: string, params?: Record<string, string | number>) => {
    let s: string = dict[key] ?? DICTS.ms[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return s;
  };


  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used inside LanguageProvider");
  return ctx;
}

export function useLanguage() {
  return useTranslation();
}
