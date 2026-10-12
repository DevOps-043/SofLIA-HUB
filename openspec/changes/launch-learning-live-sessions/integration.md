# Integración de sesiones de Learning

Decisión confirmada: Learning administra las sesiones y Soflia Hub de escritorio ejecuta el acceso a Zoom. No hay un Hub web equivalente. Este documento permite transferir y desplegar el cambio sin copiar secretos ni depender del aula retirada de Learning.

## Responsabilidades

Learning conserva cursos, asignaciones, permisos, instructores Zoom, creación de reuniones/webinars, cancelación/cierre y webhooks. Sus tarjetas y ficha abren el escritorio. Hub recibe la referencia, conserva el acceso durante login y consulta el backend de Learning desde main.

Sesiones e instructores son funciones permanentes de Learning, sin variable de activación. El catálogo, el formulario y los endpoints dependen de permisos académicos y configuración del proveedor.

La primera entrega utiliza la experiencia Zoom del navegador integrado. Chat Soflia, quizzes, materiales, RTMS, Events y Rooms físicos requieren alcance propio posterior. Abrir una URL no acredita admisión ni asistencia certificada.

## Referencia pública

```text
soflia://learning-session?organization_slug=<slug>&session_id=<uuid>
```

El slug acepta letras minúsculas, números y guiones, hasta 100 caracteres. La sesión es UUID. El parser rechaza rutas, fragmentos, credenciales, parámetros adicionales y duplicados. No se envía destino, rol, token, contraseña ni URL Zoom.

El receptor atiende arranque frío, segunda instancia y open-url. Main enfoca la ventana principal; el renderer recibe la referencia. Si no hay usuario, se reutiliza el SSO Learning existente cuando está disponible. La referencia se conserva durante autenticación dentro del proceso. Las peticiones pendientes se leen sin consumir y se confirman después de procesar la apertura.

## Acceso privado

```http
POST /api/auth/live/access
Authorization: Bearer <access token SOFIA>
Content-Type: application/json

{"organization_slug":"acme","session_id":"<uuid>"}
```

Learning verifica el token mediante Supabase Auth. Cuenta no bloqueada, organización activa, membresía activa y asignación de curso no cancelada son requisitos. No se confía en IDs o roles del body. El instructor responsable con vínculo activo y correo Zoom verificado obtiene el start_url reciente. El administrador supervisor recibe acceso de participante.

```json
{
  "session": {
    "id": "<uuid>",
    "title": "Clase",
    "session_type": "meeting",
    "starts_at": "<ISO 8601>",
    "status": "live"
  },
  "role": "participant",
  "join_url": "<URL Zoom autorizada>"
}
```

El tipo es meeting o webinar. La respuesta usa Cache-Control no-store y Referrer-Policy no-referrer. Sesiones cerradas y sin recurso disponible no abren Zoom. Learning limita por IP con una política académica específica y por usuario verificado; comparte el token OAuth REST entre solicitudes simultáneas.

Main construye el endpoint desde VITE_LEARNING_BASE_URL, sin redirects. Acepta HTTPS o localhost HTTP para desarrollo, sin path adicional, credenciales ni query. El destino Zoom debe ser HTTPS, zoom.us/zoom.com o subdominio, sin credenciales ni puerto distinto de 443. Main comprueba el mismo usuario después de la respuesta y antes de abrir.

Los errores externos no se exponen íntegros. Los HTTP 4xx, incluido 401, se presentan como denegación; 5xx/red/timeout como indisponibilidad. La espera hasta 30 segundos se reserva a identidad todavía ausente en main. El usuario puede reabrir desde Learning tras un fallo.

## IPC y navegación

Los canales son learning-live:open, app:get-pending-learning-session y app:learning-session. El wrapper tipado y preload exponen operaciones cerradas. Solo main procesa credenciales y destino; el resultado al renderer es éxito/título o error controlado.

La apertura utiliza createTab con sensitive y waitForLoad desactivado. La UI muestra el origen, sin query privada. Historial, pestañas cerradas, restauración y sync excluyen el acceso. Copias y popups heredan la sensibilidad. Se impide lectura de documentos y herramientas del agente sobre estas pestañas; errores y eventos omiten la URL privada.

La reunión conserva los pasos de admisión y permisos que Zoom solicite. Una join_url genérica copiada puede seguir funcionando fuera de Learning. Si se requiere revocación individual externa, se deben agregar controles Zoom específicos.

## Configuración y publicación

1. Aplicar en staging la migración Learning 20261010173000_live_hub_desktop.sql. Agrega session_type y zoom_webinar_id, conserva reuniones e historia, excluye asignaciones canceladas y retira la publicación Realtime del aula antigua.
2. Desplegar Learning con el endpoint y catálogo compatibles. Mantiene sus credenciales REST y webhook Zoom, sin trasladarlas a Hub.
3. Configurar VITE_LEARNING_BASE_URL en el build Hub. Verificar identidad SOFIA compartida y SSO existente mediante VITE_LEARNING_SSO_ENABLED. No agregar service-role ni secretos Zoom al renderer.
4. Publicar un build de escritorio con protocolo soflia registrado. Comprobar scopes/licencia Zoom para reuniones, webinars y lectura de usuario.
5. Ejecutar piloto con docente y alumnos de dos organizaciones: arranque frío/caliente, login, cuenta cambiada, revocación, reunión/webinar, audio, cámara, compartir pantalla, chat, cierre y reapertura.

No se aplicó SQL remoto ni se publicó un instalador. Compartir pantalla y compatibilidad de Zoom web dentro de Electron requieren prueba real; se debe comprobar que la configuración de Zoom permita el cliente web y que no obligue a usar un cliente externo.

Rollback: volver a una versión compatible y validada, conservando migración aditiva e historia. No restaurar automáticamente el aula retirada.

## Evidencia y documentación

[Reporte de verificación](reports/verification.md). Los planes Word v2 están en el repositorio Learning, docs/plans/zoom. La fuente canónica Learning es docs/architecture/learning-hub-synchronous-plan.md; esta copia mantiene el contrato operativo en Hub.
