# Verificación de carga de sesión y datos

Fecha: 2026-10-24. Estado: implementación local verificada; sin empaquetar ni
desplegar. Rama de aislamiento: `codex/fix-login-loading`.

## Diagnóstico y alcance

Confirmado en código: la vista programaba la consulta de proyectos sin esperar
el `auth:set-state` asíncrono del proveedor. El rechazo genérico de las capturas
corresponde al catch del handler de proyectos. Su atribución a la carrera es una
inferencia sustentada por el orden de efectos, sin captura de tráfico de esa
sesión de producción.

Confirmado: la restauración Lia esperaba `syncLiaProfile`, y `accept` lo ejecutaba
de nuevo. Se retiró la escritura de la ruta crítica y se compartieron llamadas
simultáneas del mismo correo/token. El callback SOFIA también esperaba trabajo
que puede volver a Auth; ahora retorna sin esperar y programa el trabajo fuera
del callback. La restauración explícita cubre `INITIAL_SESSION` una sola vez.

La UI intenta recuperar conversaciones dos veces antes de mostrar el error.
Proyectos limita a tres sus reintentos transitorios, presenta carga mientras se
recupera y conserva los rechazos reales. Se evita repetir el error de chat en
sidebar y banda superior mientras el panel principal lo gestiona. Los colores
del panel usan los tokens de ambos temas.

## Resultados de la primera verificación

- Pruebas dirigidas: **7 archivos, 60 casos aprobados**. Comando: `npx vitest run
  src/__tests__/contexts/AuthContext.test.tsx
  src/__tests__/contexts/LiaSessionLoading.test.tsx
  src/__tests__/contexts/AuthLifecycleScheduling.test.tsx
  src/__tests__/components/UnifiedProjectsSection.test.tsx
  src/__tests__/components/ChatUnavailableState.test.tsx
  src/__tests__/services/auth-state-publication.test.ts
  src/__tests__/services/lia-session-exchange-core.test.ts`.
- Suite completa `npm run test`: **517 archivos aprobados, 2 omitidos; 5871 casos
  aprobados y 5 omitidos**, duración reportada 132,23 s.
- `npm run lint:changed`: **76 archivos revisados sin deuda nueva**. ESLint
  directo sobre los archivos propios también aprobado.
- `git diff --check`: aprobado.
- `npm run verify:pr`: pasa adaptadores, arnés, cadena de suministro, documentación
  de sistema, enlaces, semilla de skills, OpenSpec (98 elementos) y pruebas de
  calidad (4 casos); **se detiene en typecheck**.
- `npm run typecheck`: falla en `electron/gmail/raw-message.ts:19`, opción
  `newline` no admitida por `Options`. Se ejecutó también en el checkout original
  antes de integrar esta corrección y produjo exactamente el mismo error.
  En esa primera entrega no se modificó Gmail. Lint y suite completa se
  ejecutaron por separado porque la compuerta no llega a ellos.
- El inventario documental se sincronizó con
  `node scripts/quality/validate-system-docs.mjs --sync-inventory`: 693 archivos
  inventariados (incluye archivos que no forman parte de la ejecución Vitest).
- Integración en el checkout original: 21 archivos propios comprobados por hash
  contra el worktree, con verificación previa de que sus bases no cambiaron.
  Tras integrar se repitieron los 60 casos dirigidos, lint incremental, arnés,
  enlaces, documentación de sistema y comprobación de whitespace: aprobados.
  El botón de actualizar proyectos también se verificó de nuevo con sus 15 casos.

## Continuación: compuerta desbloqueada

Tras la solicitud de continuar se corrigió el tipado local de `MailComposer`:
`ConstructorParameters` conserva todas sus opciones tipadas y añade únicamente
el literal CRLF que el código instalado propaga a `MimeNode`. No se eliminó la
normalización ni se utilizaron `any`, casts o supresiones de TypeScript.

La regresión MIME existente comprueba ahora la separación CRLF de cabeceras y
la ausencia de saltos sueltos, además de Unicode, BCC y adjuntos. Resultado:
**64 casos aprobados en 3 archivos Gmail**, sin enviar correo real.

`npm run typecheck`: **aprobado**. `npm run verify:pr`: **aprobado de principio a
fin**, incluidos lint incremental y suite completa: **517 archivos aprobados,
2 omitidos; 5871 casos aprobados, 5 omitidos**, duración Vitest 125,50 s.
El bloqueo descrito en la primera verificación queda resuelto. Se integraron
los dos archivos Gmail en el checkout original tras comprobar que no contenían
cambios locales y se verificó su identidad por hash.

Revisión local adicional: se mantiene la composición a partir de bytes,
`disableFileAccess`, `disableUrlAccess`, límite de tamaño y comprobación de
sesión antes/después. No se amplían capacidades ni se cambia el payload.
Sigue pendiente la comprobación del inicio de sesión real con la cuenta del
usuario y no se generó un instalador.

## Revisión adversarial de la carga inicial

Se intentó refutar: adelanto del IPC mientras SOFIA obtiene su token o main lo
valida; espera indefinida de publicación; logout retenido por una publicación
lenta; perfil que no responde o rechaza; canjes duplicados; callback de Auth que
retiene el SDK; restauración inicial duplicada; reintentos sin límite o
solapados; timer vivo tras desmontaje y respuesta tardía; ocultamiento de un
`IPC_DENIED` real. Los casos dirigidos cubren esas rutas. Las pruebas existentes
de AuthContext conservan el rechazo de sesiones y canjes con otro correo.

La revisión detectó que serializar publicaciones retrasaría logout; se cambió
por una espera conjunta que permite publicar la revocación inmediatamente.
También se deshabilitó la actualización manual de proyectos durante la carga
para evitar solicitudes duplicadas.

No se cambian main, preload, allowlists, RLS ni permisos. Un timeout de espera
devuelve `SOFIA_SESSION_PENDING` en renderer; nunca concede autorización. La
publicación no registra tokens ni persiste secretos nuevos.

## Límites y reversión

No se inició una sesión real ni se midió la latencia de un backend de producción.
La evidencia de rendimiento es estructural y determinista: una escritura de
perfil que no termina ya no bloquea el resultado de restauración. Las peticiones
enviadas antes de desmontar pueden terminar; la limpieza cancela futuros
intentos y actualizaciones locales del panel, sin prometer abortar el SDK.

El worktree recibió una copia de los cambios locales preexistentes de proyectos
para verificar el comportamiento actual. Sólo se integran los archivos propios
del arreglo; se conserva el trabajo ajeno. Para revertir, retirar únicamente el
diff de esta corrección, conservando la creación de proyectos y el tablero.
No hay migraciones, cambios de credenciales ni efectos externos que revertir.
