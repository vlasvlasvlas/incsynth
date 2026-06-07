"""
Fase 1 — Paso 2 (v2): Entrenar el VAE de timbre con beta annealing.

Cambios vs v1:
  - Beta annealing: arranca en 0 y sube linealmente a 0.1 en 300 épocas
  - Hidden layer más grande (128)
  - Más épocas (300)
  - MSE con reduction="mean" (escala mejor)
  - Learning rate scheduling
"""

import os
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

DATA_DIR = os.path.join(os.path.dirname(__file__), "datos")


class Encoder(nn.Module):
    def __init__(self, input_dim=8, hidden=128, latent=4):
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
    def __init__(self, latent=4, hidden=128, output_dim=8):
        super().__init__()
        self.fc1 = nn.Linear(latent, hidden // 2)
        self.fc2 = nn.Linear(hidden // 2, hidden)
        self.fc3 = nn.Linear(hidden, output_dim)

    def forward(self, z):
        h = torch.relu(self.fc1(z))
        h = torch.relu(self.fc2(h))
        return torch.sigmoid(self.fc3(h))


class VAE(nn.Module):
    def __init__(self, input_dim=8, hidden=128, latent=4):
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


def vae_loss(recon, x, mu, logvar, beta):
    mse = nn.functional.mse_loss(recon, x, reduction="mean")
    kl = -0.5 * torch.mean(1 + logvar - mu.pow(2) - logvar.exp())
    return mse + beta * kl, mse.item(), kl.item()


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
    data = np.load(os.path.join(DATA_DIR, "params_norm.npy")).astype(np.float32)
    print(f"Dataset: {data.shape[0]} samples × {data.shape[1]} params")

    dataset = TensorDataset(torch.from_numpy(data))
    loader = DataLoader(dataset, batch_size=128, shuffle=True)

    # Modelo
    model = VAE(input_dim=8, hidden=128, latent=4).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=3e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=300)

    # Train con beta annealing
    EPOCHS = 300
    BETA_MAX = 0.1
    WARMUP = 50  # épocas sin KL para que aprenda a reconstruir primero

    print(f"\nEntrenando {EPOCHS} épocas (beta annealing: 0→{BETA_MAX})...")
    for epoch in range(1, EPOCHS + 1):
        # Beta: 0 durante warmup, luego rampa lineal
        if epoch <= WARMUP:
            beta = 0.0
        else:
            beta = BETA_MAX * (epoch - WARMUP) / (EPOCHS - WARMUP)

        total_mse = 0
        total_kl = 0
        for (batch,) in loader:
            batch = batch.to(device)
            recon, mu, logvar = model(batch)
            loss, mse_v, kl_v = vae_loss(recon, batch, mu, logvar, beta)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_mse += mse_v
            total_kl += kl_v

        scheduler.step()
        n_batches = len(loader)
        if epoch % 30 == 0 or epoch == 1:
            print(f"  Época {epoch:3d}/{EPOCHS}  MSE={total_mse/n_batches:.5f}  KL={total_kl/n_batches:.4f}  β={beta:.4f}")

    # Guardar
    model_path = os.path.join(DATA_DIR, "vae_full.pt")
    torch.save(model.state_dict(), model_path)
    print(f"\nModelo guardado en {model_path}")

    # Evaluar reconstrucción
    model.eval()
    with torch.no_grad():
        sample = torch.from_numpy(data[:8]).to(device)
        recon, _, _ = model(sample)
        recon_np = recon.cpu().numpy()

    print("\nReconstrucción (original → reconstruido):")
    for i in range(8):
        orig = " ".join(f"{v:.2f}" for v in data[i])
        rec  = " ".join(f"{v:.2f}" for v in recon_np[i])
        diff = np.mean(np.abs(data[i] - recon_np[i]))
        print(f"  IN:  {orig}")
        print(f"  OUT: {rec}  (error medio: {diff:.3f})")
        print()

    # Verificar que el espacio latente tiene estructura
    with torch.no_grad():
        all_mu, _ = model.encoder(torch.from_numpy(data).to(device))
        all_mu = all_mu.cpu().numpy()
    labels = np.load(os.path.join(DATA_DIR, "labels.npy"))

    print("Centros latentes por familia:")
    import json
    with open(os.path.join(DATA_DIR, "meta.json")) as f:
        meta = json.load(f)
    for fi, fname in enumerate(meta["families"]):
        mask = labels == fi
        mu_mean = all_mu[mask].mean(axis=0)
        print(f"  {fname:20s}: [{', '.join(f'{v:+.2f}' for v in mu_mean)}]")

    print("\n✅ Entrenamiento v2 completado. Ejecutá exportar.py para generar los pesos.")


if __name__ == "__main__":
    main()
