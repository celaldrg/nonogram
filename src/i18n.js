/**
 * Interface strings in English and Turkish plus small formatting helpers.
 * Pure module (no DOM access), so the tests can import it.
 */

/** Supported languages; the first one is the default. */
export const LANGUAGES = Object.freeze(['en', 'tr']);

const EN = {
  gameMenu: 'Game',
  newGame: 'New game',
  restart: 'Restart',
  langShort: 'TR',
  langSwitch: 'TR – switch to Turkish',
  controls: 'Controls',
  toolGroup: 'Tool',
  toolFill: 'Fill',
  toolCross: 'Cross',
  undo: 'Undo',
  redo: 'Redo',
  check: 'Check',
  reveal: 'Reveal',
  autoCheck: 'Mistake checking',
  autoCheckHint: 'Wrong fills turn into crosses',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  time: 'Time',
  mistakes: 'Mistakes',
  pictureTitle: 'Picture {n}',
  randomTitle: 'Random puzzle',
  gridLabel: 'Puzzle grid',
  cellStatus: 'Row {row}, column {col}: {state}',
  stateEmpty: 'empty',
  stateFilled: 'filled',
  stateCrossed: 'crossed',
  hintTouch: 'Tap to fill · long-press to cross · drag to paint a line',
  hintMouse: 'Click to fill · right-click to cross · drag to paint a line',
  hintZoomTouch: 'Zoomed in: move the grid with two fingers or by dragging the clues',
  hintZoomMouse: 'Zoomed in: scroll to move the grid',
  keysTitle: 'Keyboard',
  keyArrows: 'Arrows',
  keyArrowsDesc: 'move the cursor',
  keySpace: 'Space',
  keySpaceDesc: 'mark with the tool',
  keyFillCrossDesc: 'fill · cross',
  keyShift: 'Shift + arrows',
  keyShiftDesc: 'paint a line',
  keyUndoDesc: 'undo · redo',
  pickerTitle: 'Choose a puzzle',
  close: 'Close',
  randomHeading: 'Random puzzles',
  randomText: 'A fresh grid every time, always solvable by logic alone.',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  picturesHeading: 'Pictures',
  solvedCount: '{solved} of {total} solved',
  notSolved: 'Not solved yet',
  inProgress: 'In progress',
  best: 'Best {time}',
  playingNow: 'Playing now',
  solvedTitle: 'Solved!',
  solvedToast: 'Solved in {time}!',
  resultTime: 'Time {time}',
  newRecord: 'New best time!',
  revealedTitle: 'Solution revealed',
  revealedText: 'Press Restart to try again, or pick another puzzle.',
  nextPuzzle: 'Next puzzle',
  allPuzzles: 'All puzzles',
  confirmReveal: 'Show the solution? This ends the puzzle.',
  confirmRestart: 'Clear the board and start this puzzle again?',
  cancel: 'Cancel',
  checkOk: 'No mistakes so far',
  checkWrongOne: '1 wrong mark highlighted',
  checkWrongMany: '{n} wrong marks highlighted',
  source: 'Source on GitHub',
};

const TR = {
  gameMenu: 'Oyun',
  newGame: 'Yeni oyun',
  restart: 'Sıfırla',
  langShort: 'EN',
  langSwitch: 'EN – İngilizceye geç',
  controls: 'Kontroller',
  toolGroup: 'Araç',
  toolFill: 'Boya',
  toolCross: 'Çarpı',
  undo: 'Geri al',
  redo: 'Yinele',
  check: 'Denetle',
  reveal: 'Çözümü aç',
  autoCheck: 'Hata denetimi',
  autoCheckHint: 'Yanlış boyamalar çarpıya döner',
  zoomIn: 'Yakınlaştır',
  zoomOut: 'Uzaklaştır',
  time: 'Süre',
  mistakes: 'Hatalar',
  pictureTitle: 'Resim {n}',
  randomTitle: 'Rastgele bulmaca',
  gridLabel: 'Bulmaca ızgarası',
  cellStatus: 'Satır {row}, sütun {col}: {state}',
  stateEmpty: 'boş',
  stateFilled: 'boyalı',
  stateCrossed: 'çarpılı',
  hintTouch: 'Boyamak için dokun · çarpı için basılı tut · sıra boyamak için sürükle',
  hintMouse: 'Boyamak için tıkla · çarpı için sağ tıkla · sıra boyamak için sürükle',
  hintZoomTouch: 'Yakın görünüm: ızgarayı iki parmakla ya da ipuçlarından sürükleyerek kaydır',
  hintZoomMouse: 'Yakın görünüm: ızgarayı kaydırarak gez',
  keysTitle: 'Klavye',
  keyArrows: 'Oklar',
  keyArrowsDesc: 'imleci taşı',
  keySpace: 'Boşluk',
  keySpaceDesc: 'seçili araçla işaretle',
  keyFillCrossDesc: 'boya · çarpı',
  keyShift: 'Shift + oklar',
  keyShiftDesc: 'sıra boya',
  keyUndoDesc: 'geri al · yinele',
  pickerTitle: 'Bulmaca seç',
  close: 'Kapat',
  randomHeading: 'Rastgele bulmacalar',
  randomText: 'Her seferinde yeni bir ızgara; her zaman yalnızca mantıkla çözülür.',
  easy: 'Kolay',
  medium: 'Orta',
  hard: 'Zor',
  picturesHeading: 'Resimler',
  solvedCount: '{total} resimden {solved} tanesi çözüldü',
  notSolved: 'Henüz çözülmedi',
  inProgress: 'Devam ediyor',
  best: 'En iyi {time}',
  playingNow: 'Şu an açık',
  solvedTitle: 'Çözüldü!',
  solvedToast: '{time} sürede çözüldü!',
  resultTime: 'Süre {time}',
  newRecord: 'Yeni rekor!',
  revealedTitle: 'Çözüm açıldı',
  revealedText: 'Yeniden denemek için Sıfırla’ya bas ya da başka bir bulmaca seç.',
  nextPuzzle: 'Sonraki bulmaca',
  allPuzzles: 'Tüm bulmacalar',
  confirmReveal: 'Çözüm gösterilsin mi? Bulmaca burada biter.',
  confirmRestart: 'Tahta temizlenip bu bulmacaya baştan başlansın mı?',
  cancel: 'Vazgeç',
  checkOk: 'Şimdilik hata yok',
  checkWrongOne: '1 yanlış işaret gösterildi',
  checkWrongMany: '{n} yanlış işaret gösterildi',
  source: 'Kaynak kodu GitHub’da',
};

/** All strings per language; both tables have the same keys (tested). */
export const STRINGS = Object.freeze({ en: Object.freeze(EN), tr: Object.freeze(TR) });

/**
 * Looks up a string and fills its {placeholders}.
 * Unknown languages fall back to English, unknown keys to the key itself.
 * @param {string} lang 'en' or 'tr'
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
export function translate(lang, key, params = {}) {
  const table = Object.hasOwn(STRINGS, lang) ? STRINGS[lang] : STRINGS.en;
  const text = table[key] ?? STRINGS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(params, name) ? String(params[name]) : match));
}

/**
 * Formats a play time as m:ss, or h:mm:ss from one hour on.
 * @param {number} ms
 * @returns {string}
 */
export function formatTime(ms) {
  const total = Math.floor((Number.isFinite(ms) && ms > 0 ? ms : 0) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}
