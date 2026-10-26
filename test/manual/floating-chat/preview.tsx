/** Fixture aislada: compositor real con controlador simulado; no envía datos. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/index.css';
import { FloatingSofliaChat } from '../../../src/components/floating-chat/FloatingSofliaChat';
import { FloatingProjectChatStart } from '../../../src/components/floating-chat/FloatingProjectChatStart';
import { ChatInputArea } from '../../../src/adapters/desktop_ui/chat-ui/ChatInputArea';
import type { ChatUIController } from '../../../src/adapters/desktop_ui/chat-ui/useChatUIController';

const noop = () => undefined;
export function Preview() {
  const [draft,setDraft]=useState(''),[tools,setTools]=useState(false),[missing,setMissing]=useState(false),[messages,setMessages]=useState<string[]>([]);
  const controller={
    props:{compact:true,floating:true,canSendMessages:true}, runtime:{chat:{showLoadingUI:false}},
    state:{input:{value:draft,set:setDraft},modes:{imageGen:false,promptOptimizer:false},skillModals:{},selection:{value:null},tools:{isOpen:tools,setOpen:setTools},images:{selected:[]}},
    skillCommands:{visible:false,handleKeyDown:()=>false},files:{handlePaste:noop},
    dictation:{isRecording:false,isTranscribing:false,toggleDictation:noop},
    onSendClick:()=>{if(draft.trim()){setMessages(value=>[...value,draft]);setDraft('');}},
  } as unknown as ChatUIController;
  return <main style={{position:'relative',height:'100dvh',padding:36,background:'var(--color-background-val)',color:'var(--color-primary-val)'}}>
    <div data-testid="qa-toolbar" style={{position:'absolute',zIndex:50,top:0,left:0,right:0,height:80,background:'var(--color-surface-2-val)',padding:24,fontSize:12}}>Barra superior simulada para comprobar superposición</div>
    <h1 style={{fontSize:24,fontWeight:600}}>Tareas del proyecto</h1><p style={{marginTop:12,color:'var(--color-text-secondary-val)'}}>Superficie de prueba sin datos reales.</p>
    <button onClick={()=>setMissing(true)} style={{marginTop:20}}>Simular pérdida de selección</button>
    <FloatingSofliaChat title="Soflia Hub" onNewChat={async()=>{setDraft('');setMessages([]);setMissing(false);}}>
      {missing ? <FloatingProjectChatStart canCreate onStart={async()=>setMissing(false)} /> : <div className="soflia-floating-chat-ui" data-floating-has-messages={messages.length ? 'true':undefined} style={{display:'flex',flex:1,minHeight:0,flexDirection:'column'}}>
        {messages.length>0 && <div style={{flex:1,overflow:'auto',padding:12,fontSize:12}}>{messages.map((message,index)=><p key={index}>{message}</p>)}</div>}
        <ChatInputArea controller={controller} />
      </div>}
    </FloatingSofliaChat>
  </main>;
}
document.documentElement.classList.add('dark');
createRoot(document.getElementById('root')!).render(<Preview />);
