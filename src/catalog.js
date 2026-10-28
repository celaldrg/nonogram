import { translate } from './i18n.js';
import { PICTURES } from './puzzles.js';

/**
 * Puzzle naming and ordering for the interface. Pure module (no DOM).
 */

/**
 * Display title of a puzzle. A picture's name stays hidden ("Picture 7") until it is known,
 * so the title never spoils the image.
 * @param {import('./puzzles.js').Puzzle} puzzle
 * @param {string} lang
 * @param {boolean} known the picture was solved before, or this game is over
 * @returns {string}
 */
export function puzzleTitle(puzzle, lang, known) {
  if (puzzle.kind === 'random') return translate(lang, 'randomTitle');
  if (known && puzzle.name) return puzzle.name[lang] ?? puzzle.name.en;
  return translate(lang, 'pictureTitle', { n: pictureNumber(puzzle.id) });
}

/**
 * @param {{width: number, height: number}} puzzle
 * @returns {string} e.g. "10×10"
 */
export function sizeLabel({ width, height }) {
  return `${width}×${height}`;
}

/**
 * 1-based position of a picture in the picker.
 * @param {string} id
 * @returns {number} 0 when the id is not a picture
 */
export function pictureNumber(id) {
  return PICTURES.findIndex((picture) => picture.id === id) + 1;
}

/**
 * The picture to offer after `currentId`: the next unsolved one in picker order (wrapping around),
 * or simply the next one when every picture is solved. A non-picture id starts from the first picture.
 * @param {string|null} currentId
 * @param {Record<string, number>} solved best times by puzzle id
 * @returns {string}
 */
export function nextPictureId(currentId, solved) {
  const start = PICTURES.findIndex((picture) => picture.id === currentId);
  for (let step = 1; step <= PICTURES.length; step++) {
    const candidate = PICTURES[(start + step) % PICTURES.length];
    if (!Object.hasOwn(solved, candidate.id)) return candidate.id;
  }
  return PICTURES[(start + 1) % PICTURES.length].id;
}

/**
 * Id of a random puzzle, understood by getPuzzle().
 * @param {number} size
 * @param {number} seed any number; reduced to an unsigned 32-bit integer
 * @returns {string}
 */
export function randomPuzzleId(size, seed) {
  return `random-${size}-${seed >>> 0}`;
}

/**
 * Key under which the best time of random puzzles of one size is stored.
 * @param {number} size
 * @returns {string}
 */
export function randomRecordId(size) {
  return `random-${size}`;
}
