import { ChatAvatar } from './ChatAvatar';

export function EmptyChatState() {
  return <div className="flex flex-1 flex-col items-center justify-center px-5 py-8">
    <ChatAvatar className="chat-avatar-hero" />
    <h2 className="text-center text-2xl font-light tracking-wide text-primary dark:text-white/90">¿Cómo puedo ayudarte hoy?</h2>
    <p className="mt-3 text-center text-[13px] font-light text-secondary/70 dark:text-white/45">Tus ideas, con SofLIA a tu lado.</p>
  </div>;
}
