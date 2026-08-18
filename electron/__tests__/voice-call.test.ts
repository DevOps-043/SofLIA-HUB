import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { splitForSpeech } from '../voice-call/speech';
import { VoiceCallSessionStore } from '../voice-call/session-store';
import { readVoiceCallConfig, VOICE_NOTE_MAX_CHARS } from '../voice-call/config';
import { closeVoiceCall, deliverAgentReply, openVoiceCall } from '../voice-call/delivery';
import type { VoiceCallTransport } from '../voice-call/delivery';

const ORIGINAL_ENV = { ...process.env };

function buildTransport(): VoiceCallTransport & {
  texts: string[];
  notes: Array<{ bytes: number; seconds: number }>;
} {
  const texts: string[] = [];
  const notes: Array<{ bytes: number; seconds: number }> = [];
  return {
    channel: 'whatsapp',
    chatId: '5215500000000@s.whatsapp.net',
    texts,
    notes,
    sendText: async (text) => { texts.push(text); },
    sendVoiceNote: async (audio, seconds) => { notes.push({ bytes: audio.length, seconds }); },
  };
}

/** Respuesta OGG/Opus creíble sin llamar al proveedor. */
function mockElevenLabsOk(): void {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(24_000), { status: 200 })));
}

function mockElevenLabsFailure(status: number, detail: unknown): void {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail }), { status })));
}

beforeEach(() => {
  process.env.ELEVENLABS_API_KEY = 'clave-de-prueba';
  process.env.ELEVENLABS_VOICE_ID = 'voz-de-prueba-1234';
  delete process.env.VOICE_CALL_ENABLED;
  delete process.env.VOICE_CALL_IDLE_TIMEOUT_MS;
  delete process.env.VOICE_CALL_VOICE_ID;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  process.env = { ...ORIGINAL_ENV };
});

describe('VC-001 recorte del texto hablado', () => {
  it('habla completo lo que cabe en el limite', () => {
    const { spoken, remainder } = splitForSpeech('  Listo,   ya   revise tu correo. ');
    expect(spoken).toBe('Listo, ya revise tu correo.');
    expect(remainder).toBe('');
  });

  it('corta en el final de una oracion y devuelve el resto escrito', () => {
    const primera = `${'a'.repeat(VOICE_NOTE_MAX_CHARS - 200)}. `;
    const { spoken, remainder } = splitForSpeech(`${primera}${'b'.repeat(400)}`);
    expect(spoken.endsWith('.')).toBe(true);
    expect(spoken.length).toBeLessThanOrEqual(VOICE_NOTE_MAX_CHARS);
    expect(remainder).toBe('b'.repeat(400));
  });

  it('nunca descarta contenido al recortar', () => {
    const fuente = 'palabra '.repeat(400).trim();
    const { spoken, remainder } = splitForSpeech(fuente);
    expect(`${spoken} ${remainder}`.trim()).toBe(fuente);
  });
});

describe('VC-002 ciclo de vida de la sesion', () => {
  it('reabrir una sesion viva no reinicia sus turnos', () => {
    const store = new VoiceCallSessionStore();
    store.open('whatsapp', 'chat-1', 'command');
    store.recordSpokenTurn('whatsapp', 'chat-1');
    const reabierta = store.open('whatsapp', 'chat-1', 'voice-message');
    expect(reabierta.spokenTurns).toBe(1);
    expect(reabierta.openReason).toBe('command');
  });

  it('caduca por inactividad', () => {
    vi.useFakeTimers();
    process.env.VOICE_CALL_IDLE_TIMEOUT_MS = '60000';
    const store = new VoiceCallSessionStore();
    store.open('whatsapp', 'chat-1', 'command');
    expect(store.isActive('whatsapp', 'chat-1')).toBe(true);
    vi.advanceTimersByTime(61_000);
    expect(store.isActive('whatsapp', 'chat-1')).toBe(false);
  });

  it('mantiene separadas las sesiones de cada canal', () => {
    const store = new VoiceCallSessionStore();
    store.open('whatsapp', 'chat-1', 'command');
    store.open('telegram', 'chat-1', 'command');
    expect(store.closeChannel('whatsapp')).toBe(1);
    expect(store.isActive('telegram', 'chat-1')).toBe(true);
  });

  it('avisa de la caida a texto una sola vez por sesion', () => {
    const store = new VoiceCallSessionStore();
    store.open('whatsapp', 'chat-1', 'command');
    expect(store.claimDegradedNotice('whatsapp', 'chat-1')).toBe(true);
    expect(store.claimDegradedNotice('whatsapp', 'chat-1')).toBe(false);
  });
});

describe('VC-003 entrega hablada', () => {
  it('escribe cuando no hay llamada abierta', async () => {
    mockElevenLabsOk();
    const transport = buildTransport();
    await deliverAgentReply(transport, 'Respuesta escrita.');
    expect(transport.notes).toHaveLength(0);
    expect(transport.texts).toEqual(['Respuesta escrita.']);
  });

  it('habla el turno que llego por voz aunque no haya comando previo', async () => {
    mockElevenLabsOk();
    const transport = buildTransport();
    await deliverAgentReply(transport, 'Te respondo hablando.', { forceVoice: true });
    expect(transport.notes).toHaveLength(1);
    expect(transport.notes[0].seconds).toBe(3);
    expect(transport.texts).toHaveLength(0);
  });

  it('entrega escrito el resto que no cupo en la voz', async () => {
    mockElevenLabsOk();
    const transport = buildTransport();
    await deliverAgentReply(transport, 'x'.repeat(VOICE_NOTE_MAX_CHARS + 300), { forceVoice: true });
    expect(transport.notes).toHaveLength(1);
    expect(transport.texts).toHaveLength(1);
  });

  it('cae a texto sin perder la respuesta cuando se agota la cuota a mitad de la conversacion', async () => {
    mockElevenLabsOk();
    const transport = buildTransport();
    await openVoiceCall(transport, 'command');
    expect(transport.notes).toHaveLength(1);

    mockElevenLabsFailure(402, { code: 'insufficient_credits' });
    await deliverAgentReply(transport, 'Contenido que no puede perderse.');
    expect(transport.notes).toHaveLength(1);
    expect(transport.texts[0]).toBe('Contenido que no puede perderse.');
    expect(transport.texts[1]).toMatch(/créditos/i);

    await deliverAgentReply(transport, 'Segunda respuesta.');
    expect(transport.texts.filter((text) => /créditos/i.test(text))).toHaveLength(1);
  });

  it('no filtra el cuerpo interno del proveedor', async () => {
    mockElevenLabsFailure(400, { message: 'api-key-secreta' });
    const transport = buildTransport();
    await deliverAgentReply(transport, 'Hola.', { forceVoice: true });
    expect(transport.texts.join(' ')).not.toMatch(/api-key-secreta/);
  });

  it('vuelve a texto con el modo llamada desactivado', async () => {
    process.env.VOICE_CALL_ENABLED = 'false';
    mockElevenLabsOk();
    const transport = buildTransport();
    await deliverAgentReply(transport, 'Hola.', { forceVoice: true });
    expect(transport.notes).toHaveLength(0);
    expect(transport.texts).toEqual(['Hola.']);
  });
});

describe('VC-004 apertura y cierre', () => {
  it('saluda hablando al abrir y despide por escrito al colgar', async () => {
    mockElevenLabsOk();
    const transport = buildTransport();

    await openVoiceCall(transport, 'incoming-call');
    expect(transport.notes).toHaveLength(1);

    await deliverAgentReply(transport, 'Ya lo busque.');
    expect(transport.notes).toHaveLength(2);

    expect(await closeVoiceCall(transport)).toBe(true);
    expect(transport.texts[transport.texts.length - 1]).toMatch(/colgado/i);
    await deliverAgentReply(transport, 'Y esto va escrito.');
    expect(transport.notes).toHaveLength(2);
  });

  it('colgar sin llamada abierta lo dice en vez de fingir', async () => {
    const transport = buildTransport();
    expect(await closeVoiceCall(transport)).toBe(false);
    expect(transport.texts[0]).toMatch(/no hay una llamada activa/i);
  });
});

describe('VC-005 configuracion', () => {
  it('viene habilitado y solo un false explicito lo apaga', () => {
    expect(readVoiceCallConfig().enabled).toBe(true);
    process.env.VOICE_CALL_ENABLED = 'false';
    expect(readVoiceCallConfig().enabled).toBe(false);
  });

  it('descarta una voz mal escrita en vez de propagarla', () => {
    process.env.VOICE_CALL_VOICE_ID = 'no valida!';
    expect(readVoiceCallConfig().voiceId).toBe('');
  });

  it('acota el plazo de inactividad a un rango razonable', () => {
    process.env.VOICE_CALL_IDLE_TIMEOUT_MS = '1';
    expect(readVoiceCallConfig().idleTimeoutMs).toBe(60_000);
    process.env.VOICE_CALL_IDLE_TIMEOUT_MS = '999999999';
    expect(readVoiceCallConfig().idleTimeoutMs).toBe(3_600_000);
  });
});
