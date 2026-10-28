import { computeClues } from './clues.js';
import { generatePuzzle } from './generator.js';
import { PALETTE, PICTURE_ART } from './picture-data.js';
import { createRng } from './rng.js';

/**
 * @typedef {object} Puzzle
 * @property {string} id stable id, e.g. "heart" or "random-10-1234"
 * @property {'picture'|'random'} kind
 * @property {{en: string, tr: string}|null} name picture name per language
 * @property {number|null} seed generator seed of a random puzzle
 * @property {number} width
 * @property {number} height
 * @property {number[][]} rows row clues
 * @property {number[][]} cols column clues
 * @property {number[][]} solution rows of 0/1 values
 * @property {(string|null)[][]|null} colors CSS colour per cell of a picture (null = blank)
 */

/** Grid sizes offered for random puzzles. */
export const RANDOM_SIZES = Object.freeze([5, 10, 15]);

/** Largest seed accepted in a random puzzle id (seeds are 32-bit). */
const MAX_SEED = 0xffffffff;

/**
 * Builds a puzzle (clues plus metadata) from a solution grid.
 * @param {{id: string, kind: 'picture'|'random', solution: number[][], name?: object|null,
 *   colors?: (string|null)[][]|null, seed?: number|null}} parts
 * @returns {Puzzle}
 */
export function makePuzzle({ id, kind, solution, name = null, colors = null, seed = null }) {
  const { rows, cols } = computeClues(solution);
  return { id, kind, name, seed, width: solution[0].length, height: solution.length, rows, cols, solution, colors };
}

/** Turns picture art (rows of palette letters, '.' = blank) into a puzzle with colours. */
function pictureFromArt({ id, name, art }) {
  const solution = art.map((row) => Array.from(row, (ch) => (ch === '.' ? 0 : 1)));
  const colors = art.map((row) => Array.from(row, (ch) => (ch === '.' ? null : PALETTE[ch])));
  return makePuzzle({ id, kind: 'picture', name, solution, colors });
}

/** All hand-made picture puzzles, smallest first. */
export const PICTURES = Object.freeze(PICTURE_ART.map(pictureFromArt));

/**
 * A fair random puzzle; the same size and seed always give the same puzzle.
 * @param {number} size width and height
 * @param {number} seed 32-bit integer
 * @returns {Puzzle}
 */
export function randomPuzzle(size, seed) {
  const { solution } = generatePuzzle({ width: size, rng: createRng(seed) });
  return makePuzzle({ id: `random-${size}-${seed}`, kind: 'random', solution, seed });
}

/**
 * Looks a puzzle up by id, e.g. "heart" or "random-10-1234".
 * @param {string} id
 * @returns {Puzzle|null} null for unknown or malformed ids
 */
export function getPuzzle(id) {
  const picture = PICTURES.find((puzzle) => puzzle.id === id);
  if (picture) return picture;
  const match = /^random-(\d{1,2})-(\d{1,10})$/.exec(String(id));
  if (!match) return null;
  const size = Number(match[1]);
  const seed = Number(match[2]);
  return RANDOM_SIZES.includes(size) && seed <= MAX_SEED ? randomPuzzle(size, seed) : null;
}
