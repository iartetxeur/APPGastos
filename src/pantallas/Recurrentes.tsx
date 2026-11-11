import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { centimosATexto } from '../componentes/FormMovimiento'
import { buscarCategoria, Cabecera, Hoja, Segmento, Vacio } from '../componentes/ui'
import { db, nuevoId, type Periodicidad, type Recurrente, type Tipo } from '../db'
import { useCategorias } from '../hooks'
import { aCentimos, eur } from '../lib/calculos'
import { fechaCorta, hoyIso } from '../lib/periodos'
import { aplicarRecurrentes, equivalenteMensual, fechaSerie } from '../lib/recurrentes'

const TEXTO_PERIODO: Record<Periodicidad, string> = { semanal: 'cada semana', mensual: 'cada mes', anual: 'cada año' }

export function Recurrentes() {
  const recurrentes = useLiveQuery(() => db.recurrentes.toArray())
  const categorias = useCategorias()
  const [form, setForm] = useState<{ r?: Recurrente } | null>(null)

  if (!recurrentes) return null
  const activos = recurrentes.filter((r) => r.activo)
  const gastoMes = activos.filter((r) => r.tipo === 'gasto').reduce((s, r) => s + equivalenteMensual(r), 0)
  const ingresoMes = activos.filter((r) => r.tipo === 'ingreso').reduce((s, r) => s + equivalenteMensual(r), 0)

  return (
    <>
      <Cabecera titulo="Recurrentes" atras="/mas" />
      <div className="rejilla3" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="dato">
          <div className="etq">Gasto fijo al mes</div>
          <div className="valor num">{eur(gastoMes)}</div>
          <div className="sub">alquiler, suscripciones…</div>
        </div>
        <div className="dato">
          <div className="etq">Ingreso fijo al mes</div>
          <div className="valor num">{eur(ingresoMes)}</div>
          <div className="sub">sueldo, pagas…</div>
        </div>
      </div>

      <section className="tarjeta">
        {recurrentes.length === 0 ? (
          <Vacio emoji="🔁">
            <p>Sin movimientos recurrentes.</p>
            <p className="pequeno">Añade el alquiler, el gimnasio o tus suscripciones y se apuntarán solos cuando toque.</p>
          </Vacio>
        ) : (
          <ul className="lista">
            {[...recurrentes].sort((a, b) => a.proxima.localeCompare(b.proxima)).map((r) => {
              const c = buscarCategoria(categorias, r.categoriaId)
              return (
                <li key={r.id}>
                  <button className="fila" onClick={() => setForm({ r })} style={{ opacity: r.activo ? 1 : 0.55 }}>
                    <span className="chip" style={{ ['--c' as string]: c.color }} aria-hidden="true">{c.icono}</span>
                    <span className="centro">
                      <span className="titulo" style={{ display: 'block' }}>{r.nota || c.nombre}</span>
                      <span className="sub" style={{ display: 'block' }}>
                        {r.activo ? `${TEXTO_PERIODO[r.periodicidad]} · próximo ${fechaCorta(r.proxima)}` : 'En pausa'}
                      </span>
                    </span>
                    <span className={`dcha importe num ${r.tipo === 'ingreso' ? 'ingreso' : ''}`}>
                      {r.tipo === 'ingreso' ? '+' : '−'}{eur(r.importe)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <button className="btn ancho" onClick={() => setForm({})}>+ Añadir recurrente</button>
      {form && <FormRecurrente recurrente={form.r} onCerrar={() => setForm(null)} />}
    </>
  )
}

/** Primera fecha de la serie posterior a hoy (al editar no se regeneran movimientos pasados). */
function proximaFutura(inicio: string, periodicidad: Periodicidad, hoy: string): string {
  for (let k = 0; k < 1000; k++) {
    const f = fechaSerie(inicio, periodicidad, k)
    if (f > hoy) return f
  }
  return inicio
}

function FormRecurrente({ recurrente, onCerrar }: { recurrente?: Recurrente; onCerrar: () => void }) {
  const categorias = useCategorias()
  const [tipo, setTipo] = useState<Tipo>(recurrente?.tipo ?? 'gasto')
  const [importe, setImporte] = useState(recurrente ? centimosATexto(recurrente.importe) : '')
  const [categoriaId, setCategoriaId] = useState(recurrente?.categoriaId ?? '')
  const [nota, setNota] = useState(recurrente?.nota ?? '')
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>(recurrente?.periodicidad ?? 'mensual')
  const [inicio, setInicio] = useState(recurrente?.inicio ?? hoyIso())
  const [activo, setActivo] = useState(recurrente?.activo ?? true)
  const [error, setError] = useState('')

  const delTipo = categorias.filter((c) => c.tipo === tipo)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const centimos = aCentimos(importe)
    if (!centimos || centimos <= 0) return setError('Escribe un importe mayor que cero.')
    if (!delTipo.some((c) => c.id === categoriaId)) return setError('Elige una categoría.')
    if (!inicio) return setError('Elige la fecha del primer cargo.')
    const hoy = hoyIso()
    let proxima = inicio
    if (recurrente) {
      const cambiaSerie = recurrente.inicio !== inicio || recurrente.periodicidad !== periodicidad
      const reactivado = !recurrente.activo && activo
      proxima = cambiaSerie || reactivado ? (inicio > hoy ? inicio : proximaFutura(inicio, periodicidad, hoy)) : recurrente.proxima
    }
    await db.recurrentes.put({
      id: recurrente?.id ?? nuevoId(), tipo, importe: centimos, categoriaId, nota: nota.trim(), periodicidad, inicio, proxima, activo,
    })
    await aplicarRecurrentes()
    onCerrar()
  }

  async function borrar() {
    if (!recurrente || !window.confirm('¿Borrar este recurrente? Los movimientos ya apuntados se conservan.')) return
    await db.recurrentes.delete(recurrente.id)
    onCerrar()
  }

  return (
    <Hoja titulo={recurrente ? 'Editar recurrente' : 'Nuevo recurrente'} onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <Segmento
          opciones={[{ valor: 'gasto', texto: 'Gasto' }, { valor: 'ingreso', texto: 'Ingreso' }]}
          valor={tipo}
          onCambio={(t) => { setTipo(t); setCategoriaId('') }}
        />
        <div style={{ height: 14 }} />
        <div className="dos">
          <label className="campo">
            <span>Importe (€)</span>
            <input inputMode="decimal" value={importe} placeholder="0" autoFocus={!recurrente}
              onChange={(e) => { setImporte(e.target.value.replace(/[^\d.,]/g, '')); setError('') }} />
          </label>
          <label className="campo">
            <span>Nombre</span>
            <input value={nota} maxLength={60} placeholder="p. ej. Alquiler" onChange={(e) => setNota(e.target.value)} />
          </label>
        </div>
        <label className="campo">
          <span>Categoría</span>
          <select value={categoriaId} onChange={(e) => { setCategoriaId(e.target.value); setError('') }}>
            <option value="">Elige…</option>
            {delTipo.map((c) => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
          </select>
        </label>
        <div className="dos">
          <label className="campo">
            <span>Se repite</span>
            <select value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value as Periodicidad)}>
              <option value="semanal">Cada semana</option>
              <option value="mensual">Cada mes</option>
              <option value="anual">Cada año</option>
            </select>
          </label>
          <label className="campo">
            <span>Primer cargo</span>
            <input type="date" value={inicio} max="2099-12-31" onChange={(e) => setInicio(e.target.value)} />
          </label>
        </div>
        {!recurrente && inicio < hoyIso() && (
          <p className="nota-info">La fecha es pasada: al guardar se apuntarán también los cargos desde entonces hasta hoy.</p>
        )}
        {recurrente && (
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} style={{ width: 20, height: 20 }} />
            Activo (desmarca para pausarlo)
          </label>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="botones">
          {recurrente && <button type="button" className="btn peligro" onClick={borrar}>Borrar</button>}
          <button className="btn">Guardar</button>
        </div>
      </form>
    </Hoja>
  )
}
