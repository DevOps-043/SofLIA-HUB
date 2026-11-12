import { ACESFilmicToneMapping, AmbientLight, Color, DirectionalLight, Mesh, OrthographicCamera, PMREMGenerator, Scene, Vector2, WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import modelUrl from '../assets/glb/soflia_agent_base.glb?url';
import referenceUrl from '../references/avatar-approved.png?url';
import blenderUrl from '../previews/reconstruction/front.png?url';
import './base.css';

document.querySelector('#app')!.innerHTML=`<header><b>SofLIA</b><span>Reconstrucción base · Revisión visual</span></header><main><h1>Referencia, forma y material.</h1><p>Comparación frontal sin bloom. La vista posterior es una hipótesis de modelado; la base sigue en revisión.</p><div class="comparison"><figure><img src="${referenceUrl}" alt="Concepto original aprobado"><figcaption>01 · Referencia aprobada</figcaption></figure><figure><img id="blender" src="${blenderUrl}" alt="Modelo Blender reconstruido"><figcaption>02 · Geometría Blender · Sin efectos</figcaption></figure><figure><div id="viewer"></div><figcaption>03 · Modelo Three.js · Interactivo</figcaption></figure></div><section><div class="views"><button data-view="front">Frente</button><button data-view="three_quarter">45 grados</button><button data-view="side">Lateral</button><button data-view="back">Posterior</button></div><div class="options"><label><input id="effects" type="checkbox"> Bloom moderado</label><label><input id="light-background" type="checkbox"> Fondo claro</label><label>Iluminación <input id="illumination" type="range" min="0.2" max="2" value="1" step="0.1"></label></div></section><p id="status">Cargando geometría real…</p><small>Las animaciones y exportaciones de producción están retenidas durante la corrección de la base.</small></main>`;
const host=document.querySelector<HTMLElement>('#viewer')!;
const renderer=new WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.setSize(768,768,false);renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.info.autoReset=false;
host.append(renderer.domElement);
const scene=new Scene();scene.background=new Color('#071727');
const camera=new OrthographicCamera(-1.375,1.375,1.375,-1.375,.1,20);camera.position.set(0,-.093,6);camera.lookAt(0,-.093,0);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,-.093,0);controls.enablePan=false;controls.enableDamping=false;controls.update();
const key=new DirectionalLight(0x8cb9ff,1.4);key.position.set(-3,5,4);scene.add(key);
const fill=new AmbientLight(0xb1d9ed,.6);scene.add(fill);
const rim=new DirectionalLight(0x11cddd,2);rim.position.set(3,3,-2);scene.add(rim);
const room=new RoomEnvironment();const pmrem=new PMREMGenerator(renderer),environment=pmrem.fromScene(room,.05);room.dispose();pmrem.dispose();scene.environment=environment.texture;scene.environmentIntensity=.35;
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new Vector2(768,768),.08,.1,1.5);composer.addPass(bloom);composer.addPass(new OutputPass());
let effects=false,disposed=false,frames=0;const start=performance.now();
const gltf=await new GLTFLoader().loadAsync(modelUrl);scene.add(gltf.scene);const loadMs=performance.now()-start;
let triangles=0;gltf.scene.traverse(object=>{if(object instanceof Mesh)triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3;});
function render():void{if(disposed)return;renderer.info.reset();if(effects)composer.render();else renderer.render(scene,camera);frames++;document.querySelector('#status')!.textContent=`${Math.round(triangles).toLocaleString('es')} triángulos del modelo · ${renderer.info.render.calls} llamadas de dibujo · ${(loadMs/1000).toFixed(2)} s de carga · Render bajo demanda`;}
function view(name:string):void{const positions:Record<string,[number,number,number]>={front:[0,-.093,6],three_quarter:[4.2426,-.093,4.2426],side:[6,-.093,0],back:[0,-.093,-6]};if(!Object.hasOwn(positions,name))throw Error('Vista desconocida');camera.position.set(...positions[name]);controls.update();render();}
controls.addEventListener('change',render);
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-view]'))button.addEventListener('click',()=>view(button.dataset.view!));
document.querySelector('#effects')!.addEventListener('change',event=>{effects=(event.target as HTMLInputElement).checked;render();});
document.querySelector('#light-background')!.addEventListener('change',event=>{const light=(event.target as HTMLInputElement).checked;scene.background=new Color(light?'#edf4f4':'#071727');document.body.classList.toggle('light',light);render();});
document.querySelector('#illumination')!.addEventListener('input',event=>{const value=Number((event.target as HTMLInputElement).value);key.intensity=1.4*value;rim.intensity=2*value;fill.intensity=.6*value;render();});
async function benchmark(withEffects:boolean):Promise<unknown>{
  effects=withEffects;const began=performance.now();let count=0,cpu=0;const gl=renderer.getContext() as WebGL2RenderingContext;const extension=gl.getExtension('EXT_disjoint_timer_query_webgl2');const samples:WebGLQuery[]=[];
  await new Promise<void>(resolve=>{const tick=()=>{if(performance.now()-began>=3000){resolve();return;}const query=extension?gl.createQuery():null;if(query)gl.beginQuery(extension.TIME_ELAPSED_EXT,query);const before=performance.now();render();cpu+=performance.now()-before;if(query){gl.endQuery(extension.TIME_ELAPSED_EXT);samples.push(query);}count++;requestAnimationFrame(tick);};requestAnimationFrame(tick);});
  await new Promise(resolve=>setTimeout(resolve,200));const gpu:number[]=[];
  for(const query of samples){if(!gl.getParameter(extension.GPU_DISJOINT_EXT)&&gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))gpu.push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(query);}
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  return{effects:withEffects,fps:count*1000/(performance.now()-began-200),cpuSubmitMs:cpu/count,gpuMs:gpu.length?gpu.reduce((a,b)=>a+b,0)/gpu.length:null,gpuTimerSupported:!!extension,modelTriangles:triangles,renderTriangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,memory:renderer.info.memory,loadMs,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
}
render();Object.assign(window,{baseReview:{view,render,benchmark,frames:()=>frames,scene,camera,renderer,model:gltf.scene}});
window.addEventListener('pagehide',()=>{disposed=true;controls.dispose();environment.dispose();for(const pass of composer.passes)pass.dispose();composer.dispose();gltf.scene.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});renderer.dispose();},{once:true});
