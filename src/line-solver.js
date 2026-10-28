import { EMPTY, FILLED, CROSSED } from './cells.js';
import { normalizeClue } from './clues.js';

/**
 * Deduces every cell of one line that is forced by its clue and the cells already known.
 *
 * Dynamic programming over the clue: `head[i][j]` says whether the first i cells can hold the
 * first j blocks, `tail[i][j]` whether the cells from i on can hold blocks j and later.
 * Combining both tells, for every cell, whether some valid arrangement fills it and whether
 * some valid arrangement leaves it blank. Runs in O(length * blocks).
 *
 * @param {number[]} clue block lengths; [] and [0] both mean an empty line
 * @param {ArrayLike<number>} line known cells: EMPTY (unknown), FILLED or CROSSED (blank)
 * @returns {number[]|null} a new line with every forced cell set, or null if no arrangement fits
 */
export function solveLine(clue, line) {
  const blocks = normalizeClue(clue);
  const n = line.length;
  const crosses = prefixCount(line, CROSSED);
  const hasCross = (from, to) => crosses[to] - crosses[from] > 0;
  const head = fitPrefixes(blocks, line, hasCross);
  if (!head[n][blocks.length]) return null;
  const tail = fitSuffixes(blocks, line, hasCross);
  const fillable = fillableCells(blocks, line, hasCross, head, tail);
  const result = new Array(n);
  for (let i = 0; i < n; i++) {
    const canFill = fillable[i];
    const canBlank = line[i] !== FILLED && blankFits(i, head, tail, blocks.length);
    if (!canFill && !canBlank) return null;
    if (canFill && canBlank) result[i] = EMPTY;
    else result[i] = canFill ? FILLED : CROSSED;
  }
  return result;
}

/** counts[i] = how many of the first i cells equal `value`. */
function prefixCount(line, value) {
  const counts = new Int32Array(line.length + 1);
  for (let i = 0; i < line.length; i++) {
    counts[i + 1] = counts[i] + (line[i] === value ? 1 : 0);
  }
  return counts;
}

/** fit[i][j]: cells [0, i) can hold blocks 0..j-1 and nothing else. */
function fitPrefixes(blocks, line, hasCross) {
  const n = line.length;
  const k = blocks.length;
  const fit = Array.from({ length: n + 1 }, () => new Uint8Array(k + 1));
  fit[0][0] = 1;
  const blockEndsAt = (end, b) => {
    const start = end - blocks[b];
    if (start < 0 || hasCross(start, end)) return false;
    if (start === 0) return b === 0;
    return line[start - 1] !== FILLED && fit[start - 1][b] === 1;
  };
  for (let i = 1; i <= n; i++) {
    for (let j = 0; j <= k; j++) {
      const blankHere = line[i - 1] !== FILLED && fit[i - 1][j] === 1;
      fit[i][j] = blankHere || (j > 0 && blockEndsAt(i, j - 1)) ? 1 : 0;
    }
  }
  return fit;
}

/** fit[i][j]: cells [i, n) can hold blocks j..k-1 and nothing else. */
function fitSuffixes(blocks, line, hasCross) {
  const n = line.length;
  const k = blocks.length;
  const fit = Array.from({ length: n + 1 }, () => new Uint8Array(k + 1));
  fit[n][k] = 1;
  const blockStartsAt = (start, b) => {
    const end = start + blocks[b];
    if (end > n || hasCross(start, end)) return false;
    if (end === n) return b === k - 1;
    return line[end] !== FILLED && fit[end + 1][b + 1] === 1;
  };
  for (let i = n - 1; i >= 0; i--) {
    for (let j = k; j >= 0; j--) {
      const blankHere = line[i] !== FILLED && fit[i + 1][j] === 1;
      fit[i][j] = blankHere || (j < k && blockStartsAt(i, j)) ? 1 : 0;
    }
  }
  return fit;
}

/** A blank cell i is possible when some split puts blocks 0..j-1 left of it and j.. right of it. */
function blankFits(i, head, tail, k) {
  for (let j = 0; j <= k; j++) {
    if (head[i][j] && tail[i + 1][j]) return true;
  }
  return false;
}

/** Marks every cell covered by at least one valid placement of some block. */
function fillableCells(blocks, line, hasCross, head, tail) {
  const n = line.length;
  const k = blocks.length;
  const cover = new Int32Array(n + 1);
  const canPlace = (start, b) => {
    const end = start + blocks[b];
    if (hasCross(start, end)) return false;
    const leftOk = start === 0 ? b === 0 : line[start - 1] !== FILLED && head[start - 1][b] === 1;
    const rightOk = end === n ? b === k - 1 : line[end] !== FILLED && tail[end + 1][b + 1] === 1;
    return leftOk && rightOk;
  };
  blocks.forEach((length, b) => {
    for (let start = 0; start + length <= n; start++) {
      if (canPlace(start, b)) {
        cover[start] += 1;
        cover[start + length] -= 1;
      }
    }
  });
  const fillable = new Array(n);
  let running = 0;
  for (let i = 0; i < n; i++) {
    running += cover[i];
    fillable[i] = running > 0;
  }
  return fillable;
}
