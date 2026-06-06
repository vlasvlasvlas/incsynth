import * as Tone from 'tone';

export class Pulse {
  constructor() {
    this.degradacion = 0;
    this._note = 'C6';
    this._waveform = 'triangle';
    this._synth = new Tone.Synth({
      oscillator: { type: this._waveform },
      envelope: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.05 },
    }).toDestination();
    this._synth.volume.value = -18;
  }

  setDegradacion(valor) {
    this.degradacion = Math.max(0, Math.min(1, valor));
  }

  // Pulso en Do6 cada corchea — ancla rítmica de In C
  triggerAt(time) {
    // El pulso nunca se desplaza ni desaparece: es la referencia común.
    // La volatilidad solo reduce levemente su acento.
    const velocity = 1 - this.degradacion * 0.22;
    this._synth.triggerAttackRelease(this._note, '16n', time, velocity);
  }

  setVolume(db) {
    this._synth.volume.rampTo(db, 0.3);
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

  dispose() {
    this._synth.dispose();
  }
}
