# Verificación

Estado: automatizada completa; **migración y comprobaciones manuales pendientes**
(grupo 8 de `tasks.md`). Fecha: 2026-08-10.

## Compuertas ejecutadas

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Sin errores (`tsconfig.json` y `tsconfig.node.json`). |
| `npx vitest run --project main` | 110 archivos, 1221 pruebas. **1 fallo ajeno**: ver más abajo. |
| `npm run skills:seed:check` | La semilla coincide con el registro en código. |
| `npm run docs:system:check` | 28 documentos, 147 IDs, 355 canales y 363 archivos de prueba. |
| `npm run docs:check` | Enlaces válidos en 178 archivos Markdown. |
| `npm run openspec:validate` | 15 cambios válidos en estricto. |

### Fallo ajeno al cambio

`electron/__tests__/integrated-browser-service.test.ts` falla **solo en la
ejecución completa** ("no pregunta y explica la ruta del sistema cuando el
sistema operativo bloquea la cámara"). En aislado pasa 35/35. Sus archivos
fuente (`electron/integrated-browser/*`, `profile-scope.ts`,
`browser-session-scope.ts`) están modificados por trabajo en curso de otra
persona en el mismo árbol; este cambio no los toca. Es un fallo dependiente del
orden en ese trabajo, no una regresión de aquí.

### Suite completa del renderer

No se ejecutó entera: en este equipo tarda horas y una ejecución previa terminó
con un worker caído tras cubrir 73 de ~98 archivos. Se ejecutaron dirigidas las
10 suites de Skills y catálogo: **116 pruebas, todas en verde**.

## Suites nuevas y modificadas

| Suite | Casos | Qué demuestra |
|---|---|---|
| `src/__tests__/services/system-skills-catalog.test.ts` | 27 | Acotado de la política de espacio de trabajo, descarte de herramientas no concedibles, tabla de fusión completa y viaje de ida y vuelta de la semilla. |
| `src/__tests__/services/skills-catalog-remoto.test.ts` | 8 | Catálogo del chat desde filas, respaldo ante fallo, retirada declarada y guardas de identidad. |
| `electron/__tests__/wa-skills-catalog.test.ts` | 17 (antes 12) | Paridad chat/WhatsApp, retirada en las dos superficies y respaldo sin base de datos. |

## Un defecto encontrado por las pruebas

La primera versión de `mergeSystemSkills` trataba igual dos casos que no lo son:
una fila **ilegible** y una fila **válida que no declara esta superficie**. Con
eso, una fila que acotara las superficies a `chat` dejaba viva en WhatsApp la
Skill de la versión instalada — justo lo contrario de lo que el operador acababa
de declarar. Lo detectó `una skill sin la superficie whatsapp no se ofrece ni se
puede invocar`. La lectura de fila devuelve ahora un resultado de tres estados
(`ok`, `otra-superficie`, `invalida`) y solo el segundo retira.

## Pendiente (requiere entorno real)

Nada de lo siguiente puede darse por hecho desde el repositorio:

- [ ] 8.1 Ejecutar `database/lia/migrations/system-skills-catalog.sql` en la
  instancia Pulse Hub y guardar la salida del bloque de verificación.
- [ ] 8.2 Comprobar con una sesión de usuario que `INSERT`, `UPDATE` y `DELETE`
  sobre `public.system_skills` son rechazados. **Es la guarda de la que dependen
  todas las demás**: sin ella, la decisión de guardar herramientas y política de
  workspace en la fila queda sin defensa.
- [ ] 8.3 `/presentacion` y `/presentaciones` ofrecen la Skill; `enabled = false`
  la retira de chat y WhatsApp; volver a habilitarla la restituye.
- [ ] 8.4 Con la red cortada, el chat sigue ofreciendo la Skill de la versión.
- [ ] 8.5 `npm run verify:pr` completo (incluye `lint:changed`, `harness:validate`
  y `audit:supply-chain`, no ejecutados aquí).
