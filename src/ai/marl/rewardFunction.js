/**
 * Fase 6 — Función de Recompensa MARL
 *
 * Calcula señales de recompensa basadas en métricas de sesión.
 * Diseñada a partir de las observaciones de las sesiones del 2026-06-07:
 *
 *   - maduración/tiempo dominó 73-82% de las decisiones → premiar diversidad
 *   - músicos van sincronizados (distancia ~0) → premiar separación
 *   - LSTM sorpresa cae a 0.04 en sesión larga → premiar sorpresa sostenida
 *   - tasaAvance 3-4% → target ideal ~7%
 *
 * Exports:
 *   calcularRewardCiclo()   → recompensa por ciclo, en tiempo real
 *   calcularRewardSesion()  → recompensa global sobre logs completos
 *   explicarReward()        → texto legible para UI/debugging
 */

// ── Targets calibrados desde datos reales ─────────────────────────────────────

export const TARGET = {
  tasaAvance:   0.07,   // 7% de ciclos avanzan es el ritmo musical ideal
  distancia:    8,      // 8 patrones de separación entre músicos
  lstmSorpresa: 0.15,   // LSTM con sorpresa sostenida = modelo vivo
  diversidad:   0.55,   // 55% de motivos que no son maduración/tiempo
};

export const WEIGHTS = {
  motivoDiversidad:  2.0,
  distanciaSocial:   1.5,
  lstmSorpresa:      1.0,
  tasaAvance:        0.8,
};

// Motivos "pasivos" — cuando dominan, el sistema está estancado
const MOTIVOS_PASIVOS = new Set(['maduracion', 'tiempo', 'freno', 'freno_manual']);

// ── Recompensa por ciclo ──────────────────────────────────────────────────────

/**
 * Calcula la recompensa para un instrumento en un ciclo.
 *
 * @param {Object} opts
 * @param {string}  opts.motivo           - motivo que dominó la decisión
 * @param {number}  opts.lstmSurprise     - sorpresa LSTM actual [0-1]
 * @param {number}  opts.distanciaNeighbor - distancia en patrones al músico más cercano
 * @param {boolean} opts.avanzo           - si avanzó en este ciclo
 * @returns {{ motivoDiversidad, distanciaSocial, lstmSorpresa, total }}
 */
export function calcularRewardCiclo({ motivo, lstmSurprise = 0, distanciaNeighbor = 0, avanzo = false }) {
  const r = {};

  // Motivo diversity: pasivo → −0.5, activo → +1.0
  r.motivoDiversidad = MOTIVOS_PASIVOS.has(motivo) ? -0.5 : 1.0;

  // Distancia social: gaussiana centrada en TARGET.distancia
  r.distanciaSocial = _gaussian(distanciaNeighbor, TARGET.distancia, 5);

  // LSTM sorpresa: lineal hasta TARGET, luego plateau
  r.lstmSorpresa = Math.min(1.0, lstmSurprise / TARGET.lstmSorpresa) * 1.5 - 0.25;

  const den = WEIGHTS.motivoDiversidad + WEIGHTS.distanciaSocial + WEIGHTS.lstmSorpresa;
  r.total = _r2(
    (WEIGHTS.motivoDiversidad * r.motivoDiversidad +
     WEIGHTS.distanciaSocial  * r.distanciaSocial  +
     WEIGHTS.lstmSorpresa     * r.lstmSorpresa) / den
  );

  return r;
}

// ── Recompensa de sesión ──────────────────────────────────────────────────────

/**
 * Calcula la recompensa global a partir de los eventos del logger.
 *
 * @param {Array}  eventos - array de eventos del SessionLogger
 * @returns {{ total, porInstrumento, diagnostico }}
 */
export function calcularRewardSesion(eventos) {
  if (!eventos?.length) return { total: 0, porInstrumento: {}, diagnostico: [] };

  const ids  = [...new Set(eventos.map(e => e.id))];
  const byId = {};

  for (const id of ids) {
    const evs     = eventos.filter(e => e.id === id);
    const nCiclos = evs.length;
    const nAvances = evs.filter(e => e.avanzo).length;
    const tasa    = nAvances / Math.max(1, nCiclos);

    // Diversidad de motivos
    const mCounts = {};
    for (const e of evs) mCounts[e.motivo] = (mCounts[e.motivo] || 0) + 1;
    const nPasivos  = [...MOTIVOS_PASIVOS].reduce((s, m) => s + (mCounts[m] || 0), 0);
    const diversidad = 1 - nPasivos / Math.max(1, nCiclos);

    // LSTM sorpresa media
    const lstmEvs = evs.filter(e => e.lstm);
    const lstmMedia = lstmEvs.length
      ? lstmEvs.reduce((s, e) => s + e.lstm.surprise, 0) / lstmEvs.length
      : 0;

    // GNN delta medio
    const gnnEvs = evs.filter(e => e.gnn && e.gnn.delta != null && e.gnn.delta !== 0);
    const gnnMedia = gnnEvs.length
      ? gnnEvs.reduce((s, e) => s + Math.abs(e.gnn.delta), 0) / gnnEvs.length
      : 0;

    // Rewards individuales
    const rTasa      = _gaussian(tasa, TARGET.tasaAvance, 0.04);
    const rDiversidad = _r2(diversidad * 2 - 1);          // [-1, +1]
    const rLSTM      = _r2(Math.min(1, lstmMedia / TARGET.lstmSorpresa) * 1.5 - 0.25);

    const den = WEIGHTS.tasaAvance + WEIGHTS.motivoDiversidad + WEIGHTS.lstmSorpresa;
    const rInst = _r2(
      (WEIGHTS.tasaAvance      * rTasa      +
       WEIGHTS.motivoDiversidad * rDiversidad +
       WEIGHTS.lstmSorpresa    * rLSTM) / den
    );

    byId[id] = {
      nCiclos, nAvances,
      tasaAvance:    _r2(tasa),
      diversidad:    _r2(diversidad),
      lstmMedia:     _r2(lstmMedia),
      gnnDeltaMedia: _r2(gnnMedia),
      motivoTop:     _topMotivo(mCounts),
      rewards: { tasaAvance: _r2(rTasa), motivoDiversidad: _r2(rDiversidad), lstmSorpresa: _r2(rLSTM), total: rInst },
    };
  }

  // Distancia global al cierre de sesión (últimos 5 segundos)
  const tFin = eventos[eventos.length - 1]?.t ?? 0;
  const recientes = eventos.filter(e => e.t >= tFin - 5000);
  const posArr = [...new Set(recientes.map(e => e.id))].map(id => {
    const last = recientes.filter(e => e.id === id).at(-1);
    return last?.pos ?? 0;
  });
  const distanciaFinal = posArr.length >= 2 ? Math.max(...posArr) - Math.min(...posArr) : 0;
  const rDistancia = _gaussian(distanciaFinal, TARGET.distancia, 6);

  // Total ponderado
  const instRewards = Object.values(byId).map(i => i.rewards.total);
  const instMedia   = instRewards.reduce((s, r) => s + r, 0) / Math.max(1, instRewards.length);
  const total       = _r2(instMedia * 0.65 + rDistancia * 0.35);

  // Diagnóstico legible
  const diagnostico = _diagnostico(byId, distanciaFinal, total);

  return { total, distanciaFinal, rDistancia: _r2(rDistancia), porInstrumento: byId, diagnostico };
}

// ── Texto explicativo ─────────────────────────────────────────────────────────

export function explicarReward(resultado) {
  if (!resultado) return 'sin datos';
  const lineas = [`REWARD TOTAL: ${resultado.total > 0 ? '+' : ''}${resultado.total}`];
  for (const [id, data] of Object.entries(resultado.porInstrumento || {})) {
    lineas.push(`  [${id}] r=${data.rewards.total}  diversidad=${data.diversidad}  lstm=${data.lstmMedia}  tasa=${data.tasaAvance}`);
  }
  if (resultado.distanciaFinal !== undefined) {
    lineas.push(`  distancia final: ${resultado.distanciaFinal} patrones (target: ${TARGET.distancia})`);
  }
  if (resultado.diagnostico?.length) {
    lineas.push('  ---');
    resultado.diagnostico.forEach(d => lineas.push(`  ${d}`));
  }
  return lineas.join('\n');
}

// ── Internos ──────────────────────────────────────────────────────────────────

function _gaussian(x, mu, sigma) {
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

function _r2(v) {
  return Math.round((v ?? 0) * 100) / 100;
}

function _topMotivo(counts) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
}

function _diagnostico(byId, distanciaFinal, total) {
  const msgs = [];
  if (total < 0) msgs.push('⚠ reward negativo: sistema en estado de baja calidad musical');

  for (const [id, d] of Object.entries(byId)) {
    if (d.diversidad < 0.3)
      msgs.push(`${id}: maduración domina (${Math.round((1-d.diversidad)*100)}%) — MARL debería explorar más motivos`);
    if (d.lstmMedia < 0.08)
      msgs.push(`${id}: LSTM casi sin sorpresa (${d.lstmMedia}) — modelo convergió demasiado rápido`);
    if (d.tasaAvance < 0.03)
      msgs.push(`${id}: avance muy lento (${d.tasaAvance}) — revisar umbrales de maduración`);
    if (d.gnnDeltaMedia < 0.01)
      msgs.push(`${id}: GNN inactivo — músicos demasiado sincronizados o pesos insuficientes`);
  }
  if (distanciaFinal < 3)
    msgs.push(`distancia final entre músicos: ${distanciaFinal} patrones — muy sincronizados para MARL`);
  if (distanciaFinal > 20)
    msgs.push(`distancia final: ${distanciaFinal} patrones — riesgo de ruptura de conjunto`);

  return msgs;
}
