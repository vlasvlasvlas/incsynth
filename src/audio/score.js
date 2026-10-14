// Visual collation against the user-supplied score, not publisher certification.
// Provenance, scope and interpretive choices: docs/in-c-fidelidad.md.
export const SCORE_STATUS = Object.freeze({
  verified: true,
  label: '53 figuras cotejadas con tu PDF · página 1',
});

export const GRACE_POLICY = Object.freeze({
  fraction: 1 / 8,
  description: 'Los adornos toman el primer octavo de la duración de su nota principal; no alargan la figura.',
});

export function noteMidi(note) {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(note ?? '');
  if (!match) throw new Error(`Nota inválida: ${note}`);
  const pitch = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]];
  const midi = (Number(match[3]) + 1) * 12 + pitch + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0);
  if (!Number.isSafeInteger(midi) || midi < 0 || midi > 127) throw new Error(`Nota fuera de rango: ${note}`);
  return midi;
}

export function noteName(note) {
  if (note === null) return 'Silencio';
  noteMidi(note);
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(note);
  return `${{ C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' }[match[1]]}${match[2] === '#' ? '♯' : match[2] === 'b' ? '♭' : ''}${match[3]}`;
}

export function eventBeats(event) {
  if (event.beats !== undefined) {
    const value = event.beats;
    if (!Array.isArray(value) || value.length !== 2 || !value.every(n => Number.isSafeInteger(n) && n > 0)) {
      throw new Error('beats debe ser una fracción positiva [numerador, denominador]');
    }
    if (event.duracion !== undefined) throw new Error('Usar beats o duracion, no ambas');
    return value[0] / value[1];
  }
  const match = /^(1|2|4|8|16|32|64)(n|t)(\.)?$/.exec(event.duracion ?? '');
  if (!match || (match[2] === 't' && match[3])) throw new Error(`Duración inválida: ${event.duracion}`);
  return 4 / Number(match[1]) * (match[2] === 't' ? 2 / 3 : match[3] ? 1.5 : 1);
}

// tieToNext means continuity, not another attack. grace is written separately
// from the principal note, with an explicitly chosen (not source-specified)
// performance policy. All ordinary durations must fit the transport exactly.
export function compilePattern(pattern, { ppq = 192, graceFraction = GRACE_POLICY.fraction } = {}) {
  if (!Array.isArray(pattern) || !pattern.length) throw new Error('Figura vacía');
  if (!Number.isSafeInteger(ppq) || ppq <= 0) throw new Error('Resolución rítmica inválida');
  if (!(graceFraction > 0 && graceFraction < 1)) throw new Error('Proporción de adorno inválida');
  const written = pattern.map((event, index) => {
    if (!event || typeof event !== 'object' || !('nota' in event)) throw new Error(`Evento ${index + 1} sin nota o silencio`);
    if (event.nota !== null) noteMidi(event.nota);
    const exactTicks = eventBeats(event) * ppq;
    if (!Number.isSafeInteger(exactTicks) || exactTicks <= 0) throw new Error(`Evento ${index + 1}: duración incompatible con la resolución`);
    if (event.tieToNext !== undefined && typeof event.tieToNext !== 'boolean') throw new Error('Ligadura inválida');
    const grace = event.grace ?? [];
    if (!Array.isArray(grace)) throw new Error('Adornos inválidos');
    if (grace.length && event.nota === null) throw new Error('Un silencio no puede tener adornos');
    for (const ornament of grace) {
      if (!ornament || Object.keys(ornament).some(key => key !== 'nota')) throw new Error('El adorno solo admite su nota escrita');
      noteMidi(ornament.nota);
    }
    return { note: event.nota, ticks: exactTicks, tie: event.tieToNext === true, grace };
  });
  for (const [index, event] of written.entries()) {
    if (!event.tie) continue;
    const next = written[index + 1];
    if (event.note === null || !next || next.note === null || noteMidi(event.note) !== noteMidi(next.note) || next.grace.length) {
      throw new Error(`Evento ${index + 1}: la ligadura requiere la misma altura siguiente, sin adornos`);
    }
  }
  const events = [];
  let onset = 0;
  const push = event => events.push({ index: events.length, ...event });
  written.forEach((event, sourceIndex) => {
    const graceTicks = event.grace.length ? Math.max(1, Math.floor(event.ticks * graceFraction / event.grace.length)) : 0;
    const stolen = graceTicks * event.grace.length;
    if (stolen >= event.ticks) throw new Error('Demasiados adornos para la duración principal');
    event.grace.forEach((ornament, i) => push({
      sourceIndex, note: ornament.nota, kind: 'grace', onsetTicks: onset + i * graceTicks,
      durationTicks: graceTicks, attackDurationTicks: graceTicks,
    }));
    const continuation = sourceIndex > 0 && written[sourceIndex - 1].tie;
    let attackDurationTicks = event.ticks - stolen;
    for (let i = sourceIndex; written[i].tie; i++) attackDurationTicks += written[i + 1].ticks;
    push({
      sourceIndex, note: event.note, kind: event.note === null ? 'rest' : continuation ? 'tie' : 'note',
      onsetTicks: onset + stolen, durationTicks: event.ticks - stolen,
      attackDurationTicks: event.note === null || continuation ? 0 : attackDurationTicks,
    });
    onset += event.ticks;
  });
  return { totalTicks: onset, events };
}
