import { createRoot } from 'react-dom/client';
import { useRef, useState } from 'react';
import { BrowserHomePage } from '../../../src/components/browser/BrowserHomePage';
import { EmptyChatState } from '../../../src/adapters/desktop_ui/chat-ui/EmptyChatState';
import { ChatAvatarProvider, ChatComposerPresence } from '../../../src/adapters/desktop_ui/chat-ui/ChatAvatar';
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
          {history ? <><div className="qa-messages"><p>Prepara una propuesta para mi proyecto.</p><p>Vamos a darle forma. Podemos empezar por el objetivo y los resultados que quieres conseguir.</p></div><ChatComposerPresence /></> : <EmptyChatState />}
          <input className="qa-composer" aria-label="Mensaje a SofLIA" placeholder="Escribe a SofLIA…" value={draft} onChange={event => setDraft(event.target.value)} />
        </ChatAvatarProvider>
      </aside>
      <div className="qa-home"><BrowserHomePage onNavigate={() => {}} /></div>
    </div>
    <section className="qa-project"><h2>Proyecto · Identidad SofLIA</h2><p>El mismo personaje acompaña el inicio de una conversación del proyecto.</p><ProjectChatInput canEditFolder chatInput={project} chatInputRef={input} folderName="Identidad SofLIA" onSetChatInput={setProject} onSubmit={() => {}} /></section>
  </>;
}
createRoot(document.getElementById('root')!).render(<Integration />);
