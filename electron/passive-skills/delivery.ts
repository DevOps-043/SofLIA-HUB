import type { SkillChannel } from '../../src/shared/skills/types';

/**
 * Entrega del resultado de una Skill pasiva a los canales elegidos.
 *
 * Regla central: el fallo de un canal NO impide la entrega en los demas. Antes
 * de este modulo el destino estaba cableado a WhatsApp, de modo que una sesion
 * desconectada equivalia a perder el resultado. Cada canal se aisla en su
 * propio try, y lo que ocurrio queda en el resultado para poder diagnosticarlo.
 */

export interface DeliveryContext {
  /** Envia por WhatsApp. Ausente = canal no disponible en este arranque. */
  sendWhatsApp?: (phoneNumber: string, text: string) => Promise<void>;
  /** Envia por Telegram. Ausente = canal no disponible en este arranque. */
  sendTelegram?: (text: string) => Promise<void>;
  /** Muestra la orbe y locuta el texto. Ausente = canal no disponible. */
  announceOnOrb?: (text: string, meta: { title: string }) => Promise<void> | void;
}

export interface DeliveryTarget {
  channels: readonly SkillChannel[];
  phoneNumber?: string | null;
  title: string;
}

export type DeliveryOutcome =
  | { channel: SkillChannel; ok: true }
  | { channel: SkillChannel; ok: false; reason: string };

export async function deliverToChannels(
  text: string,
  target: DeliveryTarget,
  context: DeliveryContext,
): Promise<DeliveryOutcome[]> {
  const mensaje = String(text || '').trim();
  if (!mensaje) {
    return target.channels.map((channel) => ({
      channel,
      ok: false as const,
      reason: 'La ejecucion no produjo ningun texto que entregar.',
    }));
  }

  const resultados: DeliveryOutcome[] = [];
  for (const channel of target.channels) {
    resultados.push(await deliverToChannel(channel, mensaje, target, context));
  }

  const fallidos = resultados.filter((resultado) => !resultado.ok);
  if (fallidos.length > 0) {
    console.warn(
      `[SkillsPasivas] "${target.title}": ${fallidos.length} de ${resultados.length} canales fallaron.`,
      fallidos,
    );
  }
  return resultados;
}

async function deliverToChannel(
  channel: SkillChannel,
  text: string,
  target: DeliveryTarget,
  context: DeliveryContext,
): Promise<DeliveryOutcome> {
  try {
    switch (channel) {
      case 'whatsapp': {
        if (!context.sendWhatsApp) return fallo(channel, 'WhatsApp no esta conectado.');
        const phoneNumber = String(target.phoneNumber || '').replace(/\D/g, '');
        if (!phoneNumber) return fallo(channel, 'La regla no tiene un numero de WhatsApp al que escribir.');
        await context.sendWhatsApp(phoneNumber, text);
        return { channel, ok: true };
      }
      case 'telegram': {
        if (!context.sendTelegram) return fallo(channel, 'Telegram no esta vinculado.');
        await context.sendTelegram(text);
        return { channel, ok: true };
      }
      case 'escritorio': {
        if (!context.announceOnOrb) return fallo(channel, 'La orbe no esta disponible.');
        await context.announceOnOrb(text, { title: target.title });
        return { channel, ok: true };
      }
      default:
        return fallo(channel, 'Canal desconocido.');
    }
  } catch (error) {
    return fallo(channel, error instanceof Error ? error.message : String(error));
  }
}

function fallo(channel: SkillChannel, reason: string): DeliveryOutcome {
  return { channel, ok: false, reason };
}
