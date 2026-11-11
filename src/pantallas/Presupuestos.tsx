import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { centimosATexto } from '../componentes/FormMovimiento'
import { BarraPresupuesto, Cabecera, Hoja } from '../componentes/ui'
import { db, type Categoria } from '../db'
import { useCategorias, useMovimientos } from '../hooks'
import { aCentimos, eur, filtrar, porCategoria } from '../lib/calculos'
import { etiqueta, rango } from '../lib/periodos'

export function Presupuestos() {
  const categorias = useCategorias().filter((c) => c.tipo === 'gasto')
  const movimientos = useMovimientos()
  const presupuestos = useLiveQuery(() => db.presupuestos.toArray()) ?? []
  const [editando, setEditando] = useState<Categoria | null>(null)

  const gastado = useMemo(
    () => new Map(porCategoria(filtrar(movimientos ?? [], rango('mes', new Date())), 'gasto').map((x) => [x.categoriaId, x.total])),
    [movimientos],
  )
  const limites = new Map(presupuestos.map((p) => [p.categoriaId, p.limite]))
  const con = categorias.filter((c) => limites.has(c.id))
  const sin = categorias.filter((c) => !limites.has(c.id))
  const totalLimite = con.reduce((s, c) => s + (limites.get(c.id) ?? 0), 0)
  const totalGastado = con.reduce((s, c) => s + (gastado.get(c.id) ?? 0), 0)

  return (
    <>
      <Cabecera titulo="Presupuestos" atras="/mas" />
      <p className="nota-info">
        Pon un límite mensual a cada categoría. La barra se pone en ámbar al llegar al 80 % y en rojo si te pasas.
        Mes actual: <b>{etiqueta('mes', new Date()).toLowerCase()}</b>.
      </p>

      {con.length > 0 && (
        <section className="tarjeta">
          <h2>Total presupuestado · {eur(totalGastado)} de {eur(totalLimite)}</h2>
          {con.map((c) => (
            <div key={c.id} role="button" tabIndex={0} style={{ cursor: 'pointer' }}
              onClick={() => setEditando(c)} onKeyDown={(e) => e.key === 'Enter' && setEditando(c)}>
              <BarraPresupuesto categoria={c} gastado={gastado.get(c.id) ?? 0} limite={limites.get(c.id) ?? 0} />
            </div>
          ))}
        </section>
      )}

      {sin.length > 0 && (
        <section className="tarjeta">
          <h2>Sin presupuesto</h2>
          <ul className="lista">
            {sin.map((c) => (
              <li key={c.id}>
                <button className="fila" onClick={() => setEditando(c)}>
                  <span className="chip" style={{ ['--c' as string]: c.color }} aria-hidden="true">{c.icono}</span>
                  <span className="centro">
                    <span className="titulo" style={{ display: 'block' }}>{c.nombre}</span>
                    <span className="sub num" style={{ display: 'block' }}>Este mes: {eur(gastado.get(c.id) ?? 0)}</span>
                  </span>
                  <span className="enlace">Poner límite</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editando && <FormLimite categoria={editando} limite={limites.get(editando.id)} onCerrar={() => setEditando(null)} />}
    </>
  )
}

function FormLimite({ categoria, limite, onCerrar }: { categoria: Categoria; limite?: number; onCerrar: () => void }) {
  const [texto, setTexto] = useState(limite ? centimosATexto(limite) : '')
  const [error, setError] = useState('')

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const c = aCentimos(texto)
    if (!c || c <= 0) return setError('Escribe un límite mayor que cero.')
    await db.presupuestos.put({ categoriaId: categoria.id, limite: c })
    onCerrar()
  }

  return (
    <Hoja titulo={`${categoria.icono} ${categoria.nombre}`} onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <label className="campo">
          <span>Límite mensual (€)</span>
          <input inputMode="decimal" autoFocus value={texto} placeholder="p. ej. 150"
            onChange={(e) => { setTexto(e.target.value.replace(/[^\d.,]/g, '')); setError('') }} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="botones">
          {limite !== undefined && (
            <button type="button" className="btn peligro" onClick={async () => { await db.presupuestos.delete(categoria.id); onCerrar() }}>
              Quitar límite
            </button>
          )}
          <button className="btn">Guardar</button>
        </div>
      </form>
    </Hoja>
  )
}
