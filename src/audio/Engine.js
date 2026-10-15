import * as Tone from 'tone';
import { Pulse }   from './Pulse.js';
import { PRESETS, DEFAULTS } from './presets.js';
import { ESTADOS } from '../logic/StateMachine.js';
import * as cuartoMusico from '../ai/cuartoMusico.js';
import { Expression } from './Expression.js';
import { compilePattern } from './score.js';

export class AudioEngine {
  constructor(config, patrones, sala, instrumentos, onCiclo, expression = null, { masterNode = null } = {}) {
    this.patrones     = patrones;
    this.sala         = sala;
    this.instrumentos = instrumentos;
    this.onCiclo      = onCiclo;
    this.synths       = {};
    this.filtros      = {};
    this._masterNode  = masterNode;
    this._pulse       = new Pulse(masterNode);
    this._running     = false;
    this._lastBpm      = 70;
    this._transportEvents = new Set();
    this._patternEvents = {};
    this._pulseEvent = null;
    this.expression = expression || new Expression(Object.keys(instrumentos));
    this._retiring = new Set();
    this._pendingPresets = {};
    this._disposed = false;
    this._startGeneration = 0;
    this._playback = {};
    this._pendingAdvances = {};
    this._endedAt = null;

    // Reverb compartida contenida para mantener legible la grilla.
    // Si hay bus master compartido, el reverb va ahí (limiter real). Si no, destination.
    const reverb = new Tone.Reverb({ decay: 2.8, wet: 0.12 });
    this._reverb = masterNode ? reverb.connect(masterNode) : reverb.toDestination();
    this._reverbReady = this._reverb.generate();

    // Construir un synth por instrumento según su preset por defecto
    for (const id in config.instrumentos) {
      const presetKey = instrumentos[id]?._pendingPresetKey || instrumentos[id]?._presetKey || DEFAULTS[id] || 'ARCO';
      this._buildSynth(id, instrumentos[id]?._customPreset || presetKey);
      this.instrumentos[id]._presetKey = presetKey;
      delete this.instrumentos[id]._pendingPresetKey;
    }
  }

  _editablePreset(id) {
    this._customPresets ||= {};
    let pending = this._pendingPresets[id];
    if (typeof pending === 'string') {
      pending = { ...structuredClone(PRESETS[pending]), _baseKey: pending };
      this._pendingPresets[id] = pending;
    }
    const preset = pending || this._customPresets[id] || this._snapshotPreset(id);
    if (!pending) this._customPresets[id] = preset;
    this.instrumentos[id]._customPreset = preset;
    this.instrumentos[id]._autoTimbre = false;
    return preset;
  }

  patchSynth(id, changes) {
    const preset = this._editablePreset(id);
    _mergeConfig(preset.config, changes);
    if (!this._pendingPresets[id]) this.synths[id]?.set(changes);
  }

  patchFilter(id, freq) {
    this._editablePreset(id)._filterBase = freq;
    if (this.filtros[id]) this.filtros[id].frequency.value = freq;
  }

  patchSynthType(id, tipo, params) {
    const vol = this.instrumentos[id]?._volumenDb ?? -18;
    this._pendingPresets[id] = { tipo, config: params, volume: vol };
    this.instrumentos[id]._customPreset = this._pendingPresets[id];
    this.instrumentos[id]._autoTimbre = false;
    if (!this._running) this._applyPendingPreset(id);
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
    // Fade old and new channels together; retire old nodes after their tails.
    const old = this.synths[id] ? {
      synth: this.synths[id], nodes: this.localEffects[id], gain: this.channelGains[id],
    } : null;
    if (old) {
      this._releaseSynth(old.synth, Tone.now());
      old.gain.gain.rampTo(0, 2);
      this._retiring.add(old);
      old.timer = setTimeout(() => this._disposeRetired(old), 2500);
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
    this.channelGains ||= {};
    const channelGain = new Tone.Gain(old ? 0 : 1);
    this.channelGains[id] = channelGain;
    lastNode.connect(channelGain);
    channelGain.connect(this._reverb);
    if (old) channelGain.gain.rampTo(1, 2);
    chain.push(channelGain);

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
    this._presetKeys[id] = isCustom ? this.instrumentos[id]._presetKey : presetKeyOrObj;
    // El synth nuevo ya tiene el tipo correcto; registrar para evitar set redundante.
    this._lastOscType = this._lastOscType || {};
    this._lastOscType[id] = preset.config?.oscillator?.type ?? null;
  }

  cambiarPreset(id, presetKey, automatic = false) {
    if (!PRESETS[presetKey]) return;
    const inst = this.instrumentos[id];
    if (!automatic) inst._autoTimbre = false;
    inst._customPreset = null;
    this._pendingPresets[id] = presetKey;
    inst._pendingPresetKey = presetKey;
    if (!this._running) this._applyPendingPreset(id);
  }

  _applyPendingPreset(id) {
    const preset = this._pendingPresets[id];
    if (!preset) return;
    delete this._pendingPresets[id];
    delete this.instrumentos[id]._pendingPresetKey;
    if (typeof preset === 'string') {
      delete this._customPresets?.[id];
      this.instrumentos[id]._presetKey = preset;
    }
    if (preset._baseKey) this.instrumentos[id]._presetKey = preset._baseKey;
    this._buildSynth(id, preset);
  }

  _releaseSynth(synth, time) {
    if (typeof synth.releaseAll === 'function') synth.releaseAll(time);
    else synth.triggerRelease?.(time);
  }

  _disposeRetired(old) {
    clearTimeout(old.timer);
    old.synth.dispose();
    old.nodes.forEach(node => node.dispose());
    this._retiring.delete(old);
  }

  async start() {
    if (this._running || this._starting || this._disposed) return;
    this._starting = true;
    const generation = ++this._startGeneration;
    try {
      await Tone.start();
      await this._reverbReady; // asegurar que el impulse response esté listo
      if (this._disposed || generation !== this._startGeneration) return;
      this._running = true;
      this._endedAt = null;
      this._playback = {};
      this._pendingAdvances = {};
      this.expression.pause();
      this._pulse.reset(); // evita arrancar con _expressionGain bajo de una sesión anterior
      const originTick = Tone.Transport.state === 'started' ? Tone.Transport.ticks + this._notationToTicks('8n') : 0;
      if (Tone.Transport.state !== 'started') Tone.Transport.position = 0;
      Tone.Transport.bpm.value = this._lastBpm;
      this._schedulePulse();

      let idx = 0;
      for (const id in this.instrumentos) {
        this.instrumentos[id].sala.registrarInstrumento(id, this.instrumentos[id].posicion);
        this.instrumentos[id].reiniciarMaduracion?.();
        const startTick = originTick + this._notationToTicks('8n') * idx;
        this._schedulePatternCycle(id, startTick);
        idx++;
      }
      if (Tone.Transport.state !== 'started') Tone.Transport.start('+0.08');
    } finally { this._starting = false; }
  }

  stop(endedAt = null) {
    clearTimeout(this._endedTimer);
    this._endedAt = endedAt;
    this._pendingAdvances = {};
    this._running = false;
    ++this._startGeneration;
    this.expression.pause();
    for (const event of this._transportEvents) Tone.Transport.clear(event);
    for (const synth of Object.values(this.synths)) {
      this._releaseSynth(synth, endedAt ?? this._audioNow());
    }
    for (const old of this._retiring) this._releaseSynth(old.synth, endedAt ?? this._audioNow());
    this._transportEvents.clear();
    this._patternEvents = {};
    this._pulseEvent = null;
  }

  _schedulePulse() {
    this._pulseEvent = Tone.Transport.scheduleRepeat(time => {
      if (!this._running) return;
      this._actualizarSintesis(time);
      this._pulse.triggerAt(time);
      if (!this.expression.ended) this.sala.pulso();
      if (this.expression.shouldLoop()) this._newCycle();
      else if (this.expression.ended && this.expression.settings.ending === 'coda') {
        this.stop(time);
        const generation = this._startGeneration;
        const notifyAtAudioEnd = () => {
          if (this._disposed || generation !== this._startGeneration) return;
          const remaining = time - this._audioNow();
          if (remaining > 0) this._endedTimer = setTimeout(notifyAtAudioEnd, Math.max(10, remaining * 1000));
          else this.onEnded?.();
        };
        notifyAtAudioEnd();
      }
    }, '8n', 0);
    this._transportEvents.add(this._pulseEvent);
  }

  _actualizarSintesis(time = Tone.now()) {
    const mom = this.sala.getMomentum();
    // El momentum abre el espacio sin borrar articulación.
    // Rango expresivo: 0.12 (sala seca/quieta) a 0.65 (sala mojada/activa)
    const expression = this.expression.update(time, this.instrumentos, this.patrones.length - 1);
    this._pulse.setExpression(expression.pulseGain, expression.kickGain, expression.pulseAttack);
    this._reverb.wet.rampTo(expression.reverb ?? (0.12 + mom * 0.53), 3);

    for (const id in this.instrumentos) {
      const inst = this.instrumentos[id];
      const ui   = inst.getEstadoUI();
      const feeling = expression.voices[id];
      inst._expression = { ...feeling, stage: expression.stage };
      if (!this.synths[id]) continue;

      // MUTA → filtro cutoff (el panel de síntesis puede fijar un piso manual)
      const filterBase = this._customPresets?.[id]?._filterBase ?? 900;
      const mutaAmt   = Math.max(ui.muta, inst._manualMuta ?? 0);
      const cutoff    = (filterBase + mutaAmt * Math.max(0, 14400 - filterBase)) * feeling.brightness;
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
      for (const params of [presetParams, vaeParams].filter(Boolean)) {
        params.attack *= feeling.attackScale;
        params.release *= feeling.releaseScale;
        params.sustain *= feeling.sustainScale;
        if ('modIndex' in params) params.modIndex *= feeling.modulationScale;
        if ('modulationIndex' in params) params.modulationIndex *= feeling.modulationScale;
      }
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
      this.synths[id].volume.rampTo(volBase + feeling.gainDb, 3);
      // Coda gain is independent of the user's volume and remains finite.
      this.channelGains[id].gain.rampTo(feeling.codaGain, 1);
    }

    // Pulso degradado por máxima volatilidad
    const maxVol = Math.max(0, ...Object.values(this.instrumentos).map(i => i.getVolatilidadGlobal()).filter(isFinite));
    this._pulse.setDegradacion(maxVol);
  }

  _notationToTicks(notation) {
    return Math.max(1, Math.round(Tone.Time(notation).toTicks()));
  }

  _compilePattern(pattern) {
    return compilePattern(pattern, { ppq: Tone.Transport.PPQ ?? 192 });
  }

  _patternDurationTicks(pattern) {
    return this._compilePattern(pattern).totalTicks;
  }

  _audioNow() {
    return Tone.immediate?.() ?? Tone.getContext?.().currentTime ?? Tone.now();
  }

  // Scheduler callbacks run ahead of audible time. Read the transport at the
  // audio clock, then select the ledger entry that has actually begun sounding.
  getPlaybackState(id) {
    const now = this._audioNow();
    const running = this._running || (this._endedAt !== null && now < this._endedAt);
    const ledger = this._playback[id] || [];
    const entry = ledger.findLast(item => item.startTime <= now + 1e-7);
    const pending = this._pendingAdvances[id] ?? ledger.find(item => item.startTime > now
      && item.patternIndex !== entry?.patternIndex)?.patternIndex;
    const base = {
      running, phase: running ? 'waiting' : this._endedAt !== null ? 'ended' : 'stopped',
      patternIndex: entry?.patternIndex ?? this.instrumentos[id]?.posicion ?? 0,
      eventIndex: null, sourceIndex: null, cycle: entry?.cycle ?? 0,
      progress: 0, eventProgress: 0, pendingPatternIndex: pending ?? null,
      note: null, kind: null,
    };
    if (!entry) return base;
    if (running && Tone.getContext?.().state === 'suspended') {
      base.running = false;
      base.phase = 'suspended';
      return base;
    }
    const tick = Tone.Transport.getTicksAtTime?.(now) ?? Tone.Transport.ticks;
    const elapsed = Math.max(0, tick - entry.startTick);
    base.progress = Math.min(1, elapsed / (entry.endTick - entry.startTick));
    if (!running) return base;
    if (entry.waiting) return base;
    const event = entry.events.findLast(ev => ev.onsetTicks <= elapsed + 1e-7);
    base.phase = entry.silent ? 'resting' : 'playing';
    if (entry.silent) return base;
    if (event && elapsed < entry.endTick - entry.startTick) {
      base.eventIndex = event.index;
      base.sourceIndex = event.sourceIndex;
      base.eventProgress = Math.min(1, (elapsed - event.onsetTicks) / event.durationTicks);
      base.note = entry.silent ? null : event.note;
      base.kind = event.kind;
    }
    return base;
  }

  requestAdvance(id) {
    const inst = this.instrumentos[id];
    if (!this._running || !inst || this._pendingAdvances[id] !== undefined
      || inst.posicion >= this.patrones.length - 1) return false;
    const audible = this.getPlaybackState(id);
    // If the scheduler has already committed an upcoming change, let it sound
    // before accepting another gesture. Repeated clicks cannot skip figures.
    if (inst.posicion > audible.patternIndex) return false;
    this._pendingAdvances[id] = inst.posicion + 1;
    return true;
  }

  _recordPlayback(id, entry) {
    const ledger = this._playback[id] ||= [];
    const previous = ledger.at(-1);
    ledger.push({ ...entry, cycle: (previous?.cycle ?? 0) + (entry.waiting ? 0 : 1) });
    const now = this._audioNow();
    // Keep the currently audible cycle and all lookahead cycles.
    while (ledger.length > 2 && ledger[1].startTime <= now) ledger.shift();
  }

  _scheduleAtTick(tick, callback, ownerId = null) {
    let eventId = null;
    eventId = Tone.Transport.scheduleOnce(time => {
      this._transportEvents.delete(eventId);
      if (ownerId) this._patternEvents[ownerId]?.delete(eventId);
      if (this._running) callback(time);
    }, `${Math.max(0, tick)}i`);
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

    if (inst.posicion >= this.patrones.length) {
      this.expression.markSounding(id, false);
      return;
    }
    if (ui.estado === ESTADOS.DORMIDO || ui.estado === ESTADOS.ARMADO) {
      this.expression.markSounding(id, false);
      const endTick = startTick + this._notationToTicks('1m');
      this._recordPlayback(id, { patternIndex: inst.posicion, startTick, endTick, startTime, events: [], waiting: true });
      this._schedulePatternCycle(id, endTick);
      return;
    }
    const phrase = this.expression.phrase(id, this.instrumentos, inst._presetKey, inst._autoTimbre !== false);
    if (phrase.preset && !this._pendingPresets[id]) this.cambiarPreset(id, phrase.preset, true);
    this._applyPendingPreset(id);
    const silent = phrase.rest || this.expression.ended || ui.estado === ESTADOS.DESCANSANDO;
    this.expression.markSounding(id, !silent);
    const patternIndex = inst.posicion;
    const compiled = this._compilePattern(this.patrones[patternIndex]);
    const durationTicks = compiled.totalTicks;
    this._recordPlayback(id, { patternIndex, startTick, endTick: startTick + durationTicks,
      startTime, events: compiled.events, silent });
    const synth = this.synths[id];
    for (const event of compiled.events) {
      if (silent || !event.note || event.attackDurationTicks <= 0) continue;
      const attack = time => synth.triggerAttack(event.note, time);
      if (event.onsetTicks === 0) attack(startTime);
      else this._scheduleAtTick(startTick + event.onsetTicks, attack, id);
      // Release is a transport event, not a duration frozen into seconds at
      // attack time. Ties have one attack and retain their release under BPM changes.
      this._scheduleAtTick(startTick + event.onsetTicks + event.attackDurationTicks,
        time => this._releaseSynth(synth, time), id);
    }

    const finishTick = startTick + durationTicks;
    this._scheduleAtTick(finishTick, finishTime => {
      if (inst.posicion >= this.patrones.length) return;
      // At 53 the voice waits for its partners, then all fade through the coda.
      const waiting = inst.posicion === this.patrones.length - 1;
      const requested = this._pendingAdvances[id];
      delete this._pendingAdvances[id];
      let avanzo = false;
      if (!waiting && requested !== undefined) {
        avanzo = inst.forzarAvance('gesto al terminar la figura');
      } else if (!waiting && !phrase.rest) avanzo = inst.decidirAvance();
      if (waiting || phrase.rest) inst.registrarEspera?.(waiting ? 'coda' : 'respiracion');
      if (this.onCiclo) this.onCiclo(id, inst.posicion, avanzo, inst.getEstadoUI());
      // El siguiente ciclo hereda el timestamp exacto del límite anterior.
      this._runPatternCycle(id, finishTick, finishTime);
    }, id);
  }

  _newCycle() {
    for (const id of Object.keys(this._patternEvents)) {
      for (const event of this._patternEvents[id]) { Tone.Transport.clear(event); this._transportEvents.delete(event); }
    }
    this._patternEvents = {};
    this._pendingAdvances = {};
    Object.assign(this.sala, new this.sala.constructor(this.patrones.length));
    this.expression.reset();
    let index = 0;
    for (const [id, inst] of Object.entries(this.instrumentos)) {
      inst.posicion = 0;
      inst.estado = ESTADOS.DORMIDO;
      inst._probBreakdown = null;
      inst.reiniciarMaduracion();
      this.sala.registrarInstrumento(id, 0);
      this.expression.voices[id].stage = -1;
      if (this._running) this._schedulePatternCycle(id, Tone.Transport.ticks + this._notationToTicks('8n') * (++index));
    }
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
    if (this._disposed) return;
    this._disposed = true;
    this.stop();
    for (const old of [...this._retiring]) this._disposeRetired(old);
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
