"""
Fase 1 — Paso 3: Exportar el decoder del VAE a JSON para el browser.

Lee los pesos de PyTorch y genera un archivo JSON con:
- Las matrices de pesos y biases del decoder
- Los rangos de desnormalización
- Metadata del modelo

El archivo resultante pesa ~205KB y se carga en src/ai/pesos/vae_decoder.json.
"""

import os
import json
import numpy as np
import torch
from entrenar import VAE

DATA_DIR = os.path.join(os.path.dirname(__file__), "datos")
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUTPUT_PATH = os.path.join(PROJECT_ROOT, "src", "ai", "pesos", "vae_decoder.json")


def main():
    # Cargar modelo entrenado
    model = VAE(input_dim=8, hidden=128, latent=4)
    weights_path = os.path.join(DATA_DIR, "vae_full.pt")
    model.load_state_dict(torch.load(weights_path, map_location="cpu", weights_only=True))
    model.eval()

    decoder = model.decoder

    # Extraer pesos del decoder como listas
    layers = []
    for name, param in decoder.named_parameters():
        layers.append({
            "name": name,
            "shape": list(param.shape),
            "data": param.detach().cpu().numpy().tolist(),
        })

    # Cargar meta para los rangos de desnormalización
    meta_path = os.path.join(DATA_DIR, "meta.json")
    with open(meta_path) as f:
        meta = json.load(f)

    export = {
        "version": 1,
        "description": "VAE decoder for timbre space — In C / Mundo Real",
        "architecture": "4 → 64 (ReLU) → 128 (ReLU) → 8 (Sigmoid)",
        "latent_dim": 4,
        "output_dim": 8,
        "param_names": meta["param_names"],
        "ranges": meta["ranges"],
        "layers": layers,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(export, f)

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"✅ Decoder exportado a {OUTPUT_PATH}")
    print(f"   Tamaño: {size_kb:.1f} KB")
    print(f"   Capas: {len(layers)}")
    for l in layers:
        print(f"     {l['name']}: {l['shape']}")

    # Verificar: correr el decoder en numpy para comparar con PyTorch
    print("\nVerificación — comparando PyTorch vs JSON export:")
    z_test = torch.randn(1, 4)
    with torch.no_grad():
        out_pt = decoder(z_test).numpy()[0]

    # Reconstruir manualmente desde los pesos exportados
    z = z_test.numpy()[0]
    w1 = np.array(export["layers"][0]["data"])  # fc1.weight
    b1 = np.array(export["layers"][1]["data"])  # fc1.bias
    w2 = np.array(export["layers"][2]["data"])  # fc2.weight
    b2 = np.array(export["layers"][3]["data"])  # fc2.bias
    w3 = np.array(export["layers"][4]["data"])  # fc3.weight
    b3 = np.array(export["layers"][5]["data"])  # fc3.bias

    h = np.maximum(0, w1 @ z + b1)       # ReLU
    h = np.maximum(0, w2 @ h + b2)       # ReLU
    out_np = 1 / (1 + np.exp(-(w3 @ h + b3)))  # Sigmoid

    max_diff = np.max(np.abs(out_pt - out_np))
    print(f"  PyTorch:  {[f'{v:.4f}' for v in out_pt]}")
    print(f"  NumPy:    {[f'{v:.4f}' for v in out_np]}")
    print(f"  Max diff: {max_diff:.8f}")
    if max_diff < 1e-5:
        print("  ✅ Verificación exitosa — los pesos se exportaron correctamente")
    else:
        print("  ⚠️  Diferencia alta — revisar exportación")


if __name__ == "__main__":
    main()
