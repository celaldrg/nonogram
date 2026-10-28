import { readJSON, writeJSON, removeItem } from './storage.js';

const SETTINGS_KEY = 'settings';
const SOLVED_KEY = 'solved';
const CURRENT_KEY = 'current';
const GAME_PREFIX = 'game:';
/** Random puzzles share one slot, so only the latest one keeps its progress. */
const RANDOM_SLOT = 'random';

/**
 * Player settings, with defaults for anything missing or invalid.
 * @returns {{lang: 'en'|'tr', autoCheck: boolean}}
 */
export function loadSettings() {
  const saved = readJSON(SETTINGS_KEY, null);
  return {
    lang: saved?.lang === 'tr' ? 'tr' : 'en',
    autoCheck: saved?.autoCheck === true,
  };
}

/**
 * @param {{lang: string, autoCheck: boolean}} settings
 * @returns {boolean} false when storage is unavailable
 */
export function saveSettings({ lang, autoCheck }) {
  return writeJSON(SETTINGS_KEY, { lang: lang === 'tr' ? 'tr' : 'en', autoCheck: autoCheck === true });
}

/**
 * Best times of solved puzzles; pictures stay hidden in the picker until they appear here.
 * @returns {Record<string, number>} puzzle id -> best time in ms
 */
export function loadSolved() {
  const saved = readJSON(SOLVED_KEY, null);
  const solved = {};
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    for (const [id, ms] of Object.entries(saved)) {
      if (Number.isFinite(ms) && ms >= 0) solved[id] = ms;
    }
  }
  return solved;
}

/**
 * Records a win, keeping the best time per puzzle.
 * @param {string} id puzzle id
 * @param {number} elapsedMs
 * @returns {{best: number, isRecord: boolean}}
 */
export function recordSolved(id, elapsedMs) {
  const solved = loadSolved();
  const time = Math.round(elapsedMs);
  const isRecord = !Object.hasOwn(solved, id) || time < solved[id];
  if (isRecord) {
    solved[id] = time;
    writeJSON(SOLVED_KEY, solved);
  }
  return { best: solved[id], isRecord };
}

/**
 * Saved progress of a puzzle, as produced by game.snapshot().
 * @param {string} id puzzle id
 * @returns {object|null}
 */
export function loadProgress(id) {
  const saved = readJSON(GAME_PREFIX + slotFor(id), null);
  return saved?.id === id ? (saved.snapshot ?? null) : null;
}

/**
 * @param {string} id puzzle id
 * @param {object} snapshot from game.snapshot()
 * @returns {boolean} false when storage is unavailable
 */
export function saveProgress(id, snapshot) {
  return writeJSON(GAME_PREFIX + slotFor(id), { id, snapshot });
}

/**
 * Forgets the saved progress of a puzzle. (Restarts and wins overwrite the slot with a new
 * snapshot, so the app itself does not call this.)
 * @param {string} id puzzle id
 */
export function clearProgress(id) {
  if (loadProgress(id)) removeItem(GAME_PREFIX + slotFor(id));
}

/** @returns {string|null} id of the puzzle that was open last */
export function loadCurrent() {
  const id = readJSON(CURRENT_KEY, null);
  return typeof id === 'string' ? id : null;
}

/**
 * @param {string} id puzzle id to reopen on the next visit
 * @returns {boolean} false when storage is unavailable
 */
export function saveCurrent(id) {
  return writeJSON(CURRENT_KEY, id);
}

function slotFor(id) {
  return id.startsWith('random-') ? RANDOM_SLOT : id;
}
