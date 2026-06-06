import * as Tone from 'tone';
import { Pulse }   from './Pulse.js';
import { PRESETS, DEFAULTS } from './presets.js';
import { ESTADOS } from '../logic/StateMachine.js';

export class AudioEngine {
  constructor(config, patrones, sala, instrumentos, onCiclo) {
    this.patrones     = patrones;
    this.sala         = sala;
    this.instrumentos = instrumentos;
    this.onCiclo      = onCiclo;
    this.synths       = {};
    this.filtros      = {};
    this._pulse       = new Pulse();
    this._running     = false;
    this._lastBpm      = 96;
    this._patternTimers = {};
    this._pulseTimer = null;

    // Reverb compartido — base 0.35, sube con momentum
    this._reverb = new Tone.Reverb({ decay: 4, wet: 0.35 }).toDestination();
    this._reverb.generate();

    // Construir un synth por instrumento según su preset por defecto
    for (const id in config.instrumentos) {
      const presetKey = instrumentos[id]?._presetKey || DEFAULTS[id] || 'ARCO';
      this._buildSynth(id, presetKey);
    }
  }

  _buildSynth(id, presetKey) {
    // Dispose del synth anterior si existe
    if (this.synths[id]) { try { this.synths[id].dispose(); } catch (_) {} }
    if (this.filtros[id]) { try { this.filtros[id].dispose(); } catch (_) {} }

    const preset = PRESETS[presetKey] || PRESETS.VANGELIS;
    
    // Cadena de efectos local
    const chain = [];
    const filtro = new Tone.Filter(preset.effects?.filterFreq || 8000, preset.effects?.filterType || 'lowpass');
    chain.push(filtro);

    if (preset.effects?.chorus) {
      chain.push(new Tone.Chorus(4, 2.5, 0.5).start());
    }
    if (preset.effects?.delay) {
      chain.push(new Tone.PingPongDelay("8n.", 0.2));
    }
    if (preset.effects?.autoFilter) {
      chain.push(new Tone.AutoFilter("4n").start());
    }
    
    // Conectar cadena al reverb global
    let lastNode = filtro;
    for (let i = 1; i < chain.length; i++) {
      lastNode.connect(chain[i]);
      lastNode = chain[i];
    }
    lastNode.connect(this._reverb);

    this.localEffects = this.localEffects || {};
    this.localEffects[id] = chain;

    let synth;
    try {
      if (preset.tipo === 'AMSynth') {
        synth = new Tone.AMSynth(preset.config);
      } else if (preset.tipo === 'FMSynth') {
        synth = new Tone.FMSynth(preset.config);
      } else if (preset.tipo === 'MembraneSynth') {
        synth = new Tone.MembraneSynth(preset.config);
      } else if (preset.tipo === 'PolySynth') {
        synth = new Tone.PolySynth(Tone.Synth, preset.config);
      } else {
        synth = new Tone.Synth(preset.config);
      }
      synth.connect(filtro);
    } catch (e) {
      synth = new Tone.Synth().connect(filtro);
    }

    synth.volume.value = preset.volume ?? -18;
    this.synths[id]  = synth;
    this.filtros[id] = filtro;
    this._presetKeys = this._presetKeys || {};
    this._presetKeys[id] = presetKey;
  }

  cambiarPreset(id, presetKey) {
    if (!PRESETS[presetKey]) return;
    if (this.instrumentos[id]) this.instrumentos[id]._presetKey = presetKey;
    this._buildSynth(id, presetKey);
  }

  async start() {
    this._running = true;
    Tone.start().catch(() => {});
    Tone.Transport.bpm.value = this._lastBpm;
    Tone.Transport.cancel(0);
    Tone.Transport.start();
    this._startPulseLoop();

    let idx = 0;
    for (const id in this.instrumentos) {
      this.instrumentos[id].sala.registrarInstrumento(id, 0);
      this.instrumentos[id].reiniciarMaduracion?.();
      this._schedulePattern(id, 0.15 + idx * 0.08);
      idx++;
    }
  }

  stop() {
    this._running = false;
    if (this._pulseTimer) {
      clearTimeout(this._pulseTimer);
      this._pulseTimer = null;
    }
    for (const id in this._patternTimers) {
      clearTimeout(this._patternTimers[id]);
    }
    this._patternTimers = {};
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
  }

  _startPulseLoop() {
    const tick = () => {
      if (!this._running) return;
      const now = Tone.now();
      this._pulse.triggerAt(now);
      this.sala.pulso();
      this._actualizarSintesis();
      const delayMs = Math.max(40, Tone.Time('8n').toSeconds() * 1000);
      this._pulseTimer = setTimeout(tick, delayMs);
    };
    tick();
  }

  _actualizarSintesis() {
    const mom = this.sala.getMomentum();
    // Base 0.35 + hasta 0.45 de contagio = max 0.80
    this._reverb.wet.rampTo(0.35 + mom * 0.45, 0.5);

    for (const id in this.instrumentos) {
      const inst = this.instrumentos[id];
      const ui   = inst.getEstadoUI();
      if (!this.synths[id]) continue;

      // MUTA → filtro cutoff
      const cutoff = 900 + Math.max(ui.muta, inst._manualMuta ?? 0) * 13500;
      this.filtros[id].frequency.rampTo(cutoff, 0.3);

      // Volumen base + ajuste por estado y audibilidad
      const preset   = PRESETS[this._presetKeys?.[id]] || {};
      let   volBase  = (preset.volume ?? -18) + (inst._volumenDb ?? 0);
      if (ui.audibilidad < 0.3)  volBase -= 14;
      else if (ui.audibilidad < 0.7) volBase -= 5;
      if (ui.estado === ESTADOS.DESBORDADO)  volBase += 3;
      if (ui.estado === ESTADOS.DESCANSANDO) volBase -= 50;
      if (ui.estado === ESTADOS.PERIFERICO)  volBase -= 8;
      this.synths[id].volume.rampTo(volBase, 0.5);
    }

    // Pulso degradado por máxima volatilidad
    const maxVol = Math.max(0, ...Object.values(this.instrumentos).map(i => i.getVolatilidadGlobal()).filter(isFinite));
    this._pulse.setDegradacion(maxVol);
  }

  _patternDurationBeats(patron) {
    // Calcula la duración de un patrón en beats (quarter notes)
    // Tone.Time convierte "8n", "4n", etc a segundos con el BPM actual,
    // pero en beats es invariante: "8n" = 0.5 beat siempre.
    return patron.reduce((sum, ev) => {
      return sum + Tone.Time(ev.duracion).toBarsBeatsSixteenths()
        // fallback: convertir usando 60/bpm ratio
        .split(':').reduce((acc, part, i) => {
          const factors = [4, 1, 0.25]; // bars=4 beats, beats=1, 16ths=0.25
          return acc + parseFloat(part || 0) * (factors[i] || 0);
        }, 0);
    }, 0);
  }

  _schedulePattern(id, delaySeconds = 0) {
    if (!this._running) return;
    clearTimeout(this._patternTimers[id]);
    this._patternTimers[id] = setTimeout(() => {
      if (!this._running) return;
      const inst = this.instrumentos[id];
      inst.tick();
      const ui = inst.getEstadoUI();

      if (ui.estado === ESTADOS.DORMIDO) {
        this._schedulePattern(id, 2);
        return;
      }
      if (inst.posicion >= this.patrones.length) return;

      const patron = this.patrones[inst.posicion];
      const jitter = ui.estado === ESTADOS.DESBORDADO ? 0.035 : 0;
      const startTime = Tone.now() + 0.03;
      let timeOffset = 0;

      for (const ev of patron) {
        const dur = Tone.Time(ev.duracion).toSeconds();
        if (ev.nota && ui.estado !== ESTADOS.DESCANSANDO) {
          const j = (Math.random() - 0.5) * jitter;
          try { this.synths[id]?.triggerAttackRelease(ev.nota, ev.duracion, startTime + timeOffset + j); }
          catch (_) {}
        }
        timeOffset += dur;
      }

      const finishDelayMs = Math.max(20, timeOffset * 1000);
      this._patternTimers[id] = setTimeout(() => {
        if (!this._running) return;
        if (inst.posicion >= this.patrones.length) return;
      const avanzo = inst.decidirAvance();
        if (this.onCiclo) this.onCiclo(id, inst.posicion, avanzo, inst.getEstadoUI());
        this._schedulePattern(id, 0.02);
      }, finishDelayMs);
    }, Math.max(0, delaySeconds) * 1000);
  }

  // Cambiar BPM de forma segura: el scheduling recursivo usa `t` real,
  // por lo que el cambio se absorbe en el próximo ciclo sin desincronización.
  setBPM(v) {
    this._lastBpm = Math.max(20, Math.min(300, v));
    Tone.Transport.bpm.rampTo(this._lastBpm, 0.1);
  }

  audition(id) {
    const synth = this.synths[id];
    if (!synth) return;
    const now = Tone.now();
    const notas = id === 'percusion' ? ['C2', 'G2'] : ['C4', 'E4', 'G4'];
    try {
      if (Array.isArray(notas) && synth.triggerAttackRelease) {
        notas.forEach((nota, i) => synth.triggerAttackRelease(nota, '8n', now + i * 0.12));
      }
    } catch (_) {}
  }

  dispose() {
    this.stop();
    this._pulse.dispose();
    try { this._reverb.dispose(); } catch (_) {}
    for (const id in this.synths) {
      this.synths[id].dispose();
    }
    for (const id in this.localEffects) {
      if (this.localEffects[id]) {
        this.localEffects[id].forEach(fx => {
          try { fx.dispose(); } catch(e){}
        });
      }
    }
    try { this._reverb.dispose(); } catch (_) {}
  }
}
