# Contexto: evolución del gestor con Proton Pass como referencia

- Objetivo: continuar las 21 tareas abiertas, priorizando confidencialidad,
  recuperación y experiencia de credenciales (4.8, 4.10 y 8.7).
- Usuario o actor: titular del perfil local; páginas y agentes no tienen acceso
  general a la bóveda ni deciden sobre su persistencia.
- Alcance inmediato: cifrar metadata además del secreto, migrar v1 a un formato
  autenticado v2 con respaldo cifrado, rechazar corrupción/versiones futuras,
  serializar lecturas y escrituras y verificar con Electron real aislado. La
  continuación incorpora oferta contextual opt-in con puente privado y
  confirmación nativa; la tarea 7.1 añade el esquema local de sync no secreto.
- No objetivos de este bloque: clonar Proton, copiar su código, afirmar E2EE
  por usar DPAPI, sincronizar contraseñas, implementar recuperación por correo,
  compartir bóvedas, instalar extensiones ni ejecutar migraciones remotas.
- Restricciones: conservar IDs y fechas, origen estricto, APIs sin secretos,
  archivos temporales privados, contexto capturado antes de E/S y errores sin PII.
- Contratos afectados: persistencia local de `BrowserCredentialVault`, pruebas,
  diagnóstico del gestor, documentación y escenarios OpenSpec.
- Riesgo y HITL: pérdida de acceso si cambia la cuenta del SO; respaldo antes de
  reemplazar, rechazo cerrado sin almacenamiento seguro. Exportar, sobrescribir
  credenciales o recuperar un respaldo siguen requiriendo consentimiento.
- Criterios verificables: ausencia de usuario/origen/secreto en principal y
  respaldo; autenticación de datos y ámbito; actualización/concurrencia sin
  pérdida; fallo de escritura conserva original; formato futuro no se reescribe;
  lectura pendiente pertenece al perfil original y participa en `flush()`.
- Incertidumbres: Windows Hello requiere integración nativa ligada a la ventana;
  ni DPAPI ni un diálogo de confirmación demuestran presencia del titular.

## Comparación basada en fuentes oficiales

| Área | Proton Pass | Pulse Hub antes de esta fase | Dirección de mejora |
|---|---|---|---|
| Cifrado | Protege también usuario, URL y notas; claves de bóveda y elemento, AES-256-GCM, operaciones locales antes del servidor. | v1 deja origen, usuario, ID y fechas en JSON; sólo el secreto usa `safeStorage`. | Cifrar la instantánea completa y autenticarla. La primera versión local no reproduce la jerarquía compartible de Proton. |
| Guardado | La extensión sugiere credenciales y pide añadirlas después del registro/login. | Guardado manual con revisión de origen y reemplazo confirmado. | Oferta contextual tras gesto real, sin registrar valores en eventos/logs, y sin asumir que todo submit fue autenticación exitosa. |
| Desbloqueo | PIN y autobloqueo; opción de contraseña adicional y biometría. | Cifrado del SO sin autenticación de presencia. | Bloqueo local y autenticación real; cancelar o proveedor no disponible no conceden acceso. |
| Organización | Bóvedas que agrupan elementos y distintos tipos de registro. | Credenciales del origen activo; generador, salud e importación/exportación JSON. | Evolución posterior de búsqueda/bóvedas y recuperación sin ampliar las herramientas del agente. |

Fuentes consultadas el 2026-09-06:

- [Modelo de seguridad de Proton Pass](https://proton.me/blog/proton-pass-security-model).
- [Autoguardado y sugerencias](https://proton.me/support/proton-pass-autosave).
- [Bóvedas](https://proton.me/support/pass-vault).
- [PIN y autobloqueo](https://proton.me/support/proton-pass-pin),
  [contraseña adicional](https://proton.me/support/pass-extra-password),
  [desbloqueo biométrico](https://proton.me/support/biometric-unlock-desktop).
- [Límites de safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage):
  DPAPI protege frente a otros usuarios del SO, no frente a otro proceso que
  ya corre como el mismo usuario. Se rechaza `basic_text` en Linux.
- [Verificación nativa ligada a HWND](https://learn.microsoft.com/en-us/windows/win32/api/userconsentverifierinterop/nf-userconsentverifierinterop-iuserconsentverifierinterop-requestverificationforwindowasync):
  Microsoft exige la API interoperable de escritorio para vincular la solicitud
  a la ventana. Su disponibilidad y el resultado deben verificarse realmente.

Las prioridades de implementación son una decisión del proyecto, no una
afirmación de que Proton utiliza los mismos módulos, límites o migraciones.
