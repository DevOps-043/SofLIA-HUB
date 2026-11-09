import {z} from 'zod';
import {holdingSchema} from '../shared/studio-program';
import type {StudioPreparedScene} from '../components/learning-live/instructor/studio-types';

const metadata=z.object({id:z.string().uuid(),name:z.string().min(1).max(60),kind:z.enum(['slide','screen','image','video','holding']),title:z.string().max(160),description:z.string().max(500),fileName:z.string().max(260).optional(),holding:holdingSchema.optional()}).strict();
export type SavedScene={scene:z.infer<typeof metadata>;blob?:Blob};
const queues=new Map<string,Promise<void>>();
const formats=new Set(['image/png','image/jpeg','image/webp','image/gif','image/avif','video/mp4','video/webm']);
export function sceneMetadata(scene:StudioPreparedScene){return metadata.parse({id:scene.id,name:scene.name,kind:scene.kind,title:scene.title,description:scene.description,...(scene.fileName?{fileName:scene.fileName}:{}),...(scene.holding?{holding:scene.holding}:{})},{jitless:true});}
export function validateSceneBank(value:unknown):SavedScene[]{
  if(!Array.isArray(value)||value.length>12)throw new Error('La preparación local no es compatible.');
  let bytes=0;
  const scenes=value.map(item=>{
    const scene=metadata.parse(item.scene,{jitless:true}),blob=item.blob as unknown;
    if(blob!==undefined&&(!(blob instanceof Blob)||!formats.has(blob.type)||blob.size>25*1024*1024))throw new Error('El archivo local no es compatible.');
    if(blob instanceof Blob)bytes+=blob.size;
    return {scene,...(blob instanceof Blob?{blob}:{})};
  });
  if(bytes>100*1024*1024||new Set(scenes.map(item=>item.scene.id)).size!==scenes.length)throw new Error('La preparación local supera sus límites.');
  return scenes;
}
function open():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('soflia-studio-preparation',1);
    let blocked=false;
    request.onupgradeneeded=()=>{request.result.createObjectStore('banks',{keyPath:'id'});};
    request.onsuccess=()=>{if(blocked){request.result.close();return;}request.result.onversionchange=()=>request.result.close();resolve(request.result);};
    request.onerror=()=>reject(new Error('No se pudo abrir la preparación local.'));
    request.onblocked=()=>{blocked=true;reject(new Error('Cierra las otras ventanas del estudio para recuperar la preparación.'));};
  });
}
export async function loadSceneBank(key:string):Promise<SavedScene[]>{
  await queues.get(key);
  const database=await open();
  try{
    return await new Promise<SavedScene[]>((resolve,reject)=>{
      const transaction=database.transaction('banks','readonly'),request=transaction.objectStore('banks').get(key);
      request.onsuccess=()=>{try{resolve(request.result?validateSceneBank(request.result.scenes):[]);}catch(error){reject(error);}};
      transaction.onerror=()=>reject(new Error('No se pudo leer la preparación local.'));
      transaction.onabort=()=>reject(new Error('No se pudo leer la preparación local.'));
    });
  }finally{database.close();}
}
export function saveSceneBank(key:string,scenes:SavedScene[]):Promise<void>{
  const valid=validateSceneBank(scenes);
  const pending=(queues.get(key)??Promise.resolve()).catch(()=>{}).then(async()=>{
    const database=await open();
    try{
      await new Promise<void>((resolve,reject)=>{
        const transaction=database.transaction('banks','readwrite');
        transaction.objectStore('banks').put({id:key,version:1,scenes:valid});
        transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(new Error('No se pudo guardar la preparación local.'));
        transaction.onabort=()=>reject(new Error('No se pudo guardar la preparación local.'));
      });
    }finally{database.close();}
  });
  queues.set(key,pending);
  void pending.finally(()=>{if(queues.get(key)===pending)queues.delete(key);}).catch(()=>{});
  return pending;
}
