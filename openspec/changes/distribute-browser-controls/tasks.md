## 1. Atajos

- [x] 1.1 Tabla compartida de atajos con etiquetas y aceleradores.
- [x] 1.2 Reenvío desde `before-input-event` en main, sin interceptar al agente.
- [x] 1.3 Hook del renderer que ejecuta órdenes y atajos de la barra, sin capturar el chat.
- [x] 1.4 Ctrl+rueda aplica el zoom por pestaña también en modo aislado.

## 2. Distribución

- [x] 2.1 Menú nativo de pestaña y canal IPC validado.
- [x] 2.2 Icono de sonido en pestañas horizontales y verticales; `page-mute` por pestaña.
- [x] 2.3 Menú general por secciones con atajos y fila de zoom.

## 3. Verificación

- [x] 3.1 Pruebas de tabla, menú de pestaña, servicio, handlers y panel.
- [x] 3.2 Sonda con Electron real: `zoom-changed` sin zoom nativo y `before-input-event` con teclas sintéticas.
- [ ] 3.3 Fase `--zoom-only` del smoke nativo con Electron 43.4.0 (la descarga falló por red).
- [x] 3.4 Documentación de la plataforma del navegador.
- [ ] 3.5 Revisión visual en la app de escritorio.
