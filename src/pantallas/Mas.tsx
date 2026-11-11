import { Cabecera } from '../componentes/ui'
import { INVERSIONES_ACTIVAS } from '../config'

const ENLACES = [
  { ruta: '/presupuestos', icono: '🎯', titulo: 'Presupuestos', sub: 'Límites mensuales por categoría con aviso' },
  { ruta: '/recurrentes', icono: '🔁', titulo: 'Recurrentes', sub: 'Alquiler, suscripciones, sueldo…' },
  { ruta: '/ajustes', icono: '⚙️', titulo: 'Ajustes', sub: INVERSIONES_ACTIVAS ? 'Copias de seguridad, categorías, tema y bolsa' : 'Copias de seguridad, categorías y tema' },
]

export function Mas() {
  return (
    <>
      <Cabecera titulo="Más" />
      <section className="tarjeta">
        <ul className="lista">
          {ENLACES.map((e) => (
            <li key={e.ruta}>
              <a className="fila" href={`#${e.ruta}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="chip" aria-hidden="true">{e.icono}</span>
                <span className="centro">
                  <span className="titulo" style={{ display: 'block' }}>{e.titulo}</span>
                  <span className="sub" style={{ display: 'block' }}>{e.sub}</span>
                </span>
                <span className="tenue" aria-hidden="true">›</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
