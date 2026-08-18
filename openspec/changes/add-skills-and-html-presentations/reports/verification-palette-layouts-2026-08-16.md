# Verificacion: paleta de fuente y variedad compositiva

Fecha: 2026-08-16

## Alcance

- Prioridad cromatica `usuario > fuente observada > organizacion > neutro`.
- Contrato estricto y accesible para `meta.tema`.
- Variantes compositivas y rechazo de firmas `tipo:variante` repetidas en barajas nuevas.
- Eliminacion de bandas grises en imagenes con ajuste `contener`.
- Compatibilidad de lectura para barajas anteriores sin `tema` ni `variante`.

## Evidencia ejecutada

| Comando | Resultado |
| --- | --- |
| `npx vitest run src/__tests__/shared/presentation-deck-schema.test.ts src/__tests__/presentation-runtime/PresentationPlayerApp.test.tsx src/__tests__/services/presentaciones-prompt.test.ts --reporter=verbose` | Pasa: 3 archivos, 20 pruebas. |
| ESLint dirigido a los archivos TypeScript/TSX modificados | Pasa sin errores. |
| `npm run harness:validate` | Pasa: 25 rutas y 9 skills canonicas. |
| `npx openspec validate add-skills-and-html-presentations --strict --no-interactive` | Pasa. |
| `npm run adapters:check` | Pasa: 27 adaptadores. |
| `npm run docs:check` | Pasa: 226 archivos. |
| `npx vite build --config vite.config.mts` | Pasa el build de produccion del renderer, Electron y preload. |
| `git diff --check` | Pasa; solo se reportan avisos de conversion LF/CRLF. |

## Compuertas globales no atribuibles a este cambio

- `npm run typecheck` se detiene en `src/__tests__/hooks/use-monitoring-controls.test.tsx:13` con `TS2556`. No reporta errores en los archivos de presentaciones modificados.
- `npm run lint:changed` encuentra 18 usos de `any` en cambios paralelos de voz, WhatsApp, memoria y Telegram. El lint dirigido del alcance de presentaciones pasa.
- `npm run verify:pr` se detiene en `docs:system:check` porque el inventario global versionado espera 384 pruebas y el worktree contiene archivos de prueba nuevos ajenos a este cambio.

## Revision adversarial

Se intentaron refutar estas hipotesis:

1. Una orden incrustada en una pagina o documento puede sustituir la identidad visual. El prompt mantiene la fuente como datos no confiables y exige que la activacion provenga de la solicitud explicita del usuario.
2. Una paleta ilegible puede llegar al runtime. El esquema rechaza hexadecimales invalidos y contrastes insuficientes de texto, superficie, primario y acento.
3. El contrato nuevo rompe decks existentes. `tema` y `variante` son opcionales al leer decks heredados; las reglas de unicidad y diversidad se activan cuando todas las escenas declaran variante, como exige la autoria nueva.
4. `contener` vuelve a producir bandas grises. El runtime compone un fondo desenfocado de la misma imagen y conserva delante la imagen completa.
5. Las variantes solo cambian una etiqueta. React cambia columnas, densidad, secuencia, superficies y dominancia visual segun la variante.

## Riesgo residual

Las barajas ya generadas no adquieren automaticamente una paleta de fuente ni variantes nuevas; deben regenerarse o editar su `deck.json`. El arreglo de encuadre de imagen si se aplica al volver a abrirlas con el runtime actualizado.
