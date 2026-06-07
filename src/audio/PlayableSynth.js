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

    this.filter = new Tone.Filter(this.filterFrequency, 'lowpass');
    this.reverb = new Tone.Reverb({ decay: 6, wet: this.reverbWet }).toDestination();
    this.reverb.generate();
    this.filter.connect(this.reverb);
    this._buildVoice();

    this._onKeyDown = event => this._handleKeyDown(event);
    this._onKeyUp = event => this._handleKeyUp(event);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState() {
    return {
      enabled: this.enabled,
      hold: this.hold,
      activeNotes: [...this.activeNotes],
    };
  }

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

  releaseAll() {
    if (this.voice && this.activeNotes.size) {
      try { this.voice.releaseAll(); } catch (_) {}
    }
    this.activeNotes.clear();
    this._emit();
  }

  async playNote(note) {
    if (!this.enabled) return;
    Tone.start().catch(() => {});
    if (this.hold) {
      if (this.activeNotes.has(note)) {
        this.voice.triggerRelease(note);
        this.activeNotes.delete(note);
      } else {
        this.voice.triggerAttack(note);
        this.activeNotes.add(note);
      }
    } else {
      this.voice.triggerAttackRelease(note, 1.2);
    }
    this._emit();
  }

  _buildVoice() {
    this.releaseAll();
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
      oscillator: { type: this.waveform },
      envelope: this._envelope(),
    });
    this.voice.volume.value = this.volume;
    this.voice.connect(this.filter);
  }

  _envelope() {
    return {
      attack: this.attack,
      decay: this.decay,
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
      this.voice.triggerRelease(note);
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
    // Block only if it's a typing input, not a slider or checkbox
    return ['text', 'number', 'password', 'email', 'search'].includes(type);
  }
  return ['select', 'textarea'].includes(tag) || target?.isContentEditable;
}
