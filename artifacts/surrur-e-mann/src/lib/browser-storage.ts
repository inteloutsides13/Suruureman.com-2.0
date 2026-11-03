const memoryFallback = new Map<string, string>();

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLocalStorageValue(key: string): string | null {
  const storage = getLocalStorage();
  if (!storage) return memoryFallback.get(key) ?? null;

  try {
    return storage.getItem(key) ?? memoryFallback.get(key) ?? null;
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

export function writeLocalStorageValue(key: string, value: string): void {
  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.setItem(key, value);
      memoryFallback.delete(key);
      return;
    } catch {
      // Keep this tab usable when persistent browser storage is restricted.
    }
  }
  memoryFallback.set(key, value);
}

export function removeLocalStorageValue(key: string): void {
  memoryFallback.delete(key);
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch {
    // Storage cleanup is best-effort when the browser denies access.
  }
}
