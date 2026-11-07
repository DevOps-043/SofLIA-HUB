## Context

Los tres consumidores comparten el SDK de conversación. El loop ejecuta las
herramientas mediante los servicios y permisos de cada dominio.

## Decisions

Una capacidad IPC cerrada admite abrir, enviar y cerrar un turno autorizado por
ventana, documento, sesión Hub y sesión Lia. Main conserva el historial curado
por el SDK y crea el cliente por llamada. El commit de historial sólo ocurre
cuando siguen vigentes autoridad, turno, señal y plazo. Cerrar cancela la espera
y retira el historial, conservando la plaza física hasta que termine el SDK.

Main acepta sólo modelo Gemini, configuración de inferencia, catálogo declarativo,
texto, medios y respuestas de herramienta. Deriva la configuración de herramientas
servidor y fija el endpoint Gemini en el SDK. El renderer conserva decisión de despacho y autorización de efectos.
Los especialistas usan un turno de una llamada. Se mantienen SDK y claves web en
modo independiente y se rechazan puentes Electron incompletos.

## Risks / Trade-offs

Hasta cuatro turnos y cuatro llamadas físicas. Plazo nativo de 40 s por llamada,
cierre tras 20 min de inactividad, 64 intentos y presupuesto de historial. Un
turno especialmente largo puede alcanzar el presupuesto. Cada llamada resuelve
la clave bajo la misma autoridad, sin almacenar clientes por clave.

## Migration Plan

Actualizar las cuatro capas juntas. Revertir el contrato, sus consumidores y
registro desde el respaldo. No hay migración de datos.
