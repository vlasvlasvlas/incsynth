import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCardStatus } from '../src/ui/cardStatus.js';

test('phase playing con nota muestra el nombre en castellano', () => {
  const r = formatCardStatus({ running: true, phase: 'playing', note: 'C4', kind: 'note' });
  assert.match(r.current, /Do4/);
});

test('phase playing con ligadura marca " · ligada"', () => {
  const r = formatCardStatus({ running: true, phase: 'playing', note: 'C4', kind: 'tie' });
  assert.match(r.current, /ligada/);
});

test('phase playing con adorno marca " · adorno"', () => {
  const r = formatCardStatus({ running: true, phase: 'playing', note: 'C4', kind: 'grace' });
  assert.match(r.current, /adorno/);
});

test('phase playing con silencio escrito muestra "Silencio"', () => {
  const r = formatCardStatus({ running: true, phase: 'playing', note: null, kind: 'rest' });
  assert.equal(r.current, 'Silencio');
});

test('phase waiting muestra "Escuchando" (no "—")', () => {
  const r = formatCardStatus({ running: true, phase: 'waiting' });
  assert.equal(r.current, 'Escuchando');
});

test('phase resting muestra "Respirando"', () => {
  const r = formatCardStatus({ running: true, phase: 'resting' });
  assert.equal(r.current, 'Respirando');
});

test('phase suspended muestra "Audio en pausa"', () => {
  const r = formatCardStatus({ running: false, phase: 'suspended' });
  assert.equal(r.current, 'Audio en pausa');
});

test('phase ended muestra "Finalizado"', () => {
  const r = formatCardStatus({ running: false, phase: 'ended' });
  assert.equal(r.current, 'Finalizado');
});

test('phase stopped muestra "Detenido"', () => {
  const r = formatCardStatus({ running: false, phase: 'stopped' });
  assert.equal(r.current, 'Detenido');
});

test('fase desconocida cae a "—" (fallback seguro)', () => {
  const r = formatCardStatus({ running: true, phase: 'unknown-xyz' });
  assert.equal(r.current, '—');
});
