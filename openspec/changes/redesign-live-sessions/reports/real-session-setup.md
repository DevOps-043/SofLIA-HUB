# Preparación de una sesión real

Fecha: 2026-10-11. Estado: DevOps permanece como cuenta Zoom maestra. Corrección publicada, vínculo de Fernando guardado y reunión real creada en Learning; pendiente comprobar visualmente el aula de escritorio con esa sesión.

El usuario solicitó una sesión real para revisar el panel, inició sesión en Learning y autorizó crear el curso de revisión con su cuenta como instructor y anfitrión Zoom.

Se creó en Learning el curso `Revisión del panel de sesiones`, ID `664950e4-abd8-4420-b935-5f8c8841e06a`, duración de 60 minutos, sin activar su publicación a estudiantes. El catálogo de instructor de la organización `soflia` confirmó el curso con la etiqueta `Mi curso` y permitió seleccionarlo en el formulario de programación. No se modificó la autoría de cursos existentes.

El intento de vincular la cuenta Zoom devolvió `Configura ZOOM_CLIENT_ID para activar Zoom`. La verificación de anfitrión se ejecuta antes del upsert; no se acreditó una vinculación exitosa. No se envió el formulario de programación y no existe una sesión ni una asignación de alumno creadas por esta operación. El título y la descripción quedaron preparados en la pestaña de Learning, marcada para continuar.

Con autorización explícita del usuario se creó y activó la aplicación privada Server-to-Server OAuth `SofLIA Learning` en su cuenta Zoom. El usuario aceptó los términos de Marketplace y la licencia de API, y confirmó la activación de los permisos `user:read:user:admin`, `meeting:write:meeting:admin`, `meeting:read:meeting:admin`, `meeting:delete:meeting:admin` y `meeting:update:status:admin`.

Se configuraron `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` y `ZOOM_ACCOUNT_ID` como secretos exclusivos de Production/Functions en el proyecto Netlify `soflia-learning`. Las credenciales se transfirieron por los formularios autorizados, sin imprimirlas ni guardarlas en archivos locales o `.env`. La primera publicación rechazó OAuth porque el campo oculto de Zoom devolvía un texto de ocultación en lugar del secreto real; se corrigió tras revelar el secreto mediante su control oficial. El despliegue corregido `6acb4bff5073343af5b462ca` quedó publicado y el siguiente intento avanzó de la autenticación OAuth a la consulta del anfitrión.

El perfil oficial de Zoom confirmó que la cuenta conectada pertenece a `devops@soflia.ai`, con licencia Basic, mientras que el usuario de Learning es `fernando.suarez@soflia.ai`. La consulta del anfitrión Fernando fue rechazada por Zoom; no se acreditó una vinculación ni se programó una reunión. El acceso de anfitrión actual en `hub-access.service.ts` también exige coincidencia entre ambos correos. No se sustituyó la identidad ni se relajó esa condición sin una decisión del usuario. Se pidió elegir entre usar la cuenta DevOps con una vinculación adaptada o iniciar Zoom con Fernando.

Evidencias de configuración: [Zoom activado](zoom-activated.jpg), [variables protegidas en Netlify](zoom-netlify-configured.jpg) y [diferencia de cuenta Zoom](zoom-account-mismatch.jpg). Sigue pendiente comprobar el aula integrada con una sesión real; la configuración por sí sola no acredita ese resultado.

Por solicitud posterior y explícita del usuario se añadieron las tres variables Zoom al `.env` raíz de Learning y a `apps/web/.env.local`. Se conservaron las demás entradas, se verificó la coincidencia de las tres variables sin imprimir sus valores y el cargador oficial `@next/env` confirmó que Next.js las carga desde `.env.local`. Ambos archivos están excluidos por `.gitignore`; el estado Git de Learning siguió limpio. Estas credenciales corresponden a la cuenta Zoom DevOps y no resuelven por sí solas la diferencia de identidad pendiente.

Evidencia: [curso propio y formulario pendiente](real-session-course.jpg). No se cambió código en esta operación; no se repitieron pruebas de código.

## Diagnóstico posterior de los errores

El usuario reportó el rechazo genérico de Zoom y `Revisa los datos enviados`. El formulario abierto se observó con Webinar seleccionado y fecha local `2026-10-11T11:12`, ya pasada al revisar a las 11:21. La programación exige fecha futura. La integración existente solo tiene permisos de reuniones y la cuenta Basic no habilita webinars. El error genérico de validación ocultaba el campo rechazado; los dos formularios compartían una alerta en la cabecera, que permanecía al cambiar el filtro.

En Learning se preparó la corrección local en `codex/fix-live-zoom-errors`: validación de programación antes del envío, mensajes propios por campo en cliente/servidor, errores junto a cada formulario y clasificación segura de errores Zoom por cuenta, permisos/licencia, autenticación y límite. No se modificó la coincidencia de identidad ni la reconciliación/idempotencia de programación. Pasaron 72 pruebas de Live y API Hub, ESLint de los archivos modificados y tipos del módulo Live. La comprobación general de tipos de features sigue mostrando errores fuera de Live en componentes Lia, PageShell, admin y landing. Esta corrección local todavía no está publicada.

El usuario eligió expresamente `fernando.suarez@soflia.ai` como anfitrión y completó el acceso Google. El perfil Zoom confirmó ese correo y licencia Basic. Marketplace solicitó nuevamente sus términos para esta cuenta; se pidió confirmación para los términos de Marketplace y licencia de API antes de aceptarlos. La app y las variables existentes siguen perteneciendo a DevOps hasta completar el cambio. Evidencia: [términos solicitados en la cuenta Fernando](zoom-fernando-marketplace-terms.jpg).

## Aclaración de la cuenta maestra

El usuario aclaró que DevOps debe seguir siendo la cuenta Zoom maestra y que cada instructor no debe crear una aplicación ni configurar claves. Se conserva la app DevOps activa y sus tres credenciales de Netlify y los archivos locales. La nueva app preparada en Fernando quedó sin activar; no se copiaron sus credenciales ni se sustituyeron las de DevOps.

La corrección local permite que un administrador vincule explícitamente a un miembro activo de su organización con un anfitrión activo de la cuenta Zoom maestra, aunque sus correos sean distintos. Se guarda el ID canónico del anfitrión. Al abrir una sesión como instructor se comprueba ese ID frente al anfitrión del recurso Zoom, el guardado en las credenciales privadas de la sesión y el vínculo vigente. Se comprueba además que el anfitrión esté activo y pertenezca a la cuenta maestra configurada. No se asigna el anfitrión automáticamente a todos los miembros o empresas.

Pasaron 84 pruebas de Live y API Hub, ESLint de todos los archivos modificados y la comprobación de tipos del módulo Live. Se conservan las limitaciones de la cuenta Basic: la integración de reuniones no habilita Zoom Webinars ni añade capacidad de sesiones simultáneas. La sesión de revisión se preparará como Reunión; todavía no se ha creado ni asignado una sesión real.

La corrección quedó en el [PR 22 de Learning](https://github.com/DevOps-043/SofLIA-Learning/pull/22), commit `61c6060d104bee8edf584f650fa9b9b15e4c9ae7`, integrado mediante `94d342b637e1a8b31007013f44dba6c05e56a4b5`. Netlify construyó correctamente el Deploy Preview. Gitleaks y la política de licencias pasaron. CI conserva fallos de tipos de módulos CSS fuera de Live y de auditoría de dependencias existentes; los manifiestos, lockfile y controles de CI no se modificaron. No se omitió una protección de rama al integrar el PR. El despliegue de producción `6acbd4df565b82000878b9f7` inició la construcción automáticamente.

## Sesión real creada con DevOps

Netlify confirmó `Published deploy` y todas las etapas completas para `6acbd4df565b82000878b9f7`. El formulario de producción mostró la nueva vinculación a la cuenta maestra. Se guardó `fernando.suarez@soflia.ai` en Learning con el anfitrión Zoom `devops@soflia.ai`; la interfaz confirmó `Permisos de instructor actualizados.` Se conservaron las tres credenciales DevOps en producción y local, y la app Fernando quedó sin activar.

Se programó una sola reunión real `Revisión del panel de sesiones síncronas`, ID `39196c76-711f-45b5-b6ea-f7b7db508f8d`, en el curso de revisión propio. Inicio: 2026-10-11 12:34, America/Mexico_City (18:34 UTC); duración: 30 minutos; tipo: Reunión. Learning confirmó `Sesión programada`, mostró una sesión en el catálogo de instructor y permitió abrir [su ficha real](https://soflia.ai/soflia/live/39196c76-711f-45b5-b6ea-f7b7db508f8d). La cuenta de Fernando es el instructor responsable; no se creó una inscripción de alumno ni se publicó el curso vacío.

La ficha ofrece `Abrir Soflia Hub` con referencia a la organización y la sesión, sin credenciales Zoom en el enlace. Se intentó abrir ese enlace; el navegador mantuvo la ficha y la herramienta no permitió verificar el resultado en la aplicación nativa. No se acredita todavía entrada a medios ni revisión visual del aula real. La ficha quedó abierta como resultado para el usuario.

Evidencias: [vínculo maestro guardado](zoom-master-linked.png), [confirmación de sesión creada](real-session-devops-created.png) y [ficha con acceso a Hub](real-session-devops-details.png).
