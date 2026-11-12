import sharp from 'sharp';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const ffmpeg=process.argv[2];const ffprobe=process.argv[3];
if(!ffmpeg||!ffprobe)throw Error('Proporciona las rutas verificadas de FFmpeg y FFprobe');
function run(executable,args){const result=spawnSync(executable,args,{encoding:'utf8',windowsHide:true,maxBuffer:8e6});if(result.status!==0)throw Error(result.stderr||result.error?.message||'Falló un proceso multimedia');return result.stdout;}
const states={idle:4,listening:3,thinking:3,speaking:3,success:2,warning:2};
const reports=[];
for(const folder of ['animations/gifs','animations/webm','build','previews'])await mkdir(root+folder,{recursive:true});
for(const [state,duration] of Object.entries(states)){
  const frames=root+`animations/frames/${state}/%04d.png`;
  const gif=root+`animations/gifs/${state}.gif`,webm=root+`animations/webm/${state}.webm`;
  run(ffmpeg,['-v','error','-y','-framerate','24','-i',frames,'-filter_complex','[0:v]split[a][b];[a]palettegen=reserve_transparent=1:stats_mode=full[p];[b][p]paletteuse=alpha_threshold=128:dither=sierra2_4a','-loop',state==='success'||state==='warning'?'-1':'0',gif]);
  run(ffmpeg,['-v','error','-y','-framerate','24','-i',frames,'-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','30','-deadline','good','-cpu-used','4','-auto-alt-ref','0',webm]);
  const decoded=root+`build/${state}-alpha.png`;
  run(ffmpeg,['-v','error','-y','-c:v','libvpx-vp9','-i',webm,'-frames:v','1',decoded]);
  const metadata=JSON.parse(run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',webm]));
  const stream=metadata.streams[0];const image=await sharp(decoded).stats();const alpha=image.channels[3];
  if(!alpha||alpha.min!==0||alpha.max!==255)throw Error(`No se conserva transparencia real en ${state}`);
  const gifMeta=await sharp(gif,{animated:true}).metadata();
  if(stream.width!==512||stream.height!==512||gifMeta.width!==512||gifMeta.pageHeight!==512)throw Error(`Resolución incorrecta: ${state}`);
  if(Math.abs(Number(metadata.format.duration)-duration)>.09)throw Error(`Duración incorrecta: ${state}`);
  const source=await sharp(root+`previews/state_${state}.png`).resize(160,160).png().toBuffer();
  await writeFile(root+`previews/thumbnail_${state}.png`,source);
  reports.push({state,duration,width:stream.width,height:stream.height,frames:duration*24,gifBytes:(await stat(gif)).size,webmBytes:(await stat(webm)).size,webmAlpha:{min:alpha.min,max:alpha.max,tag:stream.tags?.alpha_mode,decoder:'libvpx-vp9'},gifPages:gifMeta.pages});
}
for(const [name,color] of [['dark','#061725'],['light','#edf5f5']])await sharp(root+'previews/avatar_front.png').flatten({background:color}).toFile(root+`previews/avatar_${name}_background.png`);
const tiles=await Promise.all(Object.keys(states).map(async(state,i)=>({input:await sharp(root+`previews/state_${state}.png`).resize(256,256).png().toBuffer(),left:i%3*256,top:Math.floor(i/3)*256})));
await sharp({create:{width:768,height:512,channels:4,background:'#061725'}}).composite(tiles).png().toFile(root+'previews/all-states.png');
await writeFile(root+'build/media-validation.json',JSON.stringify(reports,null,2));
console.info('Verificados seis GIF, seis WebM VP9 con alfa decodificado, PNG y miniaturas.');
