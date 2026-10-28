import { computeClues } from './clues.js';
import { isLineSolvable } from './solver.js';

/** Share of filled cells used when no density is given. */
const DEFAULT_DENSITY = 0.55;

/**
 * Random solution grid where each cell is filled with probability `density`.
 * @param {number} width
 * @param {number} height
 * @param {number} density between 0 and 1
 * @param {() => number} rng seeded random source returning [0, 1)
 * @returns {number[][]} rows of 0/1 values
 */
export function randomGrid(width, height, density, rng) {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => (rng() < density ? 1 : 0)),
  );
}

/**
 * Generates a fair puzzle: random grids are drawn until one can be finished by line logic alone.
 * Line-solvable puzzles never need guessing and always have exactly one solution.
 * @param {object} options
 * @param {number} options.width
 * @param {number} [options.height=options.width]
 * @param {number} [options.density=0.55] share of filled cells
 * @param {() => number} options.rng seeded random source (see createRng)
 * @param {number} [options.maxAttempts=2000]
 * @returns {{solution: number[][], rows: number[][], cols: number[][], attempts: number}}
 */
export function generatePuzzle({ width, height = width, density = DEFAULT_DENSITY, rng, maxAttempts = 2000 }) {
  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    const solution = randomGrid(width, height, density, rng);
    const { rows, cols } = computeClues(solution);
    if (isLineSolvable(rows, cols)) return { solution, rows, cols, attempts };
  }
  throw new Error(`No fair ${width}x${height} puzzle found in ${maxAttempts} attempts`);
}
