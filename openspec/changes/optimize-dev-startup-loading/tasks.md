## Implementación y evidencia

- [x] Leer log y medir imports en Electron aislado sin cuentas ni ventanas.
- [x] Implementar carga concurrente, métricas y ahorro accesorio en dev.
- [x] Comprobar concurrencia, fallo, exports, reloj y opciones build dev.
- [x] Investigar recompilación adicional preservando HMR; mismo contenido confirmado, se evita reinicio redundante.
- [x] Actualizar documentación, revisar riesgos y ejecutar build/gate: build aislado completo y verify:pr aprobados; 7629 pruebas globales aprobadas, sin reducir cobertura ni funciones.
- [x] Reducir el grafo del build main en desarrollo y verificar carga diferida del SDK, recarga y empaquetado de producción. Build, smokes Electron y verify:pr aprobados.
- [x] Medir el renderer con Electron aislado y reducir la espera del acceso tras la fusión, preservando el intro, el sonido y la restauración de sesión.
