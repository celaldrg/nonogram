import { EMPTY, FILLED, CROSSED } from './cells.js';
import { normalizeClue } from './clues.js';
import { solveLine } from './line-solver.js';

/**
 * Line logic for a whole grid: runs the line solver on rows and columns until nothing changes.
 * @param {number[][]} rows row clues
 * @param {number[][]} cols column clues
 * @param {number[][]} [grid] known cells (EMPTY = unknown); copied, never modified
 * @returns {{grid: number[][], solved: boolean, contradiction: boolean}}
 *   solved: every cell decided; contradiction: the clues cannot be met from this grid
 */
export function propagate(rows, cols, grid) {
  const cells = grid ? grid.map((row) => Array.from(row)) : blankGrid(cols.length, rows.length);
  const allLines = Array.from({ length: rows.length + cols.length }, (_, id) => id);
  const consistent = settle(rows, cols, cells, allLines);
  return {
    grid: cells,
    solved: consistent && cells.every((row) => row.every((cell) => cell !== EMPTY)),
    contradiction: !consistent,
  };
}

/**
 * True when line logic alone finishes the puzzle from an empty grid.
 * Such a puzzle never needs guessing, and its solution is unique.
 * @param {number[][]} rows
 * @param {number[][]} cols
 * @returns {boolean}
 */
export function isLineSolvable(rows, cols) {
  return propagate(rows, cols).solved;
}

/**
 * Finds solutions by line logic plus backtracking, stopping once `limit` are found.
 * @param {number[][]} rows row clues
 * @param {number[][]} cols column clues
 * @param {number} [limit=2] stop after this many solutions (2 is enough to prove uniqueness)
 * @returns {number[][][]} solutions as rows of 0/1 values
 */
export function findSolutions(rows, cols, limit = 2) {
  const solutions = [];
  if (limit < 1 || !totalsAgree(rows, cols)) return solutions;
  const start = propagate(rows, cols);
  if (start.contradiction) return solutions;
  const height = rows.length;
  const search = (cells) => {
    const next = firstUnknown(cells);
    if (!next) {
      solutions.push(cells.map((row) => row.map((cell) => (cell === FILLED ? 1 : 0))));
      return;
    }
    for (const guess of [FILLED, CROSSED]) {
      if (solutions.length >= limit) return;
      const copy = cells.map((row) => row.slice());
      copy[next.row][next.col] = guess;
      if (settle(rows, cols, copy, [next.row, height + next.col])) search(copy);
    }
  };
  search(start.grid);
  return solutions;
}

/**
 * Number of solutions, counted up to `limit`.
 * @param {number[][]} rows
 * @param {number[][]} cols
 * @param {number} [limit=2]
 * @returns {number}
 */
export function countSolutions(rows, cols, limit = 2) {
  return findSolutions(rows, cols, limit).length;
}

function blankGrid(width, height) {
  return Array.from({ length: height }, () => new Array(width).fill(EMPTY));
}

/** Cheap early exit: rows and columns must paint the same number of cells. */
function totalsAgree(rows, cols) {
  const total = (clues) => clues.reduce((sum, clue) => sum + normalizeClue(clue).reduce((a, b) => a + b, 0), 0);
  return total(rows) === total(cols);
}

function firstUnknown(cells) {
  for (let row = 0; row < cells.length; row++) {
    const col = cells[row].indexOf(EMPTY);
    if (col !== -1) return { row, col };
  }
  return null;
}

/**
 * Solves the queued lines in place, re-queueing every crossing line that gains a cell.
 * Line ids 0..height-1 are rows, height.. are columns.
 * @returns {boolean} false on a contradiction
 */
function settle(rows, cols, cells, lineIds) {
  const height = rows.length;
  const queued = new Uint8Array(height + cols.length);
  const queue = [];
  const enqueue = (id) => {
    if (!queued[id]) {
      queued[id] = 1;
      queue.push(id);
    }
  };
  lineIds.forEach(enqueue);
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    queued[id] = 0;
    const isRow = id < height;
    const index = isRow ? id : id - height;
    const line = isRow ? cells[index] : cells.map((row) => row[index]);
    const solved = solveLine(isRow ? rows[index] : cols[index], line);
    if (!solved) return false;
    for (let i = 0; i < solved.length; i++) {
      if (solved[i] === line[i]) continue;
      if (isRow) {
        cells[index][i] = solved[i];
        enqueue(height + i);
      } else {
        cells[i][index] = solved[i];
        enqueue(i);
      }
    }
  }
  return true;
}
