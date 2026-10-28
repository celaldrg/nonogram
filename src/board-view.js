import { CROSSED, FILLED } from './cells.js';
import { el } from './dom.js';
import { fitCellSize } from './layout.js';

/** Cell size limits (px) when the board is fitted to the screen. */
const MIN_CELL = 14;
const MAX_CELL = 56;
/** Cell size when zoomed in: a comfortable finger target. */
const ZOOM_CELL = 40;
/** Zoom is offered while fitted cells are smaller than this. */
const ZOOM_OFFER_BELOW = 36;
/** Delay between the diagonals of the win wave. */
const WAVE_STEP_MS = 28;
/** Height kept free under the board: hint and footer on wide screens, the tools on narrow ones. */
const RESERVE_WIDE = 104;
const RESERVE_NARROW = 150;
const MIN_BOX_HEIGHT = 240;
/** Border width (px) around the cell area; the clue lanes are offset by it in CSS too. */
const CELLS_BORDER = 2;
const FLASH_MS = 700;

/**
 * The puzzle board in the DOM: clue lanes plus a grid of cells, all sized by the --cell variable.
 * The structure (box > board > top/body > clue lanes and cells) comes from index.html.
 */
export class BoardView {
  /** @param {HTMLElement} box scroll container that holds the .board */
  constructor(box) {
    this.box = box;
    this.board = box.querySelector('.board');
    this.top = box.querySelector('.board-top');
    this.colClues = box.querySelector('.col-clues');
    this.rowClues = box.querySelector('.row-clues');
    this.cells = box.querySelector('.cells');
    this.rowBand = el('div', { className: 'band band-row' });
    this.colBand = el('div', { className: 'band band-col' });
    this.cursor = el('div', { className: 'cursor' });
    this.wide = window.matchMedia('(min-width: 900px)');
    this.cols = 0;
    this.rows = 0;
    this.cellNodes = [];
    this.rowClueNodes = [];
    this.colClueNodes = [];
    this.rendered = [];
    this.wrong = [];
    this.lit = null;
  }

  /**
   * Creates clue lanes and cells for a puzzle.
   * @param {import('./puzzles.js').Puzzle} puzzle
   */
  build(puzzle) {
    const { width, height } = puzzle;
    this.cols = width;
    this.rows = height;
    this.board.style.setProperty('--cols', String(width));
    this.board.style.setProperty('--rows', String(height));
    this.board.classList.remove('won', 'animate', 'revealed');
    this.colClueNodes = puzzle.cols.map((clue) => clueNode('clue clue-col', clue));
    this.rowClueNodes = puzzle.rows.map((clue) => clueNode('clue clue-row', clue));
    this.colClues.replaceChildren(...this.colClueNodes);
    this.rowClues.replaceChildren(...this.rowClueNodes);
    this.cellNodes = Array.from({ length: width * height }, (_, i) => cellNode(Math.floor(i / width), i % width, width, height));
    this.cells.replaceChildren(this.rowBand, this.colBand, ...this.cellNodes, this.cursor);
    this.rendered = new Array(width * height).fill(-1);
    this.wrong = [];
    this.lit = null;
    this.box.scrollTo(0, 0);
  }

  /**
   * Sizes the board: fitted to the free space, or with large cells inside a scrollable box.
   * @param {boolean} zoomed the player asked for large cells
   * @returns {{canZoom: boolean, zoomed: boolean}} whether zooming helps, and whether it is on
   */
  layout(zoomed) {
    this.box.classList.remove('zoomed');
    this.box.style.maxHeight = '';
    this.#setCell(MIN_CELL);
    const space = this.#freeSpace();
    const fitted = fitCellSize({
      cols: this.cols,
      rows: this.rows,
      availWidth: space.width,
      availHeight: space.height,
      min: MIN_CELL,
      max: MAX_CELL,
      measure: (cell) => this.#measure(cell),
    });
    const canZoom = fitted < ZOOM_OFFER_BELOW;
    const zoom = zoomed && canZoom;
    // The zoomed board uses a smaller clue font, so the class goes on before the clue lane is measured.
    this.box.classList.toggle('zoomed', zoom);
    this.#setCell(zoom ? ZOOM_CELL : fitted);
    this.board.style.setProperty('--rcw', `${this.rowClues.offsetWidth}px`);
    if (zoom) this.box.style.maxHeight = `${space.height}px`;
    return { canZoom, zoomed: zoom };
  }

  /**
   * Shows a game state; only cells whose mark changed are touched.
   * @param {import('./game.js').GameState} state
   */
  update(state) {
    state.cells.forEach((value, i) => {
      if (this.rendered[i] === value) return;
      this.rendered[i] = value;
      this.cellNodes[i].classList.toggle('filled', value === FILLED);
      this.cellNodes[i].classList.toggle('crossed', value === CROSSED);
    });
    state.rowsDone.forEach((done, r) => this.rowClueNodes[r].classList.toggle('done', done));
    state.colsDone.forEach((done, c) => this.colClueNodes[c].classList.toggle('done', done));
    this.board.classList.toggle('revealed', state.status === 'revealed');
    if (state.status !== 'won') this.board.classList.remove('won', 'animate');
  }

  /**
   * Cell under a viewport point.
   * @param {number} x clientX
   * @param {number} y clientY
   * @param {boolean} [clampToGrid=false] snap points outside the grid to the nearest cell
   * @returns {{row: number, col: number}|null}
   */
  cellAt(x, y, clampToGrid = false) {
    const rect = this.cells.getBoundingClientRect();
    const size = (rect.width - 2 * CELLS_BORDER) / this.cols;
    const col = Math.floor((x - rect.left - CELLS_BORDER) / size);
    const row = Math.floor((y - rect.top - CELLS_BORDER) / size);
    if (clampToGrid) return { row: clamp(row, 0, this.rows - 1), col: clamp(col, 0, this.cols - 1) };
    return row >= 0 && col >= 0 && row < this.rows && col < this.cols ? { row, col } : null;
  }

  /**
   * Highlights a row and a column with their clues; null removes the highlight.
   * @param {{row: number, col: number}|null} cell
   */
  highlight(cell) {
    if (cell?.row === this.lit?.row && cell?.col === this.lit?.col) return;
    this.rowClueNodes[this.lit?.row]?.classList.remove('hl');
    this.colClueNodes[this.lit?.col]?.classList.remove('hl');
    this.lit = cell ? { row: cell.row, col: cell.col } : null;
    this.cells.classList.toggle('hover', Boolean(cell));
    if (!cell) return;
    this.rowClueNodes[cell.row].classList.add('hl');
    this.colClueNodes[cell.col].classList.add('hl');
    this.cells.style.setProperty('--hr', String(cell.row));
    this.cells.style.setProperty('--hc', String(cell.col));
  }

  /**
   * Places the keyboard cursor and, when zoomed, scrolls it out from under the clue lanes.
   * @param {{row: number, col: number}} cell
   */
  placeCursor({ row, col }) {
    this.cells.style.setProperty('--kr', String(row));
    this.cells.style.setProperty('--kc', String(col));
    if (!this.box.classList.contains('zoomed')) return;
    const box = this.box.getBoundingClientRect();
    const left = this.rowClues.getBoundingClientRect().right;
    const top = this.top.getBoundingClientRect().bottom;
    const target = this.cellNodes[row * this.cols + col].getBoundingClientRect();
    if (target.left < left) this.box.scrollLeft -= left - target.left;
    else if (target.right > box.right) this.box.scrollLeft += target.right - box.right;
    if (target.top < top) this.box.scrollTop -= top - target.top;
    else if (target.bottom > box.bottom) this.box.scrollTop += target.bottom - box.bottom;
  }

  /** @param {boolean} on show the keyboard cursor */
  setKeyboardMode(on) {
    this.cells.classList.toggle('kbd', on);
  }

  /**
   * Briefly flashes cells that mistake checking turned into crosses.
   * @param {import('./game.js').CellChange[]} changes
   */
  flashMistakes(changes) {
    for (const { index, mistake } of changes) {
      if (!mistake) continue;
      const node = this.cellNodes[index];
      node.classList.remove('mistake');
      void node.offsetWidth; // restart the animation when the same cell flashes again
      node.classList.add('mistake');
      setTimeout(() => node.classList.remove('mistake'), FLASH_MS);
    }
  }

  /** @param {number[]} indices cells to mark as wrong after a check */
  markWrong(indices) {
    this.clearWrong();
    this.wrong = indices;
    for (const index of indices) this.cellNodes[index].classList.add('wrong');
  }

  /** Removes the marks of the last check. */
  clearWrong() {
    for (const index of this.wrong) this.cellNodes[index]?.classList.remove('wrong');
    this.wrong = [];
  }

  /**
   * Paints the solved picture: filled cells take their picture colour in a diagonal wave.
   * @param {(string|null)[][]|null} colors picture colours; null keeps the accent colour
   * @param {boolean} animate play the wave and the pop
   */
  celebrate(colors, animate) {
    this.cellNodes.forEach((node, i) => {
      const row = Math.floor(i / this.cols);
      const col = i % this.cols;
      const color = colors?.[row]?.[col];
      if (color) node.style.setProperty('--paint', color);
      else node.style.removeProperty('--paint');
      node.style.setProperty('--delay', `${animate ? (row + col) * WAVE_STEP_MS : 0}ms`);
    });
    this.highlight(null);
    this.board.classList.toggle('animate', animate);
    this.board.classList.add('won');
  }

  #setCell(cell) {
    this.board.style.setProperty('--cell', `${cell}px`);
  }

  /** Space the board needs besides its cells when cells are `cell` px. */
  #measure(cell) {
    this.#setCell(cell);
    return {
      width: this.rowClues.offsetWidth + 2 * CELLS_BORDER,
      height: this.top.offsetHeight + 2 * CELLS_BORDER,
    };
  }

  /** Width of the box and the height left on screen below its top edge. */
  #freeSpace() {
    const width = this.#widthBesideScrollbar();
    const top = this.box.getBoundingClientRect().top + window.scrollY;
    const reserve = this.wide.matches ? RESERVE_WIDE : RESERVE_NARROW;
    return { width, height: Math.max(MIN_BOX_HEIGHT, window.innerHeight - top - reserve) };
  }

  /**
   * Content width of the box while the page shows a vertical scrollbar. The small boards used for
   * measuring can hide that scrollbar, and the fitted board must still fit once the page is tall again.
   */
  #widthBesideScrollbar() {
    const root = document.documentElement;
    root.style.overflowY = 'scroll';
    const style = getComputedStyle(this.box);
    const width = this.box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    root.style.overflowY = '';
    return width;
  }
}

/** A clue lane; an empty line shows a single 0. */
function clueNode(className, clue) {
  const numbers = clue.length > 0 ? clue : [0];
  return el('div', { className }, numbers.map((n) => el('span', { text: String(n) })));
}

/** A cell with the classes for thicker lines between blocks of five and no line on the outer edge. */
function cellNode(row, col, width, height) {
  const node = el('div', { className: 'cell' });
  if (col === width - 1) node.classList.add('end-r');
  else if (col % 5 === 4) node.classList.add('sep-r');
  if (row === height - 1) node.classList.add('end-b');
  else if (row % 5 === 4) node.classList.add('sep-b');
  return node;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
