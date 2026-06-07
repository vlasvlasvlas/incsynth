# Bitácora — Laboratorio de IA para In C / Mundo Real

> Registro cronológico de ideas, decisiones y avances.  
> Cada entrada tiene fecha. Nada se borra, solo se agrega.

---

## Índice

- [2026-06-07 — Panel de Expertos: Ronda 1](#2026-06-07--panel-de-expertos-ronda-1)
- [2026-06-07 — Panel de Expertos: Ronda 2 — Viabilidad en Browser](#2026-06-07--panel-de-expertos-ronda-2--viabilidad-en-browser)
- [2026-06-07 — Decisión: Arrancar Fase 1 — VAE de Timbre](#2026-06-07--decisión-arrancar-fase-1--vae-de-timbre)
- [2026-06-07 — Fase 1: Implementación en curso](#2026-06-07--fase-1-implementación-en-curso)

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
