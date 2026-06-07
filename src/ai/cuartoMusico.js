/**
 * Cuarto Músico — Controlador de IA para In C / Mundo Real
 * 
 * Gestiona el dial de influencia de IA (0–100%) y coordina los
 * sub-modelos disponibles. Cada sub-modelo se activa/desactiva
 * según el nivel del dial.
 * 
 * Niveles:
 *   > 10%  → VAE de timbre (el sonido muta con el contexto)
 *   > 30%  → LSTM de estilo (futuro)
 *   > 50%  → GNN social (futuro)
 *   > 80%  → RAVE audio (futuro)
 *   = 100% → MARL agentes (futuro)
 */

import * as vae from './vaeTimbre.js';

let _alpha = 0;   // 0.0 – 1.0
let _ready = false;
let _listeners = new Set();

// ── Inicialización ──

export async function init() {
  const ok = await vae.cargarPesos();
  _ready = ok;
  if (ok) console.log('[Cuarto Músico] Inicializado. VAE timbre listo.');
  else console.warn('[Cuarto Músico] VAE no disponible — modo reglas puro.');
  return ok;
}

export function isReady() { return _ready; }

// ── Control del dial ──

export function getAlpha() { return _alpha; }

export function setAlpha(v) {
  _alpha = Math.max(0, Math.min(1, Number(v) || 0));
  _emit();
}

// ── VAE Timbre ──

/**
 * Si el dial está por encima del umbral de VAE (10%), produce
 * parámetros de síntesis modulados por el estado del instrumento.
 * Si no, retorna null (el sistema usa presets fijos).
 * 
 * @param {Object} instrumento - Instancia de Instrumento.js
 * @param {Object} sala - Instancia de LaSala.js
 * @returns {Object|null} Parámetros de síntesis o null
 */
export function getTimbreIA(instrumento, sala) {
  if (!_ready || _alpha < 0.1) return null;
  if (!vae.isReady()) return null;

  const params = vae.inferirTimbre(instrumento, sala);
  if (!params) return null;

  // La influencia escala con alpha: a 10% apenas toca, a 100% domina
  const influence = Math.min(1, (_alpha - 0.1) / 0.9);
  params._influence = influence;
  params._oscName = vae.oscTypeToName(params.oscType);

  return params;
}

/**
 * Aplica los parámetros del VAE a un sintetizador Tone.js,
 * mezclando suavemente entre el preset original y el VAE.
 * 
 * @param {Object} synth - Sintetizador Tone.js
 * @param {Object} filtro - Filtro Tone.js
 * @param {Object} vaeParams - Resultado de getTimbreIA()
 * @param {Object} presetParams - Parámetros originales del preset
 */
export function aplicarTimbre(synth, filtro, vaeParams, presetParams) {
  if (!vaeParams || !synth) return;

  const t = vaeParams._influence;  // 0–1 blend
  const lerp = (a, b) => a + (b - a) * t;

  // Envolvente
  try {
    const env = {
      attack:  lerp(presetParams.attack  ?? 0.1, vaeParams.attack),
      decay:   lerp(presetParams.decay   ?? 0.5, vaeParams.decay),
      sustain: lerp(presetParams.sustain ?? 0.5, vaeParams.sustain),
      release: lerp(presetParams.release ?? 1.0, vaeParams.release),
    };
    synth.set({ envelope: env });
  } catch (_) {}

  // Filtro
  try {
    const presetCut = presetParams.filterCut ?? 4000;
    const targetCut = lerp(presetCut, vaeParams.filterCut);
    filtro.frequency.rampTo(targetCut, 0.5);
  } catch (_) {}

  // Modulación FM (si el synth lo soporta)
  try {
    const presetHarm = presetParams.harmonicity ?? 1;
    const presetMod = presetParams.modIndex ?? 5;
    
    synth.set({
      harmonicity: lerp(presetHarm, vaeParams.harmonicity),
      modulationIndex: lerp(presetMod, vaeParams.modIndex)
    });
  } catch (_) {}

  // Tipo de oscilador (cambia discretamente si la influencia es mayor a 50%)
  try {
    if (t > 0.5 && vaeParams._oscName) {
      synth.set({ oscillator: { type: vaeParams._oscName } });
    }
  } catch (_) {}
}

// ── Listeners ──

export function subscribe(fn) {
  _listeners.add(fn);
  fn({ alpha: _alpha, ready: _ready });
  return () => _listeners.delete(fn);
}

function _emit() {
  const state = { alpha: _alpha, ready: _ready };
  for (const fn of _listeners) fn(state);
}
