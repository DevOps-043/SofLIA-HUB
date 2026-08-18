# Verificación — Modo llamada por WhatsApp y Telegram

Fecha: 2026-08-16

## Alcance verificado

Conversación hablada semi-dúplex por WhatsApp y Telegram, con el catálogo
completo del agente disponible durante la charla, más el rechazo y reconducción
de la llamada entrante de WhatsApp.

## Comandos ejecutados

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Limpio para el cambio. Persiste un único error ajeno en `src/__tests__/hooks/use-monitoring-controls.test.tsx`, sobre trabajo sin commitear presente en el worktree al iniciar y no tocado por este cambio. |
| `npx vitest run --project main` | 1380/1381 tras corregir el LID. El único fallo es `whatsapp-workflow-presentacion` (espera `index.html`, el código escribe `deck.json`). |
| `npm run test` (main + renderer) | 2067/2071, 219/221 archivos. Mismo único fallo de presentaciones. Registró además un `Worker exited unexpectedly` que dejó un archivo sin completar y 3 pruebas sin contabilizar. La corrida duró 5.139 s con otros procesos de vitest ejecutándose en paralelo sobre la misma máquina, así que la caída del worker se atribuye a contención de recursos y no al cambio; se reejecutó el proyecto `renderer` aislado para descartarlo. |
| `npx vitest run --project main electron/__tests__/voice-call.test.ts electron/__tests__/whatsapp-call-events.test.ts` | 23/23. |
| Suites directamente afectadas (WhatsApp service, jailbreak, tool executor, ElevenLabs, orb TTS, voz, llamadas) | 103/103. |

### Prueba de que el fallo de presentaciones es preexistente

Se guardó el cambio completo con `git stash push`, se ejecutó
`whatsapp-workflow-presentacion.test.ts` sobre el árbol limpio y **falló
idénticamente** (1 fallo, 18 pasan). Se restauró con `git stash pop` y se
reconfirmaron las 23 pruebas propias en verde. Ningún archivo de presentaciones
aparece en el diff de este cambio.

## Cobertura nueva

`electron/__tests__/voice-call.test.ts` (18 casos)

- VC-001 recorte: corte en frontera de oración, tope respetado y **contenido
  nunca descartado** (`spoken + remainder === fuente`).
- VC-002 sesión: reabrir no reinicia turnos, vencimiento por inactividad con
  temporizadores falsos, aislamiento entre canales, aviso degradado una sola vez.
- VC-003 entrega: escrito sin llamada; hablado con `forceVoice`; resto escrito al
  recortar; **cuota agotada a mitad de conversación** conserva la respuesta y
  avisa una vez; el cuerpo del proveedor no se filtra; `VOICE_CALL_ENABLED=false`
  vuelve todo a texto.
- VC-004 ciclo: saludo hablado al abrir, despedida escrita al colgar, y las
  respuestas posteriores vuelven a texto; colgar sin llamada lo dice.
- VC-005 configuración: habilitado por omisión, voz inválida descartada, plazo
  acotado a 1–60 min.

`electron/__tests__/whatsapp-call-events.test.ts` (5 casos)

- Rechazo del `offer` y reconducción con el número resuelto.
- Número sin autorización: **se rechaza igual, pero no se abre sesión ni se
  responde**.
- Estados `ringing`/`accept`/`terminate`/`reject`/`timeout` ignorados: no
  multiplican saludos ni rechazos.
- Llamada a grupo rechazada sin abrir sesión.
- Registro en historial con `rejected: true`.

## Defecto encontrado en prueba real y corregido

La primera llamada en dispositivo real **falló**. El log mostró:

```
[WhatsApp] Llamada rechazada de un numero sin autorizacion: 149310259892439
```

`149310259892439` no es un teléfono: es el **LID** con el que WhatsApp
multidispositivo identifica al llamante. `directNumberFromJid` solo devuelve
vacío para grupos, así que con un JID `@lid` devolvía los dígitos del LID —no
vacíos— y el respaldo `|| directNumberFromJid(callerPn)` **nunca se ejecutaba**.
Ese identificador no coincide con la allowlist ni con el principal del Hub, de
modo que la llamada se rechazaba correctamente pero jamás se reconducía.

Corrección: `resolveCallerNumber` prefiere `callerPn`, cae a
`lidMapping.getPNForLID` y devuelve vacío si ninguno resuelve, en cuyo caso no se
abre sesión. Se responde por `<teléfono>@s.whatsapp.net`.

Defecto latente del mismo origen, corregido a la vez: las sesiones se indexaban
por JID, y un mismo interlocutor llega unas veces como `@lid` y otras como
`@s.whatsapp.net`, así que una llamada abierta con una forma no se encontraba al
buscarla con la otra. Ahora el índice es el teléfono normalizado
(`whatsAppVoiceSessionId`); el JID queda solo como dirección de envío.

Regresión cubierta con tres casos nuevos, uno de ellos con el LID exacto del log.

## Riesgo residual

| Riesgo | Estado |
|---|---|
| No existe llamada nativa de WhatsApp | **Asumido y documentado.** Límite de Baileys, no del cambio. La reconducción es la mitigación. |
| Latencia de ida y vuelta por nota de voz | No medida en dispositivo real (tarea 6.x). |
| Consumo de créditos ElevenLabs en llamadas largas | Acotado por recorte por turno y vencimiento por inactividad; sin tope de gasto acumulado. |
| Texto libre en Telegram sigue devolviendo la ayuda | **Preexistente y fuera de alcance.** El canal solo enruta comandos y Skills; la voz sí llega al loop completo del agente. Queda anotado porque el mensaje de ayuda promete lo contrario. |
| Transcripción depende de Gemini | Sin cambio respecto al comportamiento previo de WhatsApp. |

## Pendiente

Verificación manual en dispositivo real (tareas 6.1–6.3) y revisión adversarial
(tarea 5.4).
