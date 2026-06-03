import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

/**
 * Per-user localStorage hook. Keys are automatically suffixed with the
 * current Supabase user id so two accounts on the same device do not
 * share or overwrite each other's data.
 */
export function useLocalStorage<T>(baseKey: string, initialValue: T) {
  const { userId } = useAuth();
  const key = userId ? `${baseKey}_${userId}` : null;
  const initialRef = useRef(initialValue);
  const [value, setValue] = useState<T>(initialValue);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // Load stored value whenever the effective key changes (e.g. after login).
  useEffect(() => {
    if (!key) {
      setLoadedKey(null);
      setValue(initialRef.current);
      return;
    }
    try {
      const stored = localStorage.getItem(key);
      setValue(stored ? (JSON.parse(stored) as T) : initialRef.current);
    } catch {
      setValue(initialRef.current);
    }
    setLoadedKey(key);
  }, [key]);

  // Persist whenever value changes — but only after we've loaded for this key.
  useEffect(() => {
    if (!key || loadedKey !== key) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, loadedKey, value]);

  return [value, setValue] as const;
}
