import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { compilePattern } from '../src/audio/score.js';
const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url)));
const patterns = read('../src/data/patterns.json');
const manifest = read('../docs/in-c-verificacion.json');
// Regression protection AFTER visual collation; hashing cannot read a score.
test('all 53 visually collated figures retain their recorded musical content', () => {
  assert.equal(patterns.length, 53);
  patterns.forEach((pattern,i) => {
    const expected=manifest.patterns[i];
    assert.equal(createHash('sha256').update(JSON.stringify(pattern)).digest('hex'),expected.sha256,`Figura ${i+1}: revisar contra PDF antes de cambiar huella`);
    assert.equal(compilePattern(pattern).totalTicks/192,expected.quarterBeats);
    assert.equal(pattern.length,expected.writtenEvents);
  });
});
test('score anchors preserve ornaments, long ties, exact rests and altered pitches', () => {
  assert.equal(compilePattern(patterns[0]).events.filter(e=>e.kind==='grace').length,3);
  assert.deepEqual(patterns[13].map(e=>e.nota),['C5','B4','G4','F#4']);
  assert.equal(compilePattern(patterns[5]).events[0].attackDurationTicks,8*192);
  assert.equal(compilePattern(patterns[6]).events.filter(e=>e.kind==='rest').reduce((n,e)=>n+e.durationTicks,0),8*192);
  assert.ok(patterns[31].slice(0,6).every(e=>e.duracion==='16n'));
  const long=compilePattern(patterns[34]);
  assert.equal(long.totalTicks,29*192);
  assert.equal(long.events.filter(e=>e.kind==='tie').length,3);
  assert.ok(patterns[34].some(e=>e.nota==='B5'));
  assert.equal(compilePattern(patterns[47]).events[2].attackDurationTicks,5*192);
  assert.deepEqual(patterns[52].map(e=>e.nota),['Bb4','G4']);
});
