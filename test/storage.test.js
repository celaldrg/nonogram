import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearProgress,
  loadCurrent,
  loadProgress,
  loadSettings,
  loadSolved,
  recordSolved,
  saveCurrent,
  saveProgress,
  saveSettings,
} from '../src/progress.js';
import { readJSON, removeItem, writeJSON } from '../src/storage.js';

/** In-memory stand-in for localStorage. */
function memoryStorage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

/** Runs `fn` with globalThis.localStorage replaced by `getter()` (which may throw). */
function withStorage(getter, fn) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: getter });
  try {
    fn();
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
}

test('storage round-trips JSON values under a namespace', () => {
  const store = memoryStorage();
  withStorage(() => store, () => {
    assert.equal(writeJSON('answer', { value: 42 }), true);
    assert.deepEqual(readJSON('answer', null), { value: 42 });
    assert.equal(store.data.get('nonogram:answer'), '{"value":42}');
    removeItem('answer');
    assert.equal(readJSON('answer', 'none'), 'none');
  });
});

test('storage falls back quietly when localStorage is missing', () => {
  withStorage(() => undefined, () => {
    assert.equal(readJSON('x', 'fallback'), 'fallback');
    assert.equal(writeJSON('x', 1), false);
    assert.doesNotThrow(() => removeItem('x'));
  });
});

test('storage never throws when access is blocked or the quota is full', () => {
  withStorage(() => {
    throw new Error('SecurityError');
  }, () => {
    assert.equal(readJSON('x', 'fallback'), 'fallback');
    assert.equal(writeJSON('x', 1), false);
    assert.doesNotThrow(() => removeItem('x'));
  });
  const failing = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  };
  withStorage(() => failing, () => {
    assert.equal(readJSON('x', 7), 7);
    assert.equal(writeJSON('x', 1), false);
    assert.doesNotThrow(() => removeItem('x'));
  });
});

test('storage ignores corrupted JSON', () => {
  const store = memoryStorage();
  store.data.set('nonogram:broken', '{not json');
  withStorage(() => store, () => {
    assert.equal(readJSON('broken', 'fallback'), 'fallback');
  });
});

test('settings default to English without mistake checking and round-trip', () => {
  const store = memoryStorage();
  withStorage(() => store, () => {
    assert.deepEqual(loadSettings(), { lang: 'en', autoCheck: false });
    saveSettings({ lang: 'tr', autoCheck: true });
    assert.deepEqual(loadSettings(), { lang: 'tr', autoCheck: true });
    store.data.set('nonogram:settings', '{"lang":"de","autoCheck":"yes"}');
    assert.deepEqual(loadSettings(), { lang: 'en', autoCheck: false });
  });
});

test('wins keep the best time per puzzle', () => {
  const store = memoryStorage();
  withStorage(() => store, () => {
    assert.deepEqual(loadSolved(), {});
    assert.deepEqual(recordSolved('heart', 9000), { best: 9000, isRecord: true });
    assert.deepEqual(recordSolved('heart', 12000), { best: 9000, isRecord: false });
    assert.deepEqual(recordSolved('heart', 7000.4), { best: 7000, isRecord: true });
    recordSolved('owl', 60000);
    assert.deepEqual(loadSolved(), { heart: 7000, owl: 60000 });
    store.data.set('nonogram:solved', '{"heart":"fast","owl":-5,"cat":3000}');
    assert.deepEqual(loadSolved(), { cat: 3000 });
  });
});

test('progress is kept per picture; random puzzles share one slot', () => {
  const store = memoryStorage();
  withStorage(() => store, () => {
    const snapshot = { v: 1, cells: '0', elapsed: 5, mistakes: 0, status: 'playing' };
    saveProgress('heart', snapshot);
    saveProgress('owl', { ...snapshot, elapsed: 6 });
    assert.deepEqual(loadProgress('heart'), snapshot);
    assert.equal(loadProgress('owl').elapsed, 6);
    saveProgress('random-5-1', snapshot);
    saveProgress('random-10-2', { ...snapshot, elapsed: 7 });
    assert.equal(loadProgress('random-5-1'), null, 'an older random puzzle is replaced');
    assert.equal(loadProgress('random-10-2').elapsed, 7);
    clearProgress('random-5-1');
    assert.equal(loadProgress('random-10-2').elapsed, 7, 'clearing another random id keeps the slot');
    clearProgress('heart');
    assert.equal(loadProgress('heart'), null);
    assert.equal(loadProgress('owl').elapsed, 6);
  });
});

test('the last open puzzle is remembered', () => {
  const store = memoryStorage();
  withStorage(() => store, () => {
    assert.equal(loadCurrent(), null);
    saveCurrent('random-15-77');
    assert.equal(loadCurrent(), 'random-15-77');
    store.data.set('nonogram:current', '42');
    assert.equal(loadCurrent(), null);
  });
});

test('progress functions work without any storage', () => {
  withStorage(() => undefined, () => {
    assert.deepEqual(loadSettings(), { lang: 'en', autoCheck: false });
    assert.equal(saveSettings({ lang: 'tr', autoCheck: false }), false);
    assert.deepEqual(recordSolved('heart', 1000), { best: 1000, isRecord: true });
    assert.equal(saveProgress('heart', {}), false);
    assert.equal(loadProgress('heart'), null);
    assert.doesNotThrow(() => clearProgress('heart'));
    assert.equal(loadCurrent(), null);
  });
});
