import { DataSourceAdapter } from './DataSourceAdapter.js';

// Titulares reales via RSS (feeds publicos) + proxy CORS gratuito.
// Las palabras no "leen noticias": producen presion semantica sobre la sala.

const PROXY = 'https://api.allorigins.win/get?url=';

const NEWS_CATALOG = [
  {
    id: 'global',
    label: 'Global',
    feeds: [
      {
        id: 'bbc-world',
        name: 'BBC News World',
        url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
      },
      {
        id: 'dw-world',
        name: 'Deutsche Welle World',
        url: 'https://rss.dw.com/rdf/rss-en-world',
      },
      {
        id: 'guardian-world',
        name: 'The Guardian World',
        url: 'https://www.theguardian.com/world/rss',
      },
    ],
  },
  {
    id: 'argentina',
    label: 'Argentina',
    feeds: [
      {
        id: 'lanacion',
        name: 'La Nacion',
        url: 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml',
      },
      {
        id: 'clarin',
        name: 'Clarin',
        url: 'https://www.clarin.com/rss/lo-ultimo/',
      },
      {
        id: 'pagina12',
        name: 'Pagina/12',
        url: 'https://www.pagina12.com.ar/rss/',
      },
      {
        id: 'infobae',
        name: 'Infobae',
        url: 'https://www.infobae.com/arc/outboundfeeds/rss/?outputType=xml',
      },
    ],
  },
  {
    id: 'chile',
    label: 'Chile',
    feeds: [
      {
        id: 'emol',
        name: 'Emol',
        url: 'https://www.emol.com/rss/noticias.xml',
      },
    ],
  },
  {
    id: 'brasil',
    label: 'Brasil',
    feeds: [
      {
        id: 'agencia-brasil',
        name: 'Agência Brasil',
        url: 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml',
      },
      {
        id: 'g1',
        name: 'G1 Globo',
        url: 'https://g1.globo.com/rss/g1/',
      },
    ],
  },
  {
    id: 'peru',
    label: 'Perú',
    feeds: [
      {
        id: 'elcomercio-pe',
        name: 'El Comercio',
        url: 'https://elcomercio.pe/feed/',
      },
      {
        id: 'rpp',
        name: 'RPP Noticias',
        url: 'https://rpp.pe/rss',
      },
    ],
  },
  {
    id: 'colombia',
    label: 'Colombia',
    feeds: [
      {
        id: 'eltiempo-co',
        name: 'El Tiempo',
        url: 'https://www.eltiempo.com/rss/colombia.xml',
      },
    ],
  },
  {
    id: 'usa',
    label: 'Estados Unidos',
    feeds: [
      {
        id: 'nytimes-world',
        name: 'The New York Times World',
        url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
      },
      {
        id: 'nytimes-us',
        name: 'The New York Times US',
        url: 'https://rss.nytimes.com/services/xml/rss/nyt/US.xml',
      },
    ],
  },
  {
    id: 'reino_unido',
    label: 'Reino Unido',
    feeds: [
      {
        id: 'bbc-uk',
        name: 'BBC News UK',
        url: 'https://feeds.bbci.co.uk/news/uk/rss.xml',
      },
      {
        id: 'guardian-uk',
        name: 'The Guardian UK',
        url: 'https://www.theguardian.com/uk/rss',
      },
    ],
  },
  {
    id: 'espana',
    label: 'España',
    feeds: [
      {
        id: 'elpais',
        name: 'El Pais',
        url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada',
      },
    ],
  },
  {
    id: 'alemania',
    label: 'Alemania',
    feeds: [
      {
        id: 'dw-world',
        name: 'Deutsche Welle World',
        url: 'https://rss.dw.com/rdf/rss-en-world',
      },
    ],
  },
];

export function getNewsCatalog() {
  return NEWS_CATALOG.map(country => ({
    id: country.id,
    label: country.label,
    feeds: country.feeds.map(feed => ({ id: feed.id, name: feed.name })),
  }));
}

// Mapa de palabras -> categoria semantica (BITACORA Parte 2)
const CATEGORIAS = {
  conflicto: ['war', 'attack', 'conflict', 'bomb', 'kill', 'battle', 'troops', 'military', 'gun', 'missile', 'violence', 'terror', 'shoot', 'explosion', 'guerra', 'ataque'],
  migracion: ['migrant', 'refugee', 'asylum', 'border', 'displacement', 'flee', 'migration', 'migracion', 'refugio', 'frontera'],
  economia:  ['market', 'economy', 'inflation', 'trade', 'bank', 'price', 'dollar', 'debt', 'gdp', 'rate', 'economia', 'mercado'],
  clima:     ['climate', 'flood', 'fire', 'storm', 'heat', 'drought', 'hurricane', 'earthquake', 'tsunami', 'tornado', 'temperatura'],
  vida:      ['birth', 'child', 'baby', 'health', 'hospital', 'nacimiento', 'salud'],
  muerte:    ['death', 'dead', 'die', 'killed', 'victim', 'casualties', 'murder', 'muerte', 'muerto', 'asesinato'],
  politica:  ['election', 'president', 'government', 'protest', 'vote', 'democracy', 'leader', 'minister', 'eleccion', 'gobierno'],
};

const STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'being', 'their', 'there', 'these', 'those', 'which', 'would',
  'could', 'should', 'where', 'while', 'world', 'news', 'from', 'with', 'that', 'have', 'over', 'into',
]);

export class NewsRSSAdapter extends DataSourceAdapter {
  constructor() {
    super();
    this._titulares        = [];
    this._categorias       = {};
    this._categoriaDetalle = {};
    this._categoriaDom     = null;
    this._palabrasDom      = [];
    this._sourceStats      = {};
    this._countryId        = 'global';
    this._sourceId         = 'all';
    this._activeFeeds      = getFeedsForSelection(this._countryId, this._sourceId);
    this._feedsEstado      = this._activeFeeds.map(feed => ({ ...feed, estado: 'pendiente', items: 0, error: null }));
    this._modo             = 'iniciando';
    this._fetchSeq         = 0;
    this.magnitud          = 0.3;
    this.payloadText       = 'noticias: cargando RSS...';
  }

  start() {
    this._fetch();
    setInterval(() => this._fetch(), 15 * 60 * 1000); // cada 15 min
  }

  tick() {
    if (this._modo !== 'real') {
      const drift = (Math.random() - 0.5) * 0.02;
      this.magnitud    = clamp(this.magnitud + drift, 0, 1);
      this.cambio      = drift;
      this.volatilidad = clamp(this.volatilidad * 0.9 + Math.abs(drift) * 2, 0, 1);
      return;
    }

    // Entre fetches, el mundo no se congela: oscila muy poco alrededor del ultimo analisis.
    const drift = (Math.random() - 0.5) * 0.01;
    this.cambio = drift;
    this.magnitud = clamp(this.magnitud + drift, 0, 1);
  }

  async _fetch() {
    const seq = ++this._fetchSeq;
    const activeFeeds = this._activeFeeds;
    const resultados = await Promise.allSettled(activeFeeds.map(feed => this._fetchFeed(feed)));
    if (seq !== this._fetchSeq) return;

    const titulares = [];
    const estados = [];

    for (let i = 0; i < resultados.length; i++) {
      const feed = activeFeeds[i];
      const result = resultados[i];
      if (result.status === 'fulfilled') {
        titulares.push(...result.value.items);
        estados.push({ ...feed, estado: 'ok', items: result.value.items.length, error: null });
      } else {
        estados.push({ ...feed, estado: 'error', items: 0, error: result.reason?.message || 'error' });
      }
    }

    this._feedsEstado = estados;

    if (!titulares.length) {
      this._modo = 'error';
      const errores = estados.filter(s => s.error).map(s => `${s.name}: ${s.error}`).join(' · ');
      this.payloadText = `noticias: sin RSS (${errores || 'sin datos'})`;
      return;
    }

    this._titulares = titulares;
    this._procesarTitulares();
    this._modo = 'real';
  }

  setSelection(countryId = 'global', sourceId = 'all') {
    this._countryId = NEWS_CATALOG.some(country => country.id === countryId) ? countryId : 'global';
    this._sourceId = sourceId || 'all';
    this._activeFeeds = getFeedsForSelection(this._countryId, this._sourceId);
    this._feedsEstado = this._activeFeeds.map(feed => ({ ...feed, estado: 'pendiente', items: 0, error: null }));
    this._titulares = [];
    this._categorias = {};
    this._categoriaDetalle = {};
    this._palabrasDom = [];
    this._sourceStats = {};
    this._modo = 'cargando';
    const country = NEWS_CATALOG.find(c => c.id === this._countryId);
    const source = this._sourceId === 'all'
      ? 'todos los medios'
      : this._activeFeeds[0]?.name || this._sourceId;
    this.payloadText = `noticias: ${country?.label || this._countryId} / ${source}`;
    return this._fetch();
  }

  getCatalog() {
    return getNewsCatalog();
  }

  getSelection() {
    const country = NEWS_CATALOG.find(c => c.id === this._countryId);
    return {
      countryId: this._countryId,
      countryLabel: country?.label || this._countryId,
      sourceId: this._sourceId,
      sourceLabel: this._sourceId === 'all' ? 'Todos los medios' : this._activeFeeds[0]?.name || this._sourceId,
      feeds: this._activeFeeds,
    };
  }

  async _fetchFeed(feed) {
    const errors = [];

    try {
      const res = await fetchWithTimeout(feed.url, 7000);
      if (!res.ok) throw new Error(`direct HTTP ${res.status}`);
      const xmlText = await res.text();
      return { feed, items: parseXmlItems(xmlText, feed) };
    } catch (e) {
      errors.push(e.message || String(e));
    }

    try {
      const res = await fetchWithTimeout(`${PROXY}${encodeURIComponent(feed.url)}`, 7000);
      if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
      const json = await res.json();
      return { feed, items: parseXmlItems(json.contents, feed) };
    } catch (e) {
      errors.push(e.message || String(e));
    }

    try {
      const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
      const res = await fetchWithTimeout(url, 7000);
      if (!res.ok) throw new Error(`rss2json HTTP ${res.status}`);
      const json = await res.json();
      const items = (json.items || []).slice(0, 18).map(item => ({
        feedId: feed.id,
        source: feed.name,
        title: item.title || '',
        description: item.description || '',
        text: `${item.title || ''} ${item.description || ''}`,
      })).filter(item => item.title || item.description);
      return { feed, items };
    } catch (e) {
      errors.push(e.message || String(e));
    }

    throw new Error(errors.filter(Boolean).slice(-2).join(' / ') || 'sin respuesta');
  }

  _procesarTitulares() {
    if (!this._titulares.length) return;

    const conteo = {};
    const detalle = {};
    const sourceStats = {};
    const keywordFreq = {};
    let total = 0;

    for (const feed of this._activeFeeds) {
      sourceStats[feed.name] = {
        items: this._titulares.filter(t => t.source === feed.name).length,
        matches: 0,
        categorias: {},
        palabras: {},
      };
    }

    for (const [cat, keys] of Object.entries(CATEGORIAS)) {
      conteo[cat] = 0;
      detalle[cat] = { total: 0, palabras: {}, fuentes: {} };
    }

    for (const item of this._titulares) {
      const itemText = normalize(item.text);
      const stat = sourceStats[item.source] || (sourceStats[item.source] = { items: 0, matches: 0, categorias: {}, palabras: {} });

      for (const [cat, keys] of Object.entries(CATEGORIAS)) {
        for (const key of keys) {
          const count = countWord(itemText, normalize(key));
          if (!count) continue;

          conteo[cat] += count;
          detalle[cat].total += count;
          detalle[cat].palabras[key] = (detalle[cat].palabras[key] || 0) + count;
          detalle[cat].fuentes[item.source] = (detalle[cat].fuentes[item.source] || 0) + count;

          stat.matches += count;
          stat.categorias[cat] = (stat.categorias[cat] || 0) + count;
          stat.palabras[key] = (stat.palabras[key] || 0) + count;
          keywordFreq[key] = (keywordFreq[key] || 0) + count;
          total += count;
        }
      }
    }

    this._categorias = conteo;
    this._categoriaDetalle = detalle;
    this._sourceStats = sourceStats;

    let domCat = 'sin foco', domVal = 0;
    for (const [cat, val] of Object.entries(conteo)) {
      if (val > domVal) { domCat = cat; domVal = val; }
    }
    this._categoriaDom = domCat;

    const intensos = (conteo.conflicto || 0) + (conteo.muerte || 0) + (conteo.clima || 0);
    const prevMag = this.magnitud;
    this.magnitud    = total > 0 ? clamp(intensos / Math.max(total, 5), 0, 1) : 0.3;
    this.cambio      = this.magnitud - prevMag;
    this.tendencia   = this.tendencia * 0.8 + this.cambio * 0.2;
    this.volatilidad = clamp(Object.values(conteo).filter(v => v > 0).length / 5, 0, 1);

    this._palabrasDom = Object.entries(keywordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([w, n]) => ({ palabra: w, n }));

    const words = this._palabrasDom.map(w => w.palabra).join(', ') || topPlainWords(this._titulares);
    const feedsOk = this._feedsEstado.filter(f => f.estado === 'ok').map(f => f.name.replace(' News', '')).join(' + ');
    this.payloadText = `${domCat.toUpperCase()}: ${words}${feedsOk ? ` · ${feedsOk}` : ''}`;
  }

  getCategorias() { return this._categorias; }
  getCatDominante() { return this._categoriaDom; }
  getPalabras() { return this._palabrasDom; }

  getDebugInfo() {
    return {
      modo: this._modo,
      feeds: this._feedsEstado,
      categorias: this._categorias,
      detalle: this._categoriaDetalle,
      dominante: this._categoriaDom,
      palabras: this._palabrasDom,
      fuentes: this._sourceStats,
      seleccion: this.getSelection(),
      titulares: this._titulares.slice(0, 5).map(t => ({
        fuente: t.source,
        titulo: t.title,
      })),
      flujo: 'RSS -> palabras clave -> categorias -> magnitud/cambio/volatilidad -> AVANZA/RETIENE/MUTA',
    };
  }
}

function getFeedsForSelection(countryId, sourceId) {
  const country = NEWS_CATALOG.find(c => c.id === countryId) || NEWS_CATALOG[0];
  let feeds = country.feeds.map(feed => ({
    ...feed,
    countryId: country.id,
    countryLabel: country.label,
  }));
  if (sourceId && sourceId !== 'all') {
    const selected = feeds.filter(feed => feed.id === sourceId);
    if (selected.length) feeds = selected;
  }
  return feeds;
}

function parseXmlItems(xmlText, feed) {
  const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
  const parserError = xml.querySelector('parsererror');
  if (parserError) throw new Error('XML invalido');

  const items = [...xml.querySelectorAll('item, entry')].slice(0, 18).map(item => {
    const title = textOf(item, 'title');
    const description = textOf(item, 'description') || textOf(item, 'summary');
      return {
        feedId: feed.id,
        source: feed.name,
        title,
        description,
        text: `${title} ${description}`,
    };
  }).filter(item => item.title || item.description);

  return items;
}

function textOf(node, selector) {
  return node.querySelector(selector)?.textContent?.trim() || '';
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function countWord(text, word) {
  if (!word) return 0;
  const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'g');
  return (text.match(re) || []).length;
}

function topPlainWords(items) {
  const freq = {};
  for (const item of items) {
    for (const w of normalize(item.text).split(/\W+/)) {
      if (w.length <= 4 || STOPWORDS.has(w)) continue;
      freq[w] = (freq[w] || 0) + 1;
    }
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w]) => w).join(', ');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
