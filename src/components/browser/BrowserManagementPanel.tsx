import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  integratedBrowserService,
  type BrowserCredentialMetadata,
  type BrowserExtensionMetadata,
  type BrowserHistoryEntry,
  type IntegratedBrowserDataResponse,
} from '../../services/integrated-browser-service';

export type BrowserManagementTab = 'history' | 'credentials' | 'extensions';

export function BrowserManagementPanel(props: { tab: BrowserManagementTab }) {
  if (props.tab === 'history') return <HistoryPanel />;
  if (props.tab === 'credentials') return <CredentialsPanel />;
  return <ExtensionsPanel />;
}

function HistoryPanel() {
  const [entries, setEntries] = useState<BrowserHistoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    const response = await integratedBrowserService.listHistory(search, 100);
    setLoading(false);
    if (!response.success) return setError(response.error || 'No se pudo cargar el historial.');
    setError(null);
    setEntries(response.history ?? []);
  }, []);

  useEffect(() => { void load(''); }, [load]);

  const clear = async () => {
    const response = await integratedBrowserService.clearHistory();
    consume(response, setError);
    if (response.success && response.cleared) setEntries([]);
  };

  return (
    <ManagementSection title="Historial" actions={<button className="text-xs font-semibold text-danger" onClick={() => void clear()}>Borrar</button>}>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void load(query); }}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en historial" className={inputClass} />
        <button className={secondaryButtonClass}>Buscar</button>
      </form>
      {error && <ErrorNotice message={error} />}
      <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
        {loading ? <Empty text="Cargando historial..." /> : entries.length === 0 ? <Empty text="Sin historial" /> : entries.map((entry) => (
          <button key={entry.id} type="button" onClick={() => void integratedBrowserService.navigate(entry.url)} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-white/[0.05]">
            <div className="truncate text-xs font-semibold text-gray-800 dark:text-white/85">{entry.title || entry.url}</div>
            <div className="truncate text-[11px] text-gray-500 dark:text-white/45">{entry.url}</div>
          </button>
        ))}
      </div>
    </ManagementSection>
  );
}

function CredentialsPanel() {
  const [credentials, setCredentials] = useState<BrowserCredentialMetadata[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await integratedBrowserService.listCredentials();
    if (!response.success) return setError(response.error || 'No se pudieron cargar las contrasenas.');
    setError(null);
    setCredentials(response.credentials ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const response = await integratedBrowserService.saveCredential({ username, password });
    if (!consume(response, setError)) return;
    setPassword('');
    await load();
  };

  const fill = async (id: string) => {
    consume(await integratedBrowserService.fillCredential(id), setError);
  };

  const remove = async (id: string) => {
    const response = await integratedBrowserService.removeCredential(id);
    if (consume(response, setError) && response.removed) await load();
  };

  return (
    <ManagementSection title="Contrasenas">
      <form className="grid grid-cols-[1fr_1fr_auto] gap-2" onSubmit={(event) => void save(event)}>
        <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="Usuario o correo" className={inputClass} required />
        <input value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" type="password" placeholder="Contrasena" className={inputClass} required />
        <button className={primaryButtonClass}>Guardar</button>
      </form>
      <p className="mt-1 text-[11px] text-gray-500 dark:text-white/45">Cifrado por el sistema. SofLIA no muestra ni entrega el secreto al agente.</p>
      {error && <ErrorNotice message={error} />}
      <div className="mt-2 max-h-36 space-y-1 overflow-y-auto">
        {credentials.length === 0 ? <Empty text="No hay credenciales para este sitio" /> : credentials.map((credential) => (
          <div key={credential.id} className="flex items-center gap-2 rounded-lg border border-gray-200/70 px-2 py-1.5 dark:border-white/[0.07]">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-gray-800 dark:text-white/85">{credential.username}</div>
              <div className="truncate text-[11px] text-gray-500 dark:text-white/45">{credential.origin}</div>
            </div>
            <button type="button" className={secondaryButtonClass} onClick={() => void fill(credential.id)}>Rellenar</button>
            <button type="button" className="px-2 py-1 text-xs font-semibold text-danger" onClick={() => void remove(credential.id)}>Eliminar</button>
          </div>
        ))}
      </div>
    </ManagementSection>
  );
}

function ExtensionsPanel() {
  const [extensions, setExtensions] = useState<BrowserExtensionMetadata[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await integratedBrowserService.listExtensions();
    if (!response.success) return setError(response.error || 'No se pudieron cargar las extensiones.');
    setError(null);
    setExtensions(response.extensions ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const install = async () => {
    setBusy(true);
    const response = await integratedBrowserService.installExtension();
    setBusy(false);
    if (consume(response, setError) && !response.canceled) await load();
  };
  const toggle = async (extension: BrowserExtensionMetadata) => {
    if (consume(await integratedBrowserService.setExtensionEnabled(extension.installId, !extension.enabled), setError)) await load();
  };
  const remove = async (installId: string) => {
    const response = await integratedBrowserService.removeExtension(installId);
    if (consume(response, setError) && response.removed) await load();
  };

  return (
    <ManagementSection title="Extensiones" actions={<button type="button" disabled={busy} className={primaryButtonClass} onClick={() => void install()}>{busy ? 'Revisando...' : 'Instalar carpeta'}</button>}>
      <p className="text-[11px] text-gray-500 dark:text-white/45">Solo carpetas Manifest V3 desempaquetadas; Chrome Web Store y archivos CRX no son compatibles.</p>
      {error && <ErrorNotice message={error} />}
      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
        {extensions.length === 0 ? <Empty text="No hay extensiones instaladas" /> : extensions.map((extension) => (
          <div key={extension.installId} className="flex items-center gap-2 rounded-lg border border-gray-200/70 px-2 py-1.5 dark:border-white/[0.07]">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-gray-800 dark:text-white/85">{extension.name} <span className="font-normal text-gray-400">{extension.version}</span></div>
              <div className={`text-[11px] ${extension.status === 'error' ? 'text-danger' : 'text-gray-500 dark:text-white/45'}`}>{extension.error || (extension.enabled ? 'Activa' : 'Deshabilitada')}</div>
            </div>
            <button type="button" className={secondaryButtonClass} onClick={() => void toggle(extension)}>{extension.enabled ? 'Deshabilitar' : 'Habilitar'}</button>
            <button type="button" className="px-2 py-1 text-xs font-semibold text-danger" onClick={() => void remove(extension.installId)}>Remover</button>
          </div>
        ))}
      </div>
    </ManagementSection>
  );
}

function ManagementSection(props: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-gray-200/80 bg-gray-50/95 px-3 py-2 dark:border-white/[0.08] dark:bg-[#111820]/95">
      <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-gray-800 dark:text-white">{props.title}</h3>{props.actions}</div>
      {props.children}
    </section>
  );
}

function consume(response: IntegratedBrowserDataResponse, setError: (value: string | null) => void): boolean {
  if (!response.success) {
    setError(response.error || 'No se pudo completar la operacion.');
    return false;
  }
  setError(null);
  return true;
}

function ErrorNotice({ message }: { message: string }) {
  return <div role="alert" className="mt-2 rounded-lg bg-danger/10 px-2 py-1 text-xs text-danger">{message}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="py-4 text-center text-xs text-gray-400 dark:text-white/35">{text}</div>;
}

const inputClass = 'min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800 outline-none focus:border-accent dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white';
const primaryButtonClass = 'rounded-lg bg-[#0A2540] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50 dark:bg-accent dark:text-on-accent';
const secondaryButtonClass = 'rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-white/[0.08] dark:text-white/70 dark:hover:bg-white/[0.05]';
