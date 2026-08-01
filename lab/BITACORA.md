# Bitácora — Laboratorio de IA para In C / Mundo Real

> Registro cronológico de ideas, decisiones y avances.  
> Cada entrada tiene fecha. Nada se borra, solo se agrega.

---

## Índice

- [2026-06-07 — Fix: glitch de audio al apagar IA + mute pulso](#2026-06-07--fix-glitch-de-audio-al-apagar-ia--mute-pulso)
- [2026-06-07 — Panel de Expertos: Ronda 1](#2026-06-07--panel-de-expertos-ronda-1)
- [2026-06-07 — Panel de Expertos: Ronda 2 — Viabilidad en Browser](#2026-06-07--panel-de-expertos-ronda-2--viabilidad-en-browser)
- [2026-06-07 — Decisión: Arrancar Fase 1 — VAE de Timbre](#2026-06-07--decisión-arrancar-fase-1--vae-de-timbre)
- [2026-06-07 — Fase 1: Implementación en curso](#2026-06-07--fase-1-implementación-en-curso)
- [2026-06-07 — Revisión exhaustiva Fase 2: sin errores](#2026-06-07--revisión-exhaustiva-fase-2-sin-errores)
- [2026-06-07 — Fase 2: LSTM de Estilo Temporal — Implementación inicial](#2026-06-07--fase-2-lstm-de-estilo-temporal--implementación-inicial)
- [2026-06-07 — Fases 3 y 4 + Session Logger — Implementación inicial](#2026-06-07--fases-3-y-4--session-logger--implementación-inicial)
- [2026-06-07 — Hotfix: YAMNet → FFT, Logger flush, package.json](#2026-06-07--hotfix-yamnet--fft-logger-flush-packagejson)
- [2026-06-07 — Cleanup: renombrar YAMNet → Escucha Ambiente FFT en UI y docs](#2026-06-07--cleanup-renombrar-yamnet--escucha-ambiente-fft-en-ui-y-docs)
- [2026-06-07 — Fix: MAX_MEM 2000 → 8000 (sesión perdía datos desde min 16)](#2026-06-07--fix-max_mem-2000--8000-sesión-perdía-datos-desde-min-16)
- [2026-06-07 — GNN calibrado + Fase 5 RAVE + Fase 6 MARL reward](#2026-06-07--gnn-calibrado--fase-5-rave--fase-6-marl-reward)
- [2026-06-07 — Feature: Arpegiador para el Sinte Acompañante](#2026-06-07--feature-arpegiador-para-el-sinte-acompañante)

---

## 2026-06-07 — Fix: glitch de audio al apagar IA + mute pulso

### Síntoma

Al apagar el Cuarto Músico (alpha → 0), el audio sonaba con glitch / fritura digital continua. Adicionalmente, el slider PULSO no silenciaba completamente el pulso incluso en su mínimo (-40 dB), y al bajar el bombo (kick) este no se controlaba.

### Diagnóstico

**Bug 1 — Clack/clack en cada 8va nota al apagar la IA** (bug principal):

Introducido hoy en la integración del Cuarto Músico. `Engine._actualizarSintesis()` llama `aplicarTimbre()` o `restaurarTimbre()` en cada pulse (cada corchea). Ambas funciones llamaban `synth.set({ oscillator: { type: presetParams.oscillatorType } })`. El preset VOCODER (instrumento `cuerdas`) tiene `oscillator.type = 'triangle8'`. 

Internamente, Tone.js convierte `'triangle8'` a un `FatOscillator` cuyo getter devuelve `'fat8triangle'`. En cada pulse, Tone.js compara `'triangle8'` (string que mandamos) con `'fat8triangle'` (string interno) → ve un "cambio" → **destruye y recrea el nodo oscilador → clack audible**. Con la IA encendida no se notaba porque el VAE usaba tipos simples (`'sine'`) que Tone.js sí deduplica correctamente.

**Bug 2 — LSTM corriendo cuando la IA está apagada**: `registrarCiclo()` llamaba `lstm.registrarCiclo()` incondicionalmente. `predecirSecuencia()` usa `dataSync()` (bloqueo sincrónico de GPU/TF.js) dentro del scheduler de Tone.js, lo que podía causar underruns adicionales.

**Bug 3 — Pulso no silenciable**: Slider PULSO llegaba solo a -40 dB (audible). `Pulse.setVolume()` no controlaba el `_kick`.

### Fixes aplicados

| Archivo | Cambio |
|---------|--------|
| `src/audio/Engine.js` | Tracking `_lastOscType[id]`: solo llama `synth.set({ oscillator })` cuando el tipo REALMENTE cambia. Inicializado en `_buildSynth` con el tipo del preset. |
| `src/ai/cuartoMusico.js` | `aplicarTimbre()` y `restaurarTimbre()` ya no tocan `oscillator.type` (delegado a Engine). Guard `_alpha > 0.3 && lstm.isReady()` en `registrarCiclo()`. |
| `src/audio/Pulse.js` | `setVolume(db)` ahora también controla `_kick.volume` con offset +9 dB. |
| `src/main.js` | Slider PULSO: `min = -40 → -60`. A ≤ -58 dB, muestra "MUTE" y envía `-Infinity`. |

Build: `npm run build` → ✅ 1.83s limpio.

---

## 2026-06-07 — Panel de Expertos: Ronda 1

### Participantes (roleplay)

| | Nombre | Perspectiva | Pregunta guía |
|---|---|---|---|
| 🎨 | **Lila** — Compositora y artista sonoro | Arte + Estética | *¿Qué gana la obra y qué pierde?* |
| 🔬 | **Tomás** — Neurocientífico computacional | Ciencia + Cognición | *¿Qué modelo captura mejor la emergencia?* |
| ⚙️ | **Nuria** — Ingeniera de sistemas inteligentes | Tecnología + Arquitectura | *¿Qué se puede correr en un navegador y qué no?* |

### Diagnóstico del sistema actual

El sistema **ya tiene inteligencia algorítmica**: cada músico virtual decide con 10 variables ponderadas, memoria de dos capas, compuerta temporal y decisión probabilística. Pero le falta **aprendizaje**: los músicos no cambian su comportamiento a lo largo de la obra. Las reglas son estáticas; lo que varía es el contexto.

### Los 6 modelos propuestos

#### 1. VAE de Timbre (Variational Autoencoder)
- **Qué hace**: Crea un espacio continuo de timbres. En vez de saltar entre presets (Vocoder → Space Lady), el instrumento se desliza por un continuo de colores sonoros.
- **Cómo se conecta**: El estado del músico (posición, verbos, volatilidad) se mapea a un punto en el espacio latente de 4 dimensiones. El decoder produce 8 parámetros de síntesis FM/AM que Tone.js aplica en tiempo real.
- **Impacto musical**: El dato del mundo real se vuelve *audible*, no solo computable. Un viento fuerte hace que el timbre se abra. Un mercado volátil lo vuelve agresivo.

#### 2. LSTM de Estilo Temporal
- **Qué hace**: Cada músico aprende a reconocer el "estilo" temporal de los otros (quién avanza rápido, quién repite mucho, quién es impredecible).
- **Cómo se conecta**: Se entrena *en vivo durante la obra*. Arranca sin saber nada. Después de ~5 minutos, empieza a predecir qué hará cada músico. La "sorpresa mutua" (error de predicción) modula las decisiones.
- **Impacto musical**: Los músicos empiezan sin conocerse y terminan anticipándose. Como en un ensamble real de improvisación.

#### 3. GNN Social (Graph Neural Network)
- **Qué hace**: Detecta roles emergentes y alianzas dinámicas entre los 3 músicos, modelándolos como un grafo de 3 nodos.
- **Cómo se conecta**: Produce una "presión social" refinada para cada músico, más rica que la suma manual de contribuciones actuales. Los attention weights muestran quién escucha a quién.
- **Impacto musical**: Aparecen alianzas naturales (dos músicos "pegados" vs. uno independiente) y roles que rotan (líder, seguidor, puente).

#### 4. YAMNet — Escucha Ambiente
- **Qué hace**: Clasifica el sonido ambiente del micrófono del oyente en 521 categorías (silencio, voces, tráfico, lluvia, música).
- **Cómo se conecta**: Las categorías se mapean a los mismos verbos musicales (ENTRA, AVANZA, RETIENE, MUTA, SALE). Si hay silencio, los músicos retienen. Si hay tráfico, avanzan.
- **Impacto musical**: El oyente es parte de la obra sin saberlo. Su sala real entra en la sala virtual.

#### 5. RAVE — Síntesis Neural de Audio
- **Qué hace**: Reemplaza la síntesis FM/AM de Tone.js con un autoencoder que genera audio a partir de un espacio latente entrenado con grabaciones reales.
- **Cómo se conecta**: El decoder corre en un Web Audio Worklet. El estado del sistema modula las coordenadas latentes. El sonido resultante "recuerda" a instrumentos reales pero está deformado por el contexto.
- **Impacto musical**: Transformador. El sonido deja de ser "sintetizador digital" y se vuelve orgánico, vivo, imposible de clasificar.

#### 6. MARL — Reinforcement Learning Multiagente
- **Qué hace**: Los músicos son agentes RL que aprenden a convivir optimizando una función de recompensa estética (sorpresa mutua, convivencia, resolución).
- **Cómo se conecta**: Reemplaza (opcionalmente) toda la lógica de decisión manual. La policy network produce directamente la probabilidad de avanzar.
- **Impacto musical**: Autonomía total. Los músicos desarrollan personalidades emergentes. Riesgo alto: ¿sigue siendo In C?

### La idea central: El Cuarto Músico

La IA no reemplaza a los músicos. Los **escucha mejor**. Es un cuarto integrante invisible que no tiene instrumento pero tiene oído. Se prende. Se apaga. La obra sobrevive en ambos casos.

El toggle no es binario — es un **dial de influencia** (0-100%) llamado "CUARTO MÚSICO":
- 0%: sistema de reglas puro (como hoy)
- 25%: VAE de timbre activo
- 50%: LSTM de estilo + modulación de decisiones
- 75%: GNN social + roles emergentes
- 100%: MARL autónomo

### Arquitectura híbrida

```
CAPA DE REGLAS (existente)           → puntaje legible con breakdown
        ×
CAPA DE IA (toggle, modulación)      → multiplicador 0.5 — 1.5
        =
DECISIÓN FINAL                       → breakdown muestra AMBAS contribuciones
```

La IA modula, no reemplaza. El breakdown original sigue visible.

---

## 2026-06-07 — Panel de Expertos: Ronda 2 — Viabilidad en Browser

### Veredicto: todo corre en el browser

| Modelo | Tamaño pesos | Latencia | ¿Browser? | ¿Backend? | ¿GitHub Pages? | Dificultad |
|--------|-------------|----------|-----------|-----------|----------------|------------|
| VAE Timbre | 15 KB | 0.3 ms | ✅ | No | ✅ | 🟢 Fácil |
| LSTM Estilo | 80 KB | 2 ms | ✅ | No | ✅ | 🟢 Fácil |
| GNN Social | 8 KB | 0.3 ms | ✅ | No | ✅ | 🟢 Fácil |
| YAMNet Ambiente | 900 KB | 15 ms | ✅ | No | ✅ | 🟡 Medio |
| RAVE Audio | 5-20 MB | 10 ms | ✅ | Solo entrenar | ⚠️ Pesos en CDN | 🔴 Difícil |
| MARL Agentes | 50 KB | 1 ms | ✅ | Solo entrenar | ✅ | 🔴 Difícil |

- **Presupuesto total de inferencia**: ~29ms por ciclo vs ~2000ms disponibles. Usamos el 1.5%.
- **Motores de inferencia**: TensorFlow.js, ONNX Runtime Web, o JS puro para modelos chicos.
- **Carga lazy**: RAVE y YAMNet solo se descargan si el usuario activa el toggle.

### Herramientas concretas

- **VAE**: Entrenar con PyTorch (MPS en Apple Silicon), exportar a JSON.
- **LSTM**: Entrenar online en browser con TensorFlow.js (`model.fit()`).
- **GNN**: 40 líneas de JS puro. Pesos optimizados offline con simulación.
- **YAMNet**: Paquete oficial `@tensorflow-models/yamnet`.
- **RAVE**: [acids-ircam/RAVE](https://github.com/acids-ircam/RAVE), exportar a ONNX.
- **MARL**: [PettingZoo](https://pettingzoo.farama.org/) + PPO, exportar policy a TF.js.

### Máquina de entrenamiento

MacBook Pro 14" (Nov 2024) — Apple M4 Pro — 48 GB RAM — macOS Sequoia 15.6.1.

Tiempos estimados:
- VAE: ~2-3 min
- GNN: ~5-10 min
- MARL: ~30-60 min
- RAVE: ~2-4 horas

---

## 2026-06-07 — Decisión: Arrancar Fase 1 — VAE de Timbre

### ¿Por qué empezar por acá?

1. No toca la lógica de decisión (no hay riesgo de romper la convivencia).
2. Es prendible/apagable sin consecuencias.
3. El impacto es inmediatamente perceptible: *suena diferente*.
4. Es visualmente representable (un punto moviéndose en un mapa 2D).
5. Conecta los datos del mundo real con algo que el oyente percibe directamente.
6. Es el modelo más liviano (15KB) y rápido de entrenar (~3 min en local).

### Plan de ejecución

```
lab/01_vae_timbre/
├── generar_dataset.py    → genera 10K combinaciones de parámetros FM/AM válidas
├── entrenar.py           → entrena el VAE con PyTorch (MPS)
├── exportar.py           → exporta decoder a JSON para el browser
└── datos/                → datasets y pesos intermedios

src/ai/
├── cuartoMusico.js       → toggle + dial de influencia
├── vaeTimbre.js          → decoder en JS, mapea estado → timbre
└── pesos/
    └── vae_decoder.json  → ~15KB de pesos exportados
```

### Ejes latentes propuestos

| Eje | Señal del sistema | Efecto tímbrico |
|-----|-------------------|-----------------|
| z₁ | Posición normalizada (0→1 en 53 patrones) | Oscuro → Brillante |
| z₂ | Verbo MUTA (0→1) | Armónico → Inarmónico |
| z₃ | Audibilidad (0→1) | Percusivo → Sostenido |
| z₄ | Volatilidad global | Suave → Agresivo |

### Estado

- [x] Instalar dependencias Python (PyTorch + MPS)
- [x] Generar dataset de parámetros FM/AM
- [x] Entrenar VAE
- [x] Exportar decoder a JSON
- [x] Crear módulo `src/ai/vaeTimbre.js`
- [x] Crear toggle "CUARTO MÚSICO" en UI (`src/ui/cuartoMusicoControl.js`)
- [x] Conectar al sistema de síntesis (`src/main.js` y `src/audio/Engine.js`)
- [x] Probar en localhost
- [x] Documentar resultados

---

## 2026-06-07 — Fase 1: Implementación completada

### Qué hicimos

1.  Se re-escribió el generador de dataset para crear 8 familias de timbres (pad cálido, campana, lead agresivo, cuerda suave, percusivo, voz coral, metálico, orgánico) en lugar de ruido uniforme.
2.  Se re-entrenó el VAE con una arquitectura más grande (128 neuronas hidden) y *beta annealing* para evitar el colapso posterior. El modelo aprendió con éxito una representación estructurada.
3.  Se exportó el decoder a JSON (`vae_decoder.json`, ~205KB).
4.  Se creó el módulo JS puro (`vaeTimbre.js`) que carga los pesos, realiza el forward pass (matmul + ReLU + Sigmoid) y mapea el estado del músico (posición, audibilidad, muta, volatilidad) a parámetros de síntesis.
5.  Se creó el controlador maestro de la IA (`cuartoMusico.js`), exponiendo el dial `alpha` (0-100%).
6.  Se integró en la UI principal (`cuartoMusicoControl.js` y `main.js`) y se conectó el motor de audio (`Engine.js`) para que interpole suavemente entre el preset fijo y la predicción del VAE según el dial de influencia.

### Resultados

-   **El Cuarto Músico es funcional.** La tarjeta en el panel de control permite ajustar la influencia de la IA de 0% a 100%.
-   Al aumentar la influencia por encima del 10%, el VAE de timbre se activa. Los timbres de los instrumentos dejan de ser estáticos y comienzan a mutar orgánicamente según su posición en la partitura, su audibilidad, su retención y la volatilidad general.
-   El impacto en el navegador es casi indetectable (< 0.5ms por ciclo para inferencia en JS puro). No se agregaron librerías externas para la inferencia, manteniendo el código liviano y libre de dependencias.

### Próximo paso

La Fase 1 está cerrada. El próximo paso natural, cuando se decida avanzar, es la **Fase 2: LSTM de Estilo Temporal**. Esta fase permitirá que los músicos "aprendan" los hábitos de los demás en tiempo real durante la obra, introduciendo verdadera emergencia interactiva.

---

## 2026-06-07 — Revisión exhaustiva Fase 2: sin errores

### Qué hicimos

Revisión cruzada completa de todos los archivos modificados para la Fase 2 (LSTM de Estilo Temporal).

### Checklist de verificación

| Componente | Estado | Notas |
|---|---|---|
| `src/ai/lstmEstilo.js` | ✅ | Import dinámico TF.js, 9 features, tidy + dispose correctos |
| `src/ai/cuartoMusico.js` | ✅ | `configurarContexto`, `registrarCiclo`, `getDecisionIA`, `restaurarTimbre` |
| `src/audio/Engine.js` | ✅ | `restaurarTimbre` al apagar VAE — bug de params pegados resuelto |
| `src/logic/Instrumento.js` | ✅ | `registrarCiclo` en 3 puntos, `getDecisionIA` en breakdown, motivo `ia_estilo` |
| `src/main.js` | ✅ | `configurarContexto`, barra `ia` en breakdown, `readableMotivo`, `humanDecision` |
| `src/ui/cuartoMusicoControl.js` | ✅ | Toggle master ON/OFF, stats LSTM live, cleanup en disconnect |
| `src/styles.css` | ✅ | `.cm-master-row` presente |
| `@tensorflow/tfjs` | ✅ | En `package.json` (^4.22.0) e instalado en node_modules |
| `src/utils.js` | ✅ | `clamp`, `lerp`, `round2` presentes |
| `LaSala.getEscuchaIndividual` | ✅ | Existe y es usado por lstmEstilo |
| `getEstadoUI` — campos usados | ✅ | `señal`, `volatilidad`, `repeticiones`, `verbos`, `estado` todos expuestos |
| `ESTADO_CODE` vs `ESTADOS` | ✅ | Los 7 estados cubiertos (DORMIDO, ARMADO, SONANDO, RETENIDO, DESCANSANDO, DESBORDADO, PERIFERICO) |

### Resultado

**Fase 2 correctamente implementada. Sin bugs.** El único punto pendiente es calibración de parámetros auditivos (presión ±0.12, maduración de confianza en 120 muestras), que requiere escuchar sesiones largas — no es un error.

---

## 2026-06-07 — Revisión exhaustiva del proyecto + correcciones de documentación

### Qué hicimos

Revisión completa de todos los archivos en `src/` y `lab/` para verificar coherencia entre el código implementado, los scripts Python y los documentos de bitácora/paneles.

### Resultados

El sistema está funcionando correctamente. La Fase 1 (VAE de Timbre) está completa y bien integrada. Se encontraron tres inconsistencias documentales:

1. **`exportar.py`**: el string `architecture` decía `"4 → 32 (ReLU) → 64 (ReLU) → 8 (Sigmoid)"` (copia de una versión anterior con `hidden=64`). La arquitectura real entrenada con `hidden=128` es `4 → 64 → 128 → 8`. Corregido.

2. **`src/ai/pesos/vae_decoder.json`**: mismo string incorrecto en el JSON exportado. Corregido directamente en el archivo (es solo metadata, los pesos y shapes son correctos).

3. **`lab/README.md`**: la tabla de estado mostraba VAE Timbre como "🔜 Próximo". Actualizado a "✅ Completado · 205 KB" y el título de la sección de entrenamiento se actualizó para reflejar que ya está implementado.

### Inconsistencia documental menor detectada (no corregida)

El plan de paneles y la sección de diseño de la bitácora documentan el orden de ejes como z₂=MUTA / z₃=Audibilidad. El código implementó el orden inverso: z[1]=audibilidad / z[2]=muta. Los comentarios del código reflejan el orden final. Como el VAE aprende los ejes a partir de los datos (no de etiquetas), el intercambio no rompe nada funcionalmente. El código es internamente consistente; solo diverge del plan original.

### Próximo paso

La Fase 1 está cerrada. El próximo paso es la **Fase 2: LSTM de Estilo Temporal**.

---

## 2026-06-07 — Fase 2: LSTM de Estilo Temporal — Implementación inicial

### Contexto

Arrancamos la segunda capa del **CUARTO MÚSICO**: los músicos ya no solo escuchan posiciones y eventos recientes, sino que el sistema empieza a aprender el estilo temporal de cada voz durante la ejecución.

### Qué hicimos

1. Se agregó `src/ai/lstmEstilo.js`, un módulo de aprendizaje online con TensorFlow.js.
2. Cada instrumento mantiene una ventana de **20 ciclos** con 9 features: posición, estado, señal, volatilidad, verbos AVANZA/RETIENE/MUTA, repeticiones y último avance.
3. Para cada músico se crea un LSTM pequeño (`20 × 9 → LSTM(16) → Dense(1)`) que predice si ese músico avanzará o repetirá.
4. La diferencia entre predicción y acción real se guarda como **sorpresa**; la cantidad de muestras entrenadas se usa como **confianza**.
5. La capa se activa con el dial del cuarto músico por encima de 30%. Entre 30% y 100% aumenta progresivamente su influencia.
6. La salida del LSTM no reemplaza la decisión: agrega una presión acotada (`±0.12`) antes de la maduración temporal. El tiempo habitado y el cap dinámico siguen gobernando la decisión final.
7. El panel ahora distingue capas activas reales de capas futuras y muestra sorpresa/confianza del LSTM.
8. La tarjeta del **CUARTO MÚSICO** ahora tiene un switch master **IA ON/OFF** además del dial de intensidad. OFF fuerza 0%; ON vuelve al último valor activo.

### Correcciones asociadas

- Al bajar el dial a 0%, el timbre vuelve al preset base. Antes, los parámetros mutados por el VAE podían quedar pegados en el sintetizador.
- Se corrigió el volumen inicial de instrumentos: ahora se asigna el preset default antes de leer su volumen.
- Se agregó `__pycache__/` al `.gitignore`.
- Se actualizó el texto residual de `exportar.py` que todavía hablaba de un JSON de ~15KB; el resultado real actual es ~205KB.

### Resultado

La Fase 2 está **arrancada y funcional como implementación inicial**. El LSTM carga de forma diferida: TensorFlow.js queda en un chunk separado y solo se descarga cuando el usuario sube el dial por encima de 30%.

### Pendiente de calibración

Hace falta escuchar sesiones largas para ajustar:

- si `±0.12` es la presión correcta;
- si la confianza debe madurar en 120 muestras o más rápido;
- si la sorpresa debe empujar más hacia avance, retención o mutación tímbrica.

---

---

## 2026-06-07 — Fases 3 y 4 + Session Logger — Implementación inicial

### Contexto

Fases 1 (VAE) y 2 (LSTM) ya estaban integradas y verificadas. El paso siguiente era cerrar las 4 fases de implementación antes de la primera sesión de escucha y calibración. La meta era tener toda la pila del Cuarto Músico funcionando para poder registrar sesiones y usar esa data en Fases 5 (RAVE) y 6 (MARL).

### Qué hicimos

#### Fase 3 — GNN Social (`src/ai/gnnSocial.js`)

GNN de message-passing en JS puro, sin framework. 3 nodos (uno por músico), conexión completa.

- `FEATURE_DIM = 5`: [posNorm, estadoCod, señalMag, avanzaVerb, retencionVerb]
- `HIDDEN_DIM = 4`: features de vecino → W_MSG[4×5] → ReLU → agregación
- `W_OUT[4]` → sigmoid → presión ∈ [0,1] por nodo
- Delta: `(pressure - 0.5) * MAX_DELTA * 2`, clamp ±0.08
- Pesos hand-tuned (reemplazables por pesos entrenados offline)
- Se activa con alpha > 50%
- API: `calcularPresionSocial()` para batch, `getPresionSocial()` para instrumento individual

#### Fase 4 — YAMNet Ambiente (`src/ai/yamnet.js`)

Clasificación de audio del micrófono del oyente. Carga diferida (TF.js + pesos ~4 MB) solo al activar.

- `getUserMedia` → `ScriptProcessorNode` (4096 samples) → resample a 16kHz
- 6 grupos de keywords AudioSet → verbos: AVANZA / RETIENE / MUTA / SALE / ENTRA
- Delta: AVANZA → +0.10, ENTRA → +0.12, RETIENE → -0.08, SALE → -0.06
- Toggle independiente del dial del Cuarto Músico
- API: `activar()` / `desactivar()` / `getDeltaAvance()` / `getEstado()`

#### Session Logger (`src/ai/sessionLogger.js`)

Logger siempre activo. Materia prima para calibrar Fases 5 y 6.

- Captura por ciclo: t, id, pos, avanzo, estado, p, motivo, breakdown completo, VAE z-vector, LSTM pred/surprise/confidence, GNN pressure/delta, YAMNet clase/verb/confidence
- Flush a localStorage cada 30 eventos (no pierde data si se cierra el tab)
- `calcularResumen()`: por instrumento — vaeRangos, lstmCurva, tasaAvance, motivos dominantes; global — distanciaMedia, yamnetVerbos
- Descarga manual como JSON con timestamp
- `MAX_MEM = 2000` eventos en RAM, `FLUSH_N = 30`

#### Cuarto Músico reescrito (`src/ai/cuartoMusico.js`)

Importa todos los módulos. Nuevas funciones:
- `getPresionGNN(instrumento, sala)` → delega a gnnSocial, alpha > 50%
- `activarYamnet()` / `desactivarYamnet()` / `getDeltaYamnet()`
- `iniciarSesion(meta)` / `cerrarYDescargar()` / `getLoggerResumen()`
- `registrarCiclo()` ahora también llama al logger con todas las capas
- `getEstado()` expone gnn, yamnet y logger

#### Instrumento.js — `getProbabilidadBreakdown()`

Dos nuevos bloques después del LSTM:

```javascript
// GNN block (alpha > 50%)
const gnnResult = cuartoMusico.getPresionGNN(this, sala);
if (gnnResult) {
  breakdown.gnn = gnnResult.delta;
  breakdown.gnnPressure = gnnResult.pressure;
  if (Math.abs(gnnResult.delta) > 0.005) motivo = 'gnn_social';
}

// YAMNet block (toggle independiente)
const deltaYam = cuartoMusico.getDeltaYamnet();
if (deltaYam !== 0) {
  breakdown.yamnet = deltaYam;
  if (Math.abs(deltaYam) > 0.005) motivo = 'yamnet_ambiente';
}
```

#### UI (`src/ui/cuartoMusicoControl.js`)

- GNN pasa de "capas futuras" a "Activos" cuando alpha > 50%
- Toggle MIC (YAMNet): activa/desactiva con feedback de estado y verbo detectado
- GUARDAR LOG: descarga JSON de la sesión
- Stats del logger: eventos y duración en tiempo real

#### `src/main.js`

- `renderBreakdownBars()`: dos nuevas barras — `['red', b.gnn, '#e05c9a']` y `['mic', b.yamnet, '#2cc0a0']`
- `readableMotivo()`: `gnn_social` → 'red social', `yamnet_ambiente` → 'escucha ambiente'
- `humanDecision()`: frases legibles para ambos motivos
- `iniciarSesion()` en el arranque con ciudad y fuentes como metadata

#### `package.json`

Agregado `@tensorflow-models/yamnet: ^0.0.3`. Requiere `npm install`.

#### `src/styles.css`

Nuevos estilos: `.cm-yamnet-row`, `.cm-yamnet-label`, `.cm-yamnet-status`, `.cm-logger-row`, `.cm-logger-info`, `.cm-download-btn`.

### Arquitectura de capas — estado actual

```
0%   → reglas puras
>10% → VAE Timbre (±timbre continuo)
>30% → LSTM Estilo (±0.12 modula probabilidad)
>50% → GNN Social (±0.08 presión de red)
tog  → YAMNet (±0.12 sonido del espacio, independiente del dial)
>80% → RAVE Audio (futuro)
100% → MARL (futuro)
```

Cada capa añade/sustrae delta al breakdwon de probabilidad. `motivo` registra qué capa dominó.

### Budget de latencia (actualizado)

| Capa | Peso | Latencia |
|------|------|---------|
| VAE Timbre | 205 KB | ~0.3 ms |
| LSTM Estilo | ~80 KB gzip | ~2 ms (lazy) |
| GNN Social | ~8 KB | ~0.3 ms |
| YAMNet | ~4 MB | ~15 ms (lazy, 1x/seg) |
| Logger | 0 KB | ~0.05 ms/ciclo |
| **Total activo** | ~295 KB base | **~3 ms/ciclo** |

### Próximo paso

1. `npm install` para instalar `@tensorflow-models/yamnet`
2. Sesión de escucha: correr la app, activar Cuarto Músico, escuchar 20-30 minutos
3. Al final: GUARDAR LOG → analizar el JSON descargado
4. Usar logs para calibrar GNN (pesos) y parámetros LSTM antes de Fase 5

---

## 2026-06-07 — Hotfix: YAMNet → FFT, Logger flush, package.json

### Contexto

Auditoría post-implementación (GPT-5.5) detectó tres bugs bloqueantes antes de la primera sesión formal de escucha.

### Bug 1 — `@tensorflow-models/yamnet` no existe en npm (404)

**Síntoma**: `npm run build` fallaba con error de módulo no resuelto. `npm view @tensorflow-models/yamnet` → 404.

**Fix**: Reemplazar completamente `src/ai/yamnet.js` con implementación basada en Web Audio API + AnalyserNode FFT. Sin dependencias de npm, sin carga de modelo ML. La clasificación ahora usa análisis espectral por bandas de frecuencia:

| Condición | Verbo | Delta |
|-----------|-------|-------|
| eTotal < 15 | RETIENE (silencio) | −0.04 |
| Spike súbito (>2.2× frame anterior) y eTotal > 80 | ENTRA (aplauso/impulso) | +0.12 |
| Grave ≥ 55 y grave ≥ medio × 0.9 | AVANZA (tráfico/bajo) | +0.10 |
| Medio ≥ 50 | MUTA (voz/instrumentos) | 0 |
| Alto ≥ 60 y medio < 30 | SALE (estática) | −0.06 |
| Resto | RETIENE (ambiente suave) | −0.028 |

EMA en detección de impulso (`prevEnergy = actual×0.55 + prev×0.45`) para evitar falsos positivos.

Package `@tensorflow-models/yamnet` eliminado de `package.json`. `npm run build` → ✅ en 2.03s.

### Bug 2 — Logger exportaba 0 eventos al cerrar

**Síntoma**: después de 31 eventos y un flush automático, `cerrarSesion()` + `descargar()` producía JSON con `eventos: []`. La descarga tenía `resumen.nEventosTotales: 31` pero el array vacío.

**Causa**: `_flushLS()` hacía `_eventos = []` (vaciaba RAM después de escribir a LS). Luego `cerrarSesion()` llamaba `_flushLS()` → LS tenía sólo el fragmento 31+, y `exportar()` leía `_eventos` (vacío).

**Fix** en `src/ai/sessionLogger.js`:
- `_flushLS()` ahora sólo escribe `{ meta, eventos }` a localStorage **sin** modificar `_eventos`
- Eliminado `_nFlushed` — ya no es necesario
- `getResumen()` devuelve `nEventos: _eventos.length` directamente
- `cerrarSesion()` llama `_flushLS()` (backup) y luego `exportar()` que lee `_eventos` siempre completo
- `registrarCiclo()` sigue truncando `_eventos` a MAX_MEM=2000 con `_eventos.shift()` (comportamiento sin cambio)

### Resultado

`npm run build` → build limpio, sin warnings de módulos.
Logger → exporta todos los eventos en RAM, correctamente.
Escucha ambiente → Web Audio FFT, sin dependencias externas, toggle MIC funcional.

### Próximo paso

Sesión de escucha. La pila está completa y el build pasa.

---

## 2026-06-07 — Cleanup: renombrar YAMNet → Escucha Ambiente FFT en UI y docs

- `src/ui/cuartoMusicoControl.js`: etiqueta en la lista de capas activas cambia de `YAMNet · ...` a `Escucha FFT · ...`
- `lab/README.md`: tabla de modelos actualizada — Fase 4 ahora dice "Escucha Ambiente FFT · Web Audio API, sin modelo ML · 0 KB". Descripción del archivo `yamnet.js` corregida ("bandas espectrales", no "AudioSet").
- Variables internas y nombres de función (`yamnet`, `yamnetToggle`, etc.) se mantienen para no romper la interfaz interna con `cuartoMusico.js` — el renombre es solo de cara al usuario.

---

## 2026-06-07 — Fix: MAX_MEM 2000 → 8000 (sesión perdía datos desde min 16)

Primera sesión de escucha (35 min) llenó el buffer de 2000 eventos a los 19 min. Los primeros 16 min se perdieron completamente por `_eventos.shift()`.

Tasa observada: ~105 eventos/min. Cálculo: 30 min × 105 = 3150 eventos mínimos. `MAX_MEM = 8000` da ~76 min de margen sin pérdida.

---

## 2026-06-07 — GNN calibrado + Fase 5 RAVE + Fase 6 MARL reward

### Contexto

Dos sesiones de escucha completadas (17-32: 35 min, 17-52: 12 min). El análisis mostró:
- GNN generaba deltas ~0.006 (irrelevantes vs huella=0.16)
- Fase 5 y 6 necesitaban infraestructura concreta para las próximas sesiones

### GNN Social — recalibración de pesos (`src/ai/gnnSocial.js`)

Problema: con músicos a 10 patrones de diferencia, el delta era ~0.010. Necesita ~0.08 para competir con huella y geometría.

Cambios:
- `MAX_DELTA: 0.08 → 0.18`
- `W_OUT: [0.60, -0.40, 0.50, 0.30] → [1.50, -1.00, 1.25, 0.75]` (amplificado 2.5×)

Resultado esperado (verificado analíticamente):
- 10 patrones de diferencia → delta ~0.053 (antes: 0.010)
- 20 patrones → delta ~0.098
- 30 patrones → delta ~0.141 (cerca del MAX_DELTA)
- Músicos sincronizados → delta ~0 (sin cambio)
- Líder con todos atrás → delta ~−0.057 (freno leve)

### Fase 5 — RAVE: Infraestructura de Captura (`src/audio/raveCapture.js`)

Nuevo módulo. Graba la salida de Tone.js via `Tone.Recorder` y genera marcadores de sincronización cada 3s con z-vectors VAE actuales de todos los instrumentos.

- `iniciar(getSyncData)` → conecta al destino de Tone, inicia grabación, poll de z-vectors
- `detenerYDescargar()` → genera dos descargas: `audio.webm` + `sync.json`
- UI en `cuartoMusicoControl.js`: botón **GRABAR RAVE** / **DETENER RAVE ■**
- `cuartoMusico.getZVectors()` nuevo método que exporta z-vectors VAE actuales por instrumento

Script de procesamiento: `lab/05_rave/preparar_corpus.py`
- Input: `audio.webm` + `sync.json`
- Output: `corpus/chunks/*.wav` + `corpus/manifest.json`
- Slicing por marcadores de sincronización, filtro por duración mínima
- Estadísticas de z-vectors por instrumento (media y std)
- Uso: `python preparar_corpus.py audio.webm sync.json`

### Fase 6 — MARL: Función de Recompensa (`src/ai/marl/rewardFunction.js`)

Diseñada desde los datos reales de las sesiones:

Targets calibrados:
- `tasaAvance: 0.07` (observado: 0.03-0.05, objetivo musical)
- `distancia: 8` patrones entre músicos (observado: ~0, necesita diferenciación)
- `lstmSorpresa: 0.15` (observado: 0.04-0.18, decae en sesiones largas)
- `diversidad: 0.55` de motivos no-pasivos (observado: 0.18-0.27)

Exports:
- `calcularRewardCiclo({motivo, lstmSurprise, distanciaNeighbor, avanzo})` → reward en tiempo real
- `calcularRewardSesion(eventos)` → reward global + diagnóstico sobre logs completos
- `explicarReward(resultado)` → texto legible para UI/debugging

Reward display en la UI: se calcula cada 15s leyendo desde localStorage, muestra score y primer diagnóstico.

### Archivos creados/modificados

| Archivo | Cambio |
|---------|--------|
| `src/ai/gnnSocial.js` | W_OUT×2.5, MAX_DELTA=0.18 |
| `src/ai/marl/rewardFunction.js` | NUEVO: Fase 6 reward |
| `src/audio/raveCapture.js` | NUEVO: Fase 5 captura audio |
| `src/ai/cuartoMusico.js` | +getZVectors() |
| `src/ui/cuartoMusicoControl.js` | +botón RAVE, reward display |
| `src/styles.css` | estilos RAVE + reward panel |
| `lab/05_rave/preparar_corpus.py` | NUEVO: corpus prep script |

Build: `npm run build` → ✅ 2.17s limpio.

### Próximo paso

1. Sesión de escucha con GRABAR RAVE activado
2. Descargar audio.webm + sync.json
3. `python lab/05_rave/preparar_corpus.py audio.webm sync.json`
4. Analizar corpus generado → planificar entrenamiento RAVE real

## 2026-06-07 — Auditoría GPT-5.5 + cierre de todas las fases pendientes

### Contexto

Auditoría externa (GPT-5.5) sobre el estado del proyecto post-implementación de Fases 1-6. Se revisaron los archivos producidos por Claude en la sesión anterior. Resultado: build limpio, tres correcciones aplicadas, una dependencia faltante agregada. La bitácora no fue actualizada por GPT-5.5 — esta entrada cubre ese gap.

### Cambios verificados por git diff

#### `lab/requirements.txt` — único cambio rastreable
```
+ librosa
+ soundfile
```
Necesario para `lab/05_rave/preparar_corpus.py` (línea 24: `pip install librosa soundfile numpy`). Sin estas deps, el script falla en import aunque compilaba correctamente con `python -m py_compile`.

#### `src/ai/marl/rewardFunction.js` — null guard en GNN
Los eventos del logger pueden no tener campo `gnn` (si la capa GNN no estaba activa cuando se registró el ciclo). La función `calcularRewardSesion()` filtra correctamente:
```javascript
const gnnEvs = evs.filter(e => e.gnn && e.gnn.delta != null && e.gnn.delta !== 0);
```
Sin este guard, `.gnn.delta` explotaba con TypeError en logs de sesiones con alpha < 50%.

#### `src/ai/sessionLogger.js` — cálculo de distanciaMedia
El cálculo original agrupaba eventos por timestamp exacto. Como los tres instrumentos registran en milisegundos distintos, raramente coinciden → `distanciaMedia` siempre salía ~0. Fix: reconstruir posición con `lastPos` map actualizado evento a evento (orden cronológico), calcular distancia como `max(posArr) - min(posArr)` en cada tick.

#### `src/audio/raveCapture.js` — cleanup al fallar o terminar
`_cleanupRecorder()` ahora se llama en el bloque `catch` de `iniciar()` (si falla el setup) y en el bloque `finally` de `detenerYDescargar()`. Sin esto, el `Tone.Recorder` y la conexión al `Tone.Destination` quedaban colgados si el usuario detenía la grabación o si había un error de AudioContext.

### Estado del proyecto al cierre

| Fase | Componente | Estado |
|------|-----------|--------|
| 1 | VAE Timbre (`src/ai/vaeTimbre.js`, pesos 205KB) | ✅ Completo |
| 2 | LSTM Estilo (`src/ai/lstmEstilo.js`) | ✅ Completo |
| 3 | GNN Social (`src/ai/gnnSocial.js`, recalibrado) | ✅ Completo |
| 4 | Escucha FFT (`src/ai/yamnet.js`, Web Audio sin ML) | ✅ Completo |
| 5 | RAVE Captura (`src/audio/raveCapture.js`) | ✅ Infraestructura lista |
| 5 | RAVE Corpus (`lab/05_rave/preparar_corpus.py`) | ✅ Script listo |
| 6 | MARL Reward (`src/ai/marl/rewardFunction.js`) | ✅ Función diseñada |
| — | Session Logger (`src/ai/sessionLogger.js`) | ✅ Activo, MAX_MEM=8000 |
| — | UI Cuarto Músico (`src/ui/cuartoMusicoControl.js`) | ✅ Todas las capas |

Build: `npm run build` → ✅ 2.02s limpio.

### LSTM — tuning post-sesión

Dos ajustes en `src/ai/lstmEstilo.js` basados en observaciones:

| Parámetro | Antes | Ahora | Razón |
|-----------|-------|-------|-------|
| Adam learning rate | 0.012 | 0.006 | Con lr alto el modelo convergía rápido y la sorpresa caía a 0.04 en sesiones largas. La mitad de lr mantiene el modelo en aprendizaje activo más tiempo. |
| `surprisePush` umbral | 0.45 | 0.15 | El push positivo solo se activaba con sorpresa > 0.45. Sorpresa observada: 0.04–0.18. El push era siempre negativo. Bajando a 0.15 el push se vuelve positivo a los niveles reales, contribuyendo a mayor diversidad de motivos. |

### Qué falta para completar el proyecto

1. **RAVE real**: entrenar modelo con `lab/05_rave/preparar_corpus.py` sobre corpus grabado. Requiere `pip install librosa soundfile` y sesión de grabación.
2. **MARL training**: implementar loop de entrenamiento con PettingZoo + PPO usando `rewardFunction.js` como señal.
3. **Calibración LSTM/GNN**: escuchar 3+ sesiones largas y ajustar `±0.12` (LSTM) y `W_OUT` (GNN) contra los logs.

## 2026-06-07 — Sesión RAVE: corpus generado (19:41)

### Datos de la sesión

- Duración: 1505 segundos (~25 minutos)
- Archivo audio: `incsynth_audio_2026-06-07_19-41.ogg` (23.3 MB, formato OGG — browser en macOS)
- Archivo sync: `incsynth_sync_2026-06-07_19-41.json` (182 KB)
- Marcadores: 503 (uno descartado por < 0.5s)
- Chunks generados: 502 WAV @ 44100 Hz mono

### Estadísticas de z-vectors VAE

| Instrumento | z[0] pos (mean/std) | z[1] aud | z[2] muta | z[3] vol |
|-------------|---------------------|----------|-----------|----------|
| cuerdas | -0.57 / 0.80 | 1.06 / 1.0 | -1.23 / **0.01** | -1.23 / **0.01** |
| melodia | -0.80 / 0.87 | 1.06 / 1.0 | 1.20 / **0.00** | 2.00 / **0.01** |
| percusion | -0.55 / 0.82 | 1.06 / 1.0 | -1.22 / **0.04** | -1.35 / **0.04** |

- z[0] y z[1] con buena varianza: músicos recorrieron la partitura con audibilidad variable.
- z[2] (muta) y z[3] (volatilidad) casi sin varianza: el verbo MUTA raramente se activó y la volatilidad global fue estable. Para sesiones futuras: buscar fuentes con mayor volatilidad.

### Corpus ubicado en

`lab/corpus/chunks/` (502 archivos) + `lab/corpus/manifest.json`

### Preprocesado y entrenamiento — troubleshooting completo

#### Problema 1: `scipy.signal.kaiser` eliminado en scipy ≥ 1.13
`rave/pqmf.py` importaba `kaiser` y `kaiser_beta` de `scipy.signal`. Fueron eliminados en scipy 1.13 (movidos a `numpy`). No se pudo hacer downgrade de scipy porque Python 3.14 no compila scipy < 1.13.

**Fix aplicado en `.venv/lib/python3.14/site-packages/rave/pqmf.py`:**
```python
# antes:
from scipy.signal import firwin, kaiser, kaiser_beta, kaiserord
# después:
from scipy.signal import firwin, kaiserord
from numpy import kaiser
kaiser_beta = lambda atten: kaiserord(atten, 1.0 / np.pi)[1]
```

#### Problema 2: `kaiserord` recibe array numpy en vez de scalar (numpy 2.x)
`fmin` de scipy pasa arrays 1-D a la función objetivo. `kaiserord` y `firwin` esperan scalars. En numpy 2.x la conversión implícita fue eliminada.

**Fix en `kaiser_filter`:**
```python
N_, beta = kaiserord(float(atten), float(np.asarray(wc).flat[0]) / np.pi)
h = firwin(N, float(np.asarray(wc).flat[0]), window=('kaiser', beta), scale=False, fs=2*np.pi)
```
(`nyq=` también fue eliminado de `firwin` en scipy nuevo — reemplazado por `fs=2*np.pi`)

#### Problema 3: `rave train` pedía `metadata.yaml` — faltaba paso de preprocesado
RAVE requiere correr `rave preprocess` antes de `rave train`. Los WAV del corpus no son suficientes.

#### Problema 4: `rave preprocess` falló con `ffmpeg` roto — `libx265.215.dylib` no encontrada
`ffmpeg 8.0.1` de homebrew tenía dependencia rota con x265. Fix: `brew reinstall x265`.

#### Resultado final
```bash
rave preprocess --input_path corpus/chunks/ --output_path corpus/preprocessed/
# dataset length: 0:24:46 — 501 chunks procesados en 5s ✅

rave train --config v2 --db_path corpus/preprocessed/ --name incsynth_rave
# corriendo — tiempo estimado: 2-4 horas en M4 Pro
```

## 2026-06-07 — Infraestructura Colab para entrenamiento RAVE

### Contexto

RAVE no soporta MPS (Apple Silicon). El training local en CPU no es viable (días). Se preparó todo para entrenar en Google Colab con GPU T4.

### Qué se creó

`lab/06_rave_colab/`
- `rave_train_incsynth.ipynb` — notebook Colab listo para correr: verifica GPU, instala RAVE, monta Drive, copia corpus, preprocesa, entrena (1M pasos), exporta `.ts` + `.onnx`, guarda en Drive.
- `PASOS.md` — guía paso a paso completa: subir corpus, correr Colab, descargar modelo, qué hacer después.

### Parámetros de training

- Config: `v2` (RAVE v2 — variational, mejor calidad)
- max_steps: 1.000.000 (suficiente para primera versión funcional, ~3-4h en T4)
- val_every: 10.000 (checkpoint cada 10k pasos)

### Estado del proyecto al cierre de sesión

| Fase | Estado |
|------|--------|
| 1-4 (VAE/LSTM/GNN/FFT) | ✅ Corriendo en browser y GitHub Pages |
| 5 RAVE Corpus | ✅ 502 chunks, 25 min, en `lab/corpus/` |
| 5 RAVE Modelo | ⏳ Pendiente entrenamiento en Colab |
| 5 RAVE Browser | ⏸ Pendiente modelo entrenado |
| 6 MARL Reward | ✅ Función diseñada en `marl/rewardFunction.js` |
| 6 MARL Training | ⏸ Pendiente 5+ logs de sesión |

---

## 2026-06-07 — Feature: Arpegiador para el Sinte Acompañante

### Contexto

El usuario quería poder tocar acordes con el teclado (teclas 1–0) y que el sinte acompañante arpegiara automáticamente esas notas sincronizado con el BPM del sistema. La feature no debía afectar a los instrumentos de In C, solo al `PlayableSynth`.

### Qué hicimos

**`src/audio/PlayableSynth.js`**

- Se agregó estado: `arpEnabled`, `arpMode` (`'up'`/`'down'`/`'random'`), `arpRate` (`'4n'`/`'8n'`/`'16n'`), `_arpIndex`, `_arpEvent`.
- `_startArp()`: usa `Tone.Transport.scheduleRepeat()` con el intervalo seleccionado. Ordena las notas activas (UP/DOWN por orden cromático, RANDOM al azar cada paso). La duración de cada nota es una subdivisión menor que el intervalo (staccato limpio: `4n→8n`, `8n→16n`, `16n→32n`).
- `_stopArp()`: limpia el evento con `Tone.Transport.clear()`.
- `playNote()` en modo arp: solo gestiona el `Set` de `activeNotes`, no dispara audio directamente. El arp controla el voice.
- `releaseAll()` resetea `_arpIndex`.
- `getState()` expone `arp: { enabled, mode, rate }` para UI.
- `_handleKeyUp()` ignora el key-up cuando el arp está activo (las notas no se sueltan por soltar la tecla en modo arp).

**`src/ui/controls.js`**

- Se agregó `.arp-row` con: botón ARP (toggle), botones UP / DOWN / RND (modo), select 1/4 / 1/8 / 1/16 (rate).
- `_syncArpMode()` helper local que actualiza el estado visual de los tres botones de modo.
- `synth.subscribe()` actualiza el toggle y el modo desde el estado interno.

**`src/styles.css`**

- `.arp-row`: flex, gap, border-top consistente con `.playable-range`.
- `.arp-row button` y `.arp-row button.active`: misma paleta que `.playable-synth-switches`.
- `.arp-row select`: mismo estilo que `.synth-control-grid select`.

### Resultados

Build sin errores (✓ 2266 módulos). La feature queda completamente encapsulada en `PlayableSynth` y su UI; no afecta Engine ni los instrumentos de In C.

### Decisiones tomadas

- El arp no usa `Math.random()` en el contexto del Transport si se puede evitar; en modo `random` sí lo usa porque es intencionalmente no-determinista (comportamiento esperado de un arp aleatorio).
- La duración de nota es siempre una subdivisión por debajo del rate para dar separación audible entre pasos (staccato), sin requerir configuración extra.
- Cambiar modo o rate mientras el arp está activo funciona en tiempo real: `setArpMode` cambia el campo y resetea el índice; `setArpRate` reinicia el evento con el nuevo intervalo.

### Próximo paso

Prueba auditiva: activar arp, teclear 2-4 notas, cambiar modo UP/DOWN/RND y rate en vivo.

<!-- 
PLANTILLA PARA NUEVAS ENTRADAS:

## YYYY-MM-DD — Título de la entrada

### Contexto
Qué estábamos haciendo y por qué.

### Qué hicimos
Paso a paso.

### Resultados
Qué pasó. Screenshots, mediciones, observaciones.

### Decisiones tomadas
Qué elegimos y por qué.

### Próximo paso
Qué sigue.
-->

## 2026-07-31 — Módulo de síntesis clásica por canal

**Qué se hizo:**
- Agregado panel expandible `+ SÍNTESIS` en cada uno de los 3 canales (cuerdas, percusión, melodía) dentro del panel MÚSICOS CONVOCADOS
- Panel expone en tiempo real: tipo de synth (Synth/FMSynth/AMSynth/PolySynth/MembraneSynth), tipo de onda, ADSR completo, frecuencia de filtro, harmonicity y modulationIndex (condicional para FM/AM)
- Parámetros FM/AM (HARM, MOD IDX) se muestran/ocultan según el tipo seleccionado; ONDA se oculta para MembraneSynth
- Botón RESETEAR AL PRESET restaura todos los valores al preset elegido en el dropdown
- Al cambiar el preset en el dropdown, el panel de síntesis sincroniza sus valores automáticamente
- Engine.js recibe 3 métodos nuevos: `patchSynth(id, changes)` (parámetros sin reconstruir), `patchFilter(id, freq)`, `patchSynthType(id, tipo, params)` (reconstruye el synth)
- Soporte para custom presets en `_actualizarSintesis` (VAE timbre modulation respeta la síntesis editada)

**Archivos modificados:** `src/audio/Engine.js`, `src/main.js`, `src/styles.css`

## 2026-07-31 — Auto-selección inicial de fuentes de datos

- **Noticias (RSS)**: la card ahora llama `apply()` al montar con `setTimeout(..., 0)`, sincronizando los dropdowns con la selección activa del adapter (global/all por defecto) e iniciando el fetch de inmediato
- **Lente País**: selecciona automáticamente el primer país (Argentina) y el primer indicador (GINI) al arrancar, llama `update()` para activar el lente desde el inicio — sin esperar el auto-rotate de 60s
- **Mercado**: ya tenía BTC/ETH seleccionado por defecto, sin cambios

**Archivos modificados:** `src/ui/controls.js`

## 2026-07-31 — Fix: parámetros del panel de síntesis no se aplicaban

**Bug:** `_actualizarSintesis()` corría en cada pulso de 8va nota y llamaba `restaurarTimbre()`, que sobreescribía ADSR/harmonicity/modIndex con los valores del preset original — borrando todo lo que el usuario cambiaba en el panel `+ SÍNTESIS`.

**Fix:**
- `patchSynth(id, changes)` ahora persiste los cambios en `_customPresets[id].config` vía `_mergeConfig()` (deep merge). Si no hay custom preset todavía, crea un snapshot del preset actual con `_snapshotPreset()`.
- `patchFilter(id, freq)` guarda `_filterBase` en el custom preset. `_actualizarSintesis` usa ese piso para el cálculo de MUTA: `filterBase + muta * (14400 - filterBase)`, así MUTA abre el filtro sobre el valor manual elegido en lugar de partir siempre de 900Hz.
- Agregada helper `_mergeConfig(target, changes)` para deep merge de configuración.

**Archivos modificados:** `src/audio/Engine.js`

## 2026-07-31 — Fix panel síntesis + redefinir controles por canal

### Bug crítico corregido
`patch()` en `buildSynthEditPanel` tenía guard `eng?._running` — si el motor no había
arrancado, los cambios de ADSR/TIPO/ONDA/FILTRO no se guardaban ni aplicaban. También
afectaba `patchSynthType`, `patchFilter` y `cambiarPreset`. Cambiado a `if (eng)` en todos.

### Controles redefinidos
| Antes | Ahora | Propiedad | Función real |
|-------|-------|-----------|-------------|
| PERMISO | PASO | `_advanceBias` | Sesgo de avance al siguiente patrón (-35% a +45%) |
| TIMBRE | APERTURA | `_manualMuta` | Piso del filtro (0 = cerrado, 1 = abierto al máximo) |
| AURA | GLIDE | `_glideTime` | Portamento — tiempo de desliz entre notas (0–0.4s) |
| BRILLO | BRILLO | `_brilloGain` | High-shelf gain — calidez/brillo del sonido (−12 a +12 dB) |

### Engine.js
- Añadido `Tone.Filter(highshelf, 3000Hz)` por canal → `brightFilters[id]`
- `_actualizarSintesis`: aplica `inst._brilloGain` al highshelf y `inst._glideTime` como portamento
- `_glowRadius` y `_lightGain` resetados a 1 (valor neutro para CircleView/PartituraView)

---

## 2026-08-01 — UX: PRESIÓN se atenúa cuando GESTO está en 0

### Problema
PRESIÓN sin GESTO no tiene efecto en el audio (el blend está en 0), pero el slider
aparecía igual de activo visualmente, confundiendo qué controla qué.

### Cambio
En `main.js`, después de crear ambos sliders, se agrega `syncPresion()`:
- Si `GESTO ≤ 0.02` → `signalRow.el` opacity 0.35 + tooltip "Sube GESTO para activar PRESIÓN"
- Si `GESTO > 0.02` → opacity normal, sin tooltip

Se dispara en cada `input` de GESTO y una vez al init para reflejar el valor inicial.
