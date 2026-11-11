import type { Activo, Operacion, Precio } from '../db'

export interface Posicion {
  cantidad: number
  /** Coste (con comisiones) de la cantidad que aún se tiene. */
  invertido: number
  costeMedio: number
  /** Ganancia o pérdida ya materializada en ventas. */
  realizado: number
}

const EPS = 1e-9

/** Posición por coste medio ponderado a partir de las compras y ventas. */
export function calcularPosicion(ops: Operacion[]): Posicion {
  const orden = [...ops].sort((a, b) => a.fecha.localeCompare(b.fecha))
  let cantidad = 0
  let invertido = 0
  let realizado = 0
  for (const op of orden) {
    if (op.tipo === 'compra') {
      cantidad += op.cantidad
      invertido += op.cantidad * op.precio + op.comision
    } else {
      const vendida = Math.min(op.cantidad, cantidad)
      const medio = cantidad > EPS ? invertido / cantidad : 0
      realizado += vendida * op.precio - op.comision - vendida * medio
      cantidad -= vendida
      invertido -= vendida * medio
    }
    if (cantidad < EPS) {
      cantidad = 0
      invertido = 0
    }
  }
  return { cantidad, invertido, costeMedio: cantidad > 0 ? invertido / cantidad : 0, realizado }
}

export interface LineaCartera {
  activo: Activo
  posicion: Posicion
  precio: Precio | undefined
  valor: number | null
  ganancia: number | null
  gananciaPct: number | null
  /** Cuánto ha variado hoy el valor de la posición, en euros. */
  cambioDiaEur: number | null
}

export interface ResumenCartera {
  lineas: LineaCartera[]
  valor: number
  invertido: number
  ganancia: number
  gananciaPct: number | null
  cambioDiaEur: number
  cambioDiaPct: number | null
  realizado: number
  /** false si falta el precio de algún activo en cartera (los totales serían parciales). */
  completo: boolean
}

export function resumirCartera(activos: Activo[], operaciones: Operacion[], precios: Map<string, Precio>): ResumenCartera {
  const porActivo = new Map<string, Operacion[]>()
  for (const op of operaciones) {
    const lista = porActivo.get(op.activoId)
    if (lista) lista.push(op)
    else porActivo.set(op.activoId, [op])
  }
  const lineas: LineaCartera[] = activos.map((activo) => {
    const posicion = calcularPosicion(porActivo.get(activo.id) ?? [])
    const precio = precios.get(activo.id)
    const tiene = posicion.cantidad > 0
    const valor = precio && tiene ? posicion.cantidad * precio.precio : tiene ? null : 0
    const ganancia = valor !== null && tiene ? valor - posicion.invertido : null
    let cambioDiaEur: number | null = null
    if (valor !== null && tiene && precio && precio.cambioDia !== null) {
      // valor de ayer = valor / (1 + cambio); la diferencia es lo ganado o perdido hoy
      cambioDiaEur = valor - valor / (1 + precio.cambioDia / 100)
    }
    return {
      activo,
      posicion,
      precio,
      valor,
      ganancia,
      gananciaPct: ganancia !== null && posicion.invertido > 0 ? (ganancia / posicion.invertido) * 100 : null,
      cambioDiaEur,
    }
  })
  const enCartera = lineas.filter((l) => l.posicion.cantidad > 0)
  const valor = enCartera.reduce((s, l) => s + (l.valor ?? 0), 0)
  const invertido = enCartera.reduce((s, l) => s + l.posicion.invertido, 0)
  const cambioDiaEur = enCartera.reduce((s, l) => s + (l.cambioDiaEur ?? 0), 0)
  const completo = enCartera.every((l) => l.valor !== null)
  const ayer = valor - cambioDiaEur
  return {
    lineas,
    valor,
    invertido,
    ganancia: valor - invertido,
    gananciaPct: invertido > 0 ? ((valor - invertido) / invertido) * 100 : null,
    cambioDiaEur,
    cambioDiaPct: ayer > 0 ? (cambioDiaEur / ayer) * 100 : null,
    realizado: lineas.reduce((s, l) => s + l.posicion.realizado, 0),
    completo,
  }
}
