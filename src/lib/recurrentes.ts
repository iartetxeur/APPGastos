import { addMonths, addWeeks, addYears } from 'date-fns'
import { db, nuevoId, type BaseDatos, type Movimiento, type Periodicidad, type Recurrente } from '../db'
import { deIso, hoyIso, iso } from './periodos'

/** Fecha número k (0 = inicio) de la serie. Se calcula desde el inicio para que un día 31 no se quede en 28. */
export function fechaSerie(inicio: string, periodicidad: Periodicidad, k: number): string {
  const d = deIso(inicio)
  switch (periodicidad) {
    case 'semanal':
      return iso(addWeeks(d, k))
    case 'mensual':
      return iso(addMonths(d, k))
    case 'anual':
      return iso(addYears(d, k))
  }
}

const MAX_PASOS = 1000

/** Fechas pendientes de generar (proxima ≤ hoy) y la nueva "proxima". */
export function pendientes(
  rec: Pick<Recurrente, 'inicio' | 'proxima' | 'periodicidad'>,
  hoy: string,
): { fechas: string[]; proxima: string } {
  const fechas: string[] = []
  let proxima = rec.proxima
  for (let k = 0; k < MAX_PASOS; k++) {
    const f = fechaSerie(rec.inicio, rec.periodicidad, k)
    if (f < rec.proxima) continue
    if (f > hoy) {
      proxima = f
      return { fechas, proxima }
    }
    fechas.push(f)
    proxima = fechaSerie(rec.inicio, rec.periodicidad, k + 1)
  }
  return { fechas, proxima }
}

/** Coste mensual equivalente (céntimos) para sumar "comprometido al mes". */
export function equivalenteMensual(rec: Pick<Recurrente, 'importe' | 'periodicidad'>): number {
  switch (rec.periodicidad) {
    case 'semanal':
      return Math.round((rec.importe * 52) / 12)
    case 'mensual':
      return rec.importe
    case 'anual':
      return Math.round(rec.importe / 12)
  }
}

/** Crea los movimientos de los recurrentes vencidos. Devuelve cuántos se han creado. */
export async function aplicarRecurrentes(hoy: string = hoyIso(), base: BaseDatos = db): Promise<number> {
  return base.transaction('rw', base.recurrentes, base.movimientos, async () => {
    let creados = 0
    for (const rec of await base.recurrentes.toArray()) {
      if (!rec.activo) continue
      const { fechas, proxima } = pendientes(rec, hoy)
      if (fechas.length === 0) continue
      const nuevos: Movimiento[] = fechas.map((fecha) => ({
        id: nuevoId(),
        tipo: rec.tipo,
        importe: rec.importe,
        categoriaId: rec.categoriaId,
        fecha,
        nota: rec.nota,
        recurrenteId: rec.id,
        creado: Date.now(),
      }))
      await base.movimientos.bulkAdd(nuevos)
      await base.recurrentes.update(rec.id, { proxima })
      creados += nuevos.length
    }
    return creados
  })
}
