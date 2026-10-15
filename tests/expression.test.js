import test from 'node:test';
import assert from 'node:assert/strict';
import { Expression, createExpressionSettings, expressionRandom } from '../src/audio/Expression.js';

const ids = ['cuerdas', 'percusion', 'melodia'];
const ensemble = () => Object.fromEntries(ids.map(id => [id, { posicion: 0, estado: 'SONANDO' }]));
function advance(score, inst, seconds) {
  score.update(score.elapsed, inst);
  for (let n = 0; n < seconds; n++) score.update(score.lastTime + 1, inst);
}

test('stage boundaries use human pattern numbers, with seven coherent sections', () => {
  const score = new Expression(ids);
  assert.deepEqual([0,5,6,14,15,23,24,29,30,39,40,46,47,52].map(p => score.stageIndex(p)), [0,0,1,1,2,2,3,3,4,4,5,5,6,6]);
});

test('manual timbres remain protected and structural changes obey minimum dwell', () => {
  const score = new Expression(ids); const inst = ensemble();
  assert.equal(score.phrase(ids[0], inst, 'FLAUTA').preset, null);
  inst.cuerdas.posicion = 6;
  assert.equal(score.phrase(ids[0], inst, 'FLAUTA', false).preset, null);
  assert.equal(score.phrase(ids[0], inst, 'FLAUTA').preset, 'ARCO');
  inst.cuerdas.posicion = 15;
  advance(score, inst, 119);
  assert.equal(score.phrase(ids[0], inst, 'ARCO').preset, null);
  advance(score, inst, 1);
  assert.equal(score.phrase(ids[0], inst, 'ARCO').preset, 'PAD');
});

test('at most one phrase rest and never intentionally rests the only audible voice', () => {
  const score = new Expression(ids, createExpressionSettings(), () => 0.5); const inst = ensemble();
  ids.forEach(id => score.markSounding(id, true));
  advance(score, inst, 150);
  const result = ids.map(id => score.phrase(id, inst, 'FLAUTA'));
  assert.equal(result.filter(v => v.rest).length, 1);
  const solo = new Expression(ids); solo.markSounding(ids[0], true);
  inst.percusion.estado = 'DORMIDO'; inst.melodia.estado = 'DESCANSANDO';
  advance(solo, inst, 150);
  assert.equal(solo.phrase(ids[0], inst, 'FLAUTA').rest, false);
});

test('return from rest ramps presence; exposure recovers during silence', () => {
  const score = new Expression(ids); const inst = ensemble();
  ids.forEach(id => score.markSounding(id, true));
  advance(score, inst, 100);
  const before = score.voices.cuerdas.exposure;
  score.phrase('cuerdas', inst, 'FLAUTA');
  score.markSounding('cuerdas', false);
  advance(score, inst, 25);
  assert.ok(score.voices.cuerdas.exposure < before);
  score.phrase('cuerdas', inst, 'FLAUTA');
  assert.equal(score.voices.cuerdas.reentryAt, score.elapsed);
});

test('random changes are reproducible, spaced, within voice palette and do not change patterns', () => {
  function run() {
    const settings = createExpressionSettings(); settings.timbres = 'azar'; settings.dwell = 30; settings.randomMinutes = 1;
    const score = new Expression(ids, settings, expressionRandom(24)); const inst = ensemble();
    let preset = 'FLAUTA'; const changes = [];
    for (let t = 0; t < 1800; t++) {
      score.update(t, inst);
      const p = score.phrase('cuerdas', inst, preset).preset;
      if (p) { preset = p; changes.push([t,p]); }
    }
    assert.equal(inst.cuerdas.posicion, 0);
    assert.ok(changes.length > 2);
    changes.slice(1).forEach((c,i) => assert.ok(c[0] - changes[i][0] >= settings.dwell));
    return changes;
  }
  assert.deepEqual(run(), run());
});

test('disabled expression returns neutral sound without rests or swaps', () => {
  const score = new Expression(ids); const inst = ensemble();
  score.settings.enabled = false;
  advance(score, inst, 1000);
  assert.equal(score.snapshot.pulseGain, 1);
  assert.equal(score.snapshot.reverb, null);
  assert.equal(score.snapshot.voices.cuerdas.gainDb, 0);
  assert.equal(score.snapshot.voices.cuerdas.releaseScale, 1);
  assert.deepEqual(score.phrase('cuerdas', inst, 'FLAUTA'), { rest: false, preset: null });
  assert.equal(score.ended, false);
});

test('disabling timbre expression cannot cancel the shared ending', () => {
  const score = new Expression(ids); const inst = ensemble();
  score.settings.enabled = false;
  inst.cuerdas.posicion = 52; inst.percusion.posicion = 52;
  advance(score, inst, 40); assert.equal(score.codaAt, null);
  inst.melodia.posicion = 52;
  advance(score, inst, 40);
  assert.equal(score.ended, true);
  assert.equal(score.snapshot.voices.cuerdas.codaGain, 0);
  score.settings.enabled = true;
  score.update(score.lastTime + 1, inst);
  assert.equal(score.ended, true);
});

test('coda waits for all voices; installation rest precedes new cycle', () => {
  const score = new Expression(ids); const inst = ensemble();
  inst.cuerdas.posicion = 52; inst.percusion.posicion = 52;
  advance(score, inst, 50); assert.equal(score.codaAt, null);
  inst.melodia.posicion = 52;
  score.update(score.lastTime + 1, inst);
  assert.equal(score.snapshot.stage, 'Coda compartida');
  advance(score, inst, 36);
  assert.equal(score.ended, true); assert.equal(score.snapshot.pulseGain, 0);
  assert.equal(score.shouldLoop(), false);
  score.settings.ending = 'loop';
  assert.equal(score.shouldLoop(), false);
  advance(score, inst, 20); assert.equal(score.shouldLoop(), true);
  score.reset(); assert.equal(score.ended, false); assert.equal(score.elapsed, 0);
});

test('two-hour simulated session keeps finite bounded parameters and bounded storage', () => {
  const score = new Expression(ids); const inst = ensemble();
  for (let t = 0; t < 7200; t++) {
    ids.forEach((id,i) => {
      inst[id].posicion = Math.min(51, Math.floor(t / 150) + i);
      if (t % 4 === 0) score.markSounding(id, !score.phrase(id, inst, 'FLAUTA').rest);
    });
    const snapshot = score.update(t, inst);
    for (const voice of Object.values(snapshot.voices)) {
      for (const value of Object.values(voice)) if (typeof value === 'number') assert.ok(Number.isFinite(value));
      assert.ok(voice.gainDb <= 0); assert.ok(voice.exposure <= 180);
      assert.ok(voice.brightness > 0 && voice.brightness <= 1);
    }
  }
  assert.equal(Object.keys(score.voices).length, 3);
  score.pause(); const elapsed = score.elapsed; score.update(99999, inst); assert.equal(score.elapsed, elapsed);
});
