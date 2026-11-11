import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { eur, eurDec, type PuntoSerie } from '../lib/calculos'

interface PropsBurbuja {
  active?: boolean
  label?: string | number
  payload?: readonly { name?: string | number; value?: unknown; color?: string }[]
}

const EJE = { fontSize: 11, fill: 'var(--texto-3)' }

function compacto(euros: number): string {
  const abs = Math.abs(euros)
  if (abs >= 1_000_000) return `${(euros / 1_000_000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M`
  if (abs >= 10_000) return `${Math.round(euros / 1000)} k`
  if (abs >= 1000) return `${(euros / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} k`
  if (abs > 0 && abs < 1) return euros.toLocaleString('es-ES', { maximumSignificantDigits: 3 })
  return euros.toLocaleString('es-ES', { maximumFractionDigits: abs < 10 ? 2 : 0 })
}

/** Gastos e ingresos por día (semana/mes) o por mes (año). Un solo eje, en euros. */
export function BarrasPeriodo({ datos, titulo, conIngresos }: {
  datos: PuntoSerie[]
  titulo: (etiqueta: string) => string
  /** Por días solo se pintan los gastos: una nómina dejaría el resto de barras ilegibles. */
  conIngresos: boolean
}) {
  const hayIngresos = conIngresos && datos.some((d) => d.ingresos > 0)
  const filas = datos.map((d) => ({ etiqueta: d.etiqueta, Gastos: d.gastos / 100, Ingresos: d.ingresos / 100 }))
  return (
    <>
      {hayIngresos && (
        <div className="leyenda">
          <span><i style={{ background: 'var(--serie-1)' }} />Gastos</span>
          <span><i style={{ background: 'var(--serie-2)' }} />Ingresos</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={filas} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--rejilla)" />
          <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={{ stroke: 'var(--rejilla)' }} interval="preserveStartEnd" minTickGap={6} />
          <YAxis tick={EJE} tickLine={false} axisLine={false} width={44} tickFormatter={compacto} />
          <Tooltip
            cursor={{ fill: 'var(--superficie-2)' }}
            content={(p) => {
              const b = p as unknown as PropsBurbuja
              if (!b.active || !b.payload?.length) return null
              return (
                <div className="tooltip">
                  <b>{titulo(String(b.label))}</b>
                  {b.payload.map((s) => (
                    <div key={String(s.name)} className="num">
                      <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 6, background: s.color }} />
                      {s.name}: {eur(Math.round(Number(s.value) * 100))}
                    </div>
                  ))}
                </div>
              )
            }}
          />
          <Bar dataKey="Gastos" fill="var(--serie-1)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          {hayIngresos && <Bar dataKey="Ingresos" fill="var(--serie-2)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />}
        </BarChart>
      </ResponsiveContainer>
    </>
  )
}

export interface PuntoLinea {
  t: number
  valor: number
}

/** Línea de evolución (precio de un activo o valor de la cartera), en euros. */
export function LineaEvolucion({ datos, formatoFecha, nombre }: {
  datos: PuntoLinea[]
  formatoFecha: (t: number, largo: boolean) => string
  nombre: string
}) {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={datos} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--rejilla)" />
        <XAxis
          dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tick={EJE} tickLine={false}
          axisLine={{ stroke: 'var(--rejilla)' }} tickFormatter={(t: number) => formatoFecha(t, false)} minTickGap={40} tickCount={5}
        />
        <YAxis tick={EJE} tickLine={false} axisLine={false} width={52} domain={['auto', 'auto']} tickFormatter={compacto} />
        <Tooltip
          cursor={{ stroke: 'var(--texto-3)', strokeWidth: 1 }}
          content={(p) => {
            const b = p as unknown as PropsBurbuja
            if (!b.active || !b.payload?.length) return null
            return (
              <div className="tooltip">
                <b>{formatoFecha(Number(b.label), true)}</b>
                <span className="num">{nombre}: {eurDec(Number(b.payload[0].value))}</span>
              </div>
            )
          }}
        />
        <Line dataKey="valor" stroke="var(--serie-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: 'var(--superficie)', strokeWidth: 2 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
