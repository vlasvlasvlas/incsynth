import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { Expression } from '../src/audio/Expression.js';
import { LaSala } from '../src/logic/LaSala.js';

async function harness() {
  let now = 0, idCounter = 0, pendingStart = null;
  const nodes = [], events = new Map();
  class Param {
    constructor(value = 0) { this.value = value; }
    rampTo(value) { assert.ok(!Number.isNaN(value)); this.value = value; }
  }
  class Node {
    constructor(config = {}) {
      this.config = config; this.volume = new Param(); this.frequency = new Param(8000);
      this.gain = new Param(typeof config === 'number' ? config : 1); this.wet = new Param();
      this.attacks = []; this.disposed = false; nodes.push(this);
    }
    connect() { assert.equal(this.disposed, false); return this; }
    toDestination() { return this; }
    start() { return this; }
    generate() { return Promise.resolve(); }
    set(patch) { assert.equal(this.disposed, false); this.config = { ...this.config, ...patch }; }
    triggerAttackRelease(...args) { assert.equal(this.disposed, false); this.attacks.push(args); }
    triggerRelease() {}
    releaseAll() {}
    dispose() { this.disposed = true; }
  }
  const Transport = {
    state: 'stopped', ticks: 0, position: 0, bpm: new Param(70),
    start() { this.state = 'started'; },
    scheduleOnce(callback, tick) { const id = ++idCounter; events.set(id, { callback, tick: parseInt(tick), repeat: false }); return id; },
    scheduleRepeat(callback) { const id = ++idCounter; events.set(id, { callback, repeat: true }); return id; },
    clear(id) { events.delete(id); },
    cancel() { throw new Error('Must not cancel another component’s events'); },
  };
  const tone = { Transport, now: () => now, start: () => pendingStart || Promise.resolve(),
    Time: value => ({ toTicks: () => ({ '8n': 96, '16n': 48, '1m': 768, '4n': 192 }[value] || 96) }),
    Synth: Node, FMSynth: Node, AMSynth: Node, MembraneSynth: Node, PolySynth: Node,
    Reverb: Node, Filter: Node, Gain: Node, Chorus: Node, PingPongDelay: Node, AutoFilter: Node,
  };
  const context = vm.createContext({ console, setTimeout, clearTimeout, structuredClone });
  const moduleOf = obj => new vm.SyntheticModule(Object.keys(obj), function() {
    for (const [key,value] of Object.entries(obj)) this.setExport(key,value);
  }, { context });
  const toneModule = moduleOf(tone);
  const ai = moduleOf({ getTimbreIA: () => null, restaurarTimbre: () => {}, aplicarTimbre: () => {} });
  const pulse = new vm.SourceTextModule(await readFile(new URL('../src/audio/Pulse.js', import.meta.url), 'utf8'), { context });
  await pulse.link(() => toneModule);
  const presets = moduleOf(await import('../src/audio/presets.js'));
  const states = moduleOf(await import('../src/logic/StateMachine.js'));
  const expression = moduleOf({ Expression });
  const engineModule = new vm.SourceTextModule(await readFile(new URL('../src/audio/Engine.js', import.meta.url), 'utf8'), { context });
  await engineModule.link(spec => ({ tone: toneModule, './Pulse.js': pulse, './presets.js': presets,
    '../logic/StateMachine.js': states, '../ai/cuartoMusico.js': ai, './Expression.js': expression }[spec]));
  await engineModule.evaluate();
  const sala = new LaSala(53);
  const instruments = {};
  for (const id of ['cuerdas','percusion','melodia']) {
    instruments[id] = { id, sala, posicion: 0, estado: 'SONANDO', _presetKey: 'FLAUTA', _volumenDb: -18,
      _verbos: {}, tick() {}, reiniciarMaduracion() {}, advances: 0,
      decidirAvance() { this.advances++; return false; },
      getEstadoUI() { return { estado: this.estado, muta: 0, audibilidad: 1 }; },
      getVolatilidadGlobal() { return 0; },
    };
  }
  const patterns = Array.from({length:53}, () => [{nota:'C4',duracion:'8n'}]);
  const Engine = engineModule.namespace.AudioEngine;
  const score = new Expression(Object.keys(instruments));
  score.settings.timbres = 'fijo'; score.settings.breaths = false;
  const engine = new Engine({instrumentos: instruments}, patterns, sala, instruments, null, score);
  return { engine, score, instruments, nodes, events, Transport,
    pending() { let resolve; pendingStart = new Promise(r => { resolve = r; }); return resolve; },
    runTick(tick) {
      now = tick / 192; Transport.ticks = tick;
      for (const [id, event] of [...events]) {
        if (!event.repeat && event.tick === tick) { events.delete(id); event.callback(now); }
      }
    },
  };
}

test('stopping during asynchronous start cannot revive disposed nodes', async () => {
  const h = await harness(); const release = h.pending();
  const starting = h.engine.start(); h.engine.dispose(); release(); await starting;
  assert.equal(h.engine._running, false); assert.equal(h.events.size, 0);
  assert.ok(h.nodes.every(node => node.disposed));
});

test('start and stop preserve companion events and current room positions', async () => {
  const h = await harness(); const arp = h.Transport.scheduleRepeat(() => {});
  h.instruments.cuerdas.posicion = 12;
  await h.engine.start();
  assert.equal(h.instruments.cuerdas.sala.instrumentos.cuerdas.posicion, 12);
  h.engine.stop(); assert.ok(h.events.has(arp)); assert.equal(h.events.size, 1);
  h.engine.dispose();
});

test('timbre changes wait for phrase boundary and retire old audio chains', async () => {
  const h = await harness(); await h.engine.start(); h.runTick(0);
  const old = h.engine.synths.cuerdas;
  h.engine.cambiarPreset('cuerdas','ARCO');
  assert.equal(h.engine.synths.cuerdas, old);
  assert.equal(h.instruments.cuerdas._autoTimbre, false);
  h.runTick(96);
  assert.notEqual(h.engine.synths.cuerdas, old);
  assert.equal(h.instruments.cuerdas._presetKey, 'ARCO');
  assert.equal(old.disposed, false);
  assert.equal(h.engine._retiring.size, 1);
  h.engine.dispose(); assert.ok(h.nodes.every(node => node.disposed));
});

test('a phrase rest schedules the next boundary without notes or autonomous advance', async () => {
  const h = await harness(); await h.engine.start();
  h.score.settings.breaths = true;
  h.score.voices.cuerdas.restUntil = 20;
  h.runTick(0);
  assert.equal(h.engine.synths.cuerdas.attacks.length, 0);
  h.runTick(96);
  assert.equal(h.instruments.cuerdas.advances, 0);
  assert.ok(h.events.size > 0);
  h.engine.dispose();
});

test('last figure repeats instead of advancing beyond the score', async () => {
  const h = await harness(); h.instruments.cuerdas.posicion = 52;
  await h.engine.start(); h.runTick(0); h.runTick(96);
  assert.equal(h.instruments.cuerdas.advances, 0);
  assert.equal(h.instruments.cuerdas.posicion, 52);
  assert.ok(h.engine.synths.cuerdas.attacks.length >= 2);
  h.engine.dispose();
});

test('installation reset keeps shared objects and only clears owned pattern events', async () => {
  const h = await harness(); const arp = h.Transport.scheduleRepeat(() => {});
  await h.engine.start(); const room = h.engine.sala;
  h.instruments.melodia.posicion = 52;
  h.engine._newCycle();
  assert.equal(h.engine.sala, room);
  assert.ok(h.events.has(arp));
  assert.deepEqual(Object.values(h.instruments).map(i => i.posicion), [0,0,0]);
  assert.equal(h.engine.sala.getDistanciaMaxima(), 0);
  h.engine.dispose();
});

test('expression never overwrites the chosen volume and all synthesis outputs stay finite', async () => {
  const h = await harness(); await h.engine.start();
  for (let t=0;t<100;t++) h.engine._actualizarSintesis(t);
  assert.equal(h.instruments.cuerdas._volumenDb,-18);
  assert.ok(h.engine.synths.cuerdas.volume.value <= -18);
  assert.ok(Number.isFinite(h.engine.filtros.cuerdas.frequency.value));
  h.engine.dispose();
});

test('edits made after a queued preset selection belong to the new preset', async () => {
  const h = await harness(); await h.engine.start(); h.runTick(0);
  h.engine.cambiarPreset('cuerdas','ARCO');
  h.engine.patchSynth('cuerdas',{envelope:{attack:1.7}});
  h.engine.patchFilter('cuerdas',1800);
  h.runTick(96);
  assert.equal(h.instruments.cuerdas._presetKey,'ARCO');
  assert.equal(h.instruments.cuerdas._customPreset.config.envelope.attack,1.7);
  assert.equal(h.engine._customPresets.cuerdas._filterBase,1800);
  h.engine.dispose();
});

test('changing synth type queues edits coherently and preserves them for restart', async () => {
  const h = await harness(); await h.engine.start(); h.runTick(0);
  h.engine.patchSynthType('cuerdas','FMSynth',{envelope:{attack:0.2}});
  h.engine.patchSynth('cuerdas',{envelope:{release:2.3}});
  h.runTick(96);
  assert.equal(h.instruments.cuerdas._customPreset.tipo,'FMSynth');
  assert.equal(h.instruments.cuerdas._customPreset.config.envelope.release,2.3);
  h.engine.dispose();
});
