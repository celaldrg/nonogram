import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY, FILLED, CROSSED } from '../src/cells.js';
import { createGame } from '../src/game.js';
import { makePuzzle } from '../src/puzzles.js';

const U = EMPTY;
const F = FILLED;
const X = CROSSED;

/** 3x3 plus sign: rows [1] [3] [1], columns [1] [3] [1]. */
const plus = makePuzzle({ id: 'plus', kind: 'picture', solution: [[0, 1, 0], [1, 1, 1], [0, 1, 0]] });
/** 2x2 diagonal: its clues also fit the other diagonal. */
const diagonal = makePuzzle({ id: 'diag', kind: 'picture', solution: [[1, 0], [0, 1]] });

const cells = (game) => game.getState().cells;

function solvePlus(game) {
  game.toggle(0, 1);
  game.startStroke(1, 0);
  game.moveStroke(1, 2);
  game.endStroke();
  return game.toggle(2, 1);
}

test('a new game starts empty and playing', () => {
  const state = createGame({ puzzle: plus }).getState();
  assert.deepEqual(state.cells, new Array(9).fill(U));
  assert.equal(state.status, 'playing');
  assert.equal(state.elapsed, 0);
  assert.equal(state.mistakes, 0);
  assert.equal(state.canUndo, false);
  assert.equal(state.canRedo, false);
});

test('tapping fills, tapping again erases, the cross tool crosses', () => {
  const game = createGame({ puzzle: plus });
  game.toggle(0, 0);
  assert.equal(game.cell(0, 0), F);
  game.toggle(0, 0);
  assert.equal(game.cell(0, 0), U);
  game.toggle(0, 0, 'cross');
  assert.equal(game.cell(0, 0), X);
  game.toggle(0, 0, 'fill');
  assert.equal(game.cell(0, 0), F, 'a tap replaces the other mark');
  game.toggle(0, 0, 'cross');
  assert.equal(game.cell(0, 0), X);
});

test('a stroke reports the cells it changes', () => {
  const game = createGame({ puzzle: plus });
  assert.deepEqual(game.startStroke(1, 0), [{ index: 3, value: F, mistake: false }]);
  assert.deepEqual(game.moveStroke(1, 2), [
    { index: 4, value: F, mistake: false },
    { index: 5, value: F, mistake: false },
  ]);
  assert.deepEqual(game.endStroke(), { changed: 3, mistakes: 0, won: false });
  assert.equal(game.endStroke(), null);
});

test('a drag stays on the row it first moved along', () => {
  const game = createGame({ puzzle: plus });
  game.startStroke(1, 0);
  game.moveStroke(1, 1);
  game.moveStroke(2, 2);
  game.endStroke();
  assert.deepEqual(cells(game), [U, U, U, F, F, F, U, U, U]);
});

test('a drag that first moves vertically stays on the column', () => {
  const game = createGame({ puzzle: plus });
  game.startStroke(0, 1, 'cross');
  game.moveStroke(2, 2);
  game.endStroke();
  assert.deepEqual(cells(game), [U, X, U, U, X, U, U, X, U]);
});

test('dragging back shrinks the stroke and restores the cells', () => {
  const game = createGame({ puzzle: plus });
  game.toggle(0, 2, 'cross');
  game.startStroke(0, 0);
  game.moveStroke(0, 2);
  game.moveStroke(0, 1);
  assert.deepEqual(cells(game).slice(0, 3), [F, F, X]);
  game.moveStroke(0, 0);
  game.endStroke();
  assert.deepEqual(cells(game).slice(0, 3), [F, U, X]);
});

test('painting skips cells with another mark and erasing clears only its own mark', () => {
  const game = createGame({ puzzle: plus });
  game.toggle(1, 1, 'cross');
  game.startStroke(1, 0);
  game.moveStroke(1, 2);
  game.endStroke();
  assert.deepEqual(cells(game).slice(3, 6), [F, X, F]);
  game.startStroke(1, 0); // starts on a filled cell, so this stroke erases fills
  game.moveStroke(1, 2);
  game.endStroke();
  assert.deepEqual(cells(game).slice(3, 6), [U, X, U]);
});

test('out-of-range moves are clamped and invalid input is ignored', () => {
  const game = createGame({ puzzle: plus });
  assert.deepEqual(game.startStroke(5, 0), []);
  assert.deepEqual(game.startStroke(0, 0, 'paint'), []);
  assert.deepEqual(game.moveStroke(0, 2), []);
  game.startStroke(2, 0);
  assert.deepEqual(game.moveStroke(2, Number.NaN), []);
  game.moveStroke(2, 99);
  game.endStroke();
  assert.deepEqual(cells(game).slice(6), [F, F, F]);
});

test('undo and redo work per stroke', () => {
  const game = createGame({ puzzle: plus });
  game.startStroke(0, 0);
  game.moveStroke(0, 2);
  game.endStroke();
  game.toggle(2, 2, 'cross');
  assert.equal(game.undo(), true);
  assert.deepEqual(cells(game), [F, F, F, U, U, U, U, U, U]);
  assert.equal(game.undo(), true);
  assert.deepEqual(cells(game), new Array(9).fill(U));
  assert.equal(game.undo(), false);
  assert.equal(game.getState().canRedo, true);
  assert.equal(game.redo(), true);
  assert.deepEqual(cells(game), [F, F, F, U, U, U, U, U, U]);
  game.toggle(1, 1);
  assert.equal(game.getState().canRedo, false, 'a new move clears the redo history');
  assert.equal(game.redo(), false);
  assert.equal(game.getState().canUndo, true);
});

test('undo during a drag finishes the stroke first, then reverts it', () => {
  const game = createGame({ puzzle: plus });
  game.startStroke(0, 0);
  game.moveStroke(0, 1);
  assert.equal(game.undo(), true);
  assert.deepEqual(cells(game), new Array(9).fill(U));
  assert.equal(game.redo(), true);
  assert.deepEqual(cells(game).slice(0, 3), [F, F, U]);
});

test('mistake checking turns wrong fills into crosses and counts them', () => {
  const game = createGame({ puzzle: plus, autoCheck: true });
  const changes = game.startStroke(0, 0);
  assert.deepEqual(changes, [{ index: 0, value: X, mistake: true }]);
  game.moveStroke(0, 2);
  assert.deepEqual(cells(game).slice(0, 3), [X, F, X]);
  game.moveStroke(0, 1); // the dropped cell is restored and no longer counted
  assert.deepEqual(game.endStroke(), { changed: 2, mistakes: 1, won: false });
  assert.equal(game.getState().mistakes, 1);
  game.toggle(1, 1, 'cross');
  assert.equal(game.cell(1, 1), X, 'crosses are not checked');
  assert.equal(game.getState().mistakes, 1);
  game.setAutoCheck(false);
  game.toggle(2, 0);
  assert.equal(game.cell(2, 0), F);
  assert.equal(game.getState().autoCheck, false);
});

test('check lists marks that contradict the solution', () => {
  const game = createGame({ puzzle: plus });
  game.toggle(0, 0);
  game.toggle(0, 1, 'cross');
  game.toggle(1, 1);
  game.toggle(2, 2, 'cross');
  assert.deepEqual(game.check(), [0, 1]);
});

test('clues fade when their line matches', () => {
  const game = createGame({ puzzle: plus });
  game.toggle(0, 1);
  const state = game.getState();
  assert.deepEqual(state.rowsDone, [true, false, false]);
  assert.deepEqual(state.colsDone, [false, false, false]);
  game.toggle(0, 0);
  assert.deepEqual(game.getState().rowsDone, [false, false, false]);
});

test('matching all clues wins and locks the board', () => {
  const game = createGame({ puzzle: plus });
  assert.deepEqual(solvePlus(game), { changed: 1, mistakes: 0, won: true });
  const state = game.getState();
  assert.equal(state.status, 'won');
  assert.equal(state.canUndo, false);
  assert.deepEqual(game.startStroke(0, 0), []);
  assert.equal(game.undo(), false);
  assert.equal(game.reveal(), false);
});

test('crosses do not block a win', () => {
  const game = createGame({ puzzle: plus });
  game.toggle(0, 0, 'cross');
  game.toggle(2, 2, 'cross');
  assert.equal(solvePlus(game).won, true);
});

test('an alternative solution that fits the clues also wins', () => {
  const game = createGame({ puzzle: diagonal });
  game.toggle(0, 1);
  const result = game.toggle(1, 0);
  assert.equal(result.won, true);
  assert.equal(game.getState().status, 'won');
});

test('the timer starts with the first move and stops at the win', () => {
  const game = createGame({ puzzle: plus });
  game.tick(1000);
  assert.equal(game.getState().elapsed, 0);
  game.toggle(0, 1);
  game.tick(1500);
  game.tick(-50);
  game.tick(Number.NaN);
  assert.equal(game.getState().elapsed, 1500);
  game.startStroke(1, 0);
  game.moveStroke(1, 2);
  game.endStroke();
  game.toggle(2, 1);
  game.tick(1000);
  assert.equal(game.getState().elapsed, 1500);
});

test('reveal shows the solution and ends the game without a win', () => {
  const game = createGame({ puzzle: plus });
  game.toggle(0, 0);
  assert.equal(game.reveal(), true);
  const state = game.getState();
  assert.equal(state.status, 'revealed');
  assert.deepEqual(state.cells, [U, F, U, F, F, F, U, F, U]);
  assert.equal(state.canUndo, false);
  assert.deepEqual(game.startStroke(0, 0), []);
});

test('restart clears the board, history, timer and mistakes', () => {
  const game = createGame({ puzzle: plus, autoCheck: true });
  game.toggle(0, 0);
  game.tick(500);
  game.reveal();
  game.restart();
  const state = game.getState();
  assert.deepEqual(state.cells, new Array(9).fill(U));
  assert.equal(state.status, 'playing');
  assert.equal(state.elapsed, 0);
  assert.equal(state.mistakes, 0);
  assert.equal(state.canUndo, false);
  game.tick(500);
  assert.equal(game.getState().elapsed, 0, 'the timer waits for the first move again');
});

test('a snapshot survives JSON and restores the game', () => {
  const game = createGame({ puzzle: plus, autoCheck: true });
  game.toggle(0, 0);
  game.toggle(1, 1);
  game.toggle(2, 2, 'cross');
  game.tick(4321);
  const saved = JSON.parse(JSON.stringify(game.snapshot()));
  assert.deepEqual(saved, { v: 1, cells: '200010002', elapsed: 4321, mistakes: 1, status: 'playing' });
  const restored = createGame({ puzzle: plus, snapshot: saved });
  assert.deepEqual(restored.getState().cells, cells(game));
  assert.equal(restored.getState().elapsed, 4321);
  assert.equal(restored.getState().mistakes, 1);
  restored.tick(10);
  assert.equal(restored.getState().elapsed, 4331, 'a restored game keeps its timer running');
});

test('restoring keeps the win or the reveal', () => {
  const won = createGame({ puzzle: plus });
  solvePlus(won);
  assert.equal(createGame({ puzzle: plus, snapshot: won.snapshot() }).getState().status, 'won');
  const revealed = createGame({ puzzle: plus });
  revealed.reveal();
  assert.equal(createGame({ puzzle: plus, snapshot: revealed.snapshot() }).getState().status, 'revealed');
  const fake = { ...createGame({ puzzle: plus }).snapshot(), status: 'won' };
  assert.equal(createGame({ puzzle: plus, snapshot: fake }).getState().status, 'playing');
});

test('invalid snapshots are ignored', () => {
  const good = { v: 1, cells: '010111010', elapsed: 10, mistakes: 0, status: 'playing' };
  const bad = [
    null,
    'garbage',
    { ...good, v: 2 },
    { ...good, cells: '0101' },
    { ...good, cells: '01011101x' },
    { ...good, elapsed: -1 },
    { ...good, elapsed: 'soon' },
    { ...good, mistakes: 1.5 },
    { ...good, status: 'paused' },
  ];
  for (const snapshot of bad) {
    const state = createGame({ puzzle: plus, snapshot }).getState();
    assert.deepEqual(state.cells, new Array(9).fill(U), JSON.stringify(snapshot));
    assert.equal(state.elapsed, 0);
  }
});

test('cancelling a stroke restores its cells without touching history, mistakes or timer', () => {
  const game = createGame({ puzzle: plus, autoCheck: true });
  game.toggle(0, 2, 'cross');
  game.startStroke(0, 0);
  game.moveStroke(0, 1);
  assert.deepEqual(cells(game).slice(0, 3), [X, F, X]);
  assert.deepEqual(game.cancelStroke(), [
    { index: 0, value: U, mistake: false },
    { index: 1, value: U, mistake: false },
  ]);
  assert.deepEqual(cells(game).slice(0, 3), [U, U, X]);
  assert.equal(game.endStroke(), null, 'the stroke is gone');
  assert.deepEqual(game.cancelStroke(), [], 'nothing left to cancel');
  const state = game.getState();
  assert.equal(state.mistakes, 0);
  assert.equal(game.undo(), true);
  assert.deepEqual(cells(game), new Array(9).fill(U), 'only the earlier cross was in the history');
});

test('a cancelled first stroke does not start the timer', () => {
  const game = createGame({ puzzle: plus });
  game.startStroke(1, 1);
  game.cancelStroke();
  game.tick(1000);
  assert.equal(game.getState().elapsed, 0);
  assert.equal(game.getState().canUndo, false);
});

test('a long-press can replace a fill stroke with a cross stroke on the same cell', () => {
  const game = createGame({ puzzle: plus });
  game.startStroke(0, 0, 'fill');
  game.cancelStroke();
  game.startStroke(0, 0, 'cross');
  game.moveStroke(0, 2);
  assert.deepEqual(game.endStroke(), { changed: 3, mistakes: 0, won: false });
  assert.deepEqual(cells(game).slice(0, 3), [X, X, X]);
});
