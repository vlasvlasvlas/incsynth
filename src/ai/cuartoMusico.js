/**
 * Cuarto Músico — Controlador de IA para In C / Mundo Real
 *
 * Gestiona el dial de influencia (0–100%) y coordina todos los sub-modelos.
 * Cada capa se activa progresivamente según el dial:
 *
 *   > 10%  → VAE de timbre
 *   > 30%  → LSTM de estilo (aprendizaje online)
 *   > 50%  → GNN social (presión de grafo)
 *   Toggle → YAMNet (escucha ambiente, independiente del dial)
 *   > 80%  → RAVE audio (futuro)
 *   = 100% → MARL agentes (futuro)
 */

import * as vae    from './vaeTimbre.js';
import * as lstm   from './lstmEstilo.js';
import * as gnn    from './gnnSocial.js';
import * as yamnet from './yamnet.js';
import * as logger from './sessionLogger.js';

let _alpha       = 0;
let _ready       = false;
let _listeners   = new Set();
let _instrumentos = null;
let _sala        = null;
let _instIds     = [];
let _lstmPromise = null;

// ── Inicialización ────────────────────────────────────────────────────────────

export async function init() {
  const ok = await vae.cargarPesos();
  _ready = ok;
  if (ok) console.log('[Cuarto Músico] VAE timbre listo.');
  else    console.warn('[Cuarto Músico] VAE no disponible — modo reglas puro.');
  return ok;
}

export function isReady() { return _ready; }

export function configurarContexto(instrumentos, sala) {
  _instrumentos = instrumentos || null;
  _sala         = sala        || null;
  _instIds      = Object.keys(_instrumentos || {});
  lstm.configurar(_instIds);
  if (_alpha > 0.3) _ensureLSTM();
  _emit();
}

// ── Control del dial ──────────────────────────────────────────────────────────

export function getAlpha() { return _alpha; }

export function setAlpha(v) {
  _alpha = Math.max(0, Math.min(1, Number(v) || 0));
  if (_alpha > 0.3) _ensureLSTM();
  logger.actualizarMeta({ alpha: _alpha });
  _emit();
}

// ── VAE Timbre ────────────────────────────────────────────────────────────────

export function getTimbreIA(instrumento, sala) {
  if (!_ready || _alpha < 0.1 || !vae.isReady()) return null;
  const params = vae.inferirTimbre(instrumento, sala);
  if (!params) return null;
  const influence     = Math.min(1, (_alpha - 0.1) / 0.9);
  params._influence   = influence;
  params._oscName     = vae.oscTypeToName(params.oscType);
  params._z           = vae.estadoALatente(instrumento, sala);
  return params;
}

export function aplicarTimbre(synth, filtro, vaeParams, presetParams) {
  if (!vaeParams || !synth) return;
  const t    = vaeParams._influence;
  const lerp = (a, b) => a + (b - a) * t;
  try {
    synth.set({ envelope: {
      attack:  lerp(presetParams.attack  ?? 0.1, vaeParams.attack),
      decay:   lerp(presetParams.decay   ?? 0.5, vaeParams.decay),
      sustain: lerp(presetParams.sustain ?? 0.5, vaeParams.sustain),
      release: lerp(presetParams.release ?? 1.0, vaeParams.release),
    }});
  } catch (_) {}
  try {
    filtro.frequency.rampTo(lerp(presetParams.filterCut ?? 4000, vaeParams.filterCut), 0.5);
  } catch (_) {}
  try {
    synth.set({
      harmonicity:     lerp(presetParams.harmonicity ?? 1, vaeParams.harmonicity),
      modulationIndex: lerp(presetParams.modIndex    ?? 5, vaeParams.modIndex),
    });
  } catch (_) {}
  try {
    if (t > 0.5 && vaeParams._oscName) {
      synth.set({ oscillator: { type: vaeParams._oscName } });
    } else if (presetParams.oscillatorType) {
      synth.set({ oscillator: { type: presetParams.oscillatorType } });
    }
  } catch (_) {}
}

export function restaurarTimbre(synth, filtro, presetParams) {
  if (!synth || !presetParams) return;
  try { synth.set({ envelope: { attack: presetParams.attack ?? 0.1, decay: presetParams.decay ?? 0.5, sustain: presetParams.sustain ?? 0.5, release: presetParams.release ?? 1.0 } }); } catch (_) {}
  try { if (presetParams.oscillatorType) synth.set({ oscillator: { type: presetParams.oscillatorType } }); } catch (_) {}
  try { synth.set({ harmonicity: presetParams.harmonicity ?? 1, modulationIndex: presetParams.modIndex ?? 5 }); } catch (_) {}
  try { filtro?.frequency?.rampTo?.(presetParams.filterCut ?? 4000, 0.4); } catch (_) {}
}

// ── LSTM Estilo ───────────────────────────────────────────────────────────────

export function registrarCiclo(id, instrumento, sala, avanzo) {
  lstm.registrarCiclo(id, instrumento, sala || _sala, avanzo);

  // Logger: capturar estado completo
  if (logger.isActivo()) {
    const lstmStats = _getLSTMStats(id);
    const gnnData   = _getGNNData(id);
    const vaeData   = vae.isReady() ? _getVAEData(instrumento, sala || _sala) : null;
    const yamData   = yamnet.isActive() ? yamnet.getEstado() : null;
    logger.registrarCiclo(id, instrumento, sala || _sala, avanzo, {
      vae:    vaeData,
      lstm:   lstmStats,
      gnn:    gnnData,
      yamnet: yamData,
    });
  }
}

export function getDecisionIA(instrumento, sala) {
  if (_alpha <= 0.3 || !lstm.isReady()) {
    if (_alpha > 0.3) _ensureLSTM();
    return null;
  }
  const influence = Math.min(1, (_alpha - 0.3) / 0.7);
  return lstm.calcularModulacion(instrumento, sala || _sala, _instrumentos, influence);
}

// ── GNN Social ────────────────────────────────────────────────────────────────

export function getPresionGNN(instrumento, sala) {
  if (_alpha <= 0.5 || !instrumento) return null;
  const influence = Math.min(1, (_alpha - 0.5) / 0.5);
  return gnn.getPresionSocial(instrumento, _instIds, _instrumentos, sala || _sala, influence);
}

// ── YAMNet ────────────────────────────────────────────────────────────────────

export async function activarYamnet() {
  return yamnet.activar();
}

export function desactivarYamnet() {
  yamnet.desactivar();
  _emit();
}

export function getDeltaYamnet() {
  if (!yamnet.isActive()) return 0;
  return yamnet.getDeltaAvance(1);
}

// ── Session Logger ────────────────────────────────────────────────────────────

export function iniciarSesion(meta = {}) {
  logger.iniciarSesion({ ...meta, alpha: _alpha });
}

export function cerrarYDescargar() {
  logger.cerrarSesion();
  logger.descargar();
}

export function getLoggerResumen() {
  return logger.getResumen();
}

// ── Estado global ─────────────────────────────────────────────────────────────

export function getEstado() {
  return {
    alpha:    _alpha,
    ready:    _ready,
    vaeReady: vae.isReady(),
    lstm:     lstm.getResumen(),
    gnn: {
      activo:  _alpha > 0.5,
      instIds: _instIds,
    },
    yamnet:   yamnet.getEstado(),
    logger:   logger.getResumen(),
  };
}

export function subscribe(fn) {
  _listeners.add(fn);
  fn(getEstado());
  return () => _listeners.delete(fn);
}

// ── RAVE — z-vectors para corpus ──────────────────────────────────────────────

export function getZVectors() {
  if (!_ready || !vae.isReady() || !_instrumentos) return {};
  const out = {};
  for (const [id, inst] of Object.entries(_instrumentos)) {
    if (!inst) continue;
    const z = vae.estadoALatente(inst, _sala);
    if (z) out[id] = Array.from(z).map(v => Math.round(v * 100) / 100);
  }
  return out;
}

// ── Internos ──────────────────────────────────────────────────────────────────

function _emit() {
  const s = getEstado();
  for (const fn of _listeners) fn(s);
}

function _ensureLSTM() {
  if (_lstmPromise || lstm.isReady()) return _lstmPromise;
  _lstmPromise = lstm.init(_instIds).then(ok => { _emit(); return ok; });
  _emit();
  return _lstmPromise;
}

function _getLSTMStats(id) {
  const resumen = lstm.getResumen();
  const item    = resumen.items?.find(i => i.id === id);
  return item ? { prediction: item.prediction, surprise: item.surprise, confidence: item.confidence } : null;
}

function _getGNNData(id) {
  if (_alpha <= 0.5 || !_instrumentos) return null;
  const res = gnn.calcularPresionSocial(_instIds, _instrumentos, _sala, 1);
  if (!res) return null;
  const detalle = res.detalles?.find(d => d.id === id);
  return detalle ? { pressure: detalle.pressure, delta: detalle.delta } : null;
}

function _getVAEData(instrumento, sala) {
  if (!vae.isReady()) return null;
  const params = vae.inferirTimbre(instrumento, sala);
  if (!params) return null;
  const z = Array.from(vae.estadoALatente(instrumento, sala));
  return { ...params, z };
}
