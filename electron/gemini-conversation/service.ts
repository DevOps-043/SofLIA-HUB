import { randomUUID } from 'node:crypto';
import type { OpenAIAuthority, OpenAICaller } from '../openai-runtime/types';
import type { JsonObject } from '../../src/shared/bounded-json';
import { jsonObject } from '../../src/shared/grounded-generation';
import {
  GEMINI_CALL_TIMEOUT_MS, GEMINI_HISTORY_BYTES, GEMINI_IDLE_TIMEOUT_MS, GEMINI_MAX_CALLS_PER_TURN,
  GEMINI_MAX_TURNS, GEMINI_REPLY_BYTES, type NativeGeminiFailureCode, type NativeGeminiReply,
  type NativeGeminiSend, type NativeGeminiSetup,
} from '../../src/shared/native-gemini-conversation';
import { conversationSnapshot } from './contract';
import type { GeminiConversationProvider } from './provider';

interface TurnOwner { sender: object; frame: unknown; userId: string | null }
interface Turn {
  id: string;
  owner: TurnOwner;
  authority: OpenAIAuthority;
  setup: NativeGeminiSetup;
  calls: number;
  busy: boolean;
  timer?: ReturnType<typeof setTimeout>;
  retire(): void;
}

export function conversationFailure(code: NativeGeminiFailureCode, status?: number): NativeGeminiReply {
  return { success: false, code, ...(status === undefined ? {} : { status }) };
}

export class GeminiConversationService {
  private readonly turns = new Map<string, Turn>();
  private activeCalls = 0;

  constructor(
    private readonly bind: (caller: OpenAICaller) => OpenAIAuthority,
    private readonly provider: GeminiConversationProvider,
  ) {}

  open(owner: TurnOwner, caller: OpenAICaller, setup: NativeGeminiSetup): NativeGeminiReply {
    caller.assert();
    if (this.turns.size >= GEMINI_MAX_TURNS) return conversationFailure('BUSY');
    const authority = this.bind(caller);
    const id = randomUUID();
    const retire = () => {
      if (this.turns.get(id) !== turn) return;
      this.turns.delete(id);
      clearTimeout(turn.timer);
      authority.signal.removeEventListener('abort', retire);
      authority.dispose();
    };
    const turn: Turn = { id, owner, authority, setup, calls: 0, busy: false, retire };
    this.turns.set(id, turn);
    authority.signal.addEventListener('abort', retire, { once: true });
    try {
      this.assertTurn(turn);
      this.touch(turn);
      return { success: true, turnId: id };
    } catch {
      retire();
      return conversationFailure('REVOKED');
    }
  }

  close(owner: TurnOwner, id: string): NativeGeminiReply {
    const turn = this.ownedTurn(owner, id);
    if (!turn) return conversationFailure('REVOKED');
    turn.retire();
    return { success: true, closed: true };
  }

  async send(owner: TurnOwner, request: NativeGeminiSend): Promise<NativeGeminiReply> {
    const turn = this.ownedTurn(owner, request.turnId);
    if (!turn) return conversationFailure('REVOKED');
    this.assertTurn(turn);
    if (turn.busy || this.activeCalls >= GEMINI_MAX_TURNS) return conversationFailure('BUSY');
    if (turn.calls >= GEMINI_MAX_CALLS_PER_TURN) return conversationFailure('LIMIT');
    turn.calls++;
    turn.busy = true;
    this.activeCalls++;
    this.touch(turn);
    const timeout = AbortSignal.timeout(GEMINI_CALL_TIMEOUT_MS);
    const signal = AbortSignal.any([turn.authority.signal, timeout]);
    const cancelled = () => conversationFailure(timeout.aborted && !turn.authority.signal.aborted ? 'TIMEOUT' : 'REVOKED');
    const work = async (): Promise<NativeGeminiReply> => {
      try {
        signal.throwIfAborted();
        const key = await turn.authority.key(signal);
        this.assertTurn(turn);
        signal.throwIfAborted();
        const result = await this.provider(key, turn.setup, request, signal);
        this.assertTurn(turn);
        signal.throwIfAborted();
        const history = conversationSnapshot(result.history, GEMINI_HISTORY_BYTES);
        const response = conversationSnapshot(result.response, GEMINI_REPLY_BYTES);
        if (!Array.isArray(history) || !history.every((entry): entry is JsonObject => jsonObject(entry)) || !jsonObject(response)) return conversationFailure('PROVIDER_FAILED');
        turn.setup = { ...turn.setup, history };
        return { success: true, response };
      } catch (error) {
        if (signal.aborted || this.turns.get(turn.id) !== turn) return cancelled();
        const status = jsonObject(error) && typeof error.status === 'number' && [400, 401, 403, 404, 429, 500, 503].includes(error.status) ? error.status : undefined;
        return conversationFailure('PROVIDER_FAILED', status);
      } finally {
        turn.busy = false;
        this.activeCalls--;
      }
    };
    let abort!: () => void;
    const abandoned = new Promise<NativeGeminiReply>(resolve => {
      abort = () => resolve(cancelled());
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
    try { return await Promise.race([work(), abandoned]); }
    finally { signal.removeEventListener('abort', abort); }
  }

  private assertTurn(turn: Turn): void {
    turn.authority.assert();
    if (turn.authority.signal.aborted || this.turns.get(turn.id) !== turn) throw new Error('El turno ya no está vigente.');
  }
  private ownedTurn(owner: TurnOwner, id: string): Turn | undefined {
    const turn = this.turns.get(id);
    return turn && turn.owner.sender === owner.sender && turn.owner.frame === owner.frame
      && turn.owner.userId === owner.userId ? turn : undefined;
  }
  private touch(turn: Turn): void {
    clearTimeout(turn.timer);
    turn.timer = setTimeout(turn.retire, GEMINI_IDLE_TIMEOUT_MS);
    turn.timer.unref();
  }
}
