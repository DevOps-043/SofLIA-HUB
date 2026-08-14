import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

const isPresentationRuntime = new URLSearchParams(window.location.search).get('view') === 'presentation'
  || window.location.pathname.startsWith('/presentacion/')
  || Boolean((window as Window & { __PULSE_PRESENTATION__?: unknown }).__PULSE_PRESENTATION__);

async function bootstrap() {
  const root = ReactDOM.createRoot(document.getElementById('root')!)

  if (isPresentationRuntime) {
    // La vista previa vive en un iframe sandbox con origen opaco. Cargar solo
    // su runtime evita inicializar App/Supabase, que legitimamente intenta leer
    // localStorage y no debe recibir ese permiso dentro de la previsualizacion.
    const { PresentationPlayerApp } = await import('./presentation-runtime/PresentationPlayerApp.tsx')
    root.render(
      <React.StrictMode>
        <PresentationPlayerApp />
      </React.StrictMode>,
    )
    return
  }

  const [{ default: App }, { registerMainProcessMessages }] = await Promise.all([
    import('./App.tsx'),
    import('./app/registerMainProcessMessages'),
  ])
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )

  // El renderer tambien debe poder montar una pantalla de recuperacion cuando
  // el preload no esta disponible. Una API IPC ausente nunca debe dejar la
  // ventana completamente en blanco.
  registerMainProcessMessages(window.ipcRenderer)
}

void bootstrap()
