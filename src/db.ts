import Dexie, { type Table } from 'dexie'

export type Tipo = 'gasto' | 'ingreso'
export type Periodicidad = 'semanal' | 'mensual' | 'anual'

/** Las fechas se guardan como 'AAAA-MM-DD' (día local) y los importes en céntimos enteros. */
export interface Movimiento {
  id: string
  tipo: Tipo
  importe: number
  categoriaId: string
  fecha: string
  nota: string
  recurrenteId?: string
  creado: number
}

export interface Categoria {
  id: string
  nombre: string
  icono: string
  color: string
  tipo: Tipo
  orden: number
}

export interface Presupuesto {
  categoriaId: string
  limite: number
}

export interface Recurrente {
  id: string
  tipo: Tipo
  importe: number
  categoriaId: string
  nota: string
  periodicidad: Periodicidad
  /** Primera fecha; las siguientes se calculan siempre desde aquí para no desviarse (31 → 30 → 31). */
  inicio: string
  /** Próxima fecha todavía no generada. */
  proxima: string
  activo: boolean
}

export interface Ajuste {
  clave: string
  valor: unknown
}

export type TipoActivo = 'cripto' | 'accion'

export interface Activo {
  id: string
  tipo: TipoActivo
  simbolo: string
  nombre: string
  /** Cripto: par de Binance (BTCEUR, DOGEUSDT…). Acción: símbolo de Finnhub. */
  par: string
  creado: number
}

/** Cantidades y precios de inversión en euros con decimales (no céntimos: hay fracciones de cripto). */
export interface Operacion {
  id: string
  activoId: string
  tipo: 'compra' | 'venta'
  cantidad: number
  precio: number
  comision: number
  fecha: string
}

export interface Precio {
  activoId: string
  precio: number
  cambioDia: number | null
  max: number | null
  min: number | null
  hora: number
}

export interface FotoCartera {
  fecha: string
  valor: number
  invertido: number
}

export class BaseDatos extends Dexie {
  movimientos!: Table<Movimiento, string>
  categorias!: Table<Categoria, string>
  presupuestos!: Table<Presupuesto, string>
  recurrentes!: Table<Recurrente, string>
  ajustes!: Table<Ajuste, string>
  activos!: Table<Activo, string>
  operaciones!: Table<Operacion, string>
  precios!: Table<Precio, string>
  fotosCartera!: Table<FotoCartera, string>

  constructor(nombre = 'appgastos') {
    super(nombre)
    this.version(1).stores({
      movimientos: 'id, fecha, categoriaId, recurrenteId',
      categorias: 'id, tipo, orden',
      presupuestos: 'categoriaId',
      recurrentes: 'id',
      ajustes: 'clave',
      activos: 'id',
      operaciones: 'id, activoId, fecha',
      precios: 'activoId',
      fotosCartera: 'fecha',
    })
    this.on('populate', (tx) => {
      tx.table('categorias').bulkAdd(CATEGORIAS_INICIALES)
    })
  }
}

export const CATEGORIAS_INICIALES: Categoria[] = [
  { id: 'comida', nombre: 'Comida', icono: '🛒', color: '#f59e0b', tipo: 'gasto', orden: 1 },
  { id: 'restaurantes', nombre: 'Bares y restaurantes', icono: '🍽️', color: '#ef4444', tipo: 'gasto', orden: 2 },
  { id: 'transporte', nombre: 'Transporte', icono: '🚌', color: '#3b82f6', tipo: 'gasto', orden: 3 },
  { id: 'vivienda', nombre: 'Vivienda', icono: '🏠', color: '#8b5cf6', tipo: 'gasto', orden: 4 },
  { id: 'ocio', nombre: 'Ocio', icono: '🎮', color: '#ec4899', tipo: 'gasto', orden: 5 },
  { id: 'suscripciones', nombre: 'Suscripciones', icono: '📺', color: '#06b6d4', tipo: 'gasto', orden: 6 },
  { id: 'salud', nombre: 'Salud', icono: '💊', color: '#10b981', tipo: 'gasto', orden: 7 },
  { id: 'ropa', nombre: 'Ropa', icono: '👕', color: '#a855f7', tipo: 'gasto', orden: 8 },
  { id: 'estudios', nombre: 'Estudios', icono: '📚', color: '#0ea5e9', tipo: 'gasto', orden: 9 },
  { id: 'otros', nombre: 'Otros', icono: '📦', color: '#64748b', tipo: 'gasto', orden: 10 },
  { id: 'sueldo', nombre: 'Sueldo', icono: '💼', color: '#16a34a', tipo: 'ingreso', orden: 1 },
  { id: 'bizum', nombre: 'Bizum recibido', icono: '📲', color: '#0d9488', tipo: 'ingreso', orden: 2 },
  { id: 'otros-ingresos', nombre: 'Otros ingresos', icono: '💰', color: '#65a30d', tipo: 'ingreso', orden: 3 },
]

export const db = new BaseDatos()

export function nuevoId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export async function leerAjuste<T>(clave: string, defecto: T, base: BaseDatos = db): Promise<T> {
  const a = await base.ajustes.get(clave)
  return a === undefined ? defecto : (a.valor as T)
}

export async function guardarAjuste(clave: string, valor: unknown, base: BaseDatos = db): Promise<void> {
  await base.ajustes.put({ clave, valor })
}
