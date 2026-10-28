import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFits, fitCellSize } from '../src/layout.js';

/** Clue areas that scale with the cell, with a minimum font like the real board. */
const clueAreas = (rowSlots, colSlots) => (cell) => {
  const font = Math.max(10, cell * 0.46);
  return { width: rowSlots * font * 1.3 + 12, height: colSlots * font * 1.2 + 14 };
};

const boardSize = (cell, options) => {
  const extra = options.measure(cell);
  return { width: extra.width + options.cols * cell, height: extra.height + options.rows * cell };
};

test('the fitted cell is the largest size that fits', () => {
  for (const [cols, availWidth, availHeight] of [[10, 323, 400], [15, 323, 400], [5, 760, 590], [15, 760, 590]]) {
    const options = { cols, rows: cols, availWidth, availHeight, min: 12, max: 56, measure: clueAreas(3, 4) };
    const cell = fitCellSize(options);
    const size = boardSize(cell, options);
    assert.ok(size.width <= availWidth && size.height <= availHeight, `${cols}: ${cell} overflows`);
    if (cell < options.max) {
      const bigger = boardSize(cell + 1, options);
      assert.ok(bigger.width > availWidth || bigger.height > availHeight, `${cols}: ${cell + 1} would fit too`);
    }
  }
});

test('the fitted cell stays within the limits', () => {
  const measure = clueAreas(2, 2);
  assert.equal(fitCellSize({ cols: 5, rows: 5, availWidth: 5000, availHeight: 5000, min: 12, max: 56, measure }), 56);
  assert.equal(fitCellSize({ cols: 15, rows: 15, availWidth: 100, availHeight: 100, min: 12, max: 56, measure }), 12);
});

test('height can be the limiting side', () => {
  const measure = () => ({ width: 0, height: 0 });
  assert.equal(fitCellSize({ cols: 10, rows: 10, availWidth: 1000, availHeight: 305, min: 10, max: 60, measure }), 30);
  assert.equal(fitCellSize({ cols: 10, rows: 10, availWidth: 305, availHeight: 1000, min: 10, max: 60, measure }), 30);
});

test('boardFits agrees with the fitted size and reports overflow at the minimum', () => {
  const options = { cols: 15, rows: 15, availWidth: 323, availHeight: 600, min: 14, max: 56, measure: clueAreas(8, 4) };
  const cell = fitCellSize(options);
  assert.equal(cell, 14);
  assert.equal(boardFits(options, 14), false, 'an 8-number row clue overflows at 14 px');
  const compact = { ...options, min: 12, max: 14, measure: clueAreas(5, 4) };
  const smaller = fitCellSize(compact);
  assert.ok(boardFits(compact, smaller), 'compact clues fit');
});
