import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserVerticalTabs, BrowserGroupEditor } from '../../../src/components/browser/BrowserTabWorkspace';
import { BrowserManagementPanel } from '../../../src/components/browser/BrowserManagementPanel';
import type { BrowserBookmark, BrowserTabGroup, BrowserTabGroupColor, IntegratedBrowserTabState } from '../../../src/services/integrated-browser-service';
import type { BrowserManagementTab } from '../../../src/components/browser/BrowserManagementPanel';
import '../../../src/index.css';

const now = new Date().toISOString();
let savedBookmarks: BrowserBookmark[] = [
  { id: 'ejemplo', title: 'Documentación del equipo', url: 'https://example.com/docs', folderId: 'Trabajo/Clientes', tags: ['lectura'], position: 0, createdAt: now, updatedAt: now },
  { id: 'referencia', title: 'Referencia de prueba', url: 'https://example.org', folderId: null, tags: [], position: 1, createdAt: now, updatedAt: now },
];
let groups: BrowserTabGroup[] = [];
let tabs: IntegratedBrowserTabState[] = ['Investigación', 'Documentación', 'Notas del proyecto'].map((title, index) => ({
  id: String(index), title, url: `https://example.com/${index}`, isLoading: false, error: null, isSuspended: false, isDetached: false,
}));
let publish = () => {};
Object.defineProperty(window, 'integratedBrowser', { configurable: true, value: {
  getRuntimeDiagnostic: async () => ({ success: true, diagnostic: { appVersion: '0.9.8', electronVersion: '43.4.0', chromiumVersion: '150.0.7871.224', nodeVersion: '24.18.1', profileKind: 'authenticated', protectionLevel: 'off', managed: false, checkedAt: now } }),
  exportRuntimeDiagnostic: async () => ({ success: true, diagnosticExport: { cancelled: true, exported: false } }),
  createTabGroup: async (name: string, color: BrowserTabGroupColor) => {
    const group: BrowserTabGroup = { id: crypto.randomUUID(), name, color, collapsed: false };
    groups = [...groups, group]; publish(); return { success: true, group };
  },
  assignTabGroup: async (id: string, groupId: string | null) => {
    tabs = tabs.map((tab) => tab.id === id ? { ...tab, groupId } : tab); publish(); return { success: true };
  },
  listBookmarks: async (query = '') => ({ success: true, bookmarks: savedBookmarks.filter((bookmark) => `${bookmark.title} ${bookmark.url} ${bookmark.folderId} ${bookmark.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())) }),
  saveBookmark: async (input: Partial<BrowserBookmark> & Pick<BrowserBookmark, 'title' | 'url'>) => {
    const previous = savedBookmarks.find((bookmark) => bookmark.id === input.id);
    const bookmark: BrowserBookmark = { id: crypto.randomUUID(), position: savedBookmarks.length, tags: [], folderId: null, createdAt: now, updatedAt: now, ...previous, ...input };
    savedBookmarks = savedBookmarks.filter((item) => item.id !== bookmark.id);
    savedBookmarks.splice(bookmark.position, 0, bookmark);
    savedBookmarks = savedBookmarks.map((item, position) => ({ ...item, position }));
    return { success: true, bookmark };
  },
  removeBookmark: async (id: string) => { savedBookmarks = savedBookmarks.filter((bookmark) => bookmark.id !== id); return { success: true, removed: true }; },
  importBookmarksHtml: async () => ({ success: true, bookmarkTransfer: { cancelled: true } }),
  exportBookmarksHtml: async () => ({ success: true, bookmarkTransfer: { cancelled: true } }),
  navigate: async () => ({ success: false, error: 'Esta prueba no navega a sitios externos.' }),
} });

export function WorkspaceFixture() {
  const [, renderRevision] = useState(0);
  const [activeId, setActiveId] = useState('0');
  const [editing, setEditing] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [managementTab, setManagementTab] = useState<BrowserManagementTab>('bookmarks');
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    return () => document.documentElement.classList.remove('dark');
  }, [dark]);
  useEffect(() => {
    publish = () => renderRevision((revision) => revision + 1);
    return () => { publish = () => {}; };
  }, []);
  return <div className={dark ? 'dark' : ''}><main className="flex min-h-screen flex-col bg-background text-primary">
    <header className="flex flex-wrap items-center gap-3 border-b border-border p-4">
      <h1 className="mr-auto text-lg font-semibold">Prueba local · datos ficticios</h1>
      <button className="soflia-browser-button px-3" onClick={() => setEditing(!editing)}>Organizar grupo</button>
      <button className="soflia-browser-button px-3" onClick={() => { setManagementTab('bookmarks'); setBookmarksOpen(true); }}>Abrir marcadores</button>
      <button className="soflia-browser-button px-3" onClick={() => { setManagementTab('support'); setBookmarksOpen(true); }}>Abrir diagnóstico</button>
      <button className="soflia-browser-button px-3" onClick={() => setDark(!dark)}>Cambiar tema</button>
    </header>
    {editing && <BrowserGroupEditor tabId={activeId} groups={groups} onChanged={publish} onClose={() => setEditing(false)} />}
    <div className="flex min-h-[30rem] flex-1">
      <BrowserVerticalTabs tabs={tabs} groups={groups} activeTabId={activeId} onActivate={setActiveId}
        onClose={(id) => { tabs = tabs.filter((tab) => tab.id !== id); if (activeId === id) setActiveId(tabs[0]?.id ?? ''); publish(); }}
        onReorder={(source, target) => { const moving = tabs.find((tab) => tab.id === source); const index = tabs.findIndex((tab) => tab.id === target); if (moving && index >= 0) { tabs = tabs.filter((tab) => tab.id !== source); tabs.splice(index, 0, moving); publish(); } }} />
      <section className="min-w-0 flex-1 p-8"><h2 className="text-2xl">{tabs.find((tab) => tab.id === activeId)?.title ?? 'Sin pestañas'}</h2>
        <p className="mt-4 text-secondary">Controles reales del renderer con un puente en memoria. No prueba Electron ni guarda datos reales.</p>
      </section>
    </div>
    {bookmarksOpen && <BrowserManagementPanel tab={managementTab} onTabChange={() => {}} onClose={() => setBookmarksOpen(false)} onFillCredential={async () => ({ success: false })} />}
  </main></div>;
}
createRoot(document.getElementById('root')!).render(<WorkspaceFixture />);
