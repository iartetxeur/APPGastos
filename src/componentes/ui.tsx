import { useEffect, type ReactNode } from 'react'
import type { Categoria, Movimiento } from '../db'
import { estadoPresupuesto, eur, pct } from '../lib/calculos'
import { etiqueta, mover, type Unidad } from '../lib/periodos'

export function Hoja({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', f)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', f)
      document.body.style.overflow = ''
    }
  }, [onCerrar])
  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="hoja-cab">
          <h2>{titulo}</h2>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Cabecera({ titulo, atras, children }: { titulo: string; atras?: string; children?: ReactNode }) {
  return (
    <header className="cabecera">
      {atras && <a className="atras" href={`#${atras}`} aria-label="Volver" style={{ textDecoration: 'none', color: 'inherit' }}>←</a>}
      <h1>{titulo}</h1>
      {children}
    </header>
  )
}

export function Segmento<T extends string>({ opciones, valor, onCambio }: {
  opciones: { valor: T; texto: string }[]
  valor: T
  onCambio: (v: T) => void
}) {
  return (
    <div className="segmento">
      {opciones.map((o) => (
        <button key={o.valor} type="button" aria-pressed={o.valor === valor} onClick={() => onCambio(o.valor)}>{o.texto}</button>
      ))}
    </div>
  )
}

export function SelectorPeriodo({ unidad, fecha, onCambio }: { unidad: Unidad; fecha: Date; onCambio: (d: Date) => void }) {
  const siguiente = mover(unidad, fecha, 1)
  return (
    <div className="periodo">
      <button onClick={() => onCambio(mover(unidad, fecha, -1))} aria-label="Periodo anterior">‹</button>
      <div className="txt">{etiqueta(unidad, fecha)}</div>
      <button onClick={() => onCambio(siguiente)} aria-label="Periodo siguiente">›</button>
    </div>
  )
}

export function Vacio({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <div className="vacio">
      <span className="emoji" aria-hidden="true">{emoji}</span>
      {children}
    </div>
  )
}

const SIN_CATEGORIA: Categoria = { id: '', nombre: 'Sin categoría', icono: '❔', color: '#64748b', tipo: 'gasto', orden: 99 }

export function buscarCategoria(categorias: Categoria[], id: string): Categoria {
  return categorias.find((c) => c.id === id) ?? SIN_CATEGORIA
}

export function FilaMovimiento({ m, categorias, onClick, conFecha }: {
  m: Movimiento
  categorias: Categoria[]
  onClick: () => void
  conFecha?: string
}) {
  const c = buscarCategoria(categorias, m.categoriaId)
  return (
    <button className="fila" onClick={onClick}>
      <span className="chip" style={{ ['--c' as string]: c.color }} aria-hidden="true">{c.icono}</span>
      <span className="centro">
        <span className="titulo" style={{ display: 'block' }}>{m.nota || c.nombre}</span>
        <span className="sub" style={{ display: 'block' }}>
          {[m.nota ? c.nombre : '', conFecha, m.recurrenteId ? '🔁 recurrente' : ''].filter(Boolean).join(' · ') || ' '}
        </span>
      </span>
      <span className={`dcha importe num ${m.tipo === 'ingreso' ? 'ingreso' : ''}`}>
        {m.tipo === 'ingreso' ? '+' : '−'}{eur(m.importe)}
      </span>
    </button>
  )
}

const TEXTO_ESTADO = { bien: '', cerca: '⚠ Cerca del límite', superado: '⛔ Superado' } as const

export function BarraPresupuesto({ categoria, gastado, limite }: { categoria: Categoria; gastado: number; limite: number }) {
  const estado = estadoPresupuesto(gastado, limite)
  const resto = limite - gastado
  return (
    <div className="ppto">
      <div className="ppto-cab">
        <span className="n">{categoria.icono} {categoria.nombre}</span>
        <span className="num pequeno"><b>{eur(gastado)}</b> <span className="tenue">de {eur(limite)}</span></span>
      </div>
      <div className={`barra ${estado}`} role="img" aria-label={`${Math.round((gastado / limite) * 100)} % del presupuesto`}>
        <i style={{ width: `${Math.min(100, (gastado / limite) * 100)}%` }} />
      </div>
      <div className="ppto-pie">
        <span className={`etiqueta-estado ${estado}`}>{TEXTO_ESTADO[estado]}</span>
        <span className="num">{resto >= 0 ? `Quedan ${eur(resto)}` : `Te has pasado ${eur(-resto)}`}</span>
      </div>
    </div>
  )
}

/** Variación con flecha y signo, para que no dependa solo del color. */
export function Variacion({ valor, invertido, sufijo }: { valor: number | null; invertido?: boolean; sufijo?: string }) {
  if (valor === null || !Number.isFinite(valor)) return <span className="tenue">—</span>
  const sube = valor > 0
  const plano = Math.abs(valor) < 0.05
  // En gastos, subir es malo: `invertido` cambia el color pero no la flecha
  const clase = plano ? 'tenue' : sube !== !!invertido ? 'sube' : 'baja'
  return <span className={`num ${clase}`}>{plano ? '=' : sube ? '▲' : '▼'} {pct(valor)}{sufijo ? ` ${sufijo}` : ''}</span>
}

export const ICONOS = {
  inicio: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>,
  lista: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>,
  balance: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 20V10M12 20V4M19 20v-7" /></svg>,
  bolsa: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>,
  mas: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 12h.01M12 12h.01M19 12h.01" /></svg>,
}
