/**
 * Session Logger — In C / Mundo Real
 *
 * Registra cada ciclo de decisión con todo el estado del sistema.
 * Los logs son la materia prima para calibrar RAVE (Fase 5)
 * y diseñar la función de recompensa de MARL (Fase 6).
 *
 * Almacenamiento:
 *   - _eventos permanece en RAM durante toda la sesión (nunca se vacía en flush)
 *   - localStorage se actualiza como backup cada FLUSH_N eventos
 *   - Descarga manual como JSON al finalizar
 *
 * Siempre activo. Se puede desactivar con setActivo(false).
 */

const LS_KEY  = 'incsynth_session_log';
const MAX_MEM = 8000;   // eventos máximos en RAM (~76 min a la tasa observada)
const FLUSH_N = 30;     // backup a localStorage cada N eventos

let _activo  = true;
let _eventos = [];
let _meta    = {};
let _inicio  = null;

// ── Control ──────────────────────────────────────────────────────────────────

export function setActivo(v) { _activo = !!v; }
export function isActivo()   { return _activo; }

export function iniciarSesion(meta = {}) {
  _inicio  = Date.now();
  _eventos = [];
  _meta = {
    version: 2,
    inicio:  new Date(_inicio).toISOString(),
    ciudad:  meta.ciudad  || '—',
    bpm:     meta.bpm     || 70,
    alpha:   meta.alpha   || 0,
    fuentes: meta.fuentes || {},
    ...meta,
  };
  _flushLS();
  console.log('[SessionLogger] Sesión iniciada.');
}

export function cerrarSesion() {
  if (!_inicio) return null;
  _meta.fin        = new Date().toISOString();
  _meta.duracion_s = Math.round((Date.now() - _inicio) / 1000);
  _meta.nEventos   = _eventos.length;
  _flushLS();
  console.log(`[SessionLogger] Sesión cerrada. ${_eventos.length} eventos.`);
  return exportar();
}

// ── Registro de eventos ──────────────────────────────────────────────────────

export function registrarCiclo(id, instrumento, sala, avanzo, extras = {}) {
  if (!_activo) return;

  const ui        = instrumento?.getEstadoUI?.() || {};
  const breakdown = ui.probBreakdown || {};

  const evento = {
    t:      Date.now() - (_inicio || Date.now()),
    id,
    pos:    instrumento?.posicion ?? 0,
    avanzo: !!avanzo,
    estado: ui.estado || '—',
    p:      round2(breakdown.p ?? 0),
    motivo: breakdown.motivo || '—',
    bd: {
      api:       round2(breakdown.api        ?? 0),
      huella:    round2(breakdown.stigmergy  ?? 0),
      grupo:     round2(breakdown.cohesion   ?? 0),
      separa:    round2(breakdown.separacion ?? 0),
      momentum:  round2(breakdown.momentum   ?? 0),
      impacto:   round2(breakdown.shockwave  ?? 0),
      geometria: round2(breakdown.geometria  ?? 0),
      escucha:   round2(breakdown.escucha    ?? 0),
      secuencia: round2(breakdown.secuencia  ?? 0),
      bias:      round2(breakdown.bias       ?? 0),
      iaEstilo:  round2(breakdown.iaEstilo   ?? 0),
      gnn:       round2(breakdown.gnn        ?? 0),
      yamnet:    round2(breakdown.yamnet     ?? 0),
    },
    vae: extras.vae ? {
      z:           extras.vae.z?.map(round2) || [],
      oscType:     round2(extras.vae.oscType     ?? 0),
      harmonicity: round2(extras.vae.harmonicity ?? 0),
      modIndex:    round2(extras.vae.modIndex    ?? 0),
      filterCut:   round2(extras.vae.filterCut   ?? 0),
      attack:      round2(extras.vae.attack      ?? 0),
    } : null,
    lstm: extras.lstm ? {
      pred:       round2(extras.lstm.prediction ?? 0.5),
      surprise:   round2(extras.lstm.surprise   ?? 0),
      confidence: round2(extras.lstm.confidence ?? 0),
    } : null,
    gnn: extras.gnn ? {
      pressure: round2(extras.gnn.pressure ?? 0.5),
      delta:    round2(extras.gnn.delta    ?? 0),
    } : null,
    yamnet: extras.yamnet ? {
      clase:      extras.yamnet.clase      || '—',
      verb:       extras.yamnet.verb       || null,
      confidence: round2(extras.yamnet.confidence ?? 0),
    } : null,
  };

  _eventos.push(evento);
  if (_eventos.length > MAX_MEM) _eventos.shift();   // truncar viejos en RAM
  if (_eventos.length % FLUSH_N === 0) _flushLS();   // backup periódico
}

export function actualizarMeta(patch = {}) {
  Object.assign(_meta, patch);
}

// ── Export ───────────────────────────────────────────────────────────────────

export function exportar() {
  return {
    meta:    _meta,
    eventos: _eventos,
    resumen: calcularResumen(),
  };
}

export function descargar() {
  const data  = exportar();
  const json  = JSON.stringify(data, null, 2);
  const blob  = new Blob([json], { type: 'application/json' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  const fecha = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  a.href      = url;
  a.download  = `incsynth_sesion_${fecha}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function getResumen() {
  return {
    activo:     _activo,
    nEventos:   _eventos.length,
    duracion_s: _inicio ? Math.round((Date.now() - _inicio) / 1000) : 0,
  };
}

// ── Internos ─────────────────────────────────────────────────────────────────

/**
 * Escribe el estado actual a localStorage como backup.
 * NO vacía _eventos — sólo copia. Así exportar() siempre lee datos completos.
 */
function _flushLS() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ meta: _meta, eventos: _eventos }));
  } catch (_) {
    // localStorage lleno o no disponible — seguir en RAM
  }
}

function calcularResumen() {
  if (!_eventos.length) return {};

  const ids  = [...new Set(_eventos.map(e => e.id))];
  const byId = {};

  for (const id of ids) {
    const evs  = _eventos.filter(e => e.id === id);
    const nAdv = evs.filter(e => e.avanzo).length;

    const posiciones = evs.map(e => e.pos);
    const posMin = Math.min(...posiciones);
    const posMax = Math.max(...posiciones);

    // VAE — rangos de parámetros observados
    const vaeEvs = evs.filter(e => e.vae);
    let vaeRangos = null;
    if (vaeEvs.length) {
      const params = ['oscType', 'harmonicity', 'modIndex', 'filterCut', 'attack'];
      vaeRangos = {};
      for (const p of params) {
        const vals = vaeEvs.map(e => e.vae[p]).filter(v => v != null);
        if (vals.length) {
          vaeRangos[p] = {
            min:  round2(Math.min(...vals)),
            max:  round2(Math.max(...vals)),
            mean: round2(vals.reduce((s, v) => s + v, 0) / vals.length),
          };
        }
      }
    }

    // LSTM — curva de sorpresa a lo largo del tiempo
    const lstmEvs  = evs.filter(e => e.lstm);
    const lstmCurva = lstmEvs.map(e => e.lstm.surprise);

    // Motivos dominantes
    const motivos = {};
    for (const e of evs) motivos[e.motivo] = (motivos[e.motivo] || 0) + 1;

    byId[id] = {
      nCiclos:    evs.length,
      nAvances:   nAdv,
      tasaAvance: round2(nAdv / Math.max(1, evs.length)),
      posRango:   [posMin, posMax],
      vaeRangos,
      lstmCurva,
      motivos,
    };
  }

  // Distancias reconstruidas con la última posición conocida por instrumento.
  // Los músicos registran eventos en milisegundos distintos, así que agrupar por
  // timestamp exacto subestima la distancia y suele dar 0.
  const lastPos = new Map();
  const distancias = [];
  for (const e of [..._eventos].sort((a, b) => a.t - b.t)) {
    lastPos.set(e.id, e.pos);
    if (lastPos.size < 2) continue;
    const posArr = [...lastPos.values()];
    distancias.push(Math.max(...posArr) - Math.min(...posArr));
  }

  const distMedia = distancias.length
    ? round2(distancias.reduce((s, v) => s + v, 0) / distancias.length)
    : 0;

  // YAMNet — top verbos detectados
  const yamnetEvs   = _eventos.filter(e => e.yamnet?.verb);
  const yamnetConteo = {};
  for (const e of yamnetEvs) {
    yamnetConteo[e.yamnet.verb] = (yamnetConteo[e.yamnet.verb] || 0) + 1;
  }

  return {
    porInstrumento:  byId,
    distanciaMedia:  distMedia,
    yamnetVerbos:    yamnetConteo,
    nEventosTotales: _eventos.length,
  };
}

function round2(v) {
  return Math.round((v ?? 0) * 100) / 100;
}
