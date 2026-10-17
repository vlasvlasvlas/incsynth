import * as Tone from 'tone';

// Bus master compartido: unifica el grafo de las 3 voces, pulse, playable y radio.
// Lazy para no instanciar nodos antes de tiempo (el AudioContext queda suspendido
// hasta el primer gesto del usuario, igual).
let _bus = null;
let _limiter = null;
let _radioStage = null;

export function masterBus() {
  if (!_bus) {
    // Threshold a -1.0 dBFS: deja respirar la mezcla antes de que el limiter actúe.
    _limiter = new Tone.Limiter(-1.0).toDestination();
    // Bus a nivel unidad. Los presets están en su nivel original de diseño;
    // el limiter solo pisa picos de suma cuando se activan muchas capas.
    _bus = new Tone.Gain(1).connect(_limiter);
  }
  return _bus;
}

// Nodo Web Audio nativo del bus — para capas que no usan Tone (RadioPlayer).
export function masterNative() {
  return masterBus().input;
}

// Etapa de ganancia dedicada para la radio: topa su aporte al bus master a -9 dBFS
// (gain 0.35). Aún con la radio al 100%, no puede dominar al ensamble ni forzar al
// limiter a comprimir todo el programa. Es un techo de seguridad por diseño,
// independiente del VOL del panel y del volumen interno de la radio.
export function radioInput() {
  if (!_radioStage) {
    _radioStage = new Tone.Gain(0.35).connect(masterBus());
  }
  return _radioStage.input;
}

// AudioContext compartido con Tone — para que la radio viva en el mismo grafo.
export function masterContext() {
  return Tone.getContext().rawContext;
}
