import { useMemo, useState } from 'react'
import { Cabecera, FilaMovimiento, Segmento, SelectorPeriodo, Vacio } from '../componentes/ui'
import type { Movimiento } from '../db'
import { useAcciones, useCategorias, useMovimientos } from '../hooks'
import { eur, filtrar, totales } from '../lib/calculos'
import { etiquetaDia, hoyIso, rango, type Unidad } from '../lib/periodos'

type Filtro = Unidad | 'todo'

export function Movimientos() {
  const movimientos = useMovimientos()
  const categorias = useCategorias()
  const { abrirMovimiento } = useAcciones()
  const [filtro, setFiltro] = useState<Filtro>('mes')
  const [fecha, setFecha] = useState(() => new Date())
  const [categoriaId, setCategoriaId] = useState('')
  const [texto, setTexto] = useState('')

  const { dias, total } = useMemo(() => {
    let movs = movimientos ?? []
    if (filtro !== 'todo') movs = filtrar(movs, rango(filtro, fecha))
    if (categoriaId) movs = movs.filter((m) => m.categoriaId === categoriaId)
    const q = texto.trim().toLowerCase()
    if (q) {
      const nombres = new Map(categorias.map((c) => [c.id, c.nombre.toLowerCase()]))
      movs = movs.filter((m) => m.nota.toLowerCase().includes(q) || (nombres.get(m.categoriaId) ?? '').includes(q))
    }
    const orden = [...movs].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado)
    const dias: { fecha: string; movs: Movimiento[] }[] = []
    for (const m of orden) {
      const ultimo = dias[dias.length - 1]
      if (ultimo?.fecha === m.fecha) ultimo.movs.push(m)
      else dias.push({ fecha: m.fecha, movs: [m] })
    }
    return { dias, total: totales(movs) }
  }, [movimientos, categorias, filtro, fecha, categoriaId, texto])

  if (!movimientos) return null
  const hoy = hoyIso()

  return (
    <>
      <Cabecera titulo="Movimientos" />
      <Segmento<Filtro>
        opciones={[
          { valor: 'semana', texto: 'Semana' },
          { valor: 'mes', texto: 'Mes' },
          { valor: 'anio', texto: 'Año' },
          { valor: 'todo', texto: 'Todo' },
        ]}
        valor={filtro}
        onCambio={setFiltro}
      />
      {filtro !== 'todo' ? <SelectorPeriodo unidad={filtro} fecha={fecha} onCambio={setFecha} /> : <div style={{ height: 14 }} />}
      <div className="dos" style={{ marginBottom: 12 }}>
        <input className="entrada" type="search" placeholder="Buscar…" aria-label="Buscar" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <select className="entrada" aria-label="Categoría" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
        </select>
      </div>

      <div className="rejilla3">
        <div className="dato"><div className="etq">Gastos</div><div className="valor num">{eur(total.gastos)}</div></div>
        <div className="dato"><div className="etq">Ingresos</div><div className="valor num">{eur(total.ingresos)}</div></div>
        <div className="dato"><div className="etq">Balance</div><div className="valor num">{eur(total.balance)}</div></div>
      </div>

      {dias.length === 0 ? (
        <section className="tarjeta"><Vacio emoji="🔍"><p>No hay movimientos con estos filtros.</p></Vacio></section>
      ) : (
        dias.map((dia) => {
          const t = totales(dia.movs)
          return (
            <div key={dia.fecha}>
              <div className="dia-cab">
                <span>{etiquetaDia(dia.fecha, hoy)}</span>
                <span className="num">{t.balance > 0 ? '+' : t.balance < 0 ? '−' : ''}{eur(Math.abs(t.balance))}</span>
              </div>
              <section className="tarjeta" style={{ paddingTop: 6, paddingBottom: 6 }}>
                <ul className="lista">
                  {dia.movs.map((m) => (
                    <li key={m.id}><FilaMovimiento m={m} categorias={categorias} onClick={() => abrirMovimiento(m)} /></li>
                  ))}
                </ul>
              </section>
            </div>
          )
        })
      )}
    </>
  )
}
