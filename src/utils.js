// Utilidades compartidas — In C / Mundo Real

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function round2(v) {
  return Math.round(v * 100) / 100;
}

export function signedPct(v) {
  const n = Math.round(Math.max(-1, Math.min(1, v || 0)) * 100);
  return `${n >= 0 ? '+' : ''}${n}%`;
}

export function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
