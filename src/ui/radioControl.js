import { RADIO_STREAMS } from '../data/radioStreams.js';

export function buildRadioCard() {
  let currentIdx = -1;
  let playing = false;
  let userWantsPlay = false;
  let fxReady = false;
  let amOn = false;

  let audioCtx = null;
  let hpNode = null;
  let lpNode = null;
  let amNode = null;
  let delayNode = null;
  let masterGain = null;

  const audio = new Audio();
  audio.preload = 'none';

  function initFX() {
    if (fxReady) return;
    try {
      audioCtx = new AudioContext();
      const stream = audio.captureStream?.() || audio.mozCaptureStream?.();
      if (!stream) throw new Error('no captureStream');
      const src = audioCtx.createMediaStreamSource(stream);

      hpNode    = audioCtx.createBiquadFilter(); hpNode.type = 'highpass'; hpNode.frequency.value = 20;
      lpNode    = audioCtx.createBiquadFilter(); lpNode.type = 'lowpass';  lpNode.frequency.value = 20000;
      amNode    = audioCtx.createBiquadFilter(); amNode.type = 'bandpass'; amNode.frequency.value = 20000; amNode.Q.value = 0.01;
      delayNode = audioCtx.createDelay(2.0);     delayNode.delayTime.value = 0;
      masterGain = audioCtx.createGain();         masterGain.gain.value = parseFloat(volSlider.value);

      src.connect(hpNode); hpNode.connect(lpNode); lpNode.connect(amNode);
      amNode.connect(delayNode); delayNode.connect(masterGain); masterGain.connect(audioCtx.destination);

      // Mutear el elemento para que solo salga por WebAudio (evita doble output sin FX)
      audio.muted = true;

      fxReady = true;
    } catch (_) { fxReady = false; }
  }

  function pickStation(idx) {
    const s = RADIO_STREAMS[idx];
    if (!s) return null;
    currentIdx = idx;
    audio.src = s.url;
    return s;
  }

  function randomIdx() {
    const pool = RADIO_STREAMS.map((_, i) => i).filter(i => i !== currentIdx);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── Card ─────────────────────────────────────────────────────────────────────

  const card = document.createElement('div');
  card.className = 'lente-card';

  // Helper: fila flex inline
  function row(...children) {
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;align-items:center;gap:0.35rem;margin-bottom:0.28rem;min-width:0;';
    children.forEach(c => d.appendChild(c));
    return d;
  }

  function lbl(txt) {
    const s = document.createElement('span');
    s.className = 'lente-label';
    s.style.minWidth = '22px';
    s.textContent = txt;
    return s;
  }

  function btn(txt, title = '') {
    const b = document.createElement('button');
    b.className = 'lente-btn';
    b.style.cssText = 'flex:0 0 auto;width:auto;';
    b.textContent = txt;
    if (title) b.title = title;
    return b;
  }

  function slider(min, max, step, val, flex = '1') {
    const s = document.createElement('input');
    s.type = 'range'; s.min = min; s.max = max; s.step = step; s.value = val;
    s.className = 'lente-slider';
    s.style.flex = flex;
    return s;
  }

  // Header
  const headRow = document.createElement('div');
  headRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:0.35rem;';
  const headLbl = document.createElement('span');
  headLbl.className = 'lente-label'; headLbl.textContent = 'RADIO EN VIVO';
  headRow.appendChild(headLbl);
  card.appendChild(headRow);

  // Station display
  const stationEl = document.createElement('div');
  stationEl.className = 'radio-station-display';
  stationEl.textContent = '— sin señal —';
  card.appendChild(stationEl);

  // Row 1: play + random + status
  const btnPlay   = btn('▶');
  const btnRandom = btn('⟳ random');
  const statusEl  = document.createElement('span');
  statusEl.className = 'radio-status';
  statusEl.style.cssText = 'flex:1;text-align:right;';
  card.appendChild(row(btnPlay, btnRandom, statusEl));

  // Row 2: HP
  const hpSlider = slider('20', '4000', '10', '20');
  const hpVal    = lbl('20 Hz'); hpVal.style.minWidth = '46px'; hpVal.style.textAlign = 'right';
  card.appendChild(row(lbl('HP'), hpSlider, hpVal));

  // Row 3: LP
  const lpSlider = slider('500', '20000', '100', '20000');
  const lpVal    = lbl('20k Hz'); lpVal.style.minWidth = '46px'; lpVal.style.textAlign = 'right';
  card.appendChild(row(lbl('LP'), lpSlider, lpVal));

  // Row 4: AM + delay
  const btnAM     = btn('AM');
  const delaySlider = slider('0', '0.8', '0.01', '0', '0 0 70px');
  delaySlider.style.width = '70px';
  card.appendChild(row(btnAM, lbl('DLY'), delaySlider));

  // Row 5: Vol
  const volSlider = slider('0', '1', '0.01', '0.5');
  card.appendChild(row(lbl('VOL'), volSlider));

  // ── Logic ────────────────────────────────────────────────────────────────────

  function setStatus(t) { statusEl.textContent = t; }

  function updateStation(s) {
    stationEl.textContent = s ? `${s.flag} ${s.nombre} · ${s.pais}` : '— sin señal —';
  }

  function updatePlayBtn() {
    btnPlay.textContent = playing ? '■' : '▶';
    btnPlay.classList.toggle('active', playing);
  }

  let loadTimer = null;

  async function startPlay() {
    userWantsPlay = true;
    if (currentIdx === -1) updateStation(pickStation(randomIdx()));
    setStatus('cargando...');
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => { if (!playing) setStatus('sin respuesta'); }, 10000);
    try {
      await audio.play();
      playing = true;
      initFX();  // captura el stream YA reproduciendo y mutea el elemento
      if (audioCtx?.state === 'suspended') await audioCtx.resume();
      if (fxReady && masterGain) masterGain.gain.value = parseFloat(volSlider.value);
      else audio.muted = false; // si FX falló, desmutear para que suene
      setStatus(fxReady ? 'en vivo · fx' : 'en vivo');
    } catch (e) {
      setStatus('error — probá random');
    }
    clearTimeout(loadTimer);
    updatePlayBtn();
  }

  function stopPlay() {
    userWantsPlay = false;
    clearTimeout(loadTimer);
    audio.pause();
    audio.muted = false;
    playing = false;
    updatePlayBtn();
    setStatus('');
  }

  btnPlay.addEventListener('click', () => playing ? stopPlay() : startPlay());

  btnRandom.addEventListener('click', async () => {
    const was = playing;
    stopPlay();
    updateStation(pickStation(randomIdx()));
    if (was) await startPlay();
  });

  btnAM.addEventListener('click', () => {
    amOn = !amOn;
    btnAM.classList.toggle('active', amOn);
    if (!amNode) return;
    amNode.frequency.value = amOn ? 1400 : 20000;
    amNode.Q.value         = amOn ? 1.4  : 0.01;
  });

  hpSlider.addEventListener('input', () => {
    const v = parseInt(hpSlider.value);
    hpVal.textContent = v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v} Hz`;
    if (hpNode) hpNode.frequency.value = v;
  });

  lpSlider.addEventListener('input', () => {
    const v = parseInt(lpSlider.value);
    lpVal.textContent = v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v} Hz`;
    if (lpNode) lpNode.frequency.value = v;
  });

  delaySlider.addEventListener('input', () => {
    if (delayNode) delayNode.delayTime.value = parseFloat(delaySlider.value);
  });

  volSlider.addEventListener('input', () => {
    const v = parseFloat(volSlider.value);
    if (fxReady && masterGain) masterGain.gain.value = v;
    else audio.volume = v;
  });

  audio.addEventListener('waiting', () => { if (userWantsPlay) setStatus('buffering...'); });
  audio.addEventListener('playing', () => { if (userWantsPlay) setStatus(fxReady ? 'en vivo · fx' : 'en vivo'); playing = true; updatePlayBtn(); });
  audio.addEventListener('error',   () => {
    if (!userWantsPlay) return;
    setStatus('no disponible — probá random');
    playing = false;
    updatePlayBtn();
  });

  return card;
}
