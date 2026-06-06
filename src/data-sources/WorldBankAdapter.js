import { DataSourceAdapter } from './DataSourceAdapter.js';

// World Bank Open Data API — completamente libre, sin key
// https://datahelpdesk.worldbank.org/knowledgebase/articles/898581
export class WorldBankAdapter extends DataSourceAdapter {
  constructor() {
    super();
    this._paisCodigo    = null;
    this._indicador     = null;
    this._worldBankCode = null;
    this._indicadorMeta = null; // { invert, rango }
    this._valorCrudo    = null;
    this._año            = null;
    this._modo          = 'sin_configurar';
    this.payloadText    = 'lente país: sin configurar';
  }

  async setLente(paisCodigo, indicadorCodigo, indicadorMeta, rango) {
    this._paisCodigo    = paisCodigo;
    this._indicador     = indicadorCodigo;
    this._indicadorMeta = indicadorMeta;
    this._worldBankCode = indicadorMeta?.worldBankCode || indicadorCodigo;
    this._rango         = rango;
    this._valorCrudo    = null;
    this._año           = null;
    this._modo          = 'cargando';
    this.payloadText    = `${paisCodigo}/${indicadorCodigo}: cargando...`;
    await this._fetch();
  }

  tick() {}  // datos anuales — no hay tick de simulación

  async _fetch() {
    if (!this._paisCodigo || !this._indicador) return;
    try {
      if (this._indicadorMeta?.provider === 'unhcr') {
        await this._fetchUnhcr();
        return;
      }

      // Pedimos una ventana amplia porque algunos indicadores publican
      // años nulos antes del último valor efectivo.
      const url = `https://api.worldbank.org/v2/country/${this._paisCodigo}/indicator/${this._worldBankCode}`
        + `?format=json&mrv=20&per_page=20`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Estructura: [ meta, [ { value, date, country } ] ]
      const registros = data[1];
      const registro = registros?.find(item => item?.value !== null && Number.isFinite(Number(item.value)));
      if (!registro) throw new Error('sin serie disponible');

      this._aplicarRegistro(Number(registro.value), registro.date, registro.country?.value || this._paisCodigo);
    } catch (e) {
      if (this._valorCrudo !== null) {
        this._modo = 'fallback';
        this.payloadText = `${this._paisCodigo}/${this._indicador}: sin dato nuevo · conserva ${this._año}`;
      } else {
        this._modo = 'error';
        this.magnitud = 0.5;
        this.payloadText = `${this._paisCodigo}/${this._indicador}: ${e.message} · lente neutra`;
      }
    }
  }

  async _fetchUnhcr() {
    const currentYear = new Date().getFullYear();
    const url = 'https://api.unhcr.org/population/v1/population/'
      + `?yearFrom=${currentYear - 4}&yearTo=${currentYear}&coo=${this._paisCodigo}&limit=20`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`UNHCR HTTP ${res.status}`);
    const data = await res.json();
    const registro = [...(data.items || [])]
      .filter(item => Number.isFinite(Number(item.refugees)))
      .sort((a, b) => Number(b.year) - Number(a.year))[0];
    if (!registro) throw new Error('UNHCR sin serie disponible');
    this._aplicarRegistro(Number(registro.refugees), registro.year, registro.coo_name || this._paisCodigo, 'UNHCR');
  }

  _aplicarRegistro(valorApi, año, pais, fuente = 'World Bank') {
    this._valorCrudo = valorApi / (this._indicadorMeta?.divisor || 1);
    this._año = año;
    const rango = this._rango;
    const norm = rango
      ? Math.max(0, Math.min(1, (this._valorCrudo - rango.min) / (rango.max - rango.min)))
      : Math.max(0, Math.min(1, this._valorCrudo / 100));
    this.magnitud = this._indicadorMeta?.invert ? 1 - norm : norm;
    this.cambio = 0;
    this.tendencia = 0;
    this.volatilidad = 0;
    const antiguedad = Math.max(0, new Date().getFullYear() - Number(año));
    this._modo = antiguedad > 3 ? 'dato_antiguo' : 'real';
    const nota = antiguedad > 3 ? ' · último disponible' : '';
    const displayValue = this._indicadorMeta?.divisor === 1000000
      ? this._valorCrudo < 0.01
        ? `${Math.round(valorApi).toLocaleString('es-AR')} personas`
        : `${this._valorCrudo.toFixed(2)} M`
      : this._valorCrudo.toFixed(2);
    this.payloadText = `${pais} ${año}: ${displayValue} · ${fuente}${nota}`;
  }

  getInfoTexto() {
    return {
      modo:      this._modo,
      crudo:     this._valorCrudo,
      año:       this._año,
      pais:      this._paisCodigo,
      indicador: this._indicador,
      worldBankCode: this._worldBankCode,
      payload:   this.payloadText,
    };
  }
}
