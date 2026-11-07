import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {useStudioProgram} from '../../components/learning-live/instructor/useStudioProgram';
import {StudioProgramControls} from '../../components/learning-live/instructor/StudioProgramControls';
vi.mock('../../services/studio-output',()=>({connectProgramOutput:async()=>()=>{}}));
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('permisos y cancelación de composición',()=>{
  it('exige detener compartir antes de activar otra pista de audio',()=>{
    const audio=vi.fn();
    render(<StudioProgramControls camera={false} pending={false} audio={false} audioAvailable sharing label="" onCamera={()=>{}} onAudio={audio} onLabel={()=>{}}/>);
    const button=screen.getByRole('button',{name:'Activar audio de videos'});
    expect(button).toBeDisabled();fireEvent.click(button);expect(audio).not.toHaveBeenCalled();
  });
  it('apaga inmediatamente una cámara que sigue esperando loadeddata al cerrar salida',async()=>{
    const stop=vi.fn(),track={stop,readyState:'live'};
    const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn(async()=>stream)}});
    vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
    vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1));vi.stubGlobal('cancelAnimationFrame',vi.fn());
    function Fixture(){
      const program=useStudioProgram();
      return <><canvas ref={element=>{if(element)element.captureStream=()=>({getTracks:()=>[],getVideoTracks:()=>[]}) as unknown as MediaStream;program.bindCanvas(element);}}/><button onClick={()=>void program.take({id:'lamina',name:'Lámina',kind:'slide',title:'Clase',description:''},true)}>Preparar</button><button onClick={()=>void program.toggleCamera()}>Cámara</button><button onClick={program.stop}>Cerrar salida</button></>;
    }
    const view=render(<Fixture/>);
    await act(async()=>{fireEvent.click(screen.getByText('Preparar'));await Promise.resolve();});
    await act(async()=>{fireEvent.click(screen.getByText('Cámara'));await Promise.resolve();});
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    await act(async()=>{fireEvent.click(screen.getByText('Cerrar salida'));await Promise.resolve();});
    expect(stop).toHaveBeenCalled();view.unmount();
  });
});
