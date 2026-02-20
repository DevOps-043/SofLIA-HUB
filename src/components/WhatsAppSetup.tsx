import { useState, useEffect, useCallback, useRef } from 'react';

declare global {
  interface Window {
    whatsApp?: {
      connect: () => Promise<any>;
      disconnect: () => Promise<any>;
      getStatus: () => Promise<{
        connected: boolean;
        phoneNumber: string | null;
        qr: string | null;
        allowedNumbers: string[];
        groupPolicy: 'open' | 'allowlist' | 'disabled';
        groupActivation: 'mention' | 'always';
        groupPrefix: string;
        allowedGroups: string[];
        groupAllowFrom: string[];
      }>;
      setAllowedNumbers: (numbers: string[]) => Promise<any>;
      setGroupConfig: (config: any) => Promise<any>;
      setApiKey: (apiKey: string) => Promise<any>;
      onQR: (cb: (qr: string) => void) => void;
      onStatusChange: (cb: (status: any) => void) => void;
      removeListeners: () => void;
    };
  }
}

interface WhatsAppSetupProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey?: string;
}

export function WhatsAppSetup({ isOpen, onClose, apiKey }: WhatsAppSetupProps) {
  const [status, setStatus] = useState<{
    connected: boolean;
    phoneNumber: string | null;
    qr: string | null;
    allowedNumbers: string[];
    groupPolicy: 'open' | 'allowlist' | 'disabled';
    groupActivation: 'mention' | 'always';
    groupPrefix: string;
    allowedGroups: string[];
    groupAllowFrom: string[];
  }>({
    connected: false,
    phoneNumber: null,
    qr: null,
    allowedNumbers: [],
    groupPolicy: 'open',
    groupActivation: 'mention',
    groupPrefix: '/soflia',
    allowedGroups: [],
    groupAllowFrom: [],
  });

  const [connecting, setConnecting] = useState(false);
  const [numberInput, setNumberInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  // Load initial status and setup listeners
  useEffect(() => {
    if (!isOpen || !window.whatsApp) return;

    const loadStatus = async () => {
      const s = await window.whatsApp!.getStatus();
      setStatus(s);
    };

    loadStatus();

    // Send API key to main process for the agent
    if (apiKey) {
      window.whatsApp.setApiKey(apiKey);
    }

    window.whatsApp.onQR((qr: string) => {
      setStatus(prev => ({ ...prev, qr }));
      setConnecting(false);
    });

    window.whatsApp.onStatusChange((newStatus: any) => {
      setStatus(newStatus);
      if (newStatus.connected) {
        setConnecting(false);
        setError(null);
      }
    });

    initialized.current = true;

    return () => {
      window.whatsApp?.removeListeners();
      initialized.current = false;
    };
  }, [isOpen, apiKey]);

  const handleConnect = useCallback(async () => {
    if (!window.whatsApp) return;
    setConnecting(true);
    setError(null);

    // Send API key before connecting
    if (apiKey) {
      await window.whatsApp.setApiKey(apiKey);
    }

    const result = await window.whatsApp.connect();
    if (!result.success) {
      setError(result.error || 'Error al conectar');
      setConnecting(false);
    }
  }, [apiKey]);

  const handleDisconnect = useCallback(async () => {
    if (!window.whatsApp) return;
    await window.whatsApp.disconnect();
    setStatus(prev => ({
      ...prev,
      connected: false,
      phoneNumber: null,
      qr: null,
    }));
  }, []);

  const handleAddNumber = useCallback(async () => {
    if (!window.whatsApp || !numberInput.trim()) return;
    const cleaned = numberInput.replace(/[^0-9]/g, '');
    if (cleaned.length < 10) {
      setError('Ingresa un número válido (mínimo 10 dígitos con código de país)');
      return;
    }
    const updated = [...status.allowedNumbers, cleaned];
    await window.whatsApp.setAllowedNumbers(updated);
    setStatus(prev => ({ ...prev, allowedNumbers: updated }));
    setNumberInput('');
    setError(null);
  }, [numberInput, status.allowedNumbers]);

  const handleRemoveNumber = useCallback(async (num: string) => {
    if (!window.whatsApp) return;
    const updated = status.allowedNumbers.filter(n => n !== num);
    await window.whatsApp.setAllowedNumbers(updated);
    setStatus(prev => ({ ...prev, allowedNumbers: updated }));
  }, [status.allowedNumbers]);

  const handleUpdateGroupConfig = useCallback(async (updates: any) => {
    if (!window.whatsApp) return;
    const result = await window.whatsApp.setGroupConfig(updates);
    if (result.success) {
      setStatus(prev => ({ ...prev, ...updates }));
    } else {
      setError(result.error || 'Error al actualizar configuración');
    }
  }, []);

  const [groupInput, setGroupInput] = useState('');
  const handleAddGroup = useCallback(async () => {
    if (!window.whatsApp || !groupInput.trim()) return;
    const updated = [...status.allowedGroups, groupInput.trim()];
    await handleUpdateGroupConfig({ allowedGroups: updated });
    setGroupInput('');
  }, [groupInput, status.allowedGroups, handleUpdateGroupConfig]);

  const handleRemoveGroup = useCallback(async (jid: string) => {
    const updated = status.allowedGroups.filter(g => g !== jid);
    await handleUpdateGroupConfig({ allowedGroups: updated });
  }, [status.allowedGroups, handleUpdateGroupConfig]);

  if (!isOpen) return null;

  const isAvailable = !!window.whatsApp;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1E1F23] rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-200 dark:border-white/10">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between bg-linear-to-r from-green-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">WhatsApp</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Controla SofLIA desde tu celular</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {!isAvailable && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="text-sm">WhatsApp no está disponible.</p>
              <p className="text-xs mt-1 opacity-75">Asegúrate de ejecutar la aplicación en modo Electron.</p>
            </div>
          )}

          {isAvailable && !status.connected && !status.qr && !connecting && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">Vincula tu WhatsApp para controlar SofLIA desde tu celular</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Se mostrará un código QR para escanear</p>
              </div>
              <button
                onClick={handleConnect}
                className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium text-sm transition-colors shadow-lg shadow-green-500/20"
              >
                Conectar WhatsApp
              </button>
            </div>
          )}

          {/* Connecting / QR */}
          {isAvailable && !status.connected && (connecting || status.qr) && (
            <div className="text-center space-y-4">
              {status.qr ? (
                <>
                  <div className="bg-white rounded-2xl p-3 inline-block shadow-inner border border-gray-100">
                    <img src={status.qr} alt="QR Code" className="w-64 h-64" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Escanea el código QR</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Abre WhatsApp en tu celular &gt; Dispositivos vinculados &gt; Vincular dispositivo
                    </p>
                  </div>
                </>
              ) : (
                <div className="py-8">
                  <div className="flex gap-1.5 justify-center">
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <p className="text-sm text-gray-500 mt-3">Conectando...</p>
                </div>
              )}
            </div>
          )}

          {/* Connected */}
          {isAvailable && status.connected && (
            <div className="space-y-5">
              {/* Status Badge */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">Conectado</p>
                  {status.phoneNumber && (
                    <p className="text-xs text-green-600/70 dark:text-green-500/70">+{status.phoneNumber}</p>
                  )}
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors border border-red-500/20"
                >
                  Desconectar
                </button>
              </div>

              {/* Allowed Numbers */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  Números autorizados
                </label>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                  Solo estos números pueden enviar mensajes a SofLIA. Si la lista está vacía, cualquier número puede interactuar.
                </p>

                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={numberInput}
                    onChange={(e) => setNumberInput(e.target.value)}
                    placeholder="Ej: 5215512345678"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNumber()}
                  />
                  <button
                    onClick={handleAddNumber}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Agregar
                  </button>
                </div>

                {status.allowedNumbers.length > 0 ? (
                  <div className="space-y-1.5">
                    {status.allowedNumbers.map((num) => (
                      <div key={num} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                        <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">+{num}</span>
                        <button
                          onClick={() => handleRemoveNumber(num)}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                        >
                          <svg className="w-4 h-4 text-gray-400 hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-500 dark:text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                    Sin restricciones — cualquier número puede interactuar con SofLIA
                  </p>
                )}
              </div>

              {/* Group Configuration — NEW */}
              <div className="pt-4 border-t border-gray-100 dark:border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-900 dark:text-white">
                    Soporte para Grupos
                  </label>
                  <select
                    value={status.groupPolicy}
                    onChange={(e) => handleUpdateGroupConfig({ groupPolicy: e.target.value })}
                    className="text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
                  >
                    <option value="open">Habilitado</option>
                    <option value="allowlist">Solo Whitelist</option>
                    <option value="disabled">Deshabilitado</option>
                  </select>
                </div>

                {status.groupPolicy !== 'disabled' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Activation Mode */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Modo de Activación
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleUpdateGroupConfig({ groupActivation: 'mention' })}
                          className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                            status.groupActivation === 'mention'
                              ? 'bg-green-500/10 border-green-500 text-green-600 dark:text-green-400'
                              : 'bg-transparent border-gray-200 dark:border-white/10 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5'
                          }`}
                        >
                          Mención (@SofLIA)
                        </button>
                        <button
                          onClick={() => handleUpdateGroupConfig({ groupActivation: 'always' })}
                          className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                            status.groupActivation === 'always'
                              ? 'bg-green-500/10 border-green-500 text-green-600 dark:text-green-400'
                              : 'bg-transparent border-gray-200 dark:border-white/10 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5'
                          }`}
                        >
                          Siempre Activo
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 italic">
                        {status.groupActivation === 'mention'
                          ? 'Responde cuando lo mencionan, usan el prefijo o hacen reply.'
                          : 'Responde a cada mensaje enviado en el grupo.'}
                      </p>
                    </div>

                    {/* Prefix */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Prefijo de Comando
                      </label>
                      <input
                        type="text"
                        value={status.groupPrefix}
                        onChange={(e) => setStatus(prev => ({ ...prev, groupPrefix: e.target.value }))}
                        onBlur={(e) => handleUpdateGroupConfig({ groupPrefix: e.target.value })}
                        placeholder="/soflia"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40"
                      />
                    </div>

                    {/* Group Allowlist */}
                    {status.groupPolicy === 'allowlist' && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Grupos permitidos (JIDs)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={groupInput}
                            onChange={(e) => setGroupInput(e.target.value)}
                            placeholder="Ej: 1203630248... @g.us"
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
                          />
                          <button
                            onClick={handleAddGroup}
                            className="px-3 py-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium transition-colors"
                          >
                            Add
                          </button>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {status.allowedGroups.map((jid) => (
                            <div key={jid} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-[10px]">
                              <span className="truncate flex-1 font-mono text-gray-400">{jid}</span>
                              <button
                                onClick={() => handleRemoveGroup(jid)}
                                className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                          {status.allowedGroups.length === 0 && (
                            <p className="text-[10px] text-gray-400 text-center py-2 italic border border-dashed border-gray-200 dark:border-white/10 rounded-lg">
                              No hay grupos en la whitelist
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-500">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
            Los mensajes se procesan localmente. Tu sesión de WhatsApp se mantiene vinculada.
          </p>
        </div>
      </div>
    </div>
  );
}
