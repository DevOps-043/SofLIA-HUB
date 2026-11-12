import avatarBadge from '../../../assets/soflia-avatar/badge-idle.png';
import { type AudioFeatureRefs } from '../../../components/orb/useAudioFeatures';
import { createContext, useContext, type ReactNode } from 'react';
import { SofliaAvatar } from '../../../components/avatar/SofliaAvatar';
import { type AvatarExpression } from '../../../components/avatar/avatar-model';
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

/** La última respuesta concentra los gestos; el historial conserva una imagen ligera. */
export function ChatProfileAvatar({ active = false }: { active?: boolean }) {
  return <div className="chat-avatar-profile" data-live={active}>
    {active ? <ChatAvatar /> : <img src={avatarBadge} alt="SofLIA" draggable={false} />}
  </div>;
}
