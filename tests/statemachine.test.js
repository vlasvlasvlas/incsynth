import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transicionar, ESTADOS } from '../src/logic/StateMachine.js';
import { DataSourceAdapter } from '../src/data-sources/DataSourceAdapter.js';

const mappings = JSON.parse(
  await readFile(new URL('../src/data/mappings.json', import.meta.url), 'utf8')
);

function ctx(magnitud) {
  const señal = new DataSourceAdapter();
  señal.magnitud = magnitud;
  const mapeo = mappings.fuentes.noticias;
  return {
    señal, mapeo, numFuentes: 1, ciclosSinActividad: 0,
    indice_pais: null, posicion: 2, numPatrones: 53,
    umbrales: mappings.umbrales, sala: null,
  };
}

test('magnitud 0.5 estable no saca de SONANDO en 100 ticks', () => {
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  let estado = ESTADOS.SONANDO;
  for (let i = 0; i < 100; i++) estado = transicionar(estado, ctx(0.5));
  Math.random = originalRandom;
  assert.equal(estado, ESTADOS.SONANDO);
});

test('magnitud 0.20 (piso Melodía post-Task 1) permite entrar desde ARMADO', () => {
  const siguiente = transicionar(ESTADOS.ARMADO, ctx(0.20));
  assert.equal(siguiente, ESTADOS.SONANDO);
});

test('magnitud 0.03 saca de SONANDO a DORMIDO en pocos ticks', () => {
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  let estado = ESTADOS.SONANDO;
  for (let i = 0; i < 5 && estado === ESTADOS.SONANDO; i++) {
    estado = transicionar(estado, ctx(0.03));
  }
  Math.random = originalRandom;
  assert.equal(estado, ESTADOS.DORMIDO);
});

test('SALE es rampa lineal: 1 en magnitud≤0.05, 0 en magnitud≥0.15, 0.5 en 0.10', () => {
  const señal = new DataSourceAdapter();
  const mapeo = mappings.fuentes.noticias;
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  señal.magnitud = 0.05; assert.ok(near(señal.getVerb('SALE', mapeo), 1), `SALE(0.05)=${señal.getVerb('SALE', mapeo)}`);
  señal.magnitud = 0.00; assert.ok(near(señal.getVerb('SALE', mapeo), 1));
  señal.magnitud = 0.15; assert.ok(near(señal.getVerb('SALE', mapeo), 0));
  señal.magnitud = 0.20; assert.ok(near(señal.getVerb('SALE', mapeo), 0));
  señal.magnitud = 0.10; assert.ok(near(señal.getVerb('SALE', mapeo), 0.5));
});
