import * as Tone from 'tone';

// Bus master compartido: unifica el grafo de las 3 voces, pulse, playable y radio.
// Lazy para no instanciar nodos antes de tiempo (el AudioContext queda suspendido
// hasta el primer gesto del usuario, igual).
let _bus = null;
let _limiter = null;

export function masterBus() {
  if (!_bus) {
    // Threshold apenas por debajo de 0 dBFS: protege clipping sin comprimir programa.
    _limiter = new Tone.Limiter(-0.3).toDestination();
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

// AudioContext compartido con Tone — para que la radio viva en el mismo grafo.
export function masterContext() {
  return Tone.getContext().rawContext;
}
