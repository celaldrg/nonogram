import { puzzleTitle, randomRecordId, sizeLabel } from './catalog.js';
import { el } from './dom.js';
import { formatTime, translate } from './i18n.js';
import { PICTURES, RANDOM_SIZES } from './puzzles.js';

/** Thumbnail edge length in CSS px (see .thumb in style.css). */
const THUMB_PX = 56;
const LEVELS = Object.freeze({ 5: 'easy', 10: 'medium', 15: 'hard' });

/**
 * @typedef {object} PickerContext
 * @property {string} lang
 * @property {Record<string, number>} solved best times by puzzle id (and by random size)
 * @property {string} currentId puzzle that is open now
 * @property {(id: string) => boolean} hasProgress the picture has unfinished saved progress
 */

/**
 * The "New game" dialog: random puzzles by size and the picture collection.
 * A picture's thumbnail and name stay hidden until it is solved.
 */
export class Picker {
  /**
   * @param {HTMLDialogElement} dialog
   * @param {{onPicture: (id: string) => void, onRandom: (size: number) => void}} handlers
   */
  constructor(dialog, handlers) {
    this.dialog = dialog;
    this.handlers = handlers;
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  }

  /**
   * Builds the dialog content for the current state and opens it.
   * @param {PickerContext} context
   */
  open(context) {
    const t = (key, params) => translate(context.lang, key, params);
    const close = el('button', { className: 'icon-btn', text: '×', attrs: { type: 'button', 'aria-label': t('close') } });
    close.addEventListener('click', () => this.dialog.close());
    const head = el('div', { className: 'dialog-head' }, [
      el('h2', { text: t('pickerTitle'), attrs: { id: 'picker-title' } }),
      close,
    ]);
    this.dialog.replaceChildren(
      el('div', { className: 'dialog-inner picker-inner' }, [head, this.#randomSection(context, t), this.#pictureSection(context, t)]),
    );
    this.dialog.showModal();
    this.dialog.querySelector('.tile.current')?.focus();
  }

  #randomSection(context, t) {
    const buttons = RANDOM_SIZES.map((size) => {
      const best = context.solved[randomRecordId(size)];
      const parts = [
        el('span', { className: 'size-num', text: sizeLabel({ width: size, height: size }) }),
        el('span', { className: 'size-level', text: t(LEVELS[size]) }),
      ];
      if (best !== undefined) parts.push(el('span', { className: 'size-best', text: t('best', { time: formatTime(best) }) }));
      const button = el('button', { className: 'size-btn', attrs: { type: 'button' } }, parts);
      button.addEventListener('click', () => this.#choose(() => this.handlers.onRandom(size)));
      return button;
    });
    return el('section', { className: 'picker-section' }, [
      el('h3', { text: t('randomHeading') }),
      el('p', { className: 'muted', text: t('randomText') }),
      el('div', { className: 'sizes' }, buttons),
    ]);
  }

  #pictureSection(context, t) {
    const solvedCount = PICTURES.filter((p) => Object.hasOwn(context.solved, p.id)).length;
    return el('section', { className: 'picker-section' }, [
      el('div', { className: 'section-head' }, [
        el('h3', { text: t('picturesHeading') }),
        el('span', { className: 'muted', text: t('solvedCount', { solved: solvedCount, total: PICTURES.length }) }),
      ]),
      el('div', { className: 'tiles' }, PICTURES.map((puzzle) => this.#tile(puzzle, context, t))),
    ]);
  }

  #tile(puzzle, context, t) {
    const solved = Object.hasOwn(context.solved, puzzle.id);
    const current = puzzle.id === context.currentId;
    let status = t('notSolved');
    if (solved) status = t('best', { time: formatTime(context.solved[puzzle.id]) });
    else if (current) status = t('playingNow');
    else if (context.hasProgress(puzzle.id)) status = t('inProgress');
    const thumb = el('canvas', { className: 'thumb', attrs: { 'aria-hidden': 'true' } });
    drawThumb(thumb, puzzle, solved);
    const tile = el('button', { className: 'tile', attrs: { type: 'button' } }, [
      thumb,
      el('span', { className: 'tile-name', text: puzzleTitle(puzzle, context.lang, solved) }),
      el('span', { className: 'tile-meta', text: `${sizeLabel(puzzle)} · ${status}` }),
    ]);
    tile.classList.toggle('solved', solved);
    tile.classList.toggle('current', current);
    if (current) tile.setAttribute('aria-current', 'true');
    tile.addEventListener('click', () => this.#choose(() => this.handlers.onPicture(puzzle.id)));
    return tile;
  }

  #choose(action) {
    this.dialog.close();
    action();
  }
}

/**
 * Draws a thumbnail in whole device pixels so the pixel art stays crisp:
 * the coloured picture once solved, otherwise an empty grid with a question mark.
 */
function drawThumb(canvas, puzzle, solved) {
  const ratio = Math.min(3, window.devicePixelRatio || 1);
  const size = Math.round(THUMB_PX * ratio);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cell = Math.floor(size / puzzle.width);
  const offset = Math.floor((size - cell * puzzle.width) / 2);
  const tokens = getComputedStyle(document.documentElement);
  if (solved) {
    puzzle.colors.forEach((row, r) =>
      row.forEach((color, c) => {
        if (!color) return;
        ctx.fillStyle = color;
        ctx.fillRect(offset + c * cell, offset + r * cell, cell, cell);
      }),
    );
    return;
  }
  ctx.fillStyle = tokens.getPropertyValue('--line').trim();
  for (let i = 1; i < puzzle.width; i++) {
    ctx.fillRect(offset + i * cell, offset, 1, cell * puzzle.width);
    ctx.fillRect(offset, offset + i * cell, cell * puzzle.width, 1);
  }
  ctx.fillStyle = tokens.getPropertyValue('--muted').trim();
  ctx.font = `700 ${Math.round(size * 0.42)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', size / 2, size / 2 + ratio);
}
