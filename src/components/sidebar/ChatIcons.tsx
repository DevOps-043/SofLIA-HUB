import { IconGlyph } from '../ui/IconGlyph';
import { ChatBubbleIcon as SharedChatBubbleIcon } from '../ui/Icons';
export { EditIcon, MoreIcon } from '../ui/Icons';

export function ChatBubbleIcon({ size = 14, ...props }: Parameters<typeof SharedChatBubbleIcon>[0]) {
  return <SharedChatBubbleIcon size={size} {...props} />;
}

export function ShareGlyph({ owner }: { owner: boolean }) {
  return owner ? (
    <IconGlyph xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="18" cy="5" r="3" fill="currentColor" fillOpacity=".2" />
      <circle cx="6" cy="12" r="3" fill="currentColor" fillOpacity=".2" />
      <circle cx="18" cy="19" r="3" fill="currentColor" fillOpacity=".2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </IconGlyph>
  ) : (
    <IconGlyph xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="7" r="4" fill="currentColor" fillOpacity=".2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 21v-2a6.5 6.5 0 0 1 13 0v2Z" fill="currentColor" fillOpacity=".14" />
    </IconGlyph>
  );
}
