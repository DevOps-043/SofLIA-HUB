import { describe,expect,it,vi,beforeEach } from 'vitest';
import { askParticipantTutor,participantTutorContext } from '../../services/participant-tutor';
import { emptyStudioState } from '../../shared/live-studio-domain';
import type { StudioSnapshot } from '../../shared/live-studio.contract';
import type { WorkspaceSnapshot } from '../../shared/learning-workspace.contract';
import { learningLiveService } from '../../services/learning-live-service';
const generate=vi.hoisted(()=>vi.fn());
vi.mock('../../services/gemini-chat/client',()=>({getGenAiClient:async()=>({models:{generateContentStream:generate}})}));
const access={reference:{organization_slug:'acme',session_id:'session'},userId:'student'};
let permission:WorkspaceSnapshot;
beforeEach(()=>{
  vi.clearAllMocks();
  permission={user_id:'student',session:{id:'session'},policy:{version:2,ai_enabled:true},consent:{policy_version:2,ai_enabled:true}} as WorkspaceSnapshot;
  vi.spyOn(learningLiveService,'workspace').mockImplementation(async()=>({success:true,snapshot:permission}));
});
describe('Soflia tutora de la sesión',()=>{
  it('proyecta solo título y práctica elegida, nunca respuestas, mensajes o assets',()=>{
    const state=emptyStudioState();state.practices=[{id:'p',title:'Práctica',instructions:'Pasos'}];state.quizzes=[{id:'q',question:'Secreto',options:['a','b'],correct:1}];
    const context=participantTutorContext({title:'Clase',state,asset_urls:{private:'url'}} as unknown as StudioSnapshot,'p');
    expect(context).toEqual({title:'Clase',practice:{title:'Práctica',instructions:'Pasos'}});expect(JSON.stringify(context)).not.toMatch(/Secreto|private|correct/);
  });
  it('genera texto sin herramientas, con señal de cancelación y límites',async()=>{
    generate.mockResolvedValue((async function*(){yield{text:'Una '};yield{text:'pista'};})());const chunks=vi.fn();const signal=new AbortController().signal;
    expect(await askParticipantTutor('Ayuda',[],{title:'Clase'},signal,chunks,access)).toBe('Una pista');
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({config:expect.objectContaining({tools:[],abortSignal:signal,maxOutputTokens:1500})}));expect(chunks).toHaveBeenLastCalledWith('Una pista');
  });
  it('rechaza entrada larga y cancelación antes de solicitar IA',async()=>{
    const controller=new AbortController();controller.abort();await expect(askParticipantTutor('Ayuda',[],{title:'Clase'},controller.signal,vi.fn())).rejects.toThrow();
    await expect(askParticipantTutor('x'.repeat(2001),[],{title:'Clase'},new AbortController().signal,vi.fn())).rejects.toThrow('2000');expect(generate).not.toHaveBeenCalled();
  });
  it.each(['sin acceso','otra identidad','otra sesión','IA deshabilitada','sin consentimiento','consentimiento anterior'])('bloquea envío antes del proveedor: %s',async(reason)=>{
    if(reason==='otra identidad') permission.user_id='other';
    if(reason==='otra sesión') permission.session.id='other';
    if(reason==='IA deshabilitada') permission.policy.ai_enabled=false;
    if(reason==='sin consentimiento') permission.consent=null;
    if(reason==='consentimiento anterior') permission.consent!.policy_version=1;
    await expect(askParticipantTutor('Ayuda',[],{title:'Clase'},new AbortController().signal,vi.fn(),reason==='sin acceso'?undefined:access)).rejects.toThrow(/política|habilite/);
    expect(generate).not.toHaveBeenCalled();
  });
});
