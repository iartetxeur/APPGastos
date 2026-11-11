import {
  addDays, addMonths, addWeeks, addYears, endOfMonth, endOfWeek, endOfYear, format,
  startOfMonth, startOfWeek, startOfYear,
} from 'date-fns'
import { es } from 'date-fns/locale'

export type Unidad = 'dia' | 'semana' | 'mes' | 'anio'

/** Rango de fechas inclusivo en formato 'AAAA-MM-DD'. */
export interface Rango {
  desde: string
  hasta: string
}

const LUNES = { weekStartsOn: 1 as const }

export function iso(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

/** Interpreta 'AAAA-MM-DD' como día local (new Date('AAAA-MM-DD') lo tomaría como UTC). */
export function deIso(s: string): Date {
  const [a, m, d] = s.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function hoyIso(): string {
  return iso(new Date())
}

export function rango(unidad: Unidad, ref: Date): Rango {
  switch (unidad) {
    case 'dia':
      return { desde: iso(ref), hasta: iso(ref) }
    case 'semana':
      return { desde: iso(startOfWeek(ref, LUNES)), hasta: iso(endOfWeek(ref, LUNES)) }
    case 'mes':
      return { desde: iso(startOfMonth(ref)), hasta: iso(endOfMonth(ref)) }
    case 'anio':
      return { desde: iso(startOfYear(ref)), hasta: iso(endOfYear(ref)) }
  }
}

export function mover(unidad: Unidad, ref: Date, n: number): Date {
  switch (unidad) {
    case 'dia':
      return addDays(ref, n)
    case 'semana':
      return addWeeks(ref, n)
    case 'mes':
      return addMonths(ref, n)
    case 'anio':
      return addYears(ref, n)
  }
}

export function enRango(fecha: string, r: Rango): boolean {
  return fecha >= r.desde && fecha <= r.hasta
}

function mayuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function etiqueta(unidad: Unidad, ref: Date): string {
  switch (unidad) {
    case 'dia':
      return mayuscula(format(ref, "EEEE d 'de' MMMM", { locale: es }))
    case 'semana': {
      const a = startOfWeek(ref, LUNES)
      const b = endOfWeek(ref, LUNES)
      return a.getMonth() === b.getMonth()
        ? `${format(a, 'd')} – ${format(b, 'd MMM yyyy', { locale: es })}`
        : `${format(a, 'd MMM', { locale: es })} – ${format(b, 'd MMM yyyy', { locale: es })}`
    }
    case 'mes':
      return mayuscula(format(ref, 'MMMM yyyy', { locale: es }))
    case 'anio':
      return format(ref, 'yyyy')
  }
}

/** "Hoy", "Ayer" o "lunes 3 de noviembre". */
export function etiquetaDia(fecha: string, hoy: string = hoyIso()): string {
  if (fecha === hoy) return 'Hoy'
  if (fecha === iso(addDays(deIso(hoy), -1))) return 'Ayer'
  const d = deIso(fecha)
  const conAnio = fecha.slice(0, 4) !== hoy.slice(0, 4)
  return mayuscula(format(d, conAnio ? "EEEE d 'de' MMMM yyyy" : "EEEE d 'de' MMMM", { locale: es }))
}

export function fechaCorta(fecha: string): string {
  return format(deIso(fecha), 'd MMM yyyy', { locale: es })
}
