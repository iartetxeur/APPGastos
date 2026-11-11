import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { BarraPresupuesto, buscarCategoria, FilaMovimiento, Vacio, Variacion } from '../componentes/ui'
import { INVERSIONES_ACTIVAS } from '../config'
import { db } from '../db'
import { useAcciones, useAjuste, useCategorias, useMovimientos } from '../hooks'
import { estadoPresupuesto, eur, eurDec, filtrar, porCategoria, prevision, totales, variacion } from '../lib/calculos'
import { resumirCartera } from '../lib/cartera'
import { exportarJson } from '../lib/copia'
import { etiqueta, etiquetaDia, hoyIso, mover, rango } from '../lib/periodos'
import { usePrecios } from '../lib/precios/servicio'

const DIAS_AVISO_COPIA = 30

export function Inicio() {
  const movimientos = useMovimientos()
  const categorias = useCategorias()
  const presupuestos = useLiveQuery(() => db.presupuestos.toArray()) ?? []
  const activos = useLiveQuery(() => db.activos.toArray()) ?? []
  const operaciones = useLiveQuery(() => db.operaciones.toArray()) ?? []
  const ultimaCopia = useAjuste<number>('ultimaCopia', 0)
  const { precios } = usePrecios()
  const { abrirMovimiento } = useAcciones()

  const hoy = new Date()
  const d = useMemo(() => {
    const movs = movimientos ?? []
    const ahora = new Date()
    const delMes = filtrar(movs, rango('mes', ahora))
    const mesAnterior = filtrar(movs, rango('mes', mover('mes', ahora, -1)))
    return {
      mes: totales(delMes),
      gastosMesAnterior: totales(mesAnterior).gastos,
      semana: totales(filtrar(movs, rango('semana', ahora))).gastos,
      dia: totales(filtrar(movs, rango('dia', ahora))).gastos,
      gastoPorCategoria: new Map(porCategoria(delMes, 'gasto').map((x) => [x.categoriaId, x.total])),
      ultimos: [...movs].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado).slice(0, 6),
      primero: movs.reduce((min, m) => Math.min(min, m.creado), Infinity),
    }
  }, [movimientos])

  const cartera = useMemo(() => resumirCartera(activos, operaciones, precios), [activos, operaciones, precios])
  const alertas = presupuestos
    .map((p) => ({ p, gastado: d.gastoPorCategoria.get(p.categoriaId) ?? 0 }))
    .filter((x) => estadoPresupuesto(x.gastado, x.p.limite) !== 'bien')
  const prev = d.mes.gastos > 0 ? prevision(d.mes.gastos, hoy) : null
  const referenciaCopia = ultimaCopia || (Number.isFinite(d.primero) ? d.primero : Date.now())
  const avisarCopia = (movimientos?.length ?? 0) > 0 && Date.now() - referenciaCopia > DIAS_AVISO_COPIA * 86_400_000

  if (!movimientos) return null

  return (
    <>
      <section className="tarjeta heroe">
        <div className="etq">Balance de {etiqueta('mes', hoy).toLowerCase()}</div>
        <div className="cifra num">{eur(d.mes.balance)}</div>
        <div className="pareja">
          <span>Ingresos<b className="num">{eur(d.mes.ingresos)}</b></span>
          <span>Gastos<b className="num">{eur(d.mes.gastos)}</b></span>
        </div>
      </section>

      <div className="rejilla3">
        <div className="dato"><div className="etq">Hoy</div><div className="valor num">{eur(d.dia)}</div></div>
        <div className="dato"><div className="etq">Esta semana</div><div className="valor num">{eur(d.semana)}</div></div>
        <div className="dato">
          <div className="etq">Este mes</div>
          <div className="valor num">{eur(d.mes.gastos)}</div>
        </div>
      </div>

      {avisarCopia && (
        <div className="aviso-banda">
          <span>Llevas más de {DIAS_AVISO_COPIA} días sin guardar una copia de tus datos.</span>
          <button className="btn sec" onClick={() => void exportarJson()}>Guardar copia</button>
        </div>
      )}

      {prev && (
        <section className="tarjeta">
          <h2>Ritmo de gasto</h2>
          <table className="tabla-mini">
            <tbody>
              <tr><td>Media diaria este mes</td><td className="num">{eur(prev.mediaDiaria)}</td></tr>
              <tr><td>A este ritmo acabarás el mes en</td><td className="num">{eur(prev.finDeMes)}</td></tr>
              {d.gastosMesAnterior > 0 && (
                <tr>
                  <td>Mes pasado gastaste {eur(d.gastosMesAnterior)}</td>
                  <td><Variacion valor={variacion(prev.finDeMes, d.gastosMesAnterior)} invertido /></td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {alertas.length > 0 && (
        <section className="tarjeta">
          <h2>Presupuestos a vigilar</h2>
          {alertas.map(({ p, gastado }) => (
            <BarraPresupuesto key={p.categoriaId} categoria={buscarCategoria(categorias, p.categoriaId)} gastado={gastado} limite={p.limite} />
          ))}
        </section>
      )}

      {INVERSIONES_ACTIVAS && cartera.invertido > 0 && (
        <a className="tarjeta" href="#/inversiones" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          <h2>Inversiones</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <b className="num" style={{ fontSize: '1.4rem' }}>{eurDec(cartera.valor)}</b>
            <span className="pequeno">Hoy <Variacion valor={cartera.cambioDiaPct} /></span>
          </div>
          <div className="pequeno tenue num">
            Ganancia total: {cartera.ganancia >= 0 ? '+' : ''}{eurDec(cartera.ganancia)}
            {!cartera.completo && ' · faltan precios'}
          </div>
        </a>
      )}

      <div className="seccion-titulo">
        <span>Últimos movimientos</span>
        {d.ultimos.length > 0 && <a href="#/movimientos">Ver todos</a>}
      </div>
      <section className="tarjeta">
        {d.ultimos.length === 0 ? (
          <Vacio emoji="🧾">
            <p>Aún no has apuntado nada.</p>
            <p className="pequeno">Pulsa <b>+</b> para añadir tu primer gasto.</p>
          </Vacio>
        ) : (
          <ul className="lista">
            {d.ultimos.map((m) => (
              <li key={m.id}>
                <FilaMovimiento m={m} categorias={categorias} conFecha={etiquetaDia(m.fecha, hoyIso())} onClick={() => abrirMovimiento(m)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
