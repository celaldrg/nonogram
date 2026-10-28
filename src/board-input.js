/** A touch held this long without moving turns into a cross. */
const LONG_PRESS_MS = 450;
/** Pointer travel (px) before a press counts as a drag, so finger jitter does not paint a neighbour. */
const DRAG_SLOP = Object.freeze({ mouse: 2, pen: 5, touch: 8 });
const STEPS = Object.freeze({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] });

/**
 * @typedef {object} BoardActions
 * @property {(row: number, col: number, tool: 'fill'|'cross') => void} start begin a stroke
 * @property {(row: number, col: number) => void} move extend the stroke
 * @property {() => void} end finish the stroke as one move
 * @property {() => void} cancel drop the stroke without a trace
 * @property {() => void} undo
 * @property {() => void} redo
 * @property {() => 'fill'|'cross'} tool the selected tool
 * @property {(row: number, col: number) => void} announce tell screen readers about a cell
 */

/**
 * Turns pointer and keyboard input on the board into strokes.
 * Mouse: left button uses the tool, right button crosses. Touch: tap or drag uses the tool,
 * a long-press crosses, two fingers pan a zoomed board. Keyboard: see the keys in index.html.
 */
export class BoardInput {
  #pointers = new Map();
  #stroke = null;
  #pan = null;
  #longPress = 0;
  #cursor = { row: 0, col: 0 };
  #keyStroke = false;
  #pointerFocus = false;

  /**
   * @param {import('./board-view.js').BoardView} view
   * @param {BoardActions} actions
   */
  constructor(view, actions) {
    this.view = view;
    this.actions = actions;
    const cells = view.cells;
    cells.addEventListener('pointerdown', (e) => this.#down(e));
    cells.addEventListener('pointermove', (e) => this.#move(e));
    cells.addEventListener('pointerup', (e) => this.#up(e));
    cells.addEventListener('pointercancel', (e) => this.#up(e));
    cells.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !this.#stroke) view.highlight(null);
    });
    cells.addEventListener('contextmenu', (e) => e.preventDefault());
    cells.addEventListener('keydown', (e) => this.#key(e));
    cells.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') this.#endKeyStroke();
    });
    cells.addEventListener('focus', () => {
      if (!this.#pointerFocus) this.#showCursor();
      this.#pointerFocus = false;
    });
    cells.addEventListener('blur', () => {
      this.#endKeyStroke();
      view.setKeyboardMode(false);
      view.highlight(null);
    });
  }

  /** Forgets strokes and moves the cursor home; called when a new board is built. */
  reset() {
    this.#clearLongPress();
    this.#stroke = null;
    this.#pan = null;
    this.#pointers.clear();
    this.#keyStroke = false;
    this.#cursor = { row: 0, col: 0 };
    this.view.placeCursor(this.#cursor);
  }

  #down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    this.#pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.view.cells.setPointerCapture(e.pointerId);
    if (this.#pointers.size > 1) {
      this.#startPan();
      return;
    }
    const cell = this.view.cellAt(e.clientX, e.clientY);
    if (!cell) return;
    e.preventDefault();
    this.#focusFromPointer();
    const tool = e.button === 2 ? 'cross' : this.actions.tool();
    this.#stroke = { id: e.pointerId, type: e.pointerType, cell, x: e.clientX, y: e.clientY, dragging: false };
    this.#cursor = cell;
    this.view.placeCursor(cell);
    this.view.highlight(cell);
    this.actions.start(cell.row, cell.col, tool);
    if (e.pointerType !== 'mouse' && tool === 'fill') this.#armLongPress(cell);
  }

  #move(e) {
    const pointer = this.#pointers.get(e.pointerId);
    if (pointer) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    }
    if (this.#pan) {
      this.#panBy();
      return;
    }
    const stroke = this.#stroke;
    if (!stroke || stroke.id !== e.pointerId) {
      if (e.pointerType === 'mouse' && !stroke) this.view.highlight(this.view.cellAt(e.clientX, e.clientY));
      return;
    }
    if (!stroke.dragging) {
      const slop = DRAG_SLOP[stroke.type] ?? DRAG_SLOP.mouse;
      if (Math.hypot(e.clientX - stroke.x, e.clientY - stroke.y) < slop) return;
      stroke.dragging = true;
    }
    const cell = this.view.cellAt(e.clientX, e.clientY, true);
    if (cell.row === stroke.cell.row && cell.col === stroke.cell.col) return;
    stroke.cell = cell;
    this.#clearLongPress();
    this.view.highlight(cell);
    this.actions.move(cell.row, cell.col);
  }

  #up(e) {
    this.#pointers.delete(e.pointerId);
    if (this.#pan) {
      this.#pan = this.#pointers.size > 0 ? this.#midpoint() : null;
      return;
    }
    if (this.#stroke?.id !== e.pointerId) return;
    const { type } = this.#stroke;
    this.#stroke = null;
    this.#clearLongPress();
    this.actions.end();
    if (type !== 'mouse') this.view.highlight(null);
  }

  /** A second finger: drop the stroke the first one started and move the board instead. */
  #startPan() {
    if (this.#stroke) {
      this.#stroke = null;
      this.#clearLongPress();
      this.actions.cancel();
    }
    this.view.highlight(null);
    this.#pan = this.#midpoint();
  }

  #panBy() {
    const mid = this.#midpoint();
    this.view.box.scrollLeft -= mid.x - this.#pan.x;
    this.view.box.scrollTop -= mid.y - this.#pan.y;
    this.#pan = mid;
  }

  #midpoint() {
    let x = 0;
    let y = 0;
    for (const point of this.#pointers.values()) {
      x += point.x;
      y += point.y;
    }
    return { x: x / this.#pointers.size, y: y / this.#pointers.size };
  }

  #armLongPress(cell) {
    this.#clearLongPress();
    this.#longPress = setTimeout(() => {
      this.#longPress = 0;
      if (!this.#stroke) return;
      this.actions.cancel();
      this.actions.start(cell.row, cell.col, 'cross');
    }, LONG_PRESS_MS);
  }

  #clearLongPress() {
    clearTimeout(this.#longPress);
    this.#longPress = 0;
  }

  /** Focuses the board for keyboard use without showing the keyboard cursor. */
  #focusFromPointer() {
    this.view.setKeyboardMode(false);
    if (document.activeElement === this.view.cells) return;
    this.#pointerFocus = true;
    this.view.cells.focus({ preventScroll: true });
  }

  #key(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const step = STEPS[e.key];
    if (step) {
      e.preventDefault();
      this.#step(step, e.shiftKey);
      return;
    }
    const key = e.key.toLowerCase();
    if (key === ' ' || key === 'enter') {
      if (!e.repeat) this.#mark(this.actions.tool());
    } else if (key === 'f') this.#mark('fill');
    else if (key === 'x') this.#mark('cross');
    else if (key === 'z') this.actions.undo();
    else if (key === 'y') this.actions.redo();
    else return;
    e.preventDefault();
  }

  /** Moves the cursor; with Shift held, the move paints a line like a drag. */
  #step([dRow, dCol], painting) {
    if (painting && !this.#keyStroke) {
      this.#keyStroke = true;
      this.actions.start(this.#cursor.row, this.#cursor.col, this.actions.tool());
    } else if (!painting) {
      this.#endKeyStroke();
    }
    this.#cursor = {
      row: Math.min(this.view.rows - 1, Math.max(0, this.#cursor.row + dRow)),
      col: Math.min(this.view.cols - 1, Math.max(0, this.#cursor.col + dCol)),
    };
    if (this.#keyStroke) this.actions.move(this.#cursor.row, this.#cursor.col);
    this.#showCursor();
  }

  #mark(tool) {
    this.#endKeyStroke();
    this.actions.start(this.#cursor.row, this.#cursor.col, tool);
    this.actions.end();
    this.#showCursor();
  }

  #endKeyStroke() {
    if (!this.#keyStroke) return;
    this.#keyStroke = false;
    this.actions.end();
  }

  #showCursor() {
    this.view.setKeyboardMode(true);
    this.view.placeCursor(this.#cursor);
    this.view.highlight(this.#cursor);
    this.actions.announce(this.#cursor.row, this.#cursor.col);
  }
}
