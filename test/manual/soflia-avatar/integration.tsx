import { createRoot } from 'react-dom/client';
import { useRef, useState } from 'react';
import { BrowserHomePage } from '../../../src/components/browser/BrowserHomePage';
import { MessageList } from '../../../src/adapters/desktop_ui/chat-ui/messages/MessageList';
import type { ChatUIController } from '../../../src/adapters/desktop_ui/chat-ui/useChatUIController';
import { EmptyChatState } from '../../../src/adapters/desktop_ui/chat-ui/EmptyChatState';
import { ChatAvatarProvider } from '../../../src/adapters/desktop_ui/chat-ui/ChatAvatar';
import { ProjectChatInput } from '../../../src/components/project-hub/ProjectChatInput';
import { AVATAR_EXPRESSIONS, EXPRESSION_LABELS, type AvatarExpression } from '../../../src/components/avatar/avatar-model';
import '../../../src/index.css';
import '../../../src/components/avatar/chat-avatar.css';
import './integration.css';

export function Integration() {
  const [draft, setDraft] = useState(''); const [project, setProject] = useState('');
  const [mode, setMode] = useState<AvatarExpression>('idle'); const [history, setHistory] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return <>
    <header className="qa-controls"><strong>Verificación local · superficies de producción</strong><select aria-label="Estado de prueba" value={mode} onChange={event => setMode(event.target.value as AvatarExpression)}>{AVATAR_EXPRESSIONS.map(state => <option key={state} value={state}>{EXPRESSION_LABELS[state]}</option>)}</select><label><input type="checkbox" checked={history} onChange={event => setHistory(event.target.checked)} /> Con conversación</label></header>
    <div className="qa-layout">
      <aside className="soflia-floating-chat-ui qa-chat">
        <div className="qa-chat-title">SofLIA <span>Tu espacio para crear</span></div>
        <ChatAvatarProvider input={{ mode, draft, busy: !['idle', 'sleeping'].includes(mode) }}>
          {history ? <MessageList controller={{ props: { canSendMessages: true, floating: true, messages: [{ id: 'ejemplo', role: 'model', text: '## ¿Qué puedo hacer?\n\nPodemos empezar por el objetivo y los resultados que quieres conseguir.\n\n- Organizar archivos y preparar documentos.\n- Revisar una propuesta y resolver dudas.\n- Explorar ideas para tu proyecto.', timestamp: 1 }] }, state: { editing: { messageId: null }, images: { setZoomed() {} } }, runtime: { chat: { showLoadingUI: mode === 'thinking' || mode === 'focused', activeToolCall: mode === 'focused' ? { name: 'run_command', args: { command: 'Preparando una propuesta con un nombre suficientemente largo para revisar el ancho' } } : null, handleCopy() {}, handleRegenerate() {}, handleFeedback() {} } }, refs: { messagesEndRef: { current: null } } } as unknown as ChatUIController} /> : <EmptyChatState />}
          <input className="qa-composer" aria-label="Mensaje a SofLIA" placeholder="Escribe a SofLIA…" value={draft} onChange={event => setDraft(event.target.value)} />
        </ChatAvatarProvider>
      </aside>
      <div className="qa-home"><BrowserHomePage onNavigate={() => {}} /></div>
    </div>
    <section className="qa-project"><h2>Proyecto · Identidad SofLIA</h2><p>El mismo personaje acompaña el inicio de una conversación del proyecto.</p><ProjectChatInput canEditFolder chatInput={project} chatInputRef={input} folderName="Identidad SofLIA" onSetChatInput={setProject} onSubmit={() => {}} /></section>
  </>;
}
createRoot(document.getElementById('root')!).render(<Integration />);
