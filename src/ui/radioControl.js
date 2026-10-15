import { RADIO_STREAMS } from '../data/radioStreams.js';

export function buildRadioCard() {
  let currentIdx = -1;
  let playing = false;
  let fxReady = false;
  let amOn = false;

  let audioCtx = null;
  let sourceNode = null;
  let filterNode = null;
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

      // AM bandpass filter
      filterNode = audioCtx.createBiquadFilter();
      filterNode.type = 'bandpass';
      filterNode.frequency.value = 1400;
      filterNode.Q.value = 0.9;

      // Highpass to cut rumble
      const hipass = audioCtx.createBiquadFilter();
      hipass.type = 'highpass';
      hipass.frequency.value = 80;

      // Delay
      delayNode = audioCtx.createDelay(2.0);
      delayNode.delayTime.value = 0;

      // Delay feedback
      const fbGain = audioCtx.createGain();
      fbGain.gain.value = 0;
      delayNode.connect(fbGain);
      fbGain.connect(delayNode);

      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.7;

      // Default chain (clean): source → hipass → delay → master → out
      sourceNode.connect(hipass);
      hipass.connect(delayNode);
      delayNode.connect(masterGain);
      masterGain.connect(audioCtx.destination);

      fxReady = true;
    } catch (e) {
      fxReady = false;
    }
  }

  function setAM(on) {
    amOn = on;
    if (!fxReady || !filterNode || !sourceNode || !masterGain) return;
    // Reconnect chain based on AM toggle
    try {
      sourceNode.disconnect();
      filterNode.disconnect();
      if (on) {
        filterNode.frequency.value = 1400;
        filterNode.Q.value = 1.4;
        sourceNode.connect(filterNode);
        filterNode.connect(delayNode);
      } else {
        filterNode.frequency.value = 80;
        filterNode.Q.value = 0.3;
        sourceNode.connect(filterNode);
        filterNode.connect(delayNode);
      }
    } catch (_) {}
  }

  function pickStation(idx) {
    const station = RADIO_STREAMS[idx];
    if (!station) return;
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

  // Station display
  const stationEl = document.createElement('div');
  stationEl.className = 'radio-station-display';
  stationEl.textContent = '— sin señal —';
  card.appendChild(stationEl);

  // Controls row
  const row1 = document.createElement('div');
  row1.className = 'ritmo-control';

  const btnPlay = document.createElement('button');
  btnPlay.className = 'lente-btn';
  btnPlay.textContent = '▶';
  btnPlay.title = 'Reproducir / Detener';

  const btnRandom = document.createElement('button');
  btnRandom.className = 'lente-btn';
  btnRandom.textContent = '⟳ random';
  btnRandom.title = 'Cambiar emisora al azar';

  row1.appendChild(btnPlay);
  row1.appendChild(btnRandom);
  card.appendChild(row1);

  // FX row
  const row2 = document.createElement('div');
  row2.className = 'ritmo-control';

  const btnAM = document.createElement('button');
  btnAM.className = 'lente-btn';
  btnAM.textContent = 'AM';
  btnAM.title = 'Filtro AM radio';

  const delayLbl = document.createElement('span');
  delayLbl.className = 'lente-label';
  delayLbl.textContent = 'DELAY';

  const delaySlider = document.createElement('input');
  delaySlider.type = 'range';
  delaySlider.min = '0';
  delaySlider.max = '0.8';
  delaySlider.step = '0.01';
  delaySlider.value = '0';
  delaySlider.className = 'lente-slider';
  delaySlider.style.width = '80px';

  row2.appendChild(btnAM);
  row2.appendChild(delayLbl);
  row2.appendChild(delaySlider);
  card.appendChild(row2);

  // Volume row
  const row3 = document.createElement('div');
  row3.className = 'ritmo-control';

  const volLbl = document.createElement('span');
  volLbl.className = 'lente-label';
  volLbl.textContent = 'VOL';

  const volSlider = document.createElement('input');
  volSlider.type = 'range';
  volSlider.min = '0';
  volSlider.max = '1';
  volSlider.step = '0.01';
  volSlider.value = '0.5';
  volSlider.className = 'lente-slider';

  row3.appendChild(volLbl);
  row3.appendChild(volSlider);
  card.appendChild(row3);

  // Status
  const statusEl = document.createElement('span');
  statusEl.className = 'radio-status';
  statusEl.textContent = '';
  card.appendChild(statusEl);

  // ── Event handlers ──────────────────────────────────────────────────────────

  function updateStationDisplay(station) {
    if (!station) { stationEl.textContent = '— sin señal —'; return; }
    stationEl.textContent = `${station.flag} ${station.nombre} · ${station.pais}`;
  }

  function updatePlayBtn() {
    btnPlay.textContent = playing ? '■' : '▶';
    btnPlay.classList.toggle('active', playing);
  }

  async function startPlay() {
    if (currentIdx === -1) pickStation(randomStation());
    initFX();
    if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
    audio.volume = fxReady ? 1 : parseFloat(volSlider.value);
    if (masterGain) masterGain.gain.value = parseFloat(volSlider.value);
    try {
      await audio.play();
      playing = true;
      statusEl.textContent = fxReady ? 'FX activo' : '';
    } catch (e) {
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

  btnPlay.addEventListener('click', async () => {
    if (playing) { stopPlay(); } else { await startPlay(); }
  });

  btnRandom.addEventListener('click', async () => {
    const wasPlaying = playing;
    stopPlay();
    const station = pickStation(randomStation());
    updateStationDisplay(station);
    if (wasPlaying) await startPlay();
  });

  btnAM.addEventListener('click', () => {
    amOn = !amOn;
    setAM(amOn);
    btnAM.classList.toggle('active', amOn);
  });

  delaySlider.addEventListener('input', () => {
    if (delayNode) delayNode.delayTime.value = parseFloat(delaySlider.value);
  });

  volSlider.addEventListener('input', () => {
    const v = parseFloat(volSlider.value);
    if (fxReady && masterGain) {
      masterGain.gain.value = v;
    } else {
      audio.volume = v;
    }
  });

  audio.addEventListener('error', () => {
    statusEl.textContent = 'stream no disponible';
    playing = false;
    updatePlayBtn();
  });

  return card;
}
