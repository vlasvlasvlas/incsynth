import { ColorSystem } from './ColorSystem.js';

export class CircleView {
  constructor(containerEl, instrumentIds) {
    this.container = containerEl;
    this.ids       = instrumentIds;
    this.colors    = new ColorSystem();

    this._canvas      = document.createElement('canvas');
    this._ctx         = this._canvas.getContext('2d');
    this._trailCanvas = document.createElement('canvas');
    this._trailCtx    = this._trailCanvas.getContext('2d');
    this._ripples     = [];
    this._prevPos     = {};
    this._W = 0; this._H = 0; // dimensiones lógicas (CSS px)

    this.container.appendChild(this._canvas);

    // Ángulo fijo por instrumento (equidistante, primero arriba)
    this._angles = {};
    instrumentIds.forEach((id, i) => {
      this._angles[id] = -Math.PI / 2 + (i / instrumentIds.length) * Math.PI * 2;
    });

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  // ─ Resize con DPR para pantallas Retina ─
  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const w   = Math.max(320, this.container.offsetWidth || window.innerWidth);
    // Tomar la altura disponible del contenedor real
    const parentH = this.container.parentElement?.offsetHeight || window.innerHeight - 60;
    const h   = Math.max(360, parentH);
    if (!w || !h) { setTimeout(() => this._resize(), 100); return; }

    this._W = w; this._H = h;

    // Canvas principal
    this._canvas.width  = Math.round(w * dpr);
    this._canvas.height = Math.round(h * dpr);
    this._canvas.style.width  = `${w}px`;
    this._canvas.style.height = `${h}px`;
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Canvas de trails
    this._trailCanvas.width  = Math.round(w * dpr);
    this._trailCanvas.height = Math.round(h * dpr);
    this._trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._trailCtx.clearRect(0, 0, w, h);
  }

  render(instrumentos, sala) {
    const W  = this._W;
    const H  = this._H;
    if (!W || !H) return;
    try {

    const bodyStyle = getComputedStyle(document.body);
    const bgCol = bodyStyle.getPropertyValue('--canvas-bg').trim() || bodyStyle.getPropertyValue('--bg').trim() || '#ffffff';
    const fgCol = bodyStyle.getPropertyValue('--fg').trim() || '#111111';
    const isDark = document.body.classList.contains('dark-theme');

    const C    = this._ctx;
    const T    = this._trailCtx;
    const cX   = W / 2;
    const cY   = H / 2;
    const compact = W < 600;
    const maxR = Math.min(W, H) * (compact ? 0.29 : 0.38);
    const N    = sala.numPatrones;

    // ── 1. Trail canvas: fade + stigmergy radial ──
    T.fillStyle = isDark ? 'rgba(13,13,13,0.07)' : 'rgba(245,245,243,0.07)';
    T.fillRect(0, 0, W, H);

    for (const id of this.ids) {
      const inst = instrumentos[id];
      if (!inst) continue;
      const angle = this._angles[id];
      const color = this.colors.getDotColor(inst, sala);
      const rgb   = this._cssToRgb(color);
      for (let p = 0; p < N; p++) {
        const intensity = sala.terreno[p];
        if (intensity < 0.03) continue;
        const r  = (p / N) * maxR;
        const tx = cX + Math.cos(angle) * r;
        const ty = cY + Math.sin(angle) * r;
        T.beginPath();
        T.arc(tx, ty, 3 + intensity * 5, 0, Math.PI * 2);
        T.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${intensity * 0.55})`;
        T.fill();
      }
    }

    // ── 2. Canvas principal ──
    C.clearRect(0, 0, W, H);
    C.fillStyle = bgCol;
    C.fillRect(0, 0, W, H);
    C.drawImage(this._trailCanvas, 0, 0, W, H);

    // ── 3. Anillos guía ──
    C.save();
    for (let p = 5; p <= N; p += 5) {
      const r = (p / N) * maxR;
      C.strokeStyle = p % 5 === 0 ? fgCol : fgCol;
      C.globalAlpha = p % 5 === 0 ? 0.15 : 0.04;
      C.beginPath(); C.arc(cX, cY, r, 0, Math.PI*2); C.stroke();
      C.globalAlpha = 1;

      if (p % 5 === 0 || p === N - 1) {
        C.font = '10px Courier New';
        C.fillStyle = fgCol;
        C.globalAlpha = 0.4;
        C.fillText(String(p + 1), cX, cY - r - 4);
        C.globalAlpha = 1;
      }
    }
    C.restore();

    // Centro de masa
    C.save();
    const momRadius = (sala.getCentroMasa() / N) * maxR;
    C.strokeStyle = fgCol;
    C.globalAlpha = 0.3;
    C.lineWidth = 1.5;
    C.setLineDash([4, 4]);
    C.beginPath(); C.arc(cX, cY, momRadius, 0, Math.PI*2); C.stroke();
    C.setLineDash([]);
    C.globalAlpha = 1;
    C.restore();

    // ── 4. Pulso central ──
    C.save();
    const pulse = (Math.sin(Date.now() * 0.003) + 1) * 0.5;
    const pg = C.createRadialGradient(cX, cY, 0, cX, cY, 10 + pulse * 5);
    pg.addColorStop(0, `rgba(0,0,0,${0.18 + pulse * 0.1})`);
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    C.beginPath(); C.arc(cX, cY, 15 + pulse * 4, 0, Math.PI * 2);
    C.fillStyle = pg; C.fill();
    C.restore();

    // ── 5. Calcular posiciones ──
    const pos = {};
    for (const id of this.ids) {
      const inst = instrumentos[id];
      if (!inst) continue;
      const angle = this._angles[id];
      const r     = (inst.posicion / N) * maxR;
      const x = cX + Math.cos(angle) * r;
      const y = cY + Math.sin(angle) * r;
      const labelOffset = compact ? 25 : 40;
      pos[id] = { x, y, inst, r, angle, lblX: cX + Math.cos(angle) * (maxR + labelOffset), lblY: cY + Math.sin(angle) * (maxR + labelOffset) };
    }

    // ── 6. Forma común: triángulo creado por los tres músicos ──
    const triangle = this.ids.map(id => pos[id]).filter(Boolean).slice(0, 3);
    if (triangle.length === 3) {
      const geometria = sala.getGeometria();
      C.save();
      C.beginPath();
      C.moveTo(triangle[0].x, triangle[0].y);
      C.lineTo(triangle[1].x, triangle[1].y);
      C.lineTo(triangle[2].x, triangle[2].y);
      C.closePath();
      C.fillStyle = isDark ? 'rgba(74,170,164,0.055)' : 'rgba(0,105,100,0.045)';
      C.fill();
      C.strokeStyle = isDark ? 'rgba(110,190,184,0.32)' : 'rgba(0,105,100,0.24)';
      C.lineWidth = 1 + geometria.estabilidad;
      C.setLineDash(geometria.tendencia === 'estable' ? [4, 5] : []);
      C.stroke();
      C.setLineDash([]);
      C.fillStyle = fgCol;
      C.globalAlpha = 0.48;
      C.font = '9px Courier New';
      C.textAlign = 'center';
      C.fillText(`forma ${geometria.estado} · área ${Math.round(geometria.area * 100)}%`, cX, cY + 34);
      C.restore();
    }

    // ── 7. Emanación contenida ──
    C.save();
    for (const id of this.ids) {
      const p = pos[id]; if (!p) continue;
      const ui  = p.inst.getEstadoUI();
      const rgb = this._cssToRgb(this.colors.getDotColor(p.inst, sala));
      const glowFactor = p.inst._glowRadius !== undefined ? p.inst._glowRadius : 1.0;
      const lightGain = p.inst._lightGain !== undefined ? p.inst._lightGain : 1.0;
      const mag = ui.señal || 0;
      if (mag > 0.05 || glowFactor > 1.0) {
        const effMag = Math.max(mag, 0.2);
        const gR = 10 + effMag * 22 * glowFactor * lightGain;
        const grd = C.createRadialGradient(p.x, p.y, 0, p.x, p.y, gR);
        grd.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(0.52, effMag * 0.28 * lightGain)})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        C.fillStyle = grd;
        C.beginPath(); C.arc(p.x, p.y, gR, 0, Math.PI*2); C.fill();
      }
    }
    C.restore();

    // ── 8. Hilos de cohesión ──
    C.save();
    const active = this.ids.filter(id => pos[id] && instrumentos[id]?.estado !== 'DORMIDO');
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = pos[active[i]], b = pos[active[j]];
        const d = Math.abs(instrumentos[active[i]].posicion - instrumentos[active[j]].posicion);
        if (d > 8) continue;
        const alpha = Math.max(0, 0.5 - d * 0.06);
        const rgbA  = this._cssToRgb(this.colors.getDotColor(a.inst, sala));
        const rgbB  = this._cssToRgb(this.colors.getDotColor(b.inst, sala));
        const grd   = C.createLinearGradient(a.x, a.y, b.x, b.y);
        grd.addColorStop(0, `rgba(${rgbA.r},${rgbA.g},${rgbA.b},${alpha})`);
        grd.addColorStop(1, `rgba(${rgbB.r},${rgbB.g},${rgbB.b},${alpha})`);
        C.strokeStyle = grd;
        C.lineWidth   = 1 + alpha;
        C.setLineDash(d < 3 ? [] : [3, 3]);
        C.beginPath(); C.moveTo(a.x, a.y); C.lineTo(b.x, b.y); C.stroke();
        C.setLineDash([]);
      }
    }
    C.restore();

    // ── 8. Flecha de momentum ──
    C.save();
    const mom = sala.getMomentum();
    if (mom > 0.05) {
      const arrowLen = mom * maxR * 0.25;
      const ax = cX, ay = cY - maxR - 10;
      C.strokeStyle = fgCol;
      C.globalAlpha = 0.2 + mom * 0.5;
      C.lineWidth   = 1.5;
      C.beginPath();
      C.moveTo(ax - arrowLen/2, ay);
      C.lineTo(ax + arrowLen/2, ay);
      C.moveTo(ax + arrowLen/2 - 5, ay - 3);
      C.lineTo(ax + arrowLen/2, ay);
      C.lineTo(ax + arrowLen/2 - 5, ay + 3);
      C.stroke();
    }
    C.restore();

    // ── 9. Shockwaves (Ripples) ──
    C.save();
    for (let i = this._ripples.length - 1; i >= 0; i--) {
      const rp = this._ripples[i];
      rp.age += 0.015;
      if (rp.age >= 1) { this._ripples.splice(i, 1); continue; }
      if (rp.text) {
        rp.y -= 0.5;
        C.font = 'bold 11px Courier New';
        C.fillStyle = `rgba(${rp.rgb.r},${rp.rgb.g},${rp.rgb.b},${1 - rp.age})`;
        C.textAlign = 'center'; C.textBaseline = 'middle';
        C.fillText(rp.text, rp.x, rp.y);
      } else {
        const maxWaveR = Math.min(W, H) * 0.4;
        const r = Math.max(0.1, rp.age * maxWaveR);
        const alpha = Math.max(0, (1 - rp.age) * 0.8);
        const grd = C.createRadialGradient(rp.x, rp.y, Math.max(0, r * 0.8), rp.x, rp.y, r);
        grd.addColorStop(0, `rgba(${rp.rgb.r},${rp.rgb.g},${rp.rgb.b},0)`);
        grd.addColorStop(0.8, `rgba(${rp.rgb.r},${rp.rgb.g},${rp.rgb.b},${alpha * 0.5})`);
        grd.addColorStop(1, `rgba(${rp.rgb.r},${rp.rgb.g},${rp.rgb.b},${alpha})`);
        C.fillStyle = grd;
        C.beginPath(); C.arc(rp.x, rp.y, r, 0, Math.PI*2); C.fill();
        C.strokeStyle = `rgba(${rp.rgb.r},${rp.rgb.g},${rp.rgb.b},${alpha * 1.5})`;
        C.lineWidth = 3 - rp.age * 2;
        C.beginPath(); C.arc(rp.x, rp.y, r, 0, Math.PI*2); C.stroke();
      }
    }
    C.restore();

    // ── 10. Dots + semáforos + labels ──
    for (const id of this.ids) {
      const p   = pos[id]; if (!p) continue;
      const ui  = p.inst.getEstadoUI();
      const rgb = this._cssToRgb(this.colors.getDotColor(p.inst, sala));
      const impact = sala.getImpactoShockwave(p.inst.posicion);

      if (this._prevPos[id] !== undefined && this._prevPos[id] !== p.inst.posicion) {
        this._ripples.push({ x: p.x, y: p.y, age: 0, rgb });
        if (ui.payload) this._ripples.push({ x: p.x, y: p.y - 18, age: 0, rgb, text: ui.payload });
      }
      this._prevPos[id] = p.inst.posicion;

      C.save();
      const probP = ui.probBreakdown?.p ?? 0;
      const semColor = probP > 0.60 ? '#1a7a1a' : probP > 0.40 ? '#c9a000'
                     : probP > 0.20 ? '#cc6000' : '#cc2200';
      C.strokeStyle = fgCol; C.globalAlpha = 0.1; C.lineWidth = 3;
      C.beginPath(); C.arc(p.x, p.y, 14, 0, Math.PI*2); C.stroke();
      C.globalAlpha = 1;
      if (probP > 0.02) {
        C.strokeStyle = semColor;
        C.beginPath(); C.arc(p.x, p.y, 14, -Math.PI/2, -Math.PI/2 + probP * Math.PI*2); C.stroke();
      }
      if (impact > 0.04) {
        const rr = 18 + impact * 18 + Math.sin(Date.now() * 0.008) * 2;
        C.strokeStyle = `rgba(204,136,0,${0.25 + impact * 0.55})`;
        C.lineWidth = 1 + impact * 2;
        C.beginPath(); C.arc(p.x, p.y, rr, 0, Math.PI*2); C.stroke();
      }

      C.beginPath(); C.arc(p.x, p.y, 9, 0, Math.PI*2);
      C.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`; C.fill();
      C.beginPath(); C.arc(p.x, p.y, 3, 0, Math.PI*2);
      C.fillStyle = '#fff'; C.fill();

      if (ui.estado === 'RETENIDO') {
        const pulse = 14 + Math.sin(Date.now() * 0.007) * 3;
        C.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.6)`;
        C.lineWidth = 1.5;
        C.beginPath(); C.arc(p.x, p.y, pulse, 0, Math.PI*2); C.stroke();
      }

      C.textAlign = 'center'; C.textBaseline = 'middle';
      C.font = `bold ${compact ? 9 : 12}px Courier New`;
      C.fillStyle = fgCol;
      C.fillText(p.inst._nombre || id, p.lblX, p.lblY);
      C.font = `${compact ? 8 : 10}px Courier New`;
      C.fillStyle = fgCol; C.globalAlpha = 0.6;
      C.fillText(`${ui.estado} ${ui.posicion}/${N}`, p.lblX, p.lblY + 14);
      if (impact > 0.04) {
        C.fillStyle = '#cc8800';
        C.globalAlpha = 0.85;
        C.fillText(`impacto ${Math.round(impact * 100)}%`, p.lblX, p.lblY + (compact ? 22 : 28));
      }
      C.globalAlpha = 1;
      C.restore();
    }
    C.font = '10px Courier New';
    C.textAlign = 'left';
    C.textBaseline = 'middle';
    const sems = [
      { color: '#1a7a1a', label: 'AVANZA' },
      { color: '#c9a000', label: 'posible' },
      { color: '#cc6000', label: 'frenado' },
      { color: '#cc2200', label: 'insiste' },
    ];
    const iW  = compact ? 62 : 78;
    const totW = sems.length * iW;
    let   lx  = cX - totW / 2;
    const ly  = cY + maxR + 32;
    // Fondo de la leyenda
    C.fillStyle = isDark ? 'rgba(13,13,13,0.9)' : 'rgba(255,255,255,0.9)';
    C.fillRect(lx - 6, ly - 8, totW + 12, 20);
    for (const s of sems) {
      C.fillStyle = s.color;
      C.beginPath(); C.arc(lx + 5, ly, 4, 0, Math.PI * 2); C.fill();
      C.fillStyle = fgCol;
      C.fillText(s.label, lx + 14, ly);
      lx += iW;
    }
    C.font = '9px Courier New';
    C.fillStyle = fgCol;
    C.globalAlpha = 0.45;
    C.textAlign = 'center';
    C.fillText(
      compact ? 'huella · cohesión · centro de grupo' : 'manchas: huella del patrón  ·  hilos: cohesión entre instrumentos  ·  anillo punteado: centro de grupo',
      cX,
      ly + 18
    );
    C.globalAlpha = 1;
    C.restore();
    } catch (e) {
      console.error(e);
      this._ctx.fillStyle = 'red';
      this._ctx.font = '14px Arial';
      this._ctx.fillText(e.toString(), 20, 50);
      this._ctx.fillText(e.stack || '', 20, 80);
    }
  }

  _cssToRgb(css) {
    if (!css) return { r: 100, g: 100, b: 100 };
    if (css.startsWith('#')) {
      const hex = css.replace('#', '');
      if (hex.length === 6) {
        return {
          r: parseInt(hex.substring(0, 2), 16),
          g: parseInt(hex.substring(2, 4), 16),
          b: parseInt(hex.substring(4, 6), 16)
        };
      }
    }
    const m = css.match(/\d+/g);
    if (!m || m.length < 3) return { r: 100, g: 100, b: 100 };
    return { r: +m[0], g: +m[1], b: +m[2] };
  }
}
