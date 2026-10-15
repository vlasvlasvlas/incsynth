import * as Tone from 'tone';

export class Pulse {
  constructor() {
    this.degradacion = 0;
    this._note = 'C6';
    this._waveform = 'sine';
    this._kickEnabled = false;
    this._step = 0;
    this._expressionGain = 1;
    this._kickGain = 1;
    this._synth = new Tone.Synth({
      oscillator: { type: this._waveform },
      envelope: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.05 },
    }).toDestination();
    this._synth.volume.value = -23;
    this._kick = new Tone.MembraneSynth({
      pitchDecay: 0.09,
      octaves: 3,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.12 },
    }).toDestination();
    this._kick.volume.value = -18;
  }

  setDegradacion(valor) {
    this.degradacion = Math.max(0, Math.min(1, valor));
  }

  // Pulso en Do6 cada corchea — ancla rítmica de In C
  triggerAt(time) {
    // El pulso nunca se desplaza ni desaparece: es la referencia común.
    // La volatilidad solo reduce levemente su acento.
    const velocity = (1 - this.degradacion * 0.22) * this._expressionGain;
    if (velocity > 0.001) this._synth.triggerAttackRelease(this._note, '16n', time, velocity);
    if (this._kickEnabled && this._kickGain > 0.001 && this._step % 2 === 0) {
      this._kick.triggerAttackRelease('C2', '8n', time, 0.75 * this._kickGain);
    }
    this._step++;
  }

  setExpression(pulseGain = 1, kickGain = 1, attack = 0.002) {
    // Smooth presence without moving any beat or overriding the chosen volume.
    this._expressionGain += (pulseGain - this._expressionGain) * 0.12;
    this._kickGain += (kickGain - this._kickGain) * 0.12;
    this._synth.set({ envelope: { attack } });
  }

  setVolume(db) {
    this._synth.volume.rampTo(db, 0.3);
    this._kick.volume.rampTo(Math.min(0, db + 9), 0.3);
  }

  setPulseVolume(db) {
    this._synth.volume.rampTo(db, 0.3);
  }

  setKickVolume(db) {
    this._kick.volume.rampTo(db, 0.3);
  }

  setWaveform(type) {
    if (!['sine', 'triangle', 'square', 'sawtooth'].includes(type)) return;
    this._waveform = type;
    this._synth.set({ oscillator: { type } });
  }

  setFrequency(hz) {
    const value = Math.max(110, Math.min(3520, Number(hz) || 1046.5));
    this._note = value;
  }

  setKickEnabled(enabled) {
    this._kickEnabled = Boolean(enabled);
    if (this._kickEnabled) this._step = 0;
  }

  reset() {
    this._expressionGain = 1;
    this._kickGain = 1;
    this._step = 0;
  }

  dispose() {
    this._synth.dispose();
    this._kick.dispose();
  }
}
