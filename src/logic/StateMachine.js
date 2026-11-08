export const ESTADOS = {
  DORMIDO:     'DORMIDO',
  ARMADO:      'ARMADO',
  SONANDO:     'SONANDO',
  RETENIDO:    'RETENIDO',
  DESCANSANDO: 'DESCANSANDO',
  DESBORDADO:  'DESBORDADO',
  PERIFERICO:  'PERIFERICO',
};

// Tabla de transiciones. Cada regla: { desde, condicion(ctx) → bool, hacia }
// ctx = { señal, sala, numFuentes, ciclosSinActividad, indice_pais, posicion, numPatrones, umbrales }
export const TRANSICIONES = [
  {
    desde: ESTADOS.DORMIDO,
    hacia: ESTADOS.ARMADO,
    condicion: (ctx) => ctx.numFuentes > 0,
  },
  {
    desde: ESTADOS.ARMADO,
    hacia: ESTADOS.DORMIDO,
    condicion: (ctx) => ctx.numFuentes === 0,
  },
  {
    desde: ESTADOS.ARMADO,
    hacia: ESTADOS.SONANDO,
    condicion: (ctx) => ctx.señal && ctx.señal.magnitud >= ctx.umbrales.entrada,
  },
  {
    desde: ESTADOS.SONANDO,
    hacia: ESTADOS.DORMIDO,
    condicion: (ctx) => ctx.posicion >= ctx.numPatrones,
  },
  {
    desde: ESTADOS.SONANDO,
    hacia: ESTADOS.RETENIDO,
    condicion: (ctx) =>
      ctx.señal &&
      ctx.señal.getVerb('RETIENE', ctx.mapeo) > ctx.umbrales.retiene &&
      Math.random() < ctx.señal.getVerb('RETIENE', ctx.mapeo),
  },
  {
    desde: ESTADOS.RETENIDO,
    hacia: ESTADOS.SONANDO,
    condicion: (ctx) =>
      !ctx.señal || ctx.señal.getVerb('RETIENE', ctx.mapeo) < ctx.umbrales.retiene_libera,
  },
  {
    desde: ESTADOS.SONANDO,
    hacia: ESTADOS.DESCANSANDO,
    condicion: (ctx) => ctx.ciclosSinActividad > 5,
  },
  {
    desde: ESTADOS.DESCANSANDO,
    hacia: ESTADOS.SONANDO,
    condicion: (ctx) => ctx.señal && ctx.señal.magnitud >= ctx.umbrales.entrada,
  },
  {
    desde: ESTADOS.SONANDO,
    hacia: ESTADOS.DESBORDADO,
    condicion: (ctx) => ctx.numFuentes >= ctx.umbrales.desbordado_n,
  },
  {
    desde: ESTADOS.DESBORDADO,
    hacia: ESTADOS.SONANDO,
    condicion: (ctx) => ctx.numFuentes < ctx.umbrales.desbordado_n,
  },
  {
    desde: ESTADOS.SONANDO,
    hacia: ESTADOS.PERIFERICO,
    condicion: (ctx) =>
      ctx.indice_pais !== null && ctx.indice_pais < ctx.umbrales.periferico,
  },
  {
    desde: ESTADOS.PERIFERICO,
    hacia: ESTADOS.SONANDO,
    condicion: (ctx) =>
      ctx.indice_pais === null || ctx.indice_pais >= ctx.umbrales.periferico,
  },
  {
    desde: ESTADOS.PERIFERICO,
    hacia: ESTADOS.DORMIDO,
    condicion: (ctx) => ctx.numFuentes === 0,
  },
  {
    desde: ESTADOS.SONANDO,
    hacia: ESTADOS.DORMIDO,
    condicion: (ctx) =>
      ctx.señal &&
      ctx.señal.getVerb('SALE', ctx.mapeo) > ctx.umbrales.sale &&
      Math.random() < ctx.señal.getVerb('SALE', ctx.mapeo),
  },
  {
    desde: ESTADOS.RETENIDO,
    hacia: ESTADOS.DORMIDO,
    condicion: (ctx) =>
      ctx.señal &&
      ctx.señal.getVerb('SALE', ctx.mapeo) > ctx.umbrales.sale &&
      Math.random() < ctx.señal.getVerb('SALE', ctx.mapeo),
  },
  {
    desde: ESTADOS.DESCANSANDO,
    hacia: ESTADOS.DORMIDO,
    condicion: (ctx) =>
      ctx.señal &&
      ctx.señal.getVerb('SALE', ctx.mapeo) > ctx.umbrales.sale &&
      Math.random() < ctx.señal.getVerb('SALE', ctx.mapeo),
  },
  {
    desde: ESTADOS.PERIFERICO,
    hacia: ESTADOS.DORMIDO,
    condicion: (ctx) =>
      ctx.señal &&
      ctx.señal.getVerb('SALE', ctx.mapeo) > ctx.umbrales.sale &&
      Math.random() < ctx.señal.getVerb('SALE', ctx.mapeo),
  },
];

export function transicionar(estadoActual, ctx) {
  for (const t of TRANSICIONES) {
    if (t.desde === estadoActual && t.condicion(ctx)) {
      return t.hacia;
    }
  }
  return estadoActual;
}
