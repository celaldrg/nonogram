/**
 * Board sizing math. Pure module: the DOM measuring is passed in as a function, so tests can fake it.
 */

/**
 * Largest whole-pixel cell size whose board fits the available space.
 * The clue areas grow with the cell size (their font scales with it), so `measure` reports the
 * space the board needs besides the cells for a candidate size. That space must not shrink when the
 * cell grows, which makes "fits" monotone and allows a binary search.
 * @param {object} options
 * @param {number} options.cols cells per row
 * @param {number} options.rows cells per column
 * @param {number} options.availWidth px
 * @param {number} options.availHeight px
 * @param {number} options.min smallest cell size; returned when even that does not fit
 * @param {number} options.max largest cell size
 * @param {(cell: number) => {width: number, height: number}} options.measure extra px next to and above the cells
 * @returns {number} cell size in px
 */
export function fitCellSize(options) {
  const { min, max } = options;
  const fits = (cell) => boardFits(options, cell);
  if (fits(max)) return max;
  if (!fits(min)) return min;
  let low = min;
  let high = max;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return low;
}

/**
 * Whether the board with a given cell size fits the available space.
 * @param {{cols: number, rows: number, availWidth: number, availHeight: number,
 *   measure: (cell: number) => {width: number, height: number}}} options as for fitCellSize
 * @param {number} cell cell size in px
 * @returns {boolean}
 */
export function boardFits({ cols, rows, availWidth, availHeight, measure }, cell) {
  const extra = measure(cell);
  return extra.width + cols * cell <= availWidth && extra.height + rows * cell <= availHeight;
}
