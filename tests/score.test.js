import test from 'node:test';
import assert from 'node:assert/strict';
import { compilePattern, noteName, SCORE_STATUS } from '../src/audio/score.js';

// Synthetic fixtures: these test musical semantics, not Riley's transcription.
test('rests and dotted durations retain exact positions and total duration', () => {
  const score = compilePattern([{ nota: null, duracion: '8n' }, { nota: 'D4', duracion: '4n.' }, { nota: 'Ab4', beats: [1, 3] }]);
  assert.deepEqual(score.events.map(e => [e.onsetTicks, e.durationTicks, e.attackDurationTicks]), [[0, 96, 0], [96, 288, 288], [384, 64, 64]]);
  assert.equal(score.totalTicks, 448);
});

test('a tie sustains across written segments with a single attack', () => {
  const score = compilePattern([{ nota: 'D4', duracion: '8n', tieToNext: true }, { nota: 'D4', duracion: '4n', tieToNext: true }, { nota: 'D4', duracion: '8n' }, { nota: 'D4', duracion: '8n' }]);
  assert.deepEqual(score.events.map(e => e.attackDurationTicks), [384, 0, 0, 96]);
  assert.deepEqual(score.events.map(e => e.kind), ['note', 'tie', 'tie', 'note']);
  assert.equal(score.totalTicks, 480);
});

test('ornaments borrow time without changing the written phrase length', () => {
  const score = compilePattern([{ nota: 'A4', duracion: '4n', grace: [{ nota: 'G4' }, { nota: 'F4' }], tieToNext: true }, { nota: 'A4', duracion: '8n' }]);
  assert.deepEqual(score.events.map(e => e.onsetTicks), [0, 12, 24, 192]);
  assert.deepEqual(score.events.map(e => e.attackDurationTicks), [12, 12, 264, 0]);
  assert.equal(score.totalTicks, 288);
});

test('invalid written data fail explicitly rather than guessing music', () => {
  for (const pattern of [[], [{ nota: 'H4', duracion: '4n' }], [{ nota: 'C4', beats: [0, 1] }], [{ nota: 'C4', beats: [1, 5] }], [{ nota: 'C4', duracion: 'foo' }], [{ nota: 'C4', duracion: '4n', tieToNext: true }], [{ nota: null, duracion: '4n', grace: [{ nota: 'C4' }] }], [{ nota: 'C4', duracion: '4n', tieToNext: true }, { nota: 'D4', duracion: '4n' }]]) {
    assert.throws(() => compilePattern(pattern));
  }
});

test('note labels retain alteration and octave; status identifies the supplied source', () => {
  assert.equal(noteName('F#4'), 'Fa♯4');
  assert.equal(noteName('Bb3'), 'Si♭3');
  assert.equal(noteName(null), 'Silencio');
  assert.equal(SCORE_STATUS.verified, true);
  assert.match(SCORE_STATUS.label, /PDF/);
});
