## Context

Las superficies existentes consumen `public/assets/Icono.png` y `icono.ico`.
El logo suministrado es vertical y transparente; el ICO es rectangular.

## Decisions

- Usar el PNG original, recortando solo el margen transparente, y centrarlo sin
  deformación en iconos cuadrados para distribución. Ajustar el inicio del navegador
  para que la nueva altura no invada el buscador.
- Cambiar la marca visible a Soflia Hub y el prefijo de artefactos a Soflia-Hub.
- Mantener el `appId`, repositorio remoto, identificadores persistidos, cabecera
  SSO y contexto autenticado del cifrado. Los archivos históricos no se reescriben.
- Fijar userData y sessionData antes de setName. Producción conserva el perfil
  anterior; desarrollo conserva el perfil detectado antes del cambio de nombre.
- El shell reconoce los ejecutables anterior y nuevo y rechaza instalar con
  cualquiera de los dos procesos activos. Reutiliza el destino estándar anterior.
- Preparar en worktree aislado con una copia del estado local previo. Incorporar
  únicamente diferencias de marca al checkout del usuario, comprobando que los
  archivos no cambiaron desde la captura. Preservar íntegro Live Studio.

## Risks

No se ejecuta instalación ni actualización real en este equipo. La compatibilidad
del instalador completo y los paquetes macOS/Linux requieren smoke en el entorno
de release. Los links externos a artefactos históricos no cambian de destino.

## Rollback

Restaurar assets y textos por Git; no hay migración, borrado ni cambio de identidad
del perfil. Mantener la carpeta del worktree y la evidencia mientras sea necesaria.
