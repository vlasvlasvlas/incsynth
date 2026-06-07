import { ColorSystem } from './ColorSystem.js';

export class PartituraView {
  constructor(containerEl, instrumentIds) {
    this.container = containerEl;
    this.ids       = instrumentIds;
    this.colors    = new ColorSystem();

    this._canvas      = document.createElement('canvas');
    this._ctx         = this._canvas.getContext('2d');
    this._trailCanvas = document.createElement('canvas');
    this._trailCtx    = this._trailCanvas.getContext('2d');
    this._prevPos     = {};
    this._ripples     = [];
    this._W = 0;
    this._H = 0;

    this.container.appendChild(this._canvas);
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(320, this.container.offsetWidth || window.innerWidth);
    const parentH = this.container.parentElement?.offsetHeight || window.innerHeight - 60;
    const h = Math.max(360, parentH);
    if (!w || !h) { setTimeout(() => this._resize(), 100); return; }

    this._W = w;
    this._H = h;

    this._canvas.width = Math.round(w * dpr);
    this._canvas.height = Math.round(h * dpr);
    this._canvas.style.width = `${w}px`;
    this._canvas.style.height = `${h}px`;
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this._trailCanvas.width = Math.round(w * dpr);
    this._trailCanvas.height = Math.round(h * dpr);
    this._trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._trailCtx.clearRect(0, 0, w, h);
  }

  render(instrumentos, sala) {
    const W = this._W;
    const H = this._H;
    if (!W || !H) return;

    try {
      const style = getComputedStyle(document.body);
      const bgCol = style.getPropertyValue('--canvas-bg').trim() || style.getPropertyValue('--bg').trim() || '#f5f1e8';
      const fgCol = style.getPropertyValue('--fg').trim() || '#181611';
      const lineCol = style.getPropertyValue('--line').trim() || '#d3cabb';
      const mutedCol = style.getPropertyValue('--muted').trim() || '#766f61';
      const fieldCol = style.getPropertyValue('--field').trim() || '#fffaf0';
      const isDark = document.body.classList.contains('dark-theme');

      const C = this._ctx;
      const T = this._trailCtx;
      const N = sala.numPatrones;
      const compact = W < 600;
      const marginX = compact ? 88 : Math.max(96, Math.min(132, W * 0.1));
      const topY = compact ? 96 : 118;
      const bottomY = H - (compact ? 82 : 108);
      const laneH = Math.max(compact ? 64 : 72, (bottomY - topY) / Math.max(1, this.ids.length - 1));
      const graphW = W - marginX * 2;
      const stepX = graphW / Math.max(1, N - 1);
      const center = sala.getCentroMasa();
      const bandMin = Math.max(0, center - 3);
      const bandMax = Math.min(N - 1, center + 3);

      T.fillStyle = isDark ? 'rgba(10,12,16,0.075)' : 'rgba(246,240,226,0.075)';
      T.fillRect(0, 0, W, H);

      C.clearRect(0, 0, W, H);
      C.fillStyle = bgCol;
      C.fillRect(0, 0, W, H);

      const bg = C.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, bgCol);
      bg.addColorStop(0.48, fieldCol);
      bg.addColorStop(1, bgCol);
      C.fillStyle = bg;
      C.fillRect(0, 0, W, H);

      this._depositTrails(T, instrumentos, sala, marginX, topY, laneH, stepX, N);
      C.drawImage(this._trailCanvas, 0, 0, W, H);

      this._drawRileyBand(C, marginX, topY, bottomY, stepX, bandMin, bandMax, fgCol, isDark);
      this._drawGrid(C, marginX, topY, bottomY, stepX, N, fgCol, lineCol);
      this._drawShockwaves(C, sala, marginX, topY, bottomY, stepX);

      const pos = this._computePositions(instrumentos, sala, marginX, topY, laneH, stepX, N);
      this._drawListeningLines(C, pos, instrumentos, sala, fgCol, isDark);
      this._drawCenterLine(C, marginX, topY, bottomY, stepX, center, fgCol, mutedCol);
      this._drawInstruments(C, pos, instrumentos, sala, fgCol, mutedCol, bgCol, N, marginX);
      this._drawFooter(C, fgCol, mutedCol, W, H, sala);
    } catch (e) {
      console.error(e);
      this._ctx.fillStyle = 'red';
      this._ctx.font = '14px sans-serif';
      this._ctx.fillText(e.toString(), 20, 50);
    }
  }

  _drawHeader(C, fg, muted, marginX, W, N) {
    const compact = W < 600;
    C.save();
    C.textAlign = 'left';
    C.textBaseline = 'top';
    C.fillStyle = fg;
    C.font = `700 ${compact ? 12 : 15}px Georgia, serif`;
    C.fillText(compact ? 'PARTITURA' : 'PARTITURA DE CONVIVENCIA', marginX, 24);
    C.font = `${compact ? 9 : 11}px Courier New, monospace`;
    C.fillStyle = muted;
    C.fillText(
      compact ? '53 patrones · mundo externo + sala' : '53 patrones en orden. Cada músico escucha dos cosas: su mundo externo y la sala que forman los demás.',
      marginX,
      48
    );
    C.textAlign = 'right';
    C.fillText(`1 → ${N}`, W - marginX, 48);
    C.restore();
  }

  _drawGrid(C, marginX, topY, bottomY, stepX, N, fg, line) {
    C.save();
    for (let p = 0; p < N; p++) {
      const x = marginX + p * stepX;
      const major = p === 0 || p === N - 1 || p % 5 === 0;
      C.strokeStyle = major ? fg : line;
      C.globalAlpha = major ? 0.2 : 0.07;
      C.lineWidth = major ? 1.2 : 1;
      C.beginPath();
      C.moveTo(x, topY - 42);
      C.lineTo(x, bottomY + 34);
      C.stroke();
      if (major) {
        // Texto de número removido
      }
    }
    C.globalAlpha = 1;
    C.restore();
  }

  _drawRileyBand(C, marginX, topY, bottomY, stepX, minP, maxP, fg, isDark) {
    const x1 = marginX + minP * stepX;
    const x2 = marginX + maxP * stepX;
    C.save();
    C.fillStyle = isDark ? 'rgba(228,190,92,0.09)' : 'rgba(191,128,32,0.10)';
    C.fillRect(x1, topY - 34, Math.max(2, x2 - x1), bottomY - topY + 68);
    C.strokeStyle = isDark ? 'rgba(228,190,92,0.32)' : 'rgba(130,80,20,0.22)';
    C.setLineDash([5, 5]);
    C.strokeRect(x1, topY - 34, Math.max(2, x2 - x1), bottomY - topY + 68);
    C.setLineDash([]);
    C.fillStyle = fg;
    C.globalAlpha = 0.65;
    C.font = '10px Courier New, monospace';
    C.textAlign = 'left';
    C.fillText('zona de escucha Riley: ±3 patrones del grupo', x1 + 6, topY - 28);
    C.restore();
  }

  _drawCenterLine(C, marginX, topY, bottomY, stepX, center, fg, muted) {
    const x = marginX + center * stepX;
    C.save();
    C.strokeStyle = fg;
    C.globalAlpha = 0.45;
    C.lineWidth = 1.5;
    C.setLineDash([2, 7]);
    C.beginPath();
    C.moveTo(x, topY - 50);
    C.lineTo(x, bottomY + 44);
    C.stroke();
    C.setLineDash([]);
    C.fillStyle = muted;
    C.font = '10px Courier New, monospace';
    C.textAlign = 'center';
    C.fillText('centro de la sala', x, bottomY + 56);
    C.restore();
  }

  _drawShockwaves(C, sala, marginX, topY, bottomY, stepX) {
    const waves = sala.getShockwaves ? sala.getShockwaves() : [];
    C.save();
    for (const sw of waves) {
      const x = marginX + sw.pos * stepX;
      const alpha = Math.max(0, 1 - sw.age);
      C.fillStyle = `rgba(210,128,28,${0.07 * alpha})`;
      C.fillRect(x - 18, topY - 42, 36, bottomY - topY + 84);
      C.strokeStyle = `rgba(210,128,28,${0.45 * alpha})`;
      C.lineWidth = 1 + alpha * 2;
      C.beginPath();
      C.moveTo(x, topY - 48);
      C.lineTo(x, bottomY + 48);
      C.stroke();
    }
    C.restore();
  }

  _depositTrails(T, instrumentos, sala, marginX, topY, laneH, stepX, N) {
    for (let i = 0; i < this.ids.length; i++) {
      const id = this.ids[i];
      const inst = instrumentos[id];
      if (!inst) continue;
      const rgb = this._cssToRgb(this.colors.getDotColor(inst, sala));
      const y = topY + i * laneH;
      for (let p = 0; p < N; p++) {
        const intensity = sala.terreno[p];
        if (intensity < 0.025) continue;
        const x = marginX + p * stepX;
        T.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.10 + intensity * 0.30})`;
        T.beginPath();
        T.ellipse(x, y, 8 + intensity * 16, 3 + intensity * 5, 0, 0, Math.PI * 2);
        T.fill();
      }
    }
  }

  _computePositions(instrumentos, sala, marginX, topY, laneH, stepX, N) {
    const pos = {};
    for (let i = 0; i < this.ids.length; i++) {
      const id = this.ids[i];
      const inst = instrumentos[id];
      if (!inst) continue;
      const x = marginX + Math.min(N - 1, inst.posicion) * stepX;
      const y = topY + i * laneH;
      const ui = inst.getEstadoUI();
      const b = inst.señal ? inst.getProbabilidadBreakdown() : ui.probBreakdown;
      pos[id] = { id, inst, ui, b, x, y, row: i };
    }
    return pos;
  }

  _drawListeningLines(C, pos, instrumentos, sala, fg, isDark) {
    const active = this.ids.filter(id => pos[id] && instrumentos[id]?.estado !== 'DORMIDO');
    C.save();
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = pos[active[i]];
        const b = pos[active[j]];
        const d = Math.abs(a.inst.posicion - b.inst.posicion);
        const relation = relationForDistance(d);
        const strength = Math.max(0, 1 - d / 9);
        const rgbA = this._cssToRgb(this.colors.getDotColor(a.inst, sala));
        const rgbB = this._cssToRgb(this.colors.getDotColor(b.inst, sala));
        const grad = C.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, `rgba(${rgbA.r},${rgbA.g},${rgbA.b},${0.15 + strength * 0.45})`);
        grad.addColorStop(1, `rgba(${rgbB.r},${rgbB.g},${rgbB.b},${0.15 + strength * 0.45})`);
        C.strokeStyle = grad;
        C.lineWidth = 1 + strength * 4;
        C.setLineDash(relation.dash);
        C.beginPath();
        C.moveTo(a.x, a.y);
        C.bezierCurveTo(a.x + 30, a.y, b.x - 30, b.y, b.x, b.y);
        C.stroke();
        C.setLineDash([]);

        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 - 8;
        C.fillStyle = isDark ? 'rgba(12,14,18,0.78)' : 'rgba(255,250,238,0.82)';
        C.fillRect(mx - 50, my - 9, 100, 18);
        C.fillStyle = fg;
        C.globalAlpha = 0.75;
        C.font = '10px Courier New, monospace';
        C.textAlign = 'center';
        C.fillText(`${relation.label} · ${d}p`, mx, my + 4);
        C.globalAlpha = 1;
      }
    }
    C.restore();
  }

  _drawInstruments(C, pos, instrumentos, sala, fg, muted, bg, N, marginX) {
    C.save();
    for (const id of this.ids) {
      const p = pos[id];
      if (!p) continue;
      const rgb = this._cssToRgb(this.colors.getDotColor(p.inst, sala));
      const prob = p.b?.p ?? 0;
      const world = p.b?.api ?? 0;
      const room = (p.b?.stigmergy ?? 0) + (p.b?.cohesion ?? 0) + (p.b?.separacion ?? 0)
        + (p.b?.momentum ?? 0) + (p.b?.shockwave ?? 0) + (p.b?.geometria ?? 0)
        + (p.b?.escucha ?? 0) + (p.b?.secuencia ?? 0) - (p.b?.freno ?? 0);
      const impact = sala.getImpactoShockwave(p.inst.posicion);
      const signal = p.ui.señal || 0;
      const glow = p.inst._glowRadius ?? 1;
      const light = p.inst._lightGain ?? 1;

      if (this._prevPos[id] !== undefined && this._prevPos[id] !== p.inst.posicion) {
        this._ripples.push({ x: p.x, y: p.y, age: 0, rgb, text: p.ui.payload || p.inst._lastDecision || 'avanza' });
      }
      this._prevPos[id] = p.inst.posicion;

      C.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`;
      C.lineWidth = 2;
      C.beginPath();
      C.moveTo(marginX, p.y);
      C.lineTo(C.canvas.width, p.y);
      C.stroke();

      const auraR = 20 + signal * 28 * glow * light;
      const aura = C.createRadialGradient(p.x, p.y, 0, p.x, p.y, auraR);
      aura.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(0.48, 0.14 + signal * 0.30 * light)})`);
      aura.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
      C.fillStyle = aura;
      C.beginPath();
      C.arc(p.x, p.y, auraR, 0, Math.PI * 2);
      C.fill();

      if (impact > 0.04) {
        C.strokeStyle = `rgba(218,130,30,${0.35 + impact * 0.5})`;
        C.lineWidth = 1 + impact * 3;
        C.beginPath();
        C.arc(p.x, p.y, 28 + impact * 24, 0, Math.PI * 2);
        C.stroke();
      }

      C.strokeStyle = fg;
      C.globalAlpha = 0.16;
      C.lineWidth = 8;
      C.beginPath();
      C.arc(p.x, p.y, 18, 0, Math.PI * 2);
      C.stroke();
      C.globalAlpha = 1;
      C.strokeStyle = probColor(prob);
      C.lineWidth = 4;
      C.beginPath();
      C.arc(p.x, p.y, 18, -Math.PI / 2, -Math.PI / 2 + prob * Math.PI * 2);
      C.stroke();

      C.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
      C.beginPath();
      C.arc(p.x, p.y, 11, 0, Math.PI * 2);
      C.fill();
      C.fillStyle = bg;
      C.beginPath();
      C.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      C.fill();

      C.fillStyle = fg;
      C.textAlign = 'right';
      C.textBaseline = 'middle';
      C.fillStyle = fg;
      C.font = 'bold 12px sans-serif';
      const _abrev = { cuerdas: 'CUE', percusion: 'PER', melodia: 'MEL' };
      C.fillText(_abrev[id] || id.slice(0, 3).toUpperCase(), marginX - 16, p.y - 8);
      C.fillStyle = muted;
      C.font = '10px sans-serif';
      C.fillText(`${p.ui.estado} · ${Math.min(p.inst.posicion + 1, N)}/${N}`, marginX - 16, p.y + 8);

      C.textAlign = 'left';
      C.fillStyle = fg;
      C.font = '10px sans-serif';
      C.fillText(`mundo ${signedPct(world)}   sala ${signedPct(room)}   P ${Math.round(prob * 100)}%`, p.x + 28, p.y - 8);
      C.fillStyle = muted;
      C.fillText(decisionText(p), p.x + 28, p.y + 8);
    }

    for (let i = this._ripples.length - 1; i >= 0; i--) {
      const rp = this._ripples[i];
      rp.age += 0.018;
      if (rp.age >= 1) { this._ripples.splice(i, 1); continue; }
      const alpha = 1 - rp.age;
      C.strokeStyle = `rgba(${rp.rgb.r},${rp.rgb.g},${rp.rgb.b},${alpha * 0.8})`;
      C.lineWidth = 2;
      C.beginPath();
      C.arc(rp.x, rp.y, 24 + rp.age * 78, 0, Math.PI * 2);
      C.stroke();
      C.fillStyle = `rgba(${rp.rgb.r},${rp.rgb.g},${rp.rgb.b},${alpha})`;
      C.font = '700 10px Courier New, monospace';
      C.textAlign = 'center';
      C.fillText(String(rp.text || '').slice(0, 44), rp.x, rp.y - 32 - rp.age * 22);
    }
    C.restore();
  }

  _drawFooter(C, fg, muted, W, H, sala) {
    // Texto del pie de página removido a pedido del usuario
  }

  _cssToRgb(css) {
    if (!css) return { r: 100, g: 100, b: 100 };
    if (css.startsWith('#')) {
      const hex = css.replace('#', '');
      if (hex.length === 6) {
        return {
          r: parseInt(hex.substring(0, 2), 16),
          g: parseInt(hex.substring(2, 4), 16),
          b: parseInt(hex.substring(4, 6), 16),
        };
      }
    }
    const m = css.match(/\d+/g);
    if (!m || m.length < 3) return { r: 100, g: 100, b: 100 };
    return { r: +m[0], g: +m[1], b: +m[2] };
  }
}

function relationForDistance(d) {
  if (d <= 1) return { label: 'unísono', dash: [] };
  if (d <= 3) return { label: 'escucha', dash: [] };
  if (d <= 6) return { label: 'tensión', dash: [6, 4] };
  return { label: 'aislamiento', dash: [2, 6] };
}

function probColor(p) {
  if (p > 0.6) return '#2f9e44';
  if (p > 0.4) return '#c49a00';
  if (p > 0.2) return '#d66a00';
  return '#cf2e16';
}

function signedPct(v) {
  const n = Math.round(Math.max(-1, Math.min(1, v || 0)) * 100);
  return `${n >= 0 ? '+' : ''}${n}%`;
}

function decisionText(p) {
  const motivo = p.b?.motivo || 'mixto';
  const map = {
    dato: 'el mundo empuja',
    api: 'el mundo empuja',
    huella: 'repite por huella fresca',
    stigmergy: 'repite por huella fresca',
    grupo: 'la sala lo arrastra',
    cohesion: 'la sala lo arrastra',
    separacion: 'se destraba para abrir espacio',
    momentum: 'sigue la corriente del grupo',
    impacto: 'otro avance lo contagia',
    shockwave: 'otro avance lo contagia',
    geometria: 'la forma común modifica la decisión',
    escucha: 'escucha el paso de sus vecinos',
    secuencia: 'la repetición acumulada pide avanzar',
    maduracion: 'todavía habita este patrón',
    tiempo: 'el tiempo habitado habilita avanzar',
    freno: 'se frena por alejarse',
    freno_manual: 'freno del convocante',
    control: 'gesto del convocante',
  };
  return map[motivo] || 'decisión mixta';
}
