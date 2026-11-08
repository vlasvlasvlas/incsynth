import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Instrumento } from '../src/logic/Instrumento.js';
import { ESTADOS } from '../src/logic/StateMachine.js';

const mappings = JSON.parse(
  await readFile(new URL('../src/data/mappings.json', import.meta.url), 'utf8')
);

function makeInst() {
  const sala = { registrarInstrumento() {}, actualizarPosicion() {}, calcularProbabilidadBreakdown: () => ({ p: 0 }) };
  const mapeo = mappings.fuentes.noticias;
  return new Instrumento('melodia', sala, mapeo, mappings.umbrales, mappings.pesos_sala);
}

test('despertar desde DORMIDO pasa a ARMADO por default', () => {
  const inst = makeInst();
  inst.estado = ESTADOS.DORMIDO;
  inst.despertar('x');
  assert.equal(inst.estado, ESTADOS.ARMADO);
  assert.equal(inst._ciclosSinActividad, 0);
  assert.match(inst._lastDecision, /DESPIERTA.*x/);
});

test('despertar desde DESCANSANDO pasa a ARMADO', () => {
  const inst = makeInst();
  inst.estado = ESTADOS.DESCANSANDO;
  inst.despertar('y');
  assert.equal(inst.estado, ESTADOS.ARMADO);
});

test('despertar desde SONANDO no lo degrada (no-op sobre estado)', () => {
  const inst = makeInst();
  inst.estado = ESTADOS.SONANDO;
  inst.despertar('z');
  assert.equal(inst.estado, ESTADOS.SONANDO);
  assert.equal(inst._ciclosSinActividad, 0); // sí resetea el contador
});

test('despertar con estadoDestino SONANDO fuerza SONANDO desde DORMIDO (promesa fuerte)', () => {
  const inst = makeInst();
  inst.estado = ESTADOS.DORMIDO;
  inst.despertar('primer minuto', ESTADOS.SONANDO);
  assert.equal(inst.estado, ESTADOS.SONANDO);
});

test('despertar con estadoDestino SONANDO no degrada ya SONANDO', () => {
  const inst = makeInst();
  inst.estado = ESTADOS.SONANDO;
  inst.despertar('primer minuto', ESTADOS.SONANDO);
  assert.equal(inst.estado, ESTADOS.SONANDO);
});
