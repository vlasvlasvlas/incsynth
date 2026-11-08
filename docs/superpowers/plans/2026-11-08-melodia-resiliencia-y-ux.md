# Melodía: resiliencia + UX de canal · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar el freeze permanente del canal Melodía (y de cualquier canal cuya fuente colapse) y convertir las tarjetas de canal en una UI honesta y legible, sin tocar el motor de composición ni los patrones.

**Architecture:** Capas separadas, cada fix en su archivo responsable. Cambios mínimos en la señal (piso de magnitud + SALE con pendiente), bajo umbral de entrada, watchdog por canal en el Engine, closure defensivo en el scheduler, texto honesto y medidor visual en la tarjeta.

**Tech Stack:** JavaScript (ESM), Tone.js, Vite, test runner nativo de Node (`node --test`) con harness que mockea Tone.

**Spec:** este documento (deriva del análisis de comité documentado en la conversación 2026-11-08).

## Global Constraints

- Nada que cambie la "música" como obra: patrones JSON, orden de las 53 figuras, duración de cada figura y presets de cada stage **no se tocan**.
- Nada que cambie el sonido de los canales Cuerdas y Percusión excepto como efecto colateral del fix de SALE/entrada (que les aplica a los 3 por igual; se verifica que no empeoren).
- Español rioplatense en todo texto de UI nuevo. Sin emojis.
- Commits chicos, uno por task. Nunca `--no-verify`. Nunca `Co-Authored-By: Claude`.
- Tests: `node --experimental-vm-modules --test tests/*.test.js` desde la raíz del repo. Mantener compatible con el harness existente en `tests/engine.test.js`.

## Review Focus

1. **Cuerdas y Percusión no deben quedar nunca más "DORMIDAS" por el cambio de SALE/entrada** — con las fuentes `clima` (0.5-0.8 estable) y `mercado` (centrada en 0.5), una vez sonando, deben seguir sonando. Pin: test en Task 2 que fija magnitud=0.5 por 100 ciclos y verifica estado SONANDO.
2. **Melodía no debe quedar atrapada con `noticias.magnitud = 0` ni con `intensos=0`** — el piso del Task 1 debe garantizarlo. Pin: test en Task 1 con conteo sin "intensos".
3. **El watchdog no debe reactivar un canal cuando el usuario apagó el Transport (`engine._running === false`)** — Pin: test en Task 3 con engine parado.
4. **El try/catch defensivo no debe silenciar errores en silencio** — debe loguear y reagendar. Pin: test en Task 4 que inyecta un throw y verifica reagendado + log.
5. **El texto honesto no debe mentir sobre "Silencio escrito" vs "Esperando entrada"** — `state.kind === 'rest'` con `phase === 'playing'` es "Silencio" musical (ya existente); el resto es estado del intérprete. Pin: tests por fase en Task 5.

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `src/data-sources/NewsRSSAdapter.js` | Fuente RSS → magnitud | Modify (fórmula de magnitud) |
| `src/data-sources/DataSourceAdapter.js` | Verbos genéricos ENTRA/SALE/etc. | Modify (SALE con pendiente) |
| `src/data/mappings.json` | Umbrales globales | Modify (bajar `entrada`) |
| `src/audio/Engine.js` | Scheduler + watchdog + primer minuto | Modify (3 cambios localizados) |
| `src/logic/Instrumento.js` | Estado del canal | Modify (método `despertar()`) |
| `src/audio/presets.js` | DEFAULTS por canal | Modify (default melodía) |
| `src/ui/PatternReader.js` | Tarjeta de canal | Modify (texto honesto + medidor + dato fuente) |
| `src/ui/pattern-reader.css` | Estilos de tarjeta | Modify (barrita medidor) |
| `tests/newsrss.test.js` | Suite RSS | Create |
| `tests/statemachine.test.js` | Suite máquina de estados | Create |
| `tests/engine.test.js` | Suite motor | Modify (watchdog + closure defensivo + primer minuto) |
| `tests/pattern-reader.test.js` | Suite UI tarjeta | Create |

---

## Scope explícitamente FUERA de este plan

- **Frases melódicas con arco pregunta/respuesta** (ítem #8 del análisis) — rediseño del motor melódico; va en un spec/plan propio.
- Cambios al archivo `patterns.json`.
- Cambios a `Expression.js` (tabla STAGES).
- Rediseño del layout general de la app.

---

## Task 1: Piso de magnitud en NewsRSSAdapter

**Problema que resuelve:** con titulares sin palabras "intensas", `intensos/max(total,5)` da 0 y `SALE` dispara a 1 en el siguiente tick.

**Files:**
- Modify: `src/data-sources/NewsRSSAdapter.js:396`
- Test: `tests/newsrss.test.js` (create)

**Interfaces:**
- Produces: `NewsRSSAdapter.magnitud ∈ [0.20, 1.0]` garantizado tras `_procesarTitulares` con cualquier input no vacío.

- [ ] **Step 1: Test que falla** — titulares sin keywords intensos → `magnitud >= 0.20`.

```javascript
// tests/newsrss.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { NewsRSSAdapter } from '../src/data-sources/NewsRSSAdapter.js';

test('magnitud tiene piso 0.20 cuando hay titulares sin keywords intensos', () => {
  const adapter = new NewsRSSAdapter();
  const titulares = [
    { source: 'TEST', title: 'parliament debates budget reforms' },
    { source: 'TEST', title: 'football team wins championship' },
    { source: 'TEST', title: 'technology company reports earnings' },
  ];
  adapter._procesarTitulares(titulares);
  assert.ok(adapter.magnitud >= 0.20, `esperaba >= 0.20, obtuve ${adapter.magnitud}`);
});

test('magnitud puede subir sobre el piso cuando hay intensos', () => {
  const adapter = new NewsRSSAdapter();
  const titulares = Array.from({ length: 10 }, (_, i) => ({
    source: 'TEST', title: i < 5 ? 'war attack bomb kill' : 'normal news story',
  }));
  adapter._procesarTitulares(titulares);
  assert.ok(adapter.magnitud > 0.30);
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `node --experimental-vm-modules --test tests/newsrss.test.js`
Expected: FAIL en el primer test con magnitud ≈ 0.

- [ ] **Step 3: Implementar**

En `src/data-sources/NewsRSSAdapter.js:396`, reemplazar:
```js
this.magnitud = total > 0 ? clamp(intensos / Math.max(total, 5), 0, 1) : 0.3;
```
por una fórmula con piso 0.20: la señal cruda sigue siendo `intensos/max(total,5)`, pero se clampa a `[0.20, 1.0]` cuando hay `total > 0`. Si `total === 0`, mantener `0.3` (fallback de inicialización).

- [ ] **Step 4: Correr y verificar que pasa**

Run: `node --experimental-vm-modules --test tests/newsrss.test.js`
Expected: PASS ambos tests.

- [ ] **Step 5: Correr suite completa**

Run: `node --experimental-vm-modules --test tests/*.test.js`
Expected: PASS todos los tests (ningún otro test depende de la fórmula exacta).

- [ ] **Step 6: Commit**

```bash
git add src/data-sources/NewsRSSAdapter.js tests/newsrss.test.js
git commit -m "fix(news): piso 0.20 en magnitud para evitar freeze de Melodía"
```

---

## Task 2: Umbral de entrada más bajo + SALE con pendiente

**Problema que resuelve:** asimetría salida/entrada. SALE binaria dispara en 0.08 con probabilidad 1; entrada pide `> 0.30` estricto. Trampa.

**Files:**
- Modify: `src/data-sources/DataSourceAdapter.js:27-28`
- Modify: `src/data/mappings.json:41` (bajar `entrada` a `0.20`)
- Test: `tests/statemachine.test.js` (create)

**Interfaces:**
- Produces: `DataSourceAdapter.getVerb('SALE')` ∈ [0,1] continua, 1 en magnitud ≤ 0.05, 0 en magnitud ≥ 0.15, lineal entre medias.
- Produces: `mappings.umbrales.entrada === 0.20`.

- [ ] **Step 1: Test que falla** — máquina de estados no debe caer a DORMIDO con magnitud estable 0.5 (Cuerdas/Percusión), ni con magnitud estable 0.20 (piso de Melodía post-Task 1).

```javascript
// tests/statemachine.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { transicionar, ESTADOS } from '../src/logic/StateMachine.js';
import { DataSourceAdapter } from '../src/data-sources/DataSourceAdapter.js';
import mappings from '../src/data/mappings.json' with { type: 'json' };

function ctx(magnitud, estado = ESTADOS.SONANDO) {
  const señal = new DataSourceAdapter();
  señal.magnitud = magnitud;
  const mapeo = mappings.fuentes.noticias;
  return { señal, mapeo, numFuentes: 1, ciclosSinActividad: 0,
    indice_pais: null, posicion: 2, numPatrones: 53,
    umbrales: mappings.umbrales, sala: null };
}

test('magnitud 0.5 estable no saca de SONANDO en 100 ticks', () => {
  let estado = ESTADOS.SONANDO;
  for (let i = 0; i < 100; i++) estado = transicionar(estado, ctx(0.5));
  assert.equal(estado, ESTADOS.SONANDO);
});

test('magnitud 0.20 (piso Melodía) permite entrar desde ARMADO', () => {
  const siguiente = transicionar(ESTADOS.ARMADO, ctx(0.20, ESTADOS.ARMADO));
  assert.equal(siguiente, ESTADOS.SONANDO);
});

test('magnitud 0.03 saca de SONANDO con alta probabilidad en pocos ticks', () => {
  // Con Math.random determinístico (siempre 0), prob del random walk sin bias;
  // acá usamos que SALE=1 y umbrales.sale=0.08, random<1 siempre pasa.
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  let estado = ESTADOS.SONANDO;
  for (let i = 0; i < 5 && estado === ESTADOS.SONANDO; i++) {
    estado = transicionar(estado, ctx(0.03));
  }
  Math.random = originalRandom;
  assert.equal(estado, ESTADOS.DORMIDO);
});
```

- [ ] **Step 2: Correr y verificar que fallan los primeros 2 tests** (SONANDO cae por SALE, ARMADO no entra con 0.20).

Run: `node --experimental-vm-modules --test tests/statemachine.test.js`

- [ ] **Step 3: Implementar**

En `src/data-sources/DataSourceAdapter.js:27-28`, reemplazar la rama `'SALE'` del `switch`:
```js
case 'SALE': return this.magnitud < 0.08 ? 1 : 0;
```
por una rampa lineal: 0 cuando `magnitud >= 0.15`, 1 cuando `magnitud <= 0.05`, lineal entre medias. Usar `clamp((0.15 - this.magnitud) / 0.10, 0, 1)`.

En `src/data/mappings.json:41`, cambiar `"entrada": 0.30` → `"entrada": 0.20`.

- [ ] **Step 4: Correr y verificar que pasan los 3**

Run: `node --experimental-vm-modules --test tests/statemachine.test.js`

- [ ] **Step 5: Correr suite completa — verificar que ningún test previo rompe**

Run: `node --experimental-vm-modules --test tests/*.test.js`

- [ ] **Step 6: Commit**

```bash
git add src/data-sources/DataSourceAdapter.js src/data/mappings.json tests/statemachine.test.js
git commit -m "fix(estado): histéresis SALE/entrada para evitar canales atrapados"
```

---

## Task 3: Watchdog por canal

**Problema que resuelve:** si por cualquier razón (señal rota, fetch fallido, estado residual) un canal queda en DORMIDO/ARMADO más de N ciclos, hoy no hay forma de resucitarlo. Watchdog = red de seguridad.

**Files:**
- Modify: `src/logic/Instrumento.js` (nuevo método `despertar(motivo)`)
- Modify: `src/audio/Engine.js:473-478` (contador por canal + llamada a `despertar` cuando pasa el umbral)
- Test: `tests/engine.test.js` (agregar test al final)

**Interfaces:**
- Produces: `Instrumento.despertar(motivo: string): void` — fuerza `this.estado = ESTADOS.ARMADO`, resetea `_ciclosSinActividad`, registra en `_lastDecision`.
- Consumes (Engine): `inst.despertar(motivo)` desde `_runPatternCycle`.

- [ ] **Step 1: Test que falla** — un canal que queda en DORMIDO 10 ciclos debe ser despertado por el Engine.

```javascript
// tests/engine.test.js — agregar al final del archivo
test('watchdog despierta canal dormido tras 10 ciclos de espera', async () => {
  const { engine, instruments, Transport, setClock } = await harness();
  engine.start();
  instruments.melodia.estado = 'DORMIDO';
  for (let i = 0; i < 12; i++) {
    setClock((i + 1) * 768);
    // dispara eventos agendados hasta este tick
    for (const [id, ev] of Transport.events) if (ev.tick <= Transport.ticks) { ev.callback(ev.tick / 192); Transport.events.delete(id); }
  }
  assert.notEqual(instruments.melodia.estado, 'DORMIDO',
    'Melodía debería haber sido despertada por el watchdog');
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `node --experimental-vm-modules --test tests/engine.test.js`

- [ ] **Step 3: Implementar `despertar`**

En `src/logic/Instrumento.js`, agregar método público `despertar(motivo)`:
- Setear `this.estado = ESTADOS.ARMADO` (desde DORMIDO) o no-op si ya está SONANDO.
- `this._ciclosSinActividad = 0`.
- `this._lastDecision = 'DESPIERTA: ' + motivo`.

- [ ] **Step 4: Implementar contador + llamada en Engine**

En `src/audio/Engine.js`:
- En el constructor (o primera vez que se usa), inicializar `this._waitingCycles = {}`.
- En la rama `waiting` (líneas 473-478): `this._waitingCycles[id] = (this._waitingCycles[id] ?? 0) + 1`; cuando `>= 10 && this._running`, llamar `inst.despertar('watchdog')` y resetear a 0.
- Resetear contador a 0 cuando el ciclo NO entra en esta rama (el canal volvió a sonar) — al inicio del `_runPatternCycle` tras calcular `ui`.

- [ ] **Step 5: Correr test y suite**

Run: `node --experimental-vm-modules --test tests/engine.test.js`

- [ ] **Step 6: Commit**

```bash
git add src/logic/Instrumento.js src/audio/Engine.js tests/engine.test.js
git commit -m "feat(engine): watchdog por canal reactiva tras 10 ciclos sin tocar"
```

---

## Task 4: Try/catch defensivo en el scheduler

**Problema que resuelve:** el closure dentro de `_scheduleAtTick` en `_runPatternCycle` no tiene try/catch. Una excepción mata el canal silenciosamente para siempre.

**Files:**
- Modify: `src/audio/Engine.js:503-517` (callback del finishTick)
- Test: `tests/engine.test.js`

**Interfaces:** sin nueva superficie; comportamiento más robusto.

- [ ] **Step 1: Test que falla** — si `inst.decidirAvance()` tira, el canal debe seguir vivo (reagendar próximo ciclo y loguear).

```javascript
test('excepción en decidirAvance no mata el canal', async () => {
  const { engine, instruments, Transport, setClock, nodes } = await harness();
  engine.start();
  let tirado = 0;
  const original = instruments.melodia.decidirAvance.bind(instruments.melodia);
  instruments.melodia.decidirAvance = () => { tirado++; throw new Error('boom'); };
  for (let i = 0; i < 3; i++) {
    setClock((i + 1) * 1536);
    for (const [id, ev] of Transport.events) if (ev.tick <= Transport.ticks) { ev.callback(ev.tick / 192); Transport.events.delete(id); }
  }
  assert.ok(tirado > 0, 'debería haber intentado decidirAvance al menos una vez');
  // Y debería haber agendado el siguiente ciclo igual (events sigue teniendo entradas futuras)
  const futurosDeMelodia = [...Transport.events.values()].filter(ev => !ev.repeat);
  assert.ok(futurosDeMelodia.length > 0, 'el watchdog/recovery debería haber reagendado');
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `node --experimental-vm-modules --test tests/engine.test.js`

- [ ] **Step 3: Implementar**

Envolver el cuerpo del closure del `_scheduleAtTick(finishTick, ...)` en `src/audio/Engine.js:503-517` con try/catch. En el `catch`:
- `console.error('[engine] ciclo falló para', id, err)`.
- Reagendar el próximo ciclo igual: `this._runPatternCycle(id, finishTick, finishTime)` dentro de otro try que loguee si también falla.

- [ ] **Step 4: Correr y verificar**

Run: `node --experimental-vm-modules --test tests/engine.test.js`

- [ ] **Step 5: Commit**

```bash
git add src/audio/Engine.js tests/engine.test.js
git commit -m "fix(engine): closure defensivo en finishTick nunca mata un canal"
```

---

## Task 5: Texto honesto en la tarjeta (reemplazar "—")

**Problema que resuelve:** "—" significa 5 estados distintos. El usuario lo lee como "roto". Hay que ser explícito.

**Files:**
- Modify: `src/ui/PatternReader.js:7` (ampliar PHASES) y `src/ui/PatternReader.js:237` (texto de `card.current`)
- Test: `tests/pattern-reader.test.js` (create)

**Interfaces:**
- Produces: función exportada `formatCardStatus(state): { current: string, kind: 'playing'|'rest'|'waiting'|'suspended'|'ended'|'stopped' }` para poder testearla sin DOM.

- [ ] **Step 1: Test que falla** — para cada phase, texto humano específico.

```javascript
// tests/pattern-reader.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCardStatus } from '../src/ui/PatternReader.js';

test('phase playing con nota muestra el nombre', () => {
  const r = formatCardStatus({ running: true, phase: 'playing', note: 'C4', kind: 'note' });
  assert.match(r.current, /Do4/);
});
test('phase playing con silencio escrito muestra "Silencio"', () => {
  const r = formatCardStatus({ running: true, phase: 'playing', note: null, kind: 'rest' });
  assert.equal(r.current, 'Silencio');
});
test('phase waiting muestra "Escuchando el dato"', () => {
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
test('phase stopped muestra "Detenido"', () => {
  const r = formatCardStatus({ running: false, phase: 'stopped' });
  assert.equal(r.current, 'Detenido');
});
```

- [ ] **Step 2: Correr y verificar que falla** (función no existe).

Run: `node --experimental-vm-modules --test tests/pattern-reader.test.js`

- [ ] **Step 3: Implementar**

En `src/ui/PatternReader.js`:
1. Exportar nueva función `formatCardStatus(state)` que devuelve `{ current, kind }` siguiendo los asserts de arriba. Usa `scoreNoteName` para la nota; "Do4" en lugar de "C4".
2. Reemplazar la línea 237 por: `card.current.textContent = formatCardStatus(state).current;`.
3. Mantener compatibilidad con el uso actual de PHASES para el `status` del aria-label.

- [ ] **Step 4: Correr tests**

Run: `node --experimental-vm-modules --test tests/pattern-reader.test.js`

- [ ] **Step 5: Smoke manual** — `npm run dev`, abrir el browser, apretar Play, verificar que Melodía al arrancar dice "Escuchando" y no "—". Reportar brevemente.

- [ ] **Step 6: Commit**

```bash
git add src/ui/PatternReader.js tests/pattern-reader.test.js
git commit -m "feat(ui): texto honesto en tarjeta (Escuchando/Respirando/etc.) reemplaza '—'"
```

---

## Task 6: Primer minuto garantizado para Melodía

**Problema que resuelve:** si `noticias` no entrega en el primer fetch, Melodía arranca muda y el usuario se va antes del segundo fetch (15 min).

**Files:**
- Modify: `src/audio/Engine.js` — en `_runPatternCycle`, antes de la rama `waiting`, verificar si el canal está en "primer minuto" y forzar SONANDO si corresponde.
- Test: `tests/engine.test.js`

**Interfaces:** sin nueva superficie pública.

- [ ] **Step 1: Test que falla**

```javascript
test('melodia arranca sonando aunque magnitud sea 0 en el primer minuto', async () => {
  const { engine, instruments, setClock, Transport } = await harness();
  // simular adapter con magnitud 0
  instruments.melodia.estado = 'ARMADO';
  instruments.melodia.señal = { magnitud: 0, getVerb: () => 0, payloadText: '' };
  engine.start();
  setClock(768); // un compás
  for (const [id, ev] of Transport.events) if (ev.tick <= Transport.ticks) { ev.callback(ev.tick / 192); Transport.events.delete(id); }
  assert.equal(instruments.melodia.estado, 'SONANDO',
    'Melodía debería forzarse a sonar en el primer minuto');
});
```

- [ ] **Step 2: Correr y verificar que falla**

- [ ] **Step 3: Implementar**

En `src/audio/Engine.js`:
- En el método `start()` (línea ~210), tras `Tone.Transport.start()`, guardar `this._startedAtTick = Tone.Transport.ticks`.
- En `_runPatternCycle` tras calcular `ui`, antes de la rama `waiting`:
  - `const elapsedTicks = (Tone.Transport.getTicksAtTime?.(this._audioNow()) ?? Tone.Transport.ticks) - (this._startedAtTick ?? 0);`
  - `const elapsedSeconds = elapsedTicks / Tone.Transport.PPQ / (Tone.Transport.bpm.value / 60);`
  - Si `elapsedSeconds < 60 && (ui.estado === 'DORMIDO' || ui.estado === 'ARMADO')`, llamar `inst.despertar('primer minuto')` y refrescar `ui = inst.getEstadoUI()`.

- [ ] **Step 4: Correr tests**

- [ ] **Step 5: Commit**

```bash
git add src/audio/Engine.js tests/engine.test.js
git commit -m "feat(engine): primer minuto garantizado — todos los canales arrancan sonando"
```

---

## Task 7: Preset default más cálido para Melodía

**Problema que resuelve:** `OBOE` (FMSynth) default es áspero sin articulación; no "canta". El propio comité pidió un preset más voz/pad.

**Files:**
- Modify: `src/audio/presets.js:289` (`DEFAULTS.melodia`)
- Test: no se agrega test — es una elección de default verificable por oído.

**Decisión abierta para el implementer:** elegir entre los siguientes, probar en browser con `npm run dev`:
- `VANGELIS` — pad cálido con cuerpo
- `SPACE_LADY` — voz sintética suave
- `FLAUTA` — más tradicional

**Default recomendado:** `VANGELIS`. Si al reproducir no se percibe como "voz principal" (compite con Cuerdas que también pueden usar pads), caer a `FLAUTA`.

- [ ] **Step 1: Cambiar `DEFAULTS.melodia` a `'VANGELIS'`**

- [ ] **Step 2: `npm run dev`, apretar Play, escuchar 30s. Si Melodía se confunde con Cuerdas, cambiar a `'FLAUTA'` y repetir.**

- [ ] **Step 3: Correr suite de tests por si acaso**

Run: `node --experimental-vm-modules --test tests/*.test.js`

- [ ] **Step 4: Commit**

```bash
git add src/audio/presets.js
git commit -m "chore(presets): default melodia pasa a VANGELIS (más voz, menos aspereza)"
```

---

## Task 8: Medidor de señal en cada tarjeta

**Problema que resuelve:** el usuario no ve por qué un canal toca o se calla. Un medidor delgado hace visible la "respiración" del dato.

**Files:**
- Modify: `src/ui/PatternReader.js` — en `update()`, setear ancho de una barra a partir de `inst.señal?.magnitud`.
- Modify: `src/ui/PatternReader.js` — en la creación de cada card, insertar el elemento `.card-signal-bar` con un `.card-signal-fill`.
- Modify: `src/ui/pattern-reader.css` — estilos de la barra (altura 3px, en la base de la card).

**Interfaces:** sin nueva superficie pública.

- [ ] **Step 1: Agregar el elemento HTML en la construcción de cada card**

Buscar dónde se crean los elementos de card (constructor o método que arma la DOM) y agregar al final del contenedor principal:
```js
const signalBar = element('div', 'card-signal-bar');
const signalFill = element('div', 'card-signal-fill');
signalBar.append(signalFill);
```
Guardar la referencia en `card.signalFill`.

- [ ] **Step 2: Actualizar el ancho en `update()`**

Dentro del loop por card, agregar:
```js
const mag = this.instrumentos[id].señal?.magnitud ?? 0;
card.signalFill.style.width = `${Math.max(0, Math.min(1, mag)) * 100}%`;
```

- [ ] **Step 3: CSS en `src/ui/pattern-reader.css`**

Agregar:
```css
.card-signal-bar { position: relative; height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 8px; overflow: hidden; }
.card-signal-fill { height: 100%; background: currentColor; opacity: 0.6; transition: width 0.3s ease; }
```
(usa `currentColor` para que herede el color del canal).

- [ ] **Step 4: `npm run dev`, verificar visualmente que las 3 barras se mueven y la de Melodía ya no queda en 0.**

- [ ] **Step 5: Correr suite**

- [ ] **Step 6: Commit**

```bash
git add src/ui/PatternReader.js src/ui/pattern-reader.css
git commit -m "feat(ui): medidor de señal visible en cada tarjeta"
```

---

## Task 9: Mostrar el dato fuente en la tarjeta

**Problema que resuelve:** el usuario no ve qué titular / temperatura / cambio % está moviendo la música. Sin esto, el "data-driven" es invisible.

**Files:**
- Modify: `src/ui/PatternReader.js` — nuevo subelemento `.card-source` que muestra `inst.señal?.payloadText`, recortado a 80 caracteres.
- Modify: `src/ui/pattern-reader.css` — estilo chico, opacidad baja, una línea.

**Interfaces:** sin nueva superficie pública.

- [ ] **Step 1: Agregar elemento en la construcción de card**

```js
const sourceLabel = element('div', 'card-source');
```
Insertarlo debajo de `card.current` (la nota). Guardar referencia en `card.sourceLabel`.

- [ ] **Step 2: Actualizar en `update()`**

```js
const raw = this.instrumentos[id].señal?.payloadText ?? '';
card.sourceLabel.textContent = raw.length > 80 ? raw.slice(0, 77) + '…' : raw;
```

- [ ] **Step 3: CSS**

```css
.card-source { font-size: 10px; opacity: 0.45; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.02em; }
```

- [ ] **Step 4: `npm run dev`, verificar que Melodía muestra el titular dominante y Cuerdas / Percusión muestran algo tipo "TEMP: 22°C" / "CRIPTOS: +1.2%". Si los payloads son muy largos o poco legibles, mejorar el texto en los adapters correspondientes (fuera del scope de este task — anotar como follow-up).**

- [ ] **Step 5: Correr suite**

- [ ] **Step 6: Commit**

```bash
git add src/ui/PatternReader.js src/ui/pattern-reader.css
git commit -m "feat(ui): tarjeta muestra el dato fuente que mueve cada canal"
```

---

## Verificación final (post-task 9)

- [ ] `npm run dev`, apretar Play, esperar 2 minutos. Verificar:
  - Las 3 tarjetas pasan a "Escuchando" al inicio, luego a nota concreta o "Silencio" / "Respirando".
  - Ninguna se queda en "Escuchando" > 20s sin cambio (el watchdog debería reactivar antes).
  - Los medidores de señal se mueven.
  - Los sources muestran texto.
  - DevTools Console: 0 errores rojos.
- [ ] Correr suite completa final:
  ```
  node --experimental-vm-modules --test tests/*.test.js
  ```
- [ ] Reportar al usuario: commits, tests verdes, resultado del smoke, pendientes conocidos (el ítem #8 del análisis, "frases melódicas con arco", queda pendiente de spec propio).
