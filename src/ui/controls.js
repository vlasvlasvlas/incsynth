// Controles independientes: lente país, noticias y selector de ciudad

export function buildIntervencionCard(instrumentos, callbacks = {}) {
  const card = document.createElement('div');
  card.className = 'intervencion-card';

  const h = document.createElement('h3');
  h.textContent = 'EMPUJAR LA SALA';
  card.appendChild(h);

  const note = document.createElement('div');
  note.className = 'intervencion-note';
  note.textContent = 'Intervenciones breves: alteran el recorrido sin reemplazar la escucha autónoma.';
  card.appendChild(note);

  const status = document.createElement('div');
  status.className = 'intervencion-status';
  status.textContent = 'sala autónoma';

  const grid = document.createElement('div');
  grid.className = 'intervencion-grid';
  for (const [id, inst] of Object.entries(instrumentos)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'intervencion-inst-btn';
    btn.innerHTML = `<span>${inst._nombre || id}</span><b>+1</b>`;
    btn.addEventListener('click', () => {
      const moved = callbacks.onAdvance?.(id);
      status.textContent = moved === false
        ? `${inst._nombre || id}: fin de recorrido`
        : `${inst._nombre || id}: un patrón adelante`;
    });
    grid.appendChild(btn);
  }
  card.appendChild(grid);

  const actions = document.createElement('div');
  actions.className = 'intervencion-actions';

  const randomBtn = document.createElement('button');
  randomBtn.type = 'button';
  randomBtn.textContent = 'AZAR: AVANZA UNO';
  randomBtn.addEventListener('click', () => {
    const result = callbacks.onAdvanceRandom?.();
    status.textContent = result?.label
      ? `${result.label}: un patrón adelante`
      : 'ningún músico pudo avanzar';
  });

  const redistributeBtn = document.createElement('button');
  redistributeBtn.type = 'button';
  redistributeBtn.className = 'primary-intervention';
  redistributeBtn.textContent = 'REDISTRIBUIR + EMPUJAR';
  redistributeBtn.addEventListener('click', () => {
    const result = callbacks.onRedistributeAndPush?.();
    status.textContent = result || 'fuentes redistribuidas';
  });

  actions.appendChild(randomBtn);
  actions.appendChild(redistributeBtn);
  card.appendChild(actions);
  card.appendChild(status);
  return card;
}

export function buildPlayableSynthCard(synth) {
  const card = document.createElement('div');
  card.className = 'playable-synth-card';
  card.innerHTML = `
    <div class="playable-synth-head">
      <h3>SINTE ACOMPAÑANTE</h3>
      <div class="playable-synth-switches">
        <button type="button" data-action="power">ON</button>
        <button type="button" data-action="hold" class="active">HOLD</button>
        <button type="button" data-action="release">SOLTAR</button>
      </div>
    </div>
    <div class="key-map">
      ${[
        ['1 C', 'C4'], ['2 D', 'D4'], ['3 E', 'E4'], ['4 F', 'F4'], ['5 G', 'G4'],
        ['6 A', 'A4'], ['7 B', 'B4'], ['8 C', 'C5'], ['9 D', 'D5'], ['0 E', 'E5'],
      ].map(([label, note]) => `<button type="button" data-note="${note}">${label}</button>`).join('')}
    </div>
    <div class="synth-control-grid">
      <label>MODO<select data-param="mode">
        <option value="synth">SUBTRACTIVO</option>
        <option value="am">AM</option>
        <option value="fm" selected>FM</option>
      </select></label>
      <label>ONDA<select data-param="waveform">
        <option value="sine">SENO</option>
        <option value="triangle">TRIÁNGULO</option>
        <option value="sawtooth">SIERRA</option>
        <option value="square">CUADRADA</option>
      </select></label>
    </div>
    <div class="arp-row">
      <button type="button" data-action="arp-toggle">ARP</button>
      <button type="button" data-action="arp-up" class="active">UP</button>
      <button type="button" data-action="arp-down">DOWN</button>
      <button type="button" data-action="arp-rnd">RND</button>
      <select data-param="arp-rate">
        <option value="4n">1/4</option>
        <option value="8n" selected>1/8</option>
        <option value="16n">1/16</option>
      </select>
    </div>
  `;

  const power = card.querySelector('[data-action="power"]');
  const hold = card.querySelector('[data-action="hold"]');
  const release = card.querySelector('[data-action="release"]');
  power.addEventListener('click', () => synth.setEnabled(!synth.enabled));
  hold.addEventListener('click', () => synth.setHold(!synth.hold));
  release.addEventListener('click', () => synth.releaseAll());
  card.querySelector('[data-param="mode"]').addEventListener('change', event => synth.setMode(event.target.value));
  card.querySelector('[data-param="waveform"]').addEventListener('change', event => synth.setWaveform(event.target.value));

  const arpToggle = card.querySelector('[data-action="arp-toggle"]');
  const arpUp     = card.querySelector('[data-action="arp-up"]');
  const arpDown   = card.querySelector('[data-action="arp-down"]');
  const arpRnd    = card.querySelector('[data-action="arp-rnd"]');
  const arpRate   = card.querySelector('[data-param="arp-rate"]');

  arpToggle.addEventListener('click', () => synth.setArpEnabled(!synth.arpEnabled));
  arpUp.addEventListener('click',  () => { synth.setArpMode('up');     _syncArpMode('up'); });
  arpDown.addEventListener('click',() => { synth.setArpMode('down');   _syncArpMode('down'); });
  arpRnd.addEventListener('click', () => { synth.setArpMode('random'); _syncArpMode('random'); });
  arpRate.addEventListener('change', () => synth.setArpRate(arpRate.value));

  function _syncArpMode(mode) {
    arpUp.classList.toggle('active',   mode === 'up');
    arpDown.classList.toggle('active', mode === 'down');
    arpRnd.classList.toggle('active',  mode === 'random');
  }
  for (const key of card.querySelectorAll('.key-map button')) {
    key.addEventListener('click', () => synth.playNote(key.dataset.note));
  }

  const controls = [
    ['ATAQUE', 'attack', 0.01, 5, 0.01, synth.attack, value => `${value.toFixed(2)}s`],
    ['DECAY', 'decay', 0.01, 5, 0.01, synth.decay, value => `${value.toFixed(2)}s`],
    ['SUSTAIN', 'sustain', 0, 1, 0.01, synth.sustain, value => value.toFixed(2)],
    ['RELEASE', 'release', 0.05, 12, 0.05, synth.release, value => `${value.toFixed(2)}s`],
    ['FILTRO', 'filter', 120, 12000, 10, synth.filterFrequency, value => `${Math.round(value)}Hz`],
    ['REVERB', 'reverb', 0, 0.9, 0.01, synth.reverbWet, value => `${Math.round(value * 100)}%`],
    ['VOLUMEN', 'volume', -36, 0, 1, synth.volume, value => `${Math.round(value)}dB`],
  ];

  for (const [label, param, min, max, step, initial, format] of controls) {
    const row = document.createElement('label');
    row.className = 'playable-range';
    const name = document.createElement('span');
    name.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = initial;
    const value = document.createElement('b');
    const apply = () => {
      const n = Number(input.value);
      value.textContent = format(n);
      if (['attack', 'decay', 'sustain', 'release'].includes(param)) synth.setEnvelope(param, n);
      if (param === 'filter') synth.setFilterFrequency(n);
      if (param === 'reverb') synth.setReverbWet(n);
      if (param === 'volume') synth.setVolume(n);
    };
    input.addEventListener('input', apply);
    apply();
    row.appendChild(name);
    row.appendChild(input);
    row.appendChild(value);
    card.appendChild(row);
  }

  synth.subscribe(state => {
    power.classList.toggle('active', state.enabled);
    power.textContent = state.enabled ? 'ON' : 'OFF';
    hold.classList.toggle('active', state.hold);
    for (const key of card.querySelectorAll('.key-map button')) {
      const pitch = key.dataset.note;
      key.classList.toggle('active', state.activeNotes.includes(pitch));
    }
    arpToggle.classList.toggle('active', state.arp.enabled);
    _syncArpMode(state.arp.mode);
    arpRate.value = state.arp.rate;
  });

  return card;
}

export function buildNoticiasCard(noticiasFuente) {
  const card = document.createElement('div');
  card.className = 'lente-card noticias-card';

  const h = document.createElement('h3');
  h.textContent = 'NOTICIAS';
  card.appendChild(h);

  const help = document.createElement('div');
  help.className = 'noticias-help';
  help.textContent = 'Elegis pais/edicion y medio. Los titulares se convierten en palabras, categorias y presion musical.';
  card.appendChild(help);

  const rowPais = document.createElement('div');
  rowPais.className = 'lente-row';
  const lblPais = document.createElement('span');
  lblPais.className = 'lente-label';
  lblPais.textContent = 'PAIS';
  const selPais = document.createElement('select');
  selPais.className = 'lente-sel';
  rowPais.appendChild(lblPais);
  rowPais.appendChild(selPais);
  card.appendChild(rowPais);

  const rowMedio = document.createElement('div');
  rowMedio.className = 'lente-row';
  const lblMedio = document.createElement('span');
  lblMedio.className = 'lente-label';
  lblMedio.textContent = 'MEDIO';
  const selMedio = document.createElement('select');
  selMedio.className = 'lente-sel';
  rowMedio.appendChild(lblMedio);
  rowMedio.appendChild(selMedio);
  card.appendChild(rowMedio);

  const estado = document.createElement('div');
  estado.className = 'lente-crudo noticias-status';
  card.appendChild(estado);

  const catalog = noticiasFuente.getCatalog ? noticiasFuente.getCatalog() : [];
  for (const country of catalog) {
    const opt = document.createElement('option');
    opt.value = country.id;
    opt.textContent = country.label;
    selPais.appendChild(opt);
  }

  const fillMedios = () => {
    const country = catalog.find(c => c.id === selPais.value) || catalog[0];
    selMedio.innerHTML = '<option value="all">Todos los medios del pais</option>';
    for (const feed of country?.feeds || []) {
      const opt = document.createElement('option');
      opt.value = feed.id;
      opt.textContent = feed.name;
      selMedio.appendChild(opt);
    }
  };

  const apply = async () => {
    if (!noticiasFuente.setSelection) return;
    selPais.disabled = true;
    selMedio.disabled = true;
    estado.textContent = 'cargando RSS...';
    try {
      await noticiasFuente.setSelection(selPais.value, selMedio.value);
      const selection = noticiasFuente.getSelection?.();
      estado.textContent = selection
        ? `${selection.countryLabel} / ${selection.sourceLabel}`
        : 'noticias actualizadas';
    } catch (e) {
      estado.textContent = `error: ${e.message || e}`;
    } finally {
      selPais.disabled = false;
      selMedio.disabled = false;
    }
  };

  selPais.addEventListener('change', () => {
    fillMedios();
    apply();
  });
  selMedio.addEventListener('change', apply);

  if (catalog[0]) selPais.value = catalog[0].id;
  fillMedios();
  const selection = noticiasFuente.getSelection?.();
  estado.textContent = selection
    ? `${selection.countryLabel} / ${selection.sourceLabel}`
    : 'Global / todos los medios';

  return card;
}

export function buildMercadoCard(mercadoFuente) {
  const card = document.createElement('div');
  card.className = 'lente-card';

  const h = document.createElement('h3');
  h.textContent = 'MERCADO (COINGECKO)';
  card.appendChild(h);

  const row = document.createElement('div');
  row.className = 'lente-row';
  const lbl = document.createElement('span');
  lbl.className = 'lente-label';
  lbl.textContent = 'ACTIVOS';
  const sel = document.createElement('select');
  sel.className = 'lente-sel';

  const catalog = mercadoFuente.getCatalog ? mercadoFuente.getCatalog() : [];
  for (const item of catalog) {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.label;
    sel.appendChild(opt);
  }

  const estado = document.createElement('div');
  estado.className = 'lente-crudo';
  estado.style.marginTop = '0.25rem';

  sel.addEventListener('change', () => {
    if (mercadoFuente.setSelection) {
      mercadoFuente.setSelection(sel.value);
      estado.textContent = `Cargando ${sel.options[sel.selectedIndex].text}...`;
    }
  });

  if (mercadoFuente.getSelection) {
    const s = mercadoFuente.getSelection();
    if (s && s.id) sel.value = s.id;
  }

  row.appendChild(lbl);
  row.appendChild(sel);
  card.appendChild(row);
  card.appendChild(estado);

  return card;
}

export function buildLenteCard(paisesData, lenteFuente, instrumentos) {
  const card = document.createElement('div');
  card.className = 'lente-card';

  const h = document.createElement('h3');
  h.textContent = 'LENTE PAÍS';
  card.appendChild(h);

  // Selector de PAÍS
  const rowPais = document.createElement('div');
  rowPais.className = 'lente-row';
  const lblP = document.createElement('span');
  lblP.className = 'lente-label'; lblP.textContent = 'PAÍS';
  const selPais = document.createElement('select');
  selPais.className = 'lente-sel';
  selPais.innerHTML = '<option value="">— ninguno —</option>';
  for (const p of paisesData.paises) {
    selPais.innerHTML += `<option value="${p.codigo}">${p.nombre}</option>`;
  }
  rowPais.appendChild(lblP); rowPais.appendChild(selPais);
  card.appendChild(rowPais);

  // Selector de INDICADOR
  const rowInd = document.createElement('div');
  rowInd.className = 'lente-row';
  const lblI = document.createElement('span');
  lblI.className = 'lente-label'; lblI.textContent = 'DATO';
  const selInd = document.createElement('select');
  selInd.className = 'lente-sel';
  selInd.innerHTML = '<option value="">— ninguno —</option>';
  for (const ind of paisesData.indicadores) {
    selInd.innerHTML += `<option value="${ind.codigo}">${ind.nombre}</option>`;
  }
  rowInd.appendChild(lblI); rowInd.appendChild(selInd);
  card.appendChild(rowInd);

  // Barra de valor
  const rowVal = document.createElement('div');
  rowVal.className = 'lente-row'; rowVal.style.marginTop = '0.5rem';
  const barBg   = document.createElement('div'); barBg.className = 'lente-bar-bg';
  const barFill = document.createElement('div'); barFill.className = 'lente-bar-fill'; barFill.id = 'lente-bar';
  barBg.appendChild(barFill);
  const efEl    = document.createElement('span'); efEl.className = 'lente-efecto'; efEl.id = 'lente-efecto'; efEl.textContent = 'sin lente';
  rowVal.appendChild(barBg); rowVal.appendChild(efEl);
  card.appendChild(rowVal);

  // Dato crudo
  const crudoEl = document.createElement('div');
  crudoEl.className = 'lente-crudo'; crudoEl.id = 'lente-crudo';
  crudoEl.style.marginTop = '0.25rem';
  card.appendChild(crudoEl);

  // Lógica
  const update = async () => {
    const pais = selPais.value, ind = selInd.value;
    if (!pais || !ind) {
      efEl.textContent = 'sin lente';
      for (const id in instrumentos) instrumentos[id].conectarLente(null);
      return;
    }
    efEl.textContent = 'cargando...';
    const rango   = paisesData.rangos[ind];
    const indMeta = paisesData.indicadores.find(i => i.codigo === ind);
    await lenteFuente.setLente(pais, ind, indMeta, rango);
    const val = lenteFuente.magnitud;
    barFill.style.width  = `${val * 100}%`;
    efEl.textContent     = val > 0.7 ? 'central' : val > 0.3 ? 'borde' : 'periférico';
    crudoEl.textContent  = lenteFuente.payloadText;
    for (const id in instrumentos) instrumentos[id].conectarLente(lenteFuente);
  };

  selPais.addEventListener('change', update);
  selInd.addEventListener('change', update);

  setInterval(() => {
    const pOptions = selPais.options;
    const iOptions = selInd.options;
    if (pOptions.length > 1 && iOptions.length > 1) {
      selPais.selectedIndex = Math.floor(Math.random() * (pOptions.length - 1)) + 1;
      selInd.selectedIndex = Math.floor(Math.random() * (iOptions.length - 1)) + 1;
      update();
    }
  }, 60000);

  return card;
}

export function buildCiudadCard(onCambioCiudad) {
  const card = document.createElement('div');
  card.className = 'ciudad-card';

  const h = document.createElement('h3');
  h.textContent = 'CIUDAD (CLIMA)';
  card.appendChild(h);

  const inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'ciudad-input';
  inp.placeholder = 'Buenos Aires'; inp.value = 'Buenos Aires';
  card.appendChild(inp);

  const btn = document.createElement('button');
  btn.className = 'ciudad-btn'; btn.textContent = 'CAMBIAR';
  btn.addEventListener('click', async () => {
    const ciudad = inp.value.trim();
    if (!ciudad) return;
    btn.textContent = 'buscando...';
    btn.disabled = true;
    // Geocodificar con Open-Meteo Geocoding API (libre, sin key)
    try {
      const res  = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=1&language=es`);
      const data = await res.json();
      const loc  = data.results?.[0];
      if (!loc) { btn.textContent = 'no encontrada'; btn.disabled = false; return; }
      onCambioCiudad(loc.name, loc.latitude, loc.longitude);
      btn.textContent = `✓ ${loc.name}`;
      setTimeout(() => { btn.textContent = 'CAMBIAR'; btn.disabled = false; }, 2000);
    } catch (e) {
      btn.textContent = 'error'; btn.disabled = false;
    }
  });
  card.appendChild(btn);
  return card;
}
