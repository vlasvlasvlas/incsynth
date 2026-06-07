# Lab — Laboratorio de IA para In C / Mundo Real

> **Si estás leyendo esto en una conversación nueva**: leé este archivo y `BITACORA.md` para recuperar todo el contexto.

## Qué es esto

Subproyecto de IA para la app [In C / Mundo Real](https://vlasvlasvlas.github.io/incysynth/). La app ya funciona sin IA. Este laboratorio agrega una capa opcional de inteligencia artificial que se prende/apaga con un dial llamado **"CUARTO MÚSICO"**.

## La idea en una oración

La IA no reemplaza a los músicos. Los escucha mejor. Es un cuarto integrante invisible que no toca pero tiene oído.

## Arquitectura

```
src/ai/           ← Módulos JS para browser (solo inferencia, ~150KB total)
lab/              ← Scripts Python para entrenar modelos (no se despliega)
lab/BITACORA.md   ← Registro completo de ideas, decisiones y avances
```

Todo corre en el browser. No hay backend. GitHub Pages sobrevive.

## Los 6 modelos (en orden de implementación)

| # | Modelo | Qué hace | Pesos | Estado |
|---|--------|----------|-------|--------|
| 1 | **VAE Timbre** | El timbre muta con el contexto | 205 KB | ✅ Completado |
| 2 | **LSTM Estilo** | Los músicos se "conocen" en vivo | sin pesos · TFJS lazy 305 KB gzip | 🟡 Implementación inicial |
| 3 | **GNN Social** | Roles emergentes (líder/seguidor) | 8 KB | 🟡 Implementación inicial |
| 4 | **Escucha Ambiente FFT** | El micrófono alimenta la obra (Web Audio API, sin modelo ML) | 0 KB | 🟡 Implementación inicial |
| 5 | **RAVE Audio** | Síntesis neural orgánica | 5-20 MB | 🟡 Infraestructura lista (captura + corpus) |
| 6 | **MARL Agentes** | Autonomía total con RL | 50 KB | 🟡 Función de reward implementada |

## Máquina de entrenamiento

MacBook Pro 14" (Nov 2024) — **Apple M4 Pro** — **48 GB RAM** — macOS Sequoia 15.6.1.  
PyTorch con MPS (Metal Performance Shaders) para GPU local.

## Cómo re-entrenar el VAE (Fase 1)

```bash
cd lab/01_vae_timbre
pip install -r ../requirements.txt
python generar_dataset.py
python entrenar.py
python exportar.py  # → genera src/ai/pesos/vae_decoder.json
```

## Estructura de carpetas

```
lab/
├── README.md              ← este archivo
├── BITACORA.md            ← registro cronológico completo
├── requirements.txt       ← dependencias Python compartidas
├── 01_vae_timbre/         ← Fase 1: VAE para espacio continuo de timbres
├── 02_lstm_estilo/        ← Fase 2: LSTM para estilo temporal
├── 03_gnn_social/         ← Fase 3: GNN para dinámica social
├── 04_yamnet/             ← Fase 4: Escucha ambiente con micrófono
├── 05_rave/               ← Fase 5: Síntesis neural RAVE
└── 06_marl/               ← Fase 6: Reinforcement Learning multiagente

src/ai/
├── cuartoMusico.js        ← Toggle + dial de influencia (0-100%)
├── vaeTimbre.js           ← Decoder VAE en JS
├── lstmEstilo.js          ← LSTM online de estilo temporal
├── gnnSocial.js           ← GNN social message-passing en JS puro
├── yamnet.js              ← Escucha ambiente FFT (Web Audio API, bandas espectrales)
├── marl/
│   └── rewardFunction.js  ← Función de recompensa MARL (Fase 6)
└── ...

src/audio/
├── Engine.js
├── raveCapture.js         ← Grabador de audio para corpus RAVE (Fase 5)
├── sessionLogger.js       ← Logger siempre activo, exporta JSON
└── pesos/                 ← JSONs con pesos exportados
```

## Documentos de referencia

- `lab/BITACORA.md` — Todo: paneles de expertos, decisiones, progreso paso a paso
- `README.md` (raíz) — Documentación general de la app
