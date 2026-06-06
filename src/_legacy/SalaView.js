import { ColorSystem, INSTRUMENT_IDENTITY } from './ColorSystem.js';
import { ESTADOS } from '../logic/StateMachine.js';

export class SalaView {
  constructor(containerEl, numPatrones, instrumentIds) {
    this.container   = containerEl;
    this.numPatrones = numPatrones;
    this.ids         = instrumentIds;
    this.colors      = new ColorSystem();

    this._huellas    = {};
    this._dots       = {};
    this._canvas     = null;
    this._ctx        = null;
    this._prevPos    = {};
    this._ripples    = [];

    this._build();
  }

  _build() {
    this.container.innerHTML = '';
    this.container.style.position = 'relative';

    // Grid de columnas
    const grid = document.createElement('div');
    grid.className = 'sala-grid';
    grid.style.gridTemplateColumns = `repeat(${this.numPatrones}, 1fr)`;

    for (let i = 0; i < this.numPatrones; i++) {
      const col = document.createElement('div');
      col.className = 'col-patron';
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = ((i + 1) % 5 === 0 || i === 0 || i === this.numPatrones - 1) ? i + 1 : '';
      col.appendChild(num);

      for (const id of this.ids) {
        const h = document.createElement('div');
        h.className = `huella huella-${id}`;
        col.appendChild(h);
        if (!this._huellas[id]) this._huellas[id] = [];
        this._huellas[id][i] = h;
      }
      grid.appendChild(col);
    }

    // Dots de instrumentos
    for (const id of this.ids) {
      const dot = document.createElement('div');
      dot.className = `instrumento-dot inst-${id}`;
      dot.id = `dot-${id}`;

      const identity = INSTRUMENT_IDENTITY[id] || {};
      const lbl = document.createElement('span');
      lbl.className = 'dot-label';
      lbl.textContent = `${identity.label || ''} ${id}`;
      dot.appendChild(lbl);

      const stEl = document.createElement('span');
      stEl.className = 'dot-estado';
      dot.appendChild(stEl);

      grid.appendChild(dot);
      this._dots[id] = { dot, stEl };
    }

    this.container.appendChild(grid);
    this._grid = grid;

    // Canvas overlay para contagio, fuerzas, ripples
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';
    grid.appendChild(canvas);
    this._canvas = canvas;
    this._ctx    = canvas.getContext('2d');

    // Panel de señales debajo del grid
    this._signalPanel = document.createElement('div');
    this._signalPanel.className = 'signal-panel';
    this.container.appendChild(this._signalPanel);
  }

  _syncCanvas() {
    const rect = this._grid.getBoundingClientRect();
    if (this._canvas.width !== Math.round(rect.width) || this._canvas.height !== Math.round(rect.height)) {
      this._canvas.width  = Math.round(rect.width);
      this._canvas.height = Math.round(rect.height);
    }
  }

  render(instrumentos, sala) {
    this._syncCanvas();
    const W = this._canvas.width;
    const H = this._canvas.height;
    const ctx = this._ctx;
    ctx.clearRect(0, 0, W, H);

    // ── 1. Posicionar y colorear dots ──
    const dotCoords = {};
    for (const id of this.ids) {
      const inst = instrumentos[id];
      if (!inst) continue;
      const ui   = inst.getEstadoUI();
      const { dot, stEl } = this._dots[id];

      const percX  = ((ui.posicion + 0.5) / this.numPatrones) * 100;
      dot.style.left = `${percX}%`;

      const aud = this.colors.getAudibilidadStyle(ui.audibilidad);
      dot.style.bottom  = `${50 - aud.verticalOffset}px`;
      dot.style.opacity = aud.opacity;
      dot.style.filter  = aud.filter;

      // Color = fuente, no instrumento
      dot.style.background = this.colors.getDotColor(inst, sala);
      dot.className = `instrumento-dot inst-${id} estado-${ui.estado.toLowerCase()}`;

      stEl.textContent = ui.estado;

      // Patrón fantasma (item 4) — instrumento DORMIDO o señal mínima
      dot.classList.toggle('ghost', ui.estado === ESTADOS.DORMIDO || (ui.señal < 0.08 && ui.señal > 0));

      // Coords para canvas
      const xPx = ((ui.posicion + 0.5) / this.numPatrones) * W;
      const yPx = H - (50 - aud.verticalOffset + 6);
      dotCoords[id] = { x: xPx, y: yPx, pos: ui.posicion, inst };

      // Detect avance → ripple
      if (this._prevPos[id] !== undefined && this._prevPos[id] !== ui.posicion) {
        const srcColor = this._getDominantSourceColor(inst);
        this._ripples.push({ x: xPx, y: yPx, age: 0, color: srcColor });
        // Texto flotante con payload
        if (ui.payload) {
          this._ripples.push({ type: 'text', text: ui.payload, x: xPx, y: yPx - 10, age: 0, color: srcColor });
        }
      }
      this._prevPos[id] = ui.posicion;
    }

    // ── 2. Huellas de stigmergy con color de fuente ──
    for (const id of this.ids) {
      const inst = instrumentos[id];
      if (!inst) continue;
      for (let i = 0; i < this.numPatrones; i++) {
        const intensidad = sala.terreno[i];
        const h = this._huellas[id]?.[i];
        if (!h) continue;
        if (intensidad < 0.01) {
          h.style.opacity = 0;
        } else {
          h.style.backgroundColor = this.colors.getHuellaColor(inst, intensidad);
          h.style.opacity = intensidad;
        }
      }
    }

    // ── 3. Canvas: línea de centro de masa ──
    const cmX = (sala.getCentroMasa() / this.numPatrones) * W;
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cmX, 0);
    ctx.lineTo(cmX, H);
    ctx.stroke();
    ctx.restore();

    // ── 4. Canvas: flecha de momentum ──
    const momentum = sala.getMomentum();
    if (momentum > 0.05) {
      const arrowY = 8;
      const arrowLen = momentum * (W * 0.15);
      ctx.save();
      ctx.strokeStyle = `rgba(0,0,0,${momentum * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cmX, arrowY);
      ctx.lineTo(cmX + arrowLen, arrowY);
      ctx.moveTo(cmX + arrowLen - 5, arrowY - 3);
      ctx.lineTo(cmX + arrowLen, arrowY);
      ctx.lineTo(cmX + arrowLen - 5, arrowY + 3);
      ctx.stroke();
      ctx.restore();
    }

    // ── 5. Canvas: hilos de cohesión (contagio) ──
    const activeIds = this.ids.filter(id => dotCoords[id] && instrumentos[id]?.estado !== ESTADOS.DORMIDO);
    for (let i = 0; i < activeIds.length; i++) {
      for (let j = i + 1; j < activeIds.length; j++) {
        const a = dotCoords[activeIds[i]];
        const b = dotCoords[activeIds[j]];
        const dist = Math.abs(a.pos - b.pos);
        if (dist > 6) continue;
        const alpha = Math.max(0, 0.35 - dist * 0.05);
        ctx.save();
        ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();

        // Punto de tensión cuando están en el mismo patrón
        if (dist === 0) {
          ctx.save();
          ctx.fillStyle = 'rgba(200,0,0,0.25)';
          ctx.beginPath();
          ctx.arc((a.x + b.x) / 2, (a.y + b.y) / 2, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // ── 6. Canvas: ripples y texto flotante ──
    for (let i = this._ripples.length - 1; i >= 0; i--) {
      const p = this._ripples[i];
      p.age += 0.025;
      if (p.age >= 1) { this._ripples.splice(i, 1); continue; }

      if (p.type === 'text') {
        const alpha = 1 - p.age;
        p.y -= 0.4;
        ctx.save();
        ctx.font = '9px Courier New';
        ctx.fillStyle = `rgba(${p.color.r},${p.color.g},${p.color.b},${alpha})`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
      } else {
        const r = p.age * 28;
        const alpha = (1 - p.age) * 0.6;
        ctx.save();
        ctx.strokeStyle = `rgba(${p.color.r},${p.color.g},${p.color.b},${alpha})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── 7. Panel de señales (debajo del grid) ──
    this._renderSignalPanel(instrumentos, sala);
  }

  _renderSignalPanel(instrumentos, sala) {
    const panel = this._signalPanel;
    panel.innerHTML = '';

    for (const id of this.ids) {
      const inst = instrumentos[id];
      if (!inst || !inst.fuentes?.length) continue;

      const row = document.createElement('div');
      row.className = 'signal-row';

      // Nombre instrumento
      const nameEl = document.createElement('span');
      nameEl.className = 'signal-inst-name';
      const srcColor = this._getDominantSourceColor(inst);
      nameEl.style.borderLeftColor = `rgb(${srcColor.r},${srcColor.g},${srcColor.b})`;
      nameEl.textContent = id.toUpperCase();
      row.appendChild(nameEl);

      // Para cada fuente del instrumento
      for (const f of inst.fuentes) {
        const tipo = f.tipo || f.id?.split('_')[0] || '?';
        const src  = f.source;
        const col  = this.colors.getSourceColor(tipo, src);

        const srcEl = document.createElement('div');
        srcEl.className = 'signal-source';

        // Payload text
        const payload = document.createElement('div');
        payload.className = 'signal-payload';
        payload.textContent = src?.payloadText || tipo;
        payload.style.color = `rgb(${col.r},${col.g},${col.b})`;
        srcEl.appendChild(payload);

        // Barras de verbos
        const verbos = [
          { key: 'AVANZA',  label: 'AV', color: '#1a7a1a' },
          { key: 'RETIENE', label: 'RT', color: '#b05000' },
          { key: 'MUTA',    label: 'MU', color: '#1a44cc' },
          { key: 'SALE',    label: 'SL', color: '#cc0000' },
        ];
        const verbRow = document.createElement('div');
        verbRow.className = 'signal-verb-row';
        for (const v of verbos) {
          if (!src || !f.mapeo) continue;
          const pressure = src.getVerb(v.key, f.mapeo);
          if (pressure < 0.01) continue;
          const vEl = document.createElement('div');
          vEl.className = 'signal-verb';
          vEl.innerHTML = `
            <span class="verb-label">${v.label}</span>
            <div class="verb-bar-bg">
              <div class="verb-bar-fill" style="width:${pressure*100}%;background:${v.color}"></div>
            </div>
            <span class="verb-num">${pressure.toFixed(2)}</span>
          `;
          verbRow.appendChild(vEl);
        }
        srcEl.appendChild(verbRow);
        row.appendChild(srcEl);
      }

      // Desglose de probabilidad
      const ui = inst.getEstadoUI();
      if (ui.probBreakdown) {
        const b = ui.probBreakdown;
        const pEl = document.createElement('div');
        pEl.className = 'signal-prob';
        pEl.innerHTML = `P(avance)=${Math.round(b.p*100)}%&nbsp;
          <span class="prob-part">api:${b.api}</span>
          <span class="prob-part">stig:${b.stigmergy}</span>
          <span class="prob-part">boids:${b.cohesion}</span>
          ${b.freno > 0 ? `<span class="prob-freno">freno:-${b.freno}</span>` : ''}`;
        row.appendChild(pEl);
      }

      panel.appendChild(row);
    }
  }

  _getDominantSourceColor(inst) {
    if (!inst.fuentes?.length) return { r: 160, g: 160, b: 160 };
    let dom = inst.fuentes[0];
    for (const f of inst.fuentes) {
      if ((f.source?.magnitud || 0) > (dom.source?.magnitud || 0)) dom = f;
    }
    const tipo = dom.tipo || dom.id?.split('_')[0];
    return this.colors.getSourceColor(tipo, dom.source);
  }
}
