import { ESTADOS } from '../logic/StateMachine.js';
import { ColorSystem } from './ColorSystem.js';

const TIPOS_OSCILADOR = ['triangle', 'sine', 'sawtooth', 'square'];

export class Tablero {
  constructor(containerEl, fuentes, instrumentos, paisesData, mappings, onInvocar, onDetener, onSynthChange) {
    this.container    = containerEl;
    this.fuentes      = fuentes;
    this.instrumentos = instrumentos;
    this.paises       = paisesData;
    this.mappings     = mappings;
    this.onInvocar    = onInvocar;
    this.onDetener    = onDetener;
    this.onSynthChange = onSynthChange || (() => {});
    this.colors       = new ColorSystem();
    this._running     = false;
    this._build();
  }

  _build() {
    this.container.innerHTML = '';

    const h2 = document.createElement('h2');
    h2.textContent = 'INSTRUMENTOS';
    this.container.appendChild(h2);

    for (const id in this.instrumentos) {
      this.container.appendChild(this._buildInstCard(id));
    }

    this.container.appendChild(this._buildLenteCard());
    this.container.appendChild(this._buildApiKeyCard());

    const btn = document.createElement('button');
    btn.id = 'btn-invocar';
    btn.textContent = 'INVOCAR';
    btn.addEventListener('click', () => this._invocar(btn));
    this.container.appendChild(btn);
  }

  _buildInstCard(id) {
    const inst  = this.instrumentos[id];
    const card  = document.createElement('div');
    card.className = 'inst-card';

    // Header
    const inst2 = this.instrumentos[id];
    const hdr = document.createElement('div');
    hdr.className = 'inst-card-header';
    hdr.innerHTML = `
      <div>
        <span class="inst-card-nombre">${inst2._nombre || id.toUpperCase()}</span>
        <span class="inst-card-desc">${inst2._desc || ''}</span>
      </div>
      <span class="inst-card-estado" id="ic-estado-${id}">DORMIDO</span>
    `;
    card.appendChild(hdr);

    // FUENTES A/B/C
    for (const slot of ['A','B','C']) {
      const row = document.createElement('div');
      row.className = 'inst-card-row';
      const sel = document.createElement('select');
      sel.className = 'inst-select';
      sel.id = `sel-fuente-${id}-${slot}`;
      sel.innerHTML = '<option value="">— sin fuente —</option>';
      for (const fid in this.fuentes) {
        if (fid === 'indice_pais') continue;
        sel.innerHTML += `<option value="${fid}">${fid.toUpperCase()}</option>`;
      }
      sel.addEventListener('change', () => this._reconectar(id));
      row.innerHTML = `<label class="inst-label">FUENTE ${slot}</label>`;
      row.appendChild(sel);
      card.appendChild(row);
    }

    // Volumen
    const rowVol = document.createElement('div');
    rowVol.className = 'inst-card-row';
    const slVol = document.createElement('input');
    slVol.type = 'range'; slVol.min = '-40'; slVol.max = '0'; slVol.step = '1'; slVol.value = '-18';
    slVol.className = 'inst-vol-slider'; slVol.id = `vol-${id}`;
    const valVol = document.createElement('span');
    valVol.className = 'inst-vol-val'; valVol.id = `volval-${id}`;
    valVol.textContent = '-18 dB';
    slVol.addEventListener('input', () => {
      inst._volumenDb = parseFloat(slVol.value);
      valVol.textContent = `${slVol.value} dB`;
    });
    inst._volumenDb = -18;
    rowVol.innerHTML = '<label class="inst-label">VOLUMEN</label>';
    rowVol.appendChild(slVol); rowVol.appendChild(valVol);
    card.appendChild(rowVol);

    // Señal en vivo
    const sig = document.createElement('div');
    sig.className = 'inst-signal';
    sig.innerHTML = `
      <div class="sig-row">
        <span class="sig-label">SEÑAL</span>
        <div class="sig-bar-bg"><div class="sig-bar-fill" id="sig-fill-${id}"></div></div>
        <span class="sig-num" id="sig-num-${id}">—</span>
      </div>
      <div class="sig-row">
        <span class="sig-label">VOL.</span>
        <div class="sig-bar-bg"><div class="sig-vol-fill" id="sigvol-fill-${id}"></div></div>
        <span class="sig-num" id="sigvol-num-${id}">—</span>
      </div>
      <div class="sig-row">
        <span class="sig-label">CAMBIO</span>
        <span class="sig-cambio" id="sig-cambio-${id}">—</span>
      </div>
    `;
    card.appendChild(sig);

    // ── Sección SONIDO (síntesis) ──
    const synthSection = document.createElement('details');
    synthSection.className = 'synth-section';
    synthSection.innerHTML = '<summary class="synth-summary">SONIDO ▾</summary>';

    const synthBody = document.createElement('div');
    synthBody.className = 'synth-body';

    const tipo = this.instrumentos[id]._tipoSynth;

    // Oscilador (solo para PolySynth/Synth)
    if (tipo !== 'MembraneSynth') {
      const rowOsc = document.createElement('div');
      rowOsc.className = 'inst-card-row';
      const selOsc = document.createElement('select');
      selOsc.className = 'inst-select';
      for (const t of TIPOS_OSCILADOR) selOsc.innerHTML += `<option value="${t}">${t}</option>`;
      selOsc.value = 'triangle';
      selOsc.addEventListener('change', () => this.onSynthChange(id, 'oscillator', 'type', selOsc.value));
      rowOsc.innerHTML = '<label class="inst-label">OSC</label>';
      rowOsc.appendChild(selOsc);
      synthBody.appendChild(rowOsc);
    }

    // Ataque
    synthBody.appendChild(this._buildSliderRow(id, 'ATK', 'envelope', 'attack', 0.001, 2, 0.01,
      tipo === 'MembraneSynth' ? 0.001 : 0.12));

    // Release
    synthBody.appendChild(this._buildSliderRow(id, 'RLS', 'envelope', 'release', 0.05, 5, 0.05,
      tipo === 'MembraneSynth' ? 0.4 : 1.4));

    // Pitch Decay (solo MembraneSynth)
    if (tipo === 'MembraneSynth') {
      synthBody.appendChild(this._buildSliderRow(id, 'PD', 'membrane', 'pitchDecay', 0.01, 0.5, 0.01, 0.08));
    }

    // Filtro cutoff base
    synthBody.appendChild(this._buildSliderRow(id, 'FILT', 'filter', 'frequency', 200, 18000, 100, 8000));

    // Resonancia
    synthBody.appendChild(this._buildSliderRow(id, 'RES', 'filter', 'Q', 0.1, 20, 0.1, 1));

    synthSection.appendChild(synthBody);
    card.appendChild(synthSection);

    return card;
  }

  _buildSliderRow(instId, label, grupo, param, min, max, step, defaultVal) {
    const row = document.createElement('div');
    row.className = 'inst-card-row';
    const sl = document.createElement('input');
    sl.type = 'range'; sl.min = min; sl.max = max; sl.step = step; sl.value = defaultVal;
    sl.className = 'inst-vol-slider';
    const val = document.createElement('span');
    val.className = 'inst-vol-val';
    val.textContent = defaultVal;
    sl.addEventListener('input', () => {
      val.textContent = parseFloat(sl.value).toFixed(step < 1 ? 2 : 0);
      this.onSynthChange(instId, grupo, param, sl.value);
    });
    row.innerHTML = `<label class="inst-label">${label}</label>`;
    row.appendChild(sl); row.appendChild(val);
    return row;
  }

  _buildLenteCard() {
    const card = document.createElement('div');
    card.className = 'lente-card';

    // Título
    const h = document.createElement('h2');
    h.textContent = 'LENTE PAÍS';
    card.appendChild(h);

    // Selector de PAÍS
    const rowPais = document.createElement('div');
    rowPais.className = 'inst-card-row';
    const lblPais = document.createElement('label');
    lblPais.className = 'inst-label'; lblPais.textContent = 'PAÍS';
    const selPais = document.createElement('select');
    selPais.id = 'sel-pais'; selPais.className = 'inst-select';
    selPais.style.gridColumn = '2 / 4';
    const optNone = document.createElement('option');
    optNone.value = ''; optNone.textContent = '— ninguno —';
    selPais.appendChild(optNone);
    for (const p of this.paises.paises) {
      const o = document.createElement('option');
      o.value = p.codigo; o.textContent = p.nombre;
      selPais.appendChild(o);
    }
    rowPais.appendChild(lblPais); rowPais.appendChild(selPais);
    card.appendChild(rowPais);

    // Selector de INDICADOR
    const rowInd = document.createElement('div');
    rowInd.className = 'inst-card-row';
    const lblInd = document.createElement('label');
    lblInd.className = 'inst-label'; lblInd.textContent = 'DATO';
    const selInd = document.createElement('select');
    selInd.id = 'sel-indicador'; selInd.className = 'inst-select';
    selInd.style.gridColumn = '2 / 4';
    const optNone2 = document.createElement('option');
    optNone2.value = ''; optNone2.textContent = '— ninguno —';
    selInd.appendChild(optNone2);
    for (const ind of this.paises.indicadores) {
      const o = document.createElement('option');
      o.value = ind.codigo; o.textContent = ind.nombre;
      selInd.appendChild(o);
    }
    rowInd.appendChild(lblInd); rowInd.appendChild(selInd);
    card.appendChild(rowInd);

    // Barra de valor + efecto
    const valRow = document.createElement('div');
    valRow.className = 'lente-valor-row';
    const barBg = document.createElement('div'); barBg.className = 'sig-bar-bg lente-bar-bg';
    const barFill = document.createElement('div'); barFill.className = 'sig-bar-fill lente-bar-fill'; barFill.id = 'lente-bar';
    barBg.appendChild(barFill);
    const numEl = document.createElement('span'); numEl.className = 'sig-num'; numEl.id = 'lente-num'; numEl.textContent = '—';
    const efEl  = document.createElement('span'); efEl.className = 'lente-efecto'; efEl.id = 'lente-efecto'; efEl.textContent = 'sin lente';
    valRow.appendChild(barBg); valRow.appendChild(numEl); valRow.appendChild(efEl);
    card.appendChild(valRow);

    // Dato crudo
    const crudoRow = document.createElement('div'); crudoRow.className = 'inst-card-row';
    const crudoLbl = document.createElement('span'); crudoLbl.className = 'sig-label'; crudoLbl.textContent = 'DATO REAL';
    const crudoVal = document.createElement('span'); crudoVal.className = 'sig-num'; crudoVal.id = 'lente-crudo'; crudoVal.textContent = '—';
    crudoVal.style.gridColumn = '2 / 4';
    crudoRow.appendChild(crudoLbl); crudoRow.appendChild(crudoVal);
    card.appendChild(crudoRow);

    // Lógica de actualización
    const update = async () => {
      const pais = selPais.value, ind = selInd.value;

      if (!pais || !ind) {
        if (this.fuentes.indice_pais?.setValor) this.fuentes.indice_pais.setValor(0.65);
        barFill.style.width = '65%'; numEl.textContent = '—';
        efEl.textContent = 'sin lente'; crudoVal.textContent = '—';
        for (const id in this.instrumentos) this.instrumentos[id].conectarLente(null);
        return;
      }

      efEl.textContent = 'buscando...';

      // Banco Mundial API real
      if (this.fuentes.indice_pais?.setLente) {
        const rango   = this.paises.rangos[ind];
        const indMeta = this.paises.indicadores.find(i => i.codigo === ind);
        await this.fuentes.indice_pais.setLente(pais, ind, indMeta, rango);
        const val = this.fuentes.indice_pais.magnitud;
        barFill.style.width = `${val * 100}%`;
        numEl.textContent   = `${Math.round(val * 100)}%`;
        efEl.textContent    = val > 0.7 ? 'central' : val > 0.3 ? 'borde' : 'periférico';
        crudoVal.textContent = this.fuentes.indice_pais.payloadText;
        for (const id in this.instrumentos) this.instrumentos[id].conectarLente(this.fuentes.indice_pais);
        return;
      }

      // Fallback: tabla estática
      const crudo   = this.paises.valores[pais]?.[ind];
      const rango   = this.paises.rangos[ind];
      const indMeta = this.paises.indicadores.find(i => i.codigo === ind);
      if (crudo === undefined || !rango || !indMeta) { efEl.textContent = 'sin datos'; return; }
      let norm = Math.max(0, Math.min(1, (crudo - rango.min) / (rango.max - rango.min)));
      const val = indMeta.invert ? 1 - norm : norm;
      if (this.fuentes.indice_pais?.setValor) this.fuentes.indice_pais.setValor(val);
      barFill.style.width = `${val * 100}%`;
      numEl.textContent   = `${Math.round(val * 100)}%`;
      efEl.textContent    = val > 0.7 ? 'central' : val > 0.3 ? 'borde' : 'periférico';
      crudoVal.textContent = `${crudo} (${ind})`;
      for (const id in this.instrumentos) this.instrumentos[id].conectarLente(this.fuentes.indice_pais);
    };

    selPais.addEventListener('change', update);
    selInd.addEventListener('change', update);
    return card;
  }

  _buildApiKeyCard() {
    const card = document.createElement('div');
    card.className = 'lente-card';
    card.innerHTML = '<h2>API REAL — CLIMA</h2>';

    const row = document.createElement('div'); row.className = 'inst-card-row';
    const inp = document.createElement('input');
    inp.type = 'text'; inp.placeholder = 'OpenWeather API key...';
    inp.className = 'inst-select'; inp.id = 'api-key-input';
    inp.style.fontFamily = 'var(--mono)'; inp.style.fontSize = '0.65rem';

    const cityInp = document.createElement('input');
    cityInp.type = 'text'; cityInp.placeholder = 'ciudad (ej: Buenos Aires)';
    cityInp.className = 'inst-select'; cityInp.id = 'api-city-input';
    cityInp.style.fontFamily = 'var(--mono)'; cityInp.style.fontSize = '0.65rem';
    cityInp.style.marginTop = '0.3rem';

    const btn = document.createElement('button');
    btn.textContent = 'CONECTAR'; btn.style.marginTop = '0.3rem';
    btn.addEventListener('click', () => {
      const key  = inp.value.trim();
      const city = cityInp.value.trim() || 'Buenos Aires';
      if (key) this.onSynthChange('_api', 'openweather', 'connect', { key, city });
    });

    const status = document.createElement('div');
    status.id = 'api-status'; status.className = 'sig-label'; status.textContent = 'simulación activa';
    status.style.marginTop = '0.3rem';

    row.innerHTML = '<label class="inst-label">KEY</label>';
    row.appendChild(inp); card.appendChild(row);
    const row2 = document.createElement('div'); row2.className = 'inst-card-row';
    row2.innerHTML = '<label class="inst-label">CIUDAD</label>';
    row2.appendChild(cityInp); card.appendChild(row2);
    card.appendChild(btn); card.appendChild(status);
    return card;
  }

  _buildSelect(id, options) {
    const sel = document.createElement('select');
    sel.id = id; sel.className = 'inst-select';
    for (const o of options) sel.innerHTML += `<option value="${o.value || o.codigo || ''}">${o.label || o.nombre || ''}</option>`;
    return sel;
  }

  _reconectar(id) {
    const inst = this.instrumentos[id];
    const conexiones = ['A','B','C'].map(slot => {
      const sel = document.getElementById(`sel-fuente-${id}-${slot}`);
      const fid = sel?.value;
      if (!fid) return null;
      const source = this.fuentes[fid];
      const mapeo  = this.mappings?.fuentes?.[fid];
      if (!source || !mapeo) return null;
      return { id: `${fid}_${slot}`, tipo: fid, source, mapeo };
    }).filter(Boolean);
    inst.conectarFuentes(conexiones);
  }

  renderLive(instrumentos) {
    for (const id in instrumentos) {
      const ui = instrumentos[id].getEstadoUI();

      const estadoEl = document.getElementById(`ic-estado-${id}`);
      if (estadoEl) { estadoEl.textContent = ui.estado; estadoEl.className = `inst-card-estado estado-${ui.estado.toLowerCase()}`; }

      const s = instrumentos[id].señal;
      if (s) {
        const fill   = document.getElementById(`sig-fill-${id}`);
        const num    = document.getElementById(`sig-num-${id}`);
        const vfill  = document.getElementById(`sigvol-fill-${id}`);
        const vnum   = document.getElementById(`sigvol-num-${id}`);
        const cambio = document.getElementById(`sig-cambio-${id}`);
        if (fill)  fill.style.width  = `${s.magnitud * 100}%`;
        if (num)   num.textContent   = s.magnitud.toFixed(2);
        if (vfill) vfill.style.width = `${s.volatilidad * 100}%`;
        if (vnum)  vnum.textContent  = s.volatilidad.toFixed(2);
        if (cambio) {
          const c = s.cambio;
          cambio.textContent = c > 0.02 ? `↑ +${c.toFixed(2)}` : c < -0.02 ? `↓ ${c.toFixed(2)}` : '→ 0';
          cambio.className = `sig-cambio ${c > 0.02 ? 'cambio-up' : c < -0.02 ? 'cambio-down' : ''}`;
        }
      }
    }
  }

  _invocar(btn) {
    if (!this._running) {
      this._running = true; btn.textContent = 'CORRIENDO...'; btn.classList.add('running');
      this.onInvocar();
    }
  }

  detener() {
    this._running = false;
    const btn = document.getElementById('btn-invocar');
    if (btn) { btn.textContent = 'INVOCAR'; btn.classList.remove('running'); }
  }
}
