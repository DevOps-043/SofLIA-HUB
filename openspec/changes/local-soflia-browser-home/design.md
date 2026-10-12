# Decisiones

- DEC-HOME-01: `soflia-inicio://inicio/` identifica únicamente el documento local.
  Se registra antes de app.whenReady y su handler en cada sesión materializada.
  Las demás rutas, hosts, credenciales, parámetros y fragmentos se rechazan.
- DEC-HOME-02: HTML y CSS estáticos, logo empaquetado y fuentes del sistema.
  CSP sin scripts, conexiones, frames ni objetos; formulario GET a Google.
  Salir de la portada usa los controles de seguridad del navegador existente.
- DEC-HOME-03: tokens de tema compartidos con el renderer, sin copiar valores.
  prefers-color-scheme sigue nativeTheme, que ya recibe la preferencia de la app.
  Las animaciones usan transform/opacity y respetan prefers-reduced-motion.
- DEC-HOME-04: la URL interna se conserva al restaurar sesiones, pero la barra
  muestra su placeholder de búsqueda; no se registra como visita web.
- LIM-HOME-01: la portada funciona sin red; los resultados de búsqueda y sitios
  externos dependen de sus servidores. No se migra una pestaña Google existente.

Rollback: revertir el diff de esta unidad sin retirar cambios locales anteriores.
