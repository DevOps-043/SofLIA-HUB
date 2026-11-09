import {describe,expect,it} from 'vitest';
import {sceneMetadata,validateSceneBank} from '../../services/studio-scene-store';
describe('preparación local y permisos efímeros',()=>{
  const scene={id:'00000000-0000-4000-8000-000000000001',name:'Pantalla',title:'Mi clase',description:'Descripción',kind:'screen' as const};
  it('conserva edición sin persistir URLs ni permisos de captura',()=>{
    const result=sceneMetadata({...scene,assetUrl:'https://privado.test/?token=secreto',capture:{id:'permiso'} as never});
    expect(result).toEqual(scene);
    expect(JSON.stringify(result)).not.toMatch(/secreto|permiso/);
  });
  it('rechaza almacenamiento manipulado y archivos no admitidos',()=>{
    expect(()=>validateSceneBank([{scene:{...scene,assetUrl:'blob:ajeno'}}])).toThrow();
    expect(()=>validateSceneBank([{scene,blob:new Blob(['x'],{type:'text/html'})}])).toThrow();
    expect(()=>validateSceneBank([{scene},{scene}])).toThrow();
    expect(validateSceneBank([{scene,blob:new Blob(['imagen'],{type:'image/png'})}])).toHaveLength(1);
  });
});
