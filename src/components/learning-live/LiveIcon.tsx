import type { CSSProperties } from 'react';

const paths = {
  grip: <><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></>,
  fullscreen: <><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" /></>,
  captions: <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M10 9H7v6h3M18 9h-3v6h3" /></>,
  hand: <><path d="M8 12V5a2 2 0 0 1 4 0v7M12 12V4a2 2 0 0 1 4 0v8M16 12V7a2 2 0 0 1 4 0v9a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-3l-4-6a2 2 0 0 1 3-2l2 2V8" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2M8 18h2" /></>,
  video: <><rect x="3" y="5" width="12" height="14" rx="3" /><path d="m15 10 6-4v12l-6-4" /></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  back: <path d="M19 12H5m5-5-5 5 5 5" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  chat: <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0ZM7 9h10M7 13h6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2" /></>,
  book: <><path d="M12 5v16M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></>,
  micOff: <><path d="m3 3 18 18M9 9v3a3 3 0 0 0 5 2M9 5a3 3 0 0 1 6 0v5M5 10v2a7 7 0 0 0 12 5M19 10v2M12 19v3M8 22h8" /></>,
  videoOff: <><path d="m3 3 18 18M9 5h3a3 3 0 0 1 3 3v2l6-4v12l-4-3M15 19H6a3 3 0 0 1-3-3V8" /></>,
  screen: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4m-4-10 4-4 4 4M12 7v7" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8" /><circle cx="9" cy="7" r="4" /></>,
  settings: <><path d="M4 7h16M4 17h16M8 4v6M16 14v6" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4L22 2ZM22 2 11 13" /></>,
  shield: <><path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Z" /><path d="m8 12 3 3 5-6" /></>,
  sparkles: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4M18 4h4" /></>,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14s1 3 4 3 4-3 4-3M8 8h.01M16 8h.01" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M8 13h8M8 17h5" /></>,
  quiz: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m7 8 1 1 2-2M13 8h4m-10 7 1 1 2-2M13 15h4" /></>,
  pause: <><path d="M8 5v14M16 5v14" /></>,
  play: <path d="m7 3 14 9-14 9V3Z" />,
  volume: <><path d="m11 3-6 5H2v8h3l6 5V3ZM15 8a5 5 0 0 1 0 8M18 5a9 9 0 0 1 0 14" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  logout: <><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4M9 12h13m-4-4 4 4-4 4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" /></>,
};
export type LiveIconName = keyof typeof paths;
export function LiveIcon({ name, className, style }: { name: LiveIconName; className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
