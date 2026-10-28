import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextPictureId, pictureNumber, puzzleTitle, randomPuzzleId, randomRecordId, sizeLabel } from '../src/catalog.js';
import { PICTURES, getPuzzle } from '../src/puzzles.js';

test('picture titles stay hidden until the picture is known', () => {
  const sailboat = getPuzzle('sailboat');
  assert.equal(puzzleTitle(sailboat, 'en', false), 'Picture 7');
  assert.equal(puzzleTitle(sailboat, 'tr', false), 'Resim 7');
  assert.equal(puzzleTitle(sailboat, 'en', true), 'Sailboat');
  assert.equal(puzzleTitle(sailboat, 'tr', true), 'Yelkenli');
});

test('random puzzles have a generic title and a size label', () => {
  const random = getPuzzle(randomPuzzleId(10, 42));
  assert.equal(random.id, 'random-10-42');
  assert.equal(puzzleTitle(random, 'en', true), 'Random puzzle');
  assert.equal(puzzleTitle(random, 'tr', false), 'Rastgele bulmaca');
  assert.equal(sizeLabel(random), '10×10');
  assert.equal(randomPuzzleId(5, -1), 'random-5-4294967295', 'seeds wrap to 32 bits');
  assert.notEqual(getPuzzle(randomPuzzleId(5, -1)), null);
  assert.equal(randomRecordId(15), 'random-15');
  assert.equal(getPuzzle(randomRecordId(15)), null, 'record keys are not puzzle ids');
});

test('picture numbers follow the picker order', () => {
  assert.equal(pictureNumber(PICTURES[0].id), 1);
  assert.equal(pictureNumber(PICTURES.at(-1).id), PICTURES.length);
  assert.equal(pictureNumber('random-10-1'), 0);
});

test('the next picture is the next unsolved one, wrapping around', () => {
  const ids = PICTURES.map((p) => p.id);
  assert.equal(nextPictureId(null, {}), ids[0]);
  assert.equal(nextPictureId('random-10-5', {}), ids[0]);
  assert.equal(nextPictureId(ids[0], {}), ids[1]);
  assert.equal(nextPictureId(ids[0], { [ids[1]]: 1000, [ids[2]]: 2000 }), ids[3]);
  const allButFirst = Object.fromEntries(ids.slice(1).map((id) => [id, 1]));
  assert.equal(nextPictureId(ids.at(-1), allButFirst), ids[0], 'wraps to the start');
  const all = Object.fromEntries(ids.map((id) => [id, 1]));
  assert.equal(nextPictureId(ids[4], all), ids[5], 'all solved: just the next one');
  assert.equal(nextPictureId(ids.at(-1), all), ids[0]);
});
