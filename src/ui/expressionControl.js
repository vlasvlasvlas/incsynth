import { PRESETS } from '../audio/presets.js';

export function buildExpressionCard(expression, instruments, getEngine) {
  const settings = expression.settings;
  const card = document.createElement('section');
  card.className = 'sonido-card expression-card';
  const title = document.createElement('h3');
  title.textContent = 'RESPIRACIÓN Y RECORRIDO';
  card.append(title);
  const status = document.createElement('p');
  status.className = 'expression-status';
  card.append(status);
  const note = document.createElement('p');
  note.className = 'expression-note';
  note.textContent = 'Las voces conservan su identidad, descansan por frases y se relevan. Los timbres cambian al terminar una figura; no se saltan patrones.';
  card.append(note);

  function row(label, input) {
    const el = document.createElement('label');
    el.className = 'expression-control';
    const text = document.createElement('span');
    text.textContent = label;
    el.append(text, input);
    card.append(el);
    return input;
  }
  function toggle(label, key) {
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = settings[key];
    input.addEventListener('change', () => { settings[key] = input.checked; });
    row(label, input);
  }
  function select(label, key, options) {
    const input = document.createElement('select'); input.className = 'lente-sel';
    options.forEach(([value, name]) => input.add(new Option(name, value)));
    input.value = settings[key];
    input.addEventListener('change', () => {
      settings[key] = input.value;
      if (key === 'timbres') expression.ids.forEach(id => expression.resumeAutomatic(id));
    });
    return row(label, input);
  }
  function number(label, key, min, max, step = 1) {
    const input = document.createElement('input');
    input.type = 'number'; input.min = min; input.max = max; input.step = step; input.value = settings[key];
    input.addEventListener('change', () => {
      const value = Number(input.value);
      settings[key] = Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : settings[key];
      input.value = settings[key];
    });
    return row(label, input);
  }
  toggle('Evolución expresiva', 'enabled');
  const amount = document.createElement('input');
  amount.type = 'range'; amount.min = 0; amount.max = 1; amount.step = 0.05; amount.value = settings.amount;
  amount.addEventListener('input', () => { settings.amount = Number(amount.value); });
  row('Profundidad del gesto', amount);
  toggle('Descansos de frases y reentradas', 'breaths');
  toggle('Relevos del pulso y bombo', 'pulse');
  toggle('Espacio según ocupación', 'space');
  toggle('Recuperación por exposición', 'exposure');
  select('Cambios de timbre', 'timbres', [['fijo', 'Conservar timbres'], ['tramos', 'Por tramos de patrones'], ['azar', 'Aleatorios espaciados'], ['mixto', 'Tramos + aleatorios']]);
  number('Permanencia mínima de timbre (s)', 'dwell', 30, 900);
  number('Espera aleatoria media (min)', 'randomMinutes', 1, 30);
  select('Al llegar todos al patrón 53', 'ending', [['coda', 'Coda y final'], ['loop', 'Coda, reposo y nuevo ciclo']]);
  number('Duración de coda (s)', 'codaSeconds', 15, 120);
  number('Reposo entre ciclos (s)', 'intermissionSeconds', 5, 180);

  const voices = document.createElement('div'); voices.className = 'expression-voices'; card.append(voices);
  const voiceRows = {};
  expression.ids.forEach(id => {
    const label = document.createElement('label'); label.className = 'expression-voice';
    const auto = document.createElement('input'); auto.type = 'checkbox'; auto.checked = instruments[id]._autoTimbre !== false;
    auto.addEventListener('change', () => {
      instruments[id]._autoTimbre = auto.checked;
      if (auto.checked) expression.resumeAutomatic(id);
    });
    const text = document.createElement('span');
    label.append(auto, text); voices.append(label); voiceRows[id] = { auto, text };
  });
  const details = document.createElement('details');
  const summary = document.createElement('summary'); summary.textContent = 'Configurar tramos y paletas'; details.append(summary);
  const help = document.createElement('p'); help.className = 'expression-note';
  help.textContent = 'Cada voz cambia al entrar en su tramo. La forma general sigue el avance medio. El azar elige entre los timbres configurados para esa voz. La permanencia mínima puede demorar un cambio.';
  details.append(help);
  settings.stages.forEach((stage, i) => {
    const field = document.createElement('fieldset');
    const legend = document.createElement('legend'); legend.textContent = stage.name; field.append(legend);
    const label = document.createElement('label'); label.textContent = 'Desde patrón ';
    const start = document.createElement('input'); start.type = 'number'; start.min = 1; start.max = 53; start.value = stage.from; start.disabled = i === 0;
    start.setAttribute('aria-label', `${stage.name}: patrón inicial`);
    start.addEventListener('change', () => {
      const lo = (settings.stages[i - 1]?.from ?? 0) + 1;
      const hi = (settings.stages[i + 1]?.from ?? 54) - 1;
      stage.from = Math.max(lo, Math.min(hi, Math.round(Number(start.value) || stage.from)));
      start.value = stage.from;
      expression.ids.forEach(id => expression.resumeAutomatic(id));
    });
    label.append(start); field.append(label);
    expression.ids.forEach((id, voiceIndex) => {
      const voiceLabel = document.createElement('label'); voiceLabel.textContent = instruments[id]._nombre || id;
      const preset = document.createElement('select'); preset.className = 'lente-sel';
      Object.entries(PRESETS).forEach(([key, value]) => preset.add(new Option(value.nombre, key)));
      preset.value = stage.presets[voiceIndex];
      preset.addEventListener('change', () => {
        stage.presets[voiceIndex] = preset.value;
        expression.resumeAutomatic(id);
      });
      voiceLabel.append(preset); field.append(voiceLabel);
    });
    details.append(field);
  });
  card.append(details);
  return { card, update() {
    const s = expression.snapshot;
    status.textContent = `${getEngine()?._running ? s.stage : expression.ended ? 'Interpretación finalizada' : 'Preparado'} · ${Math.floor(expression.elapsed / 60)} min`;
    for (const id of expression.ids) {
      const inst = instruments[id]; const v = s.voices[id]; const line = voiceRows[id];
      line.auto.checked = inst._autoTimbre !== false;
      line.text.textContent = `${inst._nombre || id} · ${v?.state || 'Presencia'} · ${PRESETS[inst._presetKey]?.nombre || inst._presetKey}${v?.foreground ? ' · primer plano' : ''} · ${line.auto.checked ? 'timbre automático' : 'timbre manual'}`;
    }
  } };
}
