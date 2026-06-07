/**
 * Fase 4 — Escucha Ambiente (Web Audio FFT)
 *
 * Clasifica el ambiente sonoro del micrófono usando análisis espectral FFT.
 * Sin dependencias de ML — funciona con la Web Audio API nativa del browser.
 *
 * Bandas de frecuencia → verbos musicales:
 *   Silencio (energía < umbral)   → RETIENE
 *   Impulso súbito (spike >2×)    → ENTRA   (aplauso, golpe)
 *   Grave dominante (60–300 Hz)   → AVANZA  (tráfico, bajo, bombo)
 *   Media dominante (300–4kHz)    → MUTA    (voz, instrumentos)
 *   Alta dominante (4k–12kHz)     → SALE    (sibilantes, estática)
 *   Baja energía difusa           → RETIENE (ambiente suave)
 *
 * Toggle independiente del dial del Cuarto Músico.
 */

import { clamp, round2 } from '../utils.js';

const FFT_SIZE    = 2048;
const INTERVAL_MS = 800;   // análisis cada 800 ms

// Umbrales de energía (escala 0–255, AnalyserNode getByteFrequencyData)
const TH_SILENCE  = 15;   // energía total < esto → silencio
const TH_IMPULSO  = 2.2;  // ratio vs frame anterior → ENTRA
const TH_MIN_IMP  = 80;   // energía total mínima para disparar impulso
const TH_GRAVE    = 55;   // energía grave mínima para clasificar AVANZA
const TH_MEDIO    = 50;   // energía media mínima para clasificar MUTA
const TH_ALTO     = 60;   // energía alta mínima para clasificar SALE

// ── Estado interno ────────────────────────────────────────────────────────────

let _stream      = null;
let _context     = null;
let _analyser    = null;
let _source      = null;
let _timer       = null;
let _active      = false;
let _loading     = false;
let _listeners   = new Set();

let _lastResult  = { verb: null, weight: 0, clase: '—', confidence: 0 };
let _prevEnergy  = 0;
let _frameCount  = 0;

// ── Activación / desactivación ────────────────────────────────────────────────

export async function activar() {
  if (_active)  return true;
  if (_loading) return false;
  _loading = true;
  _emit();

  try {
    _stream   = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    _context  = new AudioContext();
    _source   = _context.createMediaStreamSource(_stream);
    _analyser = _context.createAnalyser();
    _analyser.fftSize                = FFT_SIZE;
    _analyser.smoothingTimeConstant  = 0.6;
    _source.connect(_analyser);

    _timer   = setInterval(_analizar, INTERVAL_MS);
    _active  = true;
    _loading = false;
    console.log('[Escucha Ambiente] Micrófono activo. Análisis FFT iniciado.');
    _emit();
    return true;
  } catch (err) {
    _loading = false;
    console.warn('[Escucha Ambiente] No se pudo activar:', err.message);
    _emit();
    return false;
  }
}

export function desactivar() {
  if (!_active) return;
  clearInterval(_timer);
  try { _source?.disconnect();                      } catch (_) {}
  try { _context?.close();                          } catch (_) {}
  try { _stream?.getTracks().forEach(t => t.stop()); } catch (_) {}
  _active     = false;
  _prevEnergy = 0;
  _lastResult = { verb: null, weight: 0, clase: '—', confidence: 0 };
  console.log('[Escucha Ambiente] Desactivado.');
  _emit();
}

// ── Análisis FFT ──────────────────────────────────────────────────────────────

function _analizar() {
  if (!_analyser) return;

  const buf    = new Uint8Array(_analyser.frequencyBinCount);
  _analyser.getByteFrequencyData(buf);

  const binHz  = (_context.sampleRate / 2) / buf.length;

  // Índices de banda
  const iGrLo  = Math.floor(60   / binHz);
  const iGrHi  = Math.floor(300  / binHz);
  const iMedLo = iGrHi  + 1;
  const iMedHi = Math.floor(4000 / binHz);
  const iAltLo = iMedHi + 1;
  const iAltHi = Math.min(Math.floor(12000 / binHz), buf.length - 1);

  const eGrave  = _mean(buf, iGrLo,  iGrHi);
  const eMedio  = _mean(buf, iMedLo, iMedHi);
  const eAlto   = _mean(buf, iAltLo, iAltHi);
  const eTotal  = _mean(buf, 0, buf.length - 1);

  // Detectar impulso (aplauso, golpe, clap)
  const impulso = eTotal > _prevEnergy * TH_IMPULSO && eTotal > TH_MIN_IMP;
  _prevEnergy   = eTotal * 0.55 + _prevEnergy * 0.45; // EMA suavizado

  let verb, clase, weight;

  if (eTotal < TH_SILENCE) {
    verb = 'RETIENE'; clase = 'silencio';         weight = 0.50;
  } else if (impulso) {
    verb = 'ENTRA';   clase = 'impulso';           weight = clamp(eTotal / 200, 0.5, 1.0);
  } else if (eGrave >= TH_GRAVE && eGrave >= eMedio * 0.9) {
    verb = 'AVANZA';  clase = 'baja_frecuencia';   weight = clamp(eGrave / 150, 0.3, 0.8);
  } else if (eMedio >= TH_MEDIO) {
    verb = 'MUTA';    clase = 'media_frecuencia';  weight = clamp(eMedio / 180, 0.3, 0.7);
  } else if (eAlto >= TH_ALTO && eMedio < 30) {
    verb = 'SALE';    clase = 'alta_frecuencia';   weight = clamp(eAlto / 200, 0.2, 0.6);
  } else {
    verb = 'RETIENE'; clase = 'ambiente_suave';    weight = 0.35;
  }

  _lastResult = {
    verb,
    clase,
    weight:     round2(weight),
    confidence: round2(eTotal / 255),
  };
  _frameCount++;
  _emit();
}

function _mean(buf, lo, hi) {
  if (lo > hi) return 0;
  let sum = 0;
  for (let i = lo; i <= hi; i++) sum += buf[i];
  return sum / (hi - lo + 1);
}

// ── API pública ───────────────────────────────────────────────────────────────

export function isReady()   { return _active; }
export function isLoading() { return _loading; }
export function isActive()  { return _active; }

/**
 * Delta de probabilidad de avance derivado del verbo ambiente.
 */
export function getDeltaAvance(influence = 1) {
  if (!_active || !_lastResult.verb) return 0;
  const w = _lastResult.weight * influence;
  if (_lastResult.verb === 'AVANZA')  return  clamp(w * 0.10, 0, 0.10);
  if (_lastResult.verb === 'RETIENE') return -clamp(w * 0.08, 0, 0.08);
  if (_lastResult.verb === 'SALE')    return -clamp(w * 0.06, 0, 0.06);
  if (_lastResult.verb === 'ENTRA')   return  clamp(w * 0.12, 0, 0.12);
  return 0;
}

export function getVerbos() {
  if (!_active || !_lastResult.verb) return {};
  return { [_lastResult.verb]: _lastResult.weight };
}

export function getEstado() {
  return {
    active:     _active,
    loading:    _loading,
    ready:      _active,
    clase:      _lastResult.clase,
    verb:       _lastResult.verb,
    weight:     _lastResult.weight,
    confidence: _lastResult.confidence,
    frames:     _frameCount,
  };
}

// ── Subscripción ──────────────────────────────────────────────────────────────

export function subscribe(fn) {
  _listeners.add(fn);
  fn(getEstado());
  return () => _listeners.delete(fn);
}

function _emit() {
  const s = getEstado();
  for (const fn of _listeners) fn(s);
}
