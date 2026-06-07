/**
 * VAE Timbre Decoder — In C / Mundo Real
 * 
 * Carga los pesos del decoder VAE exportados desde PyTorch y ejecuta
 * inferencia en JS puro (sin frameworks). Mapea el estado del músico
 * a un vector latente de 4 dimensiones, lo decodifica a 8 parámetros
 * de síntesis FM/AM, y los desnormaliza a rangos reales.
 * 
 * Arquitectura del decoder: 4 → 64 (ReLU) → 128 (ReLU) → 8 (Sigmoid)
 * Tamaño de pesos: ~205KB
 * Latencia estimada: < 0.5ms
 */

let _weights = null;
let _ranges = null;
let _paramNames = null;

// ── Carga de pesos ──

export async function cargarPesos() {
  if (_weights) return true;
  try {
    const url = new URL('./pesos/vae_decoder.json', import.meta.url);
    const res = await fetch(url);
    const data = await res.json();

    // Parsear capas: weight matrices y bias vectors
    _weights = {
      w1: data.layers[0].data,  // [64, 4]
      b1: data.layers[1].data,  // [64]
      w2: data.layers[2].data,  // [128, 64]
      b2: data.layers[3].data,  // [128]
      w3: data.layers[4].data,  // [8, 128]
      b3: data.layers[5].data,  // [8]
    };
    _ranges = data.ranges;
    _paramNames = data.param_names;

    console.log(`[VAE Timbre] Pesos cargados (${data.layers.length} capas)`);
    return true;
  } catch (e) {
    console.warn('[VAE Timbre] No se pudieron cargar los pesos:', e.message);
    return false;
  }
}

export function isReady() {
  return _weights !== null;
}

// ── Forward pass del decoder ──

function matmulVec(matrix, vec) {
  // matrix: [outDim][inDim], vec: [inDim] → result: [outDim]
  const out = new Float32Array(matrix.length);
  for (let i = 0; i < matrix.length; i++) {
    let sum = 0;
    const row = matrix[i];
    for (let j = 0; j < row.length; j++) {
      sum += row[j] * vec[j];
    }
    out[i] = sum;
  }
  return out;
}

function addBias(vec, bias) {
  for (let i = 0; i < vec.length; i++) vec[i] += bias[i];
  return vec;
}

function relu(vec) {
  for (let i = 0; i < vec.length; i++) {
    if (vec[i] < 0) vec[i] = 0;
  }
  return vec;
}

function sigmoid(vec) {
  for (let i = 0; i < vec.length; i++) {
    vec[i] = 1 / (1 + Math.exp(-vec[i]));
  }
  return vec;
}

/**
 * Decodifica un vector latente z[4] a parámetros normalizados [0,1].
 */
function decoderForward(z) {
  if (!_weights) return null;
  let h = matmulVec(_weights.w1, z);
  addBias(h, _weights.b1);
  relu(h);

  h = matmulVec(_weights.w2, h);
  addBias(h, _weights.b2);
  relu(h);

  h = matmulVec(_weights.w3, h);
  addBias(h, _weights.b3);
  sigmoid(h);

  return h;
}

/**
 * Desnormaliza parámetros de [0,1] a rangos reales de síntesis.
 * Retorna un objeto con nombres legibles.
 */
function desnormalizar(normalized) {
  const params = {};
  for (let i = 0; i < _paramNames.length; i++) {
    const name = _paramNames[i];
    const [lo, hi] = _ranges[name];
    params[name] = lo + normalized[i] * (hi - lo);
  }
  return params;
}

// ── Mapeo de estado del músico → vector latente ──

/**
 * Convierte el estado actual de un instrumento en un vector latente z[4].
 * 
 * Ejes latentes (descubiertos por el VAE):
 *   z₁ — poco discriminativo, usamos posición para darle dirección
 *   z₂ — sostenido (+) vs percusivo (-): mapeamos con audibilidad
 *   z₃ — auxiliar: mapeamos con verbo MUTA
 *   z₄ — brillante (+) vs agresivo (-): mapeamos con volatilidad
 * 
 * Cada eje se escala a [-2, +2] para cubrir bien el espacio latente.
 */
export function estadoALatente(instrumento, sala) {
  const numPatrones = sala?.numPatrones || 53;
  const posNorm = (instrumento.posicion || 0) / numPatrones;
  const muta = instrumento._verbos?.MUTA ?? instrumento._manualMuta ?? 0;
  const audibilidad = instrumento.getEstadoUI?.()?.audibilidad ?? 0.5;
  const volatilidad = instrumento.getVolatilidadGlobal?.() ?? 0;

  // Mapear a [-2, +2] centrado en 0
  const z = new Float32Array(4);
  z[0] = (posNorm - 0.5) * 4;            // posición: -2 inicio → +2 final
  z[1] = (audibilidad - 0.5) * 4;        // audibilidad: -2 baja → +2 alta
  z[2] = (muta - 0.5) * 4;               // muta: -2 sin → +2 mutado
  z[3] = (volatilidad - 0.5) * 4;        // volatilidad: -2 calma → +2 caos
  return z;
}

// ── API pública ──

/**
 * Dado el estado de un instrumento, produce parámetros de síntesis FM/AM.
 * Retorna null si el modelo no está cargado.
 * 
 * @returns {Object|null} { oscType, harmonicity, modIndex, attack, decay, sustain, release, filterCut }
 */
export function inferirTimbre(instrumento, sala) {
  if (!_weights) return null;
  const z = estadoALatente(instrumento, sala);
  const normalized = decoderForward(z);
  return desnormalizar(normalized);
}

/**
 * Decodifica directamente un vector latente z[4] a parámetros reales.
 * Útil para debug y visualización.
 */
export function decodificar(z) {
  if (!_weights) return null;
  const normalized = decoderForward(z);
  return desnormalizar(normalized);
}

/**
 * Mapea oscType (0-1) al nombre de oscilador más cercano para Tone.js.
 */
export function oscTypeToName(oscType) {
  if (oscType < 0.2) return 'sine';
  if (oscType < 0.45) return 'triangle';
  if (oscType < 0.75) return 'sawtooth';
  return 'square';
}
