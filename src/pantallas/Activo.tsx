import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { LineaEvolucion, type PuntoLinea } from '../componentes/graficos'
import { Cabecera, Hoja, Segmento, Vacio, Variacion } from '../componentes/ui'
import { db, nuevoId, type Activo as TActivo, type Operacion } from '../db'
import { ir } from '../hooks'
import { aNumero, eurDec } from '../lib/calculos'
import { calcularPosicion } from '../lib/cartera'
import { fechaCorta, hoyIso } from '../lib/periodos'
import { historicoBinance, parEnUsd, type RangoHistorico } from '../lib/precios/fuentes'
import { usePrecios } from '../lib/precios/servicio'
import { cantidadTexto, IndicadorVivo } from './Inversiones'

export function Activo({ id }: { id: string }) {
  const activo = useLiveQuery(() => db.activos.get(id).then((a) => a ?? null), [id])
  const operaciones = useLiveQuery(() => db.operaciones.where('activoId').equals(id).toArray(), [id]) ?? []
  const estado = usePrecios()
  const [form, setForm] = useState<{ op?: Operacion } | null>(null)

  const posicion = useMemo(() => calcularPosicion(operaciones), [operaciones])
  if (activo === undefined) return null
  if (activo === null) {
    return (
      <>
        <Cabecera titulo="Activo" atras="/inversiones" />
        <section className="tarjeta"><Vacio emoji="❔"><p>Este activo ya no existe.</p></Vacio></section>
      </>
    )
  }

  const precio = estado.precios.get(id)
  const valor = precio ? posicion.cantidad * precio.precio : null
  const ganancia = valor !== null ? valor - posicion.invertido : null

  async function dejarDeSeguir() {
    const aviso = operaciones.length > 0
      ? `¿Quitar ${activo!.nombre}? Se borrarán también sus ${operaciones.length} operaciones.`
      : `¿Dejar de seguir ${activo!.nombre}?`
    if (!window.confirm(aviso)) return
    await db.transaction('rw', db.activos, db.operaciones, db.precios, async () => {
      await db.operaciones.where('activoId').equals(id).delete()
      await db.precios.delete(id)
      await db.activos.delete(id)
    })
    ir('/inversiones')
  }

  return (
    <>
      <Cabecera titulo={activo.nombre} atras="/inversiones">
        {activo.tipo === 'cripto' && <IndicadorVivo estado={estado} />}
      </Cabecera>

      <section className="tarjeta">
        <div className="tenue pequeno">
          {activo.simbolo} · {activo.tipo === 'cripto' ? 'Criptomoneda' : 'Acción'}
          {(activo.tipo === 'accion' || parEnUsd(activo.par)) && ' · cotiza en USD, convertido a €'}
        </div>
        {precio ? (
          <>
            <div className="precio-grande num">{eurDec(precio.precio)}</div>
            <div><Variacion valor={precio.cambioDia} sufijo={activo.tipo === 'cripto' ? 'en 24 h' : 'hoy'} /></div>
            <table className="tabla-mini" style={{ marginTop: 10 }}>
              <tbody>
                {precio.max !== null && <tr><td>Máximo {activo.tipo === 'cripto' ? '24 h' : 'del día'}</td><td className="num">{eurDec(precio.max)}</td></tr>}
                {precio.min !== null && <tr><td>Mínimo {activo.tipo === 'cripto' ? '24 h' : 'del día'}</td><td className="num">{eurDec(precio.min)}</td></tr>}
                <tr>
                  <td>Última actualización</td>
                  <td>{new Date(precio.hora).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' })}</td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <p style={{ marginTop: 8 }}>
            {activo.tipo === 'accion' && !estado.tieneClave
              ? <>Sin precio: falta la clave de Finnhub. <a className="enlace" href="#/ajustes">Ir a Ajustes</a></>
              : 'Cargando precio…'}
          </p>
        )}
      </section>

      {activo.tipo === 'cripto' && <Historico activo={activo} usdEur={estado.usdEur} />}

      <section className="tarjeta">
        <h2>Mi posición</h2>
        {posicion.cantidad > 0 ? (
          <table className="tabla-mini">
            <tbody>
              <tr><td>Cantidad</td><td className="num">{cantidadTexto(posicion.cantidad)} {activo.simbolo}</td></tr>
              <tr><td>Precio medio de compra</td><td className="num">{eurDec(posicion.costeMedio)}</td></tr>
              <tr><td>Invertido</td><td className="num">{eurDec(posicion.invertido)}</td></tr>
              <tr><td>Valor actual</td><td className="num">{valor !== null ? eurDec(valor) : '—'}</td></tr>
              <tr>
                <td>Ganancia / pérdida</td>
                <td className="num">
                  {ganancia !== null ? (
                    <>{ganancia >= 0 ? '+' : ''}{eurDec(ganancia)} · <Variacion valor={posicion.invertido > 0 ? (ganancia / posicion.invertido) * 100 : null} /></>
                  ) : '—'}
                </td>
              </tr>
              {posicion.realizado !== 0 && <tr><td>Ya materializado en ventas</td><td className="num">{eurDec(posicion.realizado)}</td></tr>}
            </tbody>
          </table>
        ) : (
          <p className="tenue pequeno">
            No tienes {activo.simbolo} apuntado: solo lo sigues. Apunta una compra para ver cuánto ganas o pierdes.
            {posicion.realizado !== 0 && <> Materializado en ventas: <span className="num">{eurDec(posicion.realizado)}</span>.</>}
          </p>
        )}
      </section>

      <div className="seccion-titulo"><span>Operaciones</span></div>
      {operaciones.length > 0 && (
        <section className="tarjeta" style={{ paddingTop: 6, paddingBottom: 6 }}>
          <ul className="lista">
            {[...operaciones].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((op) => (
              <li key={op.id}>
                <button className="fila" onClick={() => setForm({ op })}>
                  <span className="chip" aria-hidden="true">{op.tipo === 'compra' ? '📥' : '📤'}</span>
                  <span className="centro">
                    <span className="titulo num" style={{ display: 'block' }}>
                      {op.tipo === 'compra' ? 'Compra' : 'Venta'} de {cantidadTexto(op.cantidad)} {activo.simbolo}
                    </span>
                    <span className="sub num" style={{ display: 'block' }}>
                      {fechaCorta(op.fecha)} · a {eurDec(op.precio)}{op.comision > 0 ? ` · comisión ${eurDec(op.comision)}` : ''}
                    </span>
                  </span>
                  <span className="dcha importe num">{eurDec(op.cantidad * op.precio)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="botones">
        <button className="btn" onClick={() => setForm({})}>+ Apuntar operación</button>
        <button className="btn peligro" onClick={() => void dejarDeSeguir()}>Quitar activo</button>
      </div>

      {form && (
        <FormOperacion activo={activo} operacion={form.op} precioActual={precio?.precio} disponible={posicion.cantidad} onCerrar={() => setForm(null)} />
      )}
    </>
  )
}

function Historico({ activo, usdEur }: { activo: TActivo; usdEur: number | null }) {
  const [rango, setRango] = useState<RangoHistorico>('7D')
  const [datos, setDatos] = useState<PuntoLinea[] | null | 'error'>(null)
  const factor = parEnUsd(activo.par) ? usdEur : 1

  useEffect(() => {
    let vigente = true
    setDatos(null)
    if (!factor) return
    historicoBinance(activo.par, rango)
      .then((h) => vigente && setDatos(h.map((p) => ({ t: p.t, valor: p.precio * factor }))))
      .catch(() => vigente && setDatos('error'))
    return () => {
      vigente = false
    }
  }, [activo.par, rango, factor])

  const lista = Array.isArray(datos) ? datos : []
  const cambio = lista.length > 1 ? ((lista[lista.length - 1].valor - lista[0].valor) / lista[0].valor) * 100 : null

  return (
    <section className="tarjeta">
      <h2>Evolución del precio {cambio !== null && <span style={{ textTransform: 'none', letterSpacing: 0 }}>· <Variacion valor={cambio} /></span>}</h2>
      <Segmento<RangoHistorico>
        opciones={[{ valor: '1D', texto: '1 día' }, { valor: '7D', texto: '7 días' }, { valor: '30D', texto: '30 días' }, { valor: '1A', texto: '1 año' }]}
        valor={rango}
        onCambio={setRango}
      />
      <div style={{ height: 10 }} />
      {datos === 'error' ? (
        <p className="tenue pequeno" style={{ padding: '30px 0', textAlign: 'center' }}>No se ha podido cargar el histórico (¿sin conexión?).</p>
      ) : lista.length === 0 ? (
        <div style={{ height: 210 }} />
      ) : (
        <LineaEvolucion
          nombre={activo.simbolo}
          datos={lista}
          formatoFecha={(t, largo) =>
            new Date(t).toLocaleString('es-ES', rango === '1D'
              ? (largo ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' })
              : rango === '1A'
                ? (largo ? { day: 'numeric', month: 'short', year: 'numeric' } : { month: 'short', year: '2-digit' })
                : (largo ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' }))}
        />
      )}
    </section>
  )
}

function FormOperacion({ activo, operacion, precioActual, disponible, onCerrar }: {
  activo: TActivo
  operacion?: Operacion
  precioActual?: number
  disponible: number
  onCerrar: () => void
}) {
  const aTexto = (n: number, decimales: number) => String(Number(n.toFixed(decimales))).replace('.', ',')
  const [tipo, setTipo] = useState<'compra' | 'venta'>(operacion?.tipo ?? 'compra')
  const [cantidad, setCantidad] = useState(operacion ? aTexto(operacion.cantidad, 8) : '')
  const [precio, setPrecio] = useState(operacion ? aTexto(operacion.precio, 6) : precioActual ? aTexto(precioActual, precioActual < 1 ? 6 : 2) : '')
  const [comision, setComision] = useState(operacion?.comision ? aTexto(operacion.comision, 2) : '')
  const [fecha, setFecha] = useState(operacion?.fecha ?? hoyIso())
  const [error, setError] = useState('')

  const q = aNumero(cantidad)
  const p = aNumero(precio)
  const limpiar = (v: string) => v.replace(/[^\d.,]/g, '')

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const c = comision.trim() ? aNumero(comision) : 0
    if (!q || q <= 0) return setError('Escribe la cantidad.')
    if (!p || p <= 0) return setError('Escribe el precio por unidad en euros.')
    if (c === null || c < 0) return setError('La comisión no es válida.')
    if (!fecha) return setError('Elige una fecha.')
    const yaVendido = operacion?.tipo === 'venta' ? operacion.cantidad : 0
    if (tipo === 'venta' && q > disponible + yaVendido + 1e-9) {
      return setError(`No puedes vender más de lo que tienes (${cantidadTexto(disponible + yaVendido)} ${activo.simbolo}).`)
    }
    await db.operaciones.put({ id: operacion?.id ?? nuevoId(), activoId: activo.id, tipo, cantidad: q, precio: p, comision: c, fecha })
    onCerrar()
  }

  return (
    <Hoja titulo={`${operacion ? 'Editar' : 'Apuntar'} operación · ${activo.simbolo}`} onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <Segmento opciones={[{ valor: 'compra', texto: 'Compra' }, { valor: 'venta', texto: 'Venta' }]} valor={tipo} onCambio={setTipo} />
        <div style={{ height: 14 }} />
        <div className="dos">
          <label className="campo">
            <span>Cantidad ({activo.simbolo})</span>
            <input inputMode="decimal" autoFocus={!operacion} value={cantidad} placeholder="p. ej. 0,005"
              onChange={(e) => { setCantidad(limpiar(e.target.value)); setError('') }} />
          </label>
          <label className="campo">
            <span>Precio por unidad (€)</span>
            <input inputMode="decimal" value={precio} onChange={(e) => { setPrecio(limpiar(e.target.value)); setError('') }} />
          </label>
        </div>
        <div className="dos">
          <label className="campo">
            <span>Comisión (€, opcional)</span>
            <input inputMode="decimal" value={comision} placeholder="0" onChange={(e) => { setComision(limpiar(e.target.value)); setError('') }} />
          </label>
          <label className="campo">
            <span>Fecha</span>
            <input type="date" value={fecha} max="2099-12-31" onChange={(e) => setFecha(e.target.value)} />
          </label>
        </div>
        {q && p ? <p className="nota-info num">Total de la operación: <b>{eurDec(q * p)}</b></p> : null}
        {error && <p className="error" role="alert" style={{ marginTop: 0 }}>{error}</p>}
        <div className="botones">
          {operacion && (
            <button type="button" className="btn peligro" onClick={async () => {
              if (!window.confirm('¿Borrar esta operación?')) return
              await db.operaciones.delete(operacion.id)
              onCerrar()
            }}>Borrar</button>
          )}
          <button className="btn">Guardar</button>
        </div>
      </form>
    </Hoja>
  )
}
