import { BoardInput } from './board-input.js';
import { BoardView } from './board-view.js';
import { nextPictureId, puzzleTitle, randomPuzzleId, randomRecordId, sizeLabel } from './catalog.js';
import { CROSSED, EMPTY, FILLED } from './cells.js';
import { createDemoGame } from './demo.js';
import { translateTree } from './dom.js';
import { createGame } from './game.js';
import { formatTime, translate } from './i18n.js';
import { Picker } from './picker.js';
import * as progress from './progress.js';
import { PICTURES, getPuzzle } from './puzzles.js';

const TICK_MS = 250;
const AUTOSAVE_MS = 5000;
const TOAST_MS = 2600;
const CHECK_MARKS_MS = 2400;

/**
 * Starts the game on the page.
 * @param {Document} doc
 * @param {{demo: boolean}} options demo: show the fixed ?demo state and never read or write storage
 */
export function startApp(doc, { demo }) {
  new App(doc, demo).start();
}

/** Connects the game logic, the board, the controls and storage. */
class App {
  constructor(doc, demo) {
    this.doc = doc;
    this.demo = demo;
    this.settings = demo ? { lang: 'en', autoCheck: false } : progress.loadSettings();
    this.solved = demo ? {} : progress.loadSolved();
    this.ui = collectElements(doc);
    this.tool = 'fill';
    this.zoomed = false;
    this.canZoom = false;
    this.finished = false;
    this.record = false;
    this.unsaved = 0;
    this.toastMessage = null;
    this.timers = { toast: 0, check: 0, layout: 0 };
    this.coarse = window.matchMedia('(pointer: coarse)');
    this.view = new BoardView(this.ui.box);
    this.input = new BoardInput(this.view, {
      start: (row, col, tool) => this.strokeStart(row, col, tool),
      move: (row, col) => this.strokeMove(row, col),
      end: () => this.strokeEnd(),
      cancel: () => this.strokeCancel(),
      undo: () => this.undo(),
      redo: () => this.redo(),
      tool: () => this.tool,
      announce: (row, col) => this.announce(row, col),
    });
    this.picker = new Picker(this.ui.picker, {
      onPicture: (id) => this.openPuzzle(id),
      onRandom: (size) => this.openRandom(size),
    });
  }

  start() {
    this.bindControls();
    if (this.demo) this.setGame(createDemoGame());
    else this.openPuzzle(progress.loadCurrent() ?? nextPictureId(null, this.solved));
    this.ui.autoCheck.checked = this.settings.autoCheck;
    this.applyLanguage();
    if (!this.demo) this.startClock();
    window.addEventListener('resize', () => this.scheduleLayout());
    this.coarse.addEventListener('change', () => this.renderHint());
    this.doc.addEventListener('visibilitychange', () => {
      if (this.doc.hidden) this.save();
    });
    window.addEventListener('pagehide', () => this.save());
    this.scheduleLayout();
  }

  t(key, params) {
    return translate(this.settings.lang, key, params);
  }

  bindControls() {
    const { ui } = this;
    ui.newGame.addEventListener('click', () => this.openPicker());
    ui.restart.addEventListener('click', () => this.restart());
    ui.lang.addEventListener('click', () => this.toggleLanguage());
    for (const button of ui.toolButtons) button.addEventListener('click', () => this.setTool(button.dataset.tool));
    ui.undo.addEventListener('click', () => this.undo());
    ui.redo.addEventListener('click', () => this.redo());
    ui.check.addEventListener('click', () => this.check());
    ui.reveal.addEventListener('click', () => this.reveal());
    ui.zoom.addEventListener('click', () => this.toggleZoom());
    ui.autoCheck.addEventListener('change', () => this.setAutoCheck(ui.autoCheck.checked));
    ui.next.addEventListener('click', () => this.nextPuzzle());
    ui.allPuzzles.addEventListener('click', () => this.openPicker());
    ui.confirm.addEventListener('click', (e) => {
      if (e.target === ui.confirm) ui.confirm.close('cancel');
    });
    this.doc.addEventListener('keydown', (e) => this.onShortcut(e));
  }

  /** Ctrl/Cmd+Z undoes and Ctrl/Cmd+Shift+Z or Ctrl+Y redoes anywhere outside dialogs. */
  onShortcut(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || this.doc.querySelector('dialog[open]')) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) this.undo();
    else if ((key === 'z' && e.shiftKey) || key === 'y') this.redo();
    else return;
    e.preventDefault();
  }

  openPuzzle(id) {
    const puzzle = getPuzzle(id) ?? PICTURES[0];
    const snapshot = this.demo ? null : progress.loadProgress(puzzle.id);
    this.setGame(createGame({ puzzle, autoCheck: this.settings.autoCheck, snapshot }));
    if (!this.demo) progress.saveCurrent(puzzle.id);
  }

  openRandom(size) {
    const [seed] = crypto.getRandomValues(new Uint32Array(1));
    this.openPuzzle(randomPuzzleId(size, seed));
  }

  nextPuzzle() {
    const { puzzle } = this.game;
    if (puzzle.kind === 'random') this.openRandom(puzzle.width);
    else this.openPuzzle(nextPictureId(puzzle.id, this.solved));
  }

  setGame(game) {
    this.game = game;
    this.zoomed = false;
    this.record = false;
    this.finished = game.getState().status !== 'playing';
    this.unsaved = 0;
    this.view.build(game.puzzle);
    this.input.reset();
    this.layout();
    this.render();
    if (game.getState().status === 'won') this.view.celebrate(game.puzzle.colors, false);
  }

  openPicker() {
    this.picker.open({
      lang: this.settings.lang,
      solved: this.solved,
      currentId: this.game.puzzle.id,
      hasProgress: (id) => this.hasProgress(id),
    });
  }

  hasProgress(id) {
    if (this.demo) return false;
    const saved = progress.loadProgress(id);
    return saved?.status === 'playing' && /[12]/.test(saved.cells);
  }

  strokeStart(row, col, tool) {
    this.view.clearWrong();
    this.view.flashMistakes(this.game.startStroke(row, col, tool));
    this.view.update(this.game.getState());
  }

  strokeMove(row, col) {
    this.view.flashMistakes(this.game.moveStroke(row, col));
    this.view.update(this.game.getState());
  }

  strokeEnd() {
    if (this.game.endStroke()) this.afterChange();
  }

  strokeCancel() {
    this.game.cancelStroke();
    this.view.update(this.game.getState());
  }

  undo() {
    if (this.game.undo()) this.afterChange();
  }

  redo() {
    if (this.game.redo()) this.afterChange();
  }

  /** After a finished move: detects the win, redraws and saves. */
  afterChange() {
    if (!this.finished && this.game.getState().status === 'won') this.win();
    this.render();
    this.save();
  }

  /** Records the time (kept in memory too, so a blocked storage still unlocks the picture) and celebrates. */
  win() {
    this.finished = true;
    this.unzoom();
    const { puzzle } = this.game;
    const time = Math.round(this.game.getState().elapsed);
    const key = recordKey(puzzle);
    const previous = this.solved[key];
    this.record = previous !== undefined && time < previous;
    if (previous === undefined || this.record) this.solved = { ...this.solved, [key]: time };
    if (!this.demo) progress.recordSolved(key, time);
    this.view.celebrate(puzzle.colors, true);
    this.toast('solvedToast', { time: formatTime(time) });
  }

  check() {
    const wrong = this.game.check();
    this.view.markWrong(wrong);
    clearTimeout(this.timers.check);
    this.timers.check = setTimeout(() => this.view.clearWrong(), CHECK_MARKS_MS);
    if (wrong.length === 0) this.toast('checkOk');
    else this.toast(wrong.length === 1 ? 'checkWrongOne' : 'checkWrongMany', { n: wrong.length });
  }

  async reveal() {
    if (!(await this.confirm(this.t('confirmReveal'), this.t('reveal')))) return;
    if (!this.game.reveal()) return;
    this.finished = true;
    this.unzoom();
    this.view.clearWrong();
    this.render();
    this.save();
  }

  async restart() {
    const state = this.game.getState();
    const marked = state.cells.some((value) => value !== EMPTY);
    if (state.status === 'playing' && marked && !(await this.confirm(this.t('confirmRestart'), this.t('restart')))) return;
    this.game.restart();
    this.finished = false;
    this.record = false;
    this.view.clearWrong();
    this.render();
    this.save();
  }

  setTool(tool) {
    this.tool = tool === 'cross' ? 'cross' : 'fill';
    for (const button of this.ui.toolButtons) button.setAttribute('aria-pressed', String(button.dataset.tool === this.tool));
  }

  setAutoCheck(on) {
    this.settings.autoCheck = on;
    this.game.setAutoCheck(on);
    this.saveSettings();
    this.render();
  }

  toggleLanguage() {
    this.settings.lang = this.settings.lang === 'en' ? 'tr' : 'en';
    this.saveSettings();
    this.applyLanguage();
  }

  toggleZoom() {
    this.zoomed = !this.zoomed;
    this.layout();
  }

  /** A finished board is shown whole: the zoom control is hidden with the other tools by then. */
  unzoom() {
    if (!this.zoomed) return;
    this.zoomed = false;
    this.layout();
  }

  /** Translates the static page and redraws every text that depends on the language. */
  applyLanguage() {
    this.doc.documentElement.lang = this.settings.lang;
    translateTree(this.doc.body, (key) => this.t(key));
    // The last cell status was read out in the old language; the next move announces in the new one.
    this.ui.announcer.textContent = '';
    this.renderToast();
    this.renderZoom();
    this.render();
  }

  layout() {
    const { canZoom, zoomed } = this.view.layout(this.zoomed);
    this.canZoom = canZoom;
    this.zoomed = zoomed;
    this.renderZoom();
  }

  scheduleLayout() {
    if (this.timers.layout) return;
    this.timers.layout = requestAnimationFrame(() => {
      this.timers.layout = 0;
      this.layout();
    });
  }

  render() {
    const state = this.game.getState();
    const { ui, game } = this;
    const over = state.status !== 'playing';
    this.view.update(state);
    ui.undo.disabled = !state.canUndo;
    ui.redo.disabled = !state.canRedo;
    ui.tools.hidden = over;
    ui.hint.hidden = over;
    ui.result.hidden = !over;
    ui.title.textContent = puzzleTitle(game.puzzle, this.settings.lang, over || Object.hasOwn(this.solved, game.puzzle.id));
    ui.size.textContent = sizeLabel(game.puzzle);
    this.renderClock(state);
    if (over) this.renderResult(state);
  }

  renderClock(state) {
    const time = formatTime(state.elapsed);
    if (this.ui.timer.textContent !== time) this.ui.timer.textContent = time;
    this.ui.mistakes.textContent = String(state.mistakes);
    this.ui.mistakesStat.hidden = !(state.autoCheck || state.mistakes > 0);
  }

  renderResult(state) {
    const { ui, game } = this;
    const won = state.status === 'won';
    ui.resultTitle.textContent = this.t(won ? 'solvedTitle' : 'revealedTitle');
    ui.resultName.textContent = `${puzzleTitle(game.puzzle, this.settings.lang, true)} · ${sizeLabel(game.puzzle)}`;
    ui.resultRecord.hidden = !(won && this.record);
    if (!won) {
      ui.resultTime.textContent = this.t('revealedText');
      return;
    }
    const time = formatTime(state.elapsed);
    const key = recordKey(game.puzzle);
    const best = Object.hasOwn(this.solved, key) ? formatTime(this.solved[key]) : time;
    const parts = [this.t('resultTime', { time })];
    if (best !== time) parts.push(this.t('best', { time: best }));
    ui.resultTime.textContent = parts.join(' · ');
  }

  renderZoom() {
    const { ui } = this;
    ui.zoom.hidden = !this.canZoom;
    ui.zoom.setAttribute('aria-pressed', String(this.zoomed));
    ui.zoomLabel.textContent = this.t(this.zoomed ? 'zoomOut' : 'zoomIn');
    this.renderHint();
  }

  /** The play hint fits the input type, which can change on devices with both touch and a mouse. */
  renderHint() {
    const touch = this.coarse.matches;
    const hint = this.zoomed ? (touch ? 'hintZoomTouch' : 'hintZoomMouse') : touch ? 'hintTouch' : 'hintMouse';
    this.ui.hint.textContent = this.t(hint);
  }

  announce(row, col) {
    const value = this.game.cell(row, col);
    const state = value === FILLED ? 'stateFilled' : value === CROSSED ? 'stateCrossed' : 'stateEmpty';
    this.ui.announcer.textContent = this.t('cellStatus', { row: row + 1, col: col + 1, state: this.t(state) });
  }

  startClock() {
    let last = performance.now();
    setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      if (!this.doc.hidden) this.tickClock(delta);
    }, TICK_MS);
  }

  tickClock(delta) {
    this.game.tick(delta);
    const state = this.game.getState();
    this.renderClock(state);
    if (state.status !== 'playing' || state.elapsed === 0) return;
    this.unsaved += delta;
    if (this.unsaved >= AUTOSAVE_MS) this.save();
  }

  save() {
    if (this.demo || !this.game) return;
    this.unsaved = 0;
    progress.saveProgress(this.game.puzzle.id, this.game.snapshot());
  }

  saveSettings() {
    if (!this.demo) progress.saveSettings(this.settings);
  }

  /**
   * Shows a short message. It is kept as a key, so a language switch can translate it while it shows.
   * @param {string} key i18n key
   * @param {Record<string, string|number>} [params]
   */
  toast(key, params) {
    this.toastMessage = { key, params };
    this.renderToast();
    this.ui.toast.classList.add('show');
    clearTimeout(this.timers.toast);
    this.timers.toast = setTimeout(() => {
      this.toastMessage = null;
      this.ui.toast.classList.remove('show');
    }, TOAST_MS);
  }

  /** Writes the toast in the current language; a toast that has gone is emptied. */
  renderToast() {
    const message = this.toastMessage;
    this.ui.toast.textContent = message ? this.t(message.key, message.params) : '';
  }

  /** Asks a yes/no question in the confirm dialog. @returns {Promise<boolean>} */
  confirm(message, okLabel) {
    const { confirm, confirmText, confirmOk } = this.ui;
    confirmText.textContent = message;
    confirmOk.textContent = okLabel;
    confirm.returnValue = '';
    confirm.showModal();
    return new Promise((resolve) => {
      confirm.addEventListener('close', () => resolve(confirm.returnValue === 'ok'), { once: true });
    });
  }
}

/** Best times are kept per picture, and per size for random puzzles. */
function recordKey(puzzle) {
  return puzzle.kind === 'random' ? randomRecordId(puzzle.width) : puzzle.id;
}

function collectElements(doc) {
  const byId = (id) => doc.getElementById(id);
  return {
    newGame: byId('new-game'),
    restart: byId('restart'),
    lang: byId('lang'),
    title: byId('puzzle-title'),
    size: byId('puzzle-size'),
    timer: byId('timer'),
    mistakes: byId('mistakes'),
    mistakesStat: byId('mistakes-stat'),
    box: byId('board-box'),
    hint: byId('board-hint'),
    tools: byId('tools'),
    toolButtons: doc.querySelectorAll('[data-tool]'),
    undo: byId('undo'),
    redo: byId('redo'),
    check: byId('check'),
    reveal: byId('reveal'),
    zoom: byId('zoom'),
    zoomLabel: byId('zoom-label'),
    autoCheck: byId('auto-check'),
    result: byId('result'),
    resultTitle: byId('result-title'),
    resultName: byId('result-name'),
    resultTime: byId('result-time'),
    resultRecord: byId('result-record'),
    next: byId('next'),
    allPuzzles: byId('all-puzzles'),
    picker: byId('picker'),
    confirm: byId('confirm'),
    confirmText: byId('confirm-text'),
    confirmOk: byId('confirm-ok'),
    toast: byId('toast'),
    announcer: byId('announcer'),
  };
}
