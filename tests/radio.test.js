import test from 'node:test';
import assert from 'node:assert/strict';
import { RadioPlayer } from '../src/audio/RadioPlayer.js';

const stations = [{ nombre: 'A', url: 'https://a' }, { nombre: 'B', url: 'https://b' }];
function harness(behaviors = ['play'], timeout = 30) {
  const audios = [], nodes = [], states = [];
  function node() {
    const param = () => ({ value: 0, setTargetAtTime(v) { this.value = v; }, cancelScheduledValues() {}, setValueAtTime(v) { this.value = v; } });
    const n = { frequency: param(), gain: param(), delayTime: param(), connections: [],
      connect(other) { this.connections.push(other); }, disconnect() { this.connections = []; } };
    nodes.push(n); return n;
  }
  const ctx = { currentTime: 0, destination: {}, resume: async () => {}, createBiquadFilter: node,
    createGain: node, createDelay: node, createMediaElementSource: node };
  const player = new RadioPlayer(stations, s => states.push(s), {
    timeout, createContext: () => ctx,
    createAudio: () => {
      const behavior = behaviors[audios.length] || 'play';
      const a = new EventTarget();
      a.play = () => {
        if (behavior === 'fail') return Promise.reject(new Error('offline'));
        if (behavior === 'play') queueMicrotask(() => a.dispatchEvent(new Event('playing')));
        return Promise.resolve();
      };
      a.pause = () => { a.paused = true; };
      a.removeAttribute = () => { a.src = ''; }; a.load = () => {};
      audios.push(a); return a;
    },
  });
  return { player, audios, nodes, states, ctx };
}

test('effects use a single media source, dry + echo paths, and preserve pre-play settings', async () => {
  const { player: p, audios } = harness();
  p.set('highpass', 900); p.set('delay', 0.3); p.set('volume', 0.2);
  await p.start();
  assert.equal(audios[0].crossOrigin, 'anonymous');
  assert.equal(p.hp.frequency.value, 900);
  assert.equal(p.master.gain.value, 0.2);
  assert.equal(p.delay.delayTime.value, 0.3);
  assert.equal(p.wet.gain.value, 0.4);
  assert.deepEqual(p.lp.connections, [p.master, p.delay]);
  assert.deepEqual(p.feedback.connections, [p.delay]);
  p.set('delay', 0); assert.equal(p.wet.gain.value, 0);
  p.stop(); assert.equal(p.master.gain.value, 0); assert.equal(audios[0].paused, true);
});

test('failed station falls back; exhausting the list stops with an error', async () => {
  const h = harness(['fail', 'play']); await h.player.start();
  assert.equal(h.audios.length, 2); assert.equal(h.states.at(-1).state, 'playing');
  assert.equal(h.audios[0].paused, true); h.player.stop();
  const failed = harness(['fail', 'fail']); await failed.player.start();
  assert.equal(failed.audios.length, 2); assert.equal(failed.states.at(-1).state, 'error');
  assert.equal(failed.player.active, false);
});

test('unresponsive streams time out and stop after bounded retries', async () => {
  const h = harness(['hang', 'hang'], 5); await h.player.start();
  assert.equal(h.audios.length, 2); assert.equal(h.states.at(-1).state, 'error');
});

test('stop cancels a pending connection; stale events cannot restart it', async () => {
  const h = harness(['hang']); const pending = h.player.start();
  await Promise.resolve();
  const old = h.audios[0]; h.player.stop();
  old.dispatchEvent(new Event('playing')); old.dispatchEvent(new Event('error'));
  await pending;
  assert.equal(h.states.at(-1).state, 'idle'); assert.equal(h.player.active, false);
});

test('rapid station changes cancel the old attempt and keep only one source', async () => {
  const h = harness(['hang', 'play']); const first = h.player.start();
  await Promise.resolve(); const second = h.player.start();
  await Promise.all([first, second]);
  assert.equal(h.audios[0].paused, true); assert.equal(h.states.at(-1).state, 'playing');
  assert.equal(h.audios.length, 2); h.player.stop();
});

test('stop while audio context resumes does not begin playback', async () => {
  const h = harness(); let resume;
  h.ctx.resume = () => new Promise(resolve => { resume = resolve; });
  const pending = h.player.start(); h.player.stop(); resume(); await pending;
  assert.equal(h.audios.length, 0); assert.equal(h.player.active, false);
});


test('zero volume silences both paths and survives random changes', async () => {
  const { player: p } = harness();
  p.set('delay', 0.5); await p.start();
  p.set('volume', 0);
  assert.equal(p.master.gain.value, 0);
  assert.ok(p.wet.connections.includes(p.master));
  const previous = p.index;
  await p.start({ random: true });
  assert.notEqual(p.index, previous);
  assert.equal(p.master.gain.value, 0);
  p.stop(); await p.start();
  assert.equal(p.master.gain.value, 0);
  p.set('volume', 0.4); assert.equal(p.master.gain.value, 0.4);
  p.stop();
});

test('play after stop keeps the selected station; random starts a different one', async () => {
  const { player: p, states } = harness();
  await p.start(); const previous = p.index;
  p.stop(); await p.start(); assert.equal(p.index, previous);
  p.stop(); const pending = p.start({ random: true });
  assert.equal(states.at(-1).state, 'loading');
  await pending; assert.notEqual(p.index, previous); p.stop();
});
