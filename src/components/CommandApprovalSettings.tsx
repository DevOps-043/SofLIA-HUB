import { useState } from 'react';
import { clearCommandApprovals } from '../services/computer-use/command-approvals';

export function CommandApprovalSettings() {
  const [feedback, setFeedback] = useState('');
  return <section className="rounded-lg border border-border p-4 space-y-3">
    <h3 className="text-sm font-semibold text-primary">Permisos de comandos</h3>
    <p className="text-xs text-secondary">Siempre permitir recuerda únicamente el mismo comando y carpeta para tu usuario. Puedes quitar todos los permisos recordados para que SofLIA vuelva a pedirlos.</p>
    <button type="button" className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm text-primary" onClick={() => setFeedback(clearCommandApprovals() ? 'Se quitaron tus permisos recordados.' : 'No se pudieron quitar los permisos. Vuelve a intentarlo.')}>
      Quitar permisos recordados
    </button>
    {feedback && <p role="status" className="text-xs text-secondary">{feedback}</p>}
  </section>;
}
