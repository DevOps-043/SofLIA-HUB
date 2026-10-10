# Diseño

## DEC LLS 01 Distribución

Learning conserva catálogo, asignación académica, programación/cancelación y webhook Zoom. Hub ejecuta navegación multimedia. Se retiran SDK y chat Live de Learning; los cursos asíncronos no cambian.

## DEC LLS 02 Identidad y frontera

El deep link contiene únicamente slug y UUID. No autentica ni decide el rol. Main consulta `POST /api/auth/live/access` en el origen configurado por `VITE_LEARNING_BASE_URL`. Learning valida el bearer SOFIA en Supabase y vuelve a comprobar usuario, organización, curso e instructor. Solo el instructor responsable recibe la URL de inicio del anfitrión. Los demás reciben acceso de participante.

Main rechaza destinos de acceso que no sean HTTPS y dominios Zoom. No se acepta URL Learning ni Zoom en el deep link. No se registran tokens o URLs de acceso. El canal entrega al renderer estado de apertura, no credenciales.

## DEC LLS 03 Navegación

El navegador integrado muestra la experiencia Zoom existente. Los permisos multimedia y los pasos de ingreso que Zoom requiera permanecen visibles. No se reutiliza `meeting-trigger`, que inicia monitoreo y no autoriza asistencia. El usuario puede volver a la tarjeta y reabrir una sesión si falla el acceso.

## LIM LLS 01 Alcance multimedia

La apertura autenticada no prueba automáticamente que el participante ya fue admitido por Zoom. La validación de cámara, audio, pantalla y la configuración de ingreso web requiere staging con una cuenta real. El chat pedagógico adicional, quizzes y materiales dentro de Hub son una entrega posterior; no permanecen activos en Learning.
