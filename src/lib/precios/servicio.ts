import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'
import { db, guardarAjuste, leerAjuste, type Activo, type Precio } from '../../db'
import { resumirCartera } from '../cartera'
import { hoyIso } from '../periodos'
import {
  BINANCE_WS, cambioUsdEur, cotizacionFinnhub, ErrorClave, ErrorLimite, parEnUsd, tickerBinance, type Cotizacion,
} from './fuentes'

export interface EstadoPrecios {
  precios: Map<string, Precio>
  /** Estado del flujo en vivo de criptomonedas. */
  vivo: boolean
  enLinea: boolean
  usdEur: number | null
  tieneClave: boolean
  errorAcciones: string | null
}

let estado: EstadoPrecios = {
  precios: new Map(),
  vivo: false,
  enLinea: typeof navigator === 'undefined' ? true : navigator.onLine,
  usdEur: null,
  tieneClave: false,
  errorAcciones: null,
}
const oyentes = new Set<() => void>()

function emitir(parcial: Partial<EstadoPrecios>): void {
  estado = { ...estado, ...parcial }
  oyentes.forEach((f) => f())
}

export function usePrecios(): EstadoPrecios {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f)
      return () => oyentes.delete(f)
    },
    () => estado,
  )
}

let activos: Activo[] = []
let clave = ''
let ws: WebSocket | null = null
let paresWs = ''
let reintentos = 0
let temporizadorWs: ReturnType<typeof setTimeout> | undefined
let temporizadorAcciones: ReturnType<typeof setInterval> | undefined
let firmaAcciones = ''
const pendientes = new Map<string, Precio>()
let volcado: ReturnType<typeof setTimeout> | undefined
const sinGuardar = new Set<string>()

function aEuros(c: Cotizacion, activoId: string): Precio | null {
  const factor = c.enUsd ? estado.usdEur : 1
  if (!factor) return null
  return {
    activoId,
    precio: c.precio * factor,
    cambioDia: c.cambioDia,
    max: c.max === null ? null : c.max * factor,
    min: c.min === null ? null : c.min * factor,
    hora: c.hora,
  }
}

/** Agrupa las actualizaciones (llegan varias por segundo) para no repintar la pantalla sin parar. */
function recibir(p: Precio | null): void {
  if (!p) return
  pendientes.set(p.activoId, p)
  volcado ??= setTimeout(() => {
    volcado = undefined
    const precios = new Map(estado.precios)
    for (const [id, precio] of pendientes) {
      precios.set(id, precio)
      sinGuardar.add(id)
    }
    pendientes.clear()
    emitir({ precios })
  }, 400)
}

function conectarWs(): void {
  clearTimeout(temporizadorWs)
  const pares = [...new Set(activos.filter((a) => a.tipo === 'cripto').map((a) => a.par))].sort()
  const firma = pares.join(',')
  if (ws && firma === paresWs && ws.readyState <= WebSocket.OPEN) return
  paresWs = firma
  if (ws) {
    ws.onclose = null
    ws.close()
    ws = null
  }
  if (pares.length === 0) {
    emitir({ vivo: false })
    return
  }
  const socket = new WebSocket(BINANCE_WS + pares.map((p) => `${p.toLowerCase()}@miniTicker`).join('/'))
  ws = socket
  socket.onopen = () => {
    reintentos = 0
    emitir({ vivo: true })
  }
  socket.onmessage = (e) => {
    const d = (JSON.parse(String(e.data)) as { data?: Record<string, string> }).data
    if (!d?.s) return
    const cierre = Number(d.c)
    const apertura = Number(d.o)
    const cot: Cotizacion = {
      precio: cierre,
      cambioDia: apertura > 0 ? ((cierre - apertura) / apertura) * 100 : null,
      max: Number(d.h),
      min: Number(d.l),
      hora: Date.now(),
      enUsd: parEnUsd(d.s),
    }
    for (const a of activos) if (a.tipo === 'cripto' && a.par === d.s) recibir(aEuros(cot, a.id))
  }
  socket.onclose = () => {
    if (ws !== socket) return
    ws = null
    emitir({ vivo: false })
    reintentos++
    temporizadorWs = setTimeout(conectarWs, Math.min(30000, 1000 * 2 ** reintentos))
  }
  socket.onerror = () => socket.close()
}

/** Primer precio inmediato por REST, sin esperar al primer mensaje del flujo. */
async function cargarCriptos(): Promise<void> {
  await Promise.all(
    activos.filter((a) => a.tipo === 'cripto').map(async (a) => {
      try {
        const c = await tickerBinance(a.par)
        if (c) recibir(aEuros(c, a.id))
      } catch {
        /* sin red: se queda el precio guardado */
      }
    }),
  )
}

async function cargarAcciones(): Promise<void> {
  const acciones = activos.filter((a) => a.tipo === 'accion')
  if (!clave || acciones.length === 0 || !estado.enLinea || document.hidden) return
  try {
    for (const a of acciones) {
      const c = await cotizacionFinnhub(a.par, clave)
      if (c) recibir(aEuros(c, a.id))
    }
    if (estado.errorAcciones) emitir({ errorAcciones: null })
  } catch (e) {
    if (e instanceof ErrorClave || e instanceof ErrorLimite) emitir({ errorAcciones: e.message })
    else emitir({ errorAcciones: 'No se han podido actualizar las acciones.' })
  }
}

function programarAcciones(): void {
  const acciones = activos.filter((a) => a.tipo === 'accion')
  const firma = `${clave}|${acciones.map((a) => a.par).sort().join(',')}`
  if (firma === firmaAcciones) return
  firmaAcciones = firma
  clearInterval(temporizadorAcciones)
  if (!clave || acciones.length === 0) return
  void cargarAcciones()
  // El plan gratuito permite 60 peticiones por minuto: dejamos margen de sobra
  temporizadorAcciones = setInterval(() => void cargarAcciones(), Math.max(15000, acciones.length * 2500))
}

async function actualizarCambio(): Promise<void> {
  try {
    const usdEur = await cambioUsdEur()
    emitir({ usdEur })
    await guardarAjuste('usdEur', usdEur)
  } catch {
    /* se mantiene el último cambio conocido */
  }
}

/** Guarda en disco los últimos precios (para verlos sin conexión) y la foto diaria de la cartera. */
async function guardar(): Promise<void> {
  if (sinGuardar.size === 0) return
  const filas = [...sinGuardar].map((id) => estado.precios.get(id)).filter((p): p is Precio => !!p)
  sinGuardar.clear()
  await db.precios.bulkPut(filas)
  const resumen = resumirCartera(activos, await db.operaciones.toArray(), estado.precios)
  if (resumen.completo && resumen.valor > 0) {
    await db.fotosCartera.put({ fecha: hoyIso(), valor: resumen.valor, invertido: resumen.invertido })
  }
}

let iniciado = false

export async function iniciarPrecios(): Promise<void> {
  if (iniciado) return
  iniciado = true
  const guardados = await db.precios.toArray()
  emitir({
    precios: new Map(guardados.map((p) => [p.activoId, p])),
    usdEur: await leerAjuste<number | null>('usdEur', null),
  })
  await actualizarCambio()
  setInterval(() => void actualizarCambio(), 60 * 60 * 1000)
  setInterval(() => void guardar(), 20000)

  liveQuery(async () => ({
    activos: await db.activos.toArray(),
    clave: await leerAjuste('finnhubClave', ''),
  })).subscribe((r) => {
    const antes = activos.map((a) => a.id).join(',')
    activos = r.activos
    clave = r.clave.trim()
    if (estado.tieneClave !== !!clave) emitir({ tieneClave: !!clave, errorAcciones: null })
    conectarWs()
    programarAcciones()
    if (antes !== activos.map((a) => a.id).join(',')) void cargarCriptos()
  })

  window.addEventListener('online', () => {
    emitir({ enLinea: true })
    conectarWs()
    void cargarAcciones()
  })
  window.addEventListener('offline', () => emitir({ enLinea: false }))
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      void guardar()
      return
    }
    conectarWs()
    void cargarAcciones()
  })
}
