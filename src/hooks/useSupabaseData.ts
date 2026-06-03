import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { CLOUD_STORES } from "@/lib/supabaseData";
import { enqueue } from "@/lib/offlineQueue";

/**
 * Cloud-backed per-user storage hook.
 *
 *  - Reads localStorage cache synchronously for instant UI on mount.
 *  - Fetches the canonical value from Supabase, then overrides local state.
 *  - On every change writes to localStorage (sync) and Supabase (fire & forget).
 *  - On first login after migration: if cloud is empty but local cache has
 *    data, pushes local cache up to the cloud once and toasts success.
 */
export function useSupabaseData<T>(baseKey: string, initialValue: T) {
  const { userId } = useAuth();
  const key = userId ? `${baseKey}_${userId}` : null;
  const initialRef = useRef(initialValue);
  const store = CLOUD_STORES[baseKey];

  const [value, setValue] = useState<T>(initialValue);
  const loadedKeyRef = useRef<string | null>(null);
  const skipNextSaveRef = useRef(false);

  // Load + cloud sync whenever the effective key (i.e. userId) changes.
  useEffect(() => {
    if (!key || !userId) {
      loadedKeyRef.current = null;
      setValue(initialRef.current);
      return;
    }

    let cancelled = false;

    // Step 1: synchronous local cache.
    let localValue: T | undefined;
    try {
      const stored = localStorage.getItem(key);
      if (stored) localValue = JSON.parse(stored) as T;
    } catch {}
    skipNextSaveRef.current = true;
    setValue(localValue ?? initialRef.current);
    loadedKeyRef.current = key;

    // Step 2: cloud fetch (skip if no store registered for this key).
    if (!store) return;

    (async () => {
      const cloud = await store.fetch(userId);
      if (cancelled) return;

      const migrationFlagKey = `warkahbiz_migrated_${baseKey}_${userId}`;
      const migrated = localStorage.getItem(migrationFlagKey) === "1";
      const cloudIsEmpty = cloud == null || (Array.isArray(cloud) && cloud.length === 0);
      const localHasData = localValue != null && (store.hasData ? store.hasData(localValue) : true);

      if (cloudIsEmpty && localHasData && !migrated) {
        // First-time migration: push local cache up.
        const ok = await store.save(userId, localValue as any);
        localStorage.setItem(migrationFlagKey, "1");
        if (ok) toast.success("Data anda telah disimpan ke cloud ✅");
        // Keep current local state as the source.
        return;
      }

      if (!cloudIsEmpty) {
        skipNextSaveRef.current = true;
        setValue(cloud as T);
      }
      if (!migrated) localStorage.setItem(migrationFlagKey, "1");
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, userId]);

  // Persist whenever value changes (after initial load for this key).
  useEffect(() => {
    if (!key || loadedKeyRef.current !== key) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (!store || !userId) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueue(baseKey, userId, value as any);
      return;
    }

    store.save(userId, value as any).catch((err: any) => {
      const msg = String(err?.message ?? err ?? "");
      if (
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("Load failed")
      ) {
        enqueue(baseKey, userId, value as any);
      }
      // otherwise silent
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);

  return [value, setValue] as const;
}