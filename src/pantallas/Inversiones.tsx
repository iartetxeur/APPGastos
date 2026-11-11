import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { LineaEvolucion } from '../componentes/graficos'
import { Cabecera, Hoja, Segmento, Vacio, Variacion } from '../componentes/ui'
import { db, type TipoActivo } from '../db'
import { ir } from '../hooks'
import { eurDec } from '../lib/calculos'
import { resumirCartera, type LineaCartera } from '../lib/cartera'
import { deIso, fechaCorta, iso } from '../lib/periodos'
import { buscarAccion, buscarCripto, cotizacionFinnhub, ErrorClave, resolverPar, type Resultado } from '../lib/precios/fuentes'
import { usePrecios, type EstadoPrecios } from '../lib/precios/servicio'

export function cantidadTexto(n: number): string {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 8 })
}

export function IndicadorVivo({ estado }: { estado: EstadoPrecios }) {
  if (!estado.enLinea) return <span className="vivo"><i />Sin conexión</span>
  return estado.vivo ? <span className="vivo si"><i />En vivo</span> : <span className="vivo"><i />Conectando…</span>
}

export function Inversiones() {
  const activos = useLiveQuery(() => db.activos.toArray())
  const operaciones = useLiveQuery(() => db.operaciones.toArray())
  const fotos = useLiveQuery(() => db.fotosCartera.orderBy('fecha').toArray()) ?? []
  const estado = usePrecios()
  const [anadir, setAnadir] = useState(false)

  const cartera = useMemo(
    () => resumirCartera(activos ?? [], operaciones ?? [], estado.precios),
    [activos, operaciones, estado.precios],
  )
  if (!activos || !operaciones) return null

  const posiciones = cartera.lineas.filter((l) => l.posicion.cantidad > 0).sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0))
  const seguimiento = cartera.lineas.filter((l) => l.posicion.cantidad === 0)
  const hayAcciones = activos.some((a) => a.tipo === 'accion')
  const hayCriptos = activos.some((a) => a.tipo === 'cripto')

  return (
    <>
      <Cabecera titulo="Inversiones">{hayCriptos && <IndicadorVivo estado={estado} />}</Cabecera>

      {hayAcciones && !estado.tieneClave && (
        <div className="aviso-banda">
          <span>Falta la clave de Finnhub para actualizar las acciones.</span>
          <a className="btn sec" href="#/ajustes" style={{ textDecoration: 'none' }}>Ajustes</a>
        </div>
      )}
      {estado.errorAcciones && <div className="aviso-banda"><span>⚠ {estado.errorAcciones}</span></div>}

      {posiciones.length > 0 && (
        <section className="tarjeta heroe">
          <div className="etq">Valor de mi cartera{!cartera.completo && ' (faltan precios)'}</div>
          <div className="cifra num">{eurDec(cartera.valor)}</div>
          <div className="pareja">
            <span>Invertido<b className="num">{eurDec(cartera.invertido)}</b></span>
            <span>
              Ganancia total
              <b className="num">
                {cartera.ganancia >= 0 ? '▲ +' : '▼ '}{eurDec(cartera.ganancia)}
                {cartera.gananciaPct !== null && ` (${cartera.gananciaPct.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %)`}
              </b>
            </span>
            <span>Hoy<b className="num">{cartera.cambioDiaEur >= 0 ? '▲ +' : '▼ '}{eurDec(cartera.cambioDiaEur)}</b></span>
          </div>
        </section>
      )}

      {fotos.length >= 2 && (
        <section className="tarjeta">
          <h2>Evolución de mi cartera</h2>
          <LineaEvolucion
            nombre="Valor"
            datos={fotos.map((f) => ({ t: deIso(f.fecha).getTime(), valor: f.valor }))}
            formatoFecha={(t) => fechaCorta(iso(new Date(t)))}
          />
        </section>
      )}

      {activos.length === 0 ? (
        <section className="tarjeta">
          <Vacio emoji="📈">
            <p>Añade Bitcoin, Nvidia o lo que quieras seguir.</p>
            <p className="pequeno">Verás su precio en tiempo real y, si apuntas tus compras, cuánto vas ganando o perdiendo.</p>
          </Vacio>
        </section>
      ) : (
        <>
          {posiciones.length > 0 && <Lista titulo="Mis posiciones" lineas={posiciones} />}
          {seguimiento.length > 0 && <Lista titulo="En seguimiento" lineas={seguimiento} />}
        </>
      )}
      <button className="btn ancho" onClick={() => setAnadir(true)}>+ Añadir activo</button>
      {cartera.realizado !== 0 && (
        <p className="pequeno tenue" style={{ marginTop: 12, textAlign: 'center' }}>
          Ganancia ya materializada en ventas: <span className="num">{eurDec(cartera.realizado)}</span>
        </p>
      )}
      <p className="pequeno tenue" style={{ marginTop: 12, textAlign: 'center' }}>
        Precios informativos (Binance, Finnhub, BCE). No es asesoramiento financiero.
      </p>
      {anadir && <AnadirActivo onCerrar={() => setAnadir(false)} tieneClave={estado.tieneClave} />}
    </>
  )
}

function Lista({ titulo, lineas }: { titulo: string; lineas: LineaCartera[] }) {
  return (
    <>
      <div className="seccion-titulo"><span>{titulo}</span></div>
      <section className="tarjeta" style={{ paddingTop: 6, paddingBottom: 6 }}>
        <ul className="lista">
          {lineas.map((l) => {
            const tiene = l.posicion.cantidad > 0
            return (
              <li key={l.activo.id}>
                <a className="fila" href={`#/activo/${encodeURIComponent(l.activo.id)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span className="chip letras" aria-hidden="true">{l.activo.simbolo.slice(0, 5)}</span>
                  <span className="centro">
                    <span className="titulo" style={{ display: 'block' }}>{l.activo.nombre}</span>
                    <span className="sub num" style={{ display: 'block' }}>
                      {tiene ? `${cantidadTexto(l.posicion.cantidad)} ${l.activo.simbolo} · ` : ''}
                      {l.precio ? eurDec(l.precio.precio) : 'sin precio'}
                    </span>
                  </span>
                  <span className="dcha">
                    <span className="importe num" style={{ display: 'block' }}>
                      {tiene ? (l.valor !== null ? eurDec(l.valor) : '—') : l.precio ? eurDec(l.precio.precio) : '—'}
                    </span>
                    <span className="pequeno" style={{ display: 'block' }}>
                      {tiene ? <Variacion valor={l.gananciaPct} sufijo="total" /> : <Variacion valor={l.precio?.cambioDia ?? null} sufijo="hoy" />}
                    </span>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}

const SUGERENCIAS: Record<TipoActivo, Resultado[]> = {
  cripto: [
    { simbolo: 'BTC', nombre: 'Bitcoin' }, { simbolo: 'ETH', nombre: 'Ethereum' }, { simbolo: 'SOL', nombre: 'Solana' },
    { simbolo: 'XRP', nombre: 'XRP' }, { simbolo: 'ADA', nombre: 'Cardano' }, { simbolo: 'DOGE', nombre: 'Dogecoin' },
  ],
  accion: [
    { simbolo: 'NVDA', nombre: 'Nvidia' }, { simbolo: 'AAPL', nombre: 'Apple' }, { simbolo: 'MSFT', nombre: 'Microsoft' },
    { simbolo: 'TSLA', nombre: 'Tesla' }, { simbolo: 'AMZN', nombre: 'Amazon' }, { simbolo: 'GOOGL', nombre: 'Alphabet (Google)' },
  ],
}

function AnadirActivo({ onCerrar, tieneClave }: { onCerrar: () => void; tieneClave: boolean }) {
  const [tipo, setTipo] = useState<TipoActivo>('cripto')
  const [consulta, setConsulta] = useState('')
  const [resultados, setResultados] = useState<Resultado[] | null>(null)
  const [estado, setEstado] = useState('')
  const bloqueado = tipo === 'accion' && !tieneClave

  // Búsqueda con pausa: no se lanza una petición por cada tecla
  useEffect(() => {
    const q = consulta.trim()
    setResultados(null)
    setEstado('')
    if (q.length < 2 || bloqueado) return
    let vigente = true
    const t = setTimeout(async () => {
      try {
        const clave = (await db.ajustes.get('finnhubClave'))?.valor as string
        const r = tipo === 'cripto' ? await buscarCripto(q) : await buscarAccion(q, clave)
        if (vigente) setResultados(r)
      } catch {
        // Si el buscador falla, se puede seguir añadiendo por símbolo exacto
        if (vigente) setResultados([{ simbolo: q.toUpperCase(), nombre: q.toUpperCase() }])
      }
    }, 450)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [consulta, tipo, bloqueado])

  async function elegir(r: Resultado) {
    setEstado(`Comprobando ${r.simbolo}…`)
    try {
      const id = `${tipo}:${r.simbolo}`
      if (!(await db.activos.get(id))) {
        let par: string | null
        if (tipo === 'cripto') {
          par = await resolverPar(r.simbolo)
          if (!par) return setEstado(`❌ ${r.simbolo} no cotiza en Binance, no puedo darte su precio.`)
        } else {
          const clave = (await db.ajustes.get('finnhubClave'))?.valor as string
          if (!(await cotizacionFinnhub(r.simbolo, clave))) {
            return setEstado(`❌ No hay cotización de ${r.simbolo} (el plan gratuito solo cubre bolsa de EE. UU.).`)
          }
          par = r.simbolo
        }
        await db.activos.add({ id, tipo, simbolo: r.simbolo, nombre: r.nombre, par, creado: Date.now() })
      }
      onCerrar()
      ir(`/activo/${encodeURIComponent(id)}`)
    } catch (e) {
      setEstado(e instanceof ErrorClave ? `❌ ${e.message}` : '❌ No se ha podido comprobar. ¿Tienes conexión?')
    }
  }

  const lista = resultados ?? (consulta.trim().length < 2 ? SUGERENCIAS[tipo] : null)

  return (
    <Hoja titulo="Añadir activo" onCerrar={onCerrar}>
      <Segmento<TipoActivo>
        opciones={[{ valor: 'cripto', texto: 'Criptomoneda' }, { valor: 'accion', texto: 'Acción (EE. UU.)' }]}
        valor={tipo}
        onCambio={(t) => { setTipo(t); setConsulta('') }}
      />
      <div style={{ height: 12 }} />
      {bloqueado ? (
        <p className="nota-info">
          Para acciones hace falta una clave gratuita de Finnhub. <a href="#/ajustes" onClick={onCerrar}>Ponla en Ajustes</a> y vuelve aquí.
        </p>
      ) : (
        <>
          <input className="entrada" type="search" autoFocus placeholder={tipo === 'cripto' ? 'Buscar: bitcoin, ETH…' : 'Buscar: nvidia, AAPL…'}
            aria-label="Buscar activo" value={consulta} onChange={(e) => setConsulta(e.target.value)} />
          {estado && <p className="pequeno" role="status" style={{ marginTop: 10 }}>{estado}</p>}
          <ul className="lista" style={{ marginTop: 8, minHeight: 200 }}>
            {lista === null ? (
              <li className="tenue pequeno" style={{ padding: 12 }}>Buscando…</li>
            ) : lista.length === 0 ? (
              <li className="tenue pequeno" style={{ padding: 12 }}>Sin resultados.</li>
            ) : (
              lista.map((r) => (
                <li key={r.simbolo}>
                  <button className="fila" onClick={() => void elegir(r)}>
                    <span className="chip letras" aria-hidden="true">{r.simbolo.slice(0, 5)}</span>
                    <span className="centro">
                      <span className="titulo" style={{ display: 'block' }}>{r.nombre}</span>
                      <span className="sub" style={{ display: 'block' }}>{r.simbolo}</span>
                    </span>
                    <span className="enlace">Añadir</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </Hoja>
  )
}
