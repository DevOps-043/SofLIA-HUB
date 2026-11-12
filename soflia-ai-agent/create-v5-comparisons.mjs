import sharp from 'sharp';
import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const items=[
  ['build/before-v5/reconstruction/side_left.png','V4 · lateral izquierdo'],
  ['previews/reconstruction/side_left.png','V5 · lateral izquierdo'],
  ['build/before-v5/reconstruction/side_right.png','V4 · lateral derecho'],
  ['previews/reconstruction/side_right.png','V5 · lateral derecho'],
];
const layers=[];
for(const [index,[path,label]] of items.entries()){
  const left=index%2*640,top=Math.floor(index/2)*682;
  layers.push({input:await sharp(root+path).resize(640,640).flatten({background:'#071727'}).png().toBuffer(),left,top});
  layers.push({input:Buffer.from(`<svg width="640" height="42"><rect width="640" height="42" fill="#102a3b"/><text x="16" y="28" font-family="Segoe UI,sans-serif" font-size="17" fill="#d8ecef">${label}</text></svg>`),left,top:top+640});
}
await sharp({create:{width:1280,height:1364,channels:3,background:'#071727'}}).composite(layers).png().toFile(root+'previews/reconstruction/lateral-comparison-v5.png');
await copyFile(root+'previews/reconstruction/seven-view-comparison.png',root+'previews/reconstruction/seven-view-comparison-v5.png');
await copyFile(root+'blender/master/soflia_agent_reconstructed_base.blend',root+'blender/master/soflia_agent_base_v5.blend');
await copyFile(root+'assets/glb/soflia_agent_base.glb',root+'assets/glb/soflia_agent_base_v5.glb');
