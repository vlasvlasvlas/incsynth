import { noteName as scoreNoteName } from '../audio/score.js';

// Texto que ve el usuario en la tarjeta de cada canal, por fase del motor.
// Reemplaza el "—" ciego previo (que significaba 5 cosas distintas) por
// vocabulario humano honesto en español rioplatense.
const LABELS = {
  waiting:   'Escuchando',
  resting:   'Respirando',
  suspended: 'Audio en pausa',
  ended:     'Finalizado',
  stopped:   'Detenido',
};

export function formatCardStatus(state) {
  if (state.running && state.phase === 'playing') {
    if (state.note) {
      const suffix = state.kind === 'tie' ? ' · ligada'
                   : state.kind === 'grace' ? ' · adorno'
                   : '';
      return { current: scoreNoteName(state.note) + suffix, kind: state.kind || 'note' };
    }
    return { current: 'Silencio', kind: 'rest' };
  }
  const label = LABELS[state.phase];
  if (label) return { current: label, kind: state.phase };
  return { current: '—', kind: 'unknown' };
}
