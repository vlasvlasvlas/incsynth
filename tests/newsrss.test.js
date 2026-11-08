import test from 'node:test';
import assert from 'node:assert/strict';
import { NewsRSSAdapter } from '../src/data-sources/NewsRSSAdapter.js';

// _procesarTitulares() usa this._titulares internamente — hay que setear el
// estado antes de llamar, no pasar args.

test('magnitud tiene piso 0.20 cuando hay keywords no intensos (politica/economia)', () => {
  const adapter = new NewsRSSAdapter();
  adapter._activeFeeds = [{ name: 'TEST' }];
  adapter._titulares = [
    { source: 'TEST', text: 'election president budget reforms' },
    { source: 'TEST', text: 'market trade economy rate' },
    { source: 'TEST', text: 'minister government leader protest' },
  ];
  adapter._procesarTitulares();
  // Sin el piso: intensos=0, total>=6 → magnitud = 0/max(total,5) = 0 → FREEZE.
  assert.ok(adapter.magnitud >= 0.20, `esperaba >= 0.20, obtuve ${adapter.magnitud}`);
});

test('magnitud puede subir sobre el piso cuando hay intensos', () => {
  const adapter = new NewsRSSAdapter();
  adapter._activeFeeds = [{ name: 'TEST' }];
  adapter._titulares = Array.from({ length: 10 }, (_, i) => ({
    source: 'TEST',
    text: i < 5 ? 'war attack bomb kill' : 'election government leader',
  }));
  adapter._procesarTitulares();
  assert.ok(adapter.magnitud > 0.30, `esperaba > 0.30, obtuve ${adapter.magnitud}`);
});

test('magnitud se mantiene en 0.3 cuando no hay nada que procesar (fallback)', () => {
  const adapter = new NewsRSSAdapter();
  // Sin titulares cargados — el método hace early return y la magnitud default
  // (0.3) del DataSourceAdapter base queda intacta.
  adapter._procesarTitulares();
  assert.equal(adapter.magnitud, 0.3); // constructor NewsRSSAdapter setea 0.3
});
