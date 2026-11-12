import { type AudioFeatureRefs } from '../../../components/orb/useAudioFeatures';
import { createContext, useContext, type ReactNode } from 'react';
import { SofliaAvatar } from '../../../components/avatar/SofliaAvatar';
import { EXPRESSION_LABELS, type AvatarExpression } from '../../../components/avatar/avatar-model';
import { useAvatarPresence } from '../../../components/avatar/useAvatarPresence';
import type { PresenceInput } from '../../../components/avatar/avatar-presence';

const AvatarContext = createContext<AvatarExpression>('idle');
const VoiceContext = createContext<AudioFeatureRefs | undefined>(undefined);

/** Una presencia viva por chat; el historial usa miniaturas para mantener fluidez. */
export function ChatAvatarProvider({ input, audioFeatures, children }: { input: PresenceInput; audioFeatures?: AudioFeatureRefs; children: ReactNode }) {
  const presence = useAvatarPresence(input);
  return <VoiceContext value={audioFeatures}><AvatarContext value={presence.expression}>{children}</AvatarContext></VoiceContext>;
}

export function ChatAvatar({ className = '' }: { className?: string }) {
  const expression = useContext(AvatarContext);
  const voice = useContext(VoiceContext);
  return <SofliaAvatar state={expression} expression={expression} className={className} audioLevel={voice?.level} audioFeatures={voice} textActivity={expression === 'speaking'} />;
}

export function ChatComposerPresence() {
  const expression = useContext(AvatarContext);
  return <div className="chat-avatar-presence">
    <ChatAvatar className="chat-avatar-presence__character" />
    <span className="chat-avatar-presence__label">SofLIA <span aria-hidden="true">·</span> {EXPRESSION_LABELS[expression]}</span>
  </div>;
}
