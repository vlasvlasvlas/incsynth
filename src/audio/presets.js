// Presets de timbre para los instrumentos de In C
// Cada uno tiene carácter temporal diferente para complementarse

export const PRESETS = {

  // ─ Ataques lentos / sostenidos ─
  ARCO: {
    nombre: 'Arco (cuerdas)',
    desc:   'Ataque moderado, sostenido, cálido',
    roles:  ['pad'],
    tipo:   'AMSynth',
    config: {
      harmonicity: 2,
      oscillator:  { type: 'triangle' },
      envelope:    { attack: 0.18, decay: 0.1, sustain: 0.85, release: 2.5 },
      modulation:  { type: 'sine' },
      modulationEnvelope: { attack: 0.25, decay: 0.1, sustain: 0.8, release: 2 },
    },
    volume: -16,
  },

  PAD: {
    nombre: 'Pad (ambiente)',
    desc:   'Ataque suave, etéreo, sostenido largo',
    roles:  ['pad'],
    tipo:   'PolySynth',
    config: {
      oscillator: { type: 'triangle8' },
      envelope:   { attack: 0.32, decay: 0.2, sustain: 0.7, release: 4.0 },
    },
    volume: -18,
  },

  // ─ Ataques medios ─
  FLAUTA: {
    nombre: 'Flauta',
    desc:   'Ataque suave, legato sostenido, aéreo',
    roles:  ['pad', 'melodico'],
    tipo:   'Synth',
    config: {
      oscillator: { type: 'sine' },
      envelope:   { attack: 0.08, decay: 0.15, sustain: 0.75, release: 2.2 },
    },
    volume: -14,
  },

  ORGAN: {
    nombre: 'Órgano',
    desc:   'Sostenido, con armónicos ricos',
    roles:  ['pad'],
    tipo:   'PolySynth',
    config: {
      oscillator: { type: 'sawtooth' },
      envelope:   { attack: 0.06, decay: 0, sustain: 1, release: 0.3 },
    },
    volume: -20,
  },

  // ─ Ataques cortos / percusivos ─
  CAMPANA: {
    nombre: 'Campana / vibráfono',
    desc:   'Ataque inmediato, decaimiento lento',
    roles:  ['articulado'],
    tipo:   'FMSynth',
    config: {
      harmonicity:     5.1,
      modulationIndex: 14,
      oscillator:      { type: 'sine' },
      envelope:        { attack: 0.001, decay: 1.4, sustain: 0.0, release: 2.0 },
      modulation:      { type: 'sine' },
      modulationEnvelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 1 },
    },
    volume: -3,
  },

  PIZZ: {
    nombre: 'Pizzicato',
    desc:   'Punteo seco, muy corto',
    roles:  ['articulado'],
    tipo:   'FMSynth',
    config: {
      harmonicity:     2.5,
      modulationIndex: 5,
      oscillator:      { type: 'triangle' },
      envelope:        { attack: 0.001, decay: 0.25, sustain: 0.02, release: 0.4 },
      modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.2 },
    },
    volume: -13,
  },

  MADERA: {
    nombre: 'Madera / clave',
    desc:   'Percusivo tonal, seco',
    roles:  ['articulado'],
    tipo:   'MembraneSynth',
    config: {
      pitchDecay: 0.04,
      octaves:    2,
      envelope:   { attack: 0.001, decay: 0.2, sustain: 0, release: 0.3 },
    },
    volume: -12,
  },

  PULSO_FM: {
    nombre: 'Pulso FM',
    desc:   'Ataque electrónico corto, grave definido y armónicos sintéticos',
    roles:  ['articulado'],
    tipo:   'FMSynth',
    config: {
      harmonicity: 1.5,
      modulationIndex: 8,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.002, decay: 0.16, sustain: 0.03, release: 0.22 },
      modulation: { type: 'square' },
      modulationEnvelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.12 },
    },
    volume: -15,
  },

  METALICO: {
    nombre: 'Metálico',
    desc:   'Percusivo brillante, reverberante',
    roles:  ['articulado'],
    tipo:   'MembraneSynth',
    config: {
      pitchDecay: 0.12,
      octaves:    5,
      envelope:   { attack: 0.001, decay: 0.5, sustain: 0.01, release: 0.8 },
    },
    volume: -14,
  },

  // ─ Timbres especiales ─

  COSMOS: {
    nombre: 'Cosmos',
    desc:   'Drone espacial, lentísimo, alien',
    roles:  ['pad'],
    tipo:   'FMSynth',
    config: {
      harmonicity:     9,
      modulationIndex: 14,
      oscillator:      { type: 'sine' },
      envelope:        { attack: 1.8, decay: 0.8, sustain: 0.75, release: 5.0 },
      modulation:      { type: 'sine' },
      modulationEnvelope: { attack: 2.5, decay: 1.0, sustain: 0.5, release: 4.0 },
    },
    volume: -15,
  },

  SPACE_LADY: {
    nombre: 'Space Lady',
    desc:   'Casio puro, cristalino, sin adornos',
    roles:  ['melodico'],
    tipo:   'Synth',
    config: {
      oscillator: { type: 'triangle' },
      envelope:   { attack: 0.008, decay: 0.6, sustain: 0.35, release: 3.0 },
    },
    volume: -20,
  },

  // ─ Nuevos timbres para In C (basados en práctica de grabación) ─

  OBOE: {
    nombre: 'Oboe / viento melódico',
    desc:   'FM cálido, sostenido largo, apto para escucha de 45+ minutos',
    roles:  ['melodico'],
    tipo:   'FMSynth',
    config: {
      harmonicity:     1.8,
      modulationIndex: 2.5,
      oscillator:      { type: 'sine' },
      envelope:        { attack: 0.10, decay: 0.35, sustain: 0.70, release: 3.8 },
      modulation:      { type: 'sine' },
      modulationEnvelope: { attack: 0.12, decay: 0.30, sustain: 0.50, release: 3.0 },
    },
    volume: -16,
  },

  VIBRAFONO: {
    nombre: 'Vibráfono',
    desc:   'Percusivo tonal con ring suave — marimba / vibráfono de la grabación CBS 1968',
    roles:  ['articulado'],
    tipo:   'FMSynth',
    config: {
      harmonicity:     2,
      modulationIndex: 8,
      oscillator:      { type: 'triangle' },
      envelope:        { attack: 0.002, decay: 0.9, sustain: 0.04, release: 2.8 },
      modulation:      { type: 'sine' },
      modulationEnvelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 2.0 },
    },
    volume: -15,
  },

  MORODER: {
    nombre: 'Moroder',
    desc:   'Sawtooth driving, filtro sweep, electrónico',
    roles:  ['melodico'],
    tipo:   'AMSynth',
    config: {
      harmonicity: 2,
      oscillator:  { type: 'sawtooth' },
      envelope:    { attack: 0.004, decay: 0.18, sustain: 0.4, release: 0.35 },
      modulation:  { type: 'square' },
      modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.3 },
    },
    volume: -17,
  },

  THEREMIN: {
    nombre: 'Theremin',
    desc:   'Sine con vibrato suave, líquido',
    roles:  ['melodico'],
    tipo:   'FMSynth',
    config: {
      harmonicity:     1,
      modulationIndex: 0.4,
      oscillator:      { type: 'sine' },
      envelope:        { attack: 0.15, decay: 0, sustain: 1, release: 0.8 },
      modulation:      { type: 'sine' },
      modulationEnvelope: { attack: 0.3, decay: 0, sustain: 1, release: 0.5 },
    },
    volume: -14,
  },

  GAMELAN: {
    nombre: 'Gamelan',
    desc:   'Bronce percusivo, inarmónico, exótico',
    roles:  ['articulado'],
    tipo:   'FMSynth',
    config: {
      harmonicity:     3.01,
      modulationIndex: 20,
      oscillator:      { type: 'triangle' },
      envelope:        { attack: 0.001, decay: 1.8, sustain: 0.0, release: 3.0 },
      modulation:      { type: 'triangle' },
      modulationEnvelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 1.5 },
    },
    volume: -13,
  },

  VOCODER: {
    nombre: 'Vocoder / coral',
    desc:   'Ominoso, voces procesadas, denso',
    roles:  ['pad'],
    tipo:   'AMSynth',
    config: {
      harmonicity: 0.5,
      oscillator:  { type: 'triangle8' },
      envelope:    { attack: 0.22, decay: 0.1, sustain: 0.9, release: 2.0 },
      modulation:  { type: 'sine' },
      modulationEnvelope: { attack: 0.35, decay: 0.1, sustain: 0.7, release: 2.0 },
    },
    volume: -17,
  },

  VANGELIS: {
    nombre: 'Vangelis (Rhodes onírico)',
    desc:   'Rhodes metálico suave, largo sustain, ensueño — Apocalypse des Animaux',
    roles:  ['melodico'],
    tipo:   'FMSynth',
    config: {
      harmonicity:     2.01,
      modulationIndex: 3.2,
      oscillator: { type: 'sine' },
      envelope: {
        attack:  0.04,
        decay:   1.2,
        sustain: 0.45,
        release: 4.8,
      },
      modulation: { type: 'triangle' },
      modulationEnvelope: {
        attack:  0.08,
        decay:   0.9,
        sustain: 0.25,
        release: 3.5,
      },
    },
    volume: -14,
  },
};

export const DEFAULTS = {
  cuerdas:   'ARCO',
  percusion: 'VANGELIS',
  melodia:   'OBOE',
  mallets:   'GAMELAN',
};
