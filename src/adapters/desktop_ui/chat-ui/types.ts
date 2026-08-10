import type { ChatMessage } from '../../../services/chat-service';

export type OptimizerTarget = 'chatgpt' | 'claude' | 'gemini';

export type ProcessMessageHandler = (
  text: string,
  images: string[],
  currentHistory: ChatMessage[],
  isRegeneration?: boolean,
) => Promise<void>;

export interface ConfirmationModalState {
  toolName: string;
  description: string;
  resolve: (confirmed: boolean) => void;
}

export interface ChatUIProps {
  compact?: boolean;
  /** Conversacion activa; asocia el espacio de trabajo de una Skill a ella. */
  conversationId?: string | null;
  /**
   * El navegador integrado esta abierto. Una Skill puede leer la pagina en
   * vez de preguntarle al usuario de que trata.
   */
  browserOpen?: boolean;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  personalization?: {
    nickname?: string;
    occupation?: string;
    tone?: string;
    instructions?: string;
  };
  userAvatar?: string | null;
  externalPrompt?: string | null;
  onExternalPromptProcessed?: () => void;
  /**
   * Seleccion que el menu contextual del navegador adjunta al compositor. No
   * dispara ningun envio: queda visible sobre la barra hasta que el usuario
   * escribe su peticion o la descarta.
   */
  externalSelection?: BrowserSelectionAttachment | null;
  onExternalSelectionProcessed?: () => void;
  onShare?: () => void;
  canSendMessages?: boolean;
  readOnlyReason?: string | null;
  onOpenBrowser?: () => void;
  onOpenMeetings?: () => void;
  onOpenSdo?: () => void;
}

export interface BrowserSelectionAttachment {
  action: 'ask' | 'improve' | 'translate' | 'summarize';
  text: string;
  title: string;
  instruction: string;
}
