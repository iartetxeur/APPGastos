import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, useEffect, useState } from 'react'
import { db, type Categoria, type Movimiento, type Tipo } from './db'

/** Navegación por hash (#/balance): funciona sin servidor y con el botón "atrás" del móvil. */
export function useRuta(): string {
  const leer = () => window.location.hash.replace(/^#/, '') || '/'
  const [ruta, setRuta] = useState(leer)
  useEffect(() => {
    const f = () => {
      setRuta(leer())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return ruta
}

export function ir(ruta: string): void {
  window.location.hash = ruta
}

export interface Acciones {
  /** Abre el formulario para crear (o editar, si se pasa uno) un movimiento. */
  abrirMovimiento: (m?: Movimiento, tipo?: Tipo) => void
}

export const ContextoApp = createContext<Acciones>({ abrirMovimiento: () => {} })

export function useAcciones(): Acciones {
  return useContext(ContextoApp)
}

export function useMovimientos(): Movimiento[] | undefined {
  return useLiveQuery(() => db.movimientos.toArray())
}

export function useCategorias(): Categoria[] {
  return useLiveQuery(() => db.categorias.orderBy('orden').toArray()) ?? []
}

export function useAjuste<T>(clave: string, defecto: T): T {
  return useLiveQuery(async () => (await db.ajustes.get(clave))?.valor as T | undefined, [clave]) ?? defecto
}

export type Tema = 'auto' | 'claro' | 'oscuro'

export function leerTema(): Tema {
  try {
    const t = localStorage.getItem('tema')
    return t === 'claro' || t === 'oscuro' ? t : 'auto'
  } catch {
    return 'auto'
  }
}

export function aplicarTema(tema: Tema): void {
  if (tema === 'auto') delete document.documentElement.dataset.tema
  else document.documentElement.dataset.tema = tema
  try {
    localStorage.setItem('tema', tema)
  } catch {
    /* modo privado: el tema no se recuerda */
  }
}
