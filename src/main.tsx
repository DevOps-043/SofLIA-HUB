import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { registerMainProcessMessages } from './app/registerMainProcessMessages'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// El renderer tambien debe poder montar una pantalla de recuperacion cuando el
// preload no esta disponible. Una API IPC ausente nunca debe dejar la ventana
// completamente en blanco.
registerMainProcessMessages(window.ipcRenderer)
