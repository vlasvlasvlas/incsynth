import { RADIO_STREAMS } from '../data/radioStreams.js';

export function buildRadioCard() {
  let currentIdx = -1;
  let playing = false;
  let fxReady = false;
  let amOn = false;

  let audioCtx = null;
  let sourceNode = null;
  let hpNode = null;
  let lpNode = null;
  let amNode = null;
  let delayNode = null;
  let masterGain = null;

  const audio = new Audio();
  audio.crossOrigin = 'anonymous';
  audio.preload = 'none';

  function initFX() {
    if (fxReady) return;
    try {
      audioCtx = new AudioContext();
      sourceNode = audioCtx.createMediaElementSource(audio);

      hpNode = audioCtx.createBiquadFilter();
      hpNode.type = 'highpass';
      hpNode.frequency.value = 20;

      lpNode = audioCtx.createBiquadFilter();
      lpNode.type = 'lowpass';
      lpNode.frequency.value = 20000;

      amNode = audioCtx.createBiquadFilter();
      amNode.type = 'bandpass';
      amNode.frequency.value = 20000;
      amNode.Q.value = 0.01;

      delayNode = audioCtx.createDelay(2.0);
      delayNode.delayTime.value = 0;

      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.7;

      // Fixed chain — only AudioParams change
      sourceNode.connect(hpNode);
      hpNode.connect(lpNode);
      lpNode.connect(amNode);
      amNode.connect(delayNode);
      delayNode.connect(masterGain);
      masterGain.connect(audioCtx.destination);

      fxReady = true;
    } catch (e) {
      fxReady = false;
    }
  }

  function pickStation(idx) {
    const station = RADIO_STREAMS[idx];
    if (!station) return null;
    currentIdx = idx;
    audio.src = station.url;
    return station;
  }

  function randomStation() {
    const indices = RADIO_STREAMS.map((_, i) => i).filter(i => i !== currentIdx);
    return indices[Math.floor(Math.random() * indices.length)];
  }

  // ── UI ──────────────────────────────────────────────────────────────────────

  const card = document.createElement('div');
  card.className = 'lente-card';

  const header = document.createElement('div');
  header.className = 'lente-card-header';
  const title = document.createElement('span');
  title.className = 'lente-label';
  title.textContent = 'RADIO EN VIVO';
  header.appendChild(title);
  card.appendChild(header);

  const stationEl = document.createElement('div');
  stationEl.className = 'radio-station-display';
  stationEl.textContent = '— sin señal —';
  card.appendChild(stationEl);

  // Play + Random
  const row1 = document.createElement('div');
  row1.className = 'ritmo-control';
  const btnPlay = document.createElement('button');
  btnPlay.className = 'lente-btn';
  btnPlay.textContent = '▶';
  const btnRandom = document.createElement('button');
  btnRandom.className = 'lente-btn';
  btnRandom.textContent = '⟳ random';
  row1.appendChild(btnPlay);
  row1.appendChild(btnRandom);
  card.appendChild(row1);

  // HP
  const rowHP = document.createElement('div');
  rowHP.className = 'ritmo-control';
  const hpLbl = document.createElement('span');
  hpLbl.className = 'lente-label';
  hpLbl.textContent = 'HP';
  const hpSlider = document.createElement('input');
  hpSlider.type = 'range'; hpSlider.min = '20'; hpSlider.max = '4000';
  hpSlider.step = '10'; hpSlider.value = '20';
  hpSlider.className = 'lente-slider';
  const hpVal = document.createElement('span');
  hpVal.className = 'lente-label'; hpVal.textContent = '20 Hz';
  rowHP.appendChild(hpLbl); rowHP.appendChild(hpSlider); rowHP.appendChild(hpVal);
  card.appendChild(rowHP);

  // LP
  const rowLP = document.createElement('div');
  rowLP.className = 'ritmo-control';
  const lpLbl = document.createElement('span');
  lpLbl.className = 'lente-label';
  lpLbl.textContent = 'LP';
  const lpSlider = document.createElement('input');
  lpSlider.type = 'range'; lpSlider.min = '500'; lpSlider.max = '20000';
  lpSlider.step = '100'; lpSlider.value = '20000';
  lpSlider.className = 'lente-slider';
  const lpVal = document.createElement('span');
  lpVal.className = 'lente-label'; lpVal.textContent = '20k Hz';
  rowLP.appendChild(lpLbl); rowLP.appendChild(lpSlider); rowLP.appendChild(lpVal);
  card.appendChild(rowLP);

  // AM + Delay
  const rowFX = document.createElement('div');
  rowFX.className = 'ritmo-control';
  const btnAM = document.createElement('button');
  btnAM.className = 'lente-btn'; btnAM.textContent = 'AM';
  const delayLbl = document.createElement('span');
  delayLbl.className = 'lente-label'; delayLbl.textContent = 'DELAY';
  const delaySlider = document.createElement('input');
  delaySlider.type = 'range'; delaySlider.min = '0'; delaySlider.max = '0.8';
  delaySlider.step = '0.01'; delaySlider.value = '0';
  delaySlider.className = 'lente-slider'; delaySlider.style.width = '70px';
  rowFX.appendChild(btnAM); rowFX.appendChild(delayLbl); rowFX.appendChild(delaySlider);
  card.appendChild(rowFX);

  // Vol
  const rowVol = document.createElement('div');
  rowVol.className = 'ritmo-control';
  const volLbl = document.createElement('span');
  volLbl.className = 'lente-label'; volLbl.textContent = 'VOL';
  const volSlider = document.createElement('input');
  volSlider.type = 'range'; volSlider.min = '0'; volSlider.max = '1';
  volSlider.step = '0.01'; volSlider.value = '0.5';
  volSlider.className = 'lente-slider';
  rowVol.appendChild(volLbl); rowVol.appendChild(volSlider);
  card.appendChild(rowVol);

  const statusEl = document.createElement('span');
  statusEl.className = 'radio-status';
  card.appendChild(statusEl);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function updateStationDisplay(station) {
    stationEl.textContent = station ? `${station.flag} ${station.nombre} · ${station.pais}` : '— sin señal —';
  }

  function updatePlayBtn() {
    btnPlay.textContent = playing ? '■' : '▶';
    btnPlay.classList.toggle('active', playing);
  }

  async function startPlay() {
    if (currentIdx === -1) pickStation(randomStation());
    initFX();
    if (audioCtx?.state === 'suspended') await audioCtx.resume();
    if (masterGain) masterGain.gain.value = parseFloat(volSlider.value);
    audio.volume = fxReady ? 1 : parseFloat(volSlider.value);
    try {
      await audio.play();
      playing = true;
      statusEl.textContent = fxReady ? 'FX activo' : '';
    } catch {
      statusEl.textContent = 'error al cargar stream';
    }
    updatePlayBtn();
  }

  function stopPlay() {
    audio.pause();
    playing = false;
    updatePlayBtn();
    statusEl.textContent = '';
  }

  btnPlay.addEventListener('click', () => playing ? stopPlay() : startPlay());

  btnRandom.addEventListener('click', async () => {
    const wasPlaying = playing;
    stopPlay();
    updateStationDisplay(pickStation(randomStation()));
    if (wasPlaying) await startPlay();
  });

  btnAM.addEventListener('click', () => {
    amOn = !amOn;
    btnAM.classList.toggle('active', amOn);
    if (!amNode) return;
    if (amOn) {
      amNode.frequency.value = 1400;
      amNode.Q.value = 1.4;
    } else {
      amNode.frequency.value = 20000;
      amNode.Q.value = 0.01;
    }
  });

  hpSlider.addEventListener('input', () => {
    const v = parseInt(hpSlider.value);
    hpVal.textContent = v >= 1000 ? `${(v/1000).toFixed(1)}k Hz` : `${v} Hz`;
    if (hpNode) hpNode.frequency.value = v;
  });

  lpSlider.addEventListener('input', () => {
    const v = parseInt(lpSlider.value);
    lpVal.textContent = v >= 1000 ? `${(v/1000).toFixed(0)}k Hz` : `${v} Hz`;
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

  audio.addEventListener('error', () => {
    statusEl.textContent = 'stream no disponible';
    playing = false;
    updatePlayBtn();
  });

  return card;
}
