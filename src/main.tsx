import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { PresentationPlayerApp } from './presentation-runtime/PresentationPlayerApp.tsx'
import { registerMainProcessMessages } from './app/registerMainProcessMessages'
import './index.css'

const isPresentationRuntime = new URLSearchParams(window.location.search).get('view') === 'presentation'
  || window.location.pathname.startsWith('/presentacion/')
  || Boolean((window as Window & { __PULSE_PRESENTATION__?: unknown }).__PULSE_PRESENTATION__);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPresentationRuntime ? <PresentationPlayerApp /> : <App />}
  </React.StrictMode>,
)

// El renderer tambien debe poder montar una pantalla de recuperacion cuando el
// preload no esta disponible. Una API IPC ausente nunca debe dejar la ventana
// completamente en blanco.
if (!isPresentationRuntime) registerMainProcessMessages(window.ipcRenderer)
