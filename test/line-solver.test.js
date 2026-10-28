import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY, FILLED, CROSSED } from '../src/cells.js';
import { lineClue } from '../src/clues.js';
import { solveLine } from '../src/line-solver.js';
import { createRng } from '../src/rng.js';

const U = EMPTY;
const F = FILLED;
const X = CROSSED;
const unknown = (length) => new Array(length).fill(U);

/** Reference solver: tries every assignment of the line. */
function bruteForceLine(clue, line) {
  const expected = clue.filter((n) => n > 0).join(',');
  const canFill = new Array(line.length).fill(false);
  const canBlank = new Array(line.length).fill(false);
  let fits = false;
  for (let mask = 0; mask < 1 << line.length; mask++) {
    const cells = line.map((_, i) => ((mask >> i) & 1 ? F : X));
    if (cells.some((value, i) => line[i] !== U && line[i] !== value)) continue;
    if (lineClue(cells).join(',') !== expected) continue;
    fits = true;
    cells.forEach((value, i) => {
      if (value === F) canFill[i] = true;
      else canBlank[i] = true;
    });
  }
  if (!fits) return null;
  return line.map((_, i) => (canFill[i] && canBlank[i] ? U : canFill[i] ? F : X));
}

test('clue [3] in 5 cells forces only the middle cell', () => {
  assert.deepEqual(solveLine([3], unknown(5)), [U, U, F, U, U]);
});

test('clue [1,1,1] in 5 cells is fully determined', () => {
  assert.deepEqual(solveLine([1, 1, 1], unknown(5)), [F, X, F, X, F]);
});

test('clues [0] and [] cross out the whole line', () => {
  assert.deepEqual(solveLine([0], unknown(4)), [X, X, X, X]);
  assert.deepEqual(solveLine([], unknown(4)), [X, X, X, X]);
  assert.equal(solveLine([0], [U, F, U]), null);
  assert.deepEqual(solveLine([], []), []);
});

test('full-length clues fill the line', () => {
  assert.deepEqual(solveLine([5], unknown(5)), [F, F, F, F, F]);
  assert.deepEqual(solveLine([2, 2], unknown(5)), [F, F, X, F, F]);
});

test('overlapping placements give partial deductions', () => {
  assert.deepEqual(solveLine([4], unknown(6)), [U, U, F, F, U, U]);
  assert.deepEqual(solveLine([3, 1], unknown(6)), [U, F, F, U, U, U]);
  assert.deepEqual(solveLine([1], unknown(3)), [U, U, U]);
});

test('known cells narrow the placements', () => {
  assert.deepEqual(solveLine([2], [F, U, U, U, U]), [F, F, X, X, X]);
  assert.deepEqual(solveLine([1], [U, U, F, U, U]), [X, X, F, X, X]);
  assert.deepEqual(solveLine([2], [U, X, U, U, U]), [X, X, U, F, U]);
  assert.deepEqual(solveLine([1, 1], [U, U, F, U, U]), [U, X, F, X, U]);
});

test('impossible lines return null', () => {
  assert.equal(solveLine([6], unknown(5)), null);
  assert.equal(solveLine([2, 2], unknown(4)), null);
  assert.equal(solveLine([1], [F, X, F]), null);
  assert.equal(solveLine([3], [U, X, U, U, X]), null);
  assert.equal(solveLine([2], [F, X, F]), null);
});

test('a fully known line is returned unchanged when it fits', () => {
  assert.deepEqual(solveLine([1, 1], [F, X, F]), [F, X, F]);
});

test('the input line is not modified', () => {
  const line = unknown(5);
  solveLine([5], line);
  assert.deepEqual(line, unknown(5));
});

test('matches a brute-force solver on 1500 random lines', () => {
  const rng = createRng(2026);
  const int = (n) => Math.floor(rng() * n);
  for (let round = 0; round < 1500; round++) {
    const length = 1 + int(10);
    const source = Array.from({ length }, () => (rng() < 0.55 ? F : X));
    const clue = round % 4 === 0 ? Array.from({ length: int(4) }, () => 1 + int(4)) : lineClue(source);
    const line = Array.from({ length }, (_, i) => {
      if (rng() >= 0.3) return U;
      return round % 3 === 0 ? (rng() < 0.5 ? F : X) : source[i];
    });
    assert.deepEqual(solveLine(clue, line), bruteForceLine(clue, line), `clue ${clue} line ${line}`);
  }
});
