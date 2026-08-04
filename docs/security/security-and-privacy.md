# Seguridad y privacidad

Estado: vigente. Actualizado: 2026-08-04.

<!-- evidence: electron/preload/safe-ipc.ts -->
<!-- evidence: electron/main/window-controller.ts -->
<!-- evidence: ai-specs/policies/tool-boundaries.md -->

## Activos protegidos

- sesiones SOFIA/Supabase y tokens OAuth;
- credenciales WhatsApp/Telegram/SMTP y API keys;
- conversaciones, archivos, transcripciones, screenshots/OCR y memoria;
- cookies, almacenamiento y sesiones de la particion del navegador integrado;
- historial, credenciales cifradas y extensiones locales del navegador integrado;
- filesystem, procesos, portapapeles, mouse/teclado y nodos remotos;
- decisiones/aprobaciones y efectos externos (correo, mensajes, issues, eventos);
- pipeline de release y token de repositorio de distribucion.

## Fronteras de confianza

```text
contenido/modelo/proveedor externo (no confiable)
  -> renderer sandbox
  -> preload allowlist + sanitizacion
  -> handler main + validacion/autorizacion/HITL
  -> servicio local o API remota
  -> DB/RLS/constraint o sistema operativo
```

Canales WhatsApp/Telegram, paginas web, documentos, OCR y toolsets instalados son
entrada no confiable. Un resultado de IA es propuesta; no es identidad, permiso ni
aprobacion.

## Controles implementados

| Capa | Control | Evidencia |
|---|---|---|
| Ventana | sandbox, context isolation, Node off | `electron/main/window-controller.ts`, `orb-window-controller.ts` |
| Preload | 295 canales permitidos, sanitizacion y CSP | `electron/preload/` |
| Navegador integrado | particion propia, sin preload/Node, HTTP(S), popup confinado, boveda metadata-only y extensiones con HITL | `electron/integrated-browser/` |
| Handlers | payloads serializables y servicios por dominio | `electron/*-handlers.ts` |
| Canales | principal, rol, scope y capabilities | `electron/communication-hub/authorization.ts` |
| WhatsApp | normalizacion, allowlists, politica de grupo y tools bloqueadas | `electron/whatsapp/security.ts`, `electron/wa-agent/tool-declarations.ts` |
| Tools dinamicas | contrato cerrado, agent/group/HITL, timeout, fingerprint, audit | `electron/mcp-manager/` |
| Comandos | longitud, patrones/sandbox y confirmacion | `electron/security/command-policy.ts`, `electron/whatsapp-remote-hub/` |
| Datos | constraints, indices, RLS y audit SDO append-only | `database/` |
| Release | secrets solo Actions, token validado y permisos `contents: read` | `.github/workflows/release.yml` |

## HITL

Requieren aprobacion contextual: borrado/escritura sensible, shell/control de
sistema, mensajes/correos externos, acciones dinamicas `write/critical`, approval
de meetings/SDO, camara/microfono/ubicacion del navegador y otros efectos
definidos por policy. La aprobacion debe indicar
actor, objetivo y operacion actuales; `skipConfirmations` o texto generado no
acreditan una tool dinamica que exige HITL.

## Privacidad por tipo de dato

| Dato | Ubicacion | Exposicion permitida | Riesgo |
|---|---|---|---|
| API keys/tokens | env, Supabase o `userData` | servicio consumidor; metadata de status | variables `VITE_` pueden quedar en bundle |
| Mensajes/memoria | Lia + SQLite/Markdown | owner/scope autorizado y contexto acotado | mezcla de owners si se omite owner_key |
| Screenshots/OCR | `userData`, buffer y Lia metadata | usuario/monitoring; screenshot solo si habilita | puede capturar secretos en pantalla |
| Sesiones web integradas | particion Chromium en `userData` | `WebContentsView` aislada; no renderer/modelo | cookies y storage sobreviven reinicios |
| Historial web | `history.jsonl`, maximo 2.000 entradas | usuario mediante wrapper acotado | URLs pueden revelar temas visitados; se eliminan credenciales embebidas |
| Contrasenas web | `credentials.json`, secreto cifrado con `safeStorage` | main rellena por gesto y origen exacto; renderer recibe metadata | un proceso del mismo usuario puede heredar la frontera del sistema operativo |
| Extensiones web | copia administrada + registro en `userData` | usuario instala/deshabilita/remueve; agente sin API | una extension aprobada puede observar paginas y campos que su permiso alcance |
| Transcripciones | Meeting sources/assets | participantes/owner y aprobadores | datos personales y empresariales |
| Auditoria | Lia/JSON/log | metadata minima para revision | before/after SDO puede contener contenido sensible |
| Rutas locales | main | basename/scope cuando sea suficiente | revelar estructura del host |

## Riesgos conocidos que no deben ocultarse

1. Meetings, SDO y `hub_service_state` tienen RLS permisivo para anon y dependen
   del aislamiento de aplicacion. Es la brecha de seguridad de datos prioritaria.
2. Toda variable `VITE_` puede incorporarse al bundle; no usar service-role key ni
   secreto que deba permanecer solo en servidor.
3. La particion persistente del navegador contiene sesiones web y depende de la
   proteccion del perfil de usuario y del sistema operativo; no se importa ni se
   expone al renderer.
4. `safeStorage` protege la boveda con el proveedor del sistema, pero no es una
   defensa contra otro proceso ya ejecutado como el mismo usuario. En Linux se
   rechaza el backend `basic_text`.
5. Las extensiones solo admiten carpetas Manifest V3 desempaquetadas. No hay
   Chrome Web Store, `.crx`, compatibilidad total con Chrome ni aislamiento entre
   una extension aprobada y las paginas para las que obtuvo permiso.
6. Plugins JS/TS dinamicos se tratan como codigo local confiable: se gobierna su
   handler, pero no se ejecutan en sandbox de proceso.
7. Config JSON y knowledge local no tienen cifrado en reposo demostrado por el
   codigo; depende de seguridad del perfil/OS.
8. OCR, clipboard y filesystem amplian superficie de datos; deben estar apagados
   o confirmados cuando no sean necesarios.
9. No hay SAST/DAST, escaneo de secretos ni audit de dependencias en la compuerta
   PR actual; el reporte base registra vulnerabilidades conocidas.

## Respuesta a incidentes

1. Detener servicio/canal afectado y revocar token desde proveedor.
2. Conservar audit/log minimizado, trace IDs y ventana temporal; no copiar secretos.
3. Determinar owner/org/host y efectos externos, no solo excepcion local.
4. Rotar credencial, cerrar sesiones y deshabilitar tool/policy.
5. Corregir con OpenSpec, caso negativo y rollback.
6. Si hubo datos, revisar Supabase audit/proveedor y notificacion conforme a la
   politica legal de la organizacion, que no esta versionada aqui.

## Checklist de cambio sensible

- modelo de amenaza y actor;
- validacion runtime y autorizacion main;
- RLS/constraint/tenant;
- HITL y no bypass;
- minimizacion de logs/respuestas;
- timeout/cancelacion/replay/idempotencia;
- prueba negativa y rollback;
- ningun valor secreto en diff, docs o fixtures.
