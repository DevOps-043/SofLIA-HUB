## Implementación
- [x] 1. Contrato versionado, modelo de dominio y pruebas de permisos, salas, duplicados y límites.
- [x] 2. Preparar backend Learning transaccional, migración con RLS, importación de manifiesto Engine y autorización Zoom SDK.
- [x] 3. IPC completo para comandos, Realtime y credenciales efímeras SDK.
- [x] 4. Conectar panel instructor y participante con chat, actividades, escenas y reloj remotos.
- [x] 5. Implementar dispositivos reales, captura y runtime SDK embebido con limpieza y fallos visibles; comprobar carga nativa aislada.
- [ ] 6. Cerrar verificación completa de Learning y ensayo integrado Supabase/Zoom. Las pruebas dirigidas pasan; sus typechecks generales fallan en archivos ajenos al cambio. Documentación y revisión adversarial realizadas.

## Selector propio de pantalla
- [x] 12. Sustituir el cuadro nativo por una vista React con miniaturas reales, categorías, búsqueda y confirmación.
- [x] 13. Implementar servicio de inventario, autorización de handlers, preload exclusivo y wrapper tipado; cubrir cancelación, fuentes desaparecidas y cambios de documento/perfil.
- [x] 14. Cerrar smoke nativo de pantalla/ventana/pestaña, revisión visual claro/oscuro y evidencia de la compuerta.

## Escenas locales y fuentes ligadas
- [x] 15. Separar creación, selección y eliminación de escenas de producción de comandos académicos Learning.
- [x] 16. Vincular fuentes reales con modo Vincular del selector propio, cuatro capas IPC, actor, límites y limpieza.
- [x] 17. Reutilizar la fuente en vista local y solicitudes del SDK, detener pistas desde el dock y conservar vínculo al pausar.
- [x] 18. Cerrar pruebas dirigidas, smoke nativo, QA visual y compuerta; documentar límite público del SDK.

## Validación y continuación pendientes

- [x] 19. Retirar textos audiovisuales del proveedor y badge Realtime de la UI
  propia de Hub; conservar ingreso explícito y traducir diagnósticos de Learning.
- [x] 20. Documentar el aviso SDK, la diferencia con el backend local anterior y
  la gestión de preferencias de repetición exclusivamente en Learning.
- [ ] 7. Con autorización de despliegue, aplicar migración en staging, configurar Meeting SDK/ZAK de DevOps y publicar Learning compatible.
- [ ] 8. Ensayar ingreso real de instructor/alumno y reconexión Realtime con dos cuentas asignadas.
- [ ] 9. Integrar publicación automática del contenido síncrono desde Engine; actualmente se importa un manifiesto JSON validado.
- [ ] 10. Correlacionar y trasladar las salas audiovisuales Zoom desde el panel; actualmente las salas académicas controlan chat y actividades.
- [ ] 11. Componer láminas, overlays y cámara sobre una transmisión continua. Las fuentes de pantalla ya están ligadas a escenas locales y Zoom reutiliza la activa al iniciar Compartir.

Evidencia local, alcance y excepciones: [evidence.md](evidence.md). No archivar hasta completar las barreras de validación.
El selector propio queda verificado localmente: [reporte del selector](reports/display-media-picker.md).
Escenas locales y fuentes ligadas verificadas: [reporte de escenas](reports/studio-local-scenes.md).
Presentación y diagnóstico SDK: [reporte del panel](reports/2026-10-14-studio-presentation.md).
