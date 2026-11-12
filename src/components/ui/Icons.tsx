import { IconGlyph } from './IconGlyph';
import { HubGlyph } from './HubGlyph';

export interface IconProps {
  className?: string;
  size?: number;
  fill?: string;
}

export function CopyIcon({ className = '', size = 14 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="8" y="8" width="13" height="13" rx="2.5" fill="currentColor" fillOpacity=".14" />
      <rect x="8" y="8" width="13" height="13" rx="2.5" />
      <path d="M4 16V5a2 2 0 0 1 2-2h11" />
      <path d="M12 12h5M12 16h3" strokeWidth={1.5} />
    </IconGlyph>
  );
}

export function CheckIcon({ className = '', size = 14 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </IconGlyph>
  );
}

export function RefreshIcon({ className = '', size = 14 }: IconProps) {
  return (
    <IconGlyph data-motion="refresh" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity=".16" stroke="none" />
      <path d="M3 12a9 9 0 0 1 9-9 9.8 9.8 0 0 1 6.7 2.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.8 9.8 0 0 1-6.7-2.7L3 16" />
      <path d="M3 21v-5h5" />
    </IconGlyph>
  );
}

export function ThumbsUpIcon({ className = '', size = 14, fill = 'none' }: IconProps) {
  const isFilled = fill !== 'none';
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 10h-3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3" fill="currentColor" fillOpacity={isFilled ? '1' : '.16'} />
      <path d="M7 10v11" strokeWidth={2} />
      <path d="M7 21h9.5a2.5 2.5 0 0 0 2.4-1.8l2-7A2 2 0 0 0 19 9.5h-5.5l.8-4.2a2 2 0 0 0-3.3-1.8L7 10" fill={isFilled ? 'currentColor' : 'none'} />
    </IconGlyph>
  );
}

export function ThumbsDownIcon({ className = '', size = 14, fill = 'none' }: IconProps) {
  const isFilled = fill !== 'none';
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 14h-3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3" fill="currentColor" fillOpacity={isFilled ? '1' : '.16'} />
      <path d="M7 14V3" strokeWidth={2} />
      <path d="M7 3h9.5a2.5 2.5 0 0 1 2.4 1.8l2 7A2 2 0 0 1 19 14.5h-5.5l.8 4.2a2 2 0 0 1-3.3 1.8L7 14" fill={isFilled ? 'currentColor' : 'none'} />
    </IconGlyph>
  );
}

export function EditIcon({ className = '', size = 14 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" fill="currentColor" fillOpacity=".14" />
      <path d="m14.5 5.5 3 3" />
      <circle cx="18" cy="5" r="0.8" fill="currentColor" stroke="none" />
    </IconGlyph>
  );
}

export function ImageIcon({ className = '', size = 14 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3.5" fill="currentColor" fillOpacity=".1" />
      <circle cx="8.5" cy="8.5" r="2.2" fill="currentColor" fillOpacity=".2" stroke="none" />
      <circle cx="8.5" cy="8.5" r="2.2" />
      <path d="M3 18.5 8.5 13l4 4 2-2 6.5 6.5V19a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 19Z" fill="currentColor" fillOpacity=".14" stroke="none" />
      <path d="M3 18l5.5-5.5 4 4" />
      <path d="m11.5 15.5 3-3 6.5 6.5" />
      <path d="m18 3.5.7 1.4 1.4.7-1.4.7-.7 1.4-.7-1.4-1.4-.7 1.4-.7Z" fill="currentColor" fillOpacity=".3" stroke="none" />
    </IconGlyph>
  );
}

export function SparklesIcon({ className = '', size = 14 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 2.5 2.3 5.2 5.2 2.3-5.2 2.3L12 17.5l-2.3-5.2L4.5 10l5.2-2.3Z" fill="currentColor" fillOpacity=".16" />
      <circle cx="12" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <path d="m19 15 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z" fill="currentColor" fillOpacity=".25" stroke="none" />
      <path d="m5 16 .8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8Z" fill="currentColor" fillOpacity=".2" stroke="none" />
    </IconGlyph>
  );
}

export function DocumentIcon({ className = '', size = 14 }: IconProps) {
  return <HubGlyph name="files" size={size} className={className} />;
}

export function ToolsIcon({ className = '', size = 14 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="7" width="18" height="13" rx="3" fill="currentColor" fillOpacity=".1" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 11h18" />
      <rect x="10" y="10" width="4" height="3" rx="1" fill="currentColor" fillOpacity=".25" stroke="none" />
      <path d="M10 10h4v3h-4z" />
      <circle cx="6.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </IconGlyph>
  );
}

export function PaperclipIcon({ className = '', size = 14 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.4 11-8.8 8.8a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.8 3.8 0 0 1 5.4 5.4l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.2-8.2" />
      <path d="m10.2 12.8 2.8-2.8a2 2 0 0 1 2.8 2.8l-4.5 4.5" fill="currentColor" fillOpacity=".15" stroke="none" />
    </IconGlyph>
  );
}

export function BrowserShortcutIcon({ className = '', size = 14 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4" width="18" height="16" rx="3" fill="currentColor" fillOpacity=".1" />
      <path d="M3 9h18" />
      <path d="M4 9h16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2Z" fill="currentColor" fillOpacity=".12" stroke="none" />
      <circle cx="6.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <path d="m9 13.5 2.5 2.5-2.5 2.5M13.5 18.5h3" strokeWidth={2} />
    </IconGlyph>
  );
}

export function TabsIcon({ className = '', size = 14 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="5" width="18" height="15" rx="3" fill="currentColor" fillOpacity=".1" />
      <path d="M3 10h18" />
      <path d="M4 10h6V7a1.5 1.5 0 0 0-1.5-1.5H5.5A1.5 1.5 0 0 0 4 7Z" fill="currentColor" fillOpacity=".2" stroke="none" />
      <path d="M4 10V7a1.5 1.5 0 0 1 1.5-1.5H8.5A1.5 1.5 0 0 1 10 7v3" />
      <path d="M11 6.5h3" strokeWidth={1.5} strokeOpacity=".5" />
      <path d="M7 14h5M7 17h8" strokeWidth={1.6} />
      <circle cx="17.5" cy="15.5" r="1.5" fill="currentColor" fillOpacity=".25" stroke="none" />
      <path d="M17.5 13.5v4M15.5 15.5h4" strokeWidth={1.6} />
    </IconGlyph>
  );
}

export function AppsIcon({ className = '', size = 14 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="14" rx="3" fill="currentColor" fillOpacity=".1" />
      <rect x="6" y="6" width="4" height="3.5" rx="1" fill="currentColor" fillOpacity=".25" stroke="none" />
      <rect x="14" y="6" width="4" height="3.5" rx="1" fill="currentColor" fillOpacity=".25" stroke="none" />
      <rect x="6" y="11" width="4" height="3.5" rx="1" fill="currentColor" fillOpacity=".25" stroke="none" />
      <rect x="14" y="11" width="4" height="3.5" rx="1" fill="currentColor" fillOpacity=".25" stroke="none" />
      <path d="M6 6h4v3.5H6zM14 6h4v3.5h-4zM6 11h4v3.5H6zM14 11h4v3.5h-4z" strokeWidth={1.4} />
      <path d="M9 21h6M12 17v4" strokeWidth={1.8} />
    </IconGlyph>
  );
}

export function NewChatIcon({ className = '', size = 18 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 4H6a2.5 2.5 0 0 0-2.5 2.5v11A2.5 2.5 0 0 0 6 20h11a2.5 2.5 0 0 0 2.5-2.5v-6" fill="currentColor" fillOpacity=".12" />
      <path d="M8 9.5h4M8 13.5h2" strokeWidth={1.5} />
      <path d="M18.8 3.2a2.1 2.1 0 0 1 3 3L11.5 16.5l-4 1 1-4Z" fill="currentColor" fillOpacity=".2" />
      <path d="m15.5 6.5 3 3" />
      <circle cx="18.5" cy="4.5" r="0.8" fill="currentColor" stroke="none" />
    </IconGlyph>
  );
}

export function NewFolderIcon({ className = '', size = 18 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 7V6a2 2 0 0 1 2-2h4l2.5 2.5h7.5a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" fill="currentColor" fillOpacity=".12" />
      <path d="M3 10h18" />
      <circle cx="12" cy="15" r="4.5" fill="currentColor" fillOpacity=".14" stroke="none" />
      <path d="M12 12.5v5M9.5 15h5" strokeWidth={2} />
    </IconGlyph>
  );
}

export function SearchIcon({ className = '', size = 16 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="7.5" fill="currentColor" fillOpacity=".12" />
      <path d="m16.5 16.5 4.5 4.5" strokeWidth={2} />
      <path d="M8 10.5a3 3 0 0 1 3-3" strokeWidth={1.5} strokeLinecap="round" strokeOpacity=".5" />
    </IconGlyph>
  );
}

export function MicIcon({ className = '', size = 16 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" fillOpacity=".15" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
      <path d="M10 7h4" strokeWidth={1.5} strokeOpacity=".5" />
    </IconGlyph>
  );
}

export function SendIcon({ className = '', size = 16 }: IconProps) {
  return (
    <IconGlyph data-motion="send" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 12h14M12 5l7 7-7 7" />
      <path d="m13 6 6 6-6 6" fill="currentColor" fillOpacity=".2" stroke="none" />
    </IconGlyph>
  );
}

export function PlusIcon({ className = '', size = 16 }: IconProps) {
  return (
    <IconGlyph data-motion="plus" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="8.5" fill="currentColor" fillOpacity=".1" stroke="none" />
      <path d="M12 5v14M5 12h14" />
    </IconGlyph>
  );
}

export function ChatBubbleIcon({ active = false, className = '', size = 16 }: { active?: boolean; className?: string; size?: number }) {
  return <HubGlyph name="chats" size={size} className={className} strokeWidth={active ? 1.85 : 1.65} />;
}

export function FolderIcon({ active = false, isExpanded = false, className = '', size = 16 }: { active?: boolean; isExpanded?: boolean; className?: string; size?: number }) {
  return <HubGlyph name="folder" size={size} className={className} strokeWidth={active || isExpanded ? 1.85 : 1.65} />;
}

export function BrowserNavIcon({ className = '', size = 18 }: IconProps) {
  return <HubGlyph name="web" size={size} className={className} />;
}

export function MeetingsNavIcon({ className = '', size = 18 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="5" width="18" height="15" rx="3" fill="currentColor" fillOpacity=".1" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <circle cx="12" cy="14.5" r="3" fill="currentColor" fillOpacity=".16" stroke="none" />
      <circle cx="12" cy="14.5" r="3" />
      <path d="M12 13v1.6l1.2.7" strokeWidth={1.5} />
    </IconGlyph>
  );
}

export function PinIcon({ className = '', size = 14, pinned = false }: IconProps & { pinned?: boolean }) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 17v5M5 17h14l-2-7V4a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v6z" fill="currentColor" fillOpacity={pinned ? '.25' : '.12'} />
      <path d="M5 17h14M8 3h8" strokeWidth={2} />
    </IconGlyph>
  );
}

export function ChevronRightIcon({ className = '', size = 14 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 18 6-6-6-6" />
    </IconGlyph>
  );
}

export function MoreIcon({ className = '', size = 14 }: IconProps) {
  return (
    <IconGlyph width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
    </IconGlyph>
  );
}
