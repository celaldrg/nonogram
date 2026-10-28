import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeClues } from '../src/clues.js';
import { generatePuzzle, randomGrid } from '../src/generator.js';
import { RANDOM_SIZES, randomPuzzle } from '../src/puzzles.js';
import { createRng } from '../src/rng.js';
import { findSolutions, isLineSolvable } from '../src/solver.js';

const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);

test('the seeded RNG is deterministic and stays in [0, 1)', () => {
  const a = createRng(42);
  const b = createRng(42);
  const values = Array.from({ length: 1000 }, () => a());
  assert.deepEqual(values, Array.from({ length: 1000 }, () => b()));
  assert.ok(values.every((v) => v >= 0 && v < 1));
  assert.notDeepEqual(values.slice(0, 10), Array.from({ length: 10 }, createRng(43)));
});

test('randomGrid follows the density and the size', () => {
  const rng = createRng(5);
  assert.deepEqual(randomGrid(3, 2, 0, rng), [[0, 0, 0], [0, 0, 0]]);
  assert.deepEqual(randomGrid(2, 3, 1, rng), [[1, 1], [1, 1], [1, 1]]);
  const share = randomGrid(40, 40, 0.3, rng).flat().filter(Boolean).length / 1600;
  assert.ok(share > 0.25 && share < 0.35, `share ${share}`);
});

for (const size of RANDOM_SIZES) {
  test(`50 seeded ${size}x${size} puzzles are fair: one solution, solvable by line logic`, () => {
    for (const seed of SEEDS) {
      const puzzle = randomPuzzle(size, seed);
      assert.equal(puzzle.id, `random-${size}-${seed}`);
      assert.equal(puzzle.kind, 'random');
      assert.equal(puzzle.width, size);
      assert.equal(puzzle.height, size);
      assert.deepEqual(computeClues(puzzle.solution), { rows: puzzle.rows, cols: puzzle.cols });
      assert.equal(isLineSolvable(puzzle.rows, puzzle.cols), true, `seed ${seed} needs guessing`);
      assert.deepEqual(findSolutions(puzzle.rows, puzzle.cols, 2), [puzzle.solution], `seed ${seed} is not unique`);
    }
  });
}

test('the same seed gives the same puzzle and different seeds vary', () => {
  assert.deepEqual(randomPuzzle(10, 7), randomPuzzle(10, 7));
  const shapes = new Set(SEEDS.map((seed) => JSON.stringify(randomPuzzle(10, seed).solution)));
  assert.equal(shapes.size, SEEDS.length);
});

test('generated puzzles are neither empty nor solid', () => {
  for (const seed of SEEDS) {
    const share = randomPuzzle(15, seed).solution.flat().filter(Boolean).length / 225;
    assert.ok(share > 0.35 && share < 0.8, `seed ${seed} share ${share}`);
  }
});

test('the generator gives up after maxAttempts when no fair grid appears', () => {
  // This sequence always draws the 2x2 diagonal, which has two solutions.
  const values = [0.1, 0.9, 0.9, 0.1];
  let i = 0;
  const rng = () => values[i++ % values.length];
  assert.throws(() => generatePuzzle({ width: 2, density: 0.5, rng, maxAttempts: 5 }), /No fair 2x2 puzzle/);
});

test('generatePuzzle reports how many grids it drew', () => {
  const result = generatePuzzle({ width: 5, rng: createRng(3) });
  assert.ok(Number.isInteger(result.attempts) && result.attempts >= 1);
  assert.deepEqual(computeClues(result.solution), { rows: result.rows, cols: result.cols });
});
