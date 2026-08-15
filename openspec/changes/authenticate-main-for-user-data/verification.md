# Verificación — authenticate-main-for-user-data

Fecha: 2026-08-15.

## Compuertas ejecutadas

| Compuerta | Comando | Resultado |
|---|---|---|
| Tipos | `npx tsc --noEmit -p tsconfig.json` | ✅ Sin errores |
| Arnés | `npm run harness:validate` | ✅ 25 rutas y 9 skills canónicas |
| Semilla del catálogo | `node scripts/quality/system-skills-seed.mjs` | ✅ Coincide con el registro en código |
| Pruebas de main | `npx vitest run electron` | ✅ 1330/1331 (1 fallo preexistente) |
| Pruebas del renderer (dirigidas) | 5 suites afectadas | ✅ 41/41 |

El único fallo de main es `whatsapp-workflow-presentacion > WA-160`, ya
documentado como preexistente en el cambio anterior (espera `index.html` cuando
el runtime produce `deck.json`).

## Pruebas nuevas

| Archivo | Cubre | Casos |
|---|---|---|
| `electron/__tests__/hub-session.test.ts` | Custodia del token | 7 ✅ |
| `electron/__tests__/auth-state-contract.test.ts` | Contrato del canal de sesión | 5 ✅ |
| `electron/__tests__/passive-skills-persistence.test.ts` | Persistencia, precedencia y migración | 11 ✅ |

Lo que fijan, y por qué importa:

- **El token no se lee en el archivo.** La prueba usa un cifrado falso *opaco*
  —el primer intento usaba un prefijo legible y la aserción lo delató— y
  comprueba el buffer en `utf8` y en `latin1`.
- **Sin cifrado del sistema no se persiste nada.** Es una desviación deliberada
  del patrón de `memory/token-store.ts`, que cae a texto plano: allí el secreto
  es de un servicio acotado; aquí sería una credencial de larga vida del usuario.
- **La credencial nunca sale.** Se serializa la respuesta de `auth:set-state` y
  de `auth:get-state` y se comprueba que no contiene los tokens.
- **Un renderer que no publique tokens no rompe nada**: main queda `anon`, que es
  el estado seguro.
- **La base manda sobre la caché**: una regla borrada en otro equipo se apaga
  aquí; una creada allí se levanta aquí.
- **Sin red NO se reconcilia**: se listan las reglas levantadas y no se borra
  ninguna, porque hacerlo apagaría rutinas por una caída.
- **Guardar sin poder persistir deshace el alta local.** Dejarla solo en local
  sobreviviría al reinicio y la borraría la primera lectura correcta, con el
  usuario creyendo que estaba programada.
- **Borrar sin poder persistir no apaga el cron**, porque reaparecería en la
  siguiente lectura.
- **Sin sesión no se migra nada**: no se atribuyen reglas ajenas a quien mire.

## Los dos defectos que este cambio corrige

Ambos se detectaron al responder de dónde salían las Skills pasivas, y ninguno
producía error visible —los dos degradaban en silencio—:

1. `system_skills` concede `SELECT` a `authenticated`; main era `anon` y recibía
   cero filas, así que caía al registro en código y las seis Skills de la base no
   existían en WhatsApp ni Telegram.
2. `user_skill_channels` tiene RLS por `auth.uid()`; main recibía cero filas y
   resolvía "sin elección", de modo que desactivar una Skill en un canal no
   tenía efecto en ese canal.

## Pendiente de verificación manual

1. **Ejecutar `passive-skills.sql`** en la instancia Pulse Hub y comprobar su
   bloque de verificación (cuatro políticas, ninguna abierta a `anon`).
2. **Sesión headless**: iniciar sesión, cerrar la aplicación, reabrirla en
   segundo plano y comprobar que una Skill pasiva se ejecuta y entrega.
3. **Los dos defectos, en vivo**: invocar `/correo` por WhatsApp (debe existir) y
   desactivar una Skill para WhatsApp desde el Hub (debe dejar de ofrecerse).
4. **Cambio de usuario** en el mismo equipo: las rutinas del primero dejan de
   dispararse y no aparecen para el segundo.
5. **Migración**: actualizar sobre una instalación con rutinas ya programadas y
   comprobar que quedan a nombre del usuario y no se duplican al repetir.
6. **Sin cifrado del SO** (Linux sin keyring): la aplicación funciona, la sesión
   no persiste entre reinicios y no se escribe ningún token.
