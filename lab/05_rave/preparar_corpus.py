#!/usr/bin/env python3
"""
lab/05_rave/preparar_corpus.py

Prepara el corpus de entrenamiento para RAVE desde una sesión de incsynth.

Inputs:
  audio.webm  — grabación del sintetizador (exportado por raveCapture.js)
  sync.json   — marcadores de sincronización con z-vectors VAE

Outputs:
  corpus/chunks/chunk_NNNNN.wav  — segmentos de audio de duración variable
  corpus/manifest.json           — metadata: z_vectors, alpha, timestamps

Los chunks son la unidad de entrenamiento para RAVE. Cada uno está alineado
con un z-vector VAE específico, lo que permite condicionar RAVE al espacio
latente del VAE de timbre (Fase 1).

Uso:
  python preparar_corpus.py audio.webm sync.json
  python preparar_corpus.py audio.webm sync.json --output mi_corpus --min-dur 1.0

Requiere:
  pip install librosa soundfile numpy
"""

import argparse
import json
import sys
from pathlib import Path

try:
    import librosa
    import numpy as np
    import soundfile as sf
except ImportError:
    print("ERROR: Instalar dependencias primero:")
    print("  pip install librosa soundfile numpy")
    sys.exit(1)


def preparar_corpus(audio_path: str, sync_path: str, output_dir: str = 'corpus',
                    min_dur: float = 0.5, sr_out: int = 44100) -> list:
    audio_path = Path(audio_path)
    sync_path  = Path(sync_path)
    output     = Path(output_dir)
    chunks_dir = output / 'chunks'
    chunks_dir.mkdir(parents=True, exist_ok=True)

    print(f"Cargando audio: {audio_path}")
    y, sr = librosa.load(str(audio_path), sr=sr_out, mono=True)
    duracion_total = len(y) / sr
    print(f"  {duracion_total:.1f}s  sr={sr}Hz")

    print(f"Cargando sync: {sync_path}")
    with open(sync_path) as f:
        sync = json.load(f)

    markers = sync.get('markers', [])
    if not markers:
        print("ERROR: sync.json sin marcadores.")
        sys.exit(1)
    print(f"  {len(markers)} marcadores")

    manifest = []
    skipped  = 0

    for i, marker in enumerate(markers):
        t_start_s = marker['t_ms'] / 1000.0
        t_end_s   = (markers[i + 1]['t_ms'] / 1000.0
                     if i + 1 < len(markers)
                     else duracion_total)
        t_end_s   = min(t_end_s, duracion_total)
        dur       = t_end_s - t_start_s

        if dur < min_dur:
            skipped += 1
            continue

        i_start = int(t_start_s * sr)
        i_end   = int(t_end_s   * sr)
        chunk   = y[i_start:i_end]

        filename = f'chunk_{i:05d}.wav'
        sf.write(str(chunks_dir / filename), chunk, sr)

        manifest.append({
            'file':       filename,
            't_start':    round(t_start_s, 3),
            't_end':      round(t_end_s, 3),
            'duracion_s': round(dur, 3),
            'z_vectors':  marker.get('z_vectors', {}),
            'alpha':      marker.get('alpha', 0),
        })

    manifest_path = output / 'manifest.json'
    with open(manifest_path, 'w') as f:
        json.dump({
            'version':        1,
            'audio_original': str(audio_path.name),
            'sr':             sr_out,
            'n_chunks':       len(manifest),
            'n_skipped':      skipped,
            'chunks':         manifest,
        }, f, indent=2)

    print(f"\nCorpus generado en {output}/")
    print(f"  chunks: {len(manifest)}")
    print(f"  descartados (< {min_dur}s): {skipped}")
    print(f"  manifest: {manifest_path}")

    # Estadísticas de z-vectors por instrumento
    insts = set()
    for c in manifest:
        insts.update(c['z_vectors'].keys())
    if insts:
        print(f"\nInstrumentos capturados: {', '.join(sorted(insts))}")
        for inst in sorted(insts):
            zs = [c['z_vectors'][inst] for c in manifest if inst in c['z_vectors']]
            if zs:
                arr = np.array(zs)
                print(f"  [{inst}] z mean: {arr.mean(axis=0).round(2).tolist()}")
                print(f"          z std:  {arr.std(axis=0).round(2).tolist()}")

    return manifest


def main():
    parser = argparse.ArgumentParser(description='Preparar corpus RAVE desde sesión incsynth')
    parser.add_argument('audio',   help='Archivo de audio (.webm o .wav)')
    parser.add_argument('sync',    help='Archivo de sincronización (.json)')
    parser.add_argument('--output',  default='corpus',  help='Directorio de salida (default: corpus)')
    parser.add_argument('--min-dur', default=0.5, type=float, help='Duración mínima de chunk en segundos')
    parser.add_argument('--sr',      default=44100, type=int,   help='Sample rate de salida (default: 44100)')
    args = parser.parse_args()

    preparar_corpus(args.audio, args.sync, args.output, args.min_dur, args.sr)


if __name__ == '__main__':
    main()
