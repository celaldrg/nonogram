import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILLED, CROSSED } from '../src/cells.js';
import { DEMO_PUZZLE_ID, createDemoGame } from '../src/demo.js';

test('the demo is a half-solved 10x10 picture with some crosses and no wrong marks', () => {
  const game = createDemoGame();
  const state = game.getState();
  assert.equal(game.puzzle.id, DEMO_PUZZLE_ID);
  assert.equal(game.puzzle.kind, 'picture');
  assert.equal(state.width, 10);
  assert.equal(state.height, 10);
  assert.equal(state.status, 'playing');
  const painted = game.puzzle.solution.flat().filter(Boolean).length;
  const share = state.cells.filter((v) => v === FILLED).length / painted;
  assert.ok(share > 0.4 && share < 0.6, `share ${share}`);
  assert.ok(state.cells.filter((v) => v === CROSSED).length >= 10);
  assert.deepEqual(game.check(), []);
  assert.ok(state.rowsDone.some(Boolean) && !state.rowsDone.every(Boolean));
  assert.ok(state.colsDone.some(Boolean) && !state.colsDone.every(Boolean));
  assert.ok(state.elapsed > 0);
});

test('the demo state is deterministic', () => {
  assert.deepEqual(createDemoGame().getState(), createDemoGame().getState());
});
