import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeClues } from '../src/clues.js';
import { PALETTE, PICTURE_ART } from '../src/picture-data.js';
import { PICTURES, RANDOM_SIZES, getPuzzle } from '../src/puzzles.js';
import { findSolutions, isLineSolvable } from '../src/solver.js';

test('there are about 20 hand-made pictures with unique ids and names', () => {
  assert.equal(PICTURES.length, 20);
  assert.equal(new Set(PICTURES.map((p) => p.id)).size, PICTURES.length);
  for (const { id, kind, name } of PICTURES) {
    assert.match(id, /^[a-z]+(-[a-z]+)*$/);
    assert.equal(kind, 'picture');
    assert.ok(name.en.length > 0 && name.tr.length > 0, id);
  }
});

test('pictures are square, sized 5, 10 or 15, and sorted by size', () => {
  for (const { id, art } of PICTURE_ART) {
    assert.ok(RANDOM_SIZES.includes(art.length), id);
    assert.ok(art.every((row) => row.length === art.length), `${id} has uneven rows`);
  }
  const sizes = PICTURES.map((p) => p.width);
  assert.deepEqual(sizes, [...sizes].sort((a, b) => a - b));
  for (const size of RANDOM_SIZES) assert.ok(sizes.filter((s) => s === size).length >= 5, `size ${size}`);
});

test('every painted cell has a palette colour and every blank cell none', () => {
  for (const { id, art } of PICTURE_ART) {
    for (const row of art) {
      for (const ch of row) assert.ok(ch === '.' || Object.hasOwn(PALETTE, ch), `${id} uses "${ch}"`);
    }
  }
  for (const { id, solution, colors } of PICTURES) {
    solution.forEach((row, r) =>
      row.forEach((painted, c) => assert.equal(colors[r][c] !== null, painted === 1, `${id} ${r},${c}`)),
    );
  }
});

test('every picture has exactly one solution: the picture itself', () => {
  for (const { id, rows, cols, solution } of PICTURES) {
    assert.deepEqual(computeClues(solution), { rows, cols });
    assert.deepEqual(findSolutions(rows, cols, 2), [solution], `${id} is not unique`);
  }
});

test('every picture can be finished by line logic alone', () => {
  for (const { id, rows, cols } of PICTURES) {
    assert.equal(isLineSolvable(rows, cols), true, `${id} needs guessing`);
  }
});

test('getPuzzle finds pictures and rebuilds random puzzles from their id', () => {
  assert.equal(getPuzzle('heart'), PICTURES[0]);
  const random = getPuzzle('random-15-123');
  assert.equal(random.kind, 'random');
  assert.equal(random.seed, 123);
  assert.equal(random.width, 15);
  const badIds = ['nope', 'random-7-1', 'random-10-', 'random-10-9999999999', 'random-10-99999999999', 'random-10-1x', '', null];
  for (const bad of badIds) {
    assert.equal(getPuzzle(bad), null, String(bad));
  }
});
