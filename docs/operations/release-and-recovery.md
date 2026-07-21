# Release, respaldo y recuperacion

Estado: vigente. Actualizado: 2026-07-21.

<!-- evidence: electron-builder.json5 -->
<!-- evidence: .github/workflows/release.yml -->
<!-- evidence: electron/updater/constants.ts -->

## Artefactos por plataforma

| Plataforma | Target | Nombre |
|---|---|---|
| Windows x64 | NSIS, instalacion por usuario, directorio elegible | `SofLIA-Hub-Windows-<version>-Setup.exe` + blockmap/latest.yml |
| macOS | DMG | `SofLIA-Hub-Mac-<version>-Installer.dmg` + latest-mac.yml |
| Linux x64 | AppImage y DEB | `SofLIA-Hub-Linux-<version>-x64.<ext>` + latest-linux.yml |

NSIS conserva `userData` al desinstalar (`deleteAppDataOnUninstall: false`), crea
shortcuts y permite elevacion/directorio. Linux DEB depende de `libportaudio2`.

## Contenido empaquetado

- `dist/` y `dist-electron/` dentro de ASAR.
- `onnxruntime-node` desempaquetado de ASAR.
- runtime Python y dos sidecars como recursos.
- Context Pack meetings v1 como recurso, separado de skills de desarrollo.
- `afterPack` valida Python empaquetado.

## Publicacion y update

GitHub Actions crea un release por version de `package.json` y extrae notas de
`CHANGELOG.md`. `electron-updater` consulta el repo de releases cada cuatro horas;
descarga/progreso/instalacion se exponen a UI. Instalar reinicia la aplicacion, por
lo que el usuario debe poder concluir trabajo activo.

## Matriz de respaldo

| Estado | Respaldo actual | Recuperacion |
|---|---|---|
| Supabase | gestionado fuera del repo; no probado aqui | restauracion del proyecto/proveedor con autorizacion |
| `hub_service_state` | espejo cloud de ciertos estados JSON | servicios restauran al iniciar segun implementacion |
| memoria SQLite | sin backup automatico versionado | copiar DB con app detenida y validar schema/ABI |
| knowledge Markdown | sin backup automatico | copiar `userData/knowledge/` |
| config JSON | parcial en cloud segun servicio | restaurar archivo compatible o usar defaults |
| credenciales WhatsApp/OAuth | proveedor/userData | reconectar y revocar sesion anterior si se perdio host |
| screenshots | no deben asumirse respaldados | conservar/eliminar segun privacidad, no restaurar por defecto |
| repo/codigo | Git | revert/branch/tag/release previo |

No hay RPO/RTO cuantitativo versionado. Decir “backup completo” seria incorrecto.

## Rollback de aplicacion

1. Detener rollout/update automatico si hay incidente.
2. Identificar version y migraciones incluidas.
3. Si no hubo migracion destructiva, instalar release anterior y conservar
   `userData` compatible.
4. Si cambio schema local, usar migracion down o copia verificada; no reemplazar DB
   con app abierta.
5. Si cambio Supabase, ejecutar rollback especifico de la migracion solo tras
   preflight/backup.
6. Revocar credenciales si el incidente fue de seguridad.
7. Registrar resultado y riesgo residual.

## Recuperacion de subsistemas

- Config JSON corrupta: servicios con loader tolerante vuelven a defaults; revisar
  que no active una opcion peligrosa.
- Sidecar Python fallido: status/restart hasta el maximo; voz y tools son procesos
  separados.
- WhatsApp: desconectar, eliminar sesion autorizadamente y volver a emparejar.
- Tool dinamica invalida: loader la retira; corregir contrato/reinstalar builtin,
  no relajar schema.
- Indice FTS: cerrar DB y reindexar fuentes; no es autoridad de contenido.
- Meeting sync parcial: reutilizar idempotency key y estado, no crear accion nueva.

## Verificacion previa a release

`verify:release`, artifacts esperados, smoke Linux, firma/notarizacion cuando se
incorpore, notas de version, ruta de updater y plan de rollback. El workflow actual
no documenta firma Windows ni notarizacion Apple; no se presentan como activas.
