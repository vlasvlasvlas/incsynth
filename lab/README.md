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
| 1 | **VAE Timbre** | El timbre muta con el contexto | 15 KB | 🔜 Próximo |
| 2 | **LSTM Estilo** | Los músicos se "conocen" en vivo | 80 KB | ⬜ Pendiente |
| 3 | **GNN Social** | Roles emergentes (líder/seguidor) | 8 KB | ⬜ Pendiente |
| 4 | **YAMNet Ambiente** | El micrófono alimenta la obra | 900 KB | ⬜ Pendiente |
| 5 | **RAVE Audio** | Síntesis neural orgánica | 5-20 MB | ⬜ Pendiente |
| 6 | **MARL Agentes** | Autonomía total con RL | 50 KB | ⬜ Pendiente |

## Máquina de entrenamiento

MacBook Pro 14" (Nov 2024) — **Apple M4 Pro** — **48 GB RAM** — macOS Sequoia 15.6.1.  
PyTorch con MPS (Metal Performance Shaders) para GPU local.

## Cómo entrenar (cuando esté implementado)

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
└── pesos/                 ← JSONs con pesos exportados
```

## Documentos de referencia

- `lab/BITACORA.md` — Todo: paneles de expertos, decisiones, progreso paso a paso
- `README.md` (raíz) — Documentación general de la app
