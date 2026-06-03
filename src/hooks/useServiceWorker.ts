import { useEffect } from "react";
import { drainQueue } from "@/lib/offlineQueue";
import { CLOUD_STORES } from "@/lib/supabaseData";

function isPreviewOrIframe(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

async function runDrain(userId: string | null) {
  if (!userId) return;
  await drainQueue(async (baseKey, uid, value) => {
    const store = (CLOUD_STORES as Record<string, any>)[baseKey];
    if (!store) return true; // unknown key, drop
    if (uid !== userId) return false; // don't drain other users' queue here
    try {
      return await store.save(uid, value);
    } catch {
      return false;
    }
  });
}

export function useServiceWorker(userId: string | null) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    if (isPreviewOrIframe()) {
      // Clean up any previously registered SW in preview/iframe contexts.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {});

    const onMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "DRAIN_QUEUE") {
        runDrain(userId);
      }
    };
    const onOnline = () => runDrain(userId);

    navigator.serviceWorker.addEventListener("message", onMessage);
    window.addEventListener("online", onOnline);

    if (navigator.onLine) runDrain(userId);

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      window.removeEventListener("online", onOnline);
    };
  }, [userId]);
}
