import { compilePattern, noteName as scoreNoteName, noteMidi, SCORE_STATUS } from '../audio/score.js';
import './pattern-reader.css';

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
    heading.append(element('strong', '', 'Lectura rítmica'), element('span', 'pr-verification', SCORE_STATUS.label));
    this.grid = element('div', 'pr-cards');
    container.append(heading, this.grid);
    for (const [id, inst] of Object.entries(instrumentos)) {
      const button = element('button', 'pr-card');
      button.type = 'button';
      if (inst._colorHex) button.style.setProperty('--voice-color', inst._colorHex);
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', 'pattern-reader-detail');
      const name = element('strong', 'pr-name', inst._nombre || id);
      const position = element('span', 'pr-position');
      const status = element('span', 'pr-status');
      const graphic = element('span', 'pr-mini');
      const top = element('span', 'pr-card-top');
      top.append(name, position);
      button.append(top, graphic, status);
      button.addEventListener('click', () => this.select(this.selected === id ? null : id));
      this.grid.append(button);
      this.cards.set(id, { button, position, status, graphic, patternIndex: null, drawing: null });
    }
    this.detail = element('section', 'pr-detail');
    this.detail.id = 'pattern-reader-detail';
    this.detail.hidden = true;
    this.detail.setAttribute('aria-label', 'Detalle de la figura en ejecución');
    const detailTop = element('div', 'pr-detail-top');
    this.detailTitle = element('strong');
    const close = element('button', 'pr-close', 'Cerrar');
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    detailTop.append(this.detailTitle, close);
    this.detailStatus = element('p', 'pr-detail-status');
    this.scroller = element('div', 'pr-scroll');
    this.scroller.tabIndex = 0;
    this.scroller.setAttribute('aria-label', 'Figura completa; desplazar horizontalmente para explorar');
    this.eventList = element('ol', 'pr-event-list');
    this.detail.append(detailTop, element('p', 'pr-help', 'Más arriba = más agudo · más largo = mayor duración · 1 pulso = negra. Las notas ligadas continúan sin un nuevo ataque. El resaltado sigue la ejecución; el volumen y los efectos pueden cambiar lo que se oye.'), this.detailStatus, this.scroller, this.eventList);
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
    for (const [key, card] of this.cards) card.button.setAttribute('aria-expanded', String(key === id));
    this.update();
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
    svg.setAttribute('aria-label', `Figura ${index + 1}: ${events.length} eventos rítmicos. ${events.map(noteName).join(', ')}`);
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

  paint(drawing, state) {
    if (!drawing) return;
    const live = state.running && state.phase === 'playing';
    for (const mark of drawing.marks) {
      const active = live && mark.index === state.eventIndex;
      mark.el.classList.toggle('pr-current', active);
      mark.el.classList.toggle('pr-attack', active && !mark.isRest && ['note', 'grace'].includes(state.kind));
    }
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
      card.position.textContent = `${index + 1}/${this.patrones.length}`;
      card.status.textContent = status;
      card.button.setAttribute('aria-label', `${this.instrumentos[id]._nombre || id}, figura ${index + 1}, ${status}. Ver lectura rítmica`);
      if (card.patternIndex !== index) {
        card.patternIndex = index;
        card.drawing = this.draw(index, false);
        card.graphic.replaceChildren(card.drawing.svg);
      }
      this.paint(card.drawing, state);
      if (this.selected !== id) continue;
      const key = `${id}:${index}`;
      if (this.detailKey !== key) {
        this.detailKey = key;
        this.detailTitle.textContent = `${this.instrumentos[id]._nombre || id} · figura ${index + 1} de ${this.patrones.length}`;
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
      const pending = Number.isInteger(state.pendingPatternIndex) && state.pendingPatternIndex !== index ? ` · siguiente figura: ${state.pendingPatternIndex + 1}` : '';
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
