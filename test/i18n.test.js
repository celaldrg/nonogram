import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, STRINGS, formatTime, translate } from '../src/i18n.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('English and Turkish have the same keys and placeholders', () => {
  assert.deepEqual(LANGUAGES, ['en', 'tr']);
  const keys = Object.keys(STRINGS.en).sort();
  assert.deepEqual(Object.keys(STRINGS.tr).sort(), keys);
  for (const key of keys) {
    assert.ok(STRINGS.en[key].trim().length > 0, `en.${key} is empty`);
    assert.ok(STRINGS.tr[key].trim().length > 0, `tr.${key} is empty`);
    assert.deepEqual(placeholders(STRINGS.tr[key]), placeholders(STRINGS.en[key]), key);
  }
});

test('Turkish strings are really translated', () => {
  const same = Object.keys(STRINGS.en).filter((key) => STRINGS.en[key] === STRINGS.tr[key]);
  assert.deepEqual(same, []);
  assert.equal(STRINGS.en.langShort, 'TR', 'the English page offers Turkish');
  assert.equal(STRINGS.tr.langShort, 'EN', 'the Turkish page offers English');
});

test('translate fills placeholders and falls back sensibly', () => {
  assert.equal(translate('en', 'pictureTitle', { n: 7 }), 'Picture 7');
  assert.equal(translate('tr', 'pictureTitle', { n: 7 }), 'Resim 7');
  assert.equal(translate('tr', 'solvedCount', { solved: 3, total: 20 }), '20 resimden 3 tanesi çözüldü');
  assert.equal(translate('de', 'newGame'), 'New game', 'unknown language -> English');
  assert.equal(translate('en', 'no-such-key'), 'no-such-key');
  assert.equal(translate('en', 'best', {}), 'Best {time}', 'missing params stay visible');
});

test('formatTime shows m:ss and h:mm:ss', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(999), '0:00');
  assert.equal(formatTime(167000), '2:47');
  assert.equal(formatTime(600000), '10:00');
  assert.equal(formatTime(3723000), '1:02:03');
  assert.equal(formatTime(-5), '0:00');
  assert.equal(formatTime(Number.NaN), '0:00');
});
