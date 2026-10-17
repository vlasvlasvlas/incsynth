import { compilePattern, noteName as scoreNoteName, noteMidi, SCORE_STATUS } from '../audio/score.js';
import './pattern-reader.css';
import { notationLayout } from './notation.js';

const READER_PPQ = 192;
const SVG_NS = 'http://www.w3.org/2000/svg';
const PHASES = { stopped: 'Detenido', waiting: 'Esperando entrada', playing: 'Interpretando', resting: 'Descanso de frase', ended: 'Finalizado', suspended: 'Audio suspendido' };
const DURATIONS = { '1n': 'redonda', '2n': 'blanca', '4n': 'negra', '8n': 'corchea', '16n': 'semicorchea', '32n': 'fusa' };
function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function svgElement(tag, attributes) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, String(value));
  return el;
}
function pitch(note) { return noteMidi(note); }
function noteName(event) {
  if (event.kind === 'rest' || !event.note) return 'Silencio';
  return `${scoreNoteName(event.note)}${event.kind === 'grace' ? ' · adorno' : event.kind === 'tie' ? ' · ligada' : ''}`;
}
function durationName(source, event) {
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const divisor = gcd(event.durationTicks, READER_PPQ);
  const numerator = event.durationTicks / divisor;
  const denominator = READER_PPQ / divisor;
  const beats = denominator === 1 ? String(numerator) : `${numerator}/${denominator}`;
  const timing = `${beats} ${event.durationTicks === READER_PPQ ? 'pulso' : 'pulsos'}`;
  const value = source?.duracion;
  if (typeof value === 'string' && event.kind !== 'grace' && !source?.grace?.length) {
    const base = value.replace(/\.$/, '');
    if (DURATIONS[base]) return `${DURATIONS[base]}${value.endsWith('.') ? ' con puntillo' : ''} · ${timing}`;
  }
  if (source?.grace?.length && event.kind !== 'grace' && DURATIONS[value?.replace(/\.$/, '')]) {
    return `${DURATIONS[value.replace(/\.$/, '')]} con adorno · ${timing} de nota principal`;
  }
  return timing;
}

/** Read-only view of the audio engine's actual playback snapshot. */
export class PatternReader {
  constructor(container, instrumentos, patrones, getEngine) {
    this.container = container;
    this.instrumentos = instrumentos;
    this.patrones = patrones;
    this.getEngine = getEngine;
    this.cards = new Map();
    this.compiled = new Map();
    this.selected = null;
    this.detailKey = null;
    container.classList.add('pattern-reader');
    const heading = element('div', 'pr-heading');
    const tools = element('div', 'pr-tools');
    const source = element('span', 'pr-verification', '53 figuras · partitura cotejada');
    source.title = SCORE_STATUS.label;
    tools.append(source);
    heading.append(tools);
    this.grid = element('div', 'pr-cards');
    container.append(heading, this.grid);
    for (const [id, inst] of Object.entries(instrumentos)) {
      const row = element('article', 'pr-voice');
      const button = element('button', 'pr-card');
      button.type = 'button';
      if (inst._colorHex) row.style.setProperty('--voice-color', inst._colorHex);
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', 'pattern-reader-detail');
      const name = element('strong', 'pr-name', inst._nombre || id);
      const position = element('span', 'pr-position');
      const graphic = element('div', 'pr-mini');
      graphic.tabIndex = 0;
      graphic.setAttribute('aria-label', `Partitura de ${inst._nombre || id}; desplazar para ver figuras largas`);
      const current = element('span', 'pr-now');
      const top = element('span', 'pr-card-top');
      top.append(name, position);
      button.append(top, current);
      row.append(button, graphic);
      button.addEventListener('click', () => this.select(this.selected === id ? null : id));
      this.grid.append(row);
      this.cards.set(id, { button, position, graphic, current, patternIndex: null, drawing: null, dwellMs: 0, lastTickMs: null });
    }
    this.detail = element('section', 'pr-detail');
    this.detail.id = 'pattern-reader-detail';
    this.detail.hidden = true;
    this.detail.setAttribute('tabindex', '-1');
    this.detail.setAttribute('aria-label', 'Detalle del patrón en ejecución');
    const detailTop = element('div', 'pr-detail-top');
    this.detailTitle = element('strong');
    const close = element('button', 'pr-close', 'Cerrar');
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    detailTop.append(this.detailTitle, close);
    this.detailStatus = element('p', 'pr-detail-status');
    this.scroller = element('div', 'pr-scroll');
    this.scroller.tabIndex = 0;
    this.scroller.setAttribute('aria-label', 'Patrón completo; desplazar horizontalmente para explorar');
    this.eventList = element('ol', 'pr-event-list');
    this.detail.append(detailTop, element('p', 'pr-help', 'Tiempo del patrón: el ancho indica la duración. Las ligaduras sostienen la nota sin volver a atacarla. Un pulso equivale a una negra.'), this.detailStatus, this.scroller, this.eventList);
    container.append(this.detail);
    this.onKeydown = event => {
      if (event.key === 'Escape' && this.selected && container.contains(document.activeElement)) {
        event.preventDefault();
        this.close();
      }
    };
    container.addEventListener('keydown', this.onKeydown);
    this.update();
  }

  select(id) {
    this.selected = id;
    this.detailKey = null;
    this.detail.hidden = !id;
    this.container.classList.toggle('pr-expanded', !!id);
    for (const [key, card] of this.cards) card.button.setAttribute('aria-expanded', String(key === id));
    this.update();
    if (id) {
      this.detail.focus({ preventScroll: true });
      if (window.matchMedia('(max-width:1000px)').matches) this.detail.scrollIntoView({block:'nearest',behavior:'smooth'});
    }
  }

  close() {
    const previous = this.selected;
    this.select(null);
    this.cards.get(previous)?.button.focus();
  }

  score(index) {
    if (!this.compiled.has(index)) this.compiled.set(index, compilePattern(this.patrones[index], { ppq: READER_PPQ }));
    return this.compiled.get(index);
  }

  draw(index, large) {
    const score = this.score(index);
    const events = score.events;
    const width = large ? Math.max(540, events.length * 76) : 240;
    const height = large ? 100 : 42;
    const padding = 8;
    const total = Math.max(1, score.totalTicks);
    const notes = events.filter(e => e.note).map(e => pitch(e.note));
    const low = Math.min(60, ...notes), high = Math.max(72, ...notes);
    const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img' });
    svg.setAttribute('aria-label', `Patrón ${index + 1}: ${events.length} eventos rítmicos. ${events.map(noteName).join(', ')}`);
    if (large) svg.style.width = `${width}px`;
    const marks = [];
    for (const ev of events) {
      const x = padding + ev.onsetTicks / total * (width - padding * 2);
      const isRest = ev.kind === 'rest' || !ev.note;
      const y = isRest ? height - 12 : 6 + (high - pitch(ev.note)) / (high - low) * (height - 27);
      const rect = svgElement('rect', { x, y, width: Math.max(2, ev.durationTicks / total * (width - padding * 2) - 2), height: large ? 10 : 7, rx: 2, class: `pr-mark${isRest ? ' pr-rest' : ''}${ev.kind === 'grace' ? ' pr-grace' : ''}${ev.kind === 'tie' ? ' pr-tie' : ''}` });
      const title = svgElement('title', {});
      title.textContent = noteName(ev);
      rect.append(title);
      svg.append(rect);
      marks.push({ el: rect, index: ev.index, isRest });
    }
    const cursor = svgElement('line', { x1: padding, x2: padding, y1: 0, y2: height, class: 'pr-cursor', visibility: 'hidden' });
    svg.append(cursor);
    return { svg, marks, cursor, width, padding };
  }

  drawStaff(index) {
    const events = notationLayout(this.patrones[index], this.score(index));
    const width = Math.max(360, events.at(-1).x + events.at(-1).width + 20);
    const svg = svgElement('svg', { viewBox: `0 0 ${width} 150`, role: 'img', class: 'pr-staff', preserveAspectRatio: 'xMinYMid meet' });
    svg.style.width = `${width}px`;
    svg.setAttribute('aria-label', `Patrón ${index + 1}: ${events.map(noteName).join(', ')}`);
    const line = (parent, x1, y1, x2, y2, cls = 'pr-staff-line') => parent.append(svgElement('line', {x1,y1,x2,y2,class:cls}));
    for (let y=52; y<=92; y+=10) line(svg, 12,y,width-12,y);
    const clef=svgElement('text',{x:14,y:91,class:'pr-clef'}); clef.textContent='𝄞'; svg.append(clef);
    const marks=[];
    for (const ev of events) {
      const g=svgElement('g',{class:'pr-symbol'});
      const {x,y,denominator:d}=ev;
      const halo=svgElement('rect',{x:x-18,y:8,width:ev.width-4,height:132,rx:8,class:'pr-note-halo'});g.append(halo);
      if (ev.note) {
        for (let ly=102; ly<=y; ly+=10) line(g,x-11,ly,x+11,ly,'pr-ledger');
        for (let ly=42; ly>=y; ly-=10) line(g,x-11,ly,x+11,ly,'pr-ledger');
        const accidental=ev.accidental;
        // Explicit accidentals on each affected note avoid ambiguous carry rules.
        if(accidental) { const a=svgElement('text',{x:x-22,y:y+5,class:'pr-accidental'}); a.textContent=accidental;g.append(a); }
        g.append(svgElement('ellipse',{cx:x,cy:y,rx:ev.grace?4:6,ry:ev.grace?3:4,transform:`rotate(-20 ${x} ${y})`,class:d<=2?'pr-head pr-open-head':'pr-head'}));
        if(d>1) {
          const up=y>=72; const stemX=x+(up?5:-5), tip=y+(up?-28:28);
          line(g,stemX,y,stemX,tip,'pr-stem');
          for(let f=0; f<Math.max(0,Math.log2(d)-2); f++) {
            const fy=tip+(up?f*6:-f*6);
            g.append(svgElement('path',{d:`M ${stemX} ${fy} q ${up?15:-15} ${up?6:-6} ${up?5:-5} ${up?17:-17}`,class:'pr-flag'}));
          }
          if(ev.grace) line(g,stemX-5,tip+13,stemX+8,tip+4,'pr-stem');
        }
        if(ev.dotted) g.append(svgElement('circle',{cx:x+13,cy:y%10===2?y-4:y,r:2,class:'pr-head'}));
        if(ev.kind==='tie') {
          const prev=events[ev.index-1];
          g.append(svgElement('path',{d:`M ${prev.x+7} ${Math.max(y,prev.y)+12} Q ${(prev.x+x)/2} ${Math.max(y,prev.y)+25} ${x-7} ${y+12}`,class:'pr-tie-arc'}));
        }
      } else {
        const rest=svgElement('text',{x:x-7,y:82,class:'pr-rest-symbol'});
        rest.textContent=({1:'𝄻',2:'𝄼',4:'𝄽',8:'𝄾',16:'𝄿'})[d] || '𝄽';g.append(rest);
        if(ev.dotted) g.append(svgElement('circle',{cx:x+12,cy:72,r:2,class:'pr-head'}));
      }
      const label=svgElement('text',{x,y:128,class:'pr-note-label','text-anchor':'middle'});
      label.textContent=ev.note?scoreNoteName(ev.note):'sil.';g.append(label);
      const title=svgElement('title',{});title.textContent=`${noteName(ev)} · ${durationName(this.patrones[index][ev.sourceIndex],ev)}`;g.append(title);
      svg.append(g);marks.push({el:g,index:ev.index,isRest:!ev.note});
    }
    return {svg,marks,events,staff:true};
  }

  paint(drawing, state) {
    if (!drawing) return;
    const live = state.running && state.phase === 'playing';
    for (const mark of drawing.marks) {
      const active = live && mark.index === state.eventIndex;
      mark.el.classList.toggle('pr-current', active);
      mark.el.classList.toggle('pr-attack', active && !mark.isRest && ['note', 'grace'].includes(state.kind));
    }
    if (drawing.staff) return;
    drawing.cursor.setAttribute('visibility', live ? 'visible' : 'hidden');
    const x = drawing.padding + Math.max(0, Math.min(1, state.progress || 0)) * (drawing.width - drawing.padding * 2);
    drawing.cursor.setAttribute('x1', String(x));
    drawing.cursor.setAttribute('x2', String(x));
  }

  update() {
    const engine = this.getEngine?.();
    for (const [id, card] of this.cards) {
      const state = engine?.getPlaybackState?.(id) || { running: false, phase: 'stopped', patternIndex: null, eventIndex: null };
      const actual = Number.isInteger(state.patternIndex) && state.patternIndex >= 0 && state.patternIndex < this.patrones.length;
      // A static preview is explicitly labelled; it never pretends to be playing.
      const index = actual ? state.patternIndex : Math.max(0, Math.min(this.patrones.length - 1, this.instrumentos[id].posicion || 0));
      const status = state.phase === 'suspended' ? PHASES.suspended : state.running ? (state.kind === 'rest' && state.phase === 'playing' ? 'Silencio escrito' : PHASES[state.phase] || 'Esperando') : state.phase === 'ended' ? 'Finalizado' : 'Detenido · vista previa';
      card.position.textContent = `Patrón ${String(index + 1).padStart(2, '0')} (${String(Math.floor((card.dwellMs ?? 0) / 1000)).padStart(2, '0')}s)`;
      card.current.textContent = state.running && state.phase === 'playing' ? (state.note ? scoreNoteName(state.note) + (state.kind === 'tie' ? ' · ligada' : state.kind === 'grace' ? ' · adorno' : '') : 'Silencio') : '—';
      card.button.setAttribute('aria-label', `${this.instrumentos[id]._nombre || id}, patrón ${index + 1}, ${status}. Ver lectura rítmica`);
      const now = performance.now();
      const playing = state.running && state.phase === 'playing';
      if (card.patternIndex !== index) {
        card.patternIndex = index;
        card.drawing = this.drawStaff(index);
        card.graphic.replaceChildren(card.drawing.svg);
        card.dwellMs = 0;
        card.lastTickMs = playing ? now : null;
      } else if (playing) {
        if (card.lastTickMs !== null) card.dwellMs += now - card.lastTickMs;
        card.lastTickMs = now;
      } else {
        card.lastTickMs = null;
      }
      this.paint(card.drawing, state);
      if (state.running && state.phase === 'playing' && card.lastEvent !== state.eventIndex) {
        const event = card.drawing.events[state.eventIndex];
        if (event && (event.x < card.graphic.scrollLeft + 30 || event.x > card.graphic.scrollLeft + card.graphic.clientWidth - 40)) {
          card.graphic.scrollLeft = Math.max(0, event.x - card.graphic.clientWidth / 3);
        }
      }
      card.lastEvent = state.eventIndex;
      if (this.selected !== id) continue;
      const key = `${id}:${index}`;
      if (this.detailKey !== key) {
        this.detailKey = key;
        this.detailTitle.textContent = `${this.instrumentos[id]._nombre || id} · patrón ${index + 1} de ${this.patrones.length}`;
        this.detailDrawing = this.draw(index, true);
        this.scroller.replaceChildren(this.detailDrawing.svg);
        this.eventItems = this.score(index).events.map(ev => {
          const item = element('li');
          const source = Array.isArray(this.patrones[index]) ? this.patrones[index][ev.sourceIndex] : null;
          item.append(element('span', '', noteName(ev)), element('small', '', durationName(source, ev)));
          return { el: item, index: ev.index };
        });
        this.eventList.replaceChildren(...this.eventItems.map(item => item.el));
      }
      const pending = Number.isInteger(state.pendingPatternIndex) && state.pendingPatternIndex !== index ? ` · siguiente patrón: ${state.pendingPatternIndex + 1}` : '';
      this.detailStatus.textContent = `${status}${state.running && Number.isFinite(state.cycle) ? ` · ciclo ${state.cycle}` : ''}${pending}`;
      this.paint(this.detailDrawing, state);
      for (const item of this.eventItems || []) {
        const current = state.running && state.phase === 'playing' && item.index === state.eventIndex;
        item.el.classList.toggle('pr-current-event', current);
        if (current) item.el.setAttribute('aria-current', 'true');
        else item.el.removeAttribute('aria-current');
      }
    }
  }

  dispose() {
    this.container.removeEventListener('keydown', this.onKeydown);
    this.container.replaceChildren();
  }
}
