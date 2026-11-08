export class DataSourceAdapter {
  constructor() {
    this.magnitud    = 0.5;
    this.cambio      = 0;
    this.tendencia   = 0;
    this.volatilidad = 0;
    this.payloadText = ""; // Explicación humana de lo que viajó por la API
  }

  tick() {}

  // Presión 0-1 que esta fuente ejerce sobre un verbo dado
  getVerb(verbo, mapeo) {
    switch (verbo) {
      case 'ENTRA':
        return this.magnitud;
      case 'AVANZA':
        return clamp(Math.abs(this.cambio) * mapeo.avance_sensibilidad, 0, 1);
      case 'RETIENE':
        return clamp(
          (1 - Math.abs(this.cambio)) * mapeo.retiene_quietud
          + this.volatilidad * mapeo.retiene_sensibilidad * 0.2,
          0, 1
        );
      case 'MUTA':
        return clamp(this.volatilidad * mapeo.muta_escala, 0, 1);
      case 'SALE':
        // Rampa lineal: 1 en magnitud≤0.05, 0 en magnitud≥0.15, 0.5 en 0.10.
        // Evita el disparo binario que creaba la trampa de SONANDO→DORMIDO prob=1.
        return clamp((0.15 - this.magnitud) / 0.10, 0, 1);
      default:
        return 0;
    }
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
