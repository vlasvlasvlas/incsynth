/**
 * Fase 5 — Captura de Audio para Corpus RAVE
 *
 * Graba la salida de Tone.js y genera marcadores de sincronización
 * cada SYNC_INTERVAL_MS con los z-vectors VAE actuales.
 *
 * Produce dos archivos al detener:
 *   incsynth_audio_YYYY-MM-DD_HH-mm.webm  — audio del sintetizador
 *   incsynth_sync_YYYY-MM-DD_HH-mm.json   — marcadores VAE sincronizados
 *
 * El script lab/05_rave/preparar_corpus.py convierte estos en el
 * dataset de entrenamiento para RAVE.
 *
 * Uso:
 *   raveCapture.iniciar(() => ({ z_vectors: cuartoMusico.getZVectors(), alpha }))
 *   raveCapture.detenerYDescargar()
 */

import * as Tone from 'tone';

const SYNC_INTERVAL_MS = 3000;  // marcador de sync cada 3 segundos

let _recorder    = null;
let _timer       = null;
let _active      = false;
let _loading     = false;
let _markers     = [];
let _startTime   = null;
let _getSyncData = null;
let _listeners   = new Set();

// ── Control ───────────────────────────────────────────────────────────────────

/**
 * Inicia la captura de audio.
 * @param {Function} getSyncData - callback () => { z_vectors, alpha, ...extras }
 */
export async function iniciar(getSyncData) {
  if (_active || _loading) return false;
  _loading = true;
  _emit();

  try {
    _getSyncData = getSyncData;
    _recorder    = new Tone.Recorder();
    Tone.getDestination().connect(_recorder);
    await _recorder.start();

    _startTime = Date.now();
    _markers   = [];
    _marcar();                                    // marcador inmediato al inicio
    _timer = setInterval(_marcar, SYNC_INTERVAL_MS);

    _active  = true;
    _loading = false;
    console.log('[RAVE Capture] Grabación iniciada.');
    _emit();
    return true;
  } catch (err) {
    _cleanupRecorder();
    _loading = false;
    console.warn('[RAVE Capture] No se pudo iniciar:', err.message);
    _emit();
    return false;
  }
}

export async function detenerYDescargar() {
  if (!_active) return;
  clearInterval(_timer);
  _marcar();          // marcador final antes de detener
  _active  = false;
  _loading = true;
  _emit();

  try {
    const blob = await _recorder.stop();

    const fecha = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');

    // Descargar audio
    const audioUrl = URL.createObjectURL(blob);
    const a1 = document.createElement('a');
    a1.href     = audioUrl;
    a1.download = `incsynth_audio_${fecha}.webm`;
    a1.click();
    setTimeout(() => URL.revokeObjectURL(audioUrl), 2000);

    // Descargar JSON de sincronización
    const syncData = {
      version:    1,
      inicio:     new Date(_startTime).toISOString(),
      duracion_s: Math.round((Date.now() - _startTime) / 1000),
      n_markers:  _markers.length,
      markers:    _markers,
    };
    const syncBlob = new Blob([JSON.stringify(syncData, null, 2)], { type: 'application/json' });
    const a2 = document.createElement('a');
    a2.href     = URL.createObjectURL(syncBlob);
    a2.download = `incsynth_sync_${fecha}.json`;
    setTimeout(() => { a2.click(); setTimeout(() => URL.revokeObjectURL(a2.href), 2000); }, 600);

    console.log(`[RAVE Capture] ${_markers.length} marcadores exportados.`);
  } catch (err) {
    console.error('[RAVE Capture] Error al exportar:', err);
  } finally {
    _cleanupRecorder();
    _getSyncData = null;
  }

  _loading = false;
  _emit();
}

// ── API pública ───────────────────────────────────────────────────────────────

export function isActive()  { return _active;  }
export function isLoading() { return _loading; }

export function getEstado() {
  return {
    active:     _active,
    loading:    _loading,
    markers:    _markers.length,
    duracion_s: _startTime && _active ? Math.round((Date.now() - _startTime) / 1000) : 0,
  };
}

export function subscribe(fn) {
  _listeners.add(fn);
  fn(getEstado());
  return () => _listeners.delete(fn);
}

// ── Internos ──────────────────────────────────────────────────────────────────

function _marcar() {
  if (!_getSyncData) return;
  try {
    const data = _getSyncData();
    _markers.push({
      t_ms: Date.now() - (_startTime ?? Date.now()),
      ...data,
    });
  } catch (_) {}
}

function _emit() {
  const s = getEstado();
  for (const fn of _listeners) fn(s);
}

function _cleanupRecorder() {
  if (!_recorder) return;
  try { Tone.getDestination().disconnect(_recorder); } catch (_) {}
  try { _recorder.dispose?.(); } catch (_) {}
  _recorder = null;
}
