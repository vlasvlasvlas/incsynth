"""
Fase 1 — Paso 1 (v2): Generar dataset ESTRUCTURADO de parámetros FM/AM.

En vez de ruido uniforme, generamos familias de timbres con variación
natural dentro de cada familia. Esto le da al VAE estructura que aprender.

Familias:
  1. PAD CÁLIDO    — sine/triangle, baja modulación, ataque lento, filtro bajo
  2. CAMPANA       — sine, harmonicity alta, ataque instantáneo, filtro alto
  3. LEAD AGRESIVO — saw/square, modulación media, ataque rápido, filtro alto
  4. CUERDA SUAVE  — triangle, baja modulación, ataque medio, sustain alto
  5. PERCUSIVO     — cualquier osc, modulación alta, ataque/decay ultra cortos
  6. VOZ / CORAL   — sine, harmonicity baja entera, modulación baja, sustain alto
  7. METÁLICO      — sine, harmonicity inarmónica, modulación alta, filtro medio
  8. ORGÁNICO      — triangle/sine, modulación suave, envolvente larga, filtro variable
"""

import numpy as np
import json
import os

N_PER_FAMILY = 1500
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "datos")

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


def gauss_clamp(center, spread, lo, hi, n):
    """Genera valores gaussianos centrados, clampados al rango."""
    vals = np.random.normal(center, spread, n)
    return np.clip(vals, lo, hi)


def make_family(name, centers, spreads, n):
    """Genera n muestras de una familia de timbres."""
    data = np.zeros((n, len(PARAM_NAMES)))
    for i, param in enumerate(PARAM_NAMES):
        lo, hi = RANGES[param]
        data[:, i] = gauss_clamp(centers[i], spreads[i], lo, hi, n)
    return data


# Definición de cada familia: [center, spread] para cada parámetro
# Orden: oscType, harmonicity, modIndex, attack, decay, sustain, release, filterCut

FAMILIES = {
    "pad_calido": {
        "centers": [0.15, 1.0, 3.0, 0.8, 1.5, 0.75, 5.0, 1800],
        "spreads": [0.10, 0.5, 2.0, 0.4, 0.5, 0.15, 1.5, 800],
    },
    "campana": {
        "centers": [0.0, 5.5, 14.0, 0.001, 1.4, 0.0, 2.5, 8000],
        "spreads": [0.05, 2.0, 5.0, 0.002, 0.5, 0.05, 1.0, 2500],
    },
    "lead_agresivo": {
        "centers": [0.75, 2.0, 10.0, 0.01, 0.3, 0.6, 0.5, 9000],
        "spreads": [0.15, 1.0, 5.0, 0.02, 0.2, 0.2, 0.3, 2000],
    },
    "cuerda_suave": {
        "centers": [0.25, 1.0, 1.5, 0.3, 0.8, 0.85, 3.0, 3500],
        "spreads": [0.10, 0.3, 1.0, 0.15, 0.3, 0.10, 1.0, 1500],
    },
    "percusivo": {
        "centers": [0.50, 3.0, 20.0, 0.001, 0.15, 0.0, 0.2, 6000],
        "spreads": [0.30, 2.0, 10.0, 0.002, 0.10, 0.05, 0.1, 3000],
    },
    "voz_coral": {
        "centers": [0.0, 1.0, 2.0, 0.15, 0.5, 0.90, 2.0, 2500],
        "spreads": [0.05, 0.3, 1.5, 0.08, 0.3, 0.08, 0.8, 1000],
    },
    "metalico": {
        "centers": [0.0, 7.1, 25.0, 0.001, 0.8, 0.1, 3.0, 5000],
        "spreads": [0.08, 2.5, 8.0, 0.003, 0.4, 0.1, 1.5, 2000],
    },
    "organico": {
        "centers": [0.12, 1.5, 4.0, 0.5, 1.0, 0.65, 4.0, 4000],
        "spreads": [0.12, 0.5, 2.5, 0.3, 0.5, 0.20, 1.5, 2000],
    },
}


def normalize(data):
    normed = np.zeros_like(data)
    for i, name in enumerate(PARAM_NAMES):
        lo, hi = RANGES[name]
        normed[:, i] = (data[:, i] - lo) / (hi - lo)
    return normed


def main():
    np.random.seed(42)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    all_data = []
    all_labels = []
    family_names = list(FAMILIES.keys())

    for fi, (fname, fdef) in enumerate(FAMILIES.items()):
        samples = make_family(fname, fdef["centers"], fdef["spreads"], N_PER_FAMILY)
        all_data.append(samples)
        all_labels.extend([fi] * len(samples))
        print(f"  {fname:20s}: {len(samples)} samples")

    raw = np.vstack(all_data)
    labels = np.array(all_labels)

    # Shuffle
    idx = np.random.permutation(len(raw))
    raw = raw[idx]
    labels = labels[idx]

    normed = normalize(raw)

    print(f"\nTotal: {len(raw)} samples × {raw.shape[1]} params")
    print(f"Familias: {len(FAMILIES)}")

    # Guardar
    np.save(os.path.join(OUTPUT_DIR, "params_raw.npy"), raw)
    np.save(os.path.join(OUTPUT_DIR, "params_norm.npy"), normed)
    np.save(os.path.join(OUTPUT_DIR, "labels.npy"), labels)

    meta = {
        "n_samples": len(raw),
        "n_params": len(PARAM_NAMES),
        "n_families": len(FAMILIES),
        "param_names": PARAM_NAMES,
        "ranges": {k: list(v) for k, v in RANGES.items()},
        "families": family_names,
    }
    with open(os.path.join(OUTPUT_DIR, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\nGuardado en {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
