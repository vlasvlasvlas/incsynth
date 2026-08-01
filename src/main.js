import * as Tone             from 'tone';
import { LaSala }            from './logic/LaSala.js';
import { Instrumento }        from './logic/Instrumento.js';
import { AudioEngine }        from './audio/Engine.js';
import { PlayableSynth }      from './audio/PlayableSynth.js';
import { PRESETS, DEFAULTS }  from './audio/presets.js';
import { OpenMeteoAdapter }   from './data-sources/OpenMeteoAdapter.js';
import { CoinGeckoAdapter }   from './data-sources/CoinGeckoAdapter.js';
import { NewsRSSAdapter }     from './data-sources/NewsRSSAdapter.js';
import { WorldBankAdapter }   from './data-sources/WorldBankAdapter.js';
import { CircleView }         from './ui/CircleView.js';
import { PartituraView }      from './ui/PartituraView.js';
import {
  buildLenteCard,
  buildCiudadCard,
  buildNoticiasCard,
  buildMercadoCard,
  buildIntervencionCard,
  buildPlayableSynthCard,
} from './ui/controls.js';
import config from './data/config.json';
import patrones from './data/patterns.json';
import mappings from './data/mappings.json';
import paisesData from './data/paises.json';
import * as cuartoMusico from './ai/cuartoMusico.js';
import { buildCuartoMusicoCard } from './ui/cuartoMusicoControl.js';

const SOURCE_EXPLAINERS = {
  clima: {
    origen: 'Open-Meteo Forecast API · ciudad elegida',
    datos: 'temperatura -> magnitud · cambio de temperatura -> AVANZA · viento -> MUTA',
    formula: 'Temp normalizada (-10 a 40 C) + viento normalizado (0 a 80 km/h). No usa palabras.',
  },
  mercado: {
    origen: 'CoinGecko API · bitcoin + ethereum',
    datos: 'cambio 24h promedio -> magnitud · movimiento brusco -> AVANZA · volatilidad -> MUTA',
    formula: 'BTC/ETH 24h: -20% = 0, 0% = 0.5, +20% = 1.',
  },
  noticias: {
    origen: 'RSS publicos · pais/edicion y medio elegibles',
    datos: 'titulares -> palabras clave -> categorias semanticas -> AVANZA/RETIENE/MUTA',
    formula: 'conflicto + muerte + clima suben intensidad; diversidad de categorias sube mutacion.',
  },
};

const VERBOS = ['ENTRA', 'AVANZA', 'RETIENE', 'MUTA', 'SALE'];

function normalizeFuenteId(id) {
  if (id === 'bolsa') return 'mercado';
  if (['clima', 'mercado', 'noticias'].includes(id)) return id;
  return 'clima';
}

async function init() {
  // ── Onboarding ──
  const onboarding = document.getElementById('onboarding');
  if (onboarding) {
    const dismissOnboarding = () => {
      onboarding.classList.add('hidden');
      setTimeout(() => onboarding.remove(), 600);
      window.removeEventListener('keydown', dismissOnboarding);
      window.removeEventListener('click', dismissOnboarding);
    };
    window.addEventListener('keydown', dismissOnboarding);
    window.addEventListener('click', dismissOnboarding);
  }

  const sala = new LaSala(patrones.length);

  // ── APIs abiertas, sin key ──
  const climaFuente    = new OpenMeteoAdapter(-34.6, -58.4, 'Buenos Aires');
  const mercadoFuente  = new CoinGeckoAdapter();
  const noticiasFuente = new NewsRSSAdapter();
  const lenteFuente    = new WorldBankAdapter();
  const playableSynth  = new PlayableSynth();
  climaFuente.start(); mercadoFuente.start(); noticiasFuente.start();
  setInterval(() => { climaFuente.tick(); mercadoFuente.tick(); noticiasFuente.tick(); }, 800);

  const fuentes = { clima: climaFuente, mercado: mercadoFuente, noticias: noticiasFuente };

  // ── Inicializar IA ──
  await cuartoMusico.init();

  // ── Instrumentos (auto-conectados) ──
  const instIds   = Object.keys(config.instrumentos);
  const fuenteIds = instIds.map(id => normalizeFuenteId(config.instrumentos[id].fuente_default));
  const instrumentos = {};
  window._instrumentos = instrumentos;

  for (let i = 0; i < instIds.length; i++) {
    const id  = instIds[i];
    const cfg = config.instrumentos[id];
    const fid = fuenteIds[i];
    const mapeo = mappings.fuentes[fid] || mappings.fuentes.clima;
    const inst  = new Instrumento(id, sala, mapeo, mappings.umbrales, mappings.pesos_sala);
    inst._colorHex  = cfg.color_hex;
    inst._tipoSynth = cfg.tipo;
    inst._nombre    = cfg.nombre || id;
    inst._desc      = cfg.descripcion || '';
    inst._fuenteId  = fid;
    inst._presetKey = DEFAULTS[id] || 'ARCO';
    inst._volumenDb = PRESETS[inst._presetKey]?.volume ?? -18;
    inst._manualSignal = 0;
    inst._manualBlend = 0;
    inst._advanceBias = 0;
    inst._manualMuta = 0;
    inst._glowRadius = 1;
    inst._lightGain = 1;
    inst._glideTime = 0;
    inst._brilloGain = 0;
    instrumentos[id] = inst;
    sala.registrarInstrumento(id, 0);
    inst.conectarFuentes([{ id: `${fid}_A`, tipo: fid, source: fuentes[fid], mapeo }]);
  }
  cuartoMusico.configurarContexto(instrumentos, sala);

  // Iniciar logger de sesión con metadata disponible
  cuartoMusico.iniciarSesion({
    ciudad:  climaFuente._ciudad || 'Buenos Aires',
    fuentes: Object.fromEntries(instIds.map((id, i) => [id, fuenteIds[i]])),
  });

  const setInstrumentSource = (id, fid) => {
    const inst = instrumentos[id];
    const source = fuentes[fid];
    const mapeo = mappings.fuentes[fid];
    if (!inst || !source || !mapeo) return false;
    inst._fuenteId = fid;
    inst.conectarFuentes([{ id: `${fid}_A`, tipo: fid, source, mapeo }]);
    inst.tick();
    return true;
  };

  // ── Vistas Visuales ──
  const mainContainer = document.getElementById('circle-container');
  const views = {
    circle: new CircleView(mainContainer, instIds),
    partitura: new PartituraView(mainContainer, instIds)
  };
  let currentViewId = window.matchMedia('(max-width: 820px)').matches ? 'circle' : 'partitura';

  // Inicializar dejando solo el activo en el DOM
  mainContainer.innerHTML = '';
  mainContainer.appendChild(views[currentViewId]._canvas);
  views[currentViewId]._resize();
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === currentViewId);
  });

  // Toggle de vistas
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const viewId = e.target.dataset.view;
      if (views[viewId]) {
        // Limpiar canvas actual
        mainContainer.innerHTML = '';
        currentViewId = viewId;
        // Re-adjuntar canvas de la nueva vista
        mainContainer.appendChild(views[viewId]._canvas);
        views[viewId]._resize();
      }
    });
  });

  // ── Señales en sidebar ──
  const senalesEl    = document.getElementById('senales-strip');
  const senalUpdates = {};
  for (let i = 0; i < instIds.length; i++) {
    const id  = instIds[i];
    const fid = fuenteIds[i];
    const { card, update } = buildSenalCard(id, fid, config.instrumentos[id], fuentes[fid], instrumentos[id], mappings.fuentes[fid]);
    senalesEl.appendChild(card);
    senalUpdates[id] = update;
  }

  // ── Panel de control en sidebar ──
  let engine = null;
  const primaryEl     = document.getElementById('panel-primary');
  const tableroEl     = document.getElementById('panel-tablero');
  const salaPanelRoot = document.createElement('div');
  salaPanelRoot.className = 'sala-panel';
  const updateSalaPanel = buildSalaPanel(salaPanelRoot, instIds, instrumentos, sala);

  primaryEl.appendChild(buildIntervencionCard(instrumentos, {
    onAdvance: id => instrumentos[id]?.forzarAvance('empuje del convocante') ?? false,
    onAdvanceRandom: () => {
      const candidates = instIds.filter(id => instrumentos[id].posicion < sala.numPatrones - 1);
      if (!candidates.length) return null;
      const id = candidates[Math.floor(Math.random() * candidates.length)];
      instrumentos[id].forzarAvance('azar dirigido');
      return { id, label: instrumentos[id]._nombre || id };
    },
    onRedistributeAndPush: () => {
      const sourcePool = Object.keys(fuentes).sort(() => Math.random() - 0.5);
      instIds.forEach((id, index) => {
        const fid = sourcePool[index % sourcePool.length];
        setInstrumentSource(id, fid);
        instrumentos[id].forzarAvance('cambio de escucha');
      });
      return `nueva escucha: ${instIds.map(id => `${instrumentos[id]._nombre}←${instrumentos[id]._fuenteId}`).join(' · ')}`;
    },
  }));

  primaryEl.appendChild(buildPlayableSynthCard(playableSynth));
  primaryEl.appendChild(salaPanelRoot);

  // Ciudad
  tableroEl.appendChild(buildCiudadCard((ciudad, lat, lon) => {
    const nuevo = new OpenMeteoAdapter(lat, lon, ciudad);
    nuevo.start();
    fuentes.clima = nuevo;
    for (const id in instrumentos) {
      if (instrumentos[id]._fuenteId === 'clima' && instrumentos[id].fuentes[0]) {
        instrumentos[id].fuentes[0].source = nuevo;
      }
    }
  }));

  // Mercado
  tableroEl.appendChild(buildMercadoCard(mercadoFuente));

  // Noticias
  tableroEl.appendChild(buildNoticiasCard(noticiasFuente));

  // Lente país
  tableroEl.appendChild(buildLenteCard(paisesData, lenteFuente, instrumentos));
  tableroEl.appendChild(buildCuartoMusicoCard(cuartoMusico));

  // Timbres
  const sonidoPanel = buildSonidoCard(instIds, config.instrumentos, instrumentos, () => engine);
  tableroEl.appendChild(sonidoPanel.card);

  // BPM + Pulso
  const ritmoPanel = buildRitmoCard(() => engine);
  tableroEl.appendChild(ritmoPanel.card);

  // Botón play/stop unificado en header
  const btnPlay = document.getElementById('btn-detener');
  btnPlay.disabled = false;

  const doToggle = () => {
    if (!engine) {
      // Iniciar
      engine = new AudioEngine(config, patrones, sala, instrumentos, () => {});
      ritmoPanel.apply(engine);
      window._engine = engine;
      engine.start();
      btnPlay.textContent = '■';
      btnPlay.classList.add('playing');
      btnPlay.title = 'Detener';
    } else {
      // Detener
      engine.dispose(); engine = null;
      window._engine = null;
      btnPlay.textContent = '▶';
      btnPlay.classList.remove('playing');
      btnPlay.title = 'Invocar';
    }
  };
  btnPlay.addEventListener('click', doToggle);

  // ── Volumen master (header slider) ──
  const masterVol = document.getElementById('master-vol');
  const masterVolNum = document.getElementById('master-vol-num');
  if (masterVol) {
    Tone.Destination.volume.value = parseFloat(masterVol.value);
    masterVol.addEventListener('input', () => {
      const v = parseFloat(masterVol.value);
      Tone.Destination.volume.value = v;
      if (masterVolNum) masterVolNum.textContent = `${v} dB`;
    });
  }

  // ── Theme toggle (☾) ──
  const btnTheme = document.getElementById('btn-theme');
  const syncThemeSurface = () => {
    const dark = document.body.classList.contains('dark-theme');
    const mainView = document.getElementById('main-view');
    const circleContainer = document.getElementById('circle-container');
    const col = dark ? '#0c1118' : '#f6efe3';
    if (mainView) mainView.style.backgroundColor = col;
    if (circleContainer) circleContainer.style.backgroundColor = col;
  };
  syncThemeSurface();
  btnTheme.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    btnTheme.textContent = document.body.classList.contains('dark-theme') ? '☀' : '☾';
    syncThemeSurface();
    views[currentViewId]?.render(instrumentos, sala);
  });

  // ── Sidebar toggle (⚙) ──
  const btnSidebar = document.getElementById('btn-sidebar');
  btnSidebar.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
    btnSidebar.classList.toggle('active');
  });

  // ── About modal (?) ──
  const aboutModal    = document.getElementById('about-modal');
  const modalClose    = document.getElementById('modal-close');
  const modalBackdrop = document.getElementById('modal-backdrop');
  document.getElementById('btn-about').addEventListener('click', () => aboutModal.classList.add('open'));
  modalClose.addEventListener('click',    () => aboutModal.classList.remove('open'));
  modalBackdrop.addEventListener('click', () => aboutModal.classList.remove('open'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') aboutModal.classList.remove('open'); });

  // ── Render loop ──
  let _bpmLabelLast = 0;
  let _lastIdleTick = 0;
  const tickIdleState = () => {
    const now = performance.now();
    if (!engine && now - _lastIdleTick > 450) {
      for (const id in instrumentos) instrumentos[id].tick();
      _lastIdleTick = now;
    }
  };
  const refreshPanels = () => {
    for (const id in senalUpdates) senalUpdates[id]();
    updateSalaPanel();
    sonidoPanel.update();
    const mb = document.getElementById('momentum-bar');
    if (mb) mb.style.width = `${sala.getMomentum() * 100}%`;

    // BPM label en header
    const bpmEl = document.getElementById('bpm-label');
    if (bpmEl && engine) {
      const bpm = Math.round(Tone.Transport.bpm.value);
      if (bpm !== _bpmLabelLast) { bpmEl.textContent = `${bpm} BPM`; _bpmLabelLast = bpm; }
    }
  };
  setInterval(() => {
    try {
      tickIdleState();
      refreshPanels();
    } catch (e) {
      console.error(e);
    }
  }, 250);

  requestAnimationFrame(function loop() {
    tickIdleState();
    if (views[currentViewId]) {
      views[currentViewId].render(instrumentos, sala);
    }
    requestAnimationFrame(loop);
  });
}

// ── Panel visible de la sala ──
function buildSalaPanel(root, instIds, instrumentos, sala) {
  if (!root) return () => {};

  root.innerHTML = `
    <div class="sala-panel-head">
      <span class="sala-panel-kicker">LA SALA ESCUCHA</span>
      <span class="sala-panel-note">dos oídos: mundo externo + sala compartida</span>
    </div>
    <div class="concept-grid">
      <div class="concept-card">
        <div class="concept-title">HUELLA</div>
        <div class="concept-copy">Los patrones tocados dejan rastro. Esa memoria atrae, satura o destraba.</div>
        <div class="concept-meter"><span id="concept-huella"></span></div>
      </div>
      <div class="concept-card">
        <div class="concept-title">CONVIVENCIA</div>
        <div class="concept-copy">Riley pide no alejarse demasiado. Cerca = escucha; lejos = tensión.</div>
        <div class="concept-meter"><span id="concept-grupo"></span></div>
      </div>
      <div class="concept-card">
        <div class="concept-title">MOMENTUM</div>
        <div class="concept-copy">Cuando alguien avanza, deja una corriente. Los demás pueden sentir ese arrastre.</div>
        <div class="concept-meter"><span id="concept-momentum"></span></div>
      </div>
      <div class="concept-card">
        <div class="concept-title">FORMA</div>
        <div class="concept-copy">El triángulo entre los músicos respira. Su quietud, expansión o contracción modifica la decisión.</div>
        <div class="concept-meter"><span id="concept-area"></span></div>
      </div>
    </div>
    <div class="listening-map" id="listening-map"></div>
    <div class="decision-list" id="decision-list"></div>
  `;

  const huellaEl = root.querySelector('#concept-huella');
  const grupoEl = root.querySelector('#concept-grupo');
  const momentumEl = root.querySelector('#concept-momentum');
  const areaEl = root.querySelector('#concept-area');
  const listeningEl = root.querySelector('#listening-map');
  const listEl = root.querySelector('#decision-list');
  let last = 0;

  return function update() {
    const now = performance.now();
    if (now - last < 220) return;
    last = now;

    const maxHuella = Math.max(0, ...Array.from(sala.terreno));
    const centro = sala.getCentroMasa();
    const distancia = sala.getDistanciaMaxima();
    const momentum = sala.getMomentum();
    const geometria = sala.getGeometria();

    setMeter(huellaEl, maxHuella, `max ${maxHuella.toFixed(2)}`);
    setMeter(grupoEl, Math.min(1, distancia / 8), `centro ${(centro + 1).toFixed(1)} · distancia ${distancia}p`);
    setMeter(momentumEl, momentum, `${Math.round(momentum * 100)}%`);
    setMeter(areaEl, geometria.area, `${geometria.estado} · Δ ${signedPct(geometria.delta)}`);

    listeningEl.innerHTML = renderListeningMap(instIds, instrumentos);

    listEl.innerHTML = instIds.map(id => {
      const inst = instrumentos[id];
      if (!inst) return '';
      const ui = inst.getEstadoUI();
      const breakdown = ui.probBreakdown || (inst.señal ? inst.getProbabilidadBreakdown() : null);
      const p = breakdown?.p ?? 0;
      const motivo = readableMotivo(breakdown?.motivo);
      const world = breakdown?.api ?? 0;
      const room = getRoomPressure(breakdown);
      const closest = getClosestInstrument(id, instIds, instrumentos);
      const escucha = breakdown?.canalEscucha || ui.escucha;
      const estado = ui.estado === 'RETENIDO'
        ? 'retenido: repite el patron'
        : (ui.decision && ui.decision !== 'sin ciclo' ? ui.decision : `${ui.estado}: esperando fin del patron`);
      return `
        <div class="decision-row listening-decision">
          <div class="decision-main">
            <span class="decision-name">${escapeHTML(inst._nombre || id)}</span>
            <span class="decision-state">${escapeHTML(humanDecision(estado, motivo, closest))}</span>
            <span class="decision-pos">patrón ${Math.min(inst.posicion + 1, sala.numPatrones)}/${sala.numPatrones} · ${escapeHTML(formatEscuchaIndividual(escucha, instrumentos))}</span>
            <span class="decision-neighbors">${renderNeighborChannel(escucha, instrumentos)}</span>
          </div>
          <div class="decision-prob">
            <span class="decision-prob-num">${Math.round(p * 100)}%</span>
            <span class="decision-cause">${motivo}</span>
          </div>
          <div class="ear-bars">
            <div><b>mundo</b><i><span style="width:${Math.min(100, Math.abs(world) * 100)}%"></span></i><em>${signedPct(world)}</em></div>
            <div><b>sala</b><i><span style="width:${Math.min(100, Math.abs(room) * 100)}%"></span></i><em>${signedPct(room)}</em></div>
          </div>
          ${renderBreakdownBars(breakdown)}
        </div>
      `;
    }).join('');
  };
}

function renderBreakdownBars(b) {
  if (!b) return '<div class="decision-bars muted">sin senal suficiente</div>';
  const parts = [
    ['dato', b.api, '#1a44cc'],
    ['huella', b.stigmergy, '#111'],
    ['grupo', b.cohesion, '#444'],
    ['separa', b.separacion, '#1a7a1a'],
    ['pulso', b.momentum, '#666'],
    ['impacto', b.shockwave || 0, '#cc8800'],
    ['forma', b.geometria || 0, '#007f79'],
    ['escucha', b.escucha || 0, '#9a4f12'],
    ['secuencia', b.secuencia || 0, '#7a5b22'],
    ['ia', b.iaEstilo || 0, '#7289da'],
    ['red', b.gnn || 0, '#e05c9a'],
    ['mic', b.yamnet || 0, '#2cc0a0'],
    ['control', b.bias || 0, '#7a35cc'],
    ['freno', -b.freno, '#cc2200'],
  ];
  return `
    <div class="decision-bars">
      ${parts.map(([label, value, color]) => {
        const width = Math.min(100, Math.abs(value) * 100);
        const signed = value < 0 ? '-' : '+';
        return `
          <span class="decision-part" title="${label}: ${signed}${Math.abs(value).toFixed(2)}">
            <i style="height:${width}%;background:${color};"></i>
            <b>${label}</b>
          </span>
        `;
      }).join('')}
    </div>
  `;
}

function setMeter(el, value, label) {
  if (!el) return;
  el.style.width = `${Math.max(0, Math.min(1, value)) * 100}%`;
  el.textContent = label;
}

function readableMotivo(motivo) {
  return ({
    api: 'dato externo',
    dato: 'dato externo',
    stigmergy: 'huella',
    huella: 'huella',
    cohesion: 'grupo',
    grupo: 'grupo',
    separacion: 'destrabe',
    momentum: 'momentum',
    shockwave: 'impacto',
    impacto: 'impacto',
    geometria: 'forma de la sala',
    escucha: 'escucha vecinal',
    secuencia: 'secuencia',
    ia_estilo: 'estilo temporal',
    maduracion: 'maduración',
    tiempo: 'tiempo habitado',
    control: 'control manual',
    freno_manual: 'freno manual',
    freno: 'freno',
    gnn_social: 'red social',
    yamnet_ambiente: 'escucha ambiente',
  })[motivo] || 'mixto';
}

function renderListeningMap(instIds, instrumentos) {
  const pairs = [];
  for (let i = 0; i < instIds.length; i++) {
    for (let j = i + 1; j < instIds.length; j++) {
      const a = instrumentos[instIds[i]];
      const b = instrumentos[instIds[j]];
      if (!a || !b) continue;
      const d = Math.abs(a.posicion - b.posicion);
      pairs.push({ a, b, d, rel: relationLabel(d) });
    }
  }
  if (!pairs.length) return '';
  return `
    <div class="listening-title">QUIÉN SE ESTÁ OYENDO</div>
    ${pairs.map(({ a, b, d, rel }) => `
      <div class="listening-pair ${rel.key}">
        <span>${escapeHTML(a._nombre || a.id)}</span>
        <i>${escapeHTML(rel.text)} · ${d} patrones</i>
        <span>${escapeHTML(b._nombre || b.id)}</span>
      </div>
    `).join('')}
  `;
}

function relationLabel(distance) {
  if (distance <= 1) return { key: 'unisono', text: 'unísono' };
  if (distance <= 3) return { key: 'escucha', text: 'escucha fuerte' };
  if (distance <= 6) return { key: 'tension', text: 'tensión útil' };
  return { key: 'aislado', text: 'aislamiento' };
}

function getClosestInstrument(id, instIds, instrumentos) {
  const inst = instrumentos[id];
  if (!inst) return null;
  let best = null;
  for (const otherId of instIds) {
    if (otherId === id) continue;
    const other = instrumentos[otherId];
    if (!other) continue;
    const d = Math.abs(inst.posicion - other.posicion);
    if (!best || d < best.distance) {
      best = { id: otherId, name: other._nombre || otherId, distance: d, relation: relationLabel(d) };
    }
  }
  return best;
}

function getRoomPressure(b) {
  if (!b) return 0;
  return (b.stigmergy || 0)
    + (b.cohesion || 0)
    + (b.separacion || 0)
    + (b.momentum || 0)
    + (b.shockwave || 0)
    + (b.geometria || 0)
    + (b.escucha || 0)
    + (b.secuencia || 0)
    + (b.bias || 0)
    - (b.freno || 0);
}

function humanDecision(estado, motivo, closest) {
  const relation = closest ? `${closest.relation.text} con ${closest.name}` : 'sin relación cercana';
  if (motivo === 'impacto') return `se mueve porque otro avance lo contagia; ${relation}`;
  if (motivo === 'grupo') return `la sala lo arrastra hacia el grupo; ${relation}`;
  if (motivo === 'huella') return `la huella del patrón todavía pesa; ${relation}`;
  if (motivo === 'destrabe') return `abre espacio para no quedar pegado; ${relation}`;
  if (motivo === 'momentum') return `sigue la corriente colectiva; ${relation}`;
  if (motivo === 'dato externo') return `su mundo externo empuja; ${relation}`;
  if (motivo === 'forma de la sala') return `la forma común cambió su decisión; ${relation}`;
  if (motivo === 'escucha vecinal') return `ajusta su paso después de escuchar a los otros; ${relation}`;
  if (motivo === 'secuencia') return `la repetición acumulada pide transformar el patrón; ${relation}`;
  if (motivo === 'estilo temporal') return `el cuarto músico anticipa el estilo reciente; ${relation}`;
  if (motivo === 'maduración') return `todavía habita y escucha este patrón; ${relation}`;
  if (motivo === 'tiempo habitado') return `el tiempo acumulado habilita el avance; ${relation}`;
  if (motivo === 'freno') return `se frena por alejarse demasiado; ${relation}`;
  if (motivo === 'control manual') return `gesto del convocante altera su escucha; ${relation}`;
  if (motivo === 'red social') return `la red de músicos lo presiona a moverse; ${relation}`;
  if (motivo === 'escucha ambiente') return `el sonido del espacio modula su decisión; ${relation}`;
  return `${estado}; ${relation}`;
}

function signedPct(v) {
  const n = Math.round(Math.max(-1, Math.min(1, v || 0)) * 100);
  return `${n >= 0 ? '+' : ''}${n}%`;
}

function formatEscuchaIndividual(escucha, instrumentos) {
  if (!escucha) return 'sin canal de escucha';
  const closest = escucha.masCercano;
  if (!closest) return escucha.rol;
  const nombre = instrumentos[closest.id]?._nombre || closest.id;
  return `${escucha.rol} · ${nombre} a ${closest.distancia}p`;
}

function renderNeighborChannel(escucha, instrumentos) {
  if (!escucha?.vecinos?.length) return '';
  return escucha.vecinos.map(vecino => {
    const nombre = instrumentos[vecino.id]?._nombre || vecino.id;
    const signo = vecino.delta > 0 ? '+' : '';
    return `<i class="neighbor-chip ${vecino.direccion}">${escapeHTML(nombre)} ${signo}${vecino.delta}p</i>`;
  }).join('');
}

// ── Señal card ──
function buildSenalCard(instId, fuenteId, cfg, fuente, inst, mapeo) {
  const COLORS  = { clima: '#1a44cc', mercado: '#1a7a1a', noticias: '#cc8800' };
  const LABELS  = { clima: 'CLIMA (Open-Meteo)', mercado: 'MERCADO (CoinGecko)', noticias: 'NOTICIAS (RSS)' };
  const col     = COLORS[fuenteId] || '#888';
  const label   = LABELS[fuenteId] || fuenteId;

  const card = document.createElement('div'); card.className = 'senal-card';

  const hdr = document.createElement('div'); hdr.className = 'senal-header';
  hdr.innerHTML = `
    <span class="senal-fuente-nome" style="color:${col}">${label}</span>
    <span class="senal-flecha">→</span>
    <span class="senal-inst-nome">${cfg.nombre || instId}</span>
    <span class="senal-estado-badge" id="ss-estado-${instId}">—</span>
  `;

  const desc = document.createElement('div');
  desc.style.cssText = 'font-family:var(--mono);font-size:0.5rem;color:#ccc;';
  desc.textContent = cfg.descripcion || '';

  const payloadEl = document.createElement('div');
  payloadEl.className = 'senal-payload'; payloadEl.style.color = col;

  // Semáforo de probabilidad (BITACORA: verde pleno / tenue / amarillo / naranja / rojo)
  const semaforo = document.createElement('div');
  semaforo.className = 'senal-semaforo';
  semaforo.innerHTML = `
    <span class="semaforo-label">P(avance)</span>
    <div class="semaforo-bar-bg"><div class="semaforo-bar-fill" id="sem-fill-${instId}"></div></div>
    <span class="semaforo-estado" id="sem-estado-${instId}">—</span>
  `;

  const barBg = document.createElement('div'); barBg.className = 'senal-barra-bg';
  const barFl = document.createElement('div'); barFl.className = 'senal-barra-fill'; barFl.style.background = col;
  barBg.appendChild(barFl);

  const valsEl = document.createElement('div'); valsEl.className = 'senal-valores';
  valsEl.innerHTML = `señal: <span class="senal-val-num" id="ss-mag-${instId}">—</span>
    &nbsp;vol: <span class="senal-val-num" id="ss-vol-${instId}">—</span>
    &nbsp;cambio: <span class="senal-val-num" id="ss-cam-${instId}">—</span>`;

  const verbosEl = document.createElement('div'); verbosEl.className = 'senal-verbos';
  const chips = {};
  for (const v of ['AVANZA','RETIENE','MUTA','SALE']) {
    const c = document.createElement('span'); c.className = `verbo-chip ${v}`; c.textContent = v;
    verbosEl.appendChild(c); chips[v] = c;
  }

  const origenEl = document.createElement('div');
  origenEl.className = 'senal-origen';
  const exp = SOURCE_EXPLAINERS[fuenteId];
  origenEl.innerHTML = exp ? `
    <div><b>origen:</b> ${escapeHTML(exp.origen)}</div>
    <div><b>influye:</b> ${escapeHTML(exp.datos)}</div>
    <div class="senal-formula">${escapeHTML(exp.formula)}</div>
  ` : '';

  const detalleEl = document.createElement('div');
  detalleEl.className = 'senal-detalle';

  for (const el of [hdr, desc, payloadEl, semaforo, barBg, valsEl, verbosEl, origenEl, detalleEl]) card.appendChild(el);

  function update() {
    const ui = inst.getEstadoUI();
    const s  = inst.fuentes?.[0]?.source || fuente;
    const activeFuenteId = inst.fuentes?.[0]?.tipo || inst._fuenteId || fuenteId;
    const activeMapeo = inst.fuentes?.[0]?.mapeo || inst.mapeo || mapeo;
    const activeColor = COLORS[activeFuenteId] || '#888';
    const fuenteLabelEl = hdr.querySelector('.senal-fuente-nome');
    if (fuenteLabelEl) {
      fuenteLabelEl.textContent = LABELS[activeFuenteId] || activeFuenteId;
      fuenteLabelEl.style.color = activeColor;
    }

    const eEl = document.getElementById(`ss-estado-${instId}`);
    if (eEl) { eEl.textContent = ui.estado; eEl.className = `senal-estado-badge ${ui.estado.toLowerCase()}`; }

    payloadEl.textContent = s.payloadText || '—';
    payloadEl.style.color = activeColor;
    barFl.style.background = activeColor;
    barFl.style.width = `${s.magnitud * 100}%`;

    const mEl = document.getElementById(`ss-mag-${instId}`);
    const vEl = document.getElementById(`ss-vol-${instId}`);
    const cEl = document.getElementById(`ss-cam-${instId}`);
    if (mEl) mEl.textContent = s.magnitud.toFixed(2);
    if (vEl) vEl.textContent = s.volatilidad.toFixed(2);
    if (cEl) {
      const c = s.cambio;
      cEl.textContent = c > 0.01 ? `↑${c.toFixed(2)}` : c < -0.01 ? `↓${c.toFixed(2)}` : '→0';
      cEl.style.color = c > 0.01 ? '#1a7a1a' : c < -0.01 ? '#cc2200' : '#999';
    }

    // Semáforo de probabilidad
    const probBreakdown = ui.probBreakdown || (inst.señal ? inst.getProbabilidadBreakdown() : null);
    if (probBreakdown) {
      const p      = probBreakdown.p;
      const sfill  = document.getElementById(`sem-fill-${instId}`);
      const sestEl = document.getElementById(`sem-estado-${instId}`);
      if (sfill) {
        sfill.style.width      = `${p * 100}%`;
        sfill.style.background = p > 0.60 ? '#1a7a1a' : p > 0.40 ? '#ccaa00' : p > 0.20 ? '#cc6600' : '#cc2200';
      }
      if (sestEl) {
        sestEl.textContent = p > 0.60 ? 'avanza ▶' : p > 0.40 ? 'posible ◐' : p > 0.20 ? 'frenado ◑' : 'insiste ●';
        sestEl.style.color = p > 0.60 ? '#1a7a1a' : p > 0.40 ? '#ccaa00' : p > 0.20 ? '#cc6600' : '#cc2200';
      }
    }

    if (activeMapeo) {
      for (const v of ['AVANZA','RETIENE','MUTA','SALE']) {
        const p = s.getVerb ? s.getVerb(v, activeMapeo) : 0;
        chips[v].classList.toggle('activo', p > 0.12);
        chips[v].title = `${v}: ${p.toFixed(2)}`;
        chips[v].textContent = `${v} ${p.toFixed(2)}`;
      }
    }

    const expActual = SOURCE_EXPLAINERS[activeFuenteId];
    origenEl.innerHTML = expActual ? `
      <div><b>origen:</b> ${escapeHTML(expActual.origen)}</div>
      <div><b>influye:</b> ${escapeHTML(expActual.datos)}</div>
      <div class="senal-formula">${escapeHTML(expActual.formula)}</div>
    ` : '';
    detalleEl.innerHTML = renderFuenteDetalle(activeFuenteId, s, activeMapeo);
  }
  return { card, update };
}

function renderFuenteDetalle(fuenteId, source, mapeo) {
  if (fuenteId === 'noticias' && source.getDebugInfo) {
    return renderNoticiasDetalle(source.getDebugInfo(), source, mapeo);
  }
  const verbs = mapeo ? VERBOS.map(v => {
    const val = source.getVerb ? source.getVerb(v, mapeo) : 0;
    return `<span class="data-chip">${v} ${val.toFixed(2)}</span>`;
  }).join('') : '';
  return `<div class="data-chip-row">${verbs}</div>`;
}

function renderNoticiasDetalle(info, source, mapeo) {
  const feeds = (info.feeds || []).map(feed => `
    <div class="feed-row">
      <span>${escapeHTML(feed.name)}</span>
      <span class="${feed.estado === 'ok' ? 'ok' : 'err'}">${escapeHTML(feed.estado)}${feed.items ? ` · ${feed.items}` : ''}${feed.error ? ` · ${escapeHTML(feed.error)}` : ''}</span>
    </div>
  `).join('');

  const categorias = Object.entries(info.categorias || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cat, n]) => {
      const max = Math.max(1, ...Object.values(info.categorias || {}));
      return `
        <div class="cat-row">
          <span>${escapeHTML(cat)}</span>
          <div><i style="width:${Math.round((n / max) * 100)}%"></i></div>
          <b>${n}</b>
        </div>
      `;
    }).join('');

  const palabras = (info.palabras || [])
    .map(p => `<span class="word-chip">${escapeHTML(p.palabra)} <b>${p.n}</b></span>`)
    .join('') || '<span class="word-chip muted">sin palabras clave</span>';

  const titulares = (info.titulares || []).slice(0, 3).map(t => `
    <div class="headline-row"><b>${escapeHTML(t.fuente)}</b> ${escapeHTML(t.titulo)}</div>
  `).join('');

  const verbs = mapeo ? VERBOS.map(v => {
    const val = source.getVerb ? source.getVerb(v, mapeo) : 0;
    return `<span class="data-chip">${v} ${val.toFixed(2)}</span>`;
  }).join('') : '';

  return `
    <div class="news-flow">${escapeHTML(info.flujo || '')}</div>
    <div class="feed-list">${feeds}</div>
    <div class="cat-list">${categorias}</div>
    <div class="word-list">${palabras}</div>
    <div class="data-chip-row">${verbs}</div>
    <div class="headline-list">${titulares}</div>
  `;
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Panel de síntesis clásica por canal ──
function buildSynthEditPanel(id, inst, getEngine) {
  const TIPOS = ['Synth', 'FMSynth', 'AMSynth', 'PolySynth', 'MembraneSynth'];
  const ONDAS = ['sine', 'triangle', 'sawtooth', 'square', 'triangle8', 'sawtooth4', 'fat4'];

  const panel = document.createElement('div');
  panel.className = 'synth-edit-panel';

  let tipo = 'Synth';
  let params = {};
  let filterFreq = 8000;

  function patch(changes) {
    const eng = getEngine();
    if (eng) eng.patchSynth(id, changes);
  }

  // Tipo de synth
  const tipoRow = document.createElement('div');
  tipoRow.className = 'synth-edit-row';
  const tipoLbl = document.createElement('span'); tipoLbl.textContent = 'TIPO';
  const tipoSel = document.createElement('select'); tipoSel.className = 'lente-sel';
  TIPOS.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; tipoSel.appendChild(o); });
  tipoSel.addEventListener('change', () => {
    tipo = tipoSel.value;
    updateConditional();
    const eng = getEngine();
    if (eng) eng.patchSynthType(id, tipo, buildConfig());
  });
  tipoRow.appendChild(tipoLbl); tipoRow.appendChild(tipoSel);
  panel.appendChild(tipoRow);

  // Tipo de onda
  const ondaRow = document.createElement('div');
  ondaRow.className = 'synth-edit-row';
  const ondaLbl = document.createElement('span'); ondaLbl.textContent = 'ONDA';
  const ondaSel = document.createElement('select'); ondaSel.className = 'lente-sel';
  ONDAS.forEach(w => { const o = document.createElement('option'); o.value = w; o.textContent = w; ondaSel.appendChild(o); });
  ondaSel.addEventListener('change', () => {
    params.oscillator = { ...params.oscillator, type: ondaSel.value };
    patch({ oscillator: { type: ondaSel.value } });
  });
  ondaRow.appendChild(ondaLbl); ondaRow.appendChild(ondaSel);
  panel.appendChild(ondaRow);

  // ADSR + Filtro
  const atkR = makePanelRange('ATAQUE',  0.001, 5,     0.001, 0.1,  v => `${v.toFixed(2)}s`, v => { if (!params.envelope) params.envelope = {}; params.envelope.attack  = v; patch({ envelope: { attack:  v } }); });
  const decR = makePanelRange('DECAY',   0.001, 5,     0.001, 0.5,  v => `${v.toFixed(2)}s`, v => { if (!params.envelope) params.envelope = {}; params.envelope.decay   = v; patch({ envelope: { decay:   v } }); });
  const susR = makePanelRange('SUSTAIN', 0,     1,     0.01,  0.5,  v => v.toFixed(2),        v => { if (!params.envelope) params.envelope = {}; params.envelope.sustain = v; patch({ envelope: { sustain: v } }); });
  const relR = makePanelRange('RELEASE', 0.05,  12,    0.01,  1.0,  v => `${v.toFixed(2)}s`, v => { if (!params.envelope) params.envelope = {}; params.envelope.release = v; patch({ envelope: { release: v } }); });
  const filR = makePanelRange('FILTRO',  120,   18000, 10,    8000, v => `${Math.round(v)}Hz`, v => { filterFreq = v; const eng = getEngine(); if (eng) eng.patchFilter(id, v); });
  const harR = makePanelRange('HARM',    0.1,   20,    0.1,   2,    v => v.toFixed(1),        v => { params.harmonicity = v; patch({ harmonicity: v }); });
  const modR = makePanelRange('MOD IDX', 0,     40,    0.1,   5,    v => v.toFixed(1),        v => { params.modulationIndex = v; patch({ modulationIndex: v }); });

  for (const r of [atkR, decR, susR, relR, filR, harR, modR]) panel.appendChild(r.el);

  function updateConditional() {
    const isFM = tipo === 'FMSynth';
    const isAM = tipo === 'AMSynth';
    const isMem = tipo === 'MembraneSynth';
    harR.el.style.display = (isFM || isAM) ? '' : 'none';
    modR.el.style.display = isFM ? '' : 'none';
    ondaRow.style.display = isMem ? 'none' : '';
  }

  function buildConfig() {
    const cfg = JSON.parse(JSON.stringify(params));
    return cfg;
  }

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'mini-btn synth-reset-btn';
  resetBtn.textContent = 'RESETEAR AL PRESET';
  resetBtn.addEventListener('click', () => {
    syncFromPreset(inst._presetKey || 'ARCO');
    const eng = getEngine();
    if (eng) eng.cambiarPreset(id, inst._presetKey || 'ARCO');
  });
  panel.appendChild(resetBtn);

  function syncFromPreset(presetKey) {
    const preset = PRESETS[presetKey] || {};
    tipo = preset.tipo || 'Synth';
    params = preset.config ? JSON.parse(JSON.stringify(preset.config)) : {};
    filterFreq = preset.effects?.filterFreq ?? 8000;

    tipoSel.value = tipo;
    const oscType = params.oscillator?.type || 'sine';
    ondaSel.value = ONDAS.includes(oscType) ? oscType : 'sine';

    atkR.set(params.envelope?.attack  ?? 0.1);
    decR.set(params.envelope?.decay   ?? 0.5);
    susR.set(params.envelope?.sustain ?? 0.5);
    relR.set(params.envelope?.release ?? 1.0);
    filR.set(filterFreq);
    harR.set(params.harmonicity     ?? 2);
    modR.set(params.modulationIndex ?? 5);
    updateConditional();
  }

  syncFromPreset(inst._presetKey || 'ARCO');

  return { el: panel, syncFromPreset };
}

function makePanelRange(label, min, max, step, initial, format, onInput) {
  const r = makeRange(label, min, max, step, initial, format, onInput);
  r.set = v => {
    const clamped = Math.max(min, Math.min(max, v));
    r.input.value = String(clamped);
    r.value.textContent = format(clamped);
  };
  return r;
}

// ── Instrumentos: señal, luz y sonido ──
function buildSonidoCard(instIds, instConfig, instrumentos, getEngine) {
  const card = document.createElement('div'); card.className = 'sonido-card';
  const h = document.createElement('h3'); h.textContent = 'MÚSICOS CONVOCADOS'; card.appendChild(h);
  const rows = {};

  for (const id of instIds) {
    const cfg = instConfig[id];
    const inst = instrumentos[id];
    const touchInst = () => { if (!getEngine()) inst.tick(); };
    const row = document.createElement('div'); row.className = 'sonido-row instrumento-control';
    const lbl = document.createElement('div'); lbl.className = 'sonido-inst-name'; lbl.textContent = cfg.nombre || id;
    const status = document.createElement('div'); status.className = 'inst-live-status'; status.textContent = 'sin ciclo';
    const dlbl = document.createElement('div'); dlbl.className = 'sonido-inst-desc';
    const sel = document.createElement('select'); sel.className = 'lente-sel'; sel.style.width = '100%';
    for (const key of Object.keys(PRESETS)) {
      const opt = document.createElement('option');
      opt.value = key; opt.textContent = PRESETS[key].nombre;
      if (key === (inst._presetKey || DEFAULTS[id] || 'ARCO')) opt.selected = true;
      sel.appendChild(opt);
    }
    dlbl.textContent = PRESETS[sel.value]?.desc || '';

    const editToggle = document.createElement('button');
    editToggle.type = 'button';
    editToggle.className = 'mini-btn synth-edit-toggle';
    editToggle.textContent = '+ SÍNTESIS';

    const editPanel = buildSynthEditPanel(id, inst, getEngine);
    editPanel.el.style.display = 'none';

    editToggle.addEventListener('click', () => {
      const open = editPanel.el.style.display !== 'none';
      editPanel.el.style.display = open ? 'none' : '';
      editToggle.textContent = open ? '+ SÍNTESIS' : '− SÍNTESIS';
      editToggle.classList.toggle('active', !open);
    });

    sel.addEventListener('change', () => {
      const preset = PRESETS[sel.value];
      dlbl.textContent = preset?.desc || '';
      inst._presetKey = sel.value;
      editPanel.syncFromPreset(sel.value);

      const newVol = preset?.volume ?? -18;
      inst._volumenDb = newVol;
      const volInput = row.querySelector('input[type="range"]');
      if (volInput) {
        volInput.value = newVol;
        const volVal = volInput.nextElementSibling;
        if (volVal) volVal.textContent = `${Math.round(newVol)} dB`;
      }

      const eng = getEngine();
      if (eng && eng._running) eng.cambiarPreset(id, sel.value);
    });

    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'mini-btn';
    previewBtn.textContent = 'ESCUCHAR';
    previewBtn.addEventListener('click', async () => {
      const eng = getEngine();
      if (eng && eng._running) {
        eng.audition(id);
      } else {
        await previewPreset(sel.value, id, inst._volumenDb ?? 0);
      }
    });

    const colorRow = document.createElement('div');
    colorRow.className = 'control-row color-control-row';
    const colorLbl = document.createElement('span');
    colorLbl.className = 'control-label';
    colorLbl.textContent = 'COLOR';
    const colorInp = document.createElement('input');
    colorInp.type = 'color';
    colorInp.value = cfg.color_hex || '#ffffff';
    colorInp.className = 'color-input';
    colorInp.addEventListener('input', (e) => { inst._colorHex = e.target.value; touchInst(); });
    colorRow.appendChild(colorLbl);
    colorRow.appendChild(colorInp);
    colorRow.appendChild(previewBtn);

    const signalRow = makeRange('PRESIÓN', 0, 1, 0.01, inst._manualSignal ?? 0, v => v.toFixed(2), v => { inst._manualSignal = v; touchInst(); });
    const blendRow  = makeRange('GESTO', 0, 1, 0.01, inst._manualBlend ?? 0, v => `${Math.round(v * 100)}%`, v => { inst._manualBlend = v; touchInst(); });
    const syncPresion = () => {
      const active = parseFloat(blendRow.input.value) > 0.02;
      signalRow.el.style.opacity = active ? '' : '0.35';
      signalRow.el.title = active ? '' : 'Sube GESTO para activar PRESIÓN';
    };
    blendRow.input.addEventListener('input', syncPresion);
    syncPresion();
    const advanceRow = makeRange('PASO', -0.35, 0.45, 0.01, inst._advanceBias ?? 0, v => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`, v => { inst._advanceBias = v; touchInst(); });
    const mutaRow = makeRange('APERTURA', 0, 1, 0.01, inst._manualMuta ?? 0, v => v.toFixed(2), v => { inst._manualMuta = v; touchInst(); });
    const glowRow = makeRange('GLIDE', 0, 0.4, 0.01, inst._glideTime ?? 0, v => `${v.toFixed(2)}s`, v => { inst._glideTime = v; touchInst(); });
    const lightRow = makeRange('BRILLO', -12, 12, 0.5, inst._brilloGain ?? 0, v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}dB`, v => { inst._brilloGain = v; touchInst(); });
    const volRow = makeRange('VOL', -40, 12, 1, inst._volumenDb ?? -18, v => `${Math.round(v)} dB`, v => { inst._volumenDb = v; touchInst(); });

    row.appendChild(lbl);
    row.appendChild(status);
    row.appendChild(sel);
    row.appendChild(dlbl);
    row.appendChild(editToggle);
    row.appendChild(editPanel.el);
    row.appendChild(colorRow);
    row.appendChild(signalRow.el);
    row.appendChild(blendRow.el);
    row.appendChild(advanceRow.el);
    row.appendChild(mutaRow.el);
    row.appendChild(glowRow.el);
    row.appendChild(lightRow.el);
    row.appendChild(volRow.el);
    card.appendChild(row);
    rows[id] = { status, signalRow, blendRow, advanceRow, mutaRow, glowRow, lightRow, volRow };
  }
  return {
    card,
    update() {
      for (const id of instIds) {
        const inst = instrumentos[id];
        const row = rows[id];
        if (!inst || !row) continue;
        const ui = inst.getEstadoUI();
        const b = inst.señal ? inst.getProbabilidadBreakdown() : null;
        row.status.textContent = `${ui.estado} · patrón ${Math.min(ui.posicion + 1, inst.sala.numPatrones)}/${inst.sala.numPatrones} · P ${Math.round((b?.p ?? 0) * 100)}% · señal ${ui.señal.toFixed(2)}`;
      }
    }
  };
}

function makeRange(label, min, max, step, initial, format, onInput) {
  const el = document.createElement('div');
  el.className = 'control-row';
  const lbl = document.createElement('span');
  lbl.className = 'control-label';
  lbl.textContent = label;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(initial);
  const value = document.createElement('span');
  value.className = 'control-value';
  const sync = () => {
    const v = parseFloat(input.value);
    value.textContent = format(v);
    onInput(v);
  };
  input.addEventListener('input', sync);
  el.appendChild(lbl);
  el.appendChild(input);
  el.appendChild(value);
  sync();
  return { el, input, value };
}

async function previewPreset(presetKey, id, volumeDb = 0) {
  const preset = PRESETS[presetKey] || PRESETS.ARCO;
  await Tone.start();
  const filter = new Tone.Filter(preset.effects?.filterFreq || 9000, preset.effects?.filterType || 'lowpass').toDestination();
  const synth = createToneSynth(preset);
  synth.connect(filter);
  synth.volume.value = (preset.volume ?? -18) + volumeDb;

  const now = Tone.now() + 0.03;
  const notes = id === 'percusion' ? ['C2', 'G2', 'C2'] : ['C4', 'E4', 'G4'];
  notes.forEach((nota, i) => {
    try { synth.triggerAttackRelease(nota, '8n', now + i * 0.15); } catch (_) {}
  });
  setTimeout(() => {
    try { synth.dispose(); } catch (_) {}
    try { filter.dispose(); } catch (_) {}
  }, 1800);
}

function createToneSynth(preset) {
  try {
    if (preset.tipo === 'AMSynth') return new Tone.AMSynth(preset.config);
    if (preset.tipo === 'FMSynth') return new Tone.FMSynth(preset.config);
    if (preset.tipo === 'MembraneSynth') return new Tone.MembraneSynth(preset.config);
    if (preset.tipo === 'PolySynth') return new Tone.PolySynth(Tone.Synth, preset.config);
    return new Tone.Synth(preset.config);
  } catch (_) {
    return new Tone.Synth();
  }
}

// ── BPM y volumen del pulso ──
function buildRitmoCard(getEngine) {
  const card = document.createElement('div'); card.className = 'sonido-card ritmo-card';
  const h = document.createElement('h3'); h.textContent = 'RITMO'; card.appendChild(h);
  const grid = document.createElement('div'); grid.className = 'ritmo-grid';
  card.appendChild(grid);

  // BPM
  const bpmRow = document.createElement('div'); bpmRow.className = 'ritmo-control ritmo-bpm-row';
  const bpmLbl = document.createElement('span'); bpmLbl.className = 'lente-label'; bpmLbl.textContent = 'BPM';
  const bpmInput = document.createElement('input');
  bpmInput.type = 'number';
  bpmInput.min = '30';
  bpmInput.max = '180';
  bpmInput.step = '1';
  bpmInput.value = '70';
  bpmInput.className = 'bpm-number-input';
  bpmInput.setAttribute('aria-label', 'Tempo en BPM');
  const applyBpm = raw => {
    const v = Math.max(30, Math.min(180, Math.round(Number(raw) || 70)));
    bpmInput.value = String(v);
    const eng = getEngine();
    if (eng) eng.setBPM(v);
    else Tone.Transport.bpm.value = v;
    const lbl = document.getElementById('bpm-label');
    if (lbl) lbl.textContent = `${v} BPM`;
  };
  bpmInput.addEventListener('input', () => {
    if (bpmInput.value !== '') applyBpm(bpmInput.value);
  });
  bpmInput.addEventListener('change', () => applyBpm(bpmInput.value));
  applyBpm(70);
  bpmRow.appendChild(bpmLbl); bpmRow.appendChild(bpmInput);
  grid.appendChild(bpmRow);

  const timbreRow = document.createElement('div'); timbreRow.className = 'ritmo-control';
  const timbreLbl = document.createElement('span'); timbreLbl.className = 'lente-label'; timbreLbl.textContent = 'TIMBRE';
  const timbreSel = document.createElement('select'); timbreSel.className = 'lente-sel';
  [
    ['triangle', 'TRIÁNGULO'],
    ['sine', 'SENO'],
    ['square', 'CUADRADA'],
    ['sawtooth', 'SIERRA'],
  ].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    timbreSel.appendChild(option);
  });
  timbreSel.value = 'sine';
  timbreSel.addEventListener('change', () => getEngine()?._pulse?.setWaveform(timbreSel.value));
  timbreRow.appendChild(timbreLbl);
  timbreRow.appendChild(timbreSel);
  grid.appendChild(timbreRow);

  const freqRow = document.createElement('div'); freqRow.className = 'ritmo-control';
  const freqLbl = document.createElement('span'); freqLbl.className = 'lente-label'; freqLbl.textContent = 'FREQ';
  const freqInput = document.createElement('input');
  freqInput.type = 'number';
  freqInput.min = '110';
  freqInput.max = '3520';
  freqInput.step = '1';
  freqInput.value = '1047';
  freqInput.className = 'bpm-number-input pulse-frequency-input';
  freqInput.setAttribute('aria-label', 'Frecuencia del pulso en Hz');
  freqInput.addEventListener('input', () => {
    if (freqInput.value !== '') getEngine()?._pulse?.setFrequency(freqInput.value);
  });
  freqRow.appendChild(freqLbl);
  freqRow.appendChild(freqInput);
  grid.appendChild(freqRow);

  // Volumen del pulso
  const pulsoRow = document.createElement('div'); pulsoRow.className = 'ritmo-control ritmo-pulso-control';
  const pulsoLbl = document.createElement('span'); pulsoLbl.className = 'lente-label'; pulsoLbl.textContent = 'PULSO';
  const pulsoControl = document.createElement('div'); pulsoControl.className = 'ritmo-pulso-input';
  const pulsoSlider = document.createElement('input');
  pulsoSlider.type = 'range'; pulsoSlider.min = -60; pulsoSlider.max = 0; pulsoSlider.step = 1; pulsoSlider.value = -23;
  pulsoSlider.setAttribute('aria-label', 'Volumen del golpe agudo (-60 = silencio)');
  pulsoSlider.title = '-23 dB';
  let kickEnabled = false;
  const kickBtn = document.createElement('button');
  kickBtn.type = 'button';
  kickBtn.className = 'ritmo-kick-btn';
  kickBtn.textContent = 'BOMBO';
  kickBtn.title = 'Sumar bombo grave en negras';
  kickBtn.setAttribute('aria-pressed', 'false');
  pulsoSlider.addEventListener('input', () => {
    const v = parseInt(pulsoSlider.value);
    pulsoSlider.title = v <= -58 ? 'MUTE' : `${v} dB`;
    const eng = getEngine();
    if (eng?._pulse) eng._pulse.setVolume(v <= -58 ? -Infinity : v);
  });
  kickBtn.addEventListener('click', () => {
    kickEnabled = !kickEnabled;
    kickBtn.classList.toggle('active', kickEnabled);
    kickBtn.setAttribute('aria-pressed', String(kickEnabled));
    kickBtn.title = kickEnabled ? 'Quitar bombo grave' : 'Sumar bombo grave en negras';
    getEngine()?._pulse?.setKickEnabled(kickEnabled);
  });
  pulsoControl.appendChild(pulsoSlider);
  pulsoControl.appendChild(kickBtn);
  pulsoRow.appendChild(pulsoLbl);
  pulsoRow.appendChild(pulsoControl);
  grid.appendChild(pulsoRow);

  return {
    card,
    apply(engine) {
      if (!engine) return;
      engine.setBPM(bpmInput.value);
      engine._pulse?.setWaveform(timbreSel.value);
      engine._pulse?.setFrequency(freqInput.value);
      engine._pulse?.setVolume(pulsoSlider.value);
      engine._pulse?.setKickEnabled(kickEnabled);
    },
  };
}

init();
