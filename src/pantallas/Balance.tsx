import { useMemo, useState } from 'react'
import { BarrasPeriodo } from '../componentes/graficos'
import { buscarCategoria, Cabecera, FilaMovimiento, Segmento, SelectorPeriodo, Vacio, Variacion } from '../componentes/ui'
import type { Tipo } from '../db'
import { useAcciones, useCategorias, useMovimientos } from '../hooks'
import { eur, filtrar, porCategoria, serie, totales, variacion } from '../lib/calculos'
import { mover, rango, type Unidad } from '../lib/periodos'

const RESPECTO: Record<Unidad, string> = {
  dia: 'respecto al día anterior', semana: 'respecto a la semana anterior', mes: 'respecto al mes anterior', anio: 'respecto al año anterior',
}
const NADA_ANTES: Record<Unidad, string> = {
  dia: 'Nada el día anterior', semana: 'Nada la semana anterior', mes: 'Nada el mes anterior', anio: 'Nada el año anterior',
}
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function Balance() {
  const movimientos = useMovimientos()
  const categorias = useCategorias()
  const { abrirMovimiento } = useAcciones()
  const [unidad, setUnidad] = useState<Unidad>('mes')
  const [fecha, setFecha] = useState(() => new Date())
  const [tipo, setTipo] = useState<Tipo>('gasto')

  const d = useMemo(() => {
    const movs = movimientos ?? []
    const actuales = filtrar(movs, rango(unidad, fecha))
    const anteriores = filtrar(movs, rango(unidad, mover(unidad, fecha, -1)))
    return {
      actuales,
      total: totales(actuales),
      totalAnterior: totales(anteriores),
      categorias: porCategoria(actuales, tipo),
      categoriasAnterior: new Map(porCategoria(anteriores, tipo).map((x) => [x.categoriaId, x.total])),
      serie: unidad === 'dia' ? [] : serie(movs, unidad, fecha),
    }
  }, [movimientos, unidad, fecha, tipo])

  if (!movimientos) return null
  const totalTipo = tipo === 'gasto' ? d.total.gastos : d.total.ingresos
  const maximo = d.categorias[0]?.total ?? 0
  const tituloBarra = (e: string) =>
    unidad === 'anio' ? e : unidad === 'mes' ? `${e} de ${MESES[fecha.getMonth()]}` : e

  return (
    <>
      <Cabecera titulo="Balance" />
      <Segmento<Unidad>
        opciones={[
          { valor: 'dia', texto: 'Día' },
          { valor: 'semana', texto: 'Semana' },
          { valor: 'mes', texto: 'Mes' },
          { valor: 'anio', texto: 'Año' },
        ]}
        valor={unidad}
        onCambio={setUnidad}
      />
      <SelectorPeriodo unidad={unidad} fecha={fecha} onCambio={setFecha} />

      <section className="tarjeta">
        <div className="tenue pequeno">Balance del periodo</div>
        <div className="precio-grande num">{d.total.balance < 0 ? '−' : ''}{eur(Math.abs(d.total.balance))}</div>
        <table className="tabla-mini" style={{ marginTop: 8 }}>
          <tbody>
            <tr><td>Ingresos</td><td className="num">{eur(d.total.ingresos)}</td></tr>
            <tr><td>Gastos</td><td className="num">{eur(d.total.gastos)}</td></tr>
            <tr>
              <td>Gastos {RESPECTO[unidad]} <span className="tenue num">({eur(d.totalAnterior.gastos)})</span></td>
              <td><Variacion valor={variacion(d.total.gastos, d.totalAnterior.gastos)} invertido /></td>
            </tr>
          </tbody>
        </table>
      </section>

      {unidad !== 'dia' && d.actuales.length > 0 && (
        <section className="tarjeta">
          <h2>{unidad === 'anio' ? 'Gastos e ingresos por meses' : 'Gastos por días'}</h2>
          <BarrasPeriodo datos={d.serie} titulo={tituloBarra} conIngresos={unidad === 'anio'} />
        </section>
      )}

      <section className="tarjeta">
        <h2>Por categorías</h2>
        <Segmento<Tipo>
          opciones={[{ valor: 'gasto', texto: 'Gastos' }, { valor: 'ingreso', texto: 'Ingresos' }]}
          valor={tipo}
          onCambio={setTipo}
        />
        {d.categorias.length === 0 ? (
          <Vacio emoji="📊"><p>Sin {tipo === 'gasto' ? 'gastos' : 'ingresos'} en este periodo.</p></Vacio>
        ) : (
          <div style={{ marginTop: 8 }}>
            {d.categorias.map((x) => {
              const c = buscarCategoria(categorias, x.categoriaId)
              const antes = d.categoriasAnterior.get(x.categoriaId) ?? 0
              return (
                <div className="rank" key={x.categoriaId}>
                  <span className="e" aria-hidden="true">{c.icono}</span>
                  <span className="n">{c.nombre} <span className="tenue num">· {Math.round((x.total / totalTipo) * 100)} %</span></span>
                  <span className="v num">{eur(x.total)}</span>
                  <div className="barra"><i style={{ width: `${(x.total / maximo) * 100}%` }} /></div>
                  <div className="cmp">
                    {antes > 0 ? (
                      <><Variacion valor={variacion(x.total, antes)} invertido={tipo === 'gasto'} /> {RESPECTO[unidad]}</>
                    ) : (
                      <>{NADA_ANTES[unidad]}</>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {unidad === 'dia' && d.actuales.length > 0 && (
        <section className="tarjeta">
          <h2>Movimientos del día</h2>
          <ul className="lista">
            {d.actuales.map((m) => (
              <li key={m.id}><FilaMovimiento m={m} categorias={categorias} onClick={() => abrirMovimiento(m)} /></li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
