"""
Fase 1 — Paso 2: Entrenar el VAE de timbre.

Arquitectura:
  Encoder: 8 → 64 → 32 → (mu 4, logvar 4)   ← solo para entrenar
  Decoder: 4 → 32 → 64 → 8                    ← esto va al browser

Loss: MSE reconstrucción + KL divergence (beta=0.5 para espacio latente suave)

Entrena con MPS (Apple Silicon GPU) si está disponible.
"""

import os
import json
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

DATA_DIR = os.path.join(os.path.dirname(__file__), "datos")
OUTPUT_DIR = DATA_DIR  # pesos intermedios van al mismo lugar


# ── Modelo ──

class Encoder(nn.Module):
    def __init__(self, input_dim=8, hidden=64, latent=4):
        super().__init__()
        self.fc1 = nn.Linear(input_dim, hidden)
        self.fc2 = nn.Linear(hidden, hidden // 2)
        self.fc_mu = nn.Linear(hidden // 2, latent)
        self.fc_logvar = nn.Linear(hidden // 2, latent)

    def forward(self, x):
        h = torch.relu(self.fc1(x))
        h = torch.relu(self.fc2(h))
        return self.fc_mu(h), self.fc_logvar(h)


class Decoder(nn.Module):
    def __init__(self, latent=4, hidden=64, output_dim=8):
        super().__init__()
        self.fc1 = nn.Linear(latent, hidden // 2)
        self.fc2 = nn.Linear(hidden // 2, hidden)
        self.fc3 = nn.Linear(hidden, output_dim)

    def forward(self, z):
        h = torch.relu(self.fc1(z))
        h = torch.relu(self.fc2(h))
        return torch.sigmoid(self.fc3(h))  # output en [0, 1]


class VAE(nn.Module):
    def __init__(self, input_dim=8, hidden=64, latent=4):
        super().__init__()
        self.encoder = Encoder(input_dim, hidden, latent)
        self.decoder = Decoder(latent, hidden, input_dim)

    def reparameterize(self, mu, logvar):
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + eps * std

    def forward(self, x):
        mu, logvar = self.encoder(x)
        z = self.reparameterize(mu, logvar)
        recon = self.decoder(z)
        return recon, mu, logvar


def vae_loss(recon, x, mu, logvar, beta=0.5):
    mse = nn.functional.mse_loss(recon, x, reduction="sum")
    kl = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp())
    return mse + beta * kl


# ── Entrenamiento ──

def main():
    # Device
    if torch.backends.mps.is_available():
        device = torch.device("mps")
        print("🍎 Usando GPU Apple Silicon (MPS)")
    elif torch.cuda.is_available():
        device = torch.device("cuda")
        print("🟢 Usando CUDA GPU")
    else:
        device = torch.device("cpu")
        print("⚪ Usando CPU")

    # Datos
    norm_path = os.path.join(DATA_DIR, "params_norm.npy")
    data = np.load(norm_path).astype(np.float32)
    print(f"Dataset: {data.shape[0]} samples × {data.shape[1]} params")

    dataset = TensorDataset(torch.from_numpy(data))
    loader = DataLoader(dataset, batch_size=256, shuffle=True)

    # Modelo
    model = VAE(input_dim=8, hidden=64, latent=4).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

    # Train
    EPOCHS = 200
    print(f"\nEntrenando {EPOCHS} épocas...")
    for epoch in range(1, EPOCHS + 1):
        total_loss = 0
        for (batch,) in loader:
            batch = batch.to(device)
            recon, mu, logvar = model(batch)
            loss = vae_loss(recon, batch, mu, logvar)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        avg = total_loss / len(dataset)
        if epoch % 20 == 0 or epoch == 1:
            print(f"  Época {epoch:3d}/{EPOCHS}  loss={avg:.4f}")

    # Guardar modelo completo (para debug)
    model_path = os.path.join(OUTPUT_DIR, "vae_full.pt")
    torch.save(model.state_dict(), model_path)
    print(f"\nModelo completo guardado en {model_path}")

    # Evaluar calidad de reconstrucción
    model.eval()
    with torch.no_grad():
        sample = torch.from_numpy(data[:5]).to(device)
        recon, _, _ = model(sample)
        print("\nEjemplos de reconstrucción (original → reconstruido):")
        for i in range(5):
            orig = [f"{v:.2f}" for v in data[i]]
            rec = [f"{v:.2f}" for v in recon[i].cpu().numpy()]
            print(f"  {orig}")
            print(f"  {rec}")
            print()

    print("✅ Entrenamiento completado. Ejecutá exportar.py para generar los pesos del browser.")


if __name__ == "__main__":
    main()
