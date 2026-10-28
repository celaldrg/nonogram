import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY, FILLED, CROSSED } from '../src/cells.js';
import { computeClues } from '../src/clues.js';
import { createRng } from '../src/rng.js';
import { propagate, isLineSolvable, findSolutions, countSolutions } from '../src/solver.js';

const parse = (art) => art.map((row) => Array.from(row, (ch) => (ch === '#' ? 1 : 0)));

/** Every width x height grid, with its clues keyed for counting. */
function allGrids(width, height) {
  const grids = [];
  for (let mask = 0; mask < 2 ** (width * height); mask++) {
    const grid = Array.from({ length: height }, (_, r) =>
      Array.from({ length: width }, (_, c) => (mask >> (r * width + c)) & 1),
    );
    const { rows, cols } = computeClues(grid);
    grids.push({ grid, rows, cols, rowKey: JSON.stringify(rows), colKey: JSON.stringify(cols) });
  }
  return grids;
}

/** Brute-force solution counts for every (row clues, column clues) pair that occurs. */
function countByClues(grids) {
  const counts = new Map();
  for (const { rowKey, colKey } of grids) {
    const key = `${rowKey}|${colKey}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function compareWithBruteForce(width, height, { pairs, mixed }) {
  const grids = allGrids(width, height);
  const counts = countByClues(grids);
  const rng = createRng(width * 100 + height);
  const pick = () => grids[Math.floor(rng() * grids.length)];
  const distinct = [...new Map(grids.map((g) => [`${g.rowKey}|${g.colKey}`, g])).values()];
  const sample = pairs === 'all' ? distinct : Array.from({ length: pairs }, () => distinct[Math.floor(rng() * distinct.length)]);
  const seen = new Set();
  const expectCount = (rows, cols, expected) => {
    assert.equal(countSolutions(rows, cols, 100), expected, `${JSON.stringify(rows)} ${JSON.stringify(cols)}`);
    seen.add(Math.min(expected, 2));
  };
  for (const { rows, cols, rowKey, colKey } of sample) {
    expectCount(rows, cols, counts.get(`${rowKey}|${colKey}`));
  }
  // Row clues of one grid with column clues of another: usually no solution at all.
  for (let i = 0; i < mixed; i++) {
    const a = pick();
    const b = pick();
    expectCount(a.rows, b.cols, counts.get(`${a.rowKey}|${b.colKey}`) ?? 0);
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2], 'cases with zero, one and several solutions were checked');
}

test('propagate solves a puzzle that line logic can finish', () => {
  const solution = parse(['.#.#.', '#####', '#####', '.###.', '..#..']);
  const { rows, cols } = computeClues(solution);
  const result = propagate(rows, cols);
  assert.equal(result.solved, true);
  assert.equal(result.contradiction, false);
  assert.deepEqual(
    result.grid,
    solution.map((row) => row.map((v) => (v ? FILLED : CROSSED))),
  );
  assert.equal(isLineSolvable(rows, cols), true);
});

test('propagate continues from known cells and reports contradictions', () => {
  const rows = [[1], [1]];
  const cols = [[1], [1]];
  assert.equal(propagate(rows, cols).solved, false);
  const guided = propagate(rows, cols, [[FILLED, EMPTY], [EMPTY, EMPTY]]);
  assert.equal(guided.solved, true);
  assert.deepEqual(guided.grid, [[FILLED, CROSSED], [CROSSED, FILLED]]);
  const broken = propagate(rows, cols, [[FILLED, FILLED], [EMPTY, EMPTY]]);
  assert.equal(broken.contradiction, true);
  assert.equal(broken.solved, false);
});

test('an ambiguous puzzle has two solutions and is not line-solvable', () => {
  const rows = [[1], [1]];
  const cols = [[1], [1]];
  const solutions = findSolutions(rows, cols, 5);
  assert.equal(solutions.length, 2);
  for (const grid of solutions) assert.deepEqual(computeClues(grid), { rows, cols });
  assert.notDeepEqual(solutions[0], solutions[1]);
  assert.equal(isLineSolvable(rows, cols), false);
});

test('counting stops at the limit', () => {
  const rows = [[1], [1], [1]];
  const cols = [[1], [1], [1]];
  assert.equal(countSolutions(rows, cols, 100), 6);
  assert.equal(countSolutions(rows, cols), 2);
  assert.equal(countSolutions(rows, cols, 1), 1);
  assert.equal(countSolutions(rows, cols, 0), 0);
});

test('backtracking proves uniqueness where line logic gets stuck', () => {
  const solution = parse(['.##..', '#..#.', '..#.#', '####.', '...#.']);
  const { rows, cols } = computeClues(solution);
  assert.equal(isLineSolvable(rows, cols), false);
  assert.deepEqual(findSolutions(rows, cols, 2), [solution]);
});

test('impossible clues have no solution', () => {
  assert.equal(countSolutions([[2], [0]], [[2], [0]]), 0);
  assert.equal(countSolutions([[1], [1]], [[2], [1]]), 0);
  assert.equal(countSolutions([[3]], [[1], [1]]), 0);
});

test('solution counts match brute force on every 2x3, 3x2 and 3x3 grid', () => {
  compareWithBruteForce(2, 3, { pairs: 'all', mixed: 200 });
  compareWithBruteForce(3, 2, { pairs: 'all', mixed: 200 });
  compareWithBruteForce(3, 3, { pairs: 'all', mixed: 600 });
});

test('solution counts match brute force on sampled 4x3 and 4x4 grids', () => {
  compareWithBruteForce(4, 3, { pairs: 'all', mixed: 400 });
  compareWithBruteForce(4, 4, { pairs: 600, mixed: 600 });
});
