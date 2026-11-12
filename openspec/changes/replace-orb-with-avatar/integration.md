# Integración del personaje en SofLIA Hub

## Alcance autorizado

El personaje aprobado sustituye el retrato femenino en los chats general, lateral
del navegador y de proyectos, además de la orbe. El inicio nativo del navegador
lo presenta como centro visual. El compositor y buscador reaccionan localmente
al borrador sin enviarlo, persistirlo ni conceder permisos.

## Contratos y criterios

- RF-AVATAR-01: bienvenida alegre breve, espera y reposo tras 20 segundos sin uso; una tarea activa, permiso o voz en reproducción inhiben el reposo.
- RF-AVATAR-02: permiso real → advertencia; error o tarea incompleta → preocupación; éxito sólo ante resultados estructurados concluyentes; confirmación conversacional → asentimiento.
- RF-AVATAR-03: ejecución de herramientas y espera prolongada → concentración; generación de respuesta → rostro de respuesta. Sorpresa, curiosidad y duda reflejan señales explícitas del borrador/respuesta, sin inferir resultados.
- RF-AVATAR-04: un personaje animado principal por chat, con marcas estáticas en el historial para conservar rendimiento. Chat general, navegador y proyectos reutilizan el mismo proveedor visual.
- RF-AVATAR-05: el inicio nativo reutiliza cuerpo, SVG, CSS y configuración del personaje. Su único script local se autoriza mediante hash CSP exacto; siguen bloqueados conexiones, objetos, iframes y scripts remotos. No hay nuevos canales IPC ni acceso Node desde la página.
- RF-AVATAR-06: cancelaciones, cambios de conversación y respuestas obsoletas no celebran éxito ni alteran otro ámbito. Todos los temporizadores/listeners se liberan.

## Entrega

Se conserva el trabajo ajeno del workspace. El commit y push se realizan desde
`codex/soflia-avatar-2d`, con los cambios de este personaje, pruebas, especificación
y evidencia. No se publica un instalador ni se despliega producción.
