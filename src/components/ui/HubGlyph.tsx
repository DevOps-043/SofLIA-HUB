import type { SVGProps } from 'react';
import { IconGlyph } from './IconGlyph';

export type HubGlyphName = 'summary' | 'tasks' | 'files' | 'web' | 'chats' | 'chat' | 'milestones' | 'cycles' | 'teams' | 'metrics' | 'activity' | 'browser' | 'folder' | 'back' | 'plus' | 'settings' | 'identity' | 'appearance' | 'sun' | 'moon' | 'monitor' | 'shield' | 'memory' | 'voice' | 'connection' | 'logout' | 'check' | 'chevron' | 'close' | 'arrow' | 'download' | 'history' | 'lock' | 'search' | 'bookmark' | 'split' | 'warning' | 'refresh';

/** Siluetas canónicas de Proyectos, compartidas por el renderer. */
export function HubGlyph({ name, size = 20, className = '', ...props }: Omit<SVGProps<SVGSVGElement>, 'name'> & { name: HubGlyphName; size?: number }) {
  const glyphs = {
    settings: <><path d="m10 3-.7 2.5-2.1 1.2-2.5-.6-2 3.5 1.8 1.9v2.4l-1.8 1.9 2 3.5 2.5-.6 2.1 1.2L10 22h4l.7-2.6 2.1-1.2 2.5.6 2-3.5-1.8-1.9V11l1.8-1.9-2-3.5-2.5.6-2.1-1.2L14 3Z" fill="currentColor" fillOpacity=".1" /><circle cx="12" cy="12.5" r="3.5" /></>,
    identity: <><rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor" fillOpacity=".09" /><circle cx="12" cy="9" r="3" fill="currentColor" fillOpacity=".18" /><path d="M7 18a5 5 0 0 1 10 0" /></>,
    appearance: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M12 3v18H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Z" fill="currentColor" fillOpacity=".18" /><path d="M16 8h1M16 12h1M16 16h1" /></>,
    sun: <><circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity=".2" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>,
    moon: <><path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" fill="currentColor" fillOpacity=".18" /><path d="m17 3 .8 2.2L20 6l-2.2.8L17 9l-.8-2.2L14 6l2.2-.8Z" fill="currentColor" stroke="none" /></>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="3" fill="currentColor" fillOpacity=".12" /><path d="M8 21h8M12 17v4M7 8h5" /></>,
    shield: <><path d="m12 3 8 3v6c0 4-3 7-8 9-5-2-8-5-8-9V6Z" fill="currentColor" fillOpacity=".12" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
    memory: <><rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" fillOpacity=".14" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /><rect x="9" y="9" width="6" height="6" rx="1" /></>,
    voice: <><rect x="9" y="3" width="6" height="12" rx="3" fill="currentColor" fillOpacity=".18" /><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M9 22h6" /></>,
    connection: <><path d="m9 8-3 3a4 4 0 0 0 6 6l2-2M15 16l3-3a4 4 0 0 0-6-6l-2 2M9 15l6-6" /><circle cx="5" cy="5" r="3" fill="currentColor" fillOpacity=".18" stroke="none" /><circle cx="19" cy="19" r="3" fill="currentColor" fillOpacity=".18" stroke="none" /></>,
    logout: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" fill="currentColor" fillOpacity=".12" /><path d="M9 12h12m-4-4 4 4-4 4" /></>,
    check: <><circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity=".12" /><path d="m8 12 3 3 5-6" /></>,
    chevron: <path d="m8 10 4 4 4-4" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    download: <><path d="M3 16v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" fill="currentColor" fillOpacity=".12" /><path d="M12 3v12m-5-5 5 5 5-5" /></>,
    history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7" /><path d="M12 7v5l3 2" /><circle cx="12" cy="12" r="6" fill="currentColor" fillOpacity=".07" stroke="none" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="3" fill="currentColor" fillOpacity=".12" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    search: <><circle cx="10.5" cy="10.5" r="7" fill="currentColor" fillOpacity=".1" /><path d="m16 16 5 5" /></>,
    bookmark: <path d="M6 3h12v18l-6-4-6 4Z" fill="currentColor" fillOpacity=".13" />,
    split: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M12 4v16" /><path d="M4 5h7v14H4Z" fill="currentColor" fillOpacity=".14" stroke="none" /></>,
    warning: <><path d="m10 4-8 14a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3L14 4a2.3 2.3 0 0 0-4 0Z" fill="currentColor" fillOpacity=".12" /><path d="M12 9v4M12 17h.01" /></>,
    refresh: <><path d="M20 8a9 9 0 0 0-15-3L3 8m0-5v5h5M4 16a9 9 0 0 0 15 3l2-3m0 5v-5h-5" /><circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity=".18" stroke="none" /></>,
    summary: <><rect x="3" y="3" width="7" height="8" rx="2" fill="currentColor" fillOpacity=".2" stroke="none" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="3" y="15" width="7" height="6" rx="1.5" /><path d="M14 12h7M14 16h5M14 20h7" /></>,
    tasks: <><rect x="3" y="4" width="18" height="16" rx="3" fill="currentColor" fillOpacity=".1" /><path d="M9 4v16M15 4v16" /><path d="M5.8 8h.4M5.8 11h.4M11.8 8h.4M11.8 11h.4M11.8 14h.4M17.8 8h.4" strokeWidth="2.3" /></>,
    files: <><path d="M8 3h8l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="currentColor" fillOpacity=".12" /><path d="M15 3v5h5M3 7v11a3 3 0 0 0 3 3M10 12h6M10 16h4" /></>,
    web: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18" /><path d="M7 6.5h.01M10 6.5h.01" strokeWidth="2.2" /><path d="m9 15 3-3h5v5M11 18l6-6" /><path d="M4 9h16V6a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1Z" fill="currentColor" fillOpacity=".12" stroke="none" /></>,
    chats: <><path d="M5 4h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9l-5 3v-4a3 3 0 0 1-2-3V7a3 3 0 0 1 3-3Z" fill="currentColor" fillOpacity=".12" /><path d="M20 8a3 3 0 0 1 2 3v6a3 3 0 0 1-2 2v3l-5-3h-3M6 8h8M6 12h5" /></>,
    milestones: <><path d="M12 3v17M5 21h14" /><path d="M12 4h8l-2.5 4L20 12h-8Z" fill="currentColor" fillOpacity=".16" /><circle cx="6" cy="9" r="2" fill="currentColor" fillOpacity=".18" stroke="none" /><path d="M6 13v3a2 2 0 0 0 2 2h4" strokeDasharray="2 3" /></>,
    cycles: <><path d="M12 3a9 9 0 1 1-8.6 11.7M3.4 9.3A9 9 0 0 1 8 3.9" /><circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity=".14" /><circle cx="12" cy="3" r="2" fill="currentColor" stroke="none" /><path d="m10.5 12 1 1 2-2" /></>,
    teams: <><circle cx="12" cy="7" r="3" fill="currentColor" fillOpacity=".16" /><path d="M6.5 20v-2a5.5 5.5 0 0 1 11 0v2Z" fill="currentColor" fillOpacity=".12" /><path d="M5.2 5.5a2.5 2.5 0 0 0 0 5M18.8 5.5a2.5 2.5 0 0 1 0 5M3 18v-2a3.5 3.5 0 0 1 2-3.2M21 18v-2a3.5 3.5 0 0 0-2-3.2" /></>,
    metrics: <><path d="M3 4v14a3 3 0 0 0 3 3h15" /><path d="M7 17v-4M12 17V9M17 17V5" strokeWidth="3" strokeOpacity=".25" /><path d="m6 10 5-4 4 1 5-4M17 3h3v3" /></>,
    activity: <><rect x="2.5" y="4" width="19" height="16" rx="4" fill="currentColor" fillOpacity=".08" /><path d="M5.5 12H8l2-4 3 8 2-4h3.5" /><circle cx="18.5" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
    folder: <><path d="M3 7V6a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" fill="currentColor" fillOpacity=".12" /><path d="M3 10h18" /></>,
    back: <path d="m10 6-6 6 6 6M4 12h16" />,
    plus: <path d="M12 5v14M5 12h14" />,
  };
  const key = name === 'browser' ? 'web' : name === 'chat' ? 'chats' : name;
  return <IconGlyph className={className} aria-hidden="true" data-glyph={key} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" {...props}>{glyphs[key]}</IconGlyph>;
}
