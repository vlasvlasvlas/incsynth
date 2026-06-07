import * as raveCapture from '../audio/raveCapture.js';
import { calcularRewardSesion, explicarReward } from '../ai/marl/rewardFunction.js';

export function buildCuartoMusicoCard(aiModule) {
  const card = document.createElement('div');
  card.className = 'cuarto-musico-card';

  const header = document.createElement('h3');
  header.textContent = 'CUARTO MÚSICO';
  card.appendChild(header);

  const status = document.createElement('div');
  status.className = 'cm-status';
  status.textContent = 'Modelo cargando...';
  card.appendChild(status);

  // ── Master ON/OFF ─────────────────────────────────────────────────────────
  const masterRow = document.createElement('label');
  masterRow.className = 'cm-master-row';
  const masterToggle = document.createElement('input');
  masterToggle.type = 'checkbox';
  masterToggle.disabled = true;
  const masterText = document.createElement('span');
  masterText.textContent = 'IA OFF';
  masterRow.appendChild(masterToggle);
  masterRow.appendChild(masterText);
  card.appendChild(masterRow);

  const note = document.createElement('div');
  note.className = 'cm-note';
  note.textContent = 'Un escucha artificial que modula el sistema. Al 0%, la obra usa solo reglas manuales.';
  card.appendChild(note);

  // ── Dial ─────────────────────────────────────────────────────────────────
  const dialContainer = document.createElement('div');
  dialContainer.className = 'cm-dial-container';

  const dial = document.createElement('input');
  dial.type = 'range';
  dial.min = 0;
  dial.max = 100;
  dial.value = aiModule.getAlpha() * 100;
  dial.disabled = true;

  const valDisplay = document.createElement('span');
  valDisplay.textContent = `${dial.value}%`;
  let lastOnValue = Math.max(35, Number(dial.value) || 35);

  dial.addEventListener('input', () => {
    valDisplay.textContent = `${dial.value}%`;
    if (Number(dial.value) > 0) lastOnValue = Number(dial.value);
    aiModule.setAlpha(dial.value / 100);
  });

  masterToggle.addEventListener('change', () => {
    const nextValue = masterToggle.checked ? lastOnValue : 0;
    dial.value = String(nextValue);
    valDisplay.textContent = `${nextValue}%`;
    aiModule.setAlpha(nextValue / 100);
  });

  dialContainer.appendChild(dial);
  dialContainer.appendChild(valDisplay);
  card.appendChild(dialContainer);

  // ── Capas activas ─────────────────────────────────────────────────────────
  const activeModels = document.createElement('div');
  activeModels.className = 'cm-models';
  card.appendChild(activeModels);

  // ── MIC (Escucha FFT) ─────────────────────────────────────────────────────
  const yamnetRow = document.createElement('div');
  yamnetRow.className = 'cm-yamnet-row';

  const yamnetLabel = document.createElement('label');
  yamnetLabel.className = 'cm-yamnet-label';
  const yamnetToggle = document.createElement('input');
  yamnetToggle.type = 'checkbox';
  yamnetToggle.checked = false;
  const yamnetText = document.createElement('span');
  yamnetText.textContent = 'MIC OFF';
  yamnetLabel.appendChild(yamnetToggle);
  yamnetLabel.appendChild(yamnetText);

  const yamnetStatus = document.createElement('span');
  yamnetStatus.className = 'cm-yamnet-status';

  yamnetToggle.addEventListener('change', async () => {
    if (yamnetToggle.checked) {
      yamnetText.textContent = 'MIC activando...';
      yamnetToggle.disabled = true;
      const ok = await aiModule.activarYamnet();
      yamnetToggle.disabled = false;
      if (!ok) {
        yamnetToggle.checked = false;
        yamnetText.textContent = 'MIC OFF';
        yamnetStatus.textContent = 'sin acceso al micro';
      }
    } else {
      aiModule.desactivarYamnet();
      yamnetText.textContent = 'MIC OFF';
      yamnetStatus.textContent = '';
    }
  });

  yamnetRow.appendChild(yamnetLabel);
  yamnetRow.appendChild(yamnetStatus);
  card.appendChild(yamnetRow);

  // ── RAVE Capture ──────────────────────────────────────────────────────────
  const raveRow = document.createElement('div');
  raveRow.className = 'cm-rave-row';

  const raveBtn = document.createElement('button');
  raveBtn.className = 'cm-rave-btn';
  raveBtn.textContent = 'GRABAR RAVE';

  const raveInfo = document.createElement('span');
  raveInfo.className = 'cm-rave-info';

  raveBtn.addEventListener('click', async () => {
    if (raveCapture.isActive()) {
      raveBtn.disabled = true;
      await raveCapture.detenerYDescargar();
      raveBtn.disabled = false;
      raveBtn.textContent = 'GRABAR RAVE';
      raveInfo.textContent = '';
    } else {
      const ok = await raveCapture.iniciar(() => ({
        z_vectors: aiModule.getZVectors(),
        alpha:     aiModule.getAlpha(),
      }));
      if (ok) raveBtn.textContent = 'DETENER RAVE ■';
    }
  });

  raveRow.appendChild(raveBtn);
  raveRow.appendChild(raveInfo);
  card.appendChild(raveRow);

  // ── Logger + Reward ───────────────────────────────────────────────────────
  const loggerRow = document.createElement('div');
  loggerRow.className = 'cm-logger-row';

  const loggerInfo = document.createElement('span');
  loggerInfo.className = 'cm-logger-info';
  loggerInfo.textContent = 'log: 0 eventos';

  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'cm-download-btn';
  downloadBtn.textContent = 'GUARDAR LOG';
  downloadBtn.addEventListener('click', () => {
    aiModule.cerrarYDescargar();
  });

  loggerRow.appendChild(loggerInfo);
  loggerRow.appendChild(downloadBtn);
  card.appendChild(loggerRow);

  // ── Reward display ────────────────────────────────────────────────────────
  const rewardPanel = document.createElement('div');
  rewardPanel.className = 'cm-reward-panel';
  card.appendChild(rewardPanel);

  // ── Render ────────────────────────────────────────────────────────────────
  const render = (state = aiModule.getEstado?.() || {}) => {
    if (state.ready) {
      dial.disabled      = false;
      masterToggle.disabled = false;
      const pct = Math.round(state.alpha * 100);
      status.textContent   = `IA al ${pct}% de influencia`;
      masterToggle.checked = pct > 0;
      masterText.textContent = pct > 0 ? 'IA ON' : 'IA OFF';
      if (pct > 0) lastOnValue = pct;

      const active = [];
      const future = [];
      if (pct > 10) active.push('VAE Timbre');
      if (pct > 30) {
        if (state.lstm?.ready) {
          const sorpresa  = Math.round((state.lstm.avgSurprise  || 0) * 100);
          const confianza = Math.round((state.lstm.avgConfidence || 0) * 100);
          active.push(`LSTM Estilo · sorpresa ${sorpresa}% · confianza ${confianza}%`);
        } else {
          active.push(state.lstm?.loading ? 'LSTM Estilo cargando' : 'LSTM Estilo preparando');
        }
      }
      if (pct > 50) active.push('GNN Social');
      if (pct > 80) future.push('RAVE Audio');
      if (pct === 100) future.push('MARL Agentes');

      // Escucha FFT
      if (state.yamnet?.active) {
        const cls  = state.yamnet.clase || '—';
        const verb = state.yamnet.verb  || '';
        active.push(`Escucha FFT · ${cls} → ${verb}`);
        yamnetText.textContent   = 'MIC ON';
        yamnetToggle.checked     = true;
        yamnetStatus.textContent = verb ? `→ ${verb}` : '';
      } else if (!state.yamnet?.loading) {
        yamnetText.textContent   = 'MIC OFF';
        yamnetStatus.textContent = '';
      } else {
        yamnetText.textContent = 'MIC activando...';
      }

      const lines = [];
      if (active.length) lines.push(`Activos: ${active.join(' | ')}`);
      else lines.push('SISTEMA DE REGLAS PURO');
      if (future.length) lines.push(`Próximas capas: ${future.join(' | ')}`);
      activeModels.textContent = lines.join('\n');
      activeModels.style.color = pct > 10 ? '#7289da' : '#888';

      // Logger stats
      const logRes = state.logger;
      if (logRes) {
        loggerInfo.textContent = `log: ${logRes.nEventos} eventos · ${logRes.duracion_s}s`;
      }
    } else {
      status.textContent    = 'IA no disponible (solo reglas)';
      masterToggle.disabled = true;
      dial.disabled         = true;
    }

    // RAVE capture state
    const raveState = raveCapture.getEstado();
    if (raveState.active) {
      raveInfo.textContent = `grabando · ${raveState.markers} marcadores · ${raveState.duracion_s}s`;
    }
  };

  // Reward preview cada 15 segundos si hay suficientes datos
  const renderReward = () => {
    if (!card.isConnected) return;
    try {
      const resumen = aiModule.getLoggerResumen?.();
      if (resumen?.nEventos < 30) return;
      // Lee eventos del LS para calcular reward (sin requerir acceso a eventos en RAM)
      const snap = JSON.parse(localStorage.getItem('incsynth_session_log') || '{}');
      if (!snap.eventos?.length) return;
      const resultado = calcularRewardSesion(snap.eventos);
      const color  = resultado.total > 0.3 ? '#2cc0a0' : resultado.total > 0 ? '#7289da' : '#cc8800';
      rewardPanel.innerHTML = `<span style="color:${color};font-size:10px">reward sesión: ${resultado.total > 0 ? '+' : ''}${resultado.total}</span>`;
      if (resultado.diagnostico?.length) {
        const tip = resultado.diagnostico[0];
        rewardPanel.innerHTML += `<br><span style="color:#888;font-size:9px">${tip}</span>`;
      }
    } catch (_) {}
  };

  aiModule.subscribe(render);

  const interval = setInterval(() => {
    if (!card.isConnected) { clearInterval(interval); clearInterval(rewardInterval); return; }
    render();
  }, 1200);

  const rewardInterval = setInterval(renderReward, 15000);

  return card;
}
