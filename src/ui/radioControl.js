import { RADIO_STREAMS } from '../data/radioStreams.js';
import { RadioPlayer } from '../audio/RadioPlayer.js';
import { radioInput } from '../audio/audioMaster.js';

export function buildRadioCard() {
  const card = document.createElement('section');
  card.className = 'lente-card radio-card';
  card.innerHTML = `
    <div class="radio-heading"><h3>Voces de LATAM</h3><span class="radio-live">RADIO EN VIVO</span></div>
    <p class="radio-description">Una voz del continente se suma a la música.</p>
    <div class="radio-actions">
      <button type="button" class="lente-btn radio-play">▶ Play</button>
      <button type="button" class="lente-btn radio-next">⟳ Random</button>
      <span class="radio-status" role="status" aria-live="polite">Lista para escuchar</span>
    </div>
    <div class="radio-controls"></div>`;
  const play = card.querySelector('.radio-play');
  const next = card.querySelector('.radio-next');
  const status = card.querySelector('.radio-status');
  let active = false;
  const player = new RadioPlayer(RADIO_STREAMS, ({ state, station, message }) => {
    active = state === 'playing' || state === 'loading';
    play.textContent = active ? '■ Stop' : '▶ Play';
    play.classList.toggle('active', active);
    play.setAttribute('aria-pressed', String(active));
    status.textContent = station
      ? `${state === 'loading' ? 'Conectando · ' : ''}${station.nombre} · ${station.pais}`
      : message || 'Lista para escuchar';
  }, { masterNode: radioInput() });
  play.setAttribute('aria-pressed', 'false');
  play.addEventListener('click', () => active ? player.stop() : player.start());
  next.addEventListener('click', () => player.start({ random: true }));
  const controls = card.querySelector('.radio-controls');
  const hz = value => value >= 1000 ? `${+(value / 1000).toFixed(1)} kHz` : `${value} Hz`;
  function control(key, title, min, max, step, format) {
    const label = document.createElement('label');
    label.className = 'radio-control';
    const name = document.createElement('span'); name.textContent = title;
    const input = document.createElement('input');
    input.type = 'range'; input.min = min; input.max = max; input.step = step;
    input.value = player.settings[key]; input.setAttribute('aria-label', title);
    const output = document.createElement('output');
    const update = () => {
      const value = Number(input.value);
      output.textContent = format(value);
      input.setAttribute('aria-valuetext', output.textContent);
      player.set(key, value);
    };
    input.addEventListener('input', update); update();
    label.append(name, input, output); controls.append(label);
  }
  const filter = document.createElement('div');
  filter.className = 'radio-filter radio-control';
  filter.innerHTML = `<span>Filtro · pasaaltos / pasabajos</span><output></output>
    <div class="radio-filter-track"><button type="button" class="radio-filter-band" aria-label="Mover ambos filtros" title="Arrastrá para mover ambos filtros; también podés usar las flechas"></button>
      <input type="range" min="0" max="1000" step="1" aria-label="Pasaaltos">
      <input type="range" min="0" max="1000" step="1" aria-label="Pasabajos">
    </div>`;
  const [high, low] = filter.querySelectorAll('input');
  const output = filter.querySelector('output');
  const band = filter.querySelector('.radio-filter-band');
  const track = filter.querySelector('.radio-filter-track');
  // Logarithmic frequency scale: bass and treble remain equally easy to adjust.
  const toPosition = hz => Math.log(hz / 20) / Math.log(1000) * 1000;
  const toHz = position => Math.round(20 * 1000 ** (position / 1000));
  high.value = toPosition(player.settings.highpass);
  low.value = toPosition(player.settings.lowpass);
  function updateFilter(changed) {
    if (+high.value >= +low.value) {
      if (changed === high) high.value = +low.value - 1;
      else low.value = +high.value + 1;
    }
    const hp = toHz(+high.value), lp = toHz(+low.value);
    player.set('highpass', hp); player.set('lowpass', lp);
    high.setAttribute('aria-valuetext', hz(hp)); low.setAttribute('aria-valuetext', hz(lp));
    output.textContent = `${hz(hp)} — ${hz(lp)}`;
    filter.style.setProperty('--filter-low', `${+high.value / 10}%`);
    filter.style.setProperty('--filter-high', `${+low.value / 10}%`);
  }
  high.addEventListener('input', () => updateFilter(high));
  low.addEventListener('input', () => updateFilter(low));
  function moveBand(startHigh, startLow, delta) {
    const shift = Math.max(-startHigh, Math.min(1000 - startLow, Math.round(delta)));
    high.value = startHigh + shift;
    low.value = startLow + shift;
    updateFilter();
  }
  let drag = null;
  band.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    const width = track.getBoundingClientRect().width;
    if (!width) return;
    event.preventDefault();
    band.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, high: +high.value, low: +low.value, width };
    band.setPointerCapture(event.pointerId);
    band.classList.add('dragging');
  });
  band.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    moveBand(drag.high, drag.low, (event.clientX - drag.x) / drag.width * 1000);
  });
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    band.classList.remove('dragging');
    if (band.hasPointerCapture(event.pointerId)) band.releasePointerCapture(event.pointerId);
  }
  band.addEventListener('pointerup', finishDrag);
  band.addEventListener('pointercancel', finishDrag);
  band.addEventListener('lostpointercapture', finishDrag);
  band.addEventListener('keydown', event => {
    const direction = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    moveBand(+high.value, +low.value, direction * (event.shiftKey ? 50 : 10));
  });
  updateFilter(); controls.append(filter);
  control('volume', 'VOL', 0, 1, 0.01, v => v === 0 ? '0% · silencio' : `${Math.round(v * 100)}%`);
  control('delay', 'Eco / delay', 0, 4, 0.01, v => v ? `${Math.round(v * 1000)} ms` : 'Sin eco');
  window.addEventListener('pagehide', () => player.stop());
  return card;
}
