import * as Tone from 'tone';

const KEY_NOTES = {
  Digit1: 'C4',
  Digit2: 'D4',
  Digit3: 'E4',
  Digit4: 'F4',
  Digit5: 'G4',
  Digit6: 'A4',
  Digit7: 'B4',
  Digit8: 'C5',
  Digit9: 'D5',
  Digit0: 'E5',
};

// Duración de cada nota del arp = la mitad del intervalo (staccato limpio)
const ARP_NOTE_DUR = { '4n': '8n', '8n': '16n', '16n': '32n' };

// Orden cromático para UP / DOWN
const NOTE_ORDER = ['C4','D4','E4','F4','G4','A4','B4','C5','D5','E5'];

export class PlayableSynth {
  constructor() {
    this.enabled = true;
    this.hold = true;
    this.mode = 'fm';
    this.waveform = 'sine';
    this.attack = 0.8;
    this.decay = 1.2;
    this.sustain = 0.72;
    this.release = 4;
    this.volume = -30;
    this.filterFrequency = 2200;
    this.reverbWet = 0.48;
    this.activeNotes = new Set();
    this.listeners = new Set();

    // Arpegiador
    this.arpEnabled = false;
    this.arpMode    = 'up';   // 'up' | 'down' | 'random'
    this.arpRate    = '8n';   // '4n' | '8n' | '16n'
    this._arpIndex  = 0;
    this._arpEvent  = null;

    this.filter = new Tone.Filter(this.filterFrequency, 'lowpass');
    this.reverb = new Tone.Reverb({ decay: 6, wet: this.reverbWet }).toDestination();
    this.reverb.generate();
    this.filter.connect(this.reverb);
    this._buildVoice();

    this._onKeyDown = event => this._handleKeyDown(event);
    this._onKeyUp   = event => this._handleKeyUp(event);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);
  }

  // ── Subscripción ──────────────────────────────────────────────────────────

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState() {
    return {
      enabled:     this.enabled,
      hold:        this.hold,
      activeNotes: [...this.activeNotes],
      arp: {
        enabled: this.arpEnabled,
        mode:    this.arpMode,
        rate:    this.arpRate,
      },
    };
  }

  // ── Controles básicos ─────────────────────────────────────────────────────

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.releaseAll();
    this._emit();
  }

  setHold(hold) {
    this.hold = Boolean(hold);
    if (!this.hold) this.releaseAll();
    this._emit();
  }

  setMode(mode) {
    this.mode = ['synth', 'am', 'fm'].includes(mode) ? mode : 'synth';
    this._buildVoice();
  }

  setWaveform(waveform) {
    this.waveform = waveform;
    this._buildVoice();
  }

  setEnvelope(param, value) {
    if (!['attack', 'decay', 'sustain', 'release'].includes(param)) return;
    this[param] = Number(value);
    this.voice?.set({ envelope: this._envelope() });
  }

  setFilterFrequency(value) {
    this.filterFrequency = Number(value);
    this.filter.frequency.rampTo(this.filterFrequency, 0.08);
  }

  setReverbWet(value) {
    this.reverbWet = Number(value);
    this.reverb.wet.rampTo(this.reverbWet, 0.12);
  }

  setVolume(value) {
    this.volume = Number(value);
    if (this.voice) this.voice.volume.rampTo(this.volume, 0.08);
  }

  // ── Arpegiador ────────────────────────────────────────────────────────────

  setArpEnabled(enabled) {
    this.arpEnabled = Boolean(enabled);
    // Limpiar el voice al activar para que el arp arranque limpio
    try { this.voice?.releaseAll(); } catch (_) {}
    this._arpIndex = 0;
    if (this.arpEnabled) {
      this._startArp();
    } else {
      this._stopArp();
    }
    this._emit();
  }

  setArpMode(mode) {
    if (!['up', 'down', 'random'].includes(mode)) return;
    this.arpMode   = mode;
    this._arpIndex = 0;
  }

  setArpRate(rate) {
    if (!['4n', '8n', '16n'].includes(rate)) return;
    this.arpRate = rate;
    if (this.arpEnabled) {
      this._stopArp();
      this._startArp();
    }
  }

  _startArp() {
    this._stopArp();
    this._arpIndex = 0;
    const dur = ARP_NOTE_DUR[this.arpRate] || '16n';

    this._arpEvent = Tone.Transport.scheduleRepeat(time => {
      if (!this.enabled || !this.activeNotes.size) return;

      let note;
      if (this.arpMode === 'random') {
        const arr = [...this.activeNotes];
        note = arr[Math.floor(Math.random() * arr.length)];
      } else {
        const seq = [...this.activeNotes].sort(
          (a, b) => NOTE_ORDER.indexOf(a) - NOTE_ORDER.indexOf(b)
        );
        if (this.arpMode === 'down') seq.reverse();
        const idx = this._arpIndex % seq.length;
        note = seq[idx];
        this._arpIndex = (idx + 1) % seq.length;
      }

      try { this.voice.triggerAttackRelease(note, dur, time); } catch (_) {}
    }, this.arpRate);
  }

  _stopArp() {
    if (this._arpEvent !== null) {
      try { Tone.Transport.clear(this._arpEvent); } catch (_) {}
      this._arpEvent = null;
    }
    this._arpIndex = 0;
  }

  // ── Notas ─────────────────────────────────────────────────────────────────

  async playNote(note) {
    if (!this.enabled) return;
    Tone.start().catch(() => {});

    if (this.hold) {
      // Hold: toggle nota en pool. El arp usa el pool; sin arp, el voice suena directo.
      if (this.activeNotes.has(note)) {
        this.activeNotes.delete(note);
        if (!this.arpEnabled) this.voice.triggerRelease(note);
      } else {
        this.activeNotes.add(note);
        if (!this.arpEnabled) this.voice.triggerAttack(note);
      }
    } else if (this.arpEnabled) {
      // Arp sin hold: la nota entra al pool en keydown y sale en keyup (_handleKeyUp).
      this.activeNotes.add(note);
    } else {
      this.voice.triggerAttackRelease(note, 1.2);
    }

    this._emit();
  }

  releaseAll() {
    try { this.voice?.releaseAll(); } catch (_) {}
    this.activeNotes.clear();
    this._arpIndex = 0;
    this._emit();
  }

  dispose() {
    this._stopArp();
    this.releaseAll();
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
    try { this.voice?.dispose();  } catch (_) {}
    try { this.filter?.dispose(); } catch (_) {}
    try { this.reverb?.dispose(); } catch (_) {}
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  _buildVoice() {
    // Preservar notas activas para reatacarlas en el nuevo voice
    const notasActivas = [...this.activeNotes];
    try { this.voice?.releaseAll(); } catch (_) {}
    if (this.voice) {
      try { this.voice.dispose(); } catch (_) {}
    }

    const Voice = this.mode === 'am'
      ? Tone.AMSynth
      : this.mode === 'fm'
        ? Tone.FMSynth
        : Tone.Synth;
    this.voice = new Tone.PolySynth(Voice, {
      maxPolyphony: 10,
      oscillator:  { type: this.waveform },
      envelope:    this._envelope(),
    });
    this.voice.volume.value = this.volume;
    this.voice.connect(this.filter);

    // Reatacar notas que estaban activas (hold sin arp); el arp las retoma automáticamente
    if (!this.arpEnabled && this.hold && notasActivas.length) {
      for (const note of notasActivas) {
        try { this.voice.triggerAttack(note); } catch (_) {}
      }
    }
  }

  _envelope() {
    return {
      attack:  this.attack,
      decay:   this.decay,
      sustain: this.sustain,
      release: this.release,
    };
  }

  async _handleKeyDown(event) {
    const note = KEY_NOTES[event.code];
    if (!note || event.repeat || !this.enabled || isTypingTarget(event.target)) return;
    event.preventDefault();
    await this.playNote(note);
  }

  _handleKeyUp(event) {
    const note = KEY_NOTES[event.code];
    if (!note || this.hold || isTypingTarget(event.target)) return;
    event.preventDefault();
    if (this.activeNotes.has(note)) {
      if (!this.arpEnabled) this.voice.triggerRelease(note);
      this.activeNotes.delete(note);
      this._emit();
    }
  }

  _emit() {
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
  }
}

function isTypingTarget(target) {
  const tag = target?.tagName?.toLowerCase();
  if (tag === 'input') {
    const type = target.type?.toLowerCase();
    return ['text', 'number', 'password', 'email', 'search'].includes(type);
  }
  return ['select', 'textarea'].includes(tag) || target?.isContentEditable;
}
