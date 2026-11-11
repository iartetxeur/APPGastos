import { addDays, differenceInCalendarDays, format, getDaysInMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Movimiento, Tipo } from '../db'
import { deIso, iso, rango, type Rango, type Unidad } from './periodos'

const FORMATO_EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

/** Formatea céntimos como euros: 123456 → "1234,56 €". */
export function eur(centimos: number): string {
  return FORMATO_EUR.format(centimos / 100)
}

/** Formatea euros con decimales (inversiones). Precios muy pequeños muestran más decimales. */
export function eurDec(euros: number): string {
  const abs = Math.abs(euros)
  if (abs > 0 && abs < 1) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumSignificantDigits: 4 }).format(euros)
  }
  return FORMATO_EUR.format(euros)
}

export function pct(valor: number): string {
  const signo = valor > 0 ? '+' : ''
  return `${signo}${valor.toLocaleString('es-ES', { maximumFractionDigits: Math.abs(valor) >= 100 ? 0 : 1 })} %`
}

/** Convierte lo que teclea el usuario ("12,50", "12.5", "1.234,56") a céntimos. null si no es válido. */
export function aCentimos(texto: string): number | null {
  const n = aNumero(texto)
  return n === null ? null : Math.round(n * 100)
}

export function aNumero(texto: string): number | null {
  let t = texto.trim().replace(/\s|€/g, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export interface Totales {
  gastos: number
  ingresos: number
  balance: number
}

export function totales(movs: Movimiento[]): Totales {
  let gastos = 0
  let ingresos = 0
  for (const m of movs) {
    if (m.tipo === 'gasto') gastos += m.importe
    else ingresos += m.importe
  }
  return { gastos, ingresos, balance: ingresos - gastos }
}

export function filtrar(movs: Movimiento[], r: Rango): Movimiento[] {
  return movs.filter((m) => m.fecha >= r.desde && m.fecha <= r.hasta)
}

export interface TotalCategoria {
  categoriaId: string
  total: number
}

export function porCategoria(movs: Movimiento[], tipo: Tipo): TotalCategoria[] {
  const mapa = new Map<string, number>()
  for (const m of movs) {
    if (m.tipo === tipo) mapa.set(m.categoriaId, (mapa.get(m.categoriaId) ?? 0) + m.importe)
  }
  return [...mapa].map(([categoriaId, total]) => ({ categoriaId, total })).sort((a, b) => b.total - a.total)
}

/** Variación porcentual respecto al periodo anterior; null si no había nada con qué comparar. */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return ((actual - anterior) / anterior) * 100
}

export interface PuntoSerie {
  etiqueta: string
  gastos: number
  ingresos: number
}

/** Reparte los movimientos del periodo en barras: días (semana/mes) o meses (año). */
export function serie(movs: Movimiento[], unidad: Unidad, ref: Date): PuntoSerie[] {
  const r = rango(unidad, ref)
  const dentro = filtrar(movs, r)
  if (unidad === 'anio') {
    const puntos: PuntoSerie[] = Array.from({ length: 12 }, (_, i) => ({
      etiqueta: format(new Date(ref.getFullYear(), i, 1), 'LLL', { locale: es }),
      gastos: 0,
      ingresos: 0,
    }))
    for (const m of dentro) {
      const p = puntos[Number(m.fecha.slice(5, 7)) - 1]
      if (m.tipo === 'gasto') p.gastos += m.importe
      else p.ingresos += m.importe
    }
    return puntos
  }
  const inicio = deIso(r.desde)
  const dias = differenceInCalendarDays(deIso(r.hasta), inicio) + 1
  const indice = new Map<string, PuntoSerie>()
  const puntos: PuntoSerie[] = []
  for (let i = 0; i < dias; i++) {
    const d = addDays(inicio, i)
    const p: PuntoSerie = {
      etiqueta: unidad === 'semana' ? format(d, 'EEEEEE', { locale: es }) : format(d, 'd'),
      gastos: 0,
      ingresos: 0,
    }
    puntos.push(p)
    indice.set(iso(d), p)
  }
  for (const m of dentro) {
    const p = indice.get(m.fecha)
    if (!p) continue
    if (m.tipo === 'gasto') p.gastos += m.importe
    else p.ingresos += m.importe
  }
  return puntos
}

export interface Prevision {
  mediaDiaria: number
  finDeMes: number
}

/** Con lo gastado este mes hasta hoy, estima el gasto a fin de mes al mismo ritmo. */
export function prevision(gastadoMes: number, hoy: Date): Prevision {
  const transcurridos = hoy.getDate()
  const mediaDiaria = Math.round(gastadoMes / transcurridos)
  return { mediaDiaria, finDeMes: Math.round((gastadoMes / transcurridos) * getDaysInMonth(hoy)) }
}

export type EstadoPresupuesto = 'bien' | 'cerca' | 'superado'

export function estadoPresupuesto(gastado: number, limite: number): EstadoPresupuesto {
  if (limite <= 0) return 'bien'
  if (gastado > limite) return 'superado'
  return gastado >= limite * 0.8 ? 'cerca' : 'bien'
}
