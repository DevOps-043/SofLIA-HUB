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
  embedded?: boolean;
}

export function WhatsAppSetup({ isOpen, onClose, apiKey, embedded = false }: WhatsAppSetupProps) {
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
  const [isGroupPolicyDropdownOpen, setIsGroupPolicyDropdownOpen] = useState(false);
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

  if (!isOpen && !embedded) return null;

  const isAvailable = !!window.whatsApp;

  const content = (
    <div
      className={`flex flex-col overflow-hidden transition-all duration-500 ${
        embedded
          ? 'w-full h-full'
          : 'w-175 max-h-[85vh] bg-sidebar rounded-3xl border border-white/10 shadow-2xl animate-fade-in relative'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 blur-[100px] pointer-events-none" />

      {/* Header */}
      {!embedded && (
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between relative z-10 bg-white/2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center border border-green-500/20 shadow-lg shadow-green-500/5">
              <svg className="w-7 h-7 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <div>
              <h2 className="text-white text-xl font-black uppercase tracking-widest leading-none">WhatsApp Hub</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mt-1">Sincronización técnica y comandos remotos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all group"
          >
            <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Body */}
      <div className={`flex-1 overflow-y-auto custom-scrollbar px-8 py-8 relative z-10`}>
        {!isAvailable && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-red-500/5 border border-red-500/10 rounded-3xl">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase tracking-widest">Protocolo no disponible</p>
              <p className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-tighter">Requiere ejecución bajo el entorno de escritorio SofLIA</p>
            </div>
          </div>
        )}

        {isAvailable && !status.connected && !status.qr && !connecting && (
          <div className="flex flex-col items-center justify-center py-16 animate-in fade-in zoom-in-95 duration-500">
            <div className="relative mb-10">
              <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
              <div className="relative w-32 h-32 rounded-[2.5rem] bg-background-dark border-2 border-green-500/30 flex items-center justify-center shadow-2xl">
                <svg className="w-16 h-16 text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
            </div>
            <div className="text-center space-y-2 mb-10 max-w-xs">
              <h3 className="text-white text-lg font-black uppercase tracking-widest">Enlace de Dispositivo</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight leading-relaxed px-4">
                Vincula tu cuenta para recibir notificaciones de AutoDev, reportes de productividad y ejecutar comandos remotos.
              </p>
            </div>
            <button
              onClick={handleConnect}
              className="group relative px-10 py-4 rounded-2xl bg-green-500 text-primary text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-green-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <span className="relative z-10 flex items-center gap-2">
                Conectar WhatsApp
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            </button>
          </div>
        )}

        {/* Connecting / QR Lookout */}
        {isAvailable && !status.connected && (connecting || status.qr) && (
          <div className="flex flex-col items-center py-10 animate-in fade-in zoom-in-95 duration-500">
            {status.qr ? (
              <div className="space-y-10 flex flex-col items-center">
                <div className="relative p-8 bg-white/5 border border-white/10 rounded-[3rem] shadow-[0_0_50px_rgba(255,255,255,0.03)] group transition-all duration-700 hover:border-green-500/40">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-4 py-1 bg-green-500 rounded-full text-[8px] font-black text-primary uppercase tracking-widest">Scanner Ready</div>
                  {/* QR Core */}
                  <div className="relative bg-white rounded-4xl p-6 shadow-2xl">
                    <img src={status.qr} alt="QR Code" className="w-56 h-56" />
                    {/* Corner Borders */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500 rounded-tl-xl -translate-x-2 -translate-y-2" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500 rounded-tr-xl translate-x-2 -translate-y-2" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500 rounded-bl-xl -translate-x-2 translate-y-2" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500 rounded-br-xl translate-x-2 translate-y-2" />
                  </div>
                </div>
                <div className="text-center space-y-4 max-w-sm">
                  <h4 className="text-white text-xs font-black uppercase tracking-widest">Protocolo de Emparejamiento</h4>
                  <div className="space-y-2 bg-white/3 border border-white/5 rounded-2xl p-4">
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      Instrucciones de Vinculación
                    </p>
                    <ol className="text-[10px] text-gray-400 font-medium space-y-1.5">
                      <li>1. Abre WhatsApp en tu dispositivo móvil</li>
                      <li>2. Menu &gt; Dispositivos vinculados</li>
                      <li>3. Escanea esta matriz técnica</li>
                    </ol>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-white/5 rounded-full" />
                  <div className="absolute inset-0 w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-[10px] font-black text-green-500 uppercase tracking-[0.3em] animate-pulse">Sincronizando Terminal...</p>
              </div>
            )}
          </div>
        )}

        {/* Connected Dashboard */}
        {isAvailable && status.connected && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Connection Status Card */}
            <div className="bg-white/3 border border-white/10 rounded-3xl p-6 relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-500/5 rounded-full blur-3xl" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-ping absolute inset-0" />
                    <div className="w-3 h-3 rounded-full bg-green-500 relative z-10" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-widest leading-none">Canal Activo</h4>
                    {status.phoneNumber && (
                      <p className="text-[10px] font-mono text-green-500/70 mt-1 uppercase tracking-widest">+{status.phoneNumber}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 text-[9px] font-black text-red-400 border border-red-400/20 bg-red-400/5 rounded-xl uppercase tracking-widest hover:bg-red-400/10 hover:border-red-400/40 transition-all"
                >
                  Terminar Sesión
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Allowed Numbers Card */}
              <div className="bg-white/3 border border-white/10 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Whitelist Personal</h4>
                  <div className="px-2 py-1 bg-white/5 rounded-lg">
                    <span className="text-[9px] font-mono text-gray-400">{status.allowedNumbers.length}</span>
                  </div>
                </div>

                <div className="flex gap-2 mb-6">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={numberInput}
                      onChange={(e) => setNumberInput(e.target.value)}
                      placeholder="521..."
                      className="w-full pl-3 pr-4 py-2.5 bg-background-dark/80 border border-white/10 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-green-500/30 transition-all"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddNumber()}
                    />
                  </div>
                  <button
                    onClick={handleAddNumber}
                    className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    +
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {status.allowedNumbers.length > 0 ? (
                    status.allowedNumbers.map((num) => (
                      <div key={num} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/2 border border-white/5 group/num">
                        <span className="text-[10px] text-gray-300 font-mono tracking-widest">+{num}</span>
                        <button
                          onClick={() => handleRemoveNumber(num)}
                          className="p-1.5 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover/num:opacity-100"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center border border-dashed border-white/5 rounded-xl">
                      <p className="text-[9px] text-amber-400/60 font-black uppercase tracking-widest">Acceso Público</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Group Policy Card */}
              <div className="bg-white/3 border border-white/10 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Soporte de Grupos</h4>
                  <div className="relative dropdown-group">
                    <button 
                      onClick={() => setIsGroupPolicyDropdownOpen(!isGroupPolicyDropdownOpen)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] text-accent hover:bg-white/10 transition-all min-w-[100px] justify-between group/btn"
                    >
                      <span>{status.groupPolicy === 'open' ? 'Abierto' : status.groupPolicy === 'allowlist' ? 'Filtro' : 'Inhibido'}</span>
                      <svg className={`w-3 h-3 transition-transform duration-300 ${isGroupPolicyDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isGroupPolicyDropdownOpen && (
                      <div className="absolute top-full right-0 mt-2 w-32 bg-sidebar/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-[100] py-1.5 animate-in fade-in zoom-in-95 duration-200">
                        {[
                          { id: 'open', label: 'Abierto' },
                          { id: 'allowlist', label: 'Filtro' },
                          { id: 'disabled', label: 'Inhibido' }
                        ].map((option) => (
                          <button
                            key={option.id}
                            onClick={() => {
                              handleUpdateGroupConfig({ groupPolicy: option.id });
                              setIsGroupPolicyDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-[9px] font-black uppercase tracking-widest transition-colors ${
                              status.groupPolicy === option.id 
                                ? 'bg-accent text-primary' 
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {status.groupPolicy !== 'disabled' && (
                  <div className="space-y-5 animate-in fade-in duration-300">
                    {/* Activation Tabs */}
                    <div className="flex p-1 bg-white/5 rounded-xl gap-1">
                      {[
                        { id: 'mention', label: 'Mención' },
                        { id: 'always', label: 'Continuo' }
                      ].map(mode => (
                        <button
                          key={mode.id}
                          onClick={() => handleUpdateGroupConfig({ groupActivation: mode.id })}
                          className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                            status.groupActivation === mode.id
                              ? 'bg-accent text-primary shadow-lg shadow-accent/20'
                              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest px-1">Comando Global / Trigger</label>
                      <input
                        type="text"
                        value={status.groupPrefix}
                        onChange={(e) => setStatus(prev => ({ ...prev, groupPrefix: e.target.value }))}
                        onBlur={(e) => handleUpdateGroupConfig({ groupPrefix: e.target.value })}
                        className="w-full px-3 py-2 bg-background-dark/80 border border-white/10 rounded-xl text-white text-[10px] font-mono focus:outline-none focus:border-accent/30 transition-all"
                      />
                    </div>

                    {status.groupPolicy === 'allowlist' && (
                       <div className="space-y-4">
                          <div className="space-y-1.5">
                             <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest px-1">JID Whitelist</label>
                             <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  value={groupInput}
                                  onChange={(e) => setGroupInput(e.target.value)}
                                  placeholder="12345...@g.us"
                                  className="flex-1 px-3 py-2 bg-background-dark/80 border border-white/10 rounded-xl text-white text-[9px] font-mono focus:outline-none focus:border-accent/30"
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
                                />
                                <button
                                  onClick={handleAddGroup}
                                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] text-gray-400 hover:text-white transition-all"
                                >
                                  +
                                </button>
                             </div>
                          </div>

                          <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                             {status.allowedGroups.length > 0 ? (
                                status.allowedGroups.map((jid) => (
                                   <div key={jid} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/2 border border-white/5 group/jid">
                                      <span className="text-[9px] text-gray-400 font-mono truncate max-w-30">{jid}</span>
                                      <button
                                        onClick={() => handleRemoveGroup(jid)}
                                        className="p-1 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover/jid:opacity-100"
                                      >
                                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                         </svg>
                                      </button>
                                   </div>
                                ))
                             ) : (
                                <div className="py-4 text-center border border-dashed border-white/5 rounded-xl">
                                   <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest">Sin grupos filtrados</p>
                                </div>
                             )}
                          </div>
                       </div>
                    )}
                 </div>
              )}
              </div>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="mt-8 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">{error}</p>
          </div>
        )}
      </div>

      {/* Security Footer */}
      {!embedded && (
        <div className="px-8 py-4 border-t border-white/5 bg-white/2 flex items-center justify-center gap-2">
           <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
           </svg>
           <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em]">Cifrado de Extremo a Extremo — Sesión Local Segura</p>
        </div>
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      {content}
    </div>
  );
}
