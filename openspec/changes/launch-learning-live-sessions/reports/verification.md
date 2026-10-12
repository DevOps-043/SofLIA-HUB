# Verificación del acceso a sesiones de Learning

Estado: reporte histórico del cambio local verificado el 10 de octubre de 2026. No acredita despliegue ni reunión Zoom real. El contrato operativo está en [integration.md](../integration.md).

## Resultado Hub

`npm run verify:pr` terminó con código 0. Incluyó adapters, harness, supply chain, documentación, seeds, OpenSpec, typecheck, lint incremental y suite automatizada.

- OpenSpec: 40 elementos válidos.
- Typecheck de renderer y main: aprobado.
- Lint incremental: 23 archivos sin deuda nueva.
- Suite: 348 archivos aprobados y uno omitido; 3712 pruebas aprobadas y una omitida.
- Inventario derivado: 514 archivos de prueba, 358 de main y 155 de renderer; 444 canales IPC.

La suite conserva avisos de Vite configLoader, localStorage de Node y terminación de un worker de IntegratedBrowserPanel. Terminó correctamente; no se alteró configuración ni baseline para ocultarlos.

Se probaron validación estricta del protocolo, referencias en arranque, error de proveedor, permisos, identidad cambiada, destino no Zoom, IPC allowlisted y deduplicación. El renderer tiene regresiones para StrictMode, continuidad de login, cierre de cuenta y espera de identidad main. La prueba del servicio nativo comprueba que URL privada, ZAK, popup, historial, estado, errores y snapshot no difundan ni persistan la URL sensible y que no se pueda leer su documento.

Tras cerrar la documentación se ejecutaron de nuevo `npm run docs:check`, `npm run docs:system:check` y `npm run openspec:validate`: enlaces válidos en 373 archivos Markdown, catálogo de sistema válido y 40 elementos OpenSpec aprobados; todos con código 0.

## Resultado Learning

Comando desde la raíz Learning:

```text
npm test --workspace=apps/web -- src/features/live/__tests__ src/app/api/auth/live/access/__tests__/route.test.ts src/lib/security/__tests__/content-security-policy.test.ts src/proxy/__tests__/live-access-rate-limit.test.ts src/proxy/__tests__/api-route-auth.test.ts
```

Resultado: 10 archivos y 53 pruebas aprobadas. Incluye la migración PostgreSQL embebida con PGlite, catálogo/RLS de asignaciones canceladas, autorización de anfitrión/participante, meetings/webinars, endpoint bearer, webhook, CSP retirada y separación de los límites académicos respecto de login. La regresión OAuth comprueba que 20 solicitudes REST simultáneas compartan una sola petición de token.

Lint focalizado aprobado con ESLint sobre features/live, endpoint nuevo, rutas Live, proxy, middleware, CSP y límite de body. Se reemplazaron selectores comodín por campos administrativos explícitos.

`npm run type-check:app --workspace=apps/web` conserva 302 diagnósticos fuera del dominio Live y endpoint nuevo. `npm run type-check:features --workspace=apps/web` conserva siete diagnósticos en componentes ajenos a Live; no se registra una compilación global verde de Learning. Ejemplos: CompanyEditCard, CompanyEditInputField, UsersSection y componentes visuales con props incompatibles. No se amplió este refactor para corregir módulos ajenos.

## Actualización: panel de instructor y disponibilidad permanente

Se corrigió la navegación del perfil: administradores y miembros con vínculo docente acceden a `/{orgSlug}/instructor`. La API de capacidades usa la identidad web verificada y conserva el control de membresía; las operaciones vuelven a comprobar autorización.

Se retiró la variable de activación del código de Learning. El catálogo, el panel, la navegación y los endpoints están disponibles de forma permanente según los permisos académicos. No se editaron archivos de entorno. Las regresiones comprueban que la antigua variable ausente o con valor `false` no impida renderizar el catálogo, programar sesiones ni resolver acceso autorizado.

Comando actualizado desde Learning:

```text
npm test --workspace=apps/web -- src/core/components/UserDropdown/__tests__/PanelSwitcher.test.tsx src/app/api/[orgSlug]/live/capabilities/__tests__/route.test.ts src/features/live/__tests__ src/app/api/auth/live/access/__tests__/route.test.ts src/lib/security/__tests__/content-security-policy.test.ts src/proxy/__tests__/live-access-rate-limit.test.ts src/proxy/__tests__/api-route-auth.test.ts
```

Resultado: 13 archivos y 73 pruebas aprobadas. Lint aprobado sobre el menú de perfil, features/live, capacidades y navegación del panel de empresa. La comprobación de tipos de features mantiene siete errores previos fuera de Live. Los dos Word se actualizaron, se exportaron mediante Word y se inspeccionaron nuevamente sus 12 páginas; la auditoría de accesibilidad no encontró incidencias. La suite completa de Hub indicada arriba corresponde a la verificación histórica, no a una nueva ejecución por este ajuste de Learning.

## Revisión independiente

La revisión adversarial de solo lectura cerró sus hallazgos sin acciones restantes. Se corrigieron: asignación cancelada todavía autorizada, límite de login compartido por aulas tras NAT, pérdida de referencia bajo StrictMode, espera insuficiente de identidad main y difusión/persistencia de URL privada en superficies del navegador.

Se mantuvo explícito el límite de join_url genérica: no garantiza revocación individual fuera de Learning. La revisión no prueba multimedia ni despliegue.

## Documentos Word

Learning entrega Plan_tecnico_Learning_Hub_v2.docx de 8 páginas y Propuesta_directiva_Learning_Hub_v2.docx de 4 páginas, bajo docs/plans/zoom. Se exportaron mediante Word a PDF interno y se inspeccionaron las imágenes de las 12 páginas. La auditoría de accesibilidad no encontró incidencias. Las versiones anteriores se conservan como antecedentes.

## Estado y validación restante

Los cambios quedan locales en ambos repositorios. No se ejecutaron migraciones remotas, publicaciones, instaladores ni reuniones externas. No se editaron .env ni secretos. Las pruebas usan dobles y una base embebida aislada; no requieren restaurar estado remoto.

Antes de producción se debe aplicar la migración Learning, configurar el origen y la identidad compartida, verificar scopes/licencia y distribuir un Hub compatible. El piloto debe probar audio, cámara, compartir pantalla, chat, admisión, instructor y alumnos de dos organizaciones, login frío/caliente y revocación desde Learning. Un aula educativa propia de Hub y revocación de URLs Zoom individuales siguen siendo ampliaciones explícitas.
