import { useState } from 'react'
import { db, nuevoId, type Movimiento, type Tipo } from '../db'
import { useCategorias } from '../hooks'
import { aCentimos } from '../lib/calculos'
import { hoyIso } from '../lib/periodos'
import { Hoja, Segmento } from './ui'

export function centimosATexto(c: number): string {
  return (c / 100).toFixed(2).replace('.', ',').replace(/,00$/, '')
}

export function FormMovimiento({ movimiento, tipoInicial, onCerrar }: {
  movimiento?: Movimiento
  tipoInicial?: Tipo
  onCerrar: () => void
}) {
  const categorias = useCategorias()
  const [tipo, setTipo] = useState<Tipo>(movimiento?.tipo ?? tipoInicial ?? 'gasto')
  const [importe, setImporte] = useState(movimiento ? centimosATexto(movimiento.importe) : '')
  const [categoriaId, setCategoriaId] = useState(movimiento?.categoriaId ?? '')
  const [fecha, setFecha] = useState(movimiento?.fecha ?? hoyIso())
  const [nota, setNota] = useState(movimiento?.nota ?? '')
  const [error, setError] = useState('')

  const delTipo = categorias.filter((c) => c.tipo === tipo)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const centimos = aCentimos(importe)
    if (!centimos || centimos <= 0) return setError('Escribe un importe mayor que cero.')
    if (!delTipo.some((c) => c.id === categoriaId)) return setError('Elige una categoría.')
    if (!fecha) return setError('Elige una fecha.')
    await db.movimientos.put({
      id: movimiento?.id ?? nuevoId(),
      tipo,
      importe: centimos,
      categoriaId,
      fecha,
      nota: nota.trim(),
      recurrenteId: movimiento?.recurrenteId,
      creado: movimiento?.creado ?? Date.now(),
    })
    onCerrar()
  }

  async function borrar() {
    if (!movimiento || !window.confirm('¿Borrar este movimiento?')) return
    await db.movimientos.delete(movimiento.id)
    onCerrar()
  }

  return (
    <Hoja titulo={movimiento ? 'Editar movimiento' : 'Nuevo movimiento'} onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <Segmento
          opciones={[{ valor: 'gasto', texto: 'Gasto' }, { valor: 'ingreso', texto: 'Ingreso' }]}
          valor={tipo}
          onCambio={(t) => {
            setTipo(t)
            setCategoriaId('')
          }}
        />
        <div className="importe-grande">
          <input
            inputMode="decimal"
            autoFocus={!movimiento}
            placeholder="0"
            aria-label="Importe en euros"
            value={importe}
            onChange={(e) => {
              setImporte(e.target.value.replace(/[^\d.,]/g, ''))
              setError('')
            }}
          />
          <span>€</span>
        </div>
        <div className="cats" role="group" aria-label="Categoría">
          {delTipo.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === categoriaId}
              onClick={() => {
                setCategoriaId(c.id)
                setError('')
              }}
            >
              <span className="e" aria-hidden="true">{c.icono}</span>
              {c.nombre}
            </button>
          ))}
        </div>
        <div className="dos">
          <label className="campo">
            <span>Fecha</span>
            <input type="date" value={fecha} max="2099-12-31" onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="campo">
            <span>Nota (opcional)</span>
            <input value={nota} maxLength={80} placeholder="p. ej. Mercado" onChange={(e) => setNota(e.target.value)} />
          </label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="botones">
          {movimiento && <button type="button" className="btn peligro" onClick={borrar}>Borrar</button>}
          <button className="btn">Guardar</button>
        </div>
      </form>
    </Hoja>
  )
}
