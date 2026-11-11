import { describe, expect, it } from 'vitest'
import { BaseDatos, type Movimiento, type Operacion, type Precio, type Activo } from '../db'
import { aCentimos, estadoPresupuesto, porCategoria, prevision, serie, totales, variacion } from './calculos'
import { calcularPosicion, resumirCartera } from './cartera'
import { crearCopia, importarCopia, movimientosACsv } from './copia'
import { etiquetaDia, mover, rango } from './periodos'
import { aplicarRecurrentes, equivalenteMensual, fechaSerie, pendientes } from './recurrentes'

let n = 0
function mov(tipo: 'gasto' | 'ingreso', importe: number, fecha: string, categoriaId = 'comida'): Movimiento {
  return { id: `m${n++}`, tipo, importe, categoriaId, fecha, nota: '', creado: 0 }
}

describe('periodos', () => {
  it('la semana empieza en lunes y acaba en domingo', () => {
    // 11 nov 2026 es miércoles
    expect(rango('semana', new Date(2026, 10, 11))).toEqual({ desde: '2026-11-09', hasta: '2026-11-15' })
    // un domingo pertenece a la semana que empezó el lunes anterior
    expect(rango('semana', new Date(2026, 10, 15))).toEqual({ desde: '2026-11-09', hasta: '2026-11-15' })
  })
  it('una semana puede cruzar de año', () => {
    expect(rango('semana', new Date(2027, 0, 1))).toEqual({ desde: '2026-12-28', hasta: '2027-01-03' })
  })
  it('mes y año', () => {
    expect(rango('mes', new Date(2028, 1, 10))).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' })
    expect(rango('anio', new Date(2026, 5, 1))).toEqual({ desde: '2026-01-01', hasta: '2026-12-31' })
  })
  it('mover de enero a diciembre cambia de año', () => {
    expect(rango('mes', mover('mes', new Date(2026, 0, 31), -1)).desde).toBe('2025-12-01')
  })
  it('etiquetas de día', () => {
    expect(etiquetaDia('2026-11-11', '2026-11-11')).toBe('Hoy')
    expect(etiquetaDia('2026-10-31', '2026-11-01')).toBe('Ayer')
    expect(etiquetaDia('2026-11-02', '2026-11-11')).toBe('Lunes 2 de noviembre')
  })
})

describe('cálculos', () => {
  const movs = [
    mov('gasto', 1250, '2026-11-09'),
    mov('gasto', 3000, '2026-11-11', 'ocio'),
    mov('gasto', 750, '2026-11-11'),
    mov('ingreso', 150000, '2026-11-01', 'sueldo'),
    mov('gasto', 9999, '2026-10-31'),
  ]
  it('totales y balance', () => {
    expect(totales(movs)).toEqual({ gastos: 14999, ingresos: 150000, balance: 135001 })
  })
  it('por categoría, de mayor a menor', () => {
    expect(porCategoria(movs, 'gasto')).toEqual([
      { categoriaId: 'comida', total: 11999 },
      { categoriaId: 'ocio', total: 3000 },
    ])
  })
  it('serie semanal: 7 barras y solo lo de esa semana', () => {
    const s = serie(movs, 'semana', new Date(2026, 10, 11))
    expect(s).toHaveLength(7)
    expect(s.map((p) => p.gastos)).toEqual([1250, 0, 3750, 0, 0, 0, 0])
  })
  it('serie mensual y anual', () => {
    const mes = serie(movs, 'mes', new Date(2026, 10, 11))
    expect(mes).toHaveLength(30)
    expect(mes[0].ingresos).toBe(150000)
    const anio = serie(movs, 'anio', new Date(2026, 10, 11))
    expect(anio).toHaveLength(12)
    expect(anio[9].gastos).toBe(9999)
    expect(anio[10].gastos).toBe(5000)
  })
  it('variación respecto al periodo anterior', () => {
    expect(variacion(115, 100)).toBeCloseTo(15)
    expect(variacion(50, 100)).toBeCloseTo(-50)
    expect(variacion(50, 0)).toBeNull()
  })
  it('previsión de fin de mes', () => {
    // 300 € en 10 días de un mes de 30 → 30 €/día → 900 €
    expect(prevision(30000, new Date(2026, 10, 10))).toEqual({ mediaDiaria: 3000, finDeMes: 90000 })
  })
  it('estado del presupuesto', () => {
    expect(estadoPresupuesto(7900, 10000)).toBe('bien')
    expect(estadoPresupuesto(8000, 10000)).toBe('cerca')
    expect(estadoPresupuesto(10000, 10000)).toBe('cerca')
    expect(estadoPresupuesto(10001, 10000)).toBe('superado')
  })
  it('convierte lo tecleado a céntimos', () => {
    expect(aCentimos('12,50')).toBe(1250)
    expect(aCentimos('12.5')).toBe(1250)
    expect(aCentimos('1.234,56')).toBe(123456)
    expect(aCentimos('0,1')).toBe(10)
    expect(aCentimos('19,99 €')).toBe(1999)
    expect(aCentimos('')).toBeNull()
    expect(aCentimos('abc')).toBeNull()
    expect(aCentimos('-5')).toBeNull()
  })
})

describe('recurrentes', () => {
  it('un día 31 mensual no se queda atascado en 28', () => {
    expect(fechaSerie('2026-01-31', 'mensual', 1)).toBe('2026-02-28')
    expect(fechaSerie('2026-01-31', 'mensual', 2)).toBe('2026-03-31')
  })
  it('genera todas las fechas vencidas y avanza la próxima', () => {
    const r = pendientes({ inicio: '2026-08-05', proxima: '2026-09-05', periodicidad: 'mensual' }, '2026-11-11')
    expect(r.fechas).toEqual(['2026-09-05', '2026-10-05', '2026-11-05'])
    expect(r.proxima).toBe('2026-12-05')
  })
  it('nada pendiente si aún no toca', () => {
    const r = pendientes({ inicio: '2026-11-20', proxima: '2026-11-20', periodicidad: 'semanal' }, '2026-11-11')
    expect(r).toEqual({ fechas: [], proxima: '2026-11-20' })
  })
  it('equivalente mensual', () => {
    expect(equivalenteMensual({ importe: 12000, periodicidad: 'anual' })).toBe(1000)
    expect(equivalenteMensual({ importe: 1200, periodicidad: 'semanal' })).toBe(5200)
  })
  it('crea los movimientos una sola vez', async () => {
    const base = new BaseDatos('prueba-recurrentes')
    await base.recurrentes.add({
      id: 'r1', tipo: 'gasto', importe: 999, categoriaId: 'suscripciones', nota: 'Música',
      periodicidad: 'mensual', inicio: '2026-09-15', proxima: '2026-09-15', activo: true,
    })
    await base.recurrentes.add({
      id: 'r2', tipo: 'gasto', importe: 5000, categoriaId: 'ocio', nota: 'Pausado',
      periodicidad: 'mensual', inicio: '2026-01-01', proxima: '2026-01-01', activo: false,
    })
    expect(await aplicarRecurrentes('2026-11-11', base)).toBe(2)
    expect(await aplicarRecurrentes('2026-11-11', base)).toBe(0)
    const movs = await base.movimientos.orderBy('fecha').toArray()
    expect(movs.map((m) => m.fecha)).toEqual(['2026-09-15', '2026-10-15'])
    expect(movs[0]).toMatchObject({ importe: 999, recurrenteId: 'r1', nota: 'Música' })
    expect((await base.recurrentes.get('r1'))?.proxima).toBe('2026-11-15')
    await base.delete()
  })
})

describe('cartera', () => {
  const op = (tipo: 'compra' | 'venta', cantidad: number, precio: number, fecha: string, comision = 0, activoId = 'btc'): Operacion =>
    ({ id: `o${n++}`, activoId, tipo, cantidad, precio, comision, fecha })

  it('coste medio con varias compras', () => {
    const p = calcularPosicion([op('compra', 1, 100, '2026-01-01'), op('compra', 3, 200, '2026-02-01')])
    expect(p.cantidad).toBe(4)
    expect(p.invertido).toBe(700)
    expect(p.costeMedio).toBe(175)
  })
  it('una venta materializa ganancia y no cambia el coste medio', () => {
    const p = calcularPosicion([
      op('venta', 2, 300, '2026-03-01', 5),
      op('compra', 3, 200, '2026-02-01'),
      op('compra', 1, 100, '2026-01-01'),
    ])
    expect(p.cantidad).toBe(2)
    expect(p.costeMedio).toBe(175)
    expect(p.invertido).toBe(350)
    expect(p.realizado).toBe(2 * 300 - 5 - 2 * 175)
  })
  it('las comisiones de compra entran en el coste', () => {
    expect(calcularPosicion([op('compra', 10, 10, '2026-01-01', 2)]).costeMedio).toBeCloseTo(10.2)
  })
  it('vender todo deja la posición a cero', () => {
    const p = calcularPosicion([op('compra', 0.1, 50000, '2026-01-01'), op('venta', 0.1, 60000, '2026-02-01')])
    expect(p.cantidad).toBe(0)
    expect(p.invertido).toBe(0)
    expect(p.realizado).toBeCloseTo(1000)
  })
  it('resumen de cartera con precios en vivo', () => {
    const activos: Activo[] = [
      { id: 'btc', tipo: 'cripto', simbolo: 'BTC', nombre: 'Bitcoin', par: 'BTCEUR', creado: 0 },
      { id: 'nvda', tipo: 'accion', simbolo: 'NVDA', nombre: 'Nvidia', par: 'NVDA', creado: 0 },
      { id: 'eth', tipo: 'cripto', simbolo: 'ETH', nombre: 'Ethereum', par: 'ETHEUR', creado: 0 },
    ]
    const ops = [op('compra', 0.5, 40000, '2026-01-01'), op('compra', 10, 100, '2026-01-01', 0, 'nvda')]
    const precios = new Map<string, Precio>([
      ['btc', { activoId: 'btc', precio: 66000, cambioDia: 10, max: null, min: null, hora: 0 }],
      ['nvda', { activoId: 'nvda', precio: 90, cambioDia: -10, max: null, min: null, hora: 0 }],
    ])
    const r = resumirCartera(activos, ops, precios)
    expect(r.valor).toBe(33900)
    expect(r.invertido).toBe(21000)
    expect(r.ganancia).toBe(12900)
    expect(r.gananciaPct).toBeCloseTo(61.43, 1)
    // BTC: 33000 − 30000 = +3000 hoy; NVDA: 900 − 1000 = −100 hoy
    expect(r.cambioDiaEur).toBeCloseTo(2900)
    expect(r.completo).toBe(true)
    expect(r.lineas[2].valor).toBe(0) // solo en seguimiento
    expect(resumirCartera(activos, ops, new Map()).completo).toBe(false)
  })
})

describe('copia de seguridad', () => {
  it('exportar e importar en otro dispositivo, sin duplicar y sin la clave de la API', async () => {
    const a = new BaseDatos('prueba-copia-a')
    await a.movimientos.bulkAdd([mov('gasto', 1250, '2026-11-09'), mov('ingreso', 100000, '2026-11-01', 'sueldo')])
    await a.presupuestos.add({ categoriaId: 'ocio', limite: 10000 })
    await a.ajustes.bulkPut([{ clave: 'finnhubClave', valor: 'secreta' }, { clave: 'tema', valor: 'oscuro' }])
    const copia = JSON.parse(JSON.stringify(await crearCopia(a)))
    expect(JSON.stringify(copia)).not.toContain('secreta')

    const b = new BaseDatos('prueba-copia-b')
    await b.movimientos.add(mov('gasto', 500, '2026-11-10'))
    await importarCopia(copia, b)
    await importarCopia(copia, b)
    expect(await b.movimientos.count()).toBe(3)
    expect(await b.presupuestos.get('ocio')).toEqual({ categoriaId: 'ocio', limite: 10000 })
    expect((await b.ajustes.get('tema'))?.valor).toBe('oscuro')
    expect(await b.categorias.count()).toBe(await a.categorias.count())
    await expect(importarCopia({ hola: 1 }, b)).rejects.toThrow()
    await a.delete()
    await b.delete()
  })
  it('CSV con coma decimal y gastos en negativo', async () => {
    const csv = movimientosACsv(
      [{ ...mov('gasto', 1250, '2026-11-09'), nota: 'pan; leche' }, mov('ingreso', 100000, '2026-11-01', 'sueldo')],
      [{ id: 'comida', nombre: 'Comida', icono: '', color: '', tipo: 'gasto', orden: 1 }],
    )
    expect(csv.split('\r\n')).toEqual([
      'Fecha;Tipo;Categoría;Importe;Nota',
      '2026-11-01;ingreso;sueldo;1000,00;',
      '2026-11-09;gasto;Comida;-12,50;"pan; leche"',
      '',
    ])
  })
})
