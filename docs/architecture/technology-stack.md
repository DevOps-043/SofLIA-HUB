# Stack tecnologico

Estado: vigente. Actualizado: 2026-07-21.

Las versiones son las restricciones declaradas en `package.json`, no la salida de
un host concreto. `package-lock.json` fija la resolucion reproducible.

<!-- evidence: package.json -->
<!-- evidence: package-lock.json -->
<!-- evidence: electron-builder.json5 -->

## Runtime de aplicacion

| Capa | Tecnologia | Restriccion versionada | Uso real |
|---|---|---:|---|
| Desktop | Electron | `^39.8.5` | main, preload, BrowserWindow, tray, desktopCapturer, powerMonitor, updater |
| UI | React / React DOM | `^18.2.0` | renderer y componentes funcionales |
| Lenguaje | TypeScript | `^5.7.3` | renderer, main, preload y config estrictos |
| Build | Vite / vite-plugin-electron | `^7.0.0` / `^0.29.0` | bundles renderer, main CJS y preload |
| CSS | Tailwind CSS 4 | `^4.1.18` | tokens via `@theme`, utilities y dark selector |
| Movimiento | Framer Motion | `^11.18.2` | transiciones de modales, menus y orbe |
| 3D | Three / React Three Fiber / Drei | `^0.185.1` / `^8.18.0` / `^9.122.0` | visual de orbe |

## IA y lenguaje

| Tecnologia | Version | Consumidores |
|---|---:|---|
| `@google/genai` | `^2.10.0` | APIs Gemini recientes, grounding/computer use |
| `@google/generative-ai` | `^0.24.1` | servicios y loops heredados/compatibles |
| Gemini REST/WebSocket | endpoints v1beta | chat, Live API, embeddings, vision, transcripcion, research |
| Tesseract.js | `^5.0.5` | OCR de monitoreo/UI |
| ONNX Runtime Node | `^1.27.0` | parser visual local/OmniParser |
| Meyda | `^5.6.3` | caracteristicas de audio |
| Python sidecars | runtime embebido generado | wake word/Vosk, faster-whisper, documentos y redaccion |

Antigravity es la herramienta de desarrollo del arnes, no una dependencia
runtime. Gemini permanece como proveedor del producto porque `src/config.ts` y
los servicios lo invocan; cambiarlo exige un cambio funcional propio.

## Datos e integraciones

| Tecnologia | Version | Uso |
|---|---:|---|
| Supabase JS | `^2.95.3` | SOFIA, Lia e IRIS con clientes separados |
| better-sqlite3 | `^12.8.0` | memoria, pensamientos e indice local |
| Google APIs | `^171.4.0` | Calendar, Gmail, Drive y Chat |
| Microsoft Graph/MSAL | `^3.0.7` / `^5.0.4` | calendario Microsoft/OAuth |
| Baileys | `^7.0.0-rc13` | WebSocket WhatsApp/QR/media |
| Nodemailer | `^8.0.7` | SMTP local configurado por usuario |
| Playwright Core | `^1.58.2` | automatizacion de navegador |
| nut.js fork | `^4.2.6` | mouse/teclado nativos |
| Sharp | `^0.34.5` | imagenes, screenshots y composicion |
| Zod | `^3.24.2` | validacion de contratos, payloads y tools |
| ExcelJS / docx / pptxgenjs / mammoth | versiones en `package.json` | lectura/generacion de documentos Office |

## Toolchain y calidad

- Vitest `^4.1.0` con proyectos main/renderer.
- Testing Library React, user-event, jest-dom y MSW.
- ESLint 8 con TypeScript, hooks y React Refresh.
- OpenSpec `^1.6.0` para propuesta, requisitos, diseno y tareas.
- electron-builder `^26.8.1` para NSIS, DMG, AppImage y DEB.
- GitHub Actions: CI usa Node 24; release usa Node 20. Esa diferencia es real y
  debe considerarse al diagnosticar incompatibilidades.

## Formatos de salida

- Main: CommonJS en `dist-electron/main.js`.
- Renderer: assets Vite en `dist/`.
- Preload: bundle separado bajo `dist-electron/`.
- Instaladores: `release/<version>/` con nombres definidos por plataforma.
- Python: `python-runtime/`, `python/sidecar/` y `python/tools_sidecar/` se copian
  como `extraResources`.
