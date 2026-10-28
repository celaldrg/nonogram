import { FILLED } from './cells.js';

/**
 * Lengths of the runs of filled cells in one line.
 * @param {ArrayLike<number>} line cells, where FILLED (1) counts as filled and anything else as blank
 * @returns {number[]} run lengths from left to right; [] for a line without filled cells
 */
export function lineClue(line) {
  const clue = [];
  let run = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === FILLED) {
      run += 1;
    } else if (run > 0) {
      clue.push(run);
      run = 0;
    }
  }
  if (run > 0) clue.push(run);
  return clue;
}

/**
 * Row and column clues of a solution grid.
 * @param {number[][]} grid rows of 0/1 values (1 = filled)
 * @returns {{rows: number[][], cols: number[][]}}
 */
export function computeClues(grid) {
  const width = grid.length > 0 ? grid[0].length : 0;
  const cols = [];
  for (let c = 0; c < width; c++) {
    cols.push(lineClue(grid.map((row) => row[c])));
  }
  return { rows: grid.map(lineClue), cols };
}

/**
 * Removes zero entries, so the clues [0] and [] both mean "no filled cells".
 * @param {number[]} clue
 * @returns {number[]}
 */
export function normalizeClue(clue) {
  return clue.filter((n) => n > 0);
}

/**
 * True when the filled cells of a line form exactly the given clue.
 * @param {ArrayLike<number>} line
 * @param {number[]} clue
 * @returns {boolean}
 */
export function lineMatchesClue(line, clue) {
  const actual = lineClue(line);
  const expected = normalizeClue(clue);
  return actual.length === expected.length && actual.every((n, i) => n === expected[i]);
}
