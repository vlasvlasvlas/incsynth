export class LaSala {
  constructor(numPatrones) {
    this.numPatrones = numPatrones;
    this.terreno     = new Float32Array(numPatrones); // stigmergy: 0-1
    this.instrumentos = {};
    this._historialAvances = []; // últimos 8 ciclos: 1=avanzó, 0=repitió
    this._shockwaves = []; // { pos, age }
    this._eventCounter = 0;
    this._geometriaHistorial = [];
    this._geometriaKey = '';
    this._geometria = {
      area: 0,
      delta: 0,
      estabilidad: 1,
      tendencia: 'estable',
      presion: 0,
      estado: 'sin triangulo',
    };
  }

  registrarInstrumento(id, posicionInicial = 0) {
    const existente = this.instrumentos[id];
    this.instrumentos[id] = {
      posicion: posicionInicial,
      posicionAnterior: existente?.posicion ?? posicionInicial,
      ultimoAvanceEvento: existente?.ultimoAvanceEvento ?? -100,
      historial: existente?.historial ?? [],
    };
    this._actualizarGeometria();
  }

  actualizarPosicion(id, nuevaPosicion, avanzo) {
    if (!this.instrumentos[id]) return;
    const canal = this.instrumentos[id];
    canal.posicionAnterior = canal.posicion;
    canal.posicion = nuevaPosicion;
    this._eventCounter++;
    canal.historial.push({
      posicion: nuevaPosicion,
      avanzo: Boolean(avanzo),
      evento: this._eventCounter,
    });
    if (canal.historial.length > 16) canal.historial.shift();
    if (avanzo) canal.ultimoAvanceEvento = this._eventCounter;
    this._actualizarGeometria();
    if (avanzo !== undefined) {
      this._historialAvances.push(avanzo ? 1 : 0);
      if (this._historialAvances.length > 8) this._historialAvances.shift();
      if (avanzo) {
        this._shockwaves.push({ pos: nuevaPosicion, age: 0 });
      }
    }
  }

  // Llamado en cada pulso: decae el terreno y deposita huellas
  pulso() {
    for (let i = 0; i < this.numPatrones; i++) {
      this.terreno[i] = Math.max(0, this.terreno[i] - 0.04);
    }
    for (let i = this._shockwaves.length - 1; i >= 0; i--) {
      this._shockwaves[i].age += 0.08;
      if (this._shockwaves[i].age >= 1) this._shockwaves.splice(i, 1);
    }
    for (const id in this.instrumentos) {
      const pos = this.instrumentos[id].posicion;
      if (pos >= 0 && pos < this.numPatrones) {
        this.terreno[pos] = Math.min(1, this.terreno[pos] + 0.18);
      }
    }
    this._actualizarGeometria(false);
  }

  // --- Las 6 propiedades ---

  getDensidad(pos) {
    let count = 0;
    for (const id in this.instrumentos) {
      if (Math.abs(this.instrumentos[id].posicion - pos) <= 1) count++;
    }
    return count;
  }

  getHuecos() {
    const posiciones = Object.values(this.instrumentos).map(i => i.posicion);
    if (posiciones.length < 2) return 0;
    const min = Math.min(...posiciones);
    const max = Math.max(...posiciones);
    let huecos = 0;
    for (let p = min; p <= max; p++) {
      if (!posiciones.includes(p)) huecos++;
    }
    return huecos;
  }

  getMomentum() {
    if (this._historialAvances.length === 0) return 0;
    const suma = this._historialAvances.reduce((a, b) => a + b, 0);
    return suma / this._historialAvances.length;
  }

  getCentroMasa() {
    const ids = Object.keys(this.instrumentos);
    if (ids.length === 0) return 0;
    const suma = ids.reduce((s, id) => s + this.instrumentos[id].posicion, 0);
    return suma / ids.length;
  }

  getDistanciaMaxima() {
    const posiciones = Object.values(this.instrumentos).map(i => i.posicion);
    if (posiciones.length < 2) return 0;
    return Math.max(...posiciones) - Math.min(...posiciones);
  }

  getEnergiaTotal(senales) {
    return Object.values(senales).reduce((s, señal) => s + (señal ? señal.magnitud : 0), 0);
  }

  getImpactoShockwave(pos) {
    let impacto = 0;
    for (const sw of this._shockwaves) {
      const dist = Math.abs(sw.pos - pos);
      // Radio de impacto 5 patrones
      if (dist < 5) {
        const fuerza = (1 - sw.age) * (1 - dist / 5);
        impacto = Math.max(impacto, fuerza);
      }
    }
    return impacto;
  }

  getShockwaves() {
    return this._shockwaves.map(sw => ({ pos: sw.pos, age: sw.age }));
  }

  getGeometria() {
    this._actualizarGeometria(false);
    return { ...this._geometria };
  }

  getEscuchaIndividual(id) {
    const propio = this.instrumentos[id];
    if (!propio) return null;

    const vecinos = Object.entries(this.instrumentos)
      .filter(([otherId]) => otherId !== id)
      .map(([otherId, canal]) => {
        const delta = canal.posicion - propio.posicion;
        return {
          id: otherId,
          posicion: canal.posicion,
          delta,
          distancia: Math.abs(delta),
          direccion: delta > 0 ? 'delante' : delta < 0 ? 'detras' : 'unisono',
          acabaDeAvanzar: this._eventCounter - canal.ultimoAvanceEvento <= 3,
        };
      })
      .sort((a, b) => a.distancia - b.distancia);

    const delante = vecinos.filter(v => v.delta > 0).sort((a, b) => a.delta - b.delta)[0] || null;
    const detras = vecinos.filter(v => v.delta < 0).sort((a, b) => b.delta - a.delta)[0] || null;
    const masCercano = vecinos[0] || null;
    const posiciones = Object.values(this.instrumentos).map(i => i.posicion);
    const min = Math.min(...posiciones);
    const max = Math.max(...posiciones);
    const distanciaFrente = max - propio.posicion;
    const distanciaCola = propio.posicion - min;

    let rol = 'dentro del grupo';
    if (propio.posicion === max && max > min) rol = 'abre el grupo';
    if (propio.posicion === min && max > min) rol = 'sostiene la cola';
    if (vecinos.every(v => v.distancia === 0)) rol = 'unisono';

    let presion = 0;
    let motivo = 'escucha estable';

    // En In C se recomienda permanecer a no más de 2-3 figuras del grupo.
    if (distanciaCola > 3) {
      presion -= Math.min(0.24, 0.07 + (distanciaCola - 3) * 0.045);
      motivo = 'espera a quienes quedaron detras';
    } else if (distanciaFrente > 3) {
      presion += Math.min(0.18, 0.05 + (distanciaFrente - 3) * 0.035);
      motivo = 'recupera distancia con el frente';
    } else if (delante?.acabaDeAvanzar && delante.distancia <= 3) {
      presion += 0.055;
      motivo = `oye avanzar a ${delante.id}`;
    } else if (masCercano?.distancia === 0 && vecinos.some(v => v.distancia === 0)) {
      presion -= 0.025;
      motivo = 'permanece en unisono';
    }

    return {
      id,
      posicion: propio.posicion,
      posicionAnterior: propio.posicionAnterior,
      vecinos,
      delante,
      detras,
      masCercano,
      distanciaFrente,
      distanciaCola,
      rol,
      presion: round2(presion),
      motivo,
    };
  }

  // --- Función de probabilidad central ---
  // Combina señal de API + las 3 capas físicas de La Sala
  // Combina señal de API + las 3 capas físicas de La Sala
  calcularProbabilidadBreakdown(id, pos, señal, mapeo, pesos, umbrales, memoria = null) {
    const centro    = this.getCentroMasa();
    const densidad  = this.getDensidad(pos);
    const momentum  = this.getMomentum();
    const desgaste  = this.terreno[pos];
    const geometria = this.getGeometria();
    const escucha = this.getEscuchaIndividual(id);

    const p_api       = señal ? señal.getVerb('AVANZA', mapeo) : 0;
    const p_stigmergy = desgaste;
    const p_cohesion  = clamp((centro - pos) / 4, 0, 1);
    const p_separac   = densidad > 1 ? 0.4 : 0;
    const p_momentum  = momentum;
    const p_shockwave = this.getImpactoShockwave(pos) * 1.5; // Contagio fuerte
    const p_geometria = this._calcularPresionGeometrica(id, pos, geometria, memoria);
    const p_escucha    = escucha?.presion ?? 0;
    const freno       = pos > centro + umbrales.distancia_max ? 0.6 : 0;

    const partes = {
      api:       p_api       * pesos.api,
      stigmergy: p_stigmergy * pesos.stigmergy,
      cohesion:  p_cohesion  * pesos.cohesion,
      separacion:p_separac   * pesos.separacion,
      momentum:  p_momentum  * pesos.momentum,
      shockwave: p_shockwave,
      geometria: p_geometria,
      escucha:   p_escucha,
      freno,
    };

    const p_raw = partes.api
                + partes.stigmergy
                + partes.cohesion
                + partes.separacion
                + partes.momentum
                + partes.shockwave
                + partes.geometria
                + partes.escucha
                - partes.freno;

    const contribuciones = [
      ['dato', partes.api],
      ['huella', partes.stigmergy],
      ['grupo', partes.cohesion],
      ['separacion', partes.separacion],
      ['momentum', partes.momentum],
      ['impacto', partes.shockwave],
      ['geometria', partes.geometria],
      ['escucha', partes.escucha],
      ['freno', -partes.freno],
    ].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    return {
      p: clamp(p_raw, 0, 1),
      raw: round2(p_raw),
      api: round2(partes.api),
      stigmergy: round2(partes.stigmergy),
      cohesion: round2(partes.cohesion),
      separacion: round2(partes.separacion),
      momentum: round2(partes.momentum),
      shockwave: round2(partes.shockwave),
      geometria: round2(partes.geometria),
      escucha: round2(partes.escucha),
      freno: round2(partes.freno),
      densidad,
      centro: round2(centro),
      desgaste: round2(desgaste),
      distanciaAlCentro: round2(pos - centro),
      area: round2(geometria.area),
      areaDelta: round2(geometria.delta),
      areaEstabilidad: round2(geometria.estabilidad),
      areaTendencia: geometria.tendencia,
      areaEstado: geometria.estado,
      canalEscucha: escucha,
      motivo: contribuciones[0]?.[0] || 'dato',
    };
  }

  _calcularPresionGeometrica(id, pos, geometria, memoria) {
    const distanciaMax = this.getDistanciaMaxima();
    const repeticiones = memoria?.repeticiones ?? 0;
    const sinCambio = geometria.estabilidad > 0.78 && Math.abs(geometria.delta) < 0.025;
    let presion = 0;

    if (sinCambio && repeticiones >= 2) presion += Math.min(0.24, repeticiones * 0.045);
    if (geometria.area < 0.055 && distanciaMax <= 2) presion += 0.16;
    if (geometria.area > 0.62 && pos > this.getCentroMasa()) presion -= 0.18;
    if (geometria.delta > 0.035 && distanciaMax <= 6) presion += 0.08;
    if (geometria.delta < -0.04 && repeticiones >= 1) presion += 0.06;

    return clamp(presion, -0.24, 0.30);
  }

  _actualizarGeometria(pushHistory = true) {
    const ids = Object.keys(this.instrumentos);
    if (ids.length < 3) {
      this._geometria = {
        area: 0,
        delta: 0,
        estabilidad: 1,
        tendencia: 'estable',
        presion: 0,
        estado: 'sin triangulo',
      };
      return;
    }

    const key = ids.map(id => this.instrumentos[id].posicion).join(':');
    if (pushHistory && key === this._geometriaKey) return;

    const maxPos = Math.max(1, this.numPatrones - 1);
    const puntos = ids.slice(0, 3).map((id, i) => {
      const r = clamp(this.instrumentos[id].posicion / maxPos, 0, 1);
      const a = -Math.PI / 2 + (i / 3) * Math.PI * 2;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    });

    const rawArea = Math.abs(
      puntos[0].x * (puntos[1].y - puntos[2].y)
      + puntos[1].x * (puntos[2].y - puntos[0].y)
      + puntos[2].x * (puntos[0].y - puntos[1].y)
    ) / 2;
    const maxEquilateralArea = Math.sqrt(3) * 0.75;
    const area = clamp(rawArea / maxEquilateralArea, 0, 1);
    const prevArea = this._geometriaHistorial.at(-1)?.area ?? area;
    const delta = area - prevArea;

    if (pushHistory || !this._geometriaHistorial.length) {
      this._geometriaHistorial.push({ area, delta });
      if (this._geometriaHistorial.length > 12) this._geometriaHistorial.shift();
      this._geometriaKey = key;
    }

    const areas = this._geometriaHistorial.map(g => g.area);
    const promedio = areas.reduce((s, v) => s + v, 0) / Math.max(1, areas.length);
    const variacion = areas.reduce((s, v) => s + Math.abs(v - promedio), 0) / Math.max(1, areas.length);
    const estabilidad = clamp(1 - variacion * 8, 0, 1);
    const tendencia = delta > 0.025 ? 'expande' : delta < -0.025 ? 'contrae' : 'estable';
    const estado = area < 0.055
      ? 'colapso'
      : area > 0.62
        ? 'dispersion'
        : tendencia === 'estable' && estabilidad > 0.78
          ? 'sostenido'
          : tendencia;

    this._geometria = {
      area,
      delta,
      estabilidad,
      tendencia,
      presion: 0,
      estado,
    };
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function round2(v) {
  return Math.round(v * 100) / 100;
}
