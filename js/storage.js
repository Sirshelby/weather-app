// Thin localStorage wrapper. Storage can be unavailable (private mode, blocked
// site data) or throw on quota, so every access is guarded and falls back.
const PREFIX = 'wn:';

export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* ignore — the app still works, it just won't remember */
    }
  },
  remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
  },
};

/** Stable identity for a place, so the same city from different sources de-dupes. */
export const placeKey = (p) => `${(+p.latitude).toFixed(2)},${(+p.longitude).toFixed(2)}`;
