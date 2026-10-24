import { act,render,screen } from '@testing-library/react';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { StudioZoomFrame } from '../../components/learning-live/instructor/StudioZoomFrame';

afterEach(()=>{delete window.learningLive;});
describe('frontera audiovisual del aula',()=>{
  it('valida origen, ventana, nonce y tamaño antes de mostrar captions o capacidades',()=>{
    const onControls=vi.fn(),onCaption=vi.fn();
    const view=render(<StudioZoomFrame join={{meetingNumber:'123456789',signature:'firma',userName:'Alumno',password:'',recording_required:true,recording_recovery_allowed:false}} onStatus={vi.fn()} onMedia={vi.fn()} onShare={vi.fn()} onControls={onControls} onCaption={onCaption} participant/>);
    const frame=screen.getByTitle('Sesión audiovisual integrada') as HTMLIFrameElement;
    vi.spyOn(frame.contentWindow!,'postMessage').mockImplementation(()=>{});
    const nonce=frame.src.split('#')[1];
    function emit(type:string,detail:unknown,origin=location.origin,source:MessageEventSource|null=frame.contentWindow,token=nonce){act(()=>window.dispatchEvent(new MessageEvent('message',{origin,source,data:{source:'soflia-zoom',nonce:token,type,detail}})));}
    emit('caption',{text:'Privado',speaker:'A'},'https://otro.test');emit('caption',{text:'Privado',speaker:'A'},location.origin,window);emit('caption',{text:'Privado',speaker:'A'},location.origin,frame.contentWindow,'incorrecto');emit('caption',{text:'x'.repeat(2001),speaker:'A'});
    expect(onCaption).not.toHaveBeenCalled();
    emit('call-controls',{camera:true,captions:true,captionsEnabled:false,admin:true});expect(onControls).not.toHaveBeenCalled();
    emit('caption',{text:'Subtítulo real',speaker:'Docente'});emit('call-controls',{camera:true,captions:true,captionsEnabled:true});
    expect(onCaption).toHaveBeenCalledWith({text:'Subtítulo real',speaker:'Docente'});expect(onControls).toHaveBeenCalledWith({camera:true,captions:true,captionsEnabled:true});view.unmount();
  });
});
