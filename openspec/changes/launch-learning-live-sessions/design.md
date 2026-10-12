# Diseño

## DEC LLS 01 Distribución

Learning conserva catálogo, asignación académica, programación/cancelación y webhook Zoom. Hub ejecuta navegación multimedia. Se retiran SDK y chat Live de Learning; los cursos asíncronos no cambian.

## DEC LLS 02 Identidad y frontera

El deep link contiene únicamente slug y UUID. No autentica ni decide el rol. Main consulta `POST /api/auth/live/access` en el origen configurado por `VITE_LEARNING_BASE_URL`. Learning valida el bearer SOFIA en Supabase y vuelve a comprobar usuario, organización, curso e instructor. Solo el instructor responsable recibe la URL de inicio del anfitrión. Los demás reciben acceso de participante.

Main rechaza destinos de acceso que no sean HTTPS y dominios Zoom. No se acepta URL Learning ni Zoom en el deep link. No se registran tokens o URLs de acceso. El canal entrega al renderer estado de apertura, no credenciales.

La pestaña sensible muestra solo el origen público, queda fuera del historial, restauración, sincronización y pestañas cerradas. La sensibilidad se propaga a duplicados y popups. Se bloquean lectura de documentos y herramientas del agente; los eventos y errores públicos omiten la URL privada. Esto evita persistir o difundir el ZAK de la URL del anfitrión.

La referencia pendiente se lee sin consumirla y main confirma su procesamiento. Las aperturas concurrentes de una misma sesión y cuenta comparten operación. El renderer espera hasta 30 segundos a que la identidad SOFIA llegue a main, con cancelación al desmontar o cambiar la cuenta; un 401 de Learning es denegación y no dispara ese reintento.

## DEC LLS 03 Navegación

El navegador integrado muestra la experiencia Zoom existente. Los permisos multimedia y los pasos de ingreso que Zoom requiera permanecen visibles. No se reutiliza `meeting-trigger`, que inicia monitoreo y no autoriza asistencia. El usuario puede volver a la tarjeta y reabrir una sesión si falla el acceso.

## LIM LLS 01 Alcance multimedia

La apertura autenticada no prueba automáticamente que el participante ya fue admitido por Zoom. La validación de cámara, audio, pantalla y la configuración de ingreso web requiere staging con una cuenta real. El chat pedagógico adicional, quizzes y materiales dentro de Hub son una entrega posterior; no permanecen activos en Learning.

## LIM LLS 02 Revocación de enlaces Zoom

Learning autoriza cada apertura. La join_url genérica de participante puede funcionar fuera de Learning si se copia, según los controles Zoom. Consultarla al entrar no la vuelve personal ni efímera. Si producto exige revocación externa, hay que implementar registro/autenticación Zoom e invalidación individual en una entrega específica.

El contrato completo, los campos, la configuración y la secuencia de publicación están en [integration.md](integration.md).
