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

  patchSynth(id, changes) {
    try { this.synths[id]?.set(changes); } catch (_) {}
    this._customPresets = this._customPresets || {};
    if (!this._customPresets[id]) this._customPresets[id] = this._snapshotPreset(id);
    _mergeConfig(this._customPresets[id].config, changes);
  }

  patchFilter(id, freq) {
    this._customPresets = this._customPresets || {};
    if (!this._customPresets[id]) this._customPresets[id] = this._snapshotPreset(id);
    this._customPresets[id]._filterBase = freq;
    try { if (this.filtros[id]) this.filtros[id].frequency.value = freq; } catch (_) {}
  }

  patchSynthType(id, tipo, params) {
    const vol = this.instrumentos[id]?._volumenDb ?? -18;
    this._buildSynth(id, { tipo, config: params, volume: vol });
  }

  _snapshotPreset(id) {
    const preset = PRESETS[this._presetKeys?.[id]] || PRESETS.VANGELIS;
    return {
      tipo:   preset.tipo || 'Synth',
      config: JSON.parse(JSON.stringify(preset.config || {})),
      volume: this.instrumentos[id]?._volumenDb ?? preset.volume ?? -18,
    };
  }

  _buildSynth(id, presetKeyOrObj) {
    // Liberar toda la cadena anterior antes de reconstruir el timbre.
    if (this.synths[id]) { try { this.synths[id].dispose(); } catch (_) {} }
    if (this.localEffects?.[id]) {
      this.localEffects[id].forEach(node => {
        try { node.dispose(); } catch (_) {}
      });
    }

    const isCustom = typeof presetKeyOrObj === 'object' && presetKeyOrObj !== null;
    const preset = isCustom ? presetKeyOrObj : (PRESETS[presetKeyOrObj] || PRESETS.VANGELIS);
    if (isCustom) {
      this._customPresets = this._customPresets || {};
      this._customPresets[id] = preset;
    }
    
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
    
    // Highshelf para BRILLO (brightness del canal)
    const brightFilter = new Tone.Filter({ type: 'highshelf', frequency: 3000, gain: 0 });
    chain.push(brightFilter);
    this.brightFilters = this.brightFilters || {};
    this.brightFilters[id] = brightFilter;

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
    if (!isCustom) this._presetKeys[id] = presetKeyOrObj;
    // El synth nuevo ya tiene el tipo correcto; registrar para evitar set redundante.
    this._lastOscType = this._lastOscType || {};
    this._lastOscType[id] = preset.config?.oscillator?.type ?? null;
  }

  cambiarPreset(id, presetKey) {
    if (!PRESETS[presetKey]) return;
    if (this.instrumentos[id]) this.instrumentos[id]._presetKey = presetKey;
    if (this._customPresets) delete this._customPresets[id];
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

      // MUTA → filtro cutoff (el panel de síntesis puede fijar un piso manual)
      const filterBase = this._customPresets?.[id]?._filterBase ?? 900;
      const mutaAmt   = Math.max(ui.muta, inst._manualMuta ?? 0);
      const cutoff    = filterBase + mutaAmt * Math.max(0, 14400 - filterBase);
      this.filtros[id].frequency.rampTo(cutoff, 0.3);

      const presetConf = (this._customPresets?.[id] || PRESETS[this._presetKeys?.[id]])?.config || {};
      const presetParams = {
        attack:         presetConf.envelope?.attack ?? 0.1,
        decay:          presetConf.envelope?.decay ?? 0.5,
        sustain:        presetConf.envelope?.sustain ?? 0.5,
        release:        presetConf.envelope?.release ?? 1.0,
        filterCut:      cutoff,
        harmonicity:    presetConf.harmonicity ?? 1,
        modIndex:       presetConf.modulationIndex ?? 5,
        oscillatorType: presetConf.oscillator?.type,
      };

      // Cuarto Músico: VAE de timbre modula parámetros de síntesis
      const vaeParams = cuartoMusico.getTimbreIA(inst, this.sala);
      // Tipo de oscilador deseado: VAE cuando influencia > 50%, preset en otro caso.
      // Se setea SOLO cuando cambia para evitar que Tone.js recree el nodo en cada pulse
      // (bug: 'triangle8' ≠ 'fat8triangle' internamente → clack cada 8va nota).
      let desiredOscType = presetParams.oscillatorType ?? null;
      if (vaeParams) {
        cuartoMusico.aplicarTimbre(this.synths[id], this.filtros[id], vaeParams, presetParams);
        if (vaeParams._influence > 0.5 && vaeParams._oscName) desiredOscType = vaeParams._oscName;
      } else {
        cuartoMusico.restaurarTimbre(this.synths[id], this.filtros[id], presetParams);
      }
      if (!this._lastOscType) this._lastOscType = {};
      if (desiredOscType && desiredOscType !== this._lastOscType[id]) {
        try { this.synths[id].set({ oscillator: { type: desiredOscType } }); } catch (_) {}
        this._lastOscType[id] = desiredOscType;
      }

      // GLIDE (portamento entre notas)
      try { this.synths[id].set({ portamento: inst._glideTime ?? 0 }); } catch (_) {}

      // BRILLO (highshelf gain para calidez/brillo del canal)
      if (this.brightFilters?.[id]) {
        try { this.brightFilters[id].set({ gain: inst._brilloGain ?? 0 }); } catch (_) {}
      }

      // Volumen base + ajuste por estado y audibilidad
      const preset   = this._customPresets?.[id] || PRESETS[this._presetKeys?.[id]] || {};
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

function _mergeConfig(target, changes) {
  for (const key of Object.keys(changes)) {
    const val = changes[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      target[key] = target[key] || {};
      _mergeConfig(target[key], val);
    } else {
      target[key] = val;
    }
  }
}
