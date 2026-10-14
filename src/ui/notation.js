// Treble clef: E4 is the bottom line. Alterations do not move noteheads.
export function staffY(note) {
  const [,letter,,octave] = /^([A-G])([#b]?)(-?\d+)$/.exec(note);
  const step = Number(octave)*7 + {C:0,D:1,E:2,F:3,G:4,A:5,B:6}[letter];
  return 92 - (step - 30)*5;
}

export function notationLayout(pattern, compiled) {
  let x = 62;
  const alterations = new Map();
  return compiled.events.map(event => {
    const source = pattern[event.sourceIndex];
    const grace = event.kind === 'grace';
    const denominator = grace ? 8 : Number(source.duracion?.match(/^\d+/)?.[0] || 4);
    const width = grace ? 38 : Math.max(62, Math.min(120, 56 + event.durationTicks / 192 * 12));
    const letter = event.note?.[0];
    const explicit = event.note?.includes('#') ? '♯' : event.note?.includes('b') ? '♭' : '';
    const accidental = explicit || (alterations.get(letter) ? '♮' : '');
    if (letter) alterations.set(letter, explicit);
    const item = { ...event, accidental, x, y: event.note ? staffY(event.note) : 70, width,
      denominator, dotted: !grace && source.duracion?.endsWith('.'), grace };
    x += width;
    return item;
  });
}
