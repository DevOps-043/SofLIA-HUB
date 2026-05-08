import { ConnectionChrome } from './ConnectionChrome';
import type { WhatsAppConnectionState } from './types';

export function WhatsAppConnectionSection(props: {
  open: boolean;
  onToggle: () => void;
  connection: WhatsAppConnectionState;
}) {
  const { status } = props.connection;
  return (
    <ConnectionChrome
      open={props.open}
      onToggle={props.onToggle}
      connected={status.connected}
      icon={<WhatsAppIcon />}
      title="WhatsApp"
      subtitle={status.connected ? `Conectado — ${status.phoneNumber || 'Dispositivo enlazado'}` : 'No conectado'}
    >
      <WhatsAppBody connection={props.connection} />
    </ConnectionChrome>
  );
}

function WhatsAppBody({ connection }: { connection: WhatsAppConnectionState }) {
  const { status } = connection;
  if (status.connected) {
    return (
      <div className="pt-4 space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
          <div className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
            <CheckIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 dark:text-white">Dispositivo enlazado</p>
            {status.phoneNumber && <p className="text-[11px] text-gray-500 font-mono">{status.phoneNumber}</p>}
          </div>
          <button onClick={connection.disconnect} className="text-[10px] font-semibold text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/5 transition-colors">
            Desconectar
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center">Para configurar whitelist y grupos, usa el panel completo de WhatsApp.</p>
      </div>
    );
  }
  if (status.qr) {
    return (
      <div className="pt-4 flex flex-col items-center gap-3">
        <div className="bg-white p-3 rounded-2xl"><img src={status.qr} alt="QR WhatsApp" className="w-48 h-48" /></div>
        <p className="text-[11px] text-gray-400 text-center">Escanea el codigo QR con WhatsApp en tu telefono</p>
      </div>
    );
  }
  return (
    <div className="pt-4 flex flex-col items-center gap-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Vincula tu cuenta para recibir notificaciones y ejecutar comandos remotos.</p>
      <button onClick={connection.connect} disabled={connection.connecting} className="px-6 py-2.5 rounded-xl bg-[#25D366] text-white text-xs font-semibold hover:bg-[#20bd5a] transition-colors disabled:opacity-50">
        {connection.connecting ? 'Conectando...' : 'Conectar WhatsApp'}
      </button>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center shrink-0">
      <svg className="w-5 h-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </div>
  );
}

function CheckIcon() {
  return <svg className="w-4 h-4 text-[#25D366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
}
