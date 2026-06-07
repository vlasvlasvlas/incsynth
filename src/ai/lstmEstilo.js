/**
 * Fase 2 — LSTM de estilo temporal
 *
 * Cada musico mantiene una ventana de ciclos recientes y entrena en vivo
 * un predictor binario: "en el proximo ciclo, este musico avanza o repite".
 * La sorpresa es el error entre prediccion y accion real.
 */

import { clamp, lerp, round2 } from '../utils.js';

const SEQ_LEN = 20;
const FEATURE_DIM = 9;
const LSTM_UNITS = 16;
const HISTORY_MAX = 80;

let _tf = null;
let _ready = false;
let _loading = false;
let _loadPromise = null;
let _instrumentIds = [];

const _models = new Map();
const _histories = new Map();
const _stats = new Map();
const _training = new Set();

const ESTADO_CODE = {
  DORMIDO: 0.00,
  ARMADO: 0.16,
  SONANDO: 0.34,
  RETENIDO: 0.52,
  DESCANSANDO: 0.68,
  DESBORDADO: 0.84,
  PERIFERICO: 1.00,
};

export function configurar(instrumentIds = []) {
  _instrumentIds = [...instrumentIds];
  for (const id of _instrumentIds) {
    ensureState(id);
    if (_ready && !_models.has(id)) _models.set(id, crearModelo());
  }
}

export async function init(instrumentIds = _instrumentIds) {
  configurar(instrumentIds);
  if (_ready) return true;
  if (_loadPromise) return _loadPromise;

  _loading = true;
  _loadPromise = import('@tensorflow/tfjs').then(tf => {
    _tf = tf;
    for (const id of _instrumentIds) {
      if (!_models.has(id)) _models.set(id, crearModelo());
    }
    _ready = true;
    _loading = false;
    console.log('[LSTM Estilo] Inicializado. Aprendizaje online listo.');
    return true;
  }).catch(err => {
    _loading = false;
    console.warn('[LSTM Estilo] No se pudo inicializar:', err.message);
    return false;
  });

  return _loadPromise;
}

export function isReady() {
  return _ready;
}

export function isLoading() {
  return _loading;
}

export function registrarCiclo(id, instrumento, sala, avanzo) {
  const state = ensureState(id);
  const history = _histories.get(id);
  const label = avanzo ? 1 : 0;

  if (_ready && history.length >= SEQ_LEN) {
    const sequence = history.slice(-SEQ_LEN);
    const prediction = predecirSecuencia(id, sequence);
    if (prediction !== null) {
      const surprise = Math.abs(label - prediction);
      state.lastPrediction = prediction;
      state.lastSurprise = surprise;
      state.avgSurprise = lerp(state.avgSurprise, surprise, 0.12);
      state.confidence = clamp(state.trainedSamples / 120, 0, 1);
      entrenarAsync(id, sequence, label);
    }
  }

  history.push(extraerFeatures(instrumento, sala, label));
  if (history.length > HISTORY_MAX) history.shift();
  state.history = history.length;
}

export function calcularModulacion(instrumento, sala, instrumentos, influence = 1) {
  if (!_ready || !instrumento || !instrumentos || influence <= 0) return null;

  const propioId = instrumento.id;
  const escucha = sala?.getEscuchaIndividual?.(propioId);
  let delta = 0;
  let pesoTotal = 0;
  const detalles = [];

  for (const [otherId, otherInst] of Object.entries(instrumentos)) {
    if (otherId === propioId || !otherInst) continue;

    const pred = predecir(otherId);
    if (pred === null) continue;

    const stats = ensureState(otherId);
    const vecino = escucha?.vecinos?.find(v => v.id === otherId);
    const distance = vecino?.distancia ?? Math.abs((otherInst.posicion ?? 0) - (instrumento.posicion ?? 0));
    const direction = vecino?.direccion ?? directionFromPositions(otherInst, instrumento);
    const distanceWeight = clamp(1 - distance / 8, 0.15, 1);
    const confidence = clamp(stats.confidence, 0, 1);
    if (confidence <= 0) continue;

    let local = 0;
    let motivo = 'estilo estable';

    if (pred > 0.66) {
      if (distance <= 3) {
        local -= 0.035 * distanceWeight;
        motivo = `${otherLabel(otherInst, otherId)} parece avanzar: espera`;
      } else if (direction === 'delante') {
        local += 0.04 * distanceWeight;
        motivo = `${otherLabel(otherInst, otherId)} abre camino`;
      }
    } else if (pred < 0.34) {
      if (direction === 'delante') {
        local += 0.035 * distanceWeight;
        motivo = `${otherLabel(otherInst, otherId)} espera delante`;
      } else if (direction === 'detras') {
        local -= 0.035 * distanceWeight;
        motivo = `${otherLabel(otherInst, otherId)} queda detras`;
      }
    }

    const surprisePush = clamp(stats.avgSurprise - 0.15, -0.25, 0.35) * 0.035 * distanceWeight;
    local += surprisePush;

    const weighted = local * confidence;
    delta += weighted;
    pesoTotal += confidence * distanceWeight;
    detalles.push({
      id: otherId,
      prediccion: round2(pred),
      sorpresa: round2(stats.avgSurprise),
      confianza: round2(confidence),
      delta: round2(weighted),
      motivo,
    });
  }

  if (!detalles.length || pesoTotal <= 0) return null;

  delta = clamp(delta * influence, -0.12, 0.12);
  if (Math.abs(delta) < 0.004) return null;

  const sorpresaMedia = detalles.reduce((s, d) => s + d.sorpresa, 0) / detalles.length;
  const confianzaMedia = detalles.reduce((s, d) => s + d.confianza, 0) / detalles.length;
  const principal = detalles
    .slice()
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];

  return {
    delta,
    motivo: principal?.motivo || (delta > 0 ? 'estilo empuja' : 'estilo espera'),
    sorpresa: clamp(sorpresaMedia, 0, 1),
    confianza: clamp(confianzaMedia, 0, 1),
    detalles,
  };
}

export function getResumen() {
  const items = _instrumentIds.map(id => {
    const s = ensureState(id);
    return {
      id,
      history: s.history,
      trainedSamples: s.trainedSamples,
      prediction: round2(s.lastPrediction),
      surprise: round2(s.avgSurprise),
      confidence: round2(s.confidence),
      training: _training.has(id),
    };
  });
  const active = items.filter(i => i.history >= SEQ_LEN);
  const avgSurprise = active.length
    ? active.reduce((sum, i) => sum + i.surprise, 0) / active.length
    : 0;
  const avgConfidence = active.length
    ? active.reduce((sum, i) => sum + i.confidence, 0) / active.length
    : 0;

  return {
    ready: _ready,
    loading: _loading,
    seqLen: SEQ_LEN,
    items,
    avgSurprise: round2(avgSurprise),
    avgConfidence: round2(avgConfidence),
    activeCount: active.length,
  };
}

function crearModelo() {
  const model = _tf.sequential();
  model.add(_tf.layers.lstm({
    units: LSTM_UNITS,
    inputShape: [SEQ_LEN, FEATURE_DIM],
    recurrentInitializer: 'glorotUniform',
  }));
  model.add(_tf.layers.dense({ units: 1, activation: 'sigmoid' }));
  model.compile({
    optimizer: _tf.train.adam(0.006),
    loss: 'binaryCrossentropy',
  });
  return model;
}

function ensureState(id) {
  if (!_histories.has(id)) _histories.set(id, []);
  if (!_stats.has(id)) {
    _stats.set(id, {
      history: 0,
      trainedSamples: 0,
      lastPrediction: 0.5,
      lastSurprise: 0.5,
      avgSurprise: 0.5,
      confidence: 0,
    });
  }
  return _stats.get(id);
}

function extraerFeatures(instrumento, sala, lastAdvance) {
  const ui = instrumento?.getEstadoUI?.() || {};
  const verbos = ui.verbos || {};
  const numPatrones = sala?.numPatrones || 53;
  return [
    clamp((instrumento?.posicion ?? 0) / Math.max(1, numPatrones - 1), 0, 1),
    ESTADO_CODE[ui.estado] ?? 0,
    clamp(ui.señal ?? 0, 0, 1),
    clamp(ui.volatilidad ?? 0, 0, 1),
    clamp(verbos.AVANZA ?? 0, 0, 1),
    clamp(verbos.RETIENE ?? 0, 0, 1),
    clamp(verbos.MUTA ?? 0, 0, 1),
    clamp((ui.repeticiones ?? 0) / 16, 0, 1),
    lastAdvance ? 1 : 0,
  ];
}

function predecir(id) {
  const history = _histories.get(id);
  if (!_ready || !history || history.length < SEQ_LEN) return null;
  return predecirSecuencia(id, history.slice(-SEQ_LEN));
}

function predecirSecuencia(id, sequence) {
  const model = _models.get(id);
  if (!model || !_tf || sequence.length < SEQ_LEN) return null;
  try {
    return _tf.tidy(() => {
      const xs = _tf.tensor3d([sequence], [1, SEQ_LEN, FEATURE_DIM]);
      const out = model.predict(xs);
      return clamp(out.dataSync()[0], 0, 1);
    });
  } catch (_) {
    return null;
  }
}

function entrenarAsync(id, sequence, label) {
  const model = _models.get(id);
  if (!model || _training.has(id)) return;

  _training.add(id);
  const xs = _tf.tensor3d([sequence], [1, SEQ_LEN, FEATURE_DIM]);
  const ys = _tf.tensor2d([[label]], [1, 1]);

  model.fit(xs, ys, {
    epochs: 1,
    batchSize: 1,
    verbose: 0,
  }).then(() => {
    const s = ensureState(id);
    s.trainedSamples += 1;
    s.confidence = clamp(s.trainedSamples / 120, 0, 1);
  }).catch(err => {
    console.warn(`[LSTM Estilo] Error entrenando ${id}:`, err.message);
  }).finally(() => {
    xs.dispose();
    ys.dispose();
    _training.delete(id);
  });
}

function directionFromPositions(other, own) {
  const delta = (other?.posicion ?? 0) - (own?.posicion ?? 0);
  return delta > 0 ? 'delante' : delta < 0 ? 'detras' : 'unisono';
}

function otherLabel(inst, id) {
  return inst?._nombre || id;
}
