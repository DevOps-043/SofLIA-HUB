import { useState, useEffect, useCallback, useRef } from 'react';
import {
  isTelegramAvailable,
  getTelegramStatus,
  updateTelegramConfig,
  testTelegramConnection,
} from '../services/telegram-service';
import type { TelegramStatusSnapshot, TelegramBotInfo } from '../services/telegram-service';

// ── Types ────────────────────────────────────────────────────────────

interface CalendarConnection {
  provider: 'google' | 'microsoft';
  email?: string;
  isActive: boolean;
}

interface WhatsAppStatus {
  connected: boolean;
  phoneNumber: string | null;
  qr: string | null;
}

type ConnectionSection = 'whatsapp' | 'telegram' | 'google' | null;

interface ConnectionsPanelProps {
  apiKey?: string;
}

// ── Component ────────────────────────────────────────────────────────

export function ConnectionsPanel({ apiKey }: ConnectionsPanelProps) {
  const [expanded, setExpanded] = useState<ConnectionSection>(null);

  // WhatsApp
  const [waStatus, setWaStatus] = useState<WhatsAppStatus>({ connected: false, phoneNumber: null, qr: null });
  const [waConnecting, setWaConnecting] = useState(false);
  const waInitialized = useRef(false);

  // Telegram
  const [tgStatus, setTgStatus] = useState<TelegramStatusSnapshot | null>(null);
  const [tgTokenInput, setTgTokenInput] = useState('');
  const [tgTesting, setTgTesting] = useState(false);
  const [tgError, setTgError] = useState<string | null>(null);

  // Google Workspace
  const [calConnections, setCalConnections] = useState<CalendarConnection[]>([]);
  const [calLoading, setCalLoading] = useState<string | null>(null);
  const [calError, setCalError] = useState<string | null>(null);

  // ── WhatsApp ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!window.whatsApp || waInitialized.current) return;
    waInitialized.current = true;

    window.whatsApp.getStatus().then(s => setWaStatus({ connected: s.connected, phoneNumber: s.phoneNumber, qr: s.qr }));

    if (apiKey) window.whatsApp.setApiKey(apiKey);

    window.whatsApp.onQR((qr: string) => {
      setWaStatus(prev => ({ ...prev, qr }));
      setWaConnecting(false);
    });

    window.whatsApp.onStatusChange((s: any) => {
      setWaStatus({ connected: s.connected, phoneNumber: s.phoneNumber, qr: s.qr });
      if (s.connected) setWaConnecting(false);
    });

    return () => {
      window.whatsApp?.removeListeners();
      waInitialized.current = false;
    };
  }, [apiKey]);

  const handleWaConnect = useCallback(async () => {
    if (!window.whatsApp) return;
    setWaConnecting(true);
    if (apiKey) await window.whatsApp.setApiKey(apiKey);
    const result = await window.whatsApp.connect();
    if (!result.success) setWaConnecting(false);
  }, [apiKey]);

  const handleWaDisconnect = useCallback(async () => {
    if (!window.whatsApp) return;
    await window.whatsApp.disconnect();
    setWaStatus({ connected: false, phoneNumber: null, qr: null });
  }, []);

  // ── Telegram ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!isTelegramAvailable()) return;
    getTelegramStatus().then(setTgStatus).catch(() => {});
  }, []);

  const handleTgSaveToken = useCallback(async () => {
    if (!tgTokenInput.trim()) return;
    setTgTesting(true);
    setTgError(null);
    try {
      const updated = await updateTelegramConfig({ bot_token: tgTokenInput.trim(), enabled: true });
      setTgStatus(updated);
      const test = await testTelegramConnection();
      if (test.success) {
        setTgStatus(prev => prev ? { ...prev, bot: test.bot as TelegramBotInfo, polling: true } : prev);
        setTgTokenInput('');
      } else {
        setTgError(test.error || 'No se pudo conectar con el bot');
      }
    } catch (err: any) {
      setTgError(err.message);
    } finally {
      setTgTesting(false);
    }
  }, [tgTokenInput]);

  const handleTgDisconnect = useCallback(async () => {
    await updateTelegramConfig({ enabled: false, bot_token: '' });
    setTgStatus(prev => prev ? { ...prev, configured: false, enabled: false, polling: false, bot: null } : prev);
  }, []);

  const handleTgToggle = useCallback(async (enabled: boolean) => {
    const updated = await updateTelegramConfig({ enabled });
    setTgStatus(updated);
  }, []);

  // ── Google Workspace ─────────────────────────────────────────────

  useEffect(() => {
    if (typeof window.calendar === 'undefined') return;

    window.calendar.getConnections().then(setCalConnections).catch(() => {});

    window.calendar.onConnected((data: any) => {
      setCalConnections(prev => {
        const filtered = prev.filter(c => c.provider !== data.provider);
        return [...filtered, { provider: data.provider, email: data.email, isActive: true }];
      });
    });

    window.calendar.onDisconnected((data: any) => {
      setCalConnections(prev => prev.filter(c => c.provider !== data.provider));
    });

    return () => window.calendar.removeListeners();
  }, []);

  const handleCalConnect = async (provider: 'google' | 'microsoft') => {
    setCalLoading(provider);
    setCalError(null);
    try {
      const result = provider === 'google'
        ? await window.calendar.connectGoogle()
        : await window.calendar.connectMicrosoft();

      if (result.success) {
        setCalConnections(prev => [...prev.filter(c => c.provider !== provider), { provider, email: result.email, isActive: true }]);
      } else {
        setCalError(result.error || 'Error de conexion');
      }
    } catch (err: any) {
      setCalError(err.message);
    } finally {
      setCalLoading(null);
    }
  };

  const handleCalDisconnect = async (provider: 'google' | 'microsoft') => {
    await window.calendar.disconnect(provider);
    setCalConnections(prev => prev.filter(c => c.provider !== provider));
  };

  // ── Helpers ──────────────────────────────────────────────────────

  const googleConn = calConnections.find(c => c.provider === 'google');
  const microsoftConn = calConnections.find(c => c.provider === 'microsoft');
  const tgConnected = tgStatus?.configured && tgStatus?.enabled && !!tgStatus?.bot;

  const toggle = (section: ConnectionSection) =>
    setExpanded(prev => prev === section ? null : section);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h3 className="text-gray-900 dark:text-white text-lg font-semibold">Conexiones</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Administra tus integraciones con servicios externos</p>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6 space-y-3">

        {/* ── WhatsApp ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden transition-all">
          <button
            onClick={() => toggle('whatsapp')}
            className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">WhatsApp</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {waStatus.connected ? `Conectado — ${waStatus.phoneNumber || 'Dispositivo enlazado'}` : 'No conectado'}
              </p>
            </div>
            <StatusBadge connected={waStatus.connected} />
            <ChevronIcon open={expanded === 'whatsapp'} />
          </button>

          {expanded === 'whatsapp' && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-white/[0.04]">
              {waStatus.connected ? (
                <div className="pt-4 space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
                    <div className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#25D366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-white">Dispositivo enlazado</p>
                      {waStatus.phoneNumber && <p className="text-[11px] text-gray-500 font-mono">{waStatus.phoneNumber}</p>}
                    </div>
                    <button onClick={handleWaDisconnect} className="text-[10px] font-semibold text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/5 transition-colors">
                      Desconectar
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center">
                    Para configurar whitelist y grupos, usa el panel completo de WhatsApp.
                  </p>
                </div>
              ) : waStatus.qr ? (
                <div className="pt-4 flex flex-col items-center gap-3">
                  <div className="bg-white p-3 rounded-2xl">
                    <img src={waStatus.qr} alt="QR WhatsApp" className="w-48 h-48" />
                  </div>
                  <p className="text-[11px] text-gray-400 text-center">Escanea el codigo QR con WhatsApp en tu telefono</p>
                </div>
              ) : (
                <div className="pt-4 flex flex-col items-center gap-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Vincula tu cuenta para recibir notificaciones y ejecutar comandos remotos.
                  </p>
                  <button
                    onClick={handleWaConnect}
                    disabled={waConnecting}
                    className="px-6 py-2.5 rounded-xl bg-[#25D366] text-white text-xs font-semibold hover:bg-[#20bd5a] transition-colors disabled:opacity-50"
                  >
                    {waConnecting ? 'Conectando...' : 'Conectar WhatsApp'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Telegram ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden transition-all">
          <button
            onClick={() => toggle('telegram')}
            className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-[#2AABEE]/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[#2AABEE]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Telegram</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {tgConnected ? `@${tgStatus?.bot?.username || 'Bot conectado'}` : 'No configurado'}
              </p>
            </div>
            <StatusBadge connected={!!tgConnected} />
            <ChevronIcon open={expanded === 'telegram'} />
          </button>

          {expanded === 'telegram' && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-white/[0.04]">
              {tgConnected ? (
                <div className="pt-4 space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
                    <div className="w-8 h-8 rounded-lg bg-[#2AABEE]/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#2AABEE]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-white">@{tgStatus?.bot?.username}</p>
                      <p className="text-[11px] text-gray-500">{tgStatus?.bot?.first_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTgToggle(!tgStatus?.enabled)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${tgStatus?.enabled ? 'bg-[#2AABEE]' : 'bg-gray-300 dark:bg-gray-600'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${tgStatus?.enabled ? 'translate-x-4' : ''}`} />
                      </button>
                      <button onClick={handleTgDisconnect} className="text-[10px] font-semibold text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/5 transition-colors">
                        Quitar
                      </button>
                    </div>
                  </div>
                  {tgStatus?.recent_chats && tgStatus.recent_chats.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Chats recientes</p>
                      <div className="space-y-1">
                        {tgStatus.recent_chats.slice(0, 3).map(chat => (
                          <div key={chat.chatId} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-white/[0.02]">
                            <p className="text-[11px] text-gray-600 dark:text-gray-300 truncate flex-1">{chat.title}</p>
                            <p className="text-[10px] text-gray-400 shrink-0">{chat.type}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="pt-4 space-y-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Ingresa el token de tu bot de Telegram para recibir comandos y notificaciones.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={tgTokenInput}
                      onChange={e => setTgTokenInput(e.target.value)}
                      placeholder="123456:ABC-DEF..."
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-gray-100 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2AABEE]/50"
                      onKeyDown={e => e.key === 'Enter' && handleTgSaveToken()}
                    />
                    <button
                      onClick={handleTgSaveToken}
                      disabled={tgTesting || !tgTokenInput.trim()}
                      className="px-4 py-2 rounded-xl bg-[#2AABEE] text-white text-xs font-semibold hover:bg-[#229ED9] transition-colors disabled:opacity-50 shrink-0"
                    >
                      {tgTesting ? '...' : 'Conectar'}
                    </button>
                  </div>
                  {tgError && <p className="text-[11px] text-red-500">{tgError}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Google Workspace ──────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden transition-all">
          <button
            onClick={() => toggle('google')}
            className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Google Workspace</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {googleConn ? `${googleConn.email} — Calendar, Gmail, Drive, Chat` : 'Calendar, Gmail, Drive y Google Chat'}
              </p>
            </div>
            <StatusBadge connected={!!googleConn} />
            <ChevronIcon open={expanded === 'google'} />
          </button>

          {expanded === 'google' && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-white/[0.04]">
              <div className="pt-4 space-y-3">
                {/* Google */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-white">Google</p>
                    {googleConn && <p className="text-[11px] text-gray-500 font-mono truncate">{googleConn.email}</p>}
                  </div>
                  {googleConn ? (
                    <button onClick={() => handleCalDisconnect('google')} className="text-[10px] font-semibold text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/5 transition-colors">
                      Desconectar
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCalConnect('google')}
                      disabled={calLoading === 'google'}
                      className="px-4 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black text-[11px] font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      {calLoading === 'google' ? '...' : 'Conectar'}
                    </button>
                  )}
                </div>

                {/* Microsoft */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#FFB900" d="M13 13h10v10H13z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-white">Microsoft Outlook</p>
                    {microsoftConn && <p className="text-[11px] text-gray-500 font-mono truncate">{microsoftConn.email}</p>}
                  </div>
                  {microsoftConn ? (
                    <button onClick={() => handleCalDisconnect('microsoft')} className="text-[10px] font-semibold text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/5 transition-colors">
                      Desconectar
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCalConnect('microsoft')}
                      disabled={calLoading === 'microsoft'}
                      className="px-4 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black text-[11px] font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      {calLoading === 'microsoft' ? '...' : 'Conectar'}
                    </button>
                  )}
                </div>

                {calError && <p className="text-[11px] text-red-500 text-center">{calError}</p>}

                {googleConn && (
                  <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                    Con Google conectado, SofLIA tiene acceso a Calendar, Gmail, Drive y Google Chat.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
      connected
        ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
        : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-gray-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-600'}`} />
      {connected ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
