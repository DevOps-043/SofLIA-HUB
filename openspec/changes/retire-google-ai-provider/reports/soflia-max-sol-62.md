# SofLIA Max con Sol 6.2

El catálogo compartido de SofLIA Max usa `gpt-6.2-sol`. El selector migra los
identificadores anteriores a este modelo conservando razonamiento, ámbito de
usuario y cuota mensual. Una preferencia de Sol 6.2 existente tiene prioridad.
El catálogo de equipos admite Sol 6.2 para encargos nuevos y mantiene Sol 6.1
para recuperar los históricos con su modelo original.

El identificador y la compatibilidad de Responses con herramientas se
comprobaron en la [documentación oficial de OpenAI](https://developers.openai.com/api/docs/models/gpt-6.2-sol).
No se realizó inferencia remota; su disponibilidad depende del proyecto OpenAI
configurado. La verificación local usa proveedores simulados.

## Verificación

- `npm run test -- model-selector-options useModelSelector model-routing model-quota gemini-chat-routing native-openai-consumers openai-workspace-turn openai-hosted-tools application-open-routing BrowserWorkspaceLayout background-teams --maxWorkers=1`: 206 pruebas aprobadas en 13 archivos.
- Los casos cubren catálogo, envío del modelo y esfuerzo a OpenAI simulado,
  migración desde tres identificadores anteriores, preferencia actual con
  prioridad, cuota conservada y ejecución/recuperación de equipos Sol 6.1/6.2.
- `npm run typecheck`: aprobado.
- `npm run lint:changed`: 15 archivos revisados sin deuda nueva.
- La primera ejecución de `npm run verify:pr` aprobó adaptadores, arnés,
  dependencias, CI, runtime estable, documentación, semilla, OpenSpec y las
  70 pruebas de tooling. Se detuvo porque Python no estaba en el PATH.
- Se comprobó Python 3.12.14 incluido en Codex y se repitió la compuerta
  indicando su ruta mediante `SOFLIA_TEST_PYTHON` sólo para ese proceso.
- Resultado final de `npm run verify:pr`: código 0, compuerta completada.
  La suite con cobertura aprobó 7699 pruebas en 666 archivos; omitió cinco
  pruebas en dos archivos. Pasaron también las 70 pruebas de tooling, los
  33 contratos Python y todas las demás etapas de la compuerta.
- Cobertura verificada de 2749 fuentes productivas: líneas 63.94%, sentencias
  61.99%, funciones 58.44% y ramas 55.18%.

## Reversión

Restaurar la constante de Max y el catálogo previo. Conservar compatibilidad de
los identificadores guardados si ya hay preferencias o encargos con Sol 6.2.
