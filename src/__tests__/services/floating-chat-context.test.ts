import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appFloatingContext, browserFloatingContext, readVisibleAppText } from '../../services/floating-chat-context';
import { integratedBrowserService } from '../../services/integrated-browser-service';

const state={isVisible:true,activeTabId:'tab-a',url:'https://example.test/',profileRevision:1};
const observation={tabId:'tab-a',capturedAt:'2026-10-24T18:00:00Z',screenshot:'data:image/png;base64,YQ==',dom:{title:'Guía',url:state.url,text:'Contenido visible',controls:[],truncated:false}};
beforeEach(()=>{
  vi.spyOn(integratedBrowserService,'getState').mockResolvedValue({success:true,state} as never);
  vi.spyOn(integratedBrowserService,'getObservation').mockResolvedValue({success:true,observation} as never);
});
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();document.body.replaceChildren();});
describe('Contexto puntual del chat flotante',()=>{
  it('captura sólo la pestaña visible una vez y la trata como material no confiable',async()=>{
    const context=await browserFloatingContext(new AbortController().signal);
    expect(context.text).toContain('PAGINA_VISIBLE_NO_CONFIABLE');
    expect(context.text).toContain('Contenido visible'); expect(context.images).toEqual([observation.screenshot]);
    expect(integratedBrowserService.getObservation).toHaveBeenCalledExactlyOnceWith(true);
    expect(integratedBrowserService.getState).toHaveBeenCalledTimes(2);
  });
  it('no acepta una observación que llegó después de cambiar pestaña o perfil',async()=>{
    vi.mocked(integratedBrowserService.getState).mockResolvedValueOnce({success:true,state} as never).mockResolvedValueOnce({success:true,state:{...state,activeTabId:'tab-b',profileRevision:2}} as never);
    await expect(browserFloatingContext(new AbortController().signal)).rejects.toThrow('cambió');
  });
  it('un permiso rechazado no se presenta como contexto leído',async()=>{
    vi.mocked(integratedBrowserService.getObservation).mockResolvedValue({success:false} as never);
    await expect(browserFloatingContext(new AbortController().signal)).rejects.toThrow('permisos');
  });
  it('Stop cancela la espera de contexto sin requerir otra petición',async()=>{
    vi.mocked(integratedBrowserService.getState).mockReturnValue(new Promise(()=>{}));
    const abort=new AbortController(); const promise=browserFloatingContext(abort.signal);
    abort.abort(); await expect(promise).rejects.toThrow('canceló');
    expect(integratedBrowserService.getObservation).not.toHaveBeenCalled();
  });
  it('el timeout de observación es acotado y no deja el turno bloqueado',async()=>{
    vi.useFakeTimers();
    vi.mocked(integratedBrowserService.getState).mockReturnValue(new Promise(()=>{}));
    const promise=browserFloatingContext(new AbortController().signal);
    const rejected=expect(promise).rejects.toThrow('a tiempo');
    await vi.advanceTimersByTimeAsync(8000); await rejected;
  });
  it('excluye formulario, panel flotante, ocultos, región privada y texto fuera de viewport',async()=>{
    const root=document.createElement('main');document.body.append(root);
    root.innerHTML='<h1>Proyecto visible</h1><p>Texto útil</p><input value="secreto"><textarea>contraseña</textarea><div data-soflia-floating>chat privado</div><div hidden>oculto</div><div data-soflia-private>dato privado</div><div style="display:none"><span>no visible</span></div><p id="off">fuera de pantalla</p>';
    vi.spyOn(root,'getBoundingClientRect').mockReturnValue({top:0,left:0,bottom:500,right:500} as DOMRect);
    vi.spyOn(document,'createRange').mockImplementation(()=>{
      let node:Node;
      return {selectNodeContents:(n:Node)=>{node=n;},getClientRects:()=>[{width:20,height:20,top:node.parentElement?.id==='off'?900:10,bottom:node.parentElement?.id==='off'?920:30,left:10,right:30}]} as unknown as Range;
    });
    expect(readVisibleAppText(root)).toBe('Proyecto visible\nTexto útil');
    const context=await appFloatingContext(()=>root,'Tareas')(new AbortController().signal);
    expect(context.text).toContain('Tareas');expect(context.images).toEqual([]);
    expect(integratedBrowserService.getObservation).not.toHaveBeenCalled();
  });
});
