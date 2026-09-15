## Context

Ver [propuesta](proposal.md). El paquete actual NSIS contiene Electron y Python privado verificados. Sus metadatos alimentan electron-updater; reemplazar ese EXE rompería hashes y actualización diferencial.

## Goals / Non-Goals

Una interfaz independiente que funcione antes de instalar Electron o Python. No agregar un segundo Chromium ni un WebView descargado; no exponer shell o IPC al renderer del producto.

## Decisions

- WPF y .NET Framework de Windows permiten una ventana sin marco, texto nativo y geometría 3D sin dependencias npm nuevas. Se descartan nuevas imágenes dentro de NSIS por no satisfacer la petición y un segundo Electron por duplicar tamaño/runtime.
- `Install.exe` embebe `Setup.exe` como recurso junto con su SHA-256. `latest.yml`, blockmap y Setup.exe no se reemplazan. El bootstrapper no acepta rutas a ejecutables ni instala por argumentos.
- Servicio C# separado de ventana y escena. Extracción asíncrona, temporal privado, hash antes de ejecutar, proceso sin shell y argumentos fijos de instalación silenciosa por usuario. El destino seleccionado se valida antes de transmitir `/D=`.
- Bytes de extracción tienen progreso medido; NSIS expone espera indeterminada y código de salida, nunca porcentajes simulados. La aplicación solo se abre por clic posterior.
- Se permite cancelar preparación. Durante escritura se conserva el proceso hasta terminar; cerrar/minimizar no mata el motor. La vista previa se compila sin payload ni capacidad de instalar y sus estados de demostración se identifican.
- Logo original embebido sin recrearlo. Tras la revisión visual del usuario se elimina la aproximación WPF: se importa directamente `OrbCanvas`, `OrbMesh`, geometría y shaders del producto en una página local WebView2. Arrastre, inercia, foco, teclado y recentrado pertenecen al componente compartido. No se solicita audio.
- WebView2 SDK Microsoft 1.0.4191.47, distribuible con su licencia, queda embebido y fijado por SHA-256. Usa el runtime Evergreen instalado (verificado localmente), sin duplicar Chromium. Perfil temporal privado, navegación/recursos externos/permisos/descargas/host objects bloqueados; mensajes de estado solo desde la ventana hacia la escena. Si falta WebView2 o WebGL, se muestra aviso, no otra orbe inventada ni instalación automática del runtime.

## Risks / Trade-offs

- [Firma] El wrapper también requiere Authenticode antes de distribución pública; las pruebas generan artefactos sin firma y no publican.
- [Compatibilidad] Requiere Windows x64 con .NET Framework 4.8; la orbe original requiere WebView2 Evergreen y WebGL. Verificar en Windows limpio antes de release; el fallo gráfico no debe bloquear el motor de instalación.
- [Escritura parcial] NSIS mantiene su recuperación existente; el shell no promete rollback transaccional ni mata procesos en escritura.
- [Rendimiento/accesibilidad] Reducir animación según Windows, pausa manual y al minimizar; limitar actualización de escena a 30 FPS.
- [Actualizaciones] Mantener los artefactos del actualizador separados y probar el ciclo real en VM antes de cerrar release.

## Migration Plan

La superficie de la orbe no dibuja un marco rectangular al recibir foco. La
señal de foco por teclado se conserva como subrayado discreto de la ayuda inferior,
sin cambiar geometría, shaders, arrastre ni navegación con flechas.

Generar el wrapper después de NSIS. Entregar Install.exe para instalación manual y conservar Setup.exe/latest.yml para actualización automática. Rollback: retirar Install.exe y usar el Setup.exe existente sin cambios de formato, registro ni datos.
