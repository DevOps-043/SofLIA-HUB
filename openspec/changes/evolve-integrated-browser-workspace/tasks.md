## 1. Stores y contratos de seguridad

- [x] 1.1 Implementar tipos compartidos y validación para historial, credenciales y extensiones.
- [x] 1.2 Implementar `BrowserHistoryStore` acotado, saneado y recuperable con pruebas.
- [x] 1.3 Implementar `BrowserCredentialVault` cifrado, metadata-only y autofill por origen con pruebas negativas.
- [x] 1.4 Implementar `BrowserExtensionManager` con validación, HITL, root administrado, carga y remoción segura.

## 2. Integración Electron e IPC

- [x] 2.1 Integrar stores/managers al ciclo de vida de `IntegratedBrowserService` sin exponerlos al agente.
- [x] 2.2 Ampliar handlers con autenticación, sender, límites y errores controlados por operación.
- [x] 2.3 Añadir grupo de canales, API preload y wrapper/tipos renderer para los tres dominios.
- [x] 2.4 Ampliar mocks y pruebas de handler, allowlist, preload y wrapper.

## 3. Workspace lateral

- [x] 3.1 Separar apertura del navegador de `ActiveView` y conservar el chat activo como instancia única.
- [x] 3.2 Implementar workspace con chat izquierdo, navegador derecho, cierre y restauración de Sidebar.
- [x] 3.3 Implementar splitter accesible, ancho persistente, límites responsivos y expansión completa.
- [x] 3.4 Mantener apertura solicitada por agente y publicación correcta de bounds durante resize.

## 4. Experiencia de administración

- [x] 4.1 Añadir drawer de historial con búsqueda, reapertura, estados y borrado explícito.
- [x] 4.2 Añadir bóveda de contraseñas con guardado, metadata, selección, fill explícito y eliminación.
- [x] 4.3 Añadir gestor de extensiones con selección nativa, permisos visibles, habilitar/deshabilitar y remover.
- [x] 4.4 Cubrir panel, split y gestores con pruebas renderer de éxito, vacío, error y cancelación.

## 5. Documentación y verificación

- [x] 5.1 Actualizar arquitectura Electron/IPC, seguridad, parámetros, UX, requisitos, historias y trazabilidad.
- [x] 5.2 Ejecutar pruebas dirigidas, typecheck, lint cambiado, arnés, documentación, OpenSpec y build.
- [x] 5.3 Ejecutar `verify:pr`, registrar excepciones ambientales reales y smoke manual cuando sea posible.
- [x] 5.4 Ejecutar revisión adversarial de secretos, extensiones, paths, permisos, concurrencia, resize y cleanup; corregir hallazgos.
