import { useCallback, useEffect, useMemo, useState } from 'react'
import { FormMovimiento } from './componentes/FormMovimiento'
import { ICONOS } from './componentes/ui'
import type { Movimiento, Tipo } from './db'
import { ContextoApp, useRuta } from './hooks'
import { iniciarPrecios } from './lib/precios/servicio'
import { aplicarRecurrentes } from './lib/recurrentes'
import { Activo } from './pantallas/Activo'
import { Ajustes } from './pantallas/Ajustes'
import { Balance } from './pantallas/Balance'
import { Inicio } from './pantallas/Inicio'
import { Inversiones } from './pantallas/Inversiones'
import { Mas } from './pantallas/Mas'
import { Movimientos } from './pantallas/Movimientos'
import { Presupuestos } from './pantallas/Presupuestos'
import { Recurrentes } from './pantallas/Recurrentes'

const PESTANAS = [
  { ruta: '/', texto: 'Inicio', icono: ICONOS.inicio },
  { ruta: '/movimientos', texto: 'Movimientos', icono: ICONOS.lista },
  { ruta: '/balance', texto: 'Balance', icono: ICONOS.balance },
  { ruta: '/inversiones', texto: 'Inversiones', icono: ICONOS.bolsa },
  { ruta: '/mas', texto: 'Más', icono: ICONOS.mas },
]

const PESTANA_DE: Record<string, string> = {
  '': '/', movimientos: '/movimientos', balance: '/balance', inversiones: '/inversiones', activo: '/inversiones',
  mas: '/mas', presupuestos: '/mas', recurrentes: '/mas', ajustes: '/mas',
}

export default function App() {
  const ruta = useRuta()
  const [form, setForm] = useState<{ m?: Movimiento; tipo?: Tipo } | null>(null)

  useEffect(() => {
    void aplicarRecurrentes()
    void iniciarPrecios()
    // Pide al navegador que no borre los datos si anda justo de espacio
    void navigator.storage?.persist?.().catch(() => false)
  }, [])

  const acciones = useMemo(() => ({ abrirMovimiento: (m?: Movimiento, tipo?: Tipo) => setForm({ m, tipo }) }), [])
  const cerrar = useCallback(() => setForm(null), [])

  const [, seccion = '', parametro = ''] = ruta.split('/')
  const pestana = PESTANA_DE[seccion] ?? '/'
  const enGastos = ['', 'movimientos', 'balance'].includes(seccion)

  let pantalla
  switch (seccion) {
    case 'movimientos': pantalla = <Movimientos />; break
    case 'balance': pantalla = <Balance />; break
    case 'inversiones': pantalla = <Inversiones />; break
    case 'activo': pantalla = <Activo id={decodeURIComponent(parametro)} />; break
    case 'mas': pantalla = <Mas />; break
    case 'presupuestos': pantalla = <Presupuestos />; break
    case 'recurrentes': pantalla = <Recurrentes />; break
    case 'ajustes': pantalla = <Ajustes />; break
    default: pantalla = <Inicio />
  }

  return (
    <ContextoApp.Provider value={acciones}>
      <div className="app">
        <main className="contenido">{pantalla}</main>
        {enGastos && <button className="fab" onClick={() => setForm({})} aria-label="Añadir movimiento">+</button>}
        <nav className="nav" aria-label="Principal">
          <div className="marca"><img src="icons/favicon.svg" alt="" />APPGastos</div>
          {PESTANAS.map((p) => (
            <a key={p.ruta} href={`#${p.ruta}`} className={p.ruta === pestana ? 'activa' : ''} aria-current={p.ruta === pestana ? 'page' : undefined}>
              {p.icono}
              {p.texto}
            </a>
          ))}
        </nav>
        {form && <FormMovimiento movimiento={form.m} tipoInicial={form.tipo} onCerrar={cerrar} />}
      </div>
    </ContextoApp.Provider>
  )
}
