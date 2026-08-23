# Revisión adversarial

Fecha: 2026-08-18.

## Alcance revisado

Se contrastaron propuesta, diseño, spec, tareas, diff y evidencia. La revisión
buscó contaminación entre pestañas y conversaciones, permisos excesivos,
resultados parciales presentados como éxito, contenido inventado y contratos IPC
incompletos.

## Hallazgos corregidos

1. Una solicitud documental podía adjuntar a la vez el DOM de una página
   diferente. Se hizo mutuamente exclusiva la observación genérica cuando el
   turno depende del documento activo y se añadió una regresión negativa.
2. `read_active_document` devolvía un `nextOffset` terminal aunque `hasMore`
   fuera falso. El contrato ahora devuelve `null` al terminar.
3. OpenAI podía agotar diez iteraciones después de emitir texto intermedio y no
   anexar el fallo verificable. Ahora siempre cierra con el aviso honesto y la
   prueba fuerza las diez iteraciones.

## Guardas confirmadas

- El canal nuevo es de solo lectura, está en la allowlist y el handler conserva
  la validación del emisor principal.
- Main comprueba pestaña, `WebContents` y URL antes y después de extraer; un
  cambio concurrente descarta el texto.
- Google Docs usa las rutas semánticas autenticadas existentes y no el DOM de
  controles del editor.
- El contenido se marca como no confiable y no concede autorización para
  navegar, escribir, enviar o borrar.
- La memoria reciente se separa por conversación; memoria e historial quedan
  explícitamente subordinados al bloque documental vivo.

## Riesgo residual

La continuidad implícita se limita a solicitudes de resumen dentro de los cuatro
mensajes recientes y requiere que un turno de usuario anterior haya nombrado el
documento. Es una restricción intencional para no leer una pestaña privada ante
una petición general sin contexto. No quedan hallazgos altos o medios abiertos
dentro del alcance.
