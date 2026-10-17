// HTTPS audio streams with CORS support, checked 2026-10-15.
// Ampliado 2026-10-17: AM / talk / voces de LATAM. Las URLs nuevas siguen patrones
// conocidos de StreamTheWorld e Icecast; si alguna cae, RadioPlayer la saltea.
// HLS-only and obsolete endpoints cannot feed the browser's effect chain reliably.
export const RADIO_STREAMS = [
  // Chile
  { id: 'biobio', nombre: 'Radio Biobío', pais: 'Chile', url: 'https://redirector.dps.live/biobiosantiago/mp3/icecast.audio' },
  { id: 'cooperativa', nombre: 'Radio Cooperativa', pais: 'Chile', url: 'https://unlimited1-cl-isp.dps.live/cooperativa/aac/icecast.audio' },
  { id: 'adn', nombre: 'ADN Radio', pais: 'Chile', url: 'https://unlimited1-cl.dps.live/adn/aac/icecast.audio' },

  // Argentina
  { id: 'mitre', nombre: 'Radio Mitre (AM 790)', pais: 'Argentina', url: 'https://26613.live.streamtheworld.com/RADIO_MITRE_AMAAC.aac' },
  { id: 'continental', nombre: 'Radio Continental (AM 590)', pais: 'Argentina', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CONTINENTAL_SC' },
  { id: 'la_red', nombre: 'Radio La Red (AM 910)', pais: 'Argentina', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/LA_RED_SC' },
  { id: 'rivadavia', nombre: 'Radio Rivadavia (AM 630)', pais: 'Argentina', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/RIVADAVIAAM_SC' },

  // Uruguay
  { id: 'carve', nombre: 'Radio Carve (AM 850)', pais: 'Uruguay', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CARVEAAC' },
  { id: 'sarandi', nombre: 'Radio Sarandí (AM 690)', pais: 'Uruguay', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/SARANDI_AMAAC' },

  // Paraguay
  { id: 'cardinal', nombre: 'Radio Cardinal (AM 730)', pais: 'Paraguay', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CARDINAL_AMAAC' },

  // Perú
  { id: 'rpp', nombre: 'RPP Noticias', pais: 'Perú', url: 'https://19993.live.streamtheworld.com/CRPP_RADIOAAC.aac' },

  // Colombia
  { id: 'caracol', nombre: 'Caracol Radio', pais: 'Colombia', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CARACOL_RADIOAAC' },
  { id: 'blu', nombre: 'Blu Radio', pais: 'Colombia', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/BLU_RADIOAAC' },
  { id: 'lafm', nombre: 'La FM', pais: 'Colombia', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/LAFM_SC' },

  // Ecuador
  { id: 'quito', nombre: 'Radio Quito (AM 760)', pais: 'Ecuador', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/RADIOQUITO_AMAAC' },

  // México
  { id: 'wradio', nombre: 'W Radio', pais: 'México', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/W_RADIO_SC' },
  { id: 'formula', nombre: 'Radio Fórmula', pais: 'México', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/XERFR_FM_AAC' },
  { id: 'mvs_noticias', nombre: 'MVS Noticias', pais: 'México', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/XHMVS_FMAAC' },

  // Brasil
  { id: 'cbn_sp', nombre: 'CBN São Paulo', pais: 'Brasil', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CBN_SP_SC' },
  { id: 'cbn_rj', nombre: 'CBN Rio de Janeiro', pais: 'Brasil', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CBN_RJ_SC' },
  { id: 'bandnews_sp', nombre: 'BandNews FM', pais: 'Brasil', url: 'https://26603.live.streamtheworld.com/BANDNEWSFM_SPAAC' },
];
