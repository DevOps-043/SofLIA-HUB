# Pulse Hub

Aplicación de escritorio Electron para operaciones asistidas por IA: WhatsApp,
Google Workspace, reuniones, monitoreo, memoria, automatización de escritorio y
gestión operativa para equipos hispanohablantes.

## Inicio rápido

Requisitos: Node.js 20.19 o superior, npm y las variables de entorno del proyecto.

```powershell
npm install
npm run dev
```

La aplicación separa el proceso Electron main del renderer React. No expongas APIs
nativas directamente: sigue el contrato de cuatro capas documentado para IPC.

## Variables de entorno

Vite incrusta las variables `VITE_*` **en tiempo de compilación**: deben existir en
el `.env` de la máquina que construye el instalador, no en la del usuario final.
Una variable ausente no rompe el build, se compila como cadena vacía y desactiva
su función en silencio.

Sin estas el producto sale inutilizable:

| Variable | Habilita |
| --- | --- |
| `VITE_GEMINI_API_KEY` | SofLIA y SofLIA Lite |
| `VITE_OPENAI_API_KEY` | SofLIA Pro y SofLIA Max |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Conversaciones, reuniones y ajustes |
| `VITE_SOFIA_SUPABASE_URL`, `VITE_SOFIA_SUPABASE_ANON_KEY` | Autenticación y organizaciones |

El resto son opcionales y solo apagan su integración: `VITE_IRIS_SUPABASE_*`
(Project Hub), `VITE_GOOGLE_OAUTH_CLIENT_*` (Google Workspace),
`VITE_OPENAI_VECTOR_STORE_IDS` (file search), `VITE_MICROSOFT_CLIENT_ID` y
`VITE_SOFLIA_LEARNING_SUPABASE_*`.

La Orbe y el modo lectura del navegador usan `ELEVENLABS_API_KEY` y
`ELEVENLABS_VOICE_ID`; aceptan opcionalmente `ELEVENLABS_MODEL_ID` (default
`eleven_turbo_v2_5`) y `ELEVENLABS_OUTPUT_FORMAT` (default
`mp3_44100_128`). No llevan prefijo `VITE_`: la configuración de build las
inyecta solo en Electron main y no en renderer/preload. Sin ellas, la lectura
visual permanece disponible, pero la Orbe mantiene la respuesta escrita e
informa que la voz no está configurada. El formato MP3 es solo el transporte de
reproducción: el modo lectura no ofrece descarga. La voz configurada debe estar
disponible en el mismo workspace de la clave, no únicamente visible en el
catálogo público de ElevenLabs.
Las solicitudes en español declaran el idioma, preparan localmente marcas y
decimales ambiguos y conservan el texto visible intacto. En Google Docs el
seguimiento se muestra en la cápsula porque su lienzo no expone rangos DOM
seguros para subrayar sin tocar la interfaz.

En release cada variable se alimenta de un secret homónimo del repositorio. Toda
`VITE_*` nueva debe añadirse a los tres bloques `.env` de
[`release.yml`](.github/workflows/release.yml); la compuerta lo verifica.

## Verificación

```powershell
npm run typecheck
npm run test
npm run verify:pr
node scripts/quality/check-release-env.mjs
```

`npm run verify:release` agrega la compilación y el empaquetado; úsalo solo para un
candidato a distribución. Las pruebas reconstruyen temporalmente `better-sqlite3`
para Node y restauran después su ABI de Electron.

## El agente

Pulse Hub se opera a través de cuatro identidades de agente que comparten memoria
y políticas: el agente de chat en la ventana, el agente de WhatsApp, el agente de
escritorio (control de computadora) y el agente de reuniones. Todas sus
capacidades, herramientas, guardas, límites y opciones de configuración están en el
[Manual del agente runtime](docs/architecture/runtime-agents-manual.md). Si
prefieres un solo archivo con todo — producto, gobernanza y manual — usa la
[Referencia completa del agente](docs/architecture/agent-complete-reference.md).

## Navegación

- [Documentación](docs/README.md)
- [Manual del agente runtime](docs/architecture/runtime-agents-manual.md)
- [Arquitectura](docs/architecture/system-overview.md)
- [Normas del proyecto](docs/standards/base.md)
- [Empezar a usar el Arnes](docs/operations/harness-quickstart.md)
- [Estandar maestro de ingenieria](docs/standards/engineering-practices.md)
- [Catalogo de producto y requisitos](docs/product/product-definition.md)
- [Matriz de trazabilidad](docs/product/traceability-matrix.md)
- [Arnés de agentes](ai-specs/README.md)
- [Antigravity: reglas y workflows](.agents/rules/soflia-harness.md)
- [Cambios OpenSpec](openspec/changes/)
- [Base de datos](database/README.md)

Comienza cualquier trabajo asistido leyendo [AGENTS.md](AGENTS.md). La guía histórica
anterior se conserva únicamente en `docs/archive/project-guides/`.
