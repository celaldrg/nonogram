import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY, FILLED, CROSSED } from '../src/cells.js';
import { lineClue, computeClues, normalizeClue, lineMatchesClue } from '../src/clues.js';

test('lineClue lists the runs of filled cells from left to right', () => {
  assert.deepEqual(lineClue([1, 1, 0, 1, 0, 0, 1, 1, 1]), [2, 1, 3]);
  assert.deepEqual(lineClue([1, 1, 1, 1, 1]), [5]);
  assert.deepEqual(lineClue([0, 0, 0]), []);
  assert.deepEqual(lineClue([]), []);
});

test('lineClue treats crosses and empty cells as blank', () => {
  assert.deepEqual(lineClue([FILLED, CROSSED, FILLED, EMPTY, FILLED, FILLED]), [1, 1, 2]);
  assert.deepEqual(lineClue(Uint8Array.from([2, 1, 1, 2])), [2]);
});

test('computeClues returns row and column clues of a square grid', () => {
  const grid = [
    [1, 1, 0],
    [0, 1, 1],
    [1, 0, 1],
  ];
  assert.deepEqual(computeClues(grid), {
    rows: [[2], [2], [1, 1]],
    cols: [[1, 1], [2], [2]],
  });
});

test('computeClues handles rectangular grids and empty lines', () => {
  const grid = [
    [1, 0, 1, 1],
    [0, 0, 0, 0],
  ];
  assert.deepEqual(computeClues(grid), {
    rows: [[1, 2], []],
    cols: [[1], [], [1], [1]],
  });
});

test('normalizeClue treats [0] like an empty clue', () => {
  assert.deepEqual(normalizeClue([0]), []);
  assert.deepEqual(normalizeClue([]), []);
  assert.deepEqual(normalizeClue([3, 0, 1]), [3, 1]);
});

test('lineMatchesClue compares only the filled cells', () => {
  assert.equal(lineMatchesClue([FILLED, CROSSED, FILLED], [1, 1]), true);
  assert.equal(lineMatchesClue([FILLED, EMPTY, FILLED], [1, 1]), true);
  assert.equal(lineMatchesClue([FILLED, FILLED, EMPTY], [1, 1]), false);
  assert.equal(lineMatchesClue([CROSSED, EMPTY, CROSSED], [0]), true);
  assert.equal(lineMatchesClue([CROSSED, EMPTY, CROSSED], []), true);
  assert.equal(lineMatchesClue([FILLED, EMPTY, EMPTY], [0]), false);
});
