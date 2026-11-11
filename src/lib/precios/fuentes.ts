// Fuentes públicas de precios. Todas permiten llamadas directas desde el navegador (CORS abierto).
// - Binance (datos de mercado, sin clave): criptomonedas en vivo e histórico
// - CoinGecko (sin clave): buscador de criptomonedas por nombre
// - Finnhub (clave gratuita del usuario): acciones de EE. UU.
// - Frankfurter (BCE, sin clave): cambio USD → EUR

const BINANCE = 'https://data-api.binance.vision/api/v3'
export const BINANCE_WS = 'wss://data-stream.binance.vision/stream?streams='
const COINGECKO = 'https://api.coingecko.com/api/v3'
const FINNHUB = 'https://finnhub.io/api/v1'
const FRANKFURTER = 'https://api.frankfurter.dev/v1'

export interface Cotizacion {
  /** En la moneda de origen (EUR, o USD si `enUsd`). */
  precio: number
  cambioDia: number | null
  max: number | null
  min: number | null
  hora: number
  enUsd: boolean
}

export interface Resultado {
  simbolo: string
  nombre: string
}

export class ErrorClave extends Error {}
export class ErrorLimite extends Error {}

async function json(url: string, init?: RequestInit): Promise<unknown> {
  const r = await fetch(url, init)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export function parEnUsd(par: string): boolean {
  return par.endsWith('USDT')
}

/** Cotización 24 h de un par de Binance. null si el par no existe. */
export async function tickerBinance(par: string): Promise<Cotizacion | null> {
  const r = await fetch(`${BINANCE}/ticker/24hr?symbol=${encodeURIComponent(par)}`)
  if (r.status === 400) return null
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const d = (await r.json()) as Record<string, string>
  const precio = Number(d.lastPrice)
  if (!(precio > 0)) return null
  return {
    precio,
    cambioDia: Number(d.priceChangePercent),
    max: Number(d.highPrice),
    min: Number(d.lowPrice),
    hora: Date.now(),
    enUsd: parEnUsd(par),
  }
}

/** Busca el par con el que cotiza una cripto: primero en euros y, si no hay, en dólares (USDT). */
export async function resolverPar(simbolo: string): Promise<string | null> {
  const s = simbolo.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!s) return null
  for (const par of [`${s}EUR`, `${s}USDT`]) {
    if (await tickerBinance(par)) return par
  }
  return null
}

export type RangoHistorico = '1D' | '7D' | '30D' | '1A'

const VELAS: Record<RangoHistorico, { intervalo: string; limite: number }> = {
  '1D': { intervalo: '15m', limite: 96 },
  '7D': { intervalo: '1h', limite: 168 },
  '30D': { intervalo: '4h', limite: 180 },
  '1A': { intervalo: '1d', limite: 365 },
}

export interface PuntoHistorico {
  t: number
  precio: number
}

/** Precios de cierre históricos, en la moneda del par. */
export async function historicoBinance(par: string, rango: RangoHistorico): Promise<PuntoHistorico[]> {
  const { intervalo, limite } = VELAS[rango]
  const velas = (await json(`${BINANCE}/klines?symbol=${encodeURIComponent(par)}&interval=${intervalo}&limit=${limite}`)) as unknown[][]
  return velas.map((v) => ({ t: Number(v[0]), precio: Number(v[4]) }))
}

export async function buscarCripto(consulta: string): Promise<Resultado[]> {
  const d = (await json(`${COINGECKO}/search?query=${encodeURIComponent(consulta)}`)) as {
    coins?: { name: string; symbol: string }[]
  }
  const vistos = new Set<string>()
  const salida: Resultado[] = []
  for (const c of d.coins ?? []) {
    const simbolo = c.symbol.toUpperCase()
    if (vistos.has(simbolo) || !/^[A-Z0-9]+$/.test(simbolo)) continue
    vistos.add(simbolo)
    salida.push({ simbolo, nombre: c.name })
    if (salida.length >= 8) break
  }
  return salida
}

async function finnhub(ruta: string, clave: string): Promise<unknown> {
  // La clave viaja en una cabecera, no en la URL
  const r = await fetch(`${FINNHUB}${ruta}`, { headers: { 'X-Finnhub-Token': clave } })
  if (r.status === 401 || r.status === 403) throw new ErrorClave('La clave de Finnhub no es válida.')
  if (r.status === 429) throw new ErrorLimite('Límite de peticiones de Finnhub alcanzado.')
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

/** Cotización de una acción (en USD). null si Finnhub no conoce el símbolo. */
export async function cotizacionFinnhub(simbolo: string, clave: string): Promise<Cotizacion | null> {
  const d = (await finnhub(`/quote?symbol=${encodeURIComponent(simbolo)}`, clave)) as Record<string, number | null>
  if (!d.c || d.c <= 0) return null
  return {
    precio: d.c,
    cambioDia: typeof d.dp === 'number' ? d.dp : null,
    max: d.h || null,
    min: d.l || null,
    hora: d.t ? d.t * 1000 : Date.now(),
    enUsd: true,
  }
}

export async function buscarAccion(consulta: string, clave: string): Promise<Resultado[]> {
  const d = (await finnhub(`/search?q=${encodeURIComponent(consulta)}&exchange=US`, clave)) as {
    result?: { description: string; symbol: string; type: string }[]
  }
  return (d.result ?? [])
    .filter((x) => /^[A-Z]+$/.test(x.symbol))
    .slice(0, 8)
    .map((x) => ({ simbolo: x.symbol, nombre: tituloNombre(x.description) }))
}

function tituloNombre(s: string): string {
  return s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())
}

export async function cambioUsdEur(): Promise<number> {
  const d = (await json(`${FRANKFURTER}/latest?base=USD&symbols=EUR`)) as { rates?: { EUR?: number } }
  const v = d.rates?.EUR
  if (!v || !(v > 0)) throw new Error('Tipo de cambio no disponible')
  return v
}
