import {
  buildNodesMessage,
  buildOpsStatusMessage,
  buildSkillsMessage,
  buildTelegramHelpMessage,
  resolveUserId,
} from './messages';
import { findSkillByCommand, skillsForChannel } from '../skill-catalog/channel-skills';
import { RETIRED_COMMAND_REPLIES } from '../wa-agent/chat-commands/retired-commands';
import { handleTelegramVoiceCallCommand } from './voice';
import type { TelegramRuntimeContext } from './types';

/**
 * Dispatcher de Telegram.
 *
 * Telegram dejo de ser un menu fijo de operaciones del Hub de Flujos y pasa a
 * ser una superficie de Skills: resuelve el MISMO catalogo que el chat del Hub
 * y WhatsApp, con las mismas guardas. Antes tenia su propia lista, de modo que
 * una Skill retirada del catalogo seguia viva aqui.
 */
export async function handleIncomingTelegramCommand(
  context: TelegramRuntimeContext,
  chatId: string,
  text: string,
  isGroup = false,
): Promise<void> {
  const normalized = text.trim();
  const lowered = normalized.toLowerCase();
  const cmd = lowered.split(/\s+/)[0];
  const send = (message: string) => context.sendMessage(chatId, message);

  if (cmd === '/start' || cmd === '/help') return void await send(buildTelegramHelpMessage());
  if (cmd === '/skills' || cmd === '/agentes') {
    return void await send(await buildSkillsMessage(context, chatId, isGroup));
  }
  if (cmd === '/llamar' || cmd === '/llamada' || cmd === '/colgar') {
    const reply = await handleTelegramVoiceCallCommand({
      context,
      chatId,
      isGroup,
      command: cmd === '/colgar' ? '/colgar' : '/llamar',
    });
    // `null` significa que el comando ya respondio por su cuenta: el saludo sale
    // hablado y repetirlo escrito lo duplicaria.
    if (reply) await send(reply);
    return;
  }
  if (cmd === '/status' || lowered === '/ops status') return void await send(await buildOpsStatusMessage(context));
  if (cmd === '/nodes') return void await send(await buildNodesMessage(context));
  if (lowered.startsWith('/node test ')) return testNode(context, chatId, normalized);

  const retirado = RETIRED_COMMAND_REPLIES[cmd];
  if (retirado) return void await send(retirado);

  const ejecutada = await tryRunSkill(context, chatId, normalized, cmd, isGroup);
  if (ejecutada) return;

  await send(buildTelegramHelpMessage());
}

/**
 * Ejecuta la Skill que corresponde al comando, si existe y esta disponible.
 *
 * Devuelve `false` cuando no habia Skill para ese comando, para que quien llama
 * pueda ofrecer la ayuda en vez de callar.
 */
async function tryRunSkill(
  context: TelegramRuntimeContext,
  chatId: string,
  text: string,
  cmd: string,
  isGroup: boolean,
): Promise<boolean> {
  const runSkillTurn = context.deps?.runSkillTurn;
  if (!runSkillTurn) return false;

  const userId = resolveUserId(context, chatId);
  const skills = await skillsForChannel({ surface: 'telegram', userId, isGroup });
  const skill = findSkillByCommand(skills, cmd);
  if (!skill) return false;

  // El bloqueo en grupos ya lo aplico `skillsForChannel`, pero se repite el
  // mensaje explicito: callar en un grupo pareceria una averia.
  if (isGroup && skill.blockedInGroups) {
    await context.sendMessage(
      chatId,
      `La skill "${skill.name}" no se ejecuta en grupos: su resultado quedaria visible para todos. Escribeme por privado.`,
    );
    return true;
  }

  const encargo = text.slice(cmd.length).trim();
  const prompt = [
    skill.instructions,
    '',
    encargo
      ? `Peticion del usuario: ${encargo}`
      : 'El usuario invoco la skill sin dar detalles. Si necesitas una decision material para empezar, preguntala en una sola frase.',
  ].join('\n');

  try {
    const respuesta = await runSkillTurn({ chatId, userId, prompt, isGroup });
    await context.sendMessage(chatId, respuesta || 'No obtuve respuesta para esa skill.');
  } catch (error) {
    await context.sendMessage(
      chatId,
      `No pude ejecutar "${skill.name}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return true;
}

async function testNode(context: TelegramRuntimeContext, chatId: string, text: string): Promise<void> {
  const nodeId = text.replace(/^\/node\s+test\s+/i, '').trim();
  const allowed = await context.deps?.communicationHubService?.authorizeTool({
    provider: 'telegram',
    telegramChatId: chatId,
    channelId: chatId,
    toolName: 'test_remote_node',
    targetNodeId: nodeId,
    isGroup: false,
  });
  if (allowed && !allowed.allowed) {
    await context.sendMessage(chatId, allowed.reason || 'No tienes permisos para probar este nodo.');
    return;
  }
  const result = await context.deps!.remoteNodeService.testNode(nodeId);
  await context.sendMessage(chatId, [
    `Nodo ${nodeId}:`,
    `success=${result.success ? 'si' : 'no'}`,
    result.health?.error ? `error=${result.health.error}` : 'health=ok',
  ].join('\n'));
}
