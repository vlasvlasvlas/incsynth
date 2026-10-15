// HTTPS audio streams with CORS support, checked 2026-10-15.
// HLS-only and obsolete endpoints cannot feed the browser's effect chain reliably.
export const RADIO_STREAMS = [
  { id: 'biobio', nombre: 'Radio Biobío', pais: 'Chile', url: 'https://redirector.dps.live/biobiosantiago/mp3/icecast.audio' },
  { id: 'wradio', nombre: 'W Radio', pais: 'México', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/W_RADIO_SC' },
  { id: 'cbn_sp', nombre: 'CBN São Paulo', pais: 'Brasil', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CBN_SP_SC' },
];
