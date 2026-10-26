import type { ProjectSection } from './types';

/** Iconos propios del proyecto con planos de color y siluetas diferenciadas. */
export function ProjectGlyph({ name, size = 20 }: { name: ProjectSection | 'browser' | 'folder' | 'back' | 'plus'; size?: number }) {
  const glyphs = {
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
  return <svg className="project-glyph" aria-hidden="true" data-glyph={key} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{glyphs[key]}</svg>;
}
