/**
 * The only place that touches localStorage. Every access is guarded, so private mode,
 * blocked storage or a full quota never crash the game; values are namespaced and JSON encoded.
 */
const PREFIX = 'nonogram:';

/** localStorage, or null when the browser does not offer it or blocks access. */
function backend() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Reads a stored JSON value.
 * @param {string} key
 * @param {*} fallback returned when the value is missing, unreadable or not valid JSON
 * @returns {*}
 */
export function readJSON(key, fallback) {
  try {
    const raw = backend()?.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Stores a value as JSON.
 * @param {string} key
 * @param {*} value
 * @returns {boolean} false when storage is unavailable or full
 */
export function writeJSON(key, value) {
  try {
    const store = backend();
    if (!store) return false;
    store.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Deletes a stored value; does nothing when storage is unavailable.
 * @param {string} key
 */
export function removeItem(key) {
  try {
    backend()?.removeItem(PREFIX + key);
  } catch {
    // Storage is blocked: there is nothing to delete.
  }
}
