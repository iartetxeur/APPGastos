import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './estilos.css'
import { aplicarTema, leerTema } from './hooks'

aplicarTema(leerTema())
// Service worker: permite abrir la app sin conexión y se actualiza solo
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
