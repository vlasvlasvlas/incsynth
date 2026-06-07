"""
Fase 1 — Paso 1: Generar dataset de parámetros de síntesis FM/AM válidos.

Genera N combinaciones de 8 parámetros que representan timbres musicales
usables. Filtra combinaciones que producirían sonidos inutilizables.

Parámetros generados (8 dimensiones):
  0. oscType     — tipo de oscilador [0,1] → sine(0), triangle(0.33), sawtooth(0.66), square(1)
  1. harmonicity — relación de frecuencia FM [0.5, 12]
  2. modIndex    — índice de modulación FM [0, 40]
  3. attack      — envolvente attack [0.001, 2.0] segundos
  4. decay       — envolvente decay [0.05, 3.0] segundos
  5. sustain     — envolvente sustain [0, 1]
  6. release     — envolvente release [0.1, 8.0] segundos
  7. filterCut   — frecuencia de corte del filtro [200, 12000] Hz

Cada parámetro se normaliza a [0, 1] para el entrenamiento del VAE.
"""

import numpy as np
import json
import os

N_SAMPLES = 12000
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "datos")

# Rangos reales de cada parámetro
RANGES = {
    "oscType":     (0.0,   1.0),
    "harmonicity": (0.5,  12.0),
    "modIndex":    (0.0,  40.0),
    "attack":      (0.001, 2.0),
    "decay":       (0.05,  3.0),
    "sustain":     (0.0,   1.0),
    "release":     (0.1,   8.0),
    "filterCut":   (200.0, 12000.0),
}

PARAM_NAMES = list(RANGES.keys())


def generate_raw():
    """Genera parámetros uniformemente distribuidos en sus rangos."""
    data = np.zeros((N_SAMPLES, len(PARAM_NAMES)))
    for i, name in enumerate(PARAM_NAMES):
        lo, hi = RANGES[name]
        data[:, i] = np.random.uniform(lo, hi, N_SAMPLES)
    return data


def filter_usable(data):
    """
    Descarta combinaciones que producirían sonidos inutilizables:
    - Modulación muy alta con onda cuadrada (ruido puro)
    - Attack muy largo con sustain 0 (no se escucha nada)
    - Filtro muy cerrado con onda simple (casi silencio)
    """
    keep = np.ones(len(data), dtype=bool)

    osc = data[:, 0]
    mod = data[:, 2]
    atk = data[:, 3]
    sus = data[:, 5]
    filt = data[:, 7]

    # Cuadrada (osc > 0.85) con modulación extrema (> 25) → ruido
    keep &= ~((osc > 0.85) & (mod > 25))

    # Attack > 1.5s con sustain < 0.05 → fantasma inaudible
    keep &= ~((atk > 1.5) & (sus < 0.05))

    # Filtro < 400 Hz con oscilador simple (sine, osc < 0.15) → casi silencio
    keep &= ~((filt < 400) & (osc < 0.15))

    return data[keep]


def normalize(data):
    """Normaliza cada columna a [0, 1] según los rangos definidos."""
    normed = np.zeros_like(data)
    for i, name in enumerate(PARAM_NAMES):
        lo, hi = RANGES[name]
        normed[:, i] = (data[:, i] - lo) / (hi - lo)
    return normed


def main():
    np.random.seed(42)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"Generando {N_SAMPLES} combinaciones de parámetros FM/AM...")
    raw = generate_raw()

    print("Filtrando combinaciones inutilizables...")
    usable = filter_usable(raw)
    print(f"  → {len(usable)} / {N_SAMPLES} sobrevivieron ({100*len(usable)/N_SAMPLES:.1f}%)")

    normed = normalize(usable)

    # Guardar
    raw_path = os.path.join(OUTPUT_DIR, "params_raw.npy")
    norm_path = os.path.join(OUTPUT_DIR, "params_norm.npy")
    meta_path = os.path.join(OUTPUT_DIR, "meta.json")

    np.save(raw_path, usable)
    np.save(norm_path, normed)

    meta = {
        "n_samples": len(usable),
        "n_params": len(PARAM_NAMES),
        "param_names": PARAM_NAMES,
        "ranges": {k: list(v) for k, v in RANGES.items()},
    }
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"Guardado en {OUTPUT_DIR}/")
    print(f"  params_raw.npy   — {usable.shape}")
    print(f"  params_norm.npy  — {normed.shape}")
    print(f"  meta.json        — rangos y nombres")


if __name__ == "__main__":
    main()
