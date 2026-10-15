// One CORS-enabled media source, routed entirely through Web Audio.
export class RadioPlayer {
  constructor(stations, onState, { createAudio = () => new Audio(), createContext = () => new AudioContext(), masterNode = null, timeout = 12000 } = {}) {
    Object.assign(this, { stations, onState, createAudio, timeout });
    // Si recibimos un nodo master del grafo Tone, usamos su AudioContext (unifica grafos)
    // y conectamos la salida ahí en vez de a destination.
    this.masterNode = masterNode;
    this.createContext = masterNode ? () => masterNode.context : createContext;
    this.settings = { highpass: 80, lowpass: 12000, delay: 0, volume: 0.26 };
    this.generation = 0;
    this.index = -1;
  }

  init() {
    if (this.ctx) return;
    this.ctx = this.createContext();
    this.hp = this.ctx.createBiquadFilter(); this.hp.type = 'highpass';
    this.lp = this.ctx.createBiquadFilter(); this.lp.type = 'lowpass';
    this.delay = this.ctx.createDelay(4);
    this.wet = this.ctx.createGain();
    this.feedback = this.ctx.createGain(); this.feedback.gain.value = 0.28;
    this.master = this.ctx.createGain();
    this.hp.connect(this.lp);
    this.lp.connect(this.master);
    this.lp.connect(this.delay); this.delay.connect(this.wet); this.wet.connect(this.master);
    this.delay.connect(this.feedback); this.feedback.connect(this.delay);
    this.master.connect(this.masterNode || this.ctx.destination);
    this.applySettings();
  }

  set(key, value) {
    this.settings[key] = value;
    this.applySettings();
  }

  applySettings() {
    if (!this.ctx) return;
    const { highpass, lowpass, delay, volume } = this.settings;
    const set = (param, value) => param.setTargetAtTime(value, this.ctx.currentTime, 0.02);
    set(this.hp.frequency, highpass); set(this.lp.frequency, lowpass);
    set(this.delay.delayTime, Math.max(0.01, delay));
    set(this.wet.gain, delay > 0 ? 0.4 : 0);
    // Zero is exact, including the wet path; cancel any earlier gain automation.
    const level = this.active ? volume : 0;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    if (level === 0) this.master.gain.setValueAtTime(0, this.ctx.currentTime);
    else set(this.master.gain, level);
  }

  releaseSource() {
    this.cancelAttempt?.(); this.cancelAttempt = null;
    if (this.audio) {
      this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load();
      this.audio = null;
    }
    this.source?.disconnect(); this.source = null;
  }

  stop() {
    this.active = false; ++this.generation;
    this.releaseSource(); this.applySettings();
    this.onState({ state: 'idle' });
  }

  async start({ random = false } = {}) {
    this.stop();
    const generation = this.generation;
    this.active = true;
    this.onState({ state: 'loading', message: 'Conectando…' });
    try {
      this.init();
      await this.ctx.resume();
    } catch {
      if (generation !== this.generation) return;
      this.stop(); this.onState({ state: 'error', message: 'No se pudo activar el audio. Volvé a intentar.' });
      return;
    }
    if (generation !== this.generation) return;
    this.applySettings();
    // Try every station once; never leave an unavailable stream spinning forever.
    const candidates = this.stations.map((_, i) => i).filter(i => i !== this.index);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    if (this.index >= 0) {
      if (random) candidates.push(this.index);
      else candidates.unshift(this.index);
    }
    for (const index of candidates) {
      if (generation !== this.generation) return;
      this.index = index;
      const station = this.stations[index];
      this.onState({ state: 'loading', station });
      try {
        await this.attempt(station, generation);
        if (generation !== this.generation) return;
        this.onState({ state: 'playing', station });
        return;
      } catch (error) {
        if (generation !== this.generation) return;
        this.releaseSource();
        if (error.name === 'NotAllowedError') break;
      }
    }
    this.stop();
    this.onState({ state: 'error', message: 'No hay señal disponible. Volvé a intentar.' });
  }

  attempt(station, generation) {
    const audio = this.audio = this.createAudio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'none';
    audio.src = station.url;
    this.source = this.ctx.createMediaElementSource(audio);
    this.source.connect(this.hp);
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer;
      const finish = (error) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        error ? reject(error) : resolve();
      };
      const fail = () => {
        if (generation !== this.generation) return;
        if (!settled) finish(new Error('Stream unavailable'));
        else this.start({ random: true });
      };
      const playing = () => {
        clearTimeout(timer);
        if (generation !== this.generation) return;
        finish();
        this.onState({ state: 'playing', station });
      };
      const waiting = () => {
        if (generation !== this.generation) return;
        this.onState({ state: 'loading', station });
        clearTimeout(timer); timer = setTimeout(fail, this.timeout);
      };
      audio.addEventListener('playing', playing);
      audio.addEventListener('error', fail);
      audio.addEventListener('ended', fail);
      audio.addEventListener('waiting', waiting);
      this.cancelAttempt = () => {
        clearTimeout(timer);
        audio.removeEventListener('playing', playing);
        audio.removeEventListener('error', fail);
        audio.removeEventListener('ended', fail);
        audio.removeEventListener('waiting', waiting);
        finish(new Error('Cancelled'));
      };
      timer = setTimeout(fail, this.timeout);
      try { Promise.resolve(audio.play()).catch(finish); } catch (error) { finish(error); }
    });
  }
}
