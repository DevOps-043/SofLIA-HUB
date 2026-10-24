## 1. Preparación

- [x] 1.1 Registrar línea base del servicio, store de sesión y lifecycle antes de modificar código.

## 2. Implementación

- [x] 2.1 Crear el checkpoint de sesión con un único dueño de temporizador, escrituras y estado de cierre; probar debounce, errores, reintentos y cancelación.
- [x] 2.2 Integrarlo en el coordinador sin cambiar su API ni las pruebas existentes de recuperación/perfiles.
- [x] 2.3 Usar el módulo con el store real en el smoke nativo temporal de lifecycle.

## 3. Verificación y documentación

- [x] 3.1 Ejecutar pruebas dirigidas, typecheck y smoke nativo; resolver regresiones.
- [x] 3.2 Actualizar arquitectura, inventario y plan de deuda con alcance y límites reales.
- [x] 3.3 Ejecutar verify:pr y revisión adversarial; guardar evidencia sin atribuir un nuevo porcentaje global de deuda.
