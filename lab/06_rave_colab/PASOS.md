# Pasos completos — RAVE para In C / Mundo Real

Qué tenés que hacer vos, en orden.

---

## PARTE 1 — Subir corpus a Google Drive

El corpus ya está generado en tu máquina en `lab/corpus/chunks/` (502 archivos WAV).

1. Abrí Google Drive en el browser
2. Creá esta estructura de carpetas exacta:
   ```
   Mi unidad/
   └── incsynth/
       └── corpus/
           └── chunks/    ← acá van los 502 WAV
   ```
3. Subí todos los archivos de `lab/corpus/chunks/` dentro de `chunks/`
   - Son 502 archivos WAV, ~50 MB en total
   - Podés arrastrarlos todos juntos

---

## PARTE 2 — Correr el notebook en Google Colab

1. Abrí [colab.research.google.com](https://colab.research.google.com)
2. **Archivo → Subir notebook** → seleccioná `lab/06_rave_colab/rave_train_incsynth.ipynb`
3. **Activar GPU antes de correr:**
   - Entorno de ejecución → Cambiar tipo de entorno de ejecución → T4 GPU → Guardar
4. Corré las celdas **en orden**, de arriba a abajo (Shift+Enter en cada una)
5. En la Celda 3 te va a pedir autorización para acceder a Drive — aceptá
6. La **Celda 6 (training)** va a tardar **3-4 horas**. Dejá la pestaña abierta.
   - Colab desconecta sesiones inactivas después de ~90 min. Para evitarlo:
     podés hacer clic en la celda cada hora, o usar una extensión anti-idle.

**Al terminar:** la Celda 9 guarda el modelo en `Mi unidad/incsynth/rave_model/`

---

## PARTE 3 — Descargar el modelo entrenado

1. Abrí Google Drive
2. Ir a `Mi unidad/incsynth/rave_model/`
3. Descargar los archivos `.ts` y `.onnx` que aparezcan
4. Guardalos en `lab/06_rave_colab/modelo_entrenado/` (crear la carpeta)

---

## PARTE 4 — Avisarme a mí (Claude)

Con los archivos `.ts` y `.onnx` descargados, escribime:

> "Tengo el modelo RAVE entrenado, son estos archivos: [nombre.ts] [nombre.onnx]"

Yo me encargo de:
- Integrar el decoder ONNX en un Web Audio Worklet
- Conectarlo a `cuartoMusico.js` para que reemplace la síntesis FM de Tone.js
- Agregar el botón de activación en el panel del Cuarto Músico
- Deployar a GitHub Pages

---

## PARTE 5 — Después de integrar RAVE (futuro)

Una vez que RAVE esté corriendo en el browser:

### Mejorar el modelo con más corpus

Cada sesión que grabés con **GRABAR RAVE** agrega datos:
```bash
cd lab && source .venv/bin/activate
python 05_rave/preparar_corpus.py audio_nueva.ogg sync_nuevo.json --output corpus2/
```
Subir `corpus2/chunks/` a Drive y reentrenar.

### MARL (Fase 6 completa)

Cuando tengas 5+ sesiones de logs guardados (botón GUARDAR LOG), escribime.
Armo el script de entrenamiento con PettingZoo + PPO usando `rewardFunction.js`
como señal de recompensa.

---

## Estado actual del proyecto

| Fase | Componente | Estado |
|------|-----------|--------|
| 1 | VAE Timbre | ✅ Corriendo en browser |
| 2 | LSTM Estilo | ✅ Corriendo en browser |
| 3 | GNN Social | ✅ Corriendo en browser |
| 4 | Escucha FFT | ✅ Corriendo en browser |
| 5 | RAVE Captura | ✅ Corpus generado (502 chunks, 25 min) |
| 5 | RAVE Modelo | ⏳ Entrenar en Colab (este documento) |
| 5 | RAVE Browser | ⏸ Esperando modelo entrenado |
| 6 | MARL Reward | ✅ Función diseñada |
| 6 | MARL Training | ⏸ Esperando 5+ logs de sesión |
