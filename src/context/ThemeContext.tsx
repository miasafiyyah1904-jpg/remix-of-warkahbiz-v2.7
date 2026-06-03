import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

type Theme = "light" | "dark";
interface Ctx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<Ctx | null>(null);

const THEME_KEY_BASE = "warkahbiz_theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const themeKey = userId ? `${THEME_KEY_BASE}_${userId}` : null;
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    if (!themeKey) {
      setThemeState("light");
      return;
    }
    try { setThemeState((localStorage.getItem(themeKey) as Theme) || "light"); } catch { setThemeState("light"); }
  }, [themeKey]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (!themeKey) return;
    try { localStorage.setItem(themeKey, t); } catch {}
  };

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
