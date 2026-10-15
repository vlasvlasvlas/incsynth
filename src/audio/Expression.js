import { PRESETS } from './presets.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Voces: [0] cuerdas (rol:pad)  [1] percusion (rol:articulado)  [2] melodia (rol:melodico)
// Cada preset en su posición respeta el rol del instrumento (ver presets.js campo 'roles').
// Referencia: grabación CBS 1968 (cuerdas/pad + marimba-vibráfono + viento melódico).
// Curva dinámica basada en análisis de patrones In C (Riley 1964):
// grabaciones CBS 1968 / Bang on a Can 2008. Densidad real por zona de patrones.
export const STAGES = [
  { from: 1,  name: 'Apertura',           energy: 0.22, presets: ['FLAUTA',  'VIBRAFONO', 'OBOE'      ] },
  { from: 7,  name: 'Primer movimiento',  energy: 0.42, presets: ['ARCO',    'PIZZ',      'VANGELIS'  ] },
  { from: 15, name: 'Remanso',            energy: 0.28, presets: ['PAD',     'VIBRAFONO', 'THEREMIN'  ] },
  { from: 18, name: 'Escalera',           energy: 0.55, presets: ['ARCO',    'PIZZ',      'OBOE'      ] },
  { from: 27, name: 'Consolidación',      energy: 0.48, presets: ['FLAUTA',  'CAMPANA',   'VANGELIS'  ] },
  { from: 31, name: 'Segundo desarrollo', energy: 0.68, presets: ['ARCO',    'CAMPANA',   'OBOE'      ] },
  { from: 36, name: 'Clímax',             energy: 0.82, presets: ['VOCODER', 'GAMELAN',   'THEREMIN'  ] },
  { from: 41, name: 'Plenitud',           energy: 0.75, presets: ['PAD',     'GAMELAN',   'THEREMIN'  ] },
  { from: 48, name: 'Disolución',         energy: 0.28, presets: ['PAD',     'VIBRAFONO', 'VANGELIS'  ] },
];
export function createExpressionSettings() {
  return {
    enabled: true, amount: 0.7, breaths: true, pulse: true, space: true,
    exposure: true, timbres: 'tramos', dwell: 120, randomMinutes: 5,
    ending: 'coda', codaSeconds: 36, intermissionSeconds: 20,
    stages: STAGES.map(s => ({ ...s, presets: [...s.presets] })),
  };
}

// Separate seeded stream: rendering and the existing decision RNG cannot consume it.
export function expressionRandom(seed = 0x1ac53) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let n = Math.imul(state ^ state >>> 15, 1 | state);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

export class Expression {
  constructor(ids, settings = createExpressionSettings(), random = expressionRandom()) {
    this.ids = [...ids];
    this.settings = settings;
    this.random = random;
    this.reset();
  }

  reset() {
    this.elapsed = 0;
    this.lastTime = null;
    this.codaAt = null;
    this.ended = false;
    this.voices = Object.fromEntries(this.ids.map((id, i) => [id, {
      exposure: 0, sounding: false, restUntil: 0, reentryAt: -100,
      nextRest: 65 + i * 28, lastChange: -this.settings.dwell, nextRandom: null,
      stage: -1, reason: 'timbre inicial',
    }]));
    this.snapshot = { stage: 'Apertura', energy: 0.28, voices: {}, reverb: 0.18,
      pulseGain: 1, kickGain: 1, pulseAttack: 0.002, ended: false };
  }

  pause() { this.lastTime = null; }

  stageIndex(position) {
    const number = position + 1;
    let index = 0;
    this.settings.stages.forEach((stage, i) => { if (number >= stage.from) index = i; });
    return index;
  }

  update(time, instruments, lastPosition = 52) {
    const dt = this.lastTime === null ? 0 : clamp(time - this.lastTime, 0, 2);
    this.lastTime = time;
    this.elapsed += dt;
    const enabled = this.settings.enabled;
    const amount = enabled ? clamp(this.settings.amount, 0, 1) : 0;
    const positions = this.ids.map(id => instruments[id]?.posicion ?? 0);
    const stage = this.settings.stages[this.stageIndex(positions.reduce((a, b) => a + b, 0) / Math.max(1, positions.length))];
    // Ending belongs to the performance, independently of timbre automation.
    if (this.codaAt === null && positions.every(p => p >= lastPosition)) this.codaAt = this.elapsed;
    const codaAge = this.codaAt === null ? 0 : this.elapsed - this.codaAt;
    const codaGain = this.codaAt === null ? 1 : clamp(1 - codaAge / this.settings.codaSeconds, 0, 1);
    this.ended = this.codaAt !== null && codaGain === 0;
    const eligible = this.ids.filter(id => {
      const inst = instruments[id];
      return inst && !['DORMIDO', 'ARMADO', 'DESCANSANDO'].includes(inst.estado)
        && this.voices[id].sounding
        && (!enabled || this.voices[id].restUntil <= this.elapsed);
    });
    const leader = eligible[Math.floor(this.elapsed / 85) % Math.max(1, eligible.length)];
    const energy = stage.energy;
    const voices = {};
    for (const [i, id] of this.ids.entries()) {
      const state = this.voices[id];
      const sounding = state.sounding && eligible.includes(id) && !this.ended;
      // Exposure is a compositional proxy, not a measurement of listener fatigue.
      const previous = this.snapshot.voices[id];
      const load = sounding ? (0.5 + (previous?.brightness ?? 0.5) * 0.5) : -1.2;
      state.exposure = clamp(state.exposure + dt * load, 0, 180);
      const recovery = this.settings.exposure ? clamp((state.exposure - 55) / 100, 0, 1) : 0;
      const foreground = id === leader;
      const wave = Math.sin(this.elapsed / (19 + i * 7) + i * 2) * 0.07;
      const intensity = clamp(energy + wave - recovery * 0.35, 0, 1);
      const resting = enabled && this.settings.breaths && state.restUntil > this.elapsed;
      const reentry = clamp((this.elapsed - state.reentryAt) / 8, 0, 1);
      voices[id] = {
        state: resting ? 'Descanso de frase' : recovery > 0.35 ? 'Recuperación' : foreground && intensity > 0.6 ? 'Intenso' : 'Presencia',
        foreground, resting, exposure: state.exposure,
        gainDb: amount * (-2 - (1 - intensity) * 4 - (foreground ? 0 : 3) - recovery * 3 - (1 - reentry) * 7) || 0,
        brightness: 1 - amount * (0.18 + (1 - intensity) * 0.46 + recovery * 0.18),
        attackScale: 1 + amount * ((1 - intensity) * 0.8 + recovery),
        releaseScale: 1 - amount * (0.15 + (eligible.length / Math.max(1, this.ids.length)) * 0.25 + recovery * 0.25),
        sustainScale: 1 - amount * (0.15 + recovery * 0.25),
        modulationScale: 1 - amount * ((1 - intensity) * 0.35 + recovery * 0.25),
        codaGain, reason: state.reason,
      };
    }
    this.snapshot = {
      stage: this.ended ? 'Reposo' : this.codaAt !== null ? 'Coda compartida' : stage.name,
      energy, voices, ended: this.ended, elapsed: this.elapsed,
      reverb: this.settings.space && enabled ? 0.14 + (1 - eligible.length / Math.max(1, this.ids.length)) * 0.22 : null,
      pulseGain: (this.settings.pulse ? 1 - amount * (0.25 + (1 - energy) * 0.55) : 1) * codaGain,
      kickGain: (this.settings.pulse ? 1 - amount * (energy < 0.5 ? 0.95 : 0.3) : 1) * codaGain,
      pulseAttack: 0.002 + (this.settings.pulse ? amount * (1 - energy) * 0.012 : 0),
    };
    return this.snapshot;
  }

  // Called only at a phrase boundary; a rest never cuts a figure in flight.
  phrase(id, instruments, currentPreset, automatic = true) {
    const s = this.voices[id];
    if (!this.settings.enabled) { s.restUntil = 0; return { rest: false, preset: null }; }
    const canRest = this.settings.breaths && this.codaAt === null;
    if (!canRest) s.restUntil = 0;
    if (s.restUntil > 0 && this.elapsed >= s.restUntil) {
      s.restUntil = 0;
      s.reentryAt = this.elapsed;
    }
    const others = this.ids.filter(other => other !== id);
    const othersAvailable = others.some(other => this.voices[other].sounding
      && this.voices[other].restUntil <= this.elapsed
      && !['DORMIDO', 'ARMADO', 'DESCANSANDO'].includes(instruments[other]?.estado));
    const someoneResting = others.some(other => this.voices[other].restUntil > this.elapsed);
    if (canRest && !s.restUntil && this.elapsed >= s.nextRest && othersAvailable && !someoneResting) {
      s.restUntil = this.elapsed + 8 + this.random() * 12;
      s.nextRest = s.restUntil + 70 + this.random() * 50;
    }
    const index = this.stageIndex(instruments[id].posicion);
    let preset = null;
    const mode = this.settings.timbres;
    if (automatic && this.codaAt === null && this.elapsed - s.lastChange >= this.settings.dwell) {
      if ((mode === 'tramos' || mode === 'mixto') && index !== s.stage) {
        preset = this.settings.stages[index].presets[this.ids.indexOf(id)];
        s.stage = index;
        s.reason = `tramo desde patrón ${this.settings.stages[index].from}`;
      } else if (mode === 'azar' || mode === 'mixto') {
        if (s.nextRandom === null) s.nextRandom = this.elapsed + this._randomDelay();
        if (this.elapsed >= s.nextRandom) {
          const candidates = [...new Set(this.settings.stages.map(stage => stage.presets[this.ids.indexOf(id)]))]
            .filter(key => key !== currentPreset && PRESETS[key]);
          preset = candidates[Math.floor(this.random() * candidates.length)] || null;
          s.nextRandom = this.elapsed + this._randomDelay();
          s.reason = 'variación aleatoria al terminar la frase';
        }
      }
    }
    if (preset && PRESETS[preset] && preset !== currentPreset) {
      s.lastChange = this.elapsed;
      return { rest: s.restUntil > this.elapsed, preset };
    }
    return { rest: s.restUntil > this.elapsed, preset: null };
  }

  _randomDelay() {
    return Math.max(this.settings.dwell, -Math.log(Math.max(1e-6, 1 - this.random())) * this.settings.randomMinutes * 60);
  }

  markSounding(id, sounding) { this.voices[id].sounding = sounding; }
  resumeAutomatic(id) {
    const state = this.voices[id];
    state.stage = -1;
    state.nextRandom = null;
    state.lastChange = this.elapsed - this.settings.dwell;
  }
  shouldLoop() {
    return this.ended && this.settings.ending === 'loop'
      && this.elapsed - this.codaAt >= this.settings.codaSeconds + this.settings.intermissionSeconds;
  }
}
