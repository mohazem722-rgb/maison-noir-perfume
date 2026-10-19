/** Storage may be disabled, full, or contain obsolete data. Never make it a render dependency. */
const memory = new Map<string, string>();
export function stored<T>(key: string, fallback: T): T {
  try {
    return (
      JSON.parse(localStorage.getItem(key) ?? memory.get(key) ?? "null") ??
      fallback
    );
  } catch {
    try {
      return JSON.parse(memory.get(key) ?? "null") ?? fallback;
    } catch {
      return fallback;
    }
  }
}
export function saveStored(key: string, value: unknown): boolean {
  try {
    const text = JSON.stringify(value);
    memory.set(key, text);
    localStorage.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}
export function removeStored(key: string) {
  memory.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* Session memory remains usable. */
  }
}
