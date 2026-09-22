# Contexto del instalador solicitado

- Objetivo: preparar Python privado y un instalador Windows reconocible como Pulse Hub, con pruebas de empaquetado locales.
- Usuario o actor: persona que instala Pulse Hub; mantenedor que genera el paquete.
- Alcance: preparación recuperable de Python, integridad fijada, imports de voz/documentos, bienvenida NSIS propia, progreso real y finalización explícita; build aislado sin publicación.
- No objetivos: instalar automáticamente en este equipo, firmar con una identidad no autorizada, publicar releases, migrar servicios, copiar marcas de competidores o declarar terminado el smoke con cuentas reales.
- Restricciones: conservar datos y Python del sistema; no leer .env; no cambiar navegador predeterminado; mantener actualización/desinstalación de electron-builder y sus guardas.
- Contratos afectados: scripts de preparación, recursos NSIS, electron-builder, comprobación afterPack y comando de smoke; sin IPC ni tablas nuevos.
- Riesgo y HITL: fallo de descarga o promoción debe conservar el runtime previo. La ejecución/instalación y firma para distribución requieren el flujo humano de release.
- Criterios verificables: SHA256 incorrecto no se ejecuta; caché requiere versión/fuente/dependencias e imports válidos; se verifican ambos sidecars; exe generado con hash, sin .env, publicación ni inicio de la app; textos accesibles nativos y arte propio.
- Incertidumbres: validar visualmente DPI/lector de pantalla del asistente en un Windows interactivo; firma/reputación SmartScreen; funcionamiento de cuentas y equipos reales permanece en 9.5.

Referencia visual observada: bienvenida Comet y progreso Chrome publicados por Tom's Guide y BleepingComputer. Orientación adoptada: protagonismo de marca, jerarquía corta y estado de progreso real, sin copiar sus imágenes. No se atribuye vigencia exacta al diseño de capturas históricas.
