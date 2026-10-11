import test from 'node:test';
import assert from 'node:assert/strict';
import * as logger from '../src/ai/sessionLogger.js';

test('periodic persistence continues beyond the retained event limit', () => {
  let writes = 0;
  globalThis.localStorage = { setItem() { writes++; } };
  logger.iniciarSesion();
  const inst = { posicion: 0, getEstadoUI: () => ({ expression: { stage: 'Meseta' } }) };
  for (let i=0;i<8000;i++) logger.registrarCiclo('cuerdas',inst,null,false);
  const before = writes;
  for (let i=0;i<60;i++) logger.registrarCiclo('cuerdas',inst,null,false);
  assert.equal(writes,before+2);
  assert.equal(logger.exportar().eventos.length,8000);
  assert.equal(logger.exportar().eventos.at(-1).expression.stage,'Meseta');
  delete globalThis.localStorage;
});
