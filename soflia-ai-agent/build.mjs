/** Detectar herramientas sin modificar instalaciones ni configuración global. */
import { spawnSync } from 'node:child_process';
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
async function exists(file){try{await access(file);return true;}catch{return false;}}
async function detect(name,explicit,candidates){
  const where=spawnSync('where.exe',[name],{encoding:'utf8',windowsHide:true});
  const options=[explicit,...(where.status===0?where.stdout.trim().split(/\r?\n/):[]),...candidates].filter(Boolean);
  for(const file of options)if(await exists(file))return file;
  throw Error(`No se encontró ${name}; especifica su ruta mediante variable de entorno.`);
}
function run(executable,args){const result=spawnSync(executable,args,{cwd:root,stdio:'inherit',windowsHide:true});if(result.status!==0)throw Error(`Falló ${path.basename(executable)} (${result.status}): ${result.error?.message||''}`);}
await mkdir(root+'build',{recursive:true});await writeFile(root+'build/write-check.txt','Escritura local comprobada.');
const foundation=path.join(process.env.ProgramFiles||'C:/Program Files','Blender Foundation');
const versions=await readdir(foundation).catch(()=>[]);
const blender=await detect('blender.exe',process.env.BLENDER_BIN,versions.sort().reverse().map(version=>path.join(foundation,version,'blender.exe')));
const mediaCandidates=[1,2,3,4].map(depth=>path.resolve(root,...Array(depth).fill('..'),'media-runtime/ffmpeg.exe'));
const ffmpeg=await detect('ffmpeg.exe',process.env.FFMPEG_BIN,mediaCandidates).catch(()=>null);
const ffprobe=ffmpeg?await detect('ffprobe.exe',process.env.FFPROBE_BIN,[path.join(path.dirname(ffmpeg),'ffprobe.exe')]).catch(()=>null):null;
const references={};
for(const name of ['avatar-approved.png','identity-and-states.png','logo-original.png'])references[name]=createHash('sha256').update(await readFile(root+'references/'+name)).digest('hex');
const version=spawnSync(blender,['--version'],{encoding:'utf8',windowsHide:true}).stdout.split(/\r?\n/)[0];
await writeFile(root+'build/environment.json',JSON.stringify({blender,version,ffmpeg,ffprobe,node:process.version,platform:process.platform,references},null,2));
run(process.execPath,[root+'build-logo.mjs']);
// La corrección prioritaria retiene animaciones y optimización hasta validar la base.
run(blender,['--background','--factory-startup','--python-exit-code','1','--python',root+'blender/scripts/rebuild_base.py']);
