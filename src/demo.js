import { EMPTY, FILLED, CROSSED } from './cells.js';
import { createGame } from './game.js';
import { getPuzzle } from './puzzles.js';

/** Picture shown by the ?demo state (used for the README screenshot). */
export const DEMO_PUZZLE_ID = 'sailboat';

/** The sails (rows 0-5) are painted, the hull is still open. */
const PAINTED_ROWS = 6;
/** Rows where the blank cells are already crossed out. */
const CROSSED_ROWS = Object.freeze([0, 1, 2, 5, 8]);
/** Columns that are completely worked out (painted and crossed). */
const FINISHED_COLS = Object.freeze([0, 9]);
const DEMO_ELAPSED_MS = 167000;

/**
 * A deterministic, half-solved 10x10 picture game with some crosses, for the ?demo screenshot.
 * @returns {ReturnType<typeof createGame>}
 */
export function createDemoGame() {
  const puzzle = getPuzzle(DEMO_PUZZLE_ID);
  const cells = puzzle.solution.flatMap((row, r) => row.map((painted, c) => demoCell(r, c, painted === 1)));
  const snapshot = { ...createGame({ puzzle }).snapshot(), cells: cells.join(''), elapsed: DEMO_ELAPSED_MS };
  return createGame({ puzzle, snapshot });
}

function demoCell(row, col, painted) {
  if (FINISHED_COLS.includes(col)) return painted ? FILLED : CROSSED;
  if (painted) return row < PAINTED_ROWS ? FILLED : EMPTY;
  return CROSSED_ROWS.includes(row) ? CROSSED : EMPTY;
}
