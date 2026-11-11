import { db, guardarAjuste, type BaseDatos, type Categoria, type Movimiento } from '../db'
import { hoyIso } from './periodos'

export const VERSION_COPIA = 1

/** Ajustes que no salen del dispositivo: la clave de la API y datos internos de precios. */
const AJUSTES_PRIVADOS = new Set(['finnhubClave', 'usdEur', 'ultimaCopia'])

const TABLAS = ['movimientos', 'categorias', 'presupuestos', 'recurrentes', 'activos', 'operaciones', 'fotosCartera'] as const

export interface Copia {
  app: 'appgastos'
  version: number
  fecha: string
  datos: Record<string, unknown[]>
}

export async function crearCopia(base: BaseDatos = db): Promise<Copia> {
  const datos: Record<string, unknown[]> = {}
  for (const t of TABLAS) datos[t] = await base.table(t).toArray()
  datos.ajustes = (await base.ajustes.toArray()).filter((a) => !AJUSTES_PRIVADOS.has(a.clave))
  return { app: 'appgastos', version: VERSION_COPIA, fecha: new Date().toISOString(), datos }
}

export function esCopia(x: unknown): x is Copia {
  if (typeof x !== 'object' || x === null) return false
  const c = x as Partial<Copia>
  return c.app === 'appgastos' && typeof c.version === 'number' && typeof c.datos === 'object' && c.datos !== null
}

/** Fusiona la copia con lo que ya hay: cada registro se identifica por su id, así que no se duplica nada. */
export async function importarCopia(copia: unknown, base: BaseDatos = db): Promise<number> {
  if (!esCopia(copia)) throw new Error('El archivo no es una copia de APPGastos.')
  if (copia.version > VERSION_COPIA) throw new Error('La copia es de una versión más nueva de la app.')
  let total = 0
  await base.transaction('rw', base.tables, async () => {
    for (const t of TABLAS) {
      const filas = copia.datos[t]
      if (!Array.isArray(filas) || filas.length === 0) continue
      await base.table(t).bulkPut(filas)
      total += filas.length
    }
    const ajustes = copia.datos.ajustes
    if (Array.isArray(ajustes)) {
      const validos = (ajustes as { clave?: unknown }[]).filter(
        (a) => typeof a?.clave === 'string' && !AJUSTES_PRIVADOS.has(a.clave),
      )
      await base.ajustes.bulkPut(validos as never[])
    }
  })
  return total
}

function celda(v: string): string {
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** CSV con punto y coma y coma decimal, que es lo que abren bien Excel y LibreOffice en español. */
export function movimientosACsv(movs: Movimiento[], categorias: Categoria[]): string {
  const nombres = new Map(categorias.map((c) => [c.id, c.nombre]))
  const lineas = ['Fecha;Tipo;Categoría;Importe;Nota']
  for (const m of [...movs].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const importe = ((m.tipo === 'gasto' ? -m.importe : m.importe) / 100).toFixed(2).replace('.', ',')
    lineas.push([m.fecha, m.tipo, celda(nombres.get(m.categoriaId) ?? m.categoriaId), importe, celda(m.nota)].join(';'))
  }
  return lineas.join('\r\n') + '\r\n'
}

export function descargar(nombre: string, contenido: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportarJson(): Promise<void> {
  const copia = await crearCopia()
  descargar(`appgastos-copia-${hoyIso()}.json`, JSON.stringify(copia, null, 1), 'application/json')
  await guardarAjuste('ultimaCopia', Date.now())
}

export async function exportarCsv(): Promise<void> {
  const csv = movimientosACsv(await db.movimientos.toArray(), await db.categorias.toArray())
  // El BOM hace que Excel reconozca los acentos (UTF-8)
  descargar(`appgastos-movimientos-${hoyIso()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8')
}
