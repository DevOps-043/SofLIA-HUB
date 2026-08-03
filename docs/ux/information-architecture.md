# Arquitectura de informacion

Estado: vigente. Actualizado: 2026-07-21.

<!-- evidence: src/app/app-types.ts -->
<!-- evidence: src/app/AppSidebar.tsx -->
<!-- evidence: src/components/unified-settings/settings-tabs.tsx -->

## Espacios principales

La aplicacion no usa rutas URL internas para cada pantalla. El shell mantiene una
vista activa y la barra lateral organiza el acceso:

```text
Pulse Hub
|- Inicio/auth o ventana Orbe
`- Workspace autenticado
   |- Sidebar izquierda/derecha/inferior
   |  |- Nuevo chat y busqueda
   |  |- Chats fijados/no agrupados
   |  |- Carpetas / Project Hub
   |  |- Equipos -> proyectos -> issues IRIS
   |  |- Reuniones
   |  |- SDO
   |  `- Usuario, organizacion, tema, settings, salir
   `- Area de trabajo
      |- Chat
      |- Project Hub
      |- Productividad
      |- Reuniones
      `- Registro de decisiones SDO
```

Productividad existe como `ActiveView`, pero su acceso puede venir de settings o
acciones del shell; no debe asumirse que cada union tiene un boton superior fijo.

## Jerarquia de contenido

- Organizacion activa: scope superior de equipos, miembros, shares e IRIS.
- Equipo IRIS: agrupa proyectos.
- Proyecto/carpeta: agrupa chats y fuentes; carpeta Lia e IRIS project son
  conceptos relacionados por UI, no la misma tabla.
- Conversacion: contiene mensajes y puede tener fuentes/shares.
- Meeting run: contiene fuentes, assets, approvals y sync actions.
- Decision SDO: enlaza claims/evidencia/acciones/aprobaciones y vigencia.

## Settings

El modal unificado expone once tabs:

1. Personalizacion (`ai`)
2. Memoria
3. WhatsApp
4. Voz
5. Privacidad
6. Conexiones
7. Miembros (oculta sin organizacion)
8. Productividad
9. Flujos de Trabajo (`agents`)
10. Actualizacion
11. `meetings` existe en el tipo pero no aparece en `getSettingsTabs`; esta
    diferencia es una brecha de navegacion, no una tab visible.

## Ventanas y entradas alternativas

- Ventana principal: auth/workspace.
- Orbe: `view=orb` o `--view-mode=orb`, fondo transparente y APIs propias.
- Protocolo `soflia:`: abre shared link o meeting trigger.
- Tray/shortcut: puede mostrar/ocultar ventanas.
- WhatsApp/Telegram: superficies conversacionales sin renderer principal.

## Reglas de navegacion

- Una vista que requiere datos de usuario solo se renderiza con `userId`.
- `project` requiere `currentFolder`; si falta, no debe mostrar un proyecto vacio
  como si existiera.
- El sidebar puede cambiar de posicion, pero debe conservar jerarquia, acciones y
  seleccion.
- Notices de share/meeting/degradacion viven sobre el workspace y no sustituyen un
  estado de pantalla.
- El cierre de modal o cambio de vista no debe cancelar silenciosamente una
  operacion main; el status del servicio sigue siendo autoridad.
