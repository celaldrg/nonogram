import { EMPTY, FILLED, CROSSED } from './cells.js';
import { lineMatchesClue } from './clues.js';

/** Marks the player can paint with. */
export const TOOLS = Object.freeze({ fill: FILLED, cross: CROSSED });

const SNAPSHOT_VERSION = 1;
const STATUSES = Object.freeze(['playing', 'won', 'revealed']);

/**
 * @typedef {object} CellChange
 * @property {number} index row * width + col
 * @property {number} value new state: EMPTY, FILLED or CROSSED
 * @property {boolean} mistake true when mistake checking turned a wrong fill into a cross
 */

/**
 * @typedef {object} GameState
 * @property {number} width
 * @property {number} height
 * @property {number[]} cells row-major cell states
 * @property {boolean[]} rowsDone row matches its clue (the clue can fade)
 * @property {boolean[]} colsDone column matches its clue
 * @property {'playing'|'won'|'revealed'} status
 * @property {number} elapsed play time in ms
 * @property {number} mistakes wrong fills caught by mistake checking
 * @property {boolean} autoCheck mistake checking is on
 * @property {boolean} canUndo
 * @property {boolean} canRedo
 */

/**
 * Creates a game for a puzzle. Input arrives as strokes: a tap is startStroke + endStroke,
 * a drag adds moveStroke calls and stays on the row or column it first moved along.
 * @param {object} options
 * @param {import('./puzzles.js').Puzzle} options.puzzle needs width, height, rows, cols, solution
 * @param {boolean} [options.autoCheck=false] turn wrong fills into crosses and count them as mistakes
 * @param {object|null} [options.snapshot] saved progress from game.snapshot(); ignored when invalid
 * @returns {Game}
 */
export function createGame({ puzzle, autoCheck = false, snapshot = null }) {
  return new Game(puzzle, autoCheck, snapshot);
}

class Game {
  #cells;
  #undo = [];
  #redo = [];
  #stroke = null;
  #elapsed = 0;
  #mistakes = 0;
  #status = 'playing';
  #started = false;
  #autoCheck;

  constructor(puzzle, autoCheck, snapshot) {
    this.puzzle = puzzle;
    this.width = puzzle.width;
    this.height = puzzle.height;
    this.#cells = new Uint8Array(this.width * this.height);
    this.#autoCheck = Boolean(autoCheck);
    if (isValidSnapshot(snapshot, this.#cells.length)) this.#restore(snapshot);
  }

  /** State of one cell. */
  cell(row, col) {
    return this.#cells[row * this.width + col];
  }

  /**
   * Starts a stroke on a cell. Painting a cell that already has the tool's mark erases instead.
   * @param {number} row
   * @param {number} col
   * @param {'fill'|'cross'} [tool='fill']
   * @returns {CellChange[]}
   */
  startStroke(row, col, tool = 'fill') {
    if (this.#status !== 'playing' || !this.#inside(row, col) || !Object.hasOwn(TOOLS, tool)) return [];
    if (this.#stroke) this.endStroke();
    const origin = row * this.width + col;
    const mark = TOOLS[tool];
    this.#stroke = {
      row,
      col,
      mark,
      target: this.#cells[origin] === mark ? EMPTY : mark,
      axis: null,
      before: new Map(),
      corrected: new Set(),
    };
    return this.#paintSegment([origin]);
  }

  /**
   * Extends the stroke towards a cell. The first move locks it to a row or a column;
   * moving back shrinks it and restores the cells it no longer covers.
   * @returns {CellChange[]}
   */
  moveStroke(row, col) {
    const stroke = this.#stroke;
    if (!stroke || !Number.isInteger(row) || !Number.isInteger(col)) return [];
    const r = clamp(row, 0, this.height - 1);
    const c = clamp(col, 0, this.width - 1);
    if (!stroke.axis) {
      if (r === stroke.row && c === stroke.col) return [];
      stroke.axis = Math.abs(c - stroke.col) >= Math.abs(r - stroke.row) ? 'row' : 'col';
    }
    return this.#paintSegment(this.#segmentTo(r, c));
  }

  /**
   * Finishes the stroke as one undoable move and checks for a win.
   * @returns {{changed: number, mistakes: number, won: boolean}|null} null when no stroke was active
   */
  endStroke() {
    const stroke = this.#stroke;
    if (!stroke) return null;
    this.#stroke = null;
    const move = [];
    for (const [index, before] of stroke.before) {
      if (this.#cells[index] !== before) move.push({ index, before, after: this.#cells[index] });
    }
    if (move.length > 0) {
      this.#undo.push(move);
      this.#redo = [];
    }
    this.#mistakes += stroke.corrected.size;
    this.#started = true;
    this.#updateStatus();
    return { changed: move.length, mistakes: stroke.corrected.size, won: this.#status === 'won' };
  }

  /**
   * Abandons the active stroke: its cells get their previous marks back, and nothing is added
   * to the history, the mistakes or the timer (used when a touch turns into a pan or a long-press).
   * @returns {CellChange[]} the restored cells
   */
  cancelStroke() {
    const stroke = this.#stroke;
    if (!stroke) return [];
    this.#stroke = null;
    const restored = [];
    for (const [index, before] of stroke.before) {
      if (this.#cells[index] === before) continue;
      this.#cells[index] = before;
      restored.push({ index, value: before, mistake: false });
    }
    return restored;
  }

  /**
   * Taps one cell (keyboard or single click).
   * @param {number} row
   * @param {number} col
   * @param {'fill'|'cross'} [tool='fill']
   * @returns {{changed: number, mistakes: number, won: boolean}|null}
   */
  toggle(row, col, tool = 'fill') {
    this.startStroke(row, col, tool);
    return this.endStroke();
  }

  /** Reverts the last move. @returns {boolean} whether anything changed */
  undo() {
    if (this.#stroke) this.endStroke();
    return this.#replay(this.#undo, this.#redo, 'before');
  }

  /** Re-applies the last undone move. @returns {boolean} whether anything changed */
  redo() {
    if (this.#stroke) this.endStroke();
    return this.#replay(this.#redo, this.#undo, 'after');
  }

  /**
   * Cells whose mark contradicts the solution: fills on blank cells and crosses on painted ones.
   * @returns {number[]} cell indices
   */
  check() {
    const wrong = [];
    this.#cells.forEach((value, index) => {
      const painted = this.#isPainted(index);
      if ((value === FILLED && !painted) || (value === CROSSED && painted)) wrong.push(index);
    });
    return wrong;
  }

  /** Shows the solution and ends the game without a win. @returns {boolean} */
  reveal() {
    if (this.#status !== 'playing') return false;
    this.#stroke = null;
    this.#cells.forEach((_, index) => {
      this.#cells[index] = this.#isPainted(index) ? FILLED : EMPTY;
    });
    this.#undo = [];
    this.#redo = [];
    this.#status = 'revealed';
    return true;
  }

  /** Clears the board, the history, the timer and the mistakes. */
  restart() {
    this.#cells.fill(EMPTY);
    this.#undo = [];
    this.#redo = [];
    this.#stroke = null;
    this.#elapsed = 0;
    this.#mistakes = 0;
    this.#status = 'playing';
    this.#started = false;
  }

  /** Advances the timer; it runs only after the first move and stops when the game ends. */
  tick(ms) {
    if (this.#status === 'playing' && this.#started && Number.isFinite(ms) && ms > 0) this.#elapsed += ms;
  }

  /** Turns mistake checking on or off for the next strokes. */
  setAutoCheck(on) {
    this.#autoCheck = Boolean(on);
  }

  /** @returns {GameState} a fresh copy the UI can render from */
  getState() {
    const playing = this.#status === 'playing';
    return {
      width: this.width,
      height: this.height,
      cells: Array.from(this.#cells),
      rowsDone: this.puzzle.rows.map((_, r) => this.#rowDone(r)),
      colsDone: this.puzzle.cols.map((_, c) => this.#colDone(c)),
      status: this.#status,
      elapsed: this.#elapsed,
      mistakes: this.#mistakes,
      autoCheck: this.#autoCheck,
      canUndo: playing && this.#undo.length > 0,
      canRedo: playing && this.#redo.length > 0,
    };
  }

  /** @returns {{v: number, cells: string, elapsed: number, mistakes: number, status: string}} JSON-safe progress */
  snapshot() {
    return {
      v: SNAPSHOT_VERSION,
      cells: this.#cells.join(''),
      elapsed: Math.round(this.#elapsed),
      mistakes: this.#mistakes,
      status: this.#status,
    };
  }

  #restore(saved) {
    Array.from(saved.cells).forEach((ch, index) => {
      this.#cells[index] = Number(ch);
    });
    this.#elapsed = saved.elapsed;
    this.#mistakes = saved.mistakes;
    this.#started = saved.elapsed > 0 || this.#cells.some((value) => value !== EMPTY);
    if (saved.status === 'revealed') this.#status = 'revealed';
    else this.#updateStatus();
  }

  #inside(row, col) {
    return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && col >= 0 && row < this.height && col < this.width;
  }

  #isPainted(index) {
    return this.puzzle.solution[Math.floor(index / this.width)][index % this.width] === 1;
  }

  #rowDone(row) {
    return lineMatchesClue(this.#cells.subarray(row * this.width, (row + 1) * this.width), this.puzzle.rows[row]);
  }

  #colDone(col) {
    const line = Array.from({ length: this.height }, (_, row) => this.#cells[row * this.width + col]);
    return lineMatchesClue(line, this.puzzle.cols[col]);
  }

  /** Win detection by clues, so any grid that fits all clues wins, not only the stored solution. */
  #updateStatus() {
    if (this.#status !== 'playing') return;
    const rowsOk = this.puzzle.rows.every((_, r) => this.#rowDone(r));
    if (rowsOk && this.puzzle.cols.every((_, c) => this.#colDone(c))) this.#status = 'won';
  }

  /** Cell indices from the stroke origin to (row, col) along the locked axis, origin first. */
  #segmentTo(row, col) {
    const { row: originRow, col: originCol, axis } = this.#stroke;
    const alongRow = axis === 'row';
    const from = alongRow ? originCol : originRow;
    const to = alongRow ? col : row;
    const step = to >= from ? 1 : -1;
    const indices = [];
    for (let k = from; k !== to + step; k += step) {
      indices.push(alongRow ? originRow * this.width + k : k * this.width + originCol);
    }
    return indices;
  }

  /** Makes the stroke cover exactly `segment`: restores dropped cells, paints new ones. */
  #paintSegment(segment) {
    const stroke = this.#stroke;
    const wanted = new Set(segment);
    const changed = [];
    for (const [index, before] of stroke.before) {
      if (wanted.has(index)) continue;
      stroke.before.delete(index);
      stroke.corrected.delete(index);
      if (this.#cells[index] !== before) {
        this.#cells[index] = before;
        changed.push(index);
      }
    }
    for (const index of segment) {
      if (stroke.before.has(index)) continue;
      stroke.before.set(index, this.#cells[index]);
      const value = this.#strokeValue(index);
      if (value !== this.#cells[index]) {
        this.#cells[index] = value;
        changed.push(index);
      }
    }
    return changed.map((index) => ({ index, value: this.#cells[index], mistake: stroke.corrected.has(index) }));
  }

  /**
   * New value of a cell under the stroke. Erasing only clears the stroke's own mark; painting
   * never overwrites other marks except on the tapped cell itself.
   */
  #strokeValue(index) {
    const { row, col, mark, target, corrected } = this.#stroke;
    const current = this.#cells[index];
    if (target === EMPTY) return current === mark ? EMPTY : current;
    if (current !== EMPTY && index !== row * this.width + col) return current;
    if (this.#autoCheck && target === FILLED && !this.#isPainted(index)) {
      corrected.add(index);
      return CROSSED;
    }
    return target;
  }

  /** Moves one history entry from `from` to `to`, applying its `side` values. */
  #replay(from, to, side) {
    if (this.#status !== 'playing' || from.length === 0) return false;
    const move = from.pop();
    for (const change of move) this.#cells[change.index] = change[side];
    to.push(move);
    this.#updateStatus();
    return true;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isValidSnapshot(saved, size) {
  return (
    Boolean(saved) &&
    saved.v === SNAPSHOT_VERSION &&
    typeof saved.cells === 'string' &&
    saved.cells.length === size &&
    /^[012]*$/.test(saved.cells) &&
    Number.isFinite(saved.elapsed) &&
    saved.elapsed >= 0 &&
    Number.isInteger(saved.mistakes) &&
    saved.mistakes >= 0 &&
    STATUSES.includes(saved.status)
  );
}
