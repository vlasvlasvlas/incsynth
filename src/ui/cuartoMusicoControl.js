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

  const note = document.createElement('div');
  note.className = 'cm-note';
  note.textContent = 'Un escucha artificial que modula el sistema. Al 0%, la obra usa solo reglas manuales.';
  card.appendChild(note);

  const dialContainer = document.createElement('div');
  dialContainer.className = 'cm-dial-container';

  const dial = document.createElement('input');
  dial.type = 'range';
  dial.min = 0;
  dial.max = 100;
  dial.value = aiModule.getAlpha() * 100;
  dial.disabled = true; // disabled until ready
  
  const valDisplay = document.createElement('span');
  valDisplay.textContent = `${dial.value}%`;

  dial.addEventListener('input', () => {
    valDisplay.textContent = `${dial.value}%`;
    aiModule.setAlpha(dial.value / 100);
  });

  dialContainer.appendChild(dial);
  dialContainer.appendChild(valDisplay);
  card.appendChild(dialContainer);

  const activeModels = document.createElement('div');
  activeModels.className = 'cm-models';
  card.appendChild(activeModels);

  aiModule.subscribe((state) => {
    if (state.ready) {
      dial.disabled = false;
      const pct = Math.round(state.alpha * 100);
      status.textContent = `IA al ${pct}% de influencia`;
      
      let modelsText = [];
      if (pct > 10) modelsText.push('VAE Timbre');
      if (pct > 30) modelsText.push('LSTM Estilo (Próximamente)');
      if (pct > 50) modelsText.push('GNN Social (Próximamente)');
      if (pct > 80) modelsText.push('RAVE Audio (Próximamente)');
      if (pct === 100) modelsText.push('MARL Agentes (Próximamente)');
      
      activeModels.textContent = pct > 10 ? `Modelos activos: ${modelsText.join(' | ')}` : 'SISTEMA DE REGLAS PURO';
      activeModels.style.color = pct > 10 ? '#7289da' : '#888';
    } else {
      status.textContent = 'IA no disponible (solo reglas)';
    }
  });

  return card;
}
