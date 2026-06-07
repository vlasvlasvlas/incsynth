import * as Tone from 'tone';
import { Pulse }   from './Pulse.js';
import { PRESETS, DEFAULTS } from './presets.js';
import { ESTADOS } from '../logic/StateMachine.js';
import * as cuartoMusico from '../ai/cuartoMusico.js';

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
    this._lastBpm      = 70;
    this._transportEvents = new Set();
    this._patternEvents = {};
    this._pulseEvent = null;

    // Reverb compartida contenida para mantener legible la grilla.
    this._reverb = new Tone.Reverb({ decay: 2.8, wet: 0.12 }).toDestination();
    this._reverbReady = this._reverb.generate();

    // Construir un synth por instrumento según su preset por defecto
    for (const id in config.instrumentos) {
      const presetKey = instrumentos[id]?._presetKey || DEFAULTS[id] || 'ARCO';
      this._buildSynth(id, presetKey);
    }
  }

  _buildSynth(id, presetKey) {
    // Liberar toda la cadena anterior antes de reconstruir el timbre.
    if (this.synths[id]) { try { this.synths[id].dispose(); } catch (_) {} }
    if (this.localEffects?.[id]) {
      this.localEffects[id].forEach(node => {
        try { node.dispose(); } catch (_) {}
      });
    }

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

    synth.volume.value = this.instrumentos[id]?._volumenDb ?? preset.volume ?? -18;
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
    if (this._running) return;
    await Tone.start();
    await this._reverbReady; // asegurar que el impulse response esté listo
    this._running = true;
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    Tone.Transport.position = 0;
    Tone.Transport.bpm.value = this._lastBpm;
    this._schedulePulse();

    let idx = 0;
    for (const id in this.instrumentos) {
      this.instrumentos[id].sala.registrarInstrumento(id, 0);
      this.instrumentos[id].reiniciarMaduracion?.();
      const startTick = this._notationToTicks('8n') * idx;
      this._schedulePatternCycle(id, startTick);
      idx++;
    }
    Tone.Transport.start('+0.08');
  }

  stop() {
    this._running = false;
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    this._transportEvents.clear();
    this._patternEvents = {};
    this._pulseEvent = null;
  }

  _schedulePulse() {
    this._pulseEvent = Tone.Transport.scheduleRepeat(time => {
      if (!this._running) return;
      this._pulse.triggerAt(time);
      this.sala.pulso();
      this._actualizarSintesis();
    }, '8n', 0);
    this._transportEvents.add(this._pulseEvent);
  }

  _actualizarSintesis() {
    const mom = this.sala.getMomentum();
    // El momentum abre el espacio sin borrar articulación.
    // Rango expresivo: 0.12 (sala seca/quieta) a 0.65 (sala mojada/activa)
    this._reverb.wet.rampTo(0.12 + mom * 0.53, 0.5);

    for (const id in this.instrumentos) {
      const inst = this.instrumentos[id];
      const ui   = inst.getEstadoUI();
      if (!this.synths[id]) continue;

      // MUTA → filtro cutoff
      const cutoff = 900 + Math.max(ui.muta, inst._manualMuta ?? 0) * 13500;
      this.filtros[id].frequency.rampTo(cutoff, 0.3);

      // Cuarto Músico: VAE de timbre modula parámetros de síntesis
      const vaeParams = cuartoMusico.getTimbreIA(inst, this.sala);
      if (vaeParams) {
        const presetConf = PRESETS[this._presetKeys?.[id]]?.config || {};
        cuartoMusico.aplicarTimbre(this.synths[id], this.filtros[id], vaeParams, {
          attack:      presetConf.envelope?.attack ?? 0.1,
          decay:       presetConf.envelope?.decay ?? 0.5,
          sustain:     presetConf.envelope?.sustain ?? 0.5,
          release:     presetConf.envelope?.release ?? 1.0,
          filterCut:   cutoff,
          harmonicity: presetConf.harmonicity ?? 1,
          modIndex:    presetConf.modulationIndex ?? 5,
        });
      }

      // Volumen base + ajuste por estado y audibilidad
      const preset   = PRESETS[this._presetKeys?.[id]] || {};
      let   volBase  = inst._volumenDb ?? (preset.volume ?? -18);
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

  _notationToTicks(notation) {
    return Math.max(1, Math.round(Tone.Time(notation).toTicks()));
  }

  _patternDurationTicks(patron) {
    const ticks = patron.reduce((sum, event) => sum + this._notationToTicks(event.duracion), 0);
    return Math.max(this._notationToTicks('16n'), ticks);
  }

  _scheduleAtTick(tick, callback, ownerId = null) {
    let eventId = null;
    eventId = Tone.Transport.scheduleOnce(time => {
      this._transportEvents.delete(eventId);
      if (ownerId) this._patternEvents[ownerId]?.delete(eventId);
      if (this._running) callback(time);
    }, `${Math.max(0, Math.round(tick))}i`);
    this._transportEvents.add(eventId);
    if (ownerId) {
      this._patternEvents[ownerId] ||= new Set();
      this._patternEvents[ownerId].add(eventId);
    }
    return eventId;
  }

  _schedulePatternCycle(id, startTick) {
    if (!this._running) return;
    this._scheduleAtTick(startTick, startTime => {
      this._runPatternCycle(id, startTick, startTime);
    }, id);
  }

  _runPatternCycle(id, startTick, startTime) {
    if (!this._running) return;
    const inst = this.instrumentos[id];
    inst.tick();
    const ui = inst.getEstadoUI();

    if (ui.estado === ESTADOS.DORMIDO) {
      this._schedulePatternCycle(id, startTick + this._notationToTicks('1m'));
      return;
    }
    if (inst.posicion >= this.patrones.length) return;

    const patron = this.patrones[inst.posicion];
    const durationTicks = this._patternDurationTicks(patron);
    let offsetTicks = 0;

    for (const ev of patron) {
      // Silencio voluntario: Riley permite descansos internos dentro de un
      // patrón. El verbo RETIENE modula la probabilidad de omitir notas.
      const retiene = inst._verbos?.RETIENE ?? 0;
      const skipChance = retiene * 0.25;
      const skip = Math.random() < skipChance;
      if (ev.nota && ui.estado !== ESTADOS.DESCANSANDO && !skip) {
        const noteTick = startTick + offsetTicks;
        const trigger = time => {
          try {
            this.synths[id]?.triggerAttackRelease(ev.nota, ev.duracion, time);
          } catch (_) {}
        };
        if (offsetTicks === 0) trigger(startTime);
        else this._scheduleAtTick(noteTick, trigger, id);
      }
      offsetTicks += this._notationToTicks(ev.duracion);
    }

    const finishTick = startTick + durationTicks;
    this._scheduleAtTick(finishTick, finishTime => {
      if (inst.posicion >= this.patrones.length) return;
      const avanzo = inst.decidirAvance();
      if (this.onCiclo) this.onCiclo(id, inst.posicion, avanzo, inst.getEstadoUI());
      // El siguiente ciclo hereda el timestamp exacto del límite anterior.
      this._runPatternCycle(id, finishTick, finishTime);
    }, id);
  }

  // Transport conserva la posición musical al cambiar BPM.
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
    for (const id in this.localEffects || {}) {
      if (this.localEffects[id]) {
        this.localEffects[id].forEach(fx => {
          try { fx.dispose(); } catch(e){}
        });
      }
    }
  }
}
