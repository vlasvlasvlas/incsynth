/**
 * Fase 3 — GNN Social (Micro Graph Neural Network)
 *
 * Con 3 nodos (músicos) y 3 aristas (pares), implementa message-passing
 * en JS puro. No necesita framework. Produce una "presión social" por nodo
 * que modula la probabilidad de avance.
 *
 * Arquitectura:
 *   features [3][5] → message-passing → ReLU → readout → sigmoid → presión [3]
 *
 * Activa con alpha > 0.50.
 */

import { clamp, round2 } from '../utils.js';

const FEATURE_DIM = 5;
const HIDDEN_DIM  = 4;
const MAX_DELTA   = 0.18;  // calibrado desde sesiones 17-32/17-52: delta era ~0.006, necesita ~0.08+

// W_MSG [HIDDEN_DIM][FEATURE_DIM] — transforma diferencia relativa f_j - f_i
// sin cambios: producen mensajes correctos pero pequeños cuando posiciones son cercanas
const W_MSG = [
  [ 0.80,  0.10,  0.25,  0.45,  0.50],
  [-0.55,  0.05, -0.15, -0.30, -0.40],
  [ 0.30,  0.35,  0.40,  0.30,  0.20],
  [-0.20,  0.00,  0.10,  0.20,  0.35],
];
// W_OUT amplificado 2.5× para compensar dot products pequeños cuando músicos van juntos.
// Efecto: 10 patrones de diferencia → delta ~0.05; 30 patrones → delta ~0.14
const W_OUT = [1.50, -1.00, 1.25, 0.75];

const ESTADO_CODE = {
  DORMIDO: 0.00, ARMADO: 0.16, SONANDO: 0.34,
  RETENIDO: 0.52, DESCANSANDO: 0.68, DESBORDADO: 0.84, PERIFERICO: 1.00,
};

// ── Math helpers ──────────────────────────────────────────────────────────────

function matVec(M, v) {
  return M.map(row => row.reduce((s, w, j) => s + w * v[j], 0));
}

function relu(v) {
  return v.map(x => Math.max(0, x));
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function dot(a, b) {
  return a.reduce((s, x, i) => s + x * b[i], 0);
}

function sub(a, b) {
  return a.map((x, i) => x - b[i]);
}

// ── Feature extraction ────────────────────────────────────────────────────────

function extraerFeatures(instrumento, sala) {
  const ui  = instrumento?.getEstadoUI?.() || {};
  const num = sala?.numPatrones || 53;
  return [
    clamp((instrumento?.posicion ?? 0) / Math.max(1, num - 1), 0, 1),
    ESTADO_CODE[ui.estado] ?? 0.34,
    clamp(ui.señal ?? 0, 0, 1),
    clamp((ui.verbos?.AVANZA ?? 0), 0, 1),
    clamp((ui.verbos?.RETIENE ?? 0), 0, 1),
  ];
}

// ── Forward pass ──────────────────────────────────────────────────────────────

/**
 * @param {number[][]} features — [nNodes][FEATURE_DIM]
 * @returns {number[]} pressure — [nNodes] ∈ [0,1]
 */
function gnnForward(features) {
  const n = features.length;
  return features.map((fi, i) => {
    // Agregar mensajes de todos los vecinos
    const agg = new Array(HIDDEN_DIM).fill(0);
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const delta = sub(features[j], fi);
      const msg   = relu(matVec(W_MSG, delta));
      for (let k = 0; k < HIDDEN_DIM; k++) agg[k] += msg[k];
    }
    return sigmoid(dot(W_OUT, agg));
  });
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Calcula la presión social de cada instrumento.
 *
 * @param {string[]} ids
 * @param {Object}   instrumentos
 * @param {Object}   sala
 * @param {number}   influence — 0-1 según alpha
 * @returns {Object}  { presiones: { id → delta }, detalles: [...] }
 */
export function calcularPresionSocial(ids, instrumentos, sala, influence = 1) {
  if (!ids?.length || !instrumentos) return null;

  const activos = ids.filter(id => instrumentos[id]);
  if (activos.length < 2) return null;

  const features  = activos.map(id => extraerFeatures(instrumentos[id], sala));
  const presiones = gnnForward(features);

  const result = {};
  const detalles = [];

  activos.forEach((id, i) => {
    const pressure = presiones[i];
    // Mapear [0,1] → delta centrado en 0
    const raw   = (pressure - 0.5) * MAX_DELTA * 2;
    const delta = clamp(raw * influence, -MAX_DELTA, MAX_DELTA);
    result[id]  = Math.abs(delta) < 0.003 ? 0 : delta;
    detalles.push({ id, pressure: round2(pressure), delta: round2(result[id]) });
  });

  return { presiones: result, detalles };
}

/**
 * Devuelve la presión social para un instrumento específico.
 * Retorna null si no hay suficientes datos o influencia es nula.
 */
export function getPresionSocial(instrumento, ids, instrumentos, sala, influence = 1) {
  if (!instrumento || influence <= 0) return null;
  const res = calcularPresionSocial(ids, instrumentos, sala, influence);
  if (!res) return null;
  const delta = res.presiones[instrumento.id] ?? 0;
  if (delta === 0) return null;
  const detalle = res.detalles.find(d => d.id === instrumento.id);
  return {
    delta,
    pressure: detalle?.pressure ?? 0.5,
    motivo: delta > 0 ? 'la sala empuja hacia el grupo' : 'la sala pide separación',
  };
}
