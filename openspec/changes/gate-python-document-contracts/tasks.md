## 1. Contratos de verificación

- [x] 1.1 Añadir regresiones del wrapper: selección, aislamiento, aridad, intérprete ausente/incompatible, fallo y timeout sin verde falso.
- [x] 1.2 Añadir contratos de wiring gate/CI/release y matriz con locks/permisos, sin confundir inspección con ejecución remota.

## 2. Implementación

- [x] 2.1 Implementar comando standalone y etapa Python obligatoria en verify:pr; probar stdlib y formatos con intérprete temporal real.
- [x] 2.2 Configurar Python fijado y matriz reutilizable de formatos para cuatro targets, bloqueando builds de release si falla.
  Preparación temporal standalone con SHA256 para el patch 3.12.11 también en macOS/Windows; compartir descarga y corregir wiring del candidato Intel.

## 3. Evidencia y mantenimiento

- [x] 3.1 Actualizar documentación canónica y plan, conservando pendiente Intel; autorrevisión adversarial y rollback.
- [x] 3.2 Ejecutar pruebas dirigidas, tipos/lint, gate completo y build aislado con fuentes estables; registrar evidencia y revisión independiente pendiente.
