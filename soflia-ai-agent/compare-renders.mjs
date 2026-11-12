import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const views=[['front','Frente'],['three_quarter_left','Tres cuartos izquierdo'],['three_quarter_right','Tres cuartos derecho'],['side_right','Lateral derecho'],['side_left','Lateral izquierdo'],['back','Posterior · interpretación volumétrica'],['top','Superior']];
const tiles=[{path:'references/avatar-approved.png',label:'Referencia conceptual aprobada'},...views.map(([name,label])=>({path:`previews/reconstruction/${name}.png`,label}))];
const composite=[];
for(let i=0;i<tiles.length;i++){
  const image=await sharp(root+tiles[i].path).resize(512,512,{fit:'contain',background:'#071727'}).flatten({background:'#071727'}).png().toBuffer();
  const label=Buffer.from(`<svg width="512" height="40"><rect width="512" height="40" fill="#102a3b"/><text x="16" y="26" font-family="Segoe UI, sans-serif" font-size="15" fill="#d8ecef">${tiles[i].label}</text></svg>`);
  const left=i%4*512,top=Math.floor(i/4)*552;composite.push({input:image,left,top},{input:label,left,top:top+512});
}
await sharp({create:{width:2048,height:1104,channels:3,background:'#071727'}}).composite(composite).png().toFile(root+'previews/reconstruction/seven-view-comparison.png');
for(const [name] of views)for(const [theme,color] of [['dark','#071727'],['light','#edf4f4']])await sharp(root+`previews/reconstruction/${name}.png`).flatten({background:color}).toFile(root+`previews/reconstruction/${name}_${theme}.png`);
const triple=[];
for(const [i,item] of [{path:'references/avatar-approved.png',label:'Referencia aprobada'},{path:'previews/reconstruction/front.png',label:'Blender · base sin bloom'},{path:'previews/reconstruction/three-front.png',label:'Three.js · misma proyección, sin bloom'}].entries()){
  triple.push({input:await sharp(root+item.path).resize(640,640,{fit:'contain',background:'#071727'}).flatten({background:'#071727'}).png().toBuffer(),left:i*640,top:0});
  triple.push({input:Buffer.from(`<svg width="640" height="42"><rect width="640" height="42" fill="#102a3b"/><text x="16" y="28" font-family="Segoe UI, sans-serif" font-size="17" fill="#d8ecef">${item.label}</text></svg>`),left:i*640,top:640});
}
await sharp({create:{width:1920,height:682,channels:3,background:'#071727'}}).composite(triple).png().toFile(root+'previews/reconstruction/reference-blender-three.png');
await writeFile(root+'build/comparison-views.json',JSON.stringify(views.map(([name,label])=>({name,label,blender:`previews/reconstruction/${name}.png`})),null,2));
