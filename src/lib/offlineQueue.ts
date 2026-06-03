/**
 * IndexedDB-backed write queue for offline saves.
 * Deduplicates by baseKey+userId (last-write-wins).
 */

const DB_NAME = "warkahbiz_offline";
const STORE = "pending_writes";

export interface PendingWrite {
  id?: number;
  baseKey: string;
  userId: string;
  value: any;
  enqueuedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("by_key_user", ["baseKey", "userId"], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  const t = db.transaction(STORE, mode);
  return t.objectStore(STORE);
}

export async function enqueue(
  baseKey: string,
  userId: string,
  value: any
): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const store = tx(db, "readwrite");
    const idx = store.index("by_key_user");
    const range = IDBKeyRange.only([baseKey, userId]);
    const cursorReq = idx.openCursor(range);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        const addReq = store.add({
          baseKey,
          userId,
          value,
          enqueuedAt: Date.now(),
        } as PendingWrite);
        addReq.onsuccess = () => resolve();
        addReq.onerror = () => reject(addReq.error);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  }).catch(() => {});
  db.close();
}

export async function drainQueue(
  saveFn: (baseKey: string, userId: string, value: any) => Promise<boolean>
): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return;
  }
  const entries: PendingWrite[] = await new Promise<PendingWrite[]>((resolve, reject) => {
    const req = tx(db, "readonly").getAll();
    req.onsuccess = () => resolve((req.result as PendingWrite[]) ?? []);
    req.onerror = () => reject(req.error);
  }).catch(() => [] as PendingWrite[]);

  entries.sort((a, b) => a.enqueuedAt - b.enqueuedAt);

  for (const entry of entries) {
    try {
      const ok = await saveFn(entry.baseKey, entry.userId, entry.value);
      if (ok && entry.id != null) {
        await new Promise<void>((resolve) => {
          const req = tx(db, "readwrite").delete(entry.id!);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        });
      }
    } catch {
      // stop draining on error; will retry later
      break;
    }
  }
  db.close();
}

export async function pendingCount(): Promise<number> {
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return 0;
  }
  const count = await new Promise<number>((resolve) => {
    const req = tx(db, "readonly").count();
    req.onsuccess = () => resolve(req.result ?? 0);
    req.onerror = () => resolve(0);
  });
  db.close();
  return count;
}
