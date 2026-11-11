import { useRef, useState } from 'react'
import { Cabecera, Hoja, Segmento } from '../componentes/ui'
import { INVERSIONES_ACTIVAS } from '../config'
import { db, guardarAjuste, nuevoId, type Categoria, type Tipo } from '../db'
import { aplicarTema, leerTema, useAjuste, useCategorias, type Tema } from '../hooks'
import { exportarCsv, exportarJson, importarCopia } from '../lib/copia'
import { cotizacionFinnhub, ErrorClave } from '../lib/precios/fuentes'

const COLORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948', '#64748b']

export function Ajustes() {
  const categorias = useCategorias()
  const ultimaCopia = useAjuste<number>('ultimaCopia', 0)
  const [tema, setTema] = useState<Tema>(leerTema)
  const [mensaje, setMensaje] = useState('')
  const [categoria, setCategoria] = useState<{ c?: Categoria; tipo: Tipo } | null>(null)
  const archivo = useRef<HTMLInputElement>(null)

  async function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const n = await importarCopia(JSON.parse(await f.text()))
      setMensaje(`✅ Copia importada: ${n} registros fusionados con los que ya tenías.`)
    } catch (err) {
      setMensaje(`❌ ${err instanceof SyntaxError ? 'El archivo no es un JSON válido.' : (err as Error).message}`)
    }
  }

  return (
    <>
      <Cabecera titulo="Ajustes" atras="/mas" />

      <section className="tarjeta">
        <h2>Apariencia</h2>
        <Segmento<Tema>
          opciones={[{ valor: 'auto', texto: 'Automático' }, { valor: 'claro', texto: 'Claro' }, { valor: 'oscuro', texto: 'Oscuro' }]}
          valor={tema}
          onCambio={(t) => { setTema(t); aplicarTema(t) }}
        />
      </section>

      <section className="tarjeta">
        <h2>Copia de seguridad</h2>
        <p className="nota-info">
          Tus datos están solo en este dispositivo. Exporta una copia para guardarla o para pasarla a tu otro dispositivo
          (allí pulsa «Importar copia»: se fusiona sin duplicar nada).
          <br />
          Última copia: <b>{ultimaCopia ? new Date(ultimaCopia).toLocaleDateString('es-ES', { dateStyle: 'long' }) : 'nunca'}</b>
        </p>
        <div className="botones">
          <button className="btn" onClick={() => void exportarJson().then(() => setMensaje('✅ Copia descargada.'))}>Exportar copia</button>
          <button className="btn sec" onClick={() => archivo.current?.click()}>Importar copia</button>
        </div>
        <input ref={archivo} type="file" accept="application/json,.json" hidden onChange={importar} />
        <div style={{ height: 10 }} />
        <button className="btn sec ancho" onClick={() => void exportarCsv()}>Exportar movimientos a hoja de cálculo (CSV)</button>
        {mensaje && <p className="pequeno" role="status" style={{ marginTop: 10 }}>{mensaje}</p>}
      </section>

      {INVERSIONES_ACTIVAS && <ClaveBolsa />}

      <section className="tarjeta">
        <h2>Categorías</h2>
        {(['gasto', 'ingreso'] as const).map((tipo) => (
          <div key={tipo} style={{ marginBottom: 12 }}>
            <div className="pequeno tenue" style={{ fontWeight: 700, margin: '6px 0' }}>{tipo === 'gasto' ? 'De gasto' : 'De ingreso'}</div>
            <div className="cats" style={{ marginBottom: 0 }}>
              {categorias.filter((c) => c.tipo === tipo).map((c) => (
                <button key={c.id} onClick={() => setCategoria({ c, tipo })}>
                  <span className="e" aria-hidden="true">{c.icono}</span>{c.nombre}
                </button>
              ))}
              <button onClick={() => setCategoria({ tipo })}><span className="e" aria-hidden="true">＋</span>Nueva</button>
            </div>
          </div>
        ))}
      </section>

      <section className="tarjeta">
        <h2>Instalar la app</h2>
        <p className="pequeno">
          <b>Android, Windows y Linux</b> (Chrome o Edge): menú ⋮ → «Instalar aplicación» o el icono de instalar de la barra de direcciones.
          <br />
          <b>iPhone y iPad</b> (Safari): botón Compartir → «Añadir a pantalla de inicio».
        </p>
      </section>

      {categoria && <FormCategoria categoria={categoria.c} tipo={categoria.tipo} orden={categorias.length + 1} onCerrar={() => setCategoria(null)} />}
    </>
  )
}

function ClaveBolsa() {
  const guardada = useAjuste('finnhubClave', '')
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState('')

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const clave = texto.trim()
    if (!clave) return
    setEstado('Comprobando…')
    try {
      await cotizacionFinnhub('AAPL', clave)
      await guardarAjuste('finnhubClave', clave)
      setTexto('')
      setEstado('✅ Clave correcta y guardada.')
    } catch (err) {
      setEstado(err instanceof ErrorClave ? '❌ Finnhub rechaza esa clave. Revísala.' : '❌ No se ha podido comprobar (¿sin conexión?).')
    }
  }

  return (
    <section className="tarjeta">
      <h2>Bolsa: clave de Finnhub</h2>
      <p className="nota-info">
        Las criptomonedas funcionan sin nada. Para ver <b>acciones</b> (Nvidia, Apple…) hace falta una clave gratuita:
        regístrate en <a href="https://finnhub.io/register" target="_blank" rel="noreferrer">finnhub.io</a>, copia tu «API key» y pégala aquí.
        Se guarda solo en este dispositivo y no se incluye en las copias.
      </p>
      <p className="pequeno" style={{ marginBottom: 10 }}>Estado: <b>{guardada ? 'clave guardada ✓' : 'sin clave'}</b></p>
      <form onSubmit={guardar}>
        <label className="campo">
          <span>{guardada ? 'Cambiar clave' : 'Pega tu clave'}</span>
          <input type="password" autoComplete="off" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </label>
        <div className="botones">
          {guardada && (
            <button type="button" className="btn peligro" onClick={() => void guardarAjuste('finnhubClave', '').then(() => setEstado('Clave eliminada.'))}>
              Quitar clave
            </button>
          )}
          <button className="btn" disabled={!texto.trim()}>Guardar clave</button>
        </div>
      </form>
      {estado && <p className="pequeno" role="status" style={{ marginTop: 10 }}>{estado}</p>}
    </section>
  )
}

function FormCategoria({ categoria, tipo, orden, onCerrar }: { categoria?: Categoria; tipo: Tipo; orden: number; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [icono, setIcono] = useState(categoria?.icono ?? '')
  const [color, setColor] = useState(categoria?.color ?? COLORES[0])
  const [error, setError] = useState('')

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return setError('Escribe un nombre.')
    await db.categorias.put({
      id: categoria?.id ?? nuevoId(), nombre: nombre.trim(), icono: icono.trim() || '🏷️', color, tipo, orden: categoria?.orden ?? orden,
    })
    onCerrar()
  }

  async function borrar() {
    if (!categoria) return
    const usos = await db.movimientos.where('categoriaId').equals(categoria.id).count()
    const recurrentes = (await db.recurrentes.toArray()).filter((r) => r.categoriaId === categoria.id).length
    if (usos + recurrentes > 0) {
      return setError(`No se puede borrar: la usan ${usos} movimientos y ${recurrentes} recurrentes. Puedes cambiarle el nombre.`)
    }
    if (!window.confirm(`¿Borrar la categoría «${categoria.nombre}»?`)) return
    await db.transaction('rw', db.categorias, db.presupuestos, async () => {
      await db.categorias.delete(categoria.id)
      await db.presupuestos.delete(categoria.id)
    })
    onCerrar()
  }

  return (
    <Hoja titulo={categoria ? 'Editar categoría' : `Nueva categoría de ${tipo}`} onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <div className="dos" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <label className="campo">
            <span>Nombre</span>
            <input value={nombre} maxLength={30} autoFocus={!categoria} onChange={(e) => { setNombre(e.target.value); setError('') }} />
          </label>
          <label className="campo">
            <span>Emoji</span>
            <input value={icono} maxLength={4} placeholder="🏷️" onChange={(e) => setIcono(e.target.value)} />
          </label>
        </div>
        <div className="campo">
          <span>Color</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Color">
            {COLORES.map((c) => (
              <button key={c} type="button" aria-pressed={c === color} aria-label={`Color ${c}`} onClick={() => setColor(c)}
                style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: c === color ? '3px solid var(--texto)' : '3px solid transparent' }} />
            ))}
          </div>
        </div>
        {error && <p className="error" role="alert" style={{ marginTop: 0 }}>{error}</p>}
        <div className="botones">
          {categoria && <button type="button" className="btn peligro" onClick={borrar}>Borrar</button>}
          <button className="btn">Guardar</button>
        </div>
      </form>
    </Hoja>
  )
}
